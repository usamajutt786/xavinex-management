import { convertToUSD } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import React from 'react';
import { Client, Project, ClientPayment, FinancialAccount } from '../../types';
import { Modal } from '../common/Modal';
import {
  formatCurrency,
  formatDate,
  getAccountFullName,
} from '../../utils/formatters';
import {
  Briefcase,
  DollarSign,
  Calendar,
  Globe,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface ClientDetailModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  payments: ClientPayment[];
  fiverrAccounts: FinancialAccount[];
  onOpenNewProject: (client: Client) => void;
  onOpenRecordPayment?: (client: Client, project?: Project) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  isOpen,
  onClose,
  projects,
  payments,
  fiverrAccounts,
  onOpenNewProject,
  onOpenRecordPayment,
}) => {
  const { settings } = useData();
  const rates = settings.exchangeRates;
  if (!client) return null;

  const clientProjects = projects.filter((p) => p.clientId === client.id);
  const clientPayments = payments.filter((p) => p.clientId === client.id);
  const linkedFiverr = fiverrAccounts.find((a) => a.id === client.linkedFiverrAccountId);

  // Financial aggregates
  const totalBooked = clientProjects.reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
  const totalPayments = clientPayments.reduce((sum, p) => sum + convertToUSD(p.paymentAmount, p.currency, rates), 0);
  const outstanding = Math.max(0, totalBooked - totalPayments);

  const activeProjects = clientProjects.filter((p) => p.status === 'in_progress' || p.status === 'queued');
  const completedProjects = clientProjects.filter((p) => p.status === 'completed');

  // Dates
  const sortedProjects = [...clientProjects].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
  const firstProjectDate = sortedProjects.length > 0 ? sortedProjects[0].bookingDate : null;
  const latestProjectDate = sortedProjects.length > 0 ? sortedProjects[sortedProjects.length - 1].bookingDate : null;

  // Chart data: Cumulative business growth over time
  let cumulative = 0;
  const growthChartData = sortedProjects.map((p) => {
    cumulative += convertToUSD(p.budget, p.currency, rates);
    return {
      date: p.bookingDate,
      name: p.name,
      cumulative,
      budget: p.budget,
    };
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={client.name}
      subtitle={client.companyName ? `${client.companyName} • Client Profile` : 'Client Financial Profile'}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Header Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1">
              Total Booked Business
            </span>
            <div className="text-xl font-bold text-slate-900">
              {formatCurrency(totalBooked, 'USD')}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across {clientProjects.length} total projects
            </div>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80">
            <span className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider block mb-1">
              Payments Received
            </span>
            <div className="text-xl font-bold text-emerald-800">
              {formatCurrency(totalPayments, 'USD')}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              {clientPayments.length} recorded payments
            </div>
          </div>

          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80">
            <span className="text-[11px] font-medium text-amber-800 uppercase tracking-wider block mb-1">
              Outstanding Balance
            </span>
            <div className="text-xl font-bold text-amber-800">
              {formatCurrency(outstanding, 'USD')}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              {activeProjects.length} active projects in flight
            </div>
          </div>
        </div>

        {/* Client Metadata details */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-slate-400 block mb-0.5">Linked Fiverr Account</span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                {linkedFiverr ? `${linkedFiverr.name} (Fiverr)` : 'Unknown Fiverr'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Status</span>
              <span
                className={`inline-block font-semibold px-2 py-0.5 rounded-md ${
                  client.status === 'active'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {client.status === 'active' ? 'Active Client' : 'Inactive Client'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">First Project Date</span>
              <span className="font-medium text-slate-800">{firstProjectDate ? formatDate(firstProjectDate) : '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Most Recent Project</span>
              <span className="font-medium text-slate-800">{latestProjectDate ? formatDate(latestProjectDate) : '—'}</span>
            </div>
          </div>

          {(client.fiverrUsername || client.email || client.country || client.phone) && (
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-600">
              {client.fiverrUsername && (
                <div>
                  <span className="text-slate-400 block">Fiverr Username:</span>
                  <span className="font-medium text-slate-800">{client.fiverrUsername}</span>
                </div>
              )}
              {client.email && (
                <div>
                  <span className="text-slate-400 block">Email:</span>
                  <span className="font-medium text-slate-800">{client.email}</span>
                </div>
              )}
              {client.country && (
                <div>
                  <span className="text-slate-400 block">Country:</span>
                  <span className="font-medium text-slate-800">{client.country}</span>
                </div>
              )}
              {client.phone && (
                <div>
                  <span className="text-slate-400 block">Phone:</span>
                  <span className="font-medium text-slate-800">{client.phone}</span>
                </div>
              )}
            </div>
          )}

          {client.notes && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block mb-0.5">Notes:</span>
              <p className="text-slate-700 italic">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Client Lifetime Business Growth Line Graph */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Client Lifetime Business Growth
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">Cumulative Contracted Value</span>
          </div>

          {growthChartData.length > 0 ? (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickFormatter={(val) => formatDate(val)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    formatter={(val: any) => [`$${val}`, 'Cumulative Booked']}
                    labelFormatter={(label) => `Date: ${formatDate(String(label))}`}
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ fill: '#2563EB', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No project history recorded yet to plot lifetime growth.
            </div>
          )}
        </div>

        {/* Projects List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-slate-500" />
              Projects ({clientProjects.length})
            </h4>
            <button
              onClick={() => {
                onClose();
                onOpenNewProject(client);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Project
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Project Name</th>
                  <th className="py-2.5 px-3">Booking Date</th>
                  <th className="py-2.5 px-3">Budget</th>
                  <th className="py-2.5 px-3">Project Status</th>
                  <th className="py-2.5 px-3">Payment Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientProjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      No projects recorded for this client.
                    </td>
                  </tr>
                ) : (
                  clientProjects.map((p) => {
                    const isFullyPaid = p.paymentStatus === 'fully_paid';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{p.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{formatDate(p.bookingDate)}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {formatCurrency(p.budget, p.currency)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="capitalize px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 text-slate-700">
                            {p.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                              p.paymentStatus === 'fully_paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.paymentStatus === 'partially_paid'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {p.paymentStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!isFullyPaid && onOpenRecordPayment && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenRecordPayment(client, p);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                            >
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments History */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Payment History ({clientPayments.length})
          </h4>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Gross Payment</th>
                  <th className="py-2.5 px-3">Actual Credited</th>
                  <th className="py-2.5 px-3">Fee / Deduction</th>
                  <th className="py-2.5 px-3">Receiving Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      No payments recorded for this client yet.
                    </td>
                  </tr>
                ) : (
                  clientPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-medium text-slate-800">{formatDate(pay.paymentDate)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-medium rounded-md ${
                            pay.paymentRoute === 'payoneer_direct'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {pay.paymentRoute === 'bank_direct' ? 'Direct Bank' : pay.paymentRoute === 'payoneer_direct' ? 'Direct Payoneer' : 'Fiverr'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {formatCurrency(pay.paymentAmount, pay.currency)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">
                        {formatCurrency(pay.actualCreditedAmount, pay.receivingCurrency || pay.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {pay.feeOrDeduction > 0
                          ? `${formatCurrency(pay.feeOrDeduction, pay.currency)} (${pay.deductionPercentage.toFixed(1)}%)`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 text-[11px]">
                        Account ID: {pay.receivingAccountId}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
