/**
 * Secure Client-Side Vault Encryption
 * Uses standard Web Crypto API (AES-GCM 256-bit + PBKDF2 with SHA-256 and 100,000 iterations).
 * Encrypted vault is persisted in localStorage.
 * Private keys / seed phrases are never saved in plaintext.
 */

export interface VaultData {
  address: `0x${string}`
  mnemonic?: string
  privateKey?: string
}

export interface EncryptedPayload {
  version: 1
  address: `0x${string}`
  isMnemonic: boolean
  salt: string // hex
  iv: string   // hex
  ciphertext: string // hex
}

const VAULT_STORAGE_KEY = 'inter_wallet_vault_v1'

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

async function deriveKey(pinOrPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pinOrPassword),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptVault(data: VaultData, pinOrPassword: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pinOrPassword, salt)

  const enc = new TextEncoder()
  const plaintext = enc.encode(JSON.stringify(data))

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  )

  const payload: EncryptedPayload = {
    version: 1,
    address: data.address,
    isMnemonic: Boolean(data.mnemonic),
    salt: bufferToHex(salt),
    iv: bufferToHex(iv),
    ciphertext: bufferToHex(ciphertext),
  }

  return JSON.stringify(payload)
}

export async function decryptVault(payloadStr: string, pinOrPassword: string): Promise<VaultData> {
  const payload = JSON.parse(payloadStr) as EncryptedPayload
  if (payload.version !== 1) {
    throw new Error('Unsupported vault version')
  }

  const salt = hexToBuffer(payload.salt)
  const iv = hexToBuffer(payload.iv)
  const ciphertext = hexToBuffer(payload.ciphertext)

  const key = await deriveKey(pinOrPassword, salt)

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )

    const dec = new TextDecoder()
    return JSON.parse(dec.decode(decrypted)) as VaultData
  } catch {
    throw new Error('Incorrect PIN or password')
  }
}

export function hasStoredVault(): boolean {
  try {
    return Boolean(localStorage.getItem(VAULT_STORAGE_KEY))
  } catch {
    return false
  }
}

export function getStoredVaultMetadata(): { address: `0x${string}`; isMnemonic: boolean } | null {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw) as EncryptedPayload
    return { address: payload.address, isMnemonic: payload.isMnemonic }
  } catch {
    return null
  }
}

export async function saveVault(data: VaultData, pinOrPassword: string): Promise<void> {
  const encrypted = await encryptVault(data, pinOrPassword)
  localStorage.setItem(VAULT_STORAGE_KEY, encrypted)
}

export async function unlockStoredVault(pinOrPassword: string): Promise<VaultData> {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY)
  if (!raw) throw new Error('No wallet found')
  return decryptVault(raw, pinOrPassword)
}

export function clearStoredVault(): void {
  try {
    localStorage.removeItem(VAULT_STORAGE_KEY)
  } catch {}
}
