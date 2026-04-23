'use client';
// src/app/workers/page.tsx  ─ 師傅列表頁
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-tw';
import { getWorkers, Worker } from '@/lib/api';

dayjs.extend(relativeTime);
dayjs.locale('zh-tw');

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try { setWorkers(await getWorkers()); }
      finally { setLoading(false); }
    };
    fetch();
    const t = setInterval(fetch, 30_000);
    return () => clearInterval(t);
  }, []);

  const online  = workers.filter(w => w.is_online);
  const offline = workers.filter(w => !w.is_online);

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Nav */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-orange-400 text-xl">⚡</span>
          <span className="font-bold text-sm">師傅列表</span>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/" className="text-gray-400 hover:text-white">地圖</Link>
          <Link href="/workers" className="text-orange-400 font-semibold">師傅列表</Link>
        </nav>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 在線 */}
        <section>
          <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            上班中 ({online.length})
          </h2>
          {loading ? (
            <div className="text-gray-500 text-sm">載入中...</div>
          ) : online.length === 0 ? (
            <div className="text-gray-600 text-sm">目前無師傅上班</div>
          ) : (
            <div className="space-y-3">
              {online.map(w => <WorkerCard key={w.id} worker={w} />)}
            </div>
          )}
        </section>

        {/* 離線 */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-600" />
            未上班 / 離線 ({offline.length})
          </h2>
          {offline.length === 0 ? null : (
            <div className="space-y-3">
              {offline.map(w => <WorkerCard key={w.id} worker={w} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function WorkerCard({ worker: w }: { worker: Worker }) {
  const lastSeen = w.last_location_at
    ? dayjs(w.last_location_at).fromNow()
    : '未曾定位';

  const workHours = (() => {
    if (!w.start_time) return null;
    const mins = dayjs().diff(dayjs(w.start_time), 'minute');
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  })();

  const mapUrl = w.latitude && w.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${w.latitude},${w.longitude}`
    : null;

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 transition-all
      ${w.is_online
        ? 'bg-gray-900 border-emerald-800/40 hover:border-emerald-600/60'
        : 'bg-gray-900/50 border-gray-800'}`}>

      {/* 頭像 */}
      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0
        ${w.is_online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700/50 text-gray-500'}`}>
        {w.name.slice(0, 1)}
      </div>

      {/* 資訊 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-white">{w.name}</span>
          {!!w.is_late && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
              遲到
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {w.is_online && workHours
            ? `已上班 ${workHours}`
            : `最後更新：${lastSeen}`}
        </div>
        {w.start_time && (
          <div className="text-xs text-gray-600">
            上班：{dayjs(w.start_time).format('HH:mm')}
            {w.end_time && ` ─ ${dayjs(w.end_time).format('HH:mm')}`}
          </div>
        )}
      </div>

      {/* 操作 */}
      <div className="flex flex-col gap-2 shrink-0">
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors border border-orange-500/30"
          >
            🗺️ 地圖
          </a>
        )}
        <Link
          href={`/?focus=${w.id}`}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors border border-blue-500/30 text-center"
        >
          📍 定位
        </Link>
      </div>
    </div>
  );
}
