/**
 * Security settings utility for Inter Wallet.
 * Manages transaction authorization requirements (e.g. 6-digit PIN for swaps and sends).
 */
import { useState, useEffect, useCallback } from 'react'

const REQUIRE_TX_PIN_KEY = 'inter_require_tx_pin'

export function getRequireTxPin(): boolean {
  try {
    return localStorage.getItem(REQUIRE_TX_PIN_KEY) === 'true'
  } catch {
    return false
  }
}

export function setRequireTxPin(enabled: boolean): void {
  try {
    localStorage.setItem(REQUIRE_TX_PIN_KEY, enabled ? 'true' : 'false')
    window.dispatchEvent(
      new CustomEvent('inter_security_settings_changed', {
        detail: { requireTxPin: enabled },
      }),
    )
  } catch {}
}

/**
 * React hook to reactively read and update the transaction PIN requirement.
 */
export function useRequireTxPin(): [boolean, (val: boolean) => void] {
  const [requirePin, setRequirePinState] = useState<boolean>(() => getRequireTxPin())

  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ requireTxPin?: boolean }>
      if (customEvent.detail && typeof customEvent.detail.requireTxPin === 'boolean') {
        setRequirePinState(customEvent.detail.requireTxPin)
      } else {
        setRequirePinState(getRequireTxPin())
      }
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === REQUIRE_TX_PIN_KEY) {
        setRequirePinState(e.newValue === 'true')
      }
    }

    window.addEventListener('inter_security_settings_changed', handleSettingsChange)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('inter_security_settings_changed', handleSettingsChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const update = useCallback((val: boolean) => {
    setRequireTxPin(val)
    setRequirePinState(val)
  }, [])

  return [requirePin, update]
}
