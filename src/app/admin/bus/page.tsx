'use client';
// src/app/admin/bus/page.tsx
// v4 階段 1 — 校車系統主頁
// 對齊 admin 主頁深色配色 (bg-gray-950/900/800),不額外引入 RumiGo 玻璃擬態

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type Column,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import type {
  BusStudentRow, BusDirection, BusInfo, WeekValue,
} from '@/types/bus';
import { maskName } from '@/types/bus';
import { fetchBusTable, fetchBuses, updateStudent } from '@/lib/busApi';

// ============================================================
// 主頁
// ============================================================
export default function BusAdminPage() {
  const router = useRouter();
  const [direction, setDirection] = useState<BusDirection>('morning');

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') router.push('/admin/login');
  }, [router]);

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')}
            className="text-gray-400 hover:text-white text-sm">‹ 返回</button>
          <div>
            <div className="text-white font-bold text-lg">🚌 校車系統</div>
            <div className="text-gray-500 text-xs">學生 / 路線 / 時段管理</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/admin/bus/buses')}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-bold rounded-xl border border-gray-700 active:scale-95 transition-all">
            🛣️ 路線屬性
          </button>
          <button onClick={() => router.push('/admin/bus/audit')}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-bold rounded-xl border border-gray-700 active:scale-95 transition-all">
            📋 修改紀錄
          </button>
          <ExportButton direction={direction} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
        <TabButton active={direction === 'morning'} onClick={() => setDirection('morning')}>
          🌅 上學
        </TabButton>
        <TabButton active={direction === 'afternoon'} onClick={() => setDirection('afternoon')}>
          🌇 放學
        </TabButton>
      </div>

      {/* 主表 */}
      <BusTable direction={direction} />

      {/* 圖例 */}
      <div className="px-4 py-3 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 bg-gray-900 border-t border-gray-800">
        <span><span className="inline-block w-3 h-3 bg-gray-700 mr-1.5 align-middle rounded-sm"></span>不搭</span>
        {direction === 'morning' ? (
          <span><span className="inline-block w-3 h-3 bg-emerald-700/40 mr-1.5 align-middle rounded-sm"></span>搭</span>
        ) : (
          <>
            <span><span className="inline-block w-3 h-3 bg-blue-700/40 mr-1.5 align-middle rounded-sm"></span>1620</span>
            <span><span className="inline-block w-3 h-3 bg-purple-700/40 mr-1.5 align-middle rounded-sm"></span>1800</span>
          </>
        )}
        <span className="text-gray-600 ml-auto">點格子可切換 / 編輯</span>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}
function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={
        'px-5 py-2 rounded-2xl text-sm font-bold transition-all active:scale-95 ' +
        (active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700')
      }
    >
      {children}
    </button>
  );
}

