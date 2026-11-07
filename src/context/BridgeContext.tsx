import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createWalletClient, encodeFunctionData, erc20Abi, keccak256 } from 'viem'
import { toast } from 'sonner'
import { useWallet } from './WalletContext'
import { useNetwork } from './NetworkContext'
import { bridgeClient, getBridgeChain } from '../utils/bridgeChains'
import { towerTransport } from '../services/tower'
import { burnArgs, estimateBridge, fetchAttestation, messengerAbi, transmitterAbi, validateAttestedMessage, transactionGasBudget, type BridgeEstimate, type ReceivingEstimate } from '../services/cctp'
import { getBridgeOperations, saveBridgeOperation, isBridgePending, type BridgeOperation } from '../utils/bridgeHistory'
import { recordTransaction } from '../utils/transactionHistory'
import { recordKnownSpender } from '../utils/allowances'
import { Amount } from '../onchain-money'

interface BridgeContextValue {
  operations: BridgeOperation[]
  busy: boolean
  submit: (estimate: BridgeEstimate, existingId?: string) => Promise<void>
  complete: (operation: BridgeOperation, estimate: ReceivingEstimate) => Promise<void>
  retryBroadcast: (operation: BridgeOperation) => Promise<void>
  refresh: () => Promise<void>
}
const BridgeContext = createContext<BridgeContextValue | null>(null)

function writeBridgeActivity(operation: BridgeOperation) {
  const common = {
    value: Amount.fromRaw(BigInt(operation.amountRaw), 6).toFixed(6), rawValue: BigInt(operation.amountRaw), tokenSymbol: 'USDC',
    timestamp: operation.createdAt, status: operation.status === 'complete' ? 'success' as const : operation.status === 'failed' ? 'failed' as const : 'pending' as const,
    blockNumber: null, gasUsed: '0', contractName: 'Circle CCTP · Tower RPC', txType: 'bridge' as const, bridgeOperationId: operation.id,
  }
  if (operation.sourceHash && [5042, 5042002].includes(operation.sourceChainId)) recordTransaction({
    ...common, hash: operation.sourceHash, from: operation.wallet, to: getBridgeChain(operation.sourceChainId).messenger,
    direction: 'contract', method: 'Bridge to Base',
  }, operation.sourceChainId)
  if (operation.destinationHash && [5042, 5042002].includes(operation.destinationChainId)) recordTransaction({
    ...common, hash: operation.destinationHash, from: getBridgeChain(operation.destinationChainId).transmitter, to: operation.wallet,
    direction: 'received', method: 'Bridge from Base',
  }, operation.destinationChainId)
}

