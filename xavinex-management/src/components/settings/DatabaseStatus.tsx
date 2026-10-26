import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { api } from '../../api';
import { useData } from '../../context/DataContext';

interface StorageStatus {
  connected: boolean;
  databaseName: string;
  hosts: string[];
  deployment: string;
  compassUri: string | null;
  collections: Record<string, number>;
  checkedAt: string;
}

export function DatabaseStatus() {
  const { user } = useData();
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const result = await api<StorageStatus>('/database/status');
      if (request.current === version) setStatus(result);
    } catch (error) { if (request.current === version) setError((error as Error).message); }
    finally { if (request.current === version) setLoading(false); }
  }, []);
  useEffect(() => {
    if (user.role === 'admin') void refresh();
    return () => { request.current += 1; };
  }, [user.role, refresh]);
  if (user.role !== 'admin') return null;
  return <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs" aria-label="MongoDB storage">
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Database className="w-5 h-5 text-emerald-600" />MongoDB Storage</h3>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg disabled:opacity-50"><RefreshCw className="w-3.5 h-3.5" />Refresh database status</button>
    </div>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    {loading && <p role="status" className="text-xs text-slate-500">Checking stored records…</p>}
    {status && <div className="space-y-3 text-xs text-slate-600">
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><dt className="text-slate-500">Database</dt><dd className="font-semibold text-slate-900">{status.databaseName}</dd></div>
        <div><dt className="text-slate-500">Server</dt><dd className="font-semibold text-slate-900">{status.hosts.join(', ')}</dd></div>
        <div><dt className="text-slate-500">Storage</dt><dd className="font-semibold text-emerald-700">MongoDB · {status.deployment}</dd></div>
      </dl>
      {status.compassUri && <label className="block">MongoDB Compass connection
        <input aria-label="MongoDB Compass connection" readOnly value={status.compassUri} onFocus={event => event.currentTarget.select()} className="block mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-mono text-xs" />
      </label>}
      <p>Connect MongoDB Compass to this server, open <strong>{status.databaseName}</strong>, and select a collection to see saved entries.</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Stored record counts">{Object.entries(status.collections).map(([name, count]) => <div key={name} className="rounded-lg bg-slate-50 border border-slate-100 p-2"><dt className="capitalize">{name}</dt><dd className="font-bold text-slate-900">{count}</dd></div>)}</dl>
    </div>}
  </section>;
}
