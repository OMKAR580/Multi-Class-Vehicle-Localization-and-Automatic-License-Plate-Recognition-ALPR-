'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { FolderFile } from '@/components/ui/glass-folder-cards';

const GlassFolder = dynamic(() => import('@/components/ui/glass-folder-cards'), {
  ssr: false,
  loading: () => (
    <div className="w-[340px] h-[260px] rounded-2xl bg-zinc-100/50 dark:bg-zinc-800/30 animate-pulse flex items-center justify-center">
      <span className="w-8 h-8 rounded-full border-2 border-[#EA580C] border-t-transparent animate-spin" />
    </div>
  ),
});
import { AuthService, AuthSession } from '@/lib/auth';
import {
  getRecognitionHistory,
  getRecognitionJobDetail,
  getDashboardStats,
  getFileContentUrl,
  fetchAuthenticatedBlob,
  RecognitionHistoryItem,
  RecognitionHistoryResponse,
  RecognitionResponse,
  VideoRecognitionResponse,
  DashboardStats,
  VehicleResult,
} from '@/lib/api';
import {
  Search,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  Camera,
  FolderOpen,
  Layers,
  Video,
  Image as ImageIcon,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Car,
  Sparkles,
  FileCode,
  Filter,
  Clock,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

const VEHICLE_CLASS_LABELS: Record<string, string> = {
  car: 'Car / SUV',
  truck: 'Heavy Truck',
  bus: 'Commercial Bus',
  motorbike: 'Motorcycle / 2-W',
  motorcycle: 'Motorcycle / 2-W',
  auto_rickshaw: 'Auto Rickshaw (3-W)',
  three_wheeler: 'Three Wheeler (3-W)',
  bicycle: 'Bicycle',
};

function formatVehicleClass(cls?: string): string {
  if (!cls) return 'Vehicle';
  const clean = cls.toLowerCase().trim();
  return VEHICLE_CLASS_LABELS[clean] || cls.charAt(0).toUpperCase() + cls.slice(1);
}

function formatDate(isoString: string): { formatted: string; relative: string } {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return { formatted: isoString, relative: '' };
    }
    const formatted = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = 'just now';
    if (diffDays > 0) {
      relative = `${diffDays}d ago`;
    } else if (diffHours > 0) {
      relative = `${diffHours}h ago`;
    } else if (diffMin > 0) {
      relative = `${diffMin}m ago`;
    }

    return { formatted, relative };
  } catch {
    return { formatted: isoString, relative: '' };
  }
}

