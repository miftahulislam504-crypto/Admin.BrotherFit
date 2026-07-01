// src/services/aiOrderService.ts
// BrotherFit — AI Salesman এর মাধ্যমে order তৈরি করার service
// Groq function-calling থেকে call হয়

import {
  collection, addDoc, doc, getDoc, getDocs,
  query, where, limit, serverTimestamp, runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// ── Types (matches actual Order/OrderItem schema) ────────────────────────────────
export interface AIOrderItemInput {
  productName: string;   // AI যেভাবে বলবে (fuzzy match হবে)
  size: string;
  color: string;
  quantity: number;
}

export interface AIOrderInput {
  contactId:      string;
  items:          AIOrderItemInput[];
  customerName:   string;
  phone:          string;
  district:       string;
  upazila:        string;
  area:           string;
  address:        string;
  paymentMethod:  'cod' | 'bkash' | 'nagad';
}

export interface AIOrderResult {
  success:      boolean;
  orderId?:     string;
  orderNumber?: string;
  total?:       number;
  error?:       string;
  missingInfo?: string[]; // AI কে বলে দেবে আর কী জিজ্ঞেস করতে হবে
}

// ── Delivery charge config (settings থেকে override করা যায়) ───────────────────
const DEFAULT_SIRAJGANJ_CHARGE   = 70;
const DEFAULT_OUTSIDE_CHARGE = 120;
const SIRAJGANJ_DISTRICTS = ['sirajganj', 'সিরাজগঞ্জ'];

// ── Product/Variant lookup দিয়ে fuzzy match ───────────────────────────────────
async function findProductAndVariant(
  productNameQuery: string,
  size: string,
  color: string
): Promise<{
  productId: string; productName: string; productImage: string;
  variantId: string; price: number; stock: number;
} | null> {

  const prodSnap = await getDocs(query(
    collection(db, 'products'),
    where('isActive', '==', true),
    limit(50)
  ));

  const kw = productNameQuery.toLowerCase().trim();
  const matched = prodSnap.docs.find(d => {
    const name = (d.data().name ?? '').toLowerCase();
    return name.includes(kw) || kw.includes(name) ||
      name.split(' ').some((word: string) => kw.includes(word) && word.length > 3);
  });

  if (!matched) return null;

  const product = matched.data();
  const productId = matched.id;

  // Variant খুঁজবে (size + color match)
  const varSnap = await getDocs(query(
    collection(db, 'productVariants'),
    where('productId', '==', productId),
    limit(100)
  ));

  const sizeNorm  = size.toUpperCase().trim();
  const colorNorm = color.toLowerCase().trim();

  let variant = varSnap.docs.find(d => {
    const v = d.data();
    return (v.size ?? '').toUpperCase() === sizeNorm &&
           (v.color ?? '').toLowerCase() === colorNorm;
  });

  // Exact match না পেলে শুধু size match করে দেখবে
  if (!variant) {
    variant = varSnap.docs.find(d =>
      (d.data().size ?? '').toUpperCase() === sizeNorm
    );
  }

  if (!variant) return null;

  const vData = variant.data();
  const effectivePrice = vData.priceOverride && vData.priceOverride > 0
    ? vData.priceOverride
    : (product.salePrice && product.salePrice > 0 ? product.salePrice : product.basePrice);

  return {
    productId,
    productName:  product.name,
    productImage: product.images?.[0] ?? '',
    variantId:    variant.id,
    price:        effectivePrice,
    stock:        vData.stock ?? 0,
  };
}

// ── Delivery charge calculator ────────────────────────────────────────────────
async function getDeliveryCharge(district: string): Promise<number> {
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const isSirajganj = SIRAJGANJ_DISTRICTS.some(d => district.toLowerCase().includes(d));
    return isSirajganj
      ? (settings.deliveryChargeSirajganj   ?? DEFAULT_SIRAJGANJ_CHARGE)
      : (settings.deliveryChargeOutside ?? DEFAULT_OUTSIDE_CHARGE);
  } catch {
    const isSirajganj = SIRAJGANJ_DISTRICTS.some(d => district.toLowerCase().includes(d));
    return isSirajganj ? DEFAULT_SIRAJGANJ_CHARGE : DEFAULT_OUTSIDE_CHARGE;
  }
}

// ── Order number generator ────────────────────────────────────────────────────
function generateOrderNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const randPart  = Math.floor(1000 + Math.random() * 9000);
  return `BF-${datePart}-${randPart}`;
}

