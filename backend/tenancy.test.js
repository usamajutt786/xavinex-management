import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { collections, readState, openDatabase } from './database.js';
import { hashPassword, digest } from './auth.js';
import { testDatabase, disposeTestDatabase, testUri } from './test-database.js';

const password = 'Company-security-password-123!';
const day = '2026-10-25';
async function fixture() {
  const db = await testDatabase();
  const server = createApp(db, { logging: false, loginLimit: 100, rateLimit: 10000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (session, path, method = 'GET', data, headers = {}) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken } : {}), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const ok = async (session, path, method = 'GET', data, status = 200, headers) => {
    const result = await call(session, path, method, data, headers);
    assert.equal(result.status, status, JSON.stringify(result.body)); return result.body;
  };
  const register = async email => {
    const result = await call(null, '/auth/register', 'POST', { email, password, companyName: 'Same company name' });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return { ...result.body, cookie: result.cookie };
  };
  const login = async (email, pass = password) => {
    const result = await call(null, '/auth/login', 'POST', { email, password: pass });
    assert.equal(result.status, 200, JSON.stringify(result.body)); return { ...result.body, cookie: result.cookie };
  };
  return { db, server, call, ok, register, login, close: async () => { await new Promise(resolve => server.close(resolve)); await disposeTestDatabase(db); } };
}

