import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { fromDoc } from '@/lib/firebase/helpers';
import type { ProductVariant, Product } from '@/types';

export interface InventoryRow extends ProductVariant {
  productName: string;
  productImage: string;
  productSku: string;
}

/** Get all variants joined with their parent product info */
export async function getAllInventory(): Promise<InventoryRow[]> {
  const [productsSnap, variantsSnap] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(query(collection(db, 'productVariants'), orderBy('stock', 'asc'))),
  ]);

  const productMap = new Map<string, Product>();
  productsSnap.docs.forEach(d => productMap.set(d.id, fromDoc<Product>(d)));

  return variantsSnap.docs.map(d => {
    const variant = fromDoc<ProductVariant>(d);
    const product = productMap.get(variant.productId);
    return {
      ...variant,
      productName:  product?.name   ?? 'Unknown product',
      productImage: product?.images?.[0] ?? '',
      productSku:   product?.sku    ?? '—',
    };
  });
}

export async function adjustStock(variantId: string, newStock: number): Promise<void> {
  await updateDoc(doc(db, 'productVariants', variantId), { stock: newStock });
}
