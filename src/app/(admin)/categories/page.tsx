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
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  // ✅ FIX: form এ 'image' field ব্যবহার করা হচ্ছে (আগে 'icon' ছিল)
  // Frontend CategoryRow.tsx এবং CategoryDrawer.tsx উভয়ই cat.image চেক করে
  const [form, setForm] = useState({ name: '', slug: '', image: '', order: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setCats(await getCategories());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', slug: '', image: '', order: cats.length });
    setShowForm(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    // ✅ FIX: c.image থেকে পড়া হচ্ছে (আগে c.icon ছিল)
    setForm({ name: c.name, slug: c.slug, image: c.image ?? '', order: c.order });
    setShowForm(true);
  };
  const closeForm = () => {
    setEditing(null);
    setShowForm(false);
    setForm({ name: '', slug: '', image: '', order: 0 });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Category name is required'); return; }
    if (!form.slug.trim()) { toast.error('Slug is required'); return; }

    // Guard: base64 image must not exceed ~900 KB (Firestore doc limit is 1 MiB)
    if (form.image) {
      const base64Part = form.image.includes(',') ? form.image.split(',')[1] : form.image;
      const imageKB = Math.round((base64Part.length * 0.75) / 1024);
      if (imageKB > 900) {
        toast.error('Image is too large. Please choose a smaller image.');
        return;
      }
    }

    setSaving(true);
    try {
      // ✅ FIX: payload এ 'image' field পাঠানো হচ্ছে (আগে 'icon' ছিল)
      if (editing) {
        await updateCategory(editing.id, {
          name: form.name,
          slug: form.slug,
          image: form.image || undefined,
          order: form.order,
          isActive: editing.isActive,
        });
      } else {
        await createCategory({
          name: form.name,
          slug: form.slug,
          image: form.image || undefined,
          order: form.order,
          isActive: true,
        });
      }
      toast.success(editing ? 'Category updated' : 'Category created');
      closeForm();
      load();
    } catch (err) {
      console.error('Category save error:', err);
      toast.error('Failed to save category');
    }
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

      {showForm && (
        <div className="card card-inner space-y-3">
          <h3 className="font-serif text-sm text-primary">{editing ? 'Edit Category' : 'New Category'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Category name"
              className="input-field"
            />
            <input
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="url-slug"
              className="input-field"
            />
            <input
              type="number"
              value={form.order}
              onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
              placeholder="Order"
              className="input-field"
            />
          </div>
          <div>
            {/* ✅ FIX: Label "Category Image" এবং isIcon=true দিয়ে compressed রাখা */}
            <label className="text-xs font-medium text-muted mb-1.5 block">Category Image (optional)</label>
            <ImagePicker
              images={form.image ? [form.image] : []}
              onChange={imgs => setForm(f => ({ ...f, image: imgs[0] ?? '' }))}
              multiple={false}
              maxImages={1}
              label="Choose Image"
              isIcon={true}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={closeForm} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-bg/40">
              {['Order', 'Icon', 'Name', 'Slug', 'Actions'].map(h => (
                <th key={h} className="tbl-head tbl-cell text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? [...Array(4)].map((_, i) => (
              <tr key={i} className="border-b border-border">
                {[...Array(5)].map((_, j) => (
                  <td key={j} className="tbl-cell"><Skeleton className="h-4 rounded" /></td>
                ))}
              </tr>
            )) : cats.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8">
                  <EmptyState icon={Layers} title="No categories yet" />
                </td>
              </tr>
            ) : cats.map(c => (
              <tr key={c.id} className="tbl-row">
                <td className="tbl-cell text-muted">{c.order}</td>
                {/* ✅ FIX: c.image দিয়ে preview দেখানো হচ্ছে (আগে c.icon ছিল) */}
                <td className="tbl-cell">
                  {c.image
                    ? <img src={c.image} alt={c.name} className="w-8 h-8 rounded-lg object-cover border border-border" />
                    : <span className="text-xs text-muted/40">—</span>
                  }
                </td>
                <td className="tbl-cell font-medium">{c.name}</td>
                <td className="tbl-cell text-muted font-mono text-xs">{c.slug}</td>
                <td className="tbl-cell">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="btn-ghost p-1.5">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="btn-ghost p-1.5 hover:text-error hover:bg-error/10"
                    >
                      <Trash2 size={13} />
                    </button>
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
