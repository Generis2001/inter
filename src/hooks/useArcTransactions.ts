/**
 * Fetch transaction history for an address on the active Arc chain.
 * Parses USDC, EURC ERC-20 token transfers, and contract interactions.
 * Uses the chain block explorer API with fallback to local transaction store.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Amount } from '@/onchain-money'
import { TOKENS, TOKEN_BY_ADDRESS } from '../utils/tokens'
import { useNetwork, ARC_MAINNET_ID } from '../context/NetworkContext'

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

export function formatTransactionValue(
  rawValue: bigint | string,
  tokenSymbol: string = 'USDC',
  tokenAddress?: string,
  explicitDecimals?: number,
): string {
  const raw = typeof rawValue === 'bigint' ? rawValue : BigInt(rawValue || '0')
  if (raw === 0n) return '0.00'

  const addr = tokenAddress?.toLowerCase() ?? ''
  const isErc20Usdc = addr === '0x3600000000000000000000000000000000000000'
  const isErc20Eurc = addr === '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1'

  let decimals = explicitDecimals ?? 6
  if (!explicitDecimals) {
    if (addr === '0xfffffffffffffffffffffffffffffffffffffffe' || (!isErc20Usdc && !isErc20Eurc)) {
      if (raw >= 10_000_000_000_000n) {
        decimals = 18
      }
    } else if (raw >= 100_000_000_000_000n) {
      // If raw value is >= 10^14 (100M tokens in 6 decimals), it is an 18-decimal system transfer
      decimals = 18
    }
  }

  const amt = Amount.fromRaw(raw, decimals)
  return amt.raw > 0n && amt.raw < 10n ** BigInt(Math.max(0, decimals - 2)) ? amt.toFixed(4) : amt.toFixed(2)
}

/** Sanitize formatted value if it was saved with 18-dec / 6-dec mismatch */
export function sanitizeTxValue(valStr: string, rawVal?: bigint): string {
  if (rawVal && rawVal >= 100_000_000_000_000n) {
    return formatTransactionValue(rawVal)
  }
  const clean = (valStr || '').replace(/,/g, '')
  const num = parseFloat(clean)
  if (!isNaN(num) && num >= 100_000_000) {
    const fixed = num / 1e12
    return fixed < 0.01 ? fixed.toFixed(4) : fixed.toFixed(2)
  }
  return valStr || '0.00'
}

function safeBigInt(v: unknown): bigint | undefined {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number' && !isNaN(v)) return BigInt(Math.floor(v))
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) {
    try { return BigInt(v.trim()) } catch { return undefined }
  }
  if (typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v.trim())) {
    try { return BigInt(v.trim()) } catch { return undefined }
  }
  return undefined
}

/**
 * Persist transactions specifically and strictly for an address.
 * Transactions from different wallets are strictly separated.
 * chainId=5042 (mainnet) uses the legacy key; testnet uses a prefixed key.
 */
export function persistWalletTransactions(address: string, txs: ArcTransaction[], chainId = ARC_MAINNET_ID) {
  try {
    const addr = address.toLowerCase()
    const prefix = chainId === ARC_MAINNET_ID ? '' : `testnet_`
    const key = `inter_wallet_txs_${prefix}${addr}`
    const strictlyThisWallet = txs.filter((item) => {
      if (!item || !item.hash) return false
      const from = item.from?.toLowerCase()
      const to = item.to?.toLowerCase()
      return from === addr || to === addr
    }).slice(0, 100)

    localStorage.setItem(
      key,
      JSON.stringify(strictlyThisWallet, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    )
  } catch {
    // local storage unavailable
  }
}

export function recordTransaction(tx: ArcTransaction, chainId = ARC_MAINNET_ID) {
  try {
    const sanitizedTx: ArcTransaction = {
      ...tx,
      value: sanitizeTxValue(tx.value, tx.rawValue),
    }

    const prefix = chainId === ARC_MAINNET_ID ? '' : `testnet_`
    const saveForAddress = (addr: string) => {
      const cleanAddr = addr.toLowerCase()
      const key = `inter_wallet_txs_${prefix}${cleanAddr}`
      let existing: ArcTransaction[] = []
      try {
        const stored = localStorage.getItem(key)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) existing = parsed
        }
      } catch {}

      const updated = [
        sanitizedTx,
        ...existing.filter((item) => item.hash?.toLowerCase() !== sanitizedTx.hash?.toLowerCase()),
      ].slice(0, 100)

      localStorage.setItem(
        key,
        JSON.stringify(updated, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
      )
    }

    if (sanitizedTx.from) saveForAddress(sanitizedTx.from)
    if (sanitizedTx.to && sanitizedTx.to.toLowerCase() !== sanitizedTx.from?.toLowerCase()) {
      saveForAddress(sanitizedTx.to)
    }

    window.dispatchEvent(new CustomEvent('inter_tx_recorded', { detail: sanitizedTx }))
  } catch {
    // local storage unavailable
  }
}

