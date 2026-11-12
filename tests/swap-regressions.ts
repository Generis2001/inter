import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTowerSwapTransaction, towerSwapBuildPayload } from '../src/services/towerSwap'
import { isWalletBalanceQuery } from '../src/utils/walletQueries'
import { parseOnchainError } from '../src/utils/wallet'

const wallet = '0x1111111111111111111111111111111111111111' as const
const other = '0x2222222222222222222222222222222222222222' as const
const token = '0x3600000000000000000000000000000000000000' as const
const quote = { inputToken: token, outputToken: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', inputAmountRaw: '2000000' }

test('testnet quote builds carry the selected network inside the quote and request', () => {
  const payload = towerSwapBuildPayload(quote, wallet, 5042002)
  assert.equal(payload.quote.chainId, 5042002)
  assert.equal(payload.chainId, 5042002)
  assert.equal(payload.quote.inputAmountRaw, '2000000')
  assert.equal('chainId' in quote, false, 'The reviewed quote must not be mutated')
  assert.throws(() => towerSwapBuildPayload({ ...quote, chainId: 5042 }, wallet, 5042002), /different network/)
  assert.throws(() => towerSwapBuildPayload(quote, wallet, 8453), /Invalid swap quote/)
})

test('Tower builder accepts the current approval field and refuses another network', async () => {
  const original = globalThis.fetch
  let builtChain = 5042002
  globalThis.fetch = (_input, init) => {
    const request = JSON.parse(init?.body as string) as { quote: { chainId: number }; chainId: number }
    assert.equal(request.quote.chainId, 5042002, 'The builder otherwise defaults to mainnet')
    assert.equal(request.chainId, 5042002)
    return Promise.resolve(Response.json({ success: true, data: {
      approval: { token, spender: other, data: '0x095ea7b3' },
      swap: { to: other, data: '0xcd6267d5', value: '0', chainId: builtChain },
    } }))
  }
  try {
    const built = await buildTowerSwapTransaction(quote, wallet, 5042002)
    assert.equal(built.approve?.token, token)
    assert.equal(built.approve?.spender, other)
    builtChain = 5042
    await assert.rejects(buildTowerSwapTransaction(quote, wallet, 5042002), /different network/)
  } finally { globalThis.fetch = original }
})

test('stale Tower routes produce an actionable swap error', async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => Promise.resolve(Response.json({ success: false, error: 'No valid route found', code: 'QUOTE_STALE' }))
  try { await assert.rejects(buildTowerSwapTransaction(quote, wallet, 5042002), /quote expired or the route changed/) }
  finally { globalThis.fetch = original }
})

test('balance refresh targets both swap tokens and native gas for only this wallet/network', () => {
  const balance = (chainId: number, owner = wallet) => ['readContract', { chainId, address: token, functionName: 'balanceOf', args: [owner] }]
  assert.equal(isWalletBalanceQuery(balance(5042002), wallet, 5042002), true)
  assert.equal(isWalletBalanceQuery(['readContract', { chainId: 5042002, address: quote.outputToken, functionName: 'balanceOf', args: [wallet] }], wallet, 5042002), true)
  assert.equal(isWalletBalanceQuery(['balance', { chainId: 5042002, address: wallet }], wallet, 5042002), true)
  assert.equal(isWalletBalanceQuery(['bridge-balance', 5042002, wallet], wallet, 5042002), true)
  assert.equal(isWalletBalanceQuery(balance(5042), wallet, 5042002), false)
  assert.equal(isWalletBalanceQuery(['readContract', { chainId: 5042002, functionName: 'balanceOf', args: [other] }], wallet, 5042002), false)
  assert.equal(isWalletBalanceQuery(['readContract', { chainId: 5042002, functionName: 'allowance', args: [wallet, other] }], wallet, 5042002), false)
})

test('swap errors retain useful provider details and discard transaction dumps', () => {
  assert.equal(parseOnchainError(new Error('Tower returned a swap for a different network.')), 'Tower returned a swap for a different network.')
  assert.equal(parseOnchainError({ shortMessage: 'Execution reverted: price moved.', message: 'Transaction dump\nRaw transaction: 0x1234' }), 'Transaction failed: price moved.')
  assert.equal(parseOnchainError(new Error('Swap quote belongs to a different network.\nTransaction: 0x1234')), 'Swap quote belongs to a different network.')
  assert.equal(parseOnchainError(new Error('Failed to fetch')), 'Network error. Please check your connection and try again.')
})
