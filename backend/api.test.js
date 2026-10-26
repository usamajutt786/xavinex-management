import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase, readState, storageTarget } from './database.js';
import { testDatabase, disposeTestDatabase, testUri } from './test-database.js';
import { createUser } from './auth.js';
import { createApp } from './app.js';
import { businessDate } from './dates.js';

let db, server, base, admin;
const password = 'A-long-test-password-123!';
const day = '2026-10-25';
test('business dates use Pakistan calendar days across UTC midnight and month boundaries', () => {
  assert.equal(businessDate('2026-10-24T20:00:00.000Z'), '2026-10-25');
  assert.equal(businessDate('2026-10-31T20:00:00.000Z'), '2026-11-01');
});
const account = (name, type = 'fiverr', currency = 'USD', openingBalance = 0) => ({ name, type, currency, openingBalance, status: 'active' });
async function request(path, method = 'GET', data, session = admin, extra = {}) {
  const response = await fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}), ...extra }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const body = await response.json();
  return { status: response.status, body, headers: response.headers };
}
async function ok(path, method, input, session, expected = 200, extra) {
  const result = await request(path, method, input, session, extra);
  assert.equal(result.status, expected, JSON.stringify(result.body)); return result.body;
}
async function login(email = 'admin@example.com', pass = password) {
  const r = await request('/auth/login', 'POST', { email, password: pass }, null);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { cookie: r.headers.get('set-cookie').split(';')[0], csrf: r.body.csrfToken };
}
async function create(path, data) { return (await ok(path, 'POST', data, admin, 201)).data; }
before(async () => {
  db = await testDatabase();
  await createUser(db, { email: 'admin@example.com', name: 'Admin', password, role: 'admin' });
  server = createApp(db, { logging: false, loginLimit: 100, rateLimit: 10000 }).listen(0, '127.0.0.1');
  await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; admin = await login();
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (db) await disposeTestDatabase(db); });

