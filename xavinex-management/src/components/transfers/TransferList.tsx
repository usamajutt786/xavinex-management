import React, { useState } from 'react';
import { FundTransfer, FinancialAccount } from '../../types';
import { formatCurrency, formatDate, getAccountFullName } from '../../utils/formatters';
import { exportToCSV } from '../../utils/export';
import { EmptyState } from '../common/EmptyState';
import { ArrowRightLeft, Search, Plus, Download, ArrowRight } from 'lucide-react';

interface TransferListProps {
  transfers: FundTransfer[];
  accounts: FinancialAccount[];
  onOpenCreateTransfer: () => void;
}

export const TransferList: React.FC<TransferListProps> = ({
  transfers,
  accounts,
  onOpenCreateTransfer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransfers = transfers.filter((t) => {
    const source = accounts.find((a) => a.id === t.sourceAccountId);
    const dest = accounts.find((a) => a.id === t.destinationAccountId);

    const matchesSearch =
      (source && source.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dest && dest.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.feeCategory && t.feeCategory.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  const handleExportCSV = () => {
    const rows = filteredTransfers.map((t) => {
      const source = accounts.find((a) => a.id === t.sourceAccountId);
      const dest = accounts.find((a) => a.id === t.destinationAccountId);
      return {
        Transfer_ID: t.id,
        Date: t.transferDate,
        Source_Account: source ? source.name : t.sourceAccountId,
        Source_Type: source ? source.type : '',
        Source_Amount: t.sourceAmount,
        Source_Currency: t.sourceCurrency,
        Destination_Account: dest ? dest.name : t.destinationAccountId,
        Destination_Type: dest ? dest.type : '',
        Destination_Credited_Amount: t.destinationCreditedAmount,
        Destination_Currency: t.destinationCurrency,
        Deduction_Difference: t.difference,
        Deduction_Percentage: t.deductionPercentage ? `${t.deductionPercentage.toFixed(2)}%` : '',
        Exchange_Rate: t.effectiveExchangeRate || '',
        Fee_Category: t.feeCategory || '',
        Notes: t.notes || '',
      };
    });
    exportToCSV('Fund_Transfers_Report', rows);
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search transfers by account, category, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            disabled={filteredTransfers.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={onOpenCreateTransfer}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Transfer
          </button>
        </div>
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title="No Fund Transfers Recorded"
          description="Transfer money between your accounts (Fiverr → Payoneer, Payoneer → Payoneer, or to Bank/Cash) with separate deduction calculation."
          actionText="Initiate First Transfer"
          onAction={onOpenCreateTransfer}
        />
      ) : filteredTransfers.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          No transfers match your search query.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Source Account</th>
                  <th className="py-3 px-3">Destination Account</th>
                  <th className="py-3 px-3 text-right">Source Amount</th>
                  <th className="py-3 px-3 text-right">Credited Amount</th>
                  <th className="py-3 px-3 text-right">Fee / Deduction</th>
                  <th className="py-3 px-3">Category / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransfers.map((t) => {
                  const source = accounts.find((a) => a.id === t.sourceAccountId);
                  const dest = accounts.find((a) => a.id === t.destinationAccountId);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatDate(t.transferDate)}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {source ? source.name : 'Unknown Account'}
                        </div>
                        <span className="inline-block text-[10px] text-slate-500 capitalize">
                          {source ? source.type : ''}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {dest ? dest.name : 'Unknown Account'}
                        </div>
                        <span className="inline-block text-[10px] text-slate-500 capitalize">
                          {dest ? dest.type : ''}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                        -{formatCurrency(t.sourceAmount, t.sourceCurrency)}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        +{formatCurrency(t.destinationCreditedAmount, t.destinationCurrency)}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {t.difference > 0 ? (
                          <span className="font-semibold text-amber-700">
                            {formatCurrency(t.difference, t.sourceCurrency)} ({t.deductionPercentage.toFixed(1)}%)
                          </span>
                        ) : t.effectiveExchangeRate ? (
                          <span className="text-[11px] text-blue-700 font-medium">
                            {t.effectiveExchangeRate.toFixed(2)} rate
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 max-w-xs truncate text-slate-600">
                        <div className="font-medium text-slate-800 truncate">{t.feeCategory || 'Transfer'}</div>
                        {t.notes && <div className="text-[11px] text-slate-400 truncate">{t.notes}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
