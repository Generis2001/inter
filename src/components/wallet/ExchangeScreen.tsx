import { ArrowLeftRight, Route } from 'lucide-react'
import { PageBackground } from '../shared/PageBackground'
import { SwapScreen } from './SwapScreen'
import { BridgeScreen } from './BridgeScreen'

export function ExchangeScreen({ mode, onChange }: { mode: 'swap' | 'bridge'; onChange: (mode: 'swap' | 'bridge') => void }) {
  return <PageBackground>
    <div className="mx-auto flex max-w-md gap-1 px-4 pt-4">
      {(['swap', 'bridge'] as const).map(value => <button key={value} onClick={() => onChange(value)} aria-pressed={mode === value}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold"
        style={{ background: mode === value ? 'var(--accent-lighter)' : 'var(--surface-muted)', color: mode === value ? 'var(--accent)' : 'var(--muted)' }}>
        {value === 'swap' ? <ArrowLeftRight className="size-4" /> : <Route className="size-4" />}{value === 'swap' ? 'Swap' : 'Bridge'}
      </button>)}
    </div>
    {mode === 'bridge' ? <BridgeScreen /> : <SwapScreen />}
  </PageBackground>
}