test('authentication, origin checks, CSRF, malformed requests, missing routes and security headers', async () => {
  assert.equal((await request('/state', 'GET', undefined, null)).status, 401);
  assert.equal((await request('/auth/login', 'POST', { email: 'admin@example.com', password: 'wrong' }, null)).status, 401);
  const me = await ok('/auth/me'); assert.equal(me.user.role, 'admin');
  assert.equal((await request('/state', 'GET', undefined, admin, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/accounts', 'POST', account('bad'), { cookie: admin.cookie, csrf: 'bad' })).status, 403);
  assert.equal((await request('/accounts', 'POST', { ...account('bad'), currentBalance: 999 })).status, 422);
  assert.equal((await request('/accounts', 'POST', account('bad', 'bank', 'USD', -1))).status, 422);
  assert.equal((await request('/accounts', 'POST', account('bad', 'bank', 'USD', 1.234))).status, 422);
  assert.equal((await request('/missing')).status, 404);
  const health = await request('/health', 'GET', undefined, null); assert.equal(health.status, 200); assert.equal(health.headers.get('x-content-type-options'), 'nosniff'); assert.ok(health.headers.get('x-request-id'));
  const invalid = await fetch(base + '/api/accounts', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json', Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf } }); assert.equal(invalid.status, 400);
});

test('complete booking, collection, transfer, expense, reversal and ledger workflow', async () => {
  const f = await create('/accounts', account('Fiverr'));
  const p = await create('/accounts', account('Payoneer', 'payoneer'));
  const b = await create('/accounts', account('Bank PKR', 'bank', 'PKR'));
  const cash = await create('/accounts', account('Cash PKR', 'petty_cash', 'PKR'));
  const c = await create('/clients', { name: 'Acme', linkedFiverrAccountId: f.id, status: 'active', email: 'client@example.com' });
  const project = await create('/projects', { name: 'Website', clientId: c.id, budget: 1000, currency: 'USD', bookingDate: day, status: 'in_progress' });
  assert.equal(project.linkedFiverrAccountId, f.id);
  await ok('/projects/' + project.id, 'PATCH', { status: 'completed' });
  const pay = { clientId: c.id, projectId: project.id, paymentAmount: 600, currency: 'USD', paymentDate: day, receivingAccountId: f.id, paymentRoute: 'fiverr', actualCreditedAmount: 480 };
  await create('/payments', pay);
  let state = await ok('/state'); assert.equal(state.projects.find(x => x.id === project.id).paymentStatus, 'partially_paid');
  await create('/payments', { ...pay, receivingAccountId: p.id, paymentRoute: 'payoneer_direct', paymentAmount: 400, actualCreditedAmount: 390 });
  state = await ok('/state'); assert.equal(state.projects.find(x => x.id === project.id).paymentStatus, 'fully_paid');
  await create('/transfers', { sourceAccountId: f.id, destinationAccountId: p.id, transferDate: day, sourceAmount: 480, destinationCreditedAmount: 475 });
  await create('/transfers', { sourceAccountId: p.id, destinationAccountId: b.id, transferDate: day, sourceAmount: 100, destinationCreditedAmount: 27850 });
  await create('/transfers', { sourceAccountId: b.id, destinationAccountId: cash.id, transferDate: day, sourceAmount: 5000, destinationCreditedAmount: 5000 });
  const expense = await create('/expenses', { title: 'Office', category: 'Utilities and Office Operations', amount: 1500, currency: 'PKR', date: day, payingAccountId: cash.id });
  assert.equal((await ok('/accounts/' + cash.id)).currentBalance, 3500);
  await ok('/expenses/' + expense.id, 'DELETE');
  assert.equal((await ok('/accounts/' + cash.id)).currentBalance, 5000);
  assert.equal((await request('/expenses/' + expense.id, 'DELETE')).status, 404);
  await ok('/accounts/' + cash.id + '/adjustments', 'POST', { newBalance: 5100, reason: 'Cash count', date: day });
  await ok('/accounts/' + cash.id, 'PATCH', { openingBalance: 20, name: 'Office cash' });
  assert.equal((await ok('/accounts/' + cash.id)).currentBalance, 5120);
  const ledger = await ok('/accounts/' + cash.id + '/ledger');
  assert.equal(ledger.reduce((n, t) => n + t.amount, 0), 5120); assert.ok(ledger.some(t => t.type === 'reversal'));
  const r = await ok('/reports?from=2026-10-01&to=2026-10-31'); assert.equal(r.bookedUSD, 1000); assert.equal(r.collectedUSD, 1000); assert.equal(r.outstandingUSD, 0); assert.equal(r.expensesUSD, 0); assert.equal(r.monthly.length, 1);
  assert.equal((await ok('/analytics')).bookedUSD, 1000);
  assert.equal((await request('/projects/' + project.id, 'DELETE')).status, 409);
  assert.equal((await request('/clients/' + c.id, 'DELETE')).status, 409);
  assert.equal((await request('/accounts/' + f.id, 'DELETE')).status, 409);
  for (const collection of ['accounts', 'clients', 'projects', 'payments', 'transfers', 'expenses', 'adjustments', 'transactions']) {
    const list = await ok('/' + collection + '?limit=2'); assert.ok(Array.isArray(list.items)); assert.ok(list.items.length <= 2);
    if (list.items.length) assert.equal((await ok('/' + collection + '/' + list.items[0].id)).id, list.items[0].id);
    assert.equal((await request('/' + collection + '/missing')).status, 404);
  }
  assert.ok((await ok('/audit?limit=5')).length <= 5);
});

test('invalid associations, currencies, dates, overpayments and restricted routes roll back without ledger writes', async () => {
  const s = await ok('/state'), f = s.accounts.find(a => a.type === 'fiverr'), b = s.accounts.find(a => a.type === 'bank'), p = s.accounts.find(a => a.type === 'payoneer'), c = s.clients[0];
  const project = await create('/projects', { name: 'Validation', clientId: c.id, budget: 100, currency: 'USD', bookingDate: day, status: 'queued' });
  const before = await ok('/state');
  const payment = { projectId: project.id, clientId: c.id, paymentAmount: 101, actualCreditedAmount: 100, receivingAccountId: f.id, currency: 'USD', paymentDate: day, paymentRoute: 'fiverr' };
  for (const data of [payment, { ...payment, paymentAmount: 100, currency: 'PKR' }, { ...payment, paymentAmount: 100, receivingAccountId: p.id }, { ...payment, paymentAmount: 100, actualCreditedAmount: 101 }, { ...payment, paymentDate: '2026-02-30' }, { ...payment, clientId: 'missing' }]) assert.ok((await request('/payments', 'POST', data)).status >= 400);
  for (const data of [{ sourceAccountId: f.id, destinationAccountId: f.id, sourceAmount: 1, destinationCreditedAmount: 1, transferDate: day }, { sourceAccountId: b.id, destinationAccountId: p.id, sourceAmount: 1, destinationCreditedAmount: 1, transferDate: day }, { sourceAccountId: p.id, destinationAccountId: b.id, sourceAmount: 999999, destinationCreditedAmount: 1, transferDate: day }]) assert.ok((await request('/transfers', 'POST', data)).status >= 400);
  assert.equal((await request('/clients', 'POST', { name: 'Invalid', linkedFiverrAccountId: b.id, status: 'active' })).status, 422);
  assert.equal((await request('/accounts/' + b.id, 'PATCH', { currency: 'USD' })).status, 422);
  assert.equal((await request('/clients/' + c.id, 'PATCH', { linkedFiverrAccountId: p.id })).status, 422);
  assert.equal((await request('/expenses', 'POST', { title: 'Invalid', category: 'Other Expenses', amount: 1, currency: 'USD', date: day, payingAccountId: f.id })).status, 422);
  assert.deepEqual(await ok('/state'), before);
});

test('idempotency and simultaneous debits prevent duplicate records and overdrafts', async () => {
  const b = await create('/accounts', account('Concurrency', 'bank', 'USD', 10));
  const body = { title: 'Concurrent expense', category: 'Other Expenses', amount: 8, currency: 'USD', date: day, payingAccountId: b.id };
  const responses = await Promise.all([request('/expenses', 'POST', body, admin, { 'Idempotency-Key': 'expense-key-1' }), request('/expenses', 'POST', body, admin, { 'Idempotency-Key': 'expense-key-1' })]);
  assert.equal(responses[0].status, 201); assert.equal(responses[1].status, 201); assert.equal(responses[0].body.data.id, responses[1].body.data.id);
  assert.equal((await request('/expenses', 'POST', { ...body, title: 'Changed' }, admin, { 'Idempotency-Key': 'expense-key-1' })).status, 409);
  assert.equal((await request('/expenses', 'POST', body)).status, 409); assert.equal((await ok('/accounts/' + b.id)).currentBalance, 2);
  const b2 = await create('/accounts', account('Concurrent different keys', 'bank', 'USD', 10));
  const concurrent = await Promise.all([request('/expenses', 'POST', { ...body, payingAccountId: b2.id }), request('/expenses', 'POST', { ...body, payingAccountId: b2.id })]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
});

test('admin settings, backup validation, destructive confirmation, restore and role permissions', async () => {
  await ok('/settings', 'PATCH', { exchangeRates: { USD: 1, PKR: 280, EUR: 0.9, GBP: 0.8 }, customExpenseCategories: ['Other Expenses', 'Utilities and Office Operations'] });
  assert.equal((await ok('/settings')).exchangeRates.PKR, 280);
  assert.equal((await request('/settings', 'PATCH', { exchangeRates: { USD: 0 } })).status, 422);
  const backup = await ok('/backup');
  const invalid = structuredClone(backup); invalid.accounts[0].currentBalance += 1;
  assert.equal((await request('/restore', 'POST', invalid)).status, 422); assert.deepEqual(await ok('/state'), backup);
  assert.equal((await request('/restore', 'POST', { accounts: [] })).status, 422);
  assert.equal((await request('/data', 'DELETE', {})).status, 400);
  await ok('/data', 'DELETE', { confirm: 'DELETE ALL BUSINESS DATA' }); assert.equal((await ok('/state')).accounts.length, 0);
  await ok('/restore', 'POST', backup);
  const restored = await ok('/state');
  for (const key of Object.keys(backup)) assert.deepEqual(key === 'settings' ? restored[key] : [...restored[key]].sort((a, b) => a.id.localeCompare(b.id)), key === 'settings' ? backup[key] : [...backup[key]].sort((a, b) => a.id.localeCompare(b.id)));
  const viewer = await ok('/users', 'POST', { name: 'Viewer', email: 'viewer@example.com', password, role: 'viewer' }, admin, 201);
  const viewSession = await login('viewer@example.com'); await ok('/state', 'GET', undefined, viewSession);
  for (const [path, method, data] of [['/accounts', 'POST', account('Forbidden')], ['/settings', 'PATCH', {}], ['/data', 'DELETE', { confirm: 'DELETE ALL BUSINESS DATA' }], ['/restore', 'POST', backup], ['/users', 'GET'], ['/backup', 'GET'], ['/audit', 'GET']]) assert.equal((await request(path, method, data, viewSession)).status, 403);
  const operator = await ok('/users', 'POST', { name: 'Operator', email: 'operator@example.com', password, role: 'operator' }, admin, 201);
  const operatorSession = await login('operator@example.com');
  await ok('/accounts', 'POST', account('Operator account', 'bank'), operatorSession, 201);
  assert.equal((await request('/settings', 'PATCH', {}, operatorSession)).status, 403);
  await ok('/users/' + operator.id, 'PATCH', { active: false }); assert.equal((await request('/state', 'GET', undefined, operatorSession)).status, 401);
  const users = await ok('/users'); assert.ok(users.every(u => !u.password_hash && !u.passwordHash));
  assert.equal((await request('/users/' + users.find(u => u.role === 'admin').id, 'PATCH', { role: 'viewer' })).status, 409);
  await ok('/auth/password', 'POST', { currentPassword: password, newPassword: 'A-different-password-123!' }, viewSession);
  assert.equal((await request('/state', 'GET', undefined, viewSession)).status, 401);
  const newViewer = await login('viewer@example.com', 'A-different-password-123!');
  await ok('/auth/logout', 'POST', {}, newViewer); assert.equal((await request('/state', 'GET', undefined, newViewer)).status, 401);
});

test('MongoDB documents persist across reconnect and transactions roll back failed writes', async () => {
  let persistent = await testDatabase();
  const databaseName = persistent.mongo.databaseName;
  await persistent.collection('accounts').insertOne({ _id: 'saved', id: 'saved', name: 'Persisted', _order: 1 });
  await persistent.close();
  persistent = await openDatabase(testUri, { databaseName });
  try {
    assert.equal((await readState(persistent)).accounts[0].name, 'Persisted');
    await assert.rejects(persistent.transaction(async session => {
      await persistent.collection('accounts').updateOne({ _id: 'saved' }, { $set: { name: 'Must roll back' } }, { session });
      throw new Error('Injected failure');
    }), /Injected failure/);
    assert.equal((await persistent.collection('accounts').findOne({ _id: 'saved' })).name, 'Persisted');
    assert.equal(await persistent.collection('users').countDocuments({}), 0);
  } finally { await disposeTestDatabase(persistent); }
});

test('successful deletion, editable optional fields, every allowed transfer route, inactive accounts and fractional cents', async () => {
  const unused = await create('/accounts', account('Unused'));
  await ok('/accounts/' + unused.id, 'DELETE'); assert.equal((await request('/accounts/' + unused.id)).status, 404);
  const f = await create('/accounts', account('Route Fiverr', 'fiverr', 'USD', 100));
  const p1 = await create('/accounts', account('Route Payoneer 1', 'payoneer', 'USD', 100));
  const p2 = await create('/accounts', account('Route Payoneer 2', 'payoneer', 'USD', 100));
  const b1 = await create('/accounts', account('Route Bank 1', 'bank', 'USD', 100));
  const b2 = await create('/accounts', account('Route Bank 2', 'bank', 'USD', 100));
  const cash = await create('/accounts', account('Route Cash', 'petty_cash', 'USD', 100));
  for (const [a, b] of [[f, p1], [p1, p2], [p2, b1], [b1, b2], [b2, cash], [cash, b1]]) await create('/transfers', { sourceAccountId: a.id, destinationAccountId: b.id, sourceAmount: 1.01, destinationCreditedAmount: 1, transferDate: day });
  await ok('/accounts/' + p1.id, 'PATCH', { status: 'inactive' });
  assert.equal((await request('/transfers', 'POST', { sourceAccountId: f.id, destinationAccountId: p1.id, sourceAmount: 1, destinationCreditedAmount: 1, transferDate: day })).status, 422);
  assert.equal((await request('/accounts', 'POST', account('Fractional cents', 'bank', 'USD', 1.00001))).status, 422);
  const c = await create('/clients', { name: 'Editable client', linkedFiverrAccountId: f.id, status: 'active', email: 'edit@example.com' });
  await ok('/clients/' + c.id, 'PATCH', { email: '', notes: 'Updated' }); assert.equal((await ok('/clients/' + c.id)).email, '');
  const proj = await create('/projects', { name: 'Editable project', clientId: c.id, budget: 10, currency: 'USD', bookingDate: day, expectedCompletionDate: '2026-11-01', status: 'queued' });
  await ok('/projects/' + proj.id, 'PATCH', { expectedCompletionDate: '', notes: 'Cleared date' }); assert.equal((await ok('/projects/' + proj.id)).expectedCompletionDate, undefined);
  await ok('/projects/' + proj.id, 'DELETE'); await ok('/clients/' + c.id, 'DELETE');
  assert.equal((await request('/reports?from=2026-10-31&to=2026-10-01')).status, 400);
  assert.equal((await request('/transactions?limit=1001')).status, 422);
});

test('session expiry, production secure cookies and login throttling', async () => {
  const fixture = await testDatabase();
  await createUser(fixture, { name: 'Secure', email: 'secure@example.com', password, role: 'admin' });
  const temporary = createApp(fixture, { production: true, origin: 'https://crm.example', logging: false, loginLimit: 2 }).listen(0, '127.0.0.1');
  await once(temporary, 'listening');
  const url = `http://127.0.0.1:${temporary.address().port}/api`;
  try {
    const loggedIn = await fetch(url + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'secure@example.com', password }) });
    assert.equal(loggedIn.status, 200); const cookie = loggedIn.headers.get('set-cookie'); assert.match(cookie, /Secure/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
    await fixture.collection('sessions').updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal((await fetch(url + '/state', { headers: { Cookie: cookie.split(';')[0] } })).status, 401);
    for (let i = 0; i < 2; i++) {
      const result = await fetch(url + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'secure@example.com', password: 'wrong' }) });
      assert.equal(result.status, i === 0 ? 401 : 429);
    }
  } finally { await new Promise(resolve => temporary.close(resolve)); await disposeTestDatabase(fixture); }
});

