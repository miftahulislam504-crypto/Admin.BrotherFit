'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus } from 'lucide-react';
import { getCategories } from '@/services/adminService';
import { slugify, cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import ImagePicker from '@/components/ui/ImagePicker';
import type { Product, Category, ProductVariant } from '@/types';

// ── Schema ─────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(2, 'Product name is required'),
  sku:         z.string().min(1, 'SKU is required'),
  slug:        z.string().min(1, 'Slug is required'),
  categoryId:  z.string().min(1, 'Select a category'),
  basePrice:   z.number({ invalid_type_error: 'Enter a price' }).positive(),
  salePrice:   z.number().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  material:    z.string().optional(),
  tags:        z.string().optional(),
  section:     z.enum(['trending', 'explore']).optional(),
  isActive:    z.boolean(),
  isFeatured:  z.boolean(),
});

export type ProductFormData = z.infer<typeof schema>;

// ── Variant row type ───────────────────────────────────────

export interface VariantRow {
  id?: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  priceOverride?: number;
}

// ── Props ──────────────────────────────────────────────────

interface ProductFormProps {
  product?:  Product;
  variants?: ProductVariant[];
  onSubmit:  (data: ProductFormData, images: string[], variants: VariantRow[]) => Promise<void>;
  loading?:  boolean;
}

const DEFAULT_SIZES  = ['S', 'M', 'L', 'XL', 'XXL'];
const DEFAULT_COLORS = [{ name: 'Black', hex: '#1A1A1A' }, { name: 'White', hex: '#F5F5F5' }, { name: 'Brown', hex: '#8B5E3C' }];

