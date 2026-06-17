import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { fromDoc } from '@/lib/firebase/helpers';
import type { Order, Product } from '@/types';

export interface ReportRange { from: Date; to: Date; }

export interface SalesReportRow {
  date: string;
  orders: number;
  revenue: number;
  avgOrderValue: number;
}

export interface ProductReportRow {
  productId: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
}

/** Fetch orders within a date range */
async function getOrdersInRange(range: ReportRange): Promise<Order[]> {
  const snap = await getDocs(query(
    collection(db, 'orders'),
    where('createdAt', '>=', Timestamp.fromDate(range.from)),
    where('createdAt', '<=', Timestamp.fromDate(range.to)),
    orderBy('createdAt', 'asc'),
  ));
  return snap.docs.map(d => fromDoc<Order>(d));
}

export async function getSalesReport(range: ReportRange): Promise<SalesReportRow[]> {
  const orders = await getOrdersInRange(range);
  const byDate = new Map<string, { orders: number; revenue: number }>();

  orders.forEach(o => {
    const key = new Date(o.createdAt).toISOString().slice(0, 10);
    const cur = byDate.get(key) ?? { orders: 0, revenue: 0 };
    cur.orders  += 1;
    cur.revenue += o.total;
    byDate.set(key, cur);
  });

  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date, orders: v.orders, revenue: v.revenue,
      avgOrderValue: v.orders > 0 ? v.revenue / v.orders : 0,
    }));
}

export async function getProductReport(range: ReportRange): Promise<{ best: ProductReportRow[]; worst: ProductReportRow[] }> {
  const orders = await getOrdersInRange(range);
  const byProduct = new Map<string, ProductReportRow>();

  orders.forEach(o => {
    o.items.forEach(item => {
      const cur = byProduct.get(item.productId) ?? {
        productId: item.productId, name: item.productName, sku: '', unitsSold: 0, revenue: 0,
      };
      cur.unitsSold += item.quantity;
      cur.revenue   += item.subtotal;
      byProduct.set(item.productId, cur);
    });
  });

  const all = Array.from(byProduct.values()).sort((a, b) => b.unitsSold - a.unitsSold);
  return { best: all.slice(0, 10), worst: all.slice(-10).reverse() };
}

export async function getCustomerReport(range: ReportRange): Promise<{ newCustomers: number; returningCustomers: number; totalOrders: number }> {
  const orders = await getOrdersInRange(range);
  const userOrderCounts = new Map<string, number>();

  orders.forEach(o => {
    if (!o.userId) return;
    userOrderCounts.set(o.userId, (userOrderCounts.get(o.userId) ?? 0) + 1);
  });

  let newCustomers = 0, returningCustomers = 0;
  userOrderCounts.forEach(count => count === 1 ? newCustomers++ : returningCustomers++);

  return { newCustomers, returningCustomers, totalOrders: orders.length };
}

export async function getRevenueReport(range: ReportRange) {
  const orders = await getOrdersInRange(range);
  const totalRevenue  = orders.reduce((s, o) => s + o.total, 0);
  const totalDiscount = orders.reduce((s, o) => s + o.discount, 0);
  const totalDelivery = orders.reduce((s, o) => s + o.deliveryCharge, 0);
  const cancelled      = orders.filter(o => o.status === 'cancelled').length;

  return {
    totalOrders: orders.length, totalRevenue, totalDiscount, totalDelivery,
    cancelled, netRevenue: totalRevenue,
  };
}

// ── CSV export helper ──────────────────────────────────────

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
