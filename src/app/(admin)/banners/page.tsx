'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, ToggleLeft, ToggleRight, Image as ImageIcon } from 'lucide-react';
import ImagePicker from '@/components/ui/ImagePicker';
import { getBanners, upsertBanner, deleteBanner } from '@/services/adminService';
import { Skeleton, EmptyState } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import type { Banner } from '@/types';
import toast from 'react-hot-toast';

const EMPTY = { image:'', title:'', subtitle:'', link:'', order:0, isActive:true };

export default function BannersPage() {
  const [banners,  setBanners]  = useState<Banner[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Banner | null>(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);

  const load = async () => { setBanners(await getBanners()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setEditing(null); setForm({...EMPTY, order: banners.length}); setShowForm(true); };
  const openEdit = (b: Banner) => { setEditing(b); setForm({ image:b.image, title:b.title, subtitle:b.subtitle??'', link:b.link??'', order:b.order, isActive:b.isActive }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.image || !form.title) { toast.error('Image and title are required'); return; }
    setSaving(true);
    try {
      await upsertBanner(editing ? { ...form, id: editing.id } : form);
      toast.success(editing ? 'Banner updated' : 'Banner created');
      setShowForm(false); setEditing(null); load();
    } catch (err) { console.error(err); toast.error('Failed'); }
    setSaving(false);
  };

  const handleToggle = async (b: Banner) => {
    await upsertBanner({ id:b.id, isActive:!b.isActive });
    setBanners(prev => prev.map(x => x.id===b.id ? {...x,isActive:!b.isActive} : x));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    await deleteBanner(id); toast.success('Deleted'); load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="font-serif text-xl text-primary">Banners</h2>
        <button onClick={openAdd} className="btn-primary"><Plus size={15}/> Add Banner</button>
      </div>

      {showForm && (
        <div className="card card-inner space-y-4">
          <h3 className="font-serif text-sm text-primary">{editing?'Edit Banner':'New Banner'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">Banner Image *</label>
              <ImagePicker
                images={form.image ? [form.image] : []}
                onChange={imgs => setForm(f => ({ ...f, image: imgs[0] ?? '' }))}
                multiple={false}
                maxImages={1}
                label="Choose Banner Image"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Title *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="New Collection" className="input-field" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Subtitle</label>
                <input value={form.subtitle} onChange={e=>setForm(f=>({...f,subtitle:e.target.value}))} placeholder="Discount 50% for first order" className="input-field" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Link URL</label>
                <input value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))} placeholder="/products?category=new" className="input-field" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Display Order</label>
                <input type="number" min="0" value={form.order} onChange={e=>setForm(f=>({...f,order:Number(e.target.value)}))} className="input-field" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))} className="w-4 h-4 rounded" />
              <span className="text-sm text-text">Active (visible in store)</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving?'Saving…':'Save Banner'}</button>
            <button onClick={()=>{setShowForm(false);setEditing(null);}} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {loading ? [...Array(3)].map((_,i)=><Skeleton key={i} className="h-28 rounded-2xl"/>) :
         banners.length===0 ? <EmptyState icon={ImageIcon} title="No banners yet" description="Add banners to display on your home page" action={<button onClick={openAdd} className="btn-primary">Add Banner</button>} /> :
         banners.map(b=>(
          <div key={b.id} className={cn('card flex gap-4 items-center p-3', !b.isActive && 'opacity-60')}>
            <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-bg flex-shrink-0 border border-border">
              {b.image && <Image src={b.image} alt={b.title} fill className="object-cover" unoptimized />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text">{b.title}</p>
              {b.subtitle && <p className="text-xs text-muted clamp-1">{b.subtitle}</p>}
              <p className="text-[11px] text-muted mt-0.5">Order: {b.order}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={()=>handleToggle(b)} className={cn('text-xs font-medium px-2.5 py-1 rounded-full border',
                b.isActive?'bg-green-50 text-green-700 border-green-200':'bg-gray-50 text-gray-400 border-gray-200')}>
                {b.isActive?<ToggleRight size={13}/>:<ToggleLeft size={13}/>}
              </button>
              <button onClick={()=>openEdit(b)} className="btn-outline py-1.5 text-xs">Edit</button>
              <button onClick={()=>handleDelete(b.id)} className="btn-ghost p-1.5 hover:text-error hover:bg-error/10"><Trash2 size={13}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
