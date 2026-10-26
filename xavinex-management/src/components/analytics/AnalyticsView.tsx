import { useData } from '../../context/DataContext';
import { businessDate } from '../../utils/formatters';
import React, { useState, useMemo } from 'react';
import {
  Project,
  ClientPayment,
  Expense,
  FinancialAccount,
  Client,
  FundTransfer,
  AccountTransaction,
} from '../../types';
import { formatCurrency, formatDate, formatMonth, convertToUSD } from '../../utils/formatters';
import { exportToCSV } from '../../utils/export';
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
  BarChart3,
  PieChart as PieIcon,
  Download,
  Filter,
  DollarSign,
  ArrowRightLeft,
  Calendar,
  Layers,
  Sparkles,
  Wallet,
  Receipt,
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface AnalyticsViewProps {
  projects: Project[];
  payments: ClientPayment[];
  expenses: Expense[];
  accounts: FinancialAccount[];
  clients: Client[];
  transfers: FundTransfer[];
  transactions: AccountTransaction[];
}

// Enterprise Custom Tooltip
const AnalyticsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 text-white px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700/80 text-xs backdrop-blur-md z-30">
        <div className="font-bold text-slate-300 pb-1.5 border-b border-slate-800 text-[11px]">
          {label}
        </div>
        <div className="pt-1.5 space-y-1">
          {payload.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}:
              </span>
              <span className="font-extrabold text-white text-xs">
                {typeof item.value === 'number'
                  ? item.name.includes('%') || item.name.toLowerCase().includes('rate') || item.name.toLowerCase().includes('percentage')
                    ? `${item.value.toFixed(1)}%`
                    : item.name.includes('Count') || item.name.includes('Projects')
                    ? item.value
                    : formatCurrency(item.value, 'USD')
                  : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  projects,
  payments,
  expenses,
  accounts,
  clients,
  transfers,
  transactions,
}) => {
  const { settings } = useData();
  const rates = settings.exchangeRates;
  const [activeTab, setActiveTab] = useState<'revenue' | 'cashflow' | 'balances' | 'expenses' | 'performance'>('revenue');
  const [transferFilter, setTransferFilter] = useState<'all' | 'fiverr_to_payoneer' | 'payoneer_to_payoneer'>('all');

  const fiverrAccounts = accounts.filter((a) => a.type === 'fiverr');
  const payoneerAccounts = accounts.filter((a) => a.type === 'payoneer');
  const bankAndCashAccounts = accounts.filter((a) => a.type === 'bank' || a.type === 'petty_cash');

  // Vibrant palette
  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6'];
  const STATUS_COLORS = ['#10B981', '#2563EB', '#8B5CF6', '#F59E0B', '#EF4444'];

  // 1. Comprehensive Monthly Timeline (Strict chronological order)
  const monthlyTimelineData = useMemo(() => {
    const monthsSet = new Set<string>();

    projects.forEach((p) => {
      if (p.bookingDate) monthsSet.add(p.bookingDate.slice(0, 7));
    });
    payments.forEach((p) => {
      if (p.paymentDate) monthsSet.add(p.paymentDate.slice(0, 7));
    });
    expenses.forEach((e) => {
      if (e.date) monthsSet.add(e.date.slice(0, 7));
    });

    const sortedMonths = Array.from(monthsSet).sort();

    let runningCumulativeBooked = 0;
    let runningCumulativeCollected = 0;

    return sortedMonths.map((m) => {
      const monthBooked = projects
        .filter((p) => p.bookingDate.startsWith(m))
        .reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);

      const monthCollected = payments
        .filter((p) => p.paymentDate.startsWith(m))
        .reduce((sum, p) => sum + convertToUSD(p.paymentAmount, p.currency, rates), 0);

      const monthExpenses = expenses
        .filter((e) => e.date.startsWith(m))
        .reduce((sum, e) => sum + convertToUSD(e.amount, e.currency, rates), 0);

      runningCumulativeBooked += monthBooked;
      runningCumulativeCollected += monthCollected;
      const outstandingDue = Math.max(0, runningCumulativeBooked - runningCumulativeCollected);
      const recoveryRate = monthBooked > 0 ? (monthCollected / monthBooked) * 100 : 0;
      const netCash = monthCollected - monthExpenses;

      return {
        month: m,
        monthLabel: formatMonth(m),
        booked: monthBooked,
        collected: monthCollected,
        expenses: monthExpenses,
        netCash,
        cumulativeBooked: runningCumulativeBooked,
        cumulativeCollected: runningCumulativeCollected,
        outstandingDue,
        recoveryRate,
        inflow: monthCollected,
        outflow: monthExpenses,
      };
    });
  }, [projects, payments, expenses, rates]);

  // 2. Chronological Account Balances & Total Liquid Funds
  const accountBalancesData = useMemo(() => {
    // Collect all unique dates from transactions, sorted chronologically with timestamps
    const sortedTxs = [...transactions].sort((a, b) =>
      (a.timestamp || a.date).localeCompare(b.timestamp || b.date)
    );

    const dateSet = new Set<string>();
    sortedTxs.forEach((t) => dateSet.add(t.date));
    accounts.forEach((a) => {
      if (a.createdAt) dateSet.add(businessDate(a.createdAt));
    });

    const dates = Array.from(dateSet).sort();

    return dates.map((d) => {
      const point: Record<string, any> = {
        date: d,
        dateLabel: formatDate(d),
      };

      let totalLiquidFundsUSD = 0;

      accounts.forEach((acc) => {
        const txsUntilDate = sortedTxs.filter((t) => t.accountId === acc.id && t.date <= d);
        let balance = 0;
        if (txsUntilDate.length > 0) {
          balance = txsUntilDate.reduce((n, t) => n + t.amount, 0);
        }
        point[acc.id] = convertToUSD(balance, acc.currency, rates);
        totalLiquidFundsUSD += convertToUSD(balance, acc.currency, rates); // assuming USD reporting default
      });

      point['Total Liquid Funds'] = totalLiquidFundsUSD;
      return point;
    });
  }, [transactions, accounts, rates]);

  // 3. Transfer Deduction Percentage Trends
  const transferDeductionData = useMemo(() => {
    return transfers
      .filter((t) => {
        const src = accounts.find((a) => a.id === t.sourceAccountId);
        const dst = accounts.find((a) => a.id === t.destinationAccountId);
        if (!src || !dst) return false;

        if (transferFilter === 'fiverr_to_payoneer') {
          return src.type === 'fiverr' && dst.type === 'payoneer';
        }
        if (transferFilter === 'payoneer_to_payoneer') {
          return src.type === 'payoneer' && dst.type === 'payoneer';
        }
        return true;
      })
      .map((t) => {
        const src = accounts.find((a) => a.id === t.sourceAccountId);
        const dst = accounts.find((a) => a.id === t.destinationAccountId);
        return {
          date: t.transferDate,
          dateLabel: formatDate(t.transferDate),
          deductionPct: t.deductionPercentage || 0,
          difference: convertToUSD(t.difference || 0, t.sourceCurrency, rates),
          sourceAmount: t.sourceAmount,
          route: `${src?.name || 'Src'} → ${dst?.name || 'Dst'}`,
        };
      });
  }, [transfers, accounts, transferFilter, rates]);

  // 4. Fiverr Performance (Booked vs Received)
  const fiverrPerformanceData = useMemo(() => {
    return fiverrAccounts.map((fiverr) => {
      const booked = projects
        .filter((p) => p.linkedFiverrAccountId === fiverr.id)
        .reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);

      const collected = payments
        .filter((p) => p.linkedFiverrAccountId === fiverr.id)
        .reduce((sum, p) => sum + convertToUSD(p.paymentAmount, p.currency, rates), 0);

      return {
        name: fiverr.name,
        booked,
        collected,
        outstanding: Math.max(0, booked - collected),
      };
    });
  }, [fiverrAccounts, projects, payments, rates]);

  // 5. Expense Categories Aggregation
  const expenseCatData = useMemo(() => {
    const catMap: Record<string, number> = {};
    expenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + convertToUSD(e.amount, e.currency, rates);
    });
    return Object.keys(catMap).map((k) => ({ name: k, value: catMap[k] }));
  }, [expenses, rates]);

  // 6. Top Clients by Booked & Collected
  const topClientsData = useMemo(() => {
    return clients
      .map((c) => {
        const clientProjects = projects.filter((p) => p.clientId === c.id);
        const clientPayments = payments.filter((p) => p.clientId === c.id);
        const booked = clientProjects.reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
        const collected = clientPayments.reduce((sum, p) => sum + convertToUSD(p.paymentAmount, p.currency, rates), 0);
        return {
          name: c.name,
          booked,
          collected,
          outstanding: Math.max(0, booked - collected),
        };
      })
      .filter((c) => c.booked > 0 || c.collected > 0)
      .sort((a, b) => b.booked - a.booked)
      .slice(0, 10);
  }, [clients, projects, payments, rates]);

  // 7. Project Delivery Status Distribution
  const deliveryStatusData = useMemo(() => {
    const map: Record<string, number> = {
      Completed: 0,
      'In Progress': 0,
      Queued: 0,
      'On Hold': 0,
      Cancelled: 0,
    };
    projects.forEach((p) => {
      if (p.status === 'completed') map.Completed += 1;
      else if (p.status === 'in_progress') map['In Progress'] += 1;
      else if (p.status === 'queued') map.Queued += 1;
      else if (p.status === 'on_hold') map['On Hold'] += 1;
      else if (p.status === 'cancelled') map.Cancelled += 1;
    });
    return Object.keys(map)
      .filter((k) => map[k] > 0)
      .map((name) => ({ name, value: map[name] }));
  }, [projects, rates]);

  // 8. Project Payment Status Distribution
  const paymentStatusData = useMemo(() => {
    const map: Record<string, number> = {
      'Fully Paid': 0,
      'Partially Paid': 0,
      Unpaid: 0,
    };
    projects.forEach((p) => {
      if (p.paymentStatus === 'fully_paid') map['Fully Paid'] += 1;
      else if (p.paymentStatus === 'partially_paid') map['Partially Paid'] += 1;
      else map.Unpaid += 1;
    });
    return Object.keys(map)
      .filter((k) => map[k] > 0)
      .map((name) => ({ name, value: map[name] }));
  }, [projects, rates]);

  const handleExportCSV = () => {
    if (monthlyTimelineData.length === 0) {
      alert('No financial data available to export.');
      return;
    }
    exportToCSV('Financial_Analytics_Summary', monthlyTimelineData);
  };

  const hasData =
    projects.length > 0 || payments.length > 0 || expenses.length > 0 || transfers.length > 0 || accounts.length > 0;

  return (
    <div className="space-y-6">
      {/* Category Tabs Header */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('revenue')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'revenue'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Revenue & Bookings
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'cashflow'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cash Flow & Deductions
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'balances'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Account Balances & Funds
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Expenses & Burn Rate
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'performance'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Clients & Fiverr Performance
          </button>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          Export Dataset (CSV)
        </button>
      </div>

      {!hasData ? (
        <div className="py-16 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">No Financial Data Available</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No financial data available. Start by adding an account or recording a transaction.
          </p>
        </div>
      ) : (
        <>
          {/* TAB 1: REVENUE & PIPELINE PERFORMANCE */}
          {activeTab === 'revenue' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Graph 1: Monthly Business Booked Trend */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Monthly Business Booked Trend
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Gross contracted revenue strictly calculated by project booking date.
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTimelineData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="bookedAreaGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="booked"
                          name="Booked Business"
                          stroke="#2563EB"
                          strokeWidth={2.5}
                          fill="url(#bookedAreaGrad2)"
                          dot={{ fill: '#2563EB', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Graph 2: Monthly Client Payments Collected */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Monthly Client Collections
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Actual collections received across Fiverr and Direct Payoneer routes.
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTimelineData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="collectedAreaGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="collected"
                          name="Payments Collected"
                          stroke="#10B981"
                          strokeWidth={2.5}
                          fill="url(#collectedAreaGrad2)"
                          dot={{ fill: '#10B981', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Graph 3: Cumulative Lifetime Business Growth */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Cumulative Contracted Business Growth
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    All-time cumulative business growth trajectory.
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTimelineData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="cumulativeBooked"
                          name="Cumulative Booked"
                          stroke="#2563EB"
                          strokeWidth={2.5}
                          dot={{ fill: '#2563EB', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulativeCollected"
                          name="Cumulative Collected"
                          stroke="#10B981"
                          strokeWidth={2.5}
                          dot={{ fill: '#10B981', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Graph 4: Outstanding Client Receivables Over Time */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Outstanding Receivables Trajectory
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Cumulative unpaid project balances over time.
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTimelineData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="dueAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="outstandingDue"
                          name="Outstanding Balance"
                          stroke="#F59E0B"
                          strokeWidth={2.5}
                          fill="url(#dueAreaGrad)"
                          dot={{ fill: '#F59E0B', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CASH FLOW & LIQUIDITY */}
          {activeTab === 'cashflow' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Graph 7: Monthly Net Operating Cash Flow */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Monthly Net Operating Cash Flow
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Net cash balance movement (Collections minus Operating Expenses).
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTimelineData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="netCashGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="netCash"
                          name="Net Cash Flow"
                          stroke="#10B981"
                          strokeWidth={2.5}
                          fill="url(#netCashGrad2)"
                          dot={{ fill: '#10B981', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Graph 8: Transfer Deduction Percentage Trend */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      Transfer Deduction Percentage Trends
                    </h3>
                    <select
                      value={transferFilter}
                      onChange={(e) => setTransferFilter(e.target.value as any)}
                      className="px-2 py-1 text-[11px] font-semibold border border-slate-300 rounded-md bg-white text-slate-700"
                    >
                      <option value="all">All Transfers</option>
                      <option value="fiverr_to_payoneer">Fiverr → Payoneer</option>
                      <option value="payoneer_to_payoneer">Payoneer → Payoneer</option>
                    </select>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Historical percentage difference between source and destination accounts.
                  </p>

                  {transferDeductionData.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={transferDeductionData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${v}%`} />
                          <Tooltip content={<AnalyticsTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="deductionPct"
                            name="Deduction %"
                            stroke="#F59E0B"
                            strokeWidth={2.5}
                            dot={{ fill: '#F59E0B', r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">
                      No matching transfer records found.
                    </div>
                  )}
                </div>
              </div>

              {/* Graph 9: Cumulative Liquid Company Funds Growth */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Cumulative Company Available Balance Growth
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Progression of total available liquid capital across all accounts.
                </p>
                {accountBalancesData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={accountBalancesData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0F172A" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#0F172A" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="Total Liquid Funds"
                          name="Total Liquid Funds"
                          stroke="#0F172A"
                          strokeWidth={2.5}
                          fill="url(#liquidGrad)"
                          dot={{ fill: '#0F172A', r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">
                    No transactions recorded to calculate balance growth.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT BALANCES & TRENDS */}
          {activeTab === 'balances' && (
            <div className="space-y-6">
              {/* Multi-line graph comparing individual accounts */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Individual Account Balance Trends
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Multi-line progression of individual accounts reflecting payments, transfers, expenses, and manual corrections.
                </p>

                {accountBalancesData.length > 0 ? (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={accountBalancesData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        {accounts.map((acc, idx) => (
                          <Line
                            key={acc.id}
                            type="monotone"
                            dataKey={acc.id}
                            name={`${acc.name} (${acc.type.replace('_', ' ')})`}
                            stroke={COLORS[idx % COLORS.length]}
                            strokeWidth={2.5}
                            dot={{ fill: COLORS[idx % COLORS.length], r: 3 }}
                            activeDot={{ r: 6 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">
                    No transactions recorded to chart account history.
                  </div>
                )}
              </div>

              {/* Balances by Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Fiverr Accounts Comparison</h3>
                  <p className="text-xs text-slate-500 mb-4">Current liquid balance per Fiverr account.</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fiverrAccounts.map(account => ({ ...account, currentBalance: convertToUSD(account.currentBalance, account.currency, rates) }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip formatter={(v: any) => [`$${v}`, 'Balance']} />
                        <Bar dataKey="currentBalance" name="Current Balance" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Payoneer Accounts Comparison</h3>
                  <p className="text-xs text-slate-500 mb-4">Current liquid balance per Payoneer account.</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={payoneerAccounts.map(account => ({ ...account, currentBalance: convertToUSD(account.currentBalance, account.currency, rates) }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip formatter={(v: any) => [`$${v}`, 'Balance']} />
                        <Bar dataKey="currentBalance" name="Current Balance" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXPENSES & COSTS */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 4. Monthly Expenses */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Monthly Company Expenses</h3>
                  <p className="text-xs text-slate-500 mb-4">Month-by-month operational burn rate.</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTimelineData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="expensesAreaGrad3" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="expenses"
                          name="Operating Expenses"
                          stroke="#EF4444"
                          strokeWidth={2.5}
                          fill="url(#expensesAreaGrad3)"
                          dot={{ fill: '#EF4444', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 14. Expense Category Distribution */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Expense Distribution by Category</h3>
                  <p className="text-xs text-slate-500 mb-4">Total operating expenditure breakdown.</p>
                  {expenseCatData.length > 0 ? (
                    <div className="h-64 w-full flex items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expenseCatData} dataKey="value" cx="50%" cy="50%" outerRadius={85} paddingAngle={3}>
                            {expenseCatData.map((e, idx) => (
                              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => [`$${v}`, 'Amount']} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">
                      No expense categories recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FIVERR & CLIENT PERFORMANCE */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* Fiverr Account Performance */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Fiverr Account Performance: Booked vs Received
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Grouped comparison of total business originated vs payments collected through linked projects.
                </p>

                {fiverrPerformanceData.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fiverrPerformanceData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<AnalyticsTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                        <Bar dataKey="booked" name="Booked Business" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="collected" name="Payments Collected" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">
                    No Fiverr accounts created yet.
                  </div>
                )}
              </div>

              {/* Status Distributions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Project Delivery Status Distribution */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Project Pipeline Delivery Status
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Projects by operational delivery stage.</p>
                  {deliveryStatusData.length > 0 ? (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={deliveryStatusData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                            {deliveryStatusData.map((e, idx) => (
                              <Cell key={`cell-deliv-${idx}`} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => [v, 'Projects']} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-xs text-slate-400 italic">
                      No projects recorded yet.
                    </div>
                  )}
                </div>

                {/* Project Payment Status Distribution */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Project Payment Settlement Status
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Breakdown of orders by settlement status.</p>
                  {paymentStatusData.length > 0 ? (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentStatusData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                            <Cell fill="#10B981" />
                            <Cell fill="#F59E0B" />
                            <Cell fill="#EF4444" />
                          </Pie>
                          <Tooltip formatter={(v: any) => [v, 'Projects']} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-xs text-slate-400 italic">
                      No projects recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
