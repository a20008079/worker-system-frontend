// src/lib/busApi.ts
// v4 階段 1 — 校車系統 API 封裝
// 階段 3a — 加 fetchConfig / updateConfig
// 階段 3b — 加站牌管理 API (stops)

import type {
  BusStudentRow, BusInfo, AuditLogRow, UpdateStudentPayload, BusDirection,
  SystemConfigRow, BusStop, ImportStopsResult,
} from '@/types/bus';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const token = () => localStorage.getItem('token') || '';
const H = () => ({
  Authorization: `Bearer ${token()}`,
  'Content-Type': 'application/json',
});

async function handleResponse<T>(r: Response): Promise<T> {
  if (r.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.href = '/admin/login';
    }
    throw new Error('未登入');
  }
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const d = await r.json();
      if (d?.error) msg = d.error;
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export async function fetchBusTable(direction: BusDirection): Promise<BusStudentRow[]> {
  const r = await fetch(`${API}/api/admin/bus/${direction}`, { headers: H() });
  const d = await handleResponse<{ rows: BusStudentRow[] }>(r);
  return d.rows;
}

export async function fetchBuses(): Promise<BusInfo[]> {
  const r = await fetch(`${API}/api/admin/bus/buses`, { headers: H() });
  const d = await handleResponse<{ rows: BusInfo[] }>(r);
  return d.rows;
}

export async function updateStudent(
  studentId: number,
  payload: UpdateStudentPayload
): Promise<void> {
  const r = await fetch(`${API}/api/admin/bus/student/${studentId}`, {
    method: 'PUT',
    headers: H(),
    body: JSON.stringify(payload),
  });
  await handleResponse<{ ok: boolean }>(r);
}

export async function updateBus(
  busId: number,
  payload: Partial<BusInfo>
): Promise<void> {
  const r = await fetch(`${API}/api/admin/bus/bus/${busId}`, {
    method: 'PUT',
    headers: H(),
    body: JSON.stringify(payload),
  });
  await handleResponse<{ ok: boolean }>(r);
}

export async function fetchAuditLog(limit = 100): Promise<AuditLogRow[]> {
  const r = await fetch(`${API}/api/admin/bus/audit?limit=${limit}`, { headers: H() });
  const d = await handleResponse<{ rows: AuditLogRow[] }>(r);
  return d.rows;
}

// ============================================================
// 階段 3a:系統設定
// ============================================================

export async function fetchConfig(): Promise<SystemConfigRow[]> {
  const r = await fetch(`${API}/api/admin/config`, { headers: H() });
  const d = await handleResponse<{ configs: SystemConfigRow[] }>(r);
  return d.configs;
}

export async function updateConfig(
  configs: Array<{ key: string; value: string }>
): Promise<SystemConfigRow[]> {
  const r = await fetch(`${API}/api/admin/config`, {
    method: 'PUT',
    headers: H(),
    body: JSON.stringify({ configs }),
  });
  const d = await handleResponse<{ configs: SystemConfigRow[]; updated: number }>(r);
  return d.configs;
}

// ============================================================
// 階段 3b:站牌管理
// ============================================================

export async function fetchStops(busId: number): Promise<BusStop[]> {
  const r = await fetch(`${API}/api/admin/buses/${busId}/stops`, { headers: H() });
  const d = await handleResponse<{ stops: BusStop[] }>(r);
  return d.stops;
}

export async function createStop(
  busId: number,
  payload: Partial<Omit<BusStop, 'id' | 'bus_id'>> & { stop_name: string }
): Promise<number> {
  const r = await fetch(`${API}/api/admin/buses/${busId}/stops`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify(payload),
  });
  const d = await handleResponse<{ ok: boolean; id: number }>(r);
  return d.id;
}

export async function updateStop(
  stopId: number,
  payload: Partial<Omit<BusStop, 'id' | 'bus_id'>>
): Promise<BusStop> {
  const r = await fetch(`${API}/api/admin/stops/${stopId}`, {
    method: 'PUT',
    headers: H(),
    body: JSON.stringify(payload),
  });
  const d = await handleResponse<{ stop: BusStop }>(r);
  return d.stop;
}

export async function deleteStop(stopId: number): Promise<void> {
  const r = await fetch(`${API}/api/admin/stops/${stopId}`, {
    method: 'DELETE',
    headers: H(),
  });
  await handleResponse<{ ok: boolean }>(r);
}

export async function reorderStops(busId: number, orderedIds: number[]): Promise<void> {
  const r = await fetch(`${API}/api/admin/buses/${busId}/stops/reorder`, {
    method: 'PUT',
    headers: H(),
    body: JSON.stringify({ order: orderedIds }),
  });
  await handleResponse<{ ok: boolean }>(r);
}

export async function importStopsFromStudents(busId: number): Promise<ImportStopsResult> {
  const r = await fetch(`${API}/api/admin/buses/${busId}/stops/import-from-students`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({}),
  });
  return await handleResponse<ImportStopsResult>(r);
}
// ============================================================
// 階段 3c-1:Google 表單匯入 (student-import staging)
// 貼到 src/lib/busApi.ts 檔案末尾
// ============================================================

