// src/lib/contextBuilder.ts
// BrotherFit — Firestore থেকে data নিয়ে AI এর জন্য context বানায়
// Real Product type অনুযায়ী: basePrice, salePrice, images[], priceOverride

import {
  collection, getDocs, query, where, limit,
  orderBy, doc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// ── Types (matches actual Firestore schema) ─────────────────────────────────────
interface Product {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  salePrice?: number;      // discount/offer price (থাকলে এটাই real selling price)
  images?: string[];       // Firebase Storage URLs
  category?: string;
  categoryId?: string;
  isActive: boolean;
  tags?: string[];
}

interface ProductVariant {
  id?: string;
  productId: string;
  size: string;
  color: string;
  colorHex?: string;
  stock: number;
  priceOverride?: number;  // variant-specific price (rare, but takes priority if set)
  skuVariant?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  items: any[];
  createdAt: any;
}

interface SiteSettings {
  deliveryChargeDhaka?: number;
  deliveryChargeOutside?: number;
  freeDeliveryMinOrder?: number;
  returnPolicy?: string;
  contactPhone?: string;
  contactEmail?: string;
  bkashNumber?: string;
  nagadNumber?: string;
  websiteUrl?: string;
}

// ── Effective price helper (handles base/sale/override correctly) ──────────────
function getEffectivePrice(product: Product, variant?: ProductVariant): number {
  // Priority: variant override > product sale price > product base price
  if (variant?.priceOverride && variant.priceOverride > 0) return variant.priceOverride;
  if (product.salePrice && product.salePrice > 0) return product.salePrice;
  return product.basePrice;
}

// ── Fetch Products from Firestore ──────────────────────────────────────────────
async function getProducts(): Promise<{ products: Product[]; variants: ProductVariant[] }> {
  try {
    const [prodSnap, varSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'products'),
        where('isActive', '==', true),
        limit(50)
      )),
      getDocs(query(
        collection(db, 'productVariants'),
        limit(300)
      )),
    ]);

    const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
    const variants = varSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant));

    return { products, variants };
  } catch {
    return { products: [], variants: [] };
  }
}

// ── Fetch Site Settings ────────────────────────────────────────────────────────
async function getSettings(): Promise<SiteSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    return snap.exists() ? (snap.data() as SiteSettings) : {};
  } catch {
    return {};
  }
}

// ── Fetch Customer Orders ──────────────────────────────────────────────────────
async function getCustomerOrders(phone: string): Promise<Order[]> {
  try {
    const userSnap = await getDocs(query(
      collection(db, 'users'),
      where('phone', '==', phone),
      limit(1)
    ));

    if (userSnap.empty) return [];

    const userId = userSnap.docs[0].id;

    const orderSnap = await getDocs(query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(5)
    ));

    return orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  } catch {
    return [];
  }
}

