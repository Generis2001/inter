import { Copy, RefreshCw, Route } from 'lucide-react'
import { toast } from 'sonner'
import { Amount } from '../../onchain-money'
import { useWallet } from '../../context/WalletContext'
import { useNetwork } from '../../context/NetworkContext'
import { useBridgeChainBalances } from '../../hooks/useBridgeChainBalances'
import { getBridgeChain, getSecondaryChainId } from '../../utils/bridgeChains'
import { requireChain } from '../../onchain-facts'
import { Skeleton } from '../shared/Skeleton'
import { TokenIcon } from '../shared/TokenLogo'

function displayBalance(raw: bigint, decimals: number, precision: number): string {
  const amount = Amount.fromRaw(raw, decimals)
  const minimum = 10n ** BigInt(decimals - precision)
  if (raw > 0n && raw < minimum) return `<${Amount.fromRaw(minimum, decimals).toString()}`
  return amount.toFixed(precision)
}

export function SecondaryChainBalances({ onBridge }: { onBridge?: () => void }) {
  const { account } = useWallet()
  const { chainId } = useNetwork()
  const secondaryId = getSecondaryChainId(chainId)
  const secondary = getBridgeChain(secondaryId)
  const facts = requireChain(secondaryId)
  const balances = useBridgeChainBalances(secondaryId, account?.address)

  return <section aria-label={`${secondary.chain.name} balances`} className="pt-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>Secondary chain</p>
        <p className="mt-1 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>
          <span className="size-2 rounded-full" style={{ background: '#0052ff' }} />{secondary.chain.name}
        </p>
        {account && <div className="mt-1 flex items-center gap-1.5">
          <span className="min-w-0 break-all font-mono text-[11px]" style={{ color: 'var(--subtle)' }}>
            {account.address}
          </span>
          <button aria-label={`Copy ${secondary.chain.name} wallet address`} className="shrink-0 rounded-lg p-1.5"
            style={{ color: 'var(--accent)' }} onClick={() => {
              void navigator.clipboard.writeText(account.address)
                .then(() => toast.success('Wallet address copied'))
                .catch(() => toast.error('Copy failed'))
            }}>
            <Copy className="size-3.5" />
          </button>
        </div>}
      </div>
      <button aria-label={`Refresh ${secondary.chain.name} balances`} onClick={() => { void balances.refetch() }}
        disabled={balances.isFetching} className="rounded-xl p-2 disabled:opacity-40" style={{ color: 'var(--subtle)' }}>
        <RefreshCw className={`size-4 ${balances.isFetching ? 'animate-spin' : ''}`} />
      </button>
    </div>
    <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {[
        { symbol: 'ETH' as const, name: 'Ethereum', detail: `Gas on ${secondary.chain.name}`, raw: balances.data?.native,
          decimals: secondary.chain.nativeCurrency.decimals, precision: 8 },
        { symbol: 'USDC' as const, name: 'USD Coin', detail: `USDC on ${secondary.chain.name}`, raw: balances.data?.raw,
          decimals: facts.usdc!.decimals, precision: 2 },
      ].map((asset, index) => <div key={asset.symbol} className={`flex items-center gap-3 px-4 py-4 ${index ? 'border-t' : ''}`}
        style={{ borderColor: 'var(--border)' }}>
        <TokenIcon symbol={asset.symbol} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{asset.name}</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>{asset.detail}</p>
        </div>
        <div className="shrink-0 text-right" data-testid={`secondary-${asset.symbol.toLowerCase()}-balance`}>
          {balances.isLoading ? <Skeleton className="ml-auto h-5 w-20" /> : balances.isError ?
            <p className="text-xs" style={{ color: 'var(--danger)' }}>Balance unavailable</p> :
            <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {asset.raw === undefined ? '—' : displayBalance(asset.raw, asset.decimals,
                asset.symbol === 'USDC' && asset.raw > 0n && asset.raw < 10_000n ? asset.decimals : asset.precision)}
            </p>}
          <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>{asset.symbol}</p>
        </div>
      </div>)}
      {onBridge && <button onClick={onBridge} className="flex w-full items-center justify-center gap-2 border-t px-4 py-3 text-xs font-semibold"
        style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>
        <Route className="size-3.5" />Bridge USDC
      </button>}
    </div>
  </section>
}
