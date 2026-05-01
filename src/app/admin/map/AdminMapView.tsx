'use client';
// src/app/admin/map/AdminMapView.tsx — 地圖主體（純 client component）
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const ROUTE_COLORS: Record<string, string> = {
  中壢: '#3b82f6', 桃園: '#8b5cf6', 八德: '#10b981',
  平鎮: '#f59e0b', 蘆竹: '#ec4899', 大園: '#06b6d4',
  大溪: '#f97316', 龜山: '#84cc16', 觀音: '#a78bfa',
};

function getColor(routeName: string) {
  for (const [k, v] of Object.entries(ROUTE_COLORS)) {
    if (routeName?.includes(k)) return v;
  }
  return '#94a3b8';
}

export default function AdminMapView() {
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const pathLayerRef = useRef<L.LayerGroup | null>(null);

  const [buses, setBuses] = useState<any[]>([]);
  const [selBus, setSelBus] = useState<any>(null);
  const [routeFilter, setRouteFilter] = useState('all');
  const [showPath, setShowPath] = useState(false);
  const [updateTime, setUpdateTime] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false); // 手機版預設收合
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const token = () => localStorage.getItem('token') || '';
  const H = () => ({ Authorization: `Bearer ${token()}` });

  // ── 初始化地圖 ──
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    const m = L.map(mapElRef.current, {
      center: [24.9675, 121.2168],
      zoom: 12,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap © CARTO',
    }).addTo(m);
    L.control.zoom({ position: 'topright' }).addTo(m);
    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // 地圖尺寸在 drawer 開關後需要重新計算
  useEffect(() => {
    const t = setTimeout(() => { mapRef.current?.invalidateSize(); }, 320);
    return () => clearTimeout(t);
  }, [drawerOpen]);

  // ── 建立 marker icon ──
  function createIcon(bus: any) {
    const isOnline = bus.session_id != null;
    const color = getColor(bus.route_name || '');
    const bg = isOnline ? color : '#374151';
    const border = isOnline ? color : '#6b7280';
    return L.divIcon({
      html: `<div style="position:relative">
        <div style="width:36px;height:36px;background:${bg}33;border:3px solid ${border};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 2px 8px rgba(0,0,0,.4)">🚌</div>
        ${isOnline ? `<div style="position:absolute;top:-3px;right:-3px;width:9px;height:9px;background:#10b981;border-radius:50%;border:2px solid #0a0f1e"></div>` : ''}
      </div>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -22],
    });
  }

  // ── 載入校車資料 ──
  const loadBuses = useCallback(async () => {
    try {
      let data: any[];
      const r = await fetch(`${API}/api/admin/buses/locations`, { headers: H() });
      if (r.ok) data = await r.json();
      else {
        const r2 = await fetch(`${API}/api/admin/buses`, { headers: H() });
        data = await r2.json();
      }
      if (!Array.isArray(data)) return;
      setBuses(data);
      setUpdateTime(new Date().toLocaleTimeString('zh-TW'));
      renderMarkers(data);
    } catch {}
  }, []);

  function renderMarkers(data: any[]) {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const mkrs = markersRef.current;

    Object.keys(mkrs).forEach((id) => {
      if (!data.find((b) => b.id == id)) { mkrs[Number(id)].remove(); delete mkrs[Number(id)]; }
    });

    const bounds: [number, number][] = [];
    data.forEach((bus) => {
      if (!bus.latitude || !bus.longitude) return;
      const ll: [number, number] = [bus.latitude, bus.longitude];
      bounds.push(ll);
      const icon = createIcon(bus);
      if (mkrs[bus.id]) { mkrs[bus.id].setLatLng(ll).setIcon(icon); }
      else {
        const m = L.marker(ll, { icon }).on('click', () => selectBus(bus.id));
        m.addTo(map);
        mkrs[bus.id] = m;
      }
    });

    if (bounds.length > 0 && !selBus) {
      try { map.fitBounds(bounds, { padding: [50, 50] }); } catch {}
    }
  }

  function selectBus(busId: number) {
    setBuses((prev) => {
      const bus = prev.find((b) => b.id === busId);
      if (!bus) return prev;
      setSelBus(bus);
      if (bus.latitude && bus.longitude) {
        mapRef.current?.setView([bus.latitude, bus.longitude], 15, { animate: true });
      }
      return prev;
    });
    setShowPath(false);
    clearPath();
    // 手機點選校車後自動收合 drawer，讓地圖可見
    setDrawerOpen(false);
  }

  async function togglePath() {
    if (showPath) { clearPath(); setShowPath(false); return; }
    if (!selBus) return;
    try {
      const r = await fetch(`${API}/api/admin/buses/${selBus.id}/history`, { headers: H() });
      if (!r.ok) return;
      const pts = await r.json();
      if (!pts.length) return;
      drawPath(pts.map((p: any) => [p.latitude, p.longitude] as [number, number]), selBus.route_name);
      setShowPath(true);
    } catch {}
  }

  function drawPath(latlngs: [number, number][], routeName: string) {
    if (!mapRef.current) return;
    clearPath();
    const color = getColor(routeName || '');
    const lg = L.layerGroup();
    L.polyline(latlngs, { color, weight: 4, opacity: 0.8 }).addTo(lg);
    if (latlngs.length) L.circleMarker(latlngs[0], { radius: 7, fillColor: '#10b981', color: '#fff', weight: 2, fillOpacity: 1 }).bindTooltip('起點').addTo(lg);
    if (latlngs.length > 1) L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1 }).bindTooltip('目前').addTo(lg);
    lg.addTo(mapRef.current);
    pathLayerRef.current = lg;
    try { mapRef.current.fitBounds(latlngs, { padding: [60, 60] }); } catch {}
  }

  function clearPath() {
    if (pathLayerRef.current && mapRef.current) { mapRef.current.removeLayer(pathLayerRef.current); pathLayerRef.current = null; }
  }

  useEffect(() => {
    loadBuses();
    timerRef.current = setInterval(loadBuses, 15000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadBuses]);

  const onlineCount = buses.filter((b) => b.session_id != null).length;
  const routes = [...new Set(buses.map((b) => b.route_name).filter(Boolean))].sort();
  const filteredBuses = routeFilter === 'all' ? buses : buses.filter((b) => b.route_name === routeFilter);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0f1e', color: '#e2e8f0', fontFamily: "'Noto Sans TC', sans-serif" }}>

      {/* ── 頂部 Bar ── */}
      <div style={{ background: '#111827', borderBottom: '1px solid #1e3a5f', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, zIndex: 1000 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>🚌 校車<span style={{ color: '#3b82f6' }}>即時</span>地圖</div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Pill on={onlineCount > 0}><DotSpan on={onlineCount > 0} />{onlineCount} 在線</Pill>
          <Pill><DotSpan />{buses.length} 台</Pill>
          <Pill><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{updateTime || '--:--'}</span></Pill>
        </div>
        <button onClick={loadBuses} style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>🔄 重整</button>
        <button onClick={() => router.push('/admin')} style={{ background: '#1a2332', border: '1px solid #1e3a5f', color: '#94a3b8', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>← 後台</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ── 手機遮罩（drawer 開時點外面收合）── */}
        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.5)' }}
            className="md-hide"
          />
        )}

        {/* ── 側邊欄 ── */}
        <div style={{
          // 桌機：固定 280px，正常 flex
          // 手機：absolute 覆蓋，靠 transform 滑入滑出
          width: 280,
          background: '#111827',
          borderRight: '1px solid #1e3a5f',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
          // 手機響應式透過 inline style + CSS variable 模擬
          // 用 position + transform 處理
          position: undefined,
          zIndex: undefined,
          transition: 'transform 0.3s ease',
        }}
          // 直接用 className 做響應式
          className={`bus-drawer${drawerOpen ? ' drawer-open' : ''}`}
        >
          {/* 手機版標題列（含關閉按鈕） */}
          <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>校車列表</div>
            {/* 關閉按鈕：手機才顯示 */}
            <button
              onClick={() => setDrawerOpen(false)}
              className="drawer-close-btn"
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
            >
              ×
            </button>
          </div>

          {/* 路線篩選 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 8 }}>
            {['all', ...routes].map((r) => (
              <button key={r} onClick={() => setRouteFilter(r)} style={{ background: routeFilter === r ? '#3b82f6' : '#1a2332', border: `1px solid ${routeFilter === r ? '#3b82f6' : '#1e3a5f'}`, color: routeFilter === r ? '#fff' : '#94a3b8', padding: '3px 9px', borderRadius: 10, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {r === 'all' ? '全部' : r}
              </button>
            ))}
          </div>

          {/* 校車清單 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 6px' }}>
            {filteredBuses.map((bus) => {
              const isOn = bus.session_id != null;
              const color = getColor(bus.route_name || '');
              const pct = bus.student_count > 0 ? Math.round((bus.boarded_count || 0) / bus.student_count * 100) : 0;
              const isSel = selBus?.id === bus.id;
              return (
                <div key={bus.id} onClick={() => selectBus(bus.id)} style={{ background: isSel ? 'rgba(59,130,246,.12)' : '#1a2332', border: `1px solid ${isSel ? '#3b82f6' : '#1e3a5f'}`, borderRadius: 9, padding: '8px 10px', marginBottom: 4, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: isOn ? '#10b981' : '#475569', flexShrink: 0, boxShadow: isOn ? '0 0 5px #10b981' : 'none' }} />
                    <div style={{ fontWeight: 700, fontSize: 13, flex: 1, color: isOn ? color : '#e2e8f0' }}>{bus.bus_name}</div>
                    <div style={{ fontSize: 10, background: '#0a0f1e', padding: '1px 6px', borderRadius: 8, color: '#94a3b8', border: '1px solid #1e3a5f' }}>{bus.route_name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                    <span style={{ color: isOn ? '#10b981' : undefined }}>{bus.boarded_count || 0}/{bus.student_count || 0}人</span>
                    <span>{bus.latitude ? '📡有定位' : '📵無定位'}</span>
                    {isOn && <span style={{ color: '#10b981' }}>●行駛中</span>}
                  </div>
                  {bus.student_count > 0 && (
                    <div style={{ marginTop: 4, height: 2, background: '#1e3a5f', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: isOn ? '#10b981' : '#475569', borderRadius: 2, transition: 'width .5s' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 地圖 ── */}
        <div ref={mapElRef} style={{ flex: 1 }} />

        {/* ── 手機版「校車列表」浮動按鈕 ── */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="drawer-fab"
          style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#3b82f6', border: 'none', color: '#fff',
            padding: '10px 22px', borderRadius: 24, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', zIndex: 500, boxShadow: '0 4px 16px rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: "'Noto Sans TC', sans-serif",
          }}
        >
          🚌 校車列表
        </button>

        {/* ── 詳情面板 ── */}
        {selBus && (
          <div style={{ position: 'absolute', bottom: 16, right: 16, background: '#111827', border: '1px solid #1e3a5f', borderRadius: 12, padding: 14, width: 260, zIndex: 999 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{selBus.bus_name}</span>
              <span style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 18 }} onClick={() => { setSelBus(null); clearPath(); setShowPath(false); }}>×</span>
            </div>
            {[
              { label: '路線', value: selBus.route_name || '-' },
              { label: '司機', value: selBus.driver_name || '未指派' },
              { label: '狀態', value: selBus.session_id ? '🟢 行駛中' : '⚫ 未出發', color: selBus.session_id ? '#10b981' : '#94a3b8' },
              { label: '學生', value: `${selBus.boarded_count || 0} / ${selBus.student_count || 0} 人` },
              { label: '更新', value: selBus.last_seen ? new Date(selBus.last_seen).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #1e3a5f', color: '#94a3b8' }}>
                <span>{label}</span><strong style={{ color: color || '#e2e8f0' }}>{value}</strong>
              </div>
            ))}
            <button onClick={togglePath} style={{ width: '100%', marginTop: 10, background: showPath ? '#ef4444' : '#3b82f6', border: 'none', color: '#fff', padding: 7, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              {showPath ? '🗑️ 清除路徑' : '📍 今日行駛路徑'}
            </button>
          </div>
        )}
      </div>

      {/* ── 響應式 CSS ── */}
      <style>{`
        /* 桌機（768px 以上）：drawer 正常顯示，FAB 隱藏，關閉鈕隱藏 */
        @media (min-width: 768px) {
          .bus-drawer {
            position: relative !important;
            transform: none !important;
            z-index: auto !important;
          }
          .drawer-fab { display: none !important; }
          .drawer-close-btn { display: none !important; }
          .md-hide { display: none !important; }
        }

        /* 手機（767px 以下）：drawer 絕對定位，預設滑出畫面左側 */
        @media (max-width: 767px) {
          .bus-drawer {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            height: 100% !important;
            width: 85vw !important;
            max-width: 320px !important;
            z-index: 40 !important;
            transform: translateX(-100%) !important;
          }
          .bus-drawer.drawer-open {
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── 小元件 ──
function Pill({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <div style={{ background: '#1a2332', border: '1px solid #1e3a5f', borderRadius: 16, padding: '3px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace' }}>
      {children}
    </div>
  );
}
function DotSpan({ on }: { on?: boolean }) {
  return <div style={{ width: 7, height: 7, borderRadius: '50%', background: on ? '#10b981' : '#475569', boxShadow: on ? '0 0 5px #10b981' : 'none' }} />;
}
