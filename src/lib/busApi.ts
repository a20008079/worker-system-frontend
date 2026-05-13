// src/lib/busApi.ts
// v4 階段 1 — 校車系統 API 封裝
// 對齊既有風格:用原生 fetch + localStorage('token') + Bearer
// 跟現有 admin/page.tsx, ParentMapView.tsx 完全一致

import type {
  BusStudentRow, BusInfo, AuditLogRow, UpdateStudentPayload, BusDirection,
} from '@/types/bus';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const token = () => localStorage.getItem('token') || '';
const H = () => ({
  Authorization: `Bearer ${token()}`,
  'Content-Type': 'application/json',
});

async function handleResponse<T>(r: Response): Promise<T> {
  if (r.status === 401) {
    // session 失效,跳回登入頁
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
