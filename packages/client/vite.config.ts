// noinspection JSUnusedGlobalSymbols

import { defineConfig, loadEnv } from 'vite';
import * as react from '@vitejs/plugin-react';
import * as path from 'path';

export const viteConfig = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react.default()],
    server: {
      port: parseInt(env.VITE_APP_PORT || '3000', 10),
      proxy: {
        '/graphql': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});

// eslint-disable-next-line import/no-default-export
export default viteConfig;
