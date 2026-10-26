import React, { useState, useEffect } from 'react';
import { businessDate } from '../../utils/formatters';
import { Project, Client, FinancialAccount, Currency, ProjectStatus } from '../../types';
import { Modal } from '../common/Modal';
import { AlertCircle, Link2, Plus } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Project, 'id' | 'linkedFiverrAccountId' | 'paymentStatus' | 'createdAt'>) => Promise<void>;
  clients: Client[];
  fiverrAccounts: FinancialAccount[];
  initialClient?: Client | null;
  projectToEdit?: Project | null;
  onOpenCreateClientModal?: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
  fiverrAccounts,
  initialClient,
  projectToEdit,
  onOpenCreateClientModal,
}) => {
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [budget, setBudget] = useState('1000');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [bookingDate, setBookingDate] = useState(businessDate());
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setClientId(projectToEdit.clientId);
      setBudget(String(projectToEdit.budget));
      setCurrency(projectToEdit.currency);
      setBookingDate(projectToEdit.bookingDate);
      setExpectedCompletionDate(projectToEdit.expectedCompletionDate || '');
      setStatus(projectToEdit.status);
      setNotes(projectToEdit.notes || '');
    } else {
      setName('');
      setClientId(initialClient ? initialClient.id : (clients.length > 0 ? clients[0].id : ''));
      setBudget('1000');
      setCurrency('USD');
      setBookingDate(businessDate());
      setExpectedCompletionDate('');
      setStatus('in_progress');
      setNotes('');
    }
    setError('');
  }, [projectToEdit, initialClient, clients, isOpen]);

  // Selected client & their automatically linked Fiverr account
  const selectedClient = clients.find((c) => c.id === clientId);
  const automaticallyLinkedFiverrAccount = selectedClient
    ? fiverrAccounts.find((a) => a.id === selectedClient.linkedFiverrAccountId)
    : null;

  useEffect(() => {
    if (!projectToEdit && automaticallyLinkedFiverrAccount) setCurrency(automaticallyLinkedFiverrAccount.currency);
  }, [projectToEdit, automaticallyLinkedFiverrAccount?.id, automaticallyLinkedFiverrAccount?.currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    if (!clientId) {
      setError('Please select a client for this project.');
      return;
    }

    const numBudget = parseFloat(budget);
    if (isNaN(numBudget) || numBudget <= 0) {
      setError('Please provide a valid positive project budget.');
      return;
    }

    if (!bookingDate) {
      setError('Project booking date is required for monthly business reporting.');
      return;
    }

    try {
    await onSave({
      name: name.trim(),
      clientId,
      budget: numBudget,
      currency,
      bookingDate,
      expectedCompletionDate: expectedCompletionDate || undefined,
      status,
      notes: notes.trim() || undefined,
    });

    onClose();
    } catch (e) { setError((e as Error).message); }
  };

  const isEditing = !!projectToEdit;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Project' : 'Create New Project'}
      subtitle="The client's linked Fiverr account is retrieved and associated automatically."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {(!projectToEdit || projectToEdit.balanceRecognition === 'booking') && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-3">Booking credits the full project value to its linked Fiverr account. Transfers reduce this balance; later payments are recorded separately without adding the value twice.</p>}
        {clients.length === 0 ? (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">No Clients Found</p>
              <p className="mt-0.5 text-amber-700">
                You must create at least one client before adding projects.
              </p>
              {onOpenCreateClientModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateClientModal();
                  }}
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Create First Client Now
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Client *
            </label>
            <select
              required
              value={clientId}
              disabled={isEditing}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white disabled:bg-slate-100"
            >
              <option value="" disabled>
                Select Client
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.companyName ? `(${c.companyName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Automatically Linked Fiverr Account
            </label>
            <div className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 bg-slate-50/90 rounded-lg text-slate-700">
              <Link2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-emerald-800 truncate">
                {automaticallyLinkedFiverrAccount
                  ? `${automaticallyLinkedFiverrAccount.name} — Fiverr Account`
                  : selectedClient
                  ? 'Client linked account not found'
                  : 'Select a client first'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Automatically retrieved from the client profile (read-only).
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Project Name / Title *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Website Development, Mobile App Design, SEO Audit"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Agreed Project Budget *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="1000.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Currency *
            </label>
            <select
              value={currency}
              disabled={!projectToEdit || projectToEdit.balanceRecognition === 'booking'}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="USD">USD ($)</option>
              <option value="PKR">PKR (₨)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirmation / Booking Date *
            </label>
            <input
              type="date"
              required
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            <p className="text-[11px] text-slate-500 mt-1">When the client confirmed this project. Its full value counts as business locked in this month, regardless of payment dates.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expected Completion Date (Optional)
            </label>
            <input
              type="date"
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Project Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white capitalize"
            >
              <option value="queued">Queued</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Description / Scope Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key deliverables, timeline milestones, or technical specifications..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden resize-none"
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
            disabled={clients.length === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
          >
            {isEditing ? 'Save Project' : 'Book Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
