import { http } from 'viem'

const proxyBase = (import.meta.env.VITE_TOWER_PROXY_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const towerUrl = (path: string) => `${proxyBase}/api/tower${path}`
export const towerTransport = (chainId: number) => http(towerUrl(`/rpc/${chainId}`), { timeout: 30_000, retryCount: 0 })

export async function towerRequest<T>(path: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(towerUrl(path), {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: signal ?? AbortSignal.timeout(30_000),
  })
  const json = await response.json() as T & { error?: string; message?: string; success?: boolean }
  if (!response.ok || json.success === false) throw new Error(json.error ?? json.message ?? 'Tower is unavailable. Please try again.')
  return json
}
