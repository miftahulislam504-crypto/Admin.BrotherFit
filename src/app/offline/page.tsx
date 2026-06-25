'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 mx-auto mb-6 bg-surface rounded-2xl border border-border flex items-center justify-center shadow-card">
          <svg className="w-10 h-10 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl text-text mb-2">No Connection</h1>
        <p className="text-sm text-muted mb-6">
          Internet connection is unavailable. Please check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

