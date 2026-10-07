import { Home, Activity, Layers, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

export type NavTab = 'home' | 'activity' | 'assets' | 'settings'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const TABS: { key: NavTab; icon: typeof Home; label: string }[] = [
  { key: 'home',     icon: Home,     label: 'Home'     },
  { key: 'activity', icon: Activity, label: 'Activity' },
  { key: 'assets',   icon: Layers,   label: 'Assets'   },
  { key: 'settings', icon: Settings, label: 'Settings' },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <div
        className="mx-4 mb-3 flex w-full max-w-md items-center justify-around rounded-3xl px-2 py-2"
        style={{
          background: 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid rgba(6,182,212,0.14)',
          boxShadow: '0 8px 32px rgba(6,182,212,0.10), inset 0 1px 0 rgba(255,255,255,0.65)',
        }}
      >
        {TABS.map(({ key, icon: Icon, label }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="relative flex min-w-[60px] flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: 'rgba(6,182,212,0.10)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Icon
                className="relative z-10 size-5"
                style={{ color: isActive ? 'var(--accent-light)' : 'var(--subtle)' }}
              />
              <span
                className="relative z-10 text-xs font-semibold"
                style={{ color: isActive ? 'var(--accent)' : 'var(--subtle)' }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