test('email/password/company signup stores hashes, normalizes emails and creates isolated company administrators', async () => {
  const fixture = await testDatabase();
  const temporary = createApp(fixture, { logging: false, production: false, loginLimit: 100 }).listen(0, '127.0.0.1');
  await once(temporary, 'listening');
  const url = `http://127.0.0.1:${temporary.address().port}/api`;
  const post = (path, input) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const register = input => post('/auth/register', input);
  const input = { email: 'first@example.com', password, companyName: 'First Company' };
  try {
    assert.deepEqual(await (await fetch(url + '/auth/status')).json(), { registrationAvailable: true, firstUser: true });
    for (const invalid of [{ email: 'invalid', password }, { ...input, password: 'short' }, { ...input, role: 'admin' }, { ...input, name: 'Extra field' }]) assert.equal((await register(invalid)).status, 422);
    const responses = await Promise.all([register(input), register({ ...input, email: 'second@example.com' })]);
    assert.deepEqual(responses.map(response => response.status), [201, 201]);
    const results = await Promise.all(responses.map(response => response.json()));
    assert.deepEqual(results.map(result => result.user.role).sort(), ['admin', 'admin']);
    assert.notEqual(results[0].user.companyId, results[1].user.companyId);
    assert.ok(results.every(result => result.csrfToken && !result.user.passwordHash));
    assert.ok(responses.every(response => /HttpOnly/.test(response.headers.get('set-cookie'))));
    assert.equal(await fixture.collection('users').countDocuments({ role: 'admin' }), 2);
    const row = await fixture.collection('users').findOne({ email: input.email });
    assert.notEqual(row.passwordHash, password); assert.equal(row.password, undefined);
    assert.equal((await register({ ...input, email: '  FIRST@EXAMPLE.COM  ' })).status, 409);
    const duplicates = await Promise.all([register({ ...input, email: 'duplicate@example.com' }), register({ ...input, email: 'duplicate@example.com' })]);
    assert.deepEqual(duplicates.map(response => response.status).sort(), [201, 409]);
    const loggedIn = await post('/auth/login', { email: ' FIRST@EXAMPLE.COM ', password });
    assert.equal(loggedIn.status, 200);
    const cookie = loggedIn.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(url + '/state', { headers: { Cookie: cookie } })).status, 200);
    const wrong = await post('/auth/login', { email: input.email, password: 'incorrect-password' });
    assert.equal(wrong.status, 401); assert.equal((await wrong.json()).error.message, 'Invalid email or password');
    assert.equal((await post('/auth/login', { email: 'missing@example.com', password })).status, 401);
    assert.equal((await (await fetch(url + '/auth/status')).json()).firstUser, false);
  } finally { await new Promise(resolve => temporary.close(resolve)); await disposeTestDatabase(fixture); }
});

