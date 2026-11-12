import type { Address } from 'viem'

/** Match balances for one wallet and actual chain, including inactive screens. */
export function isWalletBalanceQuery(queryKey: readonly unknown[], address: Address, chainId: number): boolean {
  const [kind, params] = queryKey
  const wallet = address.toLowerCase()
  if (kind === 'bridge-balance') return params === chainId && queryKey[2] === wallet
  if ((kind !== 'readContract' && kind !== 'balance') || !params || typeof params !== 'object') return false
  const key = params as { chainId?: number; address?: string; functionName?: string; args?: unknown[] }
  if (key.chainId !== chainId) return false
  if (kind === 'balance') return key.address?.toLowerCase() === wallet
  return key.functionName === 'balanceOf' && typeof key.args?.[0] === 'string' && key.args[0].toLowerCase() === wallet
}
