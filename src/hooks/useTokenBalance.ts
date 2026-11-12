/**
 * Generic ERC-20 balance hook for any token on the active Arc chain.
 * Used for USDC, EURC, and cirBTC. Network is read from NetworkContext.
 */
import { useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { Amount } from '@/onchain-money'
import { getTokenAddress, type TokenInfo } from '../utils/tokens'
import { useNetwork } from '../context/NetworkContext'
import { formatTokenBalance } from '../utils/tokenAmounts'
import { BALANCE_REFRESH_INTERVAL, useWalletBalanceRefresh } from './useWalletBalanceRefresh'

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
  const contractAddress = getTokenAddress(token.symbol, chainId)

  const { data, isLoading, isError, refetch } = useReadContract({
    address: contractAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: !!address,
      staleTime: 3_000,
      refetchInterval: BALANCE_REFRESH_INTERVAL,
      refetchOnMount: 'always',
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
    },
  })
  const refresh = useWalletBalanceRefresh(refetch, address, chainId)

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
    ? formatTokenBalance(amount, token)
    : token.symbol === 'cirBTC' ? '0.00000000' : '0.00'

  return {
    raw: typeof data === 'bigint' ? data : undefined,
    formatted,
    amount,
    isLoading,
    isError,
    refetch: refresh,
  }
}
