import { useState } from 'react'
import { PageBackground } from '../shared/PageBackground'
import { GlassCard } from '../shared/GlassCard'
import { Skeleton } from '../shared/Skeleton'
import { TokenIcon } from '../shared/TokenLogo'
import { TowerLogo } from '../shared/TowerLogo'
import { formatAddress } from '../../utils/wallet'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ArrowUpRight, ArrowDownLeft, FileCode, ExternalLink } from 'lucide-react'
import { sanitizeTxValue, type ArcTransaction } from '../../hooks/useArcTransactions'
import { useNetwork } from '../../context/NetworkContext'


type Filter = 'all' | 'sent' | 'received' | 'swaps' | 'pending' | 'failed'

function TxItem({ tx }: { tx: ArcTransaction }) {
  const { chainId } = useNetwork()
  const isSent = tx.direction === 'sent'
  const isContract = tx.direction === 'contract'
  const isTower = isContract && (tx.contractName ?? '').toLowerCase().includes('tower')
  const isSwap = tx.txType === 'swap'
  const symbol = (tx.tokenSymbol === 'EURC' ? 'EURC' : 'USDC')
  const displayVal = sanitizeTxValue(tx.value, tx.rawValue)

  const title = isContract
    ? (tx.method ?? tx.contractName ?? 'Contract Interaction')
    : (isSent ? 'Sent' : 'Received')

  const subtitle = isContract
    ? (tx.contractName ? `${tx.contractName} · ${tx.to ? formatAddress(tx.to) : 'Contract'}` : (tx.to ? formatAddress(tx.to) : 'Contract'))
    : (isSent ? (tx.to ? formatAddress(tx.to) : 'Contract') : formatAddress(tx.from))

  return (
    <a
      href={buildTxExplorerUrl(chainId, tx.hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-all hover:bg-black/4"
    >
      {/* Direction or Contract icon with token logo overlay */}
      <div className="relative mt-0.5 shrink-0">
        <div
          className="flex size-9 items-center justify-center rounded-xl"
          style={{
            background: tx.status === 'failed'
              ? 'rgba(186,43,76,0.10)'
              : isContract
                ? 'rgba(6,182,212,0.14)'
                : isSent ? 'rgba(18,45,69,0.08)' : 'rgba(26,128,71,0.10)',
          }}
        >
          {tx.status === 'failed' ? (
            <ArrowUpRight className="size-4" style={{ color: 'var(--danger)' }} />
          ) : isContract && isTower ? (
            <TowerLogo size={16} />
          ) : isContract ? (
            <FileCode className="size-4" style={{ color: 'var(--accent)' }} />
          ) : isSent ? (
            <ArrowUpRight className="size-4" style={{ color: 'var(--ink-2)' }} />
          ) : (
            <ArrowDownLeft className="size-4" style={{ color: 'var(--success)' }} />
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 rounded-full border border-white">
          <TokenIcon symbol={symbol} size={14} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                {title}
              </p>
              {isSwap ? (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                  style={{ background: 'rgba(6,182,212,0.12)', color: 'var(--accent)' }}
                >
                  Swap
                </span>
              ) : isContract ? (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                  style={{ background: 'rgba(6,182,212,0.12)', color: 'var(--accent)' }}
                >
                  Contract
                </span>
              ) : null}
            </div>
            <p className="mono mt-0.5 truncate text-xs" style={{ color: 'var(--subtle)' }}>
              {subtitle}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className="display text-sm font-bold tabular-nums"
              style={{
                color:
                  tx.status === 'failed'
                    ? 'var(--danger)'
                    : isContract
                      ? 'var(--accent)'
                      : isSent ? 'var(--ink)' : 'var(--success)',
              }}
            >
              {isContract
                ? (displayVal !== '0.00' ? `${displayVal} ${tx.tokenSymbol}` : 'Call')
                : `${isSent ? '-' : '+'}${displayVal} ${tx.tokenSymbol}`}
            </p>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
              style={{
                background:
                  tx.status === 'success'
                    ? 'rgba(26,128,71,0.10)'
                    : tx.status === 'failed'
                      ? 'rgba(186,43,76,0.10)'
                      : 'rgba(139,131,156,0.10)',
                color:
                  tx.status === 'success'
                    ? 'var(--success)'
                    : tx.status === 'failed'
                      ? 'var(--danger)'
                      : 'var(--subtle)',
              }}
            >
              {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
            </span>
            {tx.timestamp > 0 && (
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                {new Date(tx.timestamp).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
         })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--subtle)' }}>
            <span className="mono">{tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}</span>
            <ExternalLink className="size-3" />
          </div>
        </div>
      </div>
    </a>
  )
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'received', label: 'Received' },
  { key: 'swaps', label: 'Swaps' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
]

interface ActivityScreenProps {
  transactions: ArcTransaction[]
  isLoading?: boolean
  isError?: boolean
}

export function ActivityScreen({ transactions, isLoading = false, isError = false }: ActivityScreenProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const isSwapTx = (tx: ArcTransaction) =>
    tx.txType === 'swap' ||
    Boolean(tx.method?.toLowerCase().includes('swap')) ||
    Boolean(tx.contractName?.toLowerCase().includes('tower')) ||
    Boolean(tx.contractName?.toLowerCase().includes('uniswap')) ||
    Boolean(tx.contractName?.toLowerCase().includes('router'))

  const isSentTx = (tx: ArcTransaction) =>
    !isSwapTx(tx) && (tx.direction === 'sent' || tx.txType === 'transfer')

  const isReceivedTx = (tx: ArcTransaction) =>
    tx.direction === 'received'

  const counts: Record<Filter, number> = {
    all: transactions.length,
    sent: transactions.filter(isSentTx).length,
    received: transactions.filter(isReceivedTx).length,
    swaps: transactions.filter(isSwapTx).length,
    pending: transactions.filter((t) => t.status === 'pending').length,
    failed: transactions.filter((t) => t.status === 'failed').length,
  }

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true
    if (filter === 'sent') return isSentTx(tx)
    if (filter === 'received') return isReceivedTx(tx)
    if (filter === 'swaps') return isSwapTx(tx)
    if (filter === 'pending') return tx.status === 'pending'
    if (filter === 'failed') return tx.status === 'failed'
    return true
  })

  return (
    <PageBackground>
      <div className="mx-auto max-w-md px-4 pb-32 pt-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Activity
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>
            Full transaction history categorized by activity type
          </p>
        </div>

        {/* Filter tabs */}
        <div
          className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl p-1 no-scrollbar"
          style={{ background: 'rgba(18,45,69,0.06)' }}
        >
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all"
              style={{
                background: filter === key ? 'white' : 'transparent',
                color: filter === key ? 'var(--ink)' : 'var(--subtle)',
                boxShadow: filter === key ? '0 2px 8px rgba(18,45,69,0.08)' : 'none',
              }}
            >
              <span>{label}</span>
              {counts[key] > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.2 text-[10px] font-bold"
                  style={{
                    background: filter === key ? 'rgba(6,182,212,0.14)' : 'rgba(18,45,69,0.06)',
                    color: filter === key ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Transactions */}
        <GlassCard className="overflow-hidden">
          {isLoading && transactions.length === 0 ? (
            <div className="space-y-1 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError && transactions.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                Could not load transactions
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                Check your network connection and try again
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>
                No {filter === 'all' ? '' : filter} transactions found
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
                {filter === 'swaps'
                  ? 'Execute a swap via Tower Exchange to see records here'
                  : filter === 'sent'
                  ? 'Send tokens to another wallet to see records here'
                  : filter === 'received'
                  ? 'Receive tokens to see records here'
                  : 'Activity on Arc Mainnet will appear here'}
              </p>
            </div>
          ) : (
            <div className="divide-y p-1" style={{ borderColor: 'var(--border)' }}>
              {filtered.map((tx) => (
                <TxItem key={tx.hash} tx={tx} />
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </PageBackground>
  )
}
