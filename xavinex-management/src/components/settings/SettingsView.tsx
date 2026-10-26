import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { AppSettings } from '../../types';
import { downloadJSONBackup } from '../../utils/export';
import { api } from '../../api';
import { DatabaseStatus } from './DatabaseStatus';
import {
  Settings,
  DollarSign,
  Tag,
  Database,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  onClearAllData: () => Promise<void>;
  onLoadBackup: (data: any) => Promise<{ success: boolean; error?: string }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onClearAllData,
  onLoadBackup,
}) => {
  const { user } = useData();
  const [pkrRate, setPkrRate] = useState(String(settings.exchangeRates.PKR || 278.5));
  const [eurRate, setEurRate] = useState(String(settings.exchangeRates.EUR || 0.92));
  const [gbpRate, setGbpRate] = useState(String(settings.exchangeRates.GBP || 0.79));
  const [newCategory, setNewCategory] = useState('');
  const [rateSaved, setRateSaved] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setPkrRate(String(settings.exchangeRates.PKR));
    setEurRate(String(settings.exchangeRates.EUR));
    setGbpRate(String(settings.exchangeRates.GBP));
  }, [settings.exchangeRates.PKR, settings.exchangeRates.EUR, settings.exchangeRates.GBP]);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);
  const perform = async (action: () => Promise<void>) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError('');
    try { await action(); } catch (error) { setSaveError((error as Error).message); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    const rates = { USD: 1, PKR: Number(pkrRate), EUR: Number(eurRate), GBP: Number(gbpRate) };
    if (Object.values(rates).some(rate => !Number.isFinite(rate) || rate <= 0 || rate > 1e9)) {
      setSaveError('Enter a positive, finite exchange rate for each currency.'); return;
    }
    setRateSaved(false);
    await perform(async () => {
      await onUpdateSettings({ exchangeRates: rates }); setRateSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setRateSaved(false), 2500);
    });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    if (settings.customExpenseCategories.some(category => category.toLowerCase() === newCategory.trim().toLowerCase())) {
      setSaveError('Category already exists.');
      return;
    }
    await perform(async () => {
      await onUpdateSettings({ customExpenseCategories: [...settings.customExpenseCategories, newCategory.trim()] });
      setNewCategory('');
    });
  };

  const handleRemoveCategory = async (cat: string) => {
    if (settings.customExpenseCategories.length <= 1) {
      setSaveError('Must retain at least one expense category.');
      return;
    }
    await perform(async () => { await onUpdateSettings({
      customExpenseCategories: settings.customExpenseCategories.filter((c) => c !== cat),
    }); });
  };

  const handleBackup = async () => {
    await perform(async () => { downloadJSONBackup(await api('/backup'), 'Xavinex_Management_Backup'); });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.currentTarget.value = '';
    if (file.size > 10 * 1024 * 1024) { setRestoreMessage({ type: 'error', text: 'Backup files must be smaller than 10 MB.' }); return; }
    await perform(async () => {
      try {
        const parsed = JSON.parse(await file.text());
        const res = await onLoadBackup(parsed);
        if (res.success) {
          setRestoreMessage({ type: 'success', text: 'Backup data successfully restored!' });
        } else {
          setRestoreMessage({ type: 'error', text: res.error || 'Failed to restore backup.' });
        }
      } catch (err: any) {
        setRestoreMessage({ type: 'error', text: 'Invalid JSON file: ' + err.message });
      }
    });
  };

  return (
    <fieldset disabled={user.role !== 'admin' || saving} className="space-y-6 max-w-4xl disabled:opacity-70" aria-busy={saving}>
      {user.role !== 'admin' && <p className="text-sm text-slate-600">Workspace settings are managed by an administrator.</p>}
      {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
      <DatabaseStatus />
      {/* Exchange Rates Settings */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Multi-Currency Exchange Rates
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Reporting currency is USD ($). When multi-currency accounts (e.g. PKR bank accounts) are summarized, these reference rates are applied to calculate unified financial reporting.
        </p>

        <form onSubmit={handleSaveRates} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1 USD to PKR (₨) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={pkrRate}
                onChange={(e) => setPkrRate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1 USD to EUR (€) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={eurRate}
                onChange={(e) => setEurRate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1 USD to GBP (£) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={gbpRate}
                onChange={(e) => setGbpRate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-semibold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Last Updated: {settings.exchangeRateLastUpdated || 'Today'}
            </span>
            <div className="flex items-center gap-2">
              {rateSaved && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Rates Updated
                </span>
              )}
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
              >
                Save Exchange Rates
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Expense Categories */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-5 h-5 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Expense Categories
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Manage system expense classification buckets for company accounting and charts.
        </p>

        <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Add new custom category (e.g. Legal & Compliance)..."
            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {settings.customExpenseCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
            >
              {cat}
              <button
                type="button"
                onClick={() => handleRemoveCategory(cat)}
                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                title="Remove Category"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Database Backup & Disaster Recovery */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Persistent Database Backup & Restore
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          All financial data is saved persistently. You can download a complete JSON database backup anytime or restore your records from a previous file.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Download Complete Backup (JSON)
          </button>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer">
            <Upload className="w-4 h-4 text-blue-600" />
            Restore from Backup (JSON)
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {restoreMessage && (
          <div
            role={restoreMessage.type === 'error' ? 'alert' : 'status'}
            className={`mt-3 p-3 rounded-lg text-xs flex items-center gap-2 ${
              restoreMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {restoreMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{restoreMessage.text}</span>
          </div>
        )}
      </div>

      {/* Reset System to Zero (No Dummy Data) */}
      <div className="bg-rose-50/60 p-5 rounded-xl border border-rose-200 shadow-2xs">
        <div className="flex items-center gap-2 mb-2 text-rose-800">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <h3 className="text-sm font-bold">Reset Database (Zero Records)</h3>
        </div>
        <p className="text-xs text-rose-700 mb-4 leading-relaxed">
          This will erase all business records for everyone in this workspace. Download a backup first. User accounts and audit history are retained.
        </p>

        <button
          onClick={async () => {
            if (
              window.confirm(
                'Are you sure you want to erase all data? This will clear all records and return the database to zero.'
              )
            ) {
              await perform(onClearAllData);
            }
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Records (Reset to Zero)
        </button>
      </div>
    </fieldset>
  );
};
