import { test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { BaseError, HttpRequestError, concatHex, createPublicClient, padHex, toHex, type Address } from 'viem'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { getRecordedTransactions, recordTransaction, transactionHistoryKey, type ArcTransaction } from '../src/utils/transactionHistory'
import { getBridgeChain, getSecondaryChainId, validateBridgeRoute } from '../src/utils/bridgeChains'
import { getBridgeOperations, saveBridgeOperation, type BridgeOperation } from '../src/utils/bridgeHistory'
import { validateAttestedMessage, transactionGasBudget, ZERO_BYTES32 } from '../src/services/cctp'
import { transactionKind } from '../src/utils/transactionPresentation'
import { TransactionIcon } from '../src/components/shared/TransactionIcon'
import { encryptVault, decryptVault } from '../src/utils/vault'
import { Amount } from '../src/onchain-money'
import { getTokens, getTokenAddress, CIRBTC_MAINNET_ADDRESS, CIRBTC_TESTNET_ADDRESS } from '../src/utils/tokens'
import { formatTokenBalance } from '../src/utils/tokenAmounts'
import { formatTransactionValue, sanitizeTxValue } from '../src/hooks/useArcTransactions'
import { createTowerTransport } from '../src/services/towerRpc'
import { bridgeErrorMessage, savedBridgeError } from '../src/utils/bridgeErrors'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } })
Object.defineProperty(globalThis, 'window', { value: { dispatchEvent: () => true, crypto: webcrypto } })
const wallet = '0x1111111111111111111111111111111111111111' as Address
const other = '0x2222222222222222222222222222222222222222' as Address
const hash = (value: number) => toHex(value, { size: 32 })
const row = (value: number): ArcTransaction => ({ hash: hash(value), from: wallet, to: other, value: '3.123456', rawValue: 3_123456n,
  tokenSymbol: 'USDC', timestamp: value, status: 'success', direction: 'sent', blockNumber: 42n, gasUsed: '20000', txType: 'transfer' })
const operation = (id: string): BridgeOperation => ({ version: 1, id, wallet, sourceChainId: 5042, destinationChainId: 8453,
  amountRaw: '3123456', status: 'attesting', sourceHash: hash(10), createdAt: 1, updatedAt: 1 })
