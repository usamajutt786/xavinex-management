import { convertToUSD } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import React, { useState } from 'react';
import { Expense, FinancialAccount } from '../../types';
import { formatCurrency, formatDate, getAccountFullName } from '../../utils/formatters';
import { exportToCSV } from '../../utils/export';
import { EmptyState } from '../common/EmptyState';
import { Receipt, Search, Plus, Download, Trash2, Tag } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  accounts: FinancialAccount[];
  categories: string[];
  onOpenCreateExpense: () => void;
  onDeleteExpense: (id: string) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  accounts,
  categories,
  onOpenCreateExpense,
  onDeleteExpense,
}) => {
  const { settings } = useData();
  const rates = settings.exchangeRates;
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.subcategory && e.subcategory.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.description && e.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.receiptNumber && e.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesAccount = accountFilter === 'all' || e.payingAccountId === accountFilter;

    return matchesSearch && matchesCategory && matchesAccount;
  });

  const totalFilteredUSD = filteredExpenses.reduce((sum, e) => sum + convertToUSD(e.amount, e.currency, rates), 0);

  const handleExportCSV = () => {
    const rows = filteredExpenses.map((e) => {
      const paying = accounts.find((a) => a.id === e.payingAccountId);
      return {
        Expense_ID: e.id,
        Date: e.date,
        Title: e.title,
        Category: e.category,
        Subcategory: e.subcategory || '',
        Amount: e.amount,
        Currency: e.currency,
        Paying_Account: paying ? paying.name : e.payingAccountId,
        Paying_Account_Type: paying ? paying.type : '',
        Receipt_Number: e.receiptNumber || '',
        Description: e.description || '',
      };
    });
    exportToCSV('Company_Expenses_Report', rows);
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses by title, receipt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white max-w-44 truncate"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {accounts.length > 0 && (
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white max-w-44 truncate"
            >
              <option value="all">All Paying Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button
            onClick={handleExportCSV}
            disabled={filteredExpenses.length === 0}
            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={onOpenCreateExpense}
            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No Expenses Recorded"
          description="Track operational expenses, software subscriptions, HR costs, and office supplies. Expenses automatically deduct from the designated financial account."
          actionText="Record First Expense"
          onAction={onOpenCreateExpense}
        />
      ) : filteredExpenses.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          No expenses match your search or filter options.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Title & Details</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Paid From</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => {
                  const paying = accounts.find((a) => a.id === exp.payingAccountId);

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatDate(exp.date)}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{exp.title}</div>
                        {(exp.description || exp.receiptNumber) && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {exp.receiptNumber ? `Receipt: #${exp.receiptNumber} ` : ''}
                            {exp.description}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {exp.category}
                        </span>
                        {exp.subcategory && (
                          <div className="text-[10px] text-slate-400 mt-0.5 pl-1">
                            {exp.subcategory}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {paying ? paying.name : 'Unknown Account'}
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize">
                          {paying ? paying.type : ''}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                        -{formatCurrency(exp.amount, exp.currency)}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete expense "${exp.title}"? The amount will be reversed back to ${paying?.name || 'the paying account'}.`)) {
                              onDeleteExpense(exp.id);
                            }
                          }}
                          title="Delete & Reverse Expense"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
