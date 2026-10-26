import { randomUUID } from 'node:crypto';
import { businessDate } from './dates.js';
import { collections } from './database.js';
import { accountInput, clientInput, projectInput, paymentInput, transferInput, expenseInput, settingsSchema, backupSchema, money, positiveMoney, date, text, requireThat, ApiError } from './validation.js';

export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const add = (a, b) => (Math.round(a * 100) + Math.round(b * 100)) / 100;
const now = () => new Date().toISOString();
const entity = data => ({ ...data, id: randomUUID(), createdAt: now() });
const find = (state, table, id) => { const row = state[table].find(r => r.id === id); if (!row) throw new ApiError(404, `${table} record not found`); return row; };
const active = a => requireThat(a.status === 'active', 'Account must be active');
export const routes = { fiverr: ['payoneer'], payoneer: ['payoneer', 'bank'], bank: ['bank', 'petty_cash'], petty_cash: ['bank'] };
function ledger(s, account, amount, type, dateValue, extra = {}) {
  const balance = add(account.currentBalance, amount);
  requireThat(balance >= 0, 'Insufficient funds for this change; restore funds to the account first', 409);
  money.parse(balance);
  account.currentBalance = balance;
  s.transactions.unshift(entity({ date: dateValue, timestamp: now(), type, accountId: account.id, accountName: account.name, accountType: account.type, currency: account.currency, amount, balanceAfter: balance, ...extra }));
}
const paidAmount = (s, p) => round(s.payments.filter(x => x.projectId === p.id).reduce((sum, x) => sum + x.paymentAmount, 0));
const recognizedBudget = (s, p) => p.status === 'cancelled' ? paidAmount(s, p) : p.budget;
const projectEntry = p => ({ referenceId: p.id, projectId: p.id, projectName: p.name, clientId: p.clientId });
function projectStatus(s, project) {
  const paid = round(s.payments.filter(p => p.projectId === project.id).reduce((a, p) => a + p.paymentAmount, 0));
  requireThat(paid <= project.budget, 'Project budget cannot be less than recorded payments');
  project.paymentStatus = paid === 0 ? 'unpaid' : paid >= project.budget ? 'fully_paid' : 'partially_paid';
}
function validateClient(s, c, ignoreId) {
  const account = find(s, 'accounts', c.linkedFiverrAccountId);
  requireThat(account.type === 'fiverr', 'Client must link to a Fiverr account');
  active(account);
  requireThat(!s.clients.some(x => x.id !== ignoreId && x.name.toLowerCase() === c.name.toLowerCase()), 'Client name already exists', 409);
  requireThat(!c.fiverrUsername || !s.clients.some(x => x.id !== ignoreId && x.linkedFiverrAccountId === c.linkedFiverrAccountId && x.fiverrUsername?.toLowerCase() === c.fiverrUsername.toLowerCase()), 'Fiverr username already exists for this account', 409);
}
function validateProject(s, p) {
  const c = find(s, 'clients', p.clientId);
  requireThat(c.status === 'active', 'Client must be active');
  active(find(s, 'accounts', c.linkedFiverrAccountId));
  requireThat(!p.expectedCompletionDate || p.expectedCompletionDate >= p.bookingDate, 'Completion date must follow booking date');
  return c;
}

