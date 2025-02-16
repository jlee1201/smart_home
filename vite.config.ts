import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// noinspection JSUnusedGlobalSymbols
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_APP_PORT || '3000', 10),
      proxy: {
        [env.GRAPHQL_PATH || '/graphql']: {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: resolve(__dirname, './dist/client'),
      emptyOutDir: true,
    },
    publicDir: resolve(__dirname, 'public'),
    root: resolve(__dirname, 'src/client'),
    resolve: {
      alias: {
        '@client': resolve(__dirname, 'src/client'),
      },
    },
  };
});
