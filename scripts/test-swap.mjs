import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const directory = path.resolve('node_modules/.cache/inter-tests')
await mkdir(directory, { recursive: true })
const outfile = path.join(directory, 'swap.mjs')
await build({ entryPoints: ['tests/swap-regressions.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', define: { 'import.meta.env': '{}' } })
await import(pathToFileURL(outfile).href)
