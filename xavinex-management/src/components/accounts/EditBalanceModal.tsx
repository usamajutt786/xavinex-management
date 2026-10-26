import React, { useState, useEffect } from 'react';
import { businessDate } from '../../utils/formatters';
import { FinancialAccount } from '../../types';
import { Modal } from '../common/Modal';
import { formatCurrency, getAccountFullName } from '../../utils/formatters';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface EditBalanceModalProps {
  account: FinancialAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onAdjustBalance: (accountId: string, newBalance: number, reason: string, date: string) => Promise<void>;
  onEditOpeningBalance: (accountId: string, newOpeningBalance: number) => Promise<void>;
}

export const EditBalanceModal: React.FC<EditBalanceModalProps> = ({
  account,
  isOpen,
  onClose,
  onAdjustBalance,
  onEditOpeningBalance,
}) => {
  const [mode, setMode] = useState<'adjustment' | 'opening'>('adjustment');
  const [newBalance, setNewBalance] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [date, setDate] = useState<string>(businessDate());
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (account && isOpen) {
      setNewBalance(mode === 'adjustment' ? String(account.currentBalance) : String(account.openingBalance));
      setReason('');
      setDate(businessDate());
      setStep('input');
      setError('');
    }
  }, [account, isOpen, mode]);

  if (!account) return null;

  const currentVal = mode === 'adjustment' ? account.currentBalance : account.openingBalance;
  const parsedNew = parseFloat(newBalance);
  const diff = !isNaN(parsedNew) ? parsedNew - currentVal : 0;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedNew)) {
      setError('Please enter a valid numeric balance.');
      return;
    }
    if (mode === 'adjustment' && !reason.trim()) {
      setError('Please provide a reason for the manual balance adjustment.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    try {
    if (mode === 'adjustment') {
      await onAdjustBalance(account.id, parsedNew, reason.trim(), date);
    } else {
      await onEditOpeningBalance(account.id, parsedNew);
    }
    onClose();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Account Balance"
      subtitle={getAccountFullName(account)}
      maxWidth="md"
    >
      {/* Mode toggle */}
      <div className="flex bg-slate-100 p-1 rounded-lg mb-5 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setMode('adjustment');
            setStep('input');
            setNewBalance(String(account.currentBalance));
          }}
          className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
            mode === 'adjustment' ? 'bg-white text-slate-800 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Manual Balance Adjustment
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('opening');
            setStep('input');
            setNewBalance(String(account.openingBalance));
          }}
          className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
            mode === 'opening' ? 'bg-white text-slate-800 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Correct Opening Balance
        </button>
      </div>

      {step === 'input' ? (
        <form onSubmit={handleProceedToConfirm} className="space-y-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 mb-1">
              {mode === 'adjustment' ? 'Current Recorded Balance' : 'Current Opening Balance'}
            </div>
            <div className="text-lg font-bold text-slate-900">
              {formatCurrency(currentVal, account.currency)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {mode === 'adjustment' ? 'New Current Balance' : 'Corrected Opening Balance'} ({account.currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-medium"
              placeholder="0.00"
            />
          </div>

          {/* Real-time difference preview */}
          {!isNaN(parsedNew) && (
            <div className="flex items-center justify-between p-3 rounded-lg border text-xs bg-slate-50/80 border-slate-200">
              <span className="text-slate-600 font-medium">Calculated Difference:</span>
              <span
                className={`font-semibold ${
                  diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-600'
                }`}
              >
                {diff > 0 ? '+' : ''}
                {formatCurrency(diff, account.currency)}
              </span>
            </div>
          )}

          {mode === 'adjustment' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Effective Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Bank statement reconciliation, missed withdrawal fee correction"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Review Changes
            </button>
          </div>
        </form>
      ) : (
        /* Confirmation step */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Confirm Balance Modification
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              This action will create an immutable audit record in the account transaction ledger. Past transactions will remain intact and reporting balances will be recalculated.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Account:</span>
              <span className="font-semibold text-slate-800">{getAccountFullName(account)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Operation:</span>
              <span className="font-medium text-slate-700">
                {mode === 'adjustment' ? 'Manual Balance Adjustment' : 'Opening Balance Correction'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Current Balance:</span>
              <span className="text-slate-700 line-through">
                {formatCurrency(currentVal, account.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
              <span className="font-medium text-slate-700">New Balance:</span>
              <span className="text-sm font-bold text-slate-900">
                {formatCurrency(parsedNew, account.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Net Adjustment:</span>
              <span
                className={`font-bold ${
                  diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-600'
                }`}
              >
                {diff > 0 ? '+' : ''}
                {formatCurrency(diff, account.currency)}
              </span>
            </div>
            {mode === 'adjustment' && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Effective Date:</span>
                  <span className="text-slate-800">{date}</span>
                </div>
                <div className="text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Reason:</span>
                  <span className="text-slate-800 font-medium italic">"{reason}"</span>
                </div>
              </>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep('input')}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirm & Save Adjustment
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
