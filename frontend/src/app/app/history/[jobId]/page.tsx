'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  getRecognitionJobDetail,
  getFileContentUrl,
  fetchAuthenticatedBlob,
  RecognitionResponse,
  VideoRecognitionResponse,
  VehicleResult,
} from '@/lib/api';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Download,
  Copy,
  Check,
  FileCode,
  Layers,
  Video,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Car,
  Gauge,
  ShieldCheck,
  Maximize2,
  ChevronRight,
  Info,
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

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function formatLatency(ms?: number | null): string {
  if (ms == null || isNaN(ms)) return '—';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)} ms`;
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = Array.isArray(params?.jobId) ? params.jobId[0] : (params?.jobId as string);

  const [jobDetail, setJobDetail] = useState<RecognitionResponse | VideoRecognitionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'annotated' | 'raw'>('annotated');
  const [rawBlobUrl, setRawBlobUrl] = useState<string | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [showJson, setShowJson] = useState<boolean>(false);
  const [isModalZoom, setIsModalZoom] = useState<boolean>(false);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getRecognitionJobDetail(jobId)
      .then(async (detail) => {
        if (!isMounted) return;
        setJobDetail(detail);

        if (detail.file_id) {
          try {
            const blob = await fetchAuthenticatedBlob(getFileContentUrl(detail.file_id));
            if (isMounted) {
              const url = URL.createObjectURL(blob);
              setRawBlobUrl(url);
            }
          } catch (blobErr) {
            console.warn('Could not load raw image asset:', blobErr);
          }
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load recognition telemetry for this job.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (rawBlobUrl) {
        URL.revokeObjectURL(rawBlobUrl);
      }
    };
  }, [jobId]);

  const handleCopyJobId = () => {
    if (!jobId) return;
    navigator.clipboard.writeText(jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAnnotated = () => {
    if (!jobDetail) return;
    if ('annotated_image' in jobDetail && jobDetail.annotated_image) {
      const a = document.createElement('a');
      a.href = `data:image/jpeg;base64,${jobDetail.annotated_image}`;
      a.download = `visionplate_${jobDetail.job_id}_annotated.jpg`;
      a.click();
    }
  };

  const handleDownloadJson = () => {
    if (!jobDetail) return;
    const blob = new Blob([JSON.stringify(jobDetail, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visionplate_job_${jobDetail.job_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derive genuine persisted recognition statistics without fabrication
  const metrics = React.useMemo(() => {
    if (!jobDetail) return null;
    const isVideo = 'frames' in jobDetail;

    let vehiclesCount = 0;
    let platesDetectedCount = 0;
    let platesRecognizedCount = 0;
    let unreadablePlatesCount = 0;

    if (isVideo) {
      jobDetail.frames.forEach((f) => {
        vehiclesCount += f.vehicles.length;
        f.vehicles.forEach((v) => {
          if (v.plate) {
            platesDetectedCount += 1;
            if (v.plate.text && v.plate.text.trim()) {
              platesRecognizedCount += 1;
            } else {
              unreadablePlatesCount += 1;
            }
          }
        });
      });
    } else {
      vehiclesCount = jobDetail.vehicles.length;
      jobDetail.vehicles.forEach((v) => {
        if (v.plate) {
          platesDetectedCount += 1;
          if (v.plate.text && v.plate.text.trim()) {
            platesRecognizedCount += 1;
          } else {
            unreadablePlatesCount += 1;
          }
        }
      });
    }

    return {
      vehiclesCount,
      platesDetectedCount,
      platesRecognizedCount,
      unreadablePlatesCount,
      isVideo,
    };
  }, [jobDetail]);

  const activeVehicles: VehicleResult[] = React.useMemo(() => {
    if (!jobDetail) return [];
    if ('frames' in jobDetail) {
      return jobDetail.frames[activeFrameIndex]?.vehicles || [];
    }
    return jobDetail.vehicles || [];
  }, [jobDetail, activeFrameIndex]);

  return (
    <div className="min-h-full font-sans p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-6xl w-full mx-auto relative text-[#1A1815] dark:text-zinc-100">
      {/* ========================================================================= */}
      {/* SECTION A: INSPECTION COMMAND HEADER & NAVIGATION BREADCRUMB               */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D8CFC0]/60 dark:border-white/10">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
          <Link
            href="/app/history"
            className="inline-flex items-center gap-1.5 hover:text-[#EA580C] dark:hover:text-[#EA580C] transition-colors font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Detection History</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[#1A1815] dark:text-white font-bold">
            Inspection Workspace
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/app/detect"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live AI Studio</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#EA580C] animate-spin mx-auto" />
          <p className="text-xs font-bold text-zinc-500">Retrieving full recognition telemetry...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 space-y-3">
          <div className="flex items-center gap-2 font-bold text-base">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <span>Job Telemetry Unavailable</span>
          </div>
          <p className="text-xs">{error}</p>
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => router.refresh()}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-xs font-bold transition-colors"
            >
              Retry
            </button>
            <Link
              href="/app/history"
              className="text-xs font-bold underline hover:no-underline"
            >
              Return to History
            </Link>
          </div>
        </div>
      ) : jobDetail ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Main Inspection Header Card */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/[0.08] shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D8CFC0]/60 dark:border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
                    Neural Recognition Dossier
                  </span>
                  {jobDetail.status === 'COMPLETED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" /> COMPLETED
                    </span>
                  ) : jobDetail.status === 'FAILED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      <AlertCircle className="w-3 h-3" /> FAILED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                      <Clock className="w-3 h-3" /> {jobDetail.status}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-[#1A1815] dark:text-white tracking-tight">
                  {jobDetail.filename || ('frames' in jobDetail ? 'video_job.mp4' : 'image_job.jpg')}
                </h1>
                <div className="text-xs text-zinc-500 font-mono flex flex-wrap items-center gap-2 mt-1">
                  <span>Job ID: {jobDetail.job_id}</span>
                  <button
                    onClick={handleCopyJobId}
                    className="hover:text-black dark:hover:text-white p-1 rounded-md hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors"
                    title="Copy full Job ID"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span>&bull;</span>
                  <span>Created: {formatDate(jobDetail.created_at)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/10 border border-[#D8CFC0] dark:border-white/10 text-xs font-bold text-[#1A1815] dark:text-white hover:bg-zinc-50 shadow-xs"
                >
                  <FileCode className="w-4 h-4 text-[#EA580C]" />
                  <span>Export JSON</span>
                </button>
                {'annotated_image' in jobDetail && jobDetail.annotated_image && (
                  <button
                    onClick={handleDownloadAnnotated}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] text-white text-xs font-bold shadow-sm active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Annotated</span>
                  </button>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION B: RECOGNITION SUMMARY (AUTHENTIC PERSISTED METRICS)              */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
              {/* Vehicles Detected */}
              <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Vehicles</span>
                  <Car className="w-3.5 h-3.5 text-[#EA580C]" />
                </div>
                <div className="font-black text-xl text-[#1A1815] dark:text-white mt-1">
                  {metrics?.vehiclesCount || 0}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {metrics?.isVideo ? 'across all frames' : 'localized'}
                </div>
              </div>

              {/* Plates Localized */}
              <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Plates Localized</span>
                  <Gauge className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="font-black text-xl text-[#1A1815] dark:text-white mt-1">
                  {metrics?.platesDetectedCount || 0}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  ROI bounding boxes
                </div>
              </div>

              {/* Plates Recognized */}
              <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Plates Resolved</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="font-black text-xl text-emerald-600 dark:text-emerald-400 mt-1">
                  {metrics?.platesRecognizedCount || 0}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  OCR text extracted
                </div>
              </div>

              {/* Unreadable / Missing */}
              <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Unreadable</span>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="font-black text-xl text-amber-600 dark:text-amber-400 mt-1">
                  {metrics?.unreadablePlatesCount || 0}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  unresolved OCR
                </div>
              </div>

              {/* Processing Latency */}
              <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 col-span-2 sm:col-span-4 lg:col-span-1">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Pipeline Latency</span>
                  <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="font-mono font-black text-xl text-[#1A1815] dark:text-white mt-1">
                  {formatLatency(jobDetail.processing_time_ms)}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  inference runtime
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION C: VISUAL EVIDENCE WORKSPACE                                      */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/[0.08] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8CFC0]/60 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#EA580C]" />
                <h3 className="font-extrabold text-sm sm:text-base text-[#1A1815] dark:text-white">
                  Visual Evidence Inspection
                </h3>
              </div>

              {/* Toggle: Annotated AI View vs Original Raw Asset */}
              {'annotated_image' in jobDetail || !('frames' in jobDetail) ? (
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-xs">
                  <button
                    onClick={() => setViewTab('annotated')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      viewTab === 'annotated'
                        ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    Annotated AI View
                  </button>
                  <button
                    onClick={() => setViewTab('raw')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      viewTab === 'raw'
                        ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    Original Raw Asset
                  </button>
                </div>
              ) : null}
            </div>

            {/* Viewport Canvas */}
            {'annotated_image' in jobDetail || !('frames' in jobDetail) ? (
              <div className="relative rounded-2xl overflow-hidden min-h-[340px] max-h-[580px] bg-black border border-black/20 flex items-center justify-center">
                {viewTab === 'annotated' ? (
                  'annotated_image' in jobDetail && jobDetail.annotated_image ? (
                    <img
                      src={`data:image/jpeg;base64,${jobDetail.annotated_image}`}
                      alt="Annotated View"
                      className="max-h-[580px] w-auto max-w-full object-contain mx-auto transition-transform"
                    />
                  ) : rawBlobUrl ? (
                    <img
                      src={rawBlobUrl}
                      alt="Raw Asset"
                      className="max-h-[580px] w-auto max-w-full object-contain mx-auto"
                    />
                  ) : (
                    <div className="text-zinc-500 text-xs py-20 text-center space-y-1">
                      <p className="font-bold">Annotated visual telemetry not recorded for this job.</p>
                      <p className="text-[11px] text-zinc-600">Raw media stream may be accessed through file storage.</p>
                    </div>
                  )
                ) : rawBlobUrl ? (
                  <img
                    src={rawBlobUrl}
                    alt="Raw Asset"
                    className="max-h-[580px] w-auto max-w-full object-contain mx-auto"
                  />
                ) : (
                  <div className="text-zinc-500 text-xs py-20 text-center space-y-1">
                    <p className="font-bold">Original raw asset stream loading or unavailable.</p>
                    <p className="text-[11px] text-zinc-600">Check connection or authenticated session access.</p>
                  </div>
                )}
              </div>
            ) : (
              /* ========================================================================= */
              /* SECTION F: VIDEO SAMPLED-FRAME INSPECTION                                 */
              /* ========================================================================= */
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <div>
                      <span className="font-bold">1 FPS Sampled Video Telemetry:</span>{' '}
                      <span>
                        {jobDetail.sampled_frames_count} sampled frames &bull; {jobDetail.duration_seconds.toFixed(1)}s duration &bull; {jobDetail.video_fps.toFixed(1)} FPS &bull; {jobDetail.video_width}x{jobDetail.video_height}px
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-[10px] self-end sm:self-auto px-2 py-0.5 rounded-md bg-purple-500/20">
                    Frame {activeFrameIndex + 1} of {jobDetail.frames.length}
                  </span>
                </div>

                {/* Sampled Frame Scrubber Pills */}
                {jobDetail.frames.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {jobDetail.frames.map((frame, idx) => (
                      <button
                        key={frame.frame_index}
                        onClick={() => setActiveFrameIndex(idx)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          activeFrameIndex === idx
                            ? 'bg-[#EA580C] text-white shadow-xs ring-2 ring-[#EA580C]/20'
                            : 'bg-white dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-[#D8CFC0] dark:border-white/10 hover:border-[#EA580C]/40'
                        }`}
                      >
                        @ {frame.timestamp_seconds.toFixed(1)}s ({frame.vehicles.length} veh)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION D & SECTION 4: VEHICLE & LICENSE PLATE RECOGNITION INTELLIGENCE   */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/[0.08] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CFC0]/60 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-[#EA580C]" />
                <h3 className="font-extrabold text-sm sm:text-base text-[#1A1815] dark:text-white">
                  Localized Entities ({activeVehicles.length} Vehicles in Scope)
                </h3>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                Pipeline Latency: {formatLatency(jobDetail.processing_time_ms)}
              </span>
            </div>

            {activeVehicles.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 bg-white/50 dark:bg-white/[0.02] rounded-2xl border border-[#D8CFC0] dark:border-white/10">
                No vehicle or plate entities were detected in this image/frame.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {activeVehicles.map((veh, idx) => {
                  const hasPlateText = Boolean(veh.plate && veh.plate.text && veh.plate.text.trim());
                  const hasPlateRoi = Boolean(veh.plate);

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:border-[#EA580C]/30 transition-colors"
                    >
                      {/* Vehicle Identity */}
                      <div className="flex items-start gap-3.5">
                        <span className="w-8 h-8 rounded-xl bg-orange-500/10 text-[#EA580C] font-mono font-black text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-[#1A1815] dark:text-white flex items-center gap-2">
                            <span>{formatVehicleClass(veh.type)}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 font-mono font-bold">
                              {(veh.confidence * 100).toFixed(1)}% detection conf
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-1">
                            Vehicle BBox: [{veh.bbox.map((n) => Math.round(n)).join(', ')}]
                          </div>
                        </div>
                      </div>

                      {/* License Plate State (Recognized / Localized Unreadable / Not Detected) */}
                      <div className="flex flex-col md:items-end gap-1.5">
                        {hasPlateText ? (
                          /* State 1: Recognized */
                          <div className="flex items-center gap-2.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white dark:bg-black border-2 border-zinc-900 dark:border-white/20 font-mono font-black text-xs sm:text-sm text-zinc-950 dark:text-white shadow-xs">
                              <span className="text-[8px] bg-blue-700 text-white font-sans font-bold px-1 rounded-xs">
                                IND
                              </span>
                              <span>{veh.plate!.text}</span>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {((veh.plate!.confidence || 0) * 100).toFixed(0)}% OCR
                            </span>
                          </div>
                        ) : hasPlateRoi ? (
                          /* State 2: Localized but Unreadable */
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-bold text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                              Plate Localized &bull; OCR Unreadable
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              ({((veh.plate!.confidence || 0) * 100).toFixed(0)}% ROI conf)
                            </span>
                          </div>
                        ) : (
                          /* State 3: Plate Not Detected */
                          <span className="text-[11px] text-zinc-400 italic">
                            No License Plate Localized
                          </span>
                        )}

                        {veh.plate && veh.plate.bbox && (
                          <span className="text-[9px] text-zinc-400 font-mono">
                            Plate ROI: [{veh.plate.bbox.map((n) => Math.round(n)).join(', ')}]
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION G: PROCESSING DIAGNOSTICS & RAW TELEMETRY JSON                   */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-7 rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/[0.08] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CFC0]/60 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#EA580C]" />
                <h3 className="font-extrabold text-sm sm:text-base text-[#1A1815] dark:text-white">
                  Processing Diagnostics &amp; Contract Metadata
                </h3>
              </div>
            </div>

            {/* Failed Error Message if applicable */}
            {jobDetail.status === 'FAILED' && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Execution Failure Notice
                </div>
                <p className="text-xs font-mono">
                  {jobDetail.error_message || 'The recognition pipeline halted prematurely.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Record UUID</span>
                <p className="font-mono text-xs text-[#1A1815] dark:text-white mt-0.5 truncate">
                  {jobDetail.job_id}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Source Filename</span>
                <p className="font-medium text-xs text-[#1A1815] dark:text-white mt-0.5 truncate">
                  {jobDetail.filename || 'media_asset'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Asset Reference</span>
                <p className="font-mono text-xs text-[#1A1815] dark:text-white mt-0.5 truncate">
                  {jobDetail.file_id || 'embedded'}
                </p>
              </div>
            </div>

            {/* Foldable Raw JSON Contract Viewer */}
            <div className="pt-2">
              <button
                onClick={() => setShowJson(!showJson)}
                className="text-xs font-bold text-[#EA580C] hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <FileCode className="w-4 h-4" />
                <span>{showJson ? 'Hide Raw AI Output Contract' : 'View Raw AI Output Contract JSON'}</span>
              </button>

              {showJson && (
                <pre className="mt-3 p-4 rounded-2xl bg-zinc-950 text-zinc-300 font-mono text-[11px] overflow-x-auto max-h-96 border border-zinc-800">
                  {JSON.stringify(jobDetail, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
