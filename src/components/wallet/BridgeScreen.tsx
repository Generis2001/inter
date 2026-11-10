import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { ArrowDownLeft, ArrowUpRight, ArrowDown, Check, Loader2, ExternalLink, RefreshCw, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useWallet } from '../../context/WalletContext'
import { useNetwork } from '../../context/NetworkContext'
import { useBridge } from '../../context/BridgeContext'
import { getBridgeChain, getSecondaryChainId } from '../../utils/bridgeChains'
import { useBridgeChainBalances } from '../../hooks/useBridgeChainBalances'
import { isBridgePending, type BridgeOperation } from '../../utils/bridgeHistory'
import { estimateBridge, estimateReceiving, type BridgeEstimate, type ReceivingEstimate } from '../../services/cctp'
import { Amount } from '../../onchain-money'
import { buildTxExplorerUrl } from '../../onchain-facts'
import { useRequireTxPin } from '../../utils/securitySettings'
import { formatAddress } from '../../utils/wallet'
import { BottomSheet } from '../shared/BottomSheet'
import { PinVerificationModal } from '../shared/PinVerificationModal'
import { TokenIcon } from '../shared/TokenLogo'
import { TowerLogo } from '../shared/TowerLogo'
import { NetworkBadge } from '../shared/NetworkBadge'

const card = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }
const muted = { color: 'var(--muted)' }
const STATUS: Record<BridgeOperation['status'], string> = {
  approving: 'Approving USDC', 'ready-to-submit': 'Ready to send', submitting: 'Submitting',
  'source-pending': 'Confirming source transaction', attesting: 'Waiting for settlement',
  'ready-to-mint': 'Ready to receive USDC', minting: 'Receiving USDC',
  'destination-pending': 'Confirming receipt', complete: 'USDC received', failed: 'Bridge failed',
}
type Review = { quote: BridgeEstimate; existingId?: string } | { operation: BridgeOperation; receiving: ReceivingEstimate }

