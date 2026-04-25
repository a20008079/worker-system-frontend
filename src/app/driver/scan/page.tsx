'use client';
// src/app/driver/scan/page.tsx — 司機掃描學生證 + 今日名單
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type ScanResult = {
  status: 'ok' | 'wrong_bus' | 'not_found' | 'error';
  message: string;
  student?: { name: string; school_class: string };
};

type Student = {
  id: number; name: string; school_class: string;
  student_code: string; is_boarded: boolean; boarded_at: string | null;
};

export default function DriverScanPage() {
  const router = useRouter();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  const [tab, setTab]           = useState<'scan' | 'list'>('scan');
  const [scanning, setScanning] = useState(false);
  const [result, setResult]     = useState<ScanResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary]   = useState({ total: 0, boarded: 0, missing: 0 });
  const [listLoading, setListLoading] = useState(true);

  const token   = () => localStorage.getItem('token');
  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`,
  });

  const fetchStudents = useCallback(async () => {
    setListLoading(true);
    try {
      const r = await fetch(`${API}/api/driver/students`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = await r.json();
      setStudents(d.students || []);
      setSummary({ total: d.total || 0, boarded: d.boarded || 0, missing: d.missing || 0 });
    } catch {}
    setListLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
    return () => stopCamera();
  }, [fetchStudents]);

  const startCamera = async () => {
    setResult(null);
    setScanning(true);
    scanningRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const jsQR = (await import('jsqr')).default;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const scan = () => {
        if (!scanningRef.current) return;
        if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
          canvas.width  = videoRef.current!.videoWidth;
          canvas.height = videoRef.current!.videoHeight;
          ctx.drawImage(videoRef.current!, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            stopCamera();
            handleCode(code.data);
            return;
          }
        }
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    } catch {
      setScanning(false);
      setResult({ status: 'error', message: '無法開啟相機' });
    }
  };

  const stopCamera = () => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const handleCode = async (code: string) => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`${API}/api/driver/scan`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      const res: ScanResult = {
        status: d.status || (r.ok ? 'ok' : 'error'),
        message: d.message || d.error || '發生錯誤',
        student: d.student,
      };
      setResult(res);
      if (res.status === 'ok') fetchStudents(); // 更新名單
    } catch {
      setResult({ status: 'error', message: '連線失敗，請重試' });
    } finally {
      setLoading(false);
    }
  };

  const handleManual = () => {
    if (!manualCode.trim()) return;
    handleCode(manualCode.trim());
    setManualCode('');
  };

  const resultStyle = {
    ok:        { bg: 'bg-emerald-950/50 border-emerald-600/50', icon: '✅', text: 'text-emerald-400' },
    wrong_bus: { bg: 'bg-red-950/50 border-red-600/50',         icon: '🚫', text: 'text-red-400' },
    not_found: { bg: 'bg-amber-950/50 border-amber-600/50',     icon: '❓', text: 'text-amber-400' },
    error:     { bg: 'bg-gray-800 border-gray-700',             icon: '⚠️', text: 'text-gray-400' },
  };

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col max-w-sm mx-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => { stopCamera(); router.push('/driver'); }} className="text-gray-400 text-xl">←</button>
        <div className="flex-1">
          <div className="text-white font-bold">學生上車掃描</div>
          <div className="text-gray-500 text-xs">
            今日：{summary.boarded}/{summary.total} 人已上車
            {summary.missing > 0 && <span className="text-amber-400 ml-1">（{summary.missing} 人未到）</span>}
          </div>
        </div>
        <button onClick={fetchStudents} className="text-gray-400 text-sm">↻</button>
      </div>

      {/* Tab */}
      <div className="flex gap-2 px-4 py-3">
        <button onClick={() => { setTab('scan'); stopCamera(); }}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all
            ${tab === 'scan' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
          📷 掃描
        </button>
        <button onClick={() => { setTab('list'); stopCamera(); }}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all
            ${tab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
          📋 名單 {summary.missing > 0 && <span className="text-amber-300">({summary.missing})</span>}
        </button>
      </div>

      <div className="flex-1 px-4 pb-8 space-y-4">

        {/* ── 掃描 Tab ── */}
        {tab === 'scan' && (
          <>
            {scanning ? (
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline
                  className="w-full rounded-2xl bg-black aspect-square object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-52 h-52 relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-blue-400/60 animate-pulse" />
                  </div>
                </div>
                <button onClick={stopCamera}
                  className="mt-3 w-full py-3 rounded-2xl bg-gray-800 text-gray-300 text-sm">
                  取消掃描
                </button>
              </div>
            ) : (
              <button onClick={startCamera}
                className="w-full py-6 rounded-3xl bg-blue-600 hover:bg-blue-500 active:scale-95
                           text-white font-bold text-xl transition-all">
                📷 掃描學生證
              </button>
            )}

            {/* 手動輸入 */}
            {!scanning && (
              <div className="flex gap-2">
                <input
                  type="text" placeholder="手動輸入學生證號碼"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManual()}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                             text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500"
                />
                <button onClick={handleManual} disabled={loading || !manualCode.trim()}
                  className="px-4 py-3 rounded-xl bg-gray-700 text-white text-sm disabled:opacity-50">
                  {loading ? '...' : '確認'}
                </button>
              </div>
            )}

            {/* 掃描結果 */}
            {result && (
              <div className={`rounded-2xl border p-5 text-center ${resultStyle[result.status].bg}`}>
                <div className="text-4xl mb-3">{resultStyle[result.status].icon}</div>
                {result.student && (
                  <div className="mb-2">
                    <div className="text-white font-bold text-xl">{result.student.name}</div>
                    <div className="text-gray-400 text-sm">{result.student.school_class}</div>
                  </div>
                )}
                <div className={`font-semibold text-lg ${resultStyle[result.status].text}`}>
                  {result.message}
                </div>
                <button
                  onClick={() => { setResult(null); startCamera(); }}
                  className="mt-4 w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm">
                  繼續掃描
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 名單 Tab ── */}
        {tab === 'list' && (
          <>
            {/* 統計 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <div className="text-white font-bold text-2xl">{summary.total}</div>
                <div className="text-gray-500 text-xs">應載</div>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-3 text-center">
                <div className="text-emerald-400 font-bold text-2xl">{summary.boarded}</div>
                <div className="text-gray-500 text-xs">已上車</div>
              </div>
              <div className="bg-amber-950/40 border border-amber-800/40 rounded-2xl p-3 text-center">
                <div className="text-amber-400 font-bold text-2xl">{summary.missing}</div>
                <div className="text-gray-500 text-xs">未到</div>
              </div>
            </div>

            {/* 未上車（優先顯示）*/}
            {students.filter(s => !s.is_boarded).length > 0 && (
              <div>
                <div className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
                  ⚠️ 尚未上車
                </div>
                <div className="space-y-2">
                  {students.filter(s => !s.is_boarded).map(s => (
                    <div key={s.id} className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-900/40 flex items-center justify-center text-xl">👦</div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">{s.name}</div>
                        <div className="text-gray-500 text-xs">{s.school_class}</div>
                      </div>
                      <div className="text-amber-400 text-xs">未上車</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 已上車 */}
            {students.filter(s => s.is_boarded).length > 0 && (
              <div>
                <div className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
                  ✅ 已上車
                </div>
                <div className="space-y-2">
                  {students.filter(s => s.is_boarded).map(s => (
                    <div key={s.id} className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-900/40 flex items-center justify-center text-xl">👦</div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">{s.name}</div>
                        <div className="text-gray-500 text-xs">{s.school_class}</div>
                      </div>
                      <div className="text-emerald-400 text-xs">
                        {s.boarded_at ? new Date(s.boarded_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '已上車'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {listLoading && (
              <div className="text-gray-500 text-center py-8">載入中...</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
