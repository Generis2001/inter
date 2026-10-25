import { useState, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWallet } from '../../context/WalletContext'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { PageBackground } from '../shared/PageBackground'
import { Skeleton } from '../shared/Skeleton'
import { NetworkBadge } from '../shared/NetworkBadge'
import { TokenIcon } from '../shared/TokenLogo'
import { TowerLogo } from '../shared/TowerLogo'
import { WalletIdenticon } from '../shared/WalletIdenticon'
import { formatAddress } from '../../utils/wallet'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { TOKENS } from '../../utils/tokens'
import { useNetwork } from '../../context/NetworkContext'
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  History,
  Copy,
  Check,
  TrendingUp,
  Coins,
  FileCode,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { sanitizeTxValue, type ArcTransaction } from '../../hooks/useArcTransactions'

interface DashboardScreenProps {
  onNavigate: (screen: string) => void
  onShowSend: () => void
  onShowReceive: () => void
  transactions: ArcTransaction[]
  isLoading?: boolean
}

function TxRow({ tx, chainId }: { tx: ArcTransaction; chainId: number }) {
  const isSent = tx.direction === 'sent'
  const isContract = tx.direction === 'contract'
  const isFailed = tx.status === 'failed'
  const isPending = tx.status === 'pending'
  const isSwap =
    tx.txType === 'swap' ||
    (tx.contractName ?? '').toLowerCase().includes('tower') ||
    (tx.contractName ?? '').toLowerCase().includes('uniswap')
  const isTower = isSwap && (tx.contractName ?? '').toLowerCase().includes('tower')
  const displayVal = sanitizeTxValue(tx.value, tx.rawValue)

  const title = isSwap
    ? 'Swap'
    : isContract
      ? (tx.method ?? tx.contractName ?? 'Contract')
      : isSent
        ? 'Sent'
        : 'Received'

  const subtitle = isContract
    ? tx.contractName
      ? `${tx.contractName} · ${tx.to ? formatAddress(tx.to) : 'Contract'}`
      : tx.to
        ? formatAddress(tx.to)
        : 'Contract'
    : isSent
      ? tx.to
        ? formatAddress(tx.to)
        : 'Contract'
      : formatAddress(tx.from)

  return (
    <a
      href={buildTxExplorerUrl(chainId, tx.hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99]"
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-sm"
        style={{
          background: isFailed
            ? 'rgba(239,68,68,0.12)'
            : isPending
              ? 'rgba(234,179,8,0.14)'
              : isSwap
                ? 'rgba(0,194,255,0.14)'
                : isContract
                  ? 'rgba(99,102,241,0.14)'
                  : isSent
                    ? 'rgba(0,194,255,0.12)'
                    : 'rgba(16,185,129,0.12)',
        }}
      >
        {isFailed ? (
          <ArrowUpRight className="size-4" style={{ color: 'var(--danger)' }} />
        ) : isTower ? (
          <TowerLogo size={18} />
        ) : isSwap ? (
          <RefreshCw className="size-4" style={{ color: 'var(--accent)' }} />
        ) : isContract ? (
          <FileCode className="size-4" style={{ color: '#818cf8' }} />
        ) : isSent ? (
          <ArrowUpRight className="size-4" style={{ color: 'var(--accent)' }} />
        ) : (
          <ArrowDownLeft className="size-4" style={{ color: 'var(--success)' }} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate max-w-[150px]" style={{ color: 'var(--ink)' }}>
              {title}
            </p>
            {isFailed ? (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(239,68,68,0.14)', color: 'var(--danger)' }}
              >
                Failed
              </span>
            ) : isPending ? (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}
              >
                Pending
              </span>
            ) : isSwap ? (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(0,194,255,0.14)', color: 'var(--accent)' }}
              >
                Swap
              </span>
            ) : null}
          </div>
          <span
            className="amount-text font-bold"
            style={{
              color: isFailed
                ? 'var(--danger)'
                : isContract
                  ? 'var(--accent)'
                  : isSent
                    ? 'var(--ink)'
                    : 'var(--success)',
            }}
          >
            {isContract
              ? displayVal !== '0.00'
                ? `${displayVal} ${tx.tokenSymbol}`
                : 'Call'
              : `${isSent ? '-' : '+'}${displayVal}`}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-xs">
          <p className="mono truncate text-[11px]" style={{ color: 'var(--subtle)' }}>
            {subtitle}
          </p>
          {tx.timestamp > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>
              {new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

export function DashboardScreen({
  onNavigate,
  onShowSend,
  onShowReceive,
  transactions,
  isLoading = false,
}: DashboardScreenProps) {
  const { account } = useWallet()
  const { chainId } = useNetwork()
  const address = account?.address
  const usdc = TOKENS[0]
  const eurc = TOKENS[1]
  const { formatted: usdcFormatted, isLoading: usdcLoading } = useTokenBalance(usdc, address)
  const { formatted: eurcFormatted, isLoading: eurcLoading } = useTokenBalance(eurc, address)
  const txLoading = isLoading
  const recentTxnsTyped: ArcTransaction[] = transactions.slice(0, 6)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'tokens' | 'activity'>('tokens')

  const handleCopy = useCallback(async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success('Address copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }, [address])

  // Total balance computation in USD
  const totalBalanceUsd = useMemo(() => {
    const u = parseFloat(usdcFormatted?.replace(/,/g, '') || '0')
    const e = parseFloat(eurcFormatted?.replace(/,/g, '') || '0')
    if (isNaN(u) && isNaN(e)) return '0.00'
    // EURC approx 1.08 USD
    const total = (isNaN(u) ? 0 : u) + (isNaN(e) ? 0 : e * 1.08)
    return total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [usdcFormatted, eurcFormatted])

  return (
    <PageBackground>
      <div className="mx-auto max-w-md px-4 pb-32 pt-3">
        {/* Top Header Bar: Account Selector Chip + Network Badge */}
        <div className="mb-4 flex items-center justify-between gap-2">
          {/* Meteor-style Account Chip */}
          <button
            onClick={() => { void handleCopy() }}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
            title="Click to copy full address"
          >
            <WalletIdenticon address={address ?? '0x00'} size={20} className="shrink-0" />
            <span className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              {address ? formatAddress(address) : 'No account'}
            </span>
            {copied ? (
              <Check className="size-3.5" style={{ color: 'var(--success)' }} />
            ) : (
              <Copy className="size-3.5 opacity-60" style={{ color: 'var(--subtle)' }} />
            )}
          </button>

          {/* Network Switcher Badge */}
          <NetworkBadge />
        </div>

        {/* Meteor-style Hero Balance Card */}
        <div
          className="relative mb-5 overflow-hidden rounded-3xl p-6 transition-all"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          {/* Subtle atmospheric ambient glow */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-20 blur-3xl"
            style={{ background: 'var(--accent-gradient)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
          />

          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
              Total Portfolio Balance
            </span>

            {/* Big Net Worth Value */}
            <div className="my-2.5 flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                $
              </span>
              {usdcLoading && eurcLoading ? (
                <Skeleton className="h-10 w-36 rounded-xl" />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={totalBalanceUsd}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="balance-text text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums"
                    style={{ color: 'var(--ink)' }}
                  >
                    {totalBalanceUsd}
                  </motion.h1>
                </AnimatePresence>
              )}
            </div>

            {/* 24h PnL / Live Status Pill */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: 'rgba(16,185,129,0.10)',
                color: 'var(--success)',
                border: '1px solid rgba(16,185,129,0.18)',
              }}
            >
              <TrendingUp className="size-3.5" />
              <span>StablEcoin native</span>
            </div>

            {/* Quick Action Hub: Send, Receive, History */}
            <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-3 pt-2 mx-auto">
              {/* 1. Send */}
              <button
                onClick={onShowSend}
                className="group flex flex-col items-center gap-1.5 transition-all"
              >
                <div
                  className="flex size-13 items-center justify-center rounded-2xl transition-all duration-200 group-hover:scale-105 group-active:scale-95 shadow-md"
                  style={{
                    background: 'var(--accent-gradient)',
                    color: '#ffffff',
                  }}
                >
                  <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  Send
                </span>
              </button>

              {/* 2. Receive */}
              <button
                onClick={onShowReceive}
                className="group flex flex-col items-center gap-1.5 transition-all"
              >
                <div
                  className="flex size-13 items-center justify-center rounded-2xl transition-all duration-200 group-hover:scale-105 group-active:scale-95 shadow-sm"
                  style={{
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    color: 'var(--ink)',
                  }}
                >
                  <ArrowDownLeft className="size-5 transition-transform group-hover:-translate-x-0.5 group-hover:translate-y-0.5" style={{ color: 'var(--accent)' }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  Receive
                </span>
              </button>

              {/* 3. History */}
              <button
                onClick={() => onNavigate('activity')}
                className="group flex flex-col items-center gap-1.5 transition-all"
              >
                <div
                  className="flex size-13 items-center justify-center rounded-2xl transition-all duration-200 group-hover:scale-105 group-active:scale-95 shadow-sm"
                  style={{
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    color: 'var(--ink)',
                  }}
                >
                  <History className="size-5 transition-transform group-hover:rotate-12" style={{ color: 'var(--subtle)' }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  History
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Meteor Segmented Tab Pill Control (Tokens vs Activity) */}
        <div
          className="mb-4 flex items-center rounded-2xl p-1"
          style={{
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setActiveTab('tokens')}
            className="relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all"
            style={{
              color: activeTab === 'tokens' ? 'var(--ink)' : 'var(--subtle)',
            }}
          >
            {activeTab === 'tokens' && (
              <motion.div
                layoutId="dash-active-tab"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'var(--surface)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid var(--border)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Coins className="relative z-10 size-4" />
            <span className="relative z-10">Tokens & Assets</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className="relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all"
            style={{
              color: activeTab === 'activity' ? 'var(--ink)' : 'var(--subtle)',
            }}
          >
            {activeTab === 'activity' && (
              <motion.div
                layoutId="dash-active-tab"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'var(--surface)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid var(--border)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <History className="relative z-10 size-4" />
            <span className="relative z-10">Recent Activity</span>
          </button>
        </div>

        {/* Tab Content 1: Tokens List */}
        {activeTab === 'tokens' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2.5"
          >
            {[
              { token: usdc, formatted: usdcFormatted, loading: usdcLoading, approxUsd: usdcFormatted },
              {
                token: eurc,
                formatted: eurcFormatted,
                loading: eurcLoading,
                approxUsd: (parseFloat(eurcFormatted?.replace(/,/g, '') || '0') * 1.08).toFixed(2),
              },
            ].map(({ token, formatted, loading, approxUsd }) => (
              <div
                key={token.symbol}
                className="flex items-center gap-3.5 rounded-2xl p-4 transition-all hover:scale-[1.01]"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <div className="relative shrink-0">
                  <TokenIcon symbol={token.symbol} size={42} />
                  <span
                    className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white shadow"
                    style={{ background: 'var(--accent)' }}
                  >
                    {token.symbol === 'USDC' ? '$' : '€'}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>
                      {token.name}
                    </p>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}
                    >
                      Arc
                    </span>
                  </div>
                  <p className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
                    {token.symbol} · ${token.symbol === 'USDC' ? '1.00' : '1.08'}
                  </p>
                </div>

                <div className="text-right">
                  {loading ? (
                    <Skeleton className="ml-auto h-5 w-20 rounded-md" />
                  ) : (
                    <>
                      <p className="amount-text text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                        {formatted}
                      </p>
                      <p className="text-xs font-medium tabular-nums" style={{ color: 'var(--subtle)' }}>
                        ≈ ${approxUsd}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Tab Content 2: Recent Activity List */}
        {activeTab === 'activity' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl p-2"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            {txLoading && recentTxnsTyped.length === 0 ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-2xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentTxnsTyped.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <History className="mx-auto size-8 opacity-30" style={{ color: 'var(--subtle)' }} />
                <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  No transactions yet
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
                  Receive USDC or EURC on Arc to see your activity here
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {recentTxnsTyped.map((tx: ArcTransaction) => (
                  <TxRow key={tx.hash} tx={tx} chainId={chainId} />
                ))}
              </div>
            )}

            <div className="p-2 pt-3 text-center border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => onNavigate('activity')}
                className="inline-flex items-center gap-1.5 text-xs font-bold transition-all hover:gap-2"
                style={{ color: 'var(--accent)' }}
              >
                <span>View Full Activity Log</span>
                <ExternalLink className="size-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </PageBackground>
  )
}