test('companies have separate MongoDB databases and cannot read, mutate, export or reset each other’s records', async () => {
  const f = await fixture();
  const { db, call, ok, register } = f;
  try {
    const a = await register('isolation-a@example.com'), b = await register('isolation-b@example.com');
    assert.notEqual(a.user.companyId, b.user.companyId);
    assert.equal(a.user.role, 'admin'); assert.equal(b.user.role, 'admin');
    const aDb = await db.forCompany(a.user.companyId), bDb = await db.forCompany(b.user.companyId);
    assert.notEqual(aDb.mongo.databaseName, bDb.mongo.databaseName);
    const create = async (path, data, headers) => (await ok(a, path, 'POST', data, 201, headers)).data;
    const account = (name, type, currency = 'USD') => ({ name, type, currency, status: 'active', openingBalance: 0 });
    const bank = await create('/accounts', account('Private Bank', 'bank', 'PKR'));
    const origin = await create('/accounts', account('Private Fiverr', 'fiverr'), { 'Idempotency-Key': 'same-key-across-companies' });
    const destination = await create('/accounts', account('Private Payoneer', 'payoneer'));
    const client = await create('/clients', { name: 'Private Client', linkedFiverrAccountId: origin.id, status: 'active' });
    const project = await create('/projects', { name: 'Private Project', clientId: client.id, budget: 1000, currency: 'USD', bookingDate: day, status: 'in_progress' });
    await create('/payments', { clientId: client.id, projectId: project.id, receivingAccountId: origin.id, paymentRoute: 'fiverr', currency: 'USD', paymentDate: day, paymentAmount: 100, actualCreditedAmount: 80 });
    await create('/transfers', { sourceAccountId: origin.id, destinationAccountId: destination.id, transferDate: day, sourceAmount: 200, destinationCreditedAmount: 195 });
    await create('/transfers', { sourceAccountId: destination.id, destinationAccountId: bank.id, transferDate: day, sourceAmount: 100, destinationCreditedAmount: 27850 });
    await create('/expenses', { title: 'Private Expense', category: 'Other Expenses', amount: 100, currency: 'PKR', date: day, payingAccountId: bank.id });
    await ok(a, '/accounts/' + bank.id + '/adjustments', 'POST', { newBalance: 27000, reason: 'Private adjustment', date: day });
    await ok(a, '/settings', 'PATCH', { exchangeRates: { USD: 1, PKR: 300, EUR: 0.9, GBP: 0.8 } });
    const snapshot = await ok(a, '/state');
    for (const name of collections) {
      assert.ok(snapshot[name].length, `${name} is populated for company A`);
      assert.equal((await ok(b, '/' + name)).total, 0);
      assert.deepEqual((await ok(b, '/' + name + '?companyId=' + a.user.companyId)).items, []);
      for (const row of snapshot[name]) assert.equal((await call(b, '/' + name + '/' + row.id)).status, 404);
      assert.equal(await bDb.collection(name).countDocuments({}), 0);
      assert.equal(await aDb.collection(name).countDocuments({}), snapshot[name].length);
    }
    assert.equal((await call(b, '/accounts/' + origin.id + '/ledger')).status, 404);
    for (const name of ['accounts', 'clients', 'projects']) {
      const id = snapshot[name][0].id;
      assert.equal((await call(b, '/' + name + '/' + id, 'PATCH', { name: 'Hijacked' })).status, 404);
      assert.equal((await call(b, '/' + name + '/' + id, 'DELETE')).status, 404);
    }
    assert.equal((await call(b, '/payments', 'POST', { clientId: client.id, projectId: project.id, receivingAccountId: origin.id, paymentRoute: 'fiverr', currency: 'USD', paymentDate: day, paymentAmount: 1, actualCreditedAmount: 1 })).status, 404);
    assert.equal((await call(b, '/transfers', 'POST', { sourceAccountId: origin.id, destinationAccountId: destination.id, transferDate: day, sourceAmount: 1, destinationCreditedAmount: 1 })).status, 404);
    assert.equal((await call(b, '/expenses', 'POST', { title: 'Hijack', category: 'Other Expenses', amount: 1, currency: 'PKR', date: day, payingAccountId: bank.id })).status, 404);
    assert.equal((await call(b, '/accounts/' + bank.id + '/adjustments', 'POST', { newBalance: 0, reason: 'Hijack', date: day })).status, 404);
    assert.equal((await call(b, '/expenses/' + snapshot.expenses[0].id, 'DELETE')).status, 404);
    for (const route of ['/reports', '/analytics']) {
      const report = await ok(b, route + '?clientId=' + client.id);
      assert.equal(report.bookedUSD, 0); assert.equal(report.collectedUSD, 0); assert.deepEqual(report.transactions, []);
    }
    assert.notEqual((await ok(b, '/settings')).exchangeRates.PKR, 300);
    const backup = await ok(b, '/backup');
    for (const name of collections) assert.deepEqual(backup[name], []);
    assert.equal((await ok(b, '/database/status')).databaseName, bDb.mongo.databaseName);
    const users = await ok(b, '/users'); assert.deepEqual(users.map(user => user.id), [b.user.id]);
    assert.equal((await call(b, '/users/' + a.user.id, 'PATCH', { role: 'viewer' })).status, 404);
    assert.equal((await call(b, '/users', 'POST', { email: 'forged@example.com', name: 'Forged', password, role: 'admin', companyId: a.user.companyId })).status, 422);
    assert.ok((await ok(b, '/audit')).every(row => row.companyId === b.user.companyId));
    assert.equal((await call(b, '/state', 'GET', undefined, { 'X-Company-ID': a.user.companyId })).status, 401);
    const bAccount = (await ok(b, '/accounts', 'POST', account('Private Fiverr', 'fiverr'), 201, { 'Idempotency-Key': 'same-key-across-companies' })).data;
    assert.notEqual(bAccount.id, origin.id);
    // Restoring a guessed ID into B must never overwrite that ID in A's database.
    const ownBackup = await ok(b, '/backup'); ownBackup.accounts[0].id = origin.id;
    await ok(b, '/restore', 'POST', ownBackup);
    await ok(b, '/accounts/' + origin.id, 'PATCH', { name: 'B owns a separate record with this ID' });
    await ok(b, '/data', 'DELETE', { confirm: 'DELETE ALL BUSINESS DATA' });
    assert.deepEqual(await ok(a, '/state'), snapshot);
    assert.deepEqual(await readState(aDb), snapshot);
  } finally { await f.close(); }
});