// ============================================================
// 主表
// ============================================================
interface BusTableProps {
  direction: BusDirection;
}
function BusTable({ direction }: BusTableProps) {
  const [rows, setRows] = useState<BusStudentRow[]>([]);
  const [buses, setBuses] = useState<BusInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ studentId: number; field: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([fetchBusTable(direction), fetchBuses()])
      .then(([rs, bs]) => {
        if (!mounted) return;
        setRows(rs);
        setBuses(bs);
      })
      .catch((e) => console.error(e))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [direction]);

  const reload = useCallback(async () => {
    const rs = await fetchBusTable(direction);
    setRows(rs);
  }, [direction]);

  const columns = useMemo<ColumnDef<BusStudentRow>[]>(() => {
    const base: ColumnDef<BusStudentRow>[] = [
      { id: '序號', header: '序號', accessorFn: (r) => r.序號, size: 50 },
      { id: '年級', header: '年級', accessorFn: (r) => r.年級, size: 60 },
      { id: '姓名', header: '姓名', accessorFn: (r) => r.姓名, size: 80 },
      { id: '隱藏姓名', header: '隱藏姓名', accessorFn: (r) => maskName(r.姓名), size: 80 },
      {
        id: '電話', header: '電話', accessorFn: (r) => r.電話, size: 130,
        cell: (ctx) => <EditableCell ctx={ctx} field="parent_phone"
          editing={editing} setEditing={setEditing} onSaved={reload} />,
      },
      {
        id: '接送位置', header: '接送位置', accessorFn: (r) => r.接送位置, size: 200,
        cell: (ctx) => <EditableCell ctx={ctx} field="pickup_location"
          editing={editing} setEditing={setEditing} onSaved={reload} />,
      },
    ];

    if (direction === 'morning') {
      base.push({ id: '上車時間', header: '上車時間', accessorFn: (r) => r.上車時間, size: 80 });
    } else {
      base.push(
        { id: '1620到站時間', header: '1620到站', accessorFn: (r) => r['1620到站時間'], size: 80 },
        { id: '1800到站時間', header: '1800到站', accessorFn: (r) => r['1800到站時間'], size: 80 },
      );
    }

    const weekDays = ['星期一','星期二','星期三','星期四','星期五'] as const;
    const dismissalFields = ['dismissal_mon','dismissal_tue','dismissal_wed','dismissal_thu','dismissal_fri'] as const;
    weekDays.forEach((day, idx) => {
      base.push({
        id: day, header: day, accessorFn: (r) => r[day], size: 70,
        cell: (ctx) => (
          <WeekDayCell ctx={ctx} direction={direction}
            field={dismissalFields[idx]} onSaved={reload} />
        ),
      });
    });

    base.push(
      {
        id: '路線', header: '路線', accessorFn: (r) => r.路線, size: 130,
        cell: (ctx) => <RouteSelectCell ctx={ctx} buses={buses} onSaved={reload}
          editing={editing} setEditing={setEditing} />,
      },
      { id: '交通公司', header: '交通公司', accessorFn: (r) => r.交通公司, size: 80 },
      { id: '司機/電話', header: '司機/電話', accessorFn: (r) => r['司機/電話'], size: 160 },
      { id: '車號', header: '車號', accessorFn: (r) => r.車號, size: 100 },
      { id: '帳號', header: '帳號', accessorFn: (r) => r.帳號, size: 100 },
      { id: '密碼', header: '密碼', accessorFn: (r) => r.密碼, size: 100 },
    );

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, editing]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnPinning: { left: ['序號', '年級', '姓名', '隱藏姓名'] },
    },
  });

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full animate-spin"
          style={{ border: '3px solid #1f2937', borderTopColor: '#3b82f6' }} />
        <div className="text-sm">載入中…</div>
      </div>
    );
  }

  return (
    <div className="overflow-auto bg-gray-950">
      <table className="border-separate border-spacing-0 text-xs sm:text-sm">
        <thead className="sticky top-0 z-20">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  style={{
                    width: h.getSize(),
                    minWidth: h.getSize(),
                    ...getPinningStyles(h.column, true),
                  }}
                  className="px-2 py-2 text-center font-semibold text-gray-300 bg-gray-900 border-b border-gray-700 whitespace-nowrap"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'bg-gray-900/40' : 'bg-gray-900/10'}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    width: cell.column.getSize(),
                    minWidth: cell.column.getSize(),
                    ...getPinningStyles(cell.column, false, idx),
                  }}
                  className="px-2 py-1.5 border-b border-gray-800 whitespace-nowrap text-gray-200"
                >
                  {flexRender(cell.column.columnDef.cell ?? defaultCell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="p-8 text-center text-gray-500">沒有資料</div>
      )}
      <div className="px-3 py-2 text-xs text-gray-500 bg-gray-900 border-t border-gray-800">
        共 {rows.length} 筆
      </div>
    </div>
  );
}

// ============================================================
// Cell renderers
// ============================================================
function defaultCell(ctx: any) {
  const v = ctx.getValue();
  return <span className="text-gray-300">{v ?? <span className="text-gray-600">—</span>}</span>;
}

