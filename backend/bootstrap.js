import { configuration } from './config.js';
import { openDatabase } from './database.js';
import { ensureLocalMongo } from './local-mongo.js';
import { createUser } from './auth.js';
const config = configuration();
await ensureLocalMongo(config.mongoUri);
const db = await openDatabase(config.mongoUri);
try {
  const user = await createUser(db, { email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME || 'Administrator', password: process.env.ADMIN_PASSWORD, role: 'admin' }, { firstUser: true });
  console.log(`Administrator created: ${user.email}`);
} finally { await db.close(); }
