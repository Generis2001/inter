/**
 * PinVerificationModal — Reusable PIN/Password authorization dialog.
 * Prompts user for their 6-digit PIN (or password fallback) and verifies
 * against the AES-256-GCM vault before invoking onSuccess.
 */
import { useState, useCallback, useEffect } from 'react'
import { BottomSheet } from './BottomSheet'
import { unlockStoredVault } from '../../utils/vault'
import { Shield, KeyRound, Delete, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface PinVerificationModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title?: string
  description?: string
  actionLabel?: string
}

export function PinVerificationModal({
  open,
  onClose,
  onSuccess,
  title = 'Security Verification',
  description = 'Enter your 6-digit PIN to authorize this transaction.',
  actionLabel = 'Authorize',
}: PinVerificationModalProps) {
  const [authPin, setAuthPin] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isPasswordMode, setIsPasswordMode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [errorShake, setErrorShake] = useState(false)

  // Reset inputs when modal opens or closes
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setAuthPin('')
      setAuthPassword('')
      setVerifying(false)
      setErrorShake(false)
    }
  }, [open])
  /* oxlint-enable react/set-state-in-effect */

  const handleVerifyCredential = useCallback(
    async (credential: string) => {
      if (!credential) return
      setVerifying(true)
      try {
        await unlockStoredVault(credential)
        onSuccess()
        onClose()
      } catch {
        setErrorShake(true)
        setTimeout(() => setErrorShake(false), 500)
        setAuthPin('')
        setAuthPassword('')
        toast.error('Incorrect PIN or password')
      } finally {
        setVerifying(false)
      }
    },
    [onSuccess, onClose],
  )

  const handlePinDigit = useCallback(
    (digit: string) => {
      if (verifying) return
      if (authPin.length < 6) {
        const next = authPin + digit
        setAuthPin(next)
        if (next.length === 6) {
          void handleVerifyCredential(next)
        }
      }
    },
    [authPin, verifying, handleVerifyCredential],
  )

  const handlePinDelete = useCallback(() => {
    if (verifying) return
    setAuthPin((prev) => prev.slice(0, -1))
  }, [verifying])

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
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
          {description}
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
                {verifying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  actionLabel
                )}
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
  )
}
