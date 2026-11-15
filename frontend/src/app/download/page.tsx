'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Smartphone, Download, CheckCircle2, Sparkles } from 'lucide-react';
import AndroidComingSoonModal from '@/components/AndroidComingSoonModal';

export default function DownloadPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#E8DEC8] text-[#1A1815] dark:bg-[#000000] dark:text-white transition-colors duration-300">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 sm:py-20 text-center flex flex-col items-center justify-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EA580C]/10 text-[#EA580C] text-xs font-mono font-bold uppercase tracking-wider mb-4 border border-[#EA580C]/20">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Mobile Field Deployment</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-5xl font-black text-[#1A1815] dark:text-white tracking-tight mb-4">
          Download Android Mobile App
        </h1>
        <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 max-w-xl mx-auto mb-10">
          Access high-speed vehicle localization and license plate recognition in real-time on the field using our dedicated Android application.
        </p>

        {/* Main APK Card */}
        <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl gw-panel border border-white/60 dark:border-white/10 shadow-2xl backdrop-blur-2xl text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-[#EA580C]/15 dark:bg-[#EA580C]/20 text-[#EA580C] border border-[#EA580C]/30 mx-auto flex items-center justify-center text-3xl font-black shadow-inner">
            <Smartphone className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1A1815] dark:text-white">
              VisionPlate Scanner APK
            </h2>
            <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 mt-1">
              v1.0.0-beta &bull; Android 8.0+ (API 26+) &bull; Native Jetpack Compose
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left text-xs font-mono p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>CameraX 60 FPS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Offline Cache</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Instant OCR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Direct Sync</span>
            </div>
          </div>

          {/* Interactive Download Button triggering Coming Soon Modal */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2 group"
          >
            <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            <span>Download Android APK</span>
          </button>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Clicking download will trigger the latest APK package installer.
          </p>
        </div>
      </main>
      <Footer />

      {/* Coming Soon Pop-up Dialog */}
      <AndroidComingSoonModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
