import React from 'react';
import { FinancialAccount } from '../../types';
import {
  formatCurrency,
  getAccountTypeBadgeClass,
  getAccountTypeLabel,
  convertToUSD,
} from '../../utils/formatters';
import {
  SlidersHorizontal,
  History,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Building2,
  DollarSign,
  Wallet,
  Globe,
  ArrowRightLeft,
  CreditCard,
} from 'lucide-react';

interface AccountCardProps {
  account: FinancialAccount;
  monthlyInflow: number;
  monthlyOutflow: number;
  exchangeRates: Record<string, number>;
  onEditBalance: (account: FinancialAccount) => void;
  onViewLedger: (account: FinancialAccount) => void;
  onEditAccount: (account: FinancialAccount) => void;
  onTransferFrom?: (account: FinancialAccount) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  monthlyInflow,
  monthlyOutflow,
  exchangeRates,
  onEditBalance,
  onViewLedger,
  onEditAccount,
  onTransferFrom,
}) => {
  const badgeColors = getAccountTypeBadgeClass(account.type);
  const isUSD = account.currency === 'USD';
  const usdValue = convertToUSD(account.currentBalance, account.currency, exchangeRates);

  const getAccountIcon = () => {
    switch (account.type) {
      case 'fiverr':
        return <Globe className="w-4 h-4 text-emerald-600" />;
      case 'payoneer':
        return <DollarSign className="w-4 h-4 text-amber-600" />;
      case 'bank':
        return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'petty_cash':
        return <Wallet className="w-4 h-4 text-purple-600" />;
    }
  };

  const getAccentColor = () => {
    switch (account.type) {
      case 'fiverr':
        return 'bg-emerald-500';
      case 'payoneer':
        return 'bg-amber-500';
      case 'bank':
        return 'bg-blue-600';
      case 'petty_cash':
        return 'bg-purple-600';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all p-5 flex flex-col justify-between group relative overflow-hidden">
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${getAccentColor()}`} />

      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200/80 shrink-0 shadow-2xs">
              {getAccountIcon()}
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                {account.name}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}
                >
                  {getAccountTypeLabel(account.type)}
                </span>
                {account.status === 'inactive' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => onEditAccount(account)}
            title="Edit Account Details"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Current Balance Display */}
        <div className="my-3.5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-3.5 border border-slate-200/70">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
            Current Available Balance
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(account.currentBalance, account.currency)}
          </div>
          {!isUSD && (
            <div className="text-xs text-slate-500 mt-0.5 font-semibold">
              ≈ {formatCurrency(usdValue, 'USD')} (USD Reference)
            </div>
          )}
        </div>

        {/* Monthly Activity Tiles */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              This Month Inflow
            </span>
            <div className="text-xs font-black text-emerald-900">
              +{formatCurrency(monthlyInflow, account.currency)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
            <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1 mb-0.5">
              <TrendingDown className="w-3 h-3 text-rose-600" />
              This Month Outflow
            </span>
            <div className="text-xs font-black text-rose-900">
              -{formatCurrency(monthlyOutflow, account.currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={() => onEditBalance(account)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          Edit Balance
        </button>
        <button
          onClick={() => onViewLedger(account)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/80 rounded-xl hover:bg-blue-100 active:bg-blue-200 transition-colors cursor-pointer"
        >
          <History className="w-3.5 h-3.5 text-blue-600" />
          Ledger
        </button>
      </div>
    </div>
  );
};
