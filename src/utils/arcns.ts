/**
 * ArcNS resolution utilities.
 * Uses the public ArcNS REST adapter — no API key, no SDK, no ABI required.
 * Docs: https://arcname.services/developers/integrate
 */

const ARCNS_API = 'https://arcname.services/api/v1'

export type ArcNSResolution =
  | { status: 'ok'; name: string; address: `0x${string}`; owner: string | null; expiry: number | null; source: 'subgraph' | 'rpc' }
  | { status: 'not_found'; hint: string }
  | { status: 'error'; code: string; hint: string }

export type ArcNSReverseResolution =
  | { status: 'ok'; address: string; name: string; verified: true; source: 'subgraph' | 'rpc' }
  | { status: 'not_found'; address: string; name: null; verified: false; hint: string }
  | { status: 'error'; code: string; hint: string }

/** Returns true if the string looks like a .arc or .circle name */
export function isArcNSName(value: string): boolean {
  const v = value.trim().toLowerCase()
  return (v.endsWith('.arc') || v.endsWith('.circle')) && v.length > 4
}

/**
 * Resolve an ArcNS name to an EVM address.
 * Re-resolves immediately before transaction construction per ArcNS safety guidelines.
 */
export async function resolveArcNSName(
  name: string,
  signal?: AbortSignal,
): Promise<ArcNSResolution> {
  const normalized = name.trim().toLowerCase()
  const res = await fetch(
    `${ARCNS_API}/resolve/name/${encodeURIComponent(normalized)}`,
    { headers: { Accept: 'application/json' }, signal },
  )
  return res.json() as Promise<ArcNSResolution>
}

/**
 * Resolve an EVM address to its verified primary ArcNS name.
 * Only returns a name when forward-confirmation passes (verified: true).
 */
export async function resolveArcNSAddress(
  address: string,
  signal?: AbortSignal,
): Promise<ArcNSReverseResolution> {
  const res = await fetch(
    `${ARCNS_API}/resolve/address/${encodeURIComponent(address)}`,
    { headers: { Accept: 'application/json' }, signal },
  )
  return res.json() as Promise<ArcNSReverseResolution>
}
