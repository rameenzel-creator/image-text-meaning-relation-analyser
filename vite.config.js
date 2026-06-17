import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({

  plugins: [react()],
  server: {
    proxy: {
      '/nvidia-api': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nvidia-api/, ''),
        timeout: 600000, // 10 minutes timeout for slow agent thinking processes
        proxyTimeout: 600000,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.error('Vite Proxy Error:', err);
          });
        }
      }
    }
  }
})
