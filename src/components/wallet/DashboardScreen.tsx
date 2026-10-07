import { useState, useCallback } from 'react'
import { useWallet } from '../../context/WalletContext'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { PageBackground } from '../shared/PageBackground'
import { GlassCard } from '../shared/GlassCard'
import { Skeleton } from '../shared/Skeleton'
import { NetworkBadge } from '../shared/NetworkBadge'
import { TokenIcon } from '../shared/TokenLogo'
import { formatAddress } from '../../utils/wallet'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { TOKENS } from '../../utils/tokens'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import type { ArcTransaction } from '../../hooks/useArcTransactions'

const ARC_MAINNET_ID = 5042

interface DashboardScreenProps {
  onNavigate: (screen: string) => void
  onShowSend: () => void
  onShowReceive: () => void
  transactions: ArcTransaction[]
}

function TxRow({ tx }: { tx: ArcTransaction }) {
  const isSent = tx.direction === 'sent'
  const isFailed = tx.status === 'failed'

  return (
    <a
      href={buildTxExplorerUrl(ARC_MAINNET_ID, tx.hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all hover:bg-cyan-50/60 active:bg-cyan-50"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: isFailed
            ? 'rgba(220,38,38,0.10)'
            : isSent ? 'rgba(6,182,212,0.10)' : 'rgba(5,150,105,0.10)',
        }}
      >
        {isSent ? (
          <ArrowUpRight className="size-4" style={{ color: isFailed ? 'var(--danger)' : 'var(--accent-light)' }} />
        ) : (
          <ArrowDownLeft className="size-4" style={{ color: 'var(--success)' }} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {isSent ? 'Sent' : tx.direction === 'received' ? 'Received' : 'Interaction'}
            </p>
            <span
              className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
              style={{ background: 'rgba(6,182,212,0.08)', color: 'var(--accent)' }}
            >
              {tx.tokenSymbol}
            </span>
          </div>
          {/* Transaction amount - 16px / semibold */}
          <span
            className="amount-text"
            style={{ color: isFailed ? 'var(--danger)' : isSent ? 'var(--ink)' : 'var(--success)' }}
          >
            {isSent ? '-' : '+'}{tx.value}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <p className="mono truncate" style={{ color: 'var(--subtle)' }}>
            {isSent ? (tx.to ? formatAddress(tx.to) : 'Contract') : formatAddress(tx.from)}
          </p>
          <div className="flex items-center gap-1">
            <span className="support-text font-medium"
              style={{ color: tx.status === 'success' ? 'var(--success)' : tx.status === 'failed' ? 'var(--danger)' : 'var(--subtle)' }}>
              {tx.status === 'pending' ? 'Pending' : tx.status === 'failed' ? 'Failed' : ''}
            </span>
            {tx.timestamp > 0 && (
              <span className="support-text" style={{ color: 'var(--subtle)' }}>
                {new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  )
}

export function DashboardScreen({ onNavigate, onShowSend, onShowReceive, transactions }: DashboardScreenProps) {
  const { account } = useWallet()
  const address = account?.address
  const usdc = TOKENS[0]
  const eurc = TOKENS[1]
  const { formatted: usdcFormatted, isLoading: usdcLoading, refetch: refetchUsdc } = useTokenBalance(usdc, address)
  const { formatted: eurcFormatted, isLoading: eurcLoading, refetch: refetchEurc } = useTokenBalance(eurc, address)
  const txLoading = (transactions).length === 0
  const recentTxnsTyped: ArcTransaction[] = (transactions).slice(0, 5)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    refetchUsdc()
    refetchEurc()
    await new Promise((r) => setTimeout(r, 800))
    setRefreshing(false)
    toast.success('Balances updated')
  }, [refetchUsdc, refetchEurc])



  return (
    <PageBackground>
      <div className="mx-auto max-w-md px-4 pb-32 pt-5">
        {/* Network + refresh row */}
        <div className="mb-4 flex items-center justify-between">
          <NetworkBadge isConnected={true} />
          <button
            onClick={() => { void handleRefresh() }}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all hover:bg-black/5"
            style={{ color: 'var(--subtle)' }}
            disabled={refreshing}
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Address pill */}
        <button
          onClick={() => { void handleCopy() }}
          className="mb-4 flex w-full items-center justify-between rounded-2xl px-4 py-3 transition-all hover:bg-black/4"
          style={{ background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.68)' }}
        >
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>Your Address</p>
            <p className="mono mt-0.5 text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {address ? formatAddress(address) : 'No address'}
            </p>
          </div>
          {copied ? (
            <Check className="size-4" style={{ color: 'var(--success)' }} />
          ) : (
            <Copy className="size-4" style={{ color: 'var(--subtle)' }} />
          )}
        </button>

        {/* Hero balance card */}
        <GlassCard className="mb-4 p-5">
          {/* Action buttons */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <button
              onClick={onShowSend}
              className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <ArrowUpRight className="size-4" />
              Send
            </button>
            <button
              onClick={onShowReceive}
              className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(6,182,212,0.18)',
                color: 'var(--ink)',
              }}
            >
              <ArrowDownLeft className="size-4" />
              Receive
            </button>
          </div>

          {/* Token balances */}
          <div className="space-y-3">
            {[
              { token: usdc, formatted: usdcFormatted, loading: usdcLoading },
              { token: eurc, formatted: eurcFormatted, loading: eurcLoading },
            ].map(({ token, formatted, loading }) => (
              <div key={token.symbol} className="flex items-center gap-3">
                <TokenIcon symbol={token.symbol} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
                    {token.name}
                  </p>
                  {loading ? (
                    <Skeleton className="mt-0.5 h-5 w-24" />
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={formatted}
                        className="amount-text"
                        style={{ color: 'var(--ink)', fontSize: '18px', fontWeight: 700 }}
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {token.sign}{formatted}
                      </motion.p>
                    </AnimatePresence>
                  )}
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--subtle)' }}>
                  {token.symbol}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 support-text" style={{ color: 'var(--subtle)' }}>
            Arc Mainnet · USDC is gas
          </p>
        </GlassCard>

        {/* Recent transactions */}
        <GlassCard>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Recent Activity
            </span>
            <button
              onClick={() => onNavigate('activity')}
              className="text-xs font-semibold"
              style={{ color: 'var(--accent-hover)' }}
            >
              View all
            </button>
          </div>
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            {txLoading ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                    <Skeleton className="size-9 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentTxnsTyped.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--subtle)' }}>No transactions yet</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
                  Receive USDC or EURC to get started
                </p>
              </div>
            ) : (
              <div className="divide-y p-1" style={{ borderColor: 'var(--border)' }}>
                {recentTxnsTyped.map((tx: ArcTransaction) => <TxRow key={tx.hash} tx={tx} />)}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </PageBackground>
  )
}
