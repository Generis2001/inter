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
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ address }))
  } catch {
    // sessionStorage might be restricted in some extension contexts or iframes
  }
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
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}

/** Format an address for display */
export function formatAddress(addr: string | null | undefined): string {
  if (!addr || typeof addr !== 'string' || addr.length < 10) {
    return typeof addr === 'string' ? addr : ''
  }
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Validate an Ethereum address */
export function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

/** Parse onchain error into user-friendly message */
export function parseOnchainError(error: unknown): string {
  const rawMsg = (error as { message?: string })?.message ?? String(error)
  const msg = rawMsg.toLowerCase()

  if (msg.includes('user rejected') || (error as { code?: number })?.code === 4001) {
    return 'Transaction cancelled.'
  }

  // Insufficient gas / account balance exceeds error on Arc (USDC is gas token)
  if (
    msg.includes('exceeds the balance') ||
    msg.includes('exceeds balance') ||
    msg.includes('total cost (gas * gas fee + value)') ||
    msg.includes('pay for the total gas') ||
    msg.includes('insufficient funds for gas') ||
    msg.includes('insufficient funds for intrinsic transaction cost') ||
    msg.includes('intrinsic gas too low') ||
    msg.includes('insufficient gas') ||
    msg.includes('insufficient funds')
  ) {
    return 'insufficient gas (USDC)'
  }

  if (msg.includes('reverted')) {
    const m = rawMsg.match(/reason="([^"]+)"/)
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
