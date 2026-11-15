'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  FileText,
  Printer,
  Download,
  X,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  Code2,
  GitBranch,
  Key,
  Cpu,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

interface DocItem {
  id: string;
  title: string;
  category: string;
  docId: string;
  date: string;
  version: string;
  filePath: string;
  description: string;
  content: {
    overview: string;
    sections: {
      heading: string;
      body?: string;
      code?: string;
      table?: { headers: string[]; rows: string[][] };
    }[];
  };
}

const DOCUMENTS: DocItem[] = [
  {
    id: 'system-architecture',
    title: 'System Architecture Blueprint',
    category: 'Architecture',
    docId: 'VP-DOC-ARCH-001',
    date: 'November 2026',
    version: 'v1.4.0',
    filePath: 'docs/architecture/system_architecture.md',
    description: 'High-level decoupled architecture blueprint covering Next.js Web Studio, Android Native App, FastAPI Backend, PostgreSQL, and Redis AI worker queue.',
    content: {
      overview: 'The Multi-Class Vehicle Localization and Automatic License Plate Recognition (ALPR) platform is designed as a modular monolith API backend with asynchronous worker queue boundaries and separate cross-platform clients (Web Studio & Android Native Application).',
      sections: [
        {
          heading: '1. High-Level Architecture Diagram',
          code: `                       +-----------------------------------+
                       |        Public / Web Studio        |
                       |       (Next.js + TypeScript)      |
                       +-----------------+-----------------+
                                         |
                                         v
+-----------------------+      +-------------------+      +------------------------+
|  Android Native App   |----->|  FastAPI Backend  |<---->|   PostgreSQL Database  |
| (Kotlin + Jetpack C.) |      |   (Python 3.11)   |      |       (PostgreSQL)     |
+-----------------------+      +---------+---------+      +------------------------+
                                         |
                                         v
                               +-------------------+
                               | Redis Task Queue  |
                               +---------+---------+
                                         |
                                         v
                               +-------------------+
                               |  AI Worker Engine |
                               | (YOLO + OCR Model)|
                               +-------------------+`,
        },
        {
          heading: '2. Architectural Decoupling Principles',
          body: '1. Frontend & Mobile Clients rely exclusively on REST API endpoints (/api/v1/*).\n2. Backend API enforces authentication, authorization, and standard JSON schemas.\n3. AI Worker Subsystem executes heavy computer vision tasks off the main web looper thread using Redis queues.\n4. Database isolation ensures all spatial detection telemetry is strictly indexed by image_id and timestamp.',
        },
        {
          heading: '3. System Component Specifications',
          table: {
            headers: ['Component', 'Technology', 'Role', 'Status'],
            rows: [
              ['Web Studio', 'Next.js 14 / TypeScript', 'Operator HUD & Live Detection Studio', 'Production Ready'],
              ['Mobile Client', 'Kotlin / Jetpack Compose', 'Android Native Roadside Edge Scanner', 'v1.0 APK Built'],
              ['Backend API', 'FastAPI / Python 3.11', 'Authentication, Schema Validation, Routing', 'Online (Port 8000)'],
              ['Task Queue', 'Redis 7 / Celery Workers', 'Async Image/Video Inference Dispatch', 'Active'],
              ['AI Engine', 'YOLOv8 + Indian OCR', '8-Class Vehicle & License Plate Localization', 'Trained & Verified'],
            ],
          },
        },
      ],
    },
  },
  {
    id: 'ai-output-contract',
    title: 'Standard AI Output Contract',
    category: 'AI Subsystem',
    docId: 'VP-DOC-AI-002',
    date: 'November 2026',
    version: 'v2.1.0',
    filePath: 'docs/ai/output_contract.md',
    description: 'Unified Pydantic JSON payload interface contract returned by the computer vision inference pipeline and ingested across frontend, mobile, and electronic tolling gantries.',
    content: {
      overview: 'This contract defines the unified JSON payload format returned by the AI subsystem and consumed by Web Studio, Android App, Backend API, and Database. Built strictly on Pydantic v2 schemas.',
      sections: [
        {
          heading: '1. Standard JSON Telemetry Schema',
          code: `{
  "image_id": "example_image_001",
  "processing_time_ms": 38.4,
  "vehicles": [
    {
      "type": "car",
      "confidence": 0.942,
      "bbox": [120, 80, 540, 420],
      "plate": {
        "text": "DL10CA4829",
        "clean_text": "DL 10 CA 4829",
        "state_code": "DL",
        "rto_name": "Delhi West",
        "confidence": 0.915,
        "is_valid_hsrp": true,
        "bbox": [230, 350, 410, 395]
      }
    }
  ]
}`,
        },
        {
          heading: '2. Schema Field Specifications',
          body: '• image_id (string, required): Unique identifier for processed roadway media frame.\n• vehicles (array): List of localized vehicle objects.\n  - type (string): Vehicle class (car, truck, bus, motorcycle, auto_rickshaw, lcv, bicycle, other).\n  - confidence (float, 0.0 - 1.0): Bounding box localization confidence score.\n  - bbox (array of 4 ints): [xmin, ymin, xmax, ymax] pixel coordinates.\n  - plate (object, optional): Extracted license plate object.\n    - text: Normalized alphanumeric license plate string.\n    - confidence: OCR character confidence score.\n    - bbox: [xmin, ymin, xmax, ymax] relative coordinates within vehicle crop.',
        },
      ],
    },
  },
  {
    id: 'authentication-flow',
    title: 'Authentication & Access Control',
    category: 'Security',
    docId: 'VP-DOC-SEC-003',
    date: 'November 2026',
    version: 'v1.2.0',
    filePath: 'docs/architecture/authentication_flow.md',
    description: 'OAuth 2.0 authentication architecture, JWT bearer token rotation, bcrypt hashing, and route protection matrix.',
    content: {
      overview: 'VisionPlate AI implements industry-standard OAuth 2.0 authentication protocols alongside encrypted JWT bearer tokens to secure operational roadway telemetry and administrative dashboard access.',
      sections: [
        {
          heading: '1. Route Access Control Matrix',
          table: {
            headers: ['Feature / Route', 'Authentication Required', 'Role Allowed', 'Notes'],
            rows: [
              ['Public Landing (/)', 'No', 'Public', 'Open marketing & capabilities showcase'],
              ['Documentation Hub (/documentation)', 'No', 'Public', 'Open technical specifications'],
              ['Android APK Download (/download)', 'No', 'Public', 'Direct client APK distribution'],
              ['Operator Dashboard (/app/dashboard)', 'Yes', 'Operator / Admin', 'Protected telemetry view'],
              ['AI Detection Studio (/app/detect)', 'Yes', 'Operator / Admin', 'Media upload & live inference'],
              ['Historical Logs (/app/history)', 'Yes', 'Operator / Admin', 'Detection database queries'],
            ],
          },
        },
        {
          heading: '2. Security Implementation Standards',
          body: '1. No OAuth client secrets or private JWT signing keys committed to git repositories.\n2. User passwords salted and hashed with bcrypt.\n3. Access tokens expire within 60 minutes with cryptographic refresh tokens stored in HTTP-only cookies.\n4. Sub-pixel coordinate crops scrubbed of personally identifiable location markers upon customer request.',
        },
      ],
    },
  },
  {
    id: 'git-workflow',
    title: 'Git Branch Strategy & Release Workflow',
    category: 'Engineering',
    docId: 'VP-DOC-DEV-004',
    date: 'November 2026',
    version: 'v1.0.0',
    filePath: 'docs/architecture/git_workflow.md',
    description: 'Monorepo branch management, automated GitHub Actions CI validation, pull request checklists, and release tagging conventions.',
    content: {
      overview: 'VisionPlate AI enforces a disciplined GitFlow development cycle to guarantee stability across deep learning models, backend APIs, and web/mobile frontends.',
      sections: [
        {
          heading: '1. Branch Taxonomy',
          body: '• main: Production release branch. Protected. Direct pushes strictly prohibited.\n• develop: Core staging integration branch for ongoing sprint cycles.\n• feature/*: Isolated new capability development (e.g. feature/hsrp-regex).\n• fix/*: Bug fixes and critical hotfixes.\n• docs/*: Architecture documents, API guides, and markdown blueprints.\n• test/*: Test coverage expansion across backend and frontend suites.',
        },
        {
          heading: '2. Pull Request Gate Requirements',
          body: '1. Target branch must be develop.\n2. All CI GitHub Actions checks (linting, pytest, Next.js build) must pass.\n3. Requires at least 1 peer code review approval before merge.\n4. Squashed commits must follow Conventional Commits formatting.',
        },
      ],
    },
  },
  {
    id: 'api-architecture',
    title: 'FastAPI REST Endpoints Specification',
    category: 'Backend',
    docId: 'VP-DOC-API-005',
    date: 'November 2026',
    version: 'v1.3.0',
    filePath: 'docs/architecture/api_architecture.md',
    description: 'Complete REST endpoint specifications for media upload, recognition dispatch, real-time polling, and FastTag integration.',
    content: {
      overview: 'FastAPI powers the core inference gateway, delivering low-latency asynchronous HTTP/REST endpoints with automatic OpenAPI v3 documentation available at /docs.',
      sections: [
        {
          heading: '1. Core Endpoint Routing Table',
          table: {
            headers: ['Method', 'Endpoint', 'Request Body', 'Response'],
            rows: [
              ['POST', '/api/v1/files/upload', 'multipart/form-data', '{ file_id, filename, size }'],
              ['POST', '/api/v1/recognition/images', '{ file_id, model_confidence }', 'Unified AI Detection Contract'],
              ['GET', '/api/v1/history', '?limit=50&offset=0', 'Historical Detection Array'],
              ['GET', '/api/v1/health', 'None', '{ status: "healthy", timestamp }'],
            ],
          },
        },
      ],
    },
  },
  {
    id: 'ai-pipeline',
    title: 'Sequential AI Pipeline Architecture',
    category: 'Computer Vision',
    docId: 'VP-DOC-ML-006',
    date: 'November 2026',
    version: 'v2.0.0',
    filePath: 'docs/architecture/ai_pipeline.md',
    description: 'Deep learning pipeline sequencing from raw frame ingestion, multi-class vehicle bounding, plate ROI cropping, bilateral filtering, OCR character extraction, and Indian RTO regex verification.',
    content: {
      overview: 'A high-throughput 8-stage computer vision pipeline tuned specifically for the complex lighting, dust, and typography variations found across Indian national highways.',
      sections: [
        {
          heading: '1. Sequential Pipeline Flowchart',
          code: `Input Media (Image / Video Stream)
    │
    ▼
Input Validation & Bilateral Resizing
    │
    ▼
Vehicle Localization (YOLOv8 Multi-Class: 8 Categories)
    │
    ▼
License Plate Region Detection (YOLO ROI Extractor)
    │
    ▼
Sub-Pixel Cropping & Perspective Deskewing
    │
    ▼
Adaptive CLAHE Binarization Preprocessing
    │
    ▼
Optical Character Recognition (Tesseract / PaddleOCR)
    │
    ▼
MoRTH Indian State Code Regex Validation
    │
    ▼
Structured Pydantic JSON Telemetry Output`,
        },
      ],
    },
  },
];

