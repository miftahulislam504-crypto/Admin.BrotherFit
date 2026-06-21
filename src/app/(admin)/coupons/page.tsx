'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Percent } from 'lucide-react';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '@/services/adminService';
import { Skeleton, EmptyState } from '@/components/ui/Spinner';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import type { Coupon } from '@/types';
import toast from 'react-hot-toast';

const EMPTY = { code:'', type:'percentage' as const, value:0, minOrder:0, usageLimit:100, expiryDate:'' };

export default function CouponsPage() {
  const [coupons,  setCoupons]  = useState<Coupon[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);

  const load = async () => { setCoupons(await getCoupons()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.code || !form.expiryDate) { toast.error('Fill all required fields'); return; }
    setSaving(true);
    try {
      await createCoupon({
        code:        form.code.toUpperCase(),
        type:        form.type,
        value:       form.value,
        minOrder:    form.minOrder,
        usageLimit:  form.usageLimit,
        expiryDate:  new Date(form.expiryDate),
        isActive:    true,
      });
      toast.success('Coupon created');
      setForm(EMPTY); setShowForm(false); load();
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  const handleToggle = async (c: Coupon) => {
    await updateCoupon(c.id, { isActive: !c.isActive });
    setCoupons(prev => prev.map(x => x.id===c.id ? {...x, isActive: !c.isActive} : x));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    await deleteCoupon(id);
    toast.success('Deleted'); load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="font-serif text-xl text-primary">Coupons</h2>
        <button onClick={() => setShowForm(v=>!v)} className="btn-primary"><Plus size={15}/> New Coupon</button>
      </div>

      {showForm && (
        <div className="card card-inner space-y-4">
          <h3 className="font-serif text-sm text-primary">Create Coupon</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Code *</label>
              <input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="SAVE20" className="input-field font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Type</label>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value as typeof form.type}))} className="input-field">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (৳)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Value *</label>
              <input type="number" min="0" value={form.value} onChange={e=>setForm(f=>({...f,value:Number(e.target.value)}))} placeholder={form.type==='percentage'?'20':'10'} className="input-field" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Min Order (৳)</label>
              <input type="number" min="0" value={form.minOrder} onChange={e=>setForm(f=>({...f,minOrder:Number(e.target.value)}))} placeholder="500" className="input-field" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Usage Limit</label>
              <input type="number" min="0" value={form.usageLimit} onChange={e=>setForm(f=>({...f,usageLimit:Number(e.target.value)}))} placeholder="100" className="input-field" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Expiry Date *</label>
              <input type="date" value={form.expiryDate} onChange={e=>setForm(f=>({...f,expiryDate:e.target.value}))} className="input-field" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary">{saving?'Creating…':'Create Coupon'}</button>
            <button onClick={()=>setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-bg/40">
            {['Code','Type','Value','Min Order','Used / Limit','Expires','Status',''].map(h=><th key={h} className="tbl-head tbl-cell text-left whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? [...Array(4)].map((_,i)=>(
              <tr key={i} className="border-b border-border">{[...Array(8)].map((_,j)=><td key={j} className="tbl-cell"><Skeleton className="h-4 rounded"/></td>)}</tr>
            )) : coupons.length===0 ? (
              <tr><td colSpan={8} className="py-10"><EmptyState icon={Percent} title="No coupons yet" /></td></tr>
            ) : coupons.map(c=>(
              <tr key={c.id} className="tbl-row">
                <td className="tbl-cell font-mono font-bold text-primary">{c.code}</td>
                <td className="tbl-cell capitalize text-muted">{c.type}</td>
                <td className="tbl-cell font-semibold">{c.type==='percentage'?`${c.value}%`:formatPrice(c.value)}</td>
                <td className="tbl-cell text-muted">{c.minOrder>0?formatPrice(c.minOrder):'—'}</td>
                <td className="tbl-cell text-muted">{c.usedCount} / {c.usageLimit}</td>
                <td className="tbl-cell text-xs text-muted whitespace-nowrap">{c.expiryDate ? formatDate(new Date(c.expiryDate as unknown as string)) : '—'}</td>
                <td className="tbl-cell">
                  <button onClick={()=>handleToggle(c)} className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
                    c.isActive?'bg-green-50 text-green-700 border-green-200':'bg-gray-50 text-gray-400 border-gray-200')}>
                    {c.isActive?<><ToggleRight size={13}/>Active</>:<><ToggleLeft size={13}/>Off</>}
                  </button>
                </td>
                <td className="tbl-cell">
                  <button onClick={()=>handleDelete(c.id)} className="btn-ghost p-1.5 hover:text-error hover:bg-error/10"><Trash2 size={13}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
