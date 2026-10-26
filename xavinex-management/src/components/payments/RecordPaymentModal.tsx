import React, { useState, useEffect, useMemo } from 'react';
import { businessDate } from '../../utils/formatters';
import { Client, Project, FinancialAccount, PaymentRoute, Currency } from '../../types';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { formatCurrency, getAccountFullName } from '../../utils/formatters';
import { AlertCircle, CheckCircle2, DollarSign, ArrowRight, Link2 } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  projects: Project[];
  accounts: FinancialAccount[];
  initialClient?: Client | null;
  initialProject?: Project | null;
  onRecordPayment: (data: {
    clientId: string;
    projectId: string;
    paymentAmount: number;
    currency: Currency;
    paymentDate: string;
    receivingAccountId: string;
    paymentRoute: PaymentRoute;
    actualCreditedAmount: number;
    feeOrDeduction?: number;
    description?: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  clients,
  projects,
  accounts,
  initialClient,
  initialProject,
  onRecordPayment,
}) => {
  const { settings } = useData();
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('200');
  const [actualCreditedAmount, setActualCreditedAmount] = useState('200');
  const [paymentRoute, setPaymentRoute] = useState<PaymentRoute>('payoneer_direct');
  const [receivingAccountId, setReceivingAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(businessDate());
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [error, setError] = useState('');

  // Selected entities
  const clientProjects = projects.filter((p) => p.clientId === clientId && p.status !== 'cancelled' && p.paymentStatus !== 'fully_paid');
  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedClient = clients.find((c) => c.id === clientId);

  // Automatically retrieved linked Fiverr account from project/client
  const linkedFiverrAccountId = selectedProject?.linkedFiverrAccountId || selectedClient?.linkedFiverrAccountId;
  const linkedFiverrAccount = accounts.find((a) => a.id === linkedFiverrAccountId);

  // Filter eligible receiving accounts based on Route
  const eligibleReceivingAccounts = useMemo(() => accounts.filter((a) => {
    if (a.status === 'inactive') return false;
    if (paymentRoute !== 'bank_direct' && selectedProject && a.currency !== selectedProject.currency) return false;
    if (paymentRoute === 'payoneer_direct') {
      return a.type === 'payoneer';
    }
    if (paymentRoute === 'bank_direct') return a.type === 'bank';
    if (paymentRoute === 'fiverr') {
      return a.type === 'fiverr' && a.id === linkedFiverrAccountId;
    }
    return false;
  }), [accounts, paymentRoute, selectedProject?.currency, linkedFiverrAccountId]);

  useEffect(() => {
    if (isOpen) {
      const cId = initialClient ? initialClient.id : (clients.length > 0 ? clients[0].id : '');
      setClientId(cId);

      const availableProjects = projects.filter((p) => p.clientId === cId && p.status !== 'cancelled' && p.paymentStatus !== 'fully_paid');
      const pId = initialProject ? initialProject.id : (availableProjects.length > 0 ? availableProjects[0].id : '');
      setProjectId(pId);

      setPaymentAmount('200');
      setActualCreditedAmount('200');
      setPaymentRoute('payoneer_direct');
      setPaymentDate(businessDate());
      setDescription('');
      setNotes('');
      setStep('form');
      setError('');
    }
  }, [isOpen, initialClient, initialProject, clients, projects]);

  // When client changes, auto-select first project for that client
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    const available = projects.filter((p) => p.clientId === newClientId && p.status !== 'cancelled' && p.paymentStatus !== 'fully_paid');
    if (available.length > 0) {
      setProjectId(available[0].id);
    } else {
      setProjectId('');
    }
  };

  // When paymentRoute changes, reset receiving account to first eligible account
  useEffect(() => {
    if (paymentRoute === 'fiverr' && linkedFiverrAccount) {
      setReceivingAccountId(linkedFiverrAccount.id);
    } else if (eligibleReceivingAccounts.length > 0) {
      // Pick first eligible account
      const exists = eligibleReceivingAccounts.find((a) => a.id === receivingAccountId);
      if (!exists) {
        setReceivingAccountId(eligibleReceivingAccounts[0].id);
      }
    } else {
      setReceivingAccountId('');
    }
  }, [paymentRoute, eligibleReceivingAccounts, linkedFiverrAccount]);

  const numPaymentAmount = parseFloat(paymentAmount) || 0;
  const receivingAccount = accounts.find((a) => a.id === receivingAccountId);
  const converted = paymentRoute === 'bank_direct' && !!selectedProject && !!receivingAccount && selectedProject.currency !== receivingAccount.currency;
  const exchangeRate = converted ? settings.exchangeRates[receivingAccount!.currency] / settings.exchangeRates[selectedProject!.currency] : 1;
  const numCreditedAmount = converted ? Math.round((numPaymentAmount * exchangeRate + Number.EPSILON) * 100) / 100 : parseFloat(actualCreditedAmount) || 0;
  const deduction = converted ? 0 : Math.round(Math.max(0, numPaymentAmount - numCreditedAmount) * 100) / 100;
  const deductionPct = numPaymentAmount > 0 ? (deduction / numPaymentAmount) * 100 : 0;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedClient) {
      setError('Please select a valid client.');
      return;
    }
    if (!selectedProject) {
      setError('Please select a project to credit this payment against.');
      return;
    }
    if (numPaymentAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (numCreditedAmount <= 0) {
      setError('Actual credited amount must be greater than zero.');
      return;
    }
    if (!receivingAccount || !eligibleReceivingAccounts.some(account => account.id === receivingAccountId)) {
      setError('Please select a valid receiving account.');
      return;
    }

    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    const res = await onRecordPayment({
      clientId,
      projectId,
      paymentAmount: numPaymentAmount,
      currency: selectedProject?.currency || 'USD',
      paymentDate,
      receivingAccountId,
      paymentRoute,
      actualCreditedAmount: numCreditedAmount,
      feeOrDeduction: deduction,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    if (!res.success) {
      setError(res.error || 'Failed to record payment.');
      setStep('form');
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Client Payment"
      subtitle="Record client payments to Fiverr, Payoneer or a bank account. Bank currency conversion is automatic."
      maxWidth="lg"
    >
      {step === 'form' ? (
        <form onSubmit={handleProceedToConfirm} className="space-y-4">
          {/* Client & Project Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Client *
              </label>
              <select
                required
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
              >
                <option value="" disabled>Select Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.companyName ? `(${c.companyName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Project *
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
              >
                <option value="" disabled>Select Project</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatCurrency(p.budget, p.currency)})
                  </option>
                ))}
              </select>
              {clientProjects.length === 0 && clientId && (
                <p className="text-[11px] text-rose-600 mt-1">
                  Selected client has no projects yet.
                </p>
              )}
            </div>
          </div>

          {/* Linked Fiverr Account Badge (Automatically retrieved) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-600" />
              <span className="text-slate-600 font-medium">Attributed Fiverr Account:</span>
            </div>
            <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {linkedFiverrAccount ? `${linkedFiverrAccount.name} — Fiverr Account` : 'None / Not Assigned'}
            </span>
          </div>

          {/* Payment Route Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Route *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${paymentRoute === 'bank_direct' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <input type="radio" name="paymentRoute" value="bank_direct" checked={paymentRoute === 'bank_direct'} onChange={() => setPaymentRoute('bank_direct')} className="text-blue-600" />
                  <span className="font-bold text-slate-900">Bank</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed pl-5">Client pays directly into an existing bank account. The net amount received increases that bank balance.</p>
              </label>
              <label
                className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                  paymentRoute === 'payoneer_direct'
                    ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="paymentRoute"
                    value="payoneer_direct"
                    checked={paymentRoute === 'payoneer_direct'}
                    onChange={() => setPaymentRoute('payoneer_direct')}
                    className="text-blue-600"
                  />
                  <span className="font-bold text-slate-900">Route B: Direct Payoneer</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                  Client pays directly into selected Payoneer. Project retains Fiverr attribution. Does not increase Fiverr balance.
                </p>
              </label>

              <label
                className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                  paymentRoute === 'fiverr'
                    ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="paymentRoute"
                    value="fiverr"
                    checked={paymentRoute === 'fiverr'}
                    onChange={() => setPaymentRoute('fiverr')}
                    className="text-blue-600"
                  />
                  <span className="font-bold text-slate-900">Route A: Recorded in Fiverr</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                  Payment is credited to the linked Fiverr account. Can be transferred to Payoneer later.
                </p>
              </label>
            </div>
          </div>

          {/* Receiving Account */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receiving Financial Account *
            </label>
            <select
              required
              value={receivingAccountId}
              onChange={(e) => setReceivingAccountId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="" disabled>Select Receiving Account</option>
              {eligibleReceivingAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {getAccountFullName(acc)} (Current: {formatCurrency(acc.currentBalance, acc.currency)})
                </option>
              ))}
            </select>
            {eligibleReceivingAccounts.length === 0 && (
              <p className="text-[11px] text-rose-600 mt-1">
                {paymentRoute === 'bank_direct' ? 'No active bank accounts found. Add a bank account in Bank & Cash first.' : `No active ${paymentRoute === 'payoneer_direct' ? 'Payoneer' : 'Fiverr'} accounts match this project's currency. Add a matching account first.`}
              </p>
            )}
          </div>

          {/* Payment Amount & Actual Credited Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gross Client Payment Amount ({selectedProject?.currency || 'USD'}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={paymentAmount}
                onChange={(e) => {
                  setPaymentAmount(e.target.value);
                  // Default credited amount to same value if not altered
                  if (actualCreditedAmount === paymentAmount) {
                    setActualCreditedAmount(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-bold text-slate-900"
                placeholder="200.00"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Reduces the project's outstanding balance by this gross amount.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Actual Credited Amount ({receivingAccount?.currency || 'USD'}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={converted ? numCreditedAmount.toFixed(2) : actualCreditedAmount}
                readOnly={converted}
                onChange={(e) => setActualCreditedAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-bold text-emerald-700"
                placeholder="200.00"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {converted ? `Automatically converted using Settings: 1 ${selectedProject?.currency} = ${exchangeRate.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${receivingAccount?.currency}.` : 'Net amount added to the receiving financial account.'}
              </p>
            </div>
          </div>

          {/* Fee / Deduction Real-time breakdown */}
          {deduction > 0 && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs flex items-center justify-between">
              <span className="text-amber-800 font-medium">Platform Fee / Deduction:</span>
              <span className="font-bold text-amber-900">
                {formatCurrency(deduction, selectedProject?.currency || 'USD')} ({deductionPct.toFixed(1)}%)
              </span>
            </div>
          )}

          {/* Date & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Reference / Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Milestone 1 payment, invoice #104"
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
              disabled={!selectedProject || !receivingAccount}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
            >
              Review Payment Posting
            </button>
          </div>
        </form>
      ) : (
        /* Confirmation Screen */
        <div className="space-y-4">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
            Please confirm the exact financial impact of this payment before posting to the ledger.
            {converted && <p className="mt-2">{formatCurrency(numPaymentAmount, selectedProject?.currency)} × {exchangeRate.toLocaleString('en-US', { maximumFractionDigits: 8 })} = {formatCurrency(numCreditedAmount, receivingAccount?.currency)} at the current Settings rate. This rate is saved with the receipt.</p>}
            {selectedProject?.balanceRecognition === 'booking' && <p className="mt-2">This project was credited to Fiverr when booked. {paymentRoute === 'fiverr' ? 'Recording this payment only subtracts its fee from the Fiverr balance.' : `The gross payment will be removed from Fiverr and the net receipt added to ${paymentRoute === 'bank_direct' ? 'the selected bank account' : 'Payoneer'}.`}</p>}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Client:</span>
              <span className="font-semibold text-slate-900">{selectedClient?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Project:</span>
              <span className="font-semibold text-slate-900">{selectedProject?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Attributed Fiverr Account:</span>
              <span className="font-medium text-emerald-800">
                {linkedFiverrAccount ? `${linkedFiverrAccount.name} (Fiverr)` : 'None'}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-600 font-medium">Gross Project Payment:</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(numPaymentAmount, selectedProject?.currency || 'USD')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 font-medium">Receiving Account:</span>
              <span className="font-bold text-emerald-700">
                {receivingAccount ? getAccountFullName(receivingAccount) : ''} ({selectedProject?.balanceRecognition === 'booking' && paymentRoute === 'fiverr' ? `−${formatCurrency(deduction, receivingAccount?.currency || 'USD')} fees` : `+${formatCurrency(numCreditedAmount, receivingAccount?.currency || 'USD')}`})
              </span>
            </div>
            {deduction > 0 && (
              <div className="flex justify-between text-amber-800">
                <span>Deduction / Fee:</span>
                <span className="font-bold">
                  {formatCurrency(deduction, selectedProject?.currency || 'USD')} ({deductionPct.toFixed(1)}%)
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-600">
              <span>Payment Route:</span>
              <span className="font-semibold capitalize">
                {paymentRoute === 'bank_direct' ? 'Direct Bank Credit' : paymentRoute === 'payoneer_direct' ? 'Direct Payoneer Credit (Route B)' : 'Fiverr Credit (Route A)'}
              </span>
            </div>
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
              Confirm & Post Payment
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
