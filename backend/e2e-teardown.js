import { MongoClient } from 'mongodb';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { testUri } from './test-database.js';
import { companyDatabaseName, legacyCompanyDatabaseName } from './database.js';

export default async function teardown() {
  const manifest = resolve(import.meta.dirname, '.e2e-database.json');
  if (!existsSync(manifest)) return;
  const { databaseName } = JSON.parse(readFileSync(manifest, 'utf8'));
  if (!/^xavinex_e2e_[a-f0-9]{24}$/.test(databaseName)) throw new Error('Invalid E2E cleanup database name');
  const client = new MongoClient(testUri);
  try {
    await client.connect();
    for (const company of await client.db(databaseName).collection('companies').find({}).toArray()) {
      if ([companyDatabaseName(databaseName, company._id), legacyCompanyDatabaseName(databaseName, company._id)].includes(company.databaseName)) await client.db(company.databaseName).dropDatabase();
    }
    await client.db(databaseName).dropDatabase();
  }
  finally { await client.close(); unlinkSync(manifest); }
}
