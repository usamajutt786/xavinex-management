import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { FinancialAccount, Client, Project, ClientPayment, FundTransfer, AccountTransaction, BalanceAdjustment, Expense, AppSettings, PaymentRoute, Currency } from '../types';
import { convertToUSD } from '../utils/formatters';
import { useBusinessMonth } from '../utils/useBusinessMonth';
import { api, User } from '../api';
import { Login } from '../components/Login';
import { AccessSettings } from '../components/settings/AccessSettings';
interface DataContextType {
  user: User;
  // Entities
  accounts: FinancialAccount[];
  clients: Client[];
  projects: Project[];
  payments: ClientPayment[];
  transfers: FundTransfer[];
  transactions: AccountTransaction[];
  adjustments: BalanceAdjustment[];
  expenses: Expense[];
  settings: AppSettings;

  // Account actions
  createAccount: (data: Omit<FinancialAccount, 'id' | 'currentBalance' | 'createdAt'>) => Promise<FinancialAccount>;
  updateAccount: (id: string, data: Partial<FinancialAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
  adjustBalance: (accountId: string, newBalance: number, reason: string, date: string) => Promise<void>;
  editOpeningBalance: (accountId: string, newOpeningBalance: number) => Promise<void>;

  // Client actions
  createClient: (data: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Project actions
  createProject: (data: Omit<Project, 'id' | 'linkedFiverrAccountId' | 'paymentStatus' | 'createdAt'>) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Payment actions
  recordClientPayment: (data: {
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

  // Transfer actions
  recordTransfer: (data: {
    sourceAccountId: string;
    destinationAccountId: string;
    transferDate: string;
    sourceAmount: number;
    destinationCreditedAmount: number;
    feeCategory?: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;

  // Expense actions
  recordExpense: (data: Omit<Expense, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
  deleteExpense: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Settings & DB management
  updateSettings: (data: Partial<AppSettings>) => Promise<void>;
  updateExchangeRate: (currency: string, rate: number) => Promise<void>;
  clearAllData: () => Promise<void>;
  loadBackupData: (backup: any) => Promise<{ success: boolean; error?: string }>;

  // Computed Financial Metrics
  metrics: {
    totalBusinessBookedUSD: number;
    totalPaymentsReceivedUSD: number;
    outstandingPaymentsUSD: number;
    totalExpensesUSD: number;
    availableBalanceUSD: number;
    totalFiverrBalanceUSD: number;
    totalPayoneerBalanceUSD: number;
    totalBankBalanceUSD: number;
    totalPettyCashBalanceUSD: number;
    totalTransferDeductionsUSD: number;
    activeProjectsCount: number;
    completedProjectsCount: number;
    totalClientsCount: number;
    totalProjectsCount: number;
    thisMonthBookedUSD: number;
    thisYearBookedUSD: number;
    thisMonthExpensesUSD: number;
    thisMonthCollectionsUSD: number;
    thisMonthNetCashFlowUSD: number;
  };
}


const defaultSettings: AppSettings = { reportingCurrency: 'USD', exchangeRates: { USD: 1, PKR: 278.5, EUR: 0.92, GBP: 0.79 }, exchangeRateLastUpdated: '', customExpenseCategories: [] };
const DataContext = createContext<DataContextType | undefined>(undefined);
type State = Pick<DataContextType, 'accounts' | 'clients' | 'projects' | 'payments' | 'transfers' | 'transactions' | 'adjustments' | 'expenses' | 'settings'>;
const emptyState: State = { accounts: [], clients: [], projects: [], payments: [], transfers: [], transactions: [], adjustments: [], expenses: [], settings: defaultSettings };
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const currentMonth = useBusinessMonth();
  const [state, setState] = useState<State>(emptyState);
  const { accounts, clients, projects, payments, transfers, transactions, adjustments, expenses, settings } = state;
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true); const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(0);
  const [access, setAccess] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const revision = useRef(0);
  const pending = useRef(0);
  const refresh = async () => {
    if (pending.current > 0) return;
    const version = revision.current;
    try { const data = await api<State>('/state'); if (version === revision.current) { setState(previous => JSON.stringify(previous) === JSON.stringify(data) ? previous : data); setLoaded(true); setError(''); } }
    catch (e) { setError((e as Error).message); }
  };
  useEffect(() => {
    api('/auth/me').then(r => setUser(r.user)).catch(() => {}).finally(() => setChecking(false));
    const expired = () => { setUser(null); setState(emptyState); setLoaded(false); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  useEffect(() => { if (user) void refresh(); }, [user]);
  useEffect(() => {
    if (!user) return;
    const onFocus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const timer = window.setInterval(onFocus, 15000);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); window.clearInterval(timer); };
  }, [user]);
  const change = (path: string, method: string, data?: unknown): Promise<any> => {
    revision.current += 1;
    pending.current += 1;
    setBusy(n => n + 1);
    const task = queue.current.catch(() => {}).then(async () => {
      try { const result = await api(path, method, data, true); setState(result.state); setError(''); return result.data; }
      catch (e) { setError((e as Error).message); throw e; }
      finally { revision.current += 1; pending.current -= 1; setBusy(n => n - 1); }
    });
    queue.current = task; return task;
  };
  const result = async (task: Promise<any>) => { try { await task; return { success: true }; } catch (e) { return { success: false, error: (e as Error).message }; } };
  const createAccount: DataContextType['createAccount'] = data => change('/accounts', 'POST', data);
  const clearOptionalFields = (data: object) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === undefined ? '' : value]));
  const updateAccount: DataContextType['updateAccount'] = async (id, data) => { await change('/accounts/' + id, 'PATCH', clearOptionalFields(data)); };
  const deleteAccount: DataContextType['deleteAccount'] = id => result(change('/accounts/' + id, 'DELETE'));
  const adjustBalance: DataContextType['adjustBalance'] = async (id, newBalance, reason, date) => { await change('/accounts/' + id + '/adjustments', 'POST', { newBalance, reason, date }); };
  const editOpeningBalance: DataContextType['editOpeningBalance'] = async (id, openingBalance) => { await change('/accounts/' + id, 'PATCH', { openingBalance }); };
  const createClient: DataContextType['createClient'] = data => change('/clients', 'POST', data);
  const updateClient: DataContextType['updateClient'] = async (id, data) => { await change('/clients/' + id, 'PATCH', clearOptionalFields(data)); };
  const deleteClient: DataContextType['deleteClient'] = id => result(change('/clients/' + id, 'DELETE'));
  const createProject: DataContextType['createProject'] = data => change('/projects', 'POST', data);
  const updateProject: DataContextType['updateProject'] = async (id, data) => { await change('/projects/' + id, 'PATCH', clearOptionalFields(data)); };
  const deleteProject: DataContextType['deleteProject'] = id => result(change('/projects/' + id, 'DELETE'));
  const recordClientPayment: DataContextType['recordClientPayment'] = data => result(change('/payments', 'POST', data));
  const recordTransfer: DataContextType['recordTransfer'] = data => result(change('/transfers', 'POST', data));
  const recordExpense: DataContextType['recordExpense'] = data => result(change('/expenses', 'POST', data));
  const deleteExpense: DataContextType['deleteExpense'] = id => result(change('/expenses/' + id, 'DELETE'));
  const updateSettings: DataContextType['updateSettings'] = async data => { await change('/settings', 'PATCH', data); };
  const updateExchangeRate: DataContextType['updateExchangeRate'] = async (currency, rate) => { await updateSettings({ exchangeRates: { ...settings.exchangeRates, [currency]: rate } }); };
  const clearAllData: DataContextType['clearAllData'] = async () => { await change('/data', 'DELETE', { confirm: 'DELETE ALL BUSINESS DATA' }); };
  const loadBackupData: DataContextType['loadBackupData'] = data => result(change('/restore', 'POST', data));
  // Metrics computation strictly from entered records
  const metrics = useMemo(() => {
    const rates = settings.exchangeRates;

    // 1. Total Business Booked USD (sum of project budgets converted to USD)
    const totalBusinessBookedUSD = projects.reduce((sum, p) => {
      return sum + convertToUSD(p.budget, p.currency, rates);
    }, 0);

    // 2. Total Payments Received USD (sum of client payments gross amount converted to USD)
    const totalPaymentsReceivedUSD = payments.reduce((sum, p) => {
      return sum + convertToUSD(p.paymentAmount, p.currency, rates);
    }, 0);

    // 3. Outstanding Payments USD
    const outstandingPaymentsUSD = Math.max(0, totalBusinessBookedUSD - totalPaymentsReceivedUSD);

    // 4. Total Expenses USD
    const totalExpensesUSD = expenses.reduce((sum, e) => {
      return sum + convertToUSD(e.amount, e.currency, rates);
    }, 0);

    // 5. Balances by Account Type
    let fiverrUSD = 0;
    let payoneerUSD = 0;
    let bankUSD = 0;
    let pettyCashUSD = 0;

    accounts.forEach((acc) => {
      const balUSD = convertToUSD(acc.currentBalance, acc.currency, rates);
      if (acc.type === 'fiverr') fiverrUSD += balUSD;
      else if (acc.type === 'payoneer') payoneerUSD += balUSD;
      else if (acc.type === 'bank') bankUSD += balUSD;
      else if (acc.type === 'petty_cash') pettyCashUSD += balUSD;
    });

    const availableBalanceUSD = fiverrUSD + payoneerUSD + bankUSD + pettyCashUSD;

    // 6. Transfer deductions
    const totalTransferDeductionsUSD = transfers.reduce((sum, t) => {
      if (t.difference > 0 && t.sourceCurrency === t.destinationCurrency) {
        return sum + convertToUSD(t.difference, t.sourceCurrency, rates);
      }
      return sum;
    }, 0);

    // 7. This month metrics
    const currentMonthPrefix = currentMonth;
    const currentYearPrefix = currentMonth.slice(0, 4);

    // This month booked: strictly by project bookingDate
    const thisMonthBookedUSD = projects
      .filter((p) => p.bookingDate.startsWith(currentMonthPrefix))
      .reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);

    // This year booked: strictly by project bookingDate
    const thisYearBookedUSD = projects
      .filter((p) => p.bookingDate.startsWith(currentYearPrefix))
      .reduce((sum, p) => sum + convertToUSD(p.budget, p.currency, rates), 0);

    // This month collections: strictly by paymentDate
    const thisMonthCollectionsUSD = payments
      .filter((p) => p.paymentDate.startsWith(currentMonthPrefix))
      .reduce((sum, p) => sum + convertToUSD(p.paymentAmount, p.currency, rates), 0);

    // This month expenses: strictly by expense date
    const thisMonthExpensesUSD = expenses
      .filter((e) => e.date.startsWith(currentMonthPrefix))
      .reduce((sum, e) => sum + convertToUSD(e.amount, e.currency, rates), 0);

    const thisMonthNetCashFlowUSD = thisMonthCollectionsUSD - thisMonthExpensesUSD;

    const activeProjectsCount = projects.filter((p) => p.status === 'in_progress' || p.status === 'queued').length;
    const completedProjectsCount = projects.filter((p) => p.status === 'completed').length;

    return {
      totalBusinessBookedUSD,
      totalPaymentsReceivedUSD,
      outstandingPaymentsUSD,
      totalExpensesUSD,
      availableBalanceUSD,
      totalFiverrBalanceUSD: fiverrUSD,
      totalPayoneerBalanceUSD: payoneerUSD,
      totalBankBalanceUSD: bankUSD,
      totalPettyCashBalanceUSD: pettyCashUSD,
      totalTransferDeductionsUSD,
      activeProjectsCount,
      completedProjectsCount,
      totalClientsCount: clients.length,
      totalProjectsCount: projects.length,
      thisMonthBookedUSD,
      thisYearBookedUSD,
      thisMonthExpensesUSD,
      thisMonthCollectionsUSD,
      thisMonthNetCashFlowUSD,
    };
  }, [accounts, clients, projects, payments, transfers, expenses, settings, currentMonth]);

  if (checking) return <div className="p-10">Connecting to Xavinex…</div>;
  if (!user) return <Login onLogin={nextUser => { setState(emptyState); setLoaded(false); setAccess(false); setError(''); setUser(nextUser); }} />;
  if (!loaded) return <div className="p-10" role="alert">{error || 'Loading your workspace…'}{error && <button className="ml-4 underline" onClick={() => void refresh()}>Retry</button>}</div>;
  return (
    <DataContext.Provider
      value={{
        user,
        accounts,
        clients,
        projects,
        payments,
        transfers,
        transactions,
        adjustments,
        expenses,
        settings,
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
        metrics,
      }}
    >
      <div className="bg-slate-900 text-white text-xs px-4 py-2 flex items-center justify-end gap-4">
        <span>{user.companyName} · {user.name} · {user.role}</span>
        <button onClick={() => setAccess(!access)}>Account & access</button>
        <button onClick={async () => { try { await api('/auth/logout', 'POST'); setUser(null); setState(emptyState); setLoaded(false); } catch (e) { setError((e as Error).message); } }}>Sign out</button>
      </div>
      {error && <div role="alert" className="bg-red-50 text-red-800 p-3 flex gap-4">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {busy > 0 && <div className="fixed inset-0 z-[100] bg-slate-900/20 flex items-center justify-center" role="status"><span className="bg-white rounded-lg p-5 shadow">Saving…</span></div>}
      {access && <AccessSettings user={user} onPasswordChanged={() => { setUser(null); setLoaded(false); }} />}
      <React.Fragment key={user.companyId}>{children}</React.Fragment>
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
