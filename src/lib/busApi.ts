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
