/**
 * Send USDC or EURC on Arc Mainnet.
 * Signs and broadcasts via the in-memory account from WalletContext.
 * Private key NEVER leaves memory.
 */
import { useState, useMemo } from 'react'
import { useWallet } from '../../context/WalletContext'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { useTokenGasEstimate } from '../../hooks/useTokenGasEstimate'
import { BottomSheet } from '../shared/BottomSheet'
import { TokenIcon } from '../shared/TokenLogo'
import { isValidAddress, parseOnchainError } from '../../utils/wallet'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { Amount } from '@/onchain-money'
import { TOKENS, type TokenInfo } from '../../utils/tokens'
import { createWalletClient, createPublicClient, http, erc20Abi } from 'viem'
import { arc } from 'viem/chains'
import {
  ExternalLink,
  Loader2,
  AlertTriangle,
  Check,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '../shared/Skeleton'

const ARC_MAINNET_ID = 5042

type SendStep = 'input' | 'confirm' | 'submitting' | 'success' | 'error'

interface SendSheetProps {
  open: boolean
  onClose: () => void
  /** Pre-select a token when opening (optional) */
  initialToken?: TokenInfo
}

function AssetPicker({
  selected,
  onChange,
}: {
  selected: TokenInfo
  onChange: (t: TokenInfo) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-2xl px-3 py-2 transition-all hover:bg-black/5"
        style={{
          background: 'rgba(255,255,255,0.70)',
          border: '1px solid rgba(18,45,69,0.12)',
        }}
      >
        <TokenIcon symbol={selected.symbol} size={22} />
        <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
          {selected.symbol}
        </span>
        <ChevronDown className="size-3.5" style={{ color: 'var(--subtle)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            className="absolute left-0 top-full z-50 mt-1.5 min-w-[140px] overflow-hidden rounded-2xl shadow-xl"
            style={{
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(18,45,69,0.12)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {TOKENS.map((t) => (
              <button
                key={t.symbol}
                onClick={() => { onChange(t); setOpen(false) }}
                className="flex w-full items-center gap-2.5 px-3.5 py-3 transition-all hover:bg-black/5"
                style={{
                  background: t.symbol === selected.symbol ? 'rgba(18,45,69,0.05)' : 'transparent',
                }}
              >
                <TokenIcon symbol={t.symbol} size={24} />
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {t.symbol}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                    {t.name}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SendSheet({ open, onClose, initialToken }: SendSheetProps) {
  const { account } = useWallet()
  const address = account?.address

  const [selectedToken, setSelectedToken] = useState<TokenInfo>(initialToken ?? TOKENS[0])
  const { amount: balanceAmount, formatted: balanceFormatted, isLoading: balanceLoading } =
    useTokenBalance(selectedToken, address)

  const [step, setStep] = useState<SendStep>('input')
  const [recipient, setRecipient] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Reset amount when token changes
  const handleTokenChange = (t: TokenInfo) => {
    setSelectedToken(t)
    setAmountStr('')
  }

  // Parse input amount
  const parsedAmount = useMemo(() => {
    if (!amountStr || amountStr === '0' || amountStr === '0.') return undefined
    try {
      return Amount.parse(amountStr, selectedToken.decimals)
    } catch {
      return undefined
    }
  }, [amountStr, selectedToken.decimals])

  // Gas estimate
  const { feeFormatted, feeAmount } = useTokenGasEstimate(
    selectedToken,
    address,
    isValidAddress(recipient) ? (recipient as `0x${string}`) : undefined,
    parsedAmount?.raw,
  )

  // Validation
  const recipientError = recipient.length > 0 && !isValidAddress(recipient) ? 'Invalid address' : ''
  const amountError = useMemo(() => {
    if (!parsedAmount) return amountStr.length > 0 ? 'Enter a valid amount' : ''
    if (parsedAmount.isZero()) return 'Amount must be greater than 0'
    if (balanceAmount && parsedAmount.gt(balanceAmount)) return 'Insufficient balance'
    return ''
  }, [parsedAmount, balanceAmount, amountStr])

  const isValid =
    isValidAddress(recipient) &&
    parsedAmount &&
    parsedAmount.isPositive() &&
    !amountError &&
    account !== null

  const handleMax = () => {
    if (!balanceAmount) return
    // For USDC (gas token on Arc), subtract fee from max; EURC has no gas cost in its own balance
    if (selectedToken.symbol === 'USDC' && feeAmount) {
      const maxAmt = balanceAmount.sub(feeAmount)
      setAmountStr(maxAmt.isPositive() ? maxAmt.toFixed(6) : '0')
    } else {
      setAmountStr(balanceAmount.toFixed(6))
    }
  }

  const handleSend = async () => {
    if (!account || !parsedAmount || !isValidAddress(recipient)) return
    setStep('submitting')
    setErrorMsg('')
    try {
      // HDAccount and PrivateKeyAccount both satisfy viem's Account interface
      type ViemAccount = Parameters<typeof createWalletClient>[0] extends { account?: infer A } ? NonNullable<A> : never
      const viemAcct = account as unknown as ViemAccount
      const walletClient = createWalletClient({ account: viemAcct, chain: arc, transport: http() })
      const publicClient = createPublicClient({ chain: arc, transport: http() })

      const hash = await walletClient.writeContract({
        account: viemAcct,
        address: selectedToken.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, parsedAmount.raw],
      })

      setTxHash(hash)

      await publicClient.waitForTransactionReceipt({ hash })
      setStep('success')
      toast.success(`${selectedToken.symbol} sent!`)
    } catch (err) {
      const msg = parseOnchainError(err)
      setErrorMsg(msg)
      setStep('error')
      toast.error(msg)
    }
  }

  const handleClose = () => {
    setStep('input')
    setRecipient('')
    setAmountStr('')
    setTxHash(null)
    setErrorMsg('')
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title={`Send ${selectedToken.symbol}`}>
      <AnimatePresence mode="wait">
        {step === 'input' && (
          <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Recipient */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                Recipient Address
              </label>
              <input
                className="mono w-full rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-slate-300"
                style={{
                  background: 'rgba(255,255,255,0.60)',
                  border: recipientError ? '1px solid rgba(186,43,76,0.40)' : '1px solid rgba(18,45,69,0.12)',
                  color: 'var(--ink)',
                }}
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                spellCheck={false}
              />
              {recipientError && (
                <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
                  {recipientError}
                </p>
              )}
            </div>

            {/* Amount with asset picker */}
            <div
              className="mb-2 rounded-2xl p-4"
              style={{
                background: 'rgba(255,255,255,0.46)',
                border: amountError ? '1px solid rgba(186,43,76,0.40)' : '1px solid rgba(255,255,255,0.56)',
              }}
            >
              <input
                inputMode="decimal"
                className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                style={{ color: 'var(--ink)' }}
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  if (val === '' || /^\d*\.?\d*$/.test(val)) setAmountStr(val)
                }}
              />
              <div className="mt-3 flex items-center justify-between">
                <AssetPicker selected={selectedToken} onChange={handleTokenChange} />
                <button
                  onClick={handleMax}
                  disabled={!balanceAmount || balanceLoading}
                  className="text-xs font-semibold disabled:opacity-40"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  {balanceLoading ? (
                    <Skeleton className="h-3 w-20" />
                  ) : (
                    `Balance: ${balanceFormatted} · Max`
                  )}
                </button>
              </div>
            </div>

            {amountError && (
              <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>
                {amountError}
              </p>
            )}

            {/* Fee estimate */}
            <div className="mb-5 flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(18,45,69,0.04)' }}>
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                Estimated network fee
              </span>
              <span className="mono text-xs font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>
                {feeFormatted} USDC
              </span>
            </div>

            {/* Warning */}
            <div className="mb-5 flex gap-2 rounded-xl p-3"
              style={{ background: 'rgba(186,43,76,0.05)', border: '1px solid rgba(186,43,76,0.12)' }}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: 'var(--danger)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Blockchain transactions are irreversible. Verify the recipient address before sending.
              </p>
            </div>

            <button
              disabled={!isValid}
              onClick={() => setStep('confirm')}
              className="w-full rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
            >
              Review Transaction
            </button>
          </motion.div>
        )}

        {step === 'confirm' && parsedAmount && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="display mb-5 text-lg font-bold" style={{ color: 'var(--ink)' }}>
              Confirm Transaction
            </h3>

            {/* Asset badge */}
            <div className="mb-4 flex items-center gap-2.5">
              <TokenIcon symbol={selectedToken.symbol} size={32} />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                  {selectedToken.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                  {selectedToken.symbol} · Arc
                </p>
              </div>
            </div>

            {/* Summary rows */}
            <div className="mb-5 overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
              {[
                { label: 'Sending', value: `${parsedAmount.toFixed(2)} ${selectedToken.symbol}` },
                { label: 'To', value: `${recipient.slice(0, 10)}...${recipient.slice(-6)}`, mono: true },
                { label: 'Network fee', value: `${feeFormatted} USDC` },
              ].map(({ label, value, mono }, i) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? 'border-t' : ''}`}
                  style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.60)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
                  <span className={`text-sm font-semibold ${mono ? 'mono' : ''}`} style={{ color: 'var(--ink)' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Warning */}
            <div className="mb-5 flex gap-2 rounded-xl p-3"
              style={{ background: 'rgba(186,43,76,0.05)', border: '1px solid rgba(186,43,76,0.12)' }}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: 'var(--danger)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                This transaction is irreversible. Once confirmed, it cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('input')}
                className="flex-1 rounded-2xl py-3.5 text-sm font-semibold transition-all hover:bg-black/5"
                style={{
                  background: 'rgba(255,255,255,0.60)',
                  border: '1px solid rgba(18,45,69,0.12)',
                  color: 'var(--ink)',
                }}
              >
                Back
              </button>
              <button
                onClick={() => { void handleSend() }}
                className="flex-1 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'var(--accent)' }}
              >
                Confirm Send
              </button>
            </div>
          </motion.div>
        )}

        {step === 'submitting' && (
          <motion.div
            key="submitting"
            className="flex flex-col items-center py-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="mb-4 size-10 animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
              Sending
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              {txHash ? 'Awaiting on-chain confirmation' : 'Broadcasting to Arc network'}
            </p>
            {txHash && (
              <a
                href={buildTxExplorerUrl(ARC_MAINNET_ID, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: 'var(--accent-hover)' }}
              >
                View on explorer <ExternalLink className="size-3" />
              </a>
            )}
          </motion.div>
        )}

        {step === 'success' && txHash && (
          <motion.div
            key="success"
            className="flex flex-col items-center py-8 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="mb-4 flex size-16 items-center justify-center rounded-full"
              style={{ background: 'rgba(26,128,71,0.12)' }}>
              <Check className="size-8" style={{ color: 'var(--success)' }} />
            </div>
            <p className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
              Sent!
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              {selectedToken.symbol} transaction confirmed on Arc
            </p>
            <a
              href={buildTxExplorerUrl(ARC_MAINNET_ID, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:bg-black/5"
              style={{
                background: 'rgba(255,255,255,0.60)',
                border: '1px solid rgba(18,45,69,0.12)',
                color: 'var(--ink)',
              }}
            >
              View on Arc Explorer <ExternalLink className="size-4" />
            </a>
            <button
              onClick={handleClose}
              className="mt-3 w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Done
            </button>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div
            key="error"
            className="flex flex-col items-center py-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="mb-4 flex size-16 items-center justify-center rounded-full"
              style={{ background: 'rgba(186,43,76,0.10)' }}>
              <AlertTriangle className="size-8" style={{ color: 'var(--danger)' }} />
            </div>
            <p className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
              Transaction Failed
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              {errorMsg}
            </p>
            <div className="mt-5 flex w-full gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-2xl py-3.5 text-sm font-semibold transition-all hover:bg-black/5"
                style={{
                  background: 'rgba(255,255,255,0.60)',
                  border: '1px solid rgba(18,45,69,0.12)',
                  color: 'var(--ink)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('input')}
                className="flex-1 rounded-2xl py-3.5 text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BottomSheet>
  )
}
