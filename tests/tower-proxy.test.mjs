import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { towerMiddleware } from '../server/tower-proxy.mjs'

async function request(middleware, path, body, origin = 'https://inter.example') {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
  Object.assign(req, { url: path, method: body === undefined ? 'GET' : 'POST', headers: { origin }, socket: { remoteAddress: '127.0.0.1' } })
  let status; let result
  const res = { setHeader() {}, writeHead(code) { status = code }, end(value) { result = JSON.parse(value ?? '{}') } }
  await middleware(req, res)
  return { status, result }
}

test('proxy normalizes viem zero-argument calls and keeps the Tower secret on the server', async () => {
  const original = globalThis.fetch
  let upstream
  globalThis.fetch = async (url, options) => { upstream = { url, options }; return Response.json({ jsonrpc: '2.0', id: 1, result: '0x13b2' }) }
  try {
    const middleware = towerMiddleware({ apiKey: 'test-only-secret', allowedOrigins: ['https://inter.example'] })
    const response = await request(middleware, '/api/tower/rpc/5042', { jsonrpc: '2.0', id: 1, method: 'eth_chainId' })
    assert.equal(response.status, 200)
    assert.deepEqual(JSON.parse(upstream.options.body).params, [])
    assert.equal(upstream.options.headers.Authorization, 'Bearer test-only-secret')
    assert.ok(!JSON.stringify(response).includes('test-only-secret'))
  } finally { globalThis.fetch = original }
})

test('proxy rejects unlisted chains, server signing, and unapproved origins', async () => {
  const middleware = towerMiddleware({ apiKey: 'fixture', allowedOrigins: ['https://inter.example'] })
  const rpc = { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }
  assert.equal((await request(middleware, '/api/tower/rpc/1', rpc)).status, 404)
  assert.equal((await request(middleware, '/api/tower/rpc/5042', { ...rpc, method: 'eth_sendTransaction' })).status, 400)
  assert.equal((await request(middleware, '/api/tower/rpc/5042', rpc, 'https://unapproved.example')).status, 403)
  assert.equal((await request(middleware, '/api/tower/health')).result.configured, true)
})

test('proxy accepts Vercel parsed request bodies', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json({ jsonrpc: '2.0', id: 1, result: '0x13b2' })
  try {
    const middleware = towerMiddleware({ apiKey: 'fixture', sameOrigin: true })
    const req = Readable.from([])
    Object.assign(req, { url: '/api/tower/rpc/5042', method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId' },
      headers: { origin: 'https://inter.example', host: 'inter.example' }, socket: { remoteAddress: '127.0.0.1' } })
    let status
    const res = { setHeader() {}, writeHead(code) { status = code }, end() {} }
    await middleware(req, res)
    assert.equal(status, 200)
  } finally { globalThis.fetch = original }
})
