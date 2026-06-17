'use client';

import { useEffect, useState } from 'react';
import { Star, Check, Trash2 } from 'lucide-react';
import { getAdminReviews, approveReview, deleteReview } from '@/services/adminService';
import { Skeleton, EmptyState } from '@/components/ui/Spinner';
import { formatDate, cn } from '@/lib/utils';
import type { Review } from '@/types';
import toast from 'react-hot-toast';

type Tab = 'pending' | 'approved' | 'all';

export default function ReviewsPage() {
  const [reviews,  setReviews]  = useState<Review[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>('pending');

  const load = async (t: Tab) => {
    setLoading(true);
    const approved = t === 'pending' ? false : t === 'approved' ? true : undefined;
    setReviews(await getAdminReviews(approved));
    setLoading(false);
  };

  useEffect(() => { load(tab); }, [tab]);

  const handleApprove = async (id: string) => {
    await approveReview(id);
    toast.success('Review approved');
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this review?')) return;
    await deleteReview(id);
    toast.success('Deleted');
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  const tabs: { key: Tab; label: string }[] = [
    { key:'pending',  label:'Pending'  },
    { key:'approved', label:'Approved' },
    { key:'all',      label:'All'      },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="font-serif text-xl text-primary">Reviews</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 rounded-full text-xs font-medium border transition-all',
              tab===t.key?'bg-primary text-white border-primary':'bg-surface border-border text-muted hover:border-accent')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Reviews */}
      <div className="space-y-3">
        {loading ? [...Array(4)].map((_,i)=><Skeleton key={i} className="h-24 rounded-2xl"/>) :
         reviews.length===0 ? (
          <EmptyState icon={Star} title={tab==='pending'?'No pending reviews':'No reviews found'}
            description={tab==='pending'?'All reviews have been moderated':undefined} />
         ) : reviews.map(r=>(
          <div key={r.id} className={cn('card card-inner', !r.isApproved && 'border-amber-200 bg-amber-50/30')}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary">{r.userName.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm font-medium text-text">{r.userName}</span>
                  {/* Stars */}
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s=>(
                      <Star key={s} size={11} className={s<=r.rating?'fill-amber-400 text-amber-400':'text-border'} />
                    ))}
                  </div>
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border ml-auto',
                    r.isApproved?'bg-green-50 text-green-700 border-green-200':'bg-amber-50 text-amber-700 border-amber-200')}>
                    {r.isApproved?'Approved':'Pending'}
                  </span>
                </div>
                <p className="text-sm text-text leading-relaxed">{r.comment}</p>
                <p className="text-xs text-muted mt-1.5">
                  {r.createdAt ? formatDate(new Date(r.createdAt as unknown as string)) : '—'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
              {!r.isApproved && (
                <button onClick={()=>handleApprove(r.id)} className="btn-primary py-1.5 text-xs">
                  <Check size={13}/> Approve
                </button>
              )}
              <button onClick={()=>handleDelete(r.id)} className="btn-ghost py-1.5 text-xs hover:text-error hover:bg-error/10">
                <Trash2 size={13}/> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
