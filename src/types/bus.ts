// src/types/bus.ts
// v4 階段 1 — 校車系統的 TS 型別

export type WeekValue = '1620' | '1800' | null;

// 對應後端 GET /api/admin/bus/morning 跟 /afternoon 的 row schema
// 屬性名跟後端 SQL alias 一樣(中文),這樣 fetch 進來不用 transform
export interface BusStudentRow {
  _student_id: number;
  _bus_id: number;
  序號: number;
  年級: string | null;
  姓名: string;
  電話: string | null;
  接送位置: string | null;
  上車時間: string | null;
  星期一: string;
  星期二: string;
  星期三: string;
  星期四: string;
  星期五: string;
  路線: string | null;
  交通公司: string | null;
  '司機/電話': string | null;
  車號: string | null;
  帳號: string | null;
  密碼: string | null;
  // 放學表才有:
  '1620到站時間'?: string | null;
  '1800到站時間'?: string | null;
}

export interface BusInfo {
  id: number;
  bus_name: string;
  pickup_time: string | null;
  company: string | null;
  driver_phone: string | null;
  plate_number: string | null;
  account_id: string | null;
  account_pass: string | null;
}

export interface AuditLogRow {
  id: number;
  action: 'update' | 'create' | 'delete';
  changed_at: string;
  student_id: number;
  student_name: string | null;
  school_class: string | null;
  admin_id: number;
  admin_name: string | null;
}

// 前端送回後端的更新 payload — 全部 optional,只送有改的
export interface UpdateStudentPayload {
  parent_phone?: string | null;
  pickup_location?: string | null;
  bus_id?: number;
  dropoff_1620?: string | null;
  dropoff_1800?: string | null;
  dismissal_mon?: WeekValue;
  dismissal_tue?: WeekValue;
  dismissal_wed?: WeekValue;
  dismissal_thu?: WeekValue;
  dismissal_fri?: WeekValue;
}

// Tab 切換用
export type BusDirection = 'morning' | 'afternoon';

// 隱藏姓名工具函式
export function maskName(name: string): string {
  if (!name) return '';
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}○`;
  return `${name[0]}○${name.slice(-1)}`;
}
