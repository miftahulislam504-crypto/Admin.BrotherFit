import { cn } from '@/lib/utils';

// ── Spinner ───────────────────────────────────────────────

export function Spinner({ size = 'md', className }: { size?: 'sm'|'md'|'lg'; className?: string }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return <div className={cn('border-2 border-border border-t-accent rounded-full animate-spin', s[size], className)} />;
}

// ── Badge ─────────────────────────────────────────────────

export function Badge({
  children, variant = 'default', className,
}: {
  children: React.ReactNode;
  variant?: 'default'|'success'|'warning'|'error'|'info';
  className?: string;
}) {
  const v = {
    default: 'bg-border text-muted',
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    error:   'bg-red-50   text-red-700   border border-red-200',
    info:    'bg-blue-50  text-blue-700  border border-blue-200',
  };
  return (
    <span className={cn('badge', v[variant], className)}>{children}</span>
  );
}

// ── Skeleton ──────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

// ── Empty state ───────────────────────────────────────────

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-bg flex items-center justify-center mb-3 border border-border">
        <Icon size={24} className="text-muted" />
      </div>
      <p className="font-serif text-lg text-primary">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
