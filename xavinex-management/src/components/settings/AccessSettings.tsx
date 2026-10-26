import React, { useEffect, useState } from 'react';
import { api, User } from '../../api';

export function AccessSettings({ user, onPasswordChanged }: { user: User; onPasswordChanged: () => void }) {
  const [users, setUsers] = useState<(User & { active: boolean })[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''); const [name, setName] = useState('');
  const [password, setPassword] = useState(''); const [role, setRole] = useState('operator');
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState('');
  const [hasLegacy, setHasLegacy] = useState(false);
  useEffect(() => { setHasLegacy(!!localStorage.getItem('xavinex_management_db_v1_accounts')); }, []);
  const refresh = async () => { if (user.role === 'admin') setUsers(await api('/users')); };
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, [user.role]);
  const perform = async (action: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section className="m-6 border rounded-xl bg-white p-6 space-y-5">
    <h2 className="font-bold text-lg">Account & access</h2>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); void perform(async () => {
      await api('/auth/password', 'POST', { currentPassword, newPassword }); onPasswordChanged();
    }); }}>
      <label className="text-sm">Current password<input aria-label="Current password" className="block border rounded p-2" type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
      <label className="text-sm">New password (12+ characters)<input aria-label="New password" className="block border rounded p-2" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
      <button disabled={busy} className="bg-blue-600 text-white p-2 rounded">Change password</button>
    </form>
    {user.role === 'admin' && <>
      <h3 className="font-semibold">Workspace users</h3>
      <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void perform(async () => {
        await api('/users', 'POST', { email, name, password, role }); setEmail(''); setName(''); setPassword(''); await refresh();
      }); }}>
        <input aria-label="New user name" placeholder="Name" className="border rounded p-2" required value={name} onChange={e => setName(e.target.value)} />
        <input aria-label="New user email" placeholder="Email" type="email" className="border rounded p-2" required value={email} onChange={e => setEmail(e.target.value)} />
        <input aria-label="New user password" placeholder="Password (12+ characters)" type="password" autoComplete="new-password" minLength={12} maxLength={128} className="border rounded p-2" required value={password} onChange={e => setPassword(e.target.value)} />
        <select aria-label="New user role" className="border rounded p-2" value={role} onChange={e => setRole(e.target.value)}>{['admin', 'operator', 'viewer'].map(r => <option key={r}>{r}</option>)}</select>
        <button disabled={busy} className="bg-blue-600 text-white p-2 rounded">Add user</button>
      </form>
      <ul className="space-y-2">{users.map(u => <li key={u.id} className="flex flex-wrap gap-3 items-center text-sm border-b py-2">
        <span>{u.name} ({u.email})</span>
        <select aria-label={`Role for ${u.email}`} disabled={busy || u.id === user.id} value={u.role} onChange={e => { const role = e.target.value; void perform(async () => { await api('/users/' + u.id, 'PATCH', { role }); await refresh(); }); }} className="border rounded p-1">{['admin', 'operator', 'viewer'].map(r => <option key={r}>{r}</option>)}</select>
        <button disabled={busy || u.id === user.id} className="underline disabled:opacity-40" onClick={() => void perform(async () => { await api('/users/' + u.id, 'PATCH', { active: !u.active }); await refresh(); })}>{u.active ? 'Disable' : 'Enable'}</button>
      </li>)}</ul>
      {user.legacyWorkspace && hasLegacy && <p className="text-sm text-amber-800">This browser has data from the earlier version. <button className="underline" onClick={() => {
        const backup: Record<string, unknown> = {};
        for (const key of ['accounts', 'clients', 'projects', 'payments', 'transfers', 'expenses', 'transactions', 'adjustments', 'settings']) {
          const value = localStorage.getItem('xavinex_management_db_v1_' + key);
          if (value) backup[key] = JSON.parse(value);
        }
        const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'xavinex-browser-backup.json'; a.click(); URL.revokeObjectURL(url);
      }}>Download browser backup</button>, then restore it in Settings. Keep a copy before restoring.</p>}
    </>}
  </section>;
}
