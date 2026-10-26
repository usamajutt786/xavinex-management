import React, { useState, useEffect } from 'react';
import { businessDate } from '../../utils/formatters';
import { FinancialAccount, FundTransfer } from '../../types';
import { Modal } from '../common/Modal';
import {
  formatCurrency,
  getAccountFullName,
  getAccountTypeBadgeClass,
  getAccountTypeLabel,
  isTransferAllowed,
} from '../../utils/formatters';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Building2,
  Globe,
  Wallet,
} from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  onRecordTransfer: (data: {
    sourceAccountId: string;
    destinationAccountId: string;
    transferDate: string;
    sourceAmount: number;
    destinationCreditedAmount: number;
    feeCategory?: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onRecordTransfer,
}) => {
  const activeAccounts = accounts.filter((a) => a.status === 'active');

  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [sourceAmount, setSourceAmount] = useState('200');
  const [destinationCreditedAmount, setDestinationCreditedAmount] = useState('160');
  const [transferDate, setTransferDate] = useState(businessDate());
  const [feeCategory, setFeeCategory] = useState('Platform Withdrawal Fee');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [error, setError] = useState('');

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);

  // Dynamic Destination Filter based on Source Account Type
  const eligibleDestinationAccounts = activeAccounts.filter((dest) => {
    if (!sourceAccount) return false;
    if (dest.id === sourceAccount.id) return false; // Prohibit self-transfer

    const rule = isTransferAllowed(sourceAccount.type, dest.type);
    return rule.allowed;
  });

  useEffect(() => {
    if (isOpen) {
      if (activeAccounts.length > 0) {
        // Pick first active account as source
        const defaultSource = activeAccounts[0];
        setSourceAccountId(defaultSource.id);

        // Find first eligible destination
        const validDest = activeAccounts.find((a) => {
          if (a.id === defaultSource.id) return false;
          return isTransferAllowed(defaultSource.type, a.type).allowed;
        });

        setDestinationAccountId(validDest ? validDest.id : '');
      } else {
        setSourceAccountId('');
        setDestinationAccountId('');
      }

      setSourceAmount('200');
      setDestinationCreditedAmount('160');
      setTransferDate(businessDate());
      setFeeCategory('Platform Withdrawal Fee');
      setNotes('');
      setStep('form');
      setError('');
    }
  }, [isOpen]);

  // When source changes, ensure destination is valid
  const handleSourceChange = (newSourceId: string) => {
    setSourceAccountId(newSourceId);
    const newSource = accounts.find((a) => a.id === newSourceId);
    if (!newSource) return;

    const validDest = activeAccounts.find((a) => {
      if (a.id === newSource.id) return false;
      return isTransferAllowed(newSource.type, a.type).allowed;
    });

    setDestinationAccountId(validDest ? validDest.id : '');
  };

  const destinationAccount = accounts.find((a) => a.id === destinationAccountId);

  // Transfer math
  const numSourceAmount = parseFloat(sourceAmount) || 0;
  const numDestAmount = parseFloat(destinationCreditedAmount) || 0;

  const isSameCurrency = sourceAccount && destinationAccount && sourceAccount.currency === destinationAccount.currency;
  const difference = isSameCurrency ? Math.max(0, numSourceAmount - numDestAmount) : 0;
  const deductionPct = isSameCurrency && numSourceAmount > 0 ? (difference / numSourceAmount) * 100 : 0;
  const effectiveExchangeRate = !isSameCurrency && numSourceAmount > 0 ? numDestAmount / numSourceAmount : null;

  // Projected balances
  const sourceProjected = sourceAccount ? sourceAccount.currentBalance - numSourceAmount : 0;
  const destProjected = destinationAccount ? destinationAccount.currentBalance + numDestAmount : 0;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!sourceAccount || !destinationAccount) {
      setError('Please select both valid source and destination accounts.');
      return;
    }

    if (sourceAccount.id === destinationAccount.id) {
      setError('Source and destination accounts cannot be the same.');
      return;
    }

    // MANDATORY PROHIBITION CHECK
    if (sourceAccount.type === 'fiverr' && destinationAccount.type === 'fiverr') {
      setError('Fiverr to Fiverr transfers are strictly prohibited.');
      return;
    }

    const rule = isTransferAllowed(sourceAccount.type, destinationAccount.type);
    if (!rule.allowed) {
      setError(rule.reason || 'This transfer combination is prohibited.');
      return;
    }

    if (numSourceAmount <= 0) {
      setError('Source amount must be greater than zero.');
      return;
    }

    if (numDestAmount <= 0) {
      setError('Destination credited amount must be greater than zero.');
      return;
    }

    if (sourceAccount.currentBalance < numSourceAmount) {
      setError(
        `Insufficient funds in ${sourceAccount.name}. Available: ${formatCurrency(
          sourceAccount.currentBalance,
          sourceAccount.currency
        )}, Required: ${formatCurrency(numSourceAmount, sourceAccount.currency)}`
      );
      return;
    }

    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    const res = await onRecordTransfer({
      sourceAccountId,
      destinationAccountId,
      transferDate,
      sourceAmount: numSourceAmount,
      destinationCreditedAmount: numDestAmount,
      feeCategory,
      notes: notes.trim() || undefined,
    });

    if (!res.success) {
      setError(res.error || 'Failed to complete transfer.');
      setStep('form');
    } else {
      onClose();
    }
  };

  const getAccountIcon = (type?: string) => {
    switch (type) {
      case 'fiverr':
        return <Globe className="w-4 h-4 text-emerald-600" />;
      case 'payoneer':
        return <DollarSign className="w-4 h-4 text-amber-600" />;
      case 'bank':
        return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'petty_cash':
        return <Wallet className="w-4 h-4 text-purple-600" />;
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Funds Between Accounts"
      subtitle="Strict routing: Fiverr → Payoneer, Payoneer → Payoneer/Bank, Bank ↔ Cash. Fiverr → Fiverr is prohibited."
      maxWidth="xl"
    >
      {step === 'form' ? (
        <form onSubmit={handleProceedToConfirm} className="space-y-4">
          {/* Source and Destination Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SOURCE ACCOUNT PANEL */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Source Account (From)
                </span>
                {sourceAccount && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    Avail: {formatCurrency(sourceAccount.currentBalance, sourceAccount.currency)}
                  </span>
                )}
              </div>

              <select
                required
                value={sourceAccountId}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
              >
                <option value="" disabled>Select Source Account</option>
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {getAccountFullName(acc)} ({formatCurrency(acc.currentBalance, acc.currency)})
                  </option>
                ))}
              </select>

              {sourceAccount && (
                <div className="pt-1 text-xs text-slate-600 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getAccountIcon(sourceAccount.type)}
                    <span className="font-semibold text-slate-800">{sourceAccount.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 text-slate-700">
                    {getAccountTypeLabel(sourceAccount.type)}
                  </span>
                </div>
              )}
            </div>

            {/* DESTINATION ACCOUNT PANEL */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Destination Account (To)
                </span>
                {destinationAccount && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    Avail: {formatCurrency(destinationAccount.currentBalance, destinationAccount.currency)}
                  </span>
                )}
              </div>

              <select
                required
                value={destinationAccountId}
                onChange={(e) => setDestinationAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
              >
                <option value="" disabled>Select Destination Account</option>
                {eligibleDestinationAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {getAccountFullName(acc)} ({formatCurrency(acc.currentBalance, acc.currency)})
                  </option>
                ))}
              </select>

              {destinationAccount ? (
                <div className="pt-1 text-xs text-slate-600 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getAccountIcon(destinationAccount.type)}
                    <span className="font-semibold text-slate-800">{destinationAccount.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 text-slate-700">
                    {getAccountTypeLabel(destinationAccount.type)}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-amber-700">
                  {sourceAccount?.type === 'fiverr'
                    ? 'Only eligible Payoneer accounts can be selected as destination.'
                    : 'Select a valid destination account.'}
                </p>
              )}
            </div>
          </div>

          {/* Amounts (Entered Separately!) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Amount Deducted ({sourceAccount?.currency || 'USD'}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={sourceAmount}
                onChange={(e) => setSourceAmount(e.target.value)}
                placeholder="200.00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Credited Amount ({destinationAccount?.currency || 'USD'}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={destinationCreditedAmount}
                onChange={(e) => setDestinationCreditedAmount(e.target.value)}
                placeholder="160.00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-bold text-emerald-700"
              />
            </div>
          </div>

          {/* Live Transfer Preview Banner */}
          {sourceAccount && destinationAccount && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Live Transfer Impact Preview
              </span>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="text-slate-500 text-[11px] font-medium">{sourceAccount.name} ({sourceAccount.type})</div>
                  <div className="text-slate-700 font-semibold mt-0.5">
                    {formatCurrency(sourceAccount.currentBalance, sourceAccount.currency)} →{' '}
                    <span className={sourceProjected < 0 ? 'text-rose-600 font-bold' : 'text-slate-900 font-bold'}>
                      {formatCurrency(sourceProjected, sourceAccount.currency)}
                    </span>
                  </div>
                  <div className="text-[10px] text-rose-600 mt-0.5">
                    -{formatCurrency(numSourceAmount, sourceAccount.currency)} deducted
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="text-slate-500 text-[11px] font-medium">{destinationAccount.name} ({destinationAccount.type})</div>
                  <div className="text-slate-700 font-semibold mt-0.5">
                    {formatCurrency(destinationAccount.currentBalance, destinationAccount.currency)} →{' '}
                    <span className="text-emerald-700 font-bold">
                      {formatCurrency(destProjected, destinationAccount.currency)}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">
                    +{formatCurrency(numDestAmount, destinationAccount.currency)} credited
                  </div>
                </div>
              </div>

              {isSameCurrency && difference > 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                  <span>Deduction / Fee:</span>
                  <span className="font-bold">
                    {formatCurrency(difference, sourceAccount.currency)} ({deductionPct.toFixed(1)}%)
                  </span>
                </div>
              )}

              {effectiveExchangeRate !== null && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-medium">
                  <span>Effective Exchange Rate:</span>
                  <span className="font-bold">
                    1 {sourceAccount.currency} = {effectiveExchangeRate.toFixed(2)} {destinationAccount.currency}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Date, Category, Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Date *
              </label>
              <input
                type="date"
                required
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deduction Category
              </label>
              <input
                type="text"
                value={feeCategory}
                onChange={(e) => setFeeCategory(e.target.value)}
                placeholder="Platform Fee, Wire Fee, Conversion Spread"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly withdrawal from Fiverr to Payoneer"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
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
              disabled={!sourceAccount || !destinationAccount}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
            >
              Review Transfer
            </button>
          </div>
        </form>
      ) : (
        /* Confirmation Screen */
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            Please confirm this fund transfer. Both accounts will be atomically updated with debit and credit records.
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Source Account:</span>
              <span className="font-bold text-slate-900">
                {sourceAccount ? getAccountFullName(sourceAccount) : ''}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Destination Account:</span>
              <span className="font-bold text-slate-900">
                {destinationAccount ? getAccountFullName(destinationAccount) : ''}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 pt-2">
              <span className="text-slate-600 font-medium">Source Deducted:</span>
              <span className="font-bold text-rose-700">
                -{formatCurrency(numSourceAmount, sourceAccount?.currency || 'USD')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Destination Credited:</span>
              <span className="font-bold text-emerald-700">
                +{formatCurrency(numDestAmount, destinationAccount?.currency || 'USD')}
              </span>
            </div>
            {isSameCurrency && difference > 0 && (
              <div className="flex justify-between items-center text-amber-800">
                <span>Deduction / Loss:</span>
                <span className="font-bold">
                  {formatCurrency(difference, sourceAccount?.currency || 'USD')} ({deductionPct.toFixed(1)}%)
                </span>
              </div>
            )}
            {effectiveExchangeRate !== null && (
              <div className="flex justify-between items-center text-blue-800">
                <span>Rate Applied:</span>
                <span className="font-semibold">
                  1 {sourceAccount?.currency} = {effectiveExchangeRate.toFixed(2)} {destinationAccount?.currency}
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm & Execute Transfer
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
