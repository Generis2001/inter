import { isAddress, type Address, type Hex } from 'viem'
import { towerRequest } from './tower'

interface TowerApproval {
  to?: string
  token?: string
  spender?: string
  data: Hex
  value?: string
  gasLimit?: string
  amountRaw?: string
}

export interface TowerSwapTransaction {
  to: Address
  data: Hex
  value: string
  gasLimit?: string
  executorAddress?: Address
  chainId?: number
}

interface TowerBuildData {
  approval?: TowerApproval
  approve?: TowerApproval
  swap: TowerSwapTransaction
}

export function towerSwapBuildPayload(quote: unknown, userAddress: Address, chainId: number) {
  if (![5042, 5042002].includes(chainId) || !quote || typeof quote !== 'object' || Array.isArray(quote)) {
    throw new Error('Invalid swap quote. Review the swap again.')
  }
  const row = quote as Record<string, unknown>
  if (row.chainId !== undefined && row.chainId !== chainId) throw new Error('Swap quote belongs to a different network.')
  // Tower quote responses can omit chainId. Its builder selects the network
  // from the quote itself, so a top-level chainId alone does not fix testnet.
  return { quote: { ...row, chainId }, userAddress, chainId }
}

export async function buildTowerSwapTransaction(quote: unknown, userAddress: Address, chainId: number) {
  const payload = towerSwapBuildPayload(quote, userAddress, chainId)
  const result = await towerRequest<{ success: boolean; data: TowerBuildData }>('/swap/build-tx', payload)
  const data = result.data
  if (!result.success || !data?.swap || !isAddress(data.swap.to) || !/^0x(?:[0-9a-fA-F]{2})+$/.test(data.swap.data)) {
    throw new Error('Tower returned an invalid swap transaction. Request a fresh quote.')
  }
  if (data.swap.chainId !== undefined && data.swap.chainId !== chainId) throw new Error('Tower returned a swap for a different network.')
  // The current API calls this field "approval"; older responses used "approve".
  return { approve: data.approval ?? data.approve, swap: data.swap }
}
