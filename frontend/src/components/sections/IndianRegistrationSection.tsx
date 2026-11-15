'use client';

import React, { useState } from 'react';
import {
  Scan,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Info,
  Layers,
  Cpu,
  Check,
  Copy,
  SlidersHorizontal,
  Workflow,
  Search,
  Hash,
  MapPin,
  FileText,
  BadgeAlert,
} from 'lucide-react';

interface IndianRegistrationSectionProps {
  theme?: 'dark' | 'beige';
}

type CharacterGroup = 'state' | 'rto' | 'series' | 'number';

interface CharacterGroupMeta {
  id: CharacterGroup;
  code: string;
  label: string;
  category: string;
  description: string;
  regexRule: string;
  verifiedMeaning: string;
  accentColor: string;
}

const CHARACTER_GROUPS: CharacterGroupMeta[] = [
  {
    id: 'state',
    code: 'PB',
    label: 'State Identifier',
    category: 'JURISDICTION',
    description: 'Mandatory two-letter ISO alpha-2 state prefix representing the vehicle registration jurisdiction.',
    regexRule: '^[A-Z]{2}$',
    verifiedMeaning: 'Punjab (PB) // Verified against 37 Indian State/UT codes in IndianPlateCleaner',
    accentColor: '#10B981', // Emerald
  },
  {
    id: 'rto',
    code: '10',
    label: 'RTO Office Code',
    category: 'DISTRICT / REGISTRATION AUTHORITY',
    description: 'Two-digit numeric code designating the specific Regional Transport Office (RTO) jurisdiction.',
    regexRule: '^[0-9]{2}$',
    verifiedMeaning: 'RTO Office 10 // Ludhiana District Authority',
    accentColor: '#F59E0B', // Amber
  },
  {
    id: 'series',
    code: 'AB',
    label: 'Alphabetical Series',
    category: 'SERIES CHRONOLOGY',
    description: 'Sequential one or two-letter alphabetical series assigned chronologically to vehicle batches.',
    regexRule: '^[A-Z]{1,3}$',
    verifiedMeaning: 'Series AB // Standard Private Passenger Vehicle Chronology',
    accentColor: '#0EA5E9', // Sky Blue
  },
  {
    id: 'number',
    code: '1234',
    label: 'Registration Number',
    category: 'UNIQUE SERIAL',
    description: 'Unique four-digit numerical sequence assigned to the individual vehicle registration record.',
    regexRule: '^[0-9]{4}$',
    verifiedMeaning: 'Serial 1234 // Validated non-zero numeric identifier',
    accentColor: '#8B5CF6', // Purple/Violet
  },
];

interface PlateCategoryExample {
  id: string;
  categoryTitle: string;
  vehicleType: string;
  plateText: string;
  bgStyle: string;
  textStyle: string;
  borderStyle: string;
  description: string;
  indStripe: boolean;
  stacked?: boolean;
}

const PLATE_CATEGORIES: PlateCategoryExample[] = [
  {
    id: 'private-hsrp',
    categoryTitle: 'Private Passenger Vehicle',
    vehicleType: 'Sedans, SUVs & Hatchbacks',
    plateText: 'DL 10 CA 4829',
    bgStyle: 'bg-[#FAF8F5]',
    textStyle: 'text-black',
    borderStyle: 'border-[#2B2823]',
    description: 'Standard white reflective High Security Registration Plate (HSRP) with authentic blue IND stripe and hot-stamped black characters.',
    indStripe: true,
  },
  {
    id: 'commercial',
    categoryTitle: 'Commercial & Freight Transport',
    vehicleType: 'Taxis, Logistics Trucks & Buses',
    plateText: 'HR 55 AB 3012',
    bgStyle: 'bg-[#FFD100]',
    textStyle: 'text-black',
    borderStyle: 'border-[#2B2823]',
    description: 'Yellow reflective background mandated for commercial carriers, passenger transit, multi-axle freight trucks, and light commercial vehicles.',
    indStripe: true,
  },
  {
    id: 'ev-plate',
    categoryTitle: 'Electric Vehicle (EV)',
    vehicleType: 'Zero-Emission Passenger & Commercial EVs',
    plateText: 'MH 12 EV 8899',
    bgStyle: 'bg-[#0E8A42]',
    textStyle: 'text-white',
    borderStyle: 'border-[#085227]',
    description: 'Distinctive green reflective plate mandated by MoRTH for registered electric vehicles, displaying high contrast white characters.',
    indStripe: true,
  },
  {
    id: 'two-wheeler',
    categoryTitle: 'Two-Wheeler Compact Format',
    vehicleType: 'Motorcycles & Commuter Scooters',
    plateText: 'KA 05\nMN 4411',
    bgStyle: 'bg-[#FAF8F5]',
    textStyle: 'text-black',
    borderStyle: 'border-[#2B2823]',
    description: 'Dual-line stacked format engineered for motorcycles and scooters where horizontal mounting dimensions are geometrically constrained.',
    indStripe: false,
    stacked: true,
  },
];

