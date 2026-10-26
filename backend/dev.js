import { ensureLocalEnvironment, configuration, envPath } from './config.js';
import { ensureLocalMongo } from './local-mongo.js';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createConnection } from 'node:net';
import { readFileSync, watch } from 'node:fs';
import { parseEnv } from 'node:util';
import { once } from 'node:events';
import { storageTarget } from './database.js';

const root = resolve(import.meta.dirname, '..');
const children = new Set();
const expectedExits = new WeakSet();
let stopping = false;
let backend;
let fileWatcher;
let restartTimer;
const environment = () => ({ ...process.env, ...parseEnv(readFileSync(envPath, 'utf8')) });
function launch(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, env: environment(), stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.once('error', error => { console.error(error.message); shutdown(1); });
  child.once('exit', code => {
    children.delete(child);
    if (!stopping && !expectedExits.has(child)) shutdown(code || 0);
  });
  return child;
}
const listening = port => new Promise(resolvePromise => {
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.setTimeout(1000);
  socket.once('connect', () => { socket.destroy(); resolvePromise(true); });
  socket.once('error', () => { socket.destroy(); resolvePromise(false); });
  socket.once('timeout', () => { socket.destroy(); resolvePromise(false); });
});
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  fileWatcher?.close(); clearTimeout(restartTimer);
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1500).unref();
}
process.on('SIGINT', () => shutdown()); process.on('SIGTERM', () => shutdown());
async function startBackend() {
  const config = configuration(environment());
  await ensureLocalMongo(config.mongoUri, { enabled: environment().LOCAL_MONGO !== 'false' });
  backend = launch([resolve(import.meta.dirname, 'server.js')], import.meta.dirname);
  for (let attempt = 0; attempt < 80; attempt++) {
    if (stopping) return;
    try { const response = await fetch(`http://127.0.0.1:${config.port}/api/health`); if (response.ok) return; } catch { /* Backend is starting. */ }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  }
  throw new Error('Backend startup failed; see the error above.');
}
try {
  ensureLocalEnvironment();
  const config = configuration(environment());
  if (await listening(config.port)) {
    const response = await fetch(`http://127.0.0.1:${config.port}/api/health`);
    const status = await response.json();
    if (!response.ok || status.service !== 'xavinex-api') throw new Error(`Port ${config.port} is used by another service.`);
    if (status.connectionId !== storageTarget(config.mongoUri).connectionId) throw new Error(`The API on port ${config.port} is connected to a different database than backend/.env. Restart the terminal running that API, then run npm run dev again.`);
    console.log(`Reusing running Xavinex API on port ${config.port}.`);
  } else {
    await startBackend();
    const watched = new Set(['.env', 'server.js', 'app.js', 'auth.js', 'database.js', 'dates.js', 'service.js', 'validation.js', 'config.js']);
    let restarting = false;
    let restartRequested = false;
    fileWatcher = watch(import.meta.dirname, (_event, filename) => {
      if (!watched.has(String(filename))) return;
      clearTimeout(restartTimer);
      restartTimer = setTimeout(async () => {
        if (stopping) return;
        if (restarting) { restartRequested = true; return; }
        restarting = true;
        try {
          do {
          restartRequested = false;
          console.log('Backend configuration/source changed; restarting API.');
          expectedExits.add(backend);
          const exited = once(backend, 'exit'); backend.kill('SIGTERM'); await exited;
          await startBackend();
          } while (restartRequested && !stopping);
        } catch (error) { console.error(error.message); shutdown(1); }
        finally { restarting = false; }
      }, 300);
    });
  }
  if (process.argv.includes('--api-only')) console.log(`API ready at http://127.0.0.1:${config.port}.`);
  else if (await listening(3000)) console.log('Frontend already listening on port 3000. Open http://localhost:3000.');
  else {
    launch([resolve(root, 'xavinex-management/node_modules/vite/bin/vite.js'), '--port', '3000', '--host', '127.0.0.1', '--strictPort'], resolve(root, 'xavinex-management'));
    console.log('Open http://localhost:3000. Frontend and backend are managed by this command.');
  }
} catch (error) { console.error(error.message); shutdown(1); }
