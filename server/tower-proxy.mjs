import { createServer } from 'node:http'

const CHAINS = new Set([5042, 5042002, 8453, 84532])
const METHODS = new Set([
  'eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_getBalance', 'eth_getCode',
  'eth_getTransactionCount', 'eth_estimateGas', 'eth_gasPrice', 'eth_maxPriorityFeePerGas',
  'eth_getBlockByNumber', 'eth_getTransactionReceipt', 'eth_getTransactionByHash',
  'eth_sendRawTransaction', 'eth_getLogs', 'eth_feeHistory',
])

// The key stays in this process. The browser only gets RPC results or swap calldata.
export function towerMiddleware({ apiKey, allowedOrigins = [], sameOrigin = false }) {
  const requests = new Map()
  let active = 0
  const waiting = []
  async function upstreamRequest(url, options) {
    if (waiting.length >= 64) throw new Error('Tower request queue is full')
    if (active >= 4) await new Promise(resolve => waiting.push(resolve))
    else active++
    try { return await fetch(url, options) }
    finally { const next = waiting.shift(); if (next) next(); else active-- }
  }
  return async (req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (!path.startsWith('/api/tower/')) {
      if (next) { next(); return }
      send(404, { error: 'Not found' }); return
    }
    function send(status, body) {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const origin = req.headers.origin
    let localOrigin = false
    try { localOrigin = sameOrigin && !!origin && new URL(origin).host === req.headers.host } catch { return send(403, { error: 'Invalid origin' }) }
    if (origin && !allowedOrigins.includes(origin) && !localOrigin) return send(403, { error: 'Origin not allowed' })
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    if (path === '/api/tower/health' && req.method === 'GET') return send(200, { configured: !!apiKey })
    if (!apiKey) return send(503, { error: 'Tower connection is not configured on the server.' })
    if (req.method !== 'POST') return send(405, { error: 'POST required' })
    const now = Date.now()
    if (requests.size > 1000) for (const [key, entry] of requests) if (entry.reset <= now) requests.delete(key)
    const ip = req.socket.remoteAddress ?? 'local'
    const entry = requests.get(ip)
    const limit = entry && entry.reset > now ? entry : { count: 0, reset: now + 60_000 }
    requests.set(ip, limit)
    if (++limit.count > 240) return send(429, { error: 'Too many requests. Try again shortly.' })
    try {
      // Vercel parses req.body; Vite and the standalone Node server stream it.
      let body = req.body === undefined ? '' : typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      if (req.body === undefined) {
        for await (const chunk of req) {
          body += chunk
          if (body.length > 128_000) return send(413, { error: 'Request too large' })
        }
      }
      if (body.length > 128_000) return send(413, { error: 'Request too large' })
      const payload = JSON.parse(body)
      const rpc = path.match(/^\/api\/tower\/rpc\/(\d+)$/)
      let upstream
      if (rpc && CHAINS.has(Number(rpc[1]))) {
        const calls = Array.isArray(payload) ? payload : [payload]
        if (calls.length === 0 || calls.length > 20 || calls.some(call => !call || call.jsonrpc !== '2.0' ||
          !METHODS.has(call.method) || (call.params !== undefined && !Array.isArray(call.params)))) return send(400, { error: 'Invalid RPC request' })
        // viem omits params for zero-argument methods; Tower requires an array.
        for (const call of calls) call.params ??= []
        upstream = `/rpc/${rpc[1]}`
      } else if (path === '/api/tower/swap/quote') {
        if (!['USDC', 'EURC'].includes(payload.inputToken) || !['USDC', 'EURC'].includes(payload.outputToken) ||
          ![5042, 5042002].includes(payload.chainId) || !/^\d+$/.test(payload.inputAmount)) return send(400, { error: 'Invalid swap quote' })
        upstream = '/swap/quote'
      } else if (path === '/api/tower/swap/build-tx') {
        if (!/^0x[0-9a-fA-F]{40}$/.test(payload.userAddress) || !payload.quote) return send(400, { error: 'Invalid swap build request' })
        upstream = '/swap/build-tx'
      } else return send(404, { error: 'Unsupported Tower operation' })
      const response = await upstreamRequest(`https://www.tower.exchange/api/public${upstream}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(25_000),
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) return send(502, { error: 'Tower rejected the server credential. Check its API scopes.' })
      send(response.status, result)
    } catch (error) {
      send(error instanceof SyntaxError ? 400 : 502, { error: error instanceof SyntaxError ? 'Invalid JSON' : 'Tower request failed. Please retry tracking before submitting again.' })
    }
  }
}

export function startTowerServer() {
  const middleware = towerMiddleware({ apiKey: process.env.TOWER_API_KEY,
    allowedOrigins: (process.env.TOWER_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean) })
  return createServer((req, res) => { void middleware(req, res) }).listen(Number(process.env.TOWER_PORT ?? 8787), '0.0.0.0')
}
