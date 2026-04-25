'use client';
// src/app/driver/page.tsx — 司機手機端
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function DriverPage() {
  const router = useRouter();
  const [driver, setDriver]   = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [msg, setMsg]         = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const geoRef  = useRef<NodeJS.Timeout | null>(null);

  const token   = () => localStorage.getItem('token');
  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`,
  });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const fetchMe = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/driver/me`, { headers: headers() });
      if (r.status === 401) { router.push('/login'); return; }
      const d = await r.json();
      setDriver(d.driver);
      setSession(d.session);
    } catch { flash('❌ 無法連線'); }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  // 計時器
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!session?.start_time || session.end_time) { setElapsed(''); return; }
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(session.start_time).getTime()) / 60000);
      setElapsed(`${Math.floor(mins / 60)}h ${mins % 60}m`);
    };
    tick();
    tickRef.current = setInterval(tick, 60000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [session]);

  // GPS 自動回傳
  useEffect(() => {
    if (geoRef.current) clearInterval(geoRef.current);
    if (!session || session.end_time) return;

    const sendLocation = () => {
      navigator.geolocation?.getCurrentPosition(async (pos) => {
        try {
          await fetch(`${API}/api/location/update`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              latitude:  pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy:  pos.coords.accuracy,
            }),
          });
        } catch {}
      }, undefined, { enableHighAccuracy: true });
    };

    sendLocation();
    geoRef.current = setInterval(sendLocation, 60 * 1000);
    return () => { if (geoRef.current) clearInterval(geoRef.current); };
  }, [session]);

  const handleOnline = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/driver/online`, { method: 'POST', headers: headers() });
      const d = await r.json();
      if (!r.ok) { flash(`❌ ${d.error}`); return; }
      flash('✅ 已上線！開始定位');
      fetchMe();
    } catch { flash('❌ 發生錯誤'); }
    finally { setLoading(false); }
  };

  const handleOffline = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/driver/offline`, { method: 'POST', headers: headers() });
      flash('✅ 已下線');
      fetchMe();
    } catch { flash('❌ 發生錯誤'); }
    finally { setLoading(false); }
  };

  const isOnline = session && !session.end_time;

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col max-w-sm mx-auto px-4 py-8 gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="text-3xl mb-2">🚌</div>
        <div className="text-white font-bold text-xl">司機操作台</div>
        {driver && <div className="text-gray-400 text-sm mt-1">{driver.name} · {driver.bus_name}</div>}
      </div>

      {/* 狀態卡 */}
      <div className={`rounded-3xl p-6 text-center border transition-all
        ${isOnline ? 'bg-emerald-950/50 border-emerald-600/40' : 'bg-gray-900 border-gray-800'}`}>
        <div className="text-4xl mb-3">{isOnline ? '🟢' : '🔴'}</div>
        <div className={`font-bold text-2xl ${isOnline ? 'text-emerald-400' : 'text-gray-400'}`}>
          {isOnline ? '行駛中' : '已下線'}
        </div>
        {isOnline && elapsed && (
          <div className="text-emerald-300 text-sm mt-2">已上線 {elapsed}</div>
        )}
        {driver?.bus_name && (
          <div className="text-gray-500 text-sm mt-2">{driver.route_name} · {driver.bus_name}</div>
        )}
      </div>

      {/* 上下線按鈕 */}
      {!isOnline ? (
        <button
          onClick={handleOnline}
          disabled={loading}
          className="w-full py-6 rounded-3xl bg-emerald-500 hover:bg-emerald-400 active:scale-95
                     text-white font-bold text-xl transition-all disabled:opacity-50"
        >
          🟢 上線出發
        </button>
      ) : (
        <button
          onClick={handleOffline}
          disabled={loading}
          className="w-full py-6 rounded-3xl bg-red-500 hover:bg-red-400 active:scale-95
                     text-white font-bold text-xl transition-all disabled:opacity-50"
        >
          🔴 下線收班
        </button>
      )}

      {/* 掃描學生上車按鈕（上線中才顯示） */}
      {isOnline && (
        <button
          onClick={() => router.push('/driver/scan')}
          className="w-full py-5 rounded-3xl bg-blue-600 hover:bg-blue-500 active:scale-95
                     text-white font-bold text-lg transition-all"
        >
          📷 掃描學生上車
        </button>
      )}

      {/* 說明 */}
      {!isOnline && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="text-gray-400 text-sm text-center">
            點「上線出發」後，系統會自動<br/>每 3 分鐘回傳校車位置給家長
          </div>
        </div>
      )}

      {/* 登出 */}
      <button
        onClick={() => { localStorage.clear(); router.push('/login'); }}
        className="text-gray-600 text-sm text-center mt-auto"
      >
        登出
      </button>

      {/* Toast */}
      {msg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full
                        bg-gray-800 border border-gray-700 text-white text-sm shadow-2xl">
          {msg}
        </div>
      )}
    </div>
  );
}
