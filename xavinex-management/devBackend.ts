import { spawn, type ChildProcess } from 'node:child_process';

interface RecoveryOptions {
  backendDirectory: string;
  healthUrl: string;
  probe?: () => Promise<boolean>;
  launch?: () => ChildProcess;
  retryDelay?: number;
  log?: (message: string) => void;
}

// Owned by the Vite server, so a frontend started directly through Vite can
// still bring up its API instead of remaining on an unavailable login screen.
export function createBackendRecovery(options: RecoveryOptions) {
  let child: ChildProcess | undefined;
  let checking = false;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const probe = options.probe || (async () => {
    const response = await fetch(options.healthUrl, { signal: AbortSignal.timeout(2000) });
    return response.ok && (await response.json()).service === 'xavinex-api';
  });
  const launch = options.launch || (() => spawn(process.execPath, ['dev.js', '--api-only'], {
    cwd: options.backendDirectory, stdio: 'inherit', windowsHide: true,
  }));
  const schedule = () => {
    if (closed) return;
    clearTimeout(retry);
    retry = setTimeout(() => void start(), options.retryDelay ?? 5000);
    retry.unref?.();
  };
  const start = async () => {
    if (closed || checking || (child && child.exitCode === null)) return;
    checking = true;
    try {
      let healthy = false;
      try { healthy = await probe(); } catch { /* An offline API needs starting. */ }
      if (closed || healthy) return;
      options.log?.('Starting the Xavinex backend API…');
      child = launch();
      child.once('error', () => { child = undefined; options.log?.('Backend launch failed; retrying shortly.'); schedule(); });
      child.once('exit', () => { child = undefined; schedule(); });
    } catch { schedule(); }
    finally { checking = false; }
  };
  const stop = () => {
    closed = true;
    clearTimeout(retry);
    if (child && child.exitCode === null) child.kill('SIGTERM');
  };
  return { start, stop };
}