export function mutate(s, action, id, input) {
  switch (action) {
    case 'accounts.create': {
      const data = accountInput.parse(input);
      const a = entity({ ...data, currentBalance: 0 }); s.accounts.unshift(a);
      if (data.openingBalance !== 0) ledger(s, a, data.openingBalance, 'opening_balance', businessDate(a.createdAt), { notes: 'Initial account opening balance' });
      return a;
    }
    case 'accounts.update': {
      const a = find(s, 'accounts', id);
      const data = accountInput.partial().parse(input);
      requireThat(data.type === undefined || data.type === a.type, 'Account type cannot be changed; create a new account');
      requireThat(data.currency === undefined || data.currency === a.currency, 'Account currency cannot be changed; create a new account');
      if (data.openingBalance !== undefined && data.openingBalance !== a.openingBalance) {
        ledger(s, a, add(data.openingBalance, -a.openingBalance), 'manual_balance_adjustment', businessDate(), { notes: `Opening balance corrected from ${a.openingBalance} to ${data.openingBalance}` });
      }
      Object.assign(a, data); return a;
    }
    case 'accounts.delete': {
      find(s, 'accounts', id);
      requireThat(!s.transactions.some(t => t.accountId === id) && !s.clients.some(c => c.linkedFiverrAccountId === id), 'Account has ledger history or linked clients; mark it inactive instead', 409);
      s.accounts = s.accounts.filter(a => a.id !== id); return null;
    }
    case 'accounts.adjust': {
      const data = adjustmentInput.parse(input);
      const a = find(s, 'accounts', id); active(a);
      const adjustment = entity({ accountId: id, date: data.date, previousBalance: a.currentBalance, newBalance: data.newBalance, difference: add(data.newBalance, -a.currentBalance), reason: data.reason });
      ledger(s, a, adjustment.difference, 'manual_balance_adjustment', data.date, { referenceId: adjustment.id, difference: adjustment.difference, notes: data.reason });
      s.adjustments.unshift(adjustment); return adjustment;
    }
    case 'clients.create': {
      const data = clientInput.parse(input); validateClient(s, data);
      const c = entity(data); s.clients.unshift(c); return c;
    }
    case 'clients.update': {
      const c = find(s, 'clients', id); const data = clientInput.partial().parse(input);
      validateClient(s, { ...c, ...data }, id); Object.assign(c, data); return c;
    }
    case 'clients.delete': {
      find(s, 'clients', id); requireThat(!s.projects.some(p => p.clientId === id), 'Client has existing projects; mark it inactive instead', 409);
      s.clients = s.clients.filter(c => c.id !== id); return null;
    }
    case 'projects.create': {
      const data = projectInput.parse(input); const c = validateProject(s, data);
      const a = find(s, 'accounts', c.linkedFiverrAccountId);
      requireThat(a.currency === data.currency, 'Project currency must match the linked Fiverr account');
      const p = entity({ ...data, linkedFiverrAccountId: c.linkedFiverrAccountId, balanceRecognition: 'booking', paymentStatus: 'unpaid' });
      s.projects.unshift(p);
      ledger(s, a, recognizedBudget(s, p), 'project_booking', p.bookingDate, { ...projectEntry(p), notes: 'Project value credited on booking' });
      return p;
    }
    case 'projects.update': {
      const p = find(s, 'projects', id); const data = projectInput.partial().parse(input);
      requireThat(!data.clientId || data.clientId === p.clientId, 'Project client association is permanent');
      requireThat(!data.currency || data.currency === p.currency || !s.payments.some(x => x.projectId === id), 'Cannot change currency after recording payments');
      const updated = { ...p, ...data };
      requireThat(!updated.expectedCompletionDate || updated.expectedCompletionDate >= updated.bookingDate, 'Completion date must follow booking date');
      if (p.balanceRecognition === 'booking') {
        requireThat(updated.currency === p.currency, 'Currency cannot change after booking credit; create a new project');
        projectStatus(s, updated);
        const difference = add(recognizedBudget(s, updated), -recognizedBudget(s, p));
        if (difference !== 0) ledger(s, find(s, 'accounts', p.linkedFiverrAccountId), difference, 'project_adjustment', businessDate(), { ...projectEntry(p), notes: 'Project budget or cancellation adjustment' });
      }
      Object.assign(p, data); projectStatus(s, p); return p;
    }
    case 'projects.delete': {
      const p = find(s, 'projects', id); requireThat(!s.payments.some(p => p.projectId === id), 'Project has recorded payments', 409);
      if (p.balanceRecognition === 'booking' && recognizedBudget(s, p) !== 0) ledger(s, find(s, 'accounts', p.linkedFiverrAccountId), -recognizedBudget(s, p), 'project_adjustment', businessDate(), { ...projectEntry(p), notes: 'Deleted project booking reversed' });
      s.projects = s.projects.filter(p => p.id !== id); return null;
    }
    case 'payments.create': {
      const data = paymentInput.parse(input);
      const p = find(s, 'projects', data.projectId), c = find(s, 'clients', data.clientId), a = find(s, 'accounts', data.receivingAccountId);
      active(a); requireThat(c.status === 'active' && p.status !== 'cancelled', 'Cannot pay an inactive client or cancelled project');
      requireThat(p.clientId === c.id, 'Project does not belong to client');
      requireThat(data.currency === p.currency, 'Payment currency must match the project');
      const converted = data.paymentRoute === 'bank_direct' && a.currency !== data.currency;
      requireThat(converted || data.currency === a.currency, 'Payment and receiving account currencies must match for this route');
      requireThat(data.paymentRoute === 'fiverr' ? a.type === 'fiverr' && a.id === p.linkedFiverrAccountId : a.type === (data.paymentRoute === 'bank_direct' ? 'bank' : 'payoneer'), 'Invalid receiving account for payment route');
      const exchangeRate = converted ? s.settings.exchangeRates[a.currency] / s.settings.exchangeRates[data.currency] : 1;
      const actualCreditedAmount = converted ? round(data.paymentAmount * exchangeRate) : data.actualCreditedAmount;
      positiveMoney.parse(actualCreditedAmount);
      if (converted) requireThat(data.actualCreditedAmount === undefined || data.actualCreditedAmount === actualCreditedAmount, 'Conversion preview no longer matches the current exchange rate. Review the payment and try again.', 409);
      else requireThat(actualCreditedAmount <= data.paymentAmount, 'Credited amount cannot exceed gross payment');
      const fee = converted ? 0 : add(data.paymentAmount, -actualCreditedAmount);
      requireThat(data.feeOrDeduction === undefined || round(data.feeOrDeduction) === fee, 'Fee must equal gross less credited amount');
      const payment = entity({ ...data, actualCreditedAmount, ...(converted ? { receivingCurrency: a.currency, exchangeRate } : {}), linkedFiverrAccountId: p.linkedFiverrAccountId, feeOrDeduction: fee, deductionPercentage: fee / data.paymentAmount * 100 });
      s.payments.unshift(payment); projectStatus(s, p);
      const extra = { referenceId: payment.id, fees: fee, difference: fee, deductionPercentage: payment.deductionPercentage, clientId: c.id, clientName: c.name, projectId: p.id, projectName: p.name, notes: data.notes || `Payment via ${data.paymentRoute}` };
      if (p.balanceRecognition === 'booking' && data.paymentRoute !== 'fiverr') {
        ledger(s, find(s, 'accounts', p.linkedFiverrAccountId), -data.paymentAmount, 'client_payment', data.paymentDate, { ...extra, notes: `Booked value moved out of Fiverr for direct ${data.paymentRoute === 'bank_direct' ? 'bank' : 'Payoneer'} receipt` });
      }
      // Booking already credited the gross value. A Fiverr receipt only deducts
      // fees; a direct receipt moves value from Fiverr into the receiving account.
      const amount = p.balanceRecognition === 'booking' && data.paymentRoute === 'fiverr' ? -fee : actualCreditedAmount;
      ledger(s, a, amount, 'client_payment', data.paymentDate, { ...extra, ...(converted ? { exchangeRate } : {}) });
      return payment;
    }
    case 'transfers.create': {
      const data = transferInput.parse(input), a = find(s, 'accounts', data.sourceAccountId), b = find(s, 'accounts', data.destinationAccountId);
      active(a); active(b);
      requireThat(a.id !== b.id && routes[a.type].includes(b.type), 'Transfer route is prohibited');
      requireThat(a.currentBalance >= data.sourceAmount, 'Insufficient funds', 409);
      const same = a.currency === b.currency;
      requireThat(!same || data.destinationCreditedAmount <= data.sourceAmount, 'Same-currency credit cannot exceed debit');
      const diff = same ? add(data.sourceAmount, -data.destinationCreditedAmount) : 0;
      const transfer = entity({ ...data, sourceCurrency: a.currency, destinationCurrency: b.currency, difference: diff, deductionPercentage: same ? diff / data.sourceAmount * 100 : 0, ...(same ? {} : { effectiveExchangeRate: data.destinationCreditedAmount / data.sourceAmount }) });
      const extra = { referenceId: transfer.id, sourceAccountId: a.id, sourceAccountName: a.name, sourceAccountType: a.type, destinationAccountId: b.id, destinationAccountName: b.name, destinationAccountType: b.type, difference: diff, fees: diff, deductionPercentage: transfer.deductionPercentage, ...(same ? {} : { exchangeRate: transfer.effectiveExchangeRate }), notes: data.notes };
      ledger(s, a, -data.sourceAmount, 'internal_transfer', data.transferDate, extra);
      ledger(s, b, data.destinationCreditedAmount, 'internal_transfer', data.transferDate, extra);
      s.transfers.unshift(transfer); return transfer;
    }
    case 'expenses.create': {
      const data = expenseInput.parse(input), a = find(s, 'accounts', data.payingAccountId); active(a);
      requireThat(['bank', 'petty_cash'].includes(a.type), 'Expenses must be paid from a bank or petty cash account');
      requireThat(data.currency === a.currency, 'Expense currency must match paying account');
      requireThat(s.settings.customExpenseCategories.includes(data.category), 'Unknown expense category');
      requireThat(a.currentBalance >= data.amount, 'Insufficient funds', 409);
      const e = entity(data); ledger(s, a, -e.amount, 'expense', e.date, { referenceId: e.id, notes: `Expense: ${e.title} [${e.category}]` }); s.expenses.unshift(e); return e;
    }
    case 'expenses.delete': {
      const e = find(s, 'expenses', id), a = find(s, 'accounts', e.payingAccountId);
      ledger(s, a, e.amount, 'reversal', businessDate(), { referenceId: e.id, notes: `Reversal of deleted expense: ${e.title}` });
      s.expenses = s.expenses.filter(x => x.id !== id); return null;
    }
    case 'settings.update': {
      const patch = settingsSchema.partial().parse(input);
      s.settings = settingsSchema.parse({ ...s.settings, ...patch, exchangeRates: patch.exchangeRates || s.settings.exchangeRates, exchangeRateLastUpdated: businessDate() }); return s.settings;
    }
    case 'data.clear': {
      requireThat(input.confirm === 'DELETE ALL BUSINESS DATA', 'Explicit confirmation required', 400);
      for (const t of collections) s[t] = []; return null;
    }
    case 'data.restore': {
      const data = validateBackup(input); Object.assign(s, data); return null;
    }
    default: throw new ApiError(404, 'Unknown action');
  }
}

