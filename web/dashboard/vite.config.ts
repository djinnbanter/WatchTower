import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fixtureApiPlugin } from './scripts/vite-fixture-api';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const liveOrigin = (process.env.WATCHTOWER_ORIGIN || env.WATCHTOWER_ORIGIN || '').replace(/\/$/, '');
  const useLiveProxy = Boolean(liveOrigin);
  const staticDemo =
    process.env.VITE_STATIC_DEMO === '1' || process.env.VITE_STATIC_DEMO === 'true';

  return {
    // Relative asset URLs so the embedded JAR can serve from any host:port root.
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      ...(useLiveProxy || staticDemo ? [] : [fixtureApiPlugin()]),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'import.meta.env.VITE_LIVE_PROXY': JSON.stringify(useLiveProxy ? '1' : '0'),
      'import.meta.env.VITE_STATIC_DEMO': JSON.stringify(staticDemo ? '1' : '0'),
    },
    build: {
      outDir: staticDemo ? 'dist-demo' : 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 8081,
      strictPort: true,
      host: '127.0.0.1',
      proxy: useLiveProxy
        ? {
            '/api': {
              target: liveOrigin,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
    preview: {
      port: 8081,
      strictPort: true,
      host: '127.0.0.1',
    },
  };
});
