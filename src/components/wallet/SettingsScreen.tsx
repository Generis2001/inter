import { useState, useCallback } from 'react'
import { useWallet } from '../../context/WalletContext'
import { useArcBalance } from '../../hooks/useArcBalance'
import { PageBackground } from '../shared/PageBackground'
import { GlassCard } from '../shared/GlassCard'
import { WalletIdenticon } from '../shared/WalletIdenticon'
import { BottomSheet } from '../shared/BottomSheet'
import { formatAddress } from '../../utils/wallet'
import { unlockStoredVault, hasStoredVault } from '../../utils/vault'
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
  EyeOff,
  Delete,
  KeyRound,
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
  const [copiedPhrase, setCopiedPhrase] = useState(false)
  const [isPhraseRevealed, setIsPhraseRevealed] = useState(false)
  const [lockConfirm, setLockConfirm] = useState(false)

  // Auth sheet state for revealing recovery phrase
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
  const [authPin, setAuthPin] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isPasswordMode, setIsPasswordMode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [errorShake, setErrorShake] = useState(false)

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

  const handleCopyPhrase = async () => {
    if (!mnemonic) return
    try {
      await navigator.clipboard.writeText(mnemonic)
      setCopiedPhrase(true)
      toast.success('Recovery phrase copied')
      setTimeout(() => setCopiedPhrase(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }

  const handleToggleReveal = () => {
    if (isPhraseRevealed) {
      setIsPhraseRevealed(false)
      return
    }
    if (hasStoredVault()) {
      setAuthPin('')
      setAuthPassword('')
      setAuthSheetOpen(true)
    } else {
      setIsPhraseRevealed(true)
    }
  }

  const handleVerifyCredential = useCallback(async (credential: string) => {
    if (!credential) return
    setVerifying(true)
    try {
      await unlockStoredVault(credential)
      setIsPhraseRevealed(true)
      setAuthSheetOpen(false)
      toast.success('Identity verified — phrase revealed')
    } catch {
      setErrorShake(true)
      setTimeout(() => setErrorShake(false), 500)
      setAuthPin('')
      setAuthPassword('')
      toast.error('Incorrect PIN or password')
    } finally {
      setVerifying(false)
    }
  }, [])

  const handlePinDigit = useCallback((digit: string) => {
    if (verifying) return
    if (authPin.length < 6) {
      const next = authPin + digit
      setAuthPin(next)
      if (next.length === 6) {
        void handleVerifyCredential(next)
      }
    }
  }, [authPin, verifying, handleVerifyCredential])

  const handlePinDelete = useCallback(() => {
    if (verifying) return
    setAuthPin((prev) => prev.slice(0, -1))
  }, [verifying])

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
            {address ? (
              <WalletIdenticon address={address} size={48} />
            ) : (
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                IN
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                My Wallet
              </p>
              <p className="mono mt-0.5 truncate text-xs" style={{ color: 'var(--subtle)' }}>
                {address ?? 'Not connected'}
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
                  onClick={handleToggleReveal}
                  className="flex w-full items-center justify-between px-4 py-3.5 transition-all hover:bg-black/4"
                >
                  <div className="flex items-center gap-2">
                    {isPhraseRevealed ? (
                      <EyeOff className="size-4" style={{ color: 'var(--accent)' }} />
                    ) : (
                      <Lock className="size-4" style={{ color: 'var(--subtle)' }} />
                    )}
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {isPhraseRevealed ? 'Hide Recovery Phrase' : 'Show Recovery Phrase'}
                    </span>
                  </div>
                  <ChevronRight
                    className="size-4 transition-transform"
                    style={{
                      color: 'var(--subtle)',
                      transform: isPhraseRevealed ? 'rotate(90deg)' : 'none',
                    }}
                  />
                </button>
                <AnimatePresence>
                  {isPhraseRevealed && (
                    <motion.div
                      className="border-t px-4 pb-4 pt-3"
                      style={{ borderColor: 'var(--border)' }}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div
                        className="mb-3 flex items-start justify-between gap-2 rounded-xl p-3"
                        style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.15)' }}
                      >
                        <div className="flex gap-2">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: 'var(--danger)' }} />
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Never share this phrase. Anyone with it has full access to your funds.
                          </p>
                        </div>
                        <button
                          onClick={() => { void handleCopyPhrase() }}
                          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all hover:bg-black/5"
                          style={{ color: 'var(--ink)' }}
                        >
                          {copiedPhrase ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                          {copiedPhrase ? 'Copied' : 'Copy'}
                        </button>
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
              { label: 'Built by', value: 'Generis2001' },
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
                Your private key will be cleared from memory. You will need your PIN or password to unlock again.
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

      {/* Security Verification Bottom Sheet */}
      <BottomSheet
        open={authSheetOpen}
        onClose={() => setAuthSheetOpen(false)}
        title="Security Verification"
      >
        <div className="px-5 pb-8 pt-2 text-center">
          <div
            className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(6,182,212,0.12)',
              border: '1px solid rgba(6,182,212,0.22)',
            }}
          >
            <Shield className="size-6" style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {isPasswordMode ? 'Enter Wallet Password' : 'Enter 6-Digit PIN'}
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            Verify your PIN or password to reveal your recovery phrase.
          </p>

          <motion.div
            animate={errorShake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="py-4"
          >
            {isPasswordMode ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleVerifyCredential(authPassword)
                }}
                className="space-y-3"
              >
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Enter wallet password"
                  autoFocus
                  className="w-full rounded-2xl px-4 py-3.5 text-center text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.75)',
                    border: '1px solid rgba(6,182,212,0.25)',
                    color: 'var(--ink)',
                  }}
                />
                <button
                  type="submit"
                  disabled={verifying || !authPassword}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: 'var(--accent-gradient)' }}
                >
                  {verifying ? 'Verifying...' : 'Unlock Phrase'}
                </button>
              </form>
            ) : (
              <div>
                {/* PIN dots */}
                <div className="mb-6 flex justify-center gap-3.5">
                  {[0, 1, 2, 3, 4, 5].map((index) => {
                    const isFilled = index < authPin.length
                    return (
                      <motion.div
                        key={index}
                        animate={{
                          scale: isFilled ? [1, 1.25, 1] : 1,
                          backgroundColor: isFilled ? 'var(--accent)' : 'rgba(6,182,212,0.15)',
                        }}
                        transition={{ duration: 0.15 }}
                        className="size-4 rounded-full border"
                        style={{
                          borderColor: isFilled ? 'var(--accent)' : 'rgba(6,182,212,0.30)',
                          boxShadow: isFilled ? '0 0 10px rgba(6,182,212,0.35)' : 'none',
                        }}
                      />
                    )
                  })}
                </div>

                {/* Keypad */}
                <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      onClick={() => handlePinDigit(digit)}
                      disabled={verifying}
                      className="flex size-14 items-center justify-center rounded-2xl text-lg font-bold transition-all hover:bg-black/5 active:scale-95 active:bg-cyan-100/40"
                      style={{
                        background: 'rgba(255,255,255,0.70)',
                        border: '1px solid rgba(6,182,212,0.14)',
                        color: 'var(--ink)',
                      }}
                    >
                      {digit}
                    </button>
                  ))}
                  <div className="size-14" />
                  <button
                    onClick={() => handlePinDigit('0')}
                    disabled={verifying}
                    className="flex size-14 items-center justify-center rounded-2xl text-lg font-bold transition-all hover:bg-black/5 active:scale-95 active:bg-cyan-100/40"
                    style={{
                      background: 'rgba(255,255,255,0.70)',
                      border: '1px solid rgba(6,182,212,0.14)',
                      color: 'var(--ink)',
                    }}
                  >
                    0
                  </button>
                  <button
                    onClick={handlePinDelete}
                    disabled={verifying}
                    className="flex size-14 items-center justify-center rounded-2xl transition-all hover:bg-black/5 active:scale-95"
                    style={{
                      background: 'rgba(255,255,255,0.40)',
                      color: 'var(--muted)',
                    }}
                    aria-label="Delete last digit"
                  >
                    <Delete className="size-5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          <button
            onClick={() => setIsPasswordMode((prev) => !prev)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            <KeyRound className="size-3.5" />
            {isPasswordMode ? 'Use 6-Digit PIN instead' : 'Use wallet password instead'}
          </button>
        </div>
      </BottomSheet>
    </PageBackground>
  )
}
