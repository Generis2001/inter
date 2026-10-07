import { useState } from 'react'
import { PageBackground } from '../shared/PageBackground'
import { GlassCard } from '../shared/GlassCard'
import { Skeleton } from '../shared/Skeleton'
import { TokenIcon } from '../shared/TokenLogo'
import { formatAddress } from '../../utils/wallet'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react'
import type { ArcTransaction } from '../../hooks/useArcTransactions'

const ARC_MAINNET_ID = 5042

type Filter = 'all' | 'sent' | 'received' | 'pending' | 'failed'

function TxItem({ tx }: { tx: ArcTransaction }) {
  const isSent = tx.direction === 'sent'
  const symbol = (tx.tokenSymbol === 'EURC' ? 'EURC' : 'USDC')

  return (
    <a
      href={buildTxExplorerUrl(ARC_MAINNET_ID, tx.hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-all hover:bg-black/4"
    >
      {/* Direction icon with token logo overlay */}
      <div className="relative mt-0.5 shrink-0">
        <div
          className="flex size-9 items-center justify-center rounded-xl"
          style={{
            background: tx.status === 'failed'
              ? 'rgba(186,43,76,0.10)'
              : isSent ? 'rgba(18,45,69,0.08)' : 'rgba(26,128,71,0.10)',
          }}
        >
          {isSent ? (
            <ArrowUpRight className="size-4" style={{ color: tx.status === 'failed' ? 'var(--danger)' : 'var(--ink-2)' }} />
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
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {isSent ? 'Sent' : tx.direction === 'received' ? 'Received' : 'Contract Interaction'}
            </p>
            <p className="mono mt-0.5 truncate text-xs" style={{ color: 'var(--subtle)' }}>
              {isSent ? (tx.to ? formatAddress(tx.to) : 'Contract') : formatAddress(tx.from)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className="display text-sm font-bold tabular-nums"
              style={{
                color:
                  tx.status === 'failed' ? 'var(--danger)' : isSent ? 'var(--ink)' : 'var(--success)',
              }}
            >
              {isSent ? '-' : '+'}{tx.value} {tx.tokenSymbol}
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
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
]

interface ActivityScreenProps {
  transactions: ArcTransaction[]
}

export function ActivityScreen({ transactions }: ActivityScreenProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const isLoading = false
  const isError = false

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true
    if (filter === 'sent') return tx.direction === 'sent'
    if (filter === 'received') return tx.direction === 'received'
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
            Full transaction history, refreshed every 30s
          </p>
        </div>

        {/* Filter tabs */}
        <div
          className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl p-1"
          style={{ background: 'rgba(18,45,69,0.06)' }}
        >
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all"
              style={{
                background: filter === key ? 'white' : 'transparent',
                color: filter === key ? 'var(--ink)' : 'var(--subtle)',
                boxShadow: filter === key ? '0 2px 8px rgba(18,45,69,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Transactions */}
        <GlassCard className="overflow-hidden">
          {isLoading ? (
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
          ) : isError ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                Could not load transactions
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                Check your connection and try again
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>
                No {filter === 'all' ? '' : filter} transactions yet
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
