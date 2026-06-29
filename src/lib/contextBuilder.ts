// src/lib/contextBuilder.ts
// BrotherFit — Firestore থেকে data নিয়ে Gemini এর জন্য context বানায়

import {
  collection, getDocs, query, where, limit,
  orderBy, doc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  category?: string;
  isActive: boolean;
  tags?: string[];
}

interface ProductVariant {
  id?: string;
  productId: string;
  size: string;
  color: string;
  price: number;
  stock: number;
  sku?: string;
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
        limit(200)
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
    // Phone দিয়ে user খুঁজবে
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

// ── Format products as readable text for Gemini ────────────────────────────────
function formatProducts(products: Product[], variants: ProductVariant[]): string {
  if (products.length === 0) return 'কোনো product পাওয়া যায়নি।';

  return products.map(p => {
    const pVariants = variants.filter(v => v.productId === p.id);

    // Available sizes
    const sizes = [...new Set(pVariants.map(v => v.size))].filter(Boolean);

    // Available colors
    const colors = [...new Set(pVariants.map(v => v.color))].filter(Boolean);

    // Price range
    const prices = pVariants.map(v => v.price).filter(p => p > 0);
    const minPrice = prices.length ? Math.min(...prices) : p.basePrice;
    const maxPrice = prices.length ? Math.max(...prices) : p.basePrice;
    const priceStr = minPrice === maxPrice ? `৳${minPrice}` : `৳${minPrice}–${maxPrice}`;

    // Stock info
    const totalStock = pVariants.reduce((s, v) => s + (v.stock || 0), 0);
    const inStock = totalStock > 0;

    return [
      `📦 ${p.name}`,
      `   দাম: ${priceStr}`,
      sizes.length ? `   Size: ${sizes.join(', ')}` : '',
      colors.length ? `   Color: ${colors.join(', ')}` : '',
      `   Stock: ${inStock ? `আছে (${totalStock} পিস)` : '❌ শেষ'}`,
      p.description ? `   বিবরণ: ${p.description.substring(0, 100)}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

// ── Format orders as readable text ─────────────────────────────────────────────
function formatOrders(orders: Order[]): string {
  if (orders.length === 0) return 'এই customer এর কোনো order নেই।';

  return orders.map(o => {
    const items = (o.items || [])
      .map((i: any) => `${i.name || i.productName} × ${i.quantity}`)
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

// ── Main: Build full context for Gemini ────────────────────────────────────────
export async function buildContext(
  customerMessage: string,
  customerPhone?: string | null
): Promise<string> {

  // Parallel fetch
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

// ── Quick product search (keyword based) ──────────────────────────────────────
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
