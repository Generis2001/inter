import { erc20Abi, parseAbi, padHex, sliceHex, hexToBigInt, type Address, type Hex } from 'viem'
import { bridgeClient, circleApi, getBridgeChain, validateBridgeRoute } from '../utils/bridgeChains'
import type { BridgeOperation } from '../utils/bridgeHistory'

// Circle CCTP V2 interfaces, verified against circlefin/evm-cctp-contracts.
export const messengerAbi = parseAbi([
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)',
  'function remoteTokenMessengers(uint32 domain) view returns (bytes32)',
])
export const transmitterAbi = parseAbi([
  'function localDomain() view returns (uint32)',
  'function receiveMessage(bytes message, bytes attestation) returns (bool)',
  'function usedNonces(bytes32 nonce) view returns (uint256)',
  'event MessageReceived(address indexed caller, uint32 sourceDomain, bytes32 indexed nonce, bytes32 sender, uint32 indexed finalityThresholdExecuted, bytes messageBody)',
])
export const ZERO_BYTES32 = padHex('0x', { size: 32 })
export const burnArgs = (sourceId: number, destinationId: number, wallet: Address, amount: bigint) =>
  [amount, getBridgeChain(destinationId).domain, padHex(wallet, { size: 32 }), getBridgeChain(sourceId).usdc, ZERO_BYTES32, 0n, 2000] as const

export interface BridgeEstimate {
  sourceChainId: number
  destinationChainId: number
  wallet: Address
  amountRaw: bigint
  balanceRaw: bigint
  sourceNative: bigint
  destinationNative: bigint
  sourceGas: bigint
  destinationGas: bigint
  quotedAt: number
}