test('company roles, session revocation, company binding, logout and password changes are enforced', async () => {
  const f = await fixture();
  const { db, call, ok, register, login } = f;
  try {
    const a = await register('role-owner@example.com'), b = await register('role-other@example.com');
    assert.equal((await call(null, '/state')).status, 401);
    assert.equal((await call(null, '/auth/register', 'POST', { email: 'missing-company@example.com', password })).status, 422);
    assert.equal((await call(null, '/auth/register', 'POST', { email: 'empty-company@example.com', password, companyName: '   ' })).status, 422);
    assert.equal((await call(null, '/auth/login', 'POST', { email: a.user.email, password: 'incorrect' })).status, 401);
    assert.equal((await call(a, '/accounts', 'POST', {}, { 'X-CSRF-Token': 'wrong' })).status, 403);
    const viewer = await ok(a, '/users', 'POST', { name: 'Viewer', email: 'company-viewer@example.com', password, role: 'viewer' }, 201);
    const operator = await ok(a, '/users', 'POST', { name: 'Operator', email: 'company-operator@example.com', password, role: 'operator' }, 201);
    assert.equal(viewer.companyId, a.user.companyId); assert.equal(operator.companyId, a.user.companyId);
    const v = await login(viewer.email), o = await login(operator.email);
    await ok(v, '/state');
    const account = { name: 'Role Bank', type: 'bank', currency: 'USD', openingBalance: 0, status: 'active' };
    for (const [path, method, data] of [['/accounts', 'POST', account], ['/settings', 'PATCH', {}], ['/restore', 'POST', {}], ['/data', 'DELETE', { confirm: 'DELETE ALL BUSINESS DATA' }], ['/users', 'POST', {}]]) assert.equal((await call(v, path, method, data)).status, 403);
    await ok(o, '/accounts', 'POST', account, 201);
    assert.equal((await call(o, '/users')).status, 403);
    assert.equal((await call(o, '/settings', 'PATCH', {})).status, 403);
    await ok(a, '/users/' + operator.id, 'PATCH', { active: false });
    assert.equal((await call(o, '/state')).status, 401);
    const session = await db.collection('sessions').findOne({ userId: b.user.id });
    await db.collection('sessions').updateOne({ _id: session._id }, { $set: { companyId: a.user.companyId } });
    assert.equal((await call(b, '/state')).status, 401);
    const another = await login(a.user.email);
    assert.notEqual(another.cookie, a.cookie);
    await ok(a, '/auth/password', 'POST', { currentPassword: password, newPassword: 'New-company-password-123!' });
    assert.equal((await call(a, '/state')).status, 401); assert.equal((await call(another, '/state')).status, 401);
    const fresh = await login(a.user.email, 'New-company-password-123!');
    await ok(fresh, '/auth/logout', 'POST', {});
    assert.equal((await call(fresh, '/state')).status, 401);
    assert.equal(await db.collection('sessions').countDocuments({ _id: digest(fresh.cookie.split('=')[1]) }), 0);
  } finally { await f.close(); }
});

test('legacy migration preserves original records for the first administrator and isolates other legacy users', async () => {
  let db = await testDatabase();
  const databaseName = db.mongo.databaseName;
  try {
    const passwordHash = await hashPassword(password);
    await db.collection('users').insertMany([
      { _id: 'old-admin', id: 'old-admin', name: 'Owner', email: 'old-owner@example.com', passwordHash, role: 'admin', active: true, createdAt: '2026-01-01' },
      { _id: 'old-viewer', id: 'old-viewer', name: 'Other', email: 'old-other@example.com', passwordHash, role: 'viewer', active: true, createdAt: '2026-01-02' },
    ]);
    await db.collection('accounts').insertOne({ _id: 'preserved', id: 'preserved', name: 'Original funds', currentBalance: 10, _order: 1 });
    await db.collection('sessions').insertOne({ _id: 'old-session', userId: 'old-viewer', expiresAt: new Date(Date.now() + 3600000) });
    await db.close(); db = await openDatabase(testUri, { databaseName });
    const owner = await db.collection('users').findOne({ _id: 'old-admin' });
    const other = await db.collection('users').findOne({ _id: 'old-viewer' });
    assert.notEqual(owner.companyId, other.companyId);
    assert.equal((await readState(await db.forCompany(owner.companyId))).accounts[0].id, 'preserved');
    assert.deepEqual((await readState(await db.forCompany(other.companyId))).accounts, []);
    assert.equal(await db.collection('sessions').countDocuments({}), 0);
    const companyCount = await db.collection('companies').countDocuments({});
    await db.close(); db = await openDatabase(testUri, { databaseName });
    assert.equal(await db.collection('companies').countDocuments({}), companyCount);
  } finally { await disposeTestDatabase(db); }
});
