// src/services/abandonedCartService.ts
// BrotherFit Admin — Abandoned Cart Detection & Reminder

import {
  collection, doc, addDoc, getDocs, updateDoc,
  query, where, orderBy, limit, serverTimestamp,
  Timestamp, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { MetaAPI } from '@/lib/meta-api';
import { generateCartReminder } from '@/lib/gemini';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AbandonedCartItem {
  productId:    string;
  productName:  string;
  productImage: string;
  variantId:    string;
  size:         string;
  color:        string;
  price:        number;
  quantity:     number;
}

export interface AbandonedCart {
  id:              string;
  userId:          string;
  userName:        string | null;
  phone:           string | null;
  email:           string | null;
  items:           AbandonedCartItem[];
  totalAmount:     number;
  status:          'active' | 'reminded' | 'converted' | 'expired';
  reminderCount:   number;
  lastRemindedAt:  Date | null;
  lastUpdatedAt:   Date;
  createdAt:       Date;
}

export interface CartReminderSettings {
  id:              string;
  isEnabled:       boolean;
  delayHours:      number;   // hours after abandonment to send first reminder
  maxReminders:    number;   // max times to remind
  reminderGapHours:number;   // hours between reminders
  useAI:           boolean;  // use Gemini to generate message
  customMessage:   string;   // fallback if AI disabled
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const toDate = (v: any): Date =>
  v instanceof Timestamp ? v.toDate() : new Date(v ?? Date.now());

const fromDoc = (d: any): AbandonedCart => ({
  id:             d.id,
  userId:         d.data().userId,
  userName:       d.data().userName ?? null,
  phone:          d.data().phone    ?? null,
  email:          d.data().email    ?? null,
  items:          d.data().items    ?? [],
  totalAmount:    d.data().totalAmount ?? 0,
  status:         d.data().status   ?? 'active',
  reminderCount:  d.data().reminderCount ?? 0,
  lastRemindedAt: d.data().lastRemindedAt ? toDate(d.data().lastRemindedAt) : null,
  lastUpdatedAt:  toDate(d.data().lastUpdatedAt),
  createdAt:      toDate(d.data().createdAt),
});

// ── Cart CRUD (called from main BrotherFit app via Firestore directly) ─────────
export async function getAbandonedCarts(statusFilter?: AbandonedCart['status']): Promise<AbandonedCart[]> {
  let q = query(
    collection(db, 'abandoned_carts'),
    orderBy('lastUpdatedAt', 'desc'),
    limit(100)
  );
  if (statusFilter) {
    q = query(
      collection(db, 'abandoned_carts'),
      where('status', '==', statusFilter),
      orderBy('lastUpdatedAt', 'desc'),
      limit(100)
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(fromDoc);
}

export async function getCartStats() {
  const [active, reminded, converted] = await Promise.all([
    getDocs(query(collection(db, 'abandoned_carts'), where('status', '==', 'active'))),
    getDocs(query(collection(db, 'abandoned_carts'), where('status', '==', 'reminded'))),
    getDocs(query(collection(db, 'abandoned_carts'), where('status', '==', 'converted'))),
  ]);

  const convertedDocs = converted.docs.map(d => d.data());
  const recoveredRevenue = convertedDocs
    .reduce((sum, d) => sum + (d.totalAmount ?? 0), 0);

  return {
    active:           active.size,
    reminded:         reminded.size,
    converted:        converted.size,
    total:            active.size + reminded.size + converted.size,
    recoveredRevenue,
    conversionRate:   converted.size > 0
      ? Math.round((converted.size / (reminded.size + converted.size)) * 100)
      : 0,
  };
}

// ── Settings CRUD ──────────────────────────────────────────────────────────────
export async function getSettings(): Promise<CartReminderSettings | null> {
  const snap = await getDocs(
    query(collection(db, 'cart_reminder_settings'), limit(1))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as CartReminderSettings;
}

export async function saveSettings(
  data: Omit<CartReminderSettings, 'id'>
): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'cart_reminder_settings'), limit(1))
  );
  if (snap.empty) {
    await addDoc(collection(db, 'cart_reminder_settings'), data);
  } else {
    await updateDoc(doc(db, 'cart_reminder_settings', snap.docs[0].id), { ...data });
  }
}

// ── Core: Process abandoned carts (called by cron) ────────────────────────────
export async function processAbandonedCarts(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const settings = await getSettings();

  // Default settings if not configured
  const cfg = settings ?? {
    id: '', isEnabled: true, delayHours: 2,
    maxReminders: 2, reminderGapHours: 24,
    useAI: true, customMessage: DEFAULT_REMINDER_MSG,
  };

  if (!cfg.isEnabled) {
    return { processed: 0, sent: 0, skipped: 0, errors: 0 };
  }

  const now         = Date.now();
  const delayMs     = cfg.delayHours      * 60 * 60 * 1000;
  const gapMs       = cfg.reminderGapHours * 60 * 60 * 1000;

  // Get active + reminded carts that might need a reminder
  const [activeCarts, remindedCarts] = await Promise.all([
    getDocs(query(collection(db, 'abandoned_carts'), where('status', '==', 'active'))),
    getDocs(query(collection(db, 'abandoned_carts'), where('status', '==', 'reminded'))),
  ]);

  const eligibleCarts = [
    // Active carts: abandoned > delayHours ago
    ...activeCarts.docs
      .map(fromDoc)
      .filter(c => {
        const age = now - c.lastUpdatedAt.getTime();
        return age >= delayMs && c.items.length > 0 && c.phone;
      }),
    // Already reminded but can send again
    ...remindedCarts.docs
      .map(fromDoc)
      .filter(c => {
        const lastReminded = c.lastRemindedAt?.getTime() ?? 0;
        const gapOk        = (now - lastReminded) >= gapMs;
        const underLimit   = c.reminderCount < cfg.maxReminders;
        return gapOk && underLimit && c.phone;
      }),
  ];

  let sent = 0, skipped = 0, errors = 0;

  for (const cart of eligibleCarts) {
    if (!cart.phone) { skipped++; continue; }

    try {
      let message: string;

      if (cfg.useAI) {
        // Generate AI-powered personalized message
        message = await generateCartReminder({
          customerName: cart.userName ?? 'বন্ধু',
          items: cart.items.map(i => ({
            name:  i.productName,
            size:  i.size,
            qty:   i.quantity,
            price: i.price,
          })),
          totalAmount: cart.totalAmount,
        });
      } else {
        // Use custom template message
        message = cfg.customMessage
          .replace('{{name}}',  cart.userName ?? 'বন্ধু')
          .replace('{{total}}', `৳${cart.totalAmount}`);
      }

      // Send WhatsApp reminder
      await MetaAPI.sendWhatsApp(cart.phone, message);

      // Update cart status
      await updateDoc(doc(db, 'abandoned_carts', cart.id), {
        status:         'reminded',
        reminderCount:  (cart.reminderCount ?? 0) + 1,
        lastRemindedAt: serverTimestamp(),
      });

      // Log the reminder
      await addDoc(collection(db, 'cart_reminder_logs'), {
        cartId:    cart.id,
        userId:    cart.userId,
        phone:     cart.phone,
        message,
        sentAt:    serverTimestamp(),
        aiGenerated: cfg.useAI,
      });

      sent++;
    } catch (err: any) {
      console.error(`[Cart Reminder] Failed for cart ${cart.id}:`, err.message);
      errors++;
    }
  }

  return {
    processed: eligibleCarts.length,
    sent,
    skipped,
    errors,
  };
}

// ── Default reminder message template ─────────────────────────────────────────
export const DEFAULT_REMINDER_MSG =
  `🛍️ আরে {{name}}!\n\n` +
  `তুমি BrotherFit এর cart এ কিছু awesome জিনিস রেখে গেছো! 👀\n\n` +
  `মোট: {{total}}\n\n` +
  `⚡ Stock limited — এখনই complete করো!\n` +
  `👉 brotherfit.com/cart\n\n` +
  `কোনো সাহায্য লাগলে reply করো 😊`;