const json = (data: unknown) => JSON.stringify(data, (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value)

test('history isolates chains and restores bigint amounts after reload', () => {
  values.clear()
  recordTransaction(row(1), 5042); recordTransaction(row(2), 5042002); recordTransaction(row(3), 8453)
  assert.deepEqual(getRecordedTransactions(wallet, 5042).map(t => t.hash), [hash(1)])
  assert.deepEqual(getRecordedTransactions(wallet, 5042002).map(t => t.hash), [hash(2)])
  assert.deepEqual(getRecordedTransactions(wallet, 8453).map(t => t.hash), [hash(3)])
  assert.equal(getRecordedTransactions(wallet, 5042002)[0].rawValue, 3_123456n)
  assert.equal(getRecordedTransactions(wallet, 5042002)[0].blockNumber, 42n)
  assert.equal(getRecordedTransactions('0x3333333333333333333333333333333333333333', 5042).length, 0)
})

test('legacy mainnet and contaminated testnet caches never leak into testnet', () => {
  values.clear()
  values.set(`inter_wallet_txs_${wallet}`, json([row(4)]))
  values.set(`inter_tx_history_${wallet}`, json([row(5)]))
  values.set(`inter_wallet_txs_testnet_${wallet}`, json([row(4), { ...row(6), chainId: 5042002 }]))
  assert.deepEqual(getRecordedTransactions(wallet, 5042002).map(t => t.hash), [hash(6)])
  assert.deepEqual(getRecordedTransactions(wallet, 5042).map(t => t.hash), [hash(5), hash(4)])
  assert.ok(values.has(`inter_wallet_txs_testnet_${wallet}`), 'Original caches must be preserved')
  values.set(transactionHistoryKey(wallet, 5042002), json([{ ...row(7), chainId: 5042 }]))
  assert.ok(!getRecordedTransactions(wallet, 5042002).some(t => t.hash === hash(7)))
})

test('bridge pairs have distinct mainnet/testnet tokens and cannot mix environments', () => {
  for (const [from, to] of [[5042, 8453], [8453, 5042], [5042002, 84532], [84532, 5042002]]) assert.doesNotThrow(() => validateBridgeRoute(from, to))
  for (const [from, to] of [[5042, 84532], [5042002, 8453], [8453, 84532], [5042, 5042]]) assert.throws(() => validateBridgeRoute(from, to))
  assert.equal(getBridgeChain(8453).domain, 6)
  assert.notEqual(getBridgeChain(8453).usdc, getBridgeChain(84532).usdc)
  assert.notEqual(getBridgeChain(5042).messenger, getBridgeChain(5042002).messenger)
})

test('secondary-chain balances use Base and Base Sepolia in their respective Arc environments', () => {
  assert.equal(getSecondaryChainId(5042), 8453)
  assert.equal(getSecondaryChainId(5042002), 84532)
  assert.throws(() => getSecondaryChainId(8453))
  assert.equal(getBridgeChain(getSecondaryChainId(5042)).usdc.toLowerCase(), '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
  assert.equal(getBridgeChain(getSecondaryChainId(5042002)).usdc.toLowerCase(), '0x036cbd53842c5426634e7929541ec2318f3dcf7e')
  for (const id of [8453, 84532]) assert.equal(getBridgeChain(id).chain.nativeCurrency.decimals, 18)
})

test('cirBTC uses the verified deployment for each Arc network and preserves satoshis', () => {
  for (const [chainId, address] of [[5042, CIRBTC_MAINNET_ADDRESS], [5042002, CIRBTC_TESTNET_ADDRESS]] as const) {
    const token = getTokens(chainId).find(asset => asset.symbol === 'cirBTC')!
    assert.equal(token.address, address)
    assert.equal(getTokenAddress('cirBTC', chainId), address)
    assert.equal(token.decimals, 8)
    assert.equal(formatTokenBalance(Amount.fromRaw(1n, token.decimals), token), '0.00000001')
    assert.equal(formatTransactionValue(100_000_000n, 'cirBTC', address), '1.00000000')
    assert.equal(sanitizeTxValue('0.00', 1n, 'cirBTC'), '0.00000001')
    assert.equal(sanitizeTxValue('0.00', 100_000_000_000_000n, 'cirBTC'), '1000000.00000000')
    assert.equal(Amount.parse('0.00000001', token.decimals).raw, 1n)
    const icon = renderToStaticMarkup(createElement(TransactionIcon, { tx: { ...row(1), tokenSymbol: 'cirBTC', rawValue: 1n }, size: 34 }))
    assert.match(icon, /cirBTC logo/)
    assert.doesNotMatch(icon, /USDC logo|EURC logo/)
  }
  assert.notEqual(CIRBTC_MAINNET_ADDRESS.toLowerCase(), CIRBTC_TESTNET_ADDRESS.toLowerCase())
  assert.equal(formatTokenBalance(Amount.fromRaw(1n, 6), getTokens(5042)[0]), '0.000001')
})

// Independently encode the published CCTP V2 header and burn message fields.
function attestedMessage(recipient: Address = wallet, amount = 3_123456n) {
  const from = getBridgeChain(5042); const to = getBridgeChain(8453)
  return concatHex([
    toHex(1, { size: 4 }), toHex(26, { size: 4 }), toHex(6, { size: 4 }), hash(99),
    padHex(from.messenger, { size: 32 }), padHex(to.messenger, { size: 32 }), ZERO_BYTES32,
    toHex(2000, { size: 4 }), toHex(2000, { size: 4 }),
    toHex(1, { size: 4 }), padHex(from.usdc, { size: 32 }), padHex(recipient, { size: 32 }),
    toHex(amount, { size: 32 }), padHex(wallet, { size: 32 }), ZERO_BYTES32, ZERO_BYTES32, ZERO_BYTES32,
  ])
}

test('settlement rejects wrong recipients, amounts, chains, and malformed messages', () => {
  const op = operation('signed-burn')
  assert.equal(validateAttestedMessage(op, attestedMessage()), hash(99))
  assert.throws(() => validateAttestedMessage(op, attestedMessage(other)))
  assert.throws(() => validateAttestedMessage(op, attestedMessage(wallet, 4_000000n)))
  assert.throws(() => validateAttestedMessage({ ...op, sourceChainId: 5042002, destinationChainId: 84532 }, attestedMessage()))
  assert.throws(() => validateAttestedMessage(op, '0x1234'))
  const valid = attestedMessage()
  const mutate = (start: number, size: number, value: number) => ('0x' + valid.slice(2, 2 + start * 2) + toHex(value, { size }).slice(2) + valid.slice(2 + (start + size) * 2)) as `0x${string}`
  assert.throws(() => validateAttestedMessage(op, mutate(144, 4, 1000)), 'Reject unfinalized settlement')
  assert.throws(() => validateAttestedMessage(op, mutate(148, 4, 0)), 'Reject a different burn body version')
  assert.throws(() => validateAttestedMessage(op, mutate(312, 32, 1)), 'Reject unexpected protocol fees')
})

test('signing fee budgets require concrete EIP-1559 or legacy gas prices', () => {
  assert.equal(transactionGasBudget({ gas: 100_000n, maxFeePerGas: 2_000_000_000n }), 200_000_000_000_000n)
  assert.equal(transactionGasBudget({ gas: 100_000n, gasPrice: 1_000_000_000n }), 100_000_000_000_000n)
  assert.throws(() => transactionGasBudget({ gas: 100_000n }))
  assert.throws(() => transactionGasBudget({ maxFeePerGas: 2_000_000_000n }))
})

test('pending burns and their exact signed transaction identities survive reload and history caps', () => {
  values.clear()
  for (let i = 0; i < 105; i++) saveBridgeOperation({ ...operation(`completed-${i}`), status: 'complete' })
  const pending = { ...operation('interrupted-burn'), sourceSignedTransaction: '0x1234' as const }
  saveBridgeOperation(pending)
  const restored = getBridgeOperations(wallet)
  assert.equal(restored.length, 101)
  assert.equal(restored.find(op => op.id === pending.id)?.sourceHash, pending.sourceHash)
  assert.equal(restored.find(op => op.id === pending.id)?.sourceSignedTransaction, '0x1234')
  assert.equal(getBridgeOperations(other).length, 0)
  assert.throws(() => saveBridgeOperation({ ...pending, destinationChainId: 84532 }))
})

test('transfers show prominent currency logos; Tower approvals and bridges are not swaps', () => {
  const sent = row(1)
  const received = { ...row(2), direction: 'received' as const, tokenSymbol: 'EURC' }
  for (const tx of [sent, received]) {
    const markup = renderToStaticMarkup(createElement(TransactionIcon, { tx, size: 34 }))
    assert.match(markup, new RegExp(`${tx.tokenSymbol} logo`))
    assert.match(markup, /width="34"/)
  }
  assert.equal(transactionKind({ ...sent, direction: 'contract', txType: 'approval', contractName: 'Tower DEX Router' }), 'approval')
  assert.equal(transactionKind({ ...sent, txType: 'bridge', contractName: 'Circle CCTP · Tower RPC' }), 'bridge')
  assert.equal(transactionKind({ ...sent, txType: 'swap', contractName: 'Tower DEX Router' }), 'swap')
})

test('existing vault encryption stays compatible with the PIN flow', async () => {
  const data = { address: wallet, privateKey: 'test-fixture-only' }
  const encrypted = await encryptVault(data, '123456')
  assert.deepEqual(await decryptVault(encrypted, '123456'), data)
  await assert.rejects(decryptVault(encrypted, '654321'))
})

test('parallel bridge reads are batched and retry one temporary HTTP failure', async () => {
  const original = globalThis.fetch
  const requests: { method: string; id: number }[][] = []
  globalThis.fetch = async (_url, options) => {
    const calls = JSON.parse(options!.body as string) as { method: string; id: number }[]
    requests.push(calls)
    if (requests.length === 1) return Response.json({ error: 'Temporary upstream failure' }, { status: 503 })
    return Response.json(calls.map(call => ({ jsonrpc: '2.0', id: call.id, result: call.method === 'eth_chainId' ? '0x13b2' : '0x10' })))
  }
  try {
    const client = createPublicClient({ transport: createTowerTransport('https://bridge-proxy.invalid/api/tower/rpc/5042') })
    const result = await Promise.all([client.getChainId(), client.getBlockNumber(), client.getBalance({ address: wallet })])
    assert.deepEqual(result, [5042, 16n, 16n])
    assert.equal(requests.length, 2)
    assert.equal(requests[0].length, 3)
    assert.deepEqual(requests[1].map(call => call.method), requests[0].map(call => call.method))
  } finally { globalThis.fetch = original }
})

test('lost broadcast responses never trigger an automatic send or batch', async () => {
  const original = globalThis.fetch
  const requests: { method: string; params: string[] }[] = []
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options!.body as string) as { method: string; params: string[] })
    return Response.json({ error: 'Response lost after accepting transaction' }, { status: 502 })
  }
  try {
    const client = createPublicClient({ transport: createTowerTransport('https://bridge-proxy.invalid/api/tower/rpc/5042') })
    await assert.rejects(client.request({ method: 'eth_sendRawTransaction', params: ['0x1234'] }), error => {
      assert.match(bridgeErrorMessage(error), /HTTP 502/)
      return true
    })
    assert.equal(requests.length, 1)
    assert.equal(Array.isArray(requests[0]), false)
    assert.equal(requests[0].method, 'eth_sendRawTransaction')
    assert.deepEqual(requests[0].params, ['0x1234'])
  } finally { globalThis.fetch = original }
})

