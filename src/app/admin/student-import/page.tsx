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
  fetchGeocodeStatus, geocodeStep,
  type StudentImportRow, type ImportQuality, type ImportBatch, type StagedRowServer,
  type GeocodeProgress,
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

  const loadBatches = async () => {
    try { setBatches(await fetchImportBatches()); } catch { /* 忽略 */ }
  };
  useEffect(() => { loadBatches(); }, []);

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

  const showRows: any[] = serverRows.length > 0 ? serverRows : parsedRows;
  const filtered = filterFlag
    ? showRows.filter((r) => (r.quality_flags || computeLocalFlags(r)).includes(filterFlag))
    : showRows;

  return (
    <div style={S.page}>
      <h2 style={S.h2}>Google 表單匯入 <span style={S.badge}>3c-1</span></h2>
      <p style={S.sub}>上傳家長填寫的 Google 表單 (xlsx),系統解析後存入暫存區並標記資料品質問題。</p>

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
            地址過短的會自動標記為失敗,需老師手動補。
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
              <span style={{ color: '#dc2626' }}>失敗 <b>{geo.failed}</b></span>
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
              <span style={S.okText}>✓ 查詢完成（{geo.geocoded} 成功 / {geo.failed} 失敗）</span>
            )}
          </div>
          {geocoding && <p style={S.hint}>查詢中…每秒約 1 筆,請保持此頁開啟。可按「暫停」中斷。</p>}
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
