import React, { useState } from 'react';
import { FinancialAccount, AccountTransaction } from '../../types';
import { Modal } from '../common/Modal';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getAccountFullName,
} from '../../utils/formatters';
import { exportToCSV } from '../../utils/export';
import { Download, Search, Filter, ArrowUpRight, ArrowDownLeft, RotateCcw } from 'lucide-react';

interface AccountLedgerModalProps {
  account: FinancialAccount | null;
  isOpen: boolean;
  onClose: () => void;
  transactions: AccountTransaction[];
}

export const AccountLedgerModal: React.FC<AccountLedgerModalProps> = ({
  account,
  isOpen,
  onClose,
  transactions,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  if (!account) return null;

  // Filter transactions belonging to this account
  const accountTxs = transactions.filter(
    (tx) => tx.accountId === account.id
  );

  const filtered = accountTxs.filter((tx) => {
    const matchesSearch =
      (tx.notes && tx.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.clientName && tx.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.projectName && tx.projectName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.type.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleExportCSV = () => {
    const rows = filtered.map((tx) => ({
      Transaction_ID: tx.id,
      Date: tx.date,
      Time: tx.timestamp,
      Type: tx.type,
      Account: account.name,
      Account_Type: account.type,
      Amount: tx.amount,
      Currency: tx.currency,
      Balance_After: tx.balanceAfter,
      Difference_Fee: tx.fees || tx.difference || 0,
      Counterparty_Account: tx.sourceAccountId === account.id ? tx.destinationAccountName : tx.sourceAccountName || '',
      Client: tx.clientName || '',
      Project: tx.projectName || '',
      Notes: tx.notes || '',
    }));
    exportToCSV(`Ledger_${account.name.replace(/\s+/g, '_')}`, rows);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${account.name} — Transaction Ledger`}
      subtitle={`Current Available Balance: ${formatCurrency(account.currentBalance, account.currency)} (${account.type.toUpperCase()})`}
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="all">All Types</option>
              <option value="project_booking">Project Bookings</option>
              <option value="project_adjustment">Project Adjustments</option>
              <option value="client_payment">Client Payments</option>
              <option value="internal_transfer">Transfers</option>
              <option value="expense">Expenses</option>
              <option value="manual_balance_adjustment">Adjustments</option>
              <option value="opening_balance">Opening Balance</option>
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
        </div>

        {/* Ledger Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description / Counterparty</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3.5 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No transaction records found for this account.
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => {
                    const isInflow = tx.amount > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                          <span className="font-medium text-slate-800">{formatDate(tx.date)}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-slate-100 text-slate-700">
                            {tx.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                          <div className="font-medium text-slate-800 truncate">
                            {tx.notes || 'Transaction'}
                          </div>
                          {(tx.clientName || tx.projectName) && (
                            <div className="text-[11px] text-slate-400 truncate">
                              {tx.clientName} {tx.projectName ? `• ${tx.projectName}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                          <span className={isInflow ? 'text-emerald-600' : 'text-rose-600'}>
                            {isInflow ? '+' : ''}
                            {formatCurrency(tx.amount, tx.currency)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-medium text-slate-800 whitespace-nowrap">
                          {formatCurrency(tx.balanceAfter, tx.currency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Showing {filtered.length} of {accountTxs.length} records</span>
          <span className="font-medium">Account ID: {account.id}</span>
        </div>
      </div>
    </Modal>
  );
};
