/**
 * NetworkContext — manages Arc Mainnet / Arc Testnet switching.
 * The selected network persists to localStorage and flows through the app
 * so that hooks, balance fetchers, and explorer links all use the correct chain.
 */
import React, { createContext, useContext, useState, useCallback } from 'react'
import { requireChain, type OnchainChain } from '@/onchain-facts'

export const ARC_MAINNET_ID = 5042
export const ARC_TESTNET_ID = 5042002

const STORAGE_KEY = 'inter_network_testnet'

interface NetworkContextValue {
  isTestnet: boolean
  chainId: number
  chain: OnchainChain
  toggleNetwork: () => void
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isTestnet, setIsTestnet] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const toggleNetwork = useCallback(() => {
    setIsTestnet((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  const chainId = isTestnet ? ARC_TESTNET_ID : ARC_MAINNET_ID
  const chain = requireChain(chainId)

  return (
    <NetworkContext.Provider value={{ isTestnet, chainId, chain, toggleNetwork }}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider')
  return ctx
}
