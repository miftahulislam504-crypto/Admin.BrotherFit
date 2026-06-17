'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ProductForm, { type ProductFormData, type VariantRow } from '@/components/products/ProductForm';
import { getAdminProductById, getProductVariants, updateProduct, upsertVariant } from '@/services/adminService';
import { Skeleton } from '@/components/ui/Spinner';
import type { Product, ProductVariant } from '@/types';
import toast from 'react-hot-toast';

export default function EditProductPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [product,  setProduct]  = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    Promise.all([getAdminProductById(id), getProductVariants(id)]).then(([p, v]) => {
      setProduct(p);
      setVariants(v);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (data: ProductFormData, images: string[], variantRows: VariantRow[]) => {
    if (!product) return;
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name:        data.name,
        slug:        data.slug,
        sku:         data.sku,
        categoryId:  data.categoryId,
        basePrice:   data.basePrice,
        salePrice:   data.salePrice,
        description: data.description,
        material:    data.material ?? '',
        tags:        data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        images,
        isActive:    data.isActive,
        isFeatured:  data.isFeatured,
      });

      // Upsert variants
      await Promise.all(
        variantRows.map(v =>
          upsertVariant({
            id:       v.id,
            productId: product.id,
            size:     v.size as typeof variants[0]['size'],
            color:    v.color,
            colorHex: v.colorHex,
            stock:    v.stock,
            reserved: 0,
            sold:     v.id ? (variants.find(x => x.id === v.id)?.sold ?? 0) : 0,
            skuVariant: `${product.id}-${v.size}-${v.color}`.toUpperCase().replace(/\s+/g, '-'),
          })
        )
      );

      toast.success('Product updated');
      router.replace('/products');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (!product) return <p className="text-muted">Product not found.</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="btn-ghost p-2 -ml-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-serif text-2xl text-primary">Edit Product</h1>
          <p className="text-sm text-muted clamp-1">{product.name}</p>
        </div>
      </div>

      <ProductForm
        product={product}
        variants={variants}
        onSubmit={handleSubmit}
        loading={saving}
      />
    </div>
  );
}
