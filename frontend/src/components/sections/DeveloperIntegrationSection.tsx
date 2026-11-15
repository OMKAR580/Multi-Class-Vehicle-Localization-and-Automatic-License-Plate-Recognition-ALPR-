'use client';

import React, { useState } from 'react';
import {
  Terminal,
  FileCode,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  Cpu,
  Layers,
  Workflow,
  ShieldCheck,
  Zap,
  Server,
  Braces,
  Hash,
  Box,
} from 'lucide-react';

interface DeveloperIntegrationSectionProps {
  theme?: 'dark' | 'beige';
}

type CodeTab = 'curl' | 'python' | 'typescript' | 'response';

interface TechItem {
  name: string;
  category: string;
  role: string;
  versionOrDetail: string;
}

const TECH_STACK: TechItem[] = [
  {
    name: 'Python',
    category: 'RUNTIME ENVIRONMENT',
    role: 'Core asynchronous execution environment powering ML inference and backend services.',
    versionOrDetail: 'Python 3.10+ Ecosystem',
  },
  {
    name: 'FastAPI',
    category: 'API FRAMEWORK',
    role: 'High-throughput async REST framework with automatic OpenAPI documentation and strict routing.',
    versionOrDetail: 'Asynchronous ASGI Engine',
  },
  {
    name: 'YOLOv8',
    category: 'NEURAL LOCALIZATION',
    role: 'Deep convolutional architectures for multi-class vehicle detection and license plate ROI localization.',
    versionOrDetail: 'Vehicle & Plate Detectors',
  },
  {
    name: 'OpenCV',
    category: 'COMPUTER VISION',
    role: 'Optical frame decoding, safe spatial clamping, contrast normalization, and dimension validation.',
    versionOrDetail: 'OpenCV cv2 Pipeline',
  },
  {
    name: 'Tesseract OCR',
    category: 'CHARACTER RECOGNITION',
    role: 'Single-line page segmentation mode (PSM 7) for alphanumeric plate character extraction.',
    versionOrDetail: 'Alphanumeric Engine (--psm 7)',
  },
  {
    name: 'Pydantic v2',
    category: 'SCHEMA VALIDATION',
    role: 'Type-safe request verification, bounded geometry constraints, and deterministic JSON schemas.',
    versionOrDetail: 'Strict Contract Delivery',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Asset Submission',
    endpoint: 'POST /api/v1/files/upload',
    description: 'Client submits multipart image asset. Server verifies MIME type, magic bytes, and records authenticated file_id.',
  },
  {
    step: '02',
    title: 'Frame Preprocessing',
    endpoint: 'OpenCV Decoding Pipeline',
    description: 'Asset is safely decoded, validated against decompression limits, and prepared for spatial inference tensor passes.',
  },
  {
    step: '03',
    title: 'Vehicle Localization',
    endpoint: 'YOLOv8 Deep Vehicle Pass',
    description: 'Identifies vehicle classes (car, truck, bus, motorbike) and clamps coordinates [xmin, ymin, xmax, ymax] to frame boundaries.',
  },
  {
    step: '04',
    title: 'Plate ROI Detection',
    endpoint: 'YOLOv8 License Plate Pass',
    description: 'Localizes license plate sub-regions within detected vehicle bounds, enforcing geometric containment.',
  },
  {
    step: '05',
    title: 'OCR & Text Cleaning',
    endpoint: 'Tesseract + IndianPlateCleaner',
    description: 'Extracts alphanumeric characters using PSM 7 and strips non-alphanumeric noise, validating against 37 Indian State/UT codes.',
  },
  {
    step: '06',
    title: 'Structured Delivery',
    endpoint: 'JSON RecognitionResponse',
    description: 'Delivers deterministic, machine-readable JSON containing vehicle categories, bounding boxes, plate text, and job telemetry.',
  },
];

