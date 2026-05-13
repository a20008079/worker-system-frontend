'use client';
// src/app/admin/bus/audit/page.tsx
// v4 階段 2 — 修改紀錄頁

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuditLog } from '@/lib/busApi';
import type { AuditLogRow } from '@/types/bus';

export default function BusAuditPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') { router.push('/admin/login'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLog(limit);
      setRows(data);
    } catch (e) {
      console.error(e);
      alert('載入失敗:' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 把 DB datetime ('2026-05-13 17:30:00') 轉成台灣時間顯示
  const formatTime = (dt: string) => {
    if (!dt) return '';
    const str = String(dt).replace(' ', 'T') + '+08:00';
    const d = new Date(str);
    return d.toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/bus')}
            className="text-gray-400 hover:text-white text-sm">‹ 返回</button>
          <div>
            <div className="text-white font-bold text-lg">📋 修改紀錄</div>
            <div className="text-gray-500 text-xs">校車系統 audit log</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-gray-500 text-xs">顯示</label>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={50}>最近 50 筆</option>
            <option value={100}>最近 100 筆</option>
            <option value={200}>最近 200 筆</option>
            <option value={500}>最近 500 筆</option>
          </select>
          <button
            onClick={load}
            className="bg-blue-700 hover:bg-blue-600 text-white text-sm font-bold rounded-xl px-3 py-1.5 active:scale-95 transition-all"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 表 */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-spin"
            style={{ border: '3px solid #1f2937', borderTopColor: '#3b82f6' }} />
          <div className="text-sm">載入中…</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <div>尚無修改紀錄</div>
          <div className="text-xs mt-2 text-gray-600">在 /admin/bus 改任何學生資料後會出現在這裡</div>
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="text-xs text-gray-500 mb-3">共 {rows.length} 筆</div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-300 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">時間</th>
                  <th className="px-4 py-3 text-left font-semibold">操作</th>
                  <th className="px-4 py-3 text-left font-semibold">學生</th>
                  <th className="px-4 py-3 text-left font-semibold">班級</th>
                  <th className="px-4 py-3 text-left font-semibold">管理員</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap text-xs">
                      {formatTime(r.changed_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <ActionBadge action={r.action} />
                    </td>
                    <td className="px-4 py-2.5 text-gray-200 font-medium">
                      {r.student_name || <span className="text-gray-600 italic">(已刪除)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {r.school_class || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-300">
                      {r.admin_name || `#${r.admin_id}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-600 mt-3">
            ※ Level 1 audit:只記錄誰、何時、改了哪個學生(不記欄位明細)
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    update: { bg: 'bg-blue-700/40 border-blue-700/60', text: 'text-blue-200', label: '修改' },
    create: { bg: 'bg-emerald-700/40 border-emerald-700/60', text: 'text-emerald-200', label: '新增' },
    delete: { bg: 'bg-red-700/40 border-red-700/60', text: 'text-red-200', label: '刪除' },
  };
  const s = map[action] || { bg: 'bg-gray-700 border-gray-600', text: 'text-gray-300', label: action };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold border ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
