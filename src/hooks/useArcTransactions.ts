/**
 * Fetch transaction history for an address on Arc Mainnet.
 * Parses both USDC and EURC ERC-20 token transfers.
 * Uses the Arc Mainnet block explorer API (Blockscout-compatible).
 */
import { useState, useEffect, useCallback } from 'react'
import { requireChain } from '@/onchain-facts'
import { Amount } from '@/onchain-money'
import { TOKENS, TOKEN_BY_ADDRESS } from '../utils/tokens'

const ARC_MAINNET_ID = 5042
const USDC_DECIMALS = 6

// All tracked token addresses (lowercase)
const TRACKED_ADDRESSES = new Set(TOKENS.map((t) => t.address.toLowerCase()))

export interface ArcTransaction {
  hash: string
  from: `0x${string}`
  to: `0x${string}` | null
  value: string       // formatted token amount
  rawValue: bigint
  tokenSymbol: string // 'USDC' | 'EURC' | 'native'
  timestamp: number
  status: 'success' | 'failed' | 'pending'
  direction: 'sent' | 'received' | 'contract'
  blockNumber: bigint | null
  gasUsed: string
}

interface ExplorerTx {
  hash: string
  from: { hash: string }
  to: { hash: string } | null
  value: string
  timestamp: string
  status: string
  block: number | null
  gas_used: string | null
  token_transfers?: Array<{
    token: { address: string; symbol?: string; decimals?: string }
    from: { hash: string }
    to: { hash: string }
    total: { value: string; decimals: string }
  }>
}

export function useArcTransactions(address: `0x${string}` | undefined) {
  const [transactions, setTransactions] = useState<ArcTransaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const chain = requireChain(ARC_MAINNET_ID)

  const fetchTxns = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setIsError(false)
    try {
      const explorerApi = `${chain.explorerBase}/api/v2/addresses/${address}/transactions?filter=to%7Cfrom&limit=50`
      const res = await fetch(explorerApi)
      if (!res.ok) throw new Error('Explorer API error')
      const data = await res.json() as { items?: ExplorerTx[] }
      const items = data.items ?? []

      const parsed: ArcTransaction[] = items.map((tx) => {
        // Find any tracked token transfer (USDC or EURC)
        const trackedTransfer = tx.token_transfers?.find(
          (t) => TRACKED_ADDRESSES.has(t.token.address.toLowerCase()),
        )

        let rawValue: bigint
        let formattedValue: string
        let tokenSymbol: string

        if (trackedTransfer) {
          const tokenInfo = TOKEN_BY_ADDRESS[trackedTransfer.token.address.toLowerCase()]
          const decimals = tokenInfo?.decimals ?? USDC_DECIMALS
          rawValue = BigInt(trackedTransfer.total.value)
          formattedValue = Amount.fromRaw(rawValue, decimals).toFixed(2)
          tokenSymbol = tokenInfo?.symbol ?? trackedTransfer.token.symbol ?? 'TOKEN'
        } else {
          // Native value is 18 decimals on Arc (native = USDC gas token)
          rawValue = BigInt(tx.value || '0')
          formattedValue = Amount.fromRaw(rawValue / 10n ** 12n, USDC_DECIMALS).toFixed(2)
          tokenSymbol = 'USDC'
        }

        const from = tx.from.hash.toLowerCase() as `0x${string}`
        const to = tx.to?.hash?.toLowerCase() as `0x${string}` | null
        const addrLower = address.toLowerCase()

        let direction: ArcTransaction['direction'] = 'contract'
        if (from === addrLower) direction = 'sent'
        else if (to === addrLower) direction = 'received'

        return {
          hash: tx.hash,
          from,
          to,
          value: formattedValue,
          rawValue,
          tokenSymbol,
          timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() : 0,
          status: tx.status === '1' || tx.status === 'ok' ? 'success' : tx.status === '0' ? 'failed' : 'pending',
          direction,
          blockNumber: tx.block !== null ? BigInt(tx.block) : null,
          gasUsed: tx.gas_used ?? '0',
        }
      })

      setTransactions(parsed)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [address, chain.explorerBase])

  // Sync with block explorer API - external system, setState-in-effect is correct here.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    void fetchTxns()
    const interval = setInterval(() => void fetchTxns(), 30_000)
    return () => clearInterval(interval)
  /* oxlint-enable react/set-state-in-effect */
  }, [fetchTxns])

  return { transactions, isLoading, isError, refetch: fetchTxns }
}
