/**
 * Generic ERC-20 balance hook for any token on the active Arc chain.
 * Used for both USDC and EURC. Network is read from NetworkContext.
 */
import { useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { Amount } from '@/onchain-money'
import { type TokenInfo } from '../utils/tokens'
import { useNetwork } from '../context/NetworkContext'

export interface TokenBalance {
  raw: bigint | undefined
  formatted: string
  amount: Amount | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useTokenBalance(
  token: TokenInfo,
  address: `0x${string}` | undefined,
): TokenBalance {
  const { chainId } = useNetwork()

  const { data, isLoading, isError, refetch } = useReadContract({
    address: token.address,
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
      amount = Amount.fromRaw(data, token.decimals)
    } else if (data !== undefined && data !== null && typeof data === 'string' && /^\d+$/.test(data)) {
      amount = Amount.fromRaw(BigInt(data), token.decimals)
    }
  } catch {
    amount = undefined
  }

  const formatted = amount
    ? (amount.raw > 0n && amount.raw < 10_000n ? amount.toFixed(4) : amount.toFixed(2))
    : '0.00'

  return {
    raw: typeof data === 'bigint' ? data : undefined,
    formatted,
    amount,
    isLoading,
    isError,
    refetch: () => { void refetch() },
  }
}
