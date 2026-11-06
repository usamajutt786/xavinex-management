import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createBackendRecovery } from './devBackend.ts';

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.kill = () => { child.exitCode = 0; child.emit('exit', 0); };
  return child;
}
const base = { backendDirectory: '.', healthUrl: 'http://127.0.0.1:4000/api/health' };

test('an already healthy backend is reused without starting another process', async () => {
  const recovery = createBackendRecovery({ ...base, probe: async () => true, launch: () => assert.fail('Duplicate backend') });
  await recovery.start(); recovery.stop();
});

test('simultaneous offline requests start one backend and closing the frontend stops its owned launcher', async () => {
  let launches = 0;
  const child = fakeChild();
  const recovery = createBackendRecovery({ ...base, probe: async () => { throw new Error('ECONNREFUSED'); }, launch: () => { launches++; return child; } });
  await Promise.all([recovery.start(), recovery.start(), recovery.start()]);
  await recovery.start();
  assert.equal(launches, 1);
  recovery.stop();
  assert.equal(child.exitCode, 0);
  await recovery.start(); assert.equal(launches, 1);
});

test('an exited backend launcher is retried while the frontend remains open', async () => {
  const children = [];
  let restarted;
  const ready = new Promise(resolve => { restarted = resolve; });
  const recovery = createBackendRecovery({ ...base, retryDelay: 10, probe: async () => false, launch: () => {
    const child = fakeChild(); children.push(child); if (children.length === 2) restarted(); return child;
  } });
  try {
    await recovery.start(); children[0].kill();
    const timeout = setTimeout(() => restarted(), 1000);
    await ready; clearTimeout(timeout);
    assert.equal(children.length, 2);
  } finally { recovery.stop(); }
});