test('read retries are bounded and do not retry rejected access or contract reverts', async () => {
  const original = globalThis.fetch
  try {
    for (const status of [503, 403]) {
      let requests = 0
      globalThis.fetch = async () => { requests++; return Response.json({ error: 'Unavailable' }, { status }) }
      const client = createPublicClient({ transport: createTowerTransport(`https://bridge-proxy.invalid/${status}`) })
      await assert.rejects(client.getChainId())
      assert.equal(requests, status === 503 ? 2 : 1)
    }
    let requests = 0
    globalThis.fetch = async (_url, options) => {
      requests++
      const calls = JSON.parse(options!.body as string) as { id: number }[]
      return Response.json(calls.map(call => ({ jsonrpc: '2.0', id: call.id, error: { code: 3, message: 'execution reverted: paused' } })))
    }
    const client = createPublicClient({ transport: createTowerTransport('https://bridge-proxy.invalid/revert') })
    await assert.rejects(client.call({ to: wallet, data: '0x1234' }))
    assert.equal(requests, 1)
  } finally { globalThis.fetch = original }
})

test('a cancelled bridge read is not sent again after the retry delay', async () => {
  const original = globalThis.fetch
  const controller = new AbortController()
  let requests = 0
  globalThis.fetch = async () => {
    requests++
    setTimeout(() => controller.abort(), 20)
    return Response.json({ error: 'Temporary failure' }, { status: 503 })
  }
  try {
    const client = createPublicClient({ transport: createTowerTransport('https://bridge-proxy.invalid/cancelled') })
    await assert.rejects(client.request({ method: 'eth_chainId' }, { signal: controller.signal }))
    assert.equal(requests, 1)
  } finally { globalThis.fetch = original }
})

test('saved bridge HTTP errors retain a useful status without exposing the signed payload', () => {
  const error = new BaseError('The request failed.', { cause: new HttpRequestError({
    url: 'https://private-proxy.invalid/rpc', status: 502, body: { method: 'eth_sendRawTransaction', params: ['0xsecretbytes'] },
  }) })
  const message = savedBridgeError(error, 'bridge')
  assert.match(message, /HTTP 502/)
  assert.match(message, /signed bridge is saved/)
  assert.match(message, /Checking confirmation/)
  assert.doesNotMatch(message, /private-proxy|secretbytes|Request body|try again/)
  assert.equal(bridgeErrorMessage(new Error('This estimate expired. Review an updated estimate.')), 'This estimate expired. Review an updated estimate.')
})
