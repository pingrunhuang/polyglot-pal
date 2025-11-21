import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    },
    define: {
      // We still keep this if you want to access API_KEY in frontend, 
      // but ideally you should move completely to backend environment variables.
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})