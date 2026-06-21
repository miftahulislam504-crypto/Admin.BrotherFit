'use client';
// Categories Page
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import ImagePicker from '@/components/ui/ImagePicker';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/adminService';
import { Skeleton, EmptyState } from '@/components/ui/Spinner';
import type { Category } from '@/types';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [cats,    setCats]    = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form,    setForm]    = useState({ name: '', slug: '', icon: '', order: 0 });
  const [saving,  setSaving]  = useState(false);

  const load = async () => { setCats(await getCategories()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setEditing(null); setForm({ name:'', slug:'', icon:'', order: cats.length }); };
  const openEdit = (c: Category) => { setEditing(c); setForm({ name:c.name, slug:c.slug, icon:c.icon??'', order:c.order }); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, { ...form, isActive: editing.isActive });
      } else {
        await createCategory({ ...form, isActive: true, parentId: undefined });
      }
      toast.success(editing ? 'Category updated' : 'Category created');
      setEditing(null); setForm({ name:'',slug:'',icon:'',order:0 });
      load();
    } catch { toast.error('Failed to save category'); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await deleteCategory(id);
    toast.success('Deleted');
    load();
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex justify-between items-center">
        <h2 className="font-serif text-xl text-primary">Categories</h2>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add</button>
      </div>

      {/* Inline form */}
      {(editing !== null || form.name !== undefined) && (
        <div className="card card-inner space-y-3">
          <h3 className="font-serif text-sm text-primary">{editing ? 'Edit Category' : 'New Category'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Category name" className="input-field" />
            <input value={form.slug} onChange={e => setForm(f=>({...f,slug:e.target.value}))} placeholder="url-slug" className="input-field" />
            <input type="number" value={form.order} onChange={e => setForm(f=>({...f,order:Number(e.target.value)}))} placeholder="Order" className="input-field" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">Icon (optional)</label>
            <ImagePicker
              images={form.icon ? [form.icon] : []}
              onChange={imgs => setForm(f => ({ ...f, icon: imgs[0] ?? '' }))}
              multiple={false}
              maxImages={1}
              label="Choose Icon"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? '…' : 'Save'}</button>
            <button onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-bg/40">
            {['Order','Name','Slug','Actions'].map(h=><th key={h} className="tbl-head tbl-cell text-left">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? [...Array(4)].map((_,i)=>(
              <tr key={i} className="border-b border-border">
                {[...Array(4)].map((_,j)=><td key={j} className="tbl-cell"><Skeleton className="h-4 rounded"/></td>)}
              </tr>
            )) : cats.length === 0 ? (
              <tr><td colSpan={4} className="py-8"><EmptyState icon={Layers} title="No categories yet" /></td></tr>
            ) : cats.map(c=>(
              <tr key={c.id} className="tbl-row">
                <td className="tbl-cell text-muted">{c.order}</td>
                <td className="tbl-cell font-medium">{c.name}</td>
                <td className="tbl-cell text-muted font-mono text-xs">{c.slug}</td>
                <td className="tbl-cell">
                  <div className="flex gap-1">
                    <button onClick={()=>openEdit(c)} className="btn-ghost p-1.5"><Pencil size={13}/></button>
                    <button onClick={()=>handleDelete(c.id,c.name)} className="btn-ghost p-1.5 hover:text-error hover:bg-error/10"><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
