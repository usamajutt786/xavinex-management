import { testDatabase, disposeTestDatabase } from './test-database.js';
import { createApp } from './app.js';
import { createUser } from './auth.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const db = await testDatabase('e2e');
writeFileSync(resolve(import.meta.dirname, '.e2e-database.json'), JSON.stringify({ databaseName: db.mongo.databaseName }));
await createUser(db, { email: 'browser@example.com', name: 'Browser Tester', password: 'Browser-test-password-123!', role: 'admin' });
const server = createApp(db, { origin: 'http://127.0.0.1:4101', logging: false, production: false }).listen(4101, '127.0.0.1');
let stopping = false;
const stop = () => {
  if (stopping) return; stopping = true;
  server.close(async () => { await disposeTestDatabase(db); process.exit(0); });
};
process.on('SIGINT', stop); process.on('SIGTERM', stop);
