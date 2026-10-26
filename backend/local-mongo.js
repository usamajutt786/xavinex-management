import './config.js';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { MongoClient } from 'mongodb';
import { pathToFileURL } from 'node:url';

const localUri = 'mongodb://127.0.0.1:27018/admin?directConnection=true';
const replicaSet = 'xavinex-local';
const dataPath = resolve(import.meta.dirname, '.mongo-data');

function executable() {
  if (process.env.MONGOD_PATH) return process.env.MONGOD_PATH;
  if (process.platform !== 'win32') return 'mongod';
  const root = join(process.env.ProgramFiles || 'C:/Program Files', 'MongoDB', 'Server');
  if (existsSync(root)) {
    for (const version of readdirSync(root).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      const candidate = join(root, version, 'bin', 'mongod.exe');
      if (existsSync(candidate)) return candidate;
    }
  }
  return 'mongod';
}
async function connectLocal() {
  const client = new MongoClient(localUri, { serverSelectionTimeoutMS: 700, connectTimeoutMS: 700 });
  try { await client.connect(); return client; } catch (error) { await client.close(); throw error; }
}

export async function ensureLocalMongo(uri, { enabled = process.env.LOCAL_MONGO !== 'false' } = {}) {
  // Never start/reconfigure another MongoDB installation or an external database.
  const managed = /^mongodb:\/\/127\.0\.0\.1:27018\//.test(uri) && uri.includes('replicaSet=xavinex-local');
  if (!enabled || !managed) return;
  let client;
  try { client = await connectLocal(); } catch {
    mkdirSync(dataPath, { recursive: true });
    const child = spawn(executable(), ['--dbpath', dataPath, '--port', '27018', '--bind_ip', '127.0.0.1', '--replSet', replicaSet, '--logpath', join(dataPath, 'mongod.log'), '--logappend'], { detached: true, stdio: 'ignore', windowsHide: true });
    let failure;
    child.on('error', error => { failure = error; });
    child.unref();
    for (let attempt = 0; attempt < 30 && !client; attempt++) {
      if (failure) throw new Error('Cannot launch mongod. Install MongoDB Server or set MONGOD_PATH in backend/.env.');
      await delay(300);
      try { client = await connectLocal(); } catch { /* Wait for the new database process. */ }
    }
    if (!client) throw new Error('Local MongoDB did not start. Check backend/.mongo-data/mongod.log and whether port 27018 is available.');
    writeFileSync(join(dataPath, 'launcher.json'), JSON.stringify({ pid: child.pid, port: 27018, replicaSet }));
  }
  try {
    const hello = await client.db('admin').command({ hello: 1 });
    if (hello.setName && hello.setName !== replicaSet) throw new Error('Port 27018 belongs to another replica set; configure MONGODB_URI explicitly.');
    try {
      await client.db('admin').command({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.code !== 94) throw error;
      await client.db('admin').command({ replSetInitiate: { _id: replicaSet, members: [{ _id: 0, host: '127.0.0.1:27018' }] } });
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) {
        console.log('Local MongoDB ready on 127.0.0.1:27018 (replica set xavinex-local).');
        return;
      }
      await delay(250);
    }
    throw new Error('Local MongoDB has not elected a primary; inspect its log.');
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { ensureLocalEnvironment, configuration } = await import('./config.js');
  ensureLocalEnvironment();
  await ensureLocalMongo(configuration().mongoUri);
}
