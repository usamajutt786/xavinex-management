import { AccountType, Currency } from '../types';
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
export const businessDate = (value: string | Date = new Date()) => businessDateFormatter.format(new Date(value));

export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    if (currency === 'PKR') {
      return `PKR ${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toFixed(2)}`;
  }
}

export function formatNumber(val: number): string {
  const safeVal = Number.isFinite(val) ? val : 0;
  return safeVal.toLocaleString('en-US');
}

export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatMonth(monthKey: string): string {
  if (!monthKey) return '—';
  try {
    const parts = monthKey.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const date = new Date(year, month, 1);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    }
    return monthKey;
  } catch {
    return monthKey;
  }
}

export function formatDateTime(dateTimeString: string): string {
  if (!dateTimeString) return '—';
  try {
    return new Date(dateTimeString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateTimeString;
  }
}

export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'fiverr':
      return 'Fiverr Account';
    case 'payoneer':
      return 'Payoneer Account';
    case 'bank':
      return 'Bank Account';
    case 'petty_cash':
      return 'Business Petty Cash';
    default:
      return type;
  }
}

export function getAccountFullName(account: { name: string; type: AccountType }): string {
  return `${account.name} — ${getAccountTypeLabel(account.type)}`;
}

export function getAccountTypeBadgeClass(type: AccountType): { bg: string; text: string; border: string } {
  switch (type) {
    case 'fiverr':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'payoneer':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'bank':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'petty_cash':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
  }
}

export function isTransferAllowed(sourceType: AccountType, destType: AccountType): { allowed: boolean; reason?: string } {
  if (sourceType === 'fiverr' && destType === 'fiverr') {
    return {
      allowed: false,
      reason: 'Fiverr to Fiverr transfers are strictly prohibited.',
    };
  }

  // Allowed combinations:
  // Fiverr -> Payoneer
  // Payoneer -> Payoneer
  // Payoneer -> Bank
  // Bank -> Bank
  // Bank -> Petty Cash
  // Petty Cash -> Bank
  if (sourceType === 'fiverr') {
    if (destType === 'payoneer') return { allowed: true };
    return { allowed: false, reason: 'Fiverr accounts can only transfer to Payoneer accounts.' };
  }

  if (sourceType === 'payoneer') {
    if (destType === 'payoneer' || destType === 'bank') return { allowed: true };
    return { allowed: false, reason: 'Payoneer accounts can only transfer to Payoneer or Bank accounts.' };
  }

  if (sourceType === 'bank') {
    if (destType === 'bank' || destType === 'petty_cash') return { allowed: true };
    return { allowed: false, reason: 'Bank accounts can only transfer to Bank or Business Petty Cash accounts.' };
  }

  if (sourceType === 'petty_cash') {
    if (destType === 'bank') return { allowed: true };
    return { allowed: false, reason: 'Petty Cash can only be transferred back to a Bank account.' };
  }

  return { allowed: false, reason: 'Invalid transfer route.' };
}

export function convertToUSD(amount: number, fromCurrency: Currency, rates: Record<string, number>): number {
  if (fromCurrency === 'USD') return amount;
  const rate = rates[fromCurrency];
  if (!rate || rate <= 0) return amount;
  // If rate is PKR = 278.5, then amount PKR in USD is amount / rate
  // If rate is EUR = 0.92, amount in USD is amount / rate
  return amount / rate;
}
