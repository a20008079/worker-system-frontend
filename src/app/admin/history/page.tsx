'use client';
// src/app/admin/history/page.tsx — 歷史紀錄查詢
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type Tab = 'sessions' | 'student' | 'stats';

export default function HistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('sessions');
  const [token, setToken] = useState('');

  useEffect(() => {
    const role = localStorage.getItem('role');
    const tok = localStorage.getItem('token') || '';
    if (role !== 'admin') { router.push('/login'); return; }
    setToken(tok);
  }, [router]);

  if (!token) return null;

  return (
    <div className="min-h-dvh" style={{ background: '#080c14', color: '#e2e8f0', fontFamily: "'Noto Sans TC', sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#0f1621', borderBottom: '1px solid #1e2d45', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: '1px solid #1e2d45', color: '#64748b', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← 後台</button>
        <div style={{ fontWeight: 900, fontSize: 17 }}>📋 歷史紀錄</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0' }}>
        {[
          { key: 'sessions', label: '📅 每日出勤' },
          { key: 'student', label: '👦 學生查詢' },
          { key: 'stats', label: '📊 統計報表' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, transition: 'all .2s',
              background: tab === t.key ? '#3b82f6' : '#131d2e', color: tab === t.key ? '#fff' : '#64748b' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        {tab === 'sessions' && <SessionsTab token={token} />}
        {tab === 'student' && <StudentTab token={token} />}
        {tab === 'stats' && <StatsTab token={token} />}
      </div>
    </div>
  );
}

// ── 每日出勤 Tab ──────────────────────────────────────
function SessionsTab({ token }: { token: string }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [boarding, setBoarding] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const H = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/history/sessions?date=${date}`, { headers: H });
      setSessions(await r.json());
    } catch {}
    setLoading(false);
  }, [date, token]);

  useEffect(() => { load(); }, [load]);

  async function selectSession(s: any) {
    setSelected(s);
    const r = await fetch(`${API}/api/admin/history/boarding?session_id=${s.id}`, { headers: H });
    setBoarding(await r.json());
  }

  const fmt = (dt: string) => dt ? new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
      {/* 左：出勤列表 */}
      <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setSelected(null); }}
            style={{ background: '#131d2e', border: '1px solid #1e2d45', color: '#e2e8f0', padding: '7px 12px', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }} />
          <div style={{ color: '#64748b', fontSize: 13 }}>{sessions.length} 筆出勤紀錄</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>載入中...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
            <div>當日無出勤紀錄</div>
          </div>
        ) : sessions.map(s => {
          const pct = s.total_students > 0 ? Math.round(s.boarded_count / s.total_students * 100) : 0;
          const isOngoing = !s.end_time;
          return (
            <div key={s.id} onClick={() => selectSession(s)}
              style={{ background: selected?.id === s.id ? 'rgba(59,130,246,.15)' : '#0f1621', border: `1px solid ${selected?.id === s.id ? '#3b82f6' : '#1e2d45'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.bus_name}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{s.route_name} · {s.driver_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: isOngoing ? '#065f46' : '#1e2d45', color: isOngoing ? '#34d399' : '#64748b', marginBottom: 4 }}>
                    {isOngoing ? '進行中' : '已結束'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>{fmt(s.start_time)} ~ {fmt(s.end_time)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, background: '#1e2d45', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', borderRadius: 4, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{s.boarded_count}/{s.total_students} 人 ({pct}%)</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 右：上車明細 */}
      {selected && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.bus_name} 上車明細</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>上車 {boarding.filter(b=>b.boarded_at).length} / {boarding.length} 人</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: '1px solid #1e2d45', color: '#64748b', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' }}>
            {boarding.map((b, i) => (
              <div key={i} style={{ background: b.boarded_at ? 'rgba(16,185,129,.08)' : '#0f1621', border: `1px solid ${b.boarded_at ? '#064e3b' : '#1e2d45'}`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 18 }}>{b.boarded_at ? '✅' : '⬜'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{b.student_name}</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>{b.school_class}</div>
                </div>
                <div style={{ fontSize: 12, color: b.boarded_at ? '#34d399' : '#475569', textAlign: 'right' }}>
                  {b.boarded_at ? fmt(b.boarded_at) : '未上車'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 學生查詢 Tab ──────────────────────────────────────
function StudentTab({ token }: { token: string }) {
  const [name, setName] = useState('');
  const [days, setDays] = useState(7);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const H = { Authorization: `Bearer ${token}` };

  async function search() {
    if (!name.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const r = await fetch(`${API}/api/admin/history/student?student_name=${encodeURIComponent(name)}&days=${days}`, { headers: H });
      setRecords(await r.json());
    } catch {}
    setLoading(false);
  }

  const fmt = (dt: string) => dt ? new Date(dt).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) : '-';
  const fmtT = (dt: string) => dt ? new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="輸入學生姓名..."
          style={{ flex: 1, minWidth: 200, background: '#131d2e', border: '1px solid #1e2d45', color: '#e2e8f0', padding: '8px 14px', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ background: '#131d2e', border: '1px solid #1e2d45', color: '#e2e8f0', padding: '8px 12px', borderRadius: 9, fontSize: 14, fontFamily: 'inherit' }}>
          <option value={7}>近 7 天</option>
          <option value={14}>近 14 天</option>
          <option value={30}>近 30 天</option>
        </select>
        <button onClick={search} style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 9, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600 }}>查詢</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>查詢中...</div>
      ) : searched && records.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
          <div>查無紀錄</div>
        </div>
      ) : records.length > 0 ? (
        <>
          <div style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>
            {records[0]?.student_name} — {records[0]?.bus_name} — 共 {records.length} 筆紀錄
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {records.map((r, i) => (
              <div key={i} style={{ background: r.boarded_at ? 'rgba(16,185,129,.08)' : '#0f1621', border: `1px solid ${r.boarded_at ? '#064e3b' : '#1e2d45'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 22 }}>{r.boarded_at ? '✅' : '❌'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(r.session_date)} ({['日','一','二','三','四','五','六'][new Date(r.session_date).getDay()]})</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{r.bus_name} · {r.route_name}</div>
                </div>
                <div style={{ fontSize: 13, color: r.boarded_at ? '#34d399' : '#ef4444', fontWeight: 600 }}>
                  {r.boarded_at ? `上車 ${fmtT(r.boarded_at)}` : '未上車'}
                </div>
              </div>
            ))}
          </div>

          {/* 出席率統計 */}
          <div style={{ marginTop: 16, background: '#0f1621', border: '1px solid #1e2d45', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>出席率統計</div>
            {(() => {
              const boarded = records.filter(r => r.boarded_at).length;
              const pct = Math.round(boarded / records.length * 100);
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, fontWeight: 900, marginBottom: 6 }}>
                    <span>{pct}%</span>
                    <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400, alignSelf: 'flex-end' }}>{boarded}/{records.length} 天有上車</span>
                  </div>
                  <div style={{ height: 6, background: '#1e2d45', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 6 }} />
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── 統計報表 Tab ──────────────────────────────────────
function StatsTab({ token }: { token: string }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const H = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/history/stats?days=${days}`, { headers: H });
      setStats(await r.json());
    } catch {}
    setLoading(false);
  }, [days, token]);

  useEffect(() => { load(); }, [load]);

  const routes = [...new Set(stats.map(s => s.route_name))].sort();

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>統計區間：</div>
        {[7, 14, 30, 60].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
              background: days === d ? '#3b82f6' : '#131d2e', color: days === d ? '#fff' : '#64748b' }}>
            {d} 天
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>載入中...</div>
      ) : (
        routes.map(route => (
          <div key={route} style={{ marginBottom: 20 }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>{route}</div>
            {stats.filter(s => s.route_name === route).map(s => {
              const avgPct = s.enrolled_students > 0 ? Math.round((s.avg_boardings || 0) / s.enrolled_students * 100) : 0;
              return (
                <div key={s.bus_name} style={{ background: '#0f1621', border: '1px solid #1e2d45', borderRadius: 12, padding: '12px 16px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{s.bus_name}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>共出勤 {s.total_sessions || 0} 次 · {s.active_days || 0} 天</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: avgPct >= 80 ? '#10b981' : avgPct >= 60 ? '#f59e0b' : '#ef4444' }}>
                      {avgPct}%
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: '登記學生', value: s.enrolled_students || 0, unit: '人' },
                      { label: '平均上車', value: Math.round(s.avg_boardings || 0), unit: '人/次' },
                      { label: '總上車次', value: s.total_boardings || 0, unit: '人次' },
                    ].map(({ label, value, unit }) => (
                      <div key={label} style={{ background: '#131d2e', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{value}<span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}> {unit}</span></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 4, background: '#1e2d45', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${avgPct}%`, background: avgPct >= 80 ? '#10b981' : avgPct >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 4, transition: 'width .8s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
