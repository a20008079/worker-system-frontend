'use client';
// src/app/workers/[id]/page.tsx  ─ 師傅詳情 + 本月出勤
// useParams() 在 Next.js 14 App Router 需要 Suspense 包裹

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface WorkerDetail { id: number; name: string; phone: string; }
interface AttendanceLog {
  id: number; work_date: string; start_time: string;
  end_time: string | null; is_late: number; late_minutes: number;
}
interface MonthStats {
  attend_days: number; late_count: number;
  total_hours: number; total_minutes: number;
}

// ── 主元件（使用 useParams）───────────────────────────────────
function WorkerDetailApp() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [worker,  setWorker]  = useState<WorkerDetail | null>(null);
  const [logs,    setLogs]    = useState<AttendanceLog[]>([]);
  const [stats,   setStats]   = useState<MonthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      axios.get(`${BASE}/api/workers/${id}`),
      axios.get(`${BASE}/api/attendance/monthly/${id}`),
      axios.get(`${BASE}/api/stats/worker/${id}`),
    ]).then(([w, l, s]) => {
      setWorker(w.data.data);
      setLogs(l.data.data || []);
      setStats(s.data.data);
    }).catch(() => setError('載入失敗，請重試'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (error)   return <div className="p-8 text-red-400">{error}</div>;
  if (!worker) return <div className="p-8 text-gray-400">找不到師傅</div>;

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white">{worker.name}</div>
          <div className="text-xs text-gray-500">{worker.phone}</div>
        </div>
        <Link
          href={`/?focus=${id}`}
          className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0"
        >
          📍 地圖定位
        </Link>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 本月統計 */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '出勤天', value: stats.attend_days,                   icon: '📅' },
              { label: '總時數', value: `${stats.total_hours}h`,             icon: '⏱️' },
              { label: '遲到次', value: stats.late_count,                    icon: '⚠️', warn: stats.late_count > 0 },
              { label: '本月',   value: dayjs().format('M月'),               icon: '📊' },
            ].map(c => (
              <div key={c.label} className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
                <div className="text-lg mb-1">{c.icon}</div>
                <div className={`text-xl font-bold ${(c as any).warn ? 'text-red-400' : 'text-white'}`}>
                  {c.value}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 出勤紀錄列表 */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            本月出勤紀錄
          </h2>
          {logs.length === 0 ? (
            <div className="text-gray-600 text-sm text-center py-10">本月尚無出勤紀錄</div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => {
                const start   = dayjs(log.start_time);
                const end     = log.end_time ? dayjs(log.end_time) : null;
                const mins    = end ? end.diff(start, 'minute') : null;
                const isToday = log.work_date === dayjs().format('YYYY-MM-DD');
                return (
                  <div
                    key={log.id}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border
                      ${log.is_late
                        ? 'bg-red-950/20 border-red-900/30'
                        : 'bg-gray-900 border-gray-800'}`}
                  >
                    {/* 日期 */}
                    <div className="w-16 text-center shrink-0">
                      <div className={`font-semibold text-sm ${isToday ? 'text-orange-400' : 'text-white'}`}>
                        {dayjs(log.work_date).format('MM/DD')}
                      </div>
                      <div className="text-gray-600 text-[10px]">{start.format('ddd')}</div>
                    </div>

                    {/* 時間 + 工時 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300">
                        {start.format('HH:mm')}
                        {' → '}
                        {end
                          ? end.format('HH:mm')
                          : <span className="text-emerald-400">上班中</span>}
                      </div>
                      {mins !== null && (
                        <div className="text-xs text-gray-500">
                          工時 {Math.floor(mins/60)}h {mins%60}m
                        </div>
                      )}
                    </div>

                    {/* 遲到標示 */}
                    <div className="shrink-0">
                      {log.is_late ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                          遲 {log.late_minutes}m
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          準時
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
      <div className="text-gray-500 text-sm animate-pulse">載入中...</div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────
export default function WorkerDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <WorkerDetailApp />
    </Suspense>
  );
}
