import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { WalletProvider, useWallet } from './context/WalletContext'
import { NetworkProvider, useNetwork } from './context/NetworkContext'
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
import { ExchangeScreen } from './components/wallet/ExchangeScreen'
import { BridgeProvider } from './context/BridgeContext'
import { SendSheet } from './components/wallet/SendSheet'
import { ReceiveSheet } from './components/wallet/ReceiveSheet'
import { NotificationPanel } from './components/wallet/NotificationPanel'
import { BottomNav, type NavTab } from './components/wallet/BottomNav'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ScreenTransition } from './components/shared/ScreenTransition'
import { pageTransition } from './utils/motion'
import { useArcTransactions } from './hooks/useArcTransactions'
import { useNotifications } from './hooks/useNotifications'
import { useArcNSPrimaryName } from './hooks/useArcNSPrimaryName'
import { InterLogo } from './components/shared/InterLogo'
import { WalletIdenticon } from './components/shared/WalletIdenticon'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { Bell, PanelRight, Sun, Moon } from 'lucide-react'
import { getInitialTheme, applyTheme, type Theme } from './utils/theme'

const PAGE_ORDER: NavTab[] = ['home', 'assets', 'swap', 'bridge', 'activity', 'ans', 'settings']

// Inner component so it can access WalletContext
function WalletApp() {
  const { screen, account } = useWallet()
  const address = account?.address
  const { chainId } = useNetwork()
  const [activeTab, setActiveTab] = useState<NavTab>('home')
  const [direction, setDirection] = useState(1)
  const scrollPositions = useRef<Partial<Record<NavTab, number>>>({})
  const [sendOpen, setSendOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  // Live transactions (fetched at app level so notifications work on every tab)
  const { transactions, isLoading: txLoading, isError: txError } = useArcTransactions(address)
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications(transactions, `${chainId}:${address ?? ''}`)
  // Resolve the user primary ANS name for the header avatar tooltip
  const { primaryName } = useArcNSPrimaryName(address)

  const isUnlocked = screen === 'unlocked'

  const handleNavigate = (target: string) => {
    const next = PAGE_ORDER.find(tab => tab === target)
    if (!next || next === activeTab) return
    const popup = document.documentElement.classList.contains('is-extension-popup')
    scrollPositions.current[activeTab] = popup ? document.body.scrollTop : window.scrollY
    setDirection(PAGE_ORDER.indexOf(next) > PAGE_ORDER.indexOf(activeTab) ? 1 : -1)
    setActiveTab(next)
  }

  useLayoutEffect(() => {
    if (!isUnlocked) return
    const top = scrollPositions.current[activeTab] ?? 0
    if (document.documentElement.classList.contains('is-extension-popup')) document.body.scrollTo({ top, behavior: 'instant' })
    else window.scrollTo({ top, behavior: 'instant' })
  }, [activeTab, isUnlocked])

  if (!isUnlocked) {
    return (
      <div className="relative min-h-dvh overflow-x-clip">
        <AnimatePresence mode="popLayout" initial={false} custom={screen === 'landing' ? -1 : 1}>
          <ScreenTransition key={screen} direction={screen === 'landing' ? -1 : 1} name={screen}>
            {screen === 'landing' && <LandingScreen />}
            {screen === 'create-mnemonic' && <CreateMnemonicScreen />}
            {screen === 'verify-mnemonic' && <VerifyMnemonicScreen />}
            {screen === 'import-wallet' && <ImportWalletScreen />}
            {screen === 'setup-pin' && <SetupPinScreen />}
            {screen === 'unlock' && <UnlockScreen />}
          </ScreenTransition>
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh">
      {/* Global top bar */}
      <header
        className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--header-border)',
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

        {/* Controls: side panel + theme + bell + avatar */}
        <div className="flex items-center gap-1.5">
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

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center rounded-2xl p-2 transition-all hover:bg-black/5"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === 'dark' ? (
                <motion.span
                  key="sun"
                  initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                >
                  <Sun className="size-5" style={{ color: '#f59e0b' }} />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ opacity: 0, rotate: 30, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -30, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                >
                  <Moon className="size-5" style={{ color: 'var(--muted)' }} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

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

          {/* Wallet avatar */}
          <button
            onClick={() => handleNavigate('settings')}
            aria-label="Wallet settings"
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
        <div className="relative min-h-[calc(100dvh-56px)] overflow-x-clip">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <ScreenTransition key={activeTab === 'bridge' ? 'swap' : activeTab} direction={direction} name={activeTab}>
              {activeTab === 'home' && (
              <ErrorBoundary fallbackTitle="Dashboard Error">
                <DashboardScreen
                  onNavigate={handleNavigate}
                  onShowSend={() => setSendOpen(true)}
                  onShowReceive={() => setReceiveOpen(true)}
                  transactions={transactions}
                  isLoading={txLoading}
                />
              </ErrorBoundary>
              )}
              {activeTab === 'activity' && (
              <ErrorBoundary fallbackTitle="History Error">
                <ActivityScreen transactions={transactions} isLoading={txLoading} isError={txError} />
              </ErrorBoundary>
              )}
              {activeTab === 'assets' && (
              <ErrorBoundary fallbackTitle="Assets Error">
                <AssetsScreen onBridge={() => handleNavigate('bridge')} />
              </ErrorBoundary>
              )}
              {(activeTab === 'swap' || activeTab === 'bridge') && (
              <ErrorBoundary fallbackTitle="Swap Error">
                <ExchangeScreen mode={activeTab} onChange={handleNavigate} />
              </ErrorBoundary>
              )}
              {activeTab === 'ans' && (
              <ErrorBoundary fallbackTitle="ArcNS Error">
                <AnsScreen />
              </ErrorBoundary>
              )}
              {activeTab === 'settings' && (
              <ErrorBoundary fallbackTitle="Settings Error">
                <SettingsScreen />
              </ErrorBoundary>
              )}
            </ScreenTransition>
          </AnimatePresence>
        </div>
      </div>

      <BottomNav active={activeTab} onChange={handleNavigate} />

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
      <MotionConfig reducedMotion="user" transition={pageTransition}>
        <NetworkProvider>
          <WalletProvider>
            <BridgeProvider><WalletApp /></BridgeProvider>
          </WalletProvider>
        </NetworkProvider>
      </MotionConfig>
    </ErrorBoundary>
  )
}
