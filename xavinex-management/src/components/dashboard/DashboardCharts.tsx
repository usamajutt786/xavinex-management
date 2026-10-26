import { convertToUSD } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import { BusinessLocked } from './BusinessLocked';
import React, { useMemo, useState } from 'react';
import { Project, ClientPayment, Expense, FinancialAccount, Client, FundTransfer } from '../../types';
import { formatCurrency, formatDate, formatMonth } from '../../utils/formatters';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Layers,
  Sparkles,
  Briefcase,
  Wallet,
  Receipt,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface DashboardChartsProps {
  projects: Project[];
  payments: ClientPayment[];
  expenses: Expense[];
  accounts: FinancialAccount[];
  clients: Client[];
  transfers: FundTransfer[];
}

// Sleek Glassmorphic Tooltip
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/80 text-xs backdrop-blur-md z-30">
        <div className="font-semibold text-slate-300 pb-1.5 border-b border-slate-800 text-[11px]">
          {label}
        </div>
        <div className="pt-1.5 space-y-1">
          {payload.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}:
              </span>
              <span className="font-bold text-white text-xs">
                {typeof item.value === 'number' ? formatCurrency(item.value, 'USD') : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  projects,
  payments,
  expenses,
  accounts,
  clients,
  transfers,
}) => {
  const { settings } = useData();
  const rates = settings.exchangeRates;
  const [chartMode, setChartMode] = useState<'area' | 'line'>('area');

  // Aggregate monthly timeline data accurately across projects, payments, and expenses
  const monthlyComparisonData = useMemo(() => {
    const monthMap: Record<string, { month: string; monthLabel: string; booked: number; collected: number; expenses: number }> = {};

    projects.forEach((p) => {
      const m = p.bookingDate.slice(0, 7);
      if (!monthMap[m]) {
        monthMap[m] = { month: m, monthLabel: formatMonth(m), booked: 0, collected: 0, expenses: 0 };
      }
      monthMap[m].booked += convertToUSD(p.budget, p.currency, rates);
    });

    payments.forEach((p) => {
      const m = p.paymentDate.slice(0, 7);
      if (!monthMap[m]) {
        monthMap[m] = { month: m, monthLabel: formatMonth(m), booked: 0, collected: 0, expenses: 0 };
      }
      monthMap[m].collected += convertToUSD(p.paymentAmount, p.currency, rates);
    });

    expenses.forEach((e) => {
      const m = e.date.slice(0, 7);
      if (!monthMap[m]) {
        monthMap[m] = { month: m, monthLabel: formatMonth(m), booked: 0, collected: 0, expenses: 0 };
      }
      monthMap[m].expenses += convertToUSD(e.amount, e.currency, rates);
    });

    return Object.keys(monthMap)
      .sort()
      .map((k) => ({
        ...monthMap[k],
        netCashFlow: monthMap[k].collected - monthMap[k].expenses,
        inflow: monthMap[k].collected,
        outflow: monthMap[k].expenses,
      }));
  }, [projects, payments, expenses, rates]);

  // Totals for top chart headers
  const chartHeaderTotals = useMemo(() => {
    const totalBooked = monthlyComparisonData.reduce((sum, d) => sum + d.booked, 0);
    const totalCollected = monthlyComparisonData.reduce((sum, d) => sum + d.collected, 0);
    const totalExpenses = monthlyComparisonData.reduce((sum, d) => sum + d.expenses, 0);
    const totalNetCash = totalCollected - totalExpenses;
    return { totalBooked, totalCollected, totalExpenses, totalNetCash };
  }, [monthlyComparisonData, rates]);

  // Expense Category Distribution
  const expenseCategoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    expenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + convertToUSD(e.amount, e.currency, rates);
    });

    return Object.keys(catMap).map((cat) => ({
      name: cat,
      value: catMap[cat],
    }));
  }, [expenses, rates]);

  // Top Clients Data
  const topClientsData = useMemo(() => {
    const clientMap: Record<string, { name: string; booked: number; collected: number }> = {};

    clients.forEach((c) => {
      clientMap[c.id] = { name: c.name, booked: 0, collected: 0 };
    });

    projects.forEach((p) => {
      if (clientMap[p.clientId]) {
        clientMap[p.clientId].booked += convertToUSD(p.budget, p.currency, rates);
      }
    });

    payments.forEach((p) => {
      if (clientMap[p.clientId]) {
        clientMap[p.clientId].collected += convertToUSD(p.paymentAmount, p.currency, rates);
      }
    });

    return Object.values(clientMap)
      .filter((c) => c.booked > 0 || c.collected > 0)
      .sort((a, b) => b.booked - a.booked)
      .slice(0, 5);
  }, [clients, projects, payments, rates]);

  // Project Delivery Status Distribution
  const projectStatusData = useMemo(() => {
    const statusMap: Record<string, number> = {
      Completed: 0,
      'In Progress': 0,
      Queued: 0,
      'On Hold': 0,
    };

    projects.forEach((p) => {
      if (p.status === 'completed') statusMap.Completed += 1;
      else if (p.status === 'in_progress') statusMap['In Progress'] += 1;
      else if (p.status === 'queued') statusMap.Queued += 1;
      else if (p.status === 'on_hold') statusMap['On Hold'] += 1;
    });

    return Object.keys(statusMap)
      .filter((k) => statusMap[k] > 0)
      .map((name) => ({ name, value: statusMap[name] }));
  }, [projects, rates]);

  // Account Type Liquidity Distribution
  const accountTypeData = useMemo(() => {
    let fiverr = 0;
    let payoneer = 0;
    let bank = 0;
    let pettyCash = 0;

    accounts.forEach((acc) => {
      if (acc.type === 'fiverr') fiverr += convertToUSD(acc.currentBalance, acc.currency, rates);
      else if (acc.type === 'payoneer') payoneer += convertToUSD(acc.currentBalance, acc.currency, rates);
      else if (acc.type === 'bank') bank += convertToUSD(acc.currentBalance, acc.currency, rates);
      else if (acc.type === 'petty_cash') pettyCash += convertToUSD(acc.currentBalance, acc.currency, rates);
    });

    const items = [
      { name: 'Fiverr Accounts', value: fiverr, color: '#10B981' },
      { name: 'Payoneer Accounts', value: payoneer, color: '#F59E0B' },
      { name: 'Bank Accounts', value: bank, color: '#2563EB' },
      { name: 'Petty Cash', value: pettyCash, color: '#8B5CF6' },
    ];

    return items.filter((i) => i.value > 0);
  }, [accounts, rates]);

  const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];
  const STATUS_COLORS = ['#10B981', '#2563EB', '#8B5CF6', '#F59E0B'];

  return (
    <div className="space-y-6">
      <BusinessLocked />
      {/* ROW 1: PRIMARY FINANCIAL CURVES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph 1: Business Booked vs. Collections (Dual-Line/Area with Rich Gradients) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  Monthly Business Booked vs. Collections
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparison of contracted order volume against actual cash received.
                </p>
              </div>

              {monthlyComparisonData.length > 0 && (
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
                  <button
                    onClick={() => setChartMode('area')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      chartMode === 'area'
                        ? 'bg-white text-blue-600 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Area Shading
                  </button>
                  <button
                    onClick={() => setChartMode('line')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      chartMode === 'line'
                        ? 'bg-white text-blue-600 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Clean Line
                  </button>
                </div>
              )}
            </div>

            {monthlyComparisonData.length > 0 && (
              <div className="flex items-center gap-4 py-2 px-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs mb-3">
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Booked:</span>
                  <div className="font-extrabold text-blue-700">
                    {formatCurrency(chartHeaderTotals.totalBooked, 'USD')}
                  </div>
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Collected:</span>
                  <div className="font-extrabold text-emerald-700">
                    {formatCurrency(chartHeaderTotals.totalCollected, 'USD')}
                  </div>
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Collection Ratio:</span>
                  <div className="font-extrabold text-slate-800">
                    {chartHeaderTotals.totalBooked > 0
                      ? `${((chartHeaderTotals.totalCollected / chartHeaderTotals.totalBooked) * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {monthlyComparisonData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'area' ? (
                  <AreaChart data={monthlyComparisonData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bookedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `$${val}`} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Area
                      type="monotone"
                      dataKey="booked"
                      name="Booked Business"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#bookedGradient)"
                      dot={{ fill: '#2563EB', r: 3 }}
                      activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="collected"
                      name="Payments Collected"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#collectedGradient)"
                      dot={{ fill: '#10B981', r: 3 }}
                      activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={monthlyComparisonData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `$${val}`} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Line
                      type="monotone"
                      dataKey="booked"
                      name="Booked Business"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ fill: '#2563EB', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="collected"
                      name="Payments Collected"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ fill: '#10B981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 font-semibold">
                No financial data available. Start by adding an account or recording a transaction.
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                As projects and client payments are booked, this chart will render your growth curves.
              </p>
            </div>
          )}
        </div>

        {/* Graph 2: Net Cash Flow Trend (Operating Cash Movement) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                  Monthly Net Operating Cash Flow
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client payments inflow minus company expenses month by month.
                </p>
              </div>
            </div>

            {monthlyComparisonData.length > 0 && (
              <div className="flex items-center gap-4 py-2 px-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs mb-3">
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Net Operating Cash:</span>
                  <div
                    className={`font-extrabold ${
                      chartHeaderTotals.totalNetCash >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {chartHeaderTotals.totalNetCash >= 0 ? '+' : ''}
                    {formatCurrency(chartHeaderTotals.totalNetCash, 'USD')}
                  </div>
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Total Expenses:</span>
                  <div className="font-extrabold text-rose-700">
                    -{formatCurrency(chartHeaderTotals.totalExpenses, 'USD')}
                  </div>
                </div>
              </div>
            )}
          </div>

          {monthlyComparisonData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyComparisonData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="netCashFlow"
                    name="Net Cash Flow"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCash)"
                    dot={{ fill: '#10B981', r: 3 }}
                    activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <DollarSign className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 font-semibold">
                No financial data available. Start by adding an account or recording a transaction.
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                Net cash flow chart will track cash inflows versus operational expenses.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2: EXPENSES TREND & CASH INFLOW VS OUTFLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph 3: Monthly Company Expenses Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                Monthly Operating Expenses Trend
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly operational burn rate across utilities, software, HR, and overhead.
              </p>
            </div>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
              Total: {formatCurrency(chartHeaderTotals.totalExpenses, 'USD')}
            </span>
          </div>

          {monthlyComparisonData.length > 0 ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyComparisonData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="expenseTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Operating Expenses"
                    stroke="#EF4444"
                    strokeWidth={2.5}
                    fill="url(#expenseTrendGrad)"
                    dot={{ fill: '#EF4444', r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500 font-medium">No expense records available yet.</p>
            </div>
          )}
        </div>

        {/* Graph 4: Inflow vs Outflow Comparison (Bar Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Cash Inflow vs. Cash Outflow
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Client payments inflow compared side-by-side with expense outflows.
              </p>
            </div>
          </div>

          {monthlyComparisonData.length > 0 ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyComparisonData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Bar dataKey="inflow" name="Inflow (Payments)" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Outflow (Expenses)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500 font-medium">No cash movement records available.</p>
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: CATEGORY & STATUS DISTRIBUTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Graph 5: Expense Category Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-600" />
              Expense Distribution
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">Operating cost classification</p>

          {expenseCategoryData.length > 0 ? (
            <div className="h-56 w-full flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`$${val}`, 'Amount']} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" align="center" verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400 italic">
              No expense categories recorded.
            </div>
          )}
        </div>

        {/* Graph 6: Project Delivery Status Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              Project Pipeline Status
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">Distribution of orders by active stage</p>

          {projectStatusData.length > 0 ? (
            <div className="h-56 w-full flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {projectStatusData.map((entry, index) => (
                      <Cell key={`cell-status-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [val, 'Projects']} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" align="center" verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400 italic">
              No projects recorded yet.
            </div>
          )}
        </div>

        {/* Graph 7: Top Clients by Business Volume */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              Top Clients by Value
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">Highest revenue relationships</p>

          {topClientsData.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClientsData} layout="vertical" margin={{ top: 0, right: 10, left: 15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#334155' }} width={75} />
                  <Tooltip formatter={(val: any) => [`$${val}`, 'Booked']} />
                  <Bar dataKey="booked" name="Booked" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400 italic">
              No clients or projects recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