import { z } from 'zod';
const adjustmentInput = z.object({ newBalance: money, reason: text, date }).strict();

export function validateBackup(input) {
  const s = backupSchema.parse(input);
  for (const t of collections) requireThat(new Set(s[t].map(r => r.id)).size === s[t].length, `Duplicate IDs in ${t}`);
  for (const c of s.clients) requireThat(find(s, 'accounts', c.linkedFiverrAccountId).type === 'fiverr', 'Invalid client association');
  for (const p of s.projects) {
    find(s, 'clients', p.clientId);
    requireThat(find(s, 'accounts', p.linkedFiverrAccountId).type === 'fiverr', 'Invalid project attribution');
    if (p.balanceRecognition === 'booking') {
      requireThat(find(s, 'accounts', p.linkedFiverrAccountId).currency === p.currency, 'Invalid booking currency');
      const entries = s.transactions.filter(t => t.projectId === p.id && ['project_booking', 'project_adjustment'].includes(t.type));
      requireThat(entries.filter(t => t.type === 'project_booking').length === 1 && entries.every(t => t.accountId === p.linkedFiverrAccountId) && round(entries.reduce((sum, t) => sum + t.amount, 0)) === recognizedBudget(s, p), 'Project booking ledger does not reconcile');
    }
    const expected = p.paymentStatus; projectStatus(s, p); requireThat(expected === p.paymentStatus, 'Project payment status does not reconcile');
  }
  for (const p of s.payments) {
    const project = find(s, 'projects', p.projectId), a = find(s, 'accounts', p.receivingAccountId);
    const converted = p.paymentRoute === 'bank_direct' && a.currency !== p.currency;
    requireThat(project.clientId === p.clientId && project.linkedFiverrAccountId === p.linkedFiverrAccountId && project.currency === p.currency && (converted || a.currency === p.currency), 'Payment associations or currencies do not reconcile');
    requireThat(p.paymentRoute === 'fiverr' ? a.id === p.linkedFiverrAccountId && a.type === 'fiverr' : a.type === (p.paymentRoute === 'bank_direct' ? 'bank' : 'payoneer'), 'Invalid payment route');
    if (converted) requireThat(p.receivingCurrency === a.currency && p.exchangeRate > 0 && round(p.paymentAmount * p.exchangeRate) === p.actualCreditedAmount && p.feeOrDeduction === 0, 'Bank currency conversion does not reconcile');
    else requireThat((p.receivingCurrency === undefined || p.receivingCurrency === a.currency) && (p.exchangeRate === undefined || p.exchangeRate === 1) && p.actualCreditedAmount <= p.paymentAmount && add(p.paymentAmount, -p.actualCreditedAmount) === round(p.feeOrDeduction), 'Invalid payment fee');
    p.feeOrDeduction = round(p.feeOrDeduction);
    p.deductionPercentage = p.feeOrDeduction / p.paymentAmount * 100;
  }
  for (const t of s.transfers) {
    const a = find(s, 'accounts', t.sourceAccountId), b = find(s, 'accounts', t.destinationAccountId);
    requireThat(a.id !== b.id && routes[a.type].includes(b.type) && a.currency === t.sourceCurrency && b.currency === t.destinationCurrency, 'Invalid transfer');
    if (a.currency === b.currency) {
      requireThat(t.destinationCreditedAmount <= t.sourceAmount && add(t.sourceAmount, -t.destinationCreditedAmount) === round(t.difference), 'Invalid transfer deduction');
      t.difference = round(t.difference); t.deductionPercentage = t.difference / t.sourceAmount * 100;
    }
    else { t.difference = 0; t.deductionPercentage = 0; t.effectiveExchangeRate = t.destinationCreditedAmount / t.sourceAmount; }
  }
  for (const e of s.expenses) requireThat(find(s, 'accounts', e.payingAccountId).currency === e.currency, 'Invalid expense currency');
  for (const a of s.adjustments) { find(s, 'accounts', a.accountId); requireThat(add(a.newBalance, -a.previousBalance) === a.difference, 'Invalid balance adjustment'); }
  for (const t of s.transactions) {
    const a = find(s, 'accounts', t.accountId);
    requireThat(t.currency === a.currency && t.accountType === a.type, 'Invalid ledger account');
    for (const f of ['sourceAccountId', 'destinationAccountId']) if (t[f]) find(s, 'accounts', t[f]);
  }
  for (const a of s.accounts) {
    const tx = s.transactions.filter(t => t.accountId === a.id);
    requireThat(round(tx.reduce((sum, t) => sum + t.amount, 0)) === a.currentBalance, `Ledger does not reconcile for ${a.name}`);
    // Older browser backups can omit zero opening entries; nonzero balances must have history.
    requireThat(a.currentBalance === 0 || tx.length > 0, 'Missing account ledger');
    let balance = 0;
    for (const entry of [...tx].reverse()) {
      balance = add(balance, entry.amount);
      requireThat(balance === entry.balanceAfter, `Ledger running balance does not reconcile for ${a.name}`);
    }
  }
  for (const p of s.payments) {
    const project = find(s, 'projects', p.projectId);
    const booked = project.balanceRecognition === 'booking';
    const amount = booked && p.paymentRoute === 'fiverr' ? -p.feeOrDeduction : p.actualCreditedAmount;
    const entries = s.transactions.filter(t => t.referenceId === p.id && t.type === 'client_payment');
    requireThat(entries.length === (booked && p.paymentRoute !== 'fiverr' ? 2 : 1) && entries.filter(t => t.accountId === p.receivingAccountId && t.amount === amount).length === 1, 'Payment ledger missing or duplicated');
    if (p.receivingCurrency && p.receivingCurrency !== p.currency) requireThat(entries.some(t => t.accountId === p.receivingAccountId && t.exchangeRate === p.exchangeRate), 'Payment ledger exchange rate does not reconcile');
    if (booked && p.paymentRoute !== 'fiverr') requireThat(entries.some(t => t.accountId === project.linkedFiverrAccountId && t.amount === -p.paymentAmount), 'Direct payment booking debit missing');
  }
  for (const t of s.transfers) {
    const tx = s.transactions.filter(x => x.referenceId === t.id && x.type === 'internal_transfer');
    requireThat(tx.length === 2 && tx.some(x => x.accountId === t.sourceAccountId && x.amount === -t.sourceAmount) && tx.some(x => x.accountId === t.destinationAccountId && x.amount === t.destinationCreditedAmount), 'Transfer ledger does not reconcile');
  }
  for (const e of s.expenses) requireThat(s.transactions.filter(t => t.referenceId === e.id && t.type === 'expense' && t.accountId === e.payingAccountId && t.amount === -e.amount).length === 1, 'Expense ledger missing or duplicated');
  return s;
}

