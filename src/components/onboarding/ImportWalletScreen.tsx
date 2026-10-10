import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { PageBackground } from '../shared/PageBackground'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { isValidMnemonic, isValidPrivateKey } from '../../utils/wallet'

type ImportMode = 'mnemonic' | 'privatekey'

export function ImportWalletScreen() {
  const { setScreen, importFromMnemonic, importFromPrivateKey } = useWallet()
  const [mode, setMode] = useState<ImportMode>('mnemonic')
  const [value, setValue] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImport = () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'mnemonic') {
        if (!isValidMnemonic(value)) {
          setError('Invalid recovery phrase. Check the words and try again.')
          setLoading(false)
          return
        }
        const ok = importFromMnemonic(value)
        if (!ok) {
          setError('Failed to import wallet. Please check your phrase.')
        }
      } else {
        if (!isValidPrivateKey(value)) {
          setError('Invalid private key. It should be a 64-character hex string.')
          setLoading(false)
          return
        }
        const ok = importFromPrivateKey(value)
        if (!ok) {
          setError('Failed to import wallet. Please check your private key.')
        }
      }
    } catch {
      toast.error('Import failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isValid = mode === 'mnemonic' ? isValidMnemonic(value) : isValidPrivateKey(value)

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
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Import Wallet
          </h1>
        </div>

        {/* Security warning */}
        <motion.div
          className="mb-5 flex gap-3 rounded-2xl p-4"
          style={{
            background: 'rgba(186,43,76,0.06)',
            border: '1px solid rgba(186,43,76,0.18)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Never share your recovery phrase or private key. ArcWallet processes this locally — it is never sent to any server.
          </p>
        </motion.div>

        {/* Mode tabs */}
        <div
          className="mb-5 flex rounded-2xl p-1"
          style={{ background: 'rgba(18,45,69,0.06)' }}
        >
          {(['mnemonic', 'privatekey'] as ImportMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setValue(''); setError('') }}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all"
              style={{
                background: mode === m ? 'white' : 'transparent',
                color: mode === m ? 'var(--ink)' : 'var(--subtle)',
                boxShadow: mode === m ? '0 2px 8px rgba(18,45,69,0.08)' : 'none',
              }}
            >
              {m === 'mnemonic' ? 'Recovery Phrase' : 'Private Key'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {mode === 'mnemonic' ? (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                  Recovery Phrase (12 or 24 words)
                </label>
                <textarea
                  className="w-full resize-none rounded-2xl p-4 text-sm outline-none placeholder:text-slate-300"
                  style={{
                    background: 'rgba(255,255,255,0.60)',
                    border: error ? '1px solid rgba(186,43,76,0.40)' : '1px solid rgba(18,45,69,0.12)',
                    color: 'var(--ink)',
                    minHeight: '120px',
                  }}
                  placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setError('') }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                  Private Key
                </label>
                <div className="relative">
                  <input
                    type={showValue ? 'text' : 'password'}
                    className="mono w-full rounded-2xl px-4 py-3.5 pr-12 text-sm outline-none placeholder:text-slate-300"
                    style={{
                      background: 'rgba(255,255,255,0.60)',
                      border: error ? '1px solid rgba(186,43,76,0.40)' : '1px solid rgba(18,45,69,0.12)',
                      color: 'var(--ink)',
                    }}
                    placeholder="0x..."
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError('') }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                    style={{ color: 'var(--subtle)' }}
                  >
                    {showValue ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="mb-4 text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <button
          disabled={!isValid || loading}
          onClick={handleImport}
          className="w-full rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? 'Importing...' : 'Import Wallet'}
        </button>
      </div>
    </PageBackground>
  )
}
