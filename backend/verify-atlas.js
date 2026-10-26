import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
const config = parseEnv(readFileSync(resolve(import.meta.dirname, '.env'), 'utf8'));
if (!config.MONGODB_URI?.startsWith('mongodb+srv://')) throw new Error('Configure an Atlas URI in backend/.env first.');
const env = { ...process.env, TEST_MONGODB_URI: config.MONGODB_URI };
// Only generated xavinex_test_* / xavinex_e2e_* databases are used and dropped.
if (!process.argv.includes('--browser-only')) {
  const api = spawn(process.execPath, ['--test', '--test-concurrency=1', 'api.test.js', 'legacy-balances.test.js', 'storage-names.test.js', 'tenancy.test.js'], { cwd: import.meta.dirname, env, stdio: 'inherit', windowsHide: true });
  const [apiCode] = await once(api, 'exit');
  if (apiCode !== 0) process.exit(apiCode || 1);
}
if (process.argv.includes('--browser') || process.argv.includes('--browser-only')) {
  const browser = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], { cwd: import.meta.dirname, env, stdio: 'inherit', windowsHide: true });
  const [browserCode] = await once(browser, 'exit');
  process.exitCode = browserCode || 0;
}
