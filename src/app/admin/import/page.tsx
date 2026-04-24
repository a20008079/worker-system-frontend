'use client';
// src/app/admin/import/page.tsx — Excel/CSV 批次匯入
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const TEMPLATE_HEADERS = ['student_name','class_name','parent_name','parent_phone','route_name','bus_name','student_code'];
const TEMPLATE_EXAMPLE = [
  ['王小明','三年二班','王爸爸','0912345678','觀音線','觀音線01','S001'],
  ['李小美','四年一班','李媽媽','0923456789','觀音線','觀音線02','S002'],
  ['張小強','二年三班','張爸爸','0934567890','大園線','大園線01','S003'],
];

export default function ImportPage() {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows]       = useState<any[]>([]);
  const [result, setResult]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');

  const token = () => localStorage.getItem('token');

  // 下載範本
  const downloadTemplate = () => {
    const csvContent = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE]
      .map(r => r.join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = '學生名單範本.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // 讀取 CSV/Excel
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const text = await file.text();
      parseCSV(text);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('xlsx');
      const ab   = await file.arrayBuffer();
      const wb   = XLSX.read(ab, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (data.length < 2) { setMsg('檔案沒有資料'); return; }
      const headers: string[] = data[0].map((h: any) => String(h).trim());
      const parsed = data.slice(1)
        .filter((r: any[]) => r.some(c => c !== undefined && c !== ''))
        .map((r: any[]) => {
          const obj: any = {};
          headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? String(r[i]).trim() : ''; });
          return obj;
        });
      setRows(parsed);
      setMsg(`已讀取 ${parsed.length} 筆資料`);
    } else {
      setMsg('請上傳 .csv 或 .xlsx 檔案');
    }
  };

  const parseCSV = (text: string) => {
    const lines   = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.replace(/^\uFEFF/, '').trim());
    const parsed  = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    }).filter(r => r.student_name);
    setRows(parsed);
    setMsg(`已讀取 ${parsed.length} 筆資料`);
  };

  const handleImport = async () => {
    if (rows.length === 0) { setMsg('請先選擇檔案'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ rows }),
      });
      const d = await r.json();
      setResult(d);
      setRows([]);
      if (fileRef.current) fileRef.current.value = '';
    } catch { setMsg('匯入失敗，請稍後再試'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/admin')} className="text-gray-400 text-xl">←</button>
        <div>
          <div className="text-white font-bold">批次匯入學生名單</div>
          <div className="text-gray-500 text-xs">支援 CSV / Excel</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">
        {/* 下載範本 */}
        <div className="bg-blue-950/30 border border-blue-800/40 rounded-2xl p-4">
          <div className="text-blue-300 font-semibold mb-1">📋 第一步：下載範本</div>
          <div className="text-gray-400 text-sm mb-3">先下載範本，照格式填好後再上傳</div>
          <button onClick={downloadTemplate}
            className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-medium text-sm">
            ⬇️ 下載學生名單範本 (.csv)
          </button>
        </div>

        {/* 欄位說明 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="text-gray-400 text-xs font-semibold mb-2">欄位說明</div>
          <div className="space-y-1">
            {[
              ['student_name',  '學生姓名', '必填'],
              ['class_name',    '班級',     '選填'],
              ['parent_name',   '家長姓名', '必填'],
              ['parent_phone',  '家長手機', '必填（作為帳號）'],
              ['route_name',    '路線名稱', '參考用'],
              ['bus_name',      '校車名稱', '必填（如：觀音線01）'],
              ['student_code',  '學生證號', '選填'],
            ].map(([key, label, note]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <code className="bg-gray-800 px-2 py-0.5 rounded text-blue-400 min-w-[120px]">{key}</code>
                <span className="text-gray-300">{label}</span>
                <span className="text-gray-600 ml-auto">{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 上傳 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="text-gray-400 text-xs font-semibold mb-3">📁 第二步：上傳檔案</div>
          <label className="block w-full py-5 border-2 border-dashed border-gray-700 rounded-xl
                            text-center cursor-pointer hover:border-blue-600 transition-colors">
            <div className="text-3xl mb-2">📂</div>
            <div className="text-gray-300 text-sm">點此選擇 CSV 或 Excel 檔案</div>
            <div className="text-gray-600 text-xs mt-1">.csv / .xlsx / .xls</div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
          {msg && !result && (
            <div className="mt-3 text-center text-sm text-gray-300">{msg}</div>
          )}
        </div>

        {/* 預覽 */}
        {rows.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="text-gray-400 text-xs font-semibold mb-3">預覽（前5筆）</div>
            <div className="space-y-2">
              {rows.slice(0, 5).map((r, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-3 text-xs">
                  <div className="text-white font-medium">{r.student_name} · {r.class_name}</div>
                  <div className="text-gray-400 mt-0.5">家長：{r.parent_name} {r.parent_phone}</div>
                  <div className="text-gray-500">校車：{r.bus_name}</div>
                </div>
              ))}
              {rows.length > 5 && (
                <div className="text-gray-600 text-xs text-center">... 還有 {rows.length - 5} 筆</div>
              )}
            </div>
            <button onClick={handleImport} disabled={loading}
              className="w-full mt-4 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500
                         text-white font-bold text-lg disabled:opacity-50">
              {loading ? '匯入中...' : `🚀 開始匯入 ${rows.length} 筆`}
            </button>
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="text-white font-bold text-lg mb-4 text-center">匯入完成</div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3 text-center">
                <div className="text-emerald-400 font-bold text-2xl">{result.added}</div>
                <div className="text-gray-500 text-xs">新增</div>
              </div>
              <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 text-center">
                <div className="text-blue-400 font-bold text-2xl">{result.updated}</div>
                <div className="text-gray-500 text-xs">更新</div>
              </div>
              <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-3 text-center">
                <div className="text-red-400 font-bold text-2xl">{result.failed}</div>
                <div className="text-gray-500 text-xs">失敗</div>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
                <div className="text-red-400 text-xs font-semibold mb-2">失敗原因</div>
                {result.errors.map((e: string, i: number) => (
                  <div key={i} className="text-red-300 text-xs">• {e}</div>
                ))}
              </div>
            )}
            <button onClick={() => { setResult(null); setMsg(''); }}
              className="w-full mt-4 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">
              繼續匯入
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
