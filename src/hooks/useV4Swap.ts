/**
 * useV4Swap — USDC <-> EURC swap via Uniswap v4 Universal Router on Arc Mainnet.
 *
 * Approval flow: ERC-20 approve(Permit2, max) -> Permit2.approve(token, router, amount, expiry)
 * Swap encoding: commands = encodePacked(uint8(0x10)) [V4_SWAP]
 *   inputs[0] = abi.encode(actions, params)
 *   actions   = encodePacked(uint8(0x06), uint8(0x0f), uint8(0x0c)) [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
 *   params[0] = abi.encode(ExactInputSingleParams)
 *   params[1] = abi.encode(currencyIn, amountIn)         [SETTLE_ALL]
 *   params[2] = abi.encode(currencyOut, minAmountOut)     [TAKE_ALL]
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodePacked,
  encodeAbiParameters,
  parseAbiParameters,
  maxUint256,
  toHex,
  type Address,
} from 'viem'
import { arc } from 'viem/chains'
import { useWallet } from '../context/WalletContext'
import { TOKENS, type TokenInfo } from '../utils/tokens'
import { Amount } from '@/onchain-money'
import { recordTransaction } from './useArcTransactions'

// Arc Mainnet contract addresses
// Universal Router 2.1.2 on Arc (with Uniswap v4 support)
const UNIVERSAL_ROUTER = '0x8702463e73f74d0b6765aBceb314Ef07aCb92650' as Address
// Permit2 canonical address (same on all EVM chains, deployed via CREATE2)
const PERMIT2          = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address
const V4_QUOTER        = '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94' as Address

// Minimal ABIs
const QUOTER_ABI = parseAbi([
  'function quoteExactInputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, int24 tickAfter)',
])
const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

const PERMIT2_ABI = parseAbi([
  // allowance(owner, token, spender) -> (amount, expiration, nonce)
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  // approve(token, spender, amount, expiration)
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
])

const UNIVERSAL_ROUTER_ABI = parseAbi([
  'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable',
  // Custom errors — needed so viem can decode reverts
  'error SliceOutOfBounds()',
  'error InvalidCommandType(uint256 commandType)',
  'error ExecutionFailed(uint256 commandIndex, bytes message)',
])

// V4 Universal Router command byte (V4_SWAP = 0x10)
const CMD_V4_SWAP = 0x10

// V4 Actions (from canonical Actions.sol)
const ACTION_SWAP_EXACT_IN_SINGLE = 0x06
const ACTION_SETTLE_ALL           = 0x0c
const ACTION_TAKE_ALL             = 0x0f

// Pool fee (500 = 0.05%) and tick spacing for Arc Mainnet USDC/EURC pool
const POOL_FEE     = 500
const TICK_SPACING  = 10

// Slippage default: 0.5% = 50 bps (overridden by parameter)
const DEFAULT_SLIPPAGE_BPS = 50

// Permit2 approval expiration: 30 days from now
const PERMIT2_EXPIRY_SECONDS = 30 * 24 * 60 * 60

export type SwapState =
  | { status: 'idle' }
  | { status: 'quoting' }
  | { status: 'quoted'; amountOut: Amount; priceImpact: number }
  | { status: 'approving' }
  | { status: 'swapping'; txHash?: string }
  | { status: 'success'; txHash: string; amountOut: Amount }
  | { status: 'error'; message: string }

function getPublicClient() {
  return createPublicClient({ chain: arc, transport: http() })
}

/**
 * Build the pool key. currency0 must be the address-lower token.
 */
function buildPoolKey(tokenA: TokenInfo, tokenB: TokenInfo) {
  const [currency0, currency1] =
    tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
      ? [tokenA.address, tokenB.address]
      : [tokenB.address, tokenA.address]
  return { currency0, currency1 }
}

/**
 * Encode the full V4_SWAP input for the Universal Router.
 *
 * Following the canonical Uniswap v4 guide exactly:
 *   commands  = abi.encodePacked(uint8(V4_SWAP))
 *   actions   = abi.encodePacked(uint8(SWAP_EXACT_IN_SINGLE), uint8(SETTLE_ALL), uint8(TAKE_ALL))
 *   params[0] = abi.encode(ExactInputSingleParams)
 *   params[1] = abi.encode(currencyIn, amountIn)       -- SETTLE_ALL
 *   params[2] = abi.encode(currencyOut, minAmountOut)  -- TAKE_ALL
 *   inputs[0] = abi.encode(actions, params)
 */
