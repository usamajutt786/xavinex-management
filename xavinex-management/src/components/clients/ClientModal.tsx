import React, { useState, useEffect } from 'react';
import { Client, FinancialAccount } from '../../types';
import { Modal } from '../common/Modal';
import { AlertCircle, Plus } from 'lucide-react';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Client, 'id' | 'createdAt'>) => Promise<void>;
  fiverrAccounts: FinancialAccount[];
  clientToEdit?: Client | null;
  existingClients: Client[];
  onOpenCreateAccountModal?: () => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  fiverrAccounts,
  clientToEdit,
  existingClients,
  onOpenCreateAccountModal,
}) => {
  const [name, setName] = useState('');
  const [linkedFiverrAccountId, setLinkedFiverrAccountId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [fiverrUsername, setFiverrUsername] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (clientToEdit) {
      setName(clientToEdit.name);
      setLinkedFiverrAccountId(clientToEdit.linkedFiverrAccountId);
      setStatus(clientToEdit.status);
      setFiverrUsername(clientToEdit.fiverrUsername || '');
      setCompanyName(clientToEdit.companyName || '');
      setEmail(clientToEdit.email || '');
      setCountry(clientToEdit.country || '');
      setPhone(clientToEdit.phone || '');
      setNotes(clientToEdit.notes || '');
    } else {
      setName('');
      setLinkedFiverrAccountId(fiverrAccounts.length > 0 ? fiverrAccounts[0].id : '');
      setStatus('active');
      setFiverrUsername('');
      setCompanyName('');
      setEmail('');
      setCountry('');
      setPhone('');
      setNotes('');
    }
    setError('');
  }, [clientToEdit, fiverrAccounts, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Client name is required.');
      return;
    }

    if (!linkedFiverrAccountId) {
      setError('Please select a linked Fiverr account for this client.');
      return;
    }

    // Check duplicate client name
    const isDuplicate = existingClients.some(
      (c) =>
        c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        (!clientToEdit || c.id !== clientToEdit.id)
    );

    if (isDuplicate) {
      setError('A client profile with this exact name already exists. Prevent accidental duplicate client profiles.');
      return;
    }

    try {
    await onSave({
      name: name.trim(),
      linkedFiverrAccountId,
      status,
      fiverrUsername: fiverrUsername.trim() || undefined,
      companyName: companyName.trim() || undefined,
      email: email.trim() || undefined,
      country: country.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
    } catch (e) { setError((e as Error).message); }
  };

  const isEditing = !!clientToEdit;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Client Profile' : 'Create New Client'}
      subtitle="Link the client to a designated Fiverr account. All subsequent projects will automatically inherit this account."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {fiverrAccounts.length === 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">No Fiverr Account Available</p>
              <p className="mt-0.5 text-amber-700">
                Clients must be linked to an existing Fiverr account. Please create a Fiverr account before adding a client.
              </p>
              {onOpenCreateAccountModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateAccountModal();
                  }}
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Create Fiverr Account Now
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Client Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Abdur Rahman, Acme Corp"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Linked Fiverr Account *
            </label>
            <select
              required
              value={linkedFiverrAccountId}
              onChange={(e) => setLinkedFiverrAccountId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="" disabled>
                Select Fiverr Account
              </option>
              {fiverrAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — Fiverr Account ({acc.currency})
                </option>
              ))}
            </select>
            {isEditing && (
              <p className="text-[11px] text-slate-500 mt-1">
                Changing this will apply to future projects. Historical projects will preserve their original account.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Client Fiverr Username (Optional)
            </label>
            <input
              type="text"
              value={fiverrUsername}
              onChange={(e) => setFiverrUsername(e.target.value)}
              placeholder="e.g. @abdur_rahman"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Company Name (Optional)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Global Tech Solutions"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Country (Optional)
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United States, UAE"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Client Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="active">Active Client</option>
              <option value="inactive">Inactive Client</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Notes / Details
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key preferences, scope requirements, or contact instructions..."
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
            disabled={fiverrAccounts.length === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
          >
            {isEditing ? 'Save Client' : 'Create Client'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
