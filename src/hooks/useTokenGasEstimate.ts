/**
 * Estimate gas cost for an ERC-20 transfer on the active Arc chain.
 * Works for any token (USDC, EURC, etc.).
 * Returns the fee in 6-decimal USDC display units (Arc native = USDC).
 */
import { useEstimateGas, useGasPrice } from 'wagmi'
import { erc20Abi, encodeFunctionData } from 'viem'
import { Amount, gasTokenDecimalsFor, usdcDecimalsFor } from '@/onchain-money'
import { getTokenAddress, type TokenInfo } from '../utils/tokens'
import { useNetwork } from '../context/NetworkContext'

export function useTokenGasEstimate(
  token: TokenInfo,
  from: `0x${string}` | undefined,
  to: `0x${string}` | undefined,
  amount: bigint | undefined,
) {
  const { chainId } = useNetwork()
  const tokenContractAddress = getTokenAddress(token.symbol, chainId)
  const { data: gasPrice } = useGasPrice({ chainId })

  const data =
    from && to && amount !== undefined
      ? encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to, amount],
        })
      : undefined

  const { data: gasEstimate } = useEstimateGas({
    chainId,
    account: from,
    to: tokenContractAddress,
    data,
    query: { enabled: !!from && !!to && amount !== undefined },
  })

  if (!gasPrice || !gasEstimate) {
    return { feeFormatted: '~0.001', feeAmount: undefined }
  }

  // Arc native gas token IS USDC (18 dec) -- convert to 6-dec display
  const feeNative = Amount.fromRaw(
    gasPrice * gasEstimate,
    gasTokenDecimalsFor(chainId),
  )
  const feeUsdc = feeNative.toDecimals(usdcDecimalsFor(chainId), 'trunc')
  return { feeFormatted: feeUsdc.toFixed(6), feeAmount: feeUsdc }
}