export function getRecordedTransactions(address: string | undefined, chainId = ARC_MAINNET_ID): ArcTransaction[] {
  if (!address) return []
  try {
    const addr = address.toLowerCase()
    const prefix = chainId === ARC_MAINNET_ID ? '' : `testnet_`
    const key = `inter_wallet_txs_${prefix}${addr}`
    const txMap = new Map<string, ArcTransaction>()

    // 1. Read primary wallet storage
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        const list: ArcTransaction[] = JSON.parse(stored)
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.hash) {
              const from = item.from?.toLowerCase()
              const to = item.to?.toLowerCase()
              if (from === addr || to === addr) {
                item.value = sanitizeTxValue(item.value, safeBigInt(item.rawValue))
                txMap.set(item.hash.toLowerCase(), item)
              }
            }
          }
        }
      } catch {}
    }

    // 2. Also check legacy address key if present for smooth backward compatibility
    const legacyKey = `inter_tx_history_${addr}`
    const legacyStored = localStorage.getItem(legacyKey)
    if (legacyStored) {
      try {
        const list: ArcTransaction[] = JSON.parse(legacyStored)
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.hash) {
              const from = item.from?.toLowerCase()
              const to = item.to?.toLowerCase()
              if (from === addr || to === addr) {
                const hashKey = item.hash.toLowerCase()
                if (!txMap.has(hashKey)) {
                  item.value = sanitizeTxValue(item.value, safeBigInt(item.rawValue))
                  txMap.set(hashKey, item)
                }
              }
            }
          }
        }
      } catch {}
    }

    return Array.from(txMap.values()).sort((a, b) => b.timestamp - a.timestamp)
  } catch {
    return []
  }
}

