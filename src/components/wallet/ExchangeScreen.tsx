import { ArrowLeftRight, Route } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { PageBackground } from '../shared/PageBackground'
import { ScreenTransition } from '../shared/ScreenTransition'
import { selectionSpring } from '../../utils/motion'
import { SwapScreen } from './SwapScreen'
import { BridgeScreen } from './BridgeScreen'

export function ExchangeScreen({ mode, onChange }: { mode: 'swap' | 'bridge'; onChange: (mode: 'swap' | 'bridge') => void }) {
  const reducedMotion = useReducedMotion()
  const direction = mode === 'bridge' ? 1 : -1
  return <PageBackground>
    <div className="mx-auto max-w-md px-4 pt-4">
    <div className="flex gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }} role="group" aria-label="Exchange mode">
      {(['swap', 'bridge'] as const).map(value => <button key={value} onClick={() => onChange(value)} aria-pressed={mode === value}
        className="relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
        style={{ color: mode === value ? 'var(--accent)' : 'var(--muted)' }}>
        {mode === value && <motion.span layoutId={reducedMotion ? undefined : 'exchange-selection'} className="absolute inset-0 rounded-xl"
          style={{ background: 'var(--surface-strong)', boxShadow: '0 2px 6px rgb(0 0 0 / 4%)' }} transition={selectionSpring} />}
        {value === 'swap' ? <ArrowLeftRight className="relative size-4" /> : <Route className="relative size-4" />}<span className="relative">{value === 'swap' ? 'Swap' : 'Bridge'}</span>
      </button>)}
    </div>
    </div>
    <div className="relative">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <ScreenTransition key={mode} direction={direction} name={`exchange-${mode}`}>
          {mode === 'bridge' ? <BridgeScreen /> : <SwapScreen />}
        </ScreenTransition>
      </AnimatePresence>
    </div>
  </PageBackground>
}
