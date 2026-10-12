import { useState } from 'react'
import { WalletProvider, useWallet } from './context/WalletContext'
import { LandingScreen } from './components/onboarding/LandingScreen'
import { CreateMnemonicScreen } from './components/onboarding/CreateMnemonicScreen'
import { VerifyMnemonicScreen } from './components/onboarding/VerifyMnemonicScreen'
import { ImportWalletScreen } from './components/onboarding/ImportWalletScreen'
import { SetupPinScreen } from './components/onboarding/SetupPinScreen'
import { UnlockScreen } from './components/onboarding/UnlockScreen'
import { DashboardScreen } from './components/wallet/DashboardScreen'
import { ActivityScreen } from './components/wallet/ActivityScreen'
import { AssetsScreen } from './components/wallet/AssetsScreen'
import { SettingsScreen } from './components/wallet/SettingsScreen'
import { AnsScreen } from './components/wallet/AnsScreen'
import { SwapScreen } from './components/wallet/SwapScreen'
import { SendSheet } from './components/wallet/SendSheet'
import { ReceiveSheet } from './components/wallet/ReceiveSheet'
import { NotificationPanel } from './components/wallet/NotificationPanel'
import { BottomNav, type NavTab } from './components/wallet/BottomNav'
import { AnimatePresence, motion } from 'framer-motion'
import { useArcTransactions } from './hooks/useArcTransactions'
import { useNotifications } from './hooks/useNotifications'
import { useArcNSPrimaryName } from './hooks/useArcNSPrimaryName'
import { InterLogo } from './components/shared/InterLogo'
import { WalletIdenticon } from './components/shared/WalletIdenticon'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { Bell, PanelRight } from 'lucide-react'

// Inner component so it can access WalletContext
function WalletApp() {
  const { screen, account } = useWallet()
  const address = account?.address
  const [activeTab, setActiveTab] = useState<NavTab>('home')
  const [sendOpen, setSendOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  // Live transactions (fetched at app level so notifications work on every tab)
  const { transactions, isLoading: txLoading, isError: txError } = useArcTransactions(address)
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications(transactions)
  // Resolve the user's primary ANS name for the header avatar tooltip
  const { primaryName } = useArcNSPrimaryName(address)

  const isUnlocked = screen === 'unlocked'

  const handleNavigate = (target: string) => {
    if (target === 'activity') setActiveTab('activity')
    if (target === 'assets') setActiveTab('assets')
    if (target === 'settings') setActiveTab('settings')
    if (target === 'ans') setActiveTab('ans')
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
        {screen === 'setup-pin' && (
          <motion.div key="setup-pin" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <SetupPinScreen />
          </motion.div>
        )}
        {screen === 'unlock' && (
          <motion.div key="unlock" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <UnlockScreen />
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

        {/* Bell + Sidepanel + avatar */}
        <div className="flex items-center gap-2">
          {/* Side panel toggle button for Chrome Extension */}
          {typeof window !== 'undefined' && Boolean((window as unknown as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime?.id) && (
            <button
              onClick={() => {
                try {
                  const c = (window as unknown as { chrome?: { runtime?: { sendMessage?: (msg: unknown) => void } } }).chrome
                  c?.runtime?.sendMessage?.({ action: 'OPEN_SIDEPANEL' })
                  setTimeout(() => window.close(), 150)
                } catch {
                  // ignore if not supported
                }
              }}
              className="flex items-center justify-center rounded-2xl p-2 transition-all hover:bg-black/5"
              title="Open in Chrome Side Panel"
              aria-label="Open in Chrome Side Panel"
            >
              <PanelRight className="size-5" style={{ color: 'var(--muted)' }} />
            </button>
          )}

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

          {/* Wallet avatar — deterministic identicon from address */}
          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center justify-center rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.97]"
            title={primaryName ?? address ?? ''}
          >
            {address ? (
              <WalletIdenticon address={address} size={32} />
            ) : (
              <div
                className="flex h-8 min-w-[32px] items-center justify-center rounded-2xl px-2 text-xs font-bold text-white"
                style={{ background: 'var(--accent-gradient)' }}
              >
                IW
              </div>
            )}
          </button>
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
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ErrorBoundary fallbackTitle="Dashboard Error">
                <DashboardScreen
                  onNavigate={handleNavigate}
                  onShowSend={() => setSendOpen(true)}
                  onShowReceive={() => setReceiveOpen(true)}
                  transactions={transactions}
                  isLoading={txLoading}
                />
              </ErrorBoundary>
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
              <ErrorBoundary fallbackTitle="Activity Error">
                <ActivityScreen
                  transactions={transactions}
                  isLoading={txLoading}
                  isError={txError}
                />
              </ErrorBoundary>
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
              <ErrorBoundary fallbackTitle="Assets Error">
                <AssetsScreen />
              </ErrorBoundary>
            </motion.div>
          )}
          {activeTab === 'swap' && (
            <motion.div
              key="swap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ErrorBoundary fallbackTitle="Swap Error">
                <SwapScreen />
              </ErrorBoundary>
            </motion.div>
          )}
          {activeTab === 'ans' && (
            <motion.div
              key="ans"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ErrorBoundary fallbackTitle="ArcNS Error">
                <AnsScreen />
              </ErrorBoundary>
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
              <ErrorBoundary fallbackTitle="Settings Error">
                <SettingsScreen />
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />

      {/* Sheets */}
      <ErrorBoundary fallbackTitle="Send Sheet Error">
        <SendSheet open={sendOpen} onClose={() => setSendOpen(false)} />
      </ErrorBoundary>
      <ErrorBoundary fallbackTitle="Receive Sheet Error">
        <ReceiveSheet open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      </ErrorBoundary>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Inter Wallet Encountered an Issue">
      <WalletProvider>
        <WalletApp />
      </WalletProvider>
    </ErrorBoundary>
  )
}
