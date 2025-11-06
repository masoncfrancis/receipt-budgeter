import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Allows access from host machine
    port: 5173, // Consistent development port
    strictPort: true, // Ensures port is available or fails
    watch: {
      usePolling: true, // Necessary for file changes to be detected in Docker
      interval: 1000, // Polling interval
    },
  },
})
