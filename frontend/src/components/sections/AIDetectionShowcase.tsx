'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Layers,
  Scan,
  Cpu,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Car,
  FileCode,
  Binary,
  SlidersHorizontal,
  Eye,
  ZoomIn,
  Truck,
  Activity,
  Maximize2,
  Box,
} from 'lucide-react';

// Dynamically import Three.js 3D Machine to avoid SSR WebGL context errors
import type { AgenticFactory3DProps } from '../ui/agentic-factory-3d';

const AgenticFactory3D = dynamic<AgenticFactory3DProps>(
  () => import('../ui/agentic-factory-3d'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] sm:h-[580px] lg:h-[640px] flex flex-col items-center justify-center font-mono text-xs gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="tracking-widest uppercase opacity-70">Initializing 3D Autonomous Pipeline...</span>
      </div>
    ),
  }
);

interface AIDetectionShowcaseProps {
  theme?: 'dark' | 'beige';
}

type ShowcaseTab = '3d-engine' | 'vehicle' | 'plate' | 'contract';

interface DemoVehicle {
  id: string;
  className: string;
  confidence: number;
  bbox: [number, number, number, number]; // [xmin, ymin, xmax, ymax]
  sensorGantry: string;
  hasPlate: boolean;
  plateText?: string;
  plateState?: string;
}

// Illustrative Ground-Truth Demonstrations for Indian Highway Corridor
const DEMO_VEHICLES: DemoVehicle[] = [
  {
    id: 'veh-01',
    className: 'Car (SUV)',
    confidence: 0.984,
    bbox: [224, 148, 776, 542],
    sensorGantry: 'NH-48 Gantry Cam #01',
    hasPlate: true,
    plateText: 'DL 10 CA 4829',
    plateState: 'DL // NCT of Delhi (West RTO)',
  },
  {
    id: 'veh-02',
    className: 'Three-Wheeler',
    confidence: 0.976,
    bbox: [48, 190, 240, 480],
    sensorGantry: 'Arterial Curb Sensor #02',
    hasPlate: true,
    plateText: 'DL 1R 1947',
    plateState: 'DL // NCT of Delhi (North RTO)',
  },
  {
    id: 'veh-03',
    className: 'Truck (Commercial)',
    confidence: 0.962,
    bbox: [760, 110, 960, 490],
    sensorGantry: 'Freight Bypass Gantry #03',
    hasPlate: true,
    plateText: 'HR 55 AB 3012',
    plateState: 'HR // Haryana (Gurugram RTO)',
  },
];

const CONTRACT_CODE = `{
  "job_id": "job_nh48_gantry_04",
  "status": "COMPLETED",
  "processing_time_ms": 42.8,
  "media_type": "image",
  "image_width": 1920,
  "image_height": 1080,
  "vehicles": [
    {
      "type": "car",
      "confidence": 0.984,
      "bbox": [224, 148, 776, 542],
      "plate": {
        "text": "DL10CA4829",
        "confidence": 0.986,
        "bbox": [384, 432, 616, 488],
        "rto_validation": {
          "state_code": "DL",
          "state_name": "NCT of Delhi",
          "rto_office": "West Delhi (Janakpuri)",
          "syntax_valid": true
        }
      }
    }
  ]
}`;

