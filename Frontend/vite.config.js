import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: []
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    }
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['framer-motion'],
          pdf: ['jspdf'],
        }
      }
    },
    sourcemap: false,
    cssMinify: true,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true
      }
    }
  },
  preview: {
    port: 3000
  }
})
