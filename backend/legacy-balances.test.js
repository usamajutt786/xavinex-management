import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, collections } from './database.js';
import { mutate, validateBackup } from './service.js';

test('historical payment-based projects and backups keep their original balances', () => {
  const state = { ...Object.fromEntries(collections.map(name => [name, []])), settings: defaultSettings() };
  const account = mutate(state, 'accounts.create', null, { name: 'Historical Fiverr', type: 'fiverr', currency: 'USD', openingBalance: 0, status: 'active' });
  const client = mutate(state, 'clients.create', null, { name: 'Historical Client', linkedFiverrAccountId: account.id, status: 'active' });
  const project = mutate(state, 'projects.create', null, { name: 'Historical Project', clientId: client.id, budget: 1000, currency: 'USD', bookingDate: '2026-01-01', status: 'in_progress' });
  // Shape of data written before booking-based balance accounting existed.
  delete project.balanceRecognition;
  state.transactions = [];
  account.currentBalance = 0;
  assert.deepEqual(validateBackup(structuredClone(state)), state);
  mutate(state, 'payments.create', null, { clientId: client.id, projectId: project.id, receivingAccountId: account.id, paymentRoute: 'fiverr', paymentAmount: 1000, actualCreditedAmount: 800, currency: 'USD', paymentDate: '2026-02-01' });
  assert.equal(account.currentBalance, 800);
  assert.equal(project.paymentStatus, 'fully_paid');
  assert.deepEqual(validateBackup(structuredClone(state)), state);
});

test('direct bank receipts on historical projects credit the bank without debiting Fiverr', () => {
  const state = { ...Object.fromEntries(collections.map(name => [name, []])), settings: defaultSettings() };
  const createAccount = type => mutate(state, 'accounts.create', null, { name: type, type, currency: 'USD', openingBalance: 0, status: 'active' });
  const fiverr = createAccount('fiverr'), bank = createAccount('bank');
  const c = mutate(state, 'clients.create', null, { name: 'Legacy bank client', linkedFiverrAccountId: fiverr.id, status: 'active' });
  const p = mutate(state, 'projects.create', null, { name: 'Legacy bank project', clientId: c.id, budget: 1000, currency: 'USD', bookingDate: '2026-01-01', status: 'in_progress' });
  delete p.balanceRecognition; state.transactions = []; fiverr.currentBalance = 0;
  mutate(state, 'payments.create', null, { clientId: c.id, projectId: p.id, paymentRoute: 'bank_direct', receivingAccountId: bank.id, currency: 'USD', paymentDate: '2026-02-01', paymentAmount: 1000, actualCreditedAmount: 990 });
  assert.equal(bank.currentBalance, 990); assert.equal(fiverr.currentBalance, 0);
  assert.deepEqual(validateBackup(structuredClone(state)), state);
});
