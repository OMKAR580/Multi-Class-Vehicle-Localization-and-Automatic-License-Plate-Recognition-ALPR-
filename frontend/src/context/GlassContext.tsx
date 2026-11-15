'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

export interface GlassSettings {
  blur: number;
  opacity: number;
  saturation: number;
  edge: number;
  tint: string;
}

export interface GlassContextType {
  glass: GlassSettings;
  updateGlass: (patch: Partial<GlassSettings>) => void;
  resetGlass: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
}

const DEFAULT_GLASS: GlassSettings = {
  blur: 22,
  opacity: 0.3,
  saturation: 1.2,
  edge: 0.6,
  tint: '#ffffff',
};

const STORAGE_KEY = 'visionplate-glass-settings';

const GlassContext = createContext<GlassContextType | undefined>(undefined);

export function GlassProvider({ children }: { children: React.ReactNode }) {
  const [glass, setGlassState] = useState<GlassSettings>(DEFAULT_GLASS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setGlassState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  const updateGlass = useCallback((patch: Partial<GlassSettings>) => {
    setGlassState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const resetGlass = useCallback(() => {
    setGlassState(DEFAULT_GLASS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const toggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      glass,
      updateGlass,
      resetGlass,
      isSettingsOpen,
      setIsSettingsOpen,
      toggleSettings,
    }),
    [glass, updateGlass, resetGlass, isSettingsOpen, toggleSettings]
  );

  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

export function useGlass() {
  const context = useContext(GlassContext);
  if (!context) {
    throw new Error('useGlass must be used within a GlassProvider');
  }
  return context;
}

