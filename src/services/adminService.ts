import {
  collection, query, where, orderBy, limit,
  getDocs, getDoc, doc, updateDoc, addDoc,
  deleteDoc, serverTimestamp, Timestamp,
  QueryConstraint, startAfter, DocumentSnapshot,
  writeBatch, setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { fromDoc, convertTimestamps } from '@/lib/firebase/helpers';
import type {
  Product, ProductVariant, Order, OrderStatus,
  Customer, Category, Coupon, Banner, Review,
  DashboardStats, DailySales, StoreSettings,
} from '@/types';
import { LOW_STOCK_THRESHOLD } from '@/lib/utils';

// ── Dashboard analytics ───────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersSnap, todaySnap, customersSnap, productsSnap, lowStockSnap] =
    await Promise.all([
      getDocs(query(collection(db,'orders'), where('status','==','pending'))),
      getDocs(query(collection(db,'orders'), where('createdAt','>=',Timestamp.fromDate(today)))),
      getDocs(query(collection(db,'users'), limit(1))),
      getDocs(query(collection(db,'products'), where('isActive','==',true))),
      getDocs(query(collection(db,'productVariants'), where('stock','<=',LOW_STOCK_THRESHOLD))),
    ]);

  const todayOrders  = todaySnap.docs.length;
  const todayRevenue = todaySnap.docs.reduce((s, d) => s + (d.data().total ?? 0), 0);

  // Count total customers (approximate via collection size)
  const custCount = (await getDocs(collection(db,'users'))).size;

  return {
    todayOrders,
    todayRevenue,
    totalCustomers: custCount,
    activeProducts: productsSnap.size,
    pendingOrders:  ordersSnap.size,
    lowStockCount:  lowStockSnap.size,
  };
}

export async function getSalesLast7Days(): Promise<DailySales[]> {
  const days: DailySales[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);

    const snap = await getDocs(query(
      collection(db,'orders'),
      where('createdAt','>=', Timestamp.fromDate(d)),
      where('createdAt','<',  Timestamp.fromDate(next)),
    ));

    const revenue = snap.docs.reduce((s, doc) => s + (doc.data().total ?? 0), 0);
    days.push({
      date: d.toLocaleDateString('en-BD', { weekday:'short' }),
      orders: snap.size,
      revenue,
    });
  }
  return days;
}

// ── Products ──────────────────────────────────────────────

export async function getAdminProducts(opts: {
  search?: string; categoryId?: string;
  active?: boolean; pageSize?: number; lastDoc?: DocumentSnapshot;
} = {}): Promise<{ products: Product[]; lastDoc: DocumentSnapshot|null; hasMore: boolean }> {
  const { categoryId, active, pageSize = 20, lastDoc } = opts;
  const c: QueryConstraint[] = [orderBy('createdAt','desc')];
  if (categoryId !== undefined) c.push(where('categoryId','==', categoryId));
  if (active     !== undefined) c.push(where('isActive','==', active));
  c.push(limit(pageSize + 1));
  if (lastDoc) c.push(startAfter(lastDoc));

  const snap = await getDocs(query(collection(db,'products'), ...c));
  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
  return { products: docs.map(d => fromDoc<Product>(d)), lastDoc: docs[docs.length-1] ?? null, hasMore };
}

export async function getAdminProductById(id: string): Promise<Product|null> {
  const snap = await getDoc(doc(db,'products',id));
  return snap.exists() ? fromDoc<Product>(snap) : null;
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const snap = await getDocs(query(collection(db,'productVariants'), where('productId','==',productId)));
  return snap.docs.map(d => fromDoc<ProductVariant>(d));
}

export async function createProduct(data: Omit<Product,'id'|'createdAt'|'updatedAt'>): Promise<string> {
  // Strip undefined optional fields — Firestore rejects them
  const payload: Record<string, unknown> = {
    ...data, salesCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  if (payload.brandId    === undefined) delete payload.brandId;
  if (payload.salePrice  === undefined) delete payload.salePrice;
  if (payload.material   === undefined || payload.material === '') delete payload.material;
  const ref = await addDoc(collection(db,'products'), payload);
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (payload.brandId   === undefined) delete payload.brandId;
  if (payload.salePrice === undefined) delete payload.salePrice;
  await updateDoc(doc(db,'products',id), payload);
}

export async function deleteProduct(id: string): Promise<void> {
  // Delete variants first
  const varSnap = await getDocs(query(collection(db,'productVariants'), where('productId','==',id)));
  const batch = writeBatch(db);
  varSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db,'products',id));
  await batch.commit();
}

export async function upsertVariant(variant: Omit<ProductVariant,'id'> & { id?: string }): Promise<void> {
  if (variant.id) {
    const { id, ...data } = variant;
    await updateDoc(doc(db,'productVariants',id), data);
  } else {
    await addDoc(collection(db,'productVariants'), variant);
  }
}

export async function getLowStockVariants(): Promise<(ProductVariant & { productName?: string })[]> {
  const snap = await getDocs(query(
    collection(db,'productVariants'),
    where('stock','<=', LOW_STOCK_THRESHOLD),
    orderBy('stock','asc'),
    limit(20),
  ));
  return snap.docs.map(d => fromDoc<ProductVariant>(d));
}

// ── Orders ────────────────────────────────────────────────