function formatLatency(ms?: number | null): string {
  if (ms == null || isNaN(ms)) return '—';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)} ms`;
}

export default function HistoryPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [historyData, setHistoryData] = useState<RecognitionHistoryResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [vehicleClassFilter, setVehicleClassFilter] = useState<'all' | 'car' | 'truck' | 'bus' | 'motorbike' | 'auto_rickshaw'>('all');
  const [selectedCollection, setSelectedCollection] = useState<'none' | 'images' | 'multi' | 'plates' | 'all'>('none');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Detail Modal state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<RecognitionResponse | VideoRecognitionResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailViewTab, setDetailViewTab] = useState<'annotated' | 'raw'>('annotated');
  const [rawBlobUrl, setRawBlobUrl] = useState<string | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);

  // Utility modals / interactions
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Batch selection state & table anchor ref
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);

  // Read initial search query from URL (e.g., from DashboardHeader search redirect)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q') || params.get('search');
      if (q) {
        setSearchInput(q);
        setDebouncedSearch(q);
        setTimeout(() => {
          tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } catch {}
  }, []);

  // Batch Selection Handlers
  const handleToggleSelectJob = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const handleSelectAllOnPage = () => {
    if (!historyData || displayedItems.length === 0) return;
    const pageIds = displayedItems.map((j) => j.job_id);
    const allSelected = pageIds.every((id) => selectedJobIds.has(id));
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleExportSelectedCsv = () => {
    if (selectedJobIds.size === 0 || !historyData) return;
    const selectedRecords = historyData.items.filter((j) => selectedJobIds.has(j.job_id));
    handleExportCsv(selectedRecords);
  };

  // Session & Auth change listeners
  useEffect(() => {
    let active = AuthService.getSession();
    if (!active) {
      active = AuthService.initGuestSession();
    }
    setSession(active);

    const handleAuthChange = () => {
      setSession(AuthService.getSession());
      setCurrentPage(1);
      fetchHistoryRecords();
      fetchOverviewStats();
    };

    window.addEventListener('visionplate_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('visionplate_auth_change', handleAuthChange);
    };
  }, []);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch Stats for Overview Section A
  const fetchOverviewStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: any) {
      console.warn('Could not fetch overview stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Fetch Paginated History Records
  const fetchHistoryRecords = useCallback(async () => {
    setIsLoadingHistory(true);
    setError(null);
    try {
      let startDateStr: string | undefined = undefined;
      const now = new Date();
      if (dateRangeFilter === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDateStr = start.toISOString();
      } else if (dateRangeFilter === '7d') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateStr = start.toISOString();
      } else if (dateRangeFilter === '30d') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDateStr = start.toISOString();
      }

      const res = await getRecognitionHistory({
        page: currentPage,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        media_type: mediaTypeFilter !== 'all' ? mediaTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        start_date: startDateStr,
        vehicle_class: vehicleClassFilter !== 'all' ? vehicleClassFilter : undefined,
      });

      setHistoryData(res);
    } catch (err: any) {
      console.error('Failed to load recognition history:', err);
      setError(err.message || 'Unable to load detection history records from backend.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [
    currentPage,
    pageSize,
    debouncedSearch,
    mediaTypeFilter,
    statusFilter,
    dateRangeFilter,
    vehicleClassFilter,
  ]);

  useEffect(() => {
    fetchOverviewStats();
  }, [fetchOverviewStats]);

  useEffect(() => {
    fetchHistoryRecords();
  }, [fetchHistoryRecords]);

  // Handle Detail Modal Opening & Data Fetching
  useEffect(() => {
    if (!selectedJobId) {
      setJobDetail(null);
      setDetailError(null);
      if (rawBlobUrl) {
        URL.revokeObjectURL(rawBlobUrl);
        setRawBlobUrl(null);
      }
      return;
    }

    let isMounted = true;
    setIsLoadingDetail(true);
    setDetailError(null);
    setDetailViewTab('annotated');
    setActiveFrameIndex(0);

    getRecognitionJobDetail(selectedJobId)
      .then(async (detail) => {
        if (!isMounted) return;
        setJobDetail(detail);

        // Pre-fetch raw asset blob using authenticated stream if available
        if (detail.file_id) {
          try {
            const blob = await fetchAuthenticatedBlob(getFileContentUrl(detail.file_id));
            if (isMounted) {
              const url = URL.createObjectURL(blob);
              setRawBlobUrl(url);
            }
          } catch (blobErr) {
            console.warn('Could not fetch raw blob for job detail:', blobErr);
          }
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error('Failed to fetch job detail:', err);
        setDetailError(err.message || 'Failed to retrieve detailed recognition telemetry.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      isMounted = false;
      if (rawBlobUrl) {
        URL.revokeObjectURL(rawBlobUrl);
      }
    };
  }, [selectedJobId]);

  // Copy to Clipboard Helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Download Annotated Image Helper
  const handleDownloadAnnotatedImage = () => {
    if (!jobDetail) return;
    const isImageJob = 'annotated_image' in jobDetail;
    if (isImageJob && jobDetail.annotated_image) {
      const a = document.createElement('a');
      a.href = `data:image/jpeg;base64,${jobDetail.annotated_image}`;
      a.download = `visionplate_${jobDetail.job_id}_annotated.jpg`;
      a.click();
    }
  };

  // Download Job JSON Helper
  const handleDownloadJobJson = () => {
    if (!jobDetail) return;
    const blob = new Blob([JSON.stringify(jobDetail, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visionplate_job_${jobDetail.job_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter Reset Helper
  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setMediaTypeFilter('all');
    setStatusFilter('all');
    setDateRangeFilter('all');
    setVehicleClassFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    mediaTypeFilter !== 'all' ||
    statusFilter !== 'all' ||
    dateRangeFilter !== 'all' ||
    vehicleClassFilter !== 'all' ||
    selectedCollection !== 'none';

  // Three Existing Dossier Collections (Page-Local Perspectives with 100% Count Integrity)
  const imageJobsCount = useMemo(() => (historyData?.items || []).filter((j) => j.media_type === 'image' && j.status === 'COMPLETED').length, [historyData]);
  const multiVehCount = useMemo(() => (historyData?.items || []).filter((j) => j.vehicle_count > 1 || j.status === 'FAILED').length, [historyData]);
  const plateJobsCount = useMemo(() => (historyData?.items || []).filter((j) => j.plates && j.plates.length > 0).length, [historyData]);
  const allCount = historyData?.items?.length || 0;

  const displayedItems = useMemo(() => {
    const raw = historyData?.items || [];
    if (selectedCollection === 'images') {
      return raw.filter((j) => j.media_type === 'image' && j.status === 'COMPLETED');
    }
    if (selectedCollection === 'multi') {
      return raw.filter((j) => j.vehicle_count > 1 || j.status === 'FAILED');
    }
    if (selectedCollection === 'plates') {
      return raw.filter((j) => j.plates && j.plates.length > 0);
    }
    if (selectedCollection === 'all') {
      return raw;
    }
    return raw;
  }, [historyData, selectedCollection]);

  const activeFolderTitle = useMemo(() => {
    switch (selectedCollection) {
      case 'images': return 'Recent Image Scans';
      case 'multi': return 'Multi-Vehicle Vault';
      case 'plates': return 'MoRTH Plate Archive';
      case 'all': return 'All Inferences Archive';
      default: return '';
    }
  }, [selectedCollection]);

  const activeFolderSubtitle = useMemo(() => {
    switch (selectedCollection) {
      case 'images': return 'Encapsulated single-frame completed image recognitions';
      case 'multi': return 'Encapsulated jobs with multi-vehicle clusters or execution alerts';
      case 'plates': return 'Encapsulated localized vehicles with verified Indian registration plates';
      case 'all': return 'Full unsegmented detection history archive';
      default: return '';
    }
  }, [selectedCollection]);

  const dossierFolders = useMemo(() => {
    const items = historyData?.items || [];
    const imageJobs = items.filter((j) => j.media_type === 'image' && j.status === 'COMPLETED');
    const multiVehJobs = items.filter((j) => j.vehicle_count > 1 || j.status === 'FAILED');
    const plateJobs = items.filter((j) => j.plates && j.plates.length > 0);

    const toFolderFile = (job: RecognitionHistoryItem): FolderFile => ({
      name: job.plates && job.plates[0] ? job.plates[0] : (job.filename || `Job #${job.job_id.slice(0, 8)}`),
      meta: `${job.vehicle_count} Veh · ${formatLatency(job.processing_time_ms)}`,
    });

    return [
      {
        id: 'images' as const,
        label: 'Recent Image Scans',
        badge: 'Single-Frame ALPR',
        description: 'Completed single-frame image inferences on current page.',
        art: 'aurora' as const,
        count: imageJobs.length,
        files: imageJobs.slice(0, 4).map((j) => toFolderFile(j)),
        onApply: () => {
          setSelectedCollection('images');
          setCurrentPage(1);
          setTimeout(() => {
            tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        },
      },
      {
        id: 'multi' as const,
        label: 'Multi-Vehicle Vault',
        badge: 'High-Density / Flagged',
        description: 'Jobs containing multi-vehicle clusters or execution warnings.',
        art: 'ember' as const,
        count: multiVehJobs.length,
        files: multiVehJobs.slice(0, 4).map((j) => toFolderFile(j)),
        onApply: () => {
          setSelectedCollection('multi');
          setCurrentPage(1);
          setTimeout(() => {
            tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        },
      },
      {
        id: 'plates' as const,
        label: 'MoRTH Plate Archive',
        badge: 'HSRP Standard Match',
        description: 'Localized vehicles with verified Indian registration plates.',
        art: 'glacier' as const,
        count: plateJobs.length,
        files: plateJobs.slice(0, 4).map((j) => toFolderFile(j)),
        onApply: () => {
          setSelectedCollection('plates');
          setCurrentPage(1);
          setTimeout(() => {
            tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        },
      },
    ];
  }, [historyData]);

  // Export RFC 4180 CSV
  const handleExportCsv = (customRecords?: RecognitionHistoryItem[]) => {
    const records = customRecords || historyData?.items || [];
    if (records.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = [
      'Job_ID',
      'Media_Type',
      'Filename',
      'Status',
      'Created_At',
      'Processing_Time_Ms',
      'Vehicles_Detected',
      'Vehicle_Classes',
      'Plates_Detected',
      'Recognized_Plates',
      'Error_Message',
    ];

    const escapeCsv = (val: any) => {
      if (val == null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = records.map((r) => [
      escapeCsv(r.job_id),
      escapeCsv(r.media_type),
      escapeCsv(r.filename || ''),
      escapeCsv(r.status),
      escapeCsv(r.created_at),
      escapeCsv(r.processing_time_ms != null ? r.processing_time_ms : ''),
      escapeCsv(r.vehicle_count),
      escapeCsv((r.vehicle_types || []).join('; ')),
      escapeCsv(r.plate_count),
      escapeCsv((r.plates || []).join('; ')),
      escapeCsv(r.error_message || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visionplate_history_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <div className="min-h-full font-sans p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl w-full mx-auto relative text-[#1A1815] dark:text-zinc-100">
      {/* ========================================================================= */}
      {/* SECTION A: COMMAND HEADER & REAL-TIME SUMMARY METRICS                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-extrabold tracking-widest uppercase text-[#EA580C] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
              Operational Audit Trail
            </span>
            {historyData && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#1A1815]/5 text-zinc-700 dark:bg-white/10 dark:text-zinc-300 border border-[#D8CFC0] dark:border-white/10">
                {historyData.total} Total Executions
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white tracking-tight">
            Detection History
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            Explore, filter, and inspect your previous recognition jobs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            disabled={!historyData || historyData.items.length === 0}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-40 transition-all shadow-xs active:scale-95"
          >
            <Download className="w-4 h-4 text-[#EA580C]" />
            <span>Export CSV / RFC 4180</span>
          </button>

          <button
            onClick={() => {
              fetchHistoryRecords();
              fetchOverviewStats();
            }}
            disabled={isLoadingHistory}
            className="inline-flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-white dark:hover:bg-white/5 transition-all shadow-xs active:scale-95"
            title="Refresh History Records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin text-[#EA580C]' : 'text-zinc-600 dark:text-zinc-400'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/app/detect"
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Live AI Studio</span>
          </Link>
        </div>
      </div>

      {/* Overview Operational Metrics Bar (4 Genuine Backend Aggregates) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Detection Jobs */}
        <div className="p-4 rounded-2xl gw-panel shadow-xs hover:border-[#EA580C]/40 transition-colors">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Total Detection Jobs</span>
            <Layers className="w-4 h-4 text-[#EA580C]" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5">
            {isLoadingStats ? (
              <span className="inline-block w-16 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              (stats?.total_jobs ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium mt-1 flex items-center gap-1.5">
            <span>{stats?.image_jobs ?? 0} images</span>
            <span>&bull;</span>
            <span>{stats?.video_jobs ?? 0} videos</span>
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="p-4 rounded-2xl gw-panel shadow-xs hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Completed Jobs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5">
            {isLoadingStats ? (
              <span className="inline-block w-16 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              (stats?.completed_jobs ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{(stats?.success_rate ?? 100).toFixed(1)}% Success Rate</span>
          </div>
        </div>

        {/* Failed Jobs */}
        <div className="p-4 rounded-2xl gw-panel shadow-xs hover:border-rose-500/40 transition-colors">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Failed Jobs</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5">
            {isLoadingStats ? (
              <span className="inline-block w-16 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              (stats?.failed_jobs ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium mt-1">
            {stats?.failed_jobs ? `${stats.failed_jobs} flagged for inspection` : '0 pipeline exceptions'}
          </div>
        </div>

        {/* Total Vehicles & Plates Detected */}
        <div className="p-4 rounded-2xl gw-panel shadow-xs hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Total Vehicles Detected</span>
            <Car className="w-4 h-4 text-[#EA580C]" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1A1815] dark:text-white mt-1.5">
            {isLoadingStats ? (
              <span className="inline-block w-16 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
            ) : (
              (stats?.total_vehicles_detected ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>{stats?.recognized_plates ?? 0} plates resolved</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION B: FILE MANAGER ARCHITECTURE                                      */}
      {/* Level 1: Root Folder Directory (selectedCollection === 'none')            */}
      {/* Level 2: Inside Folder View with Breadcrumb & Reports (selected !== 'none')*/}
      {/* ========================================================================= */}
      {selectedCollection === 'none' ? (
        /* ------------------------------------------------------------------------- */
        /* LEVEL 1: DIRECT FOLDER CARDS (NO OUTER WRAPPER BOX)                      */
        /* ------------------------------------------------------------------------- */
        <div className="w-full grid grid-cols-1 md:grid-cols-3 items-end justify-items-center gap-6 pt-1">
          {dossierFolders.map((folder, idx) => (
            <div
              key={folder.label}
              onClick={() => folder.onApply()}
              className="w-full max-w-sm rounded-2xl p-4 transition-all duration-200 flex flex-col items-center gap-3 border cursor-pointer hover:shadow-xl hover:-translate-y-1 gw-panel hover:border-[#EA580C]/60 group shadow-xs"
            >
              <div className="w-full flex items-center justify-between text-xs">
                <span className="font-bold text-[#1A1815] dark:text-white flex items-center gap-1.5 group-hover:text-[#EA580C] transition-colors">
                  <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
                  {folder.label}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EA580C]/10 text-[#EA580C] font-mono font-bold">
                  {folder.count} {folder.count === 1 ? 'report' : 'reports'}
                </span>
              </div>

              {/* 3D Glass Folder Component */}
              <div className="w-full flex justify-center py-2 pointer-events-auto">
                <GlassFolder
                  label={folder.label}
                  art={folder.art}
                  seed={idx * 5 + 3}
                  appearDelay={idx * 100}
                  onFileSelect={() => {
                    folder.onApply();
                  }}
                  files={
                    folder.files.length > 0
                      ? folder.files
                      : [
                          {
                            name: 'Archive Empty',
                            meta: 'No jobs in current page',
                          },
                        ]
                  }
                />
              </div>

              <p className="text-[11px] text-zinc-500 text-center line-clamp-1">
                {folder.description}
              </p>
            </div>
          ))}
        </div>
      ) : (
        /* ------------------------------------------------------------------------- */
        /* LEVEL 2: INSIDE FOLDER VIEW (FILE MANAGER EXPLORER)                       */
        /* ------------------------------------------------------------------------- */
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Active Folder Breadcrumb Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#EA580C]/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCollection('none')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-[#EA580C] hover:text-[#EA580C] transition-all cursor-pointer shadow-xs shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to All Folders</span>
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-[#1A1815] dark:text-white flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-[#EA580C]" />
                    <span>Folder: {activeFolderTitle}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EA580C] text-white">
                    {displayedItems.length} {displayedItems.length === 1 ? 'Report' : 'Reports'} Inside
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {activeFolderSubtitle}
                </div>
              </div>
            </div>

            {/* Quick Switcher Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase mr-1">Switch:</span>
              <button
                onClick={() => {
                  setSelectedCollection('images');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCollection === 'images'
                    ? 'bg-[#EA580C] text-white shadow-xs'
                    : 'bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                Images ({imageJobsCount})
              </button>
              <button
                onClick={() => {
                  setSelectedCollection('multi');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCollection === 'multi'
                    ? 'bg-[#EA580C] text-white shadow-xs'
                    : 'bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                Multi-Veh ({multiVehCount})
              </button>
              <button
                onClick={() => {
                  setSelectedCollection('plates');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCollection === 'plates'
                    ? 'bg-[#EA580C] text-white shadow-xs'
                    : 'bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                Plates ({plateJobsCount})
              </button>
              <button
                onClick={() => {
                  setSelectedCollection('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCollection === 'all'
                    ? 'bg-[#EA580C] text-white shadow-xs'
                    : 'bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                All ({allCount})
              </button>
            </div>
          </div>

          {/* Section C: Search & Multi-Parametric Filter Workspace */}
          <div className="space-y-3">
        <div className="p-4 rounded-2xl gw-panel shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Debounced Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Plate (e.g. DL 10 CA 4829), Filename, or Job ID..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-black/40 border border-[#D8CFC0] dark:border-white/10 text-xs font-medium text-[#1A1815] dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setDebouncedSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black dark:hover:text-white"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Media Type Pills */}
          <div className="flex items-center gap-1 bg-white/60 dark:bg-white/5 p-1 rounded-xl border border-[#D8CFC0] dark:border-white/10">
            {(
              [
                { key: 'all', label: 'All Media', icon: Layers },
                { key: 'image', label: 'Images', icon: ImageIcon },
                { key: 'video', label: 'Videos', icon: Video },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setMediaTypeFilter(tab.key);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mediaTypeFilter === tab.key
                      ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-zinc-500 uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
              >
                <option value="all">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending / Processing</option>
              </select>
            </div>

            {/* Date Range Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-zinc-500 uppercase">Range:</span>
              <select
                value={dateRangeFilter}
                onChange={(e) => {
                  setDateRangeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
              >
                <option value="all">All Time</option>
                <option value="today">Today (24h)</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            {/* Vehicle Class Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-zinc-500 uppercase">Class:</span>
              <select
                value={vehicleClassFilter}
                onChange={(e) => {
                  setVehicleClassFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
              >
                <option value="all">All Vehicle Classes</option>
                <option value="car">Cars &amp; SUVs</option>
                <option value="truck">Heavy Commercial Trucks</option>
                <option value="bus">Buses</option>
                <option value="motorbike">Two-Wheelers / Motorbikes</option>
                <option value="auto_rickshaw">Auto Rickshaws</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips & Clear All */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-zinc-500 font-medium">Active Filters:</span>
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EA580C]/10 text-[#EA580C] text-[10px] font-bold">
                  &quot;{debouncedSearch}&quot;
                  <button onClick={() => setSearchInput('')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {mediaTypeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/10 text-[#1A1815] dark:text-white text-[10px] font-bold">
                  {mediaTypeFilter}
                  <button onClick={() => setMediaTypeFilter('all')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/10 text-[#1A1815] dark:text-white text-[10px] font-bold">
                  {statusFilter}
                  <button onClick={() => setStatusFilter('all')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {dateRangeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/10 text-[#1A1815] dark:text-white text-[10px] font-bold">
                  {dateRangeFilter}
                  <button onClick={() => setDateRangeFilter('all')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {vehicleClassFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/10 text-[#1A1815] dark:text-white text-[10px] font-bold">
                  {formatVehicleClass(vehicleClassFilter)}
                  <button onClick={() => setVehicleClassFilter('all')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {activeFolderTitle && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EA580C]/10 text-[#EA580C] text-[10px] font-bold">
                  Folder: {activeFolderTitle}
                  <button onClick={() => setSelectedCollection('none')} title="Back to Folders">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={handleClearFilters}
                className="text-[11px] font-bold text-[#EA580C] hover:underline ml-1"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION D: DETECTION JOB RECORDS TABLE & SERVER-SIDE PAGINATION           */}
      {/* ========================================================================= */}
      <div ref={tableRef} className="rounded-2xl gw-panel shadow-sm overflow-hidden scroll-mt-20">
        {error && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchHistoryRecords}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-bold transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D8CFC0] dark:border-white/[0.08] bg-[#FAF8F5]/80 dark:bg-[#111318] text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={displayedItems.length > 0 && displayedItems.every((j) => selectedJobIds.has(j.job_id))}
                    onChange={handleSelectAllOnPage}
                    className="rounded border-[#D8CFC0] text-[#EA580C] focus:ring-[#EA580C] cursor-pointer"
                    title="Select all on this page"
                  />
                </th>
                <th className="py-3.5 px-4">File &amp; Job ID</th>
                <th className="py-3.5 px-4">Media</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Vehicles</th>
                <th className="py-3.5 px-4">License Plates</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Latency</th>
                <th className="py-3.5 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CFC0]/60 dark:divide-white/[0.06]">
              {isLoadingHistory ? (
                // Clean Skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="animate-pulse">
                    <td className="py-3.5 px-3 text-center">
                      <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-1" />
                      <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-14 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-7 w-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : !historyData || displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-zinc-500">
                    <div className="max-w-md mx-auto space-y-3 px-4">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-white/10 flex items-center justify-center mx-auto text-zinc-400">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-sm text-[#1A1815] dark:text-white">
                        {hasActiveFilters ? 'No Matching Recognition Jobs in this Dossier' : 'No Detection Records in this Dossier'}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {hasActiveFilters
                          ? 'No detection records in this folder match your current search query or active filter criteria.'
                          : 'This dossier collection currently does not contain any matching records.'}
                      </p>
                      {hasActiveFilters ? (
                        <button
                          onClick={handleClearFilters}
                          className="px-4 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white shadow-xs"
                        >
                          Clear Filters
                        </button>
                      ) : (
                        <Link
                          href="/app/detect"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold shadow-md"
                        >
                          <Camera className="w-4 h-4" />
                          Open Live AI Studio
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedItems.map((job) => {
                  const { formatted, relative } = formatDate(job.created_at);
                  const isCompleted = job.status === 'COMPLETED';
                  const isFailed = job.status === 'FAILED';
                  const isProcessing = job.status === 'PROCESSING' || job.status === 'PENDING';
                  const isVideo = job.media_type === 'video';

                  return (
                    <tr
                      key={job.job_id}
                      onClick={() => setSelectedJobId(job.job_id)}
                      className={`hover:bg-white/60 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer ${
                        selectedJobIds.has(job.job_id) ? 'bg-[#EA580C]/5 dark:bg-[#EA580C]/10' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedJobIds.has(job.job_id)}
                          onChange={() => handleToggleSelectJob(job.job_id)}
                          className="rounded border-[#D8CFC0] text-[#EA580C] focus:ring-[#EA580C] cursor-pointer"
                        />
                      </td>

                      {/* File & Job ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#1A1815] dark:text-white flex items-center gap-1.5">
                          <span>{job.filename || (isVideo ? 'video_feed.mp4' : 'vehicle_scan.jpg')}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{job.job_id.slice(0, 8)}...{job.job_id.slice(-4)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(job.job_id, job.job_id);
                            }}
                            className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                            title="Copy full Job ID"
                          >
                            {copiedId === job.job_id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Media Badge */}
                      <td className="py-3.5 px-4">
                        {isVideo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            <Video className="w-3 h-3" /> Video
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <ImageIcon className="w-3 h-3" /> Image
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#1A1815] dark:text-zinc-200">
                          {formatted}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {relative}
                        </div>
                      </td>

                      {/* Vehicles Detected */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#1A1815] dark:text-white">
                          {job.vehicle_count} {job.vehicle_count === 1 ? 'vehicle' : 'vehicles'}
                        </div>
                        {job.vehicle_types && job.vehicle_types.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {job.vehicle_types.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-200/70 dark:bg-white/10 font-medium text-zinc-700 dark:text-zinc-300"
                              >
                                {formatVehicleClass(t)}
                              </span>
                            ))}
                            {job.vehicle_types.length > 2 && (
                              <span className="text-[9px] text-zinc-400">+{job.vehicle_types.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* License Plates */}
                      <td className="py-3.5 px-4">
                        {job.plates && job.plates.length > 0 ? (
                          <div className="flex flex-col gap-1 items-start">
                            {job.plates.slice(0, 2).map((p) => (
                              <div
                                key={p}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-black/80 border border-zinc-900 dark:border-white/20 font-mono font-black text-[10px] text-zinc-950 dark:text-white shadow-xs"
                              >
                                <span className="text-[7px] bg-blue-700 text-white font-sans font-bold px-0.5 rounded-xs">
                                  IND
                                </span>
                                <span>{p}</span>
                              </div>
                            ))}
                            {job.plates.length > 2 && (
                              <span className="text-[9px] text-zinc-400">+{job.plates.length - 2} more</span>
                            )}
                          </div>
                        ) : job.plate_count > 0 ? (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Plate detected (Unreadable)
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">No plate</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        )}
                        {isFailed && (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              <AlertCircle className="w-3 h-3" /> Failed
                            </span>
                            {job.error_message && (
                              <span className="text-[9px] text-rose-500 font-mono line-clamp-1 max-w-[120px]" title={job.error_message}>
                                {job.error_message}
                              </span>
                            )}
                          </div>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                            <Clock className="w-3 h-3" /> {job.status}
                          </span>
                        )}
                      </td>

                      {/* Latency */}
                      <td className="py-3.5 px-4 font-mono font-medium text-zinc-700 dark:text-zinc-300">
                        {formatLatency(job.processing_time_ms)}
                      </td>

                      {/* Inspect Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJobId(job.job_id);
                            }}
                            className="p-1.5 rounded-lg bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-[#EA580C] dark:hover:text-[#EA580C] transition-colors"
                            title="Inspect in Modal"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/app/history/${encodeURIComponent(job.job_id)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-[#EA580C] dark:hover:text-[#EA580C] transition-colors hidden sm:inline-flex"
                            title="Open Dedicated Inspection Route"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer (Preserving All Filter Parameters) */}
        {historyData && displayedItems.length > 0 && (
          <div className="p-4 border-t border-[#D8CFC0] dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-3">
              <div>
                Showing{' '}
                <span className="font-bold text-[#1A1815] dark:text-white">
                  1
                </span>{' '}
                to{' '}
                <span className="font-bold text-[#1A1815] dark:text-white">
                  {displayedItems.length}
                </span>{' '}
                of{' '}
                <span className="font-bold text-[#1A1815] dark:text-white">
                  {displayedItems.length}
                </span>{' '}
                records in this dossier
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 pl-3 border-l border-[#D8CFC0] dark:border-white/10">
                <span className="text-[11px] font-bold text-zinc-500">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoadingHistory}
                className="p-1.5 rounded-lg border border-[#D8CFC0] dark:border-white/10 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-bold text-[#1A1815] dark:text-white font-mono">
                Page {historyData.page} of {Math.max(1, historyData.total_pages)}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(historyData.total_pages, p + 1))}
                disabled={currentPage >= historyData.total_pages || isLoadingHistory}
                className="p-1.5 rounded-lg border border-[#D8CFC0] dark:border-white/10 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )}

      {/* ========================================================================= */}
      {/* SECTION E: DETAILED INSPECTION MODAL / DRAWER                             */}
      {/* ========================================================================= */}
      {selectedJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 p-5 sm:p-7 shadow-2xl relative space-y-5 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CFC0] dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#EA580C]" />
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-[#1A1815] dark:text-white flex items-center gap-2">
                    <span>Detection Telemetry Inspector</span>
                    {jobDetail?.status === 'COMPLETED' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                        COMPLETED
                      </span>
                    ) : jobDetail?.status === 'FAILED' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                        FAILED
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                        {jobDetail?.status || 'LOADING'}
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                    <span>Job ID: {selectedJobId}</span>
                    <button
                      onClick={() => handleCopy(selectedJobId, 'modal-job-id')}
                      className="hover:text-black dark:hover:text-white"
                      title="Copy Job ID"
                    >
                      {copiedId === 'modal-job-id' ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <span>&bull;</span>
                    <Link
                      href={`/app/history/${encodeURIComponent(selectedJobId)}`}
                      className="text-[#EA580C] hover:underline flex items-center gap-1 font-bold"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Dedicated Workspace
                    </Link>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedJobId(null)}
                className="w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-24 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[#EA580C] animate-spin mx-auto" />
                <p className="text-xs font-bold text-zinc-500">Loading neural detection telemetry...</p>
              </div>
            ) : detailError ? (
              <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertCircle className="w-5 h-5" />
                  <span>Failed to Retrieve Recognition Details</span>
                </div>
                <p className="text-xs">{detailError}</p>
                <button
                  onClick={() => setSelectedJobId(selectedJobId)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-xs font-bold transition-colors"
                >
                  Retry Loading
                </button>
              </div>
            ) : jobDetail ? (
              <div className="space-y-5">
                {/* Image Inspection Viewport */}
                {'annotated_image' in jobDetail || !('frames' in jobDetail) ? (
                  <div className="space-y-3">
                    {/* View Switcher Tabs & Download Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
                        <button
                          onClick={() => setDetailViewTab('annotated')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            detailViewTab === 'annotated'
                              ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          Annotated AI View
                        </button>
                        <button
                          onClick={() => setDetailViewTab('raw')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            detailViewTab === 'raw'
                              ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          Original Raw Image
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {('annotated_image' in jobDetail) && jobDetail.annotated_image && (
                          <button
                            onClick={handleDownloadAnnotatedImage}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-zinc-50"
                          >
                            <Download className="w-3.5 h-3.5 text-[#EA580C]" />
                            Download Annotated JPEG
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Canvas / Viewport */}
                    <div className="relative rounded-2xl overflow-hidden min-h-[280px] max-h-[440px] bg-black border border-black/20 flex items-center justify-center">
                      {detailViewTab === 'annotated' ? (
                        ('annotated_image' in jobDetail) && jobDetail.annotated_image ? (
                          <img
                            src={`data:image/jpeg;base64,${jobDetail.annotated_image}`}
                            alt="Annotated Detections"
                            className="max-h-[440px] w-auto max-w-full object-contain mx-auto"
                          />
                        ) : rawBlobUrl ? (
                          <img
                            src={rawBlobUrl}
                            alt="Raw Asset"
                            className="max-h-[440px] w-auto max-w-full object-contain mx-auto"
                          />
                        ) : (
                          <div className="text-zinc-500 text-xs py-12">
                            No visual preview recorded for this job.
                          </div>
                        )
                      ) : rawBlobUrl ? (
                        <img
                          src={rawBlobUrl}
                          alt="Raw Asset"
                          className="max-h-[440px] w-auto max-w-full object-contain mx-auto"
                        />
                      ) : (
                        <div className="text-zinc-500 text-xs py-12">
                          Original image asset loading or unavailable.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Video Inspection Viewport with Frame Scrubber */
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="font-bold">1 FPS Sampled Video Inspection:</span>
                        <span>
                          {jobDetail.sampled_frames_count} frames sampled from {jobDetail.total_frames} total ({jobDetail.video_fps.toFixed(1)} FPS &bull; {jobDetail.duration_seconds.toFixed(1)}s)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[10px]">
                        Frame {activeFrameIndex + 1} of {jobDetail.frames.length}
                      </span>
                    </div>

                    {/* Frame Selector Pills */}
                    {jobDetail.frames.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {jobDetail.frames.map((frame, idx) => (
                          <button
                            key={frame.frame_index}
                            onClick={() => setActiveFrameIndex(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                              activeFrameIndex === idx
                                ? 'bg-[#EA580C] text-white shadow-xs'
                                : 'bg-white dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-[#D8CFC0] dark:border-white/10'
                            }`}
                          >
                            @ {frame.timestamp_seconds.toFixed(1)}s ({frame.vehicles.length} veh)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Failed Error Message Alert */}
                {jobDetail.status === 'FAILED' && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      Inference Failure Telemetry
                    </div>
                    <p className="text-xs font-mono">
                      {jobDetail.error_message || 'The neural pipeline halted with an unhandled exception.'}
                    </p>
                  </div>
                )}

                {/* Detected Entities List (Vehicles & Plates) */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                    <span>
                      Localized Entities (
                      {'frames' in jobDetail
                        ? jobDetail.frames[activeFrameIndex]?.vehicles.length || 0
                        : jobDetail.vehicles.length}{' '}
                      Vehicles)
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      Processing Latency: {formatLatency(jobDetail.processing_time_ms)}
                    </span>
                  </h4>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(() => {
                      const vehList: VehicleResult[] =
                        'frames' in jobDetail
                          ? jobDetail.frames[activeFrameIndex]?.vehicles || []
                          : jobDetail.vehicles || [];

                      if (vehList.length === 0) {
                        return (
                          <div className="p-6 text-center text-xs text-zinc-500 bg-white/50 dark:bg-white/[0.02] rounded-xl border border-[#D8CFC0] dark:border-white/10">
                            No vehicles or plates detected in this frame.
                          </div>
                        );
                      }

                      return vehList.map((veh, vIdx) => {
                        const hasPlate = veh.plate && veh.plate.text && veh.plate.text.trim();
                        return (
                          <div
                            key={vIdx}
                            className="p-3 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-lg bg-orange-500/10 text-[#EA580C] font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                                {vIdx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-[#1A1815] dark:text-white flex items-center gap-2">
                                  <span>{formatVehicleClass(veh.type)}</span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {(veh.confidence * 100).toFixed(1)}% conf
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                  bbox: [{veh.bbox.map((n) => Math.round(n)).join(', ')}]
                                </div>
                              </div>
                            </div>

                            {/* Plate Recognition Pill */}
                            <div>
                              {hasPlate ? (
                                <div className="flex items-center gap-2">
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-black border-2 border-zinc-900 dark:border-white/20 font-mono font-black text-xs text-zinc-950 dark:text-white shadow-xs">
                                    <span className="text-[8px] bg-blue-700 text-white font-sans font-bold px-1 rounded-xs">
                                      IND
                                    </span>
                                    <span>{veh.plate!.text}</span>
                                  </div>
                                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                                    {((veh.plate!.confidence || 0) * 100).toFixed(0)}% OCR
                                  </div>
                                </div>
                              ) : veh.plate ? (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  Plate localized (OCR unreadable)
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-400 italic">
                                  No plate localized
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-[#D8CFC0] dark:border-white/10">
                  <button
                    onClick={handleDownloadJobJson}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-zinc-50"
                  >
                    <FileCode className="w-3.5 h-3.5 text-[#EA580C]" />
                    Export Job JSON
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedJobId(null)}
                      className="px-4 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white"
                    >
                      Close
                    </button>
                    <Link
                      href="/app/detect"
                      className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold shadow-md"
                    >
                      Open in Live AI Studio
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION F: RFC 4180 CSV EXPORT MODAL                                      */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CFC0] dark:border-white/10">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#EA580C]" />
                <h3 className="font-extrabold text-base text-[#1A1815] dark:text-white">
                  Export Detection Audit Trail
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
              Generate an RFC 4180 compliant CSV export containing your detection records, localized vehicle counts, vehicle classes, and recognized MoRTH license plate strings.
            </p>

            <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Matching Records:</span>
                <span className="font-bold text-[#1A1815] dark:text-white">
                  {historyData?.items.length || 0} rows on this page
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Target Standard:</span>
                <span className="font-mono font-bold text-[#EA580C]">RFC 4180 CSV</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Character Encoding:</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">UTF-8</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExportCsv()}
                className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold shadow-md"
              >
                Download Export (.csv)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Batch Actions Bar */}
      {selectedJobIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1A1815] dark:bg-[#111318] text-white border border-[#D8CFC0]/30 dark:border-white/15 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="text-xs font-mono font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
            <span>{selectedJobIds.size} records selected</span>
          </span>
          <button
            onClick={handleExportSelectedCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Selected CSV</span>
          </button>
          <button
            onClick={() => setSelectedJobIds(new Set())}
            className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}
