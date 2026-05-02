'use client';
// src/app/admin/import/page.tsx — 新學期自動匯入（支援 Google 表單格式）
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// Google 表單欄位對應
const COL_MAP: Record<string, string> = {
  'j;6':                        'class_name',
  '班級':                        'class_name',
  '座號':                        'seat_no',
  '學生姓名':                    'student_name',
  '家長姓名':                    'parent_name',
  '家長聯繫電話':                'parent_phone',
  '住家地址':                    'address',
  '搭車時段':                    'direction',
  '上學地點(請填寫停車點名稱)':  'pickup_location',
  '放學地點 (請填寫停車點名稱)': 'dropoff_location',
  '放學時段 [星期一]':           'dismissal_mon',
  '放學時段 [星期二]':           'dismissal_tue',
  '放學時段 [星期三]':           'dismissal_wed',
  '放學時段 [星期四]':           'dismissal_thu',
  '放學時段 [星期五]':           'dismissal_fri',
};

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep]         = useState<'upload' | 'preview' | 'result'>('upload');
  const [rows, setRows]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const token   = () => localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

  const parseExcel = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // 對應欄位
      const mapped = raw.map(row => {
        const out: any = {};
        for (const [col, key] of Object.entries(COL_MAP)) {
          if (row[col] !== undefined) out[key] = String(row[col]).trim();
        }
        // 過濾掉完全空白的列
        return out;
      }).filter(r => r.student_name && r.parent_phone);

      setRows(mapped);
      setStep('preview');
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('請上傳 Excel 或 CSV 檔案');
      return;
    }
    parseExcel(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/import-semester`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ rows }),
      });
      const d = await r.json();
      setResult(d);
      setStep('result');
    } catch {
      alert('匯入失敗，請重試');
    }
    setLoading(false);
  };

  const dirLabel: Record<string, string> = {
    morning: '🌅 上學', afternoon: '🏫 放學', both: '🔄 上下學'
  };

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 text-xl">←</button>
        <div>
          <div className="text-white font-bold text-base">📥 新學期匯入</div>
          <div className="text-gray-500 text-xs">支援 Google 表單 Excel 格式</div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto">

        {/* Step 1: 上傳 */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* 說明 */}
            <div className="bg-blue-900/30 border border-blue-800/50 rounded-2xl p-4 space-y-2">
              <div className="text-blue-300 font-semibold text-sm">📋 支援的欄位格式</div>
              <div className="text-blue-200/70 text-xs space-y-1">
                <div>· 班級（j;6 欄）、座號、學生姓名、家長姓名、家長聯繫電話</div>
                <div>· 住家地址、搭車時段（上學/放學/上學, 放學）</div>
                <div>· 上學地點、放學地點、放學時段（星期一～五）</div>
              </div>
            </div>

            {/* 拖放區 */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer
                ${dragOver ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'}`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <div className="text-5xl mb-4">📂</div>
              <div className="text-white font-semibold mb-2">拖放 Excel 檔案到這裡</div>
              <div className="text-gray-500 text-sm">或點擊選擇檔案（.xlsx / .xls / .csv）</div>
              <input
                id="file-input" type="file" className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
            </div>

            {/* 格式提示 */}
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-2xl p-4">
              <div className="text-amber-400 text-xs font-semibold mb-2">⚠️ 注意事項</div>
              <div className="text-amber-300/70 text-xs space-y-1">
                <div>· 系統會自動建立家長帳號（帳號=手機號碼，密碼=後4碼）</div>
                <div>· 若停車點已設定對應校車，系統會自動分配；否則需手動指派</div>
                <div>· 同名同家長的學生資料會自動更新，不會重複建立</div>
                <div>· 匯入前請確認路線和停車點已在系統中設定完成</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 預覽 */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">{fileName}</div>
                <div className="text-gray-400 text-sm mt-0.5">共 {rows.length} 筆學生資料</div>
              </div>
              <button onClick={() => setStep('upload')} className="text-gray-500 text-sm hover:text-gray-300">重新選擇</button>
            </div>

            {/* 預覽表格 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <div className="text-gray-300 text-sm font-semibold">預覽（前10筆）</div>
                <div className="text-gray-500 text-xs">共 {rows.length} 筆</div>
              </div>
              <div className="overflow-x-auto">
                {rows.slice(0, 10).map((row, i) => (
                  <div key={i} className={`px-4 py-3 border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold text-sm">{row.student_name}</span>
                          {row.class_name && <span className="text-gray-500 text-xs">{row.class_name}</span>}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5">家長：{row.parent_name} · {row.parent_phone}</div>
                        {row.pickup_location && (
                          <div className="text-emerald-400/70 text-xs mt-1">↑ {row.pickup_location}</div>
                        )}
                        {row.dropoff_location && (
                          <div className="text-purple-400/70 text-xs">↓ {row.dropoff_location}</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-gray-500">{dirLabel[
                          row.direction === '上學' ? 'morning' :
                          row.direction === '放學' ? 'afternoon' : 'both'
                        ] || row.direction}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {[
                            row.dismissal_mon && `一${row.dismissal_mon}`,
                            row.dismissal_tue && `二${row.dismissal_tue}`,
                            row.dismissal_wed && `三${row.dismissal_wed}`,
                            row.dismissal_thu && `四${row.dismissal_thu}`,
                            row.dismissal_fri && `五${row.dismissal_fri}`,
                          ].filter(Boolean).join(' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {rows.length > 10 && (
                  <div className="px-4 py-3 text-center text-gray-600 text-xs">
                    還有 {rows.length - 10} 筆...
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> 匯入中...
                </span>
              ) : `確認匯入 ${rows.length} 筆學生資料`}
            </button>
          </div>
        )}

        {/* Step 3: 結果 */}
        {step === 'result' && result && (
          <div className="space-y-4">
            {/* 摘要卡 */}
            <div className={`rounded-2xl p-5 border ${result.ok ? 'bg-emerald-900/20 border-emerald-800/40' : 'bg-red-900/20 border-red-800/40'}`}>
              <div className={`text-lg font-bold mb-1 ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.ok ? '✅ 匯入完成' : '❌ 匯入失敗'}
              </div>
              <div className="text-gray-300 text-sm">{result.summary}</div>
            </div>

            {/* 統計 */}
            <div className="grid grid-cols-2 gap-3">
              <StatItem emoji="✅" label="新增學生" value={result.added} color="emerald" />
              <StatItem emoji="🔄" label="更新資料" value={result.updated} color="blue" />
              <StatItem emoji="⚠️" label="待分配校車" value={result.nobus} color="amber" />
              <StatItem emoji="❌" label="失敗" value={result.failed} color="red" />
            </div>

            {/* 待分配校車的學生 */}
            {result.unmatched?.length > 0 && (
              <div className="bg-amber-900/20 border border-amber-800/40 rounded-2xl p-4">
                <div className="text-amber-400 font-semibold text-sm mb-3">
                  ⚠️ 以下 {result.unmatched.length} 位學生找不到對應校車，請手動指派
                </div>
                <div className="space-y-2">
                  {result.unmatched.slice(0, 20).map((s: any, i: number) => (
                    <div key={i} className="bg-amber-900/10 rounded-xl p-3">
                      <div className="text-white text-sm font-semibold">{s.student_name}</div>
                      {s.pickup_location && <div className="text-amber-300/60 text-xs">↑ {s.pickup_location}</div>}
                      {s.dropoff_location && <div className="text-amber-300/60 text-xs">↓ {s.dropoff_location}</div>}
                    </div>
                  ))}
                  {result.unmatched.length > 20 && (
                    <div className="text-amber-400/60 text-xs text-center">還有 {result.unmatched.length - 20} 筆...</div>
                  )}
                </div>
              </div>
            )}

            {/* 錯誤清單 */}
            {result.errors?.length > 0 && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-4">
                <div className="text-red-400 font-semibold text-sm mb-2">❌ 錯誤明細</div>
                {result.errors.slice(0, 10).map((e: string, i: number) => (
                  <div key={i} className="text-red-300/70 text-xs py-1 border-b border-red-800/20 last:border-0">{e}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setStep('upload'); setResult(null); setRows([]); setFileName(''); }}
                className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-2xl transition-all">
                再次匯入
              </button>
              <button onClick={() => router.push('/admin')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition-all">
                回到後台
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ emoji, label, value, color }: { emoji: string; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-800/40 bg-emerald-950/30 text-emerald-400',
    blue:    'border-blue-800/40 bg-blue-950/30 text-blue-400',
    amber:   'border-amber-800/40 bg-amber-950/30 text-amber-400',
    red:     'border-red-800/40 bg-red-950/30 text-red-400',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-70 mt-0.5">{label}</div>
    </div>
  );
}
