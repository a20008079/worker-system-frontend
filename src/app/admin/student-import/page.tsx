'use client';
// src/app/admin/student-import/page.tsx
// 階段 3c Step 3c-1 : Google 表單匯入 (上傳 + 預覽 479 筆 + 品質警告)
// 走方案 2:前端用 SheetJS 解析 xlsx -> 傳 JSON rows -> 後端寫 staging
//
// ★ Next.js App Router:檔名必須是 page.tsx,放在 app/admin/student-import/
//   自動對應網址 /admin/student-import,不用改路由檔
// ★ API 一律走 @/lib/busApi (跟 stops 頁一致,不自己 fetch、不自己組 token)
//
// 依賴: npm i xlsx

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  uploadStudentImport, fetchImportBatches, fetchImportBatch,
  fetchGeocodeStatus, geocodeStep, setStagingGeo,
  applyImportBatch, resetSemester,
  type StudentImportRow, type ImportQuality, type ImportBatch, type StagedRowServer,
  type GeocodeProgress, type ApplyImportResult,
} from '@/lib/busApi';

// ── Google 表單欄位 -> staging 欄位 的彈性對應 ──
// 已對齊真實檔 (google表單.xlsx) 的實際 header:
//   時間戳記/班級/座號/學生姓名/家長姓名/家長聯繫電話/住家地址/搭車時段/
//   上學地點(請填寫停車點名稱)/放學地點 (請填寫停車點名稱)/放學時段 [星期一..五]/備註
// 比對忽略空白。⚠「搭車時段」與「放學時段[星期X]」都含「時段」,
//   故 ride_period 只精確比「搭車時段」,放學各天用「星期X」,避免互搶。
const HEADER_MAP: { key: keyof StudentImportRow; match: string[] }[] = [
  { key: 'timestamp_raw', match: ['時間戳記', '時間戳', 'timestamp'] },
  { key: 'class_name',    match: ['班級'] },
  { key: 'seat_no',       match: ['座號'] },
  { key: 'student_name',  match: ['學生姓名'] },
  { key: 'parent_name',   match: ['家長姓名'] },
  { key: 'parent_phone',  match: ['家長聯繫電話', '家長電話', '聯繫電話', '電話', '手機'] },
  { key: 'home_address',  match: ['住家地址', '地址'] },
  { key: 'ride_period',   match: ['搭車時段'] },
  { key: 'pickup_stop',   match: ['上學地點'] },
  { key: 'dropoff_stop',  match: ['放學地點'] },
  { key: 'mon_time',      match: ['星期一', '放學一', '週一'] },
  { key: 'tue_time',      match: ['星期二', '放學二', '週二'] },
  { key: 'wed_time',      match: ['星期三', '放學三', '週三'] },
  { key: 'thu_time',      match: ['星期四', '放學四', '週四'] },
  { key: 'fri_time',      match: ['星期五', '放學五', '週五'] },
  { key: 'note',          match: ['備註', '備考', 'note'] },
];

const norm = (s: any) => String(s).replace(/\s/g, '');

function mapRow(raw: Record<string, any>, headers: string[], rowNum: number): StudentImportRow {
  const out: any = {
    row_num: rowNum, timestamp_raw: '', class_name: '', seat_no: '',
    student_name: '', parent_name: '', parent_phone: '', home_address: '',
    ride_period: '', pickup_stop: '', dropoff_stop: '', mon_time: '',
    tue_time: '', wed_time: '', thu_time: '', fri_time: '', note: '',
  };
  for (const { key, match } of HEADER_MAP) {
    const h = headers.find((hd) => match.some((m) => norm(hd).includes(norm(m))));
    if (h !== undefined) {
      const v = raw[h];
      out[key] = v === undefined || v === null ? '' : String(v).trim();
    }
  }
  return out as StudentImportRow;
}

