/**
 * Notification state derived from live transaction history.
 * Tracks new incoming (received) transactions since the user last opened
 * the notification panel, and surfaces them as actionable items.
 * State is kept in memory only — never persisted — so it resets on reload.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import type { ArcTransaction } from './useArcTransactions'

export interface WalletNotification {
  id: string          // tx hash
  type: 'received' | 'sent_confirmed' | 'failed'
  tokenSymbol: string
  value: string
  from: string
  to: string | null
  timestamp: number
  txHash: string
  read: boolean
}

export function useNotifications(transactions: ArcTransaction[]) {
  const [notifications, setNotifications] = useState<WalletNotification[]>([])
  // Track the hashes we've already ingested so we don't duplicate on re-poll
  const seenHashes = useRef<Set<string>>(new Set())
  // Track read state
  const [lastReadAt, setLastReadAt] = useState<number>(() => Date.now())

  // Derive notifications from new transactions
  useEffect(() => {
    const newItems: WalletNotification[] = []

    for (const tx of transactions) {
      if (seenHashes.current.has(tx.hash)) continue
      seenHashes.current.add(tx.hash)

      // Only surface received and failed transactions as push-style notifications
      if (tx.direction === 'received' || tx.status === 'failed') {
        const type: WalletNotification['type'] =
          tx.direction === 'received'
            ? 'received'
            : 'failed'

        newItems.push({
          id: tx.hash,
          type,
          tokenSymbol: tx.tokenSymbol,
          value: tx.value,
          from: tx.from,
          to: tx.to,
          timestamp: tx.timestamp > 0 ? tx.timestamp : Date.now(),
          txHash: tx.hash,
          read: tx.timestamp <= lastReadAt,
        })
      }
    }

    if (newItems.length > 0) {
      setNotifications((prev) => {
        // Newest first, cap at 50
        const merged = [...newItems, ...prev].slice(0, 50)
        return merged
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions])

  const unreadCount = notifications.filter(
    (n) => n.timestamp > lastReadAt,
  ).length

  const markAllRead = useCallback(() => {
    const now = Date.now()
    setLastReadAt(now)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    seenHashes.current.clear()
  }, [])

  return { notifications, unreadCount, markAllRead, clearAll }
}