export function BridgeProvider({ children }: { children: ReactNode }) {
  const { account, screen } = useWallet()
  const { chainId } = useNetwork()
  const queryClient = useQueryClient()
  const current = useRef({ account, screen, chainId })
  useLayoutEffect(() => { current.current = { account, screen, chainId } }, [account, screen, chainId])
  const [allOperations, setOperations] = useState<BridgeOperation[]>([])
  const [busy, setBusy] = useState(false)
  const signing = useRef(false)
  const tracking = useRef(new Set<string>())
  const operations = allOperations.filter(row => row.wallet.toLowerCase() === account?.address.toLowerCase() &&
    getBridgeChain(row.sourceChainId).isTestnet === (chainId === 5042002))

  useEffect(() => {
    const reload = () => setOperations(getBridgeOperations(account?.address))
    reload()
    window.addEventListener('inter_bridge_updated', reload)
    window.addEventListener('storage', reload)
    return () => { window.removeEventListener('inter_bridge_updated', reload); window.removeEventListener('storage', reload) }
  }, [account?.address])

  const update = useCallback((operation: BridgeOperation, changes: Partial<BridgeOperation>) => {
    const latest = getBridgeOperations(operation.wallet).find(row => row.id === operation.id) ?? operation
    const row = { ...latest, ...changes, updatedAt: Date.now() }
    saveBridgeOperation(row)
    writeBridgeActivity(row)
    return row
  }, [])

  const assertSigner = (operation: Pick<BridgeOperation, 'wallet' | 'sourceChainId'>) => {
    const state = current.current
    if (!state.account || state.screen !== 'unlocked' || state.account.address.toLowerCase() !== operation.wallet.toLowerCase() ||
      (state.chainId === 5042002) !== getBridgeChain(operation.sourceChainId).isTestnet) throw new Error('Unlock this wallet on the bridge network before continuing.')
    return state.account
  }

  const track = useCallback(async (operation: BridgeOperation) => {
    if (!isBridgePending(operation) || tracking.current.has(operation.id) || signing.current) return
    tracking.current.add(operation.id)
    try {
      if (!operation.sourceHash) {
        if (operation.approvalHash && operation.status === 'approving') {
          const receipt = await bridgeClient(operation.sourceChainId).getTransactionReceipt({ hash: operation.approvalHash })
          update(operation, { status: receipt.status === 'success' ? 'ready-to-submit' : 'failed', approvalSignedTransaction: undefined, error: receipt.status === 'success' ? undefined : 'USDC approval reverted. No USDC was bridged.' })
        }
        return
      }
      const sourceReceipt = await bridgeClient(operation.sourceChainId).getTransactionReceipt({ hash: operation.sourceHash })
      if (sourceReceipt.status === 'reverted') { update(operation, { status: 'failed', error: 'The source transaction reverted. No USDC was bridged.' }); return }
      if (operation.destinationHash) {
        const receipt = await bridgeClient(operation.destinationChainId).getTransactionReceipt({ hash: operation.destinationHash })
        if (receipt.status === 'reverted') { update(operation, { status: 'ready-to-mint', destinationHash: undefined, destinationSignedTransaction: undefined, error: 'The destination transaction reverted. Your burn is preserved; retry receiving USDC.' }); return }
        update(operation, { status: 'complete', error: undefined, sourceSignedTransaction: undefined, destinationSignedTransaction: undefined })
        void queryClient.invalidateQueries()
        if (current.current.account?.address.toLowerCase() === operation.wallet.toLowerCase() &&
          (current.current.chainId === 5042002) === getBridgeChain(operation.sourceChainId).isTestnet) toast.success('Bridge complete. USDC received.')
        return
      }
      const attested = operation.message && operation.attestation ? { message: operation.message, attestation: operation.attestation } : await fetchAttestation(operation)
      if (!attested) { if (operation.status !== 'attesting' || operation.error) update(operation, { status: 'attesting', error: undefined }); return }
      const nonce = validateAttestedMessage(operation, attested.message)
      const destination = getBridgeChain(operation.destinationChainId)
      const used = await bridgeClient(operation.destinationChainId).readContract({ address: destination.transmitter, abi: transmitterAbi, functionName: 'usedNonces', args: [nonce] })
      // MessageTransmitter consumes this validated nonce atomically with minting.
      if (used !== 0n) { update(operation, { ...attested, status: 'complete', error: undefined, sourceSignedTransaction: undefined }); void queryClient.invalidateQueries(); return }
      if (operation.status !== 'ready-to-mint' || operation.error) update(operation, { ...attested, status: 'ready-to-mint', error: undefined })
    } catch (error) {
      const name = (error as { name?: string }).name ?? ''
      if (!name.includes('TransactionReceiptNotFound')) {
        const message = error instanceof Error ? error.message.split('\n')[0] : 'Tracking unavailable. Your bridge is saved.'
        if (operation.error !== message) update(operation, { error: message })
      }
    } finally { tracking.current.delete(operation.id) }
  }, [queryClient, update])

  const refresh = useCallback(async () => {
    const rows = getBridgeOperations(current.current.account?.address).filter(isBridgePending)
    await Promise.all(rows.map(track))
  }, [track])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => { void refresh() }, 10_000)
    return () => clearInterval(interval)
  }, [refresh, account?.address])

  const submit = async (quote: BridgeEstimate, existingId?: string) => {
    if (signing.current) throw new Error('A bridge transaction is already being signed.')
    signing.current = true; setBusy(true)
    let operation: BridgeOperation | undefined
    try {
      const signer = assertSigner({ wallet: quote.wallet, sourceChainId: quote.sourceChainId })
      const rows = getBridgeOperations(signer.address)
      const existing = existingId ? rows.find(row => row.id === existingId) : undefined
      if (existingId && (!existing || existing.sourceHash || !['ready-to-submit', 'approving'].includes(existing.status) ||
        existing.sourceChainId !== quote.sourceChainId || existing.destinationChainId !== quote.destinationChainId || BigInt(existing.amountRaw) !== quote.amountRaw)) throw new Error('This bridge cannot be submitted again.')
      if (!existing && rows.some(row => isBridgePending(row) && getBridgeChain(row.sourceChainId).isTestnet === getBridgeChain(quote.sourceChainId).isTestnet)) throw new Error('Finish your saved bridge before starting another one.')
      if (Date.now() - quote.quotedAt > 60_000) throw new Error('This estimate expired. Review an updated estimate.')
      const fresh = await estimateBridge(quote.sourceChainId, quote.destinationChainId, signer.address, quote.amountRaw)
      // The prepared approval + burn must fit the reviewed budget below. Small
      // gas-price movements alone should not invalidate a conservative quote.
      if (fresh.balanceRaw < quote.amountRaw || fresh.sourceNative < quote.sourceGas || fresh.destinationNative < fresh.destinationGas ||
        ([5042, 5042002].includes(quote.sourceChainId) && fresh.balanceRaw < quote.amountRaw + (quote.sourceGas + 999_999_999_999n) / 1_000_000_000_000n)) throw new Error('Insufficient USDC or network gas for this bridge.')
      operation = existing ?? { version: 1, id: crypto.randomUUID(), wallet: signer.address, sourceChainId: quote.sourceChainId, destinationChainId: quote.destinationChainId,
        amountRaw: quote.amountRaw.toString(), status: 'approving', createdAt: Date.now(), updatedAt: Date.now() }
      saveBridgeOperation(operation) // Refuse to sign if recovery storage is unavailable.
      const source = getBridgeChain(quote.sourceChainId)
      const client = bridgeClient(quote.sourceChainId)
      const allowance = await client.readContract({ address: source.usdc, abi: erc20Abi, functionName: 'allowance', args: [signer.address, source.messenger] })
      let approvalBudget = 0n
      if (allowance < quote.amountRaw) {
        assertSigner(operation)
        const wallet = createWalletClient({ account: signer, chain: source.chain, transport: towerTransport(source.chain.id) })
        await client.simulateContract({ account: signer.address, address: source.usdc, abi: erc20Abi, functionName: 'approve', args: [source.messenger, quote.amountRaw] })
        const request = await wallet.prepareTransactionRequest({ to: source.usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [source.messenger, quote.amountRaw] }) })
        approvalBudget = transactionGasBudget(request)
        if (approvalBudget > quote.sourceGas) throw new Error('Network fees increased. Review a new estimate.')
        assertSigner(operation)
        const signed = await wallet.signTransaction(request)
        const hash = keccak256(signed)
        operation = update(operation, { approvalHash: hash, approvalSignedTransaction: signed, status: 'approving', error: undefined })
        await client.sendRawTransaction({ serializedTransaction: signed })
        recordKnownSpender(signer.address, { tokenAddress: source.usdc, tokenSymbol: 'USDC', spenderAddress: source.messenger, spenderName: 'Circle CCTP', chainId: source.chain.id })
        const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 })
        if (receipt.status !== 'success') { operation = update(operation, { status: 'failed', error: 'USDC approval reverted.' }); throw new Error('USDC approval reverted.') }
      }
      operation = update(operation, { status: 'ready-to-submit', approvalSignedTransaction: undefined, error: undefined })
      assertSigner(operation)
      const wallet = createWalletClient({ account: signer, chain: source.chain, transport: towerTransport(source.chain.id) })
      await client.simulateContract({ account: signer.address, address: source.messenger, abi: messengerAbi, functionName: 'depositForBurn', args: burnArgs(source.chain.id, quote.destinationChainId, signer.address, quote.amountRaw) })
      const request = await wallet.prepareTransactionRequest({ to: source.messenger, data: encodeFunctionData({ abi: messengerAbi, functionName: 'depositForBurn', args: burnArgs(source.chain.id, quote.destinationChainId, signer.address, quote.amountRaw) }) })
      if (transactionGasBudget(request) + approvalBudget > quote.sourceGas) throw new Error('Network fees increased. Review a new estimate.')
      assertSigner(operation)
      const signed = await wallet.signTransaction(request)
      operation = update(operation, { sourceHash: keccak256(signed), sourceNonce: request.nonce, sourceSignedTransaction: signed, status: 'source-pending', error: undefined })
      // Persist the exact signed hash BEFORE broadcasting. Every retry uses this
      // same transaction, so a lost response cannot cause a second burn.
      await client.sendRawTransaction({ serializedTransaction: signed })
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : 'Bridge submission failed.'
      if (operation) update(operation, { error: message, status: operation.sourceHash ? 'source-pending' : operation.status === 'failed' ? 'failed' : operation.approvalHash || operation.status === 'ready-to-submit' ? operation.status : 'failed' })
      throw new Error(message)
    } finally { signing.current = false; setBusy(false); void refresh() }
  }

  const complete = async (row: BridgeOperation, estimate: ReceivingEstimate) => {
    if (signing.current) throw new Error('Another bridge transaction is being signed.')
    signing.current = true; setBusy(true)
    let operation = getBridgeOperations(row.wallet).find(item => item.id === row.id)
    try {
      if (!operation || operation.status !== 'ready-to-mint' || !operation.message || !operation.attestation || operation.destinationHash) throw new Error('This bridge is not ready to receive USDC yet.')
      if (estimate.operationId !== operation.id || Date.now() - estimate.quotedAt > 60_000) throw new Error('Receiving estimate expired. Review the receiving fee again.')
      const signer = assertSigner(operation)
      const destination = getBridgeChain(operation.destinationChainId)
      const nonce = validateAttestedMessage(operation, operation.message)
      const client = bridgeClient(destination.chain.id)
      if (await client.getChainId() !== destination.chain.id) throw new Error('Destination RPC network mismatch.')
      const used = await client.readContract({ address: destination.transmitter, abi: transmitterAbi, functionName: 'usedNonces', args: [nonce] })
      if (used !== 0n) { update(operation, { status: 'complete', error: undefined }); return }
      const wallet = createWalletClient({ account: signer, chain: destination.chain, transport: towerTransport(destination.chain.id) })
      await client.simulateContract({ account: signer.address, address: destination.transmitter, abi: transmitterAbi, functionName: 'receiveMessage', args: [operation.message, operation.attestation] })
      const request = await wallet.prepareTransactionRequest({ to: destination.transmitter, data: encodeFunctionData({ abi: transmitterAbi, functionName: 'receiveMessage', args: [operation.message, operation.attestation] }) })
      const gas = transactionGasBudget(request)
      if (gas > estimate.gas) throw new Error('Network fees increased. Review the receiving fee again.')
      if (await client.getBalance({ address: signer.address }) < gas) throw new Error(`Add ${destination.chain.nativeCurrency.symbol} on ${destination.chain.name} for gas.`)
      assertSigner(operation)
      const signed = await wallet.signTransaction(request)
      operation = update(operation, { destinationHash: keccak256(signed), destinationSignedTransaction: signed, status: 'destination-pending', error: undefined })
      await client.sendRawTransaction({ serializedTransaction: signed })
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : 'Destination transaction failed.'
      if (operation) update(operation, { error: message })
      throw new Error(message)
    } finally { signing.current = false; setBusy(false); void refresh() }
  }

  const retryBroadcast = async (operation: BridgeOperation) => {
    assertSigner(operation)
    const latest = getBridgeOperations(operation.wallet).find(row => row.id === operation.id)
    if (!latest || !isBridgePending(latest)) return
    const signed = latest.destinationSignedTransaction ?? latest.sourceSignedTransaction ?? latest.approvalSignedTransaction
    if (!signed) throw new Error('No signed transaction is available. Refresh bridge tracking.')
    const destination = !!latest.destinationSignedTransaction
    const client = bridgeClient(destination ? latest.destinationChainId : latest.sourceChainId)
    await client.sendRawTransaction({ serializedTransaction: signed })
    update(latest, { error: undefined })
    void refresh()
  }

  return <BridgeContext.Provider value={{ operations, busy, submit, complete, retryBroadcast, refresh }}>{children}</BridgeContext.Provider>
}

export function useBridge() {
  const context = useContext(BridgeContext)
  if (!context) throw new Error('useBridge must be used inside BridgeProvider')
  return context
}
