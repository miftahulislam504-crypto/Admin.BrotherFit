'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ProductForm, { type ProductFormData, type VariantRow } from '@/components/products/ProductForm';
import { createProduct, upsertVariant } from '@/services/adminService';
import { slugify } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function AddProductPage() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: ProductFormData, images: string[], variants: VariantRow[]) => {
    setLoading(true);
    try {
      const productId = await createProduct({
        name:        data.name,
        slug:        data.slug || slugify(data.name),
        sku:         data.sku,
        categoryId:  data.categoryId,
        basePrice:   data.basePrice,
        salePrice:   data.salePrice,   // undefined stripped inside createProduct
        description: data.description,
        material:    data.material,    // undefined stripped inside createProduct
        tags:        data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        images,
        isActive:    data.isActive,
        isFeatured:  data.isFeatured,
        // brandId, rating, reviewCount, salesCount omitted — set by createProduct
      });

      // Save variants
      await Promise.all(
        variants.map(v =>
          upsertVariant({
            productId,
            size:     v.size as ProductFormData['sku'] extends string ? never : never,
            color:    v.color,
            colorHex: v.colorHex,
            stock:    v.stock,
            reserved: 0,
            sold:     0,
            skuVariant: `${productId}-${v.size}-${v.color}`.toUpperCase().replace(/\s+/g, '-'),
          } as Parameters<typeof upsertVariant>[0])
        )
      );

      toast.success('Product created');
      router.replace('/products');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="btn-ghost p-2 -ml-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-serif text-2xl text-primary">Add Product</h1>
          <p className="text-sm text-muted">Create a new product listing</p>
        </div>
      </div>

      <ProductForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
