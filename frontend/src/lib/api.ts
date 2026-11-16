/**
 * API Client Abstraction for communication with FastAPI Backend
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://multi-class-vehicle-localization-and.onrender.com/api/v1'
    : 'http://localhost:8000/api/v1');

export interface FileUploadResponse {
  id: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_by_user_id?: string | null;
  created_at: string;
}

export interface LicensePlateResult {
  text: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface VehicleResult {
  type: string;
  confidence: number;
  bbox: [number, number, number, number];
  plate?: LicensePlateResult | null;
}

export interface RecognitionResponse {
  job_id: string;
  file_id: string;
  filename?: string | null;
  status: 'COMPLETED' | 'FAILED' | string;
  processing_time_ms: number;
  image_width: number;
  image_height: number;
  vehicles: VehicleResult[];
  unassociated_plates?: LicensePlateResult[];
  annotated_image?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface VideoFrameResult {
  frame_index: number;
  timestamp_seconds: number;
  width: number;
  height: number;
  vehicles: VehicleResult[];
}

export interface VideoRecognitionResponse {
  job_id: string;
  file_id: string;
  filename?: string | null;
  status: 'COMPLETED' | 'FAILED' | string;
  processing_time_ms: number;
  video_fps: number;
  total_frames: number;
  sampled_frames_count: number;
  duration_seconds: number;
  video_width: number;
  video_height: number;
  frames: VideoFrameResult[];
  error_message?: string | null;
  created_at: string;
}

export interface RecognitionHistoryItem {
  job_id: string;
  media_type: 'image' | 'video' | string;
  media_url: string;
  filename?: string | null;
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING' | string;
  processing_time_ms?: number | null;
  error_message?: string | null;
  vehicle_count: number;
  plate_count: number;
  plates?: string[];
  vehicle_types?: string[];
  created_at: string;
}

export interface RecognitionHistoryResponse {
  items: RecognitionHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardSummary {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  processing_jobs: number;
  total_vehicles_detected: number;
  total_plates_detected: number;
  recognized_plates: number;
  image_jobs: number;
  video_jobs: number;
  average_processing_time_ms: number | null;
  success_rate: number;
}

export interface ActivityTimelineItem {
  date: string;
  day_name: string;
  total_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  total_vehicles: number;
}

export interface VehicleClassDistributionItem {
  vehicle_class: string;
  count: number;
  percentage: number;
}

export interface DashboardActivityItem {
  job_id: string;
  media_type: 'image' | 'video' | string;
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING' | string;
  created_at: string;
  completed_at?: string | null;
  vehicle_count: number;
  recognized_plate_count: number;
  error_message?: string | null;
}

export interface DashboardOverviewResponse {
  summary: DashboardSummary;
  activity_timeline: ActivityTimelineItem[];
  vehicle_distribution: VehicleClassDistributionItem[];
  recent_jobs: DashboardActivityItem[];
  generated_at: string;
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('visionplate_token') || localStorage.getItem('alpr_auth_token')
      : null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('visionplate_auth_session');
      localStorage.removeItem('visionplate_token');
      window.dispatchEvent(new Event('visionplate_auth_change'));
    }
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData.error?.message ||
      errorData.detail ||
      `API error: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export async function checkBackendHealth(): Promise<{ status: string; version: string }> {
  return fetchApi<{ status: string; version: string }>('/health');
}

export async function uploadFile(file: File): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return fetchApi<FileUploadResponse>('/files/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function recognizeImage(fileId: string): Promise<RecognitionResponse> {
  return fetchApi<RecognitionResponse>('/recognition/images', {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId }),
  });
}

export async function recognizeVideo(fileId: string): Promise<VideoRecognitionResponse> {
  return fetchApi<VideoRecognitionResponse>('/recognition/videos', {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId }),
  });
}

export async function getVideoJobStatus(jobId: string): Promise<VideoRecognitionResponse> {
  return fetchApi<VideoRecognitionResponse>(`/recognition/videos/${encodeURIComponent(jobId)}`);
}

export interface RecognitionHistoryFilterParams {
  page?: number;
  page_size?: number;
  search?: string;
  media_type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  vehicle_class?: string;
}

export async function getRecognitionHistory(
  params?: RecognitionHistoryFilterParams
): Promise<RecognitionHistoryResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search && params.search.trim()) query.set('search', params.search.trim());
  if (params?.media_type && params.media_type !== 'all') query.set('media_type', params.media_type);
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.vehicle_class && params.vehicle_class !== 'all') query.set('vehicle_class', params.vehicle_class);

  const qs = query.toString();
  return fetchApi<RecognitionHistoryResponse>(`/recognition/history${qs ? `?${qs}` : ''}`);
}

export async function getRecognitionJobDetail(
  jobId: string
): Promise<RecognitionResponse | VideoRecognitionResponse> {
  return fetchApi<RecognitionResponse | VideoRecognitionResponse>(
    `/recognition/history/${encodeURIComponent(jobId)}`
  );
}

export function getFileContentUrl(fileId: string): string {
  return `${API_BASE_URL}/files/${encodeURIComponent(fileId)}/content`;
}

export async function fetchAuthenticatedBlob(url: string): Promise<Blob> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('visionplate_token') || localStorage.getItem('alpr_auth_token')
      : null;

  const fullUrl = url.startsWith('http')
    ? url
    : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(fullUrl, {
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch media file: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}

export async function getDashboardOverview(
  days: number = 7,
  recentLimit: number = 5
): Promise<DashboardOverviewResponse> {
  const cacheKey = `vp_dashboard_${days}_${recentLimit}`;
  const cacheTtl = 30_000; // 30 seconds

  // Return cached data immediately if still fresh
  if (typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < cacheTtl) return data as DashboardOverviewResponse;
      }
    } catch {}
  }

  const query = new URLSearchParams({
    days: String(days),
    recent_limit: String(recentLimit),
  });
  const data = await fetchApi<DashboardOverviewResponse>(`/dashboard/overview?${query.toString()}`);

  // Cache fresh result
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  }

  return data;
}

export interface DashboardStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  processing_jobs: number;
  total_vehicles_detected: number;
  total_plates_detected: number;
  recognized_plates: number;
  image_jobs: number;
  video_jobs: number;
  success_rate: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchApi<DashboardStats>('/dashboard/stats');
}

export interface AnalyticsPeriod {
  start_date: string;
  end_date: string;
  days?: number | null;
  timezone: string;
}

export interface AnalyticsSummary {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  total_vehicles: number;
  total_plates: number;
  recognized_plates: number;
  unreadable_plates: number;
  success_rate: number | null;
  average_latency_ms: number | null;
}

export interface AnalyticsTimelinePoint {
  date: string;
  day_name: string;
  total_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  total_vehicles: number;
}

export interface AnalyticsVehicleClass {
  vehicle_class: string;
  count: number;
  percentage: number;
}

export interface AnalyticsJurisdiction {
  code: string;
  name: string;
  count: number;
  share: number;
}

export interface AnalyticsPlateMetrics {
  total_detected: number;
  recognized: number;
  unreadable: number;
  recognition_rate: number | null;
  top_jurisdictions: AnalyticsJurisdiction[];
}

export interface AnalyticsMediaBreakdown {
  image_jobs: number;
  video_jobs: number;
  image_vehicles: number;
  video_vehicles: number;
  image_completed: number;
  image_failed: number;
  video_completed: number;
  video_failed: number;
  image_avg_latency_ms: number | null;
  video_avg_latency_ms: number | null;
}

export interface AnalyticsPerformance {
  avg_latency_ms: number | null;
  min_latency_ms: number | null;
  max_latency_ms: number | null;
  fast_count: number;
  normal_count: number;
  heavy_count: number;
}

export interface AnalyticsHourlyBucket {
  hour: string;
  count: number;
}

export interface AnalyticsWeekdayBucket {
  day: string;
  count: number;
}

export interface AnalyticsTimeDistribution {
  hourly: AnalyticsHourlyBucket[];
  weekday: AnalyticsWeekdayBucket[];
}

export interface AnalyticsOverviewResponse {
  period: AnalyticsPeriod;
  summary: AnalyticsSummary;
  activity_timeline: AnalyticsTimelinePoint[];
  vehicle_distribution: AnalyticsVehicleClass[];
  plate_analytics: AnalyticsPlateMetrics;
  media_breakdown: AnalyticsMediaBreakdown;
  performance: AnalyticsPerformance;
  time_distribution: AnalyticsTimeDistribution;
  generated_at: string;
}

export interface AnalyticsFilterParams {
  days?: number;
  start_date?: string;
  end_date?: string;
  media_type?: string;
  status?: string;
}

export async function getAnalyticsOverview(
  params?: AnalyticsFilterParams
): Promise<AnalyticsOverviewResponse> {
  const query = new URLSearchParams();
  if (params?.days != null) query.set('days', String(params.days));
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.media_type && params.media_type !== 'all') query.set('media_type', params.media_type);
  if (params?.status && params.status !== 'all') query.set('status', params.status);

  const qs = query.toString();
  return fetchApi<AnalyticsOverviewResponse>(`/analytics/overview${qs ? `?${qs}` : ''}`);
}

export type ReportType =
  | 'recognition_summary'
  | 'vehicle_distribution'
  | 'plate_recognition'
  | 'processing_performance'
  | 'media_breakdown'
  | 'custom_range';

export type ReportFormat = 'pdf' | 'csv' | 'json';

export interface ReportFilterParams {
  days?: number;
  start_date?: string;
  end_date?: string;
  media_type?: string;
  status?: string;
  vehicle_class?: string;
}

export interface ReportTemplateInfo {
  id: ReportType;
  title: string;
  description: string;
  category: string;
  supported_formats: string[];
}

export interface ReportOverviewResponse {
  templates: ReportTemplateInfo[];
  total_user_records: number;
  earliest_record_date?: string | null;
  latest_record_date?: string | null;
  supported_formats: string[];
  generated_at: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'percentage' | 'badge';
}

export interface ReportPreviewResponse {
  report_id: string;
  report_title: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  timezone: string;
  applied_filters: Record<string, any>;
  summary_kpis: Record<string, any>;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  total_rows: number;
  definitions: Record<string, string>;
  caveats: string[];
  generated_at: string;
}

export interface ReportPreviewRequest {
  report_type: ReportType;
  filters?: ReportFilterParams;
}

export interface ReportExportRequest {
  report_type: ReportType;
  format: ReportFormat;
  filters?: ReportFilterParams;
}

export async function getReportsOverview(): Promise<ReportOverviewResponse> {
  return fetchApi<ReportOverviewResponse>('/reports/overview');
}

export async function generateReportPreview(
  request: ReportPreviewRequest
): Promise<ReportPreviewResponse> {
  return fetchApi<ReportPreviewResponse>('/reports/preview', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function exportReportBlob(
  request: ReportExportRequest
): Promise<{ blob: Blob; filename: string }> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('visionplate_token') || localStorage.getItem('alpr_auth_token')
      : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/reports/export`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Export failed: ${response.status} ${response.statusText}`);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  let filename = `visionplate_${request.report_type}.${request.format}`;
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
  if (filenameMatch && filenameMatch[1]) {
    filename = filenameMatch[1];
  }

  const blob = await response.blob();
  return { blob, filename };
}

// ---------------------------------------------------------------------------
// Persistent Saved Reports API
// ---------------------------------------------------------------------------

export interface ReportGenerateRequest {
  report_type: ReportType;
  format: ReportFormat;
  title?: string;
  folder_id?: string;
  filters?: ReportFilterParams;
}

export interface SavedReportResponse {
  id: string;
  user_id?: string | null;
  folder_id?: string | null;
  title: string;
  report_type: string;
  file_format: string;
  file_size_bytes: number;
  parameters?: Record<string, any> | null;
  report_data?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface SavedReportListResponse {
  items: SavedReportResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListSavedReportsParams {
  page?: number;
  page_size?: number;
  report_type?: string;
  format?: string;
  folder_id?: string;
  is_uncategorized?: boolean;
  search?: string;
}

export async function generateAndPersistReport(
  request: ReportGenerateRequest
): Promise<SavedReportResponse> {
  return fetchApi<SavedReportResponse>('/reports/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function listSavedReports(
  params?: ListSavedReportsParams
): Promise<SavedReportListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.page_size) query.set('page_size', params.page_size.toString());
  if (params?.report_type && params.report_type !== 'all') query.set('report_type', params.report_type);
  if (params?.format && params.format !== 'all') query.set('format', params.format);
  if (params?.folder_id) query.set('folder_id', params.folder_id);
  if (params?.is_uncategorized !== undefined) query.set('is_uncategorized', params.is_uncategorized.toString());
  if (params?.search && params.search.trim()) query.set('search', params.search.trim());

  const qs = query.toString();
  return fetchApi<SavedReportListResponse>(`/reports/saved${qs ? `?${qs}` : ''}`);
}

export async function downloadSavedReportBlob(
  reportId: string
): Promise<{ blob: Blob; filename: string }> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('visionplate_token') || localStorage.getItem('alpr_auth_token')
      : null;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/reports/${encodeURIComponent(reportId)}/download`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Download failed: ${response.status} ${response.statusText}`);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  let filename = `visionplate_report_${reportId}`;
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
  if (filenameMatch && filenameMatch[1]) {
    filename = filenameMatch[1];
  }

  const blob = await response.blob();
  return { blob, filename };
}

export async function deleteSavedReport(
  reportId: string
): Promise<{ status: string; message: string; report_id: string }> {
  return fetchApi<{ status: string; message: string; report_id: string }>(
    `/reports/${encodeURIComponent(reportId)}`,
    {
      method: 'DELETE',
    }
  );
}

// ---------------------------------------------------------------------------
// Report Folder Management API
// ---------------------------------------------------------------------------

export interface FolderResponse {
  id: string;
  user_id?: string | null;
  name: string;
  description?: string | null;
  color: string;
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface FolderListResponse {
  items: FolderResponse[];
  total: number;
}

export interface FolderCreateRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface FolderUpdateRequest {
  name?: string;
  description?: string;
  color?: string;
}

export interface ReportMoveRequest {
  folder_id: string | null;
}

export interface ReportMoveResponse {
  status: string;
  report_id: string;
  folder_id?: string | null;
  message: string;
}

export async function listFolders(): Promise<FolderListResponse> {
  return fetchApi<FolderListResponse>('/reports/folders');
}

export async function createFolder(payload: FolderCreateRequest): Promise<FolderResponse> {
  return fetchApi<FolderResponse>('/reports/folders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getFolder(folderId: string): Promise<FolderResponse> {
  return fetchApi<FolderResponse>(`/reports/folders/${encodeURIComponent(folderId)}`);
}

export async function updateFolder(
  folderId: string,
  payload: FolderUpdateRequest
): Promise<FolderResponse> {
  return fetchApi<FolderResponse>(`/reports/folders/${encodeURIComponent(folderId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteFolder(
  folderId: string
): Promise<{ status: string; message: string; folder_id: string }> {
  return fetchApi<{ status: string; message: string; folder_id: string }>(
    `/reports/folders/${encodeURIComponent(folderId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function moveReportToFolder(
  reportId: string,
  folderId: string | null
): Promise<ReportMoveResponse> {
  return fetchApi<ReportMoveResponse>(`/reports/${encodeURIComponent(reportId)}/folder`, {
    method: 'PATCH',
    body: JSON.stringify({ folder_id: folderId }),
  });
}

// ---------------------------------------------------------------------------
// User Profile API
// ---------------------------------------------------------------------------

export interface UserIdentityItem {
  provider: string;
  provider_email?: string | null;
  created_at?: string | null;
}

export interface UserProfileResponse {
  id: string;
  username?: string | null;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  email_verified: boolean;
  role: string;
  created_at?: string | null;
  identities?: UserIdentityItem[];
}

export interface UserUpdatePayload {
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

export async function fetchCurrentUserProfile(): Promise<UserProfileResponse> {
  return fetchApi<UserProfileResponse>('/users/me');
}

export async function updateCurrentUserProfile(
  payload: UserUpdatePayload
): Promise<UserProfileResponse> {
  return fetchApi<UserProfileResponse>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function changeUserPassword(payload: {
  current_password?: string;
  new_password: string;
}): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/users/me/password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
