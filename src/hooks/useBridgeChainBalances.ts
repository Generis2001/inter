import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { bridgeClient, getBridgeChain } from '../utils/bridgeChains'

/** Shared by the secondary-chain holdings and the bridge's source balance. */
export function useBridgeChainBalances(chainId: number, address: Address | undefined) {
  const wallet = address?.toLowerCase() as Address | undefined

  return useQuery({
    queryKey: ['bridge-balance', chainId, wallet],
    enabled: !!wallet,
    queryFn: async () => {
      if (!wallet) throw new Error('Unlock your wallet to view balances.')
      const client = bridgeClient(chainId)
      if (await client.getChainId() !== chainId) throw new Error('Balance RPC network mismatch.')
      const chain = getBridgeChain(chainId)
      const [raw, native, gasPrice] = await Promise.all([
        client.readContract({ address: chain.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
        client.getBalance({ address: wallet }),
        client.getGasPrice(),
      ])
      return { raw, native, gasPrice }
    },
    retry: false,
    refetchInterval: 20_000,
  })
}
