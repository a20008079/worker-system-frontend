'use client';
// src/app/admin/page.tsx — 管理員後台（含座位管理 + 放學時段）
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';
type Tab = 'buses' | 'drivers' | 'students';

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab]                   = useState<Tab>('buses');
  const [buses, setBuses]               = useState<any[]>([]);
  const [drivers, setDrivers]           = useState<any[]>([]);
  const [students, setStudents]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showRouteManager, setShowRouteManager] = useState(false);

  const token   = () => localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, d, s] = await Promise.all([
        fetch(`${API}/api/admin/buses`,   { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/admin/drivers`, { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/admin/students`,{ headers: headers() }).then(r => r.json()),
      ]);
      if (Array.isArray(b)) setBuses(b);
      if (Array.isArray(d)) setDrivers(d);
      if (Array.isArray(s)) setStudents(s);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') { router.push('/login'); return; }
    fetchAll();
  }, [fetchAll]);

  const onlineCount = buses.filter(b => b.session_id).length;

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg">🏫 管理後台</div>
          <div className="text-gray-500 text-xs">校車定位系統</div>
        </div>
        <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="text-gray-500 text-sm">登出</button>
      </div>

      {/* 統計卡 */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        <StatCard emoji="🚌" label="校車" value={buses.length} color="blue" />
        <StatCard emoji="👨‍✈️" label="司機" value={drivers.length} color="emerald" />
        <StatCard emoji="👦" label="學生" value={students.length} color="amber" />
      </div>

      {/* 即時監控 */}
      <div className="px-4 mb-4">
        <div className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2 px-1">即時監控</div>
        <button onClick={() => router.push('/admin/map')}
          className="w-full bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 active:scale-95 transition-all rounded-2xl p-4 flex items-center gap-4 border border-blue-700/50">
          <div className="text-3xl">🗺️</div>
          <div className="text-left flex-1">
            <div className="text-white font-bold text-sm">校車即時地圖</div>
            <div className="text-blue-300 text-xs mt-0.5">查看所有校車位置與行駛路徑</div>
          </div>
          <div className="text-right">
            {onlineCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-bold">{onlineCount} 在線</span>
              </div>
            ) : (
              <div className="text-gray-500 text-xs">0 在線</div>
            )}
            <div className="text-blue-400 text-lg mt-0.5">›</div>
          </div>
        </button>
      </div>

      {/* 學生建檔 */}
      <div className="px-4 mb-4">
        <div className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2 px-1">學生建檔</div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/admin/scan')}
            className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all rounded-2xl p-4 text-left">
            <div className="text-2xl mb-2">📷</div>
            <div className="text-white font-bold text-sm">掃描學生證</div>
            <div className="text-blue-200 text-xs mt-0.5">逐一掃描快速建檔</div>
          </button>
          <button onClick={() => router.push('/admin/import')}
            className="bg-emerald-700 hover:bg-emerald-600 active:scale-95 transition-all rounded-2xl p-4 text-left">
            <div className="text-2xl mb-2">📥</div>
            <div className="text-white font-bold text-sm">批次匯入</div>
            <div className="text-emerald-200 text-xs mt-0.5">Excel / CSV 批量建檔</div>
          </button>
        </div>
      </div>

      {/* 管理工具 */}
      <div className="px-4 mb-4">
        <div className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2 px-1">管理工具</div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/admin/history')}
            className="bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl p-4 text-left border border-gray-700">
            <div className="text-2xl mb-2">📋</div>
            <div className="text-white font-bold text-sm">歷史紀錄</div>
            <div className="text-gray-400 text-xs mt-0.5">出勤查詢 · 學生紀錄 · 統計</div>
          </button>
          <button onClick={() => setShowRouteManager(true)}
            className="bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl p-4 text-left border border-gray-700">
            <div className="text-2xl mb-2">🛣️</div>
            <div className="text-white font-bold text-sm">路線管理</div>
            <div className="text-gray-400 text-xs mt-0.5">新增 · 刪除校車路線</div>
          </button>
        </div>
        <a href="#" onClick={e => {
            e.preventDefault();
            const tok = localStorage.getItem('token');
            fetch(`${API}/api/admin/export`, { headers: { Authorization: `Bearer ${tok}` } })
              .then(r => r.blob())
              .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `校車學生資料庫_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              });
          }}
          className="w-full mt-3 bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl p-3 flex items-center gap-3 border border-gray-700 no-underline block">
          <div className="text-xl">📊</div>
          <div className="text-left">
            <div className="text-white font-bold text-sm">匯出學生名單</div>
            <div className="text-gray-400 text-xs">下載 Excel 格式（含新欄位）</div>
          </div>
          <div className="ml-auto text-gray-500 text-sm">↓</div>
        </a>
      </div>

      {/* 帳號管理 */}
      <div className="px-4 mb-4">
        <div className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2 px-1">帳號管理</div>
        <button onClick={() => router.push('/admin/accounts')}
          className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl p-4 flex items-center gap-4 border border-gray-700">
          <div className="text-3xl">👤</div>
          <div className="text-left">
            <div className="text-white font-bold text-sm">帳號管理</div>
            <div className="text-gray-400 text-xs mt-0.5">新增 / 修改 / 刪除 家長、司機、管理員帳號密碼</div>
          </div>
          <div className="ml-auto text-gray-500 text-lg">›</div>
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-2 px-4 mb-4">
        {[
          { key: 'buses'   as Tab, label: '校車', emoji: '🚌' },
          { key: 'drivers' as Tab, label: '司機', emoji: '👨‍✈️' },
          { key: 'students'as Tab, label: '學生', emoji: '👦' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all
              ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* 列表內容 */}
      <div className="px-4 pb-8">
        {loading ? (
          <div className="text-gray-500 text-center py-12">載入中...</div>
        ) : (
          <>
            {tab === 'buses'   && <BusList buses={buses} onRefresh={fetchAll} />}
            {tab === 'drivers' && <DriverList drivers={drivers} />}
            {tab === 'students'&& <StudentList students={students} buses={buses} onRefresh={fetchAll} />}
          </>
        )}
      </div>

      {/* 路線管理 Modal */}
      {showRouteManager && (
        <RouteManager buses={buses} drivers={drivers}
          onClose={() => setShowRouteManager(false)} onRefresh={fetchAll} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 路線管理 Modal
// ══════════════════════════════════════════════════════
function RouteManager({ buses, drivers, onClose, onRefresh }: {
  buses: any[]; drivers: any[]; onClose: () => void; onRefresh: () => void;
}) {
  const [mode, setMode]           = useState<'list' | 'add' | 'delete'>('list');
  const [form, setForm]           = useState({ bus_name: '', route_name: '', driver_id: '', bus_type: 'minibus', capacity: '' });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState('');
  const token = () => localStorage.getItem('token');
  const H = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
  const routes = [...new Set(buses.map(b => b.route_name))].sort();
  const unassignedDrivers = drivers.filter(d => !buses.find(b => b.driver_id === d.id));

  // 自動填入座位上限
  const handleTypeChange = (t: string) => {
    setForm({ ...form, bus_type: t, capacity: t === 'van' ? '8' : '20' });
  };

  async function addBus() {
    if (!form.bus_name.trim()) { setMsg('請輸入車次名稱'); return; }
    if (!form.route_name || form.route_name === '__new__') { setMsg('請選擇或輸入路線名稱'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/buses`, {
        method: 'POST', headers: H(),
        body: JSON.stringify({
          bus_name:  form.bus_name.trim(),
          route_name: form.route_name.trim(),
          driver_id: form.driver_id ? Number(form.driver_id) : null,
          bus_type:  form.bus_type,
          capacity:  form.capacity ? Number(form.capacity) : undefined,
        })
      });
      const d = await r.json();
      if (!d.ok) { setMsg('❌ ' + (d.error || '新增失敗')); setLoading(false); return; }
      setMsg('✅ 新增成功！');
      onRefresh();
      setTimeout(() => { setMsg(''); setMode('list'); setForm({ bus_name: '', route_name: '', driver_id: '', bus_type: 'minibus', capacity: '' }); }, 1500);
    } catch { setMsg('❌ 新增失敗'); }
    setLoading(false);
  }

  async function deleteBus() {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/buses/${deleteTarget.id}`, { method: 'DELETE', headers: H() });
      const d = await r.json();
      if (d.ok) {
        setMsg(`✅ 已刪除 ${deleteTarget.bus_name}（含 ${d.deletedStudents} 位學生）`);
        onRefresh();
        setTimeout(() => { setMsg(''); setDeleteTarget(null); setMode('list'); }, 2000);
      } else { setMsg('❌ ' + (d.error || '刪除失敗')); }
    } catch { setMsg('❌ 刪除失敗'); }
    setLoading(false);
  }

  const busTypeLabel: Record<string, string> = { minibus: '中巴 21人座', van: '廂型車 9人座' };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {mode !== 'list' && (
              <button onClick={() => { setMode('list'); setDeleteTarget(null); setMsg(''); }} className="text-gray-400 hover:text-white text-xl">←</button>
            )}
            <div className="font-bold text-white text-base">
              {mode === 'list' ? '🛣️ 路線管理' : mode === 'add' ? '➕ 新增校車' : '🗑️ 刪除確認'}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 text-xl hover:text-white">×</button>
        </div>
        <div className="p-5">
          {msg && (
            <div className={`rounded-xl p-3 mb-4 text-sm font-semibold text-center
              ${msg.startsWith('✅') ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
              {msg}
            </div>
          )}

          {/* 列表模式 */}
          {mode === 'list' && (
            <>
              <button onClick={() => setMode('add')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl mb-5 transition-all active:scale-95">
                ＋ 新增校車
              </button>
              <div className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">現有校車（點選刪除）</div>
              {routes.map(route => (
                <div key={route} className="mb-4">
                  <div className="text-gray-400 text-xs font-bold mb-2">{route}</div>
                  {buses.filter(b => b.route_name === route).map(bus => {
                    const isFull = bus.student_count >= bus.capacity;
                    return (
                      <div key={bus.id} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 mb-2">
                        <div>
                          <div className="text-white font-semibold text-sm">{bus.bus_name}</div>
                          <div className="text-gray-500 text-xs">
                            {bus.driver_name || '未指派司機'} ·
                            <span className={isFull ? ' text-red-400 font-bold' : ' text-gray-400'}>
                              {' '}{bus.student_count}/{bus.capacity}人
                            </span>
                            <span className="text-gray-600"> · {busTypeLabel[bus.bus_type] || bus.bus_type}</span>
                          </div>
                        </div>
                        <button onClick={() => { setDeleteTarget(bus); setMode('delete'); }} className="text-red-500 hover:text-red-400 text-xl px-2">🗑️</button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* 新增模式 */}
          {mode === 'add' && (
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">路線名稱</label>
                <select value={form.route_name} onChange={e => setForm({ ...form, route_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none">
                  <option value="">-- 選擇現有路線 --</option>
                  {routes.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="__new__">＋ 輸入新路線名稱</option>
                </select>
                {form.route_name === '__new__' && (
                  <input value={''} onChange={e => setForm({ ...form, route_name: e.target.value })}
                    placeholder="輸入新路線名稱（如：新店線）"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none mt-2" />
                )}
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">車次名稱 <span className="text-red-400">*</span></label>
                <input value={form.bus_name} onChange={e => setForm({ ...form, bus_name: e.target.value })}
                  placeholder="如：中壢線06"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none" />
              </div>
              {/* 車型選擇 */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">車型</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: 'minibus', label: '🚌 中巴', sub: '21人座，可載20生' }, { v: 'van', label: '🚐 廂型車', sub: '9人座，可載8生' }].map(opt => (
                    <button key={opt.v} onClick={() => handleTypeChange(opt.v)}
                      className={`py-3 px-4 rounded-xl text-sm font-medium text-left transition-all
                        ${form.bus_type === opt.v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      <div>{opt.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">座位上限（學生人數）</label>
                <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                  placeholder={form.bus_type === 'van' ? '8' : '20'} min="1" max="50"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none" />
                <div className="text-gray-600 text-xs mt-1">中巴預設 20 人，廂型車預設 8 人</div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">指派司機（選填）</label>
                <select value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none">
                  <option value="">-- 稍後再指派 --</option>
                  {unassignedDrivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}（{d.account}）</option>
                  ))}
                </select>
              </div>
              <button onClick={addBus} disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all active:scale-95">
                {loading ? '新增中...' : '確認新增'}
              </button>
            </div>
          )}

          {/* 刪除確認 */}
          {mode === 'delete' && deleteTarget && (
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <div className="text-white font-bold text-lg mb-2">確定刪除？</div>
              <div className="bg-gray-800 rounded-2xl p-4 mb-5 text-left">
                <div className="text-white font-semibold">{deleteTarget.bus_name}</div>
                <div className="text-gray-400 text-sm mt-1">{deleteTarget.route_name}</div>
                <div className="text-red-400 text-sm mt-3">
                  ⚠️ 將同時刪除此校車的 <span className="font-bold">{deleteTarget.student_count} 位學生</span> 的綁定資料，且<span className="font-bold">無法復原</span>。
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setMode('list'); setDeleteTarget(null); }} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-2xl transition-all">取消</button>
                <button onClick={deleteBus} disabled={loading}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all active:scale-95">
                  {loading ? '刪除中...' : '確認刪除'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 元件
// ══════════════════════════════════════════════════════
function StatCard({ emoji, label, value, color }: any) {
  const colors: Record<string, string> = {
    blue:    'border-blue-800/40 bg-blue-950/30',
    emerald: 'border-emerald-800/40 bg-emerald-950/30',
    amber:   'border-amber-800/40 bg-amber-950/30',
  };
  return (
    <div className={`rounded-2xl border p-4 text-center ${colors[color]}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-white font-bold text-xl">{value}</div>
      <div className="text-gray-500 text-xs">{label}</div>
    </div>
  );
}

function BusList({ buses, onRefresh }: { buses: any[]; onRefresh: () => void }) {
  const [editBus, setEditBus] = useState<any>(null);
  const grouped = buses.reduce((acc: any, bus: any) => {
    if (!acc[bus.route_name]) acc[bus.route_name] = [];
    acc[bus.route_name].push(bus);
    return acc;
  }, {});
  const busTypeLabel: Record<string, string> = { minibus: '中巴', van: '廂型車' };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([route, list]: any) => (
        <div key={route}>
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2 px-1">{route}</div>
          <div className="space-y-3">
            {list.map((bus: any) => {
              const pct = bus.capacity > 0 ? Math.round((bus.student_count / bus.capacity) * 100) : 0;
              const isFull = bus.student_count >= bus.capacity;
              return (
                <div key={bus.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${bus.session_id ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                      <div>
                        <div className="text-white font-semibold">{bus.bus_name}</div>
                        <div className="text-gray-500 text-xs">{bus.route_name} · {busTypeLabel[bus.bus_type] || bus.bus_type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-2.5 py-1 rounded-full text-xs ${bus.session_id ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                        {bus.session_id ? '行駛中' : '未出發'}
                      </div>
                      <button onClick={() => setEditBus(bus)} className="text-blue-500 text-xs hover:text-blue-400">✏️</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div className="bg-gray-800 rounded-xl p-2.5">
                      <div className="text-gray-500 mb-0.5">司機</div>
                      <div className="text-gray-300">{bus.driver_name || '未指派'}</div>
                    </div>
                    <div className={`bg-gray-800 rounded-xl p-2.5 ${isFull ? 'border border-red-800' : ''}`}>
                      <div className="text-gray-500 mb-0.5">座位</div>
                      <div className={isFull ? 'text-red-400 font-bold' : 'text-gray-300'}>
                        {bus.student_count}/{bus.capacity}
                        {isFull && ' 🔴'}
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-2.5">
                      <div className="text-gray-500 mb-0.5">使用率</div>
                      <div className={pct >= 100 ? 'text-red-400 font-bold' : pct >= 80 ? 'text-yellow-400' : 'text-gray-300'}>
                        {pct}%
                      </div>
                    </div>
                  </div>
                  {/* 座位進度條 */}
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  {bus.last_seen && (
                    <div className="text-gray-600 text-xs mt-2 px-1">最後位置：{new Date(bus.last_seen).toLocaleString('zh-TW')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {editBus && (
        <BusEditModal bus={editBus} onClose={() => setEditBus(null)} onSaved={() => { setEditBus(null); onRefresh(); }} />
      )}
    </div>
  );
}

function BusEditModal({ bus, onClose, onSaved }: { bus: any; onClose: () => void; onSaved: () => void }) {
  const token = () => localStorage.getItem('token');
  const H = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
  const [busType, setBusType] = useState(bus.bus_type || 'minibus');
  const [capacity, setCapacity] = useState(String(bus.capacity || 20));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/buses/${bus.id}`, {
        method: 'PUT', headers: H(),
        body: JSON.stringify({ bus_type: busType, capacity: Number(capacity) })
      });
      const d = await r.json();
      if (d.ok) { setMsg('✅ 儲存成功！'); setTimeout(() => onSaved(), 1000); }
      else { setMsg('❌ ' + (d.error || '儲存失敗')); }
    } catch { setMsg('❌ 儲存失敗'); }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="font-bold text-white">🚌 編輯校車資訊</div>
          <button onClick={onClose} className="text-gray-500 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {msg && <div className={`rounded-xl p-3 text-sm font-semibold text-center ${msg.startsWith('✅') ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>{msg}</div>}
          <div className="bg-gray-800 rounded-2xl p-4">
            <div className="text-white font-bold">{bus.bus_name}</div>
            <div className="text-gray-400 text-sm">{bus.route_name}</div>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">車型</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'minibus', label: '🚌 中巴', cap: '20' }, { v: 'van', label: '🚐 廂型車', cap: '8' }].map(opt => (
                <button key={opt.v} onClick={() => { setBusType(opt.v); setCapacity(opt.cap); }}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${busType === opt.v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">座位上限（學生人數）</label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} min="1" max="50"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500" />
          </div>
          <button onClick={save} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all active:scale-95">
            {loading ? '儲存中...' : '儲存變更'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DriverList({ drivers }: { drivers: any[] }) {
  return (
    <div className="space-y-3">
      {drivers.map((d: any) => (
        <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-2xl">👨‍✈️</div>
          <div className="flex-1">
            <div className="text-white font-semibold">{d.name}</div>
            <div className="text-gray-500 text-xs">{d.phone}</div>
            <div className="text-gray-600 text-xs mt-0.5">帳號：{d.account}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-xs">{d.bus_name || '未指派'}</div>
            <div className="text-gray-600 text-xs">{d.route_name || ''}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StudentList({ students, buses, onRefresh }: { students: any[]; buses: any[]; onRefresh: () => void }) {
  const [editTarget, setEditTarget] = useState<any>(null);
  const [search, setSearch]         = useState('');

  const filtered = search.trim()
    ? students.filter(s => s.name.includes(search) || s.school_class?.includes(search) || s.bus_name?.includes(search))
    : students;

  const grouped = filtered.reduce((acc: any, s: any) => {
    const key = s.route_name || '未指派';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sessionLabel: Record<string, string> = { '1620': '16:20', '1800': '18:00', both: '兩段' };
  const dayMap: Record<string, string> = { '1':'一','2':'二','3':'三','4':'四','5':'五' };

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 搜尋學生姓名、班級、路線..."
        className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 text-white text-sm mb-4 outline-none focus:border-blue-500" />
      <div className="space-y-6">
        {Object.entries(grouped).map(([route, list]: any) => (
          <div key={route}>
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
              {route} · {(list as any[]).length} 人
            </div>
            <div className="space-y-3">
              {(list as any[]).map((s: any) => (
                <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-600/20 flex items-center justify-center text-2xl flex-shrink-0">👦</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="text-white font-semibold">{s.name}</div>
                        <button onClick={() => setEditTarget(s)} className="text-blue-500 text-xs hover:text-blue-400 ml-2">✏️ 編輯</button>
                      </div>
                      <div className="text-gray-500 text-xs">{s.school_class}</div>
                      <div className="text-gray-600 text-xs mt-0.5">家長：{s.parent_name}</div>
                      {/* 新欄位摘要 */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.dismissal_session && (
                          <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded-full text-xs">
                            放學 {sessionLabel[s.dismissal_session] || s.dismissal_session}
                          </span>
                        )}
                        {s.active_days && s.active_days !== '12345' && (
                          <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-full text-xs">
                            週{s.active_days.split('').map((d: string) => dayMap[d] || d).join('、')}
                          </span>
                        )}
                        {s.pickup_location && (
                          <span className="px-2 py-0.5 bg-emerald-900/50 text-emerald-300 rounded-full text-xs">
                            ↑ {s.pickup_location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-gray-400 text-xs">{s.bus_name}</div>
                      <div className={`text-xs mt-0.5 ${s.bus_student_count >= s.capacity ? 'text-red-400' : 'text-gray-600'}`}>
                        {s.bus_student_count}/{s.capacity}人
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {editTarget && (
        <StudentEditModal student={editTarget} buses={buses}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); onRefresh(); }} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 學生編輯 Modal（含新欄位）
// ══════════════════════════════════════════════════════
const DAYS = [
  { key: '1', label: '週一' },
  { key: '2', label: '週二' },
  { key: '3', label: '週三' },
  { key: '4', label: '週四' },
  { key: '5', label: '週五' },
];

function StudentEditModal({ student, buses, onClose, onSaved }: {
  student: any; buses: any[]; onClose: () => void; onSaved: () => void;
}) {
  const token = () => localStorage.getItem('token');
  const H = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

  const [busId,            setBusId]            = useState(String(student.bus_id || ''));
  const [schoolClass,      setSchoolClass]      = useState(student.school_class || '');
  const [address,          setAddress]          = useState(student.address || '');
  const [pickupLocation,   setPickupLocation]   = useState(student.pickup_location || '');
  const [dropoff1620,      setDropoff1620]      = useState(student.dropoff_1620 || '');
  const [dropoff1800,      setDropoff1800]      = useState(student.dropoff_1800 || '');
  const [dismissalSession, setDismissalSession] = useState(student.dismissal_session || '');
  const [activeDays,       setActiveDays]       = useState(student.active_days || '12345');
  const [loading,          setLoading]          = useState(false);
  const [msg,              setMsg]              = useState('');

  const toggleDay = (d: string) => {
    setActiveDays((prev: string) =>
      prev.includes(d) ? prev.replace(d, '') : [...prev.split(''), d].sort().join('')
    );
  };

  const routes = [...new Set(buses.map(b => b.route_name))].sort();

  async function save() {
    if (!busId) { setMsg('請選擇校車'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/students/${student.id}`, {
        method: 'PUT', headers: H(),
        body: JSON.stringify({
          name:             student.name,
          school_class:     schoolClass,
          bus_id:           Number(busId),
          parent_id:        student.parent_id,
          address,
          pickup_location:  pickupLocation,
          dropoff_1620:     dropoff1620,
          dropoff_1800:     dropoff1800,
          dismissal_session: dismissalSession || null,
          active_days:      activeDays || '12345',
        })
      });
      const d = await r.json();
      if (d.ok) { setMsg('✅ 儲存成功！'); setTimeout(() => onSaved(), 1000); }
      else { setMsg('❌ ' + (d.error || '儲存失敗')); }
    } catch { setMsg('❌ 儲存失敗'); }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div className="font-bold text-white">✏️ 編輯學生資料</div>
          <button onClick={onClose} className="text-gray-500 text-xl">×</button>
        </div>
        <div className="p-5 space-y-5">
          {msg && (
            <div className={`rounded-xl p-3 text-sm font-semibold text-center ${msg.startsWith('✅') ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
              {msg}
            </div>
          )}

          {/* 基本資料 */}
          <div className="bg-gray-800 rounded-2xl p-4">
            <div className="text-white font-bold text-lg">{student.name}</div>
            <div className="text-gray-400 text-sm">家長：{student.parent_name}</div>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">班級</label>
            <input value={schoolClass} onChange={e => setSchoolClass(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">地址</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="學生住家地址"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500" />
          </div>

          {/* 接送地點 */}
          <div className="border border-gray-700 rounded-2xl p-4 space-y-3">
            <div className="text-gray-300 text-sm font-semibold">📍 接送地點</div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">上學接送地點</label>
              <input value={pickupLocation} onChange={e => setPickupLocation(e.target.value)}
                placeholder="如：中壢火車站前"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">16:20 放學接送地點</label>
              <input value={dropoff1620} onChange={e => setDropoff1620(e.target.value)}
                placeholder="放學接送地點（16:20 時段）"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">18:00 放學接送地點</label>
              <input value={dropoff1800} onChange={e => setDropoff1800(e.target.value)}
                placeholder="放學接送地點（18:00 時段）"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* 放學時段 */}
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-2">放學時段</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ v: '1620', label: '16:20', emoji: '🕓' }, { v: '1800', label: '18:00', emoji: '🕕' }, { v: 'both', label: '兩段', emoji: '🔄' }].map(opt => (
                <button key={opt.v} onClick={() => setDismissalSession(dismissalSession === opt.v ? '' : opt.v)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all ${dismissalSession === opt.v ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  <div>{opt.emoji}</div>
                  <div className="text-xs mt-0.5">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 搭車星期 */}
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-2">搭車星期</label>
            <div className="grid grid-cols-5 gap-2">
              {DAYS.map(d => (
                <button key={d.key} onClick={() => toggleDay(d.key)}
                  className={`py-2.5 rounded-xl text-xs font-medium transition-all ${activeDays.includes(d.key) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="text-gray-600 text-xs mt-1 px-1">
              已選：{activeDays.length === 0 ? '無' : activeDays.split('').map((k: string) => DAYS.find(d => d.key === k)?.label).join('、')}
            </div>
          </div>

          {/* 校車選擇 */}
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">所屬校車</label>
            {routes.map(route => (
              <div key={route} className="mb-3">
                <div className="text-gray-500 text-xs mb-1 px-1">{route}</div>
                <div className="grid grid-cols-2 gap-2">
                  {buses.filter(b => b.route_name === route).map(b => {
                    const isFull = b.student_count >= b.capacity && String(b.id) !== busId;
                    return (
                      <button key={b.id} onClick={() => !isFull && setBusId(String(b.id))}
                        disabled={isFull}
                        className={`py-2 px-3 rounded-xl text-sm font-medium text-left transition-all
                          ${busId === String(b.id) ? 'bg-blue-600 text-white' : isFull ? 'bg-gray-900 text-gray-600 cursor-not-allowed' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {b.bus_name}
                        <div className={`text-xs mt-0.5 ${isFull ? 'text-red-500' : 'opacity-70'}`}>
                          {b.student_count}/{b.capacity}人{isFull ? ' 🔴滿' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button onClick={save} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all active:scale-95">
            {loading ? '儲存中...' : '儲存變更'}
          </button>
        </div>
      </div>
    </div>
  );
}
