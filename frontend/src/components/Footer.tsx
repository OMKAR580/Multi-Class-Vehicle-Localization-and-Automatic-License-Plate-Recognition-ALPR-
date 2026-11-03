'use client';

import React from 'react';
import Link from 'next/link';
import {
  Scan,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowUpRight,
  ExternalLink,
  Activity,
  Github,
} from 'lucide-react';

interface FooterProps {
  theme?: 'dark' | 'beige' | 'light';
}

export default function Footer({ theme = 'dark' }: FooterProps) {
  const isDark = theme === 'dark';

  return (
    <footer className={`w-full border-t relative z-20 transition-colors duration-300 ${
      isDark
        ? 'border-white/[0.08] bg-black/95 text-white'
        : 'border-[#C7BBA5] bg-[#DDD1BE] text-[#1A1815]'
    }`}>
      {/* ===================================================================== */}
      {/* MAIN MULTI-COLUMN NAVIGATION & ARCHITECTURE */}
      {/* ===================================================================== */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand & Mission Column */}
          <div className="lg:col-span-5 flex flex-col items-start pr-0 lg:pr-6">
            {/* Logo */}
            <Link
              href="/"
              className={`inline-flex items-center gap-2.5 font-semibold text-[16px] tracking-[-0.03em] group mb-4 transition-colors ${
                isDark ? 'text-white' : 'text-[#1A1815]'
              }`}
              aria-label="VisionPlate.ai"
            >
              <svg
                className={`w-5 h-5 transition-transform group-hover:scale-105 ${
                  isDark ? 'text-white' : 'text-[#1A1815]'
                }`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <g transform="rotate(-30 12 12)">
                  <circle cx="7.3" cy="3.2" r="1.45" />
                  <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
                  <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
                  <circle cx="16.7" cy="20.8" r="1.45" />
                </g>
              </svg>
              <span className="font-semibold tracking-tight">
                VisionPlate<span className={isDark ? 'text-[#9a9a9a] font-normal' : 'text-[#7A7264] font-normal'}>.ai</span>
              </span>
            </Link>

            <p className={`text-[13.5px] leading-[1.65] mb-6 max-w-sm transition-colors ${
              isDark ? 'text-[#9a9a9a]' : 'text-[#5A5245]'
            }`}>
              Operational computer vision infrastructure purpose-built for Indian roadway localization,
              dual-line license plate extraction, and high-speed electronic tolling automation.
            </p>

            {/* Live Operational Health Status Pill */}
            <div className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
              isDark
                ? 'bg-[#141412] border border-white/[0.12] text-[#FAF8F5]'
                : 'bg-[#FAF8F5] border border-[#D5CEBF] text-[#1A1815]'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>INFERENCE ENGINE ONLINE</span>
              <span className={isDark ? 'text-white/20' : 'text-[#C5BDAF]'}>•</span>
              <span className={isDark ? 'text-[#E5C378]' : 'text-emerald-800 font-semibold'}>FASTAG G-04</span>
            </div>
          </div>

          {/* Column 2: Platform */}
          <div className="lg:col-span-2">
            <h4 className={`text-[12px] font-mono uppercase tracking-wider mb-4 font-semibold transition-colors ${
              isDark ? 'text-[#D3C9B8]' : 'text-[#1A1815]'
            }`}>
              Platform
            </h4>
            <ul className={`space-y-2.5 text-[13px] ${isDark ? 'text-[#9a9a9a]' : 'text-[#5A5245]'}`}>
              <li>
                <Link href="/app/detect" className={isDark ? 'hover:text-white transition-colors flex items-center gap-1' : 'hover:text-[#1A1815] transition-colors flex items-center gap-1'}>
                  <span>Live Camera HUD</span>
                </Link>
              </li>
              <li>
                <Link href="/app/dashboard" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  Telemetry Studio
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  Pipeline Architecture
                </Link>
              </li>
              <li>
                <Link href="/download" className={isDark ? 'hover:text-white transition-colors flex items-center gap-1.5' : 'hover:text-[#1A1815] transition-colors flex items-center gap-1.5'}>
                  <span>Android Native APK</span>
                  <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${isDark ? 'bg-white/[0.1] text-white' : 'bg-[#E5DFD3] text-[#1A1815]'}`}>v1.0</span>
                </Link>
              </li>
              <li>
                <Link href="/app/login" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  Command Access
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: AI Subsystem */}
          <div className="lg:col-span-2">
            <h4 className={`text-[12px] font-mono uppercase tracking-wider mb-4 font-semibold transition-colors ${
              isDark ? 'text-[#D3C9B8]' : 'text-[#1A1815]'
            }`}>
              AI Subsystem
            </h4>
            <ul className={`space-y-2.5 text-[13px] ${isDark ? 'text-[#9a9a9a]' : 'text-[#5A5245]'}`}>
              <li>
                <Link href="/model" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  YOLOv8 Localization
                </Link>
              </li>
              <li>
                <Link href="/model" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  Plate ROI Micro-Model
                </Link>
              </li>
              <li>
                <Link href="/technology" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  CLAHE & Deskewing
                </Link>
              </li>
              <li>
                <Link href="/technology" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  PaddleOCR Engine
                </Link>
              </li>
              <li>
                <Link href="/technology" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  28 Indian RTO Regex
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Infrastructure & Docs */}
          <div className="lg:col-span-3">
            <h4 className={`text-[12px] font-mono uppercase tracking-wider mb-4 font-semibold transition-colors ${
              isDark ? 'text-[#D3C9B8]' : 'text-[#1A1815]'
            }`}>
              Infrastructure
            </h4>
            <ul className={`space-y-2.5 text-[13px] ${isDark ? 'text-[#9a9a9a]' : 'text-[#5A5245]'}`}>
              <li>
                <a
                  href="http://127.0.0.1:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className={isDark ? 'hover:text-white transition-colors inline-flex items-center gap-1.5' : 'hover:text-[#1A1815] transition-colors inline-flex items-center gap-1.5'}
                >
                  <span>FastAPI Swagger UI</span>
                  <ArrowUpRight className={`w-3.5 h-3.5 ${isDark ? 'text-[#D3C9B8]' : 'text-[#7A7264]'}`} />
                </a>
              </li>
              <li>
                <a
                  href="http://127.0.0.1:8000/api/v1/health"
                  target="_blank"
                  rel="noreferrer"
                  className={isDark ? 'hover:text-white transition-colors inline-flex items-center gap-1.5' : 'hover:text-[#1A1815] transition-colors inline-flex items-center gap-1.5'}
                >
                  <span>Backend Health Probe</span>
                  <ArrowUpRight className={`w-3.5 h-3.5 ${isDark ? 'text-[#D3C9B8]' : 'text-[#7A7264]'}`} />
                </a>
              </li>
              <li>
                <Link href="/documentation" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  API Integration Guide
                </Link>
              </li>
              <li>
                <Link href="/testing" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
                  Monorepo Quality Suite
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/OMKAR580/Multi-Class-Vehicle-Localization-and-Automatic-License-Plate-Recognition-ALPR-"
                  target="_blank"
                  rel="noreferrer"
                  className={isDark ? 'hover:text-white transition-colors inline-flex items-center gap-1.5 text-white/80' : 'hover:text-[#1A1815] transition-colors inline-flex items-center gap-1.5 text-[#1A1815]'}
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TIER 3: BOTTOM LEGAL & COPYRIGHT */}
      {/* ===================================================================== */}
      <div className={`border-t transition-colors ${
        isDark ? 'border-white/[0.06] bg-black text-[#9a9a9a]' : 'border-[#D5CEBF] bg-[#ECE7DD] text-[#5A5245]'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span>© 2026 VisionPlate.ai Infrastructure. MIT Licensed.</span>
          </div>

          <div className="flex items-center gap-5 text-[11px]">
            <Link href="/about" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
              Architecture Paper
            </Link>
            <span className={isDark ? 'text-white/20' : 'text-[#D5CEBF]'}>•</span>
            <Link href="/documentation" className={isDark ? 'hover:text-white transition-colors' : 'hover:text-[#1A1815] transition-colors'}>
              FASTag Standards
            </Link>
            <span className={isDark ? 'text-white/20' : 'text-[#D5CEBF]'}>•</span>
            <span className={isDark ? 'text-[#E5C378]' : 'text-amber-800 font-semibold'}>Target: 12 Nov 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
