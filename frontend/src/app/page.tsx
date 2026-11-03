'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ShaderBackground } from '@/components/ui/animated-shader-hero';
import {
  Scan,
  Activity,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Shield,
  Sparkles,
} from 'lucide-react';

interface VehicleScenario {
  id: string;
  name: string;
  category: 'Car' | 'Auto-Rickshaw' | 'EV Sedan' | 'Motorcycle';
  plateNumber: string;
  plateType: string;
  plateBg: string;
  plateTextColor: string;
  confidence: string;
  rtoState: string;
  speed: string;
  imageSrc: string;
  plateBoxCoords: { top: string; left: string; width: string; height: string };
  chassisBoxCoords: { top: string; left: string; width: string; height: string };
}

const VEHICLES: VehicleScenario[] = [
  {
    id: 'car-suv',
    name: 'White SUV',
    category: 'Car',
    plateNumber: 'DL 10 CA 4829',
    plateType: 'Private HSRP (White)',
    plateBg: 'bg-white',
    plateTextColor: 'text-black',
    confidence: '99.4%',
    rtoState: 'DL (Delhi West)',
    speed: '58 km/h',
    imageSrc: '/assets/real_suv.jpg',
    chassisBoxCoords: { top: '23.4%', left: '23.3%', width: '55.2%', height: '62.5%' },
    plateBoxCoords: { top: '59.0%', left: '38.5%', width: '12.4%', height: '5.1%' },
  },
  {
    id: 'auto-rickshaw',
    name: 'Bajaj Auto',
    category: 'Auto-Rickshaw',
    plateNumber: 'DL 1R 1947',
    plateType: 'Commercial Taxi (Yellow)',
    plateBg: 'bg-[#FFD100]',
    plateTextColor: 'text-black',
    confidence: '98.6%',
    rtoState: 'DL (Delhi North)',
    speed: '42 km/h',
    imageSrc: '/assets/real_autorickshaw.jpg',
    chassisBoxCoords: { top: '27.3%', left: '32.0%', width: '34.9%', height: '54.7%' },
    plateBoxCoords: { top: '47.0%', left: '53.6%', width: '6.3%', height: '7.7%' },
  },
  {
    id: 'motorcycle',
    name: 'Royal Enfield',
    category: 'Motorcycle',
    plateNumber: 'KA 05 MN 4411',
    plateType: 'Dual-Line Motorcycle',
    plateBg: 'bg-white',
    plateTextColor: 'text-black',
    confidence: '98.1%',
    rtoState: 'KA (Bengaluru South)',
    speed: '49 km/h',
    imageSrc: '/assets/real_bullet.jpg',
    chassisBoxCoords: { top: '20.8%', left: '37.1%', width: '29.8%', height: '66.4%' },
    plateBoxCoords: { top: '38.9%', left: '53.8%', width: '9.6%', height: '5.2%' },
  },
  {
    id: 'ev-sedan',
    name: 'Tata Nexon EV',
    category: 'EV Sedan',
    plateNumber: 'MH 12 EV 8899',
    plateType: 'Electric Vehicle (Green)',
    plateBg: 'bg-[#0E8A42]',
    plateTextColor: 'text-white',
    confidence: '99.1%',
    rtoState: 'MH (Pune Central)',
    speed: '64 km/h',
    imageSrc: '/assets/real_nexon_ev.jpg',
    chassisBoxCoords: { top: '26.0%', left: '14.5%', width: '54.5%', height: '57.3%' },
    plateBoxCoords: { top: '69.1%', left: '33.9%', width: '9.2%', height: '5.5%' },
  },
];

