import React, { useState, lazy, Suspense, useMemo } from 'react';
import { businessDate } from './utils/formatters';
import { DataProvider, useData } from './context/DataContext';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { KPIGrid } from './components/dashboard/KPIGrid';
import { AccountCard } from './components/accounts/AccountCard';
import { AccountModal } from './components/accounts/AccountModal';
import { EditBalanceModal } from './components/accounts/EditBalanceModal';
import { AccountLedgerModal } from './components/accounts/AccountLedgerModal';
import { ClientList } from './components/clients/ClientList';
import { ClientModal } from './components/clients/ClientModal';
import { ProjectList } from './components/projects/ProjectList';
import { ProjectModal } from './components/projects/ProjectModal';
import { RecordPaymentModal } from './components/payments/RecordPaymentModal';
import { TransferList } from './components/transfers/TransferList';
import { TransferModal } from './components/transfers/TransferModal';
import { ExpenseList } from './components/expenses/ExpenseList';
import { ExpenseModal } from './components/expenses/ExpenseModal';
import { PipelineView } from './components/pipeline/PipelineView';
import { SettingsView } from './components/settings/SettingsView';
import { EmptyState } from './components/common/EmptyState';
import { FinancialAccount, Client, Project, AccountType } from './types';
import {
  Globe,
  DollarSign,
  Building2,
  Plus,
  TrendingUp,
  Receipt,
  ArrowRightLeft,
  Briefcase,
  Users,
} from 'lucide-react';

const DashboardCharts = lazy(() => import('./components/dashboard/DashboardCharts').then(module => ({ default: module.DashboardCharts })));
const AnalyticsView = lazy(() => import('./components/analytics/AnalyticsView').then(module => ({ default: module.AnalyticsView })));
const ReportsView = lazy(() => import('./components/reports/ReportsView').then(module => ({ default: module.ReportsView })));
const ClientDetailModal = lazy(() => import('./components/clients/ClientDetailModal').then(module => ({ default: module.ClientDetailModal })));

