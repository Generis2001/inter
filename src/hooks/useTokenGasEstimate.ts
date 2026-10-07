/**
 * Estimate gas cost for an ERC-20 transfer on Arc Mainnet.
 * Works for any token (USDC, EURC, etc.).
 * Returns the fee in 6-decimal USDC display units (Arc native = USDC).
 */
import { useEstimateGas, useGasPrice } from 'wagmi'
import { erc20Abi, encodeFunctionData } from 'viem'
import { Amount, gasTokenDecimalsFor, usdcDecimalsFor } from '@/onchain-money'
import { ARC_MAINNET_ID, type TokenInfo } from '../utils/tokens'

export function useTokenGasEstimate(
  token: TokenInfo,
  from: `0x${string}` | undefined,
  to: `0x${string}` | undefined,
  amount: bigint | undefined,
) {
  const { data: gasPrice } = useGasPrice({ chainId: ARC_MAINNET_ID })

  const data =
    from && to && amount !== undefined
      ? encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to, amount],
        })
      : undefined

  const { data: gasEstimate } = useEstimateGas({
    chainId: ARC_MAINNET_ID,
    account: from,
    to: token.address,
    data,
    query: { enabled: !!from && !!to && amount !== undefined },
  })

  if (!gasPrice || !gasEstimate) {
    return { feeFormatted: '~0.001', feeAmount: undefined }
  }

  // Arc native gas token IS USDC (18 dec) - convert to 6-dec display
  const feeNative = Amount.fromRaw(
    gasPrice * gasEstimate,
    gasTokenDecimalsFor(ARC_MAINNET_ID),
  )
  const feeUsdc = feeNative.toDecimals(usdcDecimalsFor(ARC_MAINNET_ID), 'trunc')
  return { feeFormatted: feeUsdc.toFixed(6), feeAmount: feeUsdc }
}