interface EditableCellProps {
  ctx: any;
  field: string;
  editing: { studentId: number; field: string } | null;
  setEditing: (v: { studentId: number; field: string } | null) => void;
  onSaved: () => void | Promise<void>;
}
function EditableCell({ ctx, field, editing, setEditing, onSaved }: EditableCellProps) {
  const studentId = ctx.row.original._student_id as number;
  const value = ctx.getValue() as string | null;
  const isEditing = editing?.studentId === studentId && editing?.field === field;

  if (isEditing) {
    return (
      <CellEditor
        initialValue={value ?? ''}
        onCancel={() => setEditing(null)}
        onSave={async (newVal) => {
          await updateStudent(studentId, { [field]: newVal || null } as any);
          setEditing(null);
          await onSaved();
        }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing({ studentId, field })}
      className="w-full text-left px-1.5 py-0.5 rounded text-gray-200 hover:bg-blue-900/30 transition-colors"
    >
      {value || <span className="text-gray-600">—</span>}
    </button>
  );
}

interface WeekDayCellProps {
  ctx: any;
  direction: BusDirection;
  field: 'dismissal_mon'|'dismissal_tue'|'dismissal_wed'|'dismissal_thu'|'dismissal_fri';
  onSaved: () => void | Promise<void>;
}
// 星期欄 — 上學:兩態(搭/不搭),放學:三態循環(1620/1800/不搭)
function WeekDayCell({ ctx, direction, field, onSaved }: WeekDayCellProps) {
  const value = ctx.getValue() as string;
  const studentId = ctx.row.original._student_id as number;
  const notRide = value === '不搭';
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let newVal: WeekValue;
      if (direction === 'morning') {
        // 上學:不搭 ↔ 搭(搭時存 '1620' 當佔位值,SELECT 會顯示為空字串)
        newVal = notRide ? '1620' : null;
      } else {
        // 放學:1620 → 1800 → 不搭 → 1620 …
        newVal = value === '1620' ? '1800'
               : value === '1800' ? null
               : '1620';
      }
      await updateStudent(studentId, { [field]: newVal } as any);
      await onSaved();
    } catch (e) {
      console.error(e);
      alert('更新失敗:' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={
        'w-full px-1.5 py-1 rounded text-center text-xs font-semibold transition-all ' +
        (busy ? 'opacity-50 ' : '') +
        (notRide
          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          : value === '1620'
            ? 'bg-blue-700/40 text-blue-200 hover:bg-blue-700/60 border border-blue-700/60'
            : value === '1800'
              ? 'bg-purple-700/40 text-purple-200 hover:bg-purple-700/60 border border-purple-700/60'
              : 'bg-emerald-700/30 text-emerald-200 hover:bg-emerald-700/50 border border-emerald-700/50')
      }
    >
      {notRide ? '不搭' : (value || '搭')}
    </button>
  );
}

// ============================================================
// CellEditor — Enter 存 / Esc 取消
// ============================================================
interface CellEditorProps {
  initialValue: string;
  onSave: (newValue: string) => void | Promise<void>;
  onCancel: () => void;
}
function CellEditor({ initialValue, onSave, onCancel }: CellEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    if (value === initialValue) { onCancel(); return; }
    setSaving(true);
    try {
      await onSave(value);
    } catch (e) {
      console.error(e);
      alert('儲存失敗:' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onCancel();
      }}
      disabled={saving}
      className="w-full px-1.5 py-0.5 bg-gray-800 border border-blue-600 rounded outline-none focus:ring-1 focus:ring-blue-500 text-gray-100"
    />
  );
}

