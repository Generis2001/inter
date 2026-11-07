import { towerMiddleware } from '../../server/tower-proxy.mjs'

// Vercel deploys this function alongside the static Vite app. Same-origin web
// calls need no public proxy URL; native/extension builds use the site's origin.
const middleware = towerMiddleware({
  apiKey: process.env.TOWER_API_KEY,
  sameOrigin: true,
  allowedOrigins: (process.env.TOWER_ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean),
})

export default async function handler(req, res) { await middleware(req, res) }
