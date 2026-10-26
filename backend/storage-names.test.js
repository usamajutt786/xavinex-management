import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { companyDatabaseName, legacyCompanyDatabaseName, readState } from './database.js';
import { registerUser } from './auth.js';
import { createApp } from './app.js';
import { testDatabase, disposeTestDatabase } from './test-database.js';

test('company database names fit the Atlas 38-byte limit and remain distinct across installations', () => {
  const id = randomUUID();
  for (const base of ['xavinex_management', 'a'.repeat(63), '会社'.repeat(20)]) {
    const name = companyDatabaseName(base, id);
    assert.equal(Buffer.byteLength(name), 37);
    assert.match(name, /^xv_c_[a-f0-9]{32}$/);
    assert.equal(companyDatabaseName(base, id), name);
    assert.notEqual(companyDatabaseName(base + 'other', id), name);
    assert.notEqual(companyDatabaseName(base, randomUUID()), name);
  }
});

test('workspace API repairs a failed Atlas provisioning mapping and loads successfully after login', async () => {
  const db = await testDatabase();
  let server;
  try {
    const password = 'Atlas-name-regression-123!';
    const user = await registerUser(db, { email: 'atlas-name@example.com', password, companyName: 'Atlas Name Test' });
    const legacy = legacyCompanyDatabaseName(db.mongo.databaseName, user.companyId);
    await db.collection('companies').updateOne({ _id: user.companyId }, { $set: { databaseName: legacy } });
    db.deployment = 'atlas'; // Exercise the same compatibility path with isolated local data.
    server = createApp(db, { logging: false }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password }) });
    assert.equal(login.status, 200);
    const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
    const response = await fetch(base + '/state', { headers });
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.deepEqual(state.accounts, []); assert.ok(state.settings.exchangeRates.PKR > 0);
    assert.equal((await db.collection('companies').findOne({ _id: user.companyId })).databaseName, companyDatabaseName(db.mongo.databaseName, user.companyId));
    assert.equal((await fetch(base + '/state', { headers })).status, 200);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await disposeTestDatabase(db);
  }
});

test('existing legacy databases are preserved and never silently replaced with empty storage', async t => {
  const db = await testDatabase();
  try {
    if (db.deployment === 'atlas') { t.skip('Atlas rejects the oversized legacy database fixture; preservation is tested against local MongoDB.'); return; }
    const companyId = randomUUID();
    const legacy = legacyCompanyDatabaseName(db.mongo.databaseName, companyId);
    await db.collection('companies').insertOne({ _id: companyId, name: 'Existing company', databaseName: legacy, active: true });
    await db.client.db(legacy).collection('accounts').insertOne({ _id: 'retained', id: 'retained', name: 'Retained record', _order: 1 });
    db.deployment = 'atlas';
    await assert.rejects(db.forCompany(companyId), error => error.status === 503 && /preserved/.test(error.message));
    assert.equal((await db.collection('companies').findOne({ _id: companyId })).databaseName, legacy);
    db.deployment = 'replica-set';
    const scoped = await db.forCompany(companyId);
    assert.equal(scoped.mongo.databaseName, legacy);
    assert.equal((await readState(scoped)).accounts[0].id, 'retained');
  } finally { await disposeTestDatabase(db); }
});
