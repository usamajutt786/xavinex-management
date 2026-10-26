import React, { useState, useEffect } from 'react';
import { businessDate } from '../../utils/formatters';
import { Expense, FinancialAccount, Currency } from '../../types';
import { Modal } from '../common/Modal';
import { formatCurrency, getAccountFullName } from '../../utils/formatters';
import { AlertCircle, Plus } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  categories: string[];
  onSaveExpense: (data: Omit<Expense, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories,
  onSaveExpense,
}) => {
  const activeAccounts = accounts.filter((a) => a.status === 'active' && ['bank', 'petty_cash'].includes(a.type));

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Utilities and Office Operations');
  const [subcategory, setSubcategory] = useState('');
  const [amount, setAmount] = useState('50');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [date, setDate] = useState(businessDate());
  const [payingAccountId, setPayingAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCategory(categories[0] || 'Utilities and Office Operations');
      setSubcategory('');
      setAmount('50');
      setCurrency('USD');
      setDate(businessDate());
      setPayingAccountId(activeAccounts.length > 0 ? activeAccounts[0].id : '');
      setDescription('');
      setReceiptNumber('');
      setNotes('');
      setError('');
    }
  }, [isOpen, categories]);

  const payingAccount = accounts.find((a) => a.id === payingAccountId);

  // Sync currency with paying account
  useEffect(() => {
    if (payingAccount) {
      setCurrency(payingAccount.currency);
    }
  }, [payingAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Expense title is required.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please provide a positive expense amount.');
      return;
    }

    if (!payingAccountId) {
      setError('Please select a paying financial account.');
      return;
    }

    const res = await onSaveExpense({
      title: title.trim(),
      category,
      subcategory: subcategory.trim() || undefined,
      amount: numAmount,
      currency,
      date,
      payingAccountId,
      description: description.trim() || undefined,
      receiptNumber: receiptNumber.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    if (!res.success) {
      setError(res.error || 'Failed to record expense.');
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Business Expense"
      subtitle="Deduct expenses directly from bank, cash, or payment accounts with automatic category accounting."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {activeAccounts.length === 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Please create at least one financial account before recording expenses.</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Expense Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. High-speed Fiber Internet, Team Lunch, Server Subscription, Office Stationery"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subcategory (Optional)
            </label>
            <input
              type="text"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="e.g. Electricity, AWS Hosting, Contractor Fee"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Paying Financial Account *
            </label>
            <select
              required
              value={payingAccountId}
              onChange={(e) => setPayingAccountId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="" disabled>Select Paying Account</option>
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {getAccountFullName(acc)} ({formatCurrency(acc.currentBalance, acc.currency)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>
        </div>

        {payingAccount && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
            <span className="text-slate-600">Paying Account Available Balance:</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(payingAccount.currentBalance, payingAccount.currency)} →{' '}
              <span className={payingAccount.currentBalance - (parseFloat(amount) || 0) < 0 ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                {formatCurrency(payingAccount.currentBalance - (parseFloat(amount) || 0), payingAccount.currency)}
              </span>
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receipt / Invoice # (Optional)
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. INV-2026-904"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional expense remarks..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={activeAccounts.length === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
          >
            Record Expense
          </button>
        </div>
      </form>
    </Modal>
  );
};
