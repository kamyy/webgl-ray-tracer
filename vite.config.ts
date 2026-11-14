import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    // The bundled scenes are not in the repo. The dev server fetches them from the deployed site.
    proxy: {
      '/scenes': { target: 'https://webgl-ray-tracer.orky.net', changeOrigin: true },
    },
  },
})
