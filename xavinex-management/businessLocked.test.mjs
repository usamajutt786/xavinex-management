import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyBusinessLocked } from './src/utils/businessLocked.ts';
import { businessDate } from './src/utils/formatters.ts';

const project = (bookingDate, budget = 1000, currency = 'USD') => ({ bookingDate, budget, currency });
test('repeat projects are locked individually in their confirmation months, including unpaid orders', () => {
  const projects = [project('2026-01-10'), project('2026-02-15'), project('2026-08-01')];
  const data = monthlyBusinessLocked(projects, { USD: 1 }, '2026-08');
  assert.deepEqual(data.map(row => row.lockedUSD), [1000, 1000, 0, 0, 0, 0, 0, 1000]);
  // A later payment, delivery completion, or payment status does not rebook an order.
  projects[0].paymentDate = '2026-03-12';
  projects[0].paymentStatus = 'fully_paid';
  projects[0].status = 'completed';
  assert.deepEqual(monthlyBusinessLocked(projects, { USD: 1 }, '2026-08'), data);
});
test('sums full budgets in USD, handles year boundaries and months without new business', () => {
  const data = monthlyBusinessLocked([project('2025-12-31'), project('2025-12-15', 280000, 'PKR')], { USD: 1, PKR: 280 }, '2026-02');
  assert.deepEqual(data.map(row => [row.month, row.lockedUSD]), [['2025-12', 2000], ['2026-01', 0], ['2026-02', 0]]);
  assert.deepEqual(monthlyBusinessLocked([], { USD: 1 }, '2026-02').map(row => row.lockedUSD), [0]);
});
test('editing confirmation date or budget updates the historical month and leaves no stale totals', () => {
  const projects = [project('2026-01-15')];
  projects[0] = project('2026-02-01', 1500);
  assert.deepEqual(monthlyBusinessLocked(projects, { USD: 1 }, '2026-03').map(row => row.lockedUSD), [1500, 0]);
});
test('current business month uses Karachi time across UTC month boundaries', () => {
  assert.equal(businessDate('2026-01-31T20:00:00Z').slice(0, 7), '2026-02');
});
