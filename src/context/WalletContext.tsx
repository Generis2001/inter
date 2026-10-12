/**
 * ArcWallet Context — manages wallet lifecycle:
 * create, import, lock/unlock, PIN security & encrypted vault persistence.
 * Private keys and mnemonics live ONLY in React state (memory) while unlocked,
 * and encrypted with AES-256-GCM via PBKDF2 using the user's PIN/password in localStorage.
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
import {
  hasStoredVault,
  getStoredVaultMetadata,
  saveVault,
  unlockStoredVault,
  clearStoredVault,
  type VaultData,
} from '../utils/vault'

export type WalletScreen =
  | 'landing'
  | 'create-mnemonic'
  | 'verify-mnemonic'
  | 'import-wallet'
  | 'setup-pin'
  | 'unlock'
  | 'unlocked'

interface WalletContextValue {
  screen: WalletScreen
  account: ArcWalletAccount | null
  mnemonic: string | null
  storedAddress: `0x${string}` | null
  // Actions
  startCreateWallet: () => void
  confirmMnemonic: (words: string[]) => boolean
  importFromMnemonic: (phrase: string) => boolean
  importFromPrivateKey: (key: string) => boolean
  finalizeWalletWithPin: (pinOrPassword: string) => Promise<void>
  unlockWithPin: (pinOrPassword: string) => Promise<void>
  resetWallet: () => void
  lockWallet: () => void
  setScreen: (s: WalletScreen) => void
  // For verify & setup step
  pendingMnemonic: string | null
  pendingAccount: ArcWalletAccount | null
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Check if a vault already exists on this device
  const initialMeta = getStoredVaultMetadata()
  const [screen, setScreen] = useState<WalletScreen>(initialMeta ? 'unlock' : 'landing')
  const [account, setAccount] = useState<ArcWalletAccount | null>(null)
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [storedAddress, setStoredAddress] = useState<`0x${string}` | null>(initialMeta?.address ?? null)

  const [pendingMnemonic, setPendingMnemonic] = useState<string | null>(null)
  const [pendingPrivateKey, setPendingPrivateKey] = useState<string | null>(null)
  const [pendingAccount, setPendingAccount] = useState<ArcWalletAccount | null>(null)

  // Start creating new wallet: generate mnemonic & derive account
  const startCreateWallet = useCallback(() => {
    const newMnemonic = generateWalletMnemonic()
    const newAccount = accountFromMnemonic(newMnemonic)
    setPendingMnemonic(newMnemonic)
    setPendingPrivateKey(null)
    setPendingAccount(newAccount)
    setScreen('create-mnemonic')
  }, [])

  // Verify mnemonic words: on success, advance to PIN setup
  const confirmMnemonic = useCallback(
    (words: string[]): boolean => {
      if (!pendingMnemonic || !pendingAccount) return false
      const correct = pendingMnemonic.trim().split(/\s+/)
      const matches = words.every((w, i) => w.trim().toLowerCase() === correct[i]?.toLowerCase())
      if (!matches) return false
      // Advance to PIN setup before unlocking
      setScreen('setup-pin')
      return true
    },
    [pendingMnemonic, pendingAccount],
  )

  // Import via mnemonic: advance to PIN setup
  const importFromMnemonic = useCallback((phrase: string): boolean => {
    try {
      const cleanPhrase = phrase.trim()
      const acc = accountFromMnemonic(cleanPhrase)
      setPendingMnemonic(cleanPhrase)
      setPendingPrivateKey(null)
      setPendingAccount(acc)
      setScreen('setup-pin')
      return true
    } catch {
      return false
    }
  }, [])

  // Import via private key: advance to PIN setup
  const importFromPrivateKey = useCallback((key: string): boolean => {
    try {
      const cleanKey = key.trim()
      const acc = accountFromPrivateKey(cleanKey)
      setPendingMnemonic(null)
      setPendingPrivateKey(cleanKey)
      setPendingAccount(acc)
      setScreen('setup-pin')
      return true
    } catch {
      return false
    }
  }, [])

  // Finalize wallet creation/import with 6-digit PIN or password
  const finalizeWalletWithPin = useCallback(
    async (pinOrPassword: string): Promise<void> => {
      if (!pendingAccount) {
        throw new Error('No pending account found to secure')
      }

      const vaultData: VaultData = {
        address: pendingAccount.address,
        mnemonic: pendingMnemonic ?? undefined,
        privateKey: pendingPrivateKey ?? undefined,
      }

      await saveVault(vaultData, pinOrPassword)

      // Unlock active state
      setAccount(pendingAccount)
      setMnemonic(pendingMnemonic)
      setStoredAddress(pendingAccount.address)
      persistSession(pendingAccount.address)

      // Clear pending
      setPendingMnemonic(null)
      setPendingPrivateKey(null)
      setPendingAccount(null)

      setScreen('unlocked')
    },
    [pendingAccount, pendingMnemonic, pendingPrivateKey],
  )

  // Unlock with stored PIN or password
  const unlockWithPin = useCallback(async (pinOrPassword: string): Promise<void> => {
    const data = await unlockStoredVault(pinOrPassword)
    let acc: ArcWalletAccount
    if (data.mnemonic) {
      acc = accountFromMnemonic(data.mnemonic)
      setMnemonic(data.mnemonic)
    } else if (data.privateKey) {
      acc = accountFromPrivateKey(data.privateKey)
      setMnemonic(null)
    } else {
      throw new Error('Corrupted vault data')
    }

    setAccount(acc)
    setStoredAddress(data.address)
    persistSession(data.address)
    setScreen('unlocked')
  }, [])

  // Lock wallet: wipe keys from memory, return to unlock screen
  const lockWallet = useCallback(() => {
    setAccount(null)
    setMnemonic(null)
    setPendingMnemonic(null)
    setPendingPrivateKey(null)
    setPendingAccount(null)
    clearSession()
    if (hasStoredVault()) {
      setScreen('unlock')
    } else {
      setScreen('landing')
    }
  }, [])

  // Reset wallet: delete stored vault completely and return to landing
  const resetWallet = useCallback(() => {
    clearStoredVault()
    clearSession()
    setAccount(null)
    setMnemonic(null)
    setStoredAddress(null)
    setPendingMnemonic(null)
    setPendingPrivateKey(null)
    setPendingAccount(null)
    setScreen('landing')
  }, [])

  return (
    <WalletContext.Provider
      value={{
        screen,
        account,
        mnemonic,
        storedAddress,
        startCreateWallet,
        confirmMnemonic,
        importFromMnemonic,
        importFromPrivateKey,
        finalizeWalletWithPin,
        unlockWithPin,
        resetWallet,
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
