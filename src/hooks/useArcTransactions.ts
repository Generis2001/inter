/**
 * Fetch transaction history for an address on the active Arc chain.
 * Parses USDC, EURC, cirBTC ERC-20 token transfers, and contract interactions.
 * Uses the chain block explorer API with fallback to local transaction store.
 */
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { Amount } from '@/onchain-money'
import { TOKENS, TOKEN_BY_ADDRESS, getToken, getTokens, CIRBTC_MAINNET_ADDRESS, CIRBTC_TESTNET_ADDRESS } from '../utils/tokens'
import { useNetwork } from '../context/NetworkContext'

import { getRecordedTransactions, persistWalletTransactions, type ArcTransaction } from '../utils/transactionHistory'
export { recordTransaction, getRecordedTransactions, persistWalletTransactions, type ArcTransaction } from '../utils/transactionHistory'

interface RpcLog {
  address: string
  data: string
  topics: string[]
  transactionHash: string
  blockNumber: string
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
  '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1': { name: 'EURC Contract', type: 'contract' },
  '0x89b50855aa3be2f677cd6303cec089b5f319d72a': { name: 'EURC Contract', type: 'contract' },
  [CIRBTC_MAINNET_ADDRESS.toLowerCase()]: { name: 'cirBTC Contract', type: 'contract' },
  [CIRBTC_TESTNET_ADDRESS.toLowerCase()]: { name: 'cirBTC Contract', type: 'contract' },
}

