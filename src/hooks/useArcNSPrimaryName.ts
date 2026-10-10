/**
 * Resolves a wallet address to its verified primary ArcNS name.
 * Used to display the user's .arc / .circle name in the header and receive screen.
 */
import { useState, useEffect } from 'react'
import { resolveArcNSAddress } from '../utils/arcns'

export function useArcNSPrimaryName(address: `0x${string}` | undefined) {
  const [primaryName, setPrimaryName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Syncs with external ArcNS API — setState-in-effect is intentional here
  /* oxlint-disable-next-line react/set-state-in-effect */
  useEffect(() => {
    if (!address) {
      /* oxlint-disable-next-line react/set-state-in-effect */
      setPrimaryName(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    resolveArcNSAddress(address)
      .then((result) => {
        if (cancelled) return
        if (result.status === 'ok') {
          setPrimaryName(result.name)
        } else {
          setPrimaryName(null)
        }
      })
      .catch(() => {
        if (!cancelled) setPrimaryName(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [address])

  return { primaryName, isLoading }
}
