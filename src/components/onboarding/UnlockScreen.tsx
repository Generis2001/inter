import { useState, useCallback } from 'react'
import { useWallet } from '../../context/WalletContext'
import { PageBackground } from '../shared/PageBackground'
import { WalletIdenticon } from '../shared/WalletIdenticon'
import { formatAddress } from '../../utils/wallet'
import { motion } from 'framer-motion'
import { Lock, Delete, KeyRound, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

export function UnlockScreen() {
  const { unlockWithPin, storedAddress, resetWallet } = useWallet()
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isPasswordMode, setIsPasswordMode] = useState(false)
  const [password, setPassword] = useState('')
  const [errorShake, setErrorShake] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const triggerError = useCallback(() => {
    setErrorShake(true)
    setTimeout(() => setErrorShake(false), 500)
    setPin('')
    setPassword('')
  }, [])

  const attemptUnlock = useCallback(async (credential: string) => {
    setSubmitting(true)
    try {
      await unlockWithPin(credential)
      toast.success('Wallet unlocked')
    } catch {
      toast.error('Incorrect PIN or password')
      triggerError()
    } finally {
      setSubmitting(false)
    }
  }, [unlockWithPin, triggerError])

  const handleKeyPress = useCallback((digit: string) => {
    if (submitting) return
    if (pin.length < 6) {
      const next = pin + digit
      setPin(next)
      if (next.length === 6) {
        void attemptUnlock(next)
      }
    }
  }, [pin, submitting, attemptUnlock])

  const handleDelete = useCallback(() => {
    if (submitting) return
    setPin((prev) => prev.slice(0, -1))
  }, [submitting])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    void attemptUnlock(password)
  }

  return (
    <PageBackground>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-8">
        {/* Header / Avatar */}
        <div className="pt-6 text-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl shadow-sm"
          >
            {storedAddress ? (
              <WalletIdenticon address={storedAddress} size={54} />
            ) : (
              <div
                className="flex size-14 items-center justify-center rounded-2xl"
                style={{ background: 'var(--accent-gradient)' }}
              >
                <Lock className="size-6 text-white" />
              </div>
            )}
          </motion.div>

          <motion.h1
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="display text-2xl font-bold tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            Welcome Back
          </motion.h1>

          <p className="mono mt-1 text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
            {storedAddress ? formatAddress(storedAddress) : 'Inter Wallet'}
          </p>
        </div>

        {/* Input Area */}
        <motion.div
          animate={errorShake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="my-auto py-4"
        >
          {isPasswordMode ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter wallet password"
                  autoFocus
                  className="w-full rounded-2xl px-4 py-4 text-center text-base outline-none transition-all placeholder:text-slate-300"
                  style={{
                    background: 'rgba(255,255,255,0.75)',
                    border: '1px solid rgba(6,182,212,0.25)',
                    color: 'var(--ink)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !password}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: 'var(--accent-gradient)' }}
              >
                {submitting ? 'Decrypting...' : 'Unlock Wallet'}
              </button>
            </form>
          ) : (
            <div>
              {/* PIN Dots */}
              <div className="mb-8 flex justify-center gap-4">
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const isFilled = index < pin.length
                  return (
                    <motion.div
                      key={index}
                      animate={{
                        scale: isFilled ? [1, 1.3, 1] : 1,
                        backgroundColor: isFilled ? 'var(--accent)' : 'rgba(6,182,212,0.15)',
                      }}
                      transition={{ duration: 0.15 }}
                      className="size-4 rounded-full border"
                      style={{
                        borderColor: isFilled ? 'var(--accent)' : 'rgba(6,182,212,0.30)',
                        boxShadow: isFilled ? '0 0 12px rgba(6,182,212,0.40)' : 'none',
                      }}
                    />
                  )
                })}
              </div>

              {/* Numeric Keypad */}
              <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleKeyPress(digit)}
                    disabled={submitting}
                    className="flex size-16 items-center justify-center rounded-2xl text-xl font-bold transition-all hover:bg-black/5 active:scale-95 active:bg-cyan-100/40"
                    style={{
                      background: 'rgba(255,255,255,0.72)',
                      border: '1px solid rgba(6,182,212,0.14)',
                      color: 'var(--ink)',
                    }}
                  >
                    {digit}
                  </button>
                ))}
                <div className="size-16" />
                <button
                  onClick={() => handleKeyPress('0')}
                  disabled={submitting}
                  className="flex size-16 items-center justify-center rounded-2xl text-xl font-bold transition-all hover:bg-black/5 active:scale-95 active:bg-cyan-100/40"
                  style={{
                    background: 'rgba(255,255,255,0.72)',
                    border: '1px solid rgba(6,182,212,0.14)',
                    color: 'var(--ink)',
                  }}
                >
                  0
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex size-16 items-center justify-center rounded-2xl transition-all hover:bg-black/5 active:scale-95"
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

        {/* Footer controls */}
        <div className="space-y-3 pb-2 text-center">
          <button
            onClick={() => setIsPasswordMode((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            <KeyRound className="size-3.5" />
            {isPasswordMode ? 'Unlock with 6-Digit PIN' : 'Unlock with custom password'}
          </button>

          <div>
            {confirmReset ? (
              <div className="mx-auto max-w-xs rounded-2xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
                <p className="text-xs font-semibold text-red-600 mb-2">
                  This will remove the saved wallet from this device. You will need your recovery phrase to restore it.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { resetWallet(); toast.info('Wallet reset. Enter phrase to restore.') }}
                    className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 rounded-xl bg-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RotateCcw className="size-3" />
                Forgot PIN? Reset with seed phrase
              </button>
            )}
          </div>
        </div>
      </div>
    </PageBackground>
  )
}
