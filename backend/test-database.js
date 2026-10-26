import { randomUUID } from 'node:crypto';
import { openDatabase, companyDatabaseName, legacyCompanyDatabaseName } from './database.js';
import { ensureLocalMongo } from './local-mongo.js';

export const testUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/xavinex_tests?replicaSet=xavinex-local';
export async function testDatabase(prefix = 'test') {
  await ensureLocalMongo(testUri, { enabled: true });
  return openDatabase(testUri, { databaseName: `xavinex_${prefix}_${randomUUID().replaceAll('-', '').slice(0, 24)}` });
}
export async function disposeTestDatabase(db) {
  if (!/^xavinex_(test|e2e)_[a-f0-9]{24}$/.test(db.mongo.databaseName)) throw new Error('Refusing to drop a non-test database');
  for (const company of await db.collection('companies').find({}).toArray()) {
    if ([companyDatabaseName(db.mongo.databaseName, company._id), legacyCompanyDatabaseName(db.mongo.databaseName, company._id)].includes(company.databaseName)) await db.client.db(company.databaseName).dropDatabase();
  }
  await db.mongo.dropDatabase();
  await db.close();
}