test('database diagnostics identify the real destination and protect connection credentials', async () => {
  const status = await ok('/database/status');
  assert.equal(status.databaseName, db.mongo.databaseName);
  assert.equal(status.connected, true);
  for (const name of ['accounts', 'clients', 'projects', 'payments', 'transfers', 'expenses', 'adjustments', 'transactions']) {
    assert.equal(status.collections[name], await db.collection(name).countDocuments({}));
  }
  const health = await ok('/health');
  assert.equal(health.connectionId, status.connectionId);
  assert.equal((await request('/database/status', 'GET', undefined, null)).status, 401);
  const viewer = await login('viewer@example.com', 'A-different-password-123!');
  assert.equal((await request('/database/status', 'GET', undefined, viewer)).status, 403);
  const target = storageTarget('mongodb://test-user:private-password@127.0.0.1:27018/example?replicaSet=local');
  assert.equal(target.compassUri, 'mongodb://127.0.0.1:27018/example?replicaSet=local');
  assert.ok(!JSON.stringify(target).includes('private-password'));
  assert.ok(!JSON.stringify(target).includes('test-user'));
  assert.notEqual(target.connectionId, storageTarget('mongodb://127.0.0.1:27018/another?replicaSet=local').connectionId);
});

test('API saves remain in MongoDB and survive backend/database-client reconnect', async () => {
  const before = await ok('/state');
  assert.ok(before.accounts.length > 0 && before.clients.length > 0);
  const databaseName = db.mongo.databaseName;
  const independent = await openDatabase(testUri, { databaseName });
  try {
    for (const name of ['accounts', 'clients', 'projects', 'payments', 'transfers', 'expenses', 'adjustments', 'transactions']) {
      assert.equal(await independent.collection(name).countDocuments({}), before[name].length);
      for (const record of before[name]) {
        const saved = await independent.collection(name).findOne({ _id: record.id });
        const { _id, _order, ...businessFields } = saved;
        assert.deepEqual(businessFields, record);
      }
    }
  } finally { await independent.close(); }
  await new Promise(resolve => server.close(resolve));
  await db.close();
  db = await openDatabase(testUri, { databaseName });
  server = createApp(db, { logging: false, loginLimit: 100, rateLimit: 10000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await ok('/state'), before);
  assert.equal((await ok('/auth/me')).user.role, 'admin');
});

test('booking credits once, transfers debit, edits reconcile, payments do not double credit, and backups round-trip', async () => {
  const f = await create('/accounts', account('Booking Fiverr'));
  const payoneer = await create('/accounts', account('Booking Payoneer', 'payoneer'));
  const client = await create('/clients', { name: 'Booking Client', linkedFiverrAccountId: f.id, status: 'active' });
  const input = { name: 'Booked value', clientId: client.id, budget: 1000, currency: 'USD', bookingDate: day, status: 'queued' };
  const key = { 'Idempotency-Key': 'booking-credit-exactly-once' };
  const results = await Promise.all([request('/projects', 'POST', input, admin, key), request('/projects', 'POST', input, admin, key)]);
  assert.ok(results.every(r => r.status === 201));
  const project = results[0].body.data;
  assert.equal(results[1].body.data.id, project.id);
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 1000);
  await create('/transfers', { sourceAccountId: f.id, destinationAccountId: payoneer.id, transferDate: day, sourceAmount: 300, destinationCreditedAmount: 290 });
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 700);
  assert.equal((await ok('/accounts/' + payoneer.id)).currentBalance, 290);
  await create('/payments', { clientId: client.id, projectId: project.id, receivingAccountId: f.id, paymentRoute: 'fiverr', currency: 'USD', paymentDate: day, paymentAmount: 400, actualCreditedAmount: 320 });
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 620);
  await create('/payments', { clientId: client.id, projectId: project.id, receivingAccountId: payoneer.id, paymentRoute: 'payoneer_direct', currency: 'USD', paymentDate: day, paymentAmount: 200, actualCreditedAmount: 195 });
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 420);
  assert.equal((await ok('/accounts/' + payoneer.id)).currentBalance, 485);
  await ok('/projects/' + project.id, 'PATCH', { budget: 1200 });
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 620);
  await ok('/projects/' + project.id, 'PATCH', { status: 'cancelled' });
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 20);
  await ok('/projects/' + project.id, 'PATCH', { status: 'in_progress' });
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 620);
  const snapshot = await ok('/backup');
  await ok('/restore', 'POST', snapshot);
  assert.deepEqual(await ok('/state'), snapshot);
  const bad = structuredClone(snapshot);
  bad.projects.find(p => p.id === project.id).budget += 10;
  assert.equal((await request('/restore', 'POST', bad)).status, 422);
  assert.deepEqual(await ok('/state'), snapshot);
});

