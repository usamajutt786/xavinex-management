import { MongoClient } from 'mongodb';
import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from './validation.js';
import { businessDate } from './dates.js';

export const collections = ['accounts', 'clients', 'projects', 'payments', 'transfers', 'expenses', 'adjustments', 'transactions'];
// Some Atlas deployments allow only 38 bytes. Include the control database in
// the hash so identical company IDs across installations cannot share storage.
export const companyDatabaseName = (base, companyId) => `xv_c_${createHash('sha256').update(JSON.stringify([base, companyId])).digest('hex').slice(0, 32)}`;
export const legacyCompanyDatabaseName = (base, companyId) => `${base.slice(0, 26)}_c_${companyId.replaceAll('-', '')}`;
export const defaultSettings = () => ({
  reportingCurrency: 'USD', exchangeRates: { USD: 1, PKR: 278.5, EUR: 0.92, GBP: 0.79 },
  exchangeRateLastUpdated: businessDate(),
  customExpenseCategories: ['Human Resources', 'Food and Refreshments', 'Utilities and Office Operations', 'Executive Expenses', 'Office Assets and Equipment', 'Platform and Transaction Fees', 'Software and Subscriptions', 'Other Expenses'],
});

// Private storage fields never leave the repository.
export function publicRecord(document) {
  if (!document) return null;
  const { _id, _order, ...record } = document;
  return record;
}

// Stable database identity without credentials, usable by startup checks and diagnostics.
export function storageTarget(uri, databaseName) {
  const parsed = new MongoClient(uri);
  const hosts = parsed.options.srvHost ? [parsed.options.srvHost] : parsed.options.hosts.map(host => host.toString()).sort();
  const target = {
    databaseName: databaseName || parsed.options.dbName || 'test', hosts,
    replicaSet: parsed.options.replicaSet || null,
    deployment: uri.startsWith('mongodb+srv://') ? 'atlas' : 'replica-set',
  };
  const connectionId = createHash('sha256').update(JSON.stringify(target)).digest('hex');
  const local = hosts.every(host => /^(127\.0\.0\.1|localhost):\d+$/.test(host));
  const compassUri = local ? `mongodb://${hosts.join(',')}/${encodeURIComponent(target.databaseName)}${target.replicaSet ? `?replicaSet=${encodeURIComponent(target.replicaSet)}` : ''}` : null;
  return { ...target, connectionId, compassUri };
}

export async function storageStatus(db) {
  return db.transaction(async session => {
    const counts = {};
    for (const name of collections) counts[name] = await db.collection(name).countDocuments({}, { session });
    return { connected: true, ...db.target, collections: counts, checkedAt: new Date().toISOString() };
  }, { readOnly: true });
}

