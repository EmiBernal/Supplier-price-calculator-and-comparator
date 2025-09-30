import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_URL ? env.VITE_API_URL.replace(/\/$/, '') : undefined;

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react', '@sqlite.org/sqlite-wasm'],
    },
    server: apiProxyTarget
      ? {
          proxy: {
            '/api': {
              target: apiProxyTarget,
              changeOrigin: true,
              secure: false,
            },
          },
        }
      : undefined,
  };
});
