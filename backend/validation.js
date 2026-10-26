import { z } from 'zod';
export const currencies = z.enum(['USD', 'PKR', 'EUR', 'GBP']);
export const accountTypes = z.enum(['fiverr', 'payoneer', 'bank', 'petty_cash']);
export const id = z.string().min(1).max(100);
export const text = z.string().trim().min(1).max(200);
export const optionalText = z.string().max(5000).optional();
export const money = z.number().finite().min(0).max(1e12).refine(n => Math.abs(n - Math.round(n * 100) / 100) < 1e-9, 'Use at most two decimal places');
export const signedMoney = z.number().finite().min(-1e12).max(1e12).refine(n => Math.abs(n - Math.round(n * 100) / 100) < 1e-9, 'Use at most two decimal places');
export const positiveMoney = money.refine(n => n > 0, 'Amount must be greater than zero');
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }, 'Invalid calendar date');
const timestamp = z.iso.datetime();
const meta = { id, createdAt: timestamp };
const status = z.enum(['active', 'inactive']);
export const accountInput = z.object({ name: text, type: accountTypes, currency: currencies, openingBalance: money, status, notes: optionalText }).strict();
export const clientInput = z.object({ name: text, linkedFiverrAccountId: id, status, fiverrUsername: optionalText, companyName: optionalText, email: z.union([z.email(), z.literal('')]).optional(), country: optionalText, phone: optionalText, notes: optionalText }).strict();
export const projectInput = z.object({ name: text, clientId: id, budget: positiveMoney, currency: currencies, bookingDate: date, expectedCompletionDate: z.union([date, z.literal('')]).transform(v => v || undefined).optional(), status: z.enum(['queued', 'in_progress', 'on_hold', 'completed', 'cancelled']), notes: optionalText }).strict();
export const paymentInput = z.object({ clientId: id, projectId: id, paymentAmount: positiveMoney, currency: currencies, paymentDate: date, receivingAccountId: id, paymentRoute: z.enum(['fiverr', 'payoneer_direct', 'bank_direct']), actualCreditedAmount: positiveMoney.optional(), feeOrDeduction: money.optional(), description: optionalText, notes: optionalText }).strict();
export const transferInput = z.object({ sourceAccountId: id, destinationAccountId: id, transferDate: date, sourceAmount: positiveMoney, destinationCreditedAmount: positiveMoney, feeCategory: optionalText, notes: optionalText }).strict();
export const expenseInput = z.object({ title: text, category: text, subcategory: optionalText, amount: positiveMoney, currency: currencies, date, payingAccountId: id, description: optionalText, receiptNumber: optionalText, notes: optionalText }).strict();
export const settingsSchema = z.object({ reportingCurrency: currencies, exchangeRates: z.object({ USD: z.literal(1), PKR: z.number().positive().max(1e9), EUR: z.number().positive().max(1e9), GBP: z.number().positive().max(1e9) }).strict(), exchangeRateLastUpdated: date, customExpenseCategories: z.array(text).min(1).max(100).refine(a => new Set(a).size === a.length, 'Duplicate categories') }).strict();
export const transactionSchema = z.object({ ...meta, date, timestamp, type: z.enum(['project_booking', 'project_adjustment', 'opening_balance', 'client_payment', 'internal_transfer', 'expense', 'fee_deduction', 'manual_balance_adjustment', 'refund', 'reversal']), accountId: id, accountName: text, accountType: accountTypes, sourceAccountId: id.optional(), sourceAccountName: text.optional(), sourceAccountType: accountTypes.optional(), destinationAccountId: id.optional(), destinationAccountName: text.optional(), destinationAccountType: accountTypes.optional(), amount: signedMoney, balanceAfter: money, currency: currencies, difference: signedMoney.optional(), fees: money.optional(), deductionPercentage: z.number().finite().optional(), exchangeRate: z.number().positive().optional(), clientId: id.optional(), clientName: text.optional(), projectId: id.optional(), projectName: text.optional(), referenceId: id.optional(), notes: optionalText }).strict();
export const adjustmentSchema = z.object({ ...meta, accountId: id, date, previousBalance: money, newBalance: money, difference: signedMoney, reason: text }).strict();
export const backupSchema = z.object({
  accounts: z.array(accountInput.extend({ ...meta, currentBalance: money })),
  clients: z.array(clientInput.extend(meta)),
  projects: z.array(projectInput.extend({ ...meta, linkedFiverrAccountId: id, balanceRecognition: z.literal('booking').optional(), paymentStatus: z.enum(['unpaid', 'partially_paid', 'fully_paid']) })),
  payments: z.array(paymentInput.extend({ ...meta, actualCreditedAmount: positiveMoney, receivingCurrency: currencies.optional(), exchangeRate: z.number().finite().positive().optional(), linkedFiverrAccountId: id, feeOrDeduction: money, deductionPercentage: z.number().finite() })),
  transfers: z.array(transferInput.extend({ ...meta, sourceCurrency: currencies, destinationCurrency: currencies, difference: signedMoney, deductionPercentage: z.number().finite(), effectiveExchangeRate: z.number().positive().optional() })),
  expenses: z.array(expenseInput.extend(meta)), adjustments: z.array(adjustmentSchema), transactions: z.array(transactionSchema), settings: settingsSchema,
}).strict();
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireThat(condition, message, status = 422) { if (!condition) throw new ApiError(status, message); }
