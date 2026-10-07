/**
 * Client-side wallet key management utilities.
 * Private keys and seed phrases NEVER leave the browser.
 * All sensitive data is stored encrypted in sessionStorage (cleared on tab close).
 */

import { mnemonicToAccount, generateMnemonic, english, privateKeyToAccount } from 'viem/accounts'
import type { PrivateKeyAccount, HDAccount } from 'viem/accounts'

export type ArcWalletAccount = PrivateKeyAccount | HDAccount

const SESSION_KEY = 'arcwallet_session'

export interface WalletSession {
  address: `0x${string}`
  // mnemonic stored only in memory, never persisted to localStorage
}

/** Generate a new 12-word BIP-39 mnemonic */
export function generateWalletMnemonic(): string {
  return generateMnemonic(english, 128) // 128 bits = 12 words
}

/** Derive account from mnemonic */
export function accountFromMnemonic(mnemonic: string): HDAccount {
  return mnemonicToAccount(mnemonic)
}

/** Derive account from hex private key */
export function accountFromPrivateKey(privateKey: string): PrivateKeyAccount {
  const hex = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  return privateKeyToAccount(hex as `0x${string}`)
}

/** Validate a hex private key */
export function isValidPrivateKey(key: string): boolean {
  try {
    const hex = key.startsWith('0x') ? key.slice(2) : key
    if (hex.length !== 64) return false
    if (!/^[0-9a-fA-F]+$/.test(hex)) return false
    accountFromPrivateKey(key)
    return true
  } catch {
    return false
  }
}

/** Validate a BIP-39 mnemonic */
export function isValidMnemonic(phrase: string): boolean {
  try {
    const words = phrase.trim().split(/\s+/)
    if (words.length !== 12 && words.length !== 24) return false
    accountFromMnemonic(phrase.trim())
    return true
  } catch {
    return false
  }
}

/** Store session address in sessionStorage (no keys stored) */
export function persistSession(address: `0x${string}`): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ address }))
}

/** Load session from sessionStorage */
export function loadSession(): WalletSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WalletSession
  } catch {
    return null
  }
}

/** Clear session (lock wallet) */
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

/** Format an address for display */
export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Validate an Ethereum address */
export function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

/** Parse onchain error into user-friendly message */
export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || (error as { code?: number })?.code === 4001) {
    return 'Transaction cancelled.'
  }
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
    return 'Insufficient balance. Please add funds and try again.'
  }
  if (msg.includes('reverted')) {
    const m = msg.match(/reason="([^"]+)"/)
    return m ? `Transaction failed: ${m[1]}` : 'Transaction failed. Please try again.'
  }
  if (msg.includes('network') || msg.includes('timeout')) {
    return 'Network error. Please check your connection and try again.'
  }
  if (msg.includes('nonce')) {
    return 'Transaction nonce error. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}
