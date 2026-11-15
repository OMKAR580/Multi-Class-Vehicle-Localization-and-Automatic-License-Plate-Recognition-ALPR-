'use client';

import React, { useState } from 'react';
import TiltedGridHero, { TiltedGridImage } from '../ui/tilted-grid-hero';

interface MultiClassVehicleSectionProps {
  theme?: 'dark' | 'beige';
}

export interface VehicleClassDetail extends TiltedGridImage {
  description: string;
}

// 8 Verified Classes from ai/detection/vehicle_detector.py & UVH-26 dataset
const VEHICLE_CLASSES: VehicleClassDetail[] = [
  {
    sequence: '01',
    classId: 'car',
    classNameTitle: 'Cars',
    role: 'PASSENGER SEDANS, HATCHBACKS & SUVS',
    src: '/assets/real_suv.jpg',
    bbox: '[214, 148, 776, 542]',
    cam: 'CAM-01 // PASSENGER',
    confidence: '99.4%',
    alt: 'Cars — Passenger Sedans, Hatchbacks & SUVs',
    description:
      'Identifies everyday private passenger vehicles across multi-lane highways and urban arterial corridors under dense traffic conditions.',
  },
  {
    sequence: '02',
    classId: 'truck',
    classNameTitle: 'Trucks',
    role: 'HEAVY COMMERCIAL HAULAGE & FREIGHT',
    src: '/assets/real_truck.jpg',
    bbox: '[142, 84, 698, 442]',
    cam: 'CAM-03 // FREIGHT CHASSIS',
    confidence: '98.8%',
    alt: 'Trucks — Heavy Commercial Haulage & Freight',
    description:
      'Detects multi-axle cargo transports, container haulers, and tippers with elevated commercial registration plate fixtures.',
  },
  {
    sequence: '03',
    classId: 'bus',
    classNameTitle: 'Buses',
    role: 'PUBLIC TRANSIT & INTERCITY COACHES',
    src: '/assets/real_bus.jpg',
    bbox: '[116, 70, 712, 456]',
    cam: 'CAM-05 // TRANSIT COACH',
    confidence: '99.1%',
    alt: 'Buses — Public Transit & Intercity Coaches',
    description:
      'Localizes state transit buses, municipal coaches, and private transport carriers operating with high ground-clearance mounts.',
  },
  {
    sequence: '04',
    classId: 'motorbike',
    classNameTitle: 'Motorcycles',
    role: 'TWO-WHEELERS & COMMUTER BIKES',
    src: '/assets/real_bullet.jpg',
    bbox: '[308, 192, 692, 614]',
    cam: 'CAM-04 // DUAL-AXLE COMMUTER',
    confidence: '97.9%',
    alt: 'Motorcycles — Two-Wheelers & Commuter Bikes',
    description:
      'Isolates high-frequency commuter motorcycles and scooters featuring compact vertical and mudguard registration geometry.',
  },
  {
    sequence: '05',
    classId: 'three_wheeler',
    classNameTitle: 'Three-Wheelers',
    role: 'AUTO RICKSHAWS & TRIKES',
    src: '/assets/real_autorickshaw.jpg',
    bbox: '[256, 164, 744, 596]',
    cam: 'CAM-02 // URBAN LAST-MILE',
    confidence: '98.6%',
    alt: 'Three-Wheelers — Auto-Rickshaws & Trikes',
    description:
      'Recognizes iconic Indian auto-rickshaws and cargo trikes operating in high density, turbulent urban mixed-traffic streams.',
  },
  {
    sequence: '06',
    classId: 'lcv',
    classNameTitle: 'Light Commercial Vehicles',
    role: 'MINI TRUCKS & DELIVERY VANS',
    src: '/assets/real_lcv.jpg',
    bbox: '[164, 92, 686, 428]',
    cam: 'CAM-06 // UTILITY LOGISTICS',
    confidence: '98.2%',
    alt: 'Light Commercial Vehicles — Mini Trucks & Delivery Vans',
    description:
      'Identifies last-mile utility pickups, tempo vans, and intra-city distribution vehicles crucial to urban supply chains.',
  },
  {
    sequence: '07',
    classId: 'bicycle',
    classNameTitle: 'Bicycles',
    role: 'NON-MOTORIZED PEDAL CYCLES',
    src: '/assets/real_bicycle.jpg',
    bbox: '[182, 114, 648, 446]',
    cam: 'CAM-07 // VULNERABLE USER',
    confidence: '96.7%',
    alt: 'Bicycles — Non-Motorized Pedal Cycles',
    description:
      'Localizes non-motorized pedal cycles to safeguard vulnerable roadway users and support segregated lane analytics.',
  },
  {
    sequence: '08',
    classId: 'other',
    classNameTitle: 'Other Vehicles',
    role: 'SPECIALIZED ROADWAY MACHINERY',
    src: '/assets/real_other.jpg',
    bbox: '[154, 88, 704, 418]',
    cam: 'CAM-08 // AUX ROADWAY UNIT',
    confidence: '95.4%',
    alt: 'Other Vehicles — Specialized Roadway Machinery',
    description:
      'Detects construction machinery, municipal maintenance tractors, and unclassified mobile units outside standard categories.',
  },
];

