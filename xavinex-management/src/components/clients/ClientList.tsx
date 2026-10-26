import { convertToUSD } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import React, { useState, useMemo } from 'react';
import { Client, Project, ClientPayment, FinancialAccount } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/export';
import { EmptyState } from '../common/EmptyState';
import {
  Users,
  Search,
  Plus,
  Briefcase,
  DollarSign,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Building,
  Award,
  ArrowUpDown,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  Download,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface ClientListProps {
  clients: Client[];
  projects: Project[];
  payments: ClientPayment[];
  fiverrAccounts: FinancialAccount[];
  onOpenCreateModal: () => void;
  onOpenEditModal: (client: Client) => void;
  onOpenDetailModal: (client: Client) => void;
  onOpenNewProject: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

type SortOption =
  | 'booked_desc'
  | 'booked_asc'
  | 'outstanding_desc'
  | 'collected_desc'
  | 'name_asc'
  | 'name_desc'
  | 'recent';

type VolumeFilter = 'all' | 'high_value' | 'has_outstanding' | 'active_only';

export const ClientList: React.FC<ClientListProps> = ({
  clients,
  projects,
  payments,
  fiverrAccounts,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenDetailModal,
  onOpenNewProject,
  onDeleteClient,
}) => {
  const { settings } = useData();
  const rates = settings.exchangeRates;
  const [searchTerm, setSearchTerm] = useState('');
  // Default sort by Highest Business Generated as requested!
  const [sortBy, setSortBy] = useState<SortOption>('booked_desc');
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Compute enriched client data with financial statistics
  const enrichedClients = useMemo(() => {
    return clients.map((client) => {
      const clientProjects = projects.filter((p) => p.clientId === client.id);
      const clientPayments = payments.filter((p) => p.clientId === client.id);

      const totalBooked = clientProjects.reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
      const totalCollected = clientPayments.reduce((sum, p) => sum + convertToUSD(p.paymentAmount, p.currency, rates), 0);
      const outstanding = Math.max(0, totalBooked - totalCollected);
      const activeProjectsCount = clientProjects.filter(
        (p) => p.status === 'in_progress' || p.status === 'queued'
      ).length;

      const linkedFiverr = fiverrAccounts.find((a) => a.id === client.linkedFiverrAccountId);

      return {
        ...client,
        totalBooked,
        totalCollected,
        outstanding,
        projectCount: clientProjects.length,
        activeProjectsCount,
        linkedFiverrName: linkedFiverr ? linkedFiverr.name : 'Unknown',
      };
    });
  }, [clients, projects, payments, fiverrAccounts, rates]);

  // Filter and Sort clients
  const sortedAndFilteredClients = useMemo(() => {
    return enrichedClients
      .filter((client) => {
        const matchesSearch =
          client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (client.companyName && client.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (client.fiverrUsername && client.fiverrUsername.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
          client.linkedFiverrName.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (volumeFilter === 'active_only' && client.status !== 'active') return false;
        if (volumeFilter === 'high_value' && client.totalBooked < 1000) return false;
        if (volumeFilter === 'has_outstanding' && client.outstanding <= 0) return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'booked_desc': // Default: highest business first
            return b.totalBooked - a.totalBooked;
          case 'booked_asc':
            return a.totalBooked - b.totalBooked;
          case 'outstanding_desc':
            return b.outstanding - a.outstanding;
          case 'collected_desc':
            return b.totalCollected - a.totalCollected;
          case 'name_asc':
            return a.name.localeCompare(b.name);
          case 'name_desc':
            return b.name.localeCompare(a.name);
          case 'recent':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          default:
            return b.totalBooked - a.totalBooked;
        }
      });
  }, [enrichedClients, searchTerm, volumeFilter, sortBy, rates]);

  // Overall client metrics
  const clientSummary = useMemo(() => {
    const totalBooked = enrichedClients.reduce((sum, c) => sum + c.totalBooked, 0);
    const totalCollected = enrichedClients.reduce((sum, c) => sum + c.totalCollected, 0);
    const totalDue = enrichedClients.reduce((sum, c) => sum + c.outstanding, 0);
    return { totalBooked, totalCollected, totalDue };
  }, [enrichedClients, rates]);

  const handleExportCSV = () => {
    const rows = sortedAndFilteredClients.map((c, idx) => ({
      Rank: idx + 1,
      Client_Name: c.name,
      Company: c.companyName || '',
      Fiverr_Username: c.fiverrUsername || '',
      Linked_Fiverr_Account: c.linkedFiverrName,
      Total_Business_Booked_USD: c.totalBooked,
      Payments_Received_USD: c.totalCollected,
      Outstanding_Balance_USD: c.outstanding,
      Total_Projects: c.projectCount,
      Active_Projects: c.activeProjectsCount,
      Status: c.status,
      Email: c.email || '',
      Country: c.country || '',
    }));
    exportToCSV('Xavinex_Clients_Report', rows);
  };

  return (
    <div className="space-y-4">
      {/* Client Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Client Bookings
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {formatCurrency(clientSummary.totalBooked, 'USD')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Across {clients.length} registered clients
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Payments Collected
            </div>
            <div className="text-xl font-extrabold text-emerald-800 mt-0.5">
              {formatCurrency(clientSummary.totalCollected, 'USD')}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">
              {clientSummary.totalBooked > 0
                ? `${((clientSummary.totalCollected / clientSummary.totalBooked) * 100).toFixed(0)}% recovery rate`
                : 'Zero collections'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              Pending Receivables
            </div>
            <div className="text-xl font-extrabold text-amber-800 mt-0.5">
              {formatCurrency(clientSummary.totalDue, 'USD')}
            </div>
            <div className="text-[11px] text-amber-600 mt-0.5">
              Unpaid client balances
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control & Sorting Toolbar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client, company, Fiverr..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          {/* Sort Selector: Defaults to Highest Business Generated */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-slate-800"
            >
              <option value="booked_desc">Sort: Highest Business Generated</option>
              <option value="booked_asc">Sort: Lowest Business Generated</option>
              <option value="outstanding_desc">Sort: Highest Outstanding Due</option>
              <option value="collected_desc">Sort: Highest Payments Received</option>
              <option value="name_asc">Sort: Name (A - Z)</option>
              <option value="name_desc">Sort: Name (Z - A)</option>
              <option value="recent">Sort: Most Recently Added</option>
            </select>
          </div>

          {/* Filter dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={volumeFilter}
              onChange={(e) => setVolumeFilter(e.target.value as VolumeFilter)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-slate-800"
            >
              <option value="all">Filter: All Clients</option>
              <option value="active_only">Filter: Active Only</option>
              <option value="high_value">Filter: High Value (&gt; $1,000)</option>
              <option value="has_outstanding">Filter: With Outstanding Due</option>
            </select>
          </div>
        </div>

        {/* View toggles & Add Action */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="High-Density Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={sortedAndFilteredClients.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>

          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        </div>
      </div>

      {/* Clients Display */}
      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Clients Created"
          description="Start building your client portfolio. Every client is permanently associated with a Fiverr account."
          actionText="Create First Client"
          onAction={onOpenCreateModal}
        />
      ) : sortedAndFilteredClients.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          No clients match your search or filter criteria.
        </div>
      ) : viewMode === 'grid' ? (
        /* CARD GRID VIEW (Default sorted by top business) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAndFilteredClients.map((client, index) => {
            const isTopRanked = index < 3 && client.totalBooked > 0;
            return (
              <div
                key={client.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-4.5 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Rank Badge */}
                {isTopRanked && (
                  <div className="absolute top-0 right-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider text-white ${
                        index === 0
                          ? 'bg-amber-500 shadow-xs'
                          : index === 1
                          ? 'bg-slate-500 shadow-xs'
                          : 'bg-amber-700 shadow-xs'
                      }`}
                    >
                      <Award className="w-3 h-3" />
                      #{index + 1} Top Client
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-start justify-between gap-2 mb-2 pr-16">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {client.name}
                      </h4>
                      {client.companyName && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                          <Building className="w-3 h-3 text-slate-400" />
                          {client.companyName}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                        client.status === 'active'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {client.status}
                    </span>
                    {client.fiverrUsername && (
                      <span className="text-[11px] text-slate-400">
                        {client.fiverrUsername}
                      </span>
                    )}
                  </div>

                  {/* Linked Fiverr Account Badge */}
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                      Linked Fiverr Account
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {client.linkedFiverrName} — Fiverr
                    </span>
                  </div>

                  {/* Financial Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center mb-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Total Booked</span>
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatCurrency(client.totalBooked, 'USD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 block font-medium">Paid</span>
                      <span className="text-xs font-extrabold text-emerald-800">
                        {formatCurrency(client.totalCollected, 'USD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-700 block font-medium">Due</span>
                      <span
                        className={`text-xs font-extrabold ${
                          client.outstanding > 0 ? 'text-amber-800 font-black' : 'text-slate-400'
                        }`}
                      >
                        {formatCurrency(client.outstanding, 'USD')}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      {client.projectCount} projects ({client.activeProjectsCount} active)
                    </span>
                    {client.country && <span>{client.country}</span>}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 mt-2">
                  <button
                    onClick={() => onOpenDetailModal(client)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                  >
                    View Profile
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenNewProject(client)}
                      title="Create Project for Client"
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenEditModal(client)}
                      title="Edit Client"
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteClient(client.id)}
                      title="Delete Client"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW (Dense view with ranking) */
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-3">Client & Company</th>
                  <th className="py-3 px-3">Linked Fiverr Account</th>
                  <th className="py-3 px-3 text-right">Total Booked</th>
                  <th className="py-3 px-3 text-right">Payments Received</th>
                  <th className="py-3 px-3 text-right">Outstanding Balance</th>
                  <th className="py-3 px-3 text-center">Projects</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAndFilteredClients.map((client, index) => {
                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-bold">
                        {index === 0 && client.totalBooked > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs">
                            🥇
                          </span>
                        ) : index === 1 && client.totalBooked > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs">
                            🥈
                          </span>
                        ) : index === 2 && client.totalBooked > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-900 text-xs">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-400">#{index + 1}</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <button
                          onClick={() => onOpenDetailModal(client)}
                          className="font-bold text-slate-900 hover:text-blue-600 text-left cursor-pointer"
                        >
                          {client.name}
                        </button>
                        {client.companyName && (
                          <div className="text-[11px] text-slate-500 font-medium">{client.companyName}</div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {client.linkedFiverrName}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrency(client.totalBooked, 'USD')}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(client.totalCollected, 'USD')}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            client.outstanding > 0 ? 'text-amber-800' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(client.outstanding, 'USD')}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center text-slate-600 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{client.projectCount}</span>
                        {client.activeProjectsCount > 0 && (
                          <span className="text-[10px] text-blue-600 font-medium ml-1">
                            ({client.activeProjectsCount} active)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                            client.status === 'active'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {client.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenDetailModal(client)}
                            className="px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 rounded-md cursor-pointer"
                          >
                            Profile
                          </button>
                          <button
                            onClick={() => onOpenNewProject(client)}
                            title="New Project"
                            className="p-1 text-slate-600 hover:text-blue-600 rounded-md cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenEditModal(client)}
                            title="Edit"
                            className="p-1 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteClient(client.id)}
                            title="Delete"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
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