export async function getAdminOrders(opts: {
  status?: OrderStatus; pageSize?: number; lastDoc?: DocumentSnapshot;
} = {}): Promise<{ orders: Order[]; lastDoc: DocumentSnapshot|null; hasMore: boolean }> {
  const { status, pageSize = 20, lastDoc } = opts;
  const c: QueryConstraint[] = [orderBy('createdAt','desc')];
  if (status) c.push(where('status','==',status));
  c.push(limit(pageSize + 1));
  if (lastDoc) c.push(startAfter(lastDoc));

  const snap = await getDocs(query(collection(db,'orders'), ...c));
  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
  return { orders: docs.map(d => fromDoc<Order>(d)), lastDoc: docs[docs.length-1] ?? null, hasMore };
}

export async function getOrderById(id: string): Promise<Order|null> {
  const snap = await getDoc(doc(db,'orders',id));
  return snap.exists() ? fromDoc<Order>(snap) : null;
}

export async function updateOrderStatus(id: string, status: OrderStatus, note?: string): Promise<void> {
  const snap = await getDoc(doc(db,'orders',id));
  if (!snap.exists()) throw new Error('Order not found');
  const history = snap.data().statusHistory ?? [];
  const entry: Record<string, unknown> = { status, timestamp: Timestamp.now() };
  if (note !== undefined) entry.note = note;
  await updateDoc(doc(db,'orders',id), {
    status,
    statusHistory: [...history, entry],
    updatedAt: serverTimestamp(),
  });
}

export async function getOrderCountsByStatus(): Promise<Record<string, number>> {
  const statuses = ['pending','confirmed','processing','packed','shipped','delivered','cancelled'];
  const results  = await Promise.all(statuses.map(s =>
    getDocs(query(collection(db,'orders'), where('status','==',s))).then(snap => ({ [s]: snap.size }))
  ));
  return Object.assign({}, ...results);
}

// ── Categories ────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const snap = await getDocs(query(collection(db,'categories'), orderBy('order','asc')));
  return snap.docs.map(d => fromDoc<Category>(d));
}

export async function createCategory(data: Omit<Category,'id'>): Promise<string> {
  // Firestore rejects `undefined` values — strip parentId if not set
  const payload: Record<string, unknown> = { ...data };
  if (payload.parentId === undefined) delete payload.parentId;
  if (payload.icon === '' || payload.icon === undefined) delete payload.icon;
  const ref = await addDoc(collection(db,'categories'), payload);
  return ref.id;
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  const payload: Record<string, unknown> = { ...data };
  if (payload.parentId === undefined) delete payload.parentId;
  // Keep icon as empty string if user cleared it — that's intentional
  await updateDoc(doc(db,'categories',id), payload);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db,'categories',id));
}

// ── Customers ─────────────────────────────────────────────

export async function getCustomers(pageSize = 20): Promise<Customer[]> {
  const snap = await getDocs(query(collection(db,'users'), orderBy('createdAt','desc'), limit(pageSize)));
  return snap.docs.map(d => convertTimestamps<Customer>({ uid: d.id, ...d.data() }));
}

// ── Coupons ───────────────────────────────────────────────

export async function getCoupons(): Promise<Coupon[]> {
  const snap = await getDocs(query(collection(db,'coupons'), orderBy('createdAt','desc')));
  return snap.docs.map(d => fromDoc<Coupon>(d));
}

export async function createCoupon(data: Omit<Coupon,'id'|'usedCount'>): Promise<string> {
  const ref = await addDoc(collection(db,'coupons'), { ...data, usedCount: 0, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateCoupon(id: string, data: Partial<Coupon>): Promise<void> {
  await updateDoc(doc(db,'coupons',id), data);
}

export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(db,'coupons',id));
}

// ── Banners ───────────────────────────────────────────────

export async function getBanners(): Promise<Banner[]> {
  const snap = await getDocs(query(collection(db,'banners'), orderBy('order','asc')));
  return snap.docs.map(d => fromDoc<Banner>(d));
}

export async function upsertBanner(data: Partial<Banner> & { id?: string }): Promise<string> {
  const { id, ...rest } = data;
  // Strip undefined optional fields — Firestore rejects them
  const payload: Record<string, unknown> = { ...rest };
  if (payload.subtitle  === undefined) delete payload.subtitle;
  if (payload.link      === undefined) delete payload.link;
  if (payload.startDate === undefined) delete payload.startDate;
  if (payload.endDate   === undefined) delete payload.endDate;
  if (id) {
    await updateDoc(doc(db,'banners',id), payload);
    return id;
  }
  const ref = await addDoc(collection(db,'banners'), payload);
  return ref.id;
}

export async function deleteBanner(id: string): Promise<void> {
  await deleteDoc(doc(db,'banners',id));
}

// ── Reviews ───────────────────────────────────────────────

export async function getAdminReviews(approved?: boolean): Promise<Review[]> {
  const c: QueryConstraint[] = [orderBy('createdAt','desc')];
  if (approved !== undefined) c.push(where('isApproved','==',approved));
  const snap = await getDocs(query(collection(db,'reviews'), ...c));
  return snap.docs.map(d => fromDoc<Review>(d));
}

export async function approveReview(id: string): Promise<void> {
  await updateDoc(doc(db,'reviews',id), { isApproved: true });
}

export async function deleteReview(id: string): Promise<void> {
  await deleteDoc(doc(db,'reviews',id));
}

// ── Settings ──────────────────────────────────────────────

export async function getStoreSettings(): Promise<StoreSettings|null> {
  const snap = await getDoc(doc(db,'settings','store'));
  return snap.exists() ? (snap.data() as StoreSettings) : null;
}

export async function updateStoreSettings(data: Partial<StoreSettings>): Promise<void> {
  // setDoc + merge creates the document on first save instead of
  // failing when settings/store doesn't exist yet (updateDoc requires
  // the doc to already exist).
  await setDoc(doc(db, 'settings', 'store'), data, { merge: true });
}