const PIPELINE_STAGES = [
  {
    step: '01',
    title: 'Plate Localization',
    tech: 'YOLOv8 Deep Plate Detector',
    summary: 'Neural bounding box localized and clamped around license plate ROI.',
  },
  {
    step: '02',
    title: 'Image Preprocessing',
    tech: 'OpenCV Processing Pass',
    summary: 'Grayscale normalization, contrast stretching, and noise thresholding.',
  },
  {
    step: '03',
    title: 'Character OCR',
    tech: 'Tesseract OCR (--psm 7)',
    summary: 'Alphanumeric character sequence extraction in single-line mode.',
  },
  {
    step: '04',
    title: 'Text Normalization',
    tech: 'IndianPlateCleaner Engine',
    summary: 'Whitespace stripping and non-alphanumeric noise elimination.',
  },
  {
    step: '05',
    title: 'Syntax Validation',
    tech: '37 State/UT Regex Matrix',
    summary: 'Validation against Indian jurisdiction standards (e.g., PB, DL, KA).',
  },
];

const STRUCTURED_JSON_EXAMPLE = `{
  "registration_analysis": {
    "raw_ocr_string": "PB 10 AB 1234",
    "normalized_plate": "PB10AB1234",
    "syntax_valid": true,
    "format_classification": "STANDARD_HSRP_4_GROUP",
    "tokens": {
      "state_code": {
        "value": "PB",
        "name": "Punjab",
        "jurisdiction_type": "STATE",
        "verified_code": true
      },
      "rto_code": {
        "value": "10",
        "location": "Ludhiana",
        "district": "Ludhiana East"
      },
      "series": "AB",
      "serial_number": "1234"
    },
    "disclaimer": "Illustrative syntactical interpretation. No live government RTO registry verification."
  }
}`;

