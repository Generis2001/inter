import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { useArcBalance } from '../../hooks/useArcBalance'
import { PageBackground } from '../shared/PageBackground'
import { GlassCard } from '../shared/GlassCard'
import { formatAddress } from '../../utils/wallet'
import { buildAddressExplorerUrl, requireChain } from '@/onchain-facts'
import {
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Lock,
  Shield,
  Globe,
  Info,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const ARC_MAINNET_ID = 5042

export function SettingsScreen() {
  const { account, mnemonic, lockWallet } = useWallet()
  const address = account?.address
  const { formatted } = useArcBalance(address)
  const chain = requireChain(ARC_MAINNET_ID)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [lockConfirm, setLockConfirm] = useState(false)

  const handleCopyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(true)
      toast.success('Address copied')
      setTimeout(() => setCopiedAddress(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <PageBackground>
      <div className="mx-auto max-w-md px-4 pb-32 pt-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Settings
          </h1>
        </div>

        {/* Wallet info */}
        <GlassCard className="mb-4">
          <div className="flex items-center gap-3 px-4 py-4">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {address ? address.slice(2, 4).toUpperCase() : 'IN'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                My Wallet
              </p>
              <p className="mono mt-0.5 truncate text-xs" style={{ color: 'var(--subtle)' }}>
                {address ?? '—'}
              </p>
            </div>
          </div>
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>Balance</span>
              <span className="display text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {formatted} USDC
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Address section */}
        <GlassCard className="mb-4">
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Globe className="size-3.5" style={{ color: 'var(--subtle)' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
                Wallet Address
              </p>
            </div>
          </div>
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="mono text-sm" style={{ color: 'var(--ink)' }}>
                {address ? formatAddress(address) : 'Not available'}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => { void handleCopyAddress() }} style={{ color: 'var(--subtle)' }}>
                  {copiedAddress ? (
                    <Check className="size-4" style={{ color: 'var(--success)' }} />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
                {address && (
                  <a
                    href={buildAddressExplorerUrl(ARC_MAINNET_ID, address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--subtle)' }}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Network */}
        <GlassCard className="mb-4">
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Globe className="size-3.5" style={{ color: 'var(--subtle)' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
                Network
              </p>
            </div>
          </div>
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            {[
              { label: 'Network', value: chain.name },
              { label: 'Chain ID', value: `${chain.chainId}` },
              { label: 'RPC', value: chain.rpcUrls[0], mono: true, small: true },
            ].map(({ label, value, mono, small }, i) => (
              <div
                key={label}
                className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
                <span
                  className={`${mono ? 'mono' : ''} ${small ? 'text-xs' : 'text-xs font-semibold'} truncate max-w-[200px]`}
                  style={{ color: 'var(--ink)' }}
                >
                  {value}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Explorer</span>
              <a
                href={chain.explorerBase}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--accent-hover)' }}
              >
                Arc Explorer <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </GlassCard>

        {/* Security */}
        <GlassCard className="mb-4">
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Shield className="size-3.5" style={{ color: 'var(--subtle)' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
                Security
              </p>
            </div>
          </div>
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            {mnemonic && (
              <div>
                <button
                  onClick={() => setShowMnemonic((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3.5 transition-all hover:bg-black/4"
                >
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    Show Recovery Phrase
                  </span>
                  <ChevronRight
                    className="size-4 transition-transform"
                    style={{
                      color: 'var(--subtle)',
                      transform: showMnemonic ? 'rotate(90deg)' : 'none',
                    }}
                  />
                </button>
                <AnimatePresence>
                  {showMnemonic && (
                    <motion.div
                      className="border-t px-4 pb-4 pt-3"
                      style={{ borderColor: 'var(--border)' }}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div
                        className="mb-3 flex gap-2 rounded-xl p-3"
                        style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.15)' }}
                      >
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: 'var(--danger)' }} />
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          Never share this phrase. Anyone with it has full access to your wallet.
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {mnemonic.split(' ').map((word, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1 rounded-lg px-2 py-1.5"
                            style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)' }}
                          >
                            <span className="mono text-xs tabular-nums" style={{ color: 'var(--subtle)', minWidth: '14px' }}>
                              {i + 1}.
                            </span>
                            <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
                              {word}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <div
              className={`flex gap-2.5 px-4 py-4 ${mnemonic ? 'border-t' : ''}`}
              style={{ borderColor: 'var(--border)', background: 'rgba(186,43,76,0.04)' }}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--danger)' }}>Critical: </strong>
                Your recovery phrase is the only way to restore your wallet. If you lose it, your funds are permanently inaccessible. inter cannot recover it for you.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* About */}
        <GlassCard className="mb-5">
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Info className="size-3.5" style={{ color: 'var(--subtle)' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
                About
              </p>
            </div>
          </div>
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            {[
              { label: 'App', value: 'inter' },
              { label: 'Version', value: '1.0.0' },
              { label: 'Built on', value: 'Arc Studio' },
            ].map(({ label, value }, i) => (
              <div
                key={label}
                className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Lock/Disconnect */}
        <div className="space-y-3">
          {!lockConfirm ? (
            <button
              onClick={() => setLockConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-all hover:bg-red-50"
              style={{
                background: 'rgba(186,43,76,0.06)',
                border: '1px solid rgba(186,43,76,0.20)',
                color: 'var(--danger)',
              }}
            >
              <Lock className="size-4" />
              Lock Wallet
            </button>
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.20)' }}
            >
              <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                Lock your wallet?
              </p>
              <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
                Your private key will be cleared from memory. You will need your recovery phrase to unlock again.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLockConfirm(false)}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                  style={{
                    background: 'rgba(255,255,255,0.60)',
                    border: '1px solid rgba(18,45,69,0.12)',
                    color: 'var(--ink)',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={lockWallet}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                  style={{ background: 'var(--danger)', color: 'white' }}
                >
                  Lock
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageBackground>
  )
}
