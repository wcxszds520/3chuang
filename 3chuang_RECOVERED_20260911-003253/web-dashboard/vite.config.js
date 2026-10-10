import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Preserved independent review entries already use native top-level await.
  esbuild: { supported: { 'top-level-await': true } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: Object.fromEntries(['index', 'industrial-production', 'industrial-review', 'quality-review', 'rebuild-review', 'visual-acceptance'].map(name => [name, fileURLToPath(new URL(`./${name}.html`, import.meta.url))])),
      output: {
        manualChunks: {
          react: ['react', 'react-dom/client'],
          three: ['three']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.PORTCUBE_API_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  }
});
