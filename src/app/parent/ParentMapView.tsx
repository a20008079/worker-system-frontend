'use client';
// src/app/parent/ParentMapView.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import 'leaflet/dist/leaflet.css';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const REFRESH_MS = 20000;

export default function ParentMapView() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const pathLayerRef = useRef<any>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [cur, setCur] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPath, setShowPath] = useState(false);
  const [progress, setProgress] = useState(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapHeight, setMapHeight] = useState(300);
  const headerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);

  const token = () => localStorage.getItem('token') || '';
  const H = () => ({ Authorization: `Bearer ${token()}` });

  // 初始化地圖（動態 import Leaflet）
  useEffect(() => {
    if (mapInstanceRef.current || !mapContainerRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      // 確保容器有尺寸
      const container = mapContainerRef.current;
      if (!container) return;
      // 強制設定容器高度
      container.style.height = container.offsetHeight > 0 ? container.offsetHeight + "px" : "300px";

      const m = L.map(container, {
        center: [24.9675, 121.2168],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(m);

      L.control.zoom({ position: 'topright' }).addTo(m);
      mapInstanceRef.current = m;

      // 多次 invalidateSize 確保正確渲染
      setTimeout(() => { m.invalidateSize(); setMapReady(true); }, 100);
      setTimeout(() => m.invalidateSize(), 500);
      setTimeout(() => m.invalidateSize(), 1000);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // 計算地圖高度
  const calcMapHeight = useCallback(() => {
    const total = window.innerHeight;
    const headerH = headerRef.current?.offsetHeight || 0;
    const panelH = panelCollapsed ? 28 : (panelRef.current?.offsetHeight || 200) + 28;
    const progressH = 3;
    const h = total - headerH - panelH - progressH;
    setMapHeight(Math.max(h, 150));
    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
  }, [panelCollapsed]);

  useEffect(() => {
    calcMapHeight();
    window.addEventListener('resize', calcMapHeight);
    return () => window.removeEventListener('resize', calcMapHeight);
  }, [calcMapHeight]);

  // 面板收合時重算地圖尺寸
  useEffect(() => {
    const t = setTimeout(() => { mapInstanceRef.current?.invalidateSize(); }, 350);
    return () => clearTimeout(t);
  }, [panelCollapsed]);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/parent/me`, { headers: H() });
      if (r.status === 401) { router.push('/login'); return; }
      const d = await r.json();
      setData(d);
      setLoading(false);
    } catch { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 進度條自動刷新
  useEffect(() => {
    if (loading || !data.length) return;
    elapsed.current = 0;
    if (progressRef.current) clearInterval(progressRef.current);
    progressRef.current = setInterval(async () => {
      elapsed.current += 250;
      setProgress(Math.min(100, (elapsed.current / REFRESH_MS) * 100));
      if (elapsed.current >= REFRESH_MS) {
        elapsed.current = 0;
        setProgress(0);
        await fetchData();
      }
    }, 250);
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [loading, data.length, fetchData]);

  // 更新地圖 marker
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !data.length) return;
    const item = data[cur];
    if (!item?.location) {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      return;
    }

    const updateMarker = async () => {
      const L = (await import('leaflet')).default;
      const { latitude, longitude } = item.location;
      const isOn = item.is_online;

      const icon = L.divIcon({
        html: `<div style="width:48px;height:48px;background:${isOn ? '#3b82f6' : '#e2e8f0'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.25)">${isOn ? '🚌' : '🅿️'}</div>`,
        className: '', iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -28],
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]).setIcon(icon);
      } else {
        markerRef.current = L.marker([latitude, longitude], { icon }).addTo(mapInstanceRef.current);
      }
      mapInstanceRef.current.setView([latitude, longitude], 15, { animate: true });
    };

    updateMarker();
  }, [data, cur, mapReady]);

  const togglePath = async () => {
    if (!data.length || !mapReady) return;
    const item = data[cur];
    if (showPath) { clearPath(); setShowPath(false); return; }
    try {
      const r = await fetch(`${API}/api/admin/buses/${item.bus.id}/history`, { headers: H() });
      if (!r.ok) return;
      const pts = await r.json();
      if (!pts.length) return;
      await drawPath(pts.map((p: any) => [p.latitude, p.longitude] as [number, number]));
      setShowPath(true);
    } catch {}
  };

  const drawPath = async (latlngs: [number, number][]) => {
    if (!mapInstanceRef.current) return;
    clearPath();
    const L = (await import('leaflet')).default;
    const lg = L.layerGroup();
    L.polyline(latlngs, { color: '#3b82f6', weight: 5, opacity: 0.7 }).addTo(lg);
    if (latlngs.length) {
      L.circleMarker(latlngs[0], { radius: 6, fillColor: '#10b981', color: '#fff', weight: 2, fillOpacity: 1 })
        .bindTooltip('出發點').addTo(lg);
    }
    lg.addTo(mapInstanceRef.current);
    pathLayerRef.current = lg;
    try { mapInstanceRef.current.fitBounds(latlngs, { padding: [50, 50] }); } catch {}
  };

  const clearPath = () => {
    if (pathLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(pathLayerRef.current);
      pathLayerRef.current = null;
    }
  };

  if (loading) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center flex-col gap-3">
      <div className="w-9 h-9 rounded-full animate-spin" style={{ border: '3px solid #e2e8f0', borderTopColor: '#3b82f6' }} />
      <div className="text-gray-400 text-sm">取得校車資訊...</div>
    </div>
  );

  if (!data.length) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-5xl mb-3">🔍</div>
        <h3 className="font-bold text-gray-800 mb-2">找不到學生資料</h3>
        <p className="text-gray-500 text-sm">您的帳號尚未綁定學生<br />請聯絡學校管理員</p>
        <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="mt-6 text-gray-400 text-sm">登出</button>
      </div>
    </div>
  );

  const item = data[cur];
  const { student, bus, location, is_online, boarded_at } = item;
  const lastSeen = location?.created_at
    ? new Date(location.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: '100dvh', maxWidth: 500, margin: '0 auto' }}>
      {/* 進度條 */}
      <div style={{ height: 3, background: '#e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: '#3b82f6', transition: 'width .5s linear' }} />
      </div>

      {/* Header */}
      <div ref={headerRef} className="bg-white border-b border-gray-100 px-5 py-3 flex-shrink-0" style={{ boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-black text-gray-900 text-lg tracking-tight">🚌 校車追蹤</div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${is_online ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {is_online ? '行駛中' : '未出發'}
          </div>
        </div>
        {data.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {data.map((d, i) => (
              <button key={i} onClick={() => { setCur(i); setShowPath(false); clearPath(); }}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${cur === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {d.student.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 地圖容器 */}
      <div style={{ height: mapHeight, flexShrink: 0, position: 'relative', background: '#e8f4f8', overflow: 'hidden' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
            🗺️ 地圖載入中...
          </div>
        )}
      </div>

      {/* 收合拉把 */}
      <div onClick={() => setPanelCollapsed(!panelCollapsed)}
        className="bg-white flex items-center justify-center cursor-pointer flex-shrink-0"
        style={{ height: 28, borderTop: '1px solid #f1f5f9' }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 32, height: 3, background: '#d1d5db', borderRadius: 2 }} />
          <span className="text-gray-400 text-xs">{panelCollapsed ? '▲ 展開' : '▼ 收合'}</span>
          <div style={{ width: 32, height: 3, background: '#d1d5db', borderRadius: 2 }} />
        </div>
      </div>

      {/* 底部面板 */}
      <div ref={panelRef} className="bg-white flex-shrink-0 overflow-hidden"
        style={{ maxHeight: panelCollapsed ? 0 : 400, transition: 'max-height 0.3s ease' }}>
        <div className="px-5 py-4">
          {is_online ? (
            <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#1e40af)', borderRadius: 12, padding: '12px 15px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, opacity: .8 }}>校車狀態</div>
                <div style={{ fontSize: 19, fontWeight: 900 }}>行駛中 🟢</div>
              </div>
              <div style={{ fontSize: 11, opacity: .8, textAlign: 'right' }}>
                <div>{bus.bus_name}</div>
                <div>{lastSeen ? `更新 ${lastSeen}` : '等待定位'}</div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 mb-3">
              <div className="font-black text-gray-800 text-base mb-1 flex items-center gap-2">
                🚌 {bus.bus_name}
                <span className="ml-auto text-xs font-medium text-gray-400">{bus.route_name}</span>
              </div>
              <div className="text-gray-500 text-sm">⚫ 今日尚未出發</div>
              {lastSeen && <div className="text-gray-400 text-xs mt-1">🕐 最後更新：{lastSeen}</div>}
            </div>
          )}

          {location && is_online && (
            <button onClick={togglePath}
              className={`w-full py-2 rounded-xl text-sm font-semibold mb-3 transition-all border ${showPath ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-500'}`}>
              {showPath ? '🗑️ 隱藏行駛路徑' : '📍 顯示今日行駛路徑'}
            </button>
          )}

          <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">我的孩子</div>
          <div className={`flex items-center gap-3 border rounded-2xl px-4 py-3 transition-all
            ${item.alighted_at ? 'border-purple-300 bg-purple-50' : boarded_at ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 flex-shrink-0
              ${item.alighted_at ? 'bg-purple-100 border-purple-300' : boarded_at ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-200'}`}>
              {item.alighted_at ? '🏠' : boarded_at ? '✅' : '👦'}
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900">{student.name}</div>
              <div className="text-gray-400 text-xs">{student.school_class}</div>
              {item.alighted_at && (
                <div className="text-purple-600 text-xs mt-0.5">
                  下車：{new Date(item.alighted_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {boarded_at && !item.alighted_at && (
                <div className="text-green-600 text-xs mt-0.5">
                  上車：{new Date(boarded_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            <div className={`text-xs font-semibold px-3 py-1 rounded-full
              ${item.alighted_at ? 'bg-purple-100 text-purple-700' : boarded_at ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
              {item.alighted_at ? '已下車' : boarded_at ? '在車上' : '等待中'}
            </div>
          </div>

          <div className="text-center mt-3">
            <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="text-xs text-gray-300">登出</button>
          </div>
        </div>
      </div>
    </div>
  );
}