export default function MultiClassVehicleSection({ theme = 'dark' }: MultiClassVehicleSectionProps) {
  const isDark = theme === 'dark';
  const [inspectedClass, setInspectedClass] = useState<VehicleClassDetail | null>(null);

  return (
    <section
      id="vehicle-intelligence"
      className={`relative pt-10 sm:pt-14 lg:pt-18 pb-16 sm:pb-24 lg:pb-28 transition-colors duration-400 overflow-hidden ${isDark ? 'bg-black text-white' : 'bg-[#E8DEC8] text-[#1A1815]'
        }`}
    >
      {/* Background ambient radial highlight */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[500px] rounded-full blur-[120px] transition-opacity duration-700 ${isDark ? 'bg-emerald-500/[0.035]' : 'bg-emerald-700/[0.04]'
            }`}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* =================================================================== */}
        {/* 1. EDITORIAL SECTION HEADER (PROMINENT TOP POSITION, ZERO OVERLAP)  */}
        {/* =================================================================== */}
        <div className="text-center max-w-3xl mx-auto space-y-4 pt-2">
          {/* Eyebrow Pill */}
          <div
            className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300 shadow-sm backdrop-blur-md ${isDark
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.1)]'
                : 'bg-emerald-800/10 border-emerald-700/30 text-emerald-900 shadow-sm'
              }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${isDark ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-emerald-600 shadow-[0_0_6px_#059669]'
                  }`}
              />
            </span>
            <span>MULTI-CLASS VEHICLE INTELLIGENCE // 08 CLASSES</span>
            <span className="w-1.5 h-3 bg-emerald-500 animate-pulse" />
          </div>

          {/* Luxury Main Section Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12]">
            <span className={isDark ? 'text-white' : 'text-[#1A1815]'}>
              One Vision.{' '}
            </span>
            <span className="font-serif italic font-normal bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 dark:from-amber-400 dark:via-amber-300 dark:to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
              Eight Vehicle Classes.
            </span>
          </h2>

          {/* Supporting Editorial Description */}
          <p
            className={`text-sm sm:text-base md:text-lg font-normal leading-relaxed max-w-2xl mx-auto text-balance ${isDark ? 'text-zinc-400' : 'text-[#5C5346]'
              }`}
          >
            Engineered specifically for Indian mixed-traffic complexity — from high-frequency commuter auto-rickshaws to multi-axle freight haulers, verified across 8 distinct roadway taxonomy classes.
          </p>
        </div>

        {/* =================================================================== */}
        {/* 2. TILTED GRID CYLINDRICAL CURVED HERO (AI TELEMETRY STREAM)        */}
        {/* =================================================================== */}
        <div className="relative w-full overflow-hidden rounded-2xl">
          <TiltedGridHero
            images={VEHICLE_CLASSES}
            speed={5}
            tileHeight={42}
            aspectRatio={16 / 10}
            gap={6}
            axis={50}
            curve={70}
            fade={14}
            pauseOnHover={true}
            onTileClick={(img) => setInspectedClass(img as VehicleClassDetail)}
            className="w-full h-[460px] sm:h-[500px] md:h-[540px] bg-transparent"
          >
            {/* Subtle bottom-center interaction indicator */}
            <div className="relative z-10 flex h-full flex-col justify-end items-center pb-4 pointer-events-none">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-mono tracking-wider uppercase border transition-colors duration-300 ${isDark
                    ? 'bg-[#0E0D0B]/80 border-white/10 text-zinc-300 shadow-lg'
                    : 'bg-white/80 border-[#D8CFBF] text-[#5C5346] shadow-sm'
                  }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Hover Stream to Pause • Click Any Vehicle to Inspect</span>
              </div>
            </div>
          </TiltedGridHero>
        </div>

        {/* =================================================================== */}
        {/* 3. INTERACTIVE 8-CLASS INTELLIGENCE RIBBON                          */}
        {/* =================================================================== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className={`text-xs font-mono tracking-wider uppercase font-semibold ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
              Verified Model Taxonomy // Click Class to Inspect Sensor
            </span>
            <span className="text-[11px] font-mono text-emerald-500 dark:text-emerald-400 font-medium">
              8 of 8 Classes Calibrated
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {VEHICLE_CLASSES.map((item) => (
              <button
                key={item.classId}
                onClick={() => setInspectedClass(item)}
                className={`group relative text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer ${isDark
                    ? 'bg-[#0E0D0B] border-white/[0.08] hover:border-emerald-500/50 hover:bg-[#14120E] shadow-sm'
                    : 'bg-[#F9F7F2] border-[#D8CFBF] hover:border-emerald-600/50 hover:bg-white shadow-[0_2px_8px_rgba(40,30,15,0.04)]'
                  }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-amber-500 dark:text-amber-400">
                    {item.sequence}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform" />
                </div>
                <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-[#1A1815]'}`}>
                  {item.classNameTitle}
                </div>
                <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  cls: {item.classId}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. COMPACT TELEMETRY SPECIFICATION STRIP                            */}
        {/* =================================================================== */}
        <div
          className={`rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${isDark
              ? 'bg-[#0E0D0B] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
              : 'bg-[#F9F7F2] border-[#D8CFBF] shadow-[0_6px_24px_rgba(40,30,15,0.08)]'
            }`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6">
            <div className="space-y-1">
              <div className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                DETECTOR ARCHITECTURE
              </div>
              <div className={`text-sm sm:text-base font-bold font-mono ${isDark ? 'text-white' : 'text-[#1A1815]'}`}>
                YOLOv8 Deep Detector
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
                Multi-scale real-time feature pyramid
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                SUPPORTED CATEGORIES
              </div>
              <div className={`text-sm sm:text-base font-bold font-mono ${isDark ? 'text-white' : 'text-[#1A1815]'}`}>
                08 Indian Roadway Classes
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
                Verified against model taxonomy
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                INFERENCE OUTPUT
              </div>
              <div className={`text-sm sm:text-base font-bold font-mono ${isDark ? 'text-white' : 'text-[#1A1815]'}`}>
                Bounding Boxes + Conf
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
                Strict geometric boundary clamping
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                MODEL CHECKPOINT
              </div>
              <div className={`text-sm sm:text-base font-bold font-mono ${isDark ? 'text-white' : 'text-[#1A1815]'}`}>
                Custom Model (best.pt)
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
                Dedicated Indian roadway weights
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 5. SENSOR INSPECTOR MODAL                                           */}
      {/* =================================================================== */}
      {inspectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`relative w-full max-w-2xl rounded-2xl border p-6 sm:p-8 space-y-6 shadow-2xl transition-all duration-300 ${isDark
                ? 'bg-[#0E0D0B] border-white/15 text-white shadow-[0_20px_60px_rgba(0,0,0,0.8)]'
                : 'bg-[#FAF7F0] border-[#D8CFBF] text-[#1A1815] shadow-[0_20px_60px_rgba(40,30,15,0.2)]'
              }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">
                    SEQUENCE {inspectedClass.sequence}
                  </span>
                  <span className="text-xs font-mono text-zinc-400">{'//'}</span>
                  <span className="text-xs font-mono text-emerald-500 dark:text-emerald-400 font-semibold">
                    CLASS ID: {inspectedClass.classId}
                  </span>
                </div>
                <h3 className="text-2xl font-bold tracking-tight">
                  {inspectedClass.classNameTitle}
                </h3>
                <p className="text-xs font-mono uppercase tracking-wider text-amber-500/90 dark:text-amber-400/90">
                  {inspectedClass.role}
                </p>
              </div>

              <button
                onClick={() => setInspectedClass(null)}
                className={`p-2 rounded-xl border transition-colors ${isDark
                    ? 'border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white'
                    : 'border-[#D8CFBF] hover:bg-[#E8DEC8] text-[#5C5346] hover:text-[#1A1815]'
                  }`}
                aria-label="Close Inspector"
              >
                ✕
              </button>
            </div>

            {/* Annotated Image Frame */}
            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={inspectedClass.src}
                alt={inspectedClass.alt ?? ''}
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Reticle Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

              <div className="absolute inset-[15%] pointer-events-none border border-emerald-500/40 rounded">
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-emerald-500/50 text-[10px] font-mono text-emerald-300 font-bold">
                  ● {(inspectedClass.classId || 'DETECTED').toUpperCase()} {'//'} {inspectedClass.confidence}
                </div>
              </div>

              {/* Bottom Scrim Info */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-[10px] font-mono text-zinc-300 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <span className="text-emerald-400">{inspectedClass.cam}</span>
                <span>BBOX: {inspectedClass.bbox}</span>
              </div>
            </div>

            {/* Description & Technical Role */}
            <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-[#4A4237]'}`}>
              {inspectedClass.description}
            </p>

            {/* Footer action */}
            <div className="flex items-center justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setInspectedClass(null)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-colors ${isDark
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-[#1A1815] text-[#FAF7F0] hover:bg-black'
                  }`}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}