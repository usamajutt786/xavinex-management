import React, { useState, useEffect } from 'react';
import { FinancialAccount, AccountType, Currency } from '../../types';
import { Modal } from '../common/Modal';
import { getAccountTypeLabel } from '../../utils/formatters';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<FinancialAccount, 'id' | 'currentBalance' | 'createdAt'>) => Promise<void>;
  initialType?: AccountType;
  accountToEdit?: FinancialAccount | null;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialType = 'fiverr',
  accountToEdit,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(initialType);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (accountToEdit) {
      setName(accountToEdit.name);
      setType(accountToEdit.type);
      setCurrency(accountToEdit.currency);
      setOpeningBalance(String(accountToEdit.openingBalance));
      setStatus(accountToEdit.status);
      setNotes(accountToEdit.notes || '');
    } else {
      setName('');
      setType(initialType);
      setCurrency('USD');
      setOpeningBalance('0');
      setStatus('active');
      setNotes('');
    }
  }, [accountToEdit, initialType, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
    await onSave({
      name: name.trim(),
      type,
      currency,
      openingBalance: parseFloat(openingBalance) || 0,
      status,
      notes: notes.trim() || undefined,
    });
    onClose();
    } catch (e) { alert((e as Error).message); }
  };

  const isEditing = !!accountToEdit;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Financial Account' : 'Create Financial Account'}
      subtitle="Configure an individual account for accurate financial tracking."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Account Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Salman, Abdur Rahman, Habib Bank Ltd, Petty Cash Office"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Account Type *
            </label>
            <select
              value={type}
              disabled={isEditing}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white disabled:bg-slate-100"
            >
              <option value="fiverr">Fiverr Account</option>
              <option value="payoneer">Payoneer Account</option>
              <option value="bank">Bank Account</option>
              <option value="petty_cash">Business Petty Cash</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Currency *
            </label>
            <select
              value={currency}
              disabled={isEditing}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white disabled:bg-slate-100"
            >
              <option value="USD">USD ($)</option>
              <option value="PKR">PKR (₨)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>

        {!isEditing && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Opening Balance ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Initial balance will be recorded as of creation date. You can also adjust it anytime.
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Account Status *
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
          >
            <option value="active">Active (Available for transfers & payments)</option>
            <option value="inactive">Inactive (Archived)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Notes / Description (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Account holder details, IBAN/ID or designated usage notes..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden resize-none"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
          >
            {isEditing ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
