import { useState, useCallback } from 'react'
import { useWallet } from '../../context/WalletContext'
import { PageBackground } from '../shared/PageBackground'
import { motion } from 'framer-motion'
import { Lock, Check, Delete, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

export function SetupPinScreen() {
  const { finalizeWalletWithPin } = useWallet()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [usePasswordMode, setUsePasswordMode] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleKeyPress = useCallback((num: string) => {
    if (step === 'create') {
      if (pin.length < 6) {
        const next = pin + num
        setPin(next)
        if (next.length === 6) {
          setTimeout(() => setStep('confirm'), 200)
        }
      }
    } else {
      if (confirmPin.length < 6) {
        const next = confirmPin + num
        setConfirmPin(next)
        if (next.length === 6) {
          if (next === pin) {
            setSubmitting(true)
            void finalizeWalletWithPin(pin)
              .then(() => toast.success('PIN created! Wallet ready.'))
              .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : 'Failed to secure wallet'
                toast.error(msg)
                setSubmitting(false)
              })
          } else {
            toast.error('PINs do not match. Please try again.')
            setTimeout(() => {
              setConfirmPin('')
              setStep('create')
              setPin('')
            }, 600)
          }
        }
      }
    }
  }, [step, pin, confirmPin, finalizeWalletWithPin])

  const handleDelete = useCallback(() => {
    if (step === 'create') {
      setPin((prev) => prev.slice(0, -1))
    } else {
      setConfirmPin((prev) => prev.slice(0, -1))
    }
  }, [step])

  const handlePasswordSubmit = async () => {
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await finalizeWalletWithPin(password)
      toast.success('Wallet secured and ready!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to secure wallet'
      toast.error(msg)
      setSubmitting(false)
    }
  }

  const currentDisplayPin = step === 'create' ? pin : confirmPin

  return (
    <PageBackground>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-8">
        {/* Header */}
        <div className="pt-4 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(6,182,212,0.12)',
              border: '1px solid rgba(6,182,212,0.22)',
            }}
          >
            <Lock className="size-7" style={{ color: 'var(--accent)' }} />
          </motion.div>

          <motion.h1
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="display text-2xl font-bold tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            {usePasswordMode
              ? 'Set Password'
              : step === 'create'
                ? 'Create a 6-Digit PIN'
                : 'Confirm Your PIN'}
          </motion.h1>

          <motion.p
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-1 text-sm"
            style={{ color: 'var(--muted)' }}
          >
            {usePasswordMode
              ? 'Use this password to unlock your wallet on this device.'
              : step === 'create'
                ? 'You will use this PIN to quickly unlock your wallet.'
                : 'Re-enter your 6-digit PIN to confirm.'}
          </motion.p>
        </div>

        {/* PIN or Password Input */}
        {usePasswordMode ? (
          <div className="my-auto space-y-4 py-8">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
                Password (min 6 characters)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none transition-all placeholder:text-slate-300"
                style={{
                  background: 'rgba(255,255,255,0.70)',
                  border: '1px solid rgba(6,182,212,0.20)',
                  color: 'var(--ink)',
                }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none transition-all placeholder:text-slate-300"
                style={{
                  background: 'rgba(255,255,255,0.70)',
                  border: '1px solid rgba(6,182,212,0.20)',
                  color: 'var(--ink)',
                }}
              />
            </div>

            <button
              disabled={submitting || password.length < 6 || password !== confirmPassword}
              onClick={() => { void handlePasswordSubmit() }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <Check className="size-4" />
              {submitting ? 'Securing Wallet...' : 'Save Password & Continue'}
            </button>
          </div>
        ) : (
          <div className="my-auto py-4">
            {/* PIN Dots Indicator */}
            <div className="mb-8 flex justify-center gap-3.5">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const isFilled = index < currentDisplayPin.length
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
                      boxShadow: isFilled ? '0 0 12px rgba(6,182,212,0.35)' : 'none',
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
                    background: 'rgba(255,255,255,0.70)',
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
                  background: 'rgba(255,255,255,0.70)',
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

        {/* Footer switcher */}
        <div className="pb-2 text-center">
          <button
            onClick={() => setUsePasswordMode((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            <KeyRound className="size-3.5" />
            {usePasswordMode ? 'Use 6-Digit PIN instead' : 'Use a custom password instead'}
          </button>
        </div>
      </div>
    </PageBackground>
  )
}
