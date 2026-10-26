import { convertToUSD } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import React, { useState, useMemo } from 'react';
import { Project, Client, ClientPayment, FinancialAccount, ProjectStatus, PaymentStatus } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/export';
import { EmptyState } from '../common/EmptyState';
import {
  GitBranch,
  Plus,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Filter,
  ArrowUpDown,
  DollarSign,
  Calendar,
  Building,
  Edit,
  ExternalLink,
} from 'lucide-react';

interface PipelineViewProps {
  projects: Project[];
  clients: Client[];
  payments: ClientPayment[];
  fiverrAccounts: FinancialAccount[];
  onOpenNewProject: () => void;
  onUpdateProjectStatus: (id: string, status: ProjectStatus) => void;
  onOpenRecordPayment: (client: Client, project: Project) => void;
  onOpenEditProject?: (project: Project) => void;
  onOpenClientProfile?: (client: Client) => void;
}

type PipelineTab = 'all' | 'in_progress' | 'queued' | 'on_hold' | 'completed' | 'unpaid';

export const PipelineView: React.FC<PipelineViewProps> = ({
  projects,
  clients,
  payments,
  fiverrAccounts,
  onOpenNewProject,
  onUpdateProjectStatus,
  onOpenRecordPayment,
  onOpenEditProject,
  onOpenClientProfile,
}) => {
  const { settings } = useData();
  const rates = settings.exchangeRates;
  const [activeTab, setActiveTab] = useState<PipelineTab>('in_progress');
  const [searchTerm, setSearchTerm] = useState('');
  const [fiverrFilter, setFiverrFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'budget_desc' | 'outstanding_desc' | 'name_asc'>('date_desc');

  // Calculate project financial metrics
  const enrichedProjects = useMemo(() => {
    return projects.map((project) => {
      const client = clients.find((c) => c.id === project.clientId);
      const fiverr = fiverrAccounts.find((a) => a.id === project.linkedFiverrAccountId);
      const projectPayments = payments.filter((pay) => pay.projectId === project.id);
      const totalPaid = projectPayments.reduce((sum, pay) => sum + pay.paymentAmount, 0);
      const outstanding = Math.max(0, project.budget - totalPaid);
      const progressPct = project.budget > 0 ? Math.min(100, (totalPaid / project.budget) * 100) : 0;
      const isUnpaid = outstanding > 0 || project.paymentStatus === 'unpaid' || project.paymentStatus === 'partially_paid';

      return {
        ...project,
        client,
        clientName: client ? client.name : 'Unknown Client',
        fiverrName: fiverr ? fiverr.name : 'Unknown Fiverr',
        totalPaid,
        outstanding,
        progressPct,
        isUnpaid,
      };
    });
  }, [projects, clients, payments, fiverrAccounts, rates]);

  // Tab Counts and Amounts
  const tabCounts = useMemo(() => {
    const allCount = enrichedProjects.length;
    const inProgressCount = enrichedProjects.filter((p) => p.status === 'in_progress').length;
    const queuedCount = enrichedProjects.filter((p) => p.status === 'queued').length;
    const onHoldCount = enrichedProjects.filter((p) => p.status === 'on_hold').length;
    const completedCount = enrichedProjects.filter((p) => p.status === 'completed').length;
    const unpaidCount = enrichedProjects.filter((p) => p.isUnpaid).length;

    const inProgressValue = enrichedProjects
      .filter((p) => p.status === 'in_progress')
      .reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
    const completedValue = enrichedProjects
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
    const queuedValue = enrichedProjects
      .filter((p) => p.status === 'queued')
      .reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
    const onHoldValue = enrichedProjects
      .filter((p) => p.status === 'on_hold')
      .reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
    const unpaidDueValue = enrichedProjects
      .filter((p) => p.isUnpaid)
      .reduce((sum, p) => sum + convertToUSD(p.outstanding, p.currency, rates), 0);

    return {
      all: { count: allCount, amount: enrichedProjects.reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0) },
      in_progress: { count: inProgressCount, amount: inProgressValue },
      queued: { count: queuedCount, amount: queuedValue },
      on_hold: { count: onHoldCount, amount: onHoldValue },
      completed: { count: completedCount, amount: completedValue },
      unpaid: { count: unpaidCount, amount: unpaidDueValue },
    };
  }, [enrichedProjects, rates]);

  // Filter and Sort by active tab
  const filteredProjects = useMemo(() => {
    return enrichedProjects
      .filter((p) => {
        // Tab filtering
        if (activeTab === 'in_progress' && p.status !== 'in_progress') return false;
        if (activeTab === 'queued' && p.status !== 'queued') return false;
        if (activeTab === 'on_hold' && p.status !== 'on_hold') return false;
        if (activeTab === 'completed' && p.status !== 'completed') return false;
        if (activeTab === 'unpaid' && !p.isUnpaid) return false;

        // Search filtering
        const matchesSearch =
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.client?.companyName && p.client.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          p.fiverrName.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // Fiverr account filtering
        if (fiverrFilter !== 'all' && p.linkedFiverrAccountId !== fiverrFilter) return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date_desc':
            return b.bookingDate.localeCompare(a.bookingDate);
          case 'budget_desc':
            return b.budget - a.budget;
          case 'outstanding_desc':
            return b.outstanding - a.outstanding;
          case 'name_asc':
            return a.name.localeCompare(b.name);
          default:
            return b.bookingDate.localeCompare(a.bookingDate);
        }
      });
  }, [enrichedProjects, activeTab, searchTerm, fiverrFilter, sortBy, rates]);

  const handleExportCSV = () => {
    const rows = filteredProjects.map((p) => ({
      Project_Name: p.name,
      Client: p.clientName,
      Company: p.client?.companyName || '',
      Linked_Fiverr_Account: p.fiverrName,
      Budget: p.budget,
      Currency: p.currency,
      Paid_Amount: p.totalPaid,
      Outstanding_Due: p.outstanding,
      Payment_Status: p.paymentStatus,
      Delivery_Status: p.status,
      Booking_Date: p.bookingDate,
      Expected_Completion_Date: p.expectedCompletionDate || '',
      Notes: p.notes || '',
    }));
    exportToCSV(`Pipeline_${activeTab}_Projects`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner with Quick Summary */}
      <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-600" />
            Business Pipeline & Project Delivery
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Table ledger of client bookings categorized by stage and outstanding payment status.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            disabled={filteredProjects.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Tab (CSV)
          </button>
          <button
            onClick={onOpenNewProject}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Book New Project
          </button>
        </div>
      </div>

      {/* Categorization Tabs (In Progress, In Queue, On Hold, Completed, Unpaid) */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tab 1: All Projects */}
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>All Projects</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                activeTab === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {tabCounts.all.count}
            </span>
          </button>

          {/* Tab 2: In Progress */}
          <button
            onClick={() => setActiveTab('in_progress')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'in_progress'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              In Progress
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                activeTab === 'in_progress' ? 'bg-blue-700 text-blue-100' : 'bg-blue-50 text-blue-700'
              }`}
            >
              {tabCounts.in_progress.count} • {formatCurrency(tabCounts.in_progress.amount, 'USD')}
            </span>
          </button>

          {/* Tab 3: In Queue */}
          <button
            onClick={() => setActiveTab('queued')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'queued'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              In Queue
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                activeTab === 'queued' ? 'bg-purple-700 text-purple-100' : 'bg-purple-50 text-purple-700'
              }`}
            >
              {tabCounts.queued.count}
            </span>
          </button>

          {/* Tab 4: On Hold */}
          <button
            onClick={() => setActiveTab('on_hold')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'on_hold'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              On Hold
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                activeTab === 'on_hold' ? 'bg-amber-700 text-amber-100' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {tabCounts.on_hold.count}
            </span>
          </button>

          {/* Tab 5: Completed */}
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                activeTab === 'completed' ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {tabCounts.completed.count} • {formatCurrency(tabCounts.completed.amount, 'USD')}
            </span>
          </button>

          {/* Tab 6: UNPAID (Special Tab for unpaid & pending projects!) */}
          <button
            onClick={() => setActiveTab('unpaid')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              activeTab === 'unpaid'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'text-rose-700 bg-rose-50/70 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Unpaid
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                activeTab === 'unpaid' ? 'bg-rose-800 text-white' : 'bg-rose-200/80 text-rose-900'
              }`}
            >
              {tabCounts.unpaid.count} ({formatCurrency(tabCounts.unpaid.amount, 'USD')} due)
            </span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects or clients in this tab..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {fiverrAccounts.length > 0 && (
            <select
              value={fiverrFilter}
              onChange={(e) => setFiverrFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-slate-800"
            >
              <option value="all">All Fiverr Accounts</option>
              {fiverrAccounts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — Fiverr
                </option>
              ))}
            </select>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-slate-800"
          >
            <option value="date_desc">Booking Date (Latest First)</option>
            <option value="budget_desc">Budget (Highest First)</option>
            <option value="outstanding_desc">Outstanding Due (Highest First)</option>
            <option value="name_asc">Project Name (A - Z)</option>
          </select>
        </div>
      </div>

      {/* Table Format: Each project listed in a separate row */}
      {projects.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Pipeline is Empty"
          description="Track active projects as they move from queue to in-progress and completion."
          actionText="Book First Project"
          onAction={onOpenNewProject}
        />
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">No projects found in "{activeTab.replace('_', ' ').toUpperCase()}"</p>
          <p className="text-[11px] text-slate-400">
            {activeTab === 'unpaid'
              ? 'Great news! There are currently no unpaid project balances.'
              : 'Try switching tabs or resetting your search filter.'}
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Project Details</th>
                  <th className="py-3 px-3">Client & Fiverr Account</th>
                  <th className="py-3 px-3">Booking Date</th>
                  <th className="py-3 px-3 text-right">Agreed Budget</th>
                  <th className="py-3 px-3 text-right">Paid / Received</th>
                  <th className="py-3 px-3 text-right">Outstanding Due</th>
                  <th className="py-3 px-3 min-w-[130px]">Payment Status</th>
                  <th className="py-3 px-3">Delivery Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((project) => {
                  const isFullyPaid = project.outstanding === 0;

                  return (
                    <tr
                      key={project.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        activeTab === 'unpaid' && project.outstanding > 0 ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Project Name & Notes */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{project.name}</div>
                        {project.notes ? (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {project.notes}
                          </div>
                        ) : project.expectedCompletionDate ? (
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Target: {formatDate(project.expectedCompletionDate)}
                          </div>
                        ) : null}
                      </td>

                      {/* Client & Linked Fiverr Account */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {project.client ? project.client.name : 'Unknown Client'}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {project.fiverrName}
                          </span>
                        </div>
                      </td>

                      {/* Booking Date */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {formatDate(project.bookingDate)}
                      </td>

                      {/* Agreed Budget */}
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrency(project.budget, project.currency)}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(project.totalPaid, project.currency)}
                      </td>

                      {/* Outstanding Due */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {project.outstanding > 0 ? (
                          <span className="font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            {formatCurrency(project.outstanding, project.currency)}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            $0.00
                          </span>
                        )}
                      </td>

                      {/* Payment Status & Progress bar */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                          <span
                            className={`px-1.5 py-0.2 rounded-md uppercase tracking-wider text-[9px] ${
                              project.paymentStatus === 'fully_paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : project.paymentStatus === 'partially_paid'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {project.paymentStatus.replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-500">{project.progressPct.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              isFullyPaid
                                ? 'bg-emerald-500'
                                : project.progressPct > 0
                                ? 'bg-amber-500'
                                : 'bg-rose-300'
                            }`}
                            style={{ width: `${project.progressPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Delivery Status (Inline switcher) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={project.status}
                          onChange={(e) => onUpdateProjectStatus(project.id, e.target.value as ProjectStatus)}
                          className={`text-xs font-semibold rounded-lg px-2 py-1 outline-hidden border capitalize cursor-pointer transition-colors ${
                            project.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : project.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : project.status === 'queued'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : project.status === 'on_hold'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="queued">In Queue</option>
                          <option value="in_progress">In Progress</option>
                          <option value="on_hold">On Hold</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Record Payment Button */}
                          {project.outstanding > 0 && project.client && (
                            <button
                              onClick={() => onOpenRecordPayment(project.client!, project)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors cursor-pointer shadow-2xs"
                              title="Record Payment for this project"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay
                            </button>
                          )}

                          {onOpenEditProject && (
                            <button
                              onClick={() => onOpenEditProject(project)}
                              title="Edit Project"
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {project.client && onOpenClientProfile && (
                            <button
                              onClick={() => onOpenClientProfile(project.client!)}
                              title="View Client Profile"
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
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
