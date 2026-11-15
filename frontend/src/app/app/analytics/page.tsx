'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AuthService, AuthSession } from '@/lib/auth';
import {
  getAnalyticsOverview,
  AnalyticsOverviewResponse,
  AnalyticsTimelinePoint,
  AnalyticsFilterParams,
} from '@/lib/api';
import {
  TrendingUp,
  Activity,
  Zap,
  BarChart3,
  PieChart,
  Clock,
  Car,
  Bike,
  Truck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Calendar,
  Layers,
  Gauge,
  Video,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  FileCode,
  ArrowUpRight,
  Filter,
  Info,
  Camera,
} from 'lucide-react';

const VEHICLE_CLASS_LABELS: Record<string, { label: string; color: string; barColor: string }> = {
  car: { label: 'Cars & SUVs', color: 'bg-emerald-500', barColor: '#10B981' },
  truck: { label: 'Heavy Trucks', color: 'bg-[#EA580C]', barColor: '#EA580C' },
  bus: { label: 'Commercial Buses', color: 'bg-amber-500', barColor: '#F59E0B' },
  motorbike: { label: 'Two-Wheelers (Bikes/Scooters)', color: 'bg-sky-500', barColor: '#0EA5E9' },
  motorcycle: { label: 'Two-Wheelers (Bikes/Scooters)', color: 'bg-sky-500', barColor: '#0EA5E9' },
  auto_rickshaw: { label: 'Three-Wheelers (Auto Rickshaws)', color: 'bg-indigo-500', barColor: '#6366F1' },
  three_wheeler: { label: 'Three-Wheelers (Auto Rickshaws)', color: 'bg-indigo-500', barColor: '#6366F1' },
  bicycle: { label: 'Bicycles', color: 'bg-teal-500', barColor: '#14B8A6' },
  other: { label: 'Other Vehicles', color: 'bg-zinc-400', barColor: '#9CA3AF' },
};

