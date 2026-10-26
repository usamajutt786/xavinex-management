import { convertToUSD } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import React, { useState, useMemo } from 'react';
import {
  Project,
  ClientPayment,
  Expense,
  FinancialAccount,
  Client,
  FundTransfer,
  AccountTransaction,
} from '../../types';
import { formatCurrency, formatDate, getAccountFullName } from '../../utils/formatters';
import { exportToCSV } from '../../utils/export';
import { FileText, Download, Filter, Search, Printer, Calendar } from 'lucide-react';

interface ReportsViewProps {
  projects: Project[];
  payments: ClientPayment[];
  expenses: Expense[];
  accounts: FinancialAccount[];
  clients: Client[];
  transfers: FundTransfer[];
  transactions: AccountTransaction[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  projects,
  payments,
  expenses,
  accounts,
  clients,
  transfers,
  transactions,
}) => {
  const { settings } = useData();
  const rates = settings.exchangeRates;
  const [selectedReport, setSelectedReport] = useState<string>('monthly_booking');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Available Reports List
  const reportOptions = [
    { id: 'monthly_booking', label: '1. Monthly Business Booking Report' },
    { id: 'monthly_collections', label: '2. Monthly Client Collections Report' },
    { id: 'outstanding_payments', label: '3. Outstanding Project Receivables' },
    { id: 'client_lifetime_value', label: '4. Client Lifetime Value (LTV)' },
    { id: 'fiverr_performance', label: '5. Fiverr Account Performance' },
    { id: 'payoneer_performance', label: '6. Payoneer Account Performance' },
    { id: 'account_balances', label: '7. Current Financial Account Balances' },
    { id: 'transfer_history', label: '8. Fund Transfer Audit History' },
    { id: 'transfer_fees', label: '9. Transfer Fees & Platform Deductions' },
    { id: 'monthly_expenses', label: '10. Monthly Expense Breakdown' },
    { id: 'expense_categories', label: '11. Expense Category Aggregates' },
    { id: 'net_cash_flow', label: '12. Monthly Net Operating Cash Flow' },
    { id: 'annual_summary', label: '13. Annual Comprehensive Financial Summary' },
  ];

  // Report Data Generator
  const reportData = useMemo(() => {
    const within = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);
    const scopedProjects = projects.filter(p => within(p.bookingDate));
    const scopedPayments = payments.filter(p => within(p.paymentDate));
    const scopedExpenses = expenses.filter(e => within(e.date));
    const scopedTransfers = transfers.filter(t => within(t.transferDate));
    switch (selectedReport) {
      case 'monthly_booking': {
        const map: Record<string, { month: string; projectsCount: number; totalBooked: number }> = {};
        scopedProjects.forEach((p) => {
          if (startDate && p.bookingDate < startDate) return;
          if (endDate && p.bookingDate > endDate) return;
          const m = p.bookingDate.slice(0, 7);
          if (!map[m]) map[m] = { month: m, projectsCount: 0, totalBooked: 0 };
          map[m].projectsCount += 1;
          map[m].totalBooked += convertToUSD(p.budget, p.currency, rates);
        });
        return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
      }

      case 'monthly_collections': {
        const map: Record<string, { month: string; paymentsCount: number; totalCollected: number; directPayoneer: number; directBank: number; fiverr: number }> = {};
        scopedPayments.forEach((pay) => {
          if (startDate && pay.paymentDate < startDate) return;
          if (endDate && pay.paymentDate > endDate) return;
          const m = pay.paymentDate.slice(0, 7);
          if (!map[m]) map[m] = { month: m, paymentsCount: 0, totalCollected: 0, directPayoneer: 0, directBank: 0, fiverr: 0 };
          map[m].paymentsCount += 1;
          map[m].totalCollected += convertToUSD(pay.paymentAmount, pay.currency, rates);
          if (pay.paymentRoute === 'payoneer_direct') {
            map[m].directPayoneer += convertToUSD(pay.paymentAmount, pay.currency, rates);
          } else if (pay.paymentRoute === 'bank_direct') {
            map[m].directBank += convertToUSD(pay.paymentAmount, pay.currency, rates);
          } else {
            map[m].fiverr += convertToUSD(pay.paymentAmount, pay.currency, rates);
          }
        });
        return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
      }

      case 'outstanding_payments': {
        return scopedProjects
          .map((p) => {
            const client = clients.find((c) => c.id === p.clientId);
            const paid = payments
              .filter((pay) => pay.projectId === p.id)
              .reduce((sum, pay) => sum + pay.paymentAmount, 0);
            const outstanding = Math.max(0, p.budget - paid);
            return {
              projectId: p.id,
              projectName: p.name,
              clientName: client ? client.name : 'Unknown',
              budget: p.budget,
              currency: p.currency,
              paid,
              outstanding,
              status: p.status,
              paymentStatus: p.paymentStatus,
              bookingDate: p.bookingDate,
            };
          })
          .filter((p) => p.outstanding > 0);
      }

      case 'client_lifetime_value': {
        return clients.map((c) => {
          const clientProjects = scopedProjects.filter((p) => p.clientId === c.id);
          const clientPayments = scopedPayments.filter((p) => p.clientId === c.id);
          const totalBooked = clientProjects.reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
          const totalPaid = clientPayments.reduce((sum, p) => sum + convertToUSD(p.paymentAmount, p.currency, rates), 0);
          const outstanding = Math.max(0, totalBooked - totalPaid);
          return {
            clientId: c.id,
            clientName: c.name,
            companyName: c.companyName || '—',
            status: c.status,
            aggregateCurrency: 'USD',
            totalProjects: clientProjects.length,
            totalBooked,
            totalPaid,
            outstanding,
          };
        }).sort((a, b) => b.totalBooked - a.totalBooked);
      }

      case 'fiverr_performance': {
        const fiverrAccs = accounts.filter((a) => a.type === 'fiverr');
        return fiverrAccs.map((acc) => {
          const linkedProjects = scopedProjects.filter((p) => p.linkedFiverrAccountId === acc.id);
          const linkedPayments = scopedPayments.filter((p) => p.linkedFiverrAccountId === acc.id);
          const booked = linkedProjects.reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);
          const collected = linkedPayments.reduce((sum, p) => sum + convertToUSD(p.paymentAmount, p.currency, rates), 0);
          return {
            accountId: acc.id,
            accountName: acc.name,
            currentBalance: acc.currentBalance,
            currency: acc.currency,
            aggregateCurrency: 'USD',
            projectCount: linkedProjects.length,
            bookedBusiness: booked,
            collectedPayments: collected,
          };
        });
      }

      case 'payoneer_performance': {
        const payoneerAccs = accounts.filter((a) => a.type === 'payoneer');
        return payoneerAccs.map((acc) => {
          const directCredits = scopedPayments
            .filter((p) => p.receivingAccountId === acc.id)
            .reduce((sum, p) => sum + p.actualCreditedAmount, 0);
          const transfersIn = scopedTransfers
            .filter((t) => t.destinationAccountId === acc.id)
            .reduce((sum, t) => sum + t.destinationCreditedAmount, 0);
          const transfersOut = scopedTransfers
            .filter((t) => t.sourceAccountId === acc.id)
            .reduce((sum, t) => sum + t.sourceAmount, 0);

          return {
            accountId: acc.id,
            accountName: acc.name,
            currentBalance: acc.currentBalance,
            currency: acc.currency,
            directClientCredits: directCredits,
            transfersReceived: transfersIn,
            transfersSent: transfersOut,
          };
        });
      }

      case 'account_balances': {
        return accounts.map((acc) => ({
          accountId: acc.id,
          name: acc.name,
          type: acc.type,
          currency: acc.currency,
          openingBalance: acc.openingBalance,
          currentBalance: acc.currentBalance,
          status: acc.status,
        }));
      }

      case 'transfer_history': {
        return scopedTransfers.map((t) => {
          const src = accounts.find((a) => a.id === t.sourceAccountId);
          const dst = accounts.find((a) => a.id === t.destinationAccountId);
          return {
            transferId: t.id,
            date: t.transferDate,
            sourceAccount: src ? src.name : t.sourceAccountId,
            destinationAccount: dst ? dst.name : t.destinationAccountId,
            sourceAmount: t.sourceAmount,
            sourceCurrency: t.sourceCurrency,
            destinationCreditedAmount: t.destinationCreditedAmount,
            destinationCurrency: t.destinationCurrency,
            difference: t.difference,
            deductionPercentage: `${t.deductionPercentage?.toFixed(2) || 0}%`,
            feeCategory: t.feeCategory || '—',
            notes: t.notes || '',
          };
        });
      }

      case 'transfer_fees': {
        return scopedTransfers
          .filter((t) => t.difference > 0)
          .map((t) => {
            const src = accounts.find((a) => a.id === t.sourceAccountId);
            const dst = accounts.find((a) => a.id === t.destinationAccountId);
            return {
              transferId: t.id,
              date: t.transferDate,
              route: `${src?.name || 'Src'} (${src?.type}) → ${dst?.name || 'Dst'} (${dst?.type})`,
              sourceAmount: t.sourceAmount,
              creditedAmount: t.destinationCreditedAmount,
              feeAmount: t.difference,
              currency: t.sourceCurrency,
              deductionPercentage: `${t.deductionPercentage?.toFixed(2)}%`,
              feeCategory: t.feeCategory || 'Platform Fee',
            };
          });
      }

      case 'monthly_expenses': {
        const map: Record<string, { month: string; expenseCount: number; totalAmount: number }> = {};
        scopedExpenses.forEach((e) => {
          if (startDate && e.date < startDate) return;
          if (endDate && e.date > endDate) return;
          const m = e.date.slice(0, 7);
          if (!map[m]) map[m] = { month: m, expenseCount: 0, totalAmount: 0 };
          map[m].expenseCount += 1;
          map[m].totalAmount += convertToUSD(e.amount, e.currency, rates);
        });
        return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
      }

      case 'expense_categories': {
        const map: Record<string, { category: string; count: number; totalAmount: number }> = {};
        scopedExpenses.forEach((e) => {
          if (!map[e.category]) map[e.category] = { category: e.category, count: 0, totalAmount: 0 };
          map[e.category].count += 1;
          map[e.category].totalAmount += convertToUSD(e.amount, e.currency, rates);
        });
        return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
      }

      case 'net_cash_flow': {
        const monthMap: Record<string, { month: string; collections: number; expenses: number; netCash: number }> = {};
        scopedPayments.forEach((p) => {
          const m = p.paymentDate.slice(0, 7);
          if (!monthMap[m]) monthMap[m] = { month: m, collections: 0, expenses: 0, netCash: 0 };
          monthMap[m].collections += convertToUSD(p.paymentAmount, p.currency, rates);
        });
        scopedExpenses.forEach((e) => {
          const m = e.date.slice(0, 7);
          if (!monthMap[m]) monthMap[m] = { month: m, collections: 0, expenses: 0, netCash: 0 };
          monthMap[m].expenses += convertToUSD(e.amount, e.currency, rates);
        });
        return Object.values(monthMap)
          .map((item) => ({
            ...item,
            netCash: item.collections - item.expenses,
          }))
          .sort((a, b) => b.month.localeCompare(a.month));
      }

      case 'annual_summary': {
        const yearMap: Record<string, { year: string; totalBooked: number; totalCollected: number; totalExpenses: number; netIncome: number }> = {};
        scopedProjects.forEach((p) => {
          const y = p.bookingDate.slice(0, 4);
          if (!yearMap[y]) yearMap[y] = { year: y, totalBooked: 0, totalCollected: 0, totalExpenses: 0, netIncome: 0 };
          yearMap[y].totalBooked += convertToUSD(p.budget, p.currency, rates);
        });
        scopedPayments.forEach((pay) => {
          const y = pay.paymentDate.slice(0, 4);
          if (!yearMap[y]) yearMap[y] = { year: y, totalBooked: 0, totalCollected: 0, totalExpenses: 0, netIncome: 0 };
          yearMap[y].totalCollected += convertToUSD(pay.paymentAmount, pay.currency, rates);
        });
        scopedExpenses.forEach((e) => {
          const y = e.date.slice(0, 4);
          if (!yearMap[y]) yearMap[y] = { year: y, totalBooked: 0, totalCollected: 0, totalExpenses: 0, netIncome: 0 };
          yearMap[y].totalExpenses += convertToUSD(e.amount, e.currency, rates);
        });
        return Object.values(yearMap).map((item) => ({
          ...item,
          netIncome: item.totalCollected - item.totalExpenses,
        })).sort((a, b) => b.year.localeCompare(a.year));
      }

      default:
        return [];
    }
  }, [selectedReport, projects, payments, expenses, accounts, clients, transfers, startDate, endDate, rates]);

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      alert('No data to export.');
      return;
    }
    exportToCSV(`Xavinex_${selectedReport}`, reportData);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Selector & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-auto flex-1 max-w-md">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Select Financial Report
          </label>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
            className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
          >
            {reportOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <button
            onClick={handleExportCSV}
            disabled={reportData.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Print
          </button>
        </div>
      </div>

      {/* Report Table Display */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {reportOptions.find((r) => r.id === selectedReport)?.label}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Aggregate totals use USD reference rates. Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            {reportData.length} Records Found
          </span>
        </div>

        {reportData.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 italic">
            No records found matching this report criteria. Add transactions or adjust date filters.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[65vh]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  {Object.keys(reportData[0]).map((col) => (
                    <th key={col} className="py-2.5 px-3.5 capitalize whitespace-nowrap">
                      {col.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    {Object.keys(row).map((col) => {
                      const val = row[col];
                      const isNumeric = typeof val === 'number';
                      const isCurrency = isNumeric && (col === 'directBank' || /balance|amount|booked|paid|collected|due|fee|income|cash|budget|outstanding|credit|transfers|collections|expenses|fiverr|payoneer/i.test(col));
                      const nativeReport = ['account_balances', 'outstanding_payments', 'payoneer_performance', 'transfer_fees'].includes(selectedReport);
                      const cellCurrency = col === 'destinationCreditedAmount' ? row.destinationCurrency : row.sourceCurrency || (nativeReport || col === 'currentBalance' ? row.currency : 'USD');

                      return (
                        <td
                          key={col}
                          className={`py-2.5 px-3.5 whitespace-nowrap ${
                            isCurrency ? 'font-bold text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {isCurrency ? formatCurrency(val, cellCurrency || 'USD') : String(val ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