export function formatTransactionValue(
  rawValue: bigint | string,
  tokenSymbol: string = 'USDC',
  tokenAddress?: string,
  explicitDecimals?: number,
): string {
  const raw = typeof rawValue === 'bigint' ? rawValue : BigInt(rawValue || '0')
  const token = TOKEN_BY_ADDRESS[tokenAddress?.toLowerCase() ?? ''] ?? getToken(tokenSymbol)
  if (token?.symbol === 'cirBTC') return Amount.fromRaw(raw, token.decimals).toFixed(token.decimals)
  if (raw === 0n) return '0.00'

  const addr = tokenAddress?.toLowerCase() ?? ''
  const isErc20Usdc = addr === '0x3600000000000000000000000000000000000000'
  const isErc20Eurc = addr === '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1' || addr === '0x89b50855aa3be2f677cd6303cec089b5f319d72a'

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
export function sanitizeTxValue(valStr: string, rawVal?: bigint, tokenSymbol = 'USDC'): string {
  if (getToken(tokenSymbol)?.symbol === 'cirBTC') {
    return rawVal === undefined ? valStr || '0.00000000' : formatTransactionValue(rawVal, tokenSymbol)
  }
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

export function useArcTransactions(address: `0x${string}` | undefined) {
  const { chain, chainId } = useNetwork()
  const scope = `${chainId}:${address?.toLowerCase() ?? ''}`
  const activeScope = useRef(scope)
  useLayoutEffect(() => { activeScope.current = scope }, [scope])
  const [snapshot, setSnapshot] = useState(() => ({ scope, transactions: getRecordedTransactions(address, chainId) }))
  const transactions = snapshot.scope === scope ? snapshot.transactions : getRecordedTransactions(address, chainId)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)

  // Ref keeps track of rendered transactions to prevent race conditions & flicker
  const transactionsRef = useRef<ArcTransaction[]>(transactions)

  // Sync state whenever address or network changes
  useEffect(() => {
    const local = getRecordedTransactions(address, chainId)
    /* oxlint-disable-next-line react/set-state-in-effect */
    setSnapshot({ scope, transactions: local })
    transactionsRef.current = local
  }, [address, chainId, scope])

  useEffect(() => {
    transactionsRef.current = transactions
  }, [transactions])

  const fetchTxns = useCallback(async () => {
    if (!address) return
    const requestScope = scope
    const isCurrent = () => activeScope.current === requestScope
    const trackedAddresses = new Set(getTokens(chainId).map(token => token.address.toLowerCase()))

    // CRITICAL: Only flash loading skeletons if we don't have any cached transactions.
    // Background polling while transactions are rendered will NEVER flicker or hide history.
    if (transactionsRef.current.length === 0) {
      setIsLoading(true)
    }
    setIsError(false)

    const addrLower = address.toLowerCase()
    const freshLocal = getRecordedTransactions(address, chainId)
    if (freshLocal.length > 0 && isCurrent()) {
      setSnapshot({ scope: requestScope, transactions: freshLocal })
      transactionsRef.current = freshLocal
      setIsLoading(false)
    }
    const freshLocalMap = new Map<string, ArcTransaction>()
    for (const t of freshLocal) freshLocalMap.set(t.hash.toLowerCase(), t)

    let parsed: ArcTransaction[] = []

    // 1. Try Explorer API (with timeout so it never hangs)
    try {
      const explorerApi = `${chain.explorerBase}/api/v2/addresses/${address}/transactions`
      const res = await fetch(explorerApi, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const data = await res.json() as { items?: ExplorerTx[] }
        const items = data.items ?? []
        parsed = items.map((tx) => {
          const trackedTransfer = tx.token_transfers?.find(
            (t) => trackedAddresses.has(t.token.address.toLowerCase()),
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
          const to = (tx.to?.hash?.toLowerCase() ?? null) as `0x${string}` | null
          const addrLower = address.toLowerCase()
          const toLower = to ?? ''

          const isKnownContract = Boolean(KNOWN_CONTRACTS[toLower])
          const isContractCall = Boolean(tx.to?.is_contract) || isKnownContract || (Boolean(tx.method) && tx.method !== 'transfer')

          let direction: ArcTransaction['direction'] = 'contract'
          let txType: ArcTransaction['txType'] = 'contract'

          const isDexAddress =
            toLower === '0xeb8940752fa12944d3b2d736d51fa36e4da32bc8' ||
            from === '0xeb8940752fa12944d3b2d736d51fa36e4da32bc8' ||
            toLower === '0x8702463e73f74d0b6765abceb314ef07acb92650' ||
            from === '0x8702463e73f74d0b6765abceb314ef07acb92650'

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
            txType = isDexAddress ? 'swap' : 'transfer'
          } else if (to === addrLower) {
            direction = 'received'
            txType = isDexAddress ? 'swap' : 'transfer'
          }

          if (isDexAddress) {
            txType = 'swap'
          }

          const contractName =
            tx.to?.name ??
            KNOWN_CONTRACTS[toLower]?.name ??
            (isDexAddress ? 'Tower DEX Router' : isContractCall ? 'Contract' : undefined)
          const method = tx.method ?? (isKnownContract ? KNOWN_CONTRACTS[toLower].name : undefined)
          if (trackedTransfer && /^transfer/i.test(tx.method ?? '')) {
            direction = trackedTransfer.from.hash.toLowerCase() === addrLower ? 'sent' : 'received'
            txType = 'transfer'
          }

          return {
            hash: tx.hash,
            from,
            to,
            value: formattedValue,
            rawValue,
            tokenSymbol,
            timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now(),
            status: (tx.status === '1' || tx.status === 'ok' ? 'success' : tx.status === '0' ? 'failed' : 'pending'),
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

    if (!isCurrent()) return

    // 2. Try Arc RPC getLogs for past blocks to catch onchain ERC-20 transfers
    try {
      const rpc = chain.rpcUrls[0]
      if (rpc) {
        const addrPadded = '0x000000000000000000000000' + address.slice(2).toLowerCase()
        const blockRes = await fetch(rpc, {
          signal: AbortSignal.timeout(4000),
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
        })
        const blockNumHex = ((await blockRes.json()) as { result?: string }).result ?? '0x0'
        const blockNum = parseInt(blockNumHex, 16)
        if (blockNum > 0) {
          const fromBlock = '0x' + Math.max(0, blockNum - 2500).toString(16)
          const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
          const [sentRes, recvRes] = await Promise.all([
            fetch(rpc, {
              signal: AbortSignal.timeout(4000),
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
              signal: AbortSignal.timeout(4000),
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
          const sentLogs = ((await sentRes.json()) as { result?: RpcLog[] }).result ?? []
          const recvLogs = ((await recvRes.json()) as { result?: RpcLog[] }).result ?? []
          const allLogs = [...sentLogs, ...recvLogs]

          for (const log of allLogs) {
            if (log.topics.length < 3) continue
            const tokenAddr = log.address.toLowerCase()
            if (!trackedAddresses.has(tokenAddr)) continue
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

    if (!isCurrent()) return

    // Merge parsed explorer/RPC txns with all recorded local transactions
    const txMap = new Map<string, ArcTransaction>()

    for (const t of getRecordedTransactions(address, chainId)) txMap.set(t.hash.toLowerCase(), t)
    for (const t of parsed) {
      const key = t.hash.toLowerCase()
      if (!txMap.has(key)) {
        txMap.set(key, t)
      } else {
        const existing = txMap.get(key)!
        txMap.set(key, {
          ...existing,
          ...t,
          status: existing.txType === 'bridge' ? existing.status : t.status,
          chainId,
          contractName: existing.contractName ?? t.contractName,
          method: existing.method ?? t.method,
          txType: existing.txType ?? t.txType,
        })
      }
    }

    // STRICT wallet isolation: only keep transactions belonging to this address
    const strictlyThisWallet = Array.from(txMap.values())
      .map(t => ({ ...t, chainId }))
      .filter((t) => t.from?.toLowerCase() === addrLower || t.to?.toLowerCase() === addrLower)
      .sort((a, b) => b.timestamp - a.timestamp)

    persistWalletTransactions(address, strictlyThisWallet, chainId)
    setSnapshot({ scope: requestScope, transactions: strictlyThisWallet })
    transactionsRef.current = strictlyThisWallet
    setIsLoading(false)
  }, [address, chain.explorerBase, chain.rpcUrls, chainId, scope])

  // Sync with block explorer API + listen for local recorded transactions
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    void fetchTxns()
    const handleRecorded = (event: Event) => {
      if ((event as CustomEvent<ArcTransaction>).detail?.chainId === chainId) void fetchTxns()
    }
    window.addEventListener('inter_tx_recorded', handleRecorded)
    const handleResume = () => { if (document.visibilityState === 'visible') void fetchTxns() }
    window.addEventListener('focus', handleResume)
    window.addEventListener('online', handleResume)
    document.addEventListener('visibilitychange', handleResume)
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void fetchTxns() }, 10_000)
    return () => {
      window.removeEventListener('inter_tx_recorded', handleRecorded)
      window.removeEventListener('focus', handleResume)
      window.removeEventListener('online', handleResume)
      document.removeEventListener('visibilitychange', handleResume)
      clearInterval(interval)
    }
  /* oxlint-enable react/set-state-in-effect */
  }, [fetchTxns, chainId])

  return { transactions, isLoading, isError, refetch: fetchTxns }
}
