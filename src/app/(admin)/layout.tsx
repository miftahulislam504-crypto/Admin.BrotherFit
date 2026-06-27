'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/products':    'Products',
  '/inventory':   'Inventory',
  '/orders':      'Orders',
  '/customers':   'Customers',
  '/categories':  'Categories',
  '/coupons':     'Coupons',
  '/flash-sales': 'Flash Sales',
  '/banners':     'Banners',
  '/reviews':     'Reviews',
  '/reports':     'Reports',
  '/inbox':       'Inbox',
  '/automation':  'Automation',
  '/broadcast':        'Broadcast',
  '/automation/abandoned-cart': 'Abandoned Cart',
  '/settings':    'Settings',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  // Also handle nested routes like /automation/builder
  const title =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1]
    ?? 'Admin';

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Content shifts right on desktop */}
      <div className="md:ml-sidebar flex flex-col min-h-screen">
        <TopBar title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