function AppContent() {
  const {
    accounts,
    clients,
    projects,
    payments,
    transfers,
    transactions,
    adjustments,
    expenses,
    settings,
    metrics,
    createAccount,
    updateAccount,
    deleteAccount,
    adjustBalance,
    editOpeningBalance,
    createClient,
    updateClient,
    deleteClient,
    createProject,
    updateProject,
    deleteProject,
    recordClientPayment,
    recordTransfer,
    recordExpense,
    deleteExpense,
    updateSettings,
    updateExchangeRate,
    clearAllData,
    loadBackupData,
  } = useData();

  // Navigation
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalType, setAccountModalType] = useState<AccountType>('fiverr');
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);

  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
  const [balanceEditAccount, setBalanceEditAccount] = useState<FinancialAccount | null>(null);

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState<FinancialAccount | null>(null);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [isClientDetailModalOpen, setIsClientDetailModalOpen] = useState(false);
  const [detailClient, setDetailClient] = useState<Client | null>(null);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectInitialClient, setProjectInitialClient] = useState<Client | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentInitialClient, setPaymentInitialClient] = useState<Client | null>(null);
  const [paymentInitialProject, setPaymentInitialProject] = useState<Project | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const fiverrAccounts = useMemo(() => accounts.filter((a) => a.type === 'fiverr'), [accounts]);
  const payoneerAccounts = useMemo(() => accounts.filter((a) => a.type === 'payoneer'), [accounts]);
  const bankAndCashAccounts = useMemo(() => accounts.filter((a) => a.type === 'bank' || a.type === 'petty_cash'), [accounts]);

  // Trigger Account Creation for a specific type
  const openNewAccount = (type: AccountType) => {
    setAccountModalType(type);
    setEditingAccount(null);
    setIsAccountModalOpen(true);
  };

  // Trigger Client Project
  const handleOpenNewProjectForClient = (client: Client) => {
    setProjectInitialClient(client);
    setEditingProject(null);
    setIsProjectModalOpen(true);
  };

  // Trigger Record Payment for a Client/Project
  const handleOpenRecordPaymentFor = (client: Client, project?: Project) => {
    setPaymentInitialClient(client);
    setPaymentInitialProject(project || null);
    setIsPaymentModalOpen(true);
  };

  // Calculate monthly stats for account cards
  const getAccountMonthlyStats = (accId: string) => {
    const currentMonth = businessDate().slice(0, 7);
    const accTxs = transactions.filter(
      (tx) => (tx.accountId === accId || tx.sourceAccountId === accId || tx.destinationAccountId === accId) &&
      tx.date.startsWith(currentMonth)
    );

    let inflow = 0;
    let outflow = 0;
    accTxs.forEach((tx) => {
      if (tx.accountId === accId) {
        if (tx.amount > 0) inflow += tx.amount;
        else outflow += Math.abs(tx.amount);
      }
    });

    return { inflow, outflow };
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navbar */}
        <Navbar
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenPaymentModal={() => {
            setPaymentInitialClient(null);
            setPaymentInitialProject(null);
            setIsPaymentModalOpen(true);
          }}
          onOpenTransferModal={() => setIsTransferModalOpen(true)}
          onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
          onOpenProjectModal={() => {
            setProjectInitialClient(null);
            setEditingProject(null);
            setIsProjectModalOpen(true);
          }}
          onOpenClientModal={() => {
            setEditingClient(null);
            setIsClientModalOpen(true);
          }}
        />

        {/* View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <Suspense fallback={<div className="p-6 text-sm text-slate-500" role="status">Loading view…</div>}>
          {/* TAB 1: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              <KPIGrid
                metrics={metrics}
                accounts={accounts}
                exchangeRates={settings.exchangeRates}
                onEditBalance={(a) => {
                  setBalanceEditAccount(a);
                  setIsEditBalanceModalOpen(true);
                }}
                onViewLedger={(a) => {
                  setLedgerAccount(a);
                  setIsLedgerModalOpen(true);
                }}
                onOpenAddAccount={() => openNewAccount('fiverr')}
              />
              <DashboardCharts
                projects={projects}
                payments={payments}
                expenses={expenses}
                accounts={accounts}
                clients={clients}
                transfers={transfers}
              />
            </div>
          )}

          {/* TAB 2: CLIENTS */}
          {currentTab === 'clients' && (
            <div className="space-y-6">
              <ClientList
                clients={clients}
                projects={projects}
                payments={payments}
                fiverrAccounts={fiverrAccounts}
                onOpenCreateModal={() => {
                  setEditingClient(null);
                  setIsClientModalOpen(true);
                }}
                onOpenEditModal={(client) => {
                  setEditingClient(client);
                  setIsClientModalOpen(true);
                }}
                onOpenDetailModal={(client) => {
                  setDetailClient(client);
                  setIsClientDetailModalOpen(true);
                }}
                onOpenNewProject={handleOpenNewProjectForClient}
                onDeleteClient={async (id) => {
                  const res = await deleteClient(id);
                  if (!res.success) {
                    alert(res.error);
                  }
                }}
              />
            </div>
          )}

          {/* TAB 3: PROJECTS */}
          {currentTab === 'projects' && (
            <div className="space-y-6">
              <ProjectList
                projects={projects}
                clients={clients}
                payments={payments}
                fiverrAccounts={fiverrAccounts}
                onOpenCreateModal={() => {
                  setProjectInitialClient(null);
                  setEditingProject(null);
                  setIsProjectModalOpen(true);
                }}
                onOpenEditModal={(project) => {
                  setEditingProject(project);
                  setIsProjectModalOpen(true);
                }}
                onOpenRecordPayment={handleOpenRecordPaymentFor}
                onDeleteProject={async (id) => {
                  const res = await deleteProject(id);
                  if (!res.success) {
                    alert(res.error);
                  }
                }}
              />
            </div>
          )}

          {/* TAB 4: BUSINESS PIPELINE */}
          {currentTab === 'pipeline' && (
            <div className="space-y-6">
              <PipelineView
                projects={projects}
                clients={clients}
                payments={payments}
                fiverrAccounts={fiverrAccounts}
                onOpenNewProject={() => {
                  setProjectInitialClient(null);
                  setEditingProject(null);
                  setIsProjectModalOpen(true);
                }}
                onUpdateProjectStatus={async (id, status) => {
                  try { await updateProject(id, { status }); } catch (e) { alert((e as Error).message); }
                }}
                onOpenRecordPayment={handleOpenRecordPaymentFor}
                onOpenEditProject={(project) => {
                  setEditingProject(project);
                  setIsProjectModalOpen(true);
                }}
                onOpenClientProfile={(client) => {
                  setDetailClient(client);
                  setIsClientDetailModalOpen(true);
                }}
              />
            </div>
          )}

          {/* TAB 5: FIVERR ACCOUNTS */}
          {currentTab === 'fiverr_accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    Fiverr Accounts
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage individual Fiverr freelancer accounts. Projects and clients link permanently to these accounts.
                  </p>
                </div>
                <button
                  onClick={() => openNewAccount('fiverr')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Fiverr Account
                </button>
              </div>

              {fiverrAccounts.length === 0 ? (
                <EmptyState
                  icon={Globe}
                  title="No Fiverr Accounts Created"
                  description="Add individual Fiverr accounts (e.g. Salman, Osama, Hassan). Clients and projects will be associated with these accounts."
                  actionText="Add First Fiverr Account"
                  onAction={() => openNewAccount('fiverr')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fiverrAccounts.map((acc) => {
                    const stats = getAccountMonthlyStats(acc.id);
                    return (
                      <AccountCard
                        key={acc.id}
                        account={acc}
                        monthlyInflow={stats.inflow}
                        monthlyOutflow={stats.outflow}
                        exchangeRates={settings.exchangeRates}
                        onEditBalance={(a) => {
                          setBalanceEditAccount(a);
                          setIsEditBalanceModalOpen(true);
                        }}
                        onViewLedger={(a) => {
                          setLedgerAccount(a);
                          setIsLedgerModalOpen(true);
                        }}
                        onEditAccount={(a) => {
                          setEditingAccount(a);
                          setAccountModalType('fiverr');
                          setIsAccountModalOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PAYONEER ACCOUNTS */}
          {currentTab === 'payoneer_accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    Payoneer Accounts
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Direct client deposit destination and Fiverr withdrawal receiving accounts.
                  </p>
                </div>
                <button
                  onClick={() => openNewAccount('payoneer')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Payoneer Account
                </button>
              </div>

              {payoneerAccounts.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="No Payoneer Accounts Created"
                  description="Create Payoneer accounts (e.g. Abdur Rahman, Salman, Osama). These accounts can receive direct client payments or transfers."
                  actionText="Add First Payoneer Account"
                  onAction={() => openNewAccount('payoneer')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {payoneerAccounts.map((acc) => {
                    const stats = getAccountMonthlyStats(acc.id);
                    return (
                      <AccountCard
                        key={acc.id}
                        account={acc}
                        monthlyInflow={stats.inflow}
                        monthlyOutflow={stats.outflow}
                        exchangeRates={settings.exchangeRates}
                        onEditBalance={(a) => {
                          setBalanceEditAccount(a);
                          setIsEditBalanceModalOpen(true);
                        }}
                        onViewLedger={(a) => {
                          setLedgerAccount(a);
                          setIsLedgerModalOpen(true);
                        }}
                        onEditAccount={(a) => {
                          setEditingAccount(a);
                          setAccountModalType('payoneer');
                          setIsAccountModalOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: BANK & CASH */}
          {currentTab === 'bank_cash' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    Bank Accounts & Business Petty Cash
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Company local bank accounts and physical cash wallets used for paying expenses and withdrawals.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openNewAccount('bank')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Bank
                  </button>
                  <button
                    onClick={() => openNewAccount('petty_cash')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Petty Cash
                  </button>
                </div>
              </div>

              {bankAndCashAccounts.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No Bank or Cash Accounts Created"
                  description="Register your corporate bank accounts or physical cash registers to track operational cash and expense deductions."
                  actionText="Add Bank Account"
                  onAction={() => openNewAccount('bank')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bankAndCashAccounts.map((acc) => {
                    const stats = getAccountMonthlyStats(acc.id);
                    return (
                      <AccountCard
                        key={acc.id}
                        account={acc}
                        monthlyInflow={stats.inflow}
                        monthlyOutflow={stats.outflow}
                        exchangeRates={settings.exchangeRates}
                        onEditBalance={(a) => {
                          setBalanceEditAccount(a);
                          setIsEditBalanceModalOpen(true);
                        }}
                        onViewLedger={(a) => {
                          setLedgerAccount(a);
                          setIsLedgerModalOpen(true);
                        }}
                        onEditAccount={(a) => {
                          setEditingAccount(a);
                          setAccountModalType(a.type);
                          setIsAccountModalOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: FUND TRANSFERS */}
          {currentTab === 'transfers' && (
            <div className="space-y-6">
              <TransferList
                transfers={transfers}
                accounts={accounts}
                onOpenCreateTransfer={() => setIsTransferModalOpen(true)}
              />
            </div>
          )}

          {/* TAB 9: EXPENSES */}
          {currentTab === 'expenses' && (
            <div className="space-y-6">
              <ExpenseList
                expenses={expenses}
                accounts={accounts}
                categories={settings.customExpenseCategories}
                onOpenCreateExpense={() => setIsExpenseModalOpen(true)}
                onDeleteExpense={async (id) => {
                  const res = await deleteExpense(id); if (!res.success) alert(res.error);
                }}
              />
            </div>
          )}

          {/* TAB 10: ANALYTICS & LINE GRAPHS */}
          {currentTab === 'analytics' && (
            <div className="space-y-6">
              <AnalyticsView
                projects={projects}
                payments={payments}
                expenses={expenses}
                accounts={accounts}
                clients={clients}
                transfers={transfers}
                transactions={transactions}
              />
            </div>
          )}

          {/* TAB 11: REPORTS */}
          {currentTab === 'reports' && (
            <div className="space-y-6">
              <ReportsView
                projects={projects}
                payments={payments}
                expenses={expenses}
                accounts={accounts}
                clients={clients}
                transfers={transfers}
                transactions={transactions}
              />
            </div>
          )}

          {/* TAB 12: SETTINGS */}
          {currentTab === 'settings' && (
            <div className="space-y-6">
              <SettingsView
                settings={settings}
                onUpdateSettings={updateSettings}
                onClearAllData={clearAllData}
                onLoadBackup={loadBackupData}
              />
            </div>
          )}
        </Suspense></main>
      </div>

      {/* ALL MODALS */}
      {/* 1. Account Create/Edit Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        initialType={accountModalType}
        accountToEdit={editingAccount}
        onSave={async (data) => {
          if (editingAccount) {
            await updateAccount(editingAccount.id, data);
          } else {
            await createAccount(data);
          }
        }}
      />

      {/* 2. Manual Balance Editing Modal */}
      <EditBalanceModal
        isOpen={isEditBalanceModalOpen}
        onClose={() => setIsEditBalanceModalOpen(false)}
        account={accounts.find(x => x.id === balanceEditAccount?.id) || null}
        onAdjustBalance={adjustBalance}
        onEditOpeningBalance={editOpeningBalance}
      />

      {/* 3. Account Ledger Modal */}
      <AccountLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        account={accounts.find(x => x.id === ledgerAccount?.id) || null}
        transactions={transactions}
      />

      {/* 4. Client Create/Edit Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        fiverrAccounts={fiverrAccounts}
        clientToEdit={editingClient}
        existingClients={clients}
        onOpenCreateAccountModal={() => openNewAccount('fiverr')}
        onSave={async (data) => {
          if (editingClient) {
            await updateClient(editingClient.id, data);
          } else {
            await createClient(data);
          }
        }}
      />

      {/* 5. Client Profile & Lifetime Growth Detail Modal */}
      {isClientDetailModalOpen && <Suspense fallback={null}><ClientDetailModal
        isOpen={isClientDetailModalOpen}
        onClose={() => setIsClientDetailModalOpen(false)}
        client={clients.find(x => x.id === detailClient?.id) || null}
        projects={projects}
        payments={payments}
        fiverrAccounts={fiverrAccounts}
        onOpenNewProject={handleOpenNewProjectForClient}
        onOpenRecordPayment={handleOpenRecordPaymentFor}
      /></Suspense>}

      {/* 6. Project Create/Edit Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        clients={clients}
        fiverrAccounts={fiverrAccounts}
        initialClient={projectInitialClient}
        projectToEdit={editingProject}
        onOpenCreateClientModal={() => {
          setEditingClient(null);
          setIsClientModalOpen(true);
        }}
        onSave={async (data) => {
          if (editingProject) {
            await updateProject(editingProject.id, data);
          } else {
            await createProject(data);
          }
        }}
      />

      {/* 7. Record Client Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        clients={clients}
        projects={projects}
        accounts={accounts}
        initialClient={paymentInitialClient}
        initialProject={paymentInitialProject}
        onRecordPayment={recordClientPayment}
      />

      {/* 8. Fund Transfer Modal */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        accounts={accounts}
        onRecordTransfer={recordTransfer}
      />

      {/* 9. Record Expense Modal */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        accounts={accounts}
        categories={settings.customExpenseCategories}
        onSaveExpense={recordExpense}
      />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