export default function IndianRegistrationSection({
  theme = 'dark',
}: IndianRegistrationSectionProps) {
  const isDark = theme === 'dark';
  const [activeGroup, setActiveGroup] = useState<CharacterGroup>('state');
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const selectedGroup = CHARACTER_GROUPS.find((g) => g.id === activeGroup) || CHARACTER_GROUPS[0];

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(STRUCTURED_JSON_EXAMPLE)
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
      id="indian-registration-intelligence"
      className={`relative pt-16 sm:pt-20 lg:pt-28 pb-20 sm:pb-28 lg:pb-36 transition-colors duration-400 overflow-hidden ${
        isDark ? 'bg-black text-white' : 'bg-[#E8DEC8] text-[#1A1815]'
      }`}
    >
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] sm:w-[1050px] h-[520px] rounded-full blur-[140px] transition-opacity duration-700 ${
            isDark ? 'bg-emerald-500/[0.035]' : 'bg-emerald-700/[0.04]'
          }`}
        />
        <div
          className={`absolute bottom-20 right-1/4 w-[500px] h-[350px] rounded-full blur-[120px] transition-opacity duration-700 ${
            isDark ? 'bg-amber-500/[0.025]' : 'bg-amber-700/[0.035]'
          }`}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* =================================================================== */}
        {/* 1. EDITORIAL HEADER & IDENTITY                                      */}
        {/* =================================================================== */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-4">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300 shadow-sm backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isDark ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-emerald-600 shadow-[0_0_6px_#059669]'
              }`}
            />
            <span className={isDark ? 'text-emerald-400/90' : 'text-emerald-800'}>
              INDIAN REGISTRATION INTELLIGENCE // SECTION 06
            </span>
            <span className="w-1.5 h-3 bg-emerald-500 animate-pulse" />
          </div>

          {/* Primary Section Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[46px] font-bold tracking-tight leading-[1.14]">
            <span>Understanding Every Registration. </span>
            <span className="font-serif-italic font-normal text-amber-500 dark:text-amber-400">
              One Intelligent Vision.
            </span>
          </h2>

          {/* Supporting Text */}
          <p
            className={`text-base sm:text-lg font-normal leading-relaxed max-w-2xl mx-auto ${
              isDark ? 'text-zinc-400' : 'text-[#5C5346]'
            }`}
          >
            Built around the structure of Indian vehicle registration plates, transforming visual characters into structured registration intelligence.
          </p>

          {/* Architectural Notice: Educational & Syntactic Scope */}
          <div className="pt-2 flex items-center justify-center">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-[11px] font-mono backdrop-blur-md ${
                isDark
                  ? 'bg-white/[0.03] border-white/10 text-zinc-400'
                  : 'bg-black/[0.03] border-black/10 text-[#6B6152]'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-amber-500" />
              <span>Syntactical Interpretation Model</span>
              <span className="opacity-40">•</span>
              <span className="text-emerald-500 font-semibold">Tesseract OCR & IndianPlateCleaner Integration</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. REGISTRATION ANATOMY: INTERACTIVE HSRP PLATE BREAKDOWN           */}
        {/* =================================================================== */}
        <div
          className={`relative rounded-3xl border p-6 sm:p-8 lg:p-12 transition-all duration-300 mb-12 sm:mb-16 ${
            isDark
              ? 'bg-[#0E0D0B] border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.7)]'
              : 'bg-[#FAF8F5] border-[#D0C5B3] shadow-[0_16px_45px_rgba(40,30,15,0.1)]'
          }`}
        >
          {/* Top specular edge highlight */}
          <div
            className={`absolute inset-x-8 top-0 h-[1.5px] pointer-events-none ${
              isDark
                ? 'bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent'
                : 'bg-gradient-to-r from-transparent via-[#B27D22]/60 to-transparent'
            }`}
          />

          <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-500">
              Interactive Component A // Syntax Segmentation
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Anatomy of an Indian Registration Plate
            </h3>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
              Hover or tap any character group to inspect its jurisdictional meaning, syntactic regex pattern, and processing role.
            </p>
          </div>

          {/* Interactive HSRP Plate Representation */}
          <div className="flex flex-col items-center justify-center my-6">
            <div className="relative group p-2">
              <div
                className={`w-full max-w-xl sm:w-[540px] px-6 sm:px-8 py-5 rounded-2xl border-4 transition-all duration-300 shadow-2xl relative select-none flex items-center justify-between ${
                  isDark
                    ? 'bg-[#FAF8F5] text-black border-[#2B2823] shadow-[0_12px_45px_rgba(0,0,0,0.6)]'
                    : 'bg-[#FAF8F5] text-black border-[#2B2823] shadow-[0_12px_36px_rgba(40,30,15,0.18)]'
                }`}
              >
                {/* Authentic Blue IND Stripe */}
                <div className="w-8 sm:w-9 h-16 sm:h-20 bg-[#003399] rounded-md flex flex-col items-center justify-between py-1.5 text-white font-mono font-bold flex-shrink-0 shadow-inner">
                  <span className="text-[11px]">🇮🇳</span>
                  <div className="w-3.5 h-3.5 rounded-full border border-white/60 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                  </div>
                  <span className="text-[9px] tracking-widest">IND</span>
                </div>

                {/* Plate Alphanumeric Character Clusters */}
                <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4 pl-3 font-mono font-extrabold text-3xl sm:text-4xl md:text-5xl tracking-wider">
                  {/* PB - State Code */}
                  <button
                    onClick={() => setActiveGroup('state')}
                    onMouseEnter={() => setActiveGroup('state')}
                    className={`px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer relative ${
                      activeGroup === 'state'
                        ? 'bg-emerald-500/25 ring-2 ring-emerald-500 scale-105 text-emerald-950 shadow-md'
                        : 'hover:bg-black/5 text-black'
                    }`}
                  >
                    <span>PB</span>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-emerald-600 whitespace-nowrap">
                      STATE
                    </span>
                  </button>

                  {/* 10 - RTO Code */}
                  <button
                    onClick={() => setActiveGroup('rto')}
                    onMouseEnter={() => setActiveGroup('rto')}
                    className={`px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer relative ${
                      activeGroup === 'rto'
                        ? 'bg-amber-500/25 ring-2 ring-amber-500 scale-105 text-amber-950 shadow-md'
                        : 'hover:bg-black/5 text-black'
                    }`}
                  >
                    <span>10</span>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-amber-600 whitespace-nowrap">
                      RTO
                    </span>
                  </button>

                  {/* AB - Series */}
                  <button
                    onClick={() => setActiveGroup('series')}
                    onMouseEnter={() => setActiveGroup('series')}
                    className={`px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer relative ${
                      activeGroup === 'series'
                        ? 'bg-sky-500/25 ring-2 ring-sky-500 scale-105 text-sky-950 shadow-md'
                        : 'hover:bg-black/5 text-black'
                    }`}
                  >
                    <span>AB</span>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-sky-600 whitespace-nowrap">
                      SERIES
                    </span>
                  </button>

                  {/* 1234 - Number */}
                  <button
                    onClick={() => setActiveGroup('number')}
                    onMouseEnter={() => setActiveGroup('number')}
                    className={`px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer relative ${
                      activeGroup === 'number'
                        ? 'bg-purple-500/25 ring-2 ring-purple-500 scale-105 text-purple-950 shadow-md'
                        : 'hover:bg-black/5 text-black'
                    }`}
                  >
                    <span>1234</span>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-purple-600 whitespace-nowrap">
                      NUMBER
                    </span>
                  </button>
                </div>

                {/* Chrome Hot-Stamping Hologram Simulator */}
                <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full border border-zinc-400 bg-gradient-to-tr from-zinc-300 via-amber-200 to-zinc-400 flex items-center justify-center flex-shrink-0 opacity-80 shadow-sm ml-2">
                  <span className="text-[6px] font-mono font-bold text-zinc-700">VP</span>
                </div>
              </div>

              {/* Decorative Corner Calipers */}
              <div className="absolute inset-0 border-2 border-dashed border-emerald-500/30 pointer-events-none rounded-2xl -m-1" />
            </div>

            <span className="text-[11px] font-mono text-current/50 mt-8 italic">
              * Illustrative HSRP plate format demonstration. Does not represent a live vehicle record.
            </span>
          </div>

          {/* Active Character Segment Inspector Card */}
          <div
            className={`mt-6 p-6 rounded-2xl border transition-all duration-300 max-w-3xl mx-auto ${
              isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-current/10">
              <div className="flex items-center gap-3">
                <span
                  className="px-3 py-1 rounded-md text-sm font-mono font-bold text-black"
                  style={{ backgroundColor: selectedGroup.accentColor }}
                >
                  {selectedGroup.code}
                </span>
                <div>
                  <h4 className="font-bold text-lg">{selectedGroup.label}</h4>
                  <span className="text-[10px] font-mono text-current/60 uppercase">
                    {selectedGroup.category}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-current/50">Regex Syntax:</span>
                <code className="px-2 py-0.5 rounded bg-black/30 border border-current/10 text-emerald-400 font-bold">
                  {selectedGroup.regexRule}
                </code>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs font-mono">
              <div>
                <span className="block text-[10px] text-current/50 uppercase">Syntactic Role</span>
                <p className="mt-1 leading-relaxed text-current/80">{selectedGroup.description}</p>
              </div>
              <div>
                <span className="block text-[10px] text-current/50 uppercase">Pipeline Verification</span>
                <p className="mt-1 leading-relaxed font-bold text-emerald-500">
                  {selectedGroup.verifiedMeaning}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. INTELLIGENT CHARACTER INTERPRETATION (5-STAGE PROGRESSION)       */}
        {/* =================================================================== */}
        <div className="mb-12 sm:mb-16 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-500">
              Interactive Component B // Architectural Progression
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              From Plate Crop to Structured Intelligence
            </h3>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
              The five verified processing passes executed by the YOLOv8 + Tesseract + IndianPlateCleaner pipeline.
            </p>
          </div>

          {/* Pipeline Stage Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            {PIPELINE_STAGES.map((stage, sIdx) => (
              <div
                key={stage.step}
                onClick={() => setActiveStageIndex(sIdx)}
                className={`cursor-pointer p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between glow-card-emerald ${
                  activeStageIndex === sIdx
                    ? isDark
                      ? 'bg-emerald-500/15 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'bg-emerald-600/15 border-emerald-600/60 shadow-sm'
                    : isDark
                    ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
                    : 'bg-[#FAF8F5] border-[#D0C5B3] hover:bg-white shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="font-bold text-emerald-500">{stage.step}.</span>
                    <span className="text-[9px] opacity-60">PASS {sIdx + 1}/5</span>
                  </div>
                  <h4 className="font-bold text-sm tracking-tight">{stage.title}</h4>
                  <div className="text-[10px] font-mono text-amber-500 dark:text-amber-400 mt-1">
                    {stage.tech}
                  </div>
                </div>

                <p className={`text-[11px] leading-relaxed mt-3 pt-3 border-t border-current/10 ${
                  isDark ? 'text-zinc-400' : 'text-[#6B6152]'
                }`}>
                  {stage.summary}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. INDIAN REGISTRATION DIVERSITY (FOUR PLATE FORMATS)              */}
        {/* =================================================================== */}
        <div className="mb-12 sm:mb-16 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-500">
              Interactive Component C // Contextual Diversity
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Indian Registration Plate Taxonomy
            </h3>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
              Color coding and dimensional standards governed by the Ministry of Road Transport and Highways (MoRTH).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLATE_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                  isDark
                    ? 'bg-white/[0.02] border-white/10 hover:border-white/20'
                    : 'bg-[#FAF8F5] border-[#D0C5B3] hover:border-black/20'
                }`}
              >
                <div>
                  {/* Category Header */}
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-current/70 mb-1">
                    {cat.categoryTitle}
                  </div>
                  <div className="text-[11px] font-mono opacity-60 mb-4">{cat.vehicleType}</div>

                  {/* Visual Mini Plate Graphic */}
                  <div className="py-3 flex items-center justify-center">
                    <div
                      className={`w-full py-2.5 px-3 rounded-lg border-2 ${cat.bgStyle} ${cat.textStyle} ${cat.borderStyle} font-mono font-extrabold text-center shadow-md relative flex items-center justify-center`}
                    >
                      {cat.indStripe && (
                        <div className="absolute left-1.5 top-1 bottom-1 w-3.5 bg-[#003399] rounded-[2px] flex flex-col items-center justify-center text-[5px] text-white font-bold leading-none">
                          <span>🇮🇳</span>
                        </div>
                      )}
                      <div className={`text-sm sm:text-base tracking-widest whitespace-pre-line ${cat.indStripe ? 'pl-3' : ''}`}>
                        {cat.plateText}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className={`text-[11px] leading-relaxed pt-3 mt-3 border-t border-current/10 ${
                  isDark ? 'text-zinc-400' : 'text-[#6B6152]'
                }`}>
                  {cat.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 5. STRUCTURED INTELLIGENCE (CODE DELIVERY CONTRACT)                */}
        {/* =================================================================== */}
        <div
          className={`relative rounded-3xl border p-6 sm:p-8 lg:p-10 transition-all duration-300 ${
            isDark
              ? 'bg-[#0E0D0B] border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.7)]'
              : 'bg-[#FAF8F5] border-[#D0C5B3] shadow-[0_16px_45px_rgba(40,30,15,0.1)]'
          }`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
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
                      IndianRegistrationOutput.json
                    </span>
                  </div>

                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>

                {/* Terminal Code Body */}
                <pre className="p-4 sm:p-5 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-[340px]">
                  <code>{STRUCTURED_JSON_EXAMPLE}</code>
                </pre>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-current/50 px-1">
                <span>Standardized Syntactic Parsing Schema</span>
                <span>Regex Engine: Python `re` + State Table</span>
              </div>
            </div>

            {/* Right Column: Architectural Integrity & Constraints */}
            <div className="lg:col-span-5 space-y-5">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-600 dark:text-emerald-400 mb-2">
                  <FileCode className="w-3.5 h-3.5" />
                  <span>STRUCTURED REGISTRATION OUTPUT</span>
                </div>
                <h3 className="text-2xl font-bold tracking-tight">
                  Deterministic Alphanumeric Extraction
                </h3>
                <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#5C5346]'}`}>
                  Unstructured plate pixels are mapped into machine-readable JSON payloads containing segmented jurisdiction tokens, normalized alphanumeric strings, and validation flags ready for downstream highway systems.
                </p>
              </div>

              {/* Technical Constraints Box */}
              <div
                className={`p-4 rounded-2xl border space-y-2.5 text-xs font-mono ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                }`}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Supports all 37 Indian State & Union Territory Alpha-2 codes</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Integrated Tesseract PSM 7 single-line alphanumeric OCR configuration</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Sub-pixel bounding box clamping prevents region boundary distortion</span>
                </div>
              </div>

              {/* Legal / Technical Disclaimer */}
              <div
                className={`p-3 rounded-xl border text-[11px] font-mono flex items-start gap-2 ${
                  isDark
                    ? 'bg-amber-500/[0.04] border-amber-500/20 text-amber-300/80'
                    : 'bg-[#B27D22]/[0.06] border-[#B27D22]/20 text-[#8A6318]'
                }`}
              >
                <BadgeAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <span className="leading-relaxed">
                  Syntactical validation verifies format structure only. It does not imply ownership verification or live government RTO registry connectivity.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