test('USD bank receipts convert into PKR on the server and retain the posting rate across settings changes and restore', async () => {
  const f = await create('/accounts', account('FX Fiverr'));
  const bank = await create('/accounts', account('FX Bank', 'bank', 'PKR', 100));
  const c = await create('/clients', { name: 'FX Client', linkedFiverrAccountId: f.id, status: 'active' });
  const p = await create('/projects', { name: 'FX order', clientId: c.id, budget: 1000, currency: 'USD', bookingDate: day, status: 'in_progress' });
  await ok('/settings', 'PATCH', { exchangeRates: { USD: 1, PKR: 280.25, EUR: 0.9, GBP: 0.8 } });
  const payment = { projectId: p.id, clientId: c.id, paymentRoute: 'bank_direct', receivingAccountId: bank.id, currency: 'USD', paymentDate: day, paymentAmount: 100.01 };
  const before = await ok('/state');
  assert.equal((await request('/payments', 'POST', { ...payment, actualCreditedAmount: 100.01 })).status, 409);
  assert.equal((await request('/payments', 'POST', { ...payment, exchangeRate: 999 })).status, 422);
  assert.deepEqual(await ok('/state'), before);
  const key = { 'Idempotency-Key': 'converted-payment-unique' };
  const first = await ok('/payments', 'POST', payment, admin, 201, key);
  assert.equal(first.data.actualCreditedAmount, 28027.8);
  assert.equal(first.data.receivingCurrency, 'PKR'); assert.equal(first.data.exchangeRate, 280.25);
  assert.equal(first.data.feeOrDeduction, 0);
  assert.equal((await ok('/accounts/' + bank.id)).currentBalance, 28127.8);
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 899.99);
  await ok('/settings', 'PATCH', { exchangeRates: { USD: 1, PKR: 300, EUR: 0.9, GBP: 0.8 } });
  const retry = await ok('/payments', 'POST', payment, admin, 201, key);
  assert.deepEqual(retry.data, first.data);
  const snapshot = await ok('/backup');
  await ok('/restore', 'POST', snapshot);
  assert.deepEqual(await ok('/state'), snapshot);
  const bad = structuredClone(snapshot);
  bad.payments.find(x => x.id === first.data.id).exchangeRate = 300;
  assert.equal((await request('/restore', 'POST', bad)).status, 422);
  const report = await ok('/reports?clientId=' + c.id);
  assert.equal(report.collectedUSD, 100.01); assert.equal(report.bookedUSD, 1000);
});

