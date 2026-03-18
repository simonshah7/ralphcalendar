import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Map display currency symbols to ISO codes for Intl.NumberFormat
const CURRENCY_ISO_MAP: Record<string, string> = {
  'US$': 'USD',
  'UK£': 'GBP',
  'EUR': 'EUR',
};

export function formatCurrency(amount: number | string, currency: string = 'US$'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const isoCode = CURRENCY_ISO_MAP[currency] || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: isoCode,
  }).format(num);
}

export function getDaysBetween(start: Date | string, end: Date | string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export function addDays(date: Date | string, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance > 0.179 ? '#000000' : '#ffffff';
}

export const DEFAULT_STATUSES = [
  { name: 'Considering', color: '#2563EB' },
  { name: 'Negotiating', color: '#D97706' },
  { name: 'Committed', color: '#047857' },
];

export const CURRENCIES = ['US$', 'UK£', 'EUR'] as const;
export const REGIONS = ['US', 'EMEA', 'ROW'] as const;

export type Currency = (typeof CURRENCIES)[number];
export type Region = (typeof REGIONS)[number];
