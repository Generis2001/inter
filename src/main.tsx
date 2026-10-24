/*
 *  ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗
 *  ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
 *  ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 *  ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝
 *
 *  Built with Arc Studio
 *  https://studio.arc.io
 */

import './tracing'
import './console-capture'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { Toaster } from 'sonner'
import { config } from './config'
import App from './App'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import './index.css'

const queryClient = new QueryClient()

// Apply stored or system-preferred theme before React renders (prevents FOUC)
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('inter_theme')
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const theme = (stored === 'dark' || stored === 'light') ? stored : (prefersDark ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', theme)
}

// Auto-detect Chrome extension popup mode (under 500px in extension context)
if (typeof window !== 'undefined') {
  const isExtension = window.location.protocol.includes('extension') || Boolean((window as unknown as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime?.id)
  const isPopup = isExtension && window.innerWidth < 500 && !window.location.search.includes('full')
  if (isPopup) {
    document.documentElement.classList.add('is-extension-popup')
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Inter Wallet Startup Error">
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider>
            <App />
            <Toaster position="top-center" />
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </StrictMode>,
)

