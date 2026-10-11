/**
 * useSwap — unified swap facade.
 *
 * Tower Exchange (primary) and Uniswap v4 Universal Router (secondary).
 * Delegates all logic to the active hook; exposes a `route` toggle so the
 * UI can switch between them without losing the entered amount.
 *
 * Now includes a unified slippage control (in BPS) that both hooks consume.
 */
import { useState, useCallback } from 'react'
import { useTowerSwap } from './useTowerSwap'
import { useV4Swap } from './useV4Swap'

export type SwapRoute = 'tower' | 'uniswap-v4'

export function useSwap() {
  const [route, setRoute] = useState<SwapRoute>('tower')
  const [slippageBps, setSlippageBps] = useState(50) // 0.5% default

  const tower  = useTowerSwap(slippageBps)
  const uniV4  = useV4Swap(slippageBps)

  const active = route === 'tower' ? tower : uniV4

  const switchRoute = useCallback((next: SwapRoute) => {
    setRoute(next)
    // Reset both hooks so stale quotes don't bleed through
    tower.reset()
    uniV4.reset()
  }, [tower, uniV4])

  // Normalise the SwapState so SwapScreen only deals with one shape.
  // useV4Swap's 'quoted' state has no dexName; fill in a label.
  const swapState = (() => {
    const s = active.swapState
    if (route === 'uniswap-v4' && s.status === 'quoted') {
      return { ...s, dexName: 'Uniswap v4', priceImpact: 0 } as typeof s & { dexName: string; priceImpact: number }
    }
    if (route === 'uniswap-v4' && s.status === 'success') {
      return { ...s, dexName: 'Uniswap v4' } as typeof s & { dexName: string }
    }
    return s
  })()

  return {
    route,
    switchRoute,
    tokenIn:     active.tokenIn,
    tokenOut:    active.tokenOut,
    amountIn:    active.amountIn,
    setAmountIn: active.setAmountIn,
    flipTokens:  active.flipTokens,
    swapState,
    executeSwap: active.executeSwap,
    reset:       active.reset,
    slippageBps,
    setSlippageBps,
  }
}
