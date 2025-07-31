import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react', '@sqlite.org/sqlite-wasm'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',  // Cambia 3000 por el puerto de tu backend Express
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
