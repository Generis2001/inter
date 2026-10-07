import { useState } from 'react'
import { WalletProvider, useWallet } from './context/WalletContext'
import { LandingScreen } from './components/onboarding/LandingScreen'
import { CreateMnemonicScreen } from './components/onboarding/CreateMnemonicScreen'
import { VerifyMnemonicScreen } from './components/onboarding/VerifyMnemonicScreen'
import { ImportWalletScreen } from './components/onboarding/ImportWalletScreen'
import { DashboardScreen } from './components/wallet/DashboardScreen'
import { ActivityScreen } from './components/wallet/ActivityScreen'
import { AssetsScreen } from './components/wallet/AssetsScreen'
import { SettingsScreen } from './components/wallet/SettingsScreen'
import { SendSheet } from './components/wallet/SendSheet'
import { ReceiveSheet } from './components/wallet/ReceiveSheet'
import { NotificationPanel } from './components/wallet/NotificationPanel'
import { BottomNav, type NavTab } from './components/wallet/BottomNav'
import { AnimatePresence, motion } from 'framer-motion'
import { useArcTransactions } from './hooks/useArcTransactions'
import { useNotifications } from './hooks/useNotifications'
import { InterLogo } from './components/shared/InterLogo'
import { Bell } from 'lucide-react'

// Inner component so it can access WalletContext
function WalletApp() {
  const { screen, account } = useWallet()
  const address = account?.address
  const [activeTab, setActiveTab] = useState<NavTab>('home')
  const [sendOpen, setSendOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  // Live transactions (fetched at app level so notifications work on every tab)
  const { transactions } = useArcTransactions(address)
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications(transactions)

  const isUnlocked = screen === 'unlocked'

  const handleNavigate = (target: string) => {
    if (target === 'activity') setActiveTab('activity')
    if (target === 'assets') setActiveTab('assets')
    if (target === 'settings') setActiveTab('settings')
  }

  if (!isUnlocked) {
    return (
      <AnimatePresence mode="wait">
        {screen === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LandingScreen />
          </motion.div>
        )}
        {screen === 'create-mnemonic' && (
          <motion.div key="create" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <CreateMnemonicScreen />
          </motion.div>
        )}
        {screen === 'verify-mnemonic' && (
          <motion.div key="verify" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <VerifyMnemonicScreen />
          </motion.div>
        )}
        {screen === 'import-wallet' && (
          <motion.div key="import" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <ImportWalletScreen />
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <div className="relative min-h-dvh">
      {/* Global top bar — logo left, bell + avatar right */}
      <header
        className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(240,249,255,0.90)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(6,182,212,0.12)',
        }}
      >
        {/* Logo + wordmark */}
        <div className="flex items-center gap-2.5">
          <InterLogo size={28} />
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            inter
          </span>
        </div>

        {/* Bell + avatar */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex items-center justify-center rounded-2xl p-2 transition-all hover:bg-black/5"
            aria-label="Notifications"
          >
            <Bell className="size-5" style={{ color: 'var(--muted)' }} />
            {unreadCount > 0 && (
              <span
                className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
                style={{ background: 'var(--accent-light)' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Wallet avatar — cyan gradient */}
          <div
            className="flex size-8 items-center justify-center rounded-2xl text-xs font-bold text-white"
            style={{ background: 'var(--accent-gradient)' }}
          >
            {address ? address.slice(2, 4).toUpperCase() : 'IW'}
          </div>
        </div>
      </header>

      {/* Notification panel */}
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllRead={markAllRead}
        onClearAll={clearAll}
      />

      {/* Page content — offset for fixed header */}
      <div className="pt-14">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <DashboardScreen
                onNavigate={handleNavigate}
                onShowSend={() => setSendOpen(true)}
                onShowReceive={() => setReceiveOpen(true)}
                transactions={transactions}
              />
            </motion.div>
          )}
          {activeTab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ActivityScreen transactions={transactions} />
            </motion.div>
          )}
          {activeTab === 'assets' && (
            <motion.div
              key="assets"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <AssetsScreen />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SettingsScreen />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />

      {/* Sheets */}
      <SendSheet open={sendOpen} onClose={() => setSendOpen(false)} />
      <ReceiveSheet open={receiveOpen} onClose={() => setReceiveOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <WalletApp />
    </WalletProvider>
  )
}
