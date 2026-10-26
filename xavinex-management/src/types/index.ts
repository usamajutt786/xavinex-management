export type AccountType = 'fiverr' | 'payoneer' | 'bank' | 'petty_cash';

export type Currency = 'USD' | 'PKR' | 'EUR' | 'GBP';

export interface FinancialAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  openingBalance: number;
  currentBalance: number;
  status: 'active' | 'inactive';
  createdAt: string;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  linkedFiverrAccountId: string; // Required Fiverr account association
  status: 'active' | 'inactive';
  fiverrUsername?: string;
  companyName?: string;
  email?: string;
  country?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

export type ProjectStatus = 'queued' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'fully_paid';

export interface Project {
  id: string;
  name: string;
  clientId: string;
  linkedFiverrAccountId: string; // Inherited from client automatically
  budget: number;
  currency: Currency;
  bookingDate: string; // YYYY-MM-DD client confirmation date; locks full project value in this month independently of payments
  balanceRecognition?: 'booking'; // Older projects retain payment-based balance accounting
  expectedCompletionDate?: string;
  status: ProjectStatus;
  paymentStatus: PaymentStatus;
  notes?: string;
  createdAt: string;
}

export type PaymentRoute = 'fiverr' | 'payoneer_direct' | 'bank_direct';

export interface ClientPayment {
  id: string;
  clientId: string;
  projectId: string;
  linkedFiverrAccountId: string; // Recorded for attribution
  paymentAmount: number; // Gross payment amount reducing project outstanding
  currency: Currency;
  paymentDate: string;
  receivingAccountId: string; // Financial account credited
  paymentRoute: PaymentRoute;
  actualCreditedAmount: number; // Amount credited to receiving account
  receivingCurrency?: Currency; // Destination currency for converted bank receipts
  exchangeRate?: number; // Destination units per project currency unit, fixed at posting
  feeOrDeduction: number; // Difference if applicable
  deductionPercentage: number;
  description?: string;
  notes?: string;
  createdAt: string;
}

export interface FundTransfer {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  transferDate: string;
  sourceAmount: number;
  destinationCreditedAmount: number;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  difference: number;
  deductionPercentage: number;
  effectiveExchangeRate?: number;
  feeCategory?: string;
  notes?: string;
  createdAt: string;
}

export type TransactionType =
  | 'project_booking'
  | 'project_adjustment'
  | 'opening_balance'
  | 'client_payment'
  | 'internal_transfer'
  | 'expense'
  | 'fee_deduction'
  | 'manual_balance_adjustment'
  | 'refund'
  | 'reversal';

export interface AccountTransaction {
  id: string;
  date: string;
  timestamp: string;
  type: TransactionType;
  accountId: string; // The primary account this ledger record belongs to
  accountName: string;
  accountType: AccountType;
  sourceAccountId?: string;
  sourceAccountName?: string;
  sourceAccountType?: AccountType;
  destinationAccountId?: string;
  destinationAccountName?: string;
  destinationAccountType?: AccountType;
  amount: number; // Positive for inflow, negative for outflow
  balanceAfter: number;
  currency: Currency;
  difference?: number;
  fees?: number;
  deductionPercentage?: number;
  exchangeRate?: number;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectName?: string;
  referenceId?: string; // Links to paymentId, transferId, expenseId, etc.
  notes?: string;
  createdAt: string;
}

export interface BalanceAdjustment {
  id: string;
  accountId: string;
  date: string;
  previousBalance: number;
  newBalance: number;
  difference: number; // newBalance - previousBalance
  reason: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  amount: number;
  currency: Currency;
  date: string;
  payingAccountId: string;
  description?: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface ExchangeRate {
  pair: string; // e.g., 'USD/PKR', 'EUR/USD', 'GBP/USD'
  rate: number;
  updatedAt: string;
}

export interface AppSettings {
  reportingCurrency: Currency;
  exchangeRates: Record<string, number>; // e.g. { 'PKR': 278.5, 'EUR': 0.92, 'GBP': 0.79, 'USD': 1.0 }
  exchangeRateLastUpdated: string;
  customExpenseCategories: string[];
}
