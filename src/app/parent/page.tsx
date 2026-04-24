'use client';
// src/app/parent/page.tsx — 家長查看校車位置（地圖為主）
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// 動態載入地圖（避免 SSR 問題）
const BusMap = dynamic(() => import('@/components/BusMap'), { ssr: false });

export default function ParentPage() {
  const router = useRouter();
  const [data, setData]       = useState<any[]>([]);
  const [selected, setSelected] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const token = () => localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/parent/me`, { headers: headers() });
      if (r.status === 401) { router.push('/login'); return; }
      const d = await r.json();
      setData(d);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, 60000); // 每分鐘更新
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData]);

  const current = data[selected];

  if (loading) return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400">載入中...</div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg">🚌 校車追蹤</div>
          <div className="text-gray-500 text-xs mt-0.5">每分鐘自動更新</div>
        </div>
        <button
          onClick={() => { localStorage.clear(); router.push('/login'); }}
          className="text-gray-600 text-sm"
        >
          登出
        </button>
      </div>

      {/* 學生切換（多個小孩時） */}
      {data.length > 1 && (
        <div className="px-4 flex gap-2 pb-2 overflow-x-auto">
          {data.map((d, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all
                ${selected === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400'}`}
            >
              {d.student.name}
            </button>
          ))}
        </div>
      )}

      {/* 地圖 */}
      <div className="flex-1 relative">
        {current?.location ? (
          <BusMap
            latitude={current.location.latitude}
            longitude={current.location.longitude}
            busName={current.bus.bus_name}
            isOnline={current.is_online}
          />
        ) : (
          <div className="w-full h-full min-h-[60vw] bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">📍</div>
              <div className="text-gray-400">校車尚未出發</div>
            </div>
          </div>
        )}
      </div>

      {/* 資訊卡（底部） */}
      {current && (
        <div className="bg-gray-900 border-t border-gray-800 px-4 py-5 rounded-t-3xl">
          {/* 校車狀態 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${current.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              <div>
                <div className="text-white font-bold">{current.bus.bus_name}</div>
                <div className="text-gray-500 text-xs">{current.bus.route_name}</div>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium
              ${current.is_online ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
              {current.is_online ? '行駛中' : '未出發'}
            </div>
          </div>

          {/* 學生資訊 */}
          <div className="bg-gray-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-2xl">
              👦
            </div>
            <div>
              <div className="text-white font-semibold">{current.student.name}</div>
              <div className="text-gray-500 text-sm">{current.student.school_class}</div>
            </div>
            <div className="ml-auto text-right">
              {current.location ? (
                <div className="text-gray-500 text-xs">
                  更新於<br/>
                  {new Date(current.location.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                </div>
              ) : (
                <div className="text-gray-600 text-xs">尚無位置</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
