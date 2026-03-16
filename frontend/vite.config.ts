import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRODUCTION_API_URL = 'https://aksr-crm.vercel.app/api';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = mode === 'production' ? PRODUCTION_API_URL : (env.VITE_API_URL || 'http://localhost:3001/api');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: env.VITE_BASE_PATH || '/',
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['lucide-react', 'date-fns'],
          },
        },
      },
    },
  };
});
