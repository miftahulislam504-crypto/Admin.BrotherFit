'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Check } from 'lucide-react';
import { getOrderById, updateOrderStatus } from '@/services/adminService';
import { Skeleton } from '@/components/ui/Spinner';
import { formatPrice, formatDate, formatDateTime, STATUS_LABELS, STATUS_COLORS, ORDER_PIPELINE, cn } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';
import toast from 'react-hot-toast';

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:'confirmed', confirmed:'processing',
  processing:'packed', packed:'shipped', shipped:'delivered',
};

export default function OrderDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [order,    setOrder]    = useState<Order | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getOrderById(id).then(o => { setOrder(o); setLoading(false); });
  }, [id]);

  const handleStatus = async (status: OrderStatus, note?: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, status, note);
      setOrder(o => o ? { ...o, status } : o);
      toast.success(`Order marked as ${STATUS_LABELS[status]}`);
    } catch { toast.error('Failed to update'); }
    finally { setUpdating(false); }
  };

  if (loading) return <OrderDetailSkeleton />;
  if (!order)  return <p className="text-muted p-6">Order not found.</p>;

  const currentIdx = ORDER_PIPELINE.indexOf(order.status as typeof ORDER_PIPELINE[number]);
  const nextStatus = NEXT[order.status];

  return (
    <div className="max-w-3xl space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost p-2 -ml-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="font-serif text-xl text-primary">
            #{order.id.slice(0,8).toUpperCase()}
          </h2>
          <p className="text-xs text-muted">
            {order.createdAt ? formatDateTime(new Date(order.createdAt as unknown as string)) : ''}
          </p>
        </div>
        <span className={cn('badge border text-xs ml-auto', STATUS_COLORS[order.status])}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Action buttons */}
      {order.status !== 'delivered' && order.status !== 'cancelled' && (
        <div className="flex gap-2 flex-wrap">
          {nextStatus && (
            <button
              onClick={() => handleStatus(nextStatus)}
              disabled={updating}
              className="btn-primary"
            >
              {updating ? '…' : `Mark as ${STATUS_LABELS[nextStatus]}`}
            </button>
          )}
          <button
            onClick={() => handleStatus('cancelled', 'Cancelled by admin')}
            disabled={updating}
            className="btn-danger"
          >
            Cancel Order
          </button>
        </div>
      )}

      {/* Status timeline */}
      {order.status !== 'cancelled' && (
        <div className="card card-inner">
          <h3 className="font-serif text-base text-primary mb-4">Order Timeline</h3>
          <div className="flex items-center justify-between">
            {ORDER_PIPELINE.map((step, i) => {
              const done    = i <= currentIdx;
              const current = i === currentIdx;
              const isLast  = i === ORDER_PIPELINE.length - 1;
              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn(
                      'w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all',
                      done ? 'bg-primary border-primary' :
                      current ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                    )}>
                      {done && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={cn(
                      'text-[9px] font-medium text-center leading-tight capitalize',
                      current ? 'text-primary' : done ? 'text-text' : 'text-muted'
                    )}>
                      {step}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={cn('flex-1 h-px mx-1 mb-4', i < currentIdx ? 'bg-primary' : 'bg-border')} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Items */}
        <div className="card card-inner md:col-span-2">
          <h3 className="font-serif text-base text-primary mb-4">
            Items ({order.items.length})
          </h3>
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                <div className="relative w-14 h-16 rounded-xl overflow-hidden bg-bg flex-shrink-0">
                  {item.productImage && (
                    <Image src={item.productImage} alt={item.productName} fill className="object-cover" sizes="56px" unoptimized />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text clamp-1">{item.productName}</p>
                  <p className="text-xs text-muted mt-0.5">{item.size} · {item.color} · ×{item.quantity}</p>
                </div>
                <span className="font-mono text-sm font-semibold text-primary flex-shrink-0">
                  {formatPrice(item.subtotal)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Customer + address */}
        <div className="card card-inner">
          <h3 className="font-serif text-base text-primary mb-3">Customer</h3>
          <p className="text-sm font-medium text-text">{order.address.name}</p>
          <p className="text-sm text-muted">{order.address.phone}</p>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            {order.address.address}<br />
            {order.address.area}, {order.address.upazila}<br />
            {order.address.district}
          </p>
        </div>

        {/* Payment */}
        <div className="card card-inner">
          <h3 className="font-serif text-base text-primary mb-3">Payment</h3>
          <div className="space-y-2">
            <Row label="Method"   value={order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod.toUpperCase()} />
            <Row label="Subtotal" value={formatPrice(order.subtotal)} />
            <Row label="Delivery" value={formatPrice(order.deliveryCharge)} />
            {order.discount > 0 && <Row label="Discount" value={`-${formatPrice(order.discount)}`} valueClass="text-success" />}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-sm font-semibold text-text">Total</span>
              <span className="font-mono font-bold text-primary">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className={cn('text-sm font-medium', valueClass ?? 'text-text')}>{value}</span>
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-40 rounded-2xl md:col-span-2" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    </div>
  );
}