// ── Format products as readable text for AI ─────────────────────────────────────
function formatProducts(products: Product[], variants: ProductVariant[]): string {
  if (products.length === 0) return 'কোনো product পাওয়া যায়নি।';

  return products.map(p => {
    const pVariants = variants.filter(v => v.productId === p.id);

    const sizes  = [...new Set(pVariants.map(v => v.size))].filter(Boolean);
    const colors = [...new Set(pVariants.map(v => v.color))].filter(Boolean);

    // ── Price calculation: clearly separate regular vs offer price ───────────
    const regularPrice  = p.basePrice;
    const hasDiscount   = !!(p.salePrice && p.salePrice > 0 && p.salePrice < p.basePrice);
    const effectivePrice = hasDiscount ? p.salePrice! : p.basePrice;
    const discountPct   = hasDiscount
      ? Math.round(((p.basePrice - p.salePrice!) / p.basePrice) * 100)
      : 0;

    // Variant override check (rare case)
    const variantOverrides = pVariants
      .map(v => v.priceOverride)
      .filter((x): x is number => !!x && x > 0);
    const finalPrice = variantOverrides.length > 0
      ? Math.min(...variantOverrides)
      : effectivePrice;

    const priceLine = hasDiscount
      ? `   দাম: ~~৳${regularPrice}~~ ➜ ৳${finalPrice} (${discountPct}% ছাড়!) 🔥`
      : `   দাম: ৳${finalPrice}`;

    // Stock info
    const totalStock = pVariants.reduce((s, v) => s + (v.stock || 0), 0);
    const inStock     = totalStock > 0;

    // Image (first one = main image)
    const mainImage = p.images && p.images.length > 0 ? p.images[0] : null;

    return [
      `📦 ${p.name}`,
      priceLine,
      sizes.length  ? `   Size: ${sizes.join(', ')}`   : '',
      colors.length ? `   Color: ${colors.join(', ')}` : '',
      `   Stock: ${inStock ? `আছে (${totalStock} পিস)` : '❌ স্টক শেষ'}`,
      p.description ? `   বিবরণ: ${p.description.substring(0, 100)}` : '',
      mainImage ? `   ছবি: ${mainImage}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

// ── Format orders as readable text ─────────────────────────────────────────────
function formatOrders(orders: Order[]): string {
  if (orders.length === 0) return 'এই customer এর কোনো order নেই।';

  return orders.map(o => {
    const items = (o.items || [])
      .map((i: any) => `${i.productName || i.name} × ${i.quantity}`)
      .join(', ');
    return `Order #${o.orderNumber}: ${o.status} | ৳${o.total} | Items: ${items}`;
  }).join('\n');
}

// ── Format settings ─────────────────────────────────────────────────────────────
function formatSettings(s: SiteSettings): string {
  const lines = [
    '🚚 Delivery:',
    `   ঢাকার ভেতরে: ৳${s.deliveryChargeDhaka ?? 70} (1–2 দিন)`,
    `   ঢাকার বাইরে: ৳${s.deliveryChargeOutside ?? 120} (2–4 দিন)`,
    s.freeDeliveryMinOrder ? `   ৳${s.freeDeliveryMinOrder}+ এ FREE delivery` : '',
    '',
    '💳 Payment:',
    `   বিকাশ: ${s.bkashNumber ?? '01XXXXXXXXX'}`,
    `   নগদ: ${s.nagadNumber ?? '01XXXXXXXXX'}`,
    '   Cash on Delivery (COD) ✅',
    '   Card Payment ✅',
    '',
    '↩️ Return Policy:',
    `   ${s.returnPolicy ?? '7 দিনের মধ্যে size issue তে exchange করা যাবে'}`,
    '',
    '📞 Contact:',
    `   Phone/WhatsApp: ${s.contactPhone ?? '01XXXXXXXXX'}`,
    `   Email: ${s.contactEmail ?? 'brotherfit06@gmail.com'}`,
    `   Website: ${s.websiteUrl ?? 'brotherfit.com'}`,
  ];
  return lines.filter(l => l !== undefined).join('\n');
}

// ── Main: Build full context for AI ─────────────────────────────────────────────
export async function buildContext(
  customerMessage: string,
  customerPhone?: string | null
): Promise<string> {

  const [{ products, variants }, settings, orders] = await Promise.all([
    getProducts(),
    getSettings(),
    customerPhone ? getCustomerOrders(customerPhone) : Promise.resolve([]),
  ]);

  const context = [
    '═══════════════════════════════════',
    '    BROTHERFIT STORE — LIVE DATA   ',
    '═══════════════════════════════════',
    '',
    '## 🛍️ Available Products',
    '⚠️ PRICE RULE: যদি কোনো product এ ~~strikethrough~~ price দেখো, সেটা পুরনো/regular',
    '   দাম, আর তার পরের ৳ amount টাই বর্তমান বিক্রয় মূল্য (discount price)।',
    '   সবসময় শুধু চূড়ান্ত/বর্তমান দামটাই customer কে বলবে, পুরনো দাম নিজে থেকে',
    '   উল্লেখ করার দরকার নেই যদি না customer discount সম্পর্কে জিজ্ঞেস করে।',
    '',
    formatProducts(products, variants),
    '',
    '## ⚙️ Store Settings',
    formatSettings(settings),
    '',
    orders.length > 0 ? [
      '## 📦 Customer Order History',
      formatOrders(orders),
      '',
    ].join('\n') : '',
    '═══════════════════════════════════',
  ].join('\n');

  return context;
}

// ── Quick product search (keyword based) ────────────────────────────────────────
export async function searchProducts(keyword: string): Promise<string> {
  const { products, variants } = await getProducts();

  const kw = keyword.toLowerCase();
  const matched = products.filter(p =>
    p.name?.toLowerCase().includes(kw) ||
    p.description?.toLowerCase().includes(kw) ||
    p.category?.toLowerCase().includes(kw) ||
    p.tags?.some(t => t.toLowerCase().includes(kw))
  );

  if (matched.length === 0) return `"${keyword}" নামে কোনো product পাওয়া যায়নি।`;
  return formatProducts(matched, variants);
}