test('booking reversals and concurrent withdrawals cannot overdraw or partially mutate state', async () => {
  const f = await create('/accounts', account('Reversal Fiverr'));
  const destination = await create('/accounts', account('Reversal Payoneer', 'payoneer'));
  const client = await create('/clients', { name: 'Reversal Client', linkedFiverrAccountId: f.id, status: 'active' });
  const input = { name: 'Reversible project', clientId: client.id, budget: 1000, currency: 'USD', bookingDate: day, status: 'in_progress' };
  assert.equal((await request('/projects', 'POST', { ...input, currency: 'EUR' })).status, 422);
  const project = await create('/projects', input);
  const transfer = { sourceAccountId: f.id, destinationAccountId: destination.id, transferDate: day, sourceAmount: 600, destinationCreditedAmount: 600 };
  const results = await Promise.all([request('/transfers', 'POST', transfer), request('/transfers', 'POST', transfer)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const before = await ok('/state');
  for (const patch of [{ budget: 500 }, { currency: 'EUR' }, { status: 'cancelled' }]) assert.ok((await request('/projects/' + project.id, 'PATCH', patch)).status >= 400);
  assert.equal((await request('/projects/' + project.id, 'DELETE')).status, 409);
  assert.deepEqual(await ok('/state'), before);
  const removable = await create('/projects', { ...input, budget: 100 });
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 500);
  await ok('/projects/' + removable.id, 'DELETE');
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 400);
});

