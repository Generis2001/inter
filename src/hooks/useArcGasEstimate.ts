/**
 * Estimate gas cost for a USDC ERC-20 transfer on Arc Testnet.
 * Returns the fee in 6-decimal USDC display units.
 */
import { useEstimateGas, useGasPrice } from 'wagmi'
import { erc20Abi, encodeFunctionData } from 'viem'
import { getUsdc } from '@/onchain-facts'
import { Amount, gasTokenDecimalsFor, usdcDecimalsFor } from '@/onchain-money'

const ARC_MAINNET_ID = 5042
const usdcFact = getUsdc(ARC_MAINNET_ID)!

export function useArcGasEstimate(
  from: `0x${string}` | undefined,
  to: `0x${string}` | undefined,
  amount: bigint | undefined,
) {
  const { data: gasPrice } = useGasPrice({ chainId: ARC_MAINNET_ID })

  const data = (from && to && amount !== undefined)
    ? encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, amount],
      })
    : undefined

  const { data: gasEstimate } = useEstimateGas({
    chainId: ARC_MAINNET_ID,
    account: from,
    to: usdcFact.address as `0x${string}`,
    data,
    query: { enabled: !!from && !!to && amount !== undefined },
  })

  if (!gasPrice || !gasEstimate) {
    return { feeFormatted: '~0.001', feeAmount: undefined }
  }

  // Fee in native (18 decimals) → convert to USDC (6 decimals) by dividing by 10^12
  const feeNative = Amount.fromRaw(gasPrice * gasEstimate, gasTokenDecimalsFor(ARC_MAINNET_ID))
  const feeUsdc = feeNative.toDecimals(usdcDecimalsFor(ARC_MAINNET_ID), 'trunc')
  return { feeFormatted: feeUsdc.toFixed(6), feeAmount: feeUsdc }
}
