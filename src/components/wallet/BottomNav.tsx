import { Home, History, SlidersHorizontal, AtSign } from 'lucide-react'
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { selectionSpring } from '../../utils/motion'

export type NavTab = 'home' | 'activity' | 'assets' | 'swap' | 'bridge' | 'ans' | 'settings'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const TABS = [
  { key: 'home', icon: Home, label: 'Home' },
  { key: 'activity', icon: History, label: 'History' },
  { key: 'ans', icon: AtSign, label: 'ANS' },
  { key: 'settings', icon: SlidersHorizontal, label: 'Settings' },
] as const

export function BottomNav({ active, onChange }: BottomNavProps) {
  const reducedMotion = useReducedMotion()
  // Assets and exchange screens are reached from Home's shortcuts.
  const selected = ['assets', 'swap', 'bridge'].includes(active) ? 'home' : active

  return (
    <nav aria-label="Main navigation" className="wallet-nav">
      <LayoutGroup id="wallet-navigation">
        <div className="wallet-nav-bar">
          {TABS.map(({ key, icon: Icon, label }) => {
            const isActive = selected === key
            return (
              <motion.button
                key={key}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(key)}
                className="wallet-nav-button"
                whileTap={reducedMotion ? undefined : { scale: 0.94 }}
                transition={selectionSpring}
              >
                {isActive && (
                  <motion.span
                    layoutId={reducedMotion ? undefined : 'active-tab'}
                    className="wallet-nav-selection"
                    transition={selectionSpring}
                    aria-hidden="true"
                  />
                )}
                <motion.span
                  className="wallet-nav-icon"
                  animate={{ y: isActive && !reducedMotion ? -1 : 0 }}
                  transition={selectionSpring}
                  aria-hidden="true"
                >
                  <Icon size={23} strokeWidth={isActive ? 2.1 : 1.8}
                    fill={key === 'home' && isActive ? 'var(--nav-icon-fill)' : 'none'} />
                </motion.span>
                <span className="wallet-nav-label">{label}</span>
              </motion.button>
            )
          })}
        </div>
      </LayoutGroup>
    </nav>
  )
}
