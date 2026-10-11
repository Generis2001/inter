/**
 * Fetch transaction history for an address on Arc Mainnet.
 * Parses USDC, EURC ERC-20 token transfers, and contract interactions.
 * Uses the Arc Mainnet block explorer API with fallback to local transaction store.
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
  tokenSymbol: string // 'USDC' | 'EURC' | 'native' | 'TOKEN'
  timestamp: number
  status: 'success' | 'failed' | 'pending'
  direction: 'sent' | 'received' | 'contract'
  blockNumber: bigint | null
  gasUsed: string
  contractName?: string
  method?: string
  txType?: 'swap' | 'approval' | 'contract' | 'transfer'
}

interface ExplorerTx {
  hash: string
  from: { hash: string }
  to: { hash: string; is_contract?: boolean; name?: string } | null
  value: string
  timestamp: string
  status: string
  block: number | null
  gas_used: string | null
  method?: string
  token_transfers?: Array<{
    token: { address: string; symbol?: string; decimals?: string }
    from: { hash: string }
    to: { hash: string }
    total: { value: string; decimals: string }
  }>
}

const KNOWN_CONTRACTS: Record<string, { name: string; type: 'swap' | 'approval' | 'contract' }> = {
  '0xeb8940752fa12944d3b2d736d51fa36e4da32bc8': { name: 'Tower DEX Router', type: 'swap' },
  '0x8702463e73f74d0b6765abceb314ef07acb92650': { name: 'Uniswap v4 Router', type: 'swap' },
  '0x8dc178efb8111bb0973dd9d722ebeff267c98f94': { name: 'Uniswap v4 Quoter', type: 'contract' },
  '0x1f98400000000000000000000000000000000004': { name: 'Uniswap v4 PoolManager', type: 'contract' },
  '0x000000000022d473030f116ddee9f6b43ac78ba3': { name: 'Permit2', type: 'approval' },
  '0x32b5fece16ff4619e4233772f4477ce177a1371b': { name: 'Inter Name Registry', type: 'contract' },
  '0x3600000000000000000000000000000000000000': { name: 'USDC Contract', type: 'contract' },
  '0xeb9898e903126fa400e88029584aac4b14dd8b37': { name: 'EURC Contract', type: 'contract' },
}

export function recordTransaction(tx: ArcTransaction) {
  try {
    const key = `inter_tx_history_${tx.from.toLowerCase()}`
    const existing: ArcTransaction[] = JSON.parse(localStorage.getItem(key) || '[]')
    const updated = [tx, ...existing.filter((item) => item.hash.toLowerCase() !== tx.hash.toLowerCase())].slice(0, 50)
    localStorage.setItem(key, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('inter_tx_recorded', { detail: tx }))
  } catch {
    // local storage unavailable
  }
}

export function getRecordedTransactions(address: string | undefined): ArcTransaction[] {
  if (!address) return []
  try {
    const key = `inter_tx_history_${address.toLowerCase()}`
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function useArcTransactions(address: `0x${string}` | undefined) {
  const [transactions, setTransactions] = useState<ArcTransaction[]>(() => getRecordedTransactions(address))
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const chain = requireChain(ARC_MAINNET_ID)

  const fetchTxns = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setIsError(false)
    try {
      const explorerApi = `${chain.explorerBase}/api/v2/addresses/${address}/transactions`
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
          rawValue = BigInt(tx.value || '0')
          formattedValue = Amount.fromRaw(rawValue / 10n ** 12n, USDC_DECIMALS).toFixed(2)
          tokenSymbol = 'USDC'
        }

        const from = tx.from.hash.toLowerCase() as `0x${string}`
        const to = tx.to?.hash?.toLowerCase() as `0x${string}` | null
        const addrLower = address.toLowerCase()
        const toLower = to ?? ''

        const isKnownContract = Boolean(KNOWN_CONTRACTS[toLower])
        const isContractCall = Boolean(tx.to?.is_contract) || isKnownContract || (Boolean(tx.method) && tx.method !== 'transfer')

        let direction: ArcTransaction['direction'] = 'contract'
        let txType: ArcTransaction['txType'] = 'contract'

        if (isContractCall) {
          direction = 'contract'
          if (isKnownContract) {
            txType = KNOWN_CONTRACTS[toLower].type
          } else if (tx.method?.toLowerCase().includes('swap')) {
            txType = 'swap'
          } else if (tx.method?.toLowerCase().includes('approve')) {
            txType = 'approval'
          }
        } else if (from === addrLower) {
          direction = 'sent'
          txType = 'transfer'
        } else if (to === addrLower) {
          direction = 'received'
          txType = 'transfer'
        }

        const contractName = tx.to?.name ?? KNOWN_CONTRACTS[toLower]?.name ?? (isContractCall ? 'Contract' : undefined)
        const method = tx.method ?? (isKnownContract ? KNOWN_CONTRACTS[toLower].name : undefined)

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
          contractName,
          method,
          txType,
        }
      })

      // Merge with locally stored transactions
      const localTxns = getRecordedTransactions(address)
      const txMap = new Map<string, ArcTransaction>()

      for (const t of parsed) txMap.set(t.hash.toLowerCase(), t)
      for (const t of localTxns) {
        const key = t.hash.toLowerCase()
        if (!txMap.has(key)) {
          txMap.set(key, t)
        } else {
          const existing = txMap.get(key)!
          txMap.set(key, {
            ...existing,
            contractName: t.contractName ?? existing.contractName,
            method: t.method ?? existing.method,
            txType: t.txType ?? existing.txType,
            direction: t.direction ?? existing.direction,
          })
        }
      }

      const combined = Array.from(txMap.values()).sort((a, b) => b.timestamp - a.timestamp)
      setTransactions(combined)
    } catch {
      setIsError(true)
      const localTxns = getRecordedTransactions(address)
      if (localTxns.length > 0) {
        setTransactions(localTxns)
      }
    } finally {
      setIsLoading(false)
    }
  }, [address, chain.explorerBase])

  // Sync with block explorer API + listen for local recorded transactions
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    void fetchTxns()
    const handleRecorded = () => { void fetchTxns() }
    window.addEventListener('inter_tx_recorded', handleRecorded)
    const interval = setInterval(() => void fetchTxns(), 30_000)
    return () => {
      window.removeEventListener('inter_tx_recorded', handleRecorded)
      clearInterval(interval)
    }
  /* oxlint-enable react/set-state-in-effect */
  }, [fetchTxns])

  return { transactions, isLoading, isError, refetch: fetchTxns }
}
