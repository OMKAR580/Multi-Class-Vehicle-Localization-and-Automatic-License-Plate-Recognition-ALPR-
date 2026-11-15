'use client';

import React, { useState, useEffect, CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import GlassDock from '@/components/GlassDock';
import { AuthService } from '@/lib/auth';
import { useGlass } from '@/context/GlassContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const { glass } = useGlass();

  useEffect(() => {
    // Synchronize session on initial mount for authenticated dashboard routes only.
    if (pathname !== '/app/login') {
      const lastSync = sessionStorage.getItem('vp_last_sync');
      const now = Date.now();
      if (!lastSync || now - parseInt(lastSync, 10) > 60_000) {
        sessionStorage.setItem('vp_last_sync', String(now));
        AuthService.syncSession();
      }
    }
  }, [pathname]);

  // Exclude login page from shared dashboard layout
  if (pathname === '/app/login') {
    return <>{children}</>;
  }

  // Dynamic CSS variables from real-time glass settings
  const dynamicGlassStyle: CSSProperties = {
    '--gw-blur': `${glass.blur}px`,
    '--gw-opacity': glass.opacity,
    '--gw-saturation': glass.saturation,
    '--gw-edge': glass.edge,
    '--gw-tint': glass.tint,
  } as CSSProperties;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden flex flex-col p-2.5 sm:p-5 select-text transition-colors duration-300 bg-[#E8DEC8] dark:bg-black"
      style={dynamicGlassStyle}
    >
      {/* Ambient Room Backdrop - High-res warm architectural photography */}
      {!bgFailed && (
        <img
          src="https://cdn.21st.dev/assets/mirror/4a/4a0ed73b8ab76bd427aa70ab124329127f3df27cc7f31223a832ed7d28b3dda4.jpg"
          alt=""
          className="fixed inset-0 w-full h-full object-cover object-center pointer-events-none -z-20 transition-opacity duration-700 dark:hidden"
          onError={() => setBgFailed(true)}
        />
      )}

      {/* Ambient Room Shade Overlay - Luxury Frosted Tint */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 transition-colors duration-500 bg-[#E8DEC8]/40 dark:bg-black"
        style={{
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
        aria-hidden="true"
      />

      {/* Floating Layout Shell */}
      <div className="relative z-10 flex h-full w-full max-w-[1720px] mx-auto gap-3 sm:gap-4 overflow-hidden">
        {/* Floating Glass Sidebar / Rail */}
        <Sidebar
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          collapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        {/* Main Content Stage */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          {/* Floating Glass Topbar */}
          <DashboardHeader onToggleMobileMenu={() => setIsMobileOpen(!isMobileOpen)} />

          {/* Main Frosted Glass Viewport */}
          <main
            className="flex-1 min-w-0 rounded-[24px] sm:rounded-[32px] gw-glass border border-white/60 dark:border-white/10 shadow-2xl p-4 sm:p-7 overflow-y-auto relative pb-24 transition-all duration-300"
            style={{
              background: 'color-mix(in srgb, var(--gw-surface) calc((0.26 + var(--gw-opacity) * 0.45) * 100%), transparent)',
            }}
          >
            {children}
          </main>

          {/* Floating Glass Bottom Navigation Dock - Centered inside workspace */}
          <GlassDock />
        </div>
      </div>
    </div>
  );
}
