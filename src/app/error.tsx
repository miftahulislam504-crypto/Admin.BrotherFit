'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Admin panel error:', error); }, [error]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-error" />
      </div>
      <h1 className="font-serif text-2xl text-primary">Something went wrong</h1>
      <p className="text-sm text-muted mt-2 max-w-xs">
        An unexpected error occurred in the admin panel.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <p className="text-xs font-mono text-error/70 mt-3 bg-error/5 px-3 py-2 rounded-lg max-w-md break-all">
          {error.message}
        </p>
      )}
      <button onClick={reset} className="btn-primary mt-6">Try Again</button>
    </div>
  );
}
