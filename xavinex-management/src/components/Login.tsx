import React, { useEffect, useRef, useState } from 'react';
import { api, User } from '../api';

interface WorkspaceStatus { registrationAvailable: boolean; firstUser: boolean; }

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const submitting = useRef(false);
  const checkStatus = async () => {
    setChecking(true); setError('');
    try {
      const result = await api<WorkspaceStatus>('/auth/status');
      setStatus(result);
      if (result.firstUser) setMode('signup');
    } catch (error) { setError((error as Error).message); }
    finally { setChecking(false); }
  };
  useEffect(() => { void checkStatus(); }, []);
  const signup = mode === 'signup';
  const inputClass = 'mt-1 block w-full border rounded-lg p-3';
  return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
    <form className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-md space-y-5 shadow-sm" onSubmit={async event => {
      event.preventDefault();
      if (submitting.current || checking || !status) return;
      submitting.current = true; setBusy(true); setError('');
      try {
        const result = await api(signup ? '/auth/register' : '/auth/login', 'POST', { email: email.trim(), password, ...(signup ? { companyName: companyName.trim() } : {}) });
        onLogin(result.user);
      } catch (error) { setError((error as Error).message); }
      finally { submitting.current = false; setBusy(false); }
    }}>
      <h1 className="text-2xl font-bold text-slate-900">Xavinex Management</h1>
      <p className="text-sm text-slate-600">{signup ? 'Create your company workspace. You will be its administrator.' : 'Sign in to your company workspace.'}</p>
      {signup && <label className="block text-sm">Company name<input className={inputClass} required maxLength={200} autoComplete="organization" disabled={busy} value={companyName} onChange={event => setCompanyName(event.target.value)} /></label>}
      {checking && <p role="status" className="text-sm text-slate-500">Connecting…</p>}
      <label className="block text-sm">Email<input className={inputClass} type="email" autoComplete="username" required maxLength={254} disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="block text-sm">Password<input className={inputClass} type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : undefined} maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
      {signup && <p className="text-xs text-slate-500">Use 12–128 characters for your password.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!status && !checking && <button type="button" className="text-sm text-blue-700 underline" onClick={() => void checkStatus()}>Retry connection</button>}
      <button disabled={busy || checking || !status} className="w-full rounded-lg bg-blue-600 text-white py-3 disabled:opacity-50">{busy ? 'Please wait…' : signup ? 'Sign up' : 'Sign in'}</button>
      <button type="button" disabled={busy || checking} className="w-full text-sm text-blue-700 hover:underline disabled:opacity-50" onClick={() => {
        setMode(signup ? 'login' : 'signup'); setError(''); setPassword('');
      }}>{signup ? 'Already have an account? Sign in' : 'Create an account'}</button>
    </form>
  </main>;
}
