/**
 * Read USDC balance from Arc Mainnet ERC-20 (6 decimals).
 * On Arc, native and USDC ERC-20 are ONE pool — we show ONLY the ERC-20 view.
 */
import { useReadContract, useBlockNumber } from 'wagmi'
import { erc20Abi } from 'viem'
import { getUsdc, requireChain } from '@/onchain-facts'
import { Amount } from '@/onchain-money'

const ARC_MAINNET_ID = 5042
const usdcFact = getUsdc(ARC_MAINNET_ID)!

export interface ArcBalance {
  raw: bigint | undefined
  formatted: string
  amount: Amount | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useArcBalance(address: `0x${string}` | undefined): ArcBalance {
  // Watch block number to auto-refetch on new blocks
  const { data: _block } = useBlockNumber({ chainId: ARC_MAINNET_ID, watch: true })

  const { data, isLoading, isError, refetch } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_MAINNET_ID,
    query: {
      enabled: !!address,
      refetchInterval: 15_000, // fallback poll every 15s
    },
  })

  const amount = data !== undefined ? Amount.fromRaw(data, usdcFact.decimals) : undefined
  const formatted = amount ? amount.toFixed(2) : '0.00'

  return { raw: data, formatted, amount, isLoading, isError, refetch: () => { void refetch() } }
}

export function useArcChain() {
  return requireChain(ARC_MAINNET_ID)
}
