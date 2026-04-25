'use client';
// src/app/driver/scan/page.tsx — 司機掃描學生證上車
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type ScanResult = {
  status: 'ok' | 'wrong_bus' | 'not_found' | 'error';
  message: string;
  student?: { name: string; school_class: string };
};

export default function DriverScanPage() {
  const router = useRouter();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState<ScanResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [history, setHistory]     = useState<ScanResult[]>([]);

  const token = () => localStorage.getItem('token');

  useEffect(() => {
    return () => stopCamera();
  }, []);

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      const res: ScanResult = {
        status: d.status || (r.ok ? 'ok' : 'error'),
        message: d.message || d.error || '發生錯誤',
        student: d.student,
      };
      setResult(res);
      setHistory(prev => [res, ...prev.slice(0, 9)]);
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

  const resultColor = {
    ok:        'bg-emerald-950/50 border-emerald-600/50',
    wrong_bus: 'bg-red-950/50 border-red-600/50',
    not_found: 'bg-amber-950/50 border-amber-600/50',
    error:     'bg-gray-800 border-gray-700',
  };
  const resultIcon = { ok: '✅', wrong_bus: '🚫', not_found: '❓', error: '⚠️' };
  const resultTextColor = { ok: 'text-emerald-400', wrong_bus: 'text-red-400', not_found: 'text-amber-400', error: 'text-gray-400' };

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col max-w-sm mx-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center gap-3 sticky top-0">
        <button onClick={() => { stopCamera(); router.push('/driver'); }} className="text-gray-400 text-xl">←</button>
        <div>
          <div className="text-white font-bold">學生上車掃描</div>
          <div className="text-gray-500 text-xs">掃描學生證確認上車</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4">
        {/* 相機區 */}
        {scanning ? (
          <div className="relative">
            <video ref={videoRef} autoPlay playsInline
              className="w-full rounded-2xl bg-black aspect-square object-cover" />
            {/* 掃描框 */}
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
              type="text"
              placeholder="手動輸入學生證號碼"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManual()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleManual} disabled={loading || !manualCode.trim()}
              className="px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm disabled:opacity-50">
              {loading ? '...' : '確認'}
            </button>
          </div>
        )}

        {/* 掃描結果 */}
        {result && (
          <div className={`rounded-2xl border p-5 text-center transition-all ${resultColor[result.status]}`}>
            <div className="text-4xl mb-3">{resultIcon[result.status]}</div>
            {result.student && (
              <div className="mb-2">
                <div className="text-white font-bold text-xl">{result.student.name}</div>
                <div className="text-gray-400 text-sm">{result.student.school_class}</div>
              </div>
            )}
            <div className={`font-semibold text-lg ${resultTextColor[result.status]}`}>
              {result.message}
            </div>
            {result.status === 'ok' && (
              <button onClick={startCamera}
                className="mt-4 w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium">
                繼續掃描下一位
              </button>
            )}
            {result.status !== 'ok' && (
              <button onClick={() => { setResult(null); startCamera(); }}
                className="mt-4 w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm">
                重新掃描
              </button>
            )}
          </div>
        )}

        {/* 今日上車紀錄 */}
        {history.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
              今日掃描紀錄
            </div>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-xl">{resultIcon[h.status]}</span>
                  <div className="flex-1">
                    {h.student && <div className="text-white text-sm font-medium">{h.student.name}</div>}
                    <div className={`text-xs ${resultTextColor[h.status]}`}>{h.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
