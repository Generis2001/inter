import { arc, arcTestnet, base, baseSepolia } from 'viem/chains'
import { createPublicClient, type Address, type Chain } from 'viem'
import { getProtocolContractByName, requireChain } from '../onchain-facts'
import { towerTransport } from '../services/tower'

export interface BridgeChain {
  chain: Chain
  domain: number
  usdc: Address
  messenger: Address
  transmitter: Address
  isTestnet: boolean
}

/** The secondary network always belongs to the active Arc environment. */
export function getSecondaryChainId(arcChainId: number): number {
  if (arcChainId === arc.id) return base.id
  if (arcChainId === arcTestnet.id) return baseSepolia.id
  throw new Error('Choose an Arc network to view its secondary chain.')
}

export function getBridgeChain(chainId: number): BridgeChain {
  const chain = [arc, arcTestnet, base, baseSepolia].find(c => c.id === chainId)
  if (!chain) throw new Error('This bridge network is not supported.')
  const facts = requireChain(chainId)
  const network = facts.isTestnet ? 'testnet' : 'mainnet'
  const messenger = getProtocolContractByName('TokenMessengerV2', network)
  const transmitter = getProtocolContractByName('MessageTransmitterV2', network)
  // The generated registry currently omits Base mainnet's CCTP domain. Circle
  // assigns domain 6 to Base in both environments; supplement it here.
  const domain = facts.cctpDomain ?? (chainId === 8453 ? 6 : undefined)
  if (!facts.usdc || domain === undefined || !messenger || !transmitter) throw new Error('Bridge network configuration is incomplete.')
  return { chain, domain, usdc: facts.usdc.address as Address,
    messenger: messenger.address as Address, transmitter: transmitter.address as Address, isTestnet: facts.isTestnet }
}

export function validateBridgeRoute(sourceId: number, destinationId: number): void {
  const source = getBridgeChain(sourceId)
  const destination = getBridgeChain(destinationId)
  if (sourceId === destinationId || source.isTestnet !== destination.isTestnet ||
    ![sourceId, destinationId].some(id => id === 5042 || id === 5042002)) throw new Error('Choose Arc and Base in the same network environment.')
}

export const bridgeClient = (chainId: number) => createPublicClient({ chain: getBridgeChain(chainId).chain, transport: towerTransport(chainId) })
export const circleApi = (isTestnet: boolean) => isTestnet ? 'https://iris-api-sandbox.circle.com' : 'https://iris-api.circle.com'
