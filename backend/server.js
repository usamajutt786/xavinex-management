import { configuration } from './config.js';
import { openDatabase } from './database.js';
import { createApp } from './app.js';

let db;
try {
  const config = configuration();
  db = await openDatabase(config.mongoUri);
  const app = createApp(db, config);
  const server = app.listen(config.port, config.host, () => {
    console.log(`Xavinex API ready at http://${config.host}:${config.port}; MongoDB ${db.target.hosts.join(',')} / ${db.target.databaseName} connected.`);
  });
  server.requestTimeout = 30000; server.headersTimeout = 35000;
  server.on('error', async error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${config.port} is already in use. Stop the other API process or change PORT and API_PROXY_TARGET.` : `HTTP startup failed (${error.code || error.name}).`);
    await db.close(); process.exit(1);
  });
  let stopping = false;
  function shutdown() {
    if (stopping) return; stopping = true;
    server.close(async () => { await db.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(/Mongo/.test(error.name) ? 'MongoDB connection failed. Run npm run dev to start the local database, or check MONGODB_URI in backend/.env.' : error.message);
  if (db) await db.close();
  process.exitCode = 1;
}
