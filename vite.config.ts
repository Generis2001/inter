import { defineConfig, loadEnv } from 'vite'
// @ts-expect-error The Node middleware is shared with the standalone server.
import { towerMiddleware } from './server/tower-proxy.mjs'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
  }],
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
