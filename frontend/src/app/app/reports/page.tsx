'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AuthService, AuthSession } from '@/lib/auth';
import {
  getReportsOverview,
  generateReportPreview,
  exportReportBlob,
  generateAndPersistReport,
  listSavedReports,
  downloadSavedReportBlob,
  deleteSavedReport,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  moveReportToFolder,
  ReportOverviewResponse,
  ReportPreviewResponse,
  ReportType,
  ReportFormat,
  ReportFilterParams,
  SavedReportResponse,
  FolderResponse,
} from '@/lib/api';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  Layers,
  Clock,
  Sparkles,
  RefreshCw,
  Camera,
  Car,
  Gauge,
  Video,
  Image as ImageIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Shield,
  Info,
  SlidersHorizontal,
  X,
  FileCheck,
  Trash2,
  Eye,
  Plus,
  Search,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Copy,
  ExternalLink,
  FolderInput,
  MoveRight,
} from 'lucide-react';

const TEMPLATE_CONFIG: Record<
  ReportType,
  { title: string; icon: any; color: string; bg: string; badge: string; description: string }
> = {
  recognition_summary: {
    title: 'Recognition Summary Audit',
    icon: Layers,
    color: 'text-[#EA580C]',
    bg: 'bg-orange-500/10',
    badge: 'Executive Audit',
    description: 'High-level operational overview aggregating detection counts, success rates, and pipeline throughput.',
  },
  vehicle_distribution: {
    title: 'Vehicle Distribution Matrix',
    icon: Car,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    badge: 'Classification',
    description: 'Detailed category breakdown (cars, trucks, buses, motorcycles, auto-rickshaws) across the requested period.',
  },
  plate_recognition: {
    title: 'ALPR & MoRTH Compliance',
    icon: Gauge,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    badge: 'ALPR & MoRTH',
    description: 'License plate recognition audit, OCR character confidence scoring, and state-wise vehicle registration records.',
  },
  processing_performance: {
    title: 'Processing Performance Telemetry',
    icon: Clock,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    badge: 'Throughput',
    description: 'Hardware inference latency telemetry, batch job execution times, and pipeline processing efficiency.',
  },
  media_breakdown: {
    title: 'Media Breakdown & Ingestion Log',
    icon: Video,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10',
    badge: 'Media Telemetry',
    description: 'Image vs video ingestion distribution, sampled video frame recognition yields, and resolution analytics.',
  },
  custom_range: {
    title: 'Custom Range Deep Inspection',
    icon: Calendar,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    badge: 'Deep Inspection',
    description: 'Flexible temporal query allowing precise timestamp boundaries, multi-variable filtering, and deep forensic inspection.',
  },
};

const FOLDER_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  orange: { bg: 'bg-orange-500/10', text: 'text-[#EA580C]', border: 'border-orange-500/30', label: 'Orange' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', label: 'Emerald' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', label: 'Blue' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', label: 'Purple' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', label: 'Amber' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30', label: 'Rose' },
};

function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
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

