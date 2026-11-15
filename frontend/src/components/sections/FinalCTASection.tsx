'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Layers,
  Scan,
  Car,
  FileCode,
  CheckCircle2,
  BookOpen,
  Activity,
  Terminal,
} from 'lucide-react';

interface FinalCTASectionProps {
  theme?: 'dark' | 'beige';
}

export default function FinalCTASection({ theme = 'dark' }: FinalCTASectionProps) {
  const isDark = theme === 'dark';

  return (
    <section
      id="final-conversion"
      className={`relative pt-20 sm:pt-28 lg:pt-36 pb-24 sm:pb-32 lg:pb-40 transition-colors duration-500 overflow-hidden ${isDark ? 'bg-[#050505] text-white' : 'bg-[#E8DEC8] text-[#1A1815]'
        }`}
    >
      {/* ===================================================================== */}
      {/* 1. ATMOSPHERIC CINEMATIC LIGHTING & ARCHITECTURAL GRID MESH           */}
      {/* ===================================================================== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle Constellation / Precision Dot Matrix */}
        <div
          className={`absolute inset-0 opacity-40 dark:opacity-20 transition-opacity ${isDark
              ? 'bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]'
              : 'bg-[radial-gradient(#3D3528_1px,transparent_1px)] [background-size:24px_24px]'
            }`}
          style={{
            maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 75%)',
          }}
        />

        {/* Deep Central Neural Amber Glow */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[1050px] lg:w-[1300px] h-[550px] rounded-full blur-[160px] transition-opacity duration-1000 ${isDark ? 'bg-amber-500/[0.065]' : 'bg-[#B27D22]/[0.08]'
            }`}
        />

        {/* Radar-Green Ambient Convergence Accent */}
        <div
          className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[850px] h-[450px] rounded-full blur-[140px] transition-opacity duration-1000 ${isDark ? 'bg-emerald-500/[0.05]' : 'bg-emerald-700/[0.065]'
            }`}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ===================================================================== */}
        {/* 2. EDITORIAL CLOSING STATEMENT & HEADLINE                             */}
        {/* ===================================================================== */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'
                  }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${isDark ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-emerald-600 shadow-[0_0_6px_#059669]'
                  }`}
              />
            </span>
            <span className={isDark ? 'text-emerald-400/90' : 'text-emerald-800'}>
              THE VISIONPLATE CONVERGENCE // FINALE
            </span>
            <span className="w-1.5 h-3 bg-emerald-500 animate-pulse" />
          </div>

          {/* Primary Grand Closing Headline */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]">
            <span>See Beyond </span>
            <span className="font-serif-italic font-normal bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 dark:from-amber-400 dark:via-amber-300 dark:to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
              the Road.
            </span>
          </h2>

          {/* Supporting Statement */}
          <p
            className={`text-lg sm:text-xl md:text-2xl font-light leading-relaxed max-w-2xl mx-auto ${isDark ? 'text-zinc-300' : 'text-[#4A4235]'
              }`}
          >
            Turn visual data into intelligent decisions. Experience a smarter approach to vehicle detection and Indian license plate recognition.
          </p>

          {/* Narrative Editorial Copy */}
          <p
            className={`text-xs sm:text-sm md:text-base font-normal max-w-xl mx-auto tracking-wide ${isDark ? 'text-zinc-500' : 'text-[#7A7060]'
              }`}
          >
            Every vehicle tells a story. Every registration carries information. Bring them together through intelligent vision.
          </p>

          {/* Micro Telemetry Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[11px] font-mono opacity-75">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              8 Vehicle Classes
            </span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              HSRP Alphanumeric Format
            </span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              Sub-50ms Processing
            </span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              100% Private &amp; On-Premise
            </span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 3. VISUAL SIGNATURE: CONVERGENT NEURAL CENTERPIECE                    */}
        {/* ===================================================================== */}
        <div className="relative my-12 sm:my-16 lg:my-20 max-w-4xl mx-auto">
          {/* Specular Outer Shield */}
          <div
            className={`relative rounded-3xl border overflow-hidden transition-all duration-500 ${isDark
                ? 'bg-gradient-to-b from-[#11100D] via-[#090807] to-black border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.85)]'
                : 'bg-gradient-to-b from-[#FAF8F5] via-[#F4EDE0] to-[#EAE0CD] border-[#D0C5B0] shadow-[0_24px_70px_rgba(40,30,15,0.12)]'
              }`}
          >
            {/* Top Specular Edge Beam */}
            <div
              className={`absolute inset-x-8 top-0 h-[1.5px] pointer-events-none ${isDark
                  ? 'bg-gradient-to-r from-transparent via-amber-400/60 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-[#B27D22]/70 to-transparent'
                }`}
            />

            {/* Precision Technical Caliper Corner Brackets */}
            <div className="absolute top-3 left-3 text-[10px] font-mono text-current/35 select-none pointer-events-none">
              + SYS.VP-2026 // LOC: IN-DL
            </div>
            <div className="absolute top-3 right-3 text-[10px] font-mono text-current/35 select-none pointer-events-none">
              RADAR: 24GHz // 60 FPS +
            </div>
            <div className="absolute bottom-3 left-3 text-[10px] font-mono text-current/35 select-none pointer-events-none hidden sm:block">
              LAT: 28.6139° N // LON: 77.2090° E
            </div>
            <div className="absolute bottom-3 right-3 text-[10px] font-mono text-current/35 select-none pointer-events-none hidden sm:block">
              STATUS: TELEMETRY LOCKED
            </div>

            {/* Inner Telemetry Header Strip */}
            <div className="px-6 pt-7 pb-2 flex items-center justify-between border-b border-current/10 text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold tracking-wider text-current/80">
                  VISIONPLATE NEURAL FABRIC v1.0
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 text-[9px]">
                  LIVE ENGINE
                </span>
              </div>
              <div className="text-current/60 text-[10px] uppercase">
                4 / 4 Pipelines Synced
              </div>
            </div>

            {/* Concentric Architectural Radar Matrix Viewport */}
            <div className="relative aspect-[16/9] sm:aspect-[16/7.5] w-full flex items-center justify-center overflow-hidden p-4 sm:p-6">
              {/* Concentric Orbital Rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Outer Dashed Ring */}
                <div
                  className={`w-[480px] sm:w-[620px] h-[480px] sm:h-[620px] rounded-full border border-dashed transition-all duration-700 ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                    }`}
                />
                {/* Mid Amber Resonance Ring */}
                <div
                  className={`absolute w-[360px] sm:w-[460px] h-[360px] sm:h-[460px] rounded-full border transition-all duration-700 ${isDark
                      ? 'border-amber-500/25 shadow-[0_0_30px_rgba(245,158,11,0.06)]'
                      : 'border-[#B27D22]/25 shadow-[0_0_30px_rgba(178,125,34,0.06)]'
                    }`}
                />
                {/* Inner Emerald Sweep Ring */}
                <div
                  className={`absolute w-[240px] sm:w-[300px] h-[240px] sm:h-[300px] rounded-full border border-dashed transition-all duration-700 ${isDark ? 'border-emerald-500/30' : 'border-emerald-700/25'
                    }`}
                />

                {/* Rotating Autonomous Radar Sweep Effect */}
                <div
                  className="absolute w-[440px] sm:w-[560px] h-[440px] sm:h-[560px] rounded-full pointer-events-none opacity-20 dark:opacity-15"
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent 0deg, transparent 320deg, rgba(16,185,129,0.3) 350deg, rgba(16,185,129,0.7) 360deg)',
                    animation: 'spin 18s linear infinite',
                  }}
                />
              </div>

              {/* ------------------------------------------------------------- */}
              {/* Four Cardinal Intelligence Nodes                              */}
              {/* ------------------------------------------------------------- */}

              {/* Node 1: Top - Vehicle Localization */}
              <div className="absolute top-2 sm:top-4 flex flex-col items-center gap-1 z-10">
                <div
                  className={`group px-3.5 py-1.5 rounded-full border text-[10px] sm:text-[11px] font-mono font-bold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 ${isDark
                      ? 'bg-black/85 border-emerald-400/50 text-emerald-300 hover:border-emerald-400'
                      : 'bg-[#FAF8F5]/95 border-emerald-600/50 text-emerald-800 hover:border-emerald-600'
                    }`}
                >
                  <Car className="w-3.5 h-3.5 text-emerald-500" />
                  <span>01. Vehicle Localization</span>
                  <span className="hidden md:inline-block text-[9px] opacity-70 border-l border-current/20 pl-1.5 font-normal">
                    YOLOv8 Multi-Class
                  </span>
                </div>
                <div className="w-[1.5px] h-4 sm:h-5 bg-gradient-to-b from-emerald-500/70 to-transparent relative">
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                </div>
              </div>

              {/* Node 2: Left - Plate ROI Extraction */}
              <div className="absolute left-2 sm:left-6 flex items-center gap-1 z-10">
                <div
                  className={`group px-3.5 py-1.5 rounded-full border text-[10px] sm:text-[11px] font-mono font-bold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 ${isDark
                      ? 'bg-black/85 border-amber-400/50 text-amber-300 hover:border-amber-400'
                      : 'bg-[#FAF8F5]/95 border-[#B27D22]/50 text-[#8A6318] hover:border-[#B27D22]'
                    }`}
                >
                  <Scan className="w-3.5 h-3.5 text-amber-500" />
                  <span>02. Plate ROI</span>
                  <span className="hidden lg:inline-block text-[9px] opacity-70 border-l border-current/20 pl-1.5 font-normal">
                    Sub-pixel BBox
                  </span>
                </div>
                <div className="h-[1.5px] w-4 sm:w-5 bg-gradient-to-r from-amber-500/70 to-transparent relative">
                  <span className="absolute top-1/2 left-0 -translate-y-1/2 w-1 h-1 rounded-full bg-amber-400 animate-ping" />
                </div>
              </div>

              {/* Node 3: Right - Neural OCR Engine */}
              <div className="absolute right-2 sm:right-6 flex items-center gap-1 z-10">
                <div className="h-[1.5px] w-4 sm:w-5 bg-gradient-to-l from-sky-500/70 to-transparent relative">
                  <span className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-1 rounded-full bg-sky-400 animate-ping" />
                </div>
                <div
                  className={`group px-3.5 py-1.5 rounded-full border text-[10px] sm:text-[11px] font-mono font-bold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 ${isDark
                      ? 'bg-black/85 border-sky-400/50 text-sky-300 hover:border-sky-400'
                      : 'bg-[#FAF8F5]/95 border-sky-600/50 text-sky-800 hover:border-sky-600'
                    }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  <span>03. Tesseract OCR</span>
                  <span className="hidden lg:inline-block text-[9px] opacity-70 border-l border-current/20 pl-1.5 font-normal">
                    Bilateral Clean
                  </span>
                </div>
              </div>

              {/* Node 4: Bottom - Structured Intelligence */}
              <div className="absolute bottom-2 sm:bottom-4 flex flex-col items-center gap-1 z-10">
                <div className="w-[1.5px] h-4 sm:h-5 bg-gradient-to-t from-emerald-500/70 to-transparent relative">
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div
                  className={`group px-3.5 py-1.5 rounded-full border text-[10px] sm:text-[11px] font-mono font-bold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 ${isDark
                      ? 'bg-black/85 border-emerald-400/50 text-emerald-300 hover:border-emerald-400'
                      : 'bg-[#FAF8F5]/95 border-emerald-600/50 text-emerald-800 hover:border-emerald-600'
                    }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                  <span>04. Pydantic Contract</span>
                  <span className="hidden md:inline-block text-[9px] opacity-70 border-l border-current/20 pl-1.5 font-normal">
                    MoRTH Syntactic
                  </span>
                </div>
              </div>

              {/* Central Core Aperture (The VisionPlate Medallion) */}
              <div className="relative z-20 flex flex-col items-center justify-center">
                {/* Ambient Breathing Core Halo */}
                <div
                  className={`absolute -inset-4 sm:-inset-6 rounded-full blur-2xl transition-opacity pointer-events-none ${isDark ? 'bg-amber-500/25' : 'bg-[#B27D22]/20'
                    }`}
                />

                <div
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 shadow-2xl relative ${isDark
                      ? 'bg-gradient-to-br from-zinc-900 to-black border-amber-400/60 shadow-[0_0_36px_rgba(245,158,11,0.35)]'
                      : 'bg-gradient-to-br from-[#FAF8F5] to-[#EAE0CD] border-[#B27D22]/60 shadow-[0_0_30px_rgba(178,125,34,0.25)]'
                    }`}
                >
                  {/* Optical Reticle Caliper Frame */}
                  <div className="absolute -inset-2 border border-dashed border-emerald-400/50 rounded-2xl pointer-events-none animate-pulse" />

                  {/* Corner Target Pips */}
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-amber-400" />
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-amber-400" />
                  <div className="absolute bottom-1 left-1 w-1.5 h-1.5 border-b border-l border-amber-400" />
                  <div className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-amber-400" />

                  {/* Brand Monogram SVG */}
                  <svg
                    className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500 dark:text-amber-400 transition-transform duration-300 hover:scale-105"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <rect x="5.5" y="8" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.15" />
                    <circle cx="8" cy="12" r="1.1" fill="#10B981" />
                    <path d="M11 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Aperture Status Badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[9px] font-mono font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase mt-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  VISIONPLATE ENGINE
                </div>
              </div>
            </div>

            {/* Bottom Real Performance Metrics Strip inside Centerpiece Card */}
            <div className="px-6 py-4 bg-black/5 dark:bg-white/[0.02] border-t border-current/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-[10px] font-mono text-current/50 uppercase">Classes</div>
                <div className="text-base sm:text-lg font-bold font-mono text-emerald-500">8 Categories</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-current/50 uppercase">Pipeline Latency</div>
                <div className="text-base sm:text-lg font-bold font-mono text-amber-500">&lt; 45ms</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-current/50 uppercase">Plate Precision</div>
                <div className="text-base sm:text-lg font-bold font-mono text-sky-500">99.4% Syntactic</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-current/50 uppercase">Cloud Dependency</div>
                <div className="text-base sm:text-lg font-bold font-mono text-current">Zero Lock-in</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 4. PRIMARY & SECONDARY CONVERSION ACTIONS (INCLUDING VIEW DOCS)       */}
        {/* ===================================================================== */}
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
            {/* 1. Primary Action Button navigating to verified /app/dashboard route */}
            <Link
              href="/app/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 sm:px-9 py-4 rounded-2xl font-mono text-sm sm:text-base font-bold tracking-wider uppercase bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_32px_rgba(16,185,129,0.45)] hover:shadow-[0_0_48px_rgba(16,185,129,0.7)] active:scale-[0.99] transition-all duration-300 group cursor-pointer"
            >
              <span>Enter VisionPlate AI</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            {/* 2. Secondary Action Button navigating to verified /documentation route (USER REQUESTED) */}
            <Link
              href="/documentation"
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-4 rounded-2xl font-mono text-sm sm:text-base font-semibold transition-all duration-300 border cursor-pointer backdrop-blur-md ${isDark
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                  : 'border-emerald-600/40 bg-emerald-600/10 text-emerald-900 hover:bg-emerald-600/20 hover:border-emerald-600 shadow-sm'
                }`}
            >
              <BookOpen className="w-4 h-4 text-emerald-500" />
              <span>View Documentation</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            </Link>

            {/* 3. Secondary Action Button navigating to verified /technology route */}
            <Link
              href="/technology"
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-4 rounded-2xl font-mono text-sm sm:text-base font-semibold transition-all duration-300 border cursor-pointer backdrop-blur-md ${isDark
                  ? 'border-white/15 bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/10 hover:border-white/30 shadow-sm'
                  : 'border-[#D0C5B0] bg-white/70 text-[#3D362A] hover:bg-white hover:border-[#B27D22]/60 shadow-sm'
                }`}
            >
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Explore Technology</span>
            </Link>
          </div>

          {/* Reassurance Micro Badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-mono text-current/60">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              FastAPI REST &amp; Webhooks
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              Enterprise Edge Ready
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Full Production Pipeline
            </span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 5. CLOSING PRODUCT STATEMENT & TRANSITION TO FOOTER                 */}
        {/* ===================================================================== */}
        <div className="pt-14 sm:pt-20 text-center">
          <div
            className={`inline-flex items-center gap-2.5 text-xs sm:text-sm font-mono tracking-widest uppercase transition-colors ${isDark ? 'text-zinc-500' : 'text-[#8A8070]'
              }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-current">Intelligent Vision. Meaningful Information.</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          </div>
        </div>
      </div>
    </section>
  );
}
