// src/lib/api.ts
import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: BASE, timeout: 10000 });

// ── Types ────────────────────────────────────────────────────
export interface Worker {
  id: number;
  name: string;
  phone: string;
  is_active: number;
  latitude: number | null;
  longitude: number | null;
  last_location_at: string | null;
  attendance_id: number | null;
  start_time: string | null;
  end_time: string | null;
  is_late: number;
  is_online: number;
}

export interface Customer {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface AttendanceLog {
  id: number;
  worker_id: number;
  start_time: string;
  end_time: string | null;
  is_late: number;
  late_minutes: number;
  work_date: string;
}

export interface DashboardStats {
  today_jobs: number;
  month_records: number;
  total_customers: number;
  online_workers: number;
}

// ── Workers ──────────────────────────────────────────────────
export const getWorkers = async (): Promise<Worker[]> => {
  const { data } = await api.get('/api/workers');
  return data.data;
};

// ── Location ─────────────────────────────────────────────────
export const getLatestLocations = async () => {
  const { data } = await api.get('/api/location/latest');
  return data.data as Worker[];
};

export const updateLocation = async (payload: {
  worker_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
}) => {
  await api.post('/api/location/update', payload);
};

// ── Attendance ───────────────────────────────────────────────
export const startWork = async (payload: {
  worker_id: number;
  latitude?: number;
  longitude?: number;
}) => {
  const { data } = await api.post('/api/attendance/start', payload);
  return data.data as AttendanceLog & { is_late: boolean; late_minutes: number };
};

export const endWork = async (worker_id: number) => {
  const { data } = await api.post('/api/attendance/end', { worker_id });
  return data.data;
};

export const getTodayAttendance = async (worker_id: number) => {
  const { data } = await api.get(`/api/attendance/today/${worker_id}`);
  return data.data as AttendanceLog | null;
};

// ── Job Records ──────────────────────────────────────────────
export const recordJob = async (payload: {
  worker_id: number;
  type: 'arrived' | 'left';
  latitude: number;
  longitude: number;
  note?: string;
}) => {
  const { data } = await api.post('/api/job/record', payload);
  return data.data;
};

// ── Stats ────────────────────────────────────────────────────
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const { data } = await api.get('/api/stats/dashboard');
  return data.data;
};

export const getWorkerStats = async (worker_id: number) => {
  const { data } = await api.get(`/api/stats/worker/${worker_id}`);
  return data.data;
};

// ── Customers ─────────────────────────────────────────────────
export const getCustomers = async (): Promise<Customer[]> => {
  const { data } = await api.get('/api/customers');
  return data.data;
};
