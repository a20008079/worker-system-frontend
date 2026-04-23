'use client';
// src/app/worker/page.tsx  ─ 師傅手機端（打卡 + 工程紀錄）
// useSearchParams() 必須包在 <Suspense> 內，否則 Next.js 14 build 會報錯

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import {
  startWork, endWork, getTodayAttendance,
  recordJob, getWorkerStats, AttendanceLog,
} from '@/lib/api';
import { useGeolocation } from '@/hooks/useGeolocation';

dayjs.extend(duration);

// ── 主要邏輯元件（使用 useSearchParams）─────────────────────
function WorkerApp() {
  const params   = useSearchParams();
  const workerId = Number(params.get('id') || 0);

  const [attendance, setAttendance] = useState<AttendanceLog | null>(null);
  const [stats,      setStats]      = useState<any>(null);
  const [msg,        setMsg]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [elapsed,    setElapsed]    = useState('');
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  const isWorking = !!attendance && !attendance.end_time;
  const { position, error: geoError } = useGeolocation(workerId || null, isWorking, 2 * 60 * 1000);

  const refresh = useCallback(async () => {
    if (!workerId) return;
    try {
      const [att, st] = await Promise.all([
        getTodayAttendance(workerId),
        getWorkerStats(workerId),
      ]);
      setAttendance(att);
      setStats(st);
    } catch (e) {
      console.error(e);
    }
  }, [workerId]);

  useEffect(() => { refresh(); }, [refresh]);

  // 計時器
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!attendance?.start_time || attendance.end_time) { setElapsed(''); return; }
    const tick = () => {
      const mins = dayjs().diff(dayjs(attendance.start_time), 'minute');
      setElapsed(`${Math.floor(mins / 60)}h ${mins % 60}m`);
    };
    tick();
    tickRef.current = setInterval(tick, 60_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [attendance]);

  const getCurrentPos = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 10000 }
      )
    );

  const flashMsg = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3500);
  };

  const handleStart = async () => {
    if (!workerId) return flashMsg('❌ 網址缺少 ?id=');
    setLoading(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      try { const p = await getCurrentPos(); lat = p.lat; lng = p.lng; } catch {}
      const res = await startWork({ worker_id: workerId, latitude: lat, longitude: lng });
      flashMsg(res.is_late ? `⚠️ 打卡成功（遲到 ${res.late_minutes} 分）` : '✅ 上班打卡成功！');
      await refresh();
    } catch (e: any) {
      flashMsg(`❌ ${e?.response?.data?.error || '發生錯誤'}`);
    } finally { setLoading(false); }
  };

  const handleEnd = async () => {
    if (!workerId) return;
    setLoading(true);
    try {
      await endWork(workerId);
      flashMsg('✅ 下班打卡成功！辛苦了！');
      await refresh();
    } catch (e: any) {
      flashMsg(`❌ ${e?.response?.data?.error || '發生錯誤'}`);
    } finally { setLoading(false); }
  };

  const handleJobRecord = async (type: 'arrived' | 'left') => {
    if (!workerId) return;
    setLoading(true);
    try {
      const { lat, lng } = await getCurrentPos();
      await recordJob({ worker_id: workerId, type, latitude: lat, longitude: lng });
      flashMsg(type === 'arrived' ? '📍 到場紀錄完成！' : '🚗 離場紀錄完成！');
    } catch (e: any) {
      flashMsg(`❌ ${e?.response?.data?.error || '取得位置失敗，請確認定位權限'}`);
    } finally { setLoading(false); }
  };

  if (!workerId) {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-gray-300 text-sm">
            網址格式：<code className="text-orange-400">/worker?id=師傅編號</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col max-w-sm mx-auto px-4 py-6 gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="text-2xl mb-1">⚡</div>
        <div className="text-white font-bold text-lg">師傅打卡系統</div>
        <div className="text-gray-500 text-sm">師傅 #{workerId}</div>
      </div>

      {/* 狀態卡 */}
      <div className={`rounded-2xl p-5 border text-center transition-colors
        ${isWorking
          ? 'bg-emerald-950/40 border-emerald-700/40'
          : 'bg-gray-900 border-gray-800'}`}>
        {isWorking ? (
          <>
            <div className="text-3xl mb-2">🟢</div>
            <div className="text-emerald-400 font-bold text-xl">上班中</div>
            {elapsed && <div className="text-emerald-300 text-sm mt-1">已工作 {elapsed}</div>}
            <div className="text-gray-400 text-xs mt-1">
              上班：{dayjs(attendance!.start_time).format('HH:mm')}
              {!!attendance!.is_late && (
                <span className="ml-2 text-red-400">遲到 {attendance!.late_minutes} 分</span>
              )}
            </div>
            {position && (
              <div className="text-gray-600 text-[10px] mt-2">
                📡 {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </div>
            )}
            {geoError && (
              <div className="text-red-400 text-[10px] mt-1">⚠️ 定位錯誤：{geoError}</div>
            )}
          </>
        ) : attendance?.end_time ? (
          <>
            <div className="text-3xl mb-2">✅</div>
            <div className="text-gray-300 font-bold">今日已下班</div>
            <div className="text-gray-500 text-xs mt-1">
              {dayjs(attendance.start_time).format('HH:mm')} ─ {dayjs(attendance.end_time).format('HH:mm')}
            </div>
          </>
        ) : (
          <>
            <div className="text-3xl mb-2">🔴</div>
            <div className="text-gray-400 font-semibold">尚未上班</div>
            <div className="text-gray-600 text-xs mt-1">{dayjs().format('YYYY/MM/DD HH:mm')}</div>
          </>
        )}
      </div>

      {/* 打卡按鈕 */}
      <div className="space-y-3">
        {!isWorking && !attendance?.end_time && (
          <PunchButton label="開始上班" emoji="🟢" onClick={handleStart} disabled={loading} color="emerald" />
        )}
        {isWorking && (
          <PunchButton label="結束上班" emoji="🔴" onClick={handleEnd} disabled={loading} color="red" />
        )}
      </div>

      {/* 工程紀錄（上班中才顯示）*/}
      {isWorking && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-center">
            工程紀錄
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PunchButton label="我到了" emoji="📍" onClick={() => handleJobRecord('arrived')} disabled={loading} color="blue" small />
            <PunchButton label="我離開了" emoji="🚗" onClick={() => handleJobRecord('left')} disabled={loading} color="gray" small />
          </div>
        </div>
      )}

      {/* Toast 訊息 */}
      {msg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full
          bg-gray-800 border border-gray-700 text-white text-sm shadow-2xl z-50
          animate-bounce whitespace-nowrap">
          {msg}
        </div>
      )}

      {/* 本月統計 */}
      {stats && (
        <div className="mt-auto bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs text-gray-500 text-center mb-3 font-semibold uppercase tracking-widest">
            本月統計
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <StatCell label="出勤天" value={stats.attend_days} />
            <StatCell label="總時數" value={`${stats.total_hours}h`} />
            <StatCell label="遲到次" value={stats.late_count} warn={stats.late_count > 0} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub components ────────────────────────────────────────────
function PunchButton({
  label, emoji, onClick, disabled, color, small = false,
}: {
  label: string; emoji: string; onClick: () => void;
  disabled: boolean; color: string; small?: boolean;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white',
    red:     'bg-red-500     hover:bg-red-400     active:bg-red-600     text-white',
    blue:    'bg-blue-600    hover:bg-blue-500                           text-white',
    gray:    'bg-gray-700    hover:bg-gray-600                           text-white',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        ${small ? 'py-4 text-sm' : 'py-5 text-lg'}
        ${colors[color] ?? colors.gray}`}
    >
      <span className="mr-2">{emoji}</span>{label}
    </button>
  );
}

function StatCell({ label, value, warn = false }: { label: string; value: any; warn?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-bold ${warn ? 'text-red-400' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{label}</div>
    </div>
  );
}

// ── Page export：WorkerApp 包在 Suspense 內 ──────────────────
export default function WorkerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">載入中...</div>
      </div>
    }>
      <WorkerApp />
    </Suspense>
  );
}
