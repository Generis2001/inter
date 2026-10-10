import { useState, useMemo } from 'react'
import { useWallet } from '../../context/WalletContext'
import { PageBackground } from '../shared/PageBackground'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { spectral } from '../shared/GlassCard'

export function VerifyMnemonicScreen() {
  const { setScreen, pendingMnemonic, confirmMnemonic } = useWallet()

  const allWords = useMemo(
    () => pendingMnemonic?.trim().split(/\s+/) ?? [],
    [pendingMnemonic],
  )

  // Pick 4 positions to verify — spread evenly across the phrase, deterministic per render
  const testIndices = useMemo(() => {
    if (allWords.length < 4) return []
    const step = Math.floor(allWords.length / 4)
    return [0, step, step * 2, step * 3]
      .map((base, i) => (base + i) % allWords.length)
      .sort((a, b) => a - b)
  }, [allWords])

  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [attempted, setAttempted] = useState(false)

  const getStatus = (idx: number): 'idle' | 'correct' | 'wrong' => {
    const val = inputs[idx]?.trim().toLowerCase()
    if (!val) return 'idle'
    return val === allWords[idx]?.toLowerCase() ? 'correct' : 'wrong'
  }

  const allCorrect = testIndices.every((i) => getStatus(i) === 'correct')

  const handleSubmit = () => {
    setAttempted(true)
    const wordArray = allWords.map((w, i) =>
      testIndices.includes(i) ? (inputs[i]?.trim() ?? '') : w,
    )
    const success = confirmMnemonic(wordArray)
    if (!success) {
      toast.error('Some words are incorrect. Please try again.')
    }
  }

  return (
    <PageBackground>
      <div className="mx-auto max-w-md px-5 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setScreen('create-mnemonic')}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-black/6"
            style={{ color: 'var(--ink)' }}
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1">
            <div className="h-0.5 w-full rounded-full" style={{ background: 'var(--border)' }}>
              <div className="h-0.5 w-full rounded-full" style={{ background: spectral }} />
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
              Step 2 of 2
            </p>
          </div>
        </div>

        <motion.h1
          className="display mb-2 text-2xl font-bold"
          style={{ color: 'var(--ink)' }}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          Verify Your Phrase
        </motion.h1>
        <motion.p
          className="mb-6 text-sm"
          style={{ color: 'var(--muted)' }}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          Enter the missing words to confirm you have saved your recovery phrase.
        </motion.p>

        <motion.div
          className="mb-6 grid grid-cols-3 gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {allWords.map((word, i) => {
            const isTest = testIndices.includes(i)
            const status = getStatus(i)

            return (
              <div
                key={i}
                className="relative rounded-xl"
                style={{
                  background: isTest
                    ? status === 'correct'
                      ? 'rgba(26,128,71,0.07)'
                      : status === 'wrong' && attempted
                        ? 'rgba(186,43,76,0.07)'
                        : 'rgba(255,255,255,0.46)'
                    : 'rgba(255,255,255,0.30)',
                  border: `1px solid ${
                    isTest
                      ? status === 'correct'
                        ? 'rgba(26,128,71,0.30)'
                        : status === 'wrong' && attempted
                          ? 'rgba(186,43,76,0.30)'
                          : 'rgba(255,255,255,0.56)'
                      : 'rgba(18,45,69,0.06)'
                  }`,
                }}
              >
                {isTest ? (
                  <div className="flex items-center px-2 py-1.5">
                    <span className="mono mr-1 text-xs tabular-nums" style={{ color: 'var(--subtle)', minWidth: '16px' }}>
                      {i + 1}.
                    </span>
                    <input
                      className="w-full bg-transparent text-xs font-medium outline-none placeholder:text-slate-300"
                      style={{ color: 'var(--ink)' }}
                      placeholder="word"
                      value={inputs[i] ?? ''}
                      onChange={(e) => setInputs((p) => ({ ...p, [i]: e.target.value }))}
                    />
                    {status === 'correct' && <Check className="shrink-0 size-3" style={{ color: 'var(--success)' }} />}
                    {status === 'wrong' && attempted && <X className="shrink-0 size-3" style={{ color: 'var(--danger)' }} />}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-2">
                    <span className="mono text-xs tabular-nums" style={{ color: 'var(--subtle)', minWidth: '16px' }}>
                      {i + 1}.
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
                      {word}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </motion.div>

        <button
          disabled={testIndices.some((i) => !inputs[i]?.trim())}
          onClick={handleSubmit}
          className="w-full rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: allCorrect && attempted ? 'var(--success)' : 'var(--accent)' }}
        >
          {allCorrect && attempted ? 'Verified!' : 'Confirm Recovery Phrase'}
        </button>
      </div>
    </PageBackground>
  )
}