export async function openDatabase(uri, options = {}) {
  const client = options.client || new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, maxPoolSize: 20,
    ignoreUndefined: true, appName: 'Xavinex Management', ...options.clientOptions,
  });
  try {
    await client.connect();
    const mongo = client.db(options.databaseName);
    const hello = await mongo.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      throw new Error('MongoDB must be a replica set for atomic financial transactions. Run npm run mongo to start the project-local replica set, or configure MONGODB_URI for your replica set.');
    }
    await mongo.collection('metadata').updateOne({ _id: 'workspace' }, { $setOnInsert: { version: 0, sequence: 0, schemaVersion: 2 } }, { upsert: true });
    await mongo.collection('settings').updateOne({ _id: 'app' }, { $setOnInsert: defaultSettings() }, { upsert: true });
    await mongo.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongo.collection('users').createIndex({ companyId: 1, role: 1 });
    await mongo.collection('companies').createIndex({ databaseName: 1 }, { unique: true });
    await mongo.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await mongo.collection('sessions').createIndex({ userId: 1 });
    await mongo.collection('idempotency').createIndex({ userId: 1, key: 1 }, { unique: true });
    await mongo.collection('idempotency').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await mongo.collection('audit').createIndex({ createdAt: -1 });
    await mongo.collection('audit').createIndex({ companyId: 1, createdAt: -1 });
    const indexes = {
      accounts: ['type', 'status'], clients: ['linkedFiverrAccountId', 'status'],
      projects: ['clientId', 'linkedFiverrAccountId', 'status', 'bookingDate'],
      payments: ['clientId', 'projectId', 'receivingAccountId', 'paymentDate'],
      transfers: ['sourceAccountId', 'destinationAccountId', 'transferDate'],
      expenses: ['payingAccountId', 'category', 'date'], adjustments: ['accountId'], transactions: ['accountId', 'referenceId', 'date'],
    };
    for (const name of collections) {
      await mongo.collection(name).createIndex({ _order: -1 });
      for (const field of indexes[name]) await mongo.collection(name).createIndex({ [field]: 1 });
    }
    const tenantCache = new Map();
    const db = {
      client, mongo, target: storageTarget(uri, mongo.databaseName), deployment: uri.startsWith('mongodb+srv://') ? 'atlas' : 'replica-set',
      collection: name => mongo.collection(name),
      close: () => options.client ? Promise.resolve() : client.close(),
      async forCompany(companyId) {
        if (!/^[a-f0-9-]{36}$/.test(companyId || '')) throw new ApiError(401, 'Company membership required');
        const company = await mongo.collection('companies').findOne({ _id: companyId, active: true });
        if (!company) throw new ApiError(401, 'Company is unavailable');
        if (company.databaseName === mongo.databaseName) return db;
        const expected = companyDatabaseName(mongo.databaseName, companyId);
        const legacy = legacyCompanyDatabaseName(mongo.databaseName, companyId);
        if (company.databaseName !== expected && company.databaseName !== legacy) throw new Error('Invalid company database mapping');
        if (company.databaseName === legacy && db.deployment === 'atlas' && Buffer.byteLength(legacy, 'utf8') > 38) {
          // Failed provisioning created a company mapping but no database. Only
          // repair that case; never point an existing database at empty storage.
          const existing = await mongo.admin().command({ listDatabases: 1, nameOnly: true, authorizedDatabases: true, filter: { name: legacy } });
          if (existing.databases.length) throw new ApiError(503, 'This company database requires a storage migration before it can be opened. Existing records have been preserved.');
          const repaired = await mongo.collection('companies').updateOne({ _id: companyId, databaseName: legacy, active: true }, { $set: { databaseName: expected } });
          if (!repaired.matchedCount) throw new ApiError(503, 'Company storage configuration changed. Please retry.');
          company.databaseName = expected;
        }
        if (!tenantCache.has(companyId)) {
          const pending = openDatabase(uri, { databaseName: company.databaseName, client });
          tenantCache.set(companyId, pending);
          pending.catch(() => tenantCache.delete(companyId));
        }
        return tenantCache.get(companyId);
      },
      ping: () => mongo.command({ ping: 1 }),
      // Updating one shared version first prevents write skew (e.g. two concurrent payments
      // or a payment racing a project deletion). MongoDB retries transient conflicts.
      async transaction(callback, { readOnly = false } = {}) {
        return client.withSession(session => session.withTransaction(async () => {
          if (!readOnly) await mongo.collection('metadata').updateOne({ _id: 'workspace' }, { $inc: { version: 1 } }, { session });
          return callback(session);
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', maxCommitTimeMS: 10000, timeoutMS: 30000 }));
      },
    };
    if (!options.client) await migrateLegacyCompanies(db);
    return db;
  } catch (error) {
    if (!options.client) await client.close();
    throw error;
  }
}

// Preserve the original workspace for its original administrator. Never infer
// company membership from a matching name or grant all legacy users its data.
async function migrateLegacyCompanies(db) {
  await db.transaction(async session => {
    const legacyCompany = await db.collection('companies').findOne({ databaseName: db.mongo.databaseName }, { session });
    if (legacyCompany) await db.collection('users').updateMany({ companyId: legacyCompany._id, legacyWorkspace: { $ne: true } }, { $set: { legacyWorkspace: true } }, { session });
    const users = await db.collection('users').find({ companyId: { $exists: false } }, { session }).sort({ createdAt: 1, _id: 1 }).toArray();
    if (!users.length) return;
    const existingOwner = await db.collection('companies').findOne({ databaseName: db.mongo.databaseName }, { session });
    const owner = existingOwner ? null : users.find(user => user.role === 'admin') || users[0];
    for (const user of users) {
      const companyId = randomUUID();
      const companyName = `${user.name || user.email.split('@')[0]}'s company`;
      await db.collection('companies').insertOne({ _id: companyId, name: companyName, active: true, databaseName: user === owner ? db.mongo.databaseName : companyDatabaseName(db.mongo.databaseName, companyId), createdAt: new Date().toISOString() }, { session });
      await db.collection('users').updateOne({ _id: user._id }, { $set: { companyId, companyName, legacyWorkspace: user === owner, role: 'admin' }, $inc: { authVersion: 1 } }, { session });
      if (user === owner) await db.collection('audit').updateMany({ companyId: { $exists: false } }, { $set: { companyId } }, { session });
    }
    await db.collection('sessions').deleteMany({ companyId: { $exists: false } }, { session });
  });
}

export async function readState(db, session) {
  if (!session) return db.transaction(tx => readState(db, tx), { readOnly: true });
  // One server-side aggregation keeps the snapshot consistent without nine Atlas
  // round trips or unsupported parallel operations on a transaction session.
  const pipeline = [{ $match: { _id: 'workspace' } }];
  for (const name of collections) pipeline.push({ $lookup: { from: name, pipeline: [{ $sort: { _order: -1 } }, { $project: { _id: 0, _order: 0 } }], as: name } });
  pipeline.push({ $lookup: { from: 'settings', pipeline: [{ $match: { _id: 'app' } }, { $project: { _id: 0 } }], as: 'settings' } });
  pipeline.push({ $project: { _id: 0, ...Object.fromEntries(collections.map(name => [name, 1])), settings: { $arrayElemAt: ['$settings', 0] } } });
  return db.collection('metadata').aggregate(pipeline, { session, maxTimeMS: 10000 }).next();
}

export async function saveState(db, before, state, session) {
  if (!session) throw new Error('saveState requires a MongoDB transaction');
  const newCount = collections.reduce((count, name) => {
    const existing = new Set(before[name].map(row => row.id));
    return count + state[name].filter(row => !existing.has(row.id)).length;
  }, 0);
  let sequence = 0;
  if (newCount) {
    const counter = await db.collection('metadata').findOneAndUpdate({ _id: 'workspace' }, { $inc: { sequence: newCount } }, { session, returnDocument: 'after' });
    sequence = counter.sequence - newCount;
  }
  for (const name of collections) {
    const previous = new Map(before[name].map(row => [row.id, row]));
    const ids = new Set(state[name].map(row => row.id));
    const removed = before[name].filter(row => !ids.has(row.id)).map(row => row.id);
    if (removed.length) await db.collection(name).deleteMany({ _id: { $in: removed } }, { session });
    const operations = [];
    for (const raw of [...state[name]].reverse()) {
      const row = JSON.parse(JSON.stringify(raw)); // Omit cleared optional fields consistently.
      const old = previous.get(row.id);
      if (JSON.stringify(old) === JSON.stringify(row)) continue;
      const update = { $set: row };
      if (!old) {
        update.$setOnInsert = { _order: ++sequence };
      } else {
        const unset = Object.fromEntries(Object.keys(old).filter(key => !(key in row)).map(key => [key, '']));
        if (Object.keys(unset).length) update.$unset = unset;
      }
      operations.push({ updateOne: { filter: { _id: row.id }, update, upsert: true } });
    }
    if (operations.length) await db.collection(name).bulkWrite(operations, { session, ordered: true });
  }
  if (JSON.stringify(before.settings) !== JSON.stringify(state.settings)) await db.collection('settings').replaceOne({ _id: 'app' }, { _id: 'app', ...state.settings }, { session });
}

export async function listRecords(db, name, { filter = {}, limit = 100, offset = 0 } = {}) {
  if (!collections.includes(name)) throw new ApiError(404, 'Unknown collection');
  return db.transaction(async session => ({
    items: (await db.collection(name).find(filter, { session }).sort({ _order: -1 }).skip(offset).limit(limit).toArray()).map(publicRecord),
    total: await db.collection(name).countDocuments(filter, { session }), offset, limit,
  }), { readOnly: true });
}
