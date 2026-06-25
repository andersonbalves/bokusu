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
}))