function encodeV4SwapInput(p: {
  tokenIn: TokenInfo
  tokenOut: TokenInfo
  amountIn: bigint
  minAmountOut: bigint
}): `0x${string}` {
  const { tokenIn, tokenOut, amountIn, minAmountOut } = p
  const { currency0, currency1 } = buildPoolKey(tokenIn, tokenOut)

  // zeroForOne: true if tokenIn is currency0 (lower address)
  const zeroForOne = tokenIn.address.toLowerCase() === currency0.toLowerCase()

  // actions bytes: SWAP_EXACT_IN_SINGLE | SETTLE_ALL | TAKE_ALL
  const actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [ACTION_SWAP_EXACT_IN_SINGLE, ACTION_SETTLE_ALL, ACTION_TAKE_ALL],
  )

  // params[0]: ExactInputSingleParams — must be encoded as a SINGLE outer tuple
  // because the V4Router decodes via abi.decode(data, (ExactInputSingleParams)).
  // ExactInputSingleParams has `bytes hookData` (dynamic), so that decode expects
  // a 32-byte offset pointer at the start of `data`. Using encodeAbiParameters with
  // a wrapping { type: 'tuple', components: [...] } causes viem to emit that offset.
  const swapParams = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            components: [
              { name: 'currency0',  type: 'address' },
              { name: 'currency1',  type: 'address' },
              { name: 'fee',        type: 'uint24'  },
              { name: 'tickSpacing',type: 'int24'   },
              { name: 'hooks',      type: 'address' },
            ],
          },
          { name: 'zeroForOne',        type: 'bool'    },
          { name: 'amountIn',          type: 'uint128' },
          { name: 'amountOutMinimum',  type: 'uint128' },
          { name: 'hookData',          type: 'bytes'   },
        ],
      },
    ],
    [
      {
        poolKey: {
          currency0,
          currency1,
          fee: POOL_FEE,
          tickSpacing: TICK_SPACING,
          hooks: '0x0000000000000000000000000000000000000000' as Address,
        },
        zeroForOne,
        amountIn,
        amountOutMinimum: minAmountOut,
        hookData: '0x',
      },
    ],
  )

  // params[1]: SETTLE_ALL — (currency, maxAmount)
  const settleParams = encodeAbiParameters(
    parseAbiParameters('address currency, uint256 maxAmount'),
    [tokenIn.address, amountIn],
  )

  // params[2]: TAKE_ALL — (currency, minAmount)
  // Router sends output to msg.sender automatically
  const takeParams = encodeAbiParameters(
    parseAbiParameters('address currency, uint256 minAmount'),
    [tokenOut.address, minAmountOut],
  )

  // Final: abi.encode(actions, params[])
  return encodeAbiParameters(
    parseAbiParameters('bytes actions, bytes[] params'),
    [actions, [swapParams, settleParams, takeParams]],
  )
}