export function report(s, filters = {}) {
  const from = filters.from || '0000-01-01', to = filters.to || '9999-12-31';
  if (filters.from) date.parse(filters.from); if (filters.to) date.parse(filters.to);
  requireThat(from <= to, 'Invalid date range', 400);
  const matches = (r, field) => r[field] >= from && r[field] <= to && (!filters.accountId || [r.linkedFiverrAccountId, r.receivingAccountId, r.payingAccountId, r.sourceAccountId, r.destinationAccountId, r.accountId].includes(filters.accountId)) && (!filters.clientId || r.clientId === filters.clientId);
  const usd = (n, c) => n / s.settings.exchangeRates[c];
  const sum = (rows, field) => round(rows.reduce((n, r) => n + usd(r[field], r.currency), 0));
  const projects = s.projects.filter(p => matches(p, 'bookingDate'));
  const payments = s.payments.filter(p => matches(p, 'paymentDate'));
  const expenses = s.expenses.filter(p => matches(p, 'date'));
  const transfers = s.transfers.filter(p => matches(p, 'transferDate'));
  const transactions = s.transactions.filter(p => matches(p, 'date'));
  const bookedUSD = sum(projects, 'budget'), collectedUSD = sum(payments, 'paymentAmount'), expensesUSD = sum(expenses, 'amount');
  const months = {};
  for (const [rows, field, amount, key] of [[projects, 'bookingDate', 'budget', 'bookedUSD'], [payments, 'paymentDate', 'paymentAmount', 'collectedUSD'], [expenses, 'date', 'amount', 'expensesUSD']]) for (const row of rows) {
    const month = row[field].slice(0, 7); months[month] ||= { month, bookedUSD: 0, collectedUSD: 0, expensesUSD: 0 };
    months[month][key] = round(months[month][key] + usd(row[amount], row.currency));
  }
  return { bookedUSD, collectedUSD, expensesUSD, netCashFlowUSD: round(collectedUSD - expensesUSD), outstandingUSD: round(projects.reduce((n, p) => n + usd(p.budget - s.payments.filter(x => x.projectId === p.id).reduce((n, x) => n + x.paymentAmount, 0), p.currency), 0)), availableBalanceUSD: sum(s.accounts.filter(a => !filters.accountId || a.id === filters.accountId), 'currentBalance'), monthly: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)), projects, payments, expenses, transfers, transactions };
}
