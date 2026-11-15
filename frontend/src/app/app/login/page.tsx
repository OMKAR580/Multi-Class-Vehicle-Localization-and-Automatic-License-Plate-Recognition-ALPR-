'use client';

import React, { useState, useEffect } from 'react';
import SignUpComponent from '@/components/ui/sign-up';

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'beige'>('dark');

  useEffect(() => {
    // Read theme synchronously before first paint to avoid flash
    try {
      const saved = localStorage.getItem('visionplate-theme');
      const isBeige =
        saved === 'beige' ||
        saved === 'light' ||
        document.documentElement.classList.contains('beige') ||
        document.documentElement.classList.contains('light');
      const activeTheme: 'dark' | 'beige' = isBeige ? 'beige' : 'dark';
      setTheme(activeTheme);
      if (activeTheme === 'beige') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('beige', 'light');
      } else {
        document.documentElement.classList.remove('beige', 'light');
        document.documentElement.classList.add('dark');
      }
    } catch {
      setTheme('dark');
    }
    setMounted(true);

    const syncTheme = () => {
      try {
        const saved = localStorage.getItem('visionplate-theme');
        const isBeige =
          saved === 'beige' ||
          saved === 'light' ||
          document.documentElement.classList.contains('beige') ||
          document.documentElement.classList.contains('light');
        const activeTheme: 'dark' | 'beige' = isBeige ? 'beige' : 'dark';
        setTheme(activeTheme);
        if (activeTheme === 'beige') {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('beige', 'light');
        } else {
          document.documentElement.classList.remove('beige', 'light');
          document.documentElement.classList.add('dark');
        }
      } catch {
        setTheme('dark');
      }
    };

    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  const toggleTheme = () => {
    const next: 'dark' | 'beige' = theme === 'dark' ? 'beige' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('visionplate-theme', next);
    } catch {}
    if (next === 'beige') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('beige', 'light');
    } else {
      document.documentElement.classList.remove('beige', 'light');
      document.documentElement.classList.add('dark');
    }
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div suppressHydrationWarning className="min-h-screen w-screen">
      {mounted && (
        <SignUpComponent
          theme={theme}
          onToggleTheme={toggleTheme}
          brandName="VisionPlate AI"
          defaultMode="signin"
          onSuccessRedirect="/app/dashboard"
        />
      )}
    </div>
  );
}
