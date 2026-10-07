import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { PageBackground } from '../shared/PageBackground'
import { motion } from 'framer-motion'
import { ArrowLeft, AlertTriangle, Eye, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { spectral } from '../shared/GlassCard'

export function CreateMnemonicScreen() {
  const { setScreen, pendingMnemonic } = useWallet()
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const words = pendingMnemonic?.trim().split(/\s+/) ?? []

  const handleCopy = async () => {
    if (!pendingMnemonic) return
    try {
      await navigator.clipboard.writeText(pendingMnemonic)
      setCopied(true)
      toast.success('Copied to clipboard - store it somewhere safe')
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error('Could not copy. Please write it down manually.')
    }
  }

  return (
    <PageBackground>
      <div className="mx-auto max-w-md px-5 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setScreen('landing')}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-black/6"
            style={{ color: 'var(--ink)' }}
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <div className="h-0.5 w-full rounded-full" style={{ background: 'var(--border)' }}>
              <div className="h-0.5 w-1/2 rounded-full" style={{ background: spectral }} />
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
              Step 1 of 2
            </p>
          </div>
        </div>

        <motion.h1
          className="display mb-2 text-2xl font-bold"
          style={{ color: 'var(--ink)' }}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          Your Recovery Phrase
        </motion.h1>
        <motion.p
          className="mb-6 text-sm"
          style={{ color: 'var(--muted)' }}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          Write down these 12 words in order. This is the only way to recover your wallet.
        </motion.p>

        {/* Warning */}
        <motion.div
          className="mb-5 flex gap-3 rounded-2xl p-4"
          style={{
            background: 'rgba(186,43,76,0.07)',
            border: '1px solid rgba(186,43,76,0.20)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
              Never share your recovery phrase
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
              Anyone with these words has full access to your wallet. ArcWallet staff will never ask for it.
            </p>
          </div>
        </motion.div>

        {/* Mnemonic grid */}
        <div
          className="relative mb-4 rounded-3xl p-5"
          style={{
            background: 'rgba(255,255,255,0.64)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.68)',
            boxShadow: '0 8px 32px rgba(18,45,69,0.08)',
          }}
        >
          {!revealed && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl backdrop-blur-md">
              <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Tap to reveal your phrase
              </p>
              <button
                onClick={() => setRevealed(true)}
                className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Eye className="size-4" />
                Reveal
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {words.map((word, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-2"
                style={{
                  background: 'rgba(255,255,255,0.46)',
                  border: '1px solid rgba(255,255,255,0.56)',
                }}
              >
                <span className="mono text-xs tabular-nums" style={{ color: 'var(--subtle)', minWidth: '16px' }}>
                  {i + 1}.
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {word}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Copy button */}
        {revealed && (
          <motion.button
            onClick={() => { void handleCopy() }}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all hover:bg-black/5"
            style={{
              background: 'rgba(255,255,255,0.60)',
              border: '1px solid rgba(18,45,69,0.12)',
              color: 'var(--ink)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {copied ? <Check className="size-4" style={{ color: 'var(--success)' }} /> : <Copy className="size-4" />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </motion.button>
        )}

        {/* Confirm checkbox */}
        <label className="mb-6 flex cursor-pointer items-start gap-3">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              className="sr-only"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <div
              className="flex size-5 items-center justify-center rounded-md border-2 transition-all"
              style={{
                background: confirmed ? 'var(--accent)' : 'transparent',
                borderColor: confirmed ? 'var(--accent)' : 'var(--border-strong)',
              }}
            >
              {confirmed && <Check className="size-3 text-white" />}
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            I have written down my recovery phrase and stored it securely. I understand that losing it means losing access to my wallet forever.
          </p>
        </label>

        <button
          disabled={!revealed || !confirmed}
          onClick={() => setScreen('verify-mnemonic')}
          className="w-full rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          Continue to Verify
        </button>
      </div>
    </PageBackground>
  )
}
