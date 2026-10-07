import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { useArcTransactions } from '../../hooks/useArcTransactions'
import { PageBackground } from '../shared/PageBackground'
import { GlassCard } from '../shared/GlassCard'
import { Skeleton } from '../shared/Skeleton'
import { TokenIcon } from '../shared/TokenLogo'
import { formatAddress } from '../../utils/wallet'
import { buildTxExplorerUrl, buildAddressExplorerUrl, requireChain } from '@/onchain-facts'
import { TOKENS, type TokenInfo } from '../../utils/tokens'
import { ArrowUpRight, ArrowDownLeft, Copy, Check, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import type { ArcTransaction } from '../../hooks/useArcTransactions'

const ARC_MAINNET_ID = 5042

// ─── Asset Detail ─────────────────────────────────────────────────────────────

interface AssetDetailProps {
  token: TokenInfo
  onBack: () => void
  address: `0x${string}` | undefined
}

function AssetDetail({ token, onBack, address }: AssetDetailProps) {
  const { formatted, isLoading } = useTokenBalance(token, address)
  const { transactions, isLoading: txLoading } = useArcTransactions(address)
  const [copied, setCopied] = useState(false)
  const chain = requireChain(ARC_MAINNET_ID)

  const assetTxns: ArcTransaction[] = transactions
    .filter((tx) => tx.tokenSymbol === token.symbol && parseFloat(tx.value) > 0)
    .slice(0, 20)

  const handleCopyContract = async () => {
    try {
      await navigator.clipboard.writeText(token.address)
      setCopied(true)
      toast.success('Contract address copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
    >
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: 'var(--accent-hover)' }}
      >
        <ArrowDownLeft className="size-3.5 rotate-45" />
        Back to Assets
      </button>

      {/* Asset hero card */}
      <GlassCard className="mb-4 p-5">
        <div className="mb-4 flex items-center gap-3">
          <TokenIcon symbol={token.symbol} size={44} />
          <div>
            <p className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
              {token.name}
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--subtle)' }}>
              {token.symbol} on Arc
            </p>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-10 w-36" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="display text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {token.sign}{formatted}
            </span>
            <span className="text-xl font-semibold" style={{ color: 'var(--subtle)' }}>
              {token.symbol}
            </span>
          </div>
        )}

        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          1 {token.symbol} = {token.sign}1.00
        </p>
      </GlassCard>

      {/* Token details */}
      <GlassCard className="mb-4">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
            Token Details
          </p>
        </div>
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {[
            { label: 'Network', value: chain.name },
            { label: 'Decimals', value: `${token.decimals}` },
            { label: 'Symbol', value: token.symbol },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between border-b px-4 py-3 last:border-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Contract</span>
            <div className="flex items-center gap-2">
              <a
                href={buildAddressExplorerUrl(ARC_MAINNET_ID, token.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-xs font-semibold"
                style={{ color: 'var(--accent-hover)' }}
              >
                {formatAddress(token.address)}
              </a>
              <button onClick={() => { void handleCopyContract() }} style={{ color: 'var(--subtle)' }}>
                {copied
                  ? <Check className="size-3" style={{ color: 'var(--success)' }} />
                  : <Copy className="size-3" />}
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Transaction history for this asset */}
      <GlassCard>
        <div className="px-4 py-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {token.symbol} Transactions
          </p>
        </div>
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {txLoading ? (
            <div className="space-y-1 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-8 rounded-xl" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          ) : assetTxns.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>No {token.symbol} transactions yet</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
                Sent and received {token.symbol} will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y p-1" style={{ borderColor: 'var(--border)' }}>
              {assetTxns.map((tx) => {
                const isSent = tx.direction === 'sent'
                return (
                  <a
                    key={tx.hash}
                    href={buildTxExplorerUrl(ARC_MAINNET_ID, tx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all hover:bg-black/4"
                  >
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: tx.status === 'failed'
                          ? 'rgba(220,38,38,0.10)'
                          : isSent ? 'rgba(6,182,212,0.10)' : 'rgba(5,150,105,0.10)',
                      }}
                    >
                      {isSent
                        ? <ArrowUpRight className="size-4" style={{ color: tx.status === 'failed' ? 'var(--danger)' : 'var(--accent-light)' }} />
                        : <ArrowDownLeft className="size-4" style={{ color: 'var(--success)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {isSent ? 'Sent' : 'Received'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                        {tx.timestamp > 0
                          ? new Date(tx.timestamp).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })
                          : 'Pending'}
                      </p>
                    </div>
                    <span
                      className="display text-sm font-bold tabular-nums"
                      style={{ color: tx.status === 'failed' ? 'var(--danger)' : isSent ? 'var(--ink)' : 'var(--success)' }}
                    >
                      {isSent ? '-' : '+'}{tx.value}
                    </span>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ─── Asset List ───────────────────────────────────────────────────────────────

function AssetRow({
  token,
  address,
  onClick,
}: {
  token: TokenInfo
  address: `0x${string}` | undefined
  onClick: () => void
}) {
  const { formatted, isLoading } = useTokenBalance(token, address)

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 transition-all hover:bg-black/4 active:bg-black/6"
    >
      <TokenIcon symbol={token.symbol} size={40} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {token.name}
        </p>
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          {token.symbol} on Arc
        </p>
      </div>
      <div className="text-right shrink-0">
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <p className="display text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {token.sign}{formatted}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>{token.symbol}</p>
      </div>
      <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
    </button>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AssetsScreen() {
  const { account } = useWallet()
  const address = account?.address
  const [activeToken, setActiveToken] = useState<TokenInfo | null>(null)

  // Compute portfolio total (sum of all token balances)
  const { formatted: usdcFormatted, amount: usdcAmt } = useTokenBalance(TOKENS[0], address)
  const { amount: eurcAmt } = useTokenBalance(TOKENS[1], address)
  const totalUsd = (() => {
    if (!usdcAmt || !eurcAmt) return usdcFormatted
    try {
      return usdcAmt.add(eurcAmt).toFixed(2)
    } catch {
      return usdcFormatted
    }
  })()

  return (
    <PageBackground>
      <div className="mx-auto max-w-md px-4 pb-32 pt-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Assets
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>
            Your balances on Arc Mainnet
          </p>
        </div>

        <AnimatePresence mode="wait">
          {activeToken ? (
            <AssetDetail
              key={`detail-${activeToken.symbol}`}
              token={activeToken}
              onBack={() => setActiveToken(null)}
              address={address}
            />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Portfolio total */}
              <GlassCard className="mb-4 p-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
                  Total Portfolio Value
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="display text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    ${totalUsd}
                  </span>
                  <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>
                    USD
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
                  Stablecoins, 1:1 with USD
                </p>
              </GlassCard>

              {/* Asset list */}
              <GlassCard>
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    Your Assets
                  </p>
                </div>
                <div className="border-t p-1" style={{ borderColor: 'var(--border)' }}>
                  {TOKENS.map((token) => (
                    <AssetRow
                      key={token.symbol}
                      token={token}
                      address={address}
                      onClick={() => setActiveToken(token)}
                    />
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageBackground>
  )
}
