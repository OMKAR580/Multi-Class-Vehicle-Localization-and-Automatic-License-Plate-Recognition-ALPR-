'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Scan,
  History,
  BarChart3,
  FileSpreadsheet,
  LogOut,
  Smartphone,
  ArrowUpRight,
  Shield,
  X,
  Layers,
} from 'lucide-react';
import { AuthService, AuthSession } from '@/lib/auth';

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Live AI Studio', href: '/app/detect', icon: Scan, badge: 'Live' },
  { label: 'Detection History', href: '/app/history', icon: History },
  { label: 'Traffic Analytics', href: '/app/analytics', icon: BarChart3 },
  { label: 'Audit Reports', href: '/app/reports', icon: FileSpreadsheet },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  isOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let active = AuthService.getSession();
    if (!active) {
      active = AuthService.initGuestSession();
    }
    setSession(active);

    const handleAuthChange = () => {
      setSession(AuthService.getSession());
    };
    window.addEventListener('visionplate_auth_change', handleAuthChange);
    return () => window.removeEventListener('visionplate_auth_change', handleAuthChange);
  }, []);

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    await AuthService.logout();
    window.location.href = '/';
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Shell - Floating Glass Rail */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col justify-between transition-all duration-300 md:my-0 md:rounded-3xl gw-glass border border-white/50 dark:border-white/10 text-zinc-900 dark:text-zinc-100 shadow-2xl backdrop-blur-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'w-18 p-3' : 'w-64 p-5'}`}
        style={{
          background: 'color-mix(in srgb, var(--gw-surface) calc((0.32 + var(--gw-opacity) * 0.45) * 100%), transparent)',
        }}
      >
        <div>
          {/* Brand Header */}
          <div
            className={`flex items-center ${
              collapsed ? 'flex-col gap-2 justify-center' : 'justify-between'
            } mb-6`}
          >
            <Link
              href="/app/dashboard"
              onClick={handleNavClick}
              className={`flex items-center gap-2.5 py-1.5 group ${
                collapsed ? 'justify-center w-full px-0' : 'px-1'
              }`}
            >
              <div className="w-9 h-9 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              {!collapsed && (
                <div className="flex items-baseline gap-1">
                  <span className="font-extrabold text-base tracking-tight font-sans text-zinc-900 dark:text-white">
                    VisionPlate
                  </span>
                  <span className="text-xs font-mono font-bold text-[#EA580C]">.ai</span>
                </div>
              )}
            </Link>

            {/* Desktop Collapse Rail Toggle (Three Arrows) */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden md:flex p-1.5 rounded-xl text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all items-center justify-center cursor-pointer"
              >
                {collapsed ? (
                  /* 3 Arrows Pointing Right (Expand) */
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 18L11 12L5 6" />
                    <path d="M11 18L17 12L11 6" />
                    <path d="M17 18L23 12L17 6" />
                  </svg>
                ) : (
                  /* 3 Arrows Pointing Left (Collapse) */
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 18L13 12L19 6" />
                    <path d="M13 18L7 12L13 6" />
                    <path d="M7 18L1 12L7 6" />
                  </svg>
                )}
              </button>
            )}

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Operations Menu */}
          <div className="mb-6">
            {!collapsed && (
              <div className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 px-3 mb-2 font-mono">
                Operations Menu
              </div>
            )}
            <nav className="space-y-1.5">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={handleNavClick}
                    className={`relative flex items-center ${
                      collapsed ? 'justify-center w-11 h-11 mx-auto rounded-full' : 'justify-between px-3.5 py-2.5 rounded-2xl'
                    } text-xs font-semibold transition-all duration-200 group select-none ${
                      isActive
                        ? 'bg-white dark:bg-white text-zinc-950 shadow-md ring-1 ring-black/5 dark:ring-white/20'
                        : 'text-zinc-700 hover:text-black hover:bg-white/50 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10'
                    }`}
                  >
                    <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          isActive
                            ? 'text-[#EA580C]'
                            : 'text-zinc-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white'
                        }`}
                      />
                      {!collapsed && <span>{item.label}</span>}
                    </div>

                    {!collapsed && item.badge && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          isActive
                            ? 'bg-[#EA580C] text-white'
                            : item.badge === 'Live'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                            : 'bg-black/[0.06] text-zinc-700 dark:bg-white/10 dark:text-zinc-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {collapsed && item.badge === 'Live' && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
                    )}

                    {/* Collapsed Mode Floating Tooltip */}
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 shadow-xl border border-white/10 dark:border-black/10 flex items-center gap-2 translate-x-1 group-hover:translate-x-0">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EA580C] text-white">
                            {item.badge}
                          </span>
                        )}
                        <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-zinc-900 dark:bg-white" />
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section: Sign Out & APK Utility Link */}
        <div className="space-y-1.5 pt-3 border-t border-black/10 dark:border-white/[0.08]">
          {/* Sign Out Action - Placed Just Above Android Scanner APK */}
          <button
            onClick={handleLogout}
            className={`relative w-full flex items-center ${
              collapsed ? 'justify-center w-11 h-11 mx-auto rounded-full' : 'gap-3 px-3 py-2 rounded-xl'
            } text-xs font-semibold text-zinc-700 hover:text-rose-600 hover:bg-rose-50/70 dark:text-zinc-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors text-left cursor-pointer group`}
          >
            <LogOut className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-rose-500 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}

            {/* Collapsed Mode Floating Tooltip */}
            {collapsed && (
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 shadow-xl flex items-center gap-1.5 translate-x-1 group-hover:translate-x-0">
                <span>Sign Out</span>
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-rose-600" />
              </div>
            )}
          </button>

          {/* Subtle APK Utility Link */}
          <Link
            href="/download"
            onClick={handleNavClick}
            className={`relative flex items-center ${
              collapsed ? 'justify-center w-11 h-11 mx-auto rounded-full' : 'justify-between px-3 py-2 rounded-xl'
            } text-xs text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 transition-colors group`}
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#EA580C] flex-shrink-0" />
              {!collapsed && <span className="font-semibold text-[11px]">Android Scanner APK</span>}
            </div>
            {!collapsed && (
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors" />
            )}

            {/* Collapsed Mode Floating Tooltip */}
            {collapsed && (
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 shadow-xl border border-white/10 dark:border-black/10 flex items-center gap-1.5 translate-x-1 group-hover:translate-x-0">
                <span>Android Scanner APK</span>
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-zinc-900 dark:bg-white" />
              </div>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}
