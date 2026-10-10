/**
 * Resolves a .arc / .circle name to an EVM address.
 * Debounces the lookup so we only call the API after the user pauses typing.
 * Re-resolves immediately before any send — callers must use the returned
 * `resolveNow()` function right before constructing a transaction.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { isArcNSName, resolveArcNSName } from '../utils/arcns'

export type ArcNSState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'resolved'; address: `0x${string}`; name: string }
  | { status: 'not_found'; hint: string }
  | { status: 'error'; hint: string }

const DEBOUNCE_MS = 600

export function useArcNSResolution(input: string) {
  const [state, setState] = useState<ArcNSState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  const isName = isArcNSName(input)

  // Debounced resolution on input change — syncs with external ArcNS API
  /* oxlint-disable-next-line react/set-state-in-effect */
  useEffect(() => {
    if (!isName) {
      /* oxlint-disable-next-line react/set-state-in-effect */
      setState({ status: 'idle' })
      return
    }

    /* oxlint-disable-next-line react/set-state-in-effect */
    setState({ status: 'resolving' })

    const timer = setTimeout(() => void (async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        const result = await resolveArcNSName(input, ctrl.signal)
        if (ctrl.signal.aborted) return

        if (result.status === 'ok') {
          setState({ status: 'resolved', address: result.address, name: result.name })
        } else if (result.status === 'not_found') {
          setState({ status: 'not_found', hint: result.hint })
        } else {
          setState({ status: 'error', hint: result.hint })
        }
      } catch (err) {
        if (ctrl.signal.aborted) return
        setState({ status: 'error', hint: err instanceof Error ? err.message : 'Resolution failed' })
      }
    })(), DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [input, isName])

  /**
   * Re-resolve immediately — call this right before constructing a transaction.
   * Never rely on cached state for the final address.
   */
  const resolveNow = useCallback(async (): Promise<`0x${string}` | null> => {
    if (!isArcNSName(input)) return null
    try {
      const result = await resolveArcNSName(input)
      if (result.status === 'ok') return result.address
    } catch {
      // fall through
    }
    return null
  }, [input])

  return { state, isName, resolveNow }
}
