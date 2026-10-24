/**
 * Read USDC balance from the active Arc chain's ERC-20 (6 decimals).
 * On Arc, native and USDC ERC-20 are ONE pool — we show ONLY the ERC-20 view.
 * Network (mainnet / testnet) is read from NetworkContext.
 */
import { useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { getUsdc, requireChain } from '@/onchain-facts'
import { Amount } from '@/onchain-money'
import { useNetwork } from '../context/NetworkContext'

export interface ArcBalance {
  raw: bigint | undefined
  formatted: string
  amount: Amount | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useArcBalance(address: `0x${string}` | undefined): ArcBalance {
  const { chainId } = useNetwork()
  const usdcFact = getUsdc(chainId) ?? getUsdc(5042)! // fallback to mainnet fact

  const { data, isLoading, isError, refetch } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: !!address,
      refetchInterval: 15_000,
    },
  })

  let amount: Amount | undefined
  try {
    if (typeof data === 'bigint') {
      amount = Amount.fromRaw(data, usdcFact.decimals)
    } else if (data !== undefined && data !== null && typeof data === 'string' && /^\d+$/.test(data)) {
      amount = Amount.fromRaw(BigInt(data), usdcFact.decimals)
    }
  } catch {
    amount = undefined
  }

  const formatted = amount ? amount.toFixed(2) : '0.00'

  return {
    raw: typeof data === 'bigint' ? data : undefined,
    formatted,
    amount,
    isLoading,
    isError,
    refetch: () => { void refetch() },
  }
}

export function useArcChain() {
  const { chainId } = useNetwork()
  return requireChain(chainId)
}
