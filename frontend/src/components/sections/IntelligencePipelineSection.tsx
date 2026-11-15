'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  Scan,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  Activity,
  Maximize2,
  Code2,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Eye,
  Sliders,
  Compass,
  Lock,
} from 'lucide-react';

interface IntelligencePipelineSectionProps {
  theme?: 'dark' | 'beige';
}

interface PipelineStageData {
  id: string;
  stepNumber: string;
  badge: string;
  title: string;
  headline: string;
  technology: string;
  modelOrEngine: string;
  inputSpecification: string;
  outputSpecification: string;
  coreClassesOrOps: string[];
  description: string;
  telemetryMetrics: { label: string; value: string; unit?: string }[];
  urlRoute: string;
}

const PIPELINE_STAGES: PipelineStageData[] = [
  {
    id: 'stage-01',
    stepNumber: '01',
    badge: 'OBJECT DETECTION',
    title: 'Vehicle Localization',
    headline: 'Multi-Class Vehicle Boundary Localization',
    technology: 'YOLOv8 Object Detector',
    modelOrEngine: 'ai/models/best.pt',
    inputSpecification: 'Raw Roadway Sensor Frame (RGB, up to 1920×1080px)',
    outputSpecification: 'Clamped Bounding Boxes [xmin, ymin, xmax, ymax]',
    coreClassesOrOps: [
      'car',
      'truck',
      'bus',
      'motorbike',
      'three_wheeler',
      'lcv',
      'bicycle',
      'other',
    ],
    description:
      'The initial neural pass detects vehicles within chaotic roadway frames. All bounding coordinates undergo strict geometric boundary clamping to enforce downstream region integrity.',
    telemetryMetrics: [
      { label: 'Architecture', value: 'YOLOv8s Deep Model' },
      { label: 'Classes Detected', value: '8 Indian Categories' },
      { label: 'Boundary Policy', value: 'Strict Clamp [0, 0, W, H]' },
      { label: 'Inference Precision', value: 'FP16 / FP32 Tensor' },
    ],
    urlRoute: 'visionplate.ai/pipeline/vehicle-localization',
  },
  {
    id: 'stage-02',
    stepNumber: '02',
    badge: 'CASCADED ROI',
    title: 'License Plate Localization',
    headline: 'Sub-Vehicle License Plate ROI Isolation',
    technology: 'YOLOv8 Plate Detector',
    modelOrEngine: 'ai/models/yolov8_plate.pt',
    inputSpecification: 'Cropped Vehicle Region Matrix (v_crop)',
    outputSpecification: 'Relative Sub-Coordinates mapped to Global Image Space',
    coreClassesOrOps: [
      'Sub-region Crop',
      'Plate ROI Detection',
      'Coordinate Remapping',
      'Boundary Enforcement',
    ],
    description:
      'Rather than scanning full noisy images for microscopic plate regions, the pipeline isolates vehicle crops first. A specialized YOLOv8 plate model then pinpoints the license plate coordinates.',
    telemetryMetrics: [
      { label: 'Model Checkpoint', value: 'yolov8_plate.pt' },
      { label: 'Cascade Method', value: 'Two-Tier Hierarchical' },
      { label: 'Transform Matrix', value: 'Relative to Master Canvas' },
      { label: 'False Positive Filter', value: 'Spatial Rejection Filter' },
    ],
    urlRoute: 'visionplate.ai/pipeline/plate-localization',
  },
  {
    id: 'stage-03',
    stepNumber: '03',
    badge: 'IMAGE PREPROCESSING',
    title: 'Image Preprocessing',
    headline: 'Optical Matrix Contrast Normalization',
    technology: 'OpenCV Processing Pipeline',
    modelOrEngine: 'ImagePreprocessor (OpenCV cv2)',
    inputSpecification: 'Cropped License Plate RGB Sub-Matrix',
    outputSpecification: 'High-Contrast Binarized Dewarped Plate Matrix',
    coreClassesOrOps: [
      'Grayscale Conversion',
      'Adaptive Binarization',
      'Skew Correction',
      'Aspect-Ratio Resizing',
    ],
    description:
      'Raw license plate crops suffer from glare, vibrations, and angular distortion. OpenCV routines convert the image to single-channel luminance, apply adaptive binarization, and correct perspective skew.',
    telemetryMetrics: [
      { label: 'Luminance Pass', value: 'Single-Channel Grayscale' },
      { label: 'Binarization', value: 'Adaptive Thresholding' },
      { label: 'Geometry Pass', value: 'Planar Skew Dewarping' },
      { label: 'Target Aspect', value: 'Standard OCR Matrix' },
    ],
    urlRoute: 'visionplate.ai/pipeline/image-preprocessing',
  },
  {
    id: 'stage-04',
    stepNumber: '04',
    badge: 'CHARACTER RECOGNITION',
    title: 'Character Recognition',
    headline: 'Single-Line Alphanumeric OCR Engine',
    technology: 'Tesseract OCR Engine',
    modelOrEngine: 'pytesseract (PSM 7 Single-Line)',
    inputSpecification: 'Normalized Binarized Optical Plate Crop',
    outputSpecification: 'Tokenized Character Stream with Confidence Array',
    coreClassesOrOps: [
      'PSM 7 Segmentation',
      'Alphanumeric Tokenization',
      'Word Confidence Scoring',
      'Stream Concatenation',
    ],
    description:
      'Character recognition is executed using pytesseract configured in Page Segmentation Mode 7 (--psm 7), treating the normalized plate as a single uniform text line with individual word-level confidence ratings.',
    telemetryMetrics: [
      { label: 'Engine Core', value: 'pytesseract' },
      { label: 'Segmentation Mode', value: '--psm 7 (Single Line)' },
      { label: 'Token Scoring', value: 'Average Confidence Aggregation' },
      { label: 'Hallucination Policy', value: 'Zero-Guessing Fallback' },
    ],
    urlRoute: 'visionplate.ai/pipeline/ocr-recognition',
  },
  {
    id: 'stage-05',
    stepNumber: '05',
    badge: 'RESULT INTELLIGENCE',
    title: 'Result Intelligence & Validation',
    headline: 'Structured Registration Intelligence & RTO Verification',
    technology: 'IndianPlateCleaner + Pydantic Contract',
    modelOrEngine: 'StandardAIOutputContract',
    inputSpecification: 'Raw OCR Token Stream + Clamped Bounding Boxes',
    outputSpecification: 'Validated JSON Schema adhering to StandardAIOutputContract',
    coreClassesOrOps: [
      'Regex Noise Stripping',
      '37 State/UT Registry Match',
      'Hierarchical Object Binding',
      'Pydantic Serialization',
    ],
    description:
      'The final intelligence stage strips non-alphanumeric noise, normalizes text into standard uppercase strings, and validates registration state prefixes against all 37 Indian State and Union Territory RTO registries.',
    telemetryMetrics: [
      { label: 'Cleaning Engine', value: 'IndianPlateCleaner' },
      { label: 'State Registries', value: '37 States & UT Codes Verified' },
      { label: 'Output Contract', value: 'StandardAIOutputContract' },
      { label: 'Type Safety', value: 'Strict Pydantic Validation' },
    ],
    urlRoute: 'visionplate.ai/pipeline/result-contract',
  },
];

