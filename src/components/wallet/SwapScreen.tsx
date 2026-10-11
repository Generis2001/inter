/**
 * SwapScreen — USDC <-> EURC swap.
 * Tower Exchange (primary) or Uniswap v4 Universal Router (secondary).
 * Features: adjustable slippage, Tower logo branding, route details.
 */
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSwap, type SwapRoute } from '../../hooks/useSwap'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { useWallet } from '../../context/WalletContext'
import { TokenIcon } from '../shared/TokenLogo'
import { TowerLogo } from '../shared/TowerLogo'
import { buildTxExplorerUrl } from '@/onchain-facts'
import {
  ArrowUpDown,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Settings2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const ARC_MAINNET_ID = 5042

const SLIPPAGE_PRESETS = [0.1, 0.3, 0.5, 1.0]

const ROUTE_LABELS: Record<SwapRoute, string> = {
  'tower':      'Tower Exchange',
  'uniswap-v4': 'Uniswap v4',
}

export function SwapScreen() {
  const { account } = useWallet()
  const {
    route,
    switchRoute,
    tokenIn,
    tokenOut,
    amountIn,
    setAmountIn,
    flipTokens,
    swapState,
    executeSwap,
    reset,
    slippageBps,
    setSlippageBps,
  } = useSwap()

  const queryClient = useQueryClient()
  const { formatted: balanceIn, isLoading: balIn, refetch: refetchIn } = useTokenBalance(tokenIn, account?.address)
  const { formatted: balanceOut, refetch: refetchOut } = useTokenBalance(tokenOut, account?.address)

  // Slippage settings panel state
  const [showSlippage, setShowSlippage] = useState(false)
  const [customSlippage, setCustomSlippage] = useState('')

  // Sync custom input when preset changes
  useEffect(() => {
    const pct = slippageBps / 100
    if (!SLIPPAGE_PRESETS.includes(pct)) {
      setCustomSlippage(pct.toString())
    } else {
      setCustomSlippage('')
    }
  }, [slippageBps])

  // Invalidate and refresh all balance queries across the wallet immediately on swap completion
  useEffect(() => {
    if (swapState.status === 'success') {
      void queryClient.invalidateQueries()
      void refetchIn()
      void refetchOut()
      const t1 = setTimeout(() => {
        void queryClient.invalidateQueries()
        void refetchIn()
        void refetchOut()
      }, 1500)
      const t2 = setTimeout(() => {
        void queryClient.invalidateQueries()
      }, 3500)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [swapState.status, queryClient, refetchIn, refetchOut])

  const isQuoting   = swapState.status === 'quoting'
  const isQuoted    = swapState.status === 'quoted'
  const isApproving = swapState.status === 'approving'
  const isSwapping  = swapState.status === 'swapping'
  const isSuccess   = swapState.status === 'success'
  const isError     = swapState.status === 'error'

  const busy     = isApproving || isSwapping
  const canSwap  = isQuoted && !!account
  const hasInput = !!amountIn && parseFloat(amountIn) > 0

  const handleMax = () => {
    if (balanceIn) setAmountIn(balanceIn.replace(/[^0-9.]/g, ''))
  }

  const handleSlippagePreset = (pct: number) => {
    setSlippageBps(Math.round(pct * 100))
    setCustomSlippage('')
  }

  const handleCustomSlippage = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, '')
    setCustomSlippage(clean)
    const parsed = parseFloat(clean)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      setSlippageBps(Math.round(parsed * 100))
    }
  }

  // Route label with Tower logo inline
  const routeDisplay = (routeKey: SwapRoute, dexNameOverride?: string) => {
    const label = dexNameOverride ?? ROUTE_LABELS[routeKey]
    const isTower = routeKey === 'tower' || label.toLowerCase().includes('tower')
    return (
      <span className="flex items-center gap-1.5">
        {isTower ? <TowerLogo size={16} /> : null}
        {label}
      </span>
    )
  }

  // ---- success state ---------------------------------------------------------
  if (isSuccess && swapState.status === 'success') {
    const dexName = 'dexName' in swapState ? (swapState as { dexName: string }).dexName : ROUTE_LABELS[route]
    const isTowerRoute = route === 'tower' || dexName.toLowerCase().includes('tower')
    return (
      <div className="flex min-h-[calc(100dvh-120px)] flex-col items-center justify-center px-4 pb-28 pt-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-5 flex size-20 items-center justify-center rounded-full"
          style={{ background: 'rgba(26,128,71,0.12)' }}
        >
          <Check className="size-10" style={{ color: 'var(--success)' }} />
        </motion.div>
        <h2 className="display mb-1 text-2xl font-bold" style={{ color: 'var(--ink)' }}>
          Swap Complete
        </h2>
        <p className="mb-1 text-sm" style={{ color: 'var(--muted)' }}>
          You received approximately
        </p>
        <p className="display mb-2 text-3xl font-bold" style={{ color: 'var(--ink)' }}>
          {swapState.amountOut.toFixed(4)}{' '}
          <span style={{ color: 'var(--accent)' }}>{tokenOut.symbol}</span>
        </p>
        <p className="mb-5 flex items-center justify-center gap-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
          {isTowerRoute && <TowerLogo size={14} />}
          via {dexName}
        </p>
        <a
          href={buildTxExplorerUrl(ARC_MAINNET_ID, swapState.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-5 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:bg-black/5"
          style={{
            background: 'rgba(255,255,255,0.60)',
            border: '1px solid rgba(18,45,69,0.12)',
            color: 'var(--ink)',
          }}
        >
          View on Arc Explorer <ExternalLink className="size-4" />
        </a>
        <button
          onClick={() => {
            void queryClient.invalidateQueries()
            reset()
          }}
          className="w-full max-w-sm rounded-2xl py-4 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Swap Again
        </button>
      </div>
    )
  }

  // ---- main UI ---------------------------------------------------------------
  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col px-4 pb-28 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            Swap
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--muted)' }}>
            Best rate across all Arc DEXes
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Slippage gear button */}
          <button
            onClick={() => setShowSlippage((v) => !v)}
            className="flex items-center justify-center rounded-xl p-2 transition-all hover:bg-black/5"
            style={{ color: showSlippage ? 'var(--accent)' : 'var(--muted)' }}
            title="Slippage settings"
          >
            <Settings2 className="size-4.5" />
          </button>

          {/* Route selector */}
          <div
            className="flex items-center gap-0.5 rounded-xl p-1"
            style={{
              background: 'rgba(18,45,69,0.06)',
              border: '1px solid rgba(18,45,69,0.08)',
            }}
          >
            {(['tower', 'uniswap-v4'] as SwapRoute[]).map((r) => (
              <button
                key={r}
                onClick={() => { if (!busy) switchRoute(r) }}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40"
                style={
                  route === r
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { color: 'var(--muted)' }
                }
              >
                {r === 'tower' && <TowerLogo size={12} className={route === r ? '' : 'opacity-60'} />}
                {r === 'tower' ? 'Tower' : 'Uni v4'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Slippage settings panel */}
      <AnimatePresence>
        {showSlippage && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(255,255,255,0.80)',
                border: '1px solid rgba(6,182,212,0.14)',
                boxShadow: '0 2px 12px rgba(6,182,212,0.06)',
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  Max Slippage
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                  {(slippageBps / 100).toFixed(slippageBps % 100 === 0 ? 1 : 2)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                {SLIPPAGE_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleSlippagePreset(pct)}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
                    style={
                      slippageBps === Math.round(pct * 100) && customSlippage === ''
                        ? { background: 'var(--accent)', color: '#fff' }
                        : {
                            background: 'rgba(18,45,69,0.06)',
                            color: 'var(--muted)',
                          }
                    }
                  >
                    {pct}%
                  </button>
                ))}
                {/* Custom input */}
                <div
                  className="relative flex flex-1 items-center rounded-xl"
                  style={{
                    background: customSlippage ? 'rgba(6,182,212,0.08)' : 'rgba(18,45,69,0.06)',
                    border: customSlippage ? '1px solid rgba(6,182,212,0.20)' : '1px solid transparent',
                  }}
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Custom"
                    value={customSlippage}
                    onChange={(e) => handleCustomSlippage(e.target.value)}
                    className="w-full bg-transparent px-2.5 py-2 text-center text-xs font-semibold outline-none placeholder:text-slate-400"
                    style={{ color: 'var(--ink)' }}
                  />
                  {customSlippage && (
                    <span className="absolute right-2 text-xs" style={{ color: 'var(--subtle)' }}>%</span>
                  )}
                </div>
              </div>
              {/* Warning for high slippage */}
              {slippageBps > 300 && (
                <p className="mt-2 flex items-center gap-1 text-[11px]" style={{ color: 'var(--danger)' }}>
                  <AlertTriangle className="size-3" />
                  High slippage — your trade may execute at a significantly different price
                </p>
              )}
              {slippageBps < 10 && (
                <p className="mt-2 flex items-center gap-1 text-[11px]" style={{ color: '#d4a017' }}>
                  <AlertTriangle className="size-3" />
                  Very low slippage — your transaction may fail
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap card */}
      <div
        className="rounded-3xl p-5"
        style={{
          background: 'rgba(255,255,255,0.72)',
          border: '1px solid rgba(6,182,212,0.14)',
          boxShadow: '0 4px 24px rgba(6,182,212,0.08)',
        }}
      >
        {/* From token */}
        <div
          className="mb-2 rounded-2xl p-4"
          style={{
            background: 'rgba(240,249,255,0.70)',
            border: '1px solid rgba(6,182,212,0.10)',
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              You pay
            </span>
            <button
              onClick={handleMax}
              disabled={!balanceIn || balIn}
              className="text-xs font-semibold disabled:opacity-40"
              style={{ color: 'var(--accent-hover)' }}
            >
              Balance: {balIn ? '...' : (balanceIn ?? '0')} · Max
            </button>
          </div>
          <div className="flex items-center gap-3">
            <TokenIcon symbol={tokenIn.symbol} size={36} />
            <div className="flex-1">
              <input
                inputMode="decimal"
                className="display w-full bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                style={{ color: 'var(--ink)' }}
                placeholder="0.00"
                value={amountIn}
                disabled={busy}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  if (val === '' || /^\d*\.?\d*$/.test(val)) setAmountIn(val)
                }}
              />
              <p className="text-sm font-semibold" style={{ color: 'var(--subtle)' }}>
                {tokenIn.symbol}
              </p>
            </div>
          </div>
        </div>

        {/* Flip button */}
        <div className="relative my-1 flex justify-center">
          <button
            onClick={() => { if (!busy) flipTokens() }}
            disabled={busy}
            className="relative z-10 flex size-10 items-center justify-center rounded-2xl shadow-sm transition-all hover:scale-110 active:scale-95 disabled:opacity-40"
            style={{
              background: 'rgba(255,255,255,0.90)',
              border: '1px solid rgba(6,182,212,0.20)',
            }}
            aria-label="Flip swap direction"
          >
            <ArrowUpDown className="size-4" style={{ color: 'var(--accent)' }} />
          </button>
        </div>

        {/* To token */}
        <div
          className="mt-2 rounded-2xl p-4"
          style={{
            background: 'rgba(240,249,255,0.40)',
            border: '1px solid rgba(6,182,212,0.08)',
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              You receive
            </span>
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              Balance: {balanceOut ?? '0'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <TokenIcon symbol={tokenOut.symbol} size={36} />
            <div className="flex-1">
              <div className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {isQuoting ? (
                  <span className="text-2xl" style={{ color: 'var(--subtle)' }}>...</span>
                ) : isQuoted && swapState.status === 'quoted' ? (
                  swapState.amountOut.toFixed(4)
                ) : (
                  <span style={{ color: 'var(--subtle)' }}>0.00</span>
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--subtle)' }}>
                {tokenOut.symbol}
              </p>
            </div>
          </div>
        </div>

        {/* Quote details */}
        <AnimatePresence>
          {(isQuoted || isQuoting) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div
                className="rounded-xl px-3.5 py-3"
                style={{ background: 'rgba(18,45,69,0.04)' }}
              >
                {isQuoted && swapState.status === 'quoted' ? (
                  <>
                    {([
                      {
                        label: 'Route',
                        value: routeDisplay(
                          route,
                          'dexName' in swapState
                            ? (swapState as { dexName: string }).dexName
                            : undefined,
                        ),
                      },
                      {
                        label: 'Price impact',
                        value: 'priceImpact' in swapState
                          ? `${(swapState as { priceImpact: number }).priceImpact.toFixed(3)}%`
                          : '< 0.01%',
                      },
                      {
                        label: 'Max slippage',
                        value: `${(slippageBps / 100).toFixed(slippageBps % 100 === 0 ? 1 : 2)}%`,
                      },
                      { label: 'Network fee', value: 'Paid in USDC' },
                    ] as { label: string; value: React.ReactNode }[]).map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-1">
                        <span className="text-xs" style={{ color: 'var(--subtle)' }}>{label}</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{value}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="size-3 animate-spin" style={{ color: 'var(--accent)' }} />
                    <span className="text-xs" style={{ color: 'var(--subtle)' }}>Finding best route...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* No quote yet — hint */}
      <AnimatePresence>
        {!hasInput && !isError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-xs"
            style={{ color: 'var(--subtle)' }}
          >
            Enter an amount to get a quote
          </motion.p>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {isError && swapState.status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4 flex gap-2 rounded-2xl p-4"
            style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.16)' }}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {swapState.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action button */}
      <div className="mt-5">
        {!account ? (
          <div
            className="w-full rounded-2xl py-4 text-center text-sm font-semibold"
            style={{ background: 'rgba(18,45,69,0.06)', color: 'var(--muted)' }}
          >
            Unlock your wallet to swap
          </div>
        ) : busy ? (
          <div
            className="flex w-full items-center justify-center gap-3 rounded-2xl py-4"
            style={{ background: 'var(--accent)', opacity: 0.85 }}
          >
            <Loader2 className="size-5 animate-spin text-white" />
            <span className="text-sm font-semibold text-white">
              {isApproving ? 'Approving token...' : 'Swapping...'}
            </span>
          </div>
        ) : (
          <button
            onClick={() => { void executeSwap() }}
            disabled={!canSwap}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: canSwap ? 'var(--accent-gradient)' : 'rgba(18,45,69,0.12)' }}
          >
            {isError ? (
              'Try Again'
            ) : !hasInput ? (
              'Enter an amount'
            ) : isQuoting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Getting quote...
              </>
            ) : isQuoted ? (
              <>
                Swap <ChevronRight className="size-4" />
              </>
            ) : (
              'Swap'
            )}
          </button>
        )}
      </div>

      {/* Footer */}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs" style={{ color: 'var(--subtle)' }}>
        {route === 'tower' && <TowerLogo size={12} />}
        {route === 'tower'
          ? 'Optimal routing via Tower Exchange across Arc DEXes'
          : 'Direct swap via Uniswap v4 on Arc Mainnet'}
      </p>
    </div>
  )
}
