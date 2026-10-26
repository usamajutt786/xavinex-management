import type { Project } from '../types';
import { convertToUSD, formatMonth } from './formatters';

// Every booked project is a confirmed order; delivery and payment status do not
// change the month in which it was originally locked.
export function monthlyBusinessLocked(
  projects: Pick<Project, 'bookingDate' | 'budget' | 'currency'>[],
  rates: Record<string, number>,
  currentMonth: string,
) {
  const totals = new Map<string, number>();
  for (const project of projects) {
    const month = project.bookingDate.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + convertToUSD(project.budget, project.currency, rates));
  }
  const months = [...totals.keys(), currentMonth].sort();
  const [startYear, startMonth] = months[0].split('-').map(Number);
  const [endYear, endMonth] = months[months.length - 1].split('-').map(Number);
  const rows = [];
  for (let index = startYear * 12 + startMonth - 1; index <= endYear * 12 + endMonth - 1; index++) {
    const month = `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
    rows.push({ month, monthLabel: formatMonth(month), lockedUSD: totals.get(month) ?? 0 });
  }
  return rows;
}
