import type { Address, Hex } from 'viem'
import { validateBridgeRoute } from './bridgeChains'

export type BridgeStatus = 'approving' | 'ready-to-submit' | 'submitting' | 'source-pending' | 'attesting' | 'ready-to-mint' | 'minting' | 'destination-pending' | 'complete' | 'failed'
export interface BridgeOperation {
  version: 1
  id: string
  wallet: Address
  sourceChainId: number
  destinationChainId: number
  amountRaw: string
  status: BridgeStatus
  createdAt: number
  updatedAt: number
  approvalHash?: Hex
  approvalSignedTransaction?: Hex
  sourceHash?: Hex
  destinationHash?: Hex
  // Persist expected signed transaction identities before broadcast. A lost RPC
  // response must be tracked, not replaced by a second burn/mint.
  sourceNonce?: number
  sourceSignedTransaction?: Hex
  destinationSignedTransaction?: Hex
  message?: Hex
  attestation?: Hex
  error?: string
}

export const bridgeHistoryKey = (wallet: string) => `inter_bridges_v1_${wallet.toLowerCase()}`
export const isBridgePending = (operation: BridgeOperation) => !['complete', 'failed'].includes(operation.status)

export function getBridgeOperations(wallet: string | undefined): BridgeOperation[] {
  if (!wallet) return []
  try {
    const value: unknown = JSON.parse(localStorage.getItem(bridgeHistoryKey(wallet)) ?? '[]')
    if (!Array.isArray(value)) return []
    return (value as unknown[]).filter((item): item is BridgeOperation => {
      try {
        if (!item || typeof item !== 'object') return false
        const row = item as Record<string, unknown>
        if (typeof row.sourceChainId !== 'number' || typeof row.destinationChainId !== 'number' || typeof row.wallet !== 'string' ||
          typeof row.amountRaw !== 'string' || typeof row.status !== 'string') return false
        validateBridgeRoute(row.sourceChainId, row.destinationChainId)
        return row.version === 1 && row.wallet?.toLowerCase() === wallet.toLowerCase() &&
          typeof row.id === 'string' && /^\d+$/.test(row.amountRaw) && BigInt(row.amountRaw) > 0n &&
          ['approving', 'ready-to-submit', 'submitting', 'source-pending', 'attesting', 'ready-to-mint', 'minting', 'destination-pending', 'complete', 'failed'].includes(row.status)
      } catch { return false }
    }).sort((a, b) => b.createdAt - a.createdAt)
  } catch { return [] }
}

export function saveBridgeOperation(operation: BridgeOperation): void {
  validateBridgeRoute(operation.sourceChainId, operation.destinationChainId)
  const existing = getBridgeOperations(operation.wallet)
  // Keep every unsettled bridge, even when the completed history is large.
  const rows = [operation, ...existing.filter(row => row.id !== operation.id)]
  const pending = rows.filter(isBridgePending)
  const completed = rows.filter(row => !isBridgePending(row)).slice(0, 100)
  localStorage.setItem(bridgeHistoryKey(operation.wallet), JSON.stringify([...pending, ...completed]))
  window.dispatchEvent(new CustomEvent('inter_bridge_updated', { detail: operation }))
}
