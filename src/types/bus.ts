// src/types/bus.ts
// v4 階段 1 — 校車系統的 TS 型別
// 階段 3a — BusInfo 加 skip_1620 / van_only + SystemConfig 型別
// 階段 3b — 新增 BusStop 型別 (站牌管理)

export type WeekValue = '1620' | '1800' | null;

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
  skip_1620: boolean;
  van_only: boolean;
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

export type BusDirection = 'morning' | 'afternoon';

export function maskName(name: string): string {
  if (!name) return '';
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}○`;
  return `${name[0]}○${name.slice(-1)}`;
}

// ============================================================
// 階段 3a 新增:系統設定 (車隊參數)
// ============================================================

export interface SystemConfigRow {
  config_key: string;
  config_value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type ConfigKey =
  | 'FLEET_BIG_BUS'
  | 'FLEET_VAN'
  | 'BIG_BUS_CAP_MORNING'
  | 'BIG_BUS_CAP_AFTERNOON'
  | 'VAN_CAP'
  | 'BIG_BUS_THRESHOLD';

// ============================================================
// 階段 3b 新增:站牌管理 (Bus Stops)
// ============================================================

export interface BusStop {
  id: number;
  bus_id: number;
  stop_name: string;
  stop_order: number | null;     // null = 未排序
  latitude: number | null;       // null = 未設座標
  longitude: number | null;
  address: string | null;
  pickup_time: string | null;
  van_only_stop: boolean;        // 這次新增:站牌等級車種限制(這個站巷子太小只能廂型車進,跟 buses.van_only 路線等級的限制分開)
}

// 後端 import-from-students 回傳格式
export interface ImportStopsResult {
  imported: number;
  skipped:  number;
  message:  string;
}
