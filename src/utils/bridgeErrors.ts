interface BridgeError {
  name?: string
  message?: string
  shortMessage?: string
  status?: number
  cause?: unknown
}

function errorChain(error: unknown): BridgeError[] {
  const rows: BridgeError[] = []
  const seen = new Set<unknown>()
  while (error && typeof error === 'object' && !seen.has(error) && rows.length < 12) {
    seen.add(error)
    const row = error as BridgeError
    rows.push(row)
    error = row.cause
  }
  return rows
}

export function bridgeConnectionError(error: unknown): BridgeError | undefined {
  return errorChain(error).find(row => row.name === 'HttpRequestError' || row.name === 'TimeoutError' ||
    /failed to fetch|fetch failed|network request failed/i.test(row.message ?? ''))
}

/** Preserve the HTTP status without exposing viem's URL or signed request dump. */
export function bridgeErrorMessage(error: unknown): string {
  const connection = bridgeConnectionError(error)
  if (connection) {
    if (connection.status === 429) return 'Bridge service is busy (HTTP 429). Wait briefly, then refresh.'
    if (connection.status === 401 || connection.status === 403) return `Bridge service access was rejected (HTTP ${connection.status}).`
    if (connection.status && connection.status >= 500) return `Bridge service is temporarily unavailable (HTTP ${connection.status}).`
    if (connection.status) return `Bridge request failed (HTTP ${connection.status}).`
    return connection.name === 'TimeoutError' ? 'Bridge connection timed out.' : 'Bridge connection was interrupted.'
  }
  const rows = errorChain(error)
  const reverted = rows.find(row => row.name === 'ContractFunctionRevertedError')
  const message = reverted?.shortMessage ?? rows[0]?.shortMessage ?? rows[0]?.message
  return message?.split('\n')[0].trim().slice(0, 240) || 'Bridge request failed. Please refresh and try again.'
}

export function savedBridgeError(error: unknown, transaction: 'approval' | 'bridge' | 'receiving transaction'): string {
  return `${bridgeErrorMessage(error)} Your signed ${transaction} is saved. Checking confirmation; use Refresh bridge to check its status.`
}