const CODE_SNIPPETS: Record<CodeTab, { title: string; language: string; code: string }> = {
  curl: {
    title: 'cURL (REST Request)',
    language: 'bash',
    code: `# Step 1: Upload traffic frame asset
curl -X POST "https://api.visionplate.ai/api/v1/files/upload" \\
  -H "Authorization: Bearer <your_jwt_token>" \\
  -F "file=@roadway_traffic_frame.jpg"

# Server returns: { "file_id": "file_9d8e7c6b5a4f", "media_type": "image" }

# Step 2: Trigger automated ALPR inference
curl -X POST "https://api.visionplate.ai/api/v1/recognition/images" \\
  -H "Authorization: Bearer <your_jwt_token>" \\
  -H "Content-Type: application/json" \\
  -d '{"file_id": "file_9d8e7c6b5a4f"}'`,
  },
  python: {
    title: 'Python (requests client)',
    language: 'python',
    code: `import requests

BASE_URL = "https://api.visionplate.ai/api/v1"
HEADERS = {"Authorization": "Bearer <your_jwt_token>"}

# 1. Upload high-resolution traffic frame
with open("roadway_frame.jpg", "rb") as f:
    upload = requests.post(
        f"{BASE_URL}/files/upload",
        headers=HEADERS,
        files={"file": f}
    ).json()

file_id = upload["file_id"]

# 2. Trigger automated vehicle localization & ALPR
recognition = requests.post(
    f"{BASE_URL}/recognition/images",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={"file_id": file_id}
).json()

# Process structured vehicle entities & plates
for vehicle in recognition["vehicles"]:
    print(f"Vehicle: {vehicle['type']} (Conf: {vehicle['confidence']:.2f})")
    if vehicle.get("plate"):
        print(f"  Plate: {vehicle['plate']['text']} [{vehicle['plate']['confidence']:.2f}]")`,
  },
  typescript: {
    title: 'TypeScript (Fetch API)',
    language: 'typescript',
    code: `const BASE_URL = 'https://api.visionplate.ai/api/v1';
const token = '<your_jwt_token>';

// 1. Upload roadway frame asset
const formData = new FormData();
formData.append('file', imageBlob, 'roadway_frame.jpg');

const upload = await fetch(\`\${BASE_URL}/files/upload\`, {
  method: 'POST',
  headers: { Authorization: \`Bearer \${token}\` },
  body: formData,
}).then((res) => res.json());

// 2. Execute ALPR inference request
const recognition = await fetch(\`\${BASE_URL}/recognition/images\`, {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${token}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ file_id: upload.file_id }),
}).then((res) => res.json());

console.log('Status:', recognition.status);
console.log('Detected Vehicles:', recognition.vehicles);`,
  },
  response: {
    title: 'RecognitionResponse (JSON)',
    language: 'json',
    code: `{
  "job_id": "job_01h9x8y7z6a5b4c3d2e1",
  "file_id": "file_9d8e7c6b5a4f",
  "status": "COMPLETED",
  "processing_time_ms": 42.8,
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
        "bbox": [384, 432, 616, 488]
      }
    }
  ],
  "error_message": null,
  "created_at": "2026-11-11T12:00:00.000Z"
}`,
  },
};