export function useArcTransactions(address: `0x${string}` | undefined) {
  const { chain, chainId } = useNetwork()
  const [transactions, setTransactions] = useState<ArcTransaction[]>(() => getRecordedTransactions(address, chainId))
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)

  // Ref keeps track of rendered transactions to prevent race conditions & flicker
  const transactionsRef = useRef<ArcTransaction[]>(transactions)

  // Sync state whenever address or network changes
  useEffect(() => {
    const local = getRecordedTransactions(address, chainId)
    /* oxlint-disable-next-line react/set-state-in-effect */
    setTransactions(local)
    transactionsRef.current = local
  }, [address, chainId])

  useEffect(() => {
    transactionsRef.current = transactions
  }, [transactions])

  const fetchTxns = useCallback(async () => {
    if (!address) return

    // CRITICAL: Only flash loading skeletons if we don't have any cached transactions.
    // Background polling while transactions are rendered will NEVER flicker or hide history.
    if (transactionsRef.current.length === 0) {
      setIsLoading(true)
    }
    setIsError(false)

    const addrLower = address.toLowerCase()
    const freshLocal = getRecordedTransactions(address)
    const freshLocalMap = new Map<string, ArcTransaction>()
    for (const t of freshLocal) freshLocalMap.set(t.hash.toLowerCase(), t)

    let parsed: ArcTransaction[] = []

    // 1. Try Explorer API (with timeout so it never hangs)
    try {
      const explorerApi = `${chain.explorerBase}/api/v2/addresses/${address}/transactions`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(explorerApi, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (res.ok) {
        const data = await res.json() as { items?: ExplorerTx[] }
        const items = data.items ?? []
        parsed = items.map((tx) => {
          const trackedTransfer = tx.token_transfers?.find(
            (t) => TRACKED_ADDRESSES.has(t.token.address.toLowerCase()),
          )

          let rawValue: bigint
          let formattedValue: string
          let tokenSymbol: string

          if (trackedTransfer) {
            const tokenInfo = TOKEN_BY_ADDRESS[trackedTransfer.token.address.toLowerCase()]
            const transferDecimals = trackedTransfer.total.decimals
              ? parseInt(trackedTransfer.total.decimals, 10)
              : tokenInfo?.decimals
            rawValue = BigInt(trackedTransfer.total.value || '0')
            tokenSymbol = tokenInfo?.symbol ?? trackedTransfer.token.symbol ?? 'USDC'
            formattedValue = formatTransactionValue(rawValue, tokenSymbol, trackedTransfer.token.address, transferDecimals)
          } else {
            rawValue = BigInt(tx.value || '0')
            tokenSymbol = 'USDC'
            formattedValue = formatTransactionValue(rawValue, 'USDC', undefined, 18)
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
            timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now(),
            status: (tx.status === '1' || tx.status === 'ok' ? 'success' : tx.status === '0' ? 'failed' : 'pending') as ArcTransaction['status'],
            direction,
            blockNumber: tx.block !== null ? BigInt(tx.block) : null,
            gasUsed: tx.gas_used ?? '0',
            contractName,
            method,
            txType,
          }
        })
      }
    } catch {
      // Explorer API unavailable or CORS/Cloudflare protected — gracefully continue with local & RPC
    }

    // 2. Try Arc RPC getLogs for past blocks to catch onchain ERC-20 transfers
    try {
      const rpc = chain.rpcUrls[0]
      if (rpc) {
        const addrPadded = '0x000000000000000000000000' + address.slice(2).toLowerCase()
        const blockRes = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
        })
        const blockNumHex = (await blockRes.json()).result
        const blockNum = parseInt(blockNumHex, 16)
        if (blockNum > 0) {
          const fromBlock = '0x' + Math.max(0, blockNum - 2500).toString(16)
          const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
          const [sentRes, recvRes] = await Promise.all([
            fetch(rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'eth_getLogs',
                params: [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_TOPIC, addrPadded] }],
              }),
            }),
            fetch(rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'eth_getLogs',
                params: [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_TOPIC, null, addrPadded] }],
              }),
            }),
          ])
          const sentLogs = (await sentRes.json()).result ?? []
          const recvLogs = (await recvRes.json()).result ?? []
          const allLogs = [...sentLogs, ...recvLogs]

          for (const log of allLogs) {
            const tokenAddr = log.address.toLowerCase()
            const tokenInfo = TOKEN_BY_ADDRESS[tokenAddr] ?? TOKENS[0]
            const rawVal = BigInt(log.data === '0x' ? '0' : log.data)
            const fromAddr = ('0x' + log.topics[1].slice(26)).toLowerCase() as `0x${string}`
            const toAddr = ('0x' + log.topics[2].slice(26)).toLowerCase() as `0x${string}`
            const isSent = fromAddr === address.toLowerCase()

            // Maintain stable timestamp if transaction was already seen
            const existingTx = freshLocalMap.get(log.transactionHash.toLowerCase())
            const timestamp = existingTx?.timestamp ?? Date.now()

            parsed.push({
              hash: log.transactionHash,
              from: fromAddr,
              to: toAddr,
              value: formatTransactionValue(rawVal, tokenInfo.symbol, tokenAddr),
              rawValue: rawVal,
              tokenSymbol: tokenInfo.symbol,
              timestamp,
              status: 'success',
              direction: isSent ? 'sent' : 'received',
              blockNumber: BigInt(log.blockNumber),
              gasUsed: '0',
              txType: 'transfer',
            })
          }
        }
      }
    } catch {
      // RPC getLogs fallback failed — local store will serve data
    }

    // Merge parsed explorer/RPC txns with all recorded local transactions
    const txMap = new Map<string, ArcTransaction>()

    for (const t of freshLocal) txMap.set(t.hash.toLowerCase(), t)
    for (const t of parsed) {
      const key = t.hash.toLowerCase()
      if (!txMap.has(key)) {
        txMap.set(key, t)
      } else {
        const existing = txMap.get(key)!
        txMap.set(key, {
          ...existing,
          ...t,
          status: existing.status === 'success' ? 'success' : t.status,
          contractName: existing.contractName ?? t.contractName,
          method: existing.method ?? t.method,
          txType: existing.txType ?? t.txType,
        })
      }
    }

    // STRICT wallet isolation: only keep transactions belonging to this address
    const strictlyThisWallet = Array.from(txMap.values())
      .filter((t) => t.from?.toLowerCase() === addrLower || t.to?.toLowerCase() === addrLower)
      .sort((a, b) => b.timestamp - a.timestamp)

    persistWalletTransactions(address, strictlyThisWallet, chainId)
    setTransactions(strictlyThisWallet)
    transactionsRef.current = strictlyThisWallet
    setIsLoading(false)
  }, [address, chain.explorerBase, chain.rpcUrls, chainId])

  // Sync with block explorer API + listen for local recorded transactions
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    void fetchTxns()
    const handleRecorded = () => { void fetchTxns() }
    window.addEventListener('inter_tx_recorded', handleRecorded)
    const interval = setInterval(() => void fetchTxns(), 25_000)
    return () => {
      window.removeEventListener('inter_tx_recorded', handleRecorded)
      clearInterval(interval)
    }
  /* oxlint-enable react/set-state-in-effect */
  }, [fetchTxns])

  return { transactions, isLoading, isError, refetch: fetchTxns }
}