export default function HomePage() {
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [progress, setProgress] = useState(25); // 0% to 100% along the roadway
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 1.5>(1);
  const [flashTrigger, setFlashTrigger] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'beige'>('dark');
  const [eventLogs, setEventLogs] = useState<string[]>([
    'Optical Gantry Online • FASTag Lane Cam-04 Active',
  ]);

  const vehicle = VEHICLES[activeVehicleIndex];
  const animRef = useRef<number | null>(null);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('visionplate-theme');
      if (saved === 'beige' || saved === 'light') {
        setTheme('beige');
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('beige', 'light');
      } else {
        setTheme('dark');
        document.documentElement.classList.remove('beige', 'light');
        document.documentElement.classList.add('dark');
      }
    } catch {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: 'dark' | 'beige' = prev === 'dark' ? 'beige' : 'dark';
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
      return next;
    });
  };

  // States:
  // 0% - 35%: Approaching
  // 35% - 72%: Under Scanner (YOLO & Plate Locked)
  // >= 48%: OCR Extraction Verified & Logged
  // > 72%: Cleared
  const isApproaching = progress < 35;
  const isUnderScanner = progress >= 35 && progress <= 72;
  const isDetected = progress >= 48;

  // Animation Loop - Relaxed, cinematic pace so the user can easily observe the full scan
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      setProgress((prev) => {
        // Moderate, fluid driving speed across highway (~8.5s full pass)
        const inScanZone = prev >= 35 && prev <= 72;
        const currentSpeed = inScanZone ? 9.5 : 13.5;
        const next = prev + delta * currentSpeed * playbackSpeed;

        // Flash trigger when crossing detection threshold (48%)
        if (prev < 48 && next >= 48) {
          setFlashTrigger(true);
          setTimeout(() => setFlashTrigger(false), 250);

          setEventLogs([
            `[${new Date().toLocaleTimeString()}] ${vehicle.plateNumber} (${vehicle.category}) • ${vehicle.confidence} CONF • LOGGED`,
          ]);
        }

        // Loop to next vehicle after passing
        if (next >= 100) {
          setActiveVehicleIndex((idx) => (idx + 1) % VEHICLES.length);
          return 0;
        }

        return next;
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, playbackSpeed, vehicle]);

  const handleSelectVehicle = (idx: number) => {
    setActiveVehicleIndex(idx);
    setProgress(35); // Jump directly into scanner zone for immediate viewing
  };

  const handleTriggerInstantScan = () => {
    setProgress(48); // Jump directly to detection moment
  };

  return (
    <div className={`relative min-h-screen flex flex-col justify-between overflow-x-hidden transition-colors duration-400 ${
      theme === 'dark'
        ? 'bg-black text-white selection:bg-[#E8E2D5] selection:text-black'
        : 'bg-[#E8DEC8] text-[#1A1815] selection:bg-[#1A1815] selection:text-white'
    }`}>
      {/* Film grain noise overlay from Vesper design */}
      <div className={`grain transition-opacity duration-300 ${theme === 'dark' ? 'opacity-[0.045]' : 'opacity-[0.02]'}`} />

      {/* Interactive WebGL Cosmic Nebula & Celestial Streaks Shader Background */}
      <div className="fixed inset-0 -z-20 pointer-events-none overflow-hidden">
        <ShaderBackground theme={theme} className={`w-full h-full transition-opacity duration-700 ${theme === 'dark' ? 'opacity-90' : 'opacity-70'}`} />
        {/* Soft Vignette Gradients for depth and optimal legibility */}
        <div
          className={`absolute inset-0 transition-all duration-700 pointer-events-none ${
            theme === 'dark'
              ? 'bg-gradient-to-t from-black via-black/35 to-black/60'
              : 'bg-gradient-to-t from-[#E8DEC8] via-[#E8DEC8]/35 to-[#E8DEC8]/70'
          }`}
        />
        <div
          className={`absolute inset-0 transition-all duration-700 pointer-events-none ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-black/85 via-transparent to-black/85'
              : 'bg-gradient-to-r from-[#E8DEC8]/80 via-transparent to-[#E8DEC8]/80'
          }`}
        />
      </div>

      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      {/* ========================================================================= */}
      {/* SINGLE-VIEWPORT HERO: LEFT TEXT + RIGHT REAL-TIME SCANNER ANIMATION */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 flex flex-col justify-center max-w-[1440px] w-full mx-auto px-5 sm:px-8 lg:px-12 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* ------------------------------------------------------------------- */}
          {/* LEFT SIDE: LUXURY EDITORIAL COPY & INTERFACE (From Image 2 / Vesper) */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex flex-col items-start text-left">
            {/* Vesper-style Luxury Badge */}
            <div className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-[12.5px] font-normal tracking-[-0.01em] mb-6 transition-colors ${
              theme === 'dark'
                ? 'border-white/[0.18] bg-white/[0.04] backdrop-blur-md text-[#EFECE6] shadow-[0_0_20px_rgba(245,242,235,0.08)]'
                : 'border-[#C7BBA5] bg-[#FAF8F5]/90 backdrop-blur-md text-[#1A1815] shadow-xs'
            }`}>
              <svg
                className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-[#F5F2EB] drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]' : 'text-[#1A1815]'}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
              </svg>
              <span>Operational AI Traffic Infrastructure</span>
              <span className={theme === 'dark' ? 'text-white/30' : 'text-[#A0988A]'}>•</span>
              <span className={theme === 'dark' ? 'text-[#D3C9B8]' : 'text-[#4A4235] font-semibold'}>YOLOv8 + Indian OCR</span>
            </div>

            {/* Main Headline with Instrument Serif Italic Accent */}
            <h1 className={`text-3xl sm:text-4xl lg:text-[44px] xl:text-[50px] font-medium tracking-[-0.04em] leading-[1.12] mb-5 transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-[#1A1815] font-semibold'
            }`}>
              Localize vehicles &{' '}
              <span className={`font-serif-italic font-normal tracking-[-0.02em] ${
                theme === 'dark' ? 'text-[#d8d8d8]' : 'text-[#52493B]'
              }`}>
                extract number plates
              </span>{' '}
              in real-time.
            </h1>

            {/* Lede Text */}
            <p className={`text-[14.5px] sm:text-[15.5px] font-normal leading-[1.58] tracking-[-0.015em] mb-7 max-w-lg transition-colors ${
              theme === 'dark' ? 'text-[#9a9a9a]' : 'text-[#5A5245]'
            }`}>
              Engineered for the chaotic reality of Indian roadways. Real-time localization across 8 Indian vehicle
              classes with sub-second license plate OCR and verified RTO regex.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mb-7">
              <button
                onClick={handleTriggerInstantScan}
                className={`inline-flex items-center justify-center px-5 py-2.5 rounded-[7px] text-[13.5px] font-medium tracking-[-0.02em] transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'btn-solid-beige text-black'
                    : 'btn-solid-dark text-white'
                }`}
              >
                <span>Trigger Instant Scan</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>

              <Link
                href="/app/detect"
                className={`inline-flex items-center justify-center px-4 py-2.5 rounded-[7px] text-[13.5px] font-normal tracking-[-0.02em] transition-all ${
                  theme === 'dark'
                    ? 'btn-ghost-beige text-[#E8E2D5]'
                    : 'btn-ghost-dark text-[#1A1815]'
                }`}
              >
                <Scan className={`w-4 h-4 mr-2 ${theme === 'dark' ? 'text-[#E8E2D5]' : 'text-[#1A1815]'}`} />
                <span>Studio HUD</span>
              </Link>
            </div>

            {/* Quick 3-Key Metric Strip */}
            <div className={`grid grid-cols-3 gap-3 w-full max-w-md pt-5 border-t transition-colors ${
              theme === 'dark' ? 'border-white/[0.08]' : 'border-[#C7BBA5]'
            }`}>
              <div>
                <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#1A1815]'}`}>99.4%</div>
                <div className={`text-[11px] ${theme === 'dark' ? 'text-[#9a9a9a]' : 'text-[#736B5E]'}`}>Plate Precision</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#D49E35]">&lt; 18 ms</div>
                <div className={`text-[11px] ${theme === 'dark' ? 'text-[#9a9a9a]' : 'text-[#736B5E]'}`}>Neural Latency</div>
              </div>
              <div>
                <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#1A1815]'}`}>8 Classes</div>
                <div className={`text-[11px] ${theme === 'dark' ? 'text-[#9a9a9a]' : 'text-[#736B5E]'}`}>Indian Vehicles</div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------- */}
          {/* RIGHT SIDE: REAL-TIME PHOTOREALISTIC ROADWAY & SCANNER HUD */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-7 w-full flex flex-col items-center relative">
            {/* 3D Atmospheric Ambilight Glow / Studio Cast Shadow */}
            <div
              className={`absolute -inset-4 sm:-inset-8 rounded-[40px] pointer-events-none transition-all duration-700 ${
                theme === 'dark'
                  ? 'bg-gradient-to-tr from-amber-500/[0.12] via-white/[0.10] to-cyan-500/[0.08] blur-3xl opacity-80'
                  : 'bg-gradient-to-b from-[#2E2314]/30 via-[#3B2D1B]/20 to-[#4A3922]/15 blur-3xl opacity-90'
              }`}
            />

            {/* 3D Computer Monitor Outer CNC-Milled Chassis / Frame */}
            <div
              className={`relative w-full rounded-[24px] sm:rounded-[28px] md:rounded-[32px] p-2 sm:p-2.5 md:p-3 pb-2 sm:pb-2.5 md:pb-3 border-2 transition-all duration-300 z-10 ${
                theme === 'dark'
                  ? 'bg-gradient-to-b from-[#2B2926] via-[#171615] to-[#0D0D0C] border-white/[0.22] shadow-[0_0_80px_rgba(255,255,255,0.08),0_30px_70px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-1px_2px_rgba(0,0,0,0.9)]'
                  : 'bg-gradient-to-b from-[#FAF7F0] via-[#DDD4C3] to-[#B3A690] border-[#7D705C] shadow-[0_32px_75px_-12px_rgba(35,26,14,0.48),0_16px_36px_-6px_rgba(35,26,14,0.32),0_4px_12px_rgba(35,26,14,0.22),inset_0_1.5px_0_#FFFFFF,inset_0_-2.5px_4px_rgba(50,40,25,0.35)]'
              }`}
            >
              {/* Top Specular Chamfer Highlight */}
              <div
                className={`absolute inset-x-8 top-0 h-[1.5px] pointer-events-none ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-transparent via-white/50 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-white to-transparent'
                }`}
              />

              {/* Top Bezel Center: High-Precision Integrated Camera & Optical Sensor Array */}
              <div className="absolute top-1 sm:top-1.5 inset-x-0 flex items-center justify-center pointer-events-none z-30">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-sm ${
                    theme === 'dark'
                      ? 'bg-black/90 border-white/10'
                      : 'bg-[#151311] border-black/40 ring-1 ring-white/30'
                  }`}
                >
                  <div className="w-0.5 h-0.5 rounded-full bg-neutral-600" />
                  <div className="relative w-2 h-2 rounded-full bg-[#050505] ring-1 ring-white/30 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-blue-900/90" />
                  </div>
                  <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                  <div className="w-0.5 h-0.5 rounded-full bg-neutral-600" />
                </div>
              </div>

              {/* Inner Screen Display (Recessed Glass Frame) */}
              <div
                className={`relative w-full rounded-[14px] sm:rounded-[18px] border-2 overflow-hidden backdrop-blur-2xl transition-all duration-300 ${
                  theme === 'dark'
                    ? 'border-black/90 bg-black/90 shadow-[inset_0_2px_8px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-[#1E1B16] bg-[#FAF8F5] shadow-[inset_0_4px_14px_rgba(0,0,0,0.42),0_1.5px_0_#FFFFFF] text-[#1A1815]'
                }`}
              >
                {/* Screen Glass Specular Sheen (Subtle diagonal glass reflection glare) */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent 65% to-white/[0.04] pointer-events-none z-30" />

                {/* Telemetry Header */}
              <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs font-mono transition-colors ${
                theme === 'dark'
                  ? 'bg-white/[0.03] border-white/[0.08] text-[#9a9a9a]'
                  : 'bg-gradient-to-b from-[#F2ECE1] to-[#E2D8C7] border-b border-[#C2B6A2] text-[#2C2720] shadow-xs'
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-semibold text-[10px] ${
                    theme === 'dark'
                      ? 'bg-[#201F1C] border border-[#F5F2EB]/20 text-[#FAF8F5]'
                      : 'bg-[#E5DFD3] border border-[#C5BDAF] text-[#1A1815]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isUnderScanner ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`} />
                    {isUnderScanner ? 'OPTICAL SCANNING ACTIVE' : 'ROADWAY RADAR'}
                  </span>
                  <span className={`text-[11px] hidden sm:inline ${theme === 'dark' ? 'text-[#9a9a9a]' : 'text-[#736B5E]'}`}>NH-48 GANTRY #04</span>
                </div>

                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Activity className={`w-3 h-3 ${theme === 'dark' ? 'text-[#F5F2EB]' : 'text-[#1A1815]'}`} />
                    <span className={theme === 'dark' ? 'text-white font-medium' : 'text-[#1A1815] font-semibold'}>60.2 FPS</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-[#D49E35]" />
                    <span className="text-[#D49E35] font-medium">16.4 ms</span>
                  </span>
                  <span className={theme === 'dark' ? 'hidden md:inline text-white/20' : 'hidden md:inline text-[#D5CEBF]'}>|</span>
                  <span className={theme === 'dark' ? 'text-[#9a9a9a] hidden md:inline' : 'text-[#736B5E] hidden md:inline'}>SPEED: {vehicle.speed}</span>
                </div>
              </div>

              {/* Vehicle Class Switcher Tabs */}
              <div className={`flex border-b overflow-x-auto select-none transition-colors ${
                theme === 'dark' ? 'border-white/[0.08] bg-black/60' : 'border-[#C2B6A2] bg-[#E8E0D2]'
              }`}>
                {VEHICLES.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVehicle(i)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono transition-all duration-300 border-r whitespace-nowrap cursor-pointer ${
                      theme === 'dark'
                        ? activeVehicleIndex === i
                          ? 'bg-white/[0.1] text-white border-b-2 border-b-[#FAF8F5] font-bold border-r-white/[0.06] shadow-[0_0_18px_rgba(255,255,255,0.25)]'
                          : 'text-[#9a9a9a] hover:text-white hover:bg-white/[0.08] hover:shadow-[0_0_16px_rgba(255,255,255,0.2)] border-r-white/[0.06]'
                        : activeVehicleIndex === i
                          ? 'bg-[#FAF8F5] text-[#1A1815] border-b-2 border-b-[#1A1815] shadow-xs font-bold border-r-[#C2B6A2]'
                          : 'text-[#5C5343] hover:text-[#1A1815] hover:bg-[#FAF8F5]/80 hover:shadow-[0_0_12px_rgba(0,0,0,0.08)] border-r-[#C2B6A2]'
                    }`}
                  >
                    <span>{v.name}</span>
                  </button>
                ))}

                {/* Simulator Play/Pause & Speed Controls */}
                <div className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-mono">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`p-1 rounded transition-all duration-300 cursor-pointer ${
                      theme === 'dark'
                        ? 'hover:bg-white/[0.12] hover:shadow-[0_0_14px_rgba(255,255,255,0.3)] text-[#E8E2D5] hover:text-white hover:scale-105'
                        : 'hover:bg-[#D5CEBF]/60 text-[#1A1815] hover:scale-105'
                    }`}
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setProgress(0)}
                    className={`p-1 rounded transition-all duration-300 cursor-pointer ${
                      theme === 'dark'
                        ? 'hover:bg-white/[0.12] hover:shadow-[0_0_14px_rgba(255,255,255,0.3)] text-[#9a9a9a] hover:text-white hover:scale-105'
                        : 'hover:bg-[#D5CEBF]/60 text-[#6B6355] hover:text-[#1A1815] hover:scale-105'
                    }`}
                    title="Reset"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <div className={`flex items-center gap-0.5 border-l pl-1.5 ${theme === 'dark' ? 'border-white/[0.1]' : 'border-[#D5CEBF]'}`}>
                    {([0.5, 1, 1.5] as const).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-all duration-300 ${
                          playbackSpeed === spd
                            ? theme === 'dark'
                              ? 'bg-white/[0.18] text-white font-bold shadow-[0_0_14px_rgba(255,255,255,0.3)]'
                              : 'bg-[#1A1815] text-[#FAF8F5] font-bold shadow-xs'
                            : theme === 'dark'
                              ? 'text-[#9a9a9a] hover:text-white hover:bg-white/[0.08] hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                              : 'text-[#6B6355] hover:text-[#1A1815]'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* =============================================================== */}
              {/* PHOTOREALISTIC ROADWAY & VEHICLE SCANNER VIEWPORT */}
              {/* =============================================================== */}
              <div className="relative aspect-[1376/768] w-full bg-black overflow-hidden flex items-center justify-center select-none">
                {/* Photorealistic Roadway Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-85 filter contrast-110 brightness-95"
                  style={{ backgroundImage: `url('/assets/real_highway_road.jpg')` }}
                />

                {/* Roadway Perspective Overlay Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 pointer-events-none" />

                {/* Shutter flash effect */}
                {flashTrigger && (
                  <div className="absolute inset-0 bg-white/30 pointer-events-none z-30 transition-opacity duration-200" />
                )}

                {/* ------------------------------------------------------------- */}
                {/* PHOTOREALISTIC VEHICLE MOVING DOWN THE ROAD */}
                {/* ------------------------------------------------------------- */}
                {(() => {
                  // Motion dynamics:
                  // Progress 0% -> approaching from horizon
                  // Progress 48% -> directly under scanner
                  // Progress 100% -> passing bottom
                  const currentScale = 0.88 + (progress / 100) * 0.22; // 0.88 to 1.10
                  const currentTranslateY = (progress - 50) * 0.25; // gentle vertical travel

                  return (
                    <div
                      style={{
                        transform: `scale(${currentScale}) translateY(${currentTranslateY}px)`,
                        transformOrigin: '50% 50%',
                      }}
                      className="relative w-full h-full flex items-center justify-center transition-transform duration-100 ease-out pointer-events-none z-10"
                    >
                      {/* Photorealistic Vehicle Image Container */}
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img
                          src={vehicle.imageSrc}
                          alt={vehicle.name}
                          className="w-full h-full object-cover filter contrast-105 brightness-95 drop-shadow-2xl"
                        />

                        {/* ======================================================= */}
                        {/* YOLO & PLATE BOUNDING BOXES (Direct siblings on photo)  */}
                        {/* ======================================================= */}
                        {isUnderScanner && (
                          <>
                            {/* 1. YOLOv8 CHASSIS BOUNDING BOX */}
                            <div
                              style={{
                                top: vehicle.chassisBoxCoords.top,
                                left: vehicle.chassisBoxCoords.left,
                                width: vehicle.chassisBoxCoords.width,
                                height: vehicle.chassisBoxCoords.height,
                              }}
                              className="absolute border-2 border-[#FAF8F5]/90 rounded-lg shadow-[0_0_25px_rgba(245,242,235,0.4)] pointer-events-none transition-all duration-150 z-20"
                            >
                              {/* Titanium Corner Reticles */}
                              <span className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-white" />
                              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-white" />
                              <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-white" />
                              <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-white" />

                              {/* YOLO Class Tag */}
                              <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-black/90 border border-white/40 text-[9px] font-mono text-white flex items-center gap-1.5 shadow-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                <span className="font-bold">{vehicle.category.toUpperCase()}</span>
                                <span className="text-[#E5C378] font-mono">{vehicle.confidence}</span>
                                <span className="text-white/40 hidden sm:inline">TRACK #01</span>
                              </div>
                            </div>

                            {/* 2. TARGET LICENSE PLATE MICRO-BOX (Direct Sibling - 100% Exact Plate Alignment) */}
                            <div
                              style={{
                                top: vehicle.plateBoxCoords.top,
                                left: vehicle.plateBoxCoords.left,
                                width: vehicle.plateBoxCoords.width,
                                height: vehicle.plateBoxCoords.height,
                              }}
                              className="absolute border-2 border-amber-400 rounded bg-amber-400/20 shadow-[0_0_18px_rgba(245,197,24,0.85)] flex items-center justify-center transition-all duration-150 z-20 pointer-events-none"
                            >
                              {/* Glowing Corner Accents */}
                              <span className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 border-t border-l border-white" />
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 border-t border-r border-white" />
                              <span className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 border-b border-l border-white" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 border-b border-r border-white" />

                              {/* Horizontal laser scan beam */}
                              <div className="absolute inset-x-0 h-0.5 bg-white shadow-[0_0_8px_#FFF] animate-laser" />
                              <span className="absolute -bottom-4 px-1 py-0.2 rounded bg-black/95 text-[7px] font-mono text-amber-300 font-bold whitespace-nowrap shadow-md">
                                PLATE ROI: LOCKED
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* OVERHEAD SCANNER ARCH GANTRY (Fixed at top/center of road) */}
                <div className="absolute top-[18%] inset-x-[12%] sm:inset-x-[18%] pointer-events-none z-20">
                  {/* Gantry Horizontal Truss */}
                  <div className="relative h-2.5 bg-gradient-to-r from-[#181818] via-[#383838] to-[#181818] rounded-sm border-t border-b border-white/[0.3] shadow-[0_0_15px_rgba(245,242,235,0.2)] flex items-center justify-between px-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E5C378] animate-pulse" />
                    <div className="text-[8px] font-mono font-bold tracking-widest text-[#FAF8F5]/80">
                      FASTAG TOLL SCANNER GANTRY // CAM-04
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>

                  {/* Downward Optical Scanning Laser Plane */}
                  <div
                    className={`relative w-full transition-opacity duration-300 ${
                      isUnderScanner ? 'opacity-100' : 'opacity-20'
                    }`}
                  >
                    <div className="h-24 bg-gradient-to-b from-[#E5C378]/25 via-[#F5F2EB]/10 to-transparent [clip-path:polygon(10%_0%,90%_0%,100%_100%,0%_100%)] pointer-events-none" />
                    <div className="absolute top-1 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#FAF8F5] to-transparent shadow-[0_0_12px_#FAF8F5] animate-laser" />
                  </div>
                </div>

                {/* =============================================================== */}
                {/* FLOATING REAL-TIME NEURAL OCR DECODER CARD */}
                {/* =============================================================== */}
                <div
                  className={`absolute top-3 right-3 sm:top-5 sm:right-5 w-[250px] sm:w-[280px] rounded-xl bg-black/95 border border-white/[0.22] p-3 shadow-[0_0_30px_rgba(245,242,235,0.12)] backdrop-blur-xl transition-all duration-300 z-30 ${
                    isDetected ? 'opacity-100 translate-y-0 scale-100' : 'opacity-85 translate-y-1 scale-98'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/[0.1] text-[10px] font-mono">
                    <span className="text-[#9a9a9a] flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-[#E8E2D5]" />
                      <span>NEURAL OCR DECODER</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-700/60 text-emerald-300 font-bold text-[9px]">
                      {isDetected ? `CONF ${vehicle.confidence}` : 'ACQUIRING...'}
                    </span>
                  </div>

                  {/* Rendered Indian Plate Graphic */}
                  <div
                    className={`relative px-3 py-2 rounded-lg border-2 border-black/80 ${vehicle.plateBg} shadow-inner flex items-center justify-between transition-all duration-200`}
                  >
                    {/* Blue IND Hologram Stripe */}
                    <div className="flex flex-col items-center justify-center pr-2 border-r border-black/30">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-700 flex items-center justify-center text-[6px] text-white font-bold">
                        🇮🇳
                      </div>
                      <span className="text-[8px] font-black tracking-tighter text-blue-900">IND</span>
                    </div>

                    {/* Embossed Characters */}
                    <div
                      className={`font-mono text-base sm:text-lg font-black tracking-widest ${vehicle.plateTextColor} text-center flex-1`}
                    >
                      {isDetected ? vehicle.plateNumber : '•••• •• ••••'}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="mt-2 pt-1.5 border-t border-white/[0.08] grid grid-cols-2 gap-1 text-[9px] font-mono">
                    <div>
                      <span className="text-[#9a9a9a]">LAYOUT:</span>{' '}
                      <span className="text-[#FAF8F5] font-semibold">{vehicle.plateType}</span>
                    </div>
                    <div>
                      <span className="text-[#9a9a9a]">RTO:</span>{' '}
                      <span className="text-[#FAF8F5] font-semibold">{vehicle.rtoState}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-between mt-1 pt-1 border-t border-white/[0.06]">
                      <span className="text-[#9a9a9a] flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        Regex RTO Validated
                      </span>
                      <span className="text-[#E5C378] font-semibold">Tesseract + PaddleOCR</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Live Stream Event Ticker */}
                <div className="absolute bottom-0 inset-x-0 bg-black/90 border-t border-white/[0.08] px-3 py-1 flex items-center justify-between text-[10px] font-mono text-[#9a9a9a] z-20">
                  <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                    <span className="text-[#F5F2EB] font-bold">EVENT STREAM:</span>
                    <span className="text-white/80">{eventLogs[0]}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>ALPR ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>

              {/* Bottom Bezel Hardware Brand Engraving */}
              <div className="flex items-center justify-center pt-2 sm:pt-2.5 pointer-events-none select-none">
                <div className="flex items-center gap-1.5 opacity-75 hover:opacity-100 transition-opacity">
                  <span className={`w-1.5 h-1.5 rounded-full ${theme === 'dark' ? 'bg-[#D49E35]' : 'bg-[#B27D22]'}`} />
                  <span
                    className={`text-[8.5px] sm:text-[9px] font-mono tracking-widest uppercase font-semibold ${
                      theme === 'dark'
                        ? 'text-white/60'
                        : 'text-[#3D3528] drop-shadow-[0_1px_0_rgba(255,255,255,0.85)] font-bold'
                    }`}
                  >
                    VISION-PRO WORKSTATION // NH-48 HIGHWAY TELEMETRY
                  </span>
                </div>
              </div>
            </div>

            {/* =============================================================== */}
            {/* WORKSTATION COMPUTER MONITOR STAND (Pedestal & Stem)            */}
            {/* =============================================================== */}
            <div className="relative flex flex-col items-center -mt-[1px] pointer-events-none select-none z-0">
              {/* 3D Hinge / Tilt Pivot Knuckle */}
              <div
                className={`relative -mt-0.5 w-14 sm:w-16 h-2.5 rounded-t-sm border-t border-x transition-colors duration-300 ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-[#171615] via-[#35332F] to-[#171615] border-white/20 shadow-inner'
                    : 'bg-gradient-to-r from-[#8C7F6C] via-[#EAE3D4] to-[#8C7F6C] border-[#665A48] shadow-sm'
                }`}
              />

              {/* Stand Neck / Arm with sleek tapered metallic bevel */}
              <div
                className={`relative w-24 sm:w-28 h-8 sm:h-9 transition-colors duration-300 ${
                  theme === 'dark'
                    ? 'bg-gradient-to-b from-[#2E2C28] via-[#1E1D1A] to-[#131210] border-x border-white/[0.18] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
                    : 'bg-gradient-to-b from-[#EAE3D5] via-[#CFC4B1] to-[#AD9F88] border-x-2 border-[#736653] shadow-[inset_0_1px_2px_#FFFFFF,0_4px_10px_rgba(30,22,10,0.22)]'
                }`}
                style={{
                  clipPath: 'polygon(14% 0%, 86% 0%, 100% 100%, 0% 100%)',
                }}
              >
                {/* Chamfered vertical metallic reflection lines */}
                <div className={`absolute inset-y-0 left-[22%] w-[1px] ${theme === 'dark' ? 'bg-white/15' : 'bg-white/70'}`} />
                <div className={`absolute inset-y-0 right-[22%] w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-white/50'}`} />
                <div
                  className={`absolute inset-y-0 inset-x-[42%] ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-transparent via-white/[0.18] to-transparent'
                      : 'bg-gradient-to-r from-transparent via-white/80 to-transparent'
                  }`}
                />
              </div>

              {/* Stand Base / Pedestal Foot */}
              <div
                className={`relative w-64 sm:w-72 md:w-80 h-4 sm:h-4.5 rounded-lg border-2 transition-all duration-300 ${
                  theme === 'dark'
                    ? 'bg-gradient-to-b from-[#3A3834] via-[#24221F] to-[#141311] border-white/[0.25] shadow-[0_16px_36px_rgba(0,0,0,0.95)]'
                    : 'bg-gradient-to-b from-[#FFFFFF] via-[#D8CFC0] to-[#9E907B] border-[#665A48] shadow-[0_14px_30px_rgba(35,26,14,0.40),0_4px_10px_rgba(35,26,14,0.25),inset_0_1.5px_0_#FFFFFF,inset_0_-2.5px_3px_rgba(40,30,15,0.40)]'
                }`}
              >
                {/* Precision top chamfer specular highlight */}
                <div
                  className={`absolute inset-x-2 top-0 h-[1.5px] ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-transparent via-white/60 to-transparent'
                      : 'bg-gradient-to-r from-transparent via-white to-transparent'
                  }`}
                />
                {/* Subtle recessed indentation center groove */}
                <div
                  className={`absolute bottom-1 inset-x-[44%] h-[1px] ${
                    theme === 'dark' ? 'bg-white/15' : 'bg-[#5A4F3D]/40'
                  }`}
                />
              </div>

              {/* Three-Tier Realistic Desk Contact Shadows */}
              {/* 1. Sharp dark occlusion line where metal touches desk */}
              <div
                className={`w-64 sm:w-72 md:w-80 h-1.5 rounded-full blur-[1.5px] -mt-1 transition-colors duration-300 ${
                  theme === 'dark' ? 'bg-black/90' : 'bg-[#150F08]/90'
                }`}
              />
              {/* 2. Medium ambient contact blur spreading around the base */}
              <div
                className={`w-72 sm:w-80 md:w-96 h-3.5 rounded-full blur-md -mt-1.5 transition-colors duration-300 ${
                  theme === 'dark' ? 'bg-black/85' : 'bg-[#2A1E0E]/55'
                }`}
              />
              {/* 3. Wide soft studio shadow spread across the desk */}
              <div
                className={`w-80 sm:w-96 md:w-[460px] h-7 rounded-full blur-2xl -mt-2.5 transition-colors duration-300 ${
                  theme === 'dark' ? 'bg-black/80' : 'bg-[#352512]/40'
                }`}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Full Matching Luxury Vesper-Theme Footer */}
      <Footer theme={theme} />
    </div>
  );
}
