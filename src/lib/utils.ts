import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatPrice = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);

export const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat('en-BD', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);

export const slugify = (t: string) =>
  t.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();

export const truncate = (t: string, n: number) =>
  t.length > n ? t.slice(0, n) + '…' : t;

// ── Constants ─────────────────────────────────────────────

export const ORDER_PIPELINE = [
  'pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered',
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
  packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<string, string> = {
  pending:    'text-amber-700  bg-amber-50  border-amber-200',
  confirmed:  'text-blue-700   bg-blue-50   border-blue-200',
  processing: 'text-violet-700 bg-violet-50 border-violet-200',
  packed:     'text-cyan-700   bg-cyan-50   border-cyan-200',
  shipped:    'text-indigo-700 bg-indigo-50 border-indigo-200',
  delivered:  'text-green-700  bg-green-50  border-green-200',
  cancelled:  'text-red-700    bg-red-50    border-red-200',
};

export const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery', bkash: 'bKash', nagad: 'Nagad',
};

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const LOW_STOCK_THRESHOLD = 5;
export const APP_NAME = 'FashionOS Admin';
