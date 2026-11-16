'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { AuthService, AuthSession } from '@/lib/auth';
import {
  API_BASE_URL,
  getApiBaseUrl,
  uploadFile,
  recognizeImage,
  recognizeVideo,
  getRecognitionHistory,
  getRecognitionJobDetail,
  RecognitionResponse,
  VideoRecognitionResponse,
  VehicleResult,
  LicensePlateResult,
  RecognitionHistoryItem,
} from '@/lib/api';
import {
  Upload,
  Scan,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  Zap,
  Play,
  RotateCw,
  Sun,
  Moon,
  Car,
  Bike,
  Truck,
  ArrowRight,
  Shield,
  Download,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  History,
  X,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Activity,
  Maximize2,
  FileText,
  Loader2,
} from 'lucide-react';

// ==============================================================================
// 1. Authoritative Upload Constants & Constraints (Aligned with Backend)
// ==============================================================================
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB exact boundary
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
const ALLOWED_VIDEO_EXTENSIONS = ['mp4'];
const ALLOWED_EXTENSIONS = [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS];

// Verified Local Benchmark Vehicle Fixtures from frontend/public/assets
interface BenchmarkSample {
  key: string;
  label: string;
  icon: string;
  assetPath: string;
  filename: string;
  mimeType: string;
  vehicleClass: string;
  description: string;
}

const BENCHMARK_SAMPLES: BenchmarkSample[] = [
  {
    key: 'suv',
    label: 'SUV Sample',
    icon: '🚗',
    assetPath: '/assets/real_suv.jpg',
    filename: 'real_suv.jpg',
    mimeType: 'image/jpeg',
    vehicleClass: 'Car / SUV',
    description: 'White SUV in roadway corridor',
  },
  {
    key: 'auto',
    label: 'Three-Wheeler Sample',
    icon: '🛺',
    assetPath: '/assets/real_autorickshaw.jpg',
    filename: 'real_autorickshaw.jpg',
    mimeType: 'image/jpeg',
    vehicleClass: 'Three-Wheeler',
    description: 'Bajaj auto-rickshaw in urban traffic',
  },
  {
    key: 'bike',
    label: 'Motorcycle Sample',
    icon: '🏍️',
    assetPath: '/assets/real_bullet.jpg',
    filename: 'real_bullet.jpg',
    mimeType: 'image/jpeg',
    vehicleClass: 'Two-Wheeler',
    description: 'Royal Enfield motorcycle roadway view',
  },
  {
    key: 'truck',
    label: 'Commercial Truck Sample',
    icon: '🚚',
    assetPath: '/assets/real_truck.jpg',
    filename: 'real_truck.jpg',
    mimeType: 'image/jpeg',
    vehicleClass: 'Truck / Commercial',
    description: 'Heavy multi-axle freight carrier',
  },
  {
    key: 'bus',
    label: 'Bus Sample',
    icon: '🚌',
    assetPath: '/assets/real_bus.jpg',
    filename: 'real_bus.jpg',
    mimeType: 'image/jpeg',
    vehicleClass: 'Bus / Transit',
    description: 'Public transit bus on arterial road',
  },
];

type StudioStatus =
  | 'idle'
  | 'file_selected'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'no_detections'
  | 'ocr_unreadable'
  | 'error';