export function BridgeScreen() {
  const { account } = useWallet()
  const { chainId } = useNetwork()
  const bridge = useBridge()
  const [requirePin] = useRequireTxPin()
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<BridgeEstimate | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoting, setQuoting] = useState(false)
  const [revision, setRevision] = useState(0)
  const [review, setReview] = useState<Review | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [checkingReceive, setCheckingReceive] = useState(false)
  const generation = useRef(0)
  const externalId = getSecondaryChainId(chainId)
  const sourceId = direction === 'in' ? externalId : chainId
  const destinationId = direction === 'in' ? chainId : externalId
  const source = getBridgeChain(sourceId)
  const destination = getBridgeChain(destinationId)
  const pending = bridge.operations.find(isBridgePending)
  const scope = `${account?.address}:${sourceId}:${destinationId}:${amount}`
  const currentScope = useRef(scope)
  useLayoutEffect(() => { currentScope.current = scope }, [scope])

  const balances = useBridgeChainBalances(sourceId, account?.address)

  // Quote state synchronizes with the external network and a cancellable request.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    const id = ++generation.current
    const controller = new AbortController()
    setQuote(null); setQuoteError(''); setQuoting(false)
    let raw = 0n
    try { raw = Amount.parse(amount, 6).raw } catch { if (amount) setQuoteError('Use a positive amount with up to 6 decimal places.') }
    if (!account || raw <= 0n) return () => controller.abort()
    const timer = setTimeout(() => {
      setQuoting(true)
      void estimateBridge(sourceId, destinationId, account.address, raw, controller.signal).then(value => {
        if (generation.current === id && currentScope.current === scope) { setQuote(value); setQuoteError('') }
      }).catch((error: unknown) => {
        if (!controller.signal.aborted && generation.current === id) setQuoteError(error instanceof Error ? error.message.split('\n')[0] : 'Bridge estimate unavailable.')
      }).finally(() => { if (generation.current === id) setQuoting(false) })
    }, 400)
    return () => { ++generation.current; controller.abort(); clearTimeout(timer) }
  }, [scope, sourceId, destinationId, account, amount, revision])

  useEffect(() => { setReview(null); setPinOpen(false) }, [account?.address, chainId, direction])

  /* oxlint-enable react/set-state-in-effect */

  const currentQuote = quote && quote.sourceChainId === sourceId && quote.destinationChainId === destinationId &&
    quote.wallet.toLowerCase() === account?.address.toLowerCase() && (() => { try { return quote.amountRaw === Amount.parse(amount, 6).raw } catch { return false } })() ? quote : null
  const validation = currentQuote ? currentQuote.balanceRaw < currentQuote.amountRaw ? 'Insufficient USDC on the source network.'
    : currentQuote.sourceNative < currentQuote.sourceGas ? `Add ${source.chain.nativeCurrency.symbol} on ${source.chain.name} for gas.`
    : currentQuote.destinationNative < currentQuote.destinationGas ? `Add ${destination.chain.nativeCurrency.symbol} on ${destination.chain.name} for the receiving transaction.`
    : direction === 'out' && currentQuote.balanceRaw < currentQuote.amountRaw + (currentQuote.sourceGas + 999_999_999_999n) / 1_000_000_000_000n ? 'Leave enough USDC on Arc for gas.' : '' : ''

  const execute = async () => {
    const selected = review
    setPinOpen(false); setReview(null)
    if (!selected) return
    try {
      if ('quote' in selected) await bridge.submit(selected.quote, selected.existingId)
      else await bridge.complete(selected.operation, selected.receiving)
      void balances.refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bridge transaction failed.')
      setRevision(value => value + 1)
    }
  }

  const continueBridge = async (operation: BridgeOperation) => {
    const requestedScope = currentScope.current
    try {
      const fresh = await estimateBridge(operation.sourceChainId, operation.destinationChainId, operation.wallet, BigInt(operation.amountRaw))
      if (requestedScope === currentScope.current) setReview({ quote: fresh, existingId: operation.id })
    } catch (error) { toast.error(error instanceof Error ? error.message.split('\n')[0] : 'Estimate unavailable.') }
  }

  const reviewReceiving = async (operation: BridgeOperation) => {
    const requestedScope = currentScope.current
    setCheckingReceive(true)
    try {
      const receiving = await estimateReceiving(operation)
      if (receiving.nativeBalance < receiving.gas) throw new Error(`Add ${getBridgeChain(operation.destinationChainId).chain.nativeCurrency.symbol} on ${getBridgeChain(operation.destinationChainId).chain.name} for gas.`)
      if (requestedScope === currentScope.current) setReview({ operation, receiving })
    } catch (error) { toast.error(error instanceof Error ? error.message.split('\n')[0] : 'Receiving estimate unavailable.') }
    finally { setCheckingReceive(false) }
  }

  const maxAmount = () => {
    if (!balances.data) return
    const reserve = direction === 'out' ? (balances.data.gasPrice * 500_000n + 999_999_999_999n) / 1_000_000_000_000n : 0n
    setAmount(formatUnits(balances.data.raw > reserve ? balances.data.raw - reserve : 0n, 6))
  }

  const reviewedQuote = review && 'quote' in review ? review.quote : null
  const reviewedOperation = review && 'operation' in review ? review.operation : null
  const reviewedSource = reviewedQuote ? getBridgeChain(reviewedQuote.sourceChainId) : reviewedOperation ? getBridgeChain(reviewedOperation.sourceChainId) : source
  const reviewedDestination = reviewedQuote ? getBridgeChain(reviewedQuote.destinationChainId) : reviewedOperation ? getBridgeChain(reviewedOperation.destinationChainId) : destination

  return <div className="mx-auto max-w-md px-4 pb-32 pt-3">
    <div className="mb-5 flex items-start justify-between gap-3">
      <div><h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Bridge USDC</h1><p className="mt-1 text-sm" style={muted}>Move your dollars into or out of Arc.</p></div>
      <NetworkBadge />
    </div>
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
      {(['in', 'out'] as const).map(value => <button key={value} onClick={() => setDirection(value)} aria-pressed={direction === value}
        className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold" style={direction === value ? card : muted}>
        {value === 'in' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}{value === 'in' ? 'Into Arc' : 'Out of Arc'}
      </button>)}
    </div>
    <div className="rounded-3xl p-5" style={card}>
      <div className="flex items-center justify-between"><span className="text-xs font-semibold" style={muted}>From</span><span className="text-sm font-bold">{source.chain.name}</span></div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <input aria-label="USDC bridge amount" inputMode="decimal" placeholder="0.00" value={amount}
          onChange={event => { if (/^\d*\.?\d{0,6}$/.test(event.target.value)) setAmount(event.target.value) }}
          className="display min-w-0 w-full bg-transparent text-4xl font-bold outline-none" />
        <span className="flex shrink-0 items-center gap-2 font-bold"><TokenIcon symbol="USDC" size={30} />USDC</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs" style={muted}>
        <span>{balances.isPending ? 'Loading balance…' : balances.isError ? 'Balance unavailable' : `Balance: ${Amount.fromRaw(balances.data?.raw ?? 0n, 6).toFixed(6)} USDC`}</span>
        <button className="font-bold disabled:opacity-40" style={{ color: 'var(--accent)' }} disabled={!balances.data || bridge.busy} onClick={maxAmount}>Max</button>
      </div>
      <div className="my-4 flex items-center gap-3"><div className="h-px flex-1" style={{ background: 'var(--border)' }} /><ArrowDown className="size-4" style={{ color: 'var(--accent)' }} /><div className="h-px flex-1" style={{ background: 'var(--border)' }} /></div>
      <div className="flex items-center justify-between"><span className="text-xs font-semibold" style={muted}>To</span><span className="text-sm font-bold">{destination.chain.name}</span></div>
      <p className="mt-4 text-2xl font-bold">{currentQuote ? `${formatUnits(currentQuote.amountRaw, 6)} USDC` : 'Enter an amount'}</p>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl p-3 text-xs" style={{ background: 'var(--surface-muted)' }}>
        <div><p style={muted}>Your Inter address on {destination.chain.name}</p><p className="mono mt-1 font-semibold">{formatAddress(account?.address)}</p></div>
        <button aria-label="Copy bridge receiving address" onClick={() => { if (account) void navigator.clipboard.writeText(account.address).then(() => toast.success('Receiving address copied')).catch(() => toast.error('Copy failed')) }}><Copy className="size-4" /></button>
      </div>
    </div>
    <p className="mt-3 text-xs leading-relaxed" style={muted}>Use USDC held at your Inter address on {source.chain.name}. You’ll confirm a second transaction to receive it on {destination.chain.name}.</p>
    {currentQuote && <div className="mt-4 space-y-3 rounded-2xl p-4 text-xs" style={card}>
      <Detail label="Bridge fee" value="0 USDC · Standard CCTP" />
      <Detail label={`${source.chain.name} gas estimate`} value={`${formatUnits(currentQuote.sourceGas, 18)} ${source.chain.nativeCurrency.symbol}`} />
      <Detail label={`${destination.chain.name} gas estimate`} value={`${formatUnits(currentQuote.destinationGas, 18)} ${destination.chain.nativeCurrency.symbol}`} />
      <Detail label="Estimated arrival" value={direction === 'in' ? 'About 15–25 minutes' : 'A few minutes'} />
    </div>}
    {(quoteError || validation) && <p role="alert" className="mt-3 rounded-xl p-3 text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)' }}>{quoteError || validation}</p>}
    <button disabled={!currentQuote || !!validation || !!pending || bridge.busy || quoting} onClick={() => currentQuote && setReview({ quote: currentQuote })}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-40" style={{ background: 'var(--accent)' }}>
      {(quoting || bridge.busy) && <Loader2 className="size-4 animate-spin" />}{bridge.busy ? 'Submitting transaction…' : quoting ? 'Checking bridge…' : pending ? 'Continue your saved bridge below' : 'Review bridge'}
    </button>
    <div className="mt-3 flex items-center justify-between text-xs" style={muted}>
      <a href="https://www.tower.exchange/bridge" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5"><TowerLogo size={14} />Tower Exchange · Circle CCTP<ExternalLink className="size-3" /></a>
      <button onClick={() => { setRevision(value => value + 1); void balances.refetch(); void bridge.refresh() }} aria-label="Refresh bridge"><RefreshCw className="size-4" /></button>
    </div>
    {bridge.operations.length > 0 && <div className="mt-7 space-y-3"><h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Your bridges</h2>
      {bridge.operations.map(operation => <div key={operation.id} className="rounded-2xl p-4" style={card}>
        <div className="flex items-center gap-3"><TokenIcon symbol="USDC" size={32} /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{formatUnits(BigInt(operation.amountRaw), 6)} USDC</p><p className="mt-0.5 text-xs" style={muted}>{getBridgeChain(operation.sourceChainId).chain.name} → {getBridgeChain(operation.destinationChainId).chain.name}</p></div>
          {operation.status === 'complete' ? <Check className="size-5" style={{ color: 'var(--success)' }} /> : isBridgePending(operation) ? <Loader2 className="size-4 animate-spin" style={{ color: 'var(--accent)' }} /> : null}</div>
        <p className="mt-3 text-xs font-bold" style={{ color: operation.status === 'failed' ? 'var(--danger)' : 'var(--accent)' }}>{STATUS[operation.status]}</p>
        {operation.error && <p className="mt-2 break-words text-xs" style={muted}>{operation.error}</p>}
        <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--accent)' }}>
          {operation.sourceHash && <a href={buildTxExplorerUrl(operation.sourceChainId, operation.sourceHash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">Source transaction<ExternalLink className="size-3" /></a>}
          {operation.destinationHash && <a href={buildTxExplorerUrl(operation.destinationChainId, operation.destinationHash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">Receiving transaction<ExternalLink className="size-3" /></a>}
        </div>
        {operation.status === 'ready-to-mint' && <button disabled={bridge.busy || checkingReceive} onClick={() => { void reviewReceiving(operation) }} className="mt-3 w-full rounded-xl py-3 text-xs font-bold text-white disabled:opacity-40" style={{ background: 'var(--accent)' }}>{checkingReceive ? 'Checking receiving fee…' : `Receive USDC on ${getBridgeChain(operation.destinationChainId).chain.name}`}</button>}
        {operation.status === 'ready-to-submit' && <button disabled={bridge.busy} onClick={() => { void continueBridge(operation) }} className="mt-3 w-full rounded-xl py-3 text-xs font-bold" style={{ background: 'var(--surface-muted)' }}>Continue bridge</button>}
        {operation.error && (operation.approvalSignedTransaction || operation.sourceSignedTransaction || operation.destinationSignedTransaction) && isBridgePending(operation) && <button disabled={bridge.busy} onClick={() => { void bridge.retryBroadcast(operation).catch(error => toast.error(error instanceof Error ? error.message.split('\n')[0] : 'Retry failed')) }} className="mt-3 text-xs font-bold" style={{ color: 'var(--accent)' }}>Retry the same transaction</button>}
      </div>)}
    </div>}
    <BottomSheet open={!!review} onClose={() => setReview(null)} title={reviewedOperation ? 'Receive your USDC' : 'Confirm bridge'}>
      <div className="space-y-4 px-4 pb-6">
        <div className="flex items-center gap-3"><TokenIcon symbol="USDC" size={40} /><p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{reviewedQuote ? formatUnits(reviewedQuote.amountRaw, 6) : reviewedOperation ? formatUnits(BigInt(reviewedOperation.amountRaw), 6) : ''} USDC</p></div>
        <Detail label="From" value={reviewedSource.chain.name} /><Detail label="To" value={reviewedDestination.chain.name} />
        <Detail label="Receiving address" value={formatAddress(account?.address)} />
        {reviewedQuote && <><Detail label="Approval" value="Exact amount only" /><Detail label="Source gas estimate" value={`${formatUnits(reviewedQuote.sourceGas, 18)} ${reviewedSource.chain.nativeCurrency.symbol}`} /><Detail label="Receiving gas estimate" value={`${formatUnits(reviewedQuote.destinationGas, 18)} ${reviewedDestination.chain.nativeCurrency.symbol}`} /></>}
        {review && 'receiving' in review && <Detail label="Receiving gas estimate" value={`${formatUnits(review.receiving.gas, 18)} ${reviewedDestination.chain.nativeCurrency.symbol}`} />}
        <p className="text-xs leading-relaxed" style={muted}>{reviewedOperation ? `This completes your existing bridge. You’ll pay the receiving network’s gas fee in ${reviewedDestination.chain.nativeCurrency.symbol}.` : `Once sent, the bridge is saved until you confirm receipt on ${reviewedDestination.chain.name}. Keep gas on both networks for the two transactions.`}</p>
        <button onClick={() => requirePin ? setPinOpen(true) : void execute()} disabled={bridge.busy} className="w-full rounded-2xl py-4 text-sm font-bold text-white" style={{ background: 'var(--accent)' }}>{requirePin ? 'Authorize with PIN' : reviewedOperation ? 'Confirm receiving transaction' : 'Confirm bridge'}</button>
      </div>
    </BottomSheet>
    <PinVerificationModal open={pinOpen} onClose={() => setPinOpen(false)} onSuccess={() => { void execute() }} actionLabel="Authorize bridge" />
  </div>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 text-xs"><span style={muted}>{label}</span><span className="max-w-[65%] break-words text-right font-semibold" style={{ color: 'var(--ink)' }}>{value}</span></div>
}
