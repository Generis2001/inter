import { Home, Activity, Settings, AtSign, ArrowLeftRight } from 'lucide-react'
import { motion } from 'framer-motion'

export type NavTab = 'home' | 'activity' | 'assets' | 'swap' | 'ans' | 'settings'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const TABS: { key: NavTab; icon: typeof Home; label: string }[] = [
  { key: 'home',     icon: Home,             label: 'Home'     },
  { key: 'swap',     icon: ArrowLeftRight,   label: 'Swap'     },
  { key: 'activity', icon: Activity,         label: 'Activity' },
  { key: 'ans',      icon: AtSign,           label: 'ANS'      },
  { key: 'settings', icon: Settings,         label: 'Settings' },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
    >
      <div
        className="pointer-events-auto mx-4 mb-2 flex w-full max-w-md items-center justify-around rounded-3xl px-2.5 py-2 transition-all"
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--nav-shadow)',
        }}
      >
        {TABS.map(({ key, icon: Icon, label }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="relative flex min-w-[56px] flex-col items-center gap-1 rounded-2xl py-1.5 transition-all active:scale-95"
            >
              {isActive && (
                <motion.div
                  layoutId="meteor-nav-active-glow"
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'var(--accent-lighter)',
                    border: '1px solid var(--accent-light)',
                    opacity: 0.8,
                  }}
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <Icon
                className="relative z-10 size-5 transition-transform duration-200"
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--subtle)',
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                }}
              />
              <span
                className="relative z-10 text-[11px] font-bold tracking-tight"
                style={{ color: isActive ? 'var(--ink)' : 'var(--subtle)' }}
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