test('direct bank payments validate accounts, credit net receipts once, reconcile bookings and restore backups', async () => {
  const f = await create('/accounts', account('Bank receipt Fiverr'));
  const bank = await create('/accounts', account('Payment Bank', 'bank', 'USD', 100));
  const inactive = await create('/accounts', { ...account('Inactive payment bank', 'bank'), status: 'inactive' });
  const otherCurrency = await create('/accounts', account('PKR payment bank', 'bank', 'PKR'));
  const cash = await create('/accounts', account('Not a bank', 'petty_cash'));
  const c = await create('/clients', { name: 'Bank paying client', linkedFiverrAccountId: f.id, status: 'active' });
  const p = await create('/projects', { name: 'Bank paid order', clientId: c.id, budget: 1000, currency: 'USD', bookingDate: day, status: 'in_progress' });
  const payment = { clientId: c.id, projectId: p.id, paymentRoute: 'bank_direct', receivingAccountId: bank.id, currency: 'USD', paymentDate: '2026-11-01', paymentAmount: 250, actualCreditedAmount: 240 };
  const before = await ok('/state');
  for (const receivingAccountId of [f.id, cash.id, inactive.id, otherCurrency.id, 'missing']) assert.ok((await request('/payments', 'POST', { ...payment, receivingAccountId })).status >= 400);
  assert.deepEqual(await ok('/state'), before);
  const headers = { 'Idempotency-Key': 'direct-bank-receipt-once' };
  const results = await Promise.all([request('/payments', 'POST', payment, admin, headers), request('/payments', 'POST', payment, admin, headers)]);
  assert.ok(results.every(r => r.status === 201));
  assert.equal(results[0].body.data.id, results[1].body.data.id);
  assert.equal((await ok('/accounts/' + bank.id)).currentBalance, 340);
  assert.equal((await ok('/accounts/' + f.id)).currentBalance, 750);
  const report = await ok('/reports?clientId=' + c.id);
  assert.equal(report.bookedUSD, 1000); assert.equal(report.collectedUSD, 250);
  assert.deepEqual(report.monthly.map(row => [row.month, row.bookedUSD, row.collectedUSD]), [['2026-10', 1000, 0], ['2026-11', 0, 250]]);
  const snapshot = await ok('/backup');
  await ok('/restore', 'POST', snapshot);
  assert.deepEqual(await ok('/state'), snapshot);
});
