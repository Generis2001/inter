import type { Address } from 'viem'

export interface ArcTransaction {
  hash: string
  from: Address
  to: Address | null
  value: string
  rawValue: bigint
  tokenSymbol: string
  timestamp: number
  status: 'success' | 'failed' | 'pending'
  direction: 'sent' | 'received' | 'contract'
  blockNumber: bigint | null
  gasUsed: string
  contractName?: string
  method?: string
  txType?: 'swap' | 'approval' | 'contract' | 'transfer' | 'bridge'
  chainId?: number
  bridgeOperationId?: string
}

export const transactionHistoryKey = (address: string, chainId: number) =>
  `inter_wallet_txs_v2_${chainId}_${address.toLowerCase()}`

function readList(key: string): ArcTransaction[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value as ArcTransaction[] : []
  } catch { return [] }
}

function normalize(item: ArcTransaction, address: string, chainId: number): ArcTransaction | null {
  try {
    if (!item || typeof item.hash !== 'string' || !item.hash.startsWith('0x')) return null
    if (item.chainId !== undefined && item.chainId !== chainId) return null
    if (item.from?.toLowerCase() !== address && item.to?.toLowerCase() !== address) return null
    return {
      ...item, chainId,
      rawValue: BigInt(item.rawValue ?? 0),
      blockNumber: item.blockNumber == null ? null : BigInt(item.blockNumber),
    }
  } catch { return null }
}

export function getRecordedTransactions(address: string | undefined, chainId = 5042): ArcTransaction[] {
  if (!address) return []
  const addr = address.toLowerCase()
  const key = transactionHistoryKey(addr, chainId)
  const current = readList(key)
  // Untagged mainnet records have a known origin. Old testnet caches were
  // contaminated by mainnet polling; preserve them but only import tagged rows.
  const legacy = chainId === 5042
    ? [...readList(`inter_wallet_txs_${addr}`), ...readList(`inter_tx_history_${addr}`)]
    : chainId === 5042002
      ? readList(`inter_wallet_txs_testnet_${addr}`).filter(t => t.chainId === chainId)
      : []
  const rows = new Map<string, ArcTransaction>()
  for (const item of [...current, ...legacy]) {
    const row = normalize(item, addr, chainId)
    if (row && !rows.has(row.hash.toLowerCase())) rows.set(row.hash.toLowerCase(), row)
  }
  return [...rows.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200)
}

export function persistWalletTransactions(address: string, txs: ArcTransaction[], chainId = 5042): void {
  const addr = address.toLowerCase()
  const rows = txs.map(t => normalize(t, addr, chainId)).filter((t): t is ArcTransaction => t !== null).slice(0, 200)
  try {
    localStorage.setItem(transactionHistoryKey(addr, chainId), JSON.stringify(rows, (_key: string, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value))
  } catch { /* Keep legacy history intact when storage is unavailable. */ }
}

export function recordTransaction(tx: ArcTransaction, chainId = tx.chainId ?? 5042): void {
  const row = { ...tx, chainId }
  for (const address of new Set([tx.from, tx.to].filter((a): a is Address => !!a))) {
    const existing = getRecordedTransactions(address, chainId)
    persistWalletTransactions(address, [row, ...existing.filter(t => t.hash.toLowerCase() !== tx.hash.toLowerCase())], chainId)
  }
  window.dispatchEvent(new CustomEvent('inter_tx_recorded', { detail: row }))
}
