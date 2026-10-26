import React, { useState } from 'react';
import { Project, Client, ClientPayment, FinancialAccount } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';
import {
  Briefcase,
  Search,
  Plus,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Trash2,
  ExternalLink,
  CreditCard,
} from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  clients: Client[];
  payments: ClientPayment[];
  fiverrAccounts: FinancialAccount[];
  onOpenCreateModal: () => void;
  onOpenEditModal: (project: Project) => void;
  onOpenRecordPayment: (client: Client, project: Project) => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  clients,
  payments,
  fiverrAccounts,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenRecordPayment,
  onDeleteProject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  const filteredProjects = projects.filter((project) => {
    const client = clients.find((c) => c.id === project.clientId);
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client && client.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || project.paymentStatus === paymentFilter;
    const matchesClient = clientFilter === 'all' || project.clientId === clientFilter;

    return matchesSearch && matchesStatus && matchesPayment && matchesClient;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects or clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white capitalize"
          >
            <option value="all">All Project Statuses</option>
            <option value="queued">Queued</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white capitalize"
          >
            <option value="all">All Payment Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="fully_paid">Fully Paid</option>
          </select>

          {clients.length > 0 && (
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white max-w-44 truncate"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={onOpenCreateModal}
          className="w-full lg:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Book Project
        </button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No Projects Recorded"
          description="Projects represent client bookings and track budgets, payment statuses, and linked Fiverr accounts."
          actionText="Book First Project"
          onAction={onOpenCreateModal}
        />
      ) : filteredProjects.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          No projects match your current filters.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Project & Client</th>
                  <th className="py-3 px-3">Linked Fiverr Account</th>
                  <th className="py-3 px-3">Booking Date</th>
                  <th className="py-3 px-3">Budget</th>
                  <th className="py-3 px-3">Paid / Outstanding</th>
                  <th className="py-3 px-3">Payment Progress</th>
                  <th className="py-3 px-3">Project Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((project) => {
                  const client = clients.find((c) => c.id === project.clientId);
                  const linkedFiverr = fiverrAccounts.find((a) => a.id === project.linkedFiverrAccountId);
                  const projectPayments = payments.filter((p) => p.projectId === project.id);
                  const totalPaid = projectPayments.reduce((sum, p) => sum + p.paymentAmount, 0);
                  const outstanding = Math.max(0, project.budget - totalPaid);
                  const progressPct = project.budget > 0 ? Math.min(100, (totalPaid / project.budget) * 100) : 0;
                  const isFullyPaid = project.paymentStatus === 'fully_paid' || outstanding === 0;

                  return (
                    <tr key={project.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{project.name}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5 font-medium">
                          Client: {client ? client.name : 'Unknown Client'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {linkedFiverr ? `${linkedFiverr.name} (Fiverr)` : 'Unknown Fiverr'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {formatDate(project.bookingDate)}
                      </td>

                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(project.budget, project.currency)}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-emerald-700 font-semibold">
                          {formatCurrency(totalPaid, project.currency)} paid
                        </div>
                        <div className="text-amber-700 font-medium text-[11px]">
                          {formatCurrency(outstanding, project.currency)} due
                        </div>
                      </td>

                      <td className="py-3 px-3 min-w-[130px]">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span>{progressPct.toFixed(0)}%</span>
                          <span className="capitalize font-semibold">
                            {project.paymentStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              isFullyPaid
                                ? 'bg-emerald-500'
                                : progressPct > 0
                                ? 'bg-amber-500'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`capitalize px-2 py-0.5 text-[10px] font-medium rounded-md ${
                            project.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : project.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : project.status === 'queued'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {project.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isFullyPaid && client && (
                            <button
                              onClick={() => onOpenRecordPayment(client, project)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => onOpenEditModal(project)}
                            title="Edit Project"
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteProject(project.id)}
                            title="Delete Project"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
