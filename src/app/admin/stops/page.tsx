'use client';
// src/app/admin/stops/page.tsx
// 階段 3b — 站牌管理:選路線 → 顯示該路線站牌 → 在地圖上點位置 → 存座標
// 用 Leaflet + OpenStreetMap (跟既有 ParentMapView / BusMap 一致)

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchBuses, fetchStops, createStop, updateStop, deleteStop,
  reorderStops, importStopsFromStudents,
} from '@/lib/busApi';
import type { BusInfo, BusStop } from '@/types/bus';

// 校園 (預設地圖中心) - 桃園地區
const DEFAULT_CENTER: [number, number] = [24.9675, 121.2168];
const DEFAULT_ZOOM = 13;

export default function StopsPage() {
  const router = useRouter();
  const [buses, setBuses] = useState<BusInfo[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingStop, setEditingStop] = useState<BusStop | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const tempMarkerRef = useRef<any>(null);  // 編輯/新增時的暫時 marker
  const cssInjectedRef = useRef(false);
  // 「點地圖選位置」模式
  const [pickingMode, setPickingMode] = useState(false);
  const pickingModeRef = useRef(false);   // 因為 leaflet listener 需要最新值
  useEffect(() => { pickingModeRef.current = pickingMode; }, [pickingMode]);
  const [pickedLatLng, setPickedLatLng] = useState<[number, number] | null>(null);

  // ========== 初始載入 ==========
  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') { router.push('/admin/login'); return; }
    (async () => {
      try {
        const data = await fetchBuses();
        setBuses(data);
        if (data.length > 0) setSelectedBusId(data[0].id);
      } catch (e) {
        setMsg(`✗ 載入路線失敗:${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // ========== 選了路線後載站牌 ==========
  useEffect(() => {
    if (selectedBusId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchStops(selectedBusId);
        if (!cancelled) setStops(data);
      } catch (e) {
        if (!cancelled) setMsg(`✗ 載入站牌失敗:${(e as Error).message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBusId]);

  // ========== 初始化 Leaflet 地圖 ==========
  useEffect(() => {
    if (loading) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const init = async () => {
      // 插入 CSS
      if (!cssInjectedRef.current && !document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        cssInjectedRef.current = true;
      }
      await new Promise(r => setTimeout(r, 150));
      const L = (await import('leaflet')).default;

      const map = L.map(mapContainerRef.current!, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // 點地圖事件:在「選位置模式」時記錄座標
      map.on('click', (e: any) => {
        if (!pickingModeRef.current) return;
        const { lat, lng } = e.latlng;
        const ll: [number, number] = [Number(lat.toFixed(7)), Number(lng.toFixed(7))];
        setPickedLatLng(ll);
        // 放或更新暫時 marker
        if (tempMarkerRef.current) {
          tempMarkerRef.current.setLatLng(ll);
        } else {
          tempMarkerRef.current = L.marker(ll, {
            icon: L.divIcon({
              html: `<div style="width:32px;height:32px;background:#f59e0b;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:16px">📍</span></div>`,
              className: '',
              iconSize: [32, 32],
              iconAnchor: [16, 32],
            }),
          }).addTo(map);
        }
      });

      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    };
    init();

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
      markersRef.current = [];
      tempMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ========== 站牌變動時:更新地圖 markers ==========
  useEffect(() => {
    if (!mapRef.current) return;
    const renderMarkers = async () => {
      const L = (await import('leaflet')).default;
      // 清掉舊 markers
      markersRef.current.forEach((m) => { try { mapRef.current.removeLayer(m); } catch {} });
      markersRef.current = [];
      // 清掉暫時 marker
      if (tempMarkerRef.current) {
        try { mapRef.current.removeLayer(tempMarkerRef.current); } catch {}
        tempMarkerRef.current = null;
      }

      // 加新 markers (只加有座標的)
      const valid = stops.filter((s) => s.latitude != null && s.longitude != null);
      const latlngs: [number, number][] = [];
      for (const s of valid) {
        const ll: [number, number] = [Number(s.latitude), Number(s.longitude)];
        const orderLabel = s.stop_order ?? '?';
        const m = L.marker(ll, {
          icon: L.divIcon({
            html: `<div style="position:relative">
              <div style="width:36px;height:36px;background:#3b82f6;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;font-size:13px">
                <span style="transform:rotate(45deg)">${orderLabel}</span>
              </div>
            </div>`,
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
          }),
        }).bindPopup(`<b>${s.stop_name}</b><br>順序:${orderLabel}`);
        m.addTo(mapRef.current);
        markersRef.current.push(m);
        latlngs.push(ll);
      }

      // 自動 fit bounds (若有 2+ 站)
      if (latlngs.length >= 2) {
        try { mapRef.current.fitBounds(latlngs, { padding: [50, 50] }); } catch {}
      } else if (latlngs.length === 1) {
        mapRef.current.setView(latlngs[0], 15);
      } else {
        mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }
    };
    renderMarkers();
  }, [stops]);

  // ========== 操作 ==========
  const handleImportFromStudents = async () => {
    if (selectedBusId == null) return;
    setBusy(true); setMsg(null);
    try {
      const r = await importStopsFromStudents(selectedBusId);
      setMsg(`✓ ${r.message}`);
      const data = await fetchStops(selectedBusId);
      setStops(data);
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定刪除此站牌?')) return;
    setBusy(true); setMsg(null);
    try {
      await deleteStop(id);
      setStops((prev) => prev.filter((s) => s.id !== id));
      setMsg('✓ 已刪除');
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  // 拖曳排序 (上下移動)
  const moveStop = async (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= stops.length) return;
    const newOrder = [...stops];
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    setStops(newOrder);
    setBusy(true);
    try {
      await reorderStops(selectedBusId!, newOrder.map((s) => s.id));
      // 重 fetch 拿新 order
      const fresh = await fetchStops(selectedBusId!);
      setStops(fresh);
    } catch (e) {
      setMsg(`✗ 排序失敗:${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  // ========== 編輯 / 新增 modal 提交 ==========
  const handleSaveStop = async (data: {
    stop_name: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    pickup_time: string | null;
  }) => {
    setBusy(true); setMsg(null);
    try {
      if (editingStop) {
        await updateStop(editingStop.id, data);
        setMsg('✓ 已更新');
      } else {
        await createStop(selectedBusId!, data);
        setMsg('✓ 已新增');
      }
      const fresh = await fetchStops(selectedBusId!);
      setStops(fresh);
      setEditingStop(null);
      setAddingNew(false);
      setPickingMode(false);
      setPickedLatLng(null);
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  // ========== Render ==========
  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-950 text-gray-400 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-spin"
               style={{ border: '3px solid #1f2937', borderTopColor: '#3b82f6' }} />
          <div className="text-sm">載入中…</div>
        </div>
      </div>
    );
  }

  const selectedBus = buses.find((b) => b.id === selectedBusId);

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => router.push('/admin')}
                className="text-gray-400 hover:text-white text-sm">‹ 返回</button>
        <div className="flex-1">
          <div className="text-white font-bold text-lg">📍 站牌管理</div>
          <div className="text-gray-500 text-xs">選路線 · 點地圖加站 · 拖曳排序</div>
        </div>
        <select
          value={selectedBusId ?? ''}
          onChange={(e) => setSelectedBusId(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm">
          {buses.map((b) => (
            <option key={b.id} value={b.id}>{b.bus_name}</option>
          ))}
        </select>
      </div>

      {/* 主內容:左欄列表 + 右欄地圖 */}
      <div className="flex flex-1 min-h-0">
        {/* 左欄:站牌列表 */}
        <div className="w-full md:w-96 bg-gray-900 border-r border-gray-800 overflow-y-auto flex-shrink-0">
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAddingNew(true); setEditingStop(null); setPickedLatLng(null); setPickingMode(true); }}
                disabled={busy || !selectedBusId}
                className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white text-sm font-bold py-2 rounded-xl active:scale-95">
                + 新增站牌
              </button>
              <button
                onClick={handleImportFromStudents}
                disabled={busy || !selectedBusId}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95"
                title="從這條路線學生的 pickup_location 抓獨特站牌一鍵匯入(座標留空,之後手動補)">
                ⚡ 匯入
              </button>
            </div>

            {selectedBus && (
              <div className="text-xs text-gray-400 px-1 pt-1">
                {selectedBus.bus_name} · 共 {stops.length} 個站牌
              </div>
            )}

            {stops.length === 0 ? (
              <div className="bg-gray-800 border border-dashed border-gray-700 rounded-xl p-6 text-center text-gray-500 text-sm">
                此路線還沒有站牌。<br />
                點「+ 新增站牌」手動加,或點「⚡ 匯入」從學生資料抓。
              </div>
            ) : (
              <div className="space-y-2">
                {stops.map((s, idx) => {
                  const hasCoord = s.latitude != null && s.longitude != null;
                  return (
                    <div key={s.id}
                         className={`bg-gray-800 border rounded-xl p-3 ${hasCoord ? 'border-gray-700' : 'border-amber-700 bg-amber-950/30'}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <button onClick={() => moveStop(idx, -1)} disabled={busy || idx === 0}
                                  className="text-gray-500 hover:text-white disabled:text-gray-700 text-xs leading-none">▲</button>
                          <button onClick={() => moveStop(idx, 1)} disabled={busy || idx === stops.length - 1}
                                  className="text-gray-500 hover:text-white disabled:text-gray-700 text-xs leading-none">▼</button>
                        </div>
                        <div className="flex-shrink-0 w-7 h-7 bg-blue-700 text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {s.stop_order ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{s.stop_name}</div>
                          {hasCoord ? (
                            <div className="text-gray-400 text-xs mt-0.5">
                              📍 {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
                            </div>
                          ) : (
                            <div className="text-amber-400 text-xs mt-0.5">⚠️ 尚未設定座標</div>
                          )}
                          {s.address && (
                            <div className="text-gray-500 text-xs mt-0.5 truncate">{s.address}</div>
                          )}
                          {s.pickup_time && (
                            <div className="text-gray-500 text-xs mt-0.5">🕐 {s.pickup_time}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => { setEditingStop(s); setAddingNew(false); setPickedLatLng(s.latitude != null && s.longitude != null ? [Number(s.latitude), Number(s.longitude)] : null); setPickingMode(true); }}
                                disabled={busy}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 rounded-md">編輯</button>
                        <button onClick={() => handleDelete(s.id)} disabled={busy}
                                className="bg-red-900 hover:bg-red-800 text-red-200 text-xs px-3 py-1 rounded-md">刪</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {msg && (
              <div className={`text-xs px-2 py-1 rounded ${msg.startsWith('✗') ? 'text-red-400 bg-red-950' : 'text-emerald-400 bg-emerald-950'}`}>
                {msg}
              </div>
            )}
          </div>
        </div>

        {/* 右欄:地圖 */}
        <div className="flex-1 relative bg-gray-800">
          <div ref={mapContainerRef} className="w-full h-full" />
          {pickingMode && (
            <div className="absolute top-3 left-3 right-3 bg-amber-500 text-amber-950 font-bold px-4 py-2 rounded-xl shadow-lg text-sm flex items-center gap-2 z-[1000]">
              <span>👆</span>
              <span>請在地圖上點選站牌位置</span>
              {pickedLatLng && (
                <span className="text-xs font-normal">
                  已選 {pickedLatLng[0].toFixed(5)}, {pickedLatLng[1].toFixed(5)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 編輯/新增 Modal */}
      {(editingStop || addingNew) && (
        <StopEditModal
          stop={editingStop}
          pickedLatLng={pickedLatLng}
          onClose={() => {
            setEditingStop(null);
            setAddingNew(false);
            setPickingMode(false);
            setPickedLatLng(null);
            if (tempMarkerRef.current && mapRef.current) {
              try { mapRef.current.removeLayer(tempMarkerRef.current); } catch {}
              tempMarkerRef.current = null;
            }
          }}
          onSave={handleSaveStop}
          saving={busy}
        />
      )}
    </div>
  );
}

// ============================================================
// Edit / Create Modal
// ============================================================
interface ModalProps {
  stop: BusStop | null;
  pickedLatLng: [number, number] | null;
  onClose: () => void;
  onSave: (data: {
    stop_name: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    pickup_time: string | null;
  }) => void;
  saving: boolean;
}
function StopEditModal({ stop, pickedLatLng, onClose, onSave, saving }: ModalProps) {
  const [name, setName] = useState(stop?.stop_name || '');
  const [address, setAddress] = useState(stop?.address || '');
  const [pickupTime, setPickupTime] = useState(stop?.pickup_time || '');
  // 座標:優先用 picked,其次用 stop 既有,沒有就空
  const lat = pickedLatLng?.[0] ?? stop?.latitude ?? null;
  const lng = pickedLatLng?.[1] ?? stop?.longitude ?? null;

  const handleSubmit = () => {
    if (!name.trim()) { alert('請輸入站牌名稱'); return; }
    onSave({
      stop_name: name.trim(),
      latitude: lat,
      longitude: lng,
      address: address.trim() || null,
      pickup_time: pickupTime.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/70 p-3"
         onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md"
           onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="text-white font-bold">{stop ? '✏️ 編輯站牌' : '➕ 新增站牌'}</div>
          <div className="text-gray-500 text-xs mt-0.5">在地圖上點選位置以設定座標</div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">站牌名稱 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例:六和/九和二街口"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">座標</label>
            {lat != null && lng != null ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-emerald-400">
                📍 {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
              </div>
            ) : (
              <div className="bg-amber-950 border border-amber-700 rounded-lg px-3 py-2 text-sm text-amber-400">
                ⚠️ 尚未設定 — 請在地圖上點選位置
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">地址(備註,可選)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="例:桃園市中壢區六和路123號"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">上車時間(可選)</label>
            <input
              type="text"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              placeholder="例:0710"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex gap-2">
          <button onClick={onClose} disabled={saving}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-bold rounded-xl py-2.5 border border-gray-700">
            取消
          </button>
          <button onClick={handleSubmit} disabled={saving}
                  className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white text-sm font-bold rounded-xl py-2.5">
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
