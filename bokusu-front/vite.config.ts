import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'move-index-html',
      closeBundle() {
        const src = path.resolve(__dirname, '../pikaraoke/static/index.html')
        const dest = path.resolve(__dirname, '../pikaraoke/templates/index.html')
        if (fs.existsSync(src)) {
          fs.renameSync(src, dest)
        }
      }
    }
  ],
  base: '/static/',
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
  }
})
