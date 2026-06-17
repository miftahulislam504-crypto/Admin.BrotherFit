'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminOrders, updateOrderStatus, getOrderCountsByStatus } from '@/services/adminService';
import { Skeleton } from '@/components/ui/Spinner';
import { formatPrice, formatDate, STATUS_COLORS, STATUS_LABELS, ORDER_PIPELINE, cn } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';
import toast from 'react-hot-toast';

export default function OrdersPage() {
  const [orders,  setOrders]   = useState<Order[]>([]);
  const [counts,  setCounts]   = useState<Record<string,number>>({});
  const [filter,  setFilter]   = useState<OrderStatus|'all'>('all');
  const [loading, setLoading]  = useState(true);

  const load = async (f: OrderStatus|'all') => {
    setLoading(true);
    const { orders } = await getAdminOrders({ status: f === 'all' ? undefined : f, pageSize: 30 });
    setOrders(orders);
    setLoading(false);
  };

  useEffect(() => {
    getOrderCountsByStatus().then(setCounts);
    load('all');
  }, []);

  const handleFilterChange = (f: OrderStatus|'all') => {
    setFilter(f);
    load(f);
  };

  const handleStatusUpdate = async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      toast.success('Order updated');
    } catch {
      toast.error('Failed to update order');
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Pipeline overview ─────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {ORDER_PIPELINE.map(status => (
          <button
            key={status}
            onClick={() => handleFilterChange(status as OrderStatus)}
            className={cn(
              'card card-inner text-center transition-all hover:border-accent',
              filter === status && 'border-primary bg-primary/5'
            )}
          >
            <p className="font-mono text-xl font-bold text-primary">
              {counts[status] ?? 0}
            </p>
            <p className="text-[10px] text-muted mt-0.5 capitalize">{status}</p>
          </button>
        ))}
      </div>

      {/* ── Filter tabs ───────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...ORDER_PIPELINE] as const).map(f => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              filter === f
                ? 'bg-primary text-white border-primary'
                : 'bg-surface border-border text-muted hover:border-accent'
            )}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
            {f !== 'all' && counts[f] ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>

      {/* ── Table ────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg/40">
                {['Order','Customer','Items','Payment','Total','Status','Date','Action'].map(h => (
                  <th key={h} className="tbl-head tbl-cell text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_,i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(8)].map((_,j) => (
                      <td key={j} className="tbl-cell"><Skeleton className="h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="tbl-cell text-center text-muted py-10">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onStatusChange={handleStatusUpdate}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── OrderRow ───────────────────────────────────────────── */

function OrderRow({
  order,
  onStatusChange,
}: {
  order: Order;
  onStatusChange: (id: string, s: OrderStatus) => void;
}) {
  const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: 'confirmed', confirmed: 'processing',
    processing: 'packed', packed: 'shipped', shipped: 'delivered',
  };

  const nextStatus = NEXT_STATUS[order.status];

  return (
    <tr className="tbl-row">
      <td className="tbl-cell">
        <Link href={`/orders/${order.id}`} className="font-mono text-xs text-primary hover:underline">
          #{order.id.slice(0,8).toUpperCase()}
        </Link>
      </td>
      <td className="tbl-cell">
        <p className="font-medium text-text text-xs">{order.address.name}</p>
        <p className="text-muted text-[11px]">{order.address.phone}</p>
      </td>
      <td className="tbl-cell text-muted">{order.items.length}</td>
      <td className="tbl-cell text-xs capitalize text-muted">{order.paymentMethod}</td>
      <td className="tbl-cell font-mono font-semibold text-primary">{formatPrice(order.total)}</td>
      <td className="tbl-cell">
        <span className={cn('badge border text-[10px]', STATUS_COLORS[order.status])}>
          {STATUS_LABELS[order.status]}
        </span>
      </td>
      <td className="tbl-cell text-xs text-muted whitespace-nowrap">
        {order.createdAt ? formatDate(new Date(order.createdAt as unknown as string)) : '—'}
      </td>
      <td className="tbl-cell">
        <div className="flex items-center gap-1.5">
          {nextStatus && (
            <button
              onClick={() => onStatusChange(order.id, nextStatus)}
              className="text-[10px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-lg hover:bg-primary hover:text-white transition-all whitespace-nowrap"
            >
              → {STATUS_LABELS[nextStatus]}
            </button>
          )}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <button
              onClick={() => onStatusChange(order.id, 'cancelled')}
              className="text-[10px] font-medium text-error px-2 py-1 rounded-lg hover:bg-error/10 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
