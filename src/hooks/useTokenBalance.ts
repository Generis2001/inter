/**
 * Generic ERC-20 balance hook for any token on Arc Mainnet.
 * Used for both USDC and EURC.
 */
import { useReadContract, useBlockNumber } from 'wagmi'
import { erc20Abi } from 'viem'
import { Amount } from '@/onchain-money'
import { ARC_MAINNET_ID, type TokenInfo } from '../utils/tokens'

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
  const { data: _block } = useBlockNumber({ chainId: ARC_MAINNET_ID, watch: true })

  const { data, isLoading, isError, refetch } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_MAINNET_ID,
    query: {
      enabled: !!address,
      refetchInterval: 15_000,
    },
  })

  const amount = data !== undefined ? Amount.fromRaw(data, token.decimals) : undefined
  const formatted = amount ? amount.toFixed(2) : '0.00'

  return { raw: data, formatted, amount, isLoading, isError, refetch: () => { void refetch() } }
}
