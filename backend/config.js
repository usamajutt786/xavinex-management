import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

export const backendDirectory = import.meta.dirname;
export const envPath = resolve(backendDirectory, '.env');

export function ensureLocalEnvironment() {
  if (!existsSync(envPath)) {
    const example = readFileSync(resolve(backendDirectory, '.env.example'), 'utf8');
    writeFileSync(envPath, example, { mode: 0o600, flag: 'wx' });
    console.log('Created backend/.env. Register using your email and password in the application.');
  }
  loadEnvFile(envPath);
}
if (existsSync(envPath)) loadEnvFile(envPath);

export function configuration(env = process.env) {
  const port = Number(env.PORT || 4000);
  const sessionHours = Number(env.SESSION_HOURS || 12);
  const production = env.NODE_ENV === 'production';
  const origin = env.APP_ORIGIN || 'http://localhost:3000';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  if (!Number.isFinite(sessionHours) || sessionHours <= 0 || sessionHours > 168) throw new Error('SESSION_HOURS must be between 0 and 168');
  const url = new URL(origin);
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('APP_ORIGIN must be an exact http(s) origin without a trailing slash');
  if (production && url.protocol !== 'https:') throw new Error('Production requires an HTTPS APP_ORIGIN');
  if (production && !env.MONGODB_URI) throw new Error('Production requires MONGODB_URI');
  return { port, sessionHours, production, origin, host: env.HOST || '127.0.0.1', mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27018/xavinex_management?replicaSet=xavinex-local' };
}
