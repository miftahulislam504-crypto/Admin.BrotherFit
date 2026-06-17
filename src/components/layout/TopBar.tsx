'use client';

import { Menu, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface TopBarProps {
  title: string;
  onMenuClick: () => void;
}

export default function TopBar({ title, onMenuClick }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 sticky top-0 z-30">
      {/* Hamburger (mobile only) */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 text-muted hover:text-text transition-colors rounded-lg"
      >
        <Menu size={20} />
      </button>

      {/* Title */}
      <h1 className="font-serif text-lg text-primary md:text-xl">
        {title}
      </h1>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-muted hover:text-text transition-colors rounded-xl hover:bg-bg">
          <Bell size={18} />
          {/* Unread dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-xs font-semibold text-white">
            {user?.displayName?.charAt(0)?.toUpperCase() ?? 'A'}
          </span>
        </div>
      </div>
    </header>
  );
}
