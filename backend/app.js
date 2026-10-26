import express from 'express';
import { businessDate } from './dates.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { collections, readState, saveState, publicRecord, listRecords, storageStatus } from './database.js';
import { mutate, report } from './service.js';
import { ApiError, requireThat, text, id } from './validation.js';
import { digest, emailSchema, verifyPassword, hashPassword, passwordSchema, createUser, registerUser, publicUser, sessionMiddleware, issueSession, roleRequired, assertSession, audit } from './auth.js';

const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});
const loginInput = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();

export function createApp(db, options = {}) {
  const app = express();
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const origin = options.origin || process.env.APP_ORIGIN || 'http://localhost:3000';
  const sessionHours = Number(options.sessionHours || process.env.SESSION_HOURS || 12);
  const origins = new Set([origin]);
  const localOrigin = new URL(origin);
  if (!production && ['localhost', '127.0.0.1'].includes(localOrigin.hostname)) {
    localOrigin.hostname = localOrigin.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    origins.add(localOrigin.origin);
  }
  requireThat(Number.isFinite(sessionHours) && sessionHours > 0 && sessionHours <= 168, 'Invalid session duration', 500);
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet());
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-ID', req.requestId);
    if (options.logging !== false) {
      const start = Date.now();
      res.on('finish', () => console.log(JSON.stringify({ requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start })));
    }
    if (req.path.startsWith('/api')) {
      res.set('Cache-Control', 'no-store');
      if (req.headers.origin && !origins.has(req.headers.origin)) return next(new ApiError(403, 'Origin is not allowed'));
      if (origins.has(req.headers.origin)) {
        res.set('Access-Control-Allow-Origin', req.headers.origin); res.vary('Origin');
        res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Idempotency-Key, X-Company-ID');
        res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      }
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });
  const limiter = (limit, windowMs = 60000) => rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { message: 'Too many requests; retry shortly' } } });
  app.use('/api', limiter(options.rateLimit || 600));
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', async (req, res) => {
    await db.ping();
    res.json({ status: 'ok', service: 'xavinex-api', database: 'mongodb', deployment: db.deployment, databaseName: db.target.databaseName, connectionId: db.target.connectionId });
  });
  app.get('/api/auth/status', async (req, res) => {
    const firstUser = await db.collection('users').countDocuments({}) === 0;
    res.json({ registrationAvailable: true, firstUser });
  });
  const loginLimit = limiter(options.loginLimit || 15, 15 * 60000);
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/' };
  const dummyHash = hashPassword(randomUUID());
  const signIn = async (row, res) => {
    const session = await issueSession(db, row, sessionHours);
    res.cookie('xavinex_session', session.token, { ...cookieOptions, maxAge: sessionHours * 3600000 });
    res.json({ user: publicUser(row), csrfToken: session.csrf });
  };
  app.post('/api/auth/register', loginLimit, async (req, res) => {
    const user = await registerUser(db, req.body);
    res.status(201);
    await signIn(await db.collection('users').findOne({ _id: user.id }), res);
  });
  app.post('/api/auth/login', loginLimit, async (req, res) => {
    const input = loginInput.parse(req.body);
    const row = await db.collection('users').findOne({ email: input.email });
    const valid = await verifyPassword(input.password, row?.passwordHash || await dummyHash);
    requireThat(row?.active && valid, 'Invalid email or password', 401);
    await signIn(row, res);
  });
  app.use('/api', sessionMiddleware(db));
  app.use('/api', async (req, res, next) => {
    req.dataDb = await db.forCompany(req.user.companyId);
    next();
  });
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user, csrfToken: req.csrfToken }));
  app.post('/api/auth/logout', async (req, res) => {
    await db.collection('sessions').deleteOne({ _id: req.sessionHash });
    res.clearCookie('xavinex_session', cookieOptions); res.json({ success: true });
  });
  app.post('/api/auth/password', async (req, res) => {
    const input = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }).strict().parse(req.body);
    const row = await db.collection('users').findOne({ _id: req.user.id });
    requireThat(row && await verifyPassword(input.currentPassword, row.passwordHash), 'Current password is incorrect', 422);
    const passwordHash = await hashPassword(input.newPassword);
    await db.transaction(async session => {
      const user = await assertSession(db, req, session);
      requireThat(user.passwordHash === row.passwordHash, 'Password changed; sign in again', 409);
      await db.collection('users').updateOne({ _id: user.id }, { $set: { passwordHash }, $inc: { authVersion: 1 } }, { session });
      await db.collection('sessions').deleteMany({ userId: user.id }, { session });
      await audit(db, session, user.id, 'auth.password', user.id, user.companyId);
    });
    res.clearCookie('xavinex_session', cookieOptions); res.json({ success: true });
  });
  const writer = roleRequired('admin', 'operator'), admin = roleRequired('admin');
  app.get('/api/database/status', admin, async (req, res) => res.json(await storageStatus(req.dataDb)));
  app.get('/api/users', admin, async (req, res) => res.json((await db.collection('users').find({ companyId: req.user.companyId }).sort({ createdAt: 1 }).toArray()).map(publicUser)));
  app.post('/api/users', admin, async (req, res) => res.status(201).json(await createUser(db, req.body, { actorId: req.user.id, actorRequest: req })));
  app.patch('/api/users/:id', admin, async (req, res) => {
    const userId = id.parse(req.params.id);
    const patch = z.object({ name: text.optional(), role: z.enum(['admin', 'operator', 'viewer']).optional(), active: z.boolean().optional() }).strict().parse(req.body);
    const updated = await db.transaction(async session => {
      await assertSession(db, req, session, ['admin']);
      const user = await db.collection('users').findOne({ _id: userId, companyId: req.user.companyId }, { session });
      requireThat(user, 'User not found', 404);
      requireThat(userId !== req.user.id || (patch.active !== false && (!patch.role || patch.role === 'admin')), 'Cannot disable or demote your own administrator account', 409);
      await db.collection('users').updateOne({ _id: userId }, { $set: patch, $inc: { authVersion: 1 } }, { session });
      await db.collection('sessions').deleteMany({ userId }, { session });
      await audit(db, session, req.user.id, 'users.update', userId, req.user.companyId);
      return publicUser({ ...user, ...patch });
    });
    res.json(updated);
  });
  app.get('/api/state', async (req, res) => res.json(await readState(req.dataDb)));
  app.get('/api/backup', admin, async (req, res) => res.attachment(`xavinex-${businessDate()}.json`).json(await readState(req.dataDb)));
  for (const path of ['/api/reports', '/api/analytics']) app.get(path, async (req, res) => {
    const filters = z.object({ from: z.string().optional(), to: z.string().optional(), accountId: id.optional(), clientId: id.optional() }).strict().parse(req.query);
    res.json(report(await readState(req.dataDb), filters));
  });
  app.get('/api/audit', admin, async (req, res) => {
    const { limit, offset } = pagination.extend({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
    res.json((await db.collection('audit').find({ companyId: req.user.companyId }).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit).toArray()).map(row => ({ id: row._id, ...publicRecord(row) })));
  });

  function write(action, roles = ['admin', 'operator']) {
    return async (req, res) => {
      const dataDb = req.dataDb;
      const key = req.headers['idempotency-key'];
      if (key !== undefined) z.string().min(8).max(200).parse(key);
      const fingerprint = digest(JSON.stringify([req.method, req.path, req.body]));
      const result = await dataDb.transaction(async session => {
        await assertSession(db, req, session, roles);
        const prior = key && await dataDb.collection('idempotency').findOne({ key, userId: req.user.id, expiresAt: { $gt: new Date() } }, { session });
        if (prior) {
          requireThat(prior.fingerprint === fingerprint, 'Idempotency key has already been used for a different request', 409);
          return { success: true, data: prior.data, state: await readState(dataDb, session) };
        }
        const before = await readState(dataDb, session);
        const state = structuredClone(before);
        const data = mutate(state, action, req.params.id, req.body);
        await saveState(dataDb, before, state, session);
        await audit(db, session, req.user.id, action, req.params.id || data?.id || null, req.user.companyId);
        if (key) await dataDb.collection('idempotency').replaceOne({ userId: req.user.id, key }, { userId: req.user.id, key, fingerprint, data, expiresAt: new Date(Date.now() + 86400000) }, { session, upsert: true });
        return { success: true, data, state };
      });
      res.status(action.endsWith('.create') ? 201 : 200).json(result);
    };
  }
  for (const name of collections) {
    app.get(`/api/${name}`, async (req, res) => {
      const { limit, offset } = pagination.parse(req.query);
      const filter = {};
      for (const field of ['accountId', 'clientId', 'projectId', 'status', 'type']) if (req.query[field]) filter[field] = z.string().max(100).parse(req.query[field]);
      res.json(await listRecords(req.dataDb, name, { filter, limit, offset }));
    });
    app.get(`/api/${name}/:id`, async (req, res) => {
      const row = await req.dataDb.collection(name).findOne({ _id: id.parse(req.params.id) });
      requireThat(row, 'Record not found', 404); res.json(publicRecord(row));
    });
  }
  for (const name of ['accounts', 'clients', 'projects']) {
    app.post(`/api/${name}`, writer, write(`${name}.create`));
    app.patch(`/api/${name}/:id`, writer, write(`${name}.update`));
    app.delete(`/api/${name}/:id`, writer, write(`${name}.delete`));
  }
  app.post('/api/accounts/:id/adjustments', writer, write('accounts.adjust'));
  app.get('/api/accounts/:id/ledger', async (req, res) => {
    const accountId = id.parse(req.params.id);
    requireThat(await req.dataDb.collection('accounts').findOne({ _id: accountId }), 'Account not found', 404);
    res.json((await req.dataDb.collection('transactions').find({ accountId }).sort({ _order: -1 }).toArray()).map(publicRecord));
  });
  for (const name of ['payments', 'transfers', 'expenses']) app.post(`/api/${name}`, writer, write(`${name}.create`));
  app.delete('/api/expenses/:id', writer, write('expenses.delete'));
  app.get('/api/settings', async (req, res) => res.json(publicRecord(await req.dataDb.collection('settings').findOne({ _id: 'app' }))));
  app.patch('/api/settings', admin, write('settings.update', ['admin']));
  app.post('/api/restore', admin, write('data.restore', ['admin']));
  app.delete('/api/data', admin, write('data.clear', ['admin']));
  app.use('/api', (req, res, next) => next(new ApiError(404, 'API route not found')));
  const frontend = resolve(import.meta.dirname, '../xavinex-management/dist');
  if (existsSync(frontend)) {
    app.use(express.static(frontend, { index: false }));
    app.get('/{*path}', (req, res) => res.sendFile(resolve(frontend, 'index.html')));
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const unavailable = /Mongo(Network|ServerSelection|TopologyClosed|NotConnected)/.test(error.name);
    const status = unavailable ? 503 : error instanceof z.ZodError ? 422 : error.code === 11000 ? 409 : error.status || 500;
    let message = error.message;
    if (unavailable) message = 'MongoDB is unavailable. Check the database connection and retry.';
    else if (status >= 500) message = 'An internal error occurred';
    else if (error.code === 11000) message = 'This record already exists';
    else if (error instanceof z.ZodError) message = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    if (status >= 500) console.error(JSON.stringify({ requestId: req.requestId, error: error.name, code: error.code }));
    res.status(status).json({ error: { message, requestId: req.requestId } });
  });
  return app;
}
