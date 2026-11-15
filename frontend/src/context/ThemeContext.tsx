'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'visionplate-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  const applyThemeToDOM = useCallback((t: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.remove('beige', 'light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('beige', 'light');
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const isBeige =
        saved === 'beige' ||
        saved === 'light' ||
        document.documentElement.classList.contains('beige') ||
        document.documentElement.classList.contains('light');
      const initial: Theme = isBeige ? 'light' : 'dark';
      setThemeState(initial);
      applyThemeToDOM(initial);
    } catch {
      applyThemeToDOM('dark');
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const nextTheme: Theme = e.newValue === 'beige' || e.newValue === 'light' ? 'light' : 'dark';
        setThemeState(nextTheme);
        applyThemeToDOM(nextTheme);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [applyThemeToDOM]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      applyThemeToDOM(newTheme);
      const storageValue = newTheme === 'light' ? 'beige' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, storageValue);
      } catch {}
      try {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: storageValue,
          })
        );
      } catch {
        window.dispatchEvent(new Event('storage'));
      }
    },
    [applyThemeToDOM]
  );

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme,
      setTheme,
      mounted,
    }),
    [theme, toggleTheme, setTheme, mounted]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

