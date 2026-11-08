import { defineConfig, loadEnv, type Plugin } from 'vite'
// @ts-expect-error The Node middleware is shared with the standalone server.
import { towerMiddleware } from './server/tower-proxy.mjs'
// @ts-expect-error Shared Node build helper.
import { syncExtensionBuild } from './scripts/sync-extension.mjs'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

function extensionSyncPlugin(): Plugin {
  let buildDir = ''
  let root = ''
  let installedDir = ''
  return {
    name: 'inter-extension-sync',
    apply: 'build',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, 'INTER_EXTENSION_')
      buildDir = path.resolve(config.root, config.build.outDir)
      root = config.root
      installedDir = env.INTER_EXTENSION_DIR ?? ''
    },
    writeBundle() {
      syncExtensionBuild(buildDir, path.join(root, 'unpacked-extension'))
      if (installedDir) syncExtensionBuild(buildDir, installedDir, { requireExisting: true })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), nodePolyfills(), {
    name: 'inter-tower-proxy',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), 'TOWER_')
      server.middlewares.use(towerMiddleware({
        apiKey: process.env.TOWER_API_KEY ?? env.TOWER_API_KEY,
        sameOrigin: true,
        allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173', ...(env.TOWER_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)],
      }))
    },
  }, extensionSyncPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'wagmi',
      'wagmi/chains',
      'wagmi/connectors',
      'viem',
      'viem/chains',
      'connectkit',
      'framer-motion',
      'lucide-react',
      'sonner',
      'clsx',
      'tailwind-merge',
      'vite-plugin-node-polyfills/shims/buffer',
      'vite-plugin-node-polyfills/shims/global',
      'vite-plugin-node-polyfills/shims/process',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    cors: true,
  },
})