export default function IntelligencePipelineSection({ theme = 'dark' }: IntelligencePipelineSectionProps) {
  const isDark = theme === 'dark';
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [stage3Filter, setStage3Filter] = useState<'raw' | 'grayscale' | 'binary' | 'dewarped'>('binary');

  const stageItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isManualScrolling = useRef<boolean>(false);

  // Active Stage Object
  const currentStage = PIPELINE_STAGES[activeStageIndex];

  // Sample Output JSON for Stage 05 (matching actual Pydantic schema in ai/pipeline/schema.py)
  const sampleContractJson = {
    image_id: 'roadway_delhi_nh48_gantry04.jpg',
    vehicles: [
      {
        type: 'car',
        confidence: 0.99,
        bbox: [224, 148, 776, 542],
        plate: {
          text: 'DL10CA4829',
          confidence: 0.98,
          bbox: [385, 362, 509, 408],
        },
      },
    ],
  };

  const handleCopyJson = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(sampleContractJson, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2400);
  }, [sampleContractJson]);

  // Window scroll event listener to track active card smoothly (Exact TheEduCode sticky trigger)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleWindowScroll = () => {
      if (isManualScrolling.current) return;
      const triggerY = window.innerHeight * 0.55;
      let activeIdx = 0;

      stageItemRefs.current.forEach((el, idx) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top <= triggerY) {
          activeIdx = idx;
        }
      });

      setActiveStageIndex(activeIdx);
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    handleWindowScroll(); // Initial evaluation
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  // Smoothly scroll window to selected stage when card is clicked
  const handleSelectStage = useCallback((index: number) => {
    isManualScrolling.current = true;
    setActiveStageIndex(index);
    const targetEl = stageItemRefs.current[index];
    if (targetEl) {
      const headerOffset = 140; // Offset for sticky navbar
      const elementPosition = targetEl.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
    setTimeout(() => {
      isManualScrolling.current = false;
    }, 700);
  }, []);

  return (
    <section
      id="pipeline"
      className={`relative w-full pt-20 sm:pt-28 pb-8 sm:pb-12 transition-colors duration-500 overflow-visible ${
        isDark
          ? 'bg-[#000000] text-white border-t border-white/[0.08]'
          : 'bg-[#E8DEC8] text-[#1A1815] border-t border-[#D5CEBF]'
      }`}
    >
      {/* Background Decorative Tech Grid & Ambient Radial Glows */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div
          className={`absolute inset-0 opacity-[0.035] ${isDark ? 'invert' : ''}`}
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
        <div
          className={`absolute -top-32 left-1/3 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none ${
            isDark ? 'bg-amber-500/10' : 'bg-amber-700/10'
          }`}
        />
        <div
          className={`absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none ${
            isDark ? 'bg-emerald-500/[0.04]' : 'bg-emerald-700/[0.05]'
          }`}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* =================================================================== */}
        {/* SECTION HEADER: CENTERED AT TOP                                    */}
        {/* =================================================================== */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-18 space-y-4">
          {/* Eyebrow with Blinking Cursor */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300 shadow-sm backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isDark ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-[#B27D22] shadow-[0_0_6px_#B27D22]'
              }`}
            />
            <span className={isDark ? 'text-amber-300/90' : 'text-[#8A6318]'}>
              THE INTELLIGENCE PIPELINE
            </span>
            <span className="w-1.5 h-3 bg-amber-500 dark:bg-amber-400 animate-pulse" />
          </div>

          {/* Main Section Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[46px] font-bold tracking-tight leading-[1.14]">
            <span>The Intelligence </span>
            <span className="font-serif-italic font-normal text-amber-500 dark:text-amber-400">
              Behind Every Frame.
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className={`text-base sm:text-lg font-normal leading-relaxed max-w-2xl mx-auto ${
              isDark ? 'text-zinc-400' : 'text-[#5C5346]'
            }`}
          >
            From vehicle localization to structured registration intelligence — our multi-stage AI pipeline delivers sub-second license plate recognition.
          </p>
        </div>

        {/* =================================================================== */}
        {/* MAIN DUAL-COLUMN ARCHITECTURE: Left Cards Stack + Right Sticky Mockup*/}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start relative">
          {/* ================================================================= */}
          {/* LEFT COLUMN: Stack of 5 Individual Elevated Feature Cards          */}
          {/* ================================================================= */}
          <div className="lg:col-span-5 xl:col-span-6 space-y-6">
            {/* Stack of 5 Individual Elevated Feature Cards */}
            <div className="space-y-6">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isActive = activeStageIndex === idx;
                return (
                  <div
                    key={stage.id}
                    ref={(el) => {
                      stageItemRefs.current[idx] = el;
                    }}
                    data-stage-index={idx}
                    onClick={() => handleSelectStage(idx)}
                    className={`group relative p-5 sm:p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      isActive
                        ? isDark
                          ? 'bg-[#151412] border-amber-400/60 shadow-[0_16px_36px_rgba(0,0,0,0.85),0_0_20px_rgba(245,158,11,0.14)] ring-1 ring-amber-400/30'
                          : 'bg-[#FAF8F5] border-[#B27D22] shadow-[0_14px_32px_rgba(40,30,15,0.15)] ring-1 ring-[#B27D22]/30'
                        : isDark
                        ? 'bg-[#0E0D0B]/80 border-white/[0.08] hover:border-white/20 hover:bg-[#131210] opacity-80 hover:opacity-100'
                        : 'bg-[#FAF8F5]/80 border-[#D5CEBF] hover:border-[#B27D22]/50 hover:bg-[#FAF8F5] opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkmark / Stage Circle Icon (As on TheEduCode) */}
                      <span
                        className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all mt-0.5 ${
                          isActive
                            ? isDark
                              ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                              : 'bg-[#B27D22] text-[#FAF8F5] border-[#B27D22] shadow-sm'
                            : isDark
                            ? 'bg-white/[0.05] border-white/15 text-zinc-400'
                            : 'bg-[#EAE2D2] border-[#D5CEBF] text-[#6B5E4D]'
                        }`}
                      >
                        {isActive ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <span className="font-mono text-xs font-bold">{stage.stepNumber}</span>
                        )}
                      </span>

                      {/* Card Body */}
                      <div className="flex-1 min-w-0">
                        {/* Title & Badge */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h3 className="text-base sm:text-lg font-bold tracking-tight">
                            {stage.title}
                          </h3>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border flex-shrink-0 ${
                              isActive
                                ? isDark
                                  ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                                  : 'bg-[#B27D22]/15 text-[#6D4C0E] border-[#B27D22]/30'
                                : isDark
                                ? 'bg-white/[0.04] border-white/10 text-zinc-400'
                                : 'bg-black/[0.04] border-[#D5CEBF] text-[#6B5E4D]'
                            }`}
                          >
                            {stage.technology}
                          </span>
                        </div>

                        {/* Description Body */}
                        <p
                          className={`text-xs sm:text-[13px] leading-relaxed mb-3 ${
                            isDark ? 'text-zinc-300' : 'text-[#4A4237]'
                          }`}
                        >
                          {stage.description}
                        </p>

                        {/* Classes or Operation Tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {stage.coreClassesOrOps.map((op, i) => (
                            <span
                              key={i}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                                isActive
                                  ? isDark
                                    ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                                    : 'bg-[#B27D22]/10 text-[#6D4C0E] border border-[#B27D22]/20'
                                  : isDark
                                  ? 'bg-white/[0.04] text-zinc-400 border border-white/[0.06]'
                                  : 'bg-black/[0.03] text-[#6B5E4D] border border-[#D5CEBF]/80'
                              }`}
                            >
                              {op}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* ================================================================= */}
          {/* RIGHT COLUMN: Standalone Sticky Dashboard Workstation Mockup       */}
          {/* Aligned at top, stays locked at top-24 on screen while cards scroll*/}
          {/* ================================================================= */}
          <div className="hidden lg:block lg:col-span-7 xl:col-span-6 lg:sticky lg:top-24 self-start">
            <div
              className={`rounded-2xl border transition-all duration-500 overflow-hidden backdrop-blur-2xl shadow-2xl ${
                isDark
                  ? 'bg-[#11100E] border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.08)]'
                  : 'bg-[#FAF8F5] border-[#CFC5B4] shadow-[0_20px_50px_rgba(40,30,15,0.18)]'
              }`}
            >
              {/* Browser / Workstation Window Chrome (Matching TheEduCode Style) */}
              <div
                className={`flex items-center justify-between px-4 sm:px-5 py-3 border-b ${
                  isDark ? 'bg-black/70 border-white/10' : 'bg-[#EDE5D5] border-[#D5CEBF]'
                }`}
              >
                {/* Traffic Light Dots */}
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                </div>

                {/* Browser URL / Session Address Bar (As on TheEduCode) */}
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[11px] font-mono mx-4 flex-1 max-w-xs justify-center ${
                    isDark
                      ? 'bg-white/[0.04] border-white/10 text-zinc-300'
                      : 'bg-white/80 border-[#D5CEBF] text-[#4A4237]'
                  }`}
                >
                  <Lock className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{currentStage.urlRoute}</span>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono ${
                      isDark
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-emerald-700/15 text-emerald-800 border border-emerald-600/30'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                </div>
              </div>

              {/* Dynamic Interactive Stage Inspection Screen */}
              <div className="p-5 sm:p-6 space-y-5">
                {/* STAGE 01 PREVIEW: Roadway Vehicle Detection Visual */}
                {activeStageIndex === 0 && (
                  <div className="space-y-4">
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-white/10 bg-black">
                      <Image
                        src="/assets/real_suv.jpg"
                        alt="Roadway Vehicle Localization"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                      {/* Clamped Vehicle Bounding Box Overlay */}
                      <div
                        className="absolute border-2 border-emerald-400 rounded transition-all duration-300 shadow-[0_0_20px_rgba(52,211,153,0.6)]"
                        style={{
                          top: '23.4%',
                          left: '23.3%',
                          width: '55.2%',
                          height: '62.5%',
                        }}
                      >
                        <div className="absolute -top-7 left-0 bg-emerald-500 text-black px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-t flex items-center gap-1.5 shadow-md">
                          <Cpu className="w-3 h-3" />
                          <span>CLASS: CAR // CONF: 99.4%</span>
                        </div>
                        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white" />
                        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white" />
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white" />
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white" />
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-zinc-300 backdrop-blur-md bg-black/60 px-3 py-1.5 rounded-lg border border-white/10">
                        <span>SENSOR: HIGHWAY GANTRY CAM #04</span>
                        <span className="text-emerald-400 font-bold">YOLOv8 DETECT</span>
                      </div>
                    </div>

                    {/* Classes Grid Pill Selector */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-mono mb-2 text-current/70">
                        <span>8 SUPPORTED VEHICLE CLASSES:</span>
                        <span className="text-emerald-500 font-bold">ALL ACTIVE</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {currentStage.coreClassesOrOps.map((cls, i) => (
                          <div
                            key={i}
                            className={`p-2 text-center rounded-lg text-[11px] font-mono border transition-all ${
                              cls === 'car'
                                ? isDark
                                  ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold'
                                  : 'bg-[#B27D22]/20 border-[#B27D22] text-[#6D4C0E] font-bold'
                                : isDark
                                ? 'bg-white/[0.04] border-white/10 text-zinc-400'
                                : 'bg-black/[0.04] border-[#D5CEBF] text-[#6B5E4D]'
                            }`}
                          >
                            {cls}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STAGE 02 PREVIEW: Sub-Vehicle Plate Localization Visual */}
                {activeStageIndex === 1 && (
                  <div className="space-y-4">
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-white/10 bg-black">
                      <Image
                        src="/assets/real_suv.jpg"
                        alt="Sub-Vehicle Plate Extraction"
                        fill
                        className="object-cover scale-150 origin-bottom"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

                      <div
                        className="absolute border-2 border-amber-400 rounded transition-all duration-300 shadow-[0_0_25px_rgba(251,191,36,0.8)] animate-pulse"
                        style={{
                          top: '48%',
                          left: '32%',
                          width: '36%',
                          height: '24%',
                        }}
                      >
                        <div className="absolute -top-7 left-0 bg-amber-400 text-black px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-t flex items-center gap-1.5 shadow-md">
                          <Scan className="w-3 h-3" />
                          <span>PLATE ROI // CONF: 98.6%</span>
                        </div>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 text-[10px] font-mono text-zinc-300 backdrop-blur-md bg-black/70 px-3 py-2 rounded-lg border border-amber-400/30 flex items-center justify-between">
                        <span>TRANSFORM: [rel_x + v_xmin, rel_y + v_ymin]</span>
                        <span className="text-amber-400 font-bold">yolov8_plate.pt</span>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border text-xs font-mono space-y-1.5 ${
                        isDark ? 'bg-black/40 border-white/10' : 'bg-[#EAE2D2] border-[#D5CEBF]'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="text-current/60">Relative Plate Bounds:</span>
                        <span className="font-bold">[151, 442, 275, 493]</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-current/60">Global Frame Bounds:</span>
                        <span className="text-amber-500 font-bold">[385, 590, 509, 641]</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STAGE 03 PREVIEW: OpenCV Preprocessing Interactive Filters */}
                {activeStageIndex === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-black/20 border border-current/10">
                      {[
                        { id: 'raw', label: '1. Raw Crop' },
                        { id: 'grayscale', label: '2. Grayscale' },
                        { id: 'binary', label: '3. Adaptive' },
                        { id: 'dewarped', label: '4. Dewarped' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setStage3Filter(tab.id as any)}
                          className={`py-1.5 text-[11px] font-mono rounded-lg transition-all ${
                            stage3Filter === tab.id
                              ? isDark
                                ? 'bg-white/15 text-white font-bold border border-white/20'
                                : 'bg-[#1A1815] text-[#FAF8F5] font-bold'
                              : 'text-current/60 hover:text-current'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative aspect-[16/8] w-full rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-6 bg-zinc-950">
                      {stage3Filter === 'raw' && (
                        <div className="relative w-full max-w-sm h-20 rounded-md border-2 border-white/40 bg-white flex items-center justify-between px-4 text-black shadow-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-700">IND</span>
                            <span className="font-mono text-2xl font-black tracking-widest text-black">
                              DL 10 CA 4829
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500">RAW SENSOR</span>
                        </div>
                      )}

                      {stage3Filter === 'grayscale' && (
                        <div className="relative w-full max-w-sm h-20 rounded-md border-2 border-zinc-500 bg-zinc-300 flex items-center justify-between px-4 text-zinc-900 shadow-lg grayscale">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-700">IND</span>
                            <span className="font-mono text-2xl font-black tracking-widest text-zinc-900">
                              DL 10 CA 4829
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-600">cv2.cvtColor</span>
                        </div>
                      )}

                      {stage3Filter === 'binary' && (
                        <div className="relative w-full max-w-sm h-20 rounded-md border-2 border-zinc-800 bg-black flex items-center justify-between px-4 text-white shadow-2xl">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-2xl font-black tracking-widest text-white drop-shadow-[0_0_2px_#fff]">
                              DL 10 CA 4829
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            ADAPTIVE THRESHOLD
                          </span>
                        </div>
                      )}

                      {stage3Filter === 'dewarped' && (
                        <div className="relative w-full max-w-sm h-20 rounded-md border-2 border-emerald-400/80 bg-black flex items-center justify-between px-4 text-white shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-2xl font-black tracking-widest text-emerald-300">
                              DL 10 CA 4829
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            DEWARPED (0.0° SKEW)
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-mono text-current/70 text-center">
                      OpenCV operations normalize pixel intensity for clean OCR segmentation.
                    </p>
                  </div>
                )}

                {/* STAGE 04 PREVIEW: Tesseract OCR Glyph Breakdown */}
                {activeStageIndex === 3 && (
                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-xl border ${
                        isDark ? 'bg-black/50 border-white/10' : 'bg-[#EAE2D2] border-[#D5CEBF]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-3">
                        <span className="text-current/60">Tesseract --psm 7 Token Stream:</span>
                        <span className="text-amber-500 font-bold">10 GLYPHS EXTRACTED</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {['D', 'L', '1', '0', 'C', 'A', '4', '8', '2', '9'].map((glyph, i) => (
                          <div
                            key={i}
                            className={`flex flex-col items-center justify-center w-9 h-14 rounded-lg border font-mono font-bold transition-all ${
                              isDark
                                ? 'bg-white/[0.08] border-white/20 text-white'
                                : 'bg-[#FAF8F5] border-[#B27D22]/40 text-[#1A1815] shadow-sm'
                            }`}
                          >
                            <span className="text-lg leading-none">{glyph}</span>
                            <span
                              className={`text-[8px] mt-1 ${
                                isDark ? 'text-emerald-400' : 'text-emerald-700'
                              }`}
                            >
                              .98
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div
                        className={`p-3 rounded-lg border ${
                          isDark ? 'bg-black/30 border-white/10' : 'bg-[#EFE8DC] border-[#D5CEBF]'
                        }`}
                      >
                        <span className="text-current/60 block">Engine Configuration:</span>
                        <span className="font-bold text-amber-500">pytesseract --psm 7</span>
                      </div>
                      <div
                        className={`p-3 rounded-lg border ${
                          isDark ? 'bg-black/30 border-white/10' : 'bg-[#EFE8DC] border-[#D5CEBF]'
                        }`}
                      >
                        <span className="text-current/60 block">Confidence Mean:</span>
                        <span className="font-bold text-emerald-500">0.98 (Verified)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STAGE 05 PREVIEW: StandardAIOutputContract JSON Inspector */}
                {activeStageIndex === 4 && (
                  <div className="space-y-4">
                    <div
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-mono ${
                        isDark
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-emerald-700/10 border-emerald-700/30 text-emerald-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                        <span className="font-bold">
                          STATE VERIFIED: DL // NCT OF DELHI (WEST RTO)
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold uppercase">
                        37 RTO REGEX PASS
                      </span>
                    </div>

                    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/90 p-4 font-mono text-[11px] sm:text-xs">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>StandardAIOutputContract.json</span>
                        </span>
                        <button
                          onClick={handleCopyJson}
                          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-zinc-300 transition-colors"
                          title="Copy JSON Payload"
                        >
                          {copiedJson ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 text-[10px]">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[10px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="text-zinc-300 overflow-x-auto leading-relaxed max-h-56 scrollbar-thin">
                        <code>{JSON.stringify(sampleContractJson, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {/* Bottom Telemetry Metrics Strip for Selected Stage */}
                <div
                  className={`pt-4 border-t border-dashed border-current/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono`}
                >
                  {currentStage.telemetryMetrics.map((m, idx) => (
                    <div key={idx}>
                      <span className="text-current/60 block text-[10px]">{m.label}:</span>
                      <span className="font-bold text-current">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* BOTTOM METRIC RIBBON: 4 Pillar Operational Telemetry Ribbons       */}
        {/* =================================================================== */}
        <div className="mt-12 sm:mt-16 pt-8 border-t border-current/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-500 dark:text-amber-400">
                08 Classes
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-current/70">
                Indian Vehicle Types
              </div>
              <p className="text-[11px] text-current/50 font-mono">
                Car, Truck, Bus, 2/3-Wheelers & LCVs
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-500">
                2-Tier
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-current/70">
                Cascaded YOLOv8
              </div>
              <p className="text-[11px] text-current/50 font-mono">
                Vehicle + License Plate Detection
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-500 dark:text-amber-400">
                --psm 7
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-current/70">
                Single-Line OCR
              </div>
              <p className="text-[11px] text-current/50 font-mono">
                Tesseract Alphanumeric Engine
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-500">
                37 RTOs
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-current/70">
                State & UT Registries
              </div>
              <p className="text-[11px] text-current/50 font-mono">
                Verified Indian License Formats
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
