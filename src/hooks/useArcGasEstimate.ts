/**
 * Estimate gas cost for a USDC ERC-20 transfer on the active Arc chain.
 * Returns the fee in 6-decimal USDC display units.
 */
import { useEstimateGas, useGasPrice } from 'wagmi'
import { erc20Abi, encodeFunctionData } from 'viem'
import { getUsdc } from '@/onchain-facts'
import { Amount, gasTokenDecimalsFor, usdcDecimalsFor } from '@/onchain-money'
import { useNetwork, ARC_MAINNET_ID } from '../context/NetworkContext'

export function useArcGasEstimate(
  from: `0x${string}` | undefined,
  to: `0x${string}` | undefined,
  amount: bigint | undefined,
) {
  const { chainId } = useNetwork()
  const usdcFact = getUsdc(chainId) ?? getUsdc(ARC_MAINNET_ID)!

  const { data: gasPrice } = useGasPrice({ chainId })

  const data = (from && to && amount !== undefined)
    ? encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, amount],
      })
    : undefined

  const { data: gasEstimate } = useEstimateGas({
    chainId,
    account: from,
    to: usdcFact.address as `0x${string}`,
    data,
    query: { enabled: !!from && !!to && amount !== undefined },
  })

  if (!gasPrice || !gasEstimate) {
    return { feeFormatted: '~0.001', feeAmount: undefined }
  }

  // Fee in native (18 decimals) -> convert to USDC (6 decimals) by dividing by 10^12
  const feeNative = Amount.fromRaw(gasPrice * gasEstimate, gasTokenDecimalsFor(chainId))
  const feeUsdc = feeNative.toDecimals(usdcDecimalsFor(chainId), 'trunc')
  return { feeFormatted: feeUsdc.toFixed(6), feeAmount: feeUsdc }
}
