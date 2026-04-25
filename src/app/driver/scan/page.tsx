'use client';
// src/app/driver/scan/page.tsx — 司機掃描學生證（連續掃描模式）
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
  const cooldownRef = useRef(false); // 防止重複掃描同一張

  const [tab, setTab]           = useState<'scan' | 'list'>('scan');
  const [scanning, setScanning] = useState(false);
  const [result, setResult]     = useState<ScanResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary]   = useState({ total: 0, boarded: 0, missing: 0 });
  const [autoResume, setAutoResume] = useState(3); // 倒數秒數
  const autoResumeRef = useRef<NodeJS.Timeout | null>(null);

  const token   = () => localStorage.getItem('token');
  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`,
  });

  const fetchStudents = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/driver/students`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = await r.json();
      setStudents(d.students || []);
      setSummary({ total: d.total || 0, boarded: d.boarded || 0, missing: d.missing || 0 });
    } catch {}
  }, []);

  useEffect(() => {
    fetchStudents();
    return () => { stopCamera(); clearAutoResume(); };
  }, [fetchStudents]);

  const clearAutoResume = () => {
    if (autoResumeRef.current) clearInterval(autoResumeRef.current);
  };

  const startAutoResume = (seconds: number, onDone: () => void) => {
    clearAutoResume();
    setAutoResume(seconds);
    let count = seconds;
    autoResumeRef.current = setInterval(() => {
      count--;
      setAutoResume(count);
      if (count <= 0) {
        clearAutoResume();
        onDone();
      }
    }, 1000);
  };

  const startCamera = useCallback(async () => {
    setResult(null);
    setScanning(true);
    scanningRef.current = true;
    cooldownRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
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
          if (code && !cooldownRef.current) {
            cooldownRef.current = true; // 鎖定，防止重複
            handleCode(code.data);
            return;
          }
        }
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    } catch {
      setScanning(false);
      setResult({ status: 'error', message: '無法開啟相機，請允許相機權限' });
    }
  }, []);

  const stopCamera = () => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const handleCode = async (code: string) => {
    if (loading) return;
    setLoading(true);
    // 停止掃描框（但不關相機）
    scanningRef.current = false;

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

      if (res.status === 'ok') {
        fetchStudents(); // 更新名單
        // 成功：2秒後自動繼續掃描
        startAutoResume(2, () => {
          setResult(null);
          scanningRef.current = true;
          cooldownRef.current = false;
          // 重啟掃描循環
          restartScan();
        });
      } else {
        // 失敗：3秒後自動繼續掃描
        startAutoResume(3, () => {
          setResult(null);
          scanningRef.current = true;
          cooldownRef.current = false;
          restartScan();
        });
      }
    } catch {
      setResult({ status: 'error', message: '連線失敗，請重試' });
      startAutoResume(3, () => {
        setResult(null);
        scanningRef.current = true;
        cooldownRef.current = false;
        restartScan();
      });
    } finally {
      setLoading(false);
    }
  };

  const restartScan = () => {
    if (!streamRef.current) return;
    import('jsqr').then(({ default: jsQR }) => {
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
          if (code && !cooldownRef.current) {
            cooldownRef.current = true;
            handleCode(code.data);
            return;
          }
        }
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    });
  };

  const handleManual = async () => {
    if (!manualCode.trim() || loading) return;
    clearAutoResume();
    const code = manualCode.trim();
    setManualCode('');
    await handleCode(code);
  };

  const resultStyle = {
    ok:        { bg: 'bg-emerald-950/80 border-emerald-500',  icon: '✅', text: 'text-emerald-300', label: '上車成功' },
    wrong_bus: { bg: 'bg-red-950/80 border-red-500',          icon: '🚫', text: 'text-red-300',     label: '非本車學生' },
    not_found: { bg: 'bg-amber-950/80 border-amber-500',      icon: '❓', text: 'text-amber-300',   label: '查無學生' },
    error:     { bg: 'bg-gray-800/90 border-gray-600',        icon: '⚠️', text: 'text-gray-300',    label: '發生錯誤' },
  };

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col max-w-sm mx-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => { stopCamera(); clearAutoResume(); router.push('/driver'); }} className="text-gray-400 text-xl">←</button>
        <div className="flex-1">
          <div className="text-white font-bold">學生上車掃描</div>
          <div className="text-gray-500 text-xs">
            今日：{summary.boarded}/{summary.total} 人已上車
            {summary.missing > 0 && <span className="text-amber-400 ml-1">（{summary.missing} 未到）</span>}
          </div>
        </div>
        <button onClick={fetchStudents} className="text-gray-400 text-lg">↻</button>
      </div>

      {/* Tab */}
      <div className="flex gap-2 px-4 py-3">
        <button onClick={() => setTab('scan')}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all
            ${tab === 'scan' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
          📷 掃描
        </button>
        <button onClick={() => { setTab('list'); }}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all
            ${tab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
          📋 名單 {summary.missing > 0 && <span className="text-amber-300">({summary.missing})</span>}
        </button>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-3">

        {/* ── 掃描 Tab ── */}
        {tab === 'scan' && (
          <>
            {/* 相機區 */}
            <div className="relative">
              {scanning ? (
                <>
                  <video ref={videoRef} autoPlay playsInline
                    className="w-full rounded-2xl bg-black aspect-square object-cover" />

                  {/* 掃描框 */}
                  {!result && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-56 relative">
                        <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />
                        <div className="absolute inset-x-4 top-1/2 h-0.5 bg-blue-400/70 animate-pulse" />
                      </div>
                    </div>
                  )}

                  {/* 掃描結果 overlay */}
                  {result && (
                    <div className={`absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center ${resultStyle[result.status].bg} ${resultStyle[result.status].bg.includes('emerald') ? 'border-emerald-500' : result.status === 'wrong_bus' ? 'border-red-500' : result.status === 'not_found' ? 'border-amber-500' : 'border-gray-600'}`}>
                      <div className="text-6xl mb-3">{resultStyle[result.status].icon}</div>
                      {result.student && (
                        <div className="text-center mb-2">
                          <div className="text-white font-bold text-2xl">{result.student.name}</div>
                          <div className="text-gray-300 text-sm">{result.student.school_class}</div>
                        </div>
                      )}
                      <div className={`font-bold text-lg ${resultStyle[result.status].text}`}>
                        {result.message}
                      </div>
                      {/* 倒數 */}
                      <div className="mt-4 flex items-center gap-2">
                        <div className="text-gray-400 text-sm">{autoResume} 秒後繼續掃描</div>
                        <button
                          onClick={() => { clearAutoResume(); setResult(null); scanningRef.current = true; cooldownRef.current = false; restartScan(); }}
                          className="px-3 py-1 rounded-full bg-white/20 text-white text-xs">
                          立即繼續
                        </button>
                      </div>
                    </div>
                  )}

                  <button onClick={() => { stopCamera(); clearAutoResume(); setResult(null); }}
                    className="mt-2 w-full py-3 rounded-2xl bg-gray-800 text-gray-300 text-sm">
                    停止掃描
                  </button>
                </>
              ) : (
                <button onClick={startCamera}
                  className="w-full py-8 rounded-3xl bg-blue-600 hover:bg-blue-500 active:scale-95
                             text-white font-bold text-2xl transition-all">
                  📷 開始掃描
                </button>
              )}
            </div>

            {/* 手動輸入 */}
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
                className="px-4 py-3 rounded-xl bg-gray-700 text-white text-sm disabled:opacity-50 font-medium">
                {loading ? '...' : '確認'}
              </button>
            </div>

            {/* 說明 */}
            {!scanning && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <div className="text-gray-500 text-xs">掃完自動繼續，無需手動按按鈕</div>
                <div className="text-gray-600 text-xs mt-0.5">成功 2 秒 / 失敗 3 秒後自動繼續</div>
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
                      <div className="text-amber-400 text-xs font-medium">未上車</div>
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
                      <div className="text-emerald-400 text-xs font-medium">
                        {s.boarded_at ? new Date(s.boarded_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '已上車'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {students.length === 0 && (
              <div className="text-gray-600 text-center py-8">尚無學生資料</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
