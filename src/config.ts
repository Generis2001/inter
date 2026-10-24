/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { defineChain } from 'viem'
import { arc } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

/** Arc Testnet — Chain ID 5042002 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc Testnet Explorer', url: 'https://explorer.testnet.arc.io' } },
  testnet: true,
})

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, arc.rpcUrls.default.http[0])
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arc, arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    [arc.id]:        http(),
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [mainnet.id]:    http(), // ENS resolution uses mainnet
  },
})