export default function DeveloperIntegrationSection({
  theme = 'dark',
}: DeveloperIntegrationSectionProps) {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<CodeTab>('curl');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    const textToCopy = CODE_SNIPPETS[activeTab].code;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(textToCopy)
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
      id="developer-integration"
      className={`relative pt-16 sm:pt-20 lg:pt-28 pb-20 sm:pb-28 lg:pb-36 transition-colors duration-400 overflow-hidden ${
        isDark ? 'bg-[#050505] text-white' : 'bg-[#E3D9C3] text-[#1A1815]'
      }`}
    >
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[750px] sm:w-[1000px] h-[520px] rounded-full blur-[140px] transition-opacity duration-700 ${
            isDark ? 'bg-emerald-500/[0.035]' : 'bg-emerald-700/[0.04]'
          }`}
        />
        <div
          className={`absolute bottom-10 right-1/4 w-[500px] h-[350px] rounded-full blur-[120px] transition-opacity duration-700 ${
            isDark ? 'bg-amber-500/[0.025]' : 'bg-amber-700/[0.035]'
          }`}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* =================================================================== */}
        {/* 1. EDITORIAL HEADER & DEVELOPER INTRODUCTION                        */}
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
              DEVELOPER INTEGRATION // SECTION 07
            </span>
            <span className="w-1.5 h-3 bg-emerald-500 animate-pulse" />
          </div>

          {/* Primary Section Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[46px] font-bold tracking-tight leading-[1.14]">
            <span>Built to Integrate. </span>
            <span className="font-serif-italic font-normal text-amber-500 dark:text-amber-400">
              Designed to Scale.
            </span>
          </h2>

          {/* Supporting Text */}
          <p
            className={`text-base sm:text-lg font-normal leading-relaxed max-w-2xl mx-auto ${
              isDark ? 'text-zinc-400' : 'text-[#5C5346]'
            }`}
          >
            Bring intelligent vehicle detection and license plate recognition into your existing applications with a developer-friendly architecture.
          </p>

          {/* Architectural Notice: Backend Capabilities */}
          <div className="pt-2 flex items-center justify-center">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-[11px] font-mono backdrop-blur-md ${
                isDark
                  ? 'bg-white/[0.03] border-white/10 text-zinc-400'
                  : 'bg-black/[0.03] border-black/10 text-[#6B6152]'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-emerald-500" />
              <span>FastAPI REST Architecture</span>
              <span className="opacity-40">•</span>
              <span className="text-amber-500 font-semibold">Interactive OpenAPI / Swagger Integration</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. API INTEGRATION PREVIEW & INTERACTIVE CODE PANEL                 */}
        {/* =================================================================== */}
        <div
          className={`relative rounded-3xl border p-6 sm:p-8 lg:p-10 transition-all duration-300 mb-12 sm:mb-16 ${
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Interactive Code Terminal */}
            <div className="lg:col-span-7 space-y-3">
              <div className="relative rounded-2xl border border-white/15 bg-[#080808] text-white overflow-hidden shadow-2xl">
                {/* Terminal Header & Language Tabs */}
                <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-[#111111] border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 mr-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    {/* Language Switcher Tabs */}
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
                      {(['curl', 'python', 'typescript', 'response'] as CodeTab[]).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase transition-all ${
                            activeTab === tab
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Copy Code Button */}
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Terminal Code Body */}
                <pre className="p-4 sm:p-5 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-[360px] scrollbar-thin">
                  <code>{CODE_SNIPPETS[activeTab].code}</code>
                </pre>
              </div>

              {/* Terminal Footer Sub-label */}
              <div className="flex items-center justify-between text-[11px] font-mono text-current/50 px-1">
                <span>Verified Route: POST /api/v1/recognition/images</span>
                <span>Response Format: Pydantic v2 Schema</span>
              </div>
            </div>

            {/* Right Column: Architectural Integration Highlights */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-600 dark:text-emerald-400 mb-2">
                  <Braces className="w-3.5 h-3.5" />
                  <span>REST API ARCHITECTURE</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Deterministic Endpoint Delivery
                </h3>
                <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#5C5346]'}`}>
                  VisionPlate AI decouples media upload from recognition inference. Applications upload imagery to generate a secure <code className="text-emerald-500 font-mono text-xs">file_id</code>, then trigger ALPR processing to receive bounded vehicle coordinates and normalized plate OCR in a single unified payload.
                </p>
              </div>

              {/* Verified Endpoint Specs */}
              <div className="space-y-2.5 text-xs font-mono">
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                  }`}
                >
                  <span className="text-current/70">Upload Endpoint:</span>
                  <code className="text-emerald-500 font-bold">POST /api/v1/files/upload</code>
                </div>
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                  }`}
                >
                  <span className="text-current/70">Inference Endpoint:</span>
                  <code className="text-amber-500 font-bold">POST /api/v1/recognition/images</code>
                </div>
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                  }`}
                >
                  <span className="text-current/70">Authentication:</span>
                  <span className="font-bold text-current">JWT Bearer Header</span>
                </div>
              </div>

              {/* Interactive Swagger Note */}
              <div
                className={`p-3 rounded-xl border text-[11px] font-mono flex items-start gap-2 ${
                  isDark
                    ? 'bg-emerald-500/[0.04] border-emerald-500/20 text-emerald-300/80'
                    : 'bg-emerald-600/[0.06] border-emerald-600/20 text-emerald-800'
                }`}
              >
                <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                <span className="leading-relaxed">
                  Interactive OpenAPI Swagger UI (/docs) and ReDoc (/redoc) schemas are built directly into the FastAPI backend service.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. SIX-STAGE INTEGRATION WORKFLOW                                   */}
        {/* =================================================================== */}
        <div className="mb-12 sm:mb-16 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-500">
              End-to-End Execution Sequence
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              The 6-Step Recognition Lifecycle
            </h3>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
              From client asset submission to structured payload delivery across the backend pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WORKFLOW_STEPS.map((wf) => (
              <div
                key={wf.step}
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 glow-card-emerald ${
                  isDark
                    ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
                    : 'bg-[#FAF8F5] border-[#D0C5B3] hover:bg-white shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="font-bold text-emerald-500">{wf.step}.</span>
                    <code className="text-[10px] opacity-60 font-mono truncate max-w-[180px]">{wf.endpoint}</code>
                  </div>
                  <h4 className="font-bold text-base tracking-tight mb-2">{wf.title}</h4>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
                    {wf.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. COMPACT TECHNOLOGY STACK VISUALIZATION                           */}
        {/* =================================================================== */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-500">
              Verified Technical Stack
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Engineering Foundations
            </h3>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
              Built exclusively with verified open-source and modern Python deep-learning technologies.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TECH_STACK.map((tech) => (
              <div
                key={tech.name}
                className={`p-4 rounded-2xl border transition-all duration-300 glow-card-gold ${
                  isDark ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]' : 'bg-[#FAF8F5] border-[#D0C5B3] hover:bg-white shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <span className="font-bold text-emerald-500 text-sm">{tech.name}</span>
                  <span className="text-[9px] text-current/50 uppercase">{tech.category}</span>
                </div>
                <div className="text-[10px] font-mono text-amber-500 dark:text-amber-400 mb-2">
                  {tech.versionOrDetail}
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
                  {tech.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

