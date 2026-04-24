'use client';
// src/app/admin/page.tsx — 管理員後台
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type Tab = 'buses' | 'drivers' | 'students';

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab]         = useState<Tab>('buses');
  const [buses, setBuses]     = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const token = () => localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, d, s] = await Promise.all([
        fetch(`${API}/api/admin/buses`,    { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/admin/drivers`,  { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/admin/students`, { headers: headers() }).then(r => r.json()),
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

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'buses',   label: '校車',  emoji: '🚌' },
    { key: 'drivers', label: '司機',  emoji: '👨‍✈️' },
    { key: 'students',label: '學生',  emoji: '👦' },
  ];

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg">🏫 管理後台</div>
          <div className="text-gray-500 text-xs">校車定位系統</div>
        </div>
        <button
          onClick={() => { localStorage.clear(); router.push('/login'); }}
          className="text-gray-500 text-sm"
        >登出</button>
      </div>

      {/* 統計卡 */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        <StatCard emoji="🚌" label="校車" value={buses.length} color="blue" />
        <StatCard emoji="👨‍✈️" label="司機" value={drivers.length} color="emerald" />
        <StatCard emoji="👦" label="學生" value={students.length} color="amber" />
      </div>

      {/* Tab */}
      <div className="flex gap-2 px-4 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all
              ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* 內容 */}
      <div className="px-4 pb-8">
        {loading ? (
          <div className="text-gray-500 text-center py-12">載入中...</div>
        ) : (
          <>
            {tab === 'buses' && <BusList buses={buses} />}
            {tab === 'drivers' && <DriverList drivers={drivers} />}
            {tab === 'students' && <StudentList students={students} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── 統計卡 ──────────────────────────────────────────
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

// ── 校車列表 ─────────────────────────────────────────
function BusList({ buses }: { buses: any[] }) {
  // 按路線分組
  const grouped = buses.reduce((acc: any, bus: any) => {
    if (!acc[bus.route_name]) acc[bus.route_name] = [];
    acc[bus.route_name].push(bus);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([route, list]: any) => (
        <div key={route}>
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
            {route}
          </div>
          <div className="space-y-3">
            {list.map((bus: any) => (
              <div key={bus.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${bus.session_id ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                    <div>
                      <div className="text-white font-semibold">{bus.bus_name}</div>
                      <div className="text-gray-500 text-xs">{bus.route_name}</div>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs
                    ${bus.session_id ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                    {bus.session_id ? '行駛中' : '未出發'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800 rounded-xl p-2.5">
                    <div className="text-gray-500 mb-0.5">司機</div>
                    <div className="text-gray-300">{bus.driver_name || '未指派'}</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-2.5">
                    <div className="text-gray-500 mb-0.5">學生數</div>
                    <div className="text-gray-300">{bus.student_count} 人</div>
                  </div>
                </div>
                {bus.last_seen && (
                  <div className="text-gray-600 text-xs mt-2 px-1">
                    最後位置：{new Date(bus.last_seen).toLocaleString('zh-TW')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 司機列表 ─────────────────────────────────────────
function DriverList({ drivers }: { drivers: any[] }) {
  return (
    <div className="space-y-3">
      {drivers.map((d: any) => (
        <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-2xl">
            👨‍✈️
          </div>
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

// ── 學生列表 ─────────────────────────────────────────
function StudentList({ students }: { students: any[] }) {
  // 按路線分組
  const grouped = students.reduce((acc: any, s: any) => {
    const key = s.route_name || '未指派';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([route, list]: any) => (
        <div key={route}>
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
            {route} · {list.length} 人
          </div>
          <div className="space-y-3">
            {list.map((s: any) => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-600/20 flex items-center justify-center text-2xl">
                  👦
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold">{s.name}</div>
                  <div className="text-gray-500 text-xs">{s.school_class}</div>
                  <div className="text-gray-600 text-xs mt-0.5">家長：{s.parent_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-xs">{s.bus_name}</div>
                  <div className="text-gray-600 text-xs">{s.route_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
