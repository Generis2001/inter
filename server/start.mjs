import { startTowerServer } from './tower-proxy.mjs'
startTowerServer()
console.log('Inter Tower proxy listening on port', process.env.TOWER_PORT ?? 8787)
