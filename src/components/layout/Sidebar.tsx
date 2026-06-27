'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingBag, Users,
  Tag, Image, Star, Settings, LogOut, Layers,
  Percent, X, Boxes, Zap, FileBarChart,
  MessageCircle, Radio, Bot,
} from 'lucide-react';
import { adminLogout } from '@/lib/firebase/helpers';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/products',    label: 'Products',    icon: Package           },
  { href: '/inventory',   label: 'Inventory',   icon: Boxes             },
  { href: '/orders',      label: 'Orders',      icon: ShoppingBag       },
  { href: '/customers',   label: 'Customers',   icon: Users             },
  { href: '/categories',  label: 'Categories',  icon: Layers            },
  { href: '/coupons',     label: 'Coupons',     icon: Percent           },
  { href: '/flash-sales', label: 'Flash Sales', icon: Zap               },
  { href: '/banners',     label: 'Banners',     icon: Image             },
  { href: '/reviews',     label: 'Reviews',     icon: Star              },
  { href: '/reports',     label: 'Reports',     icon: FileBarChart      },
];

// Automation section — separate group
const AUTO_NAV = [
  { href: '/inbox',       label: 'Inbox',       icon: MessageCircle },
  { href: '/automation',  label: 'Automation',  icon: Bot           },
  { href: '/broadcast',      label: 'Broadcast',      icon: Radio         },
  { href: '/automation/abandoned-cart', label: 'Abandoned Cart', icon: ShoppingCart  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  const handleLogout = async () => {
    await adminLogout();
    toast.success('Signed out');
    router.replace('/login');
  };

  const NavItem = ({ href, label, icon: Icon }: typeof NAV[0]) => {
    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    return (
      <Link
        href={href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
          active
            ? 'bg-white/15 text-white'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon size={17} />
        {label}
      </Link>
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        <div>
          <span className="font-serif text-lg text-white">FashionOS</span>
          <span className="ml-2 text-[10px] font-medium bg-accent/20 text-accent px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/50 hover:text-white md:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {NAV.map(item => <NavItem key={item.href} {...item} />)}
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Automation
          </p>
          <div className="space-y-0.5">
            {AUTO_NAV.map(item => <NavItem key={item.href} {...item} />)}
          </div>
        </div>
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <Link
          href="/settings"
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            pathname === '/settings'
              ? 'bg-white/15 text-white'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          )}
        >
          <Settings size={17} />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-white/60 hover:bg-red-500/20 hover:text-red-300 transition-all"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-sidebar bg-sidebar z-40">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onClose}
          />
          <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar z-50 flex flex-col md:hidden animate-slide-up">
            {content}
          </aside>
        </>
      )}
    </>
  );
}