export default function DetectPage() {
  const { theme, isDark, toggleTheme } = useTheme();
  const [session, setSession] = useState<AuthSession | null>(null);

  // Media state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [isMediaVideo, setIsMediaVideo] = useState(false);
  const [activeBenchmark, setActiveBenchmark] = useState<string | null>(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState<string | null>(null);

  // Workflow & Inference State
  const [status, setStatus] = useState<StudioStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [pipelineStep, setPipelineStep] = useState<number>(1);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real Detection Results
  const [imageResult, setImageResult] = useState<RecognitionResponse | null>(null);
  const [videoResult, setVideoResult] = useState<VideoRecognitionResponse | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'annotated' | 'original'>('annotated');
  const [hoveredVehicleIdx, setHoveredVehicleIdx] = useState<number | null>(null);

  // UI helpers
  const [copied, setCopied] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState(false);
  const [copiedPlate, setCopiedPlate] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItems, setHistoryItems] = useState<RecognitionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleCopyPlate = (plateText: string) => {
    navigator.clipboard.writeText(plateText);
    setCopiedPlate(plateText);
    setTimeout(() => {
      setCopiedPlate((prev) => (prev === plateText ? null : prev));
    }, 2500);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Object URL lifecycle cleanup to prevent memory leaks
  const cleanupPreviewUrl = () => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  // 1. Initial Authentication Check & Lifecycle Management
  useEffect(() => {
    let active = AuthService.getSession();
    if (!active) {
      active = AuthService.initGuestSession();
    }
    setSession(active);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupPreviewUrl();
    };
  }, []);

  // 2. Centralized File Validation & Selection (Authoritative 15 MB, JPEG/PNG/MP4)
  const validateAndSelectFile = (file: File): boolean => {
    setErrorMessage(null);
    setImageResult(null);
    setVideoResult(null);

    // 2.1 File Size Boundary Check (Strictly <= 15 MB)
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setStatus('error');
      setErrorMessage(
        `File exceeds the maximum supported size of 15 MB (${(file.size / 1024 / 1024).toFixed(2)} MB).`
      );
      return false;
    }

    if (file.size === 0) {
      setStatus('error');
      setErrorMessage('Selected file is empty (0 bytes).');
      return false;
    }

    // 2.2 Extension Validation
    const nameParts = file.name.split('.');
    const ext = nameParts.length > 1 ? nameParts.pop()?.toLowerCase() || '' : '';

    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setStatus('error');
      if (ext === 'mov' || ext === 'avi') {
        setErrorMessage('Unsupported video format. Use MP4.');
      } else if (['gif', 'bmp', 'webp', 'svg', 'tiff'].includes(ext)) {
        setErrorMessage('Unsupported image format. Use JPEG or PNG.');
      } else {
        setErrorMessage(`File extension '.${ext || 'unknown'}' is not supported. Please upload JPEG, PNG, or MP4.`);
      }
      return false;
    }

    const isImageExt = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
    const isVideoExt = ALLOWED_VIDEO_EXTENSIONS.includes(ext);

    // 2.3 MIME Alignment Validation (Where browser reports MIME)
    if (file.type) {
      const mime = file.type.toLowerCase();
      if (isImageExt && !['image/jpeg', 'image/png', 'image/pjpeg', 'image/x-png'].includes(mime)) {
        setStatus('error');
        setErrorMessage('File type and extension do not match. Expected JPEG or PNG image.');
        return false;
      }
      if (isVideoExt && mime !== 'video/mp4') {
        setStatus('error');
        setErrorMessage('File type and extension do not match. Expected MP4 video.');
        return false;
      }
    }

    // 2.4 State Assignment and URL Management
    cleanupPreviewUrl();
    const newPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = newPreviewUrl;

    setSelectedFile(file);
    setIsMediaVideo(isVideoExt);
    setMediaPreviewUrl(newPreviewUrl);
    setStatus('file_selected');
    setStatusMessage(`Asset staged: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB). Ready for inference.`);
    return true;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setActiveBenchmark(null);
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  // 3. Functional Benchmark Sample Runner (Fetches Local Public Asset & Stages Real File)
  const handleSelectBenchmark = async (sample: BenchmarkSample) => {
    setActiveBenchmark(sample.key);
    setLoadingBenchmark(sample.key);
    setErrorMessage(null);
    setImageResult(null);
    setVideoResult(null);

    try {
      const res = await fetch(sample.assetPath);
      if (!res.ok) {
        throw new Error(`Failed to load benchmark fixture "${sample.filename}" (HTTP ${res.status}).`);
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        throw new Error(`Benchmark fixture "${sample.filename}" is empty.`);
      }

      // Construct a genuine File object matching the verified local asset
      const file = new File([blob], sample.filename, {
        type: sample.mimeType,
        lastModified: Date.now(),
      });

      const valid = validateAndSelectFile(file);
      if (valid) {
        setStatusMessage(`Benchmark fixture staged: ${sample.label} (${(file.size / 1024).toFixed(0)} KB). Ready for inference.`);
      }
    } catch (err: any) {
      console.error('Failed to stage benchmark sample:', err);
      setStatus('error');
      setErrorMessage(err.message || `Unable to load benchmark asset "${sample.filename}".`);
      setSelectedFile(null);
      cleanupPreviewUrl();
      setMediaPreviewUrl(null);
    } finally {
      setLoadingBenchmark(null);
    }
  };

  // 4. Complete End-to-End Inference Execution (Honest Timer & Indeterminate Stage Stepper)
  const executePipeline = async () => {
    if (!selectedFile) return;

    setStatus('uploading');
    setPipelineStep(1);
    setStatusMessage('Uploading and staging asset in VisionPlate repository...');
    setErrorMessage(null);
    setElapsedMs(0);

    const startTime = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 80);

    try {
      // Step A: Upload file to /api/v1/files/upload
      const uploadResp = await uploadFile(selectedFile);

      // Step B: Inference Pipeline (Multi-Class + Plate + OCR)
      setStatus('processing');
      setPipelineStep(2);
      setStatusMessage('Executing YOLOv8 multi-class vehicle localization...');

      // Dynamic informational stage ticker
      setTimeout(() => {
        setPipelineStep(3);
        setStatusMessage('Extracting license plate bounding regions...');
      }, 700);

      setTimeout(() => {
        setPipelineStep(4);
        setStatusMessage('Running Indian MoRTH character OCR & regex normalization...');
      }, 1400);

      if (isMediaVideo) {
        // Video Inference via /api/v1/recognition/videos
        const vResult = await recognizeVideo(uploadResp.id);
        if (timerRef.current) clearInterval(timerRef.current);
        setElapsedMs(Date.now() - startTime);

        setVideoResult(vResult);
        setActiveFrameIndex(0);

        let totalVehicles = 0;
        let totalPlates = 0;
        vResult.frames.forEach((f) => {
          totalVehicles += f.vehicles.length;
          totalPlates += f.vehicles.filter((v) => v.plate).length;
        });

        if (totalVehicles === 0) {
          setStatus('no_detections');
          setStatusMessage('No vehicles were detected across sampled video frames.');
        } else if (totalPlates === 0) {
          setStatus('ocr_unreadable');
          setStatusMessage('Vehicles localized, but no license plates could be resolved.');
        } else {
          setStatus('completed');
          setStatusMessage(`Video ALPR complete: ${totalVehicles} vehicles, ${totalPlates} plates localized.`);
        }
      } else {
        // Image Inference via /api/v1/recognition/images
        const imgResult = await recognizeImage(uploadResp.id);
        if (timerRef.current) clearInterval(timerRef.current);
        setElapsedMs(Date.now() - startTime);

        setImageResult(imgResult);

        if (!imgResult.vehicles || imgResult.vehicles.length === 0) {
          setStatus('no_detections');
          setStatusMessage('No vehicles were detected in this image.');
        } else {
          const platesFound = imgResult.vehicles.filter((v) => v.plate);
          const recognizedText = platesFound.filter((v) => v.plate?.text && v.plate.text.trim().length > 0);

          if (platesFound.length === 0) {
            setStatus('ocr_unreadable');
            setStatusMessage('Vehicle detected, but no license plate region localized.');
          } else if (recognizedText.length === 0) {
            setStatus('ocr_unreadable');
            setStatusMessage('License plate localized, but characters could not be recognized by OCR.');
          } else {
            setStatus('completed');
            setStatusMessage(`Inference complete in ${imgResult.processing_time_ms} ms.`);
          }
        }
      }
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      console.error('Inference execution failed:', err);
      setStatus('error');
      const rawMsg = err.message || '';
      if (rawMsg.includes('401') || rawMsg.includes('Unauthorized') || rawMsg.includes('credentials')) {
        setErrorMessage('Session expired or authentication required. Please sign in again.');
      } else if (rawMsg.includes('413') || rawMsg.includes('Payload Too Large')) {
        setErrorMessage('File exceeds maximum allowable limit of 15 MB.');
      } else if (rawMsg.includes('415') || rawMsg.includes('Unsupported Media Type')) {
        setErrorMessage('Unsupported media format. Only JPEG, PNG, and MP4 are accepted.');
      } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
        setErrorMessage(`Backend is connecting (${getApiBaseUrl()}). If Render was asleep, please wait 5-10s and click again.`);
      } else {
        setErrorMessage(rawMsg || 'Pipeline execution failed. Please verify asset and try again.');
      }
    }
  };

  // Active Vehicle & Plate records for display
  const activeVehicles: VehicleResult[] = useMemo(() => {
    if (imageResult) return imageResult.vehicles || [];
    if (videoResult && videoResult.frames[activeFrameIndex]) {
      return videoResult.frames[activeFrameIndex].vehicles || [];
    }
    return [];
  }, [imageResult, videoResult, activeFrameIndex]);

  const resolvedPlates = useMemo(() => {
    return activeVehicles.filter((v) => v.plate).map((v) => v.plate!);
  }, [activeVehicles]);

  const recognizedPlatesCount = useMemo(() => {
    return resolvedPlates.filter((p) => p.text && p.text.trim().length > 0).length;
  }, [resolvedPlates]);

  // Viewfinder Dimensions & Aspect
  const activeMediaDimensions = useMemo(() => {
    if (imageResult) {
      return { width: imageResult.image_width || 768, height: imageResult.image_height || 432 };
    }
    if (videoResult) {
      return { width: videoResult.video_width || 768, height: videoResult.video_height || 432 };
    }
    return { width: 768, height: 432 };
  }, [imageResult, videoResult]);

  // 5. Authentic Output Contract & Export (Pure Backend Data, Zero Mock Previews)
  const activeJsonContract = useMemo(() => {
    if (imageResult) return imageResult;
    if (videoResult) return videoResult;
    return { status: 'idle', message: 'No inference executed yet.' };
  }, [imageResult, videoResult]);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(activeJsonContract, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyJobId = (jobId: string) => {
    navigator.clipboard.writeText(jobId);
    setCopiedJobId(true);
    setTimeout(() => setCopiedJobId(false), 2000);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(activeJsonContract, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visionplate_${imageResult?.job_id || videoResult?.job_id || 'detection'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const rows = [
      ['Job ID', 'Media Type', 'Timestamp', 'Vehicle Index', 'Vehicle Type', 'Vehicle Confidence', 'Plate Text', 'Plate Confidence', 'Bounding Box'],
    ];

    const jobId = imageResult?.job_id || videoResult?.job_id || 'manual';
    const mediaType = isMediaVideo ? 'video' : 'image';
    const timestamp = imageResult?.created_at || videoResult?.created_at || new Date().toISOString();

    if (imageResult) {
      imageResult.vehicles.forEach((v, idx) => {
        rows.push([
          jobId,
          mediaType,
          timestamp,
          String(idx + 1),
          v.type,
          (v.confidence * 100).toFixed(1) + '%',
          v.plate?.text || 'N/A',
          v.plate ? (v.plate.confidence * 100).toFixed(1) + '%' : 'N/A',
          `"[${v.bbox.join(',')}]"`,
        ]);
      });
    } else if (videoResult) {
      videoResult.frames.forEach((f) => {
        f.vehicles.forEach((v, vIdx) => {
          rows.push([
            jobId,
            `video_frame_${f.frame_index}`,
            f.timestamp_seconds.toFixed(2) + 's',
            String(vIdx + 1),
            v.type,
            (v.confidence * 100).toFixed(1) + '%',
            v.plate?.text || 'N/A',
            v.plate ? (v.plate.confidence * 100).toFixed(1) + '%' : 'N/A',
            `"[${v.bbox.join(',')}]"`,
          ]);
        });
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encodedUri;
    a.download = `visionplate_${jobId}.csv`;
    a.click();
  };

  const downloadAnnotatedImage = () => {
    if (!imageResult?.annotated_image) return;
    const a = document.createElement('a');
    a.href = `data:image/jpeg;base64,${imageResult.annotated_image}`;
    a.download = `visionplate_annotated_${imageResult.job_id}.jpg`;
    a.click();
  };

  // 6. History Drawer Integration
  const openHistory = async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const hist = await getRecognitionHistory({ page: 1, page_size: 15 });
      setHistoryItems(hist.items || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPastJob = async (jobId: string) => {
    try {
      setShowHistoryModal(false);
      setStatus('processing');
      setStatusMessage(`Retrieving historical job ${jobId}...`);
      const detail = await getRecognitionJobDetail(jobId);

      if ('frames' in detail) {
        setVideoResult(detail as VideoRecognitionResponse);
        setImageResult(null);
        setIsMediaVideo(true);
        setStatus('completed');
        setStatusMessage(`Loaded video job ${jobId}`);
      } else {
        setImageResult(detail as RecognitionResponse);
        setVideoResult(null);
        setIsMediaVideo(false);
        setStatus('completed');
        setStatusMessage(`Loaded image job ${jobId}`);
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Failed to load past recognition job.');
    }
  };

  // Reset Studio
  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    cleanupPreviewUrl();
    setSelectedFile(null);
    setMediaPreviewUrl(null);
    setImageResult(null);
    setVideoResult(null);
    setActiveBenchmark(null);
    setStatus('idle');
    setErrorMessage(null);
    setStatusMessage('');
    setPipelineStep(1);
    setElapsedMs(0);
  };

  // Helper for vehicle icon
  const getVehicleIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'motorbike' || t === 'bicycle') return <Bike className="w-4 h-4" />;
    if (t === 'truck' || t === 'bus' || t === 'lcv') return <Truck className="w-4 h-4" />;
    return <Car className="w-4 h-4" />;
  };

  // Active workflow stage derivation
  const activeStage = useMemo(() => {
    if (status === 'uploading' || status === 'processing') return 2;
    if (status === 'completed' || status === 'no_detections' || status === 'ocr_unreadable') return 3;
    return 1;
  }, [status]);

  const activeJobId = imageResult?.job_id || videoResult?.job_id || null;

  return (
    <div className="min-h-full font-sans p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#C7BBA5]/40 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1A1815] dark:text-white">
              Detection Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live ALPR Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Enterprise Indian vehicle localization across 8 classes and automated license plate recognition.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Recent History Button */}
          <button
            onClick={openHistory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/15 text-xs font-semibold text-[#1A1815] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-xs cursor-pointer"
            title="Browse Authenticated History"
          >
            <History className="w-3.5 h-3.5 text-emerald-500" />
            <span>History</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/15 text-[#1A1815] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Back to Dashboard */}
          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1A1815] text-white dark:bg-white dark:text-black text-xs font-semibold hover:opacity-90 transition-all shadow-xs"
          >
            <span>Command Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3-Stage Workflow Stepper */}
      <div className="grid grid-cols-3 gap-2 p-2 rounded-2xl gw-panel text-xs font-mono">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
            activeStage === 1
              ? 'bg-white dark:bg-white/10 font-bold shadow-xs text-[#1A1815] dark:text-white'
              : activeStage > 1
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-zinc-400'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              activeStage > 1
                ? 'bg-emerald-500 text-white'
                : activeStage === 1
                ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black'
                : 'bg-zinc-300 dark:bg-white/10 text-zinc-500'
            }`}
          >
            {activeStage > 1 ? '✓' : '1'}
          </span>
          <span className="truncate">Stage 01: Media Input</span>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
            activeStage === 2
              ? 'bg-white dark:bg-white/10 font-bold shadow-xs text-amber-600 dark:text-amber-400'
              : activeStage > 2
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-zinc-400'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              activeStage > 2
                ? 'bg-emerald-500 text-white'
                : activeStage === 2
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-zinc-300 dark:bg-white/10 text-zinc-500'
            }`}
          >
            {activeStage > 2 ? '✓' : '2'}
          </span>
          <span className="truncate">Stage 02: Neural Pipeline</span>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
            activeStage === 3
              ? 'bg-white dark:bg-white/10 font-bold shadow-xs text-emerald-600 dark:text-emerald-400'
              : 'text-zinc-400'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              activeStage === 3
                ? 'bg-emerald-500 text-white'
                : 'bg-zinc-300 dark:bg-white/10 text-zinc-500'
            }`}
          >
            3
          </span>
          <span className="truncate">Stage 03: Recognition Dossier</span>
        </div>
      </div>

      {/* Verified Local Benchmark Reference Bar */}
      <div className="p-4 rounded-3xl gw-panel shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Local Roadway Benchmarks (Verified Public Assets):</span>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
            Click any fixture to stage a genuine local File and run live inference
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {BENCHMARK_SAMPLES.map((sample) => {
            const isLoading = loadingBenchmark === sample.key;
            const isSelected = activeBenchmark === sample.key && selectedFile?.name === sample.filename;

            return (
              <button
                key={sample.key}
                type="button"
                disabled={isLoading || status === 'uploading' || status === 'processing'}
                onClick={() => handleSelectBenchmark(sample)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-500/10 dark:border-emerald-400 dark:bg-emerald-500/15 shadow-xs font-bold'
                    : 'border-[#C7BBA5]/60 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                }`}
              >
                {isLoading && (
                  <div className="absolute top-2 right-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  </div>
                )}
                <div className="text-xl mb-1">{sample.icon}</div>
                <div className="text-xs font-bold text-[#1A1815] dark:text-white truncate">{sample.label}</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">{sample.vehicleClass}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Dual Panel Workspace (Responsive 12-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Viewfinder Canvas (7 Cols) */}
        <div className="lg:col-span-7 rounded-3xl p-5 sm:p-6 gw-panel shadow-xs flex flex-col justify-between">
          {/* Viewfinder Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  status === 'processing' || status === 'uploading'
                    ? 'bg-amber-500 animate-ping'
                    : status === 'completed'
                    ? 'bg-emerald-500'
                    : status === 'error'
                    ? 'bg-rose-500'
                    : 'bg-zinc-400'
                }`}
              />
              <span className="text-xs font-bold font-mono uppercase text-[#1A1815] dark:text-white tracking-wider">
                {status === 'processing'
                  ? 'Inference Engine Active'
                  : status === 'uploading'
                  ? 'Asset Ingestion'
                  : status === 'completed'
                  ? 'Inference Synchronized'
                  : status === 'no_detections'
                  ? 'No Vehicles Localized'
                  : status === 'ocr_unreadable'
                  ? 'Partial Extraction'
                  : 'Studio Viewfinder Standby'}
              </span>
            </div>

            {/* View Mode Toggle (Annotated vs Original) */}
            <div className="flex items-center gap-2">
              {imageResult?.annotated_image && (
                <div className="inline-flex rounded-full p-0.5 bg-black/5 dark:bg-white/10 border border-[#C7BBA5]/60 dark:border-white/15 text-[11px] font-mono">
                  <button
                    onClick={() => setViewMode('annotated')}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      viewMode === 'annotated'
                        ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black font-semibold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    AI Annotated
                  </button>
                  <button
                    onClick={() => setViewMode('original')}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      viewMode === 'original'
                        ? 'bg-[#1A1815] text-white dark:bg-white dark:text-black font-semibold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    Original + HUD
                  </button>
                </div>
              )}

              {/* Reset Button */}
              {(selectedFile || mediaPreviewUrl) && (
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 transition-colors cursor-pointer"
                  title="Clear Viewfinder"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Viewfinder Canvas Area */}
          <div
            ref={viewfinderRef}
            className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-black/20 dark:border-white/15 flex items-center justify-center shadow-lg group select-none"
          >
            {mediaPreviewUrl || imageResult?.annotated_image ? (
              <>
                {/* 1. Main Display Media (Annotated Image or Original Image / Video) */}
                {viewMode === 'annotated' && imageResult?.annotated_image ? (
                  <img
                    src={`data:image/jpeg;base64,${imageResult.annotated_image}`}
                    alt="AI Annotated Inference Output"
                    className="w-full h-full object-contain"
                  />
                ) : isMediaVideo && selectedFile ? (
                  <video
                    src={mediaPreviewUrl!}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={mediaPreviewUrl!}
                    alt="Selected input footage"
                    className="w-full h-full object-contain opacity-95"
                  />
                )}

                {/* 2. Interactive Real Dynamic Bounding Box Overlay (When in Original/HUD view) */}
                {viewMode === 'original' && activeVehicles.length > 0 && (
                  <svg
                    viewBox={`0 0 ${activeMediaDimensions.width} ${activeMediaDimensions.height}`}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {activeVehicles.map((v, i) => {
                      const [vx1, vy1, vx2, vy2] = v.bbox;
                      const vw = vx2 - vx1;
                      const vh = vy2 - vy1;
                      const isHovered = hoveredVehicleIdx === i;

                      return (
                        <g key={`v_box_${i}`}>
                          {/* Vehicle Box */}
                          <rect
                            x={vx1}
                            y={vy1}
                            width={vw}
                            height={vh}
                            fill={isHovered ? 'rgba(16, 185, 129, 0.25)' : 'none'}
                            stroke={isHovered ? '#10b981' : '#34d399'}
                            strokeWidth={Math.max(2, Math.round(activeMediaDimensions.width / 350))}
                            rx={4}
                          />
                          {/* Vehicle Label Tag */}
                          <rect
                            x={vx1}
                            y={Math.max(0, vy1 - 24)}
                            width={Math.max(120, v.type.length * 10 + 60)}
                            height={22}
                            fill="#0A0A0C"
                            stroke="#34d399"
                            strokeWidth={1}
                            rx={3}
                          />
                          <text
                            x={vx1 + 6}
                            y={Math.max(16, vy1 - 8)}
                            fill="#34d399"
                            fontSize="12"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {v.type.toUpperCase()} • {(v.confidence * 100).toFixed(0)}%
                          </text>

                          {/* Plate Box (if detected) */}
                          {v.plate && (
                            <g key={`p_box_${i}`}>
                              {(() => {
                                const [px1, py1, px2, py2] = v.plate.bbox;
                                const pw = px2 - px1;
                                const ph = py2 - py1;
                                return (
                                  <>
                                    <rect
                                      x={px1}
                                      y={py1}
                                      width={pw}
                                      height={ph}
                                      fill="rgba(245, 158, 11, 0.3)"
                                      stroke="#f59e0b"
                                      strokeWidth={Math.max(2, Math.round(activeMediaDimensions.width / 400))}
                                      rx={3}
                                    />
                                    <rect
                                      x={px1}
                                      y={Math.max(0, py1 - 22)}
                                      width={Math.max(90, (v.plate.text || 'Plate').length * 10 + 20)}
                                      height={20}
                                      fill="#0A0A0C"
                                      stroke="#f59e0b"
                                      strokeWidth={1}
                                      rx={3}
                                    />
                                    <text
                                      x={px1 + 4}
                                      y={Math.max(14, py1 - 8)}
                                      fill="#fbbf24"
                                      fontSize="11"
                                      fontFamily="monospace"
                                      fontWeight="bold"
                                    >
                                      {v.plate.text || 'PLATE'}
                                    </text>
                                  </>
                                );
                              })()}
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                )}

                {/* Laser Scanning Animation during processing */}
                {(status === 'uploading' || status === 'processing') && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-laser pointer-events-none" />
                )}
              </>
            ) : (
              /* Idle Empty Viewfinder */
              <div className="text-center p-8 text-zinc-500">
                <Scan className="w-12 h-12 mx-auto mb-3 text-zinc-600 opacity-60" />
                <p className="text-sm font-semibold text-zinc-400">Viewfinder Standby</p>
                <p className="text-xs text-zinc-600 mt-1 max-w-sm">
                  Upload a JPEG, PNG, or MP4 asset (up to 15 MB) or select a benchmark fixture to activate optical scan.
                </p>
              </div>
            )}

            {/* Honest Indeterminate Processing Overlay (Zero 70% freeze) */}
            {(status === 'uploading' || status === 'processing') && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 p-6 text-center space-y-4">
                <div className="relative">
                  <div className="w-12 h-12 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  <Activity className="w-5 h-5 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <span className="text-xs font-mono font-bold tracking-wide text-white block">
                    {statusMessage}
                  </span>
                  <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Elapsed: {(elapsedMs / 1000).toFixed(1)}s</span>
                  </div>
                </div>

                {/* Indeterminate Beam Progress Bar */}
                <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-shimmer" />
                </div>

                {/* Conceptual Pipeline Steps */}
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                  <span className={pipelineStep >= 1 ? 'text-emerald-400 font-bold' : ''}>Ingest</span>
                  <span>→</span>
                  <span className={pipelineStep >= 2 ? 'text-emerald-400 font-bold' : ''}>Vehicles</span>
                  <span>→</span>
                  <span className={pipelineStep >= 3 ? 'text-emerald-400 font-bold' : ''}>Plates</span>
                  <span>→</span>
                  <span className={pipelineStep >= 4 ? 'text-emerald-400 font-bold' : ''}>OCR</span>
                </div>
              </div>
            )}
          </div>

          {/* Viewfinder Telemetry & Status Bar */}
          <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              {status === 'completed' && resolvedPlates.length > 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-[#1A1815] dark:text-white">
                    {resolvedPlates.map((p) => p.text).filter(Boolean).join(' • ') || 'Plates Localized'}
                  </span>
                  <span className="text-zinc-500">
                    ({(resolvedPlates[0].confidence * 100).toFixed(1)}% OCR conf)
                  </span>
                </>
              ) : status === 'no_detections' ? (
                <>
                  <AlertCircle className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-600 dark:text-zinc-400">No vehicle detected</span>
                </>
              ) : status === 'ocr_unreadable' ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">Plate localized, OCR unreadable</span>
                </>
              ) : status === 'error' ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span className="text-rose-600 dark:text-rose-400">Inference Error</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-500">Dual YOLOv8 Model Runtime</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
              {imageResult && (
                <>
                  <span>{imageResult.processing_time_ms} ms</span>
                  <span>•</span>
                  <span>
                    {imageResult.image_width} × {imageResult.image_height} px
                  </span>
                </>
              )}
              {videoResult && (
                <>
                  <span>{videoResult.duration_seconds.toFixed(1)}s</span>
                  <span>•</span>
                  <span>{videoResult.sampled_frames_count} frames sampled</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Execution Controls, Detections, & Export (5 Cols with overflow-y-auto) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Headline Result KPI Bar (Active when inference completed) */}
          {activeStage === 3 && (
            <div className="p-4 rounded-3xl gw-panel border border-emerald-500/30 dark:border-emerald-500/20 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#1A1815] dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Recognition Dossier
                </span>
                {activeJobId && (
                  <button
                    onClick={() => copyJobId(activeJobId)}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    title="Copy Job ID"
                  >
                    <span>ID: {activeJobId.slice(0, 8)}...</span>
                    {copiedJobId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="text-lg font-bold font-mono text-[#1A1815] dark:text-white">
                    {activeVehicles.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Vehicles</div>
                </div>

                <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                    {resolvedPlates.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Plates Loc</div>
                </div>

                <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {recognizedPlatesCount}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Recognized</div>
                </div>

                <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="text-lg font-bold font-mono text-[#1A1815] dark:text-white">
                    {imageResult ? `${imageResult.processing_time_ms}ms` : `${(elapsedMs / 1000).toFixed(1)}s`}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Latency</div>
                </div>
              </div>
            </div>
          )}

          {/* File Upload & Execution Card */}
          <div className="rounded-3xl p-5 sm:p-6 gw-panel shadow-xs">
            <h3 className="font-bold text-base text-[#1A1815] dark:text-white mb-1">
              Media Ingestion &amp; Pipeline Execution
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
              Upload roadway footage to run YOLOv8 vehicle detection and Indian license plate OCR.
            </p>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-[#C7BBA5]/70 dark:border-white/15 hover:border-emerald-600 dark:hover:border-emerald-400 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
              }`}
            >
              <Upload className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-2" />
              <span className="text-xs font-semibold text-[#1A1815] dark:text-white text-center">
                {selectedFile
                  ? `Selected: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`
                  : 'Choose File or Drag & Drop'}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono mt-1">
                Supports JPG, PNG, MP4 up to 15 MB
              </span>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,video/mp4"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setActiveBenchmark(null);
                    validateAndSelectFile(e.target.files[0]);
                  }
                }}
              />
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={!selectedFile || status === 'uploading' || status === 'processing'}
                onClick={executePipeline}
                className={`flex-1 py-2.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  !selectedFile || status === 'uploading' || status === 'processing'
                    ? 'bg-zinc-300 dark:bg-white/10 text-zinc-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-98'
                }`}
              >
                {status === 'uploading' || status === 'processing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run ALPR Pipeline</span>
                  </>
                )}
              </button>

              {activeStage === 3 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-full text-xs font-semibold border border-[#C7BBA5] dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-[#1A1815] dark:text-white cursor-pointer"
                >
                  New Scan
                </button>
              )}
            </div>
          </div>

          {/* Video Frames Scrubber (Visible only if Video recognition completed) */}
          {videoResult && videoResult.frames.length > 0 && (
            <div className="rounded-3xl p-5 gw-panel shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1A1815] dark:text-white font-mono flex items-center gap-1.5">
                  <VideoIcon className="w-4 h-4 text-emerald-500" />
                  <span>Sampled Video Frames ({videoResult.sampled_frames_count}):</span>
                </span>
                <span className="font-mono text-zinc-500">
                  Frame #{videoResult.frames[activeFrameIndex]?.frame_index ?? 0} (
                  {videoResult.frames[activeFrameIndex]?.timestamp_seconds.toFixed(2)}s)
                </span>
              </div>

              {/* Frame Pills with touch/mouse scroll */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {videoResult.frames.map((frame, idx) => (
                  <button
                    key={`frame_pill_${idx}`}
                    onClick={() => setActiveFrameIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium flex-shrink-0 transition-colors cursor-pointer ${
                      activeFrameIndex === idx
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-black/10'
                    }`}
                  >
                    {frame.timestamp_seconds.toFixed(1)}s ({frame.vehicles.length}v)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Real AI Detections Breakdown Card (Scrollable list with overflow-y-auto) */}
          {activeVehicles.length > 0 && (
            <div className="rounded-3xl p-5 gw-panel shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#1A1815] dark:text-white">
                  Vehicle Detections ({activeVehicles.length}):
                </h4>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {recognizedPlatesCount} Recognized / {resolvedPlates.length} Localized
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activeVehicles.map((vehicle, i) => {
                  const hasPlate = !!vehicle.plate;
                  const isRecognized = hasPlate && !!vehicle.plate?.text && vehicle.plate.text.trim().length > 0;
                  const isHovered = hoveredVehicleIdx === i;

                  return (
                    <div
                      key={`v_card_${i}`}
                      onMouseEnter={() => setHoveredVehicleIdx(i)}
                      onMouseLeave={() => setHoveredVehicleIdx(null)}
                      className={`p-3 rounded-2xl border transition-all text-xs flex items-center justify-between cursor-default ${
                        isHovered
                          ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15'
                          : 'bg-white/70 dark:bg-white/[0.04] border-[#C7BBA5]/50 dark:border-white/10 hover:border-emerald-500/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          {getVehicleIcon(vehicle.type)}
                        </div>
                        <div>
                          <div className="font-bold text-[#1A1815] dark:text-white capitalize flex items-center gap-1.5">
                            <span>{vehicle.type.replace('_', ' ')}</span>
                            <span className="text-[10px] text-zinc-400 font-mono font-normal">
                              ({(vehicle.confidence * 100).toFixed(0)}%)
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            BBox: [{vehicle.bbox.map((b) => Math.round(b)).join(', ')}]
                          </div>
                        </div>
                      </div>

                      {/* 3-State Plate Presentation: Recognized / Localized Unreadable / Not Detected */}
                      <div className="text-right">
                        {isRecognized ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-mono font-bold text-xs tracking-wider">
                              <span>{vehicle.plate!.text}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyPlate(vehicle.plate!.text);
                                }}
                                className="p-0.5 rounded hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-pointer transition-colors"
                                title="Copy Plate to Clipboard"
                              >
                                {copiedPlate === vehicle.plate!.text ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center justify-end">
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  vehicle.plate!.confidence >= 0.85
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : vehicle.plate!.confidence >= 0.65
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                }`}
                              >
                                <span>{vehicle.plate!.confidence >= 0.85 ? '🟢' : vehicle.plate!.confidence >= 0.65 ? '🟡' : '🔴'}</span>
                                <span>OCR: {(vehicle.plate!.confidence * 100).toFixed(0)}%</span>
                              </span>
                            </div>
                          </div>
                        ) : hasPlate ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono font-medium text-[10px]">
                              Localized (Unreadable)
                            </span>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Region Conf: {(vehicle.plate!.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-400/10 text-zinc-500 dark:text-zinc-400 font-mono text-[10px]">
                            Plate Not Detected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Structured Output Contract & Export Bar */}
          <div className="rounded-3xl p-5 sm:p-6 gw-panel shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-[#1A1815] dark:text-white font-mono">
                Structured Telemetry &amp; Export
              </h3>

              {/* Action Pills */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={copyJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-[#1A1815] text-white dark:bg-white/10 dark:hover:bg-white/20 transition-all cursor-pointer shadow-xs"
                  title="Copy JSON Payload"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'JSON'}</span>
                </button>

                <button
                  onClick={downloadCsv}
                  disabled={!imageResult && !videoResult}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer shadow-xs ${
                    !imageResult && !videoResult
                      ? 'opacity-40 cursor-not-allowed bg-black/5 dark:bg-white/5 text-zinc-500'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title="Download CSV Table"
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  <span>CSV</span>
                </button>

                {imageResult?.annotated_image && (
                  <button
                    onClick={downloadAnnotatedImage}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all cursor-pointer shadow-xs"
                    title="Download Annotated Image"
                  >
                    <Download className="w-3 h-3" />
                    <span>Image</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0A0A0C] text-[#FAF8F5] border border-black/20 dark:border-white/10 text-xs font-mono overflow-x-auto max-h-56 shadow-inner">
              <pre className="text-emerald-400 whitespace-pre">
                {JSON.stringify(activeJsonContract, null, 2)}
              </pre>
            </div>

            {/* Jump to History Job Link */}
            {activeJobId && (
              <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-mono">Job Record Saved:</span>
                <Link
                  href={`/app/history/${activeJobId}`}
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  <span>Open in Detection History</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Drawer Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl p-6 bg-[#FAF8F5] dark:bg-[#111318] border border-[#C7BBA5] dark:border-white/15 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-[#C7BBA5]/50 dark:border-white/10">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-lg text-[#1A1815] dark:text-white">
                  Recognition History
                </h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* History Items Listing with overflow-y-auto */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
              {historyLoading ? (
                <div className="text-center py-10 text-zinc-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs font-mono">Retrieving authenticated records from database...</p>
                </div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <Scan className="w-10 h-10 mx-auto mb-2 text-zinc-400 opacity-50" />
                  <p className="text-sm font-semibold">No recognition history found</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Execute an image or video inference to persist records.
                  </p>
                </div>
              ) : (
                historyItems.map((item) => (
                  <div
                    key={item.job_id}
                    onClick={() => loadPastJob(item.job_id)}
                    className="p-4 rounded-2xl bg-white/70 dark:bg-white/[0.04] border border-[#C7BBA5]/60 dark:border-white/10 hover:border-emerald-500 transition-all flex items-center justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold font-mono text-[#1A1815] dark:text-white">
                          {item.media_type.toUpperCase()} JOB
                        </span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            item.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {new Date(item.created_at).toLocaleString()} • {item.processing_time_ms ?? '0'} ms
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {item.vehicle_count} Vehicles
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {item.plate_count} Plates
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification when a plate is copied */}
      {copiedPlate && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1A1815] text-white dark:bg-white dark:text-black px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-white/10 dark:border-black/10 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>
            Plate <span className="font-mono text-[#EA580C] underline font-extrabold">{copiedPlate}</span> copied to clipboard!
          </span>
        </div>
      )}
    </div>
  );
}
