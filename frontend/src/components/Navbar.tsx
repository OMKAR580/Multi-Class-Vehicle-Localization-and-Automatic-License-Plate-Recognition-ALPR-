'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AuthService } from '@/lib/auth';
import {
  BarChart3,
  ChevronDown,
  ArrowRight,
  Sun,
  Moon,
  Menu,
  X,
  Layers,
  Cpu,
  Smartphone,
  Activity,
  FileText,
  Compass,
  Code2,
  Car,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  theme?: 'dark' | 'beige' | 'light';
  onToggleTheme?: () => void;
}

/**
 * Modern Curved Notch Navigation Bar with Full Site Navigation & Theme Sync
 * - Brand Logo: High-tech ALPR Plate / Scanner emblem + VisionPlate.ai typography
 * - Central Notch: Perfectly centered curved notch with full sections and platform hubs
 * - Top-Right Hub: Theme Switcher, Login button, Try Free Dashboard button
 */
export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const [isSectionsOpen, setIsSectionsOpen] = useState(false);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const sectionsRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);

  // Authentication State: determines whether to show "Login" or hide it, and action button label
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      setIsLoggedIn(AuthService.isAuthenticated());
    };
    checkAuth();
    window.addEventListener('visionplate_auth_change', checkAuth);
    window.addEventListener('storage', checkAuth);
    return () => {
      window.removeEventListener('visionplate_auth_change', checkAuth);
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  // Auto-detect theme if not provided as prop
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'beige'>(() => {
    if (theme) return theme === 'beige' || theme === 'light' ? 'beige' : 'dark';
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('visionplate-theme');
      if (saved === 'beige' || saved === 'light') return 'beige';
      if (document.documentElement.classList.contains('beige') || document.documentElement.classList.contains('light')) return 'beige';
    }
    return 'dark';
  });

  // Sync theme changes with DOM & Storage
  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme === 'beige' || theme === 'light' ? 'beige' : 'dark');
      return;
    }

    const syncTheme = () => {
      try {
        const saved = localStorage.getItem('visionplate-theme');
        const isBeige =
          saved === 'beige' ||
          saved === 'light' ||
          document.documentElement.classList.contains('beige') ||
          document.documentElement.classList.contains('light');
        setCurrentTheme(isBeige ? 'beige' : 'dark');
      } catch {
        setCurrentTheme('dark');
      }
    };

    syncTheme();
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, [theme]);

  const isDark = currentTheme === 'dark';

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sectionsRef.current && !sectionsRef.current.contains(event.target as Node)) {
        setIsSectionsOpen(false);
      }
      if (platformRef.current && !platformRef.current.contains(event.target as Node)) {
        setIsPlatformOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const next: 'dark' | 'beige' = currentTheme === 'dark' ? 'beige' : 'dark';
      setCurrentTheme(next);
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
      <div className="relative w-full px-3 sm:px-6 lg:px-8 py-0 flex items-center justify-between min-h-[52px]">
        {/* =================================================================== */}
        {/* TOP-LEFT: BRAND LOGO                                                */}
        {/* =================================================================== */}
        <div className="pointer-events-auto flex items-center z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 sm:gap-2.5 group cursor-pointer transition-all duration-300"
            aria-label="VisionPlate.ai Home"
          >
            {/* High-tech ALPR Plate / Scanner Emblem */}
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                isDark
                  ? 'bg-white/[0.08] border border-white/20 text-white group-hover:border-white/50 group-hover:shadow-[0_0_14px_rgba(255,255,255,0.3)]'
                  : 'bg-black/[0.05] border border-black/15 text-[#1A1815] group-hover:border-black/40 group-hover:shadow-[0_0_10px_rgba(0,0,0,0.12)]'
              }`}
            >
              <svg
                className="w-4.5 h-4.5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M3 7V5a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <rect x="5.5" y="8" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1" />
                <circle cx="8" cy="12" r="0.9" fill="#10B981" />
                <path d="M11 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
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
        {/* =================================================================== */}
        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-0 hidden md:flex items-center justify-center">
          <div
            className={`relative flex items-stretch transition-all duration-300 ${
              isDark
                ? 'drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]'
                : 'drop-shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
            }`}
          >
            {/* Left Concave Shoulder Wing */}
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

            {/* Notch Center Body */}
            <nav
              className={`relative flex items-center gap-1.5 sm:gap-2 px-1 sm:px-2 h-[52px] backdrop-blur-2xl transition-all duration-300 ${
                isDark
                  ? 'bg-[#0A0A0A] text-white'
                  : 'bg-[#FAF8F5] text-[#1A1815]'
              }`}
            >
              {/* 1. SECTIONS JUMP MENU DROPDOWN */}
              <div className="relative" ref={sectionsRef}>
                <button
                  onClick={() => {
                    setIsSectionsOpen(!isSectionsOpen);
                    setIsPlatformOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-[13px] font-medium tracking-tight transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    isDark
                      ? isSectionsOpen
                        ? 'bg-white/[0.14] text-white font-semibold'
                        : 'text-white/85 hover:text-white hover:bg-white/[0.1]'
                      : isSectionsOpen
                      ? 'bg-black/[0.08] text-black font-semibold'
                      : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05]'
                  }`}
                  aria-expanded={isSectionsOpen}
                  title="Explore Landing Page Sections"
                >
                  <Compass className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-700'}`} />
                  <span>Sections</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      isSectionsOpen ? 'rotate-180' : ''
                    } ${isDark ? 'text-white/60' : 'text-black/60'}`}
                  />
                </button>

                {/* Sections Dropdown Card */}
                {isSectionsOpen && (
                  <div
                    className={`absolute top-full left-0 mt-3 w-72 rounded-xl border-2 backdrop-blur-2xl p-2 shadow-2xl transition-all z-50 ${
                      isDark
                        ? 'bg-[#0E0E0E] border-white/20 text-white shadow-[0_20px_50px_rgba(0,0,0,0.95)]'
                        : 'bg-[#FAF8F5] border-[#D0C5B0] text-[#1A1815] shadow-[0_16px_40px_rgba(0,0,0,0.15)]'
                    }`}
                  >
                    <div
                      className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-semibold ${
                        isDark ? 'text-white/40' : 'text-[#8A8174]'
                      }`}
                    >
                      Landing Architecture
                    </div>
                    
                    <Link
                      href="/#scanner"
                      onClick={() => setIsSectionsOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="font-medium">Live Highway Simulator</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>NH-48 Real-time ALPR</div>
                      </div>
                    </Link>

                    <Link
                      href="/#pipeline"
                      onClick={() => setIsSectionsOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <div>
                        <div className="font-medium">02. 4-Stage Architecture</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Ingest &rarr; Detect &rarr; OCR &rarr; Contract</div>
                      </div>
                    </Link>

                    <Link
                      href="/#vehicle-intelligence"
                      onClick={() => setIsSectionsOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Car className="w-3.5 h-3.5 text-amber-400" />
                      <div>
                        <div className="font-medium">03. 8 Vehicle Categories</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Indian Roadway Multi-Class</div>
                      </div>
                    </Link>

                    <Link
                      href="/#detection-showcase"
                      onClick={() => setIsSectionsOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="font-medium">04. 3D Pipeline Machine</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Interactive Hardware Showcase</div>
                      </div>
                    </Link>

                    <Link
                      href="/#enterprise-applications"
                      onClick={() => setIsSectionsOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                      <div>
                        <div className="font-medium">05. Enterprise Applications</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Tolling, Security &amp; Smart Traffic</div>
                      </div>
                    </Link>

                    <Link
                      href="/#indian-registration-intelligence"
                      onClick={() => setIsSectionsOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <span className="text-xs">🇮🇳</span>
                      <div>
                        <div className="font-medium">06. Indian HSRP Intelligence</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>State Code, RTO &amp; Regex Syntax</div>
                      </div>
                    </Link>

                    <Link
                      href="/#developer-integration"
                      onClick={() => setIsSectionsOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                      <div>
                        <div className="font-medium">07. Developer Integration</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>REST API &amp; Pydantic Endpoints</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {/* 2. PLATFORM & PAGES DROPDOWN */}
              <div className="relative" ref={platformRef}>
                <button
                  onClick={() => {
                    setIsPlatformOpen(!isPlatformOpen);
                    setIsSectionsOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-[13px] font-medium tracking-tight transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    isDark
                      ? isPlatformOpen
                        ? 'bg-white/[0.14] text-white font-semibold'
                        : 'text-white/85 hover:text-white hover:bg-white/[0.1]'
                      : isPlatformOpen
                      ? 'bg-black/[0.08] text-black font-semibold'
                      : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05]'
                  }`}
                  aria-expanded={isPlatformOpen}
                  title="Explore Platform Pages"
                >
                  <BarChart3 className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
                  <span>Platform</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      isPlatformOpen ? 'rotate-180' : ''
                    } ${isDark ? 'text-white/60' : 'text-black/60'}`}
                  />
                </button>

                {/* Platform Dropdown Card */}
                {isPlatformOpen && (
                  <div
                    className={`absolute top-full left-0 mt-3 w-72 rounded-xl border-2 backdrop-blur-2xl p-2 shadow-2xl transition-all z-50 ${
                      isDark
                        ? 'bg-[#0E0E0E] border-white/20 text-white shadow-[0_20px_50px_rgba(0,0,0,0.95)]'
                        : 'bg-[#FAF8F5] border-[#D0C5B0] text-[#1A1815] shadow-[0_16px_40px_rgba(0,0,0,0.15)]'
                    }`}
                  >
                    <div
                      className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-semibold ${
                        isDark ? 'text-white/40' : 'text-[#8A8174]'
                      }`}
                    >
                      Applications &amp; Documentation
                    </div>

                    <Link
                      href="/app/detect"
                      onClick={() => setIsPlatformOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="font-medium">Detection Studio</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Upload &amp; Test Live ALPR</div>
                      </div>
                    </Link>

                    <Link
                      href="/app/dashboard"
                      onClick={() => setIsPlatformOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                      <div>
                        <div className="font-medium">Operator Dashboard</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Traffic Analytics &amp; Feeds</div>
                      </div>
                    </Link>

                    <Link
                      href="/documentation"
                      onClick={() => setIsPlatformOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="font-medium">Documentation Hub</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Architecture &amp; PDF Blueprints</div>
                      </div>
                    </Link>

                    <Link
                      href="/technology"
                      onClick={() => setIsPlatformOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <div>
                        <div className="font-medium">Technology Stack</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Deep Learning Frameworks</div>
                      </div>
                    </Link>

                    <Link
                      href="/how-it-works"
                      onClick={() => setIsPlatformOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      <div>
                        <div className="font-medium">How It Works</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Pipeline Walkthrough</div>
                      </div>
                    </Link>

                    <Link
                      href="/model"
                      onClick={() => setIsPlatformOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5 text-amber-400" />
                      <div>
                        <div className="font-medium">AI Model Specifications</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>8 Classes &amp; Accuracy Metrics</div>
                      </div>
                    </Link>

                    <Link
                      href="/download"
                      onClick={() => setIsPlatformOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-white' : 'hover:bg-black/[0.05] text-black'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                      <div>
                        <div className="font-medium">Android Native App (APK)</div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[#7A7264]'}`}>Jetpack Compose v1.0</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {/* Direct Nav Link: Studio */}
              <Link
                href="/app/detect"
                className={`hidden sm:inline-flex items-center text-xs sm:text-[13px] font-medium tracking-tight px-2.5 py-1.5 rounded-lg transition-all duration-300 whitespace-nowrap ${
                  isDark
                    ? 'text-white/85 hover:text-white hover:bg-white/[0.1]'
                    : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05]'
                }`}
              >
                Studio
              </Link>

              {/* Direct Nav Link: Tech */}
              <Link
                href="/technology"
                className={`hidden md:inline-flex items-center text-xs sm:text-[13px] font-medium tracking-tight px-2.5 py-1.5 rounded-lg transition-all duration-300 whitespace-nowrap ${
                  isDark
                    ? 'text-white/85 hover:text-white hover:bg-white/[0.1]'
                    : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05]'
                }`}
              >
                Technology
              </Link>

              {/* Direct Nav Link: Docs */}
              <Link
                href="/documentation"
                className={`hidden lg:inline-flex items-center text-xs sm:text-[13px] font-medium tracking-tight px-2.5 py-1.5 rounded-lg transition-all duration-300 whitespace-nowrap ${
                  isDark
                    ? 'text-white/85 hover:text-white hover:bg-white/[0.1]'
                    : 'text-[#5A5245] hover:text-black hover:bg-black/[0.05]'
                }`}
              >
                Docs
              </Link>
            </nav>

            {/* Right Concave Shoulder Wing */}
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
        {/* TOP-RIGHT CORNER ACTION HUB                                         */}
        {/* =================================================================== */}
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5 z-10">
          {/* 1. Theme Switcher Button */}
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

          {/* 2. Login Button - Only visible when NOT logged in */}
          {!isLoggedIn && (
            <Link
              href="/app/login"
              prefetch={true}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-[10px] text-xs sm:text-[13px] font-medium tracking-tight transition-all duration-300 whitespace-nowrap cursor-pointer ${
                isDark
                  ? 'btn-ghost-beige text-[#FAF8F5]'
                  : 'btn-ghost-dark text-[#1A1815]'
              }`}
            >
              <span>Login</span>
            </Link>
          )}

          {/* 3. Action Pill: "Dashboard" if logged in, "Get Started Free" if not logged in */}
          <Link
            href="/app/dashboard"
            prefetch={true}
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-[10px] text-xs sm:text-[13px] font-semibold tracking-tight transition-all duration-300 cursor-pointer whitespace-nowrap shadow-md ${
              isDark
                ? 'btn-solid-beige text-black'
                : 'btn-solid-dark text-white'
            }`}
          >
            <span>{isLoggedIn ? 'Dashboard' : 'Get Started Free'}</span>
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
          className={`pointer-events-auto mx-auto mt-2 w-full max-w-sm rounded-2xl border-2 backdrop-blur-2xl p-4 shadow-2xl space-y-3 md:hidden z-50 max-h-[80vh] overflow-y-auto ${
            isDark
              ? 'bg-[#0E0E0E] border-white text-white'
              : 'bg-[#FAF8F5] border-black text-[#1A1815]'
          }`}
        >
          <div className="text-[10px] font-mono uppercase tracking-wider font-semibold opacity-60">
            Landing Page Sections
          </div>
          <Link
            href="/#scanner"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            01. Live Highway Scanner
          </Link>
          <Link
            href="/#pipeline"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            02. Intelligence Pipeline
          </Link>
          <Link
            href="/#vehicle-intelligence"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            03. Multi-Class Vehicles
          </Link>
          <Link
            href="/#detection-showcase"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            04. 3D Pipeline Machine
          </Link>
          <Link
            href="/#enterprise-applications"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            05. Enterprise Applications
          </Link>
          <Link
            href="/#indian-registration-intelligence"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            06. Indian HSRP Intelligence
          </Link>
          <Link
            href="/#developer-integration"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            07. Developer Integration
          </Link>

          <div className="pt-2 border-t border-current/10 text-[10px] font-mono uppercase tracking-wider font-semibold opacity-60">
            Dedicated Pages
          </div>
          <Link
            href="/app/detect"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            Detection Studio (ALPR)
          </Link>
          <Link
            href="/documentation"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            Documentation Hub &amp; PDFs
          </Link>
          <Link
            href="/technology"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            Technology &amp; Architecture
          </Link>
          <Link
            href="/model"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            AI Model Specs
          </Link>
          <Link
            href="/download"
            onClick={() => setIsMenuOpen(false)}
            className={`block py-1.5 px-3 rounded-lg text-xs font-medium ${
              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
            }`}
          >
            Download Android APK
          </Link>

          <div className="pt-2 border-t border-current/10 flex flex-col gap-2">
            {!isLoggedIn && (
              <Link
                href="/app/login"
                prefetch={true}
                onClick={() => setIsMenuOpen(false)}
                className={`block text-center py-2 px-3 rounded-lg text-sm font-medium border ${
                  isDark
                    ? 'border-white/20 text-white hover:bg-white/10'
                    : 'border-black/20 text-black hover:bg-black/5'
                }`}
              >
                Login
              </Link>
            )}
            <Link
              href="/app/dashboard"
              prefetch={true}
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold shadow-md ${
                isDark
                  ? 'btn-solid-beige text-black'
                  : 'btn-solid-dark text-white'
              }`}
            >
              <span>{isLoggedIn ? 'Dashboard' : 'Get Started Free'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