function formatLatency(ms?: number | null): string {
  if (ms == null || isNaN(ms)) return '—';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)} ms`;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export default function AnalyticsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Filter States
  const [datePreset, setDatePreset] = useState<'today' | '7d' | '30d' | '90d' | 'all' | 'custom'>('7d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'COMPLETED' | 'FAILED'>('all');

  // Chart hover states
  const [hoveredTimelinePoint, setHoveredTimelinePoint] = useState<AnalyticsTimelinePoint | null>(null);

  // Export modals
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Authentication & Session
  useEffect(() => {
    let active = AuthService.getSession();
    if (!active) {
      active = AuthService.initGuestSession();
    }
    setSession(active);

    const handleAuthChange = () => {
      setSession(AuthService.getSession());
      fetchAnalytics();
    };

    window.addEventListener('visionplate_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('visionplate_auth_change', handleAuthChange);
    };
  }, []);

  // Fetch Analytics from Backend
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: AnalyticsFilterParams = {
        media_type: mediaTypeFilter !== 'all' ? mediaTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };

      if (datePreset === 'today') {
        params.days = 1;
      } else if (datePreset === '7d') {
        params.days = 7;
      } else if (datePreset === '30d') {
        params.days = 30;
      } else if (datePreset === '90d') {
        params.days = 90;
      } else if (datePreset === 'all') {
        params.days = 365;
      } else if (datePreset === 'custom') {
        if (customStartDate) params.start_date = new Date(customStartDate).toISOString();
        if (customEndDate) params.end_date = new Date(customEndDate).toISOString();
      }

      const res = await getAnalyticsOverview(params);
      setAnalytics(res);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('Failed to load analytics overview:', err);
      setError(err.message || 'Unable to load operational analytics from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [datePreset, customStartDate, customEndDate, mediaTypeFilter, statusFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Max Timeline jobs for proportional scaling
  const maxTimelineJobs = useMemo(() => {
    if (!analytics || analytics.activity_timeline.length === 0) return 1;
    const maxVal = Math.max(...analytics.activity_timeline.map((p) => p.total_jobs));
    return maxVal > 0 ? maxVal : 1;
  }, [analytics]);

  // Max Hourly jobs for proportional scaling
  const maxHourlyCount = useMemo(() => {
    if (!analytics || analytics.time_distribution.hourly.length === 0) return 1;
    const maxVal = Math.max(...analytics.time_distribution.hourly.map((h) => h.count));
    return maxVal > 0 ? maxVal : 1;
  }, [analytics]);

  // Reset Filters
  const handleClearFilters = () => {
    setDatePreset('30d');
    setCustomStartDate('');
    setCustomEndDate('');
    setMediaTypeFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters =
    datePreset !== '30d' || mediaTypeFilter !== 'all' || statusFilter !== 'all';

  // Export RFC 4180 CSV
  const handleExportCsv = () => {
    if (!analytics) return;

    const escapeCsv = (val: any) => {
      if (val == null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    // Build multi-section analytical CSV
    const csvLines: string[] = [
      '# VisionPlate AI — Traffic & Recognition Analytics Report',
      `# Generated_At,${analytics.generated_at}`,
      `# Reporting_Period,${analytics.period.start_date} to ${analytics.period.end_date}`,
      '',
      '--- HEADLINE KPI SUMMARY ---',
      'Metric,Value',
      `Total Recognition Jobs,${analytics.summary.total_jobs}`,
      `Completed Jobs,${analytics.summary.completed_jobs}`,
      `Failed Jobs,${analytics.summary.failed_jobs}`,
      `Success Rate (%),${analytics.summary.success_rate != null ? analytics.summary.success_rate : 'N/A'}`,
      `Total Vehicles Detected,${analytics.summary.total_vehicles}`,
      `Total Plates Localized,${analytics.summary.total_plates}`,
      `Recognized Plates (OCR Valid),${analytics.summary.recognized_plates}`,
      `Unreadable Plates,${analytics.summary.unreadable_plates}`,
      `OCR Resolution Rate (%),${analytics.plate_analytics.recognition_rate != null ? analytics.plate_analytics.recognition_rate : 'N/A'}`,
      `Average Processing Latency (ms),${analytics.summary.average_latency_ms != null ? analytics.summary.average_latency_ms : 'N/A'}`,
      '',
      '--- DAILY ACTIVITY TIMELINE ---',
      'Date,Day_Name,Total_Jobs,Successful_Jobs,Failed_Jobs,Total_Vehicles',
      ...analytics.activity_timeline.map((t) =>
        [
          escapeCsv(t.date),
          escapeCsv(t.day_name),
          escapeCsv(t.total_jobs),
          escapeCsv(t.successful_jobs),
          escapeCsv(t.failed_jobs),
          escapeCsv(t.total_vehicles),
        ].join(',')
      ),
      '',
      '--- VEHICLE CLASS BREAKDOWN ---',
      'Vehicle_Class,Count,Percentage',
      ...analytics.vehicle_distribution.map((v) =>
        [escapeCsv(v.vehicle_class), escapeCsv(v.count), escapeCsv(v.percentage)].join(',')
      ),
      '',
      '--- JURISDICTION BREAKDOWN ---',
      'State_Code,State_Name,Count,Share_Percentage',
      ...analytics.plate_analytics.top_jurisdictions.map((j) =>
        [escapeCsv(j.code), escapeCsv(j.name), escapeCsv(j.count), escapeCsv(j.share)].join(',')
      ),
    ];

    const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visionplate_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // Export Full JSON
  const handleExportJson = () => {
    if (!analytics) return;
    const blob = new Blob([JSON.stringify(analytics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visionplate_analytics_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <div className="min-h-full font-sans p-6 sm:p-8 space-y-7 max-w-7xl w-full mx-auto relative text-[#1A1815] dark:text-zinc-100">
      {/* ========================================================================= */}
      {/* SECTION A: PAGE HEADING, METADATA & REFRESH ACTION                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#EA580C] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
              Operational Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white tracking-tight">
            Traffic &amp; Recognition Analytics
          </h1>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-400 mt-1 max-w-2xl">
            Understand vehicle detection activity, recognition performance and processing trends across your recorded sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {analytics && (
            <div className="hidden lg:flex flex-col items-end text-right mr-1">
              <span className="text-[10px] text-zinc-500 font-mono">
                {formatDate(analytics.period.start_date)} – {formatDate(analytics.period.end_date)}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowExportModal(true)}
            disabled={!analytics || analytics.summary.total_jobs === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4 text-[#EA580C]" />
            <span>Export Report</span>
          </button>

          <button
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-white dark:hover:bg-white/5 transition-all shadow-sm active:scale-95"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#EA580C]' : ''}`} />
          </button>

          <Link
            href="/app/detect"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Live AI Studio</span>
          </Link>
        </div>
      </div>

      {/* Synchronized Filter Toolbar */}
      <div className="p-4 rounded-2xl gw-panel shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Preset Date Range Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {(
            [
              { key: 'today', label: 'Today' },
              { key: '7d', label: 'Last 7 Days' },
              { key: '30d', label: 'Last 30 Days' },
              { key: '90d', label: 'Last 90 Days' },
              { key: 'all', label: 'All Time' },
              { key: 'custom', label: 'Custom Range' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDatePreset(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-xs ${
                datePreset === tab.key
                  ? 'bg-[#EA580C] text-white shadow-sm ring-2 ring-[#EA580C]/20'
                  : 'bg-white/60 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/10 border border-[#D8CFC0] dark:border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers (if custom selected) */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-mono"
            />
            <span className="text-zinc-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-mono"
            />
          </div>
        )}

        {/* Media & Status Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-zinc-500 uppercase">Media:</span>
            <select
              value={mediaTypeFilter}
              onChange={(e) => setMediaTypeFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            >
              <option value="all">All Media</option>
              <option value="image">Images Only</option>
              <option value="video">Videos Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-zinc-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            >
              <option value="all">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-[11px] font-bold text-[#EA580C] hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: KEY ANALYTICS METRICS (6 KPI CARDS)                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* KPI 1: Total Recognition Jobs */}
        <div className="p-4 rounded-2xl gw-panel shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Recognition Jobs</span>
            <Layers className="w-3.5 h-3.5 text-[#EA580C]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5 font-mono">
            {isLoading ? (
              <span className="inline-block w-12 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              (analytics?.summary.total_jobs ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            {analytics?.summary.completed_jobs ?? 0} ok &bull; {analytics?.summary.failed_jobs ?? 0} failed
          </div>
        </div>

        {/* KPI 2: Total Vehicles Detected */}
        <div className="p-4 rounded-2xl gw-panel shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Vehicles Detected</span>
            <Car className="w-3.5 h-3.5 text-[#EA580C]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5 font-mono">
            {isLoading ? (
              <span className="inline-block w-12 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              (analytics?.summary.total_vehicles ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            Across {analytics?.summary.total_jobs ?? 0} sessions
          </div>
        </div>

        {/* KPI 3: Total Plates Localized */}
        <div className="p-4 rounded-2xl gw-panel shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Plates Localized</span>
            <Gauge className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5 font-mono">
            {isLoading ? (
              <span className="inline-block w-12 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              (analytics?.summary.total_plates ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            ROI bounding boxes
          </div>
        </div>

        {/* KPI 4: Recognized Plates (OCR) */}
        <div className="p-4 rounded-2xl gw-panel shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Recognized Plates</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5 font-mono">
            {isLoading ? (
              <span className="inline-block w-12 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              (analytics?.summary.recognized_plates ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
            {analytics?.plate_analytics.recognition_rate != null
              ? `${analytics.plate_analytics.recognition_rate}% resolution`
              : '—'}
          </div>
        </div>

        {/* KPI 5: Success Rate */}
        <div className="p-4 rounded-2xl gw-panel shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Job Success Rate</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5 font-mono">
            {isLoading ? (
              <span className="inline-block w-12 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : analytics?.summary.success_rate != null ? (
              `${analytics.summary.success_rate.toFixed(1)}%`
            ) : (
              '—'
            )}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            Completed / Terminal
          </div>
        </div>

        {/* KPI 6: Average Processing Latency */}
        <div className="p-4 rounded-2xl gw-panel shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Average Latency</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5 font-mono">
            {isLoading ? (
              <span className="inline-block w-12 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              formatLatency(analytics?.summary.average_latency_ms)
            )}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            Completed jobs only
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION C & D: ACTIVITY TIMELINE & VEHICLE CLASS DISTRIBUTION             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SECTION C: Recognition Jobs Over Time (lg:col-span-7) */}
        <div className="lg:col-span-7 rounded-3xl p-6 gw-panel shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-[#1A1815] dark:text-white">
                Recognition Jobs Over Time
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Daily volume of executed neural recognition jobs and localized vehicle entities.
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-zinc-500 bg-white dark:bg-white/5 px-2.5 py-1 rounded-lg border border-[#D8CFC0] dark:border-white/10">
              {analytics?.activity_timeline.length ?? 0} Daily Buckets
            </span>
          </div>

          {/* Interactive Timeline Bar Chart */}
          <div className="relative min-h-[180px] flex items-end">
            {isLoading ? (
              <div className="h-44 w-full bg-zinc-200 dark:bg-zinc-800/40 rounded-2xl animate-pulse" />
            ) : analytics && analytics.activity_timeline.length > 0 ? (
              <div className="flex items-end justify-between gap-1 sm:gap-2 h-44 w-full pt-8 pb-2 px-1">
                {analytics.activity_timeline.map((point) => {
                  const jobPct = (point.total_jobs / maxTimelineJobs) * 100;
                  const isPeak = point.total_jobs === maxTimelineJobs && point.total_jobs > 0;
                  const hasJobs = point.total_jobs > 0;

                  return (
                    <div
                      key={point.date}
                      onMouseEnter={() => setHoveredTimelinePoint(point)}
                      onMouseLeave={() => setHoveredTimelinePoint(null)}
                      className="relative flex flex-col items-center gap-1.5 flex-1 h-full justify-end group cursor-pointer"
                    >
                      {/* Floating Tooltip */}
                      {hoveredTimelinePoint?.date === point.date && (
                        <div className="absolute -top-14 z-30 px-3 py-1.5 rounded-xl bg-[#1A1815] dark:bg-white text-white dark:text-black text-[10px] font-mono font-bold shadow-2xl whitespace-nowrap pointer-events-none">
                          <div>{point.date} ({point.day_name})</div>
                          <div className="text-amber-400 dark:text-orange-600">
                            {point.total_jobs} Jobs &bull; {point.successful_jobs} OK &bull; {point.failed_jobs} Fail
                          </div>
                          <div className="text-emerald-400 dark:text-emerald-600">
                            {point.total_vehicles} Vehicles Localized
                          </div>
                        </div>
                      )}

                      {/* Peak Tag */}
                      {isPeak && (
                        <div className="absolute top-0 px-1 py-0.2 rounded-full bg-[#EA580C] text-white text-[8px] font-bold font-mono">
                          Peak
                        </div>
                      )}

                      {/* Bar Pillar */}
                      <div
                        className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 group-hover:scale-105 ${
                          isPeak
                            ? 'bg-[#EA580C] shadow-[0_4px_12px_rgba(234,88,12,0.3)]'
                            : hasJobs
                            ? 'bg-[#1A1815] dark:bg-white/40'
                            : 'bg-[#EAE3D5] dark:bg-white/10'
                        }`}
                        style={{ height: hasJobs ? `${Math.max(jobPct, 12)}%` : '6%' }}
                      />

                      <span className="text-[9px] font-semibold text-zinc-500 font-mono truncate max-w-[28px]">
                        {point.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-44 w-full flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02]">
                <Activity className="w-8 h-8 text-zinc-400 mb-2" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">No activity in selected timeframe.</p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#D8CFC0]/60 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Aggregated across user jobs</span>
            <span>{analytics?.summary.total_jobs ?? 0} Executions in Period</span>
          </div>
        </div>

        {/* SECTION D: Vehicle Class Analytics (lg:col-span-5) */}
        <div className="lg:col-span-5 rounded-3xl p-6 gw-panel shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-[#1A1815] dark:text-white">
                Vehicle Class Distribution
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Classification breakdown from verified YOLOv8 detector instances.
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-zinc-500 bg-white dark:bg-white/5 px-2.5 py-1 rounded-lg border border-[#D8CFC0] dark:border-white/10">
              {analytics?.summary.total_vehicles ?? 0} Vehicles
            </span>
          </div>

          <div className="space-y-3.5 my-2">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-zinc-200 dark:bg-zinc-800/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : !analytics || analytics.vehicle_distribution.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 bg-white/40 dark:bg-white/[0.02] rounded-2xl border border-[#D8CFC0] dark:border-white/10">
                No localized vehicles recorded in this period.
              </div>
            ) : (
              analytics.vehicle_distribution.map((vc) => {
                const conf = VEHICLE_CLASS_LABELS[vc.vehicle_class] || {
                  label: vc.vehicle_class.toUpperCase(),
                  color: 'bg-zinc-400',
                  barColor: '#9CA3AF',
                };

                return (
                  <div key={vc.vehicle_class} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${conf.color}`} />
                        <span className="font-bold text-[#1A1815] dark:text-white">{conf.label}</span>
                      </div>
                      <div className="font-mono text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                        <span className="font-bold">{vc.count.toLocaleString()}</span>
                        <span className="text-zinc-400">({vc.percentage}%)</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-[#EAE3D5] dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(vc.percentage, 2))}%`,
                          backgroundColor: conf.barColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-[#D8CFC0]/60 dark:border-white/10 text-[11px] text-zinc-500 font-medium">
            Based strictly on persisted vehicle classifications.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION E & F: PLATE RECOGNITION ANALYTICS & IMAGE VS VIDEO               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SECTION E: License Plate Recognition & Jurisdiction (lg:col-span-7) */}
        <div className="lg:col-span-7 rounded-3xl p-6 gw-panel shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-[#1A1815] dark:text-white">
                License Plate Recognition &amp; Jurisdiction
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Distinction between localized plate bounding boxes and valid extracted OCR registration numbers.
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              MoRTH Compliant
            </span>
          </div>

          {/* Plate vs OCR Metric Split */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-xs">
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Localized Plates</div>
              <div className="text-xl font-black text-[#1A1815] dark:text-white mt-1 font-mono">
                {analytics?.plate_analytics.total_detected ?? 0}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Plate detector ROIs</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">OCR Resolved</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {analytics?.plate_analytics.recognized ?? 0}
              </div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">Valid text extracted</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Unreadable OCR</div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {analytics?.plate_analytics.unreadable ?? 0}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Obscured or ambiguous</div>
            </div>
          </div>

          {/* Top Jurisdictions Derived from Real Plates */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Identified State / UT Jurisdictions (From Recognized Plates)
            </h4>

            {isLoading ? (
              <div className="h-20 bg-zinc-200 dark:bg-zinc-800/40 rounded-xl animate-pulse" />
            ) : !analytics || analytics.plate_analytics.top_jurisdictions.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 bg-white/40 dark:bg-white/[0.02] rounded-xl border border-[#D8CFC0] dark:border-white/10">
                No recognized plate strings to extract regional jurisdictions.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {analytics.plate_analytics.top_jurisdictions.map((jur) => (
                  <div
                    key={jur.code}
                    className="p-3 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-xs flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm text-[#1A1815] dark:text-white">
                        {jur.code}
                      </span>
                      <span className="text-[10px] font-bold text-[#EA580C]">{jur.share}%</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate mt-1">{jur.name}</div>
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{jur.count} plates</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION F: Image vs Video Analytics (lg:col-span-5) */}
        <div className="lg:col-span-5 rounded-3xl p-6 gw-panel shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-[#1A1815] dark:text-white">
                  Image vs Video Breakdown
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Performance and volume across still imagery and sampled video streams.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 mt-4">
              {/* Image Jobs Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <ImageIcon className="w-4 h-4" />
                  <span className="font-bold text-xs">Image Sessions</span>
                </div>
                <div className="text-2xl font-black text-[#1A1815] dark:text-white font-mono">
                  {analytics?.media_breakdown.image_jobs ?? 0}
                </div>
                <div className="text-[10px] text-zinc-500 space-y-0.5">
                  <div>Vehicles: {analytics?.media_breakdown.image_vehicles ?? 0}</div>
                  <div>Avg Latency: {formatLatency(analytics?.media_breakdown.image_avg_latency_ms)}</div>
                </div>
              </div>

              {/* Video Jobs Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Video className="w-4 h-4" />
                  <span className="font-bold text-xs">Video Streams</span>
                </div>
                <div className="text-2xl font-black text-[#1A1815] dark:text-white font-mono">
                  {analytics?.media_breakdown.video_jobs ?? 0}
                </div>
                <div className="text-[10px] text-zinc-500 space-y-0.5">
                  <div>Vehicles: {analytics?.media_breakdown.video_vehicles ?? 0}</div>
                  <div>Avg Latency: {formatLatency(analytics?.media_breakdown.video_avg_latency_ms)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-900 dark:text-orange-300 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-[#EA580C]" />
            <span>Video feeds are sampled at 1 FPS to balance throughput and detection coverage.</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION G & H: PROCESSING PERFORMANCE & TIME-BASED ACTIVITY               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SECTION G: Processing Performance Analytics (lg:col-span-6) */}
        <div className="lg:col-span-6 rounded-3xl p-6 gw-panel shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-base text-[#1A1815] dark:text-white">
              Processing Performance Analytics
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              End-to-end inference durations across completed neural execution jobs.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-xs">
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Min Latency</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {formatLatency(analytics?.performance.min_latency_ms)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Average Latency</div>
              <div className="text-lg font-black text-[#1A1815] dark:text-white mt-1 font-mono">
                {formatLatency(analytics?.performance.avg_latency_ms)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Max Latency</div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {formatLatency(analytics?.performance.max_latency_ms)}
              </div>
            </div>
          </div>

          {/* Latency Brackets */}
          <div className="space-y-2 text-xs">
            <div className="font-bold text-zinc-500 uppercase text-[10px] tracking-wider">
              Duration Distribution Brackets
            </div>
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <div className="font-bold text-base">{analytics?.performance.fast_count ?? 0}</div>
                <div className="text-[9px] mt-0.5">&lt; 1,000 ms (Fast)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300">
                <div className="font-bold text-base">{analytics?.performance.normal_count ?? 0}</div>
                <div className="text-[9px] mt-0.5">1s – 2.5s (Normal)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300">
                <div className="font-bold text-base">{analytics?.performance.heavy_count ?? 0}</div>
                <div className="text-[9px] mt-0.5">&gt; 2.5s (Heavy/Video)</div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION H: Time-Based Activity Insights (lg:col-span-6) */}
        <div className="lg:col-span-6 rounded-3xl p-6 gw-panel shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-base text-[#1A1815] dark:text-white">
              Application Processing Workload
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Workload distribution across hours of day and days of week based on job creation timestamps.
            </p>
          </div>

          {/* 24-Hour Workload Distribution Bar Graphic */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase">
              <span>Hourly Workload Pattern</span>
              <span className="font-mono text-[10px] text-zinc-400">00:00 – 23:00 (UTC)</span>
            </div>

            <div className="h-20 flex items-end justify-between gap-0.5 sm:gap-1 p-2 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
              {analytics?.time_distribution.hourly.map((h) => {
                const pct = (h.count / maxHourlyCount) * 100;
                return (
                  <div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    title={`${h.hour}: ${h.count} jobs`}
                  >
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        h.count > 0 ? 'bg-[#EA580C]' : 'bg-zinc-200 dark:bg-white/10'
                      }`}
                      style={{ height: h.count > 0 ? `${Math.max(pct, 15)}%` : '8%' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekday Distribution Pills */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-zinc-500 uppercase">Weekday Workload Breakdown</div>
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
              {analytics?.time_distribution.weekday.map((w) => (
                <div
                  key={w.day}
                  className="p-2 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10"
                >
                  <div className="text-[10px] font-bold text-zinc-500">{w.day}</div>
                  <div className="font-mono font-bold text-xs text-[#1A1815] dark:text-white mt-0.5">
                    {w.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 italic">
            * Note: Reflects user inference processing sessions, not real-world highway traffic volume.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPORT MODAL                                                              */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CFC0] dark:border-white/10">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#EA580C]" />
                <h3 className="font-extrabold text-base text-[#1A1815] dark:text-white">
                  Export Operational Analytics
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Download your complete operational intelligence report for the selected filter period ({formatDate(analytics?.period.start_date || '')} to {formatDate(analytics?.period.end_date || '')}).
            </p>

            <div className="p-3.5 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Query Period:</span>
                <span className="font-bold text-[#1A1815] dark:text-white">{analytics?.period.days ?? 30} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Jobs in Scope:</span>
                <span className="font-mono font-bold text-[#EA580C]">{analytics?.summary.total_jobs ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Format Standards:</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">RFC 4180 CSV &bull; UTF-8 JSON</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white"
              >
                <FileCode className="w-3.5 h-3.5 text-[#EA580C]" />
                Export JSON
              </button>
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
