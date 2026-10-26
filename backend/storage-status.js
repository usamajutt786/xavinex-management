import { configuration } from './config.js';
import { openDatabase, storageStatus } from './database.js';

let db;
try {
  db = await openDatabase(configuration().mongoUri);
  console.log(JSON.stringify(await storageStatus(db), null, 2));
} catch (error) {
  console.error(`Storage check failed (${error.code || error.name}). Check MONGODB_URI and MongoDB availability.`);
  process.exitCode = 1;
} finally { if (db) await db.close(); }
