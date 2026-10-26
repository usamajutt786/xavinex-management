import React from 'react';
import { FinancialAccount } from '../../types';
import {
  formatCurrency,
  getAccountFullName,
  getAccountTypeBadgeClass,
  getAccountTypeLabel,
  convertToUSD,
} from '../../utils/formatters';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Clock,
  Briefcase,
  Wallet,
  Globe,
  Receipt,
  ArrowRightLeft,
  Users,
  CheckCircle2,
  Calendar,
  Building2,
  SlidersHorizontal,
  History,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface KPIGridProps {
  metrics: {
    totalBusinessBookedUSD: number;
    totalPaymentsReceivedUSD: number;
    outstandingPaymentsUSD: number;
    totalExpensesUSD: number;
    availableBalanceUSD: number;
    totalFiverrBalanceUSD: number;
    totalPayoneerBalanceUSD: number;
    totalBankBalanceUSD: number;
    totalPettyCashBalanceUSD: number;
    totalTransferDeductionsUSD: number;
    activeProjectsCount: number;
    completedProjectsCount: number;
    totalClientsCount: number;
    totalProjectsCount: number;
    thisMonthBookedUSD: number;
    thisYearBookedUSD: number;
    thisMonthExpensesUSD: number;
    thisMonthCollectionsUSD: number;
    thisMonthNetCashFlowUSD: number;
  };
  accounts?: FinancialAccount[];
  exchangeRates?: Record<string, number>;
  onEditBalance?: (account: FinancialAccount) => void;
  onViewLedger?: (account: FinancialAccount) => void;
  onOpenAddAccount?: () => void;
}

