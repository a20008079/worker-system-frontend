'use client';
// src/app/admin/scan/page.tsx — 掃描學生證快速建檔
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type State = 'idle' | 'scanning' | 'form' | 'found' | 'saved';

export default function ScanPage() {
  const router  = useRouter();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const [state, setState]   = useState<State>('idle');
  const [buses, setBuses]   = useState<any[]>([]);
  const [msg, setMsg]       = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const [found, setFound]   = useState<any>(null);

  // 表單
  const [form, setForm] = useState({
    student_name: '', school_class: '', parent_name: '',
    parent_phone: '', bus_id: '',
  });

  const token = () => localStorage.getItem('token');
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  useEffect(() => {
    fetch(`${API}/api/admin/buses-simple`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setBuses(d); });
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setState('scanning');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // 動態載入 jsQR
      const jsQR = (await import('jsqr')).default;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const scan = () => {
        if (!videoRef.current || state !== 'scanning') return;
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          canvas.width  = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            stopCamera();
            handleScanned(code.data);
            return;
          }
        }
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    } catch {
      setMsg('無法開啟相機，請改用手動輸入');
      setState('idle');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const handleScanned = async (code: string) => {
    setScannedCode(code);
    try {
      const r = await fetch(`${API}/api/admin/scan/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const d = await r.json();
      if (d.found) {
        setFound(d.student);
        setForm({
          student_name: d.student.name,
          school_class: d.student.school_class || '',
          parent_name:  d.student.parent_name || '',
          parent_phone: d.student.parent_phone || '',
          bus_id:       String(d.student.bus_id || ''),
        });
        setState('found');
      } else {
        setFound(null);
        setForm({ student_name: '', school_class: '', parent_name: '', parent_phone: '', bus_id: '' });
        setState('form');
      }
    } catch { setMsg('查詢失敗，請重試'); setState('idle'); }
  };

  const handleSave = async () => {
    if (!form.student_name || !form.parent_phone || !form.bus_id) {
      setMsg('請填寫所有必填欄位'); return;
    }
    try {
      const r = await fetch(`${API}/api/admin/scan/save`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ ...form, student_code: scannedCode, student_id: found?.id }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error); return; }
      setMsg(`✅ 儲存成功！家長帳號：${d.parent_account}，密碼：${d.parent_password}`);
      setState('saved');
    } catch { setMsg('儲存失敗'); }
  };

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center gap-3">
        <button onClick={() => { stopCamera(); router.push('/admin'); }} className="text-gray-400 text-xl">←</button>
        <div>
          <div className="text-white font-bold">掃描學生證建檔</div>
          <div className="text-gray-500 text-xs">掃描 QR Code 或條碼</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">
        {/* 相機掃描區 */}
        {state === 'scanning' ? (
          <div className="relative">
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-2xl bg-black aspect-square object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-blue-400 rounded-2xl opacity-60" />
            </div>
            <button onClick={() => { stopCamera(); setState('idle'); }}
  className="mt-3 w-full py-3 rounded-2xl bg-gray-800 text-gray-300 text-sm sticky bottom-4">
  取消掃描
</button>
          </div>
        ) : state === 'idle' ? (
          <div className="space-y-3">
            <button onClick={startCamera}
              className="w-full py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg">
              📷 掃描學生證
            </button>

            {/* 手動輸入 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800" />
              </div>
              <div className="relative flex justify-center text-xs text-gray-600">
                <span className="bg-gray-950 px-2">或手動輸入</span>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text" placeholder="輸入學生證號碼"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') handleScanned((e.target as HTMLInputElement).value); }}
              />
              <button
                onClick={(e) => { const input = (e.currentTarget.previousSibling as HTMLInputElement); handleScanned(input.value); }}
                className="px-4 py-3 rounded-xl bg-gray-700 text-white text-sm">查詢</button>
            </div>
          </div>
        ) : null}

        {/* 找到學生 */}
        {state === 'found' && (
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-4 mb-2">
            <div className="text-amber-400 font-semibold mb-1">⚠️ 此學生已建檔</div>
            <div className="text-gray-300 text-sm">可修改校車或家長資訊</div>
          </div>
        )}

        {/* 表單 */}
        {(state === 'form' || state === 'found') && (
          <div className="space-y-3">
            <div className="text-gray-500 text-xs px-1">學生證號：{scannedCode}</div>

            {[
              { key: 'student_name', label: '學生姓名 *', placeholder: '王小明' },
              { key: 'school_class', label: '班級', placeholder: '三年二班' },
              { key: 'parent_name',  label: '家長姓名 *', placeholder: '王爸爸' },
              { key: 'parent_phone', label: '家長手機 *', placeholder: '0912345678' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-gray-400 text-xs px-1">{f.label}</label>
                <input
                  type={f.key === 'parent_phone' ? 'tel' : 'text'}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                             text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}

            {/* 校車選擇 */}
            <div>
              <label className="text-gray-400 text-xs px-1">搭乘校車 *</label>
              <select
                value={form.bus_id}
                onChange={e => setForm(p => ({ ...p, bus_id: e.target.value }))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                           text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">請選擇校車</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>{b.route_name} · {b.bus_name}</option>
                ))}
              </select>
            </div>

            {msg && <div className="text-red-400 text-sm text-center">{msg}</div>}

            <button onClick={handleSave}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500
                         text-white font-bold text-lg mt-2">
              💾 儲存建檔
            </button>
            <button onClick={() => { setState('idle'); setMsg(''); }}
              className="w-full py-3 rounded-2xl bg-gray-800 text-gray-400 text-sm">
              取消，重新掃描
            </button>
          </div>
        )}

        {/* 儲存成功 */}
        {state === 'saved' && (
          <div className="space-y-4">
            <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-2xl p-5 text-center">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-emerald-400 font-bold text-lg mb-2">建檔成功！</div>
              <div className="text-gray-300 text-sm whitespace-pre-wrap">{msg}</div>
            </div>
            <button onClick={() => { setState('idle'); setMsg(''); setScannedCode(''); setFound(null); }}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold">
              繼續掃描下一位
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