const FLAG_LABEL: Record<string, { text: string; color: string }> = {
  short_addr:  { text: '地址過短', color: '#d97706' },
  phone_slash: { text: '電話含/',  color: '#7c3aed' },
  empty_stop:  { text: '地點空白', color: '#dc2626' },
  dup_seat:    { text: '班座重複', color: '#b91c1c' },
};

// 本地解析尚未上傳時,前端先算一份旗標供顯示 (上傳後以 server 的 quality_flags 為準)
// 邏輯須跟後端一致:「無」視同已填,不算 empty_stop;dup_seat 需全批比對,本地算不出
function computeLocalFlags(r: any): string {
  const flags: string[] = [];
  const addr = (r.home_address || '').trim();
  if (addr.length > 0 && addr.length < 10) flags.push('short_addr');
  if ((r.parent_phone || '').includes('/')) flags.push('phone_slash');
  const isBlank = (v: any) => (v ?? '').toString().trim() === '';
  const period = r.ride_period || '';
  if ((period.includes('上學') && isBlank(r.pickup_stop)) ||
      (period.includes('放學') && isBlank(r.dropoff_stop))) flags.push('empty_stop');
  return flags.join(',');
}

export default function StudentImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedRows, setParsedRows] = useState<StudentImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quality, setQuality] = useState<ImportQuality | null>(null);
  const [serverRows, setServerRows] = useState<StagedRowServer[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [err, setErr] = useState('');
  const [filterFlag, setFilterFlag] = useState('');
  // 3c-2 Geocoding
  const [geo, setGeo] = useState<GeocodeProgress | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const geocodingRef = useRef(false); // 用 ref 控制中斷
  // 3c-2 手動補座標
  const [manualEdit, setManualEdit] = useState<StagedRowServer | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [savingManual, setSavingManual] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapInstRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  // 需求 1:套用到正式名單 + 歸零重匯
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyImportResult | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const loadBatches = async () => {
    try { setBatches(await fetchImportBatches()); } catch { /* 忽略 */ }
  };
  useEffect(() => { loadBatches(); }, []);

  // 開啟側邊面板時初始化地圖
  useEffect(() => {
    if (!manualEdit || !mapDivRef.current) return;
    let cancelled = false;
    (async () => {
      // 動態載入 leaflet (站牌管理頁有用,前端已裝)
      const L = (await import('leaflet')).default as any;
      // CSS (確保 leaflet 樣式)
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet', '1');
        document.head.appendChild(link);
      }
      if (cancelled || !mapDivRef.current) return;
      // 已有舊地圖先清掉
      if (mapInstRef.current) {
        mapInstRef.current.remove();
        mapInstRef.current = null;
      }
      // 預設指到學校位置 (中壢有得雙語)
      const startLat = manualEdit.geo_lat ?? 24.9627;
      const startLng = manualEdit.geo_lng ?? 121.2435;
      const map = L.map(mapDivRef.current).setView([startLat, startLng], 15);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      // 已有座標就先放個 marker
      if (manualEdit.geo_lat && manualEdit.geo_lng) {
        markerRef.current = L.marker([manualEdit.geo_lat, manualEdit.geo_lng]).addTo(map);
        setPicked({ lat: manualEdit.geo_lat, lng: manualEdit.geo_lng });
      }
      // 點地圖任一處 = 標記座標
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }
        setPicked({ lat, lng });
      });
      mapInstRef.current = map;
      // 等 DOM 渲染完強制 invalidate (避免 modal 開時地圖灰塊)
      setTimeout(() => map.invalidateSize(), 100);
    })();
    return () => { cancelled = true; };
  }, [manualEdit?.id]);

  // 選檔 -> 前端解析
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(''); setParsing(true); setBatchId(''); setQuality(null); setServerRows([]);
    setFileName(f.name);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true }); // cellDates: 時間戳記讀成日期
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (aoa.length < 2) { setErr('檔案沒有資料列'); setParsing(false); return; }
      const headers = (aoa[0] as any[]).map((h) => String(h).trim());
      const rows: StudentImportRow[] = [];
      for (let i = 1; i < aoa.length; i++) {
        const arr = aoa[i];
        if (!arr || arr.every((c) => String(c).trim() === '')) continue;
        const raw: Record<string, any> = {};
        headers.forEach((h, idx) => { raw[h] = arr[idx]; });
        rows.push(mapRow(raw, headers, i + 1));
      }
      setParsedRows(rows);
    } catch (ex: any) {
      setErr('解析失敗: ' + (ex?.message || String(ex)));
    } finally {
      setParsing(false);
    }
  };

  // 上傳到後端 staging
  const onUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true); setErr('');
    try {
      const d = await uploadStudentImport(parsedRows);
      setBatchId(d.batch_id);
      setQuality(d.quality);
      await loadBatches();
      await loadBatch(d.batch_id);
      await loadGeo(d.batch_id);
    } catch (ex: any) {
      setErr('上傳失敗: ' + (ex?.message || String(ex)));
    } finally {
      setUploading(false);
    }
  };

  // 載某批次明細
  const loadBatch = async (bid: string) => {
    setErr('');
    try {
      const d = await fetchImportBatch(bid);
      setBatchId(bid);
      loadGeo(bid);
      setQuality(d.quality);
      setServerRows(d.rows || []);
      setParsedRows([]);
    } catch (ex: any) {
      setErr('讀取失敗: ' + (ex?.message || String(ex)));
    }
  };

  // 進某批次時,順便載入 geocoding 進度
  const loadGeo = async (bid: string) => {
    try { setGeo(await fetchGeocodeStatus(bid)); } catch { setGeo(null); }
  };

  // 開始/繼續查座標:反覆呼叫 geocodeStep 直到 remaining=0 或被中斷
  const startGeocode = async () => {
    if (!batchId || geocoding) return;
    setGeocoding(true);
    geocodingRef.current = true;
    try {
      let done = false;
      while (geocodingRef.current && !done) {
        const r = await geocodeStep(batchId, 10);
        setGeo({ total: r.total, geocoded: r.geocoded, failed: r.failed, remaining: r.remaining });
        if (r.remaining <= 0) done = true;
      }
    } catch (ex: any) {
      setErr('查詢座標失敗: ' + (ex?.message || String(ex)) + ' (可能是後端無法連線到 Nominatim,或網路問題。可按繼續重試)');
    } finally {
      setGeocoding(false);
      geocodingRef.current = false;
    }
  };

  const stopGeocode = () => { geocodingRef.current = false; };

  // 開啟側邊面板
  const openManual = (row: StagedRowServer) => {
    setManualEdit(row);
    setPicked(null);
    setSearchInput(row.home_address || '');
    setSearchErr('');
  };
  const closeManual = () => {
    setManualEdit(null);
    setPicked(null);
    setSearchInput('');
    setSearchErr('');
    if (mapInstRef.current) {
      mapInstRef.current.remove();
      mapInstRef.current = null;
      markerRef.current = null;
    }
  };

  // 用搜尋框查地址,跳到地圖位置
  const doSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    setSearching(true);
    setSearchErr('');
    try {
      // 直接用 OSM (前端打,免後端;有 CORS 開放)
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=tw&accept-language=zh-TW`;
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await resp.json();
      if (!Array.isArray(data) || data.length === 0) {
        setSearchErr('找不到此地址,請改換寫法(可只留路名)或直接在地圖上手動點');
        return;
      }
      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);
      const L = (await import('leaflet')).default as any;
      if (mapInstRef.current) {
        mapInstRef.current.setView([lat, lng], 17);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(mapInstRef.current);
        }
        setPicked({ lat, lng });
      }
    } catch (ex: any) {
      setSearchErr('搜尋失敗: ' + (ex?.message || String(ex)));
    } finally {
      setSearching(false);
    }
  };
  // 儲存手動座標
  const saveManual = async () => {
    if (!manualEdit || !picked) return;
    setSavingManual(true);
    try {
      await setStagingGeo(manualEdit.id, picked.lat, picked.lng);
      // 重新載入該批次,讓清單更新
      if (batchId) {
        await loadBatch(batchId);
        await loadGeo(batchId);
      }
      closeManual();
    } catch (ex: any) {
      setErr('儲存失敗: ' + (ex?.message || String(ex)));
    } finally {
      setSavingManual(false);
    }
  };

  // 重置這批次的 geocoding 狀態 (除錯/重跑用)
  const resetGeocode = async () => {
    if (!batchId) return;
    if (!confirm(`確定要重置批次 ${batchId} 的座標查詢狀態嗎?所有筆數會變回「待查」,需要重跑。`)) return;
    try {
      const tok = localStorage.getItem('token');
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/admin/student-import/${batchId}/geocode-reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadGeo(batchId);
      setErr('');
    } catch (ex: any) {
      setErr('重置失敗: ' + (ex?.message || String(ex)));
    }
  };

  // 需求 1:把這批次套用到正式 students 表(只處理還沒套用過的列,可重複點)
  const handleApply = async () => {
    if (!batchId) return;
    if (!confirm(`確定要把批次 ${batchId} 套用到正式學生名單嗎?\n會新增/更新 students 資料。已套用過的列不會重複處理。`)) return;
    setApplying(true); setErr(''); setApplyResult(null);
    try {
      const r = await applyImportBatch(batchId);
      setApplyResult(r);
      await loadBatch(batchId);
      await loadBatches();
    } catch (ex: any) {
      setErr('套用失敗: ' + (ex?.message || String(ex)));
    } finally {
      setApplying(false);
    }
  };

  const showRows: any[] = serverRows.length > 0 ? serverRows : parsedRows;
  const filtered = filterFlag
    ? showRows.filter((r) => (r.quality_flags || computeLocalFlags(r)).includes(filterFlag))
    : showRows;
  const appliedCount = serverRows.filter((r) => Number(r.applied) === 1).length;
  const pendingApplyCount = serverRows.length > 0 ? serverRows.length - appliedCount : 0;

  return (
    <div style={S.page}>
      <h2 style={S.h2}>Google 表單匯入 <span style={S.badge}>3c-1</span></h2>
      <p style={S.sub}>上傳家長填寫的 Google 表單 (xlsx),系統解析後存入暫存區並標記資料品質問題。</p>

      {/* 需求 1:歸零重匯入口 */}
      <div style={{ ...S.card, background: '#fef2f2', border: '1px solid #fecaca' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>新學期開始?</div>
            <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2 }}>
              歸零重匯會清空目前所有學生資料(保留校車路線 / 司機 / 家長帳號),再上傳新學期的表單重新開始。
            </div>
          </div>
          <button
            style={{ ...S.btn, background: '#dc2626', color: '#fff', border: '1px solid #dc2626', whiteSpace: 'nowrap' }}
            onClick={() => setShowResetModal(true)}
          >
            🗑️ 歸零重匯
          </button>
        </div>
        {resetMsg && <div style={S.okBox}>✓ {resetMsg}</div>}
      </div>

      {/* 上傳區 */}
      <div style={S.card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls"
                 onChange={onFile} style={{ display: 'none' }} />
          <button style={S.btn} onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? '解析中…' : '選擇 xlsx 檔'}
          </button>
          {fileName && <span style={S.fileName}>{fileName}</span>}
          {parsedRows.length > 0 && (
            <>
              <span style={S.okText}>已解析 {parsedRows.length} 筆</span>
              <button style={{ ...S.btn, ...S.btnPrimary }} onClick={onUpload} disabled={uploading}>
                {uploading ? '上傳中…' : `上傳這 ${parsedRows.length} 筆到暫存區`}
              </button>
            </>
          )}
        </div>
        {err && <div style={S.err}>{err}</div>}
        {batchId && (
          <div style={S.okBox}>
            ✓ 已存入暫存區 — 批次 <code>{batchId}</code>,共 {showRows.length} 筆
          </div>
        )}
      </div>

      {/* 品質統計 */}
      {quality && (
        <div style={S.card}>
          <div style={S.cardTitle}>資料品質警告</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <FlagChip label="全部" count={showRows.length} active={filterFlag === ''}
                      color="#334155" onClick={() => setFilterFlag('')} />
            {Object.keys(FLAG_LABEL).map((f) => (
              <FlagChip key={f} label={FLAG_LABEL[f].text} count={(quality as any)[f] || 0}
                        color={FLAG_LABEL[f].color} active={filterFlag === f}
                        onClick={() => setFilterFlag(filterFlag === f ? '' : f)} />
            ))}
          </div>
          <p style={S.hint}>
            這些問題需老師之後手動處理(地址過短會導致 Geocoding 失敗、班座重複需確認是否同一人)。點標籤可篩選。
          </p>
        </div>
      )}

      {/* 3c-2 座標查詢 */}
      {batchId && geo && (
        <div style={S.card}>
          <div style={S.cardTitle}>座標查詢（Geocoding）</div>
          <p style={S.hint}>
            用 OpenStreetMap 免費服務查每位學生住家的經緯度,供之後推薦路線用。
            限速關係,479 筆約需 8-10 分鐘,可中途暫停、之後再繼續(已查過的不會重跑)。
            地址過短或查不到的會標記為「待手動」,匯總後請老師逐筆檢查補座標。
          </p>

          {/* 進度條 */}
          <div style={{ margin: '12px 0' }}>
            <div style={{ height: 14, background: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${geo.total > 0 ? Math.round(((geo.geocoded + geo.failed) / geo.total) * 100) : 0}%`,
                background: 'linear-gradient(90deg,#4338ca,#6366f1)',
                transition: 'width .3s',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, flexWrap: 'wrap' }}>
              <span>總計 <b>{geo.total}</b></span>
              <span style={{ color: '#059669' }}>已查到座標 <b>{geo.geocoded}</b></span>
              <span style={{ color: '#dc2626' }}>待手動 <b>{geo.failed}</b></span>
              <span style={{ color: '#64748b' }}>待查 <b>{geo.remaining}</b></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {!geocoding && geo.remaining > 0 && (
              <button style={{ ...S.btn, ...S.btnPrimary }} onClick={startGeocode}>
                {geo.geocoded + geo.failed > 0 ? '繼續查詢' : '開始查詢座標'}
              </button>
            )}
            {geocoding && (
              <button style={S.btn} onClick={stopGeocode}>暫停</button>
            )}
            {geo.remaining === 0 && geo.total > 0 && (
              <span style={S.okText}>✓ 查詢完成({geo.geocoded} 成功 / {geo.failed} 待手動)</span>
            )}
            {!geocoding && (geo.geocoded > 0 || geo.failed > 0) && (
              <button style={{ ...S.btn, color: '#dc2626', borderColor: '#fecaca' }} onClick={resetGeocode}>
                重置(全部重查)
              </button>
            )}
          </div>
          {geocoding && <p style={S.hint}>查詢中…每秒約 1 筆,請保持此頁開啟。可按「暫停」中斷。</p>}
        </div>
      )}

      {/* 3c-2 待手動清單 */}
      {batchId && (() => {
        const manualList = (serverRows || []).filter(r => r.match_status === 'needs_manual');
        if (manualList.length === 0) return null;
        return (
          <div style={S.card}>
            <div style={S.cardTitle}>
              待手動補座標({manualList.length} 筆)
            </div>
            <p style={S.hint}>
              這些學生的住家地址 OSM 查不到精確位置,需要老師在地圖上手動標位置。
              點右側「📍 標位置」開啟地圖,點選位置後儲存即可。
            </p>
            <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>班級</th>
                    <th style={S.th}>姓名</th>
                    <th style={S.th}>地址</th>
                    <th style={S.th}>家長</th>
                    <th style={S.th}>電話</th>
                    <th style={S.th}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {manualList.slice(0, 500).map((r) => (
                    <tr key={r.id} style={{ background: '#fffbeb' }}>
                      <td style={S.td}>{r.class_name}</td>
                      <td style={S.td}>{r.student_name}</td>
                      <td style={{ ...S.td, maxWidth: 280 }}>{r.home_address || '（空白）'}</td>
                      <td style={S.td}>{r.parent_name}</td>
                      <td style={S.td}>{r.parent_phone}</td>
                      <td style={S.td}>
                        <button style={{ ...S.btn, ...S.btnPrimary, padding: '4px 10px', fontSize: 12 }}
                          onClick={() => openManual(r)}>📍 標位置</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 3c-2 側邊地圖面板 */}
      {manualEdit && (
        <>
          {/* 半透明遮罩(點外面不關閉,避免誤觸,要按 X 或取消) */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', zIndex: 999,
          }} onClick={() => { /* 不關閉,僅遮罩 */ }} />
          {/* 右側面板 */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(540px, 92vw)', background: '#fff',
            boxShadow: '-4px 0 12px rgba(0,0,0,0.2)',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    手動補座標 — {manualEdit.class_name} {manualEdit.student_name}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    家長填寫地址:<b>{manualEdit.home_address || '(空白)'}</b>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    家長:{manualEdit.parent_name} · 電話:{manualEdit.parent_phone}
                  </div>
                </div>
                <button onClick={closeManual} style={{
                  background: 'transparent', border: 'none', fontSize: 24,
                  color: '#94a3b8', cursor: 'pointer', padding: 0, lineHeight: 1,
                }}>×</button>
              </div>
            </div>
            {/* 搜尋框 — 直接打地址跳到位置 */}
            <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
                  placeholder="輸入地址搜尋(例:中壢區福州二街)"
                  style={{
                    flex: 1, padding: '6px 10px', fontSize: 13,
                    border: '1px solid #cbd5e1', borderRadius: 6,
                  }}
                />
                <button onClick={doSearch} disabled={searching || !searchInput.trim()}
                  style={{ ...S.btn, padding: '6px 14px', fontSize: 13 }}>
                  {searching ? '搜尋中…' : '🔍 搜尋'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: '#64748b' }}>
                <button onClick={() => { setSearchInput(manualEdit?.home_address || ''); setSearchErr(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#4338ca', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  ↻ 還原家長地址
                </button>
                <span>· Enter 也可搜尋 · 找不到可改寫(去掉樓號/巷弄)再試</span>
              </div>
              {searchErr && (
                <div style={{ marginTop: 6, padding: 6, fontSize: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 6 }}>
                  {searchErr}
                </div>
              )}
            </div>
            <div ref={mapDivRef} style={{ flex: 1, minHeight: 320 }} />
            <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              {picked ? (
                <div style={{ fontSize: 13, marginBottom: 10 }}>
                  已選:<code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4 }}>
                    {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
                  </code>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
                  尚未選位置 — 在地圖上點一下要的位置
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...S.btn, flex: 1 }} onClick={closeManual} disabled={savingManual}>取消</button>
                <button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} onClick={saveManual}
                  disabled={!picked || savingManual}>
                  {savingManual ? '儲存中…' : '儲存座標'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 需求 1:套用到正式學生名單 */}
      {batchId && serverRows.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>套用到正式學生名單</div>
          <p style={S.hint}>
            確認上面的資料(品質警告、座標)沒問題後,點下面按鈕把這批資料寫進正式 students 表。
            已經套用過的列不會重複處理,可以放心重複點(例如補完座標後再套用一次剩下的)。
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 13 }}>
            <span>共 <b>{serverRows.length}</b> 筆</span>
            <span style={{ color: '#059669' }}>已套用 <b>{appliedCount}</b></span>
            <span style={{ color: '#d97706' }}>待套用 <b>{pendingApplyCount}</b></span>
          </div>
          {pendingApplyCount > 0 ? (
            <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleApply} disabled={applying}>
              {applying ? '套用中…' : `套用剩下 ${pendingApplyCount} 筆`}
            </button>
          ) : (
            <span style={S.okText}>✓ 這批已全部套用完成</span>
          )}

          {applyResult && (
            <div style={{ marginTop: 14 }}>
              <div style={S.okBox}>{applyResult.summary}</div>
              {applyResult.errors.length > 0 && (
                <div style={{ ...S.err, marginTop: 8 }}>
                  {applyResult.errors.length} 筆處理失敗:
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {applyResult.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {applyResult.unmatched.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706', marginBottom: 6 }}>
                    {applyResult.unmatched.length} 位沒對到站牌,已建立學生但尚未指派校車(需要到「校車管理」頁手動指派):
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>列</th>
                          <th style={S.th}>姓名</th>
                          <th style={S.th}>上學站</th>
                          <th style={S.th}>放學站</th>
                          <th style={S.th}>家長電話</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applyResult.unmatched.map((u, i) => (
                          <tr key={i} style={{ background: '#fffbeb' }}>
                            <td style={S.td}>{u.row_num}</td>
                            <td style={S.td}>{u.student_name}</td>
                            <td style={S.td}>{u.pickup_stop}</td>
                            <td style={S.td}>{u.dropoff_stop}</td>
                            <td style={S.td}>{u.parent_phone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 既有批次 */}
      {batches.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>歷史批次(每學期保留)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {batches.map((b) => (
              <button key={b.batch_id}
                      style={{ ...S.batchBtn, ...(b.batch_id === batchId ? S.batchActive : {}) }}
                      onClick={() => loadBatch(b.batch_id)}>
                {b.batch_id} · {b.total} 筆
                {Number(b.applied_count) > 0 && <span style={S.appliedTag}>已套用</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 資料表 */}
      {showRows.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>
            預覽 {filtered.length}{filterFlag ? ` / ${showRows.length}` : ''} 筆
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['列', '班級', '座號', '姓名', '家長', '電話', '地址', '時段',
                    '上學站', '放學站', '一', '二', '三', '四', '五', '問題'].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 600).map((r, i) => {
                  const flags = r.quality_flags || computeLocalFlags(r);
                  const hasProblem = (flags || '').length > 0;
                  return (
                    <tr key={i} style={hasProblem ? S.trWarn : undefined}>
                      <td style={S.td}>{r.row_num}</td>
                      <td style={S.td}>{r.class_name}</td>
                      <td style={S.td}>{r.seat_no}</td>
                      <td style={S.td}>{r.student_name}</td>
                      <td style={S.td}>{r.parent_name}</td>
                      <td style={S.td}>{r.parent_phone}</td>
                      <td style={{ ...S.td, maxWidth: 220 }}>{r.home_address}</td>
                      <td style={S.td}>{r.ride_period}</td>
                      <td style={S.td}>{r.pickup_stop}</td>
                      <td style={S.td}>{r.dropoff_stop}</td>
                      <td style={S.td}>{r.mon_time}</td>
                      <td style={S.td}>{r.tue_time}</td>
                      <td style={S.td}>{r.wed_time}</td>
                      <td style={S.td}>{r.thu_time}</td>
                      <td style={S.td}>{r.fri_time}</td>
                      <td style={S.td}>
                        {(flags || '').split(',').filter(Boolean).map((f: string) => (
                          <span key={f} style={{
                            ...S.miniTag,
                            background: (FLAG_LABEL[f]?.color || '#999') + '22',
                            color: FLAG_LABEL[f]?.color || '#666',
                          }}>{FLAG_LABEL[f]?.text || f}</span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 600 && (
            <p style={S.hint}>表格僅顯示前 600 列(共 {filtered.length} 筆),完整資料已存入暫存區。</p>
          )}
        </div>
      )}

      {/* 需求 1:歸零重匯確認彈窗 */}
      {showResetModal && (
        <ResetSemesterModal
          onClose={() => setShowResetModal(false)}
          onDone={(msg) => {
            setResetMsg(msg);
            setBatchId('');
            setServerRows([]);
            setParsedRows([]);
            setQuality(null);
            setGeo(null);
            setApplyResult(null);
            loadBatches();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// 需求 1:歸零重匯確認彈窗 — 要求打字輸入 RESET 才能按下確認
// (跟後端 body 需要 { confirm: "RESET" } 呼應,雙重防呆)
// ============================================================
function ResetSemesterModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ok = typed.trim() === 'RESET';

  const doReset = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await resetSemester();
      onDone(r.message);
      onClose();
    } catch (ex: any) {
      setErr('歸零失敗: ' + (ex?.message || String(ex)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, maxWidth: '100%' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#b91c1c', marginBottom: 10 }}>
          ⚠️ 歸零重匯 — 這個動作無法復原
        </div>
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>
          會刪除<b>目前所有學生資料</b>,以及對應的刷卡紀錄與修改紀錄。<br />
          <b style={{ color: '#059669' }}>會保留</b>:校車路線(buses)、司機帳號(drivers)、家長帳號(parents)。<br />
          請先確認新學期的 Google 表單已經準備好,再執行這個動作。
        </p>
        <p style={{ fontSize: 13, marginTop: 14, marginBottom: 6 }}>
          請輸入 <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>RESET</code> 以確認:
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="輸入 RESET"
          autoFocus
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
        />
        {err && <div style={S.err}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button style={{ ...S.btn, flex: 1 }} onClick={onClose} disabled={busy}>取消</button>
          <button
            style={{
              ...S.btn, flex: 1,
              background: ok ? '#dc2626' : '#f1f5f9',
              color: ok ? '#fff' : '#94a3b8',
              border: `1px solid ${ok ? '#dc2626' : '#cbd5e1'}`,
              cursor: ok ? 'pointer' : 'not-allowed',
            }}
            onClick={doReset}
            disabled={!ok || busy}
          >
            {busy ? '刪除中…' : '確認歸零'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlagChip({ label, count, color, active, onClick }: {
  label: string; count: number; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${color}`, background: active ? color : 'transparent',
      color: active ? '#fff' : color, borderRadius: 999, padding: '4px 14px',
      fontSize: 13, cursor: 'pointer', fontWeight: 600,
    }}>
      {label} {count}
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: 24, maxWidth: 1280, margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#1e293b' },
  h2: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' },
  badge: { fontSize: 12, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 6, marginLeft: 8, verticalAlign: 'middle' },
  sub: { color: '#64748b', fontSize: 14, margin: '0 0 18px' },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)' },
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12 },
  btn: { border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer', fontWeight: 600 },
  btnPrimary: { background: '#4338ca', color: '#fff', border: '1px solid #4338ca' },
  fileName: { fontSize: 13, color: '#475569' },
  okText: { color: '#059669', fontWeight: 600, fontSize: 14 },
  okBox: { marginTop: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '8px 12px', borderRadius: 8, fontSize: 14 },
  err: { marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 14 },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: 10 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
  th: { background: '#f1f5f9', padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 700 },
  td: { padding: '6px 10px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  trWarn: { background: '#fffbeb' },
  miniTag: { display: 'inline-block', fontSize: 11, padding: '1px 6px', borderRadius: 4, marginRight: 4, fontWeight: 600 },
  batchBtn: { border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' },
  batchActive: { background: '#eef2ff', border: '1px solid #818cf8', color: '#4338ca', fontWeight: 700 },
  appliedTag: { fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '1px 5px', borderRadius: 4, marginLeft: 6 },
};
