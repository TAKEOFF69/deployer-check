import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Exclude Vercel serverless functions from Vite processing
  build: {
    rollupOptions: {
      external: [/^api\//]
    }
  },
  server: {
    hmr: {
      overlay: false
    },
    proxy: {
      '/api/fairscale': {
        target: 'https://api.fairscale.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fairscale/, ''),
      },
    }
  }
})
