import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ApiError, requireThat, text } from './validation.js';
import { companyDatabaseName } from './database.js';

const scrypt = promisify(scryptCallback);
export const digest = value => createHash('sha256').update(value).digest('hex');
export const passwordSchema = z.string().min(12).max(128);
export const emailSchema = z.string().trim().pipe(z.email().max(254)).transform(value => value.toLowerCase());
export const userInput = z.object({ email: emailSchema, name: text, password: passwordSchema, role: z.enum(['admin', 'operator', 'viewer']) }).strict();
export const registrationInput = z.object({ email: emailSchema, password: passwordSchema, companyName: text }).strict();
export const publicUser = row => ({ id: row.id, email: row.email, name: row.name, role: row.role, companyId: row.companyId, companyName: row.companyName, legacyWorkspace: row.legacyWorkspace === true, active: !!row.active, createdAt: row.createdAt });

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded || '')) return false;
  const [salt, value] = encoded.split(':');
  return timingSafeEqual(await scrypt(password, salt, 64), Buffer.from(value, 'hex'));
}
export async function audit(db, session, userId, action, referenceId = null, companyId) {
  requireThat(companyId, 'Company context required', 500);
  await db.collection('audit').insertOne({ _id: randomUUID(), companyId, userId, action, referenceId, createdAt: new Date().toISOString() }, { session });
}
export async function createUser(db, input, { firstUser = false, companyName, actorId = 'bootstrap', actorRequest } = {}) {
  const data = userInput.parse(input);
  const passwordHash = await hashPassword(data.password);
  return db.transaction(async session => {
    const actor = actorRequest && await assertSession(db, actorRequest, session, ['admin']);
    if (firstUser) requireThat(await db.collection('users').countDocuments({}, { session }) === 0, 'The workspace has already been set up. Sign in or contact an administrator.', 409);
    requireThat(!await db.collection('users').findOne({ email: data.email }, { session }), 'Email already exists', 409);
    let company;
    if (actor) company = await db.collection('companies').findOne({ _id: actor.companyId, active: true }, { session });
    else if (!companyName) company = await db.collection('companies').findOne({ databaseName: db.mongo.databaseName }, { session });
    if (!company) {
      const companyId = randomUUID();
      company = { _id: companyId, name: companyName || 'Xavinex Management', active: true, databaseName: companyName ? companyDatabaseName(db.mongo.databaseName, companyId) : db.mongo.databaseName, createdAt: new Date().toISOString() };
      await db.collection('companies').insertOne(company, { session });
    }
    const id = randomUUID();
    const row = { _id: id, id, email: data.email, name: data.name, passwordHash, role: data.role, companyId: company._id, companyName: company.name, legacyWorkspace: company.databaseName === db.mongo.databaseName, active: true, authVersion: 0, createdAt: new Date().toISOString() };
    await db.collection('users').insertOne(row, { session });
    await audit(db, session, actorId, 'users.create', id, company._id);
    return publicUser(row);
  });
}
export async function registerUser(db, input) {
  const { email, password, companyName } = registrationInput.parse(input);
  return createUser(db, { email, password, name: email.split('@')[0], role: 'admin' }, { companyName, actorId: 'registration' });
}
export async function assertSession(db, req, session, roles) {
  const current = await db.collection('sessions').findOne({ _id: req.sessionHash, expiresAt: { $gt: new Date() } }, { session });
  const user = current && await db.collection('users').findOne({ _id: current.userId, active: true }, { session });
  requireThat(user && user.companyId && current.companyId === user.companyId && req.user.companyId === user.companyId && current.authVersion === (user.authVersion || 0), 'Session expired; sign in again', 401);
  requireThat(await db.collection('companies').findOne({ _id: user.companyId, active: true }, { session }), 'Company is unavailable', 401);
  if (roles) requireThat(roles.includes(user.role), 'Your role cannot perform this action', 403);
  // Conflict with concurrent logout, password/role changes or deactivation so
  // a retried financial transaction must re-check the latest authorization.
  await db.collection('sessions').updateOne({ _id: current._id }, { $set: { lastUsedAt: new Date() } }, { session });
  await db.collection('users').updateOne({ _id: user._id, companyId: user.companyId }, { $inc: { requestVersion: 1 } }, { session });
  return user;
}
export function sessionMiddleware(db) {
  return async (req, res, next) => {
    const token = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('xavinex_session='))?.slice(16);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401, 'Sign in to continue');
    req.sessionHash = digest(token);
    const current = await db.collection('sessions').findOne({ _id: req.sessionHash, expiresAt: { $gt: new Date() } });
    const user = current && await db.collection('users').findOne({ _id: current.userId, active: true });
    requireThat(user && user.companyId && current.companyId === user.companyId && current.authVersion === (user.authVersion || 0), 'Session expired; sign in again', 401);
    req.user = publicUser(user);
    requireThat(!req.headers['x-company-id'] || req.headers['x-company-id'] === user.companyId, 'Company session changed; sign in again', 401);
    req.csrfToken = current.csrf;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) requireThat(req.headers['x-csrf-token'] === current.csrf, 'Invalid security token; reload and try again', 403);
    next();
  };
}
export const roleRequired = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : next(new ApiError(403, 'Your role cannot perform this action'));

export async function issueSession(db, user, hours) {
  const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
  await db.transaction(async session => {
    const current = await db.collection('users').findOne({ _id: user.id, active: true, passwordHash: user.passwordHash }, { session });
    requireThat(current, 'Account changed; sign in again', 401);
    requireThat(current.companyId && await db.collection('companies').findOne({ _id: current.companyId, active: true }, { session }), 'Company is unavailable', 401);
    await db.collection('sessions').insertOne({ _id: digest(token), userId: user.id, companyId: current.companyId, csrf, authVersion: current.authVersion || 0, expiresAt: new Date(Date.now() + hours * 3600000) }, { session });
  });
  return { token, csrf };
}
