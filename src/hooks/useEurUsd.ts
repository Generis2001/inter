/**
 * useEurUsd — live EUR/USD exchange rate from the open.er-api.com free endpoint.
 * Refreshes every 60 seconds. Falls back to 1.08 if the request fails.
 */
import { useState, useEffect, useRef } from 'react'

const FALLBACK_RATE = 1.08
const REFRESH_MS    = 60_000
const API_URL       = 'https://open.er-api.com/v6/latest/EUR'

export function useEurUsd(): { rate: number; loading: boolean } {
  const [rate, setRate]       = useState<number>(FALLBACK_RATE)
  const [loading, setLoading] = useState(true)
  const timeoutRef            = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchRate = () => {
      void fetch(API_URL)
        .then((r) => r.json() as Promise<{ rates?: { USD?: number } }>)
        .then((data) => {
          if (!cancelled && typeof data?.rates?.USD === 'number') {
            setRate(data.rates.USD)
          }
        })
        .catch(() => {
          // keep fallback rate on error
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
          if (!cancelled) {
            timeoutRef.current = setTimeout(fetchRate, REFRESH_MS)
          }
        })
    }

    fetchRate()

    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { rate, loading }
}
