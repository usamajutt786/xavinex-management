import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createBackendRecovery } from './devBackend.ts';

export default defineConfig(() => {
  const envPath = path.resolve(import.meta.dirname, '../backend/.env');
  // Read only server proxy settings. Loading backend NODE_ENV through Vite's loadEnv
  // would accidentally produce development React bundles in a production build.
  const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
  const target = env.API_PROXY_TARGET || `http://127.0.0.1:${env.PORT || 4000}`;
  const targetUrl = new URL(target);
  const autoStart = process.env.DISABLE_BACKEND_AUTOSTART !== 'true' && env.DISABLE_BACKEND_AUTOSTART !== 'true'
    && ['127.0.0.1', 'localhost'].includes(targetUrl.hostname) && Number(targetUrl.port || 80) === Number(env.PORT || 4000);
  const recovery = createBackendRecovery({
    backendDirectory: path.resolve(import.meta.dirname, '../backend'),
    healthUrl: `${targetUrl.origin}/api/health`,
    log: message => console.log(message),
  });
  return {
    plugins: [react(), tailwindcss(), {
      name: 'xavinex-backend-recovery',
      configureServer(server) {
        if (!autoStart) return;
        server.httpServer?.once('listening', () => void recovery.start());
        server.httpServer?.once('close', () => recovery.stop());
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      strictPort: true,
      proxy: { '/api': {
        target,
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            if (autoStart) void recovery.start();
            if ('writeHead' in response && !response.headersSent) {
              response.writeHead(503, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: { message: autoStart ? 'The backend is starting or reconnecting. Please retry shortly.' : 'The backend is unavailable. Run npm run dev from the project folder, then retry.' } }));
            }
          });
        },
      } },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
