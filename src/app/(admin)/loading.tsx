import { Skeleton } from '@/components/ui/Spinner';

export default function AdminLoading() {
  return (
    <div className="space-y-4 max-w-6xl">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
