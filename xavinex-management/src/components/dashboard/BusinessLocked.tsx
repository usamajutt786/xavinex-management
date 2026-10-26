import { useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../../context/DataContext';
import { monthlyBusinessLocked } from '../../utils/businessLocked';
import { formatCurrency, formatMonth } from '../../utils/formatters';
import { useBusinessMonth } from '../../utils/useBusinessMonth';

export function BusinessLocked() {
  const { projects, settings } = useData();
  const month = useBusinessMonth();
  const data = useMemo(() => monthlyBusinessLocked(projects, settings.exchangeRates, month), [projects, settings.exchangeRates, month]);
  const current = data.find(row => row.month === month)?.lockedUSD ?? 0;
  return (
    <section aria-label="Business locked" className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />Monthly Business Locked
          </h3>
          <p className="text-xs text-slate-500 mt-1">Full project value by confirmation (booking) date. Payments are tracked separately.</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-blue-700">Business Locked This Month · {formatMonth(month)}</p>
          <p className="text-3xl font-black text-blue-900" data-testid="current-month-business-locked">{formatCurrency(current, 'USD')}</p>
        </div>
      </div>
      <div className="h-64 w-full" role="img" aria-label="Monthly confirmed project value in USD">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} minTickGap={20} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={value => `$${value}`} />
            <Tooltip formatter={(value: any) => [formatCurrency(Number(value), 'USD'), 'Business Locked']} />
            <Bar dataKey="lockedUSD" name="Business Locked" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {projects.length === 0 && <p className="text-xs text-slate-500 mt-2">Book a confirmed project to start tracking locked business.</p>}
    </section>
  );
}