export default function AIDetectionShowcase({ theme = 'dark' }: AIDetectionShowcaseProps) {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('3d-engine');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('veh-01');
  const [copiedCode, setCopiedCode] = useState(false);
  const [ocrBinarizeToggle, setOcrBinarizeToggle] = useState(false);

  const selectedVehicle = DEMO_VEHICLES.find((v) => v.id === selectedVehicleId) || DEMO_VEHICLES[0];

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(CONTRACT_CODE)
        .then(() => {
          setCopiedCode(true);
          setTimeout(() => setCopiedCode(false), 2000);
        })
        .catch(() => {
          setCopiedCode(true);
          setTimeout(() => setCopiedCode(false), 2000);
        });
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <section
      id="detection-showcase"
      className={`relative pt-12 sm:pt-16 lg:pt-20 pb-20 sm:pb-28 lg:pb-32 transition-colors duration-400 overflow-hidden ${
        isDark ? 'bg-black text-white' : 'bg-[#E8DEC8] text-[#1A1815]'
      }`}
    >
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] sm:w-[1000px] h-[550px] rounded-full blur-[130px] transition-opacity duration-700 ${
            isDark ? 'bg-emerald-500/[0.035]' : 'bg-emerald-700/[0.04]'
          }`}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* =================================================================== */}
        {/* 1. SECTION IDENTITY & EDITORIAL HEADER                              */}
        {/* =================================================================== */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 space-y-4">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300 shadow-sm backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isDark ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-emerald-600 shadow-[0_0_6px_#059669]'
              }`}
            />
            <span className={isDark ? 'text-emerald-400/90' : 'text-emerald-800'}>
              AI DETECTION SHOWCASE // STAGE 04
            </span>
            <span className="w-1.5 h-3 bg-emerald-500 animate-pulse" />
          </div>

          {/* Primary Section Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[46px] font-bold tracking-tight leading-[1.14]">
            <span>Intelligence </span>
            <span className="font-serif-italic font-normal text-amber-500 dark:text-amber-400">
              Beyond Detection.
            </span>
          </h2>

          {/* Supporting Text */}
          <p
            className={`text-base sm:text-lg font-normal leading-relaxed max-w-2xl mx-auto ${
              isDark ? 'text-zinc-400' : 'text-[#5C5346]'
            }`}
          >
            From identifying diverse vehicles to recognizing Indian registration plates, experience the intelligence behind every detection.
          </p>

          {/* Architectural Notice: Illustrative Demonstration Pill */}
          <div className="pt-2 flex items-center justify-center">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-[11px] font-mono backdrop-blur-md ${
                isDark
                  ? 'bg-white/[0.03] border-white/10 text-zinc-400'
                  : 'bg-black/[0.03] border-black/10 text-[#6B6152]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Interactive 3D Autonomous Pipeline</span>
              <span className="opacity-40">•</span>
              <span className="text-emerald-500 font-semibold">Live Ingestion Reserved for Studio</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. FOUR-STAGE INTERCONNECTED DEMONSTRATION SWITCHER                 */}
        {/* =================================================================== */}
        <div
          className={`flex justify-center overflow-x-auto pb-2 scrollbar-none transition-all duration-300 ${
            activeTab === '3d-engine' ? 'mb-2 sm:mb-3' : 'mb-8 sm:mb-10'
          }`}
        >
          <div
            className={`inline-flex p-1.5 rounded-2xl border backdrop-blur-md gap-1 sm:gap-2 ${
              isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
            }`}
          >
            {/* Tab 0: 3D Autonomous Pipeline Engine */}
            <button
              onClick={() => setActiveTab('3d-engine')}
              className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                activeTab === '3d-engine'
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                    : 'bg-emerald-600/15 text-emerald-800 border border-emerald-600/40 shadow-sm'
                  : 'text-current/60 hover:text-current'
              }`}
            >
              <Box className="w-4 h-4 text-emerald-500" />
              <span>3D Pipeline Engine</span>
            </button>

            {/* Tab A: Vehicle Detection */}
            <button
              onClick={() => setActiveTab('vehicle')}
              className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                activeTab === 'vehicle'
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                    : 'bg-emerald-600/15 text-emerald-800 border border-emerald-600/40 shadow-sm'
                  : 'text-current/60 hover:text-current'
              }`}
            >
              <Car className="w-4 h-4 text-emerald-500" />
              <span>01. Vehicle Localization</span>
            </button>

            {/* Tab B: License Plate Recognition */}
            <button
              onClick={() => setActiveTab('plate')}
              className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                activeTab === 'plate'
                  ? isDark
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                    : 'bg-[#B27D22]/15 text-[#8A6318] border border-[#B27D22]/40 shadow-sm'
                  : 'text-current/60 hover:text-current'
              }`}
            >
              <Scan className="w-4 h-4 text-amber-500" />
              <span>02. License Plate OCR</span>
            </button>

            {/* Tab C: Structured Intelligence */}
            <button
              onClick={() => setActiveTab('contract')}
              className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                activeTab === 'contract'
                  ? isDark
                    ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                    : 'bg-black/10 text-black border border-black/20 shadow-sm'
                  : 'text-current/60 hover:text-current'
              }`}
            >
              <FileCode className="w-4 h-4 text-sky-400" />
              <span>03. Structured Contract</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. SHOWCASE DEMONSTRATION CONTENT STAGE                             */}
        {/* =================================================================== */}
        {activeTab === '3d-engine' ? (
          /* Pure floating 3D Pipeline with zero outer container/box */
          <div className="relative w-full h-[520px] sm:h-[580px] lg:h-[640px] -mt-2 sm:-mt-4 lg:-mt-6 animate-fadeIn">
            <AgenticFactory3D height="100%" className="w-full" />
          </div>
        ) : (
          <div
            className={`relative rounded-3xl border p-6 sm:p-8 lg:p-10 transition-all duration-300 ${
              isDark
                ? 'bg-[#0E0D0B] border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.7)]'
                : 'bg-[#FAF8F5] border-[#D0C5B3] shadow-[0_16px_45px_rgba(40,30,15,0.1)]'
            }`}
          >
            {/* Specular Edge Top Highlight */}
            <div
              className={`absolute inset-x-8 top-0 h-[1.5px] pointer-events-none ${
                isDark
                  ? 'bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-[#B27D22]/60 to-transparent'
              }`}
            />

            {/* ----------------------------------------------------------------- */}
            {/* STAGE A: VEHICLE DETECTION (MULTI-CLASS LOCALIZATION)             */}
            {/* ----------------------------------------------------------------- */}
            {activeTab === 'vehicle' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
              {/* Left Viewport: Illustrative Traffic Frame with Reticles */}
              <div className="lg:col-span-7 space-y-4">
                <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-emerald-500/40 bg-black shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/real_suv.jpg"
                    alt="Illustrative Indian roadway traffic frame"
                    className="w-full h-full object-cover"
                  />

                  {/* Surveillance Camera Grading */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35 pointer-events-none" />

                  {/* Corner Reticle Calipers */}
                  <div className="absolute inset-4 pointer-events-none">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                  </div>

                  {/* Top-left Telemetry Tag */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/85 backdrop-blur-md border border-emerald-500/60 text-[10px] font-mono text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>YOLOV8 MULTI-CLASS INFERENCE FRAME</span>
                  </div>

                  {/* Dynamic Bounding Box Overlay for Selected Vehicle */}
                  <div
                    style={{
                      left: `${(selectedVehicle.bbox[0] / 1000) * 100}%`,
                      top: `${(selectedVehicle.bbox[1] / 600) * 100}%`,
                      width: `${((selectedVehicle.bbox[2] - selectedVehicle.bbox[0]) / 1000) * 100}%`,
                      height: `${((selectedVehicle.bbox[3] - selectedVehicle.bbox[1]) / 600) * 100}%`,
                    }}
                    className="absolute border-2 border-emerald-400 bg-emerald-500/10 transition-all duration-300 shadow-[0_0_16px_rgba(16,185,129,0.4)] pointer-events-none"
                  >
                    {/* Bounding Box Corner Reticles */}
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-white" />
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-white" />
                    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-white" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-white" />

                    {/* Floating Label */}
                    <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-mono font-bold tracking-wider uppercase shadow-md flex items-center gap-1 whitespace-nowrap">
                      <span>{selectedVehicle.className}</span>
                      <span>•</span>
                      <span>{(selectedVehicle.confidence * 100).toFixed(1)}%</span>
                    </div>

                    {/* Coordinates Stamp */}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono text-zinc-300">
                      [{selectedVehicle.bbox.join(', ')}]
                    </div>
                  </div>

                  {/* Center Optical Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                    <div className="w-8 h-[1px] bg-emerald-400" />
                    <div className="h-8 w-[1px] bg-emerald-400 -ml-4" />
                  </div>
                </div>

                {/* Sub-label */}
                <div className="flex items-center justify-between text-[11px] font-mono text-current/50 px-1">
                  <span>Illustrative Detection Overlay</span>
                  <span>Target Resolution: 1920 × 1080px (Clamped)</span>
                </div>
              </div>

              {/* Right Column: Vehicle Telemetry Breakdown & Class Selector */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-600 dark:text-emerald-400 mb-2">
                    <Car className="w-3.5 h-3.5" />
                    <span>CAPABILITY 01 // MULTI-CLASS LOCALIZATION</span>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">
                    Multi-Class Vehicle Boundary Localization
                  </h3>
                  <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#5C5346]'}`}>
                    VisionPlate AI detects and localizes eight distinct vehicle classes across dense Indian mixed-traffic corridors, ensuring high geometric boundary precision before downstream plate extraction.
                  </p>
                </div>

                {/* Interactive Vehicle Class Selector */}
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-current/70">
                    Select Target Vehicle in Scene
                  </div>

                  <div className="space-y-2">
                    {DEMO_VEHICLES.map((veh) => (
                      <button
                        key={veh.id}
                        onClick={() => setSelectedVehicleId(veh.id)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs font-mono transition-all duration-200 flex items-center justify-between ${
                          selectedVehicleId === veh.id
                            ? isDark
                              ? 'bg-emerald-500/15 border-emerald-400/60 text-white shadow-md'
                              : 'bg-emerald-600/15 border-emerald-600/60 text-black shadow-md'
                            : isDark
                            ? 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/[0.05]'
                            : 'bg-[#F2ECE1] border-[#DCD3C3] text-[#6B6152] hover:bg-[#FAF8F5]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              selectedVehicleId === veh.id ? 'bg-emerald-500 animate-pulse' : 'bg-current/30'
                            }`}
                          />
                          <div>
                            <div className="font-bold text-current">{veh.className}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">{veh.sensorGantry}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-emerald-500">
                            {(veh.confidence * 100).toFixed(1)}% Conf
                          </div>
                          <div className="text-[10px] opacity-60">Clamped Box</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Technical Metric Pills */}
                <div
                  className={`p-4 rounded-2xl border grid grid-cols-2 gap-3 text-xs font-mono ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                  }`}
                >
                  <div>
                    <span className="block text-[10px] text-current/50 uppercase">Categories</span>
                    <span className="font-bold text-current">08 Indian Classes</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-current/50 uppercase">Architecture</span>
                    <span className="font-bold text-emerald-500">YOLOv8 Deep FPN</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STAGE B: LICENSE PLATE RECOGNITION (OCR & STATE VALIDATION)       */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'plate' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
              {/* Left Viewport: Close-up Plate Localization with Vector Lines */}
              <div className="lg:col-span-7 space-y-4">
                <div
                  className={`relative p-6 sm:p-8 rounded-2xl border overflow-hidden flex flex-col items-center justify-center min-h-[340px] transition-all ${
                    ocrBinarizeToggle
                      ? 'bg-zinc-950 border-white/20'
                      : isDark
                      ? 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-black border-white/15'
                      : 'bg-[#F2ECE1] border-[#D0C5B0]'
                  }`}
                >
                  {/* Subtle Background Circuit Lines */}
                  <div className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="w-full h-full bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
                  </div>

                  {/* Mode Indicator Pill */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-500">
                      STAGE 02 ROI // PLATE EXTRACTION
                    </span>
                    <span className="text-[10px] font-mono text-current/40">
                      {ocrBinarizeToggle ? 'Adaptive Binarization Layer' : 'Optical RGB Capture'}
                    </span>
                  </div>

                  {/* Mode Toggle Button */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={() => setOcrBinarizeToggle((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-all ${
                        ocrBinarizeToggle
                          ? 'bg-white text-black border-white shadow-sm'
                          : isDark
                          ? 'bg-white/10 text-zinc-300 border-white/15 hover:bg-white/15'
                          : 'bg-black/5 text-[#4A4235] border-black/10 hover:bg-black/10'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{ocrBinarizeToggle ? 'View RGB Capture' : 'View Binarized OCR'}</span>
                    </button>
                  </div>

                  {/* Centered High Security Registration Plate (HSRP) Graphic */}
                  <div className="relative my-4">
                    <div
                      className={`w-72 sm:w-80 md:w-96 px-5 py-4 rounded-xl border-4 transition-all duration-300 shadow-2xl relative select-none ${
                        ocrBinarizeToggle
                          ? 'bg-white text-black border-black font-mono shadow-[0_0_24px_rgba(255,255,255,0.4)]'
                          : 'bg-[#FAF8F5] text-black border-[#2B2823] shadow-[0_12px_36px_rgba(0,0,0,0.5)]'
                      }`}
                    >
                      {/* Authentic HSRP Blue IND Stripe */}
                      <div className="absolute left-3 top-3 bottom-3 w-6 bg-[#003399] rounded-sm flex flex-col items-center justify-between py-1 text-[7px] text-white font-mono font-bold">
                        <span className="text-[8px]">🇮🇳</span>
                        <span>IND</span>
                      </div>

                      {/* Plate Alphanumeric Characters */}
                      <div className="pl-8 text-center">
                        <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[0.22em] font-mono">
                          DL 10 CA 4829
                        </div>
                        <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mt-1">
                          HIGH SECURITY REGISTRATION PLATE // INDIA
                        </div>
                      </div>

                      {/* Optical Caliper Corner Reticles */}
                      <div className="absolute -inset-2.5 border-2 border-dashed border-amber-400 pointer-events-none rounded-xl">
                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-400" />
                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400" />
                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-amber-400" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-400" />
                      </div>
                    </div>
                  </div>

                  {/* OCR Character Segmentation Stream Chips */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                    {['D', 'L', '1', '0', 'C', 'A', '4', '8', '2', '9'].map((char, cIdx) => (
                      <div
                        key={cIdx}
                        className={`w-7 h-8 rounded border flex flex-col items-center justify-center font-mono transition-transform hover:scale-110 ${
                          cIdx < 2
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                            : cIdx < 4
                            ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                            : 'border-sky-500 bg-sky-500/15 text-sky-400'
                        }`}
                      >
                        <span className="text-xs font-bold">{char}</span>
                        <span className="text-[7px] opacity-70">99%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-label */}
                <div className="flex items-center justify-between text-[11px] font-mono text-current/50 px-1">
                  <span>Illustrative OCR Normalization</span>
                  <span>Syntax: [State: DL] [RTO: 10] [Series: CA] [Digits: 4829]</span>
                </div>
              </div>

              {/* Right Column: OCR Intelligence Breakdown */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-600 dark:text-amber-400 mb-2">
                    <Scan className="w-3.5 h-3.5" />
                    <span>CAPABILITY 02 // SUB-PIXEL OCR INTELLIGENCE</span>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">
                    Sub-Pixel Plate Localization & OCR Normalization
                  </h3>
                  <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#5C5346]'}`}>
                    Once a vehicle is localized, the pipeline clamps the sub-region containing the license plate, performs perspective rectification, strips noise, and validates against all 37 Indian State & UT RTO registries.
                  </p>
                </div>

                {/* RTO State Registry Match Box */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-current/60">State Code Match:</span>
                    <span className="font-bold text-emerald-500">DL // NCT of Delhi</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-current/60">Registered RTO:</span>
                    <span className="font-bold text-current">West Delhi (Janakpuri)</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-current/60">Registry Rule Validation:</span>
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[11px]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>37 State/UT Regex Passed</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-current/10">
                    <span className="text-current/60">OCR Ensemble Engine:</span>
                    <span className="font-bold text-amber-500 dark:text-amber-400">PaddleOCR + Custom Weights</span>
                  </div>
                </div>

                {/* Accuracy Note */}
                <p className="text-[11px] font-mono text-current/50 italic">
                  Note: Illustrative breakdown demonstration. Live video and high-resolution plate extractions are executed inside the authenticated Detection Studio.
                </p>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STAGE C: STRUCTURED INTELLIGENCE (JSON CONTRACT DELIVERY)         */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'contract' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
              {/* Left Column: Code Terminal */}
              <div className="lg:col-span-7 space-y-3">
                <div className="relative rounded-2xl border border-white/15 bg-[#080808] text-white overflow-hidden shadow-2xl">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-[#111111] border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                      </div>
                      <span className="text-xs font-mono text-zinc-400 ml-2">
                        StandardAIOutputContract.json
                      </span>
                    </div>

                    <button
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy Contract'}</span>
                    </button>
                  </div>

                  {/* Terminal Code Body */}
                  <pre className="p-4 sm:p-5 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-[380px]">
                    <code>{CONTRACT_CODE}</code>
                  </pre>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-current/50 px-1">
                  <span>Strict Pydantic Validation Contract</span>
                  <span>Inference Latency: Sub-50ms Edge Engine</span>
                </div>
              </div>

              {/* Right Column: Architectural Value Proposition */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-xs font-mono text-sky-500 mb-2">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>CAPABILITY 03 // STRUCTURED DATA CONTRACT</span>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">
                    Machine-Readable Telemetry for Traffic Infrastructure
                  </h3>
                  <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#5C5346]'}`}>
                    Unstructured camera pixels become type-safe, validated JSON streams with bounded coordinates, class IDs, OCR character sequences, and RTO state mappings ready for tolling systems, law enforcement, and traffic analytics.
                  </p>
                </div>

                {/* Structured Value Cards */}
                <div className="space-y-2.5 text-xs font-mono">
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                    }`}
                  >
                    <span className="text-current/70">Data Format:</span>
                    <span className="font-bold text-emerald-500">Pydantic v2 Contract</span>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                    }`}
                  >
                    <span className="text-current/70">Integration Protocols:</span>
                    <span className="font-bold text-amber-500 dark:text-amber-400">REST API & Webhooks</span>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                    }`}
                  >
                    <span className="text-current/70">Downstream Handshake:</span>
                    <span className="font-bold text-current">Toll Gantries & FastTag Sync</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </section>
  );
}

