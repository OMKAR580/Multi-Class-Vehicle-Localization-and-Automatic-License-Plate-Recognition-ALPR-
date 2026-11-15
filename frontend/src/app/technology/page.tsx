'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import {
  Layers,
  Cpu,
  Server,
  Database,
  Smartphone,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Code2,
} from 'lucide-react';

interface TechItem {
  category: string;
  badge: string;
  icon: React.ElementType;
  tech: string;
  version: string;
  role: string;
  specs: string[];
}

const TECH_STACK: TechItem[] = [
  {
    category: 'Computer Vision & AI',
    badge: 'Core Inference',
    icon: Cpu,
    tech: 'YOLOv8 + Indian OCR Engine',
    version: 'Ultralytics 8.1 / PyTorch 2.2',
    role: 'Multi-class vehicle localization (8 Indian categories), secondary plate ROI extraction, and bilateral filtered OCR recognition.',
    specs: ['Sub-45ms Total Pipeline Latency', '8 Vehicle Categories Detected', 'Dual-line HSRP Normalization', 'Offline Edge Deployment'],
  },
  {
    category: 'Backend & Inference API',
    badge: 'Micro-Gateway',
    icon: Server,
    tech: 'Python 3.11 & FastAPI',
    version: 'FastAPI 0.110 / Pydantic v2',
    role: 'Asynchronous REST API gateway handling media multipart uploads, model inference dispatch, and deterministic JSON schemas.',
    specs: ['Asynchronous Event Loop', 'OpenAPI v3 Interactive Swagger', 'Pydantic Strict Type Enforcement', 'CORS & Security Middleware'],
  },
  {
    category: 'Web Studio & HUD',
    badge: 'Operator Frontend',
    icon: Layers,
    tech: 'Next.js 14 & TypeScript',
    version: 'Next.js 14.2 / React 18',
    role: 'High-performance interactive web dashboard, live camera scanner simulator, and authenticated detection studio.',
    specs: ['App Router SSR & Client Hydration', 'Tailwind CSS Luxury Vesper Theme', 'WebGL & Three.js 3D Machine Pipeline', 'Lucide Vector Micro-interactions'],
  },
  {
    category: 'Mobile Edge Client',
    badge: 'Field Deployment',
    icon: Smartphone,
    tech: 'Kotlin & Jetpack Compose',
    version: 'Android SDK 34 / Jetpack',
    role: 'Native mobile client for traffic police handheld devices and roadside checkpoint officers.',
    specs: ['MVVM Clean Architecture', 'Retrofit 2 REST Client', 'CameraX Live Video Stream Feed', 'Local Cache with Room DB'],
  },
  {
    category: 'Data Storage & Caching',
    badge: 'Persistence Tier',
    icon: Database,
    tech: 'PostgreSQL 16 & Redis 7',
    version: 'PostgreSQL 16.2 / Redis 7.2',
    role: 'Structured detection telemetry persistence, user session storage, and asynchronous Celery worker queues.',
    specs: ['ACID Relational Integrity', 'Redis Pub/Sub Event Streaming', 'SQLAlchemy 2.0 ORM', 'Automated Database Migrations'],
  },
  {
    category: 'DevOps & Tooling',
    badge: 'Infrastructure',
    icon: ShieldCheck,
    tech: 'Docker & GitHub Actions CI',
    version: 'Docker Engine 25 / Compose v2',
    role: 'Multi-stage containerization, automated testing pipelines, and unified monorepo orchestration.',
    specs: ['Isolated Multi-container Compose', 'Automated Pytest & Jest CI Runs', 'Zero-downtime Rollouts', 'Linux / Windows Cross-platform'],
  },
];

export default function TechnologyPage() {
  const [theme, setTheme] = useState<'dark' | 'beige'>('dark');

  // Sync theme with DOM and localStorage
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
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className={isDark ? 'text-sky-400' : 'text-sky-800'}>
              ENGINEERING FOUNDATIONS // ARCHITECTURE
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Technology Stack &amp; Architecture
          </h1>

          <p
            className={`text-base sm:text-lg leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-[#5C5346]'
            }`}
          >
            VisionPlate AI is engineered with modern open-source deep learning frameworks and high-concurrency asynchronous microservices. Designed for zero cloud dependency and on-premise tolling automation.
          </p>
        </div>

        {/* Technology Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {TECH_STACK.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                  isDark
                    ? 'bg-white/[0.02] border-white/10 hover:border-sky-400/50 hover:bg-white/[0.04]'
                    : 'bg-[#FAF8F5] border-[#D0C5B0] hover:border-[#B27D22]/60 hover:bg-white shadow-sm'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                      {item.badge}
                    </span>
                    <span className="text-[10px] opacity-60 font-mono">{item.version}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                        isDark ? 'bg-white/5 border-white/10 text-sky-400' : 'bg-black/5 border-black/10 text-sky-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight leading-tight">
                        {item.tech}
                      </h3>
                      <span className="text-xs font-mono text-current/60">{item.category}</span>
                    </div>
                  </div>

                  <p
                    className={`text-xs leading-relaxed ${
                      isDark ? 'text-zinc-400' : 'text-[#6B6152]'
                    }`}
                  >
                    {item.role}
                  </p>

                  {/* Bullet Specs */}
                  <div className="pt-2 space-y-1.5 border-t border-current/10">
                    {item.specs.map((spec, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2 text-xs font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="text-current/80">{spec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Documentation Banner Link */}
        <div
          className={`p-8 sm:p-10 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-6 ${
            isDark
              ? 'bg-gradient-to-r from-[#11100D] via-[#090807] to-black border-white/15'
              : 'bg-gradient-to-r from-[#FAF8F5] via-[#F4EDE0] to-[#EAE0CD] border-[#D0C5B0] shadow-md'
          }`}
        >
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
              Looking for formal API Schemas &amp; Blueprints?
            </h3>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
              Access the complete Documentation Hub to inspect or print full A4 PDF architecture specifications.
            </p>
          </div>

          <Link
            href="/documentation"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg transition-all cursor-pointer flex-shrink-0"
          >
            <span>Documentation Hub</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <Footer theme={theme} />
    </div>
  );
}
