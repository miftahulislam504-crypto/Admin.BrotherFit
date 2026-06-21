'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, ToggleLeft, ToggleRight, Zap, X, Search } from 'lucide-react';
import { getFlashSales, upsertFlashSale, deleteFlashSale, getProductPickerList } from '@/services/flashSaleService';
import { Skeleton, EmptyState } from '@/components/ui/Spinner';
import { formatPrice, formatDateTime, cn } from '@/lib/utils';
import type { FlashSale, Product } from '@/types';
import toast from 'react-hot-toast';

type PickerProduct = Pick<Product,'id'|'name'|'images'|'basePrice'|'salePrice'>;

const EMPTY = {
  title: '', startTime: '', endTime: '',
  discountType: 'percentage' as const, discountValue: 10,
  productIds: [] as string[],
};

export default function FlashSalesPage() {
  const [sales,    setSales]    = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY);
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    Promise.all([getFlashSales(), getProductPickerList()]).then(([s, p]) => {
      setSales(s); setProducts(p); setLoading(false);
    });
  }, []);

  const toggleProduct = (id: string) =>
    setForm(f => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter(x => x !== id)
        : [...f.productIds, id],
    }));

  const handleCreate = async () => {
    if (!form.title || !form.startTime || !form.endTime || form.productIds.length === 0) {
      toast.error('Fill all fields and select at least one product');
      return;
    }
    setSaving(true);
    try {
      await upsertFlashSale({
        title:         form.title,
        startTime:     new Date(form.startTime),
        endTime:       new Date(form.endTime),
        discountType:  form.discountType,
        discountValue: form.discountValue,
        productIds:    form.productIds,
        isActive:      true,
      });
      toast.success('Flash sale created');
      setForm(EMPTY); setShowForm(false);
      setSales(await getFlashSales());
    } catch { toast.error('Failed to create'); }
    setSaving(false);
  };

  const handleToggle = async (s: FlashSale) => {
    await upsertFlashSale({ id: s.id, isActive: !s.isActive });
    setSales(prev => prev.map(x => x.id === s.id ? { ...x, isActive: !s.isActive } : x));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flash sale?')) return;
    await deleteFlashSale(id);
    toast.success('Deleted');
    setSales(prev => prev.filter(s => s.id !== id));
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="font-serif text-xl text-primary">Flash Sales</h2>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          <Plus size={15} /> New Flash Sale
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card card-inner space-y-4">
          <h3 className="font-serif text-sm text-primary">Create Flash Sale</h3>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Weekend Flash Sale" className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Discount Type</label>
                <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value as typeof form.discountType }))} className="input-field">
                  <option value="percentage">%</option>
                  <option value="fixed">$ Fixed</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Value</label>
                <input type="number" min="0" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))} className="input-field" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Start Time *</label>
              <input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">End Time *</label>
              <input type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input-field" />
            </div>
          </div>

          {/* Product picker */}
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">
              Select Products * ({form.productIds.length} selected)
            </label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="input-field pl-9" />
            </div>
            <div className="border border-border rounded-xl max-h-56 overflow-y-auto divide-y divide-border">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">No products found</p>
              ) : filteredProducts.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2.5 hover:bg-bg/60 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={form.productIds.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                    className="w-4 h-4 rounded flex-shrink-0"
                  />
                  <div className="relative w-9 h-11 rounded-lg overflow-hidden bg-bg flex-shrink-0">
                    {p.images[0] && <Image src={p.images[0]} alt="" fill className="object-cover" sizes="36px" unoptimized />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text clamp-1">{p.name}</p>
                    <p className="text-xs text-muted font-mono">{formatPrice(p.salePrice ?? p.basePrice)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Flash Sale'}</button>
            <button onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? [...Array(2)].map((_,i) => <Skeleton key={i} className="h-28 rounded-2xl" />) :
         sales.length === 0 ? (
          <EmptyState icon={Zap} title="No flash sales yet" description="Create time-limited discounts to boost sales" />
         ) : sales.map(s => {
          const now    = new Date();
          const status = now < new Date(s.startTime) ? 'upcoming' : now > new Date(s.endTime) ? 'ended' : 'live';
          return (
            <div key={s.id} className={cn('card card-inner', !s.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-text text-sm">{s.title}</h4>
                    <span className={cn('badge text-[10px]',
                      status === 'live' ? 'bg-green-50 text-green-700' :
                      status === 'upcoming' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'
                    )}>
                      {status === 'live' ? '🔴 Live' : status === 'upcoming' ? 'Upcoming' : 'Ended'}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {s.discountType === 'percentage' ? `${s.discountValue}% off` : `${formatPrice(s.discountValue)} off`}
                    {' · '}{s.productIds.length} products
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    {formatDateTime(new Date(s.startTime))} → {formatDateTime(new Date(s.endTime))}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handleToggle(s)} className={cn('text-xs font-medium px-2 py-1 rounded-full border',
                    s.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200')}>
                    {s.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="btn-ghost p-1.5 hover:text-error hover:bg-error/10">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
