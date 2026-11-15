'use client';

import React from 'react';
import { Smartphone, X, Sparkles, CheckCircle2, Bell, ArrowRight } from 'lucide-react';

interface AndroidComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AndroidComingSoonModal({ isOpen, onClose }: AndroidComingSoonModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl gw-panel border border-white/50 dark:border-white/15 shadow-2xl backdrop-blur-2xl text-zinc-900 dark:text-zinc-100 animate-in zoom-in-95 duration-200 text-center"
        style={{
          background: 'color-mix(in srgb, var(--gw-surface) calc((0.4 + var(--gw-opacity) * 0.5) * 100%), transparent)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Floating App Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-[#EA580C]/15 dark:bg-[#EA580C]/20 text-[#EA580C] border border-[#EA580C]/30 mx-auto flex items-center justify-center shadow-inner mb-4">
          <Smartphone className="w-8 h-8" />
        </div>

        {/* Heading */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EA580C]/10 text-[#EA580C] text-[10px] font-mono font-bold uppercase tracking-wider mb-2 border border-[#EA580C]/20">
          <Sparkles className="w-3 h-3" />
          <span>Under Active Development</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-[#1A1815] dark:text-white tracking-tight">
          Android App Coming Soon
        </h3>

        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-2 leading-relaxed">
          The VisionPlate Native Android ALPR application is currently under final testing. Experience high-speed field verification, continuous optical recognition, and automatic cloud synchronization.
        </p>

        {/* Highlighted Mobile Features */}
        <div className="my-5 grid grid-cols-2 gap-2 text-left text-xs font-mono p-3 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 text-zinc-700 dark:text-zinc-300">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">CameraX 60 FPS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Instant HSRP OCR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Offline Queue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">FastAPI Cloud Sync</span>
          </div>
        </div>

        {/* Dismiss CTA */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-5 rounded-2xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Understood, Got It</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-3 font-mono">
          Target APK Release: v1.0.0 &bull; Stay tuned for deployment updates!
        </p>
      </div>
    </div>
  );
}

