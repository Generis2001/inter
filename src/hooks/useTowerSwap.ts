/**
 * useTowerSwap — USDC <-> EURC swap via Tower Exchange Swap Engine API.
 *
 * Flow:
 *  1. POST /swap/quote  — get optimal route, amountOut, price impact, dexName
 *  2. POST /swap/build-tx — get unsigned ERC-20 approve calldata + swap calldata
 *  3. Sign & broadcast approve tx (if needed), then sign & broadcast swap tx
 *
 * API base: https://www.tower.exchange/api/public
 * Auth: server-side Tower proxy; no API key is bundled in the client
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  maxUint256,
  type Address,
} from 'viem'
import { arc } from 'viem/chains'
import { arcTestnet } from '../config'
import { towerRequest } from '../services/tower'
import { useWallet } from '../context/WalletContext'
import { TOKENS, getTokenAddress, type TokenInfo } from '../utils/tokens'
import { Amount } from '@/onchain-money'
import { recordTransaction } from './useArcTransactions'
import { parseOnchainError } from '../utils/wallet'
import { recordKnownSpender } from '../utils/allowances'
import { useNetwork } from '../context/NetworkContext'


const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

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
    outputAmountRaw?: string
    outputAmountNative?: string
    amountScale?: string
    priceImpact: number
    dexName: string
    dexId?: string
    route?: unknown
    slippageTolerance?: number
    [key: string]: unknown
  }
}

interface TowerBuildTxResponse {
  success: boolean
  data: {
    approve?: {
      to?: string
      token?: string
      spender?: string
      data: string
      value?: string
      gasLimit?: string
      amountRaw?: string
    }
    swap: {
      to: string
      data: string
      value: string
      gasLimit?: string
      executorAddress?: string
    }
  }
}

// ---- helpers ----------------------------------------------------------------

function parseQuoteOutputAmount(data: TowerQuoteResponse['data'], decimals: number): Amount {
  // Tower returns outputAmountRaw / outputAmountNative in base token decimals (e.g. "8920" for 0.008920 EURC).
  // The outputAmount field is scaled to 1e18 (normalized_1e18, e.g. "8920000000000000").
  if (data.outputAmountRaw) {
    return Amount.fromRaw(BigInt(data.outputAmountRaw), decimals)
  }
  if (data.outputAmountNative) {
    return Amount.fromRaw(BigInt(data.outputAmountNative), decimals)
  }
  const raw = BigInt(data.outputAmount)
  if (data.amountScale === 'normalized_1e18' && decimals < 18) {
    const scaleDiff = 18n - BigInt(decimals)
    return Amount.fromRaw(raw / 10n ** scaleDiff, decimals)
  }
  return Amount.fromRaw(raw, decimals)
}

async function towerQuote(
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amountIn: bigint,
  slippageBps: number,
  chainId: number,
): Promise<TowerQuoteResponse['data']> {
  const json = await towerRequest<TowerQuoteResponse>('/swap/quote', {
    inputToken: tokenIn.symbol, outputToken: tokenOut.symbol, inputAmount: amountIn.toString(),
    slippageTolerance: slippageBps, chainId,
  })
  if (!json.success || !json.data) {
    // Surface the real API error so it can be shown / debugged
    const detail = (json as { error?: string; message?: string }).error
      ?? (json as { error?: string; message?: string }).message
      ?? `Tower error`
    throw new Error(`Quote failed: ${detail}`)
  }
  return json.data
}

async function towerBuildTx(
  quoteData: unknown,
  userAddress: Address,
): Promise<TowerBuildTxResponse['data']> {
  const json = await towerRequest<TowerBuildTxResponse>('/swap/build-tx', { quote: quoteData, userAddress })
  if (!json.success || !json.data) throw new Error('Build tx failed')
  return json.data
}

function parseAmountSafe(str: string, decimals: number): bigint | null {
  if (!str || str === '0' || str === '0.') return null
  try { return Amount.parse(str, decimals).raw }
  catch { return null }
}

// ---- hook -------------------------------------------------------------------

export function useTowerSwap(slippageBps = 50) {
  const { account } = useWallet()
  const { isTestnet, chainId } = useNetwork()
  const current = useRef({ account, chainId })
  useLayoutEffect(() => { current.current = { account, chainId } }, [account, chainId])
  const quoteGeneration = useRef(0)
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
    const generation = ++quoteGeneration.current
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    const parsed = parseAmountSafe(amountIn, tokenIn.decimals)

    quoteTimerRef.current = setTimeout(() => {
      if (!parsed || parsed === 0n) {
        setSwapState({ status: 'idle' })
        return
      }
      setSwapState({ status: 'quoting' })

      // Both environments use real Tower quotes and on-chain transactions.
      void towerQuote(tokenIn, tokenOut, parsed, slippageBps, chainId)
        .then((quote) => {
          if (quoteGeneration.current !== generation) return
          setSwapState({
            status: 'quoted',
            amountOut: parseQuoteOutputAmount(quote, tokenOut.decimals),
            priceImpact: quote.priceImpact,
            dexName: quote.dexName,
            quoteData: { quote, chainId, amountRaw: parsed.toString() },
          })
        })
        .catch((err: unknown) => {
          if (quoteGeneration.current !== generation) return
          const msg = err instanceof Error ? err.message : 'Quote unavailable'
          setSwapState({ status: 'error', message: msg })
        })
    }, 400)

    return () => {
      ++quoteGeneration.current
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    }
  }, [amountIn, tokenIn, tokenOut, slippageBps, chainId])

  const executeSwap = useCallback(async (options?: { unlimitedApproval?: boolean }) => {
    if (!account) return
    if (swapState.status !== 'quoted') return
    const { quoteData, amountOut, dexName } = swapState

    setSwapState({ status: 'approving' })
    try {
      type ViemAccount = Parameters<typeof createWalletClient>[0] extends { account?: infer A } ? NonNullable<A> : never
      const viemAcct   = account as unknown as ViemAccount
      const network = isTestnet ? arcTestnet : arc
      const publicClient = createPublicClient({ chain: network, transport: http() })
      const confirmedQuote = quoteData as { quote: unknown; chainId: number; amountRaw: string }
      if (confirmedQuote.chainId !== chainId || confirmedQuote.amountRaw !== parseAmountSafe(amountIn, tokenIn.decimals)?.toString()) throw new Error('Quote changed. Review the swap again.')
      const assertCurrent = () => { if (current.current.chainId !== chainId || current.current.account?.address !== account.address) throw new Error('Wallet or network changed.') }
      assertCurrent()

      // Pre-flight check on Arc native gas balance before broadcasting
      try {
        const nativeBal = await publicClient.getBalance({ address: account.address })
        if (nativeBal < 3_000_000_000_000_000n) { // less than 0.003 USDC in 18 decimals
          setSwapState({ status: 'error', message: 'insufficient gas (USDC)' })
          return
        }
      } catch {
        // Proceed if client check fails
      }

      const walletClient  = createWalletClient({ account: viemAcct, chain: network, transport: http() })

      // Build tx calldata from Tower
      const txData = await towerBuildTx(confirmedQuote.quote, account.address)

      // Step 1: Ensure ERC-20 approval for Tower swap executor
      // Note: Tower's approve object provides `token` (the ERC20 contract address) and `spender` (the router/executor)
      const tokenAddress = getTokenAddress(tokenIn.symbol, chainId)
      if ((txData.approve?.token ?? txData.approve?.to ?? tokenAddress).toLowerCase() !== tokenAddress.toLowerCase()) throw new Error('Tower returned an unexpected approval token.')
      const spender = ((txData.approve?.spender ?? txData.swap.executorAddress ?? txData.swap.to) as Address)

      const parsedIn = parseAmountSafe(amountIn, tokenIn.decimals) ?? 0n
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, spender],
      })

      if (currentAllowance < parsedIn) {
        assertCurrent()
        setSwapState({ status: 'approving' })
        const isUnlimited = !!options?.unlimitedApproval
        const approvalAmount = isUnlimited ? maxUint256 : parsedIn
        const approveData = txData.approve?.data as `0x${string}` | undefined

        const approveTx = isUnlimited && approveData
          ? await walletClient.sendTransaction({
              account: viemAcct,
              to: tokenAddress,
              data: approveData,
              value: BigInt(txData.approve?.value ?? '0'),
            })
          : await walletClient.writeContract({
              account: viemAcct,
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [spender, approvalAmount],
            })
        const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx })
        if (approvalReceipt.status !== 'success') throw new Error('Approval reverted.')

        recordKnownSpender(account.address, {
          tokenAddress,
          tokenSymbol: tokenIn.symbol,
          spenderAddress: spender,
          spenderName: 'Tower DEX Router',
          chainId,
        })

        recordTransaction({
          hash: approveTx,
          from: account.address.toLowerCase() as `0x${string}`,
          to: tokenAddress.toLowerCase() as `0x${string}`,
          value: isUnlimited ? 'Unlimited' : Amount.fromRaw(parsedIn, tokenIn.decimals).toFixed(2),
          rawValue: parsedIn,
          tokenSymbol: tokenIn.symbol,
          timestamp: Date.now(),
          status: 'success',
          direction: 'contract',
          blockNumber: null,
          gasUsed: '0',
          contractName: 'Tower DEX Router',
          method: isUnlimited ? 'Approve Unlimited' : 'Approve Exact Amount',
          txType: 'approval',
        }, chainId)
      }

      // Step 2: Swap
      assertCurrent()
      setSwapState({ status: 'swapping' })
      const txHash = await walletClient.sendTransaction({
        account: viemAcct,
        to: txData.swap.to as Address,
        data: txData.swap.data as `0x${string}`,
        value: BigInt(txData.swap.value ?? '0'),
      })

      // Record immediately as pending
      recordTransaction({
        hash: txHash,
        from: account.address.toLowerCase() as `0x${string}`,
        to: (txData.swap.to).toLowerCase() as `0x${string}`,
        value: Amount.fromRaw(parsedIn, tokenIn.decimals).toFixed(2),
        rawValue: parsedIn,
        tokenSymbol: tokenIn.symbol,
        timestamp: Date.now(),
        status: 'pending',
        direction: 'contract',
        blockNumber: null,
        gasUsed: '0',
        contractName: 'Tower DEX Router',
        method: 'Execute Swap',
        txType: 'swap',
      }, chainId)

      setSwapState({ status: 'swapping', txHash })
      const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      if (swapReceipt.status !== 'success') throw new Error('Swap reverted.')

      // Update to success upon confirmation
      recordTransaction({
        hash: txHash,
        from: account.address.toLowerCase() as `0x${string}`,
        to: (txData.swap.to).toLowerCase() as `0x${string}`,
        value: Amount.fromRaw(parsedIn, tokenIn.decimals).toFixed(2),
        rawValue: parsedIn,
        tokenSymbol: tokenIn.symbol,
        timestamp: Date.now(),
        status: 'success',
        direction: 'contract',
        blockNumber: null,
        gasUsed: '0',
        contractName: 'Tower DEX Router',
        method: 'Execute Swap',
        txType: 'swap',
      }, chainId)

      setSwapState({ status: 'success', txHash, amountOut, dexName })
    } catch (err) {
      const clean = parseOnchainError(err)
      setSwapState({ status: 'error', message: clean })
    }
  }, [account, swapState, amountIn, tokenIn, chainId, isTestnet])

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
