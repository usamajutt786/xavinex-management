import React from 'react';
import { NavTab } from './Sidebar';
import { Menu, Plus, CreditCard, ArrowRightLeft, Receipt, Briefcase, UserPlus } from 'lucide-react';

interface NavbarProps {
  currentTab: NavTab;
  onOpenMobileSidebar: () => void;
  onOpenPaymentModal: () => void;
  onOpenTransferModal: () => void;
  onOpenExpenseModal: () => void;
  onOpenProjectModal: () => void;
  onOpenClientModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onOpenPaymentModal,
  onOpenTransferModal,
  onOpenExpenseModal,
  onOpenProjectModal,
  onOpenClientModal,
}) => {
  const getTabTitle = (tab: NavTab) => {
    switch (tab) {
      case 'dashboard':
        return 'Executive Financial Dashboard';
      case 'clients':
        return 'Client Portfolio & Fiverr Associations';
      case 'projects':
        return 'Project Bookings & Outstanding Receivables';
      case 'pipeline':
        return 'Business Pipeline & Backlog';
      case 'fiverr_accounts':
        return 'Fiverr Accounts Management';
      case 'payoneer_accounts':
        return 'Payoneer Accounts Management';
      case 'bank_cash':
        return 'Bank & Business Petty Cash';
      case 'transfers':
        return 'Fund Transfers & Platform Deductions';
      case 'expenses':
        return 'Operational Expenses Management';
      case 'analytics':
        return 'Interactive Analytics & Line Graphs';
      case 'reports':
        return 'Financial Reports & Auditing';
      case 'settings':
        return 'System Configuration & Currency';
      default:
        return 'Xavinex Management';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden cursor-pointer"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            {getTabTitle(currentTab)}
          </h1>
          <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block">
            Xavinex Enterprise Financial Operations
          </p>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPaymentModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Record</span> Payment
        </button>

        <button
          onClick={onOpenTransferModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Fund</span> Transfer
        </button>

        <button
          onClick={onOpenExpenseModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <Receipt className="w-3.5 h-3.5 text-rose-600" />
          <span className="hidden sm:inline">Record</span> Expense
        </button>

        <button
          onClick={onOpenProjectModal}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Book Project</span>
          <span className="md:hidden">Project</span>
        </button>
      </div>
    </header>
  );
};
