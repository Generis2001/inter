import { useCallback, useEffect } from 'react'
import type { Address } from 'viem'
import type { ArcTransaction } from '../utils/transactionHistory'

export const BALANCE_REFRESH_INTERVAL = 5_000

/** Stable callback and immediate refresh after this wallet's confirmed activity. */
export function useWalletBalanceRefresh(refetch: () => Promise<unknown>, address: Address | undefined, chainId: number) {
  const refresh = useCallback(() => { void refetch() }, [refetch])
  useEffect(() => {
    if (!address) return
    const wallet = address.toLowerCase()
    const onRecorded = (event: Event) => {
      const tx = (event as CustomEvent<ArcTransaction>).detail
      if (tx?.chainId === chainId && tx.status === 'success' &&
        (tx.from?.toLowerCase() === wallet || tx.to?.toLowerCase() === wallet)) refresh()
    }
    window.addEventListener('inter_tx_recorded', onRecorded)
    return () => window.removeEventListener('inter_tx_recorded', onRecorded)
  }, [address, chainId, refresh])
  return refresh
}
