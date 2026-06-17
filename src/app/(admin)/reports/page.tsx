'use client';

import { useState } from 'react';
import { Download, FileBarChart, TrendingUp, Package, Users, DollarSign } from 'lucide-react';
import {
  getSalesReport, getProductReport, getCustomerReport, getRevenueReport,
  downloadCSV, type SalesReportRow, type ProductReportRow,
} from '@/services/reportService';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatPrice, formatDate, cn } from '@/lib/utils';

type Tab = 'sales' | 'products' | 'customers' | 'revenue';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

export default function ReportsPage() {
  const [tab,     setTab]     = useState<Tab>('sales');
  const [range,   setRange]   = useState(defaultRange());
  const [loading, setLoading] = useState(false);
  const [hasRun,  setHasRun]  = useState(false);

  const [salesData,    setSalesData]    = useState<SalesReportRow[]>([]);
  const [productData,  setProductData] = useState<{ best: ProductReportRow[]; worst: ProductReportRow[] }>({ best: [], worst: [] });
  const [customerData, setCustomerData] = useState<{ newCustomers:number; returningCustomers:number; totalOrders:number } | null>(null);
  const [revenueData,  setRevenueData]  = useState<{ totalOrders:number; totalRevenue:number; totalDiscount:number; totalDelivery:number; cancelled:number; netRevenue:number } | null>(null);

  const runReport = async () => {
    setLoading(true);
    const r = { from: new Date(range.from), to: new Date(range.to + 'T23:59:59') };
    try {
      const [s, p, c, rev] = await Promise.all([
        getSalesReport(r), getProductReport(r), getCustomerReport(r), getRevenueReport(r),
      ]);
      setSalesData(s); setProductData(p); setCustomerData(c); setRevenueData(rev);
      setHasRun(true);
    } finally { setLoading(false); }
  };

  const exportSales = () => downloadCSV(
    `sales-report-${range.from}-to-${range.to}.csv`,
    ['Date','Orders','Revenue','Avg Order Value'],
    salesData.map(r => [r.date, r.orders, r.revenue.toFixed(2), r.avgOrderValue.toFixed(2)])
  );

  const exportProducts = () => downloadCSV(
    `product-report-${range.from}-to-${range.to}.csv`,
    ['Product','Units Sold','Revenue'],
    productData.best.map(r => [r.name, r.unitsSold, r.revenue.toFixed(2)])
  );

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key:'sales',     label:'Sales',     icon: TrendingUp },
    { key:'products',  label:'Products',  icon: Package    },
    { key:'customers', label:'Customers', icon: Users       },
    { key:'revenue',   label:'Revenue',   icon: DollarSign  },
  ];

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Date range picker */}
      <div className="card card-inner flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">From</label>
          <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">To</label>
          <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className="input-field" />
        </div>
        <button onClick={runReport} disabled={loading} className="btn-primary">
          {loading ? <Spinner size="sm" className="border-white border-t-transparent" /> : <FileBarChart size={15} />}
          Generate Report
        </button>
      </div>

      {!hasRun ? (
        <EmptyState icon={FileBarChart} title="Select a date range" description="Choose dates above and generate a report" />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all',
                  tab===t.key ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-muted hover:border-accent')}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {/* Sales tab */}
          {tab === 'sales' && (
            <div className="card overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h3 className="font-serif text-base text-primary">Daily Sales</h3>
                <button onClick={exportSales} className="btn-outline text-xs py-1.5"><Download size={13}/> Export CSV</button>
              </div>
              <table className="w-full">
                <thead><tr className="border-b border-border bg-bg/40">
                  {['Date','Orders','Revenue','Avg Order Value'].map(h=><th key={h} className="tbl-head tbl-cell text-left">{h}</th>)}
                </tr></thead>
                <tbody>
                  {salesData.length===0 ? (
                    <tr><td colSpan={4} className="tbl-cell text-center text-muted py-8">No sales in this period</td></tr>
                  ) : salesData.map(row => (
                    <tr key={row.date} className="tbl-row">
                      <td className="tbl-cell">{formatDate(new Date(row.date))}</td>
                      <td className="tbl-cell">{row.orders}</td>
                      <td className="tbl-cell font-mono font-semibold text-primary">{formatPrice(row.revenue)}</td>
                      <td className="tbl-cell text-muted">{formatPrice(row.avgOrderValue)}</td>
                    </tr>
                  ))}
                </tbody>
                {salesData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-bg/40">
                      <td className="tbl-cell font-semibold">Total</td>
                      <td className="tbl-cell font-semibold">{salesData.reduce((s,r)=>s+r.orders,0)}</td>
                      <td className="tbl-cell font-mono font-bold text-primary">{formatPrice(salesData.reduce((s,r)=>s+r.revenue,0))}</td>
                      <td className="tbl-cell" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Products tab */}
          {tab === 'products' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-border">
                  <h3 className="font-serif text-sm text-primary">Best Sellers</h3>
                  <button onClick={exportProducts} className="btn-ghost text-xs py-1"><Download size={12}/></button>
                </div>
                <div className="divide-y divide-border">
                  {productData.best.length===0 ? <p className="text-sm text-muted text-center py-8">No data</p> :
                   productData.best.map((p,i) => (
                    <div key={p.productId} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-muted w-4">{i+1}</span>
                        <span className="text-sm text-text clamp-1">{p.name}</span>
                      </div>
                      <span className="text-xs font-mono font-semibold text-primary flex-shrink-0">{p.unitsSold} sold</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-serif text-sm text-primary">Low Performers</h3>
                </div>
                <div className="divide-y divide-border">
                  {productData.worst.length===0 ? <p className="text-sm text-muted text-center py-8">No data</p> :
                   productData.worst.map((p,i) => (
                    <div key={p.productId} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-text clamp-1">{p.name}</span>
                      <span className="text-xs font-mono text-muted flex-shrink-0">{p.unitsSold} sold</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Customers tab */}
          {tab === 'customers' && customerData && (
            <div className="grid grid-cols-3 gap-4">
              <SummaryCard label="New Customers" value={String(customerData.newCustomers)} color="text-blue-600" bg="bg-blue-50" />
              <SummaryCard label="Returning"      value={String(customerData.returningCustomers)} color="text-violet-600" bg="bg-violet-50" />
              <SummaryCard label="Total Orders"   value={String(customerData.totalOrders)} color="text-green-600" bg="bg-green-50" />
            </div>
          )}

          {/* Revenue tab */}
          {tab === 'revenue' && revenueData && (
            <div className="card card-inner space-y-3">
              <h3 className="font-serif text-base text-primary mb-2">Revenue Summary</h3>
              <RevRow label="Total Orders"    value={String(revenueData.totalOrders)} />
              <RevRow label="Gross Revenue"   value={formatPrice(revenueData.totalRevenue)} />
              <RevRow label="Total Discounts" value={`-${formatPrice(revenueData.totalDiscount)}`} valueClass="text-amber-600" />
              <RevRow label="Delivery Charges Collected" value={formatPrice(revenueData.totalDelivery)} />
              <RevRow label="Cancelled Orders" value={String(revenueData.cancelled)} valueClass="text-error" />
              <div className="flex justify-between pt-3 border-t border-border">
                <span className="font-semibold text-text">Net Revenue</span>
                <span className="font-mono font-bold text-xl text-primary">{formatPrice(revenueData.netRevenue)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, bg }: { label:string; value:string; color:string; bg:string }) {
  return (
    <div className="card card-inner text-center">
      <p className={cn('font-mono text-3xl font-bold', color)}>{value}</p>
      <p className="text-xs text-muted mt-1.5">{label}</p>
    </div>
  );
}

function RevRow({ label, value, valueClass }: { label:string; value:string; valueClass?:string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted">{label}</span>
      <span className={cn('text-sm font-medium', valueClass ?? 'text-text')}>{value}</span>
    </div>
  );
}
