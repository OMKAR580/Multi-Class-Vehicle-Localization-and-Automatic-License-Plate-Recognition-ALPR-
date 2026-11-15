'use client';

import React, { useRef, useEffect } from 'react';
import { Settings2, X, RotateCcw, Sparkles } from 'lucide-react';
import { useGlass, GlassSettings } from '@/context/GlassContext';

const PRESETS: { name: string; value: GlassSettings }[] = [
  {
    name: 'Clear',
    value: { blur: 10, opacity: 0.16, saturation: 1.1, edge: 0.85, tint: '#ffffff' },
  },
  {
    name: 'Frosted',
    value: { blur: 22, opacity: 0.35, saturation: 1.25, edge: 0.65, tint: '#ffffff' },
  },
  {
    name: 'Solid',
    value: { blur: 34, opacity: 0.82, saturation: 1.05, edge: 0.4, tint: '#ffffff' },
  },
];

export default function GlassAdjustPopover() {
  const { glass, updateGlass, resetGlass, isSettingsOpen, setIsSettingsOpen } = useGlass();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen, setIsSettingsOpen]);

  if (!isSettingsOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-3 w-80 sm:w-88 rounded-2xl gw-glass p-5 z-50 shadow-2xl border border-white/30 dark:border-white/15 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-2xl text-zinc-900 dark:text-zinc-100"
      style={{
        background: 'color-mix(in srgb, var(--gw-surface) calc((0.35 + var(--gw-opacity) * 0.5) * 100%), transparent)',
      }}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EA580C]/15 dark:bg-[#F59E0B]/20 text-[#EA580C] dark:text-[#F59E0B] flex items-center justify-center">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider">Glass Appearance</h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Live adjustable frosted material</p>
          </div>
        </div>
        <button
          onClick={() => setIsSettingsOpen(false)}
          className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Close settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="mt-3.5 mb-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#EA580C]" />
          <span>Material Presets</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => updateGlass(preset.value)}
              className="py-1.5 px-2 rounded-xl text-xs font-semibold bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 border border-black/5 dark:border-white/10 shadow-xs hover:border-[#EA580C] transition-all cursor-pointer"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Sliders */}
      <div className="space-y-3.5 text-xs">
        {/* Blur */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
            <span>Blur Radius</span>
            <span className="font-mono text-[10px] text-zinc-500">{Math.round(glass.blur)}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={glass.blur}
            onChange={(e) => updateGlass({ blur: Number(e.target.value) })}
            className="w-full h-1.5 bg-black/10 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#EA580C]"
          />
        </div>

        {/* Opacity */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
            <span>Glass Opacity</span>
            <span className="font-mono text-[10px] text-zinc-500">{Math.round(glass.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.08}
            max={0.9}
            step={0.01}
            value={glass.opacity}
            onChange={(e) => updateGlass({ opacity: Number(e.target.value) })}
            className="w-full h-1.5 bg-black/10 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#EA580C]"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
            <span>Vibrancy Saturation</span>
            <span className="font-mono text-[10px] text-zinc-500">{Math.round(glass.saturation * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={glass.saturation}
            onChange={(e) => updateGlass({ saturation: Number(e.target.value) })}
            className="w-full h-1.5 bg-black/10 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#EA580C]"
          />
        </div>

        {/* Edge Light */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
            <span>Edge Highlight</span>
            <span className="font-mono text-[10px] text-zinc-500">{Math.round(glass.edge * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={glass.edge}
            onChange={(e) => updateGlass({ edge: Number(e.target.value) })}
            className="w-full h-1.5 bg-black/10 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#EA580C]"
          />
        </div>

        {/* Tint Color Picker */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Glass Tint Shade</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-500 uppercase">{glass.tint}</span>
            <input
              type="color"
              value={glass.tint}
              onChange={(e) => updateGlass({ tint: e.target.value })}
              className="w-7 h-7 rounded-lg border border-black/15 dark:border-white/20 cursor-pointer bg-transparent p-0"
            />
          </div>
        </div>
      </div>

      {/* Footer Reset Action */}
      <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
        <button
          type="button"
          onClick={resetGlass}
          className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Defaults</span>
        </button>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(false)}
          className="px-3 py-1 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-bold shadow-sm transition-colors cursor-pointer"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

