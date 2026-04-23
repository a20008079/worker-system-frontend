'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import {
  getWorkers, getCustomers, getDashboardStats,
  Worker, Customer, DashboardStats,
} from '@/lib/api';

const DEFAULT_CENTER: [number, number] = [25.033, 121.565];
const REFRESH_MS = 30_000;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DashboardPage() {
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const leafletRef = useRef<any>(null);

  const [workers,   setWorkers]   = useState<Worker[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats,     setStats]     = useState<DashboardStats | null>(null);
  const [filter,    setFilter]    = useState<0 | 3 | 5 | 10>(0);
  const [loading,   setLoading]   = useState(true);
  const [mapReady,  setMapReady]  = useState(false);

  // ── Leaflet CSS ───────────────────────────────────────
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // ── 初始化地圖 ────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return;

    import('leaflet').then((L) => {
      leafletRef.current = L;

      // 修正 icon 路徑
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapDivRef.current!, {
        center: DEFAULT_CENTER,
        zoom: 13,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }
    };
  }, []);

  // ── 資料抓取 ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [w, c, s] = await Promise.all([getWorkers(), getCustomers(), getDashboardStats()]);
      setWorkers(w);
      setCustomers(c);
      setStats(s);
    } catch (e) {
      console.error('fetchData error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  // ── Markers 更新 ──────────────────────────────────────
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !map || !L) return;

    const existing = new Set<string>();

    // 師傅
    workers.forEach((w) => {
      if (!w.latitude || !w.longitude) return;
      const key = `worker_${w.id}`;
      existing.add(key);
      const lat = Number(w.latitude);
      const lng = Number(w.longitude);
      const lastSeen = w.last_location_at ? dayjs(w.last_location_at).format('HH:mm') : '--';
      const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      const color = w.is_online ? '#10b981' : '#6b7280';

      const iconHtml = `<div style="width:36px;height:44px;display:flex;align-items:center;justify-content:center">
        <div style="width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
          background:${color};display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.35)">
          <span style="transform:rotate(45deg);color:white;font-size:13px;font-weight:700">師</span>
        </div></div>`;

      const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [36, 44], iconAnchor: [18, 44] });

      const popup = `<div style="font-family:system-ui;min-width:180px;padding:4px">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${w.name}</div>
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;
          background:${w.is_online ? '#d1fae5' : '#f3f4f6'};
          color:${w.is_online ? '#065f46' : '#6b7280'}">
          ${w.is_online ? '🟢 上班中' : '🔴 離線'}
        </span>
        <div style="font-size:12px;color:#6b7280;margin:6px 0">最後更新：${lastSeen}</div>
        <a href="${navUrl}" target="_blank"
          style="display:block;text-align:center;padding:6px 12px;
            background:#f97316;color:white;border-radius:6px;
            font-size:13px;font-weight:600;text-decoration:none">
          🧭 導航到這裡
        </a></div>`;

      let marker = markersRef.current.get(key);
      if (!marker) {
        marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup);
        markersRef.current.set(key, marker);
      } else {
        marker.setLatLng([lat, lng]);
        marker.setIcon(icon);
        marker.setPopupContent(popup);
      }
    });

    // 客戶
    customers.forEach((c) => {
      if (!c.latitude || !c.longitude) return;
      const key = `customer_${c.id}`;
      existing.add(key);
      if (!markersRef.current.has(key)) {
        const iconHtml = `<div style="width:32px;height:40px;display:flex;align-items:center;justify-content:center">
          <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            background:#f97316;display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.35)">
            <span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:700">客</span>
          </div></div>`;
        const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [32, 40], iconAnchor: [16, 40] });
        const marker = L.marker([Number(c.latitude), Number(c.longitude)], { icon })
          .addTo(map)
          .bindPopup(`<div style="font-family:system-ui;padding:4px">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">🏗️ ${c.name}</div>
            <div style="font-size:12px;color:#6b7280">${c.address || ''}</div>
          </div>`);
        markersRef.current.set(key, marker);
      }
    });

    // 移除舊 markers
    markersRef.current.forEach((marker, key) => {
      if (!existing.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    });
  }, [workers, customers, mapReady]);

  // ── 篩選 ──────────────────────────────────────────────
  const filteredWorkers = filter === 0
    ? workers
    : workers.filter((w) => {
        if (!w.latitude || !w.longitude || !mapRef.current) return true;
        const center = mapRef.current.getCenter();
        return haversine(center.lat, center.lng, Number(w.latitude), Number(w.longitude)) <= filter;
      });

  const focusWorker = (w: Worker) => {
    if (!w.latitude || !w.longitude || !mapRef.current) return;
    mapRef.current.setView([Number(w.latitude), Number(w.longitude)], 16);
    const marker = markersRef.current.get(`worker_${w.id}`);
    if (marker) marker.openPopup();
  };

  return (
    <div className="flex flex-col bg-gray-950" style={{ height: '100dvh' }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0" style={{ zIndex: 1000, position: 'relative' }}>
        <div className="flex items-center gap-2">
          <span className="text-orange-400 text-xl">⚡</span>
          <span className="font-bold text-sm">瘋扣弱電 師傅管理</span>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/" className="text-orange-400 font-semibold">地圖</Link>
          <Link href="/workers" className="text-gray-400 hover:text-white">師傅列表</Link>
        </nav>
      </header>

      {/* Filter */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0" style={{ zIndex: 1000, position: 'relative' }}>
        {([0, 3, 5, 10] as const).map((km) => (
          <button key={km} onClick={() => setFilter(km)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              filter === km ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            {km === 0 ? '全部' : `${km} 公里`}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">
          {loading ? '更新中...' : `${filteredWorkers.filter(w => w.is_online).length} 人在線`}
        </span>
      </div>

      {/* Map */}
      <div className="relative flex-1" style={{ zIndex: 0 }}>
        <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

        {/* 浮動師傅列表 */}
        {filteredWorkers.length > 0 && (
          <div className="absolute top-3 right-3 w-52 bg-gray-900/90 backdrop-blur rounded-xl border border-gray-700 shadow-2xl max-h-72 overflow-y-auto hidden md:block"
            style={{ zIndex: 999 }}>
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 border-b border-gray-700">師傅快速定位</div>
            {filteredWorkers.map((w) => (
              <button key={w.id} onClick={() => focusWorker(w)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 transition-colors text-left">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${w.is_online ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <span className="text-sm text-white truncate">{w.name}</span>
                {!!w.is_late && <span className="text-xs text-red-400 ml-auto">遲</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-px bg-gray-800 shrink-0" style={{ zIndex: 1000, position: 'relative' }}>
          {[
            { label: '今日服務', value: stats.today_jobs,      icon: '🔧' },
            { label: '本月紀錄', value: stats.month_records,   icon: '📋' },
            { label: '管轄客戶', value: stats.total_customers, icon: '🏗️' },
            { label: '在線師傅', value: stats.online_workers,  icon: '🟢' },
          ].map((card) => (
            <div key={card.label} className="bg-gray-900 py-3 flex flex-col items-center gap-1">
              <span className="text-base">{card.icon}</span>
              <span className="text-lg font-bold text-white">{card.value}</span>
              <span className="text-[10px] text-gray-500">{card.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
