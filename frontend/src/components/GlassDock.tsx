'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Scan, History, BarChart3, FileSpreadsheet } from 'lucide-react';

const DOCK_ITEMS = [
  { label: 'Overview', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Live Studio', href: '/app/detect', icon: Scan },
  { label: 'History', href: '/app/history', icon: History },
  { label: 'Analytics', href: '/app/analytics', icon: BarChart3 },
  { label: 'Reports', href: '/app/reports', icon: FileSpreadsheet },
];

export default function GlassDock() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed md:absolute bottom-3 sm:bottom-4 inset-x-0 z-40 flex items-center justify-center px-4">
      <nav
        className="pointer-events-auto flex items-center justify-center gap-1.5 p-1.5 rounded-full gw-glass shadow-2xl border border-white/50 dark:border-white/15 backdrop-blur-2xl transition-all w-fit max-w-full overflow-x-auto scrollbar-none mx-auto"
        style={{
          background: 'color-mix(in srgb, var(--gw-surface) calc((0.35 + var(--gw-opacity) * 0.45) * 100%), transparent)',
        }}
        aria-label="Quick dock navigation"
      >
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 mx-auto">
          {DOCK_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 select-none whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-white text-zinc-950 shadow-md ring-1 ring-black/5 dark:ring-white/20'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
