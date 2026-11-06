import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import express from 'express';
import deploymentApp, { createDeploymentApp } from './app.js';
import { testDatabase, disposeTestDatabase } from './test-database.js';
import { createUser } from './auth.js';
import { createApp } from './app.js';

test('Vercel default export is an Express application and shares one initialization across cold requests', async () => {
  assert.equal(typeof deploymentApp, 'function'); assert.equal(typeof deploymentApp.use, 'function');
  let starts = 0;
  const handler = createDeploymentApp(async () => {
    starts++;
    await new Promise(resolve => setTimeout(resolve, 20));
    const app = express(); app.get('/api/health', (req, res) => res.json({ status: 'ok' })); return app;
  });
  const server = createServer(handler).listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/health`;
    const responses = await Promise.all([fetch(url), fetch(url), fetch(url)]);
    assert.ok(responses.every(response => response.status === 200));
    assert.equal(starts, 1);
    assert.equal((await fetch(url)).status, 200); assert.equal(starts, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('a failed Vercel cold start returns safe JSON and can recover on a later request', async () => {
  let starts = 0;
  const handler = createDeploymentApp(async () => {
    if (++starts === 1) throw new Error('sensitive connection detail');
    const app = express(); app.get('/api/health', (req, res) => res.json({ status: 'ok' })); return app;
  });
  const server = createServer(handler).listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/health`;
    const failed = await fetch(url); assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await failed.text(), /sensitive connection detail/);
    assert.equal((await fetch(url)).status, 200); assert.equal(starts, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Vercel wrapper supports production cookie login, authenticated data and logout', async () => {
  const db = await testDatabase();
  const password = 'Vercel-session-password-123!';
  await createUser(db, { email: 'vercel@example.com', name: 'Deployment Test', password, role: 'admin' });
  const handler = createDeploymentApp(async () => createApp(db, { production: true, origin: 'https://xavinex-management.vercel.app', logging: false }));
  const server = createServer(handler).listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://xavinex-management.vercel.app' }, body: JSON.stringify({ email: 'vercel@example.com', password }) });
    assert.equal(login.status, 200);
    const cookieHeader = login.headers.get('set-cookie');
    assert.match(cookieHeader, /Secure/); assert.match(cookieHeader, /HttpOnly/); assert.match(cookieHeader, /SameSite=Strict/);
    assert.doesNotMatch(cookieHeader, /Domain=/i);
    const cookie = cookieHeader.split(';')[0], { csrfToken } = await login.json();
    assert.equal((await fetch(base + '/api/state', { headers: { Cookie: cookie } })).status, 200);
    const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken, Origin: 'https://xavinex-management.vercel.app' } });
    assert.equal(logout.status, 200);
    assert.equal((await fetch(base + '/api/state', { headers: { Cookie: cookie } })).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); await disposeTestDatabase(db); }
});

test('frontend Vercel rewrite preserves API paths and disables API caching', async () => {
  const config = JSON.parse(await readFile(new URL('../xavinex-management/vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.framework, 'vite'); assert.equal(config.outputDirectory, 'dist');
  assert.deepEqual(config.rewrites[0], { source: '/api/:path*', destination: 'https://backend-eosin-zeta-63.vercel.app/api/:path*' });
  assert.ok(config.headers[0].headers.every(header => header.value.includes('no-store')));
});
