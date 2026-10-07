import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, ArrowDownLeft, AlertTriangle, CheckCircle, Trash2, ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { TokenIcon } from '../shared/TokenLogo'
import { formatAddress } from '../../utils/wallet'
import type { WalletNotification } from '../../hooks/useNotifications'

const ARC_MAINNET_ID = 5042

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  notifications: WalletNotification[]
  unreadCount: number
  onMarkAllRead: () => void
  onClearAll: () => void
}

function NotifItem({ n }: { n: WalletNotification }) {
  const isReceived = n.type === 'received'
  const isFailed = n.type === 'failed'

  return (
    <a
      href={buildTxExplorerUrl(ARC_MAINNET_ID, n.txHash)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 px-4 py-3.5 transition-all hover:bg-black/4"
      style={{
        background: n.read ? 'transparent' : 'rgba(18,45,69,0.03)',
        borderLeft: n.read ? '2px solid transparent' : '2px solid var(--accent)',
      }}
    >
      {/* Icon with token logo overlay */}
      <div className="relative mt-0.5 shrink-0">
        <div
          className="flex size-9 items-center justify-center rounded-xl"
          style={{
            background: isFailed
              ? 'rgba(186,43,76,0.10)'
              : isReceived
                ? 'rgba(26,128,71,0.10)'
                : 'rgba(18,45,69,0.08)',
          }}
        >
          {isFailed ? (
            <AlertTriangle className="size-4" style={{ color: 'var(--danger)' }} />
          ) : isReceived ? (
            <ArrowDownLeft className="size-4" style={{ color: 'var(--success)' }} />
          ) : (
            <CheckCircle className="size-4" style={{ color: 'var(--ink-2)' }} />
          )}
        </div>
        {/* Token badge */}
        <div className="absolute -bottom-1 -right-1 rounded-full border border-white">
          <TokenIcon symbol={n.tokenSymbol as 'USDC' | 'EURC'} size={14} />
        </div>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {isFailed
              ? 'Transaction failed'
              : isReceived
                ? `Received ${n.tokenSymbol}`
                : `Sent ${n.tokenSymbol}`}
          </p>
          <ExternalLink className="mt-0.5 size-3 shrink-0" style={{ color: 'var(--subtle)' }} />
        </div>

        <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: isReceived ? 'var(--success)' : isFailed ? 'var(--danger)' : 'var(--ink)' }}>
          {isReceived ? '+' : ''}{n.value} {n.tokenSymbol}
        </p>

        <p className="mono mt-1 truncate text-xs" style={{ color: 'var(--subtle)' }}>
          {isReceived ? `From ${formatAddress(n.from)}` : n.to ? `To ${formatAddress(n.to)}` : ''}
        </p>

        {n.timestamp > 0 && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>
            {new Date(n.timestamp).toLocaleString(undefined, {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </a>
  )
}

export function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkAllRead,
  onClearAll,
}: NotificationPanelProps) {
  // Close on outside click
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Small delay so the open-click doesn't immediately close
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [open, onClose])

  // Mark all read when panel opens
  useEffect(() => {
    if (open && unreadCount > 0) {
      onMarkAllRead()
    }
  }, [open, unreadCount, onMarkAllRead])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.12)' }}
          />

          {/* Panel — slides in from top-right */}
          <motion.div
            key="panel"
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed right-4 top-16 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(18,45,69,0.10)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Bell className="size-4" style={{ color: 'var(--ink)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-all hover:bg-black/5"
                    style={{ color: 'var(--subtle)' }}
                  >
                    <Trash2 className="size-3" />
                    Clear
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-xl p-1.5 transition-all hover:bg-black/5"
                  style={{ color: 'var(--subtle)' }}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[420px] overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div
                    className="mb-3 flex size-12 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(18,45,69,0.06)' }}
                  >
                    <Bell className="size-5" style={{ color: 'var(--subtle)' }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    No notifications
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
                    Incoming transfers will appear here
                  </p>
                </div>
              ) : (
                notifications.map((n) => <NotifItem key={n.id} n={n} />)
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
