// noinspection JSUnusedGlobalSymbols

import { defineConfig, loadEnv } from 'vite';
import * as react from '@vitejs/plugin-react';
import * as path from 'path';

export const viteConfig = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react.default({
        // Add React Fast Refresh options
        fastRefresh: true,
      }),
    ],
    server: {
      port: parseInt(env.VITE_APP_PORT || '3000', 10),
      proxy: {
        '/graphql': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
        },
      },
      // Improve HMR configuration
      hmr: {
        overlay: true,
        timeout: 2000,
      },
      // Watch for changes in the entire project
      watch: {
        usePolling: false,
        interval: 100,
      },
      // Enable Open by default
      open: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Add optimizeDeps for faster updates
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@apollo/client'],
      exclude: [],
    },
    // Add build optimizations
    build: {
      sourcemap: true,
      minify: 'terser',
      target: 'esnext',
    },
  };
});

// eslint-disable-next-line import/no-default-export
export default viteConfig;