// 前端解析好的一列 (對應 staging 表欄位)
export interface StudentImportRow {
  row_num: number;
  timestamp_raw: string;
  class_name: string;
  seat_no: string;
  student_name: string;
  parent_name: string;
  parent_phone: string;
  home_address: string;
  ride_period: string;
  pickup_stop: string;
  dropoff_stop: string;
  mon_time: string;
  tue_time: string;
  wed_time: string;
  thu_time: string;
  fri_time: string;
  note: string;
}

export interface ImportQuality {
  short_addr: number;
  phone_slash: number;
  empty_stop: number;
  dup_seat: number;
}

export interface ImportUploadResult {
  ok: boolean;
  batch_id: string;
  total: number;
  quality: ImportQuality;
}

export interface ImportBatch {
  batch_id: string;
  total: number;
  applied_count: number;
  created_at: string;
}

// staging 表一列 (含 server 算好的 quality_flags / 處理狀態)
export interface StagedRowServer extends StudentImportRow {
  id: number;
  quality_flags: string | null;
  match_status: string;
  matched_student_id: number | null;
  geo_lat: number | null;
  geo_lng: number | null;
  recommended_bus_id: number | null;
  recommended_stop_id: number | null;
  applied: number;
}

// 上傳解析好的 rows -> 後端寫 staging,回傳 batch_id + 品質統計
export async function uploadStudentImport(
  rows: StudentImportRow[]
): Promise<ImportUploadResult> {
  const r = await fetch(`${API}/api/admin/student-import/upload`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ rows }),
  });
  return await handleResponse<ImportUploadResult>(r);
}

// 列出所有匯入批次
export async function fetchImportBatches(): Promise<ImportBatch[]> {
  const r = await fetch(`${API}/api/admin/student-import/batches`, { headers: H() });
  const d = await handleResponse<{ batches: ImportBatch[] }>(r);
  return d.batches;
}

// 讀某批次明細 (預覽用)
export async function fetchImportBatch(
  batchId: string
): Promise<{ batch_id: string; total: number; quality: ImportQuality; rows: StagedRowServer[] }> {
  const r = await fetch(`${API}/api/admin/student-import/${batchId}`, { headers: H() });
  return await handleResponse<{
    batch_id: string; total: number; quality: ImportQuality; rows: StagedRowServer[];
  }>(r);
}

// 刪某批次 (上傳到一半失敗想重來時用)
export async function deleteImportBatch(batchId: string): Promise<{ ok: boolean; deleted: number }> {
  const r = await fetch(`${API}/api/admin/student-import/${batchId}`, {
    method: 'DELETE',
    headers: H(),
  });
  return await handleResponse<{ ok: boolean; deleted: number }>(r);
}

// ============================================================
// 階段 3c-2:Geocoding
// ============================================================

export interface GeocodeProgress {
  total: number;
  geocoded: number;
  failed: number;
  remaining: number;
}

export interface GeocodeStepResult extends GeocodeProgress {
  ok: boolean;
  step_ok: number;
  step_fail: number;
}

export async function fetchGeocodeStatus(batchId: string): Promise<GeocodeProgress> {
  const r = await fetch(`${API}/api/admin/student-import/${batchId}/geocode-status`, { headers: H() });
  return await handleResponse<GeocodeProgress>(r);
}

export async function geocodeStep(batchId: string, stepSize = 10): Promise<GeocodeStepResult> {
  const r = await fetch(`${API}/api/admin/student-import/${batchId}/geocode-step`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ step_size: stepSize }),
  });
  return await handleResponse<GeocodeStepResult>(r);
}

// 老師手動補座標
export async function setStagingGeo(stagingId: number, lat: number, lng: number): Promise<void> {
  const r = await fetch(`${API}/api/admin/student-import/staging/${stagingId}/geo`, {
    method: 'PUT',
    headers: H(),
    body: JSON.stringify({ lat, lng }),
  });
  await handleResponse<{ ok: boolean }>(r);
}

// ============================================================
// 需求 1:Google 表單歸零重匯
// ============================================================

export interface ApplyImportResult {
  ok: boolean;
  batch_id: string;
  added: number;
  updated: number;
  failed: number;
  nobus: number;
  errors: string[];
  unmatched: Array<{
    row_num: number;
    student_name: string;
    pickup_stop: string;
    dropoff_stop: string;
    parent_phone: string;
  }>;
  summary: string;
}

// 套用:把某批次 staging 資料寫進正式 students 表
export async function applyImportBatch(batchId: string): Promise<ApplyImportResult> {
  const r = await fetch(`${API}/api/admin/student-import/${batchId}/apply`, {
    method: 'POST',
    headers: H(),
  });
  return await handleResponse<ApplyImportResult>(r);
}

export interface ResetSemesterResult {
  ok: boolean;
  deleted_students: number;
  message: string;
}

// 歸零:清空 students + 相關紀錄(保留 buses/drivers/parents)。這是危險操作,呼叫前務必在畫面上做二次確認。
export async function resetSemester(): Promise<ResetSemesterResult> {
  const r = await fetch(`${API}/api/admin/students/reset-semester`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ confirm: 'RESET' }),
  });
  return await handleResponse<ResetSemesterResult>(r);
}
