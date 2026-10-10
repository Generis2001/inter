/**
 * ArcWallet Context — manages wallet lifecycle:
 * create, import, lock/unlock.
 * Private keys and mnemonics live ONLY in React state (memory).
 * Only the address is persisted (sessionStorage).
 */
import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ArcWalletAccount } from '../utils/wallet'
import {
  generateWalletMnemonic,
  accountFromMnemonic,
  accountFromPrivateKey,
  persistSession,
  clearSession,
} from '../utils/wallet'

export type WalletScreen =
  | 'landing'
  | 'create-mnemonic'
  | 'verify-mnemonic'
  | 'import-wallet'
  | 'unlocked'

interface WalletContextValue {
  screen: WalletScreen
  account: ArcWalletAccount | null
  mnemonic: string | null
  // Actions
  startCreateWallet: () => void
  confirmMnemonic: (words: string[]) => boolean
  importFromMnemonic: (phrase: string) => boolean
  importFromPrivateKey: (key: string) => boolean
  lockWallet: () => void
  setScreen: (s: WalletScreen) => void
  // For verify step
  pendingMnemonic: string | null
  pendingAccount: ArcWalletAccount | null
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<WalletScreen>('landing')
  const [account, setAccount] = useState<ArcWalletAccount | null>(null)
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [pendingMnemonic, setPendingMnemonic] = useState<string | null>(null)
  const [pendingAccount, setPendingAccount] = useState<ArcWalletAccount | null>(null)

  // Restore session on mount (only the address — keys stay in memory)
  // We can only restore the address, not the keys.
  // If no session exists, stay on landing. Keys only live in memory.
  // eslint-disable-next-line -- initial state derived from sessionStorage, not from async effect
  // (no setter call needed: useState('landing') is already the right default)

  const startCreateWallet = useCallback(() => {
    const newMnemonic = generateWalletMnemonic()
    const newAccount = accountFromMnemonic(newMnemonic)
    setPendingMnemonic(newMnemonic)
    setPendingAccount(newAccount)
    setScreen('create-mnemonic')
  }, [])

  const confirmMnemonic = useCallback(
    (words: string[]): boolean => {
      if (!pendingMnemonic || !pendingAccount) return false
      const correct = pendingMnemonic.trim().split(/\s+/)
      const matches = words.every((w, i) => w.trim().toLowerCase() === correct[i]?.toLowerCase())
      if (!matches) return false
      setAccount(pendingAccount)
      setMnemonic(pendingMnemonic)
      persistSession(pendingAccount.address)
      setPendingMnemonic(null)
      setPendingAccount(null)
      setScreen('unlocked')
      return true
    },
    [pendingMnemonic, pendingAccount],
  )

  const importFromMnemonic = useCallback((phrase: string): boolean => {
    try {
      const acc = accountFromMnemonic(phrase.trim())
      setAccount(acc)
      setMnemonic(phrase.trim())
      persistSession(acc.address)
      setScreen('unlocked')
      return true
    } catch {
      return false
    }
  }, [])

  const importFromPrivateKey = useCallback((key: string): boolean => {
    try {
      const acc = accountFromPrivateKey(key.trim())
      setAccount(acc)
      setMnemonic(null) // no mnemonic when importing via private key
      persistSession(acc.address)
      setScreen('unlocked')
      return true
    } catch {
      return false
    }
  }, [])

  const lockWallet = useCallback(() => {
    setAccount(null)
    setMnemonic(null)
    setPendingMnemonic(null)
    setPendingAccount(null)
    clearSession()
    setScreen('landing')
  }, [])

  return (
    <WalletContext.Provider
      value={{
        screen,
        account,
        mnemonic,
        startCreateWallet,
        confirmMnemonic,
        importFromMnemonic,
        importFromPrivateKey,
        lockWallet,
        setScreen,
        pendingMnemonic,
        pendingAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