function formatBytes(bytes?: number | null): string {
  if (bytes == null || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatLatency(ms?: number | null): string {
  if (ms == null || isNaN(ms)) return '—';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)} ms`;
}

export default function ReportsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);

  // Overview Catalog
  const [overview, setOverview] = useState<ReportOverviewResponse | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);

  // Persisted Folders State
  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState<boolean>(true);

  // Saved Reports Collection State
  const [savedReports, setSavedReports] = useState<SavedReportResponse[]>([]);
  const [totalSaved, setTotalSaved] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  // Library Navigation & Filtering
  const [navFolderScope, setNavFolderScope] = useState<'all' | 'unorganized' | string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Folder CRUD Modals State
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderDesc, setNewFolderDesc] = useState<string>('');
  const [newFolderColor, setNewFolderColor] = useState<string>('orange');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);

  const [folderToEdit, setFolderToEdit] = useState<FolderResponse | null>(null);
  const [editFolderName, setEditFolderName] = useState<string>('');
  const [editFolderDesc, setEditFolderDesc] = useState<string>('');
  const [editFolderColor, setEditFolderColor] = useState<string>('orange');
  const [isUpdatingFolder, setIsUpdatingFolder] = useState<boolean>(false);
  const [editFolderError, setEditFolderError] = useState<string | null>(null);

  const [folderToDelete, setFolderToDelete] = useState<FolderResponse | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState<boolean>(false);
  const [deleteFolderError, setDeleteFolderError] = useState<string | null>(null);

  // Report Movement Modal / Dropdown State
  const [reportToMove, setReportToMove] = useState<SavedReportResponse | null>(null);
  const [isMovingReport, setIsMovingReport] = useState<boolean>(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Generation Modal & Configuration State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportType>('recognition_summary');
  const [generationFormat, setGenerationFormat] = useState<ReportFormat>('pdf');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'COMPLETED' | 'FAILED'>('all');
  const [vehicleClassFilter, setVehicleClassFilter] = useState<'all' | 'car' | 'truck' | 'bus' | 'motorbike' | 'auto_rickshaw'>('all');

  // Preview State (Non-persistent)
  const [preview, setPreview] = useState<ReportPreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState<boolean>(false);

  // Persistence Execution State
  const [isPersisting, setIsPersisting] = useState<boolean>(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persistSuccessMsg, setPersistSuccessMsg] = useState<string | null>(null);

  // In-Memory Export State
  const [isExportingDirect, setIsExportingDirect] = useState<boolean>(false);
  const [directExportError, setDirectExportError] = useState<string | null>(null);

  // Detail Inspection Modal
  const [inspectedReport, setInspectedReport] = useState<SavedReportResponse | null>(null);

  // Deletion Confirmation State for Reports
  const [reportToDelete, setReportToDelete] = useState<SavedReportResponse | null>(null);
  const [isDeletingReport, setIsDeletingReport] = useState<boolean>(false);
  const [deleteReportError, setDeleteReportError] = useState<string | null>(null);

  // Download & Operation Feedback Toast State
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Copied State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Authentication & Session
  useEffect(() => {
    let active = AuthService.getSession();
    if (!active) {
      active = AuthService.initGuestSession();
    }
    setSession(active);

    const handleAuthChange = () => {
      setSession(AuthService.getSession());
      fetchOverview();
      fetchFoldersList();
      fetchSavedLibrary();
    };

    window.addEventListener('visionplate_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('visionplate_auth_change', handleAuthChange);
    };
  }, []);

  // Fetch Overview Catalog
  const fetchOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    try {
      const data = await getReportsOverview();
      setOverview(data);
    } catch (err: any) {
      console.warn('Failed to load reports overview catalog:', err);
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  // Fetch Folders List from Backend
  const fetchFoldersList = useCallback(async () => {
    setIsLoadingFolders(true);
    try {
      const res = await listFolders();
      setFolders(res.items);
    } catch (err: any) {
      console.warn('Failed to load report folders:', err);
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  // Fetch Saved Reports Library from backend
  const fetchSavedLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);
    setLibraryError(null);
    try {
      const res = await listSavedReports({
        page: currentPage,
        page_size: pageSize,
        report_type: filterType !== 'all' ? filterType : undefined,
        format: filterFormat !== 'all' ? filterFormat : undefined,
        folder_id: navFolderScope !== 'all' && navFolderScope !== 'unorganized' ? navFolderScope : undefined,
        is_uncategorized: navFolderScope === 'unorganized' ? true : undefined,
        search: debouncedSearch.trim() || undefined,
      });

      setSavedReports(res.items);
      setTotalSaved(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      console.error('Failed to load saved reports library:', err);
      setLibraryError(err.message || 'Unable to retrieve saved reports from server.');
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [currentPage, pageSize, filterType, filterFormat, navFolderScope, debouncedSearch]);

  useEffect(() => {
    fetchOverview();
    fetchFoldersList();
  }, [fetchOverview, fetchFoldersList]);

  useEffect(() => {
    fetchSavedLibrary();
  }, [fetchSavedLibrary]);

  // Construct filters object from generation form
  const getFilterParams = useCallback((): ReportFilterParams => {
    const filters: ReportFilterParams = {
      media_type: mediaTypeFilter !== 'all' ? mediaTypeFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      vehicle_class: vehicleClassFilter !== 'all' ? vehicleClassFilter : undefined,
    };

    if (datePreset === '7d') filters.days = 7;
    else if (datePreset === '30d') filters.days = 30;
    else if (datePreset === '90d') filters.days = 90;
    else if (datePreset === 'all') filters.days = 365;
    else if (datePreset === 'custom') {
      if (customStartDate) filters.start_date = new Date(customStartDate).toISOString();
      if (customEndDate) filters.end_date = new Date(customEndDate).toISOString();
    }
    return filters;
  }, [datePreset, customStartDate, customEndDate, mediaTypeFilter, statusFilter, vehicleClassFilter]);

  // Generate Non-Persistent Preview
  const handlePreviewReport = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const res = await generateReportPreview({
        report_type: selectedTemplate,
        filters: getFilterParams(),
      });
      setPreview(res);
      setShowPreviewDrawer(true);
    } catch (err: any) {
      console.error('Preview generation failed:', err);
      setPreviewError(err.message || 'Failed to generate report preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Generate & Persist Report to Storage and Database
  const handleGenerateAndPersist = async () => {
    if (isPersisting) return;
    setIsPersisting(true);
    setPersistError(null);
    setPersistSuccessMsg(null);

    try {
      const saved = await generateAndPersistReport({
        report_type: selectedTemplate,
        format: generationFormat,
        title: customTitle.trim() || undefined,
        folder_id: targetFolderId.trim() || undefined,
        filters: getFilterParams(),
      });

      setPersistSuccessMsg(`Report "${saved.title}" successfully generated and saved to library.`);
      await fetchSavedLibrary();
      await fetchFoldersList();
      setTimeout(() => {
        setIsGenerateModalOpen(false);
        setPersistSuccessMsg(null);
      }, 1600);
    } catch (err: any) {
      console.error('Report persistence failed:', err);
      setPersistError(err.message || 'Failed to generate and save report.');
    } finally {
      setIsPersisting(false);
    }
  };

  // Direct In-Memory Export (Streaming without saving)
  const handleDirectExport = async (format: ReportFormat) => {
    if (isExportingDirect) return;
    setIsExportingDirect(true);
    setDirectExportError(null);

    try {
      const { blob, filename } = await exportReportBlob({
        report_type: selectedTemplate,
        format,
        filters: getFilterParams(),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Direct export failed:', err);
      setDirectExportError(err.message || `Failed to export ${format.toUpperCase()} report.`);
    } finally {
      setIsExportingDirect(false);
    }
  };

  // Download Persisted Report Artifact
  const handleDownloadReport = async (report: SavedReportResponse) => {
    if (downloadingId) return;
    setDownloadingId(report.id);
    setFeedbackToast(null);

    try {
      const { blob, filename } = await downloadSavedReportBlob(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedbackToast({
        type: 'success',
        message: `Downloaded ${filename} (${formatBytes(blob.size)})`,
      });
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch (err: any) {
      console.error('Download failed:', err);
      setFeedbackToast({
        type: 'error',
        message: err.message || 'Failed to download report artifact.',
      });
      setTimeout(() => setFeedbackToast(null), 5000);
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete Persisted Report Record
  const handleConfirmDeleteReport = async () => {
    if (!reportToDelete || isDeletingReport) return;
    setIsDeletingReport(true);
    setDeleteReportError(null);

    try {
      await deleteSavedReport(reportToDelete.id);
      setSavedReports((prev) => prev.filter((r) => r.id !== reportToDelete.id));
      setTotalSaved((prev) => Math.max(0, prev - 1));
      if (inspectedReport?.id === reportToDelete.id) {
        setInspectedReport(null);
      }
      setReportToDelete(null);
      await fetchSavedLibrary();
      await fetchFoldersList();
      setFeedbackToast({ type: 'success', message: 'Report deleted successfully.' });
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: any) {
      console.error('Deletion failed:', err);
      setDeleteReportError(err.message || 'Failed to delete report.');
    } finally {
      setIsDeletingReport(false);
    }
  };

  // Move Report to Folder
  const handleExecuteMove = async (reportId: string, newFolderId: string | null) => {
    setIsMovingReport(true);
    setMoveError(null);
    try {
      await moveReportToFolder(reportId, newFolderId);
      await fetchSavedLibrary();
      await fetchFoldersList();
      if (inspectedReport?.id === reportId) {
        setInspectedReport((prev) => (prev ? { ...prev, folder_id: newFolderId } : null));
      }
      setReportToMove(null);
      const folderName = newFolderId ? (folders.find((f) => f.id === newFolderId)?.name || 'folder') : 'Unorganized';
      setFeedbackToast({ type: 'success', message: `Report moved to ${folderName}.` });
      setTimeout(() => setFeedbackToast(null), 3500);
    } catch (err: any) {
      console.error('Move failed:', err);
      setMoveError(err.message || 'Failed to move report.');
    } finally {
      setIsMovingReport(false);
    }
  };

  // Folder CRUD: Create
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) {
      setCreateFolderError('Folder name is required.');
      return;
    }

    setIsCreatingFolder(true);
    setCreateFolderError(null);
    try {
      const created = await createFolder({
        name: cleanName,
        description: newFolderDesc.trim() || undefined,
        color: newFolderColor,
      });

      await fetchFoldersList();
      setIsCreateFolderModalOpen(false);
      setNewFolderName('');
      setNewFolderDesc('');
      setNewFolderColor('orange');
      setFeedbackToast({ type: 'success', message: `Folder "${created.name}" created successfully.` });
      setTimeout(() => setFeedbackToast(null), 3500);
    } catch (err: any) {
      console.error('Create folder failed:', err);
      setCreateFolderError(err.message || 'Failed to create folder.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Folder CRUD: Update / Rename
  const handleUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToEdit) return;
    const cleanName = editFolderName.trim();
    if (!cleanName) {
      setEditFolderError('Folder name cannot be blank.');
      return;
    }

    setIsUpdatingFolder(true);
    setEditFolderError(null);
    try {
      const updated = await updateFolder(folderToEdit.id, {
        name: cleanName,
        description: editFolderDesc.trim() || undefined,
        color: editFolderColor,
      });

      await fetchFoldersList();
      setFolderToEdit(null);
      setFeedbackToast({ type: 'success', message: `Folder updated to "${updated.name}".` });
      setTimeout(() => setFeedbackToast(null), 3500);
    } catch (err: any) {
      console.error('Update folder failed:', err);
      setEditFolderError(err.message || 'Failed to update folder.');
    } finally {
      setIsUpdatingFolder(false);
    }
  };

  // Folder CRUD: Delete
  const handleDeleteFolder = async () => {
    if (!folderToDelete || isDeletingFolder) return;
    setIsDeletingFolder(true);
    setDeleteFolderError(null);

    try {
      await deleteFolder(folderToDelete.id);
      if (navFolderScope === folderToDelete.id) {
        setNavFolderScope('all');
      }
      await fetchFoldersList();
      await fetchSavedLibrary();
      setFolderToDelete(null);
      setFeedbackToast({
        type: 'success',
        message: `Folder deleted. Associated reports preserved in Unorganized.`,
      });
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch (err: any) {
      console.error('Delete folder failed:', err);
      setDeleteFolderError(err.message || 'Failed to delete folder.');
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasActiveLibraryFilters =
    navFolderScope !== 'all' ||
    filterType !== 'all' ||
    filterFormat !== 'all' ||
    debouncedSearch.length > 0;

  const handleResetLibraryFilters = () => {
    setNavFolderScope('all');
    setFilterType('all');
    setFilterFormat('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const activeFolderMeta = useMemo(() => {
    if (navFolderScope === 'all' || navFolderScope === 'unorganized') return null;
    return folders.find((f) => f.id === navFolderScope) || null;
  }, [navFolderScope, folders]);

  return (
    <div className="min-h-full font-sans p-6 sm:p-8 space-y-7 max-w-7xl w-full mx-auto relative text-[#1A1815] dark:text-zinc-100">
      {/* ========================================================================= */}
      {/* 1. COMMAND HEADER                                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D8CFC0]/60 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#EA580C] flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
              Enterprise Document Management
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white tracking-tight mt-0.5">
            Report Library
          </h1>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-400 mt-1 max-w-2xl">
            Central repository for generated and persisted audit dockets, MoRTH compliance packets, and pipeline intelligence folders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden sm:flex flex-col items-end text-right mr-2 font-mono">
            <span className="text-xs font-bold text-[#1A1815] dark:text-white">
              {totalSaved} Persisted {totalSaved === 1 ? 'Report' : 'Reports'}
            </span>
            <span className="text-[10px] text-zinc-500">
              {folders.length} {folders.length === 1 ? 'Folder' : 'Folders'} Configured
            </span>
          </div>

          <button
            onClick={() => {
              fetchOverview();
              fetchFoldersList();
              fetchSavedLibrary();
            }}
            disabled={isLoadingLibrary || isLoadingFolders}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-white dark:hover:bg-white/5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Report Collection & Folders"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingLibrary || isLoadingFolders ? 'animate-spin text-[#EA580C]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setTargetFolderId(activeFolderMeta ? activeFolderMeta.id : '');
              setIsGenerateModalOpen(true);
              setPersistError(null);
              setPersistSuccessMsg(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Operation Feedback Toast */}
      {feedbackToast && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border animate-in fade-in shadow-sm ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{feedbackToast.message}</span>
          </div>
          <button onClick={() => setFeedbackToast(null)} className="font-bold">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DEDICATED FOLDER NAVIGATION & MANAGEMENT BAR                           */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Navigation Folder Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none font-mono text-xs">
            {/* All Reports */}
            <button
              onClick={() => {
                setNavFolderScope('all');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                navFolderScope === 'all'
                  ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-sm ring-1 ring-black/10'
                  : 'bg-[#FAF8F5] dark:bg-[#111318] text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/5 border border-[#D8CFC0] dark:border-white/10'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>All Reports</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                {totalSaved}
              </span>
            </button>

            {/* Unorganized */}
            <button
              onClick={() => {
                setNavFolderScope('unorganized');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                navFolderScope === 'unorganized'
                  ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-sm ring-1 ring-black/10'
                  : 'bg-[#FAF8F5] dark:bg-[#111318] text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/5 border border-[#D8CFC0] dark:border-white/10'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <span>Unorganized</span>
            </button>

            {/* User Persisted Folders */}
            {folders.map((f) => {
              const isSelected = navFolderScope === f.id;
              const colorInfo = FOLDER_COLORS[f.color] || FOLDER_COLORS.orange;

              return (
                <div
                  key={f.id}
                  className={`inline-flex items-center rounded-xl transition-all whitespace-nowrap border ${
                    isSelected
                      ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black border-transparent shadow-sm'
                      : 'bg-[#FAF8F5] dark:bg-[#111318] text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/5 border-[#D8CFC0] dark:border-white/10'
                  }`}
                >
                  <button
                    onClick={() => {
                      setNavFolderScope(f.id);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 flex items-center gap-2 font-bold"
                  >
                    <Folder className={`w-3.5 h-3.5 ${colorInfo.text}`} />
                    <span className="truncate max-w-[140px]" title={f.name}>
                      {f.name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                          : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {f.report_count}
                    </span>
                  </button>

                  {/* Folder action buttons */}
                  <div className="flex items-center pr-1.5 border-l border-black/10 dark:border-white/10 pl-1 gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToEdit(f);
                        setEditFolderName(f.name);
                        setEditFolderDesc(f.description || '');
                        setEditFolderColor(f.color || 'orange');
                        setEditFolderError(null);
                      }}
                      className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-600 transition-colors"
                      title="Rename / Edit Folder"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToDelete(f);
                        setDeleteFolderError(null);
                      }}
                      className="p-1 rounded-md hover:bg-rose-500/20 text-zinc-400 hover:text-rose-500 transition-colors"
                      title="Delete Folder"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Create New Folder Button */}
            <button
              onClick={() => {
                setIsCreateFolderModalOpen(true);
                setNewFolderName('');
                setNewFolderDesc('');
                setNewFolderColor('orange');
                setCreateFolderError(null);
              }}
              className="px-3 py-2 rounded-xl bg-orange-500/10 text-[#EA580C] hover:bg-orange-500/20 font-bold flex items-center gap-1.5 transition-colors border border-orange-500/20"
              title="Create New Organization Folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ Folder</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search by Title */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search report titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs text-[#1A1815] dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Template Filter */}
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            >
              <option value="all">All Templates</option>
              <option value="recognition_summary">Recognition Summary</option>
              <option value="vehicle_distribution">Vehicle Distribution</option>
              <option value="plate_recognition">Plate Recognition</option>
              <option value="processing_performance">Performance Telemetry</option>
              <option value="media_breakdown">Media Breakdown</option>
              <option value="custom_range">Custom Range</option>
            </select>

            {/* Format Filter */}
            <select
              value={filterFormat}
              onChange={(e) => {
                setFilterFormat(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            >
              <option value="all">All Formats</option>
              <option value="pdf">PDF Artifacts</option>
              <option value="csv">CSV Datasets</option>
              <option value="json">JSON Dockets</option>
            </select>

            {hasActiveLibraryFilters && (
              <button
                onClick={handleResetLibraryFilters}
                className="px-3 py-2 rounded-xl bg-orange-500/10 text-[#EA580C] hover:bg-orange-500/20 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Folder Header Banner (if a folder is selected) */}
        {activeFolderMeta && (
          <div className="p-3.5 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${FOLDER_COLORS[activeFolderMeta.color]?.bg || 'bg-orange-500/10'}`}>
                <Folder className={`w-4 h-4 ${FOLDER_COLORS[activeFolderMeta.color]?.text || 'text-[#EA580C]'}`} />
              </div>
              <div>
                <div className="font-bold text-[#1A1815] dark:text-white flex items-center gap-2">
                  <span>{activeFolderMeta.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({activeFolderMeta.report_count} {activeFolderMeta.report_count === 1 ? 'report' : 'reports'})
                  </span>
                </div>
                {activeFolderMeta.description && (
                  <p className="text-[11px] text-zinc-500 mt-0.5">{activeFolderMeta.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => {
                  setFolderToEdit(activeFolderMeta);
                  setEditFolderName(activeFolderMeta.name);
                  setEditFolderDesc(activeFolderMeta.description || '');
                  setEditFolderColor(activeFolderMeta.color || 'orange');
                  setEditFolderError(null);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[#D8CFC0] dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300 font-bold flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => {
                  setFolderToDelete(activeFolderMeta);
                  setDeleteFolderError(null);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. REPORT COLLECTION TABLE & CARDS                                        */}
      {/* ========================================================================= */}
      <div className="rounded-3xl p-5 sm:p-6 gw-panel shadow-sm space-y-4">
        {/* Loading State */}
        {isLoadingLibrary ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#EA580C] animate-spin mx-auto" />
            <p className="text-xs font-bold text-zinc-500 font-mono">
              Retrieving persistent reports from database...
            </p>
          </div>
        ) : libraryError ? (
          /* Error State */
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Unable to Load Report Library</span>
            </div>
            <p>{libraryError}</p>
            <button
              onClick={fetchSavedLibrary}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 font-bold transition-colors"
            >
              Retry
            </button>
          </div>
        ) : savedReports.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-[#EA580C] flex items-center justify-center mx-auto">
              {activeFolderMeta ? <FolderOpen className="w-7 h-7" /> : <FileText className="w-7 h-7" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1A1815] dark:text-white">
                {activeFolderMeta
                  ? `Folder "${activeFolderMeta.name}" is Empty`
                  : navFolderScope === 'unorganized'
                  ? 'All Reports are Organized'
                  : 'No Persisted Reports Found'}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                {activeFolderMeta
                  ? 'This folder has no reports assigned to it yet. Generate a report for this folder or move existing reports into it.'
                  : navFolderScope === 'unorganized'
                  ? 'You currently have zero unorganized reports. All persisted reports are assigned to designated folders.'
                  : hasActiveLibraryFilters
                  ? 'No saved reports match your active filter criteria. Try resetting filters or searching with a different term.'
                  : 'You have not persisted any reports to your library yet. Generate your first audit report to persist it in private storage.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              {activeFolderMeta ? (
                <button
                  onClick={() => {
                    setTargetFolderId(activeFolderMeta.id);
                    setIsGenerateModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Generate Report for this Folder</span>
                </button>
              ) : hasActiveLibraryFilters ? (
                <button
                  onClick={handleResetLibraryFilters}
                  className="px-4 py-2 rounded-xl bg-[#FAF8F5] dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold hover:bg-white transition-all shadow-sm"
                >
                  Clear Active Filters
                </button>
              ) : (
                <button
                  onClick={() => {
                    setTargetFolderId('');
                    setIsGenerateModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Generate First Report</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Populated Table of Saved Reports */
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#D8CFC0] dark:border-white/10 overflow-hidden bg-white dark:bg-black/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D8CFC0] dark:border-white/10 bg-[#FAF8F5]/90 dark:bg-[#111318] text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Report Details</th>
                      <th className="py-3 px-3">Template</th>
                      <th className="py-3 px-3">Format</th>
                      <th className="py-3 px-3">Size</th>
                      <th className="py-3 px-3">Created</th>
                      <th className="py-3 px-3">Folder</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CFC0]/60 dark:divide-white/[0.06]">
                    {savedReports.map((report) => {
                      const meta =
                        TEMPLATE_CONFIG[report.report_type as ReportType] ||
                        TEMPLATE_CONFIG.recognition_summary;
                      const Icon = meta.icon;
                      const isPdf = report.file_format.toLowerCase() === 'pdf';
                      const isCsv = report.file_format.toLowerCase() === 'csv';
                      const isJson = report.file_format.toLowerCase() === 'json';
                      const assignedFolder = folders.find((f) => f.id === report.folder_id);

                      return (
                        <tr
                          key={report.id}
                          className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* Title & Parameters Summary */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1A1815] dark:text-white group-hover:text-[#EA580C] transition-colors flex items-center gap-2">
                              <span>{report.title}</span>
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-xs">
                              {report.parameters ? (
                                <span>
                                  {report.parameters.days
                                    ? `Last ${report.parameters.days} Days`
                                    : 'Custom Scope'}{' '}
                                  &bull; Media: {report.parameters.media_type || 'all'} &bull; Status:{' '}
                                  {report.parameters.status || 'all'}
                                </span>
                              ) : (
                                <span className="italic">No query filters snapshot</span>
                              )}
                            </div>
                          </td>

                          {/* Template Badge */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <div className={`p-1 rounded-md ${meta.bg} ${meta.color}`}>
                                <Icon className="w-3 h-3" />
                              </div>
                              <span className="font-semibold text-[11px] text-zinc-700 dark:text-zinc-300">
                                {meta.badge}
                              </span>
                            </div>
                          </td>

                          {/* Format Badge */}
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase inline-flex items-center gap-1 ${
                                isPdf
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  : isCsv
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-orange-500/10 text-[#EA580C] border border-orange-500/20'
                              }`}
                            >
                              {isPdf && <FileText className="w-2.5 h-2.5" />}
                              {isCsv && <FileSpreadsheet className="w-2.5 h-2.5" />}
                              {isJson && <FileCode className="w-2.5 h-2.5" />}
                              <span>{report.file_format}</span>
                            </span>
                          </td>

                          {/* Size */}
                          <td className="py-3 px-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            {formatBytes(report.file_size_bytes)}
                          </td>

                          {/* Created Timestamp */}
                          <td className="py-3 px-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            {formatDate(report.created_at)}
                          </td>

                          {/* Folder Assignment with Quick Move */}
                          <td className="py-3 px-3 text-[11px] font-mono whitespace-nowrap">
                            <button
                              onClick={() => {
                                setReportToMove(report);
                                setMoveError(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-[#EA580C] flex items-center gap-1 transition-colors text-[10px]"
                              title="Move to another folder"
                            >
                              <Folder className="w-3 h-3 text-[#EA580C]" />
                              <span className="truncate max-w-[100px]">
                                {assignedFolder ? assignedFolder.name : 'Unorganized'}
                              </span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Move */}
                              <button
                                onClick={() => {
                                  setReportToMove(report);
                                  setMoveError(null);
                                }}
                                className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#EA580C] hover:bg-orange-500/10 transition-colors"
                                title="Move to Folder"
                              >
                                <FolderInput className="w-4 h-4" />
                              </button>

                              {/* Inspect */}
                              <button
                                onClick={() => setInspectedReport(report)}
                                className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#EA580C] hover:bg-orange-500/10 transition-colors"
                                title="Inspect Persisted Metadata"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Download */}
                              <button
                                onClick={() => handleDownloadReport(report)}
                                disabled={downloadingId === report.id}
                                className="p-1.5 rounded-lg text-[#EA580C] hover:bg-orange-500/10 transition-colors disabled:opacity-50"
                                title="Download Artifact"
                              >
                                <Download
                                  className={`w-4 h-4 ${
                                    downloadingId === report.id ? 'animate-bounce' : ''
                                  }`}
                                />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => {
                                  setReportToDelete(report);
                                  setDeleteReportError(null);
                                }}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                                title="Delete Persisted Report"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs font-mono">
                <div className="text-zinc-500">
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, totalSaved)} of {totalSaved} reports
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isLoadingLibrary}
                    className="p-1.5 rounded-xl border border-[#D8CFC0] dark:border-white/10 hover:bg-white dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-bold text-[#1A1815] dark:text-white">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || isLoadingLibrary}
                    className="p-1.5 rounded-xl border border-[#D8CFC0] dark:border-white/10 hover:bg-white dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. REPORT DETAIL INSPECTION MODAL                                         */}
      {/* ========================================================================= */}
      {inspectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-[#D8CFC0]/60 dark:border-white/10 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA580C] font-mono">
                    Persisted Report Dossier
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-orange-500/10 text-[#EA580C]">
                    {inspectedReport.file_format}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#1A1815] dark:text-white mt-1">
                  {inspectedReport.title}
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mt-1">
                  <span>ID: {inspectedReport.id}</span>
                  <button
                    onClick={() => copyToClipboard(inspectedReport.id, 'modal_id')}
                    className="hover:text-[#EA580C]"
                    title="Copy Report UUID"
                  >
                    {copiedId === 'modal_id' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setInspectedReport(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Core Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 font-mono">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase">Template</div>
                  <div className="font-bold text-[#1A1815] dark:text-white mt-1 truncate">
                    {TEMPLATE_CONFIG[inspectedReport.report_type as ReportType]?.badge ||
                      inspectedReport.report_type}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 font-mono">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase">File Size</div>
                  <div className="font-bold text-[#1A1815] dark:text-white mt-1">
                    {formatBytes(inspectedReport.file_size_bytes)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 font-mono">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase">Created At</div>
                  <div className="font-bold text-[#1A1815] dark:text-white mt-1">
                    {formatDate(inspectedReport.created_at)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 font-mono">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase">Folder</div>
                  <div className="font-bold text-[#1A1815] dark:text-white mt-1 truncate">
                    {folders.find((f) => f.id === inspectedReport.folder_id)?.name || 'Unorganized'}
                  </div>
                </div>
              </div>

              {/* Folder Assignment Selector inside Modal */}
              <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Folder Assignment
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Current:{' '}
                    {folders.find((f) => f.id === inspectedReport.folder_id)?.name || 'Unorganized'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={inspectedReport.folder_id || ''}
                    onChange={(e) => {
                      const val = e.target.value ? e.target.value : null;
                      handleExecuteMove(inspectedReport.id, val);
                    }}
                    disabled={isMovingReport}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
                  >
                    <option value="">Unorganized (No Folder)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.report_count} reports)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Generation Scope & Query Parameters Snapshot */}
              <div className="space-y-2">
                <div className="font-bold uppercase tracking-wider text-[11px] text-zinc-600 dark:text-zinc-400">
                  Generation Parameters Snapshot
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 font-mono text-[11px] space-y-1.5">
                  {inspectedReport.parameters && Object.keys(inspectedReport.parameters).length > 0 ? (
                    Object.entries(inspectedReport.parameters).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-zinc-500 uppercase">{k}:</span>
                        <span className="font-bold text-[#1A1815] dark:text-white">
                          {String(v ?? 'None')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-400 italic">No parameter snapshot preserved.</div>
                  )}
                </div>
              </div>

              {/* Summary KPIs Snapshot (if available from report_data) */}
              {inspectedReport.report_data?.summary_kpis && (
                <div className="space-y-2">
                  <div className="font-bold uppercase tracking-wider text-[11px] text-zinc-600 dark:text-zinc-400">
                    Frozen Metric Snapshot (At Generation Time)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {Object.entries(inspectedReport.report_data.summary_kpis).map(([k, v]) => {
                      if (typeof v === 'object' && v !== null) return null;
                      const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                      const isPct = k.includes('rate') || k.includes('pct');
                      const isLatency = k.includes('latency');

                      return (
                        <div
                          key={k}
                          className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 font-mono"
                        >
                          <div className="text-[10px] font-bold text-zinc-500 uppercase truncate">
                            {label}
                          </div>
                          <div className="text-base font-black text-[#1A1815] dark:text-white mt-0.5">
                            {v === null || v === undefined
                              ? '—'
                              : isLatency
                              ? formatLatency(Number(v))
                              : isPct
                              ? `${Number(v).toFixed(1)}%`
                              : typeof v === 'number'
                              ? v.toLocaleString()
                              : String(v)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-6 border-t border-[#D8CFC0]/60 dark:border-white/10 flex items-center justify-between gap-3 bg-[#FAF8F5]/80 dark:bg-[#111318]">
              <button
                onClick={() => {
                  setReportToDelete(inspectedReport);
                  setDeleteReportError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-500/10 font-bold text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Report</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectedReport(null)}
                  className="px-4 py-2 rounded-xl border border-[#D8CFC0] dark:border-white/10 text-xs font-bold hover:bg-white dark:hover:bg-white/5 transition-all"
                >
                  Close
                </button>

                <button
                  onClick={() => handleDownloadReport(inspectedReport)}
                  disabled={downloadingId === inspectedReport.id}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                >
                  <Download
                    className={`w-4 h-4 ${downloadingId === inspectedReport.id ? 'animate-bounce' : ''}`}
                  />
                  <span>Download Artifact</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. REPORT GENERATION MODAL                                                */}
      {/* ========================================================================= */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#D8CFC0]/60 dark:border-white/10 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA580C] font-mono">
                  Report Compiler &amp; Generator
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-[#1A1815] dark:text-white mt-0.5">
                  Generate &amp; Persist Audit Report
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Configure reporting template, output format, destination folder, and query scope to persist an audit docket.
                </p>
              </div>

              <button
                onClick={() => setIsGenerateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Feedback Banners */}
              {persistSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{persistSuccessMsg}</span>
                </div>
              )}

              {persistError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{persistError}</span>
                </div>
              )}

              {directExportError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{directExportError}</span>
                </div>
              )}

              {/* Step 1: Select Template (6 Cards) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold uppercase tracking-wider text-[11px] text-zinc-600 dark:text-zinc-400">
                    Step 1: Select Report Template (6)
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Active: {TEMPLATE_CONFIG[selectedTemplate].title}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(
                    Object.keys(TEMPLATE_CONFIG) as ReportType[]
                  ).map((tId) => {
                    const isSelected = selectedTemplate === tId;
                    const meta = TEMPLATE_CONFIG[tId];
                    const Icon = meta.icon;

                    return (
                      <div
                        key={tId}
                        onClick={() => setSelectedTemplate(tId)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? 'bg-white dark:bg-zinc-900 border-[#EA580C] shadow-md ring-1 ring-[#EA580C]'
                            : 'bg-[#FAF8F5] dark:bg-[#111318] border-[#D8CFC0] dark:border-white/10 hover:border-[#EA580C]/50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-xl ${meta.bg} ${meta.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-extrabold text-xs text-[#1A1815] dark:text-white">
                                {meta.title}
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">{meta.badge}</span>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {meta.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Format & Persisted Document Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Format Selector */}
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[11px] text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Step 2: Output Format
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['pdf', 'csv', 'json'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setGenerationFormat(fmt)}
                        className={`py-2 px-2.5 rounded-xl font-mono text-xs font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                          generationFormat === fmt
                            ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-sm'
                            : 'bg-white dark:bg-white/5 text-zinc-700 dark:text-zinc-300 border border-[#D8CFC0] dark:border-white/10 hover:bg-zinc-50'
                        }`}
                      >
                        {fmt === 'pdf' && <FileText className="w-3 h-3 text-rose-500" />}
                        {fmt === 'csv' && <FileSpreadsheet className="w-3 h-3 text-emerald-500" />}
                        {fmt === 'json' && <FileCode className="w-3 h-3 text-[#EA580C]" />}
                        <span>{fmt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Title Input */}
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[11px] text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Custom Report Title (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={255}
                    placeholder={TEMPLATE_CONFIG[selectedTemplate].title}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs text-[#1A1815] dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
                  />
                </div>

                {/* Destination Folder Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold uppercase tracking-wider text-[11px] text-zinc-600 dark:text-zinc-400">
                      Destination Folder
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateFolderModalOpen(true);
                        setNewFolderName('');
                        setNewFolderDesc('');
                        setNewFolderColor('orange');
                        setCreateFolderError(null);
                      }}
                      className="text-[#EA580C] hover:underline text-[10px] font-bold"
                    >
                      + New Folder
                    </button>
                  </div>
                  <select
                    value={targetFolderId}
                    onChange={(e) => setTargetFolderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
                  >
                    <option value="">Unorganized (No Folder)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.report_count} reports)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 3: Scope & Filter Controls */}
              <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span className="uppercase tracking-wider">Step 3: Query Scope &amp; Filter Boundaries</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Preset Date Range Buttons */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {(
                      [
                        { key: '7d', label: '7 Days' },
                        { key: '30d', label: '30 Days' },
                        { key: '90d', label: '90 Days' },
                        { key: 'all', label: 'All Time' },
                        { key: 'custom', label: 'Custom' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setDatePreset(tab.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          datePreset === tab.key
                            ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-sm'
                            : 'bg-white/60 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/10 border border-[#D8CFC0] dark:border-white/5'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Date Pickers */}
                  {datePreset === 'custom' && (
                    <div className="flex items-center gap-2">
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

                  {/* Media, Status & Class Selectors */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-zinc-500 uppercase">Media:</span>
                      <select
                        value={mediaTypeFilter}
                        onChange={(e) => setMediaTypeFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none"
                      >
                        <option value="all">All</option>
                        <option value="image">Images</option>
                        <option value="video">Videos</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-zinc-500 uppercase">Status:</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none"
                      >
                        <option value="all">All</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="FAILED">Failed</option>
                      </select>
                    </div>

                    {selectedTemplate === 'vehicle_distribution' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase">Class:</span>
                        <select
                          value={vehicleClassFilter}
                          onChange={(e) => setVehicleClassFilter(e.target.value as any)}
                          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs font-semibold text-[#1A1815] dark:text-white focus:outline-none"
                        >
                          <option value="all">All</option>
                          <option value="car">Cars</option>
                          <option value="truck">Trucks</option>
                          <option value="bus">Buses</option>
                          <option value="motorbike">2-Wheelers</option>
                          <option value="auto_rickshaw">Auto Rickshaws</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* On-Demand Preview Drawer / Expansion */}
              {showPreviewDrawer && preview && (
                <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#EA580C]/40 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D8CFC0]/60 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#EA580C]" />
                      <span className="font-bold text-xs text-[#1A1815] dark:text-white">
                        Live Preview ({preview.total_rows} matching rows)
                      </span>
                    </div>
                    <button
                      onClick={() => setShowPreviewDrawer(false)}
                      className="text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Summary KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                    {Object.entries(preview.summary_kpis).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-black/30 border border-[#D8CFC0] dark:border-white/10">
                        <div className="text-[9px] font-bold text-zinc-500 uppercase truncate">
                          {k.replace(/_/g, ' ')}
                        </div>
                        <div className="text-sm font-black text-[#1A1815] dark:text-white mt-0.5">
                          {String(v ?? '—')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Preview Rows Table Snippet */}
                  <div className="max-h-48 overflow-y-auto border border-[#D8CFC0] dark:border-white/10 rounded-xl">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-[#FAF8F5] dark:bg-[#111318] border-b border-[#D8CFC0] dark:border-white/10 text-zinc-600 dark:text-zinc-400 uppercase text-[9px] sticky top-0">
                        <tr>
                          {preview.columns.map((col) => (
                            <th key={col.key} className="py-2 px-3 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8CFC0]/60 dark:divide-white/[0.06]">
                        {preview.rows.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            {preview.columns.map((col) => (
                              <td key={col.key} className="py-1.5 px-3 whitespace-nowrap">
                                {String(row[col.key] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 sm:p-6 border-t border-[#D8CFC0]/60 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FAF8F5]/90 dark:bg-[#111318]">
              {/* Direct In-Memory Export actions */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase hidden md:inline">
                  Direct Stream:
                </span>
                <button
                  type="button"
                  onClick={() => handleDirectExport('pdf')}
                  disabled={isExportingDirect || isPersisting}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-[11px] font-bold hover:bg-zinc-100 disabled:opacity-50"
                  title="Stream PDF directly without saving"
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectExport('csv')}
                  disabled={isExportingDirect || isPersisting}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-[11px] font-bold hover:bg-zinc-100 disabled:opacity-50"
                  title="Stream CSV directly without saving"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectExport('json')}
                  disabled={isExportingDirect || isPersisting}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-[11px] font-bold hover:bg-zinc-100 disabled:opacity-50"
                  title="Stream JSON directly without saving"
                >
                  Export JSON
                </button>
              </div>

              {/* Primary Persistence Actions */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handlePreviewReport}
                  disabled={isLoadingPreview || isPersisting}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-zinc-50 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{isLoadingPreview ? 'Previewing...' : 'Preview Telemetry'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateAndPersist}
                  disabled={isPersisting || isLoadingPreview}
                  className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  <FileCheck className={`w-4 h-4 ${isPersisting ? 'animate-spin' : ''}`} />
                  <span>{isPersisting ? 'Compiling & Saving...' : 'Generate & Save to Library'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CREATE FOLDER MODAL                                                    */}
      {/* ========================================================================= */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-md bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-[#EA580C]">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1A1815] dark:text-white">
                    Create New Folder
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono">Organize audit &amp; intelligence dockets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createFolderError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createFolderError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-[10px] text-zinc-600 dark:text-zinc-400 mb-1">
                  Folder Name <span className="text-[#EA580C]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="e.g. Monthly Toll Audits"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs text-[#1A1815] dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[10px] text-zinc-600 dark:text-zinc-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={512}
                  placeholder="Purpose of this folder..."
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs text-[#1A1815] dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#EA580C] resize-none"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[10px] text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {Object.entries(FOLDER_COLORS).map(([colorKey, colorVal]) => (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setNewFolderColor(colorKey)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${colorVal.bg} ${colorVal.text} ${
                        newFolderColor === colorKey ? 'ring-2 ring-[#EA580C] shadow-sm' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={colorVal.label}
                    >
                      <Folder className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D8CFC0]/60 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#D8CFC0] dark:border-white/10 text-xs font-bold hover:bg-white dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingFolder}
                className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isCreatingFolder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
                <span>{isCreatingFolder ? 'Creating...' : 'Create Folder'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. EDIT / RENAME FOLDER MODAL                                             */}
      {/* ========================================================================= */}
      {folderToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleUpdateFolder}
            className="w-full max-w-md bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-[#EA580C]">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1A1815] dark:text-white">
                    Edit Folder
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono">Rename or change theme color</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFolderToEdit(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editFolderError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editFolderError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-[10px] text-zinc-600 dark:text-zinc-400 mb-1">
                  Folder Name <span className="text-[#EA580C]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[10px] text-zinc-600 dark:text-zinc-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={512}
                  value={editFolderDesc}
                  onChange={(e) => setEditFolderDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-xs text-[#1A1815] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#EA580C] resize-none"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[10px] text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {Object.entries(FOLDER_COLORS).map(([colorKey, colorVal]) => (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setEditFolderColor(colorKey)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${colorVal.bg} ${colorVal.text} ${
                        editFolderColor === colorKey ? 'ring-2 ring-[#EA580C] shadow-sm' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={colorVal.label}
                    >
                      <Folder className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D8CFC0]/60 dark:border-white/10">
              <button
                type="button"
                onClick={() => setFolderToEdit(null)}
                className="px-4 py-2 rounded-xl border border-[#D8CFC0] dark:border-white/10 text-xs font-bold hover:bg-white dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingFolder}
                className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUpdatingFolder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isUpdatingFolder ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. DELETE FOLDER CONFIRMATION DIALOG                                      */}
      {/* ========================================================================= */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[#1A1815] dark:text-white">
                Delete Folder &quot;{folderToDelete.name}&quot;?
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                Deleting this folder will move its{' '}
                <strong className="text-[#1A1815] dark:text-white font-mono">
                  {folderToDelete.report_count} {folderToDelete.report_count === 1 ? 'report' : 'reports'}
                </strong>{' '}
                to <span className="font-semibold text-[#EA580C]">Unorganized</span>. The reports and their generated artifact files will remain completely intact in your library.
              </p>
            </div>

            {deleteFolderError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {deleteFolderError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setFolderToDelete(null)}
                disabled={isDeletingFolder}
                className="px-4 py-2 rounded-xl border border-[#D8CFC0] dark:border-white/10 text-xs font-bold hover:bg-white dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteFolder}
                disabled={isDeletingFolder}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeletingFolder ? 'animate-spin' : ''}`} />
                <span>{isDeletingFolder ? 'Deleting...' : 'Delete Folder'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MOVE REPORT TO FOLDER MODAL                                            */}
      {/* ========================================================================= */}
      {reportToMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-[#EA580C]">
                  <FolderInput className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1A1815] dark:text-white">
                    Move Report
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[240px]">
                    {reportToMove.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReportToMove(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {moveError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {moveError}
              </div>
            )}

            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Select Destination:
              </div>

              {/* Option: Unorganized */}
              <button
                onClick={() => handleExecuteMove(reportToMove.id, null)}
                disabled={isMovingReport || reportToMove.folder_id === null}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                  reportToMove.folder_id === null
                    ? 'bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white dark:bg-[#111318] border-[#D8CFC0] dark:border-white/10 hover:border-[#EA580C]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <div>
                    <div className="font-bold text-[#1A1815] dark:text-white">Unorganized</div>
                    <div className="text-[10px] text-zinc-500">Remove from any folder</div>
                  </div>
                </div>
                {reportToMove.folder_id === null && (
                  <span className="text-[10px] font-mono text-zinc-400 font-bold">Current</span>
                )}
              </button>

              {/* Option: Persisted Folders */}
              {folders.map((f) => {
                const isCurrent = reportToMove.folder_id === f.id;
                const colorInfo = FOLDER_COLORS[f.color] || FOLDER_COLORS.orange;

                return (
                  <button
                    key={f.id}
                    onClick={() => handleExecuteMove(reportToMove.id, f.id)}
                    disabled={isMovingReport || isCurrent}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 opacity-50 cursor-not-allowed'
                        : 'bg-white dark:bg-[#111318] border-[#D8CFC0] dark:border-white/10 hover:border-[#EA580C]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Folder className={`w-4 h-4 ${colorInfo.text}`} />
                      <div>
                        <div className="font-bold text-[#1A1815] dark:text-white">{f.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {f.report_count} {f.report_count === 1 ? 'report' : 'reports'}
                        </div>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-zinc-400 font-bold">Current</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setReportToMove(null)}
                className="px-4 py-2 rounded-xl border border-[#D8CFC0] dark:border-white/10 text-xs font-bold hover:bg-white dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. DELETE REPORT CONFIRMATION DIALOG                                     */}
      {/* ========================================================================= */}
      {reportToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[#1A1815] dark:text-white">
                Delete Persisted Report?
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Are you sure you want to permanently delete{' '}
                <strong className="text-[#1A1815] dark:text-white font-mono">
                  &quot;{reportToDelete.title}&quot;
                </strong>
                ? This will remove the database record and permanently delete the stored{' '}
                <span className="uppercase font-bold">{reportToDelete.file_format}</span> artifact from private storage.
              </p>
            </div>

            {deleteReportError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {deleteReportError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setReportToDelete(null)}
                disabled={isDeletingReport}
                className="px-4 py-2 rounded-xl border border-[#D8CFC0] dark:border-white/10 text-xs font-bold hover:bg-white dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmDeleteReport}
                disabled={isDeletingReport}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeletingReport ? 'animate-spin' : ''}`} />
                <span>{isDeletingReport ? 'Deleting...' : 'Permanently Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
