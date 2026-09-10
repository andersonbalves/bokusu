/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'flask-integration',
      buildStart() {
        // vitest loads this config; deleting Flask build artifacts on every test run is destructive
        if (process.env.VITEST || process.env.NODE_ENV === 'test') return
        const assetsDir = path.resolve(__dirname, '../pikaraoke/static/assets')
        if (fs.existsSync(assetsDir)) {
          fs.rmSync(assetsDir, { recursive: true, force: true })
        }
      },
      closeBundle() {
        const src = path.resolve(__dirname, '../pikaraoke/static/index.html')
        const dest = path.resolve(__dirname, '../pikaraoke/templates/index.html')
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.renameSync(src, dest)
        }
      }
    }
  ],
  base: command === 'build' ? '/static/' : '/',
  build: {
    outDir: '../pikaraoke/static',
    emptyOutDir: false, // não apagar os outros assets do Flask
    rollupOptions: {
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5555',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5555',
        ws: true,
      },
      '/stream': {
        target: 'http://127.0.0.1:5555',
        changeOrigin: true,
      },
    },
  },
}))
