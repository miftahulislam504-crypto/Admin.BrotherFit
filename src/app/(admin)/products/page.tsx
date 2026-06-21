'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { getAdminProducts, updateProduct, deleteProduct } from '@/services/adminService';
import { Skeleton, EmptyState } from '@/components/ui/Spinner';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { products } = await getAdminProducts({ pageSize: 50 });
    setProducts(products);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (p: Product) => {
    await updateProduct(p.id, { isActive: !p.isActive });
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, isActive: !p.isActive } : x));
    toast.success(p.isActive ? 'Product hidden' : 'Product published');
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('Product deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-4 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or SKU..."
            className="input-field pl-9"
          />
        </div>
        <Link href="/products/add" className="btn-primary flex-shrink-0">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg/40">
                {['Product','SKU','Price','Stock','Status','Created','Actions'].map(h => (
                  <th key={h} className="tbl-head tbl-cell text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_,i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(7)].map((_,j) => (
                      <td key={j} className="tbl-cell"><Skeleton className="h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10">
                    <EmptyState
                      icon={Search}
                      title={search ? 'No products found' : 'No products yet'}
                      description={search ? `No results for "${search}"` : 'Add your first product to get started'}
                      action={!search && <Link href="/products/add" className="btn-primary">Add Product</Link>}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map(product => (
                  <tr key={product.id} className="tbl-row">
                    {/* Product */}
                    <td className="tbl-cell">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-12 rounded-lg overflow-hidden bg-bg flex-shrink-0">
                          {product.images[0] && (
                            <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="40px" unoptimized />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text clamp-1">{product.name}</p>
                          <p className="text-xs text-muted">{product.tags[0] ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    {/* SKU */}
                    <td className="tbl-cell font-mono text-xs text-muted">{product.sku}</td>
                    {/* Price */}
                    <td className="tbl-cell">
                      <span className="font-mono text-sm font-semibold text-primary">
                        {formatPrice(product.salePrice ?? product.basePrice)}
                      </span>
                      {product.salePrice && (
                        <span className="font-mono text-xs text-muted line-through block">
                          {formatPrice(product.basePrice)}
                        </span>
                      )}
                    </td>
                    {/* Stock — placeholder */}
                    <td className="tbl-cell text-sm text-muted">—</td>
                    {/* Status */}
                    <td className="tbl-cell">
                      <button
                        onClick={() => handleToggleActive(product)}
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all',
                          product.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        )}
                      >
                        {product.isActive
                          ? <><ToggleRight size={14} /> Active</>
                          : <><ToggleLeft  size={14} /> Hidden</>
                        }
                      </button>
                    </td>
                    {/* Date */}
                    <td className="tbl-cell text-xs text-muted whitespace-nowrap">
                      {product.createdAt ? formatDate(new Date(product.createdAt as unknown as string)) : '—'}
                    </td>
                    {/* Actions */}
                    <td className="tbl-cell">
                      <div className="flex items-center gap-1">
                        <Link href={`/products/${product.id}`} className="btn-ghost p-2">
                          <Pencil size={14} />
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          disabled={deleting === product.id}
                          className="btn-ghost p-2 hover:text-error hover:bg-error/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted">
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