export default function ProductForm({ product, variants = [], onSubmit, loading }: ProductFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [images,     setImages]     = useState<string[]>(product?.images ?? []);
  const [variantRows, setVariantRows] = useState<VariantRow[]>(
    variants.length > 0
      ? variants.map(v => ({ id: v.id, size: v.size, color: v.color, colorHex: v.colorHex ?? '', stock: v.stock }))
      : []
  );
  const [newSize,     setNewSize]     = useState('');
  const [newColor,    setNewColor]    = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:        product?.name        ?? '',
      sku:         product?.sku         ?? '',
      slug:        product?.slug        ?? '',
      categoryId:  product?.categoryId  ?? '',
      basePrice:   product?.basePrice   ?? 0,
      salePrice:   product?.salePrice,
      description: product?.description ?? '',
      material:    product?.material    ?? '',
      tags:        product?.tags?.join(', ') ?? '',
      section:     product?.section,
      isActive:    product?.isActive    ?? true,
      isFeatured:  product?.isFeatured  ?? false,
    },
  });

  const name = watch('name');
  useEffect(() => {
    if (!product) setValue('slug', slugify(name));
  }, [name, product, setValue]);

  useEffect(() => { getCategories().then(setCategories); }, []);

  // ── Variant handlers ──────────────────────────────────────

  const addVariant = () => {
    if (!newSize || !newColor) return;
    const exists = variantRows.some(v => v.size === newSize && v.color === newColor);
    if (exists) return;
    setVariantRows(prev => [...prev, { size: newSize, color: newColor, colorHex: newColorHex, stock: 0 }]);
    setNewSize(''); setNewColor('');
  };

  const removeVariant = (i: number) => setVariantRows(prev => prev.filter((_, idx) => idx !== i));

  const updateVariantStock = (i: number, stock: number) =>
    setVariantRows(prev => prev.map((v, idx) => idx === i ? { ...v, stock } : v));

  // ── Submit ────────────────────────────────────────────────

  const handleFormSubmit = async (data: ProductFormData) => {
    await onSubmit(data, images, variantRows);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-3xl">

      {/* ── Basic Info ─────────────────────────────── */}
      <Section title="Basic Information">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Product Name" error={errors.name?.message} required>
            <input {...register('name')} placeholder="Light Brown Jacket" className={`input-field ${errors.name ? 'input-error' : ''}`} />
          </Field>
          <Field label="SKU" error={errors.sku?.message} required>
            <input {...register('sku')} placeholder="LBJ-001" className={`input-field ${errors.sku ? 'input-error' : ''}`} />
          </Field>
          <Field label="URL Slug" error={errors.slug?.message} required>
            <input {...register('slug')} placeholder="light-brown-jacket" className={`input-field ${errors.slug ? 'input-error' : ''}`} />
          </Field>
          <Field label="Category" error={errors.categoryId?.message} required>
            <select {...register('categoryId')} className={`input-field ${errors.categoryId ? 'input-error' : ''}`}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Description" error={errors.description?.message} required>
          <textarea
            {...register('description')} rows={4} placeholder="Product description..."
            className={`input-field resize-none ${errors.description ? 'input-error' : ''}`}
          />
        </Field>

        <Field label="Material">
          <input {...register('material')} placeholder="100% Cotton, Polyester blend..." className="input-field" />
        </Field>

        <Field label="Tags (comma separated)">
          <input {...register('tags')} placeholder="jacket, brown, winter, casual" className="input-field" />
        </Field>
      </Section>

      {/* ── Pricing ────────────────────────────────── */}
      <Section title="Pricing">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Base Price (৳ Taka)" error={errors.basePrice?.message} required>
            <input
              {...register('basePrice', { valueAsNumber: true })}
              type="number" step="1" min="0"
              placeholder="990"
              className={`input-field ${errors.basePrice ? 'input-error' : ''}`}
            />
          </Field>
          <Field label="Sale Price (৳ Taka)">
            <input
              {...register('salePrice', { valueAsNumber: true, setValueAs: v => v === '' ? undefined : Number(v) })}
              type="number" step="1" min="0"
              placeholder="Leave empty if no discount"
              className="input-field"
            />
          </Field>
        </div>
      </Section>

      {/* ── Images ─────────────────────────────────── */}
      <Section title="Product Images">
        <ImagePicker
          images={images}
          onChange={setImages}
          multiple
          maxImages={6}
          label="Choose from Gallery"
        />
      </Section>

      {/* ── Variants ───────────────────────────────── */}
      <Section title="Variants (Size × Color × Stock)">
        {/* Quick add */}
        <div className="flex gap-2 flex-wrap">
          <select value={newSize} onChange={e => setNewSize(e.target.value)} className="input-field w-28">
            <option value="">Size</option>
            {['XS','S','M','L','XL','XXL','XXXL'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={newColor} onChange={e => setNewColor(e.target.value)} placeholder="Color name" className="input-field w-32" />
          <div className="flex items-center gap-2 border border-border rounded-xl px-3">
            <label className="text-xs text-muted">Hex</label>
            <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
          </div>
          <button type="button" onClick={addVariant} className="btn-outline">
            <Plus size={15} /> Add Variant
          </button>
        </div>

        {/* Variant list */}
        {variantRows.length > 0 && (
          <div className="mt-3 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg/60 border-b border-border">
                <tr>
                  <th className="tbl-head tbl-cell text-left">Size</th>
                  <th className="tbl-head tbl-cell text-left">Color</th>
                  <th className="tbl-head tbl-cell text-left">Stock</th>
                  <th className="tbl-head tbl-cell" />
                </tr>
              </thead>
              <tbody>
                {variantRows.map((v, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-bg/40">
                    <td className="tbl-cell font-medium">{v.size}</td>
                    <td className="tbl-cell">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-border" style={{ background: v.colorHex || '#ccc' }} />
                        {v.color}
                      </div>
                    </td>
                    <td className="tbl-cell">
                      <input
                        type="number" min="0" value={v.stock}
                        onChange={e => updateVariantStock(i, parseInt(e.target.value) || 0)}
                        className="input-field w-20 py-1.5 text-center"
                      />
                    </td>
                    <td className="tbl-cell">
                      <button type="button" onClick={() => removeVariant(i)} className="btn-ghost p-1.5 hover:text-error hover:bg-error/10">
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Home Section ───────────────────────────── */}
      <Section title="Home Page Section">
        <p className="text-xs text-muted mb-3">
          Product কোন section-এ দেখাবে তা বেছে নিন।
        </p>
        <div className="flex gap-4 flex-wrap">
          {[
            { value: 'trending', label: 'Trending Now', desc: 'Home-এর "Trending Now" section-এ দেখাবে' },
            { value: 'explore',  label: 'New Arrivals', desc: 'Home-এর "New Arrivals" section-এ দেখাবে' },
          ].map(opt => {
            const current = watch('section');
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 cursor-pointer border rounded-xl px-4 py-3 flex-1 min-w-[180px] transition-colors ${
                  current === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="radio"
                  value={opt.value}
                  checked={current === opt.value}
                  onChange={() => setValue('section', opt.value as 'trending' | 'explore')}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-semibold text-text">{opt.label}</p>
                  <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
        {watch('section') && (
          <button
            type="button"
            onClick={() => setValue('section', undefined)}
            className="text-xs text-muted hover:text-error mt-2 underline"
          >
            Section নির্বাচন বাতিল করুন
          </button>
        )}
      </Section>

      {/* ── Visibility ─────────────────────────────── */}
      <Section title="Visibility">
        <div className="flex gap-6">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" {...register('isActive')} className="w-4 h-4 rounded" />
            <span className="text-sm font-medium text-text">Published (visible in store)</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" {...register('isFeatured')} className="w-4 h-4 rounded" />
            <span className="text-sm font-medium text-text">Featured (show on home page)</span>
          </label>
        </div>
      </Section>

      {/* ── Submit ─────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading && <Spinner size="sm" className="border-white border-t-transparent" />}
          {product ? 'Update Product' : 'Create Product'}
        </button>
        <button type="button" onClick={() => history.back()} className="btn-outline">
          Cancel
        </button>
      </div>

    </form>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card-inner space-y-4">
      <h3 className="font-serif text-base text-primary border-b border-border pb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text">
        {label}{required && <span className="text-error ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
