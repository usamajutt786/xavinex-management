let csrfToken = '';
let companyId = '';
let authGeneration = 0;
const uncertainWrites = new Map<string, string>();
export interface User { id: string; email: string; name: string; companyId: string; companyName: string; legacyWorkspace?: boolean; role: 'admin' | 'operator' | 'viewer'; }
export async function api<T = any>(path: string, method = 'GET', body?: unknown, idempotent = false): Promise<T> {
  const generation = authGeneration;
  const publicAuth = ['/auth/login', '/auth/register', '/auth/status'].includes(path);
  const fingerprint = JSON.stringify([path, method, body]);
  const key = idempotent ? uncertainWrites.get(fingerprint) || crypto.randomUUID() : '';
  if (idempotent) uncertainWrites.set(fingerprint, key);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method, credentials: 'include', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', ...(companyId ? { 'X-Company-ID': companyId } : {}), ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('The server could not be reached. Try again; repeating the same action will reuse its request ID.');
  }
  const data = await response.json().catch(() => null);
  if (!publicAuth && generation !== authGeneration) throw new Error('The company session changed. Reload this view.');
  if (!data) throw new Error(response.status >= 500
    ? 'The backend is unavailable. Run npm run dev from the project folder to start the complete application, then retry.'
    : 'The server response was interrupted. Try the same action again to safely check its result.');
  // Keep the same key after an ambiguous network/server failure so a retry cannot double-post.
  if (response.ok || (response.status >= 400 && response.status < 500)) uncertainWrites.delete(fingerprint);
  if (!response.ok) {
    if (response.status === 401 && !['/auth/login', '/auth/register'].includes(path)) {
      authGeneration++; csrfToken = ''; companyId = ''; uncertainWrites.clear();
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new Error(data?.error?.message || `Request failed (${response.status})`);
  }
  if (data?.csrfToken) csrfToken = data.csrfToken;
  if (data?.user?.companyId) { companyId = data.user.companyId; authGeneration++; uncertainWrites.clear(); }
  if (path === '/auth/logout') { authGeneration++; companyId = ''; csrfToken = ''; uncertainWrites.clear(); }
  return data;
}