// ============================================================
// 匯出按鈕(內嵌)
// ============================================================
function ExportButton({ direction }: { direction: BusDirection }) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const rows = await fetchBusTable(direction);
      const sheet = direction === 'morning'
        ? buildMorningSheet(rows)
        : buildAfternoonSheet(rows);
      const wb = XLSX.utils.book_new();
      const sheetName = direction === 'morning' ? '上學表' : '兩段放學';
      XLSX.utils.book_append_sheet(wb, sheet, sheetName);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      XLSX.writeFile(wb, `校車_${sheetName}_${dateStr}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('匯出失敗:' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 text-white text-sm font-bold rounded-xl active:scale-95 transition-all"
    >
      {busy ? '匯出中…' : '📥 匯出 Excel'}
    </button>
  );
}

function buildMorningSheet(rows: BusStudentRow[]) {
  const data: any[][] = [
    [
      '序號','年級','姓名','姓名(隱藏)','電話','接送位置','上車時間',
      '星期一','星期二','星期三','星期四','星期五',
      '路線','交通公司','司機/電話','車號','帳號','密碼',
    ],
  ];
  rows.forEach((r) => {
    data.push([
      r.序號, r.年級, r.姓名, maskName(r.姓名),
      r.電話, r.接送位置, r.上車時間,
      r.星期一 || '', r.星期二 || '', r.星期三 || '', r.星期四 || '', r.星期五 || '',
      r.路線, r.交通公司, r['司機/電話'], r.車號, r.帳號, r.密碼,
    ]);
  });
  return XLSX.utils.aoa_to_sheet(data);
}

function buildAfternoonSheet(rows: BusStudentRow[]) {
  const data: any[][] = [
    [
      '序號','年級','姓名','姓名(隱藏)','電話','接送位置',
      '1620到站時間','1800到站時間',
      '星期一','星期二','星期三','星期四','星期五',
      '路線','交通公司','司機/電話','車號','帳號','密碼',
    ],
  ];
  rows.forEach((r) => {
    data.push([
      r.序號, r.年級, r.姓名, maskName(r.姓名),
      r.電話, r.接送位置,
      r['1620到站時間'] ?? '', r['1800到站時間'] ?? '',
      r.星期一, r.星期二, r.星期三, r.星期四, r.星期五,
      r.路線, r.交通公司, r['司機/電話'], r.車號, r.帳號, r.密碼,
    ]);
  });
  return XLSX.utils.aoa_to_sheet(data);
}

// ============================================================
// Pinning styles — 深色版,有右側陰影
// ============================================================
function getPinningStyles(
  column: Column<BusStudentRow>,
  isHeader = false,
  rowIdx = 0
): React.CSSProperties {
  const isPinned = column.getIsPinned();
  if (!isPinned) return {};
  const isLast = isPinned === 'left' && column.getIsLastColumn('left');
  // 偶數列跟標題用 gray-900,奇數列用稍亮但仍須蓋底以免透出底下文字
  const bg = isHeader
    ? '#111827'              // gray-900
    : rowIdx % 2 === 0
      ? '#0a0e1a'            // 深色偶數列底色
      : '#0d1220';           // 深色奇數列底色
  return {
    position: 'sticky',
    left: column.getStart('left'),
    zIndex: isHeader ? 21 : 1,
    boxShadow: isLast ? '4px 0 8px -2px rgba(0,0,0,0.5)' : undefined,
    background: bg,
  };
}

// ============================================================
// RouteSelectCell — 路線下拉(改學生 bus_id)
// ============================================================
interface RouteSelectCellProps {
  ctx: any;
  buses: BusInfo[];
  editing: { studentId: number; field: string } | null;
  setEditing: (v: { studentId: number; field: string } | null) => void;
  onSaved: () => void | Promise<void>;
}
function RouteSelectCell({ ctx, buses, editing, setEditing, onSaved }: RouteSelectCellProps) {
  const studentId = ctx.row.original._student_id as number;
  const currentBusId = ctx.row.original._bus_id as number;
  const value = ctx.getValue() as string | null;
  const isEditing = editing?.studentId === studentId && editing?.field === 'bus_id';
  const [saving, setSaving] = useState(false);

  if (isEditing) {
    return (
      <select
        autoFocus
        defaultValue={currentBusId}
        disabled={saving}
        onBlur={() => setEditing(null)}
        onChange={async (e) => {
          const newBusId = parseInt(e.target.value, 10);
          if (newBusId === currentBusId) { setEditing(null); return; }
          setSaving(true);
          try {
            await updateStudent(studentId, { bus_id: newBusId });
            setEditing(null);
            await onSaved();
          } catch (err) {
            alert('儲存失敗:' + (err as Error).message);
          } finally {
            setSaving(false);
          }
        }}
        className="w-full bg-gray-800 border border-blue-600 rounded text-gray-100 text-xs px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {buses.map((b) => (
          <option key={b.id} value={b.id}>{b.bus_name}</option>
        ))}
      </select>
    );
  }

  return (
    <button
      onClick={() => setEditing({ studentId, field: 'bus_id' })}
      className="w-full text-left px-1.5 py-0.5 rounded text-gray-200 hover:bg-blue-900/30 transition-colors"
    >
      {value || <span className="text-gray-600">—</span>}
    </button>
  );
}

