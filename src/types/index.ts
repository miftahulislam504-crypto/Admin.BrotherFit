// ── Shared with web app ───────────────────────────────────

export type SizeOption = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';

export type OrderStatus =
  | 'pending' | 'confirmed' | 'processing'
  | 'packed'  | 'shipped'   | 'delivered' | 'cancelled';

export type PaymentMethod = 'cod' | 'bkash' | 'nagad';

// ── Product ───────────────────────────────────────────────

export interface Category {
  id: string; name: string; slug: string;
  icon?: string; image?: string; parentId?: string;
  order: number; isActive: boolean;
}

export interface Brand {
  id: string; name: string; slug: string; logo?: string; isActive: boolean;
}

export interface Product {
  id: string; name: string; slug: string; sku: string;
  categoryId: string; brandId?: string;
  basePrice: number; salePrice?: number;
  images: string[];
  description: string; material?: string;
  tags: string[];
  isActive: boolean; isFeatured: boolean;
  salesCount: number; rating?: number; reviewCount?: number;
  createdAt: Date; updatedAt: Date;
}

export interface ProductVariant {
  id: string; productId: string;
  size: SizeOption; color: string; colorHex?: string;
  stock: number; reserved: number; sold: number;
  priceOverride?: number; skuVariant: string;
}

// ── Order ─────────────────────────────────────────────────

export interface OrderItem {
  productId: string; productName: string; productImage: string;
  variantId: string; size: string; color: string;
  price: number; quantity: number; subtotal: number;
}

export interface DeliveryAddress {
  name: string; phone: string;
  district: string; upazila: string; area: string; address: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus; timestamp: Date; note?: string;
}

export interface Order {
  id: string; userId?: string; status: OrderStatus;
  items: OrderItem[];
  subtotal: number; deliveryCharge: number; discount: number; total: number;
  address: DeliveryAddress;
  paymentMethod: PaymentMethod; couponCode?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: Date; updatedAt: Date;
}

// ── User ──────────────────────────────────────────────────

export interface UserAddress {
  id: string; label: string; name: string; phone: string;
  district: string; upazila: string; area: string; address: string;
  isDefault: boolean;
}

export interface Customer {
  uid: string; name: string; email?: string; phone?: string;
  photoURL?: string; addresses: UserAddress[];
  orderCount?: number; totalSpent?: number;
  createdAt: Date;
}

// ── Marketing ─────────────────────────────────────────────

export interface Banner {
  id: string; image: string; title: string; subtitle?: string;
  link?: string; isActive: boolean;
  startDate?: Date; endDate?: Date; order: number;
}

export interface Coupon {
  id: string; code: string; type: 'fixed' | 'percentage';
  value: number; minOrder: number;
  usageLimit: number; usedCount: number;
  expiryDate: Date; isActive: boolean;
}

export interface FlashSale {
  id: string; title: string; startTime: Date; endTime: Date;
  productIds: string[]; discountType: 'fixed' | 'percentage';
  discountValue: number; isActive: boolean;
}

export interface Review {
  id: string; productId: string; userId: string;
  userName: string; userPhoto?: string;
  rating: number; comment: string;
  isApproved: boolean; createdAt: Date;
}

// ── Analytics ─────────────────────────────────────────────

export interface DailySales {
  date: string;   // 'YYYY-MM-DD'
  orders: number;
  revenue: number;
}

export interface DashboardStats {
  todayOrders:    number;
  todayRevenue:   number;
  totalCustomers: number;
  activeProducts: number;
  pendingOrders:  number;
  lowStockCount:  number;
}

// ── Settings ──────────────────────────────────────────────

export interface StoreSettings {
  logo?: string; name: string; address: string; email: string; phone?: string;
  payment: { bkash: boolean; nagad: boolean; cod: boolean };
  delivery: { dhakaCharge: number; outsideCharge: number };
  reviews: { autoApprove: boolean };
}