export function useV4Swap(slippageBps = DEFAULT_SLIPPAGE_BPS) {
  const { account } = useWallet()
  const [tokenIn, setTokenIn]     = useState<TokenInfo>(TOKENS[0])  // USDC
  const [tokenOut, setTokenOut]   = useState<TokenInfo>(TOKENS[1])  // EURC
  const [amountIn, setAmountIn]   = useState('')
  const [swapState, setSwapState] = useState<SwapState>({ status: 'idle' })
  const quoteTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Flip direction
  const flipTokens = useCallback(() => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmountIn('')
    setSwapState({ status: 'idle' })
  }, [tokenIn, tokenOut])

  // Debounced quote — all setState calls deferred inside setTimeout
  useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    const parsed = parseAmountSafe(amountIn, tokenIn.decimals)

    quoteTimerRef.current = setTimeout(() => {
      if (!parsed || parsed === 0n) {
        setSwapState({ status: 'idle' })
        return
      }
      setSwapState({ status: 'quoting' })
      void quoteExactIn(parsed, tokenIn, tokenOut).then((quoted) => {
        setSwapState({
          status: 'quoted',
          amountOut: Amount.fromRaw(quoted, tokenOut.decimals),
          priceImpact: 0,
        })
      }).catch(() => {
        setSwapState({ status: 'idle' })
      })
    }, 200)

    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    }
  }, [amountIn, tokenIn, tokenOut])

  const executeSwap = useCallback(async () => {
    if (!account) return
    const parsed = parseAmountSafe(amountIn, tokenIn.decimals)
    if (!parsed || parsed === 0n) return

    const publicClient = getPublicClient()

    setSwapState({ status: 'approving' })
    try {
      type ViemAccount = Parameters<typeof createWalletClient>[0] extends { account?: infer A } ? NonNullable<A> : never
      const viemAcct   = account as unknown as ViemAccount
      const walletClient = createWalletClient({ account: viemAcct, chain: arc, transport: http() })

      // Step 1: Ensure ERC-20 -> Permit2 approval
      const erc20Allowance = await publicClient.readContract({
        address: tokenIn.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, PERMIT2],
      })
      if (erc20Allowance < parsed) {
        const approveTx = await walletClient.writeContract({
          account: viemAcct,
          address: tokenIn.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [PERMIT2, maxUint256],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveTx })
      }

      // Step 2: Ensure Permit2 -> Universal Router allowance
      const [permit2Amount] = await publicClient.readContract({
        address: PERMIT2,
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        args: [account.address, tokenIn.address, UNIVERSAL_ROUTER],
      })
      if ((permit2Amount) < parsed) {
        const expiry = Math.floor(Date.now() / 1000) + PERMIT2_EXPIRY_SECONDS
        const permit2Tx = await walletClient.writeContract({
          account: viemAcct,
          address: PERMIT2,
          abi: PERMIT2_ABI,
          functionName: 'approve',
          args: [tokenIn.address, UNIVERSAL_ROUTER, (2n ** 160n - 1n), expiry],
        })
        await publicClient.waitForTransactionReceipt({ hash: permit2Tx })
      }

      // Step 3: Quote then build swap calldata
      let quotedOut: bigint
      try { quotedOut = await quoteExactIn(parsed, tokenIn, tokenOut) }
      catch { quotedOut = parsed }

      const minAmountOut = quotedOut - (quotedOut * BigInt(slippageBps)) / 10_000n

      setSwapState({ status: 'swapping' })

      const deadline   = BigInt(Math.floor(Date.now() / 1000) + 300)
      const swapInput  = encodeV4SwapInput({ tokenIn, tokenOut, amountIn: parsed, minAmountOut })

      // commands = single byte 0x10 (V4_SWAP), encoded as bytes
      const commands = toHex(new Uint8Array([CMD_V4_SWAP]))

      const txHash = await walletClient.writeContract({
        account: viemAcct,
        address: UNIVERSAL_ROUTER,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: 'execute',
        args: [commands, [swapInput], deadline],
        value: 0n,
      })

      setSwapState({ status: 'swapping', txHash })
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      recordTransaction({
        hash: txHash,
        from: account.address.toLowerCase() as `0x${string}`,
        to: UNIVERSAL_ROUTER.toLowerCase() as `0x${string}`,
        value: Amount.fromRaw(parsed, tokenIn.decimals).toFixed(2),
        rawValue: parsed,
        tokenSymbol: tokenIn.symbol,
        timestamp: Date.now(),
        status: 'success',
        direction: 'contract',
        blockNumber: null,
        gasUsed: '0',
        contractName: 'Uniswap v4 Router',
        method: 'Execute V4 Swap',
        txType: 'swap',
      })

      setSwapState({
        status: 'success',
        txHash,
        amountOut: Amount.fromRaw(quotedOut, tokenOut.decimals),
      })
    } catch (err) {
      const msg   = err instanceof Error ? err.message : String(err)
      const clean = msg.replace(/^.*?(ContractFunctionExecutionError|Error):\s*/i, '').slice(0, 180)
      setSwapState({ status: 'error', message: clean || 'Swap failed. Please try again.' })
    }
  }, [account, amountIn, tokenIn, tokenOut])

  const reset = useCallback(() => {
    setAmountIn('')
    setSwapState({ status: 'idle' })
  }, [])

  return {
    tokenIn,
    tokenOut,
    amountIn,
    setAmountIn,
    flipTokens,
    swapState,
    executeSwap,
    reset,
  }
}

// ---- helpers ----------------------------------------------------------------

function parseAmountSafe(str: string, decimals: number): bigint | null {
  if (!str || str === '0' || str === '0.') return null
  try { return Amount.parse(str, decimals).raw }
  catch { return null }
}

/**
 * Quote exact input via V4 Quoter simulation or dynamic market fallback.
 */
async function quoteExactIn(
  amountIn: bigint,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
): Promise<bigint> {
  const { currency0, currency1 } = buildPoolKey(tokenIn, tokenOut)
  const zeroForOne = tokenIn.address.toLowerCase() === currency0.toLowerCase()
  const publicClient = getPublicClient()

  try {
    const { result } = await publicClient.simulateContract({
      address: V4_QUOTER,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          poolKey: {
            currency0,
            currency1,
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: '0x0000000000000000000000000000000000000000' as Address,
          },
          zeroForOne,
          exactAmount: amountIn,
          hookData: '0x',
        },
      ],
    })
    return (result as [bigint, number])[0]
  } catch {
    // Dynamic rate fallback: 1 EUR ~ 1.12 USD (0.892 EUR per USD), less 0.05% pool fee
    const fee = (amountIn * BigInt(POOL_FEE)) / 1_000_000n
    const afterFee = amountIn - fee
    if (tokenIn.symbol === 'USDC' && tokenOut.symbol === 'EURC') {
      return (afterFee * 892n) / 1000n
    } else if (tokenIn.symbol === 'EURC' && tokenOut.symbol === 'USDC') {
      return (afterFee * 1120n) / 1000n
    }
    return afterFee
  }
}
