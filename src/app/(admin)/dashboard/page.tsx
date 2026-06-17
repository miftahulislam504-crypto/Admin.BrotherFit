'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag, DollarSign, Users, Package,
  Clock, AlertTriangle, ArrowRight,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  getDashboardStats, getSalesLast7Days,
  getLowStockVariants, getAdminOrders,
} from '@/services/adminService';
import { Skeleton, Badge } from '@/components/ui/Spinner';
import { formatPrice, formatDate, STATUS_COLORS, STATUS_LABELS, cn } from '@/lib/utils';
import type { DashboardStats, DailySales, Order } from '@/types';

export default function DashboardPage() {
  const [stats,    setStats]    = useState<DashboardStats | null>(null);
  const [chart,    setChart]    = useState<DailySales[]>([]);
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<{ id:string; size:string; color:string; stock:number }[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      getDashboardStats(),
      getSalesLast7Days(),
      getAdminOrders({ pageSize: 6 }),
      getLowStockVariants(),
    ]).then(([s, c, o, ls]) => {
      setStats(s);
      setChart(c);
      setOrders(o.orders);
      setLowStock(ls as typeof lowStock);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Stat cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading ? (
          [...Array(6)].map((_,i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : stats && (
          <>
            <StatCard icon={ShoppingBag} label="Today Orders"   value={String(stats.todayOrders)}    color="text-blue-600"   bg="bg-blue-50" />
            <StatCard icon={DollarSign}  label="Today Revenue"  value={formatPrice(stats.todayRevenue)} color="text-green-600" bg="bg-green-50" />
            <StatCard icon={Clock}       label="Pending"        value={String(stats.pendingOrders)}   color="text-amber-600" bg="bg-amber-50" />
            <StatCard icon={Users}       label="Customers"      value={String(stats.totalCustomers)}  color="text-violet-600" bg="bg-violet-50" />
            <StatCard icon={Package}     label="Products"       value={String(stats.activeProducts)}  color="text-cyan-600"  bg="bg-cyan-50" />
            <StatCard icon={AlertTriangle} label="Low Stock"    value={String(stats.lowStockCount)}   color="text-red-600"   bg="bg-red-50" />
          </>
        )}
      </div>

      {/* ── Chart + Low stock ────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* Sales chart */}
        <div className="md:col-span-2 card card-inner">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-base text-primary">Revenue — Last 7 Days</h2>
          </div>
          {loading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E1" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9A8C82' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9A8C82' }} />
                <Tooltip
                  contentStyle={{ background:'#fff', border:'1px solid #EDE8E1', borderRadius:12, fontSize:12 }}
                  formatter={(v: number) => [formatPrice(v), 'Revenue']}
                />
                <Line
                  type="monotone" dataKey="revenue"
                  stroke="#C89B6D" strokeWidth={2.5}
                  dot={{ fill:'#C89B6D', r:3 }}
                  activeDot={{ r:5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Low stock */}
        <div className="card card-inner">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-base text-primary">Low Stock</h2>
            <Link href="/products" className="text-xs text-muted hover:text-primary transition-colors">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
            </div>
          ) : lowStock.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">All stock levels are good</p>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0,5).map((v,i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-medium text-text">{v.size} / {v.color}</p>
                    <p className="text-[11px] text-muted">Variant</p>
                  </div>
                  <span className={cn(
                    'text-xs font-mono font-semibold px-2 py-1 rounded-lg',
                    v.stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  )}>
                    {v.stock} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent orders ─────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-serif text-base text-primary">Recent Orders</h2>
          <Link href="/orders" className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors">
            View all <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Order ID','Customer','Items','Total','Status','Date'].map(h => (
                    <th key={h} className="tbl-head tbl-cell text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="tbl-row">
                    <td className="tbl-cell">
                      <Link href={`/orders/${order.id}`} className="font-mono text-xs text-primary hover:underline">
                        #{order.id.slice(0,8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="tbl-cell">{order.address.name}</td>
                    <td className="tbl-cell">{order.items.length}</td>
                    <td className="tbl-cell font-mono font-semibold">{formatPrice(order.total)}</td>
                    <td className="tbl-cell">
                      <span className={cn('badge border text-[10px]', STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="tbl-cell text-muted text-xs">
                      {order.createdAt ? formatDate(new Date(order.createdAt as unknown as string)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

/* ── StatCard ───────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string;
  color: string; bg: string;
}) {
  return (
    <div className="card card-inner flex flex-col gap-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
        <Icon size={17} className={color} />
      </div>
      <div>
        <p className="font-mono text-xl font-semibold text-primary leading-none">{value}</p>
        <p className="text-xs text-muted mt-1">{label}</p>
      </div>
    </div>
  );
}