export default function DocumentationPage() {
  const [theme, setTheme] = useState<'dark' | 'beige'>('dark');
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [modalPaperTheme, setModalPaperTheme] = useState<'white' | 'dark'>('white');

  // Sync theme from localStorage & document class
  useEffect(() => {
    const syncTheme = () => {
      try {
        const saved = localStorage.getItem('visionplate-theme');
        const isBeige =
          saved === 'beige' ||
          saved === 'light' ||
          document.documentElement.classList.contains('beige') ||
          document.documentElement.classList.contains('light');
        setTheme(isBeige ? 'beige' : 'dark');
      } catch {
        setTheme('dark');
      }
    };

    syncTheme();
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  const toggleTheme = () => {
    const next: 'dark' | 'beige' = theme === 'dark' ? 'beige' : 'dark';
    setTheme(next);
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
  };

  const isDark = theme === 'dark';

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-400 ${
        isDark ? 'bg-[#050505] text-white' : 'bg-[#E8DEC8] text-[#1A1815]'
      }`}
    >
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Header Section */}
        <div className="max-w-3xl mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-mono font-bold tracking-wider uppercase backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={isDark ? 'text-emerald-400' : 'text-emerald-800'}>
              ENGINEERING DOCUMENTATION HUB
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            System Blueprints &amp; Contracts
          </h1>

          <p
            className={`text-base sm:text-lg leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-[#5C5346]'
            }`}
          >
            Verified technical specifications, API contracts, and architecture blueprints for the VisionPlate AI ALPR platform. Click any document below to open and read in official PDF format.
          </p>
        </div>

        {/* Document Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DOCUMENTS.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`group cursor-pointer p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between hover:scale-[1.015] hover:shadow-xl ${
                isDark
                  ? 'bg-white/[0.02] border-white/10 hover:border-emerald-400/60 hover:bg-white/[0.04]'
                  : 'bg-[#FAF8F5] border-[#D0C5B0] hover:border-emerald-600/60 hover:bg-white shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {doc.category}
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">{doc.version}</span>
                </div>

                <h3 className="text-lg font-bold tracking-tight group-hover:text-emerald-500 transition-colors">
                  {doc.title}
                </h3>

                <p
                  className={`text-xs leading-relaxed line-clamp-3 ${
                    isDark ? 'text-zinc-400' : 'text-[#6B6152]'
                  }`}
                >
                  {doc.description}
                </p>
              </div>

              <div className="pt-4 mt-6 border-t border-current/10 flex items-center justify-between text-xs font-mono text-current/70 group-hover:text-emerald-500 transition-colors">
                <span className="flex items-center gap-1.5 font-bold">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open PDF Document</span>
                </span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ===================================================================== */}
      {/* AUTHENTIC PDF DOCUMENT VIEWER MODAL                                   */}
      {/* ===================================================================== */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md animate-fadeIn print:p-0 print:bg-white print:static print:overflow-visible">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-[#18181B] border border-white/20 print:max-h-none print:border-none print:shadow-none print:bg-white">
            {/* Modal Top Control Bar */}
            <div className="px-4 sm:px-6 py-3.5 bg-[#121214] border-b border-white/10 flex items-center justify-between flex-shrink-0 text-white print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight truncate max-w-[180px] sm:max-w-md">
                    {selectedDoc.title}.pdf
                  </h3>
                  <div className="text-[10px] font-mono text-zinc-400">
                    {selectedDoc.docId} • {selectedDoc.version}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Paper Mode Selector */}
                <div className="hidden sm:flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10 text-[11px] font-mono">
                  <button
                    onClick={() => setModalPaperTheme('white')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      modalPaperTheme === 'white'
                        ? 'bg-white text-zinc-950 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    📄 Paper
                  </button>
                  <button
                    onClick={() => setModalPaperTheme('dark')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      modalPaperTheme === 'dark'
                        ? 'bg-emerald-500 text-black font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    🌙 Dark
                  </button>
                </div>

                {/* Print / Save PDF Button */}
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold transition-all shadow-sm cursor-pointer"
                  title="Print or Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print / Save PDF</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Printable PDF Document Paper Sheet Container */}
            <div
              className={`flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 print:p-0 print:overflow-visible ${
                modalPaperTheme === 'white' ? 'bg-[#0f0f12]' : 'bg-[#09090b]'
              }`}
            >
              {/* Paper Sheet Card */}
              <div
                className={`w-full max-w-3xl mx-auto h-fit min-h-full rounded-xl shadow-2xl p-6 sm:p-12 font-sans border transition-colors duration-200 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none ${
                  modalPaperTheme === 'white'
                    ? 'bg-white text-zinc-950 border-zinc-200'
                    : 'bg-[#18181B] text-zinc-100 border-zinc-800'
                }`}
              >
                {/* Official PDF Document Header */}
                <div
                  className={`pb-5 mb-8 flex items-start justify-between border-b-2 ${
                    modalPaperTheme === 'white'
                      ? 'border-zinc-900 text-zinc-950'
                      : 'border-emerald-500/40 text-white'
                  }`}
                >
                  <div>
                    <div className="text-[11px] font-mono font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
                      VISIONPLATE AI SYSTEMS • ENGINEERING DOCUMENTATION
                    </div>
                    <h2
                      className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 ${
                        modalPaperTheme === 'white' ? 'text-zinc-950' : 'text-white'
                      }`}
                    >
                      {selectedDoc.title}
                    </h2>
                    <div
                      className={`text-xs font-mono mt-1 ${
                        modalPaperTheme === 'white' ? 'text-zinc-600' : 'text-zinc-400'
                      }`}
                    >
                      File: {selectedDoc.filePath}
                    </div>
                  </div>

                  <div
                    className={`text-right text-[10px] font-mono space-y-0.5 ${
                      modalPaperTheme === 'white' ? 'text-zinc-600' : 'text-zinc-400'
                    }`}
                  >
                    <div>
                      <span className={modalPaperTheme === 'white' ? 'font-bold text-zinc-900' : 'font-bold text-zinc-200'}>
                        DOC ID:
                      </span>{' '}
                      {selectedDoc.docId}
                    </div>
                    <div>
                      <span className={modalPaperTheme === 'white' ? 'font-bold text-zinc-900' : 'font-bold text-zinc-200'}>
                        DATE:
                      </span>{' '}
                      {selectedDoc.date}
                    </div>
                    <div>
                      <span className={modalPaperTheme === 'white' ? 'font-bold text-zinc-900' : 'font-bold text-zinc-200'}>
                        STATUS:
                      </span>{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">APPROVED</span>
                    </div>
                    <div
                      className={`inline-block px-2 py-0.5 mt-1 rounded font-bold border ${
                        modalPaperTheme === 'white'
                          ? 'bg-zinc-100 border-zinc-300 text-zinc-800'
                          : 'bg-zinc-800/80 border-zinc-700 text-zinc-200'
                      }`}
                    >
                      RESTRICTED // SPEC
                    </div>
                  </div>
                </div>

                {/* Overview Paragraph */}
                <div className="mb-8">
                  <h4
                    className={`text-xs font-mono font-bold uppercase tracking-wider mb-2 ${
                      modalPaperTheme === 'white' ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    Executive Overview
                  </h4>
                  <p
                    className={`text-sm leading-relaxed font-sans ${
                      modalPaperTheme === 'white' ? 'text-zinc-800' : 'text-zinc-200'
                    }`}
                  >
                    {selectedDoc.content.overview}
                  </p>
                </div>

                {/* Document Sections */}
                <div className="space-y-8">
                  {selectedDoc.content.sections.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-3">
                      <h3
                        className={`text-base sm:text-lg font-bold border-b pb-1.5 ${
                          modalPaperTheme === 'white'
                            ? 'text-zinc-950 border-zinc-200'
                            : 'text-emerald-400 border-zinc-800'
                        }`}
                      >
                        {section.heading}
                      </h3>

                      {section.body && (
                        <p
                          className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line font-sans ${
                            modalPaperTheme === 'white' ? 'text-zinc-800' : 'text-zinc-300'
                          }`}
                        >
                          {section.body}
                        </p>
                      )}

                      {section.code && (
                        <div
                          className={`relative rounded-xl p-4 font-mono text-xs overflow-x-auto shadow-inner border my-3 ${
                            modalPaperTheme === 'white'
                              ? 'bg-zinc-950 text-emerald-400 border-zinc-800'
                              : 'bg-black/90 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-[10px] text-zinc-400 font-mono">
                            <span>ARCHITECTURAL SOURCE SPECIFICATION</span>
                            <span className="text-emerald-400 font-bold">● VERIFIED CONTRACT</span>
                          </div>
                          <pre className="whitespace-pre overflow-x-auto leading-relaxed max-w-full font-mono text-xs text-emerald-400">
                            <code>{section.code}</code>
                          </pre>
                        </div>
                      )}

                      {section.table && (
                        <div
                          className={`overflow-x-auto rounded-xl border shadow-sm my-3 ${
                            modalPaperTheme === 'white'
                              ? 'border-zinc-300 bg-white'
                              : 'border-zinc-800 bg-zinc-900'
                          }`}
                        >
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr
                                className={`border-b ${
                                  modalPaperTheme === 'white'
                                    ? 'bg-zinc-100 border-zinc-300 text-zinc-950 font-bold'
                                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-100 font-bold'
                                }`}
                              >
                                {section.table.headers.map((h, hIdx) => (
                                  <th key={hIdx} className="p-3 font-semibold">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody
                              className={`divide-y ${
                                modalPaperTheme === 'white'
                                  ? 'divide-zinc-200 bg-white text-zinc-900'
                                  : 'divide-zinc-800 bg-zinc-900 text-zinc-300'
                              }`}
                            >
                              {section.table.rows.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={`transition-colors ${
                                    modalPaperTheme === 'white'
                                      ? 'bg-white hover:bg-zinc-50'
                                      : 'bg-zinc-900 hover:bg-zinc-800/50'
                                  }`}
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`p-3 font-mono ${
                                        modalPaperTheme === 'white'
                                          ? 'text-zinc-900 bg-white'
                                          : 'text-zinc-200 bg-zinc-900'
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Official Document Footer Stamp */}
                <div
                  className={`mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono gap-2 ${
                    modalPaperTheme === 'white'
                      ? 'border-zinc-300 text-zinc-500'
                      : 'border-zinc-800 text-zinc-400'
                  }`}
                >
                  <div>CONFIDENTIAL • VISIONPLATE AI ROADWAY INFRASTRUCTURE</div>
                  <div>PAGE 1 OF 1 • VERIFIED SPECIFICATION</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer theme={theme} />
    </div>
  );
}
