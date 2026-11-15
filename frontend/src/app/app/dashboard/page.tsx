'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AuthService, AuthSession } from '@/lib/auth';
import { useTheme } from '@/context/ThemeContext';
import {
  getDashboardOverview,
  DashboardOverviewResponse,
  DashboardActivityItem,
  VehicleClassDistributionItem,
  ActivityTimelineItem,
} from '@/lib/api';
import {
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  FileText,
  Car,
  Truck,
  Bike,
  Download,
  RefreshCw,
  Play,
  Sparkles,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Layers,
  Video,
  Image as ImageIcon,
  BarChart3,
  Search,
  Scan,
  Plus,
  Compass,
  SlidersHorizontal,
  Check,
  Gauge,
  Zap,
} from 'lucide-react';

export default function DashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [hoveredTimelineDay, setHoveredTimelineDay] = useState<ActivityTimelineItem | null>(null);

  // Global Theme Context
  const { theme, isDark } = useTheme();

  // Load Session and set up Auth listener
  useEffect(() => {
    let active = AuthService.getSession();
    if (!active) {
      active = AuthService.initGuestSession();
    }
    setSession(active);

    const handleAuthChange = () => {
      setOverview(null);
      setSession(AuthService.getSession());
      fetchOverview();
    };
    window.addEventListener('visionplate_auth_change', handleAuthChange);

    return () => {
      window.removeEventListener('visionplate_auth_change', handleAuthChange);
    };
  }, []);

  // Fetch real backend operational overview data
  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    try {
      const data = await getDashboardOverview(7, 6);
      setOverview(data);
    } catch (err: any) {
      console.error('Failed to load dashboard overview:', err);
      setIsError(true);
      setErrorMessage(
        err?.message || 'Unable to communicate with VisionPlate ALPR backend.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Current formatted date
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Chief Operator';
  const userEmail = session?.user?.email || 'operator@visionplate.ai';

  // Helper to format ISO timestamp
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDateShort = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // Helper for vehicle class icons
  const renderVehicleClassIcon = (vehicleClass: string) => {
    const cls = vehicleClass.toLowerCase();
    if (cls.includes('car') || cls.includes('suv')) {
      return <Car className="w-4 h-4 text-[#EA580C]" />;
    }
    if (cls.includes('auto') || cls.includes('three')) {
      return <span className="text-xs">🛺</span>;
    }
    if (cls.includes('bike') || cls.includes('motor') || cls.includes('two')) {
      return <Bike className="w-4 h-4 text-[#EA580C]" />;
    }
    if (cls.includes('truck') || cls.includes('lcv') || cls.includes('bus')) {
      return <Truck className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />;
    }
    return <Car className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
  };

  // Max jobs in timeline for bar height calculation
  const maxTimelineJobs = useMemo(() => {
    if (!overview || !overview.activity_timeline.length) return 1;
    const max = Math.max(...overview.activity_timeline.map((t) => t.total_jobs));
    return max > 0 ? max : 1;
  }, [overview]);

  // Export CSV generator using real data (RFC 4180 format)
  const handleExportCsv = () => {
    if (!overview) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Recognition Jobs', overview.summary.total_jobs],
      ['Completed Jobs', overview.summary.completed_jobs],
      ['Failed Jobs', overview.summary.failed_jobs],
      ['Total Vehicles Detected', overview.summary.total_vehicles_detected],
      ['Total Plates Detected', overview.summary.total_plates_detected],
      ['Recognized Plates', overview.summary.recognized_plates],
      ['Average Latency (ms)', overview.summary.average_processing_time_ms ?? 'N/A'],
      ['Success Rate (%)', `${overview.summary.success_rate}%`],
      ['Image Jobs', overview.summary.image_jobs],
      ['Video Jobs', overview.summary.video_jobs],
      [],
      ['Recent Job ID', 'Media Type', 'Status', 'Vehicles', 'Plates Resolved', 'Created At'],
      ...overview.recent_jobs.map((j) => [
        j.job_id,
        j.media_type,
        j.status,
        j.vehicle_count,
        j.recognized_plate_count,
        j.created_at,
      ]),
      [],
      ['Vehicle Class', 'Count', 'Percentage'],
      ...overview.vehicle_distribution.map((v) => [v.vehicle_class, v.count, `${v.percentage}%`]),
    ];

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `visionplate_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportOpen(false);
  };

  return (
    <div className="min-h-full font-sans p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 relative">
      {/* Reusable SVG Definitions for Diagonal Pattern */}
      <svg className="absolute w-0 h-0" aria-hidden="true" focusable="false">
        <defs>
          <pattern
            id="diagonalHatchLight"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="#1A1815" strokeWidth="2" strokeOpacity="0.15" />
          </pattern>
          <pattern
            id="diagonalHatchDark"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="#F59E0B" strokeWidth="2" strokeOpacity="0.25" />
          </pattern>
        </defs>
      </svg>

      {/* ========================================================================= */}
      {/* SECTION A — WORKSPACE COMMAND HEADER                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8CFC0]/60 dark:border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-[#EA580C] dark:text-[#F59E0B] flex-wrap">
            <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
            <span>Operational ALPR Workspace</span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="text-zinc-600 dark:text-zinc-400">{todayFormatted}</span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/20 text-[10px]">
              <Zap className="w-3 h-3 text-[#EA580C]" />
              <span>Pipeline Latency: {overview?.summary?.average_processing_time_ms ? `${Math.round(overview.summary.average_processing_time_ms)}ms` : '~140ms'}</span>
            </span>
          </div>
          <h1 className="font-serif-italic font-normal text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1A1815] dark:text-white flex items-center gap-3">
            <span>Welcome, {userName}</span>
            <span className="not-italic text-2xl sm:text-3xl select-none" role="img" aria-label="wave">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            Your recognition workspace at a glance. Real-time Indian ALPR telemetry &amp; vehicle analytics.
          </p>
        </div>

        {/* Primary and Operational Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchOverview()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/15 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            title="Refresh Real Backend Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#EA580C]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/15 text-[#1A1815] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold tracking-wide transition-all shadow-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Export Telemetry</span>
          </button>

          <Link
            href="/app/history"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/15 text-[#1A1815] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold tracking-wide transition-all shadow-xs"
          >
            <Clock className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span>View History</span>
          </Link>

          <Link
            href="/app/detect"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-semibold tracking-wide shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Detection</span>
          </Link>
        </div>
      </div>

      {/* Error Notification Banner with Retry */}
      {isError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 flex items-center justify-between gap-3 text-rose-800 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={fetchOverview}
            className="px-3 py-1 rounded-full bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B — OPERATIONAL OVERVIEW (KPI HIERARCHY)                         */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {/* Tier 1: 4 Primary Operational KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* KPI 1: Total Detection Jobs */}
          <div className="relative overflow-hidden rounded-3xl p-6 bg-[#1A1815] dark:bg-[#09090b] text-white shadow-xl transition-transform hover:-translate-y-0.5 duration-200 border border-white/20 dark:border-white/10 flex flex-col justify-between gw-panel">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-zinc-300">Total Detection Jobs</span>
              <Link
                href="/app/history"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                title="View Detection History"
              >
                <ArrowUpRight className="w-4 h-4 text-[#F59E0B]" />
              </Link>
            </div>

            <div className="my-3">
              {isLoading ? (
                <div className="h-10 w-24 bg-white/10 rounded-lg animate-pulse" />
              ) : (
                <div className="text-3xl sm:text-4xl font-black tracking-tight font-mono">
                  {overview?.summary.total_jobs ?? 0}
                </div>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-amber-300 font-mono w-fit">
              <span className="text-[10px] bg-[#EA580C] text-white rounded px-1 font-bold">
                {overview?.summary.completed_jobs ?? 0} Completed
              </span>
              <span>
                {overview?.summary.failed_jobs ?? 0} Failed
              </span>
            </div>
          </div>

          {/* KPI 2: Vehicles Detected */}
          <div className="gw-panel p-6 shadow-sm transition-transform hover:-translate-y-0.5 duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">Vehicles Detected</span>
              <Link
                href="/app/analytics"
                className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.08] flex items-center justify-center text-zinc-800 dark:text-zinc-200 transition-all"
                title="View Traffic Analytics"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="my-3">
              {isLoading ? (
                <div className="h-10 w-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
              ) : (
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#1A1815] dark:text-white font-mono">
                  {overview?.summary.total_vehicles_detected ?? 0}
                </div>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/5 border border-black/[0.08] dark:border-white/10 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 font-mono w-fit">
              <span>{overview?.summary.image_jobs ?? 0} Img</span>
              <span>•</span>
              <span>{overview?.summary.video_jobs ?? 0} Video Jobs</span>
            </div>
          </div>

          {/* KPI 3: Plates Recognized */}
          <div className="gw-panel p-6 shadow-sm transition-transform hover:-translate-y-0.5 duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">Plates Recognized</span>
              <Link
                href="/app/history"
                className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.08] flex items-center justify-center text-zinc-800 dark:text-zinc-200 transition-all"
                title="Inspect Recognized Plates"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="my-3">
              {isLoading ? (
                <div className="h-10 w-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
              ) : (
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#1A1815] dark:text-white font-mono">
                  {overview?.summary.recognized_plates ?? 0}
                </div>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-medium text-emerald-800 dark:text-emerald-400 font-mono w-fit">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {overview?.summary.total_plates_detected ?? 0} Localized ROIs
              </span>
            </div>
          </div>

          {/* KPI 4: Average Processing Latency */}
          <div className="gw-panel p-6 shadow-sm transition-transform hover:-translate-y-0.5 duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">Average Latency</span>
              <Link
                href="/app/detect"
                className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.08] flex items-center justify-center text-zinc-800 dark:text-zinc-200 transition-all"
                title="Launch Live Detection Studio"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="my-3">
              {isLoading ? (
                <div className="h-10 w-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
              ) : (
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#1A1815] dark:text-white font-mono">
                  {overview?.summary.average_processing_time_ms
                    ? `${Math.round(overview.summary.average_processing_time_ms)} ms`
                    : '—'}
                </div>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[11px] font-medium text-amber-800 dark:text-amber-400 font-mono w-fit">
              <Activity className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>YOLOv8 + Indian OCR</span>
            </div>
          </div>
        </div>

        {/* Tier 2: 3 Secondary Intelligence Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-2xl gw-panel flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Gauge className="w-4 h-4 text-[#EA580C]" />
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-bold">Pipeline Success Rate</div>
                <div className="text-base font-mono font-bold text-[#1A1815] dark:text-white">
                  {overview?.summary.total_jobs ? `${overview.summary.success_rate.toFixed(1)}%` : '100%'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Terminal jobs</span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl gw-panel flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Scan className="w-4 h-4 text-[#EA580C]" />
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-bold">Plate Resolution Rate</div>
                <div className="text-base font-mono font-bold text-[#1A1815] dark:text-white">
                  {overview?.summary.total_plates_detected && overview.summary.total_plates_detected > 0
                    ? `${Math.round((overview.summary.recognized_plates / overview.summary.total_plates_detected) * 100)}%`
                    : '100%'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">OCR / Localized</span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl gw-panel flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-[#EA580C]" />
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-bold">Media Distribution</div>
                <div className="text-base font-mono font-bold text-[#1A1815] dark:text-white">
                  {overview?.summary.image_jobs ?? 0} Img / {overview?.summary.video_jobs ?? 0} Vid
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Dual Ingestion</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION C — RECOGNITION INTELLIGENCE & TELEMETRY CHARTS                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 7-Day Activity Timeline Bar Chart (lg:col-span-7) */}
        <div className="lg:col-span-7 rounded-3xl p-6 gw-panel shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-base text-[#1A1815] dark:text-white">Recognition Activity Timeline</h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">7-Day Historical Job &amp; Vehicle Processing Volume</p>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono font-semibold">Past 7 Days</span>
          </div>

          {/* Interactive Bar Chart */}
          <div className="relative my-4">
            {isLoading ? (
              <div className="h-44 w-full bg-black/5 dark:bg-white/5 rounded-2xl animate-pulse" />
            ) : overview && overview.activity_timeline.length > 0 ? (
              <div className="flex items-end justify-between gap-2.5 h-44 pt-6 pb-2 px-1">
                {overview.activity_timeline.map((item) => {
                  const jobPct = (item.total_jobs / maxTimelineJobs) * 100;
                  const isPeak = item.total_jobs === maxTimelineJobs && item.total_jobs > 0;
                  const hasJobs = item.total_jobs > 0;

                  return (
                    <div
                      key={item.date}
                      onMouseEnter={() => setHoveredTimelineDay(item)}
                      onMouseLeave={() => setHoveredTimelineDay(null)}
                      className="relative flex flex-col items-center gap-2 flex-1 h-full justify-end group cursor-pointer"
                    >
                      {/* Floating Tooltip */}
                      {hoveredTimelineDay?.date === item.date && (
                        <div className="absolute -top-12 z-20 px-2.5 py-1 rounded-lg bg-[#1A1815] dark:bg-white text-white dark:text-black text-[10px] font-mono font-bold shadow-xl whitespace-nowrap pointer-events-none">
                          <div>{item.date}</div>
                          <div className="text-amber-400 dark:text-orange-600">
                            {item.total_jobs} Jobs ({item.successful_jobs} OK, {item.total_vehicles} Veh)
                          </div>
                        </div>
                      )}

                      {/* Peak Tag */}
                      {isPeak && (
                        <div className="absolute top-0 px-1.5 py-0.5 rounded-full bg-[#EA580C] text-white text-[9px] font-bold shadow-md whitespace-nowrap font-mono">
                          Peak
                        </div>
                      )}

                      {/* Bar Pillar */}
                      <div
                        className={`w-full max-w-[36px] rounded-full transition-all duration-300 group-hover:scale-105 ${
                          isPeak
                            ? 'bg-[#EA580C] dark:bg-[#F59E0B] shadow-[0_4px_16px_rgba(234,88,12,0.35)]'
                            : hasJobs
                            ? 'bg-[#1A1815] dark:bg-white/40'
                            : 'bg-[#D8CFC0]/50 dark:bg-white/10'
                        }`}
                        style={{
                          height: hasJobs ? `${Math.max(jobPct, 15)}%` : '8%',
                          backgroundImage:
                            !hasJobs
                              ? isDark
                                ? 'url(#diagonalHatchDark)'
                                : 'url(#diagonalHatchLight)'
                              : undefined,
                        }}
                      />

                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 font-mono">
                        {item.day_name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02]">
                <Activity className="w-8 h-8 text-zinc-400 mb-2" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">No activity in the last 7 days.</p>
                <Link
                  href="/app/detect"
                  className="mt-2 text-xs text-[#EA580C] dark:text-[#F59E0B] font-bold hover:underline"
                >
                  Run your first scan →
                </Link>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#D8CFC0]/60 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Aggregated across user jobs</span>
            <span>{overview?.summary.total_jobs ?? 0} Lifetime Executions</span>
          </div>
        </div>

        {/* Vehicle Class Distribution (lg:col-span-5) */}
        <div className="lg:col-span-5 rounded-3xl p-6 gw-panel shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-base text-[#1A1815] dark:text-white">Vehicle Distribution</h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">8 Supported MoRTH Roadway Classes</p>
            </div>
            <Link
              href="/app/analytics"
              className="text-xs font-semibold text-[#EA580C] dark:text-[#F59E0B] hover:underline"
            >
              Full Analytics →
            </Link>
          </div>

          <div className="my-2 space-y-2.5">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-black/5 dark:bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : overview && overview.vehicle_distribution.length > 0 ? (
              overview.vehicle_distribution.slice(0, 5).map((dist) => (
                <div key={dist.vehicle_class} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold capitalize text-[#1A1815] dark:text-white flex items-center gap-1.5">
                      {renderVehicleClassIcon(dist.vehicle_class)}
                      <span>{dist.vehicle_class.replace('_', ' ')}</span>
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {dist.count} ({dist.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#D8CFC0]/40 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#EA580C] dark:bg-[#F59E0B] transition-all duration-500"
                      style={{ width: `${Math.min(dist.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <Car className="w-8 h-8 text-zinc-400 mb-2" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  No vehicles localized yet.
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Run image or video detection in Studio.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#D8CFC0]/60 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Total Localized: {overview?.summary.total_vehicles_detected ?? 0}</span>
            <span className="text-[#EA580C] dark:text-[#F59E0B] font-bold">YOLOv8 Multi-Class</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION D — RECENT DETECTION ACTIVITY                                     */}
      {/* ========================================================================= */}
      <div className="rounded-3xl p-6 gw-panel shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#D8CFC0]/60 dark:border-white/10">
          <div>
            <h3 className="font-bold text-base text-[#1A1815] dark:text-white">Recent Recognition Activity</h3>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Live pipeline execution logs, localized vehicles &amp; extracted plate counts
            </p>
          </div>
          <Link
            href="/app/history"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#EA580C] dark:text-[#F59E0B] hover:underline"
          >
            <span>View All History ({overview?.summary.total_jobs ?? 0})</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-black/5 dark:bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : overview && overview.recent_jobs.length > 0 ? (
          <div className="divide-y divide-[#D8CFC0]/40 dark:divide-white/[0.06]">
            {overview.recent_jobs.map((job) => (
              <div
                key={job.job_id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-xl px-2 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/10 flex items-center justify-center flex-shrink-0 text-zinc-700 dark:text-zinc-200">
                    {job.media_type === 'video' ? (
                      <Video className="w-5 h-5 text-[#EA580C]" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[#EA580C]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#1A1815] dark:text-white truncate">
                        Job: {job.job_id.slice(0, 8)}...
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          job.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : job.status === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 flex items-center gap-2">
                      <span>{job.media_type.toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatDateShort(job.created_at)} at {formatTime(job.created_at)}</span>
                      {job.error_message && (
                        <span className="text-rose-500 truncate max-w-[200px]">
                          • {job.error_message}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  <div className="text-right font-mono text-xs">
                    <div className="font-bold text-[#1A1815] dark:text-white">
                      {job.vehicle_count} {job.vehicle_count === 1 ? 'vehicle' : 'vehicles'}
                    </div>
                    <div className="text-[11px] text-[#EA580C] dark:text-[#F59E0B]">
                      {job.recognized_plate_count} {job.recognized_plate_count === 1 ? 'plate' : 'plates'}
                    </div>
                  </div>

                  <Link
                    href={`/app/history/${encodeURIComponent(job.job_id)}`}
                    className="p-2 rounded-lg bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.08] text-zinc-700 dark:text-zinc-300 transition-colors"
                    title="View Job Details"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 sm:py-12 px-4 rounded-2xl bg-white/60 dark:bg-white/[0.02] border border-dashed border-[#D8CFC0] dark:border-white/10 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EA580C]/10 text-[#EA580C] flex items-center justify-center mb-3">
              <Scan className="w-7 h-7" />
            </div>
            <h4 className="text-base font-black text-[#1A1815] dark:text-white">
              No detection activity recorded yet
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-md">
              Your recognition workspace is ready. Launch the Live AI Studio to test verified Indian roadway benchmarks or upload custom traffic video feeds.
            </p>

            {/* Quick 3-Step Guided Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5 max-w-2xl w-full text-left">
              <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0]/60 dark:border-white/10">
                <div className="text-[10px] font-mono font-bold text-[#EA580C] uppercase">Step 01</div>
                <div className="text-xs font-bold text-[#1A1815] dark:text-white mt-0.5">Select Media</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Upload JPG/PNG or MP4 video corridor feed.</div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0]/60 dark:border-white/10">
                <div className="text-[10px] font-mono font-bold text-[#EA580C] uppercase">Step 02</div>
                <div className="text-xs font-bold text-[#1A1815] dark:text-white mt-0.5">Run YOLOv8 AI</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Detect vehicles and isolate license plate ROIs.</div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0]/60 dark:border-white/10">
                <div className="text-[10px] font-mono font-bold text-[#EA580C] uppercase">Step 03</div>
                <div className="text-xs font-bold text-[#1A1815] dark:text-white mt-0.5">MoRTH OCR</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Extract alphanumeric plates and persist telemetry.</div>
              </div>
            </div>

            <Link
              href="/app/detect"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Your First AI Detection</span>
            </Link>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION E — QUICK OPERATIONAL SHORTCUTS                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/app/detect"
          className="p-5 rounded-3xl gw-panel hover:border-[#EA580C] dark:hover:border-[#EA580C] transition-all group shadow-xs"
        >
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-[#EA580C] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Scan className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-[#1A1815] dark:text-white">
            Live AI Studio
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Execute 8-class vehicle localization &amp; OCR on fresh media
          </div>
        </Link>

        <Link
          href="/app/history"
          className="p-5 rounded-3xl gw-panel hover:border-[#EA580C] dark:hover:border-[#EA580C] transition-all group shadow-xs"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-[#1A1815] dark:text-white">
            Detection History
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Search, filter, inspect and export all historical detections
          </div>
        </Link>

        <Link
          href="/app/analytics"
          className="p-5 rounded-3xl gw-panel hover:border-[#EA580C] dark:hover:border-[#EA580C] transition-all group shadow-xs"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-[#1A1815] dark:text-white">
            Traffic Analytics
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Corridor volumes, vehicle class breakdown &amp; RTO jurisdictions
          </div>
        </Link>

        <Link
          href="/app/reports"
          className="p-5 rounded-3xl gw-panel hover:border-[#EA580C] dark:hover:border-[#EA580C] transition-all group shadow-xs"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-[#1A1815] dark:text-white">
            Audit Reports
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Preview, generate and export verified compliance PDF/CSV reports
          </div>
        </Link>
      </div>

      {/* Export Telemetry Modal (Uses Real Data) */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CFC0]/60 dark:border-white/10">
              <h3 className="text-lg font-bold text-[#1A1815] dark:text-white">Export ALPR Telemetry Log</h3>
              <button
                onClick={() => setIsExportOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Download verified recognition statistics, localized vehicle classes, and recent execution logs directly from the backend database:
              </p>

              <div className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-xs font-mono space-y-1 text-zinc-800 dark:text-zinc-200">
                <div>• Format: RFC 4180 Comma-Separated Values (CSV)</div>
                <div>• Total Jobs: {overview?.summary.total_jobs ?? 0}</div>
                <div>• Total Vehicles: {overview?.summary.total_vehicles_detected ?? 0}</div>
                <div>• Scope: Authenticated User Telemetry</div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-black/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-5 py-2 rounded-full bg-[#1A1815] hover:bg-[#2C2924] dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>Download Real CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