export async function estimateBridge(sourceId: number, destinationId: number, wallet: Address, amount: bigint, signal?: AbortSignal): Promise<BridgeEstimate> {
  validateBridgeRoute(sourceId, destinationId)
  if (amount <= 0n) throw new Error('Enter a positive USDC amount.')
  const source = getBridgeChain(sourceId)
  const destination = getBridgeChain(destinationId)
  const from = bridgeClient(sourceId)
  const to = bridgeClient(destinationId)
  const [sourceChain, destinationChain, balanceRaw, sourceNative, destinationNative, sourcePrice, destinationPrice, sourceDomain, destinationDomain, sourceRemote, destinationRemote] = await Promise.all([
    from.getChainId(), to.getChainId(),
    from.readContract({ address: source.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
    from.getBalance({ address: wallet }), to.getBalance({ address: wallet }), from.estimateFeesPerGas(), to.estimateFeesPerGas(),
    from.readContract({ address: source.transmitter, abi: transmitterAbi, functionName: 'localDomain' }),
    to.readContract({ address: destination.transmitter, abi: transmitterAbi, functionName: 'localDomain' }),
    from.readContract({ address: source.messenger, abi: messengerAbi, functionName: 'remoteTokenMessengers', args: [destination.domain] }),
    to.readContract({ address: destination.messenger, abi: messengerAbi, functionName: 'remoteTokenMessengers', args: [source.domain] }),
  ])
  if (sourceChain !== sourceId || destinationChain !== destinationId || sourceDomain !== source.domain || destinationDomain !== destination.domain ||
    sourceRemote.toLowerCase() !== padHex(destination.messenger, { size: 32 }).toLowerCase() ||
    destinationRemote.toLowerCase() !== padHex(source.messenger, { size: 32 }).toLowerCase()) throw new Error('This CCTP route is not available on the selected networks.')
  const response = await fetch(`${circleApi(source.isTestnet)}/v2/burn/USDC/fees/${source.domain}/${destination.domain}`, { signal: signal ?? AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error('Circle bridge fee data is unavailable.')
  const fees: unknown = await response.json()
  // Standard CCTP uses finalized attestations and zero protocol fee. Refuse a
  // changed fee policy rather than signing a zero-fee burn that might not settle.
  if (!Array.isArray(fees) || !fees.some((row: { finalityThreshold?: unknown; minimumFee?: unknown }) => row.finalityThreshold === 2000 && Number(row.minimumFee) === 0)) throw new Error('Standard CCTP is unavailable for this route. Try again later.')
  return { sourceChainId: sourceId, destinationChainId: destinationId, wallet, amountRaw: amount, balanceRaw, sourceNative, destinationNative,
    sourceGas: (sourcePrice.maxFeePerGas ?? sourcePrice.gasPrice ?? 0n) * 500_000n,
    destinationGas: (destinationPrice.maxFeePerGas ?? destinationPrice.gasPrice ?? 0n) * 350_000n, quotedAt: Date.now() }
}

export interface ReceivingEstimate { operationId: string; gas: bigint; nativeBalance: bigint; quotedAt: number }

export async function estimateReceiving(operation: BridgeOperation): Promise<ReceivingEstimate> {
  if (!operation.message || !operation.attestation) throw new Error('Settlement is not ready yet.')
  validateAttestedMessage(operation, operation.message)
  const destination = getBridgeChain(operation.destinationChainId)
  const client = bridgeClient(destination.chain.id)
  const [chainId, gasUnits, fees, nativeBalance] = await Promise.all([
    client.getChainId(),
    client.estimateContractGas({ account: operation.wallet, address: destination.transmitter, abi: transmitterAbi,
      functionName: 'receiveMessage', args: [operation.message, operation.attestation] }),
    client.estimateFeesPerGas(), client.getBalance({ address: operation.wallet }),
  ])
  if (chainId !== destination.chain.id) throw new Error('Destination RPC network mismatch.')
  return { operationId: operation.id, gas: gasUnits * 2n * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n), nativeBalance, quotedAt: Date.now() }
}

export function transactionGasBudget(request: { gas?: bigint; maxFeePerGas?: bigint; gasPrice?: bigint }): bigint {
  const price = request.maxFeePerGas ?? request.gasPrice
  if (request.gas === undefined || price === undefined || price <= 0n) throw new Error('Network fee estimate is unavailable.')
  return request.gas * price
}

// V2 message header: version(4), source(4), destination(4), nonce(32),
// sender(32), recipient(32), caller(32), finality(4+4), then burn body.
export function validateAttestedMessage(operation: BridgeOperation, message: Hex): Hex {
  const source = getBridgeChain(operation.sourceChainId)
  const destination = getBridgeChain(operation.destinationChainId)
  if (!/^0x[0-9a-fA-F]+$/.test(message) || message.length < 2 + 376 * 2) throw new Error('Invalid Circle message.')
  const read = (start: number, end: number) => sliceHex(message, start, end)
  if (hexToBigInt(read(0, 4)) !== 1n || hexToBigInt(read(4, 8)) !== BigInt(source.domain) ||
    hexToBigInt(read(8, 12)) !== BigInt(destination.domain) ||
    read(44, 76).toLowerCase() !== padHex(source.messenger, { size: 32 }).toLowerCase() ||
    read(76, 108).toLowerCase() !== padHex(destination.messenger, { size: 32 }).toLowerCase() ||
    read(108, 140) !== ZERO_BYTES32 ||
    hexToBigInt(read(140, 144)) !== 2000n ||
    hexToBigInt(read(144, 148)) < 2000n || hexToBigInt(read(148, 152)) !== 1n ||
    read(152, 184).toLowerCase() !== padHex(source.usdc, { size: 32 }).toLowerCase() ||
    read(184, 216).toLowerCase() !== padHex(operation.wallet, { size: 32 }).toLowerCase() ||
    hexToBigInt(read(216, 248)) !== BigInt(operation.amountRaw) ||
    read(248, 280).toLowerCase() !== padHex(operation.wallet, { size: 32 }).toLowerCase() ||
    hexToBigInt(read(280, 312)) !== 0n || hexToBigInt(read(312, 344)) !== 0n) throw new Error('Circle message does not match this bridge.')
  return read(12, 44)
}

export async function fetchAttestation(operation: BridgeOperation): Promise<{ message: Hex; attestation: Hex } | null> {
  if (!operation.sourceHash) return null
  const source = getBridgeChain(operation.sourceChainId)
  const response = await fetch(`${circleApi(source.isTestnet)}/v2/messages/${source.domain}?transactionHash=${operation.sourceHash}`, { signal: AbortSignal.timeout(20_000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Circle settlement tracking is unavailable. Your bridge can be resumed.')
  const result = await response.json() as { messages?: { status: string; message: Hex; attestation: Hex }[] }
  const candidates = result.messages?.filter(row => row.status === 'complete' && /^0x[0-9a-fA-F]+$/.test(row.attestation)) ?? []
  for (const row of candidates) {
    try { validateAttestedMessage(operation, row.message); return { message: row.message, attestation: row.attestation } }
    catch { /* Never sign a message for a different recipient/amount/route. */ }
  }
  if (candidates.length) throw new Error('Circle returned settlement data for a different bridge.')
  return null
}
