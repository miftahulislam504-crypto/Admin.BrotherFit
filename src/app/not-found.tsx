import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
      <h1 className="font-serif text-6xl text-primary">404</h1>
      <p className="font-serif text-xl text-text mt-2">Page not found</p>
      <Link href="/dashboard" className="btn-primary mt-6">Back to Dashboard</Link>
    </div>
  );
}