// ── MAIN: AI থেকে order তৈরি করে ─────────────────────────────────────────────
export async function createOrderFromAI(input: AIOrderInput): Promise<AIOrderResult> {

  // ── Validation: কী কী তথ্য এখনো নেই ──────────────────────────────────────
  const missing: string[] = [];
  if (!input.customerName?.trim()) missing.push('নাম');
  if (!input.phone?.trim() || input.phone.replace(/\D/g,'').length < 11) missing.push('সঠিক ফোন নম্বর');
  if (!input.district?.trim())  missing.push('জেলা');
  if (!input.area?.trim() && !input.address?.trim()) missing.push('বিস্তারিত ঠিকানা');
  if (!input.items || input.items.length === 0) missing.push('কোন প্রোডাক্ট নিবেন');

  if (missing.length > 0) {
    return { success: false, missingInfo: missing, error: 'তথ্য অসম্পূর্ণ' };
  }

  // ── প্রতিটা item Firestore এ resolve করবে (name → productId/variantId/price) ──
  const resolvedItems: any[] = [];
  const notFound: string[] = [];
  const outOfStock: string[] = [];

  for (const item of input.items) {
    const found = await findProductAndVariant(item.productName, item.size, item.color);

    if (!found) {
      notFound.push(`${item.productName} (${item.size}/${item.color})`);
      continue;
    }
    if (found.stock < item.quantity) {
      outOfStock.push(`${found.productName} — মাত্র ${found.stock} পিস আছে`);
      continue;
    }

    resolvedItems.push({
      productId:    found.productId,
      productName:  found.productName,
      productImage: found.productImage,
      variantId:    found.variantId,
      size:         item.size,
      color:        item.color,
      price:        found.price,
      quantity:     item.quantity,
      subtotal:     found.price * item.quantity,
    });
  }

  if (notFound.length > 0) {
    return {
      success: false,
      error: `এই প্রোডাক্টগুলো খুঁজে পাওয়া যায়নি: ${notFound.join(', ')}`,
    };
  }
  if (outOfStock.length > 0) {
    return {
      success: false,
      error: `Stock সমস্যা: ${outOfStock.join(', ')}`,
    };
  }
  if (resolvedItems.length === 0) {
    return { success: false, error: 'কোনো valid product পাওয়া যায়নি' };
  }

  // ── Totals calculate করবে ────────────────────────────────────────────────
  const subtotal       = resolvedItems.reduce((s, i) => s + i.subtotal, 0);
  const deliveryCharge = await getDeliveryCharge(input.district);
  const discount        = 0; // coupon logic future এ যোগ করা যাবে
  const total           = subtotal + deliveryCharge - discount;

  // ── Stock deduct + Order create (transaction দিয়ে safe) ───────────────────
  try {
    const orderNumber = generateOrderNumber();
    const orderId = await runTransaction(db, async (transaction) => {

      // Stock আবার check ও deduct করবে (race condition এড়াতে)
      for (const item of resolvedItems) {
        const variantRef = doc(db, 'productVariants', item.variantId);
        const variantSnap = await transaction.get(variantRef);
        if (!variantSnap.exists()) throw new Error(`Variant not found: ${item.productName}`);

        const currentStock = variantSnap.data().stock ?? 0;
        if (currentStock < item.quantity) {
          throw new Error(`স্টক শেষ হয়ে গেছে: ${item.productName}`);
        }

        transaction.update(variantRef, { stock: currentStock - item.quantity });
      }

      // Order document তৈরি
      const orderRef = doc(collection(db, 'orders'));
      transaction.set(orderRef, {
        orderNumber,
        userId:          null, // guest order (Messenger/WhatsApp থেকে)
        status:           'pending',
        items:            resolvedItems,
        subtotal,
        deliveryCharge,
        discount,
        total,
        address: {
          name:     input.customerName,
          phone:    input.phone,
          district: input.district,
          upazila:  input.upazila || '',
          area:     input.area || '',
          address:  input.address,
        },
        paymentMethod:    input.paymentMethod,
        source:           'ai_automation',
        contactId:        input.contactId,
        statusHistory: [{
          status: 'pending',
          timestamp: new Date(),
          note: 'AI Assistant এর মাধ্যমে অর্ডার তৈরি হয়েছে',
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return orderRef.id;
    });

    return {
      success:     true,
      orderId,
      orderNumber,
      total,
    };

  } catch (err: any) {
    console.error('[AI Order] Transaction failed:', err.message);
    return { success: false, error: err.message || 'অর্ডার তৈরি করতে সমস্যা হয়েছে' };
  }
}

// ── Order status check (AI কে দিয়ে "আমার অর্ডার কোথায়" জিজ্ঞেস করলে) ────────
export async function checkOrderStatus(phone: string): Promise<string> {
  try {
    const snap = await getDocs(query(
      collection(db, 'orders'),
      where('address.phone', '==', phone),
      limit(5)
    ));

    if (snap.empty) return 'এই নম্বরে কোনো অর্ডার পাওয়া যায়নি।';

    const orders = snap.docs
      .map(d => d.data())
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      .slice(0, 3);

    const statusMap: Record<string, string> = {
      pending:    'অপেক্ষমান — শীঘ্রই confirm হবে',
      confirmed:  'নিশ্চিত হয়েছে',
      processing: 'প্রসেসিং চলছে',
      packed:     'প্যাক করা হয়েছে',
      shipped:    'শিপিং এ পাঠানো হয়েছে',
      delivered:  'ডেলিভার হয়ে গেছে ✅',
      cancelled:  'বাতিল হয়েছে',
    };

    return orders.map(o =>
      `Order #${o.orderNumber}: ${statusMap[o.status] ?? o.status} — মোট ৳${o.total}`
    ).join('\n');

  } catch {
    return 'অর্ডার status check করতে সমস্যা হচ্ছে, একটু পরে আবার চেষ্টা করুন।';
  }
}
