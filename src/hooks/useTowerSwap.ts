/**
 * useTowerSwap — USDC <-> EURC swap via Tower Exchange Swap Engine API.
 *
 * Flow:
 *  1. POST /swap/quote  — get optimal route, amountOut, price impact, dexName
 *  2. POST /swap/build-tx — get unsigned ERC-20 approve calldata + swap calldata
 *  3. Sign & broadcast approve tx (if needed), then sign & broadcast swap tx
 *
 * API base: https://www.tower.exchange/api/public
 * Auth: Authorization: Bearer <VITE_TOWER_API_KEY>
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from 'viem'
import { arc } from 'viem/chains'
import { useWallet } from '../context/WalletContext'
import { TOKENS, type TokenInfo } from '../utils/tokens'
import { Amount } from '@/onchain-money'

const TOWER_BASE = 'https://www.tower.exchange/api/public'
const SLIPPAGE_BPS = 50   // 0.5%
const ARC_CHAIN_ID = 5042

// ---- types ------------------------------------------------------------------

export type SwapState =
  | { status: 'idle' }
  | { status: 'quoting' }
  | { status: 'quoted'; amountOut: Amount; priceImpact: number; dexName: string; quoteData: unknown }
  | { status: 'approving' }
  | { status: 'swapping'; txHash?: string }
  | { status: 'success'; txHash: string; amountOut: Amount; dexName: string }
  | { status: 'error'; message: string }

interface TowerQuoteResponse {
  success: boolean
  data: {
    inputToken: string
    outputToken: string
    inputAmount: string
    outputAmount: string
    priceImpact: number
    dexName: string
    dexId: string
    route: unknown[]
    slippageTolerance: number
  }
}

interface TowerBuildTxResponse {
  success: boolean
  data: {
    approve?: {
      to: string
      data: string
      value: string
      gasLimit: string
    }
    swap: {
      to: string
      data: string
      value: string
      gasLimit: string
    }
  }
}

// ---- helpers ----------------------------------------------------------------

function getApiKey(): string {
  return (import.meta.env.VITE_TOWER_API_KEY as string | undefined) ?? ''
}

function getPublicClient() {
  return createPublicClient({ chain: arc, transport: http() })
}

async function towerQuote(
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amountIn: bigint,
): Promise<TowerQuoteResponse['data']> {
  const key = getApiKey()
  const res = await fetch(`${TOWER_BASE}/swap/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      inputToken:       tokenIn.symbol,   // Tower uses symbols (USDC/EURC), not hex addresses
      outputToken:      tokenOut.symbol,
      inputAmount:      amountIn.toString(),
      slippageTolerance: SLIPPAGE_BPS,
      chainId:          ARC_CHAIN_ID,
    }),
  })
  const json = (await res.json()) as TowerQuoteResponse
  if (!json.success || !json.data) {
    // Surface the real API error so it can be shown / debugged
    const detail = (json as { error?: string; message?: string }).error
      ?? (json as { error?: string; message?: string }).message
      ?? `HTTP ${res.status}`
    throw new Error(`Quote failed: ${detail}`)
  }
  return json.data
}

async function towerBuildTx(
  quoteData: unknown,
  userAddress: Address,
): Promise<TowerBuildTxResponse['data']> {
  const key = getApiKey()
  const res = await fetch(`${TOWER_BASE}/swap/build-tx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ quote: quoteData, userAddress }),
  })
  const json = (await res.json()) as TowerBuildTxResponse
  if (!json.success || !json.data) throw new Error('Build tx failed')
  return json.data
}

function parseAmountSafe(str: string, decimals: number): bigint | null {
  if (!str || str === '0' || str === '0.') return null
  try { return Amount.parse(str, decimals).raw }
  catch { return null }
}

// ---- hook -------------------------------------------------------------------

export function useTowerSwap() {
  const { account } = useWallet()
  const [tokenIn, setTokenIn]     = useState<TokenInfo>(TOKENS[0])  // USDC
  const [tokenOut, setTokenOut]   = useState<TokenInfo>(TOKENS[1])  // EURC
  const [amountIn, setAmountIn]   = useState('')
  const [swapState, setSwapState] = useState<SwapState>({ status: 'idle' })
  const quoteTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flipTokens = useCallback(() => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmountIn('')
    setSwapState({ status: 'idle' })
  }, [tokenIn, tokenOut])

  // Debounced quote — all setState deferred inside setTimeout
  useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    const parsed = parseAmountSafe(amountIn, tokenIn.decimals)

    quoteTimerRef.current = setTimeout(() => {
      if (!parsed || parsed === 0n) {
        setSwapState({ status: 'idle' })
        return
      }
      setSwapState({ status: 'quoting' })
      void towerQuote(tokenIn, tokenOut, parsed)
        .then((quote) => {
          setSwapState({
            status: 'quoted',
            amountOut: Amount.fromRaw(BigInt(quote.outputAmount), tokenOut.decimals),
            priceImpact: quote.priceImpact,
            dexName: quote.dexName,
            quoteData: quote,
          })
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Quote unavailable'
          setSwapState({ status: 'error', message: msg })
        })
    }, 400)

    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    }
  }, [amountIn, tokenIn, tokenOut])

  const executeSwap = useCallback(async () => {
    if (!account) return
    if (swapState.status !== 'quoted') return
    const { quoteData, amountOut, dexName } = swapState

    setSwapState({ status: 'approving' })
    try {
      type ViemAccount = Parameters<typeof createWalletClient>[0] extends { account?: infer A } ? NonNullable<A> : never
      const viemAcct   = account as unknown as ViemAccount
      const publicClient  = getPublicClient()
      const walletClient  = createWalletClient({ account: viemAcct, chain: arc, transport: http() })

      // Build tx calldata from Tower
      const txData = await towerBuildTx(quoteData, account.address)

      // Step 1: ERC-20 approve if Tower returned one
      if (txData.approve) {
        const approveTx = await walletClient.sendTransaction({
          account: viemAcct,
          to: txData.approve.to as Address,
          data: txData.approve.data as `0x${string}`,
          value: BigInt(txData.approve.value ?? '0'),
        })
        await publicClient.waitForTransactionReceipt({ hash: approveTx })
      }

      // Step 2: Swap
      setSwapState({ status: 'swapping' })
      const txHash = await walletClient.sendTransaction({
        account: viemAcct,
        to: txData.swap.to as Address,
        data: txData.swap.data as `0x${string}`,
        value: BigInt(txData.swap.value ?? '0'),
      })

      setSwapState({ status: 'swapping', txHash })
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      setSwapState({ status: 'success', txHash, amountOut, dexName })
    } catch (err) {
      const msg   = err instanceof Error ? err.message : String(err)
      const clean = msg.replace(/^.*?(ContractFunctionExecutionError|Error):\s*/i, '').slice(0, 200)
      setSwapState({ status: 'error', message: clean || 'Swap failed. Please try again.' })
    }
  }, [account, swapState])

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
