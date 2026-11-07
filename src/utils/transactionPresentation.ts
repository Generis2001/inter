import type { ArcTransaction } from './transactionHistory'

export function transactionKind(tx: ArcTransaction): 'transfer' | 'swap' | 'approval' | 'bridge' | 'contract' {
  if (tx.txType === 'bridge' || tx.bridgeOperationId) return 'bridge'
  if (tx.txType === 'approval' || tx.method?.toLowerCase().includes('approv')) return 'approval'
  if (tx.txType === 'swap') return 'swap'
  if (tx.txType === 'transfer' || tx.direction === 'sent' || tx.direction === 'received') return 'transfer'
  if (/swap|tower|uniswap|dex/i.test(`${tx.method ?? ''} ${tx.contractName ?? ''}`)) return 'swap'
  return 'contract'
}
