import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `npm run dev:phone` sets HTTPS=1: phones only allow camera access on https pages,
// so we serve a self-signed certificate and listen on the local network.
const https = process.env.HTTPS === '1'

export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  server: {
    host: https ? true : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        ws: true, // device cameras stream frames over a WebSocket
      },
    },
  },
})
