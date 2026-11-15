'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  ShieldAlert,
  ArrowRight,
  Settings2,
  Layers,
} from 'lucide-react';
import { AuthService, AuthSession } from '@/lib/auth';
import { useTheme } from '@/context/ThemeContext';
import { useGlass } from '@/context/GlassContext';
import UserAvatar from '@/components/UserAvatar';
import GlassAdjustPopover from '@/components/GlassAdjustPopover';

interface DashboardHeaderProps {
  onToggleMobileMenu?: () => void;
  title?: string;
  badge?: string;
}

export default function DashboardHeader({
  onToggleMobileMenu,
  title,
  badge,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const watchlistRef = useRef<HTMLDivElement>(null);
  const { theme, isDark, toggleTheme } = useTheme();
  const { toggleSettings, isSettingsOpen, setIsSettingsOpen } = useGlass();

  useEffect(() => {
    setSession(AuthService.getSession());
    const handleAuthChange = () => {
      setSession(AuthService.getSession());
    };
    window.addEventListener('visionplate_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('visionplate_auth_change', handleAuthChange);
    };
  }, []);

  // Keyboard shortcut for global search focus (Ctrl+K, Cmd+F, or /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'f' || e.key === 'F')) ||
        (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close watchlist popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (watchlistRef.current && !watchlistRef.current.contains(e.target as Node)) {
        setIsWatchlistOpen(false);
      }
    };
    if (isWatchlistOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isWatchlistOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/app/history?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const userName = session?.user?.name || 'Chief Operator';
  const userEmail = session?.user?.email || 'operator@visionplate.ai';

  return (
    <header className="sticky top-0 z-30 mb-4 sm:mb-6 rounded-2xl gw-glass border border-white/50 dark:border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sm:gap-4 shadow-lg transition-all duration-300">
      {/* Left Area: Mobile Menu Trigger + Brand & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Mobile Hamburger Menu */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl bg-black/[0.04] dark:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white cursor-pointer"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Label in Header (Liquid Glass Style) */}
        <Link
          href="/app/dashboard"
          className="hidden sm:flex items-center gap-2 text-zinc-900 dark:text-white hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <span className="font-extrabold text-sm tracking-tight">VisionPlate</span>
            <span className="text-[#EA580C] font-mono text-xs font-bold">.ai</span>
          </div>
          <span className="text-zinc-400 dark:text-zinc-500 text-xs mx-1">|</span>
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium hidden md:inline">
            Operational ALPR
          </span>
        </Link>

        {/* Global Search Form with Enter navigation */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[140px]">
          <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plate, jurisdiction..."
            className="w-full pl-9 pr-12 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm bg-white/70 dark:bg-black/30 border border-white/60 dark:border-white/10 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C] dark:focus:ring-[#F59E0B] shadow-xs backdrop-blur-md transition-all"
          />
          <span
            onClick={() => searchInputRef.current?.focus()}
            title="Press Ctrl+K or / to search"
            className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/[0.06] dark:bg-white/10 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          >
            ⌘ K
          </span>
        </form>
      </div>

      {/* Right Area: Adjust Glass Button + Watchlist + Theme Toggle + User Pill */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 relative">
        {/* Adjust Glass Button Trigger with Real-time Sliders Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              toggleSettings();
              setIsWatchlistOpen(false);
            }}
            aria-expanded={isSettingsOpen}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs select-none ${
              isSettingsOpen
                ? 'bg-[#EA580C] text-white border-[#EA580C] ring-2 ring-[#EA580C]/30'
                : 'bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-white/80 dark:hover:bg-white/20 hover:text-black dark:hover:text-white'
            }`}
            title="Adjust Frosted Glass Appearance"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Adjust glass</span>
          </button>
          <GlassAdjustPopover />
        </div>

        {/* Watchlist Alerts Bell & Pop-over Dropdown */}
        <div className="relative" ref={watchlistRef}>
          <button
            onClick={() => {
              setIsWatchlistOpen(!isWatchlistOpen);
              setIsSettingsOpen(false);
            }}
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white shadow-xs transition-transform active:scale-95 cursor-pointer backdrop-blur-md"
            title="Watchlist & Flagged Vehicle Alerts"
            aria-label="Watchlist Alerts"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#EA580C] ring-2 ring-white dark:ring-black animate-pulse" />
          </button>

          {/* Floating Watchlist Dropdown */}
          {isWatchlistOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl gw-glass border border-white/40 dark:border-white/15 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#EA580C]" />
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Corridor Watchlist
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EA580C]/15 text-[#EA580C]">
                  2 Flagged Active
                </span>
              </div>

              <div className="divide-y divide-black/5 dark:divide-white/[0.06] my-2 max-h-64 overflow-y-auto">
                {/* Alert Item 1 */}
                <div className="py-2.5 space-y-1 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-1 rounded-xl transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      MH12AB1234
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">12m ago</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
                    Commercial carrier speeding violation flagged at NH-48 Express Corridor.
                  </p>
                  <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                    <span>Severity: High Alert</span>
                    <span>•</span>
                    <span className="text-amber-600">Camera #04</span>
                  </div>
                </div>

                {/* Alert Item 2 */}
                <div className="py-2.5 space-y-1 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-1 rounded-xl transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      DL3CA9876
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">38m ago</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
                    Suspicious duplicate plate pattern identified on Ring Road Tollway.
                  </p>
                  <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                    <span>Severity: Audit Watch</span>
                    <span>•</span>
                    <span className="text-amber-600">Camera #11</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs">
                <Link
                  href="/app/reports"
                  onClick={() => setIsWatchlistOpen(false)}
                  className="font-bold text-[#EA580C] hover:underline flex items-center gap-1"
                >
                  <span>Open Audit Reports</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsWatchlistOpen(false)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white shadow-xs transition-transform active:scale-95 cursor-pointer backdrop-blur-md"
          title={`Switch to ${isDark ? 'Porcelain Beige' : 'Dark'} Mode`}
          aria-label="Toggle theme mode"
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-[#F59E0B]" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-[#1A1815]" />
          )}
        </button>

        {/* User Profile Pill */}
        <Link
          href="/app/profile"
          className="flex items-center gap-2 pl-1 group"
          title="View profile settings"
        >
          <UserAvatar
            src={session?.user?.avatarUrl}
            name={userName}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full shadow-xs ring-2 ring-white/60 dark:ring-white/20 group-hover:ring-[#EA580C] transition-all"
          />
          <div className="hidden md:block text-left leading-tight">
            <div className="font-bold text-xs text-zinc-900 dark:text-white group-hover:text-[#EA580C] transition-colors truncate max-w-[120px]">
              {userName}
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
              {userEmail}
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