export const KPIGrid: React.FC<KPIGridProps> = ({
  metrics,
  accounts = [],
  exchangeRates = { USD: 1.0, PKR: 278.5, EUR: 0.92, GBP: 0.79 },
  onEditBalance,
  onViewLedger,
  onOpenAddAccount,
}) => {
  const recoveryRate =
    metrics.totalBusinessBookedUSD > 0
      ? (metrics.totalPaymentsReceivedUSD / metrics.totalBusinessBookedUSD) * 100
      : 0;

  return (
    <div className="space-y-5">
      {/* SECTION 1: PRIMARY FINANCIAL COMMAND CARDS (Spacious 4-Card Executive Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL CURRENT AVAILABLE BALANCE (HERO CARD) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white p-5 rounded-2xl shadow-md border border-slate-800/80 hover:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                Total Current Balance
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-blue-300 backdrop-blur-md">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="text-3xl font-black text-white tracking-tight my-1">
            {formatCurrency(metrics.availableBalanceUSD, 'USD')}
          </div>

          <p className="text-[11px] text-slate-300 font-medium">
            All account balances, including booked Fiverr projects
          </p>

          {/* Quick Category Balance Micro-Badges */}
          <div className="grid grid-cols-2 gap-1.5 pt-3 mt-3 border-t border-slate-800/80 text-[10px]">
            <div className="bg-white/5 px-2 py-1 rounded-md text-slate-300 flex justify-between">
              <span className="text-emerald-400 font-bold">Fiverr:</span>
              <span className="font-semibold">{formatCurrency(metrics.totalFiverrBalanceUSD, 'USD')}</span>
            </div>
            <div className="bg-white/5 px-2 py-1 rounded-md text-slate-300 flex justify-between">
              <span className="text-amber-400 font-bold">Payoneer:</span>
              <span className="font-semibold">{formatCurrency(metrics.totalPayoneerBalanceUSD, 'USD')}</span>
            </div>
            <div className="bg-white/5 px-2 py-1 rounded-md text-slate-300 flex justify-between">
              <span className="text-blue-400 font-bold">Bank:</span>
              <span className="font-semibold">{formatCurrency(metrics.totalBankBalanceUSD, 'USD')}</span>
            </div>
            <div className="bg-white/5 px-2 py-1 rounded-md text-slate-300 flex justify-between">
              <span className="text-purple-400 font-bold">Cash:</span>
              <span className="font-semibold">{formatCurrency(metrics.totalPettyCashBalanceUSD, 'USD')}</span>
            </div>
          </div>
        </div>

        {/* Card 2: TOTAL BUSINESS BOOKED */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Business Booked
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>

          <div className="text-3xl font-black text-slate-900 tracking-tight my-1">
            {formatCurrency(metrics.totalBusinessBookedUSD, 'USD')}
          </div>

          <div className="flex items-center justify-between text-xs mt-2 text-slate-500 font-medium">
            <span>This Month:</span>
            <span className="font-extrabold text-blue-700">
              {formatCurrency(metrics.thisMonthBookedUSD, 'USD')}
            </span>
          </div>

          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{metrics.totalProjectsCount} Total Projects</span>
            <span className="font-semibold text-slate-700">{metrics.activeProjectsCount} In Progress</span>
          </div>
        </div>

        {/* Card 3: PAYMENTS RECEIVED & RECOVERY */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Payments Collected
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="text-3xl font-black text-emerald-800 tracking-tight my-1">
            {formatCurrency(metrics.totalPaymentsReceivedUSD, 'USD')}
          </div>

          <div className="flex items-center justify-between text-xs mt-2 text-slate-500 font-medium">
            <span>This Month:</span>
            <span className="font-extrabold text-emerald-700">
              +{formatCurrency(metrics.thisMonthCollectionsUSD, 'USD')}
            </span>
          </div>

          <div className="pt-2 mt-2 border-t border-slate-100">
            <div className="flex justify-between text-[10px] text-slate-500 font-bold mb-1">
              <span>Collection Progress</span>
              <span>{recoveryRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, recoveryRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: OUTSTANDING CLIENT RECEIVABLES */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Outstanding Receivables
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div
            className={`text-3xl font-black tracking-tight my-1 ${
              metrics.outstandingPaymentsUSD > 0 ? 'text-amber-800' : 'text-slate-400'
            }`}
          >
            {formatCurrency(metrics.outstandingPaymentsUSD, 'USD')}
          </div>

          <div className="flex items-center justify-between text-xs mt-2 text-slate-500 font-medium">
            <span>Uncollected Balance:</span>
            <span
              className={`font-extrabold ${
                metrics.outstandingPaymentsUSD > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {metrics.outstandingPaymentsUSD > 0 ? 'Payment Pending' : 'Fully Settled'}
            </span>
          </div>

          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Active Clients</span>
            <span className="font-semibold text-slate-700">{metrics.totalClientsCount} Registered</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: OPERATING CASH FLOW & EXPENSES MINI-METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Operating Expenses */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center font-bold shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                Total Operating Expenses
              </span>
              <div className="text-xl font-extrabold text-rose-800">
                -{formatCurrency(metrics.totalExpensesUSD, 'USD')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                This Month: -{formatCurrency(metrics.thisMonthExpensesUSD, 'USD')}
              </div>
            </div>
          </div>
        </div>

        {/* Net Cash Flow (Inflow - Outflow) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                metrics.thisMonthNetCashFlowUSD >= 0
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-rose-50 text-rose-600 border border-rose-100'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Monthly Net Cash Flow
              </span>
              <div
                className={`text-xl font-extrabold ${
                  metrics.thisMonthNetCashFlowUSD >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {metrics.thisMonthNetCashFlowUSD >= 0 ? '+' : ''}
                {formatCurrency(metrics.thisMonthNetCashFlowUSD, 'USD')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {metrics.thisMonthNetCashFlowUSD >= 0 ? 'Operating Surplus' : 'Operating Deficit'}
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Deductions & Fees */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center font-bold shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Transfer Fees & Deductions
              </span>
              <div className="text-xl font-extrabold text-slate-900">
                {formatCurrency(metrics.totalTransferDeductionsUSD, 'USD')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Total platform withdrawal spread
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: LIVE ACCOUNT BALANCES COMMAND STRIP */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Live Financial Accounts & Current Balances ({accounts.length})
            </h3>
          </div>
          {onOpenAddAccount && (
            <button
              onClick={onOpenAddAccount}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Account
            </button>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">No financial accounts created yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Click "+ Add Account" to register your Fiverr, Payoneer, or Bank accounts with their opening balances.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {accounts.map((acc) => {
              const badgeColors = getAccountTypeBadgeClass(acc.type);
              const isUSD = acc.currency === 'USD';
              const usdVal = convertToUSD(acc.currentBalance, acc.currency, exchangeRates);

              return (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {acc.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider border ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}
                      >
                        {acc.type}
                      </span>
                    </div>

                    <div className="text-lg font-black text-slate-900 tracking-tight my-1">
                      {formatCurrency(acc.currentBalance, acc.currency)}
                    </div>
                    {!isUSD && (
                      <div className="text-[10px] text-slate-500 font-semibold">
                        ≈ {formatCurrency(usdVal, 'USD')}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                    {onEditBalance && (
                      <button
                        onClick={() => onEditBalance(acc)}
                        className="text-slate-600 hover:text-blue-600 font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <SlidersHorizontal className="w-3 h-3" /> Edit Balance
                      </button>
                    )}
                    {onViewLedger && (
                      <button
                        onClick={() => onViewLedger(acc)}
                        className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <History className="w-3 h-3" /> Ledger
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
