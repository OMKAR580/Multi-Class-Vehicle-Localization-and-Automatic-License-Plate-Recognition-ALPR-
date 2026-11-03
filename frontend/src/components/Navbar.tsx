'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ChevronDown,
  User,
  ArrowRight,
  Sun,
  Moon,
  Scan,
  Menu,
  X,
  Layers,
  Cpu,
  Smartphone,
  Activity,
} from 'lucide-react';

interface NavbarProps {
  theme?: 'dark' | 'beige' | 'light';
  onToggleTheme?: () => void;
}

/**
 * Modern Curved Notch Navigation Bar with Separated Top-Right Action Hub
 * - Central Notch: High-contrast outline (White in Dark theme, Black in Light theme)
 * - Top-Right Corner Hub: User Profile, Theme Switcher, Camera HUD, Launch Button
 * - Dropdown Menu with links to Scanner, Pipeline, 8-Class Model, and Android App
 */
export default function Navbar({ theme = 'dark', onToggleTheme }: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const current =
        document.documentElement.classList.contains('light') ||
        document.documentElement.classList.contains('beige')
          ? 'beige'
          : 'dark';
      const next = current === 'dark' ? 'beige' : 'dark';
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
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full pointer-events-none select-none">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-0 flex items-start justify-between">
        {/* =================================================================== */}
        {/* TOP-LEFT: BRAND LOGO (Original geometric design, outside the box)   */}
        {/* =================================================================== */}
        <div className="pointer-events-auto flex items-center pt-2 sm:pt-2.5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 sm:gap-2.5 group cursor-pointer transition-all duration-300"
            aria-label="VisionPlate.ai Home"
          >
            <svg
              className={`w-5 h-5 sm:w-[22px] sm:h-[22px] transition-all duration-300 group-hover:scale-105 ${
                isDark
                  ? 'text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]'
                  : 'text-[#1A1815] group-hover:drop-shadow-[0_0_8px_rgba(0,0,0,0.2)]'
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
            <span
              className={`font-semibold text-[15px] sm:text-[16px] tracking-[-0.03em] flex items-center whitespace-nowrap transition-all duration-300 ${
                isDark
                  ? 'text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                  : 'text-[#1A1815] group-hover:drop-shadow-[0_0_6px_rgba(0,0,0,0.15)]'
              }`}
            >
              <span>VisionPlate</span>
              <span
                className={`font-normal text-[11px] sm:text-[12px] ml-0.5 ${
                  isDark ? 'text-[#9a9a9a]' : 'text-[#7A7264]'
                }`}
              >
                .ai
              </span>
            </span>
          </Link>
        </div>

        {/* =================================================================== */}
        {/* CENTER: CURVED TOP NOTCH NAV BAR (Clean Seamless Dynamic Notch)     */}
        {/* Borderless silhouette (Boundary line removed as requested)           */}
        {/* =================================================================== */}
        <div className="pointer-events-auto flex items-center justify-center mx-auto lg:mx-0">
          <div
            className={`relative flex items-stretch transition-all duration-300 ${
              isDark
                ? 'drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]'
                : 'drop-shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
            }`}
          >
            {/* Left Concave Shoulder & Rounded Corner Wing */}
            <svg
              className="w-[40px] h-[52px] flex-shrink-0 -mr-[1px] pointer-events-none"
              viewBox="0 0 40 52"
              fill="none"
            >
              <path
                d="M 0 0 A 20 20 0 0 1 20 20 L 20 32 A 20 20 0 0 0 40 52 L 40 0 Z"
                className={`transition-colors duration-300 ${
                  isDark ? 'fill-[#0A0A0A]' : 'fill-[#FAF8F5]'
                }`}
              />
            </svg>

            {/* Notch Center Body (Borderless seamless notch) */}
            <nav
              className={`relative flex items-center gap-1.5 sm:gap-2 px-1 sm:px-2 h-[52px] backdrop-blur-2xl transition-all duration-300 ${
                isDark
                  ? 'bg-[#0A0A0A] text-white'
                  : 'bg-[#FAF8F5] text-[#1A1815]'
              }`}
            >
              {/* Dashboard Dropdown Menu */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-[13px] font-medium tracking-tight transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    isDark
                      ? isDropdownOpen
                        ? 'bg-white/[0.14] text-white font-semibold shadow-[0_0_14px_rgba(255,255,255,0.25)]'
                        : 'text-white/85 hover:text-white hover:bg-white/[0.1] hover:shadow-[0_0_14px_rgba(255,255,255,0.22)]'
                      : isDropdownOpen
                      ? 'bg-black/[0.08] text-black font-semibold shadow-[0_0_10px_rgba(0,0,0,0.1)]'
                      : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05] hover:shadow-[0_0_10px_rgba(0,0,0,0.08)]'
                  }`}
                  aria-expanded={isDropdownOpen}
                  title="Open Navigation Menu"
                >
                  <BarChart3
                    className={`w-3.5 h-3.5 ${
                      isDark ? 'text-amber-300' : 'text-amber-700'
                    }`}
                  />
                  <span>Dashboard</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      isDropdownOpen ? 'rotate-180' : ''
                    } ${isDark ? 'text-white/60' : 'text-black/60'}`}
                  />
                </button>

                {/* Floating Dropdown Card */}
                {isDropdownOpen && (
                  <div
                    className={`absolute top-full left-0 mt-3 w-64 rounded-xl border-2 backdrop-blur-2xl p-2 shadow-2xl transition-all z-50 ${
                      isDark
                        ? 'bg-[#0E0E0E] border-white text-white shadow-[0_20px_50px_rgba(0,0,0,0.95)]'
                        : 'bg-[#FAF8F5] border-black text-[#1A1815] shadow-[0_16px_40px_rgba(0,0,0,0.2)]'
                    }`}
                  >
                    <div
                      className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-semibold ${
                        isDark ? 'text-white/40' : 'text-[#8A8174]'
                      }`}
                    >
                      Traffic Command Hub
                    </div>
                    <Link
                      href="/#scanner"
                      onClick={() => setIsDropdownOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark
                          ? 'hover:bg-white/[0.08] text-white'
                          : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="font-medium">Live Highway Scanner</div>
                        <div
                          className={`text-[10px] ${
                            isDark ? 'text-white/50' : 'text-[#7A7264]'
                          }`}
                        >
                          NH-48 Real-time ALPR
                        </div>
                      </div>
                    </Link>
                    <Link
                      href="/technology"
                      onClick={() => setIsDropdownOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark
                          ? 'hover:bg-white/[0.08] text-white'
                          : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <div>
                        <div className="font-medium">Pipeline Architecture</div>
                        <div
                          className={`text-[10px] ${
                            isDark ? 'text-white/50' : 'text-[#7A7264]'
                          }`}
                        >
                          YOLOv8 + Indian OCR
                        </div>
                      </div>
                    </Link>
                    <Link
                      href="/model"
                      onClick={() => setIsDropdownOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark
                          ? 'hover:bg-white/[0.08] text-white'
                          : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5 text-amber-400" />
                      <div>
                        <div className="font-medium">AI Model Specifications</div>
                        <div
                          className={`text-[10px] ${
                            isDark ? 'text-white/50' : 'text-[#7A7264]'
                          }`}
                        >
                          8 Indian Vehicle Classes
                        </div>
                      </div>
                    </Link>
                    <Link
                      href="/download"
                      onClick={() => setIsDropdownOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark
                          ? 'hover:bg-white/[0.08] text-white'
                          : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                      <div>
                        <div className="font-medium">Android Native App</div>
                        <div
                          className={`text-[10px] ${
                            isDark ? 'text-white/50' : 'text-[#7A7264]'
                          }`}
                        >
                          Kotlin Jetpack Compose
                        </div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {/* Direct Nav Link: Live Scanner */}
              <Link
                href="/#scanner"
                className={`hidden sm:inline-flex items-center text-xs sm:text-[13px] font-medium tracking-tight px-2.5 py-1.5 rounded-lg transition-all duration-300 whitespace-nowrap ${
                  isDark
                    ? 'text-white/85 hover:text-white hover:bg-white/[0.1] hover:shadow-[0_0_14px_rgba(255,255,255,0.22)]'
                    : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05] hover:shadow-[0_0_10px_rgba(0,0,0,0.08)]'
                }`}
              >
                Live Scanner
              </Link>

              {/* Direct Nav Link: How It Works */}
              <Link
                href="/how-it-works"
                className={`hidden md:inline-flex items-center text-xs sm:text-[13px] font-medium tracking-tight px-2.5 py-1.5 rounded-lg transition-all duration-300 whitespace-nowrap ${
                  isDark
                    ? 'text-white/85 hover:text-white hover:bg-white/[0.1] hover:shadow-[0_0_14px_rgba(255,255,255,0.22)]'
                    : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05] hover:shadow-[0_0_10px_rgba(0,0,0,0.08)]'
                }`}
              >
                How It Works
              </Link>

              {/* Direct Nav Link: Pipeline */}
              <Link
                href="/technology"
                className={`hidden lg:inline-flex items-center text-xs sm:text-[13px] font-medium tracking-tight px-2.5 py-1.5 rounded-lg transition-all duration-300 whitespace-nowrap ${
                  isDark
                    ? 'text-white/85 hover:text-white hover:bg-white/[0.1] hover:shadow-[0_0_14px_rgba(255,255,255,0.22)]'
                    : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05] hover:shadow-[0_0_10px_rgba(0,0,0,0.08)]'
                }`}
              >
                Pipeline
              </Link>
            </nav>

            {/* Right Concave Shoulder & Rounded Corner Wing */}
            <svg
              className="w-[40px] h-[52px] flex-shrink-0 -ml-[1px] pointer-events-none"
              viewBox="0 0 40 52"
              fill="none"
            >
              <path
                d="M 0 52 A 20 20 0 0 0 20 32 L 20 20 A 20 20 0 0 1 40 0 L 0 0 Z"
                className={`transition-colors duration-300 ${
                  isDark ? 'fill-[#0A0A0A]' : 'fill-[#FAF8F5]'
                }`}
              />
            </svg>
          </div>
        </div>

        {/* =================================================================== */}
        {/* TOP-RIGHT CORNER ACTION HUB (Restored to Top-Right Corner)          */}
        {/* [👤 Profile] [☀️ Theme] [⛶ Camera HUD] [Launch →]                   */}
        {/* Soft, Refined Hover Glow                                             */}
        {/* =================================================================== */}
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5 pt-2 sm:pt-2.5">
          {/* 1. User Profile Avatar Button */}
          <Link
            href="/app/dashboard"
            className={`w-8 sm:w-9 h-8 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer border ${
              isDark
                ? 'bg-[#1C1C1E] border-white/20 text-white/90 hover:bg-white/15 hover:border-white/60 hover:shadow-[0_0_16px_rgba(255,255,255,0.4)] hover:scale-105'
                : 'bg-[#E8E2D5] border-black/20 text-[#1A1815] hover:bg-white hover:border-black/50 hover:shadow-[0_0_12px_rgba(0,0,0,0.15)] hover:scale-105'
            }`}
            title="Telemetry Dashboard"
            aria-label="User Profile Dashboard"
          >
            <User className="w-3.5 h-3.5" />
          </Link>

          {/* 2. Theme Switcher Button */}
          <button
            onClick={handleToggle}
            className={`w-8 sm:w-9 h-8 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
              isDark
                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 hover:shadow-[0_0_16px_rgba(251,191,36,0.45)] hover:scale-105'
                : 'text-slate-800 hover:text-black hover:bg-black/5 hover:shadow-[0_0_12px_rgba(0,0,0,0.15)] hover:scale-105'
            }`}
            title={isDark ? 'Switch to Beige Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* 3. Camera HUD Button (Luminous Glass Glow matching Studio HUD) */}
          <Link
            href="/app/detect"
            className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-xs font-medium tracking-tight transition-all duration-300 whitespace-nowrap cursor-pointer ${
              isDark
                ? 'btn-ghost-beige text-[#FAF8F5]'
                : 'btn-ghost-dark text-[#1A1815]'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Camera HUD</span>
          </Link>

          {/* 4. Launch Platform Action Pill (Radiant Ambient Glow matching Instant Scan) */}
          <Link
            href="/app/login"
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-[10px] text-xs sm:text-[13px] font-semibold tracking-tight transition-all duration-300 cursor-pointer whitespace-nowrap shadow-md ${
              isDark
                ? 'btn-solid-beige text-black'
                : 'btn-solid-dark text-white'
            }`}
          >
            <span>Launch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {/* Mobile Menu Hamburger Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`md:hidden p-1.5 rounded-lg border ${
              isDark
                ? 'border-white/20 text-white/80 hover:text-white'
                : 'border-black/20 text-black/80 hover:text-black'
            }`}
            aria-label="Toggle mobile menu"
          >
            {isMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MOBILE EXPANDED MENU DRAWER                                         */}
      {/* =================================================================== */}
      {isMenuOpen && (
        <div
          className={`pointer-events-auto mx-auto mt-2 w-full max-w-sm rounded-2xl border-2 backdrop-blur-2xl p-4 shadow-2xl space-y-2.5 md:hidden z-50 ${
            isDark
              ? 'bg-[#0E0E0E] border-white text-white'
              : 'bg-[#FAF8F5] border-black text-[#1A1815]'
          }`}
        >
          <Link
            href="/#scanner"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-2 px-3 rounded-lg text-sm font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            Live Highway Scanner
          </Link>
          <Link
            href="/how-it-works"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-2 px-3 rounded-lg text-sm font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            How It Works
          </Link>
          <Link
            href="/technology"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-2 px-3 rounded-lg text-sm font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            Pipeline Architecture
          </Link>
          <Link
            href="/model"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-2 px-3 rounded-lg text-sm font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            YOLOv8 + Indian OCR Model
          </Link>
          <Link
            href="/download"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-2 px-3 rounded-lg text-sm font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            Android Native APK
          </Link>
          <Link
            href="/app/detect"
            onClick={() => setIsMenuOpen(false)}
            className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm font-semibold ${
              isDark
                ? 'bg-white/[0.08] text-[#FAF8F5]'
                : 'bg-black/[0.08] text-[#1A1815]'
            }`}
          >
            <span>Camera HUD Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </header>
  );
}
