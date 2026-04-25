'use client';
// src/app/admin/accounts/page.tsx — 帳號管理
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type Role = 'driver' | 'parent' | 'admin';

const roleLabel: Record<Role, string> = {
  driver: '司機', parent: '家長', admin: '管理員',
};
const roleColor: Record<Role, string> = {
  driver: 'bg-teal-900/40 text-teal-300 border-teal-700/40',
  parent: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  admin:  'bg-purple-900/40 text-purple-300 border-purple-700/40',
};

interface Account {
  id: number; name: string; account: string;
  phone: string; role: Role; is_active: number;
}

const emptyForm = { name: '', account: '', password: '', phone: '', role: 'driver' as Role };

export default function AccountsPage() {
  const router = useRouter();
  const [data, setData]         = useState<{ drivers: Account[]; parents: Account[]; admins: Account[] }>({ drivers: [], parents: [], admins: [] });
  const [tab, setTab]           = useState<Role>('driver');
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Account | null>(null);
  const [form, setForm]         = useState({ ...emptyForm });
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');

  const token   = () => localStorage.getItem('token');
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  const flash = (m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
    setTimeout(() => { setMsg(''); setErr(''); }, 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/accounts`, { headers: { Authorization: `Bearer ${token()}` } });
      if (r.status === 401) { router.push('/login'); return; }
      const d = await r.json();
      setData(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, role: tab });
    setShowForm(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setForm({ name: acc.name, account: acc.account, password: '', phone: acc.phone || '', role: acc.role });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.account) { flash('請填寫姓名和帳號', true); return; }
    if (!editing && !form.password) { flash('新增帳號必須設定密碼', true); return; }

    try {
      if (editing) {
        const r = await fetch(`${API}/api/admin/accounts/${editing.role}/${editing.id}`, {
          method: 'PUT', headers: headers(), body: JSON.stringify(form),
        });
        const d = await r.json();
        if (!r.ok) { flash(d.error, true); return; }
        flash('✅ 修改成功');
      } else {
        const r = await fetch(`${API}/api/admin/accounts`, {
          method: 'POST', headers: headers(), body: JSON.stringify(form),
        });
        const d = await r.json();
        if (!r.ok) { flash(d.error, true); return; }
        flash('✅ 新增成功');
      }
      setShowForm(false);
      fetchData();
    } catch { flash('發生錯誤', true); }
  };

  const handleDelete = async (acc: Account) => {
    if (!confirm(`確定要刪除「${acc.name}」的帳號嗎？`)) return;
    try {
      await fetch(`${API}/api/admin/accounts/${acc.role}/${acc.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      });
      flash('✅ 已刪除');
      fetchData();
    } catch { flash('刪除失敗', true); }
  };

  const currentList = tab === 'driver' ? data.drivers : tab === 'parent' ? data.parents : data.admins;

  const tabs: Role[] = ['driver', 'parent', 'admin'];
  const tabCount: Record<Role, number> = {
    driver: data.drivers.length,
    parent: data.parents.length,
    admin:  data.admins.length,
  };

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="text-gray-400 text-xl">←</button>
        <div className="flex-1">
          <div className="text-white font-bold">帳號管理</div>
          <div className="text-gray-500 text-xs">新增 / 修改 / 刪除帳號</div>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
        >
          + 新增
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-2 px-4 py-3">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all
              ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            {roleLabel[t]}<span className="ml-1 text-xs opacity-70">({tabCount[t]})</span>
          </button>
        ))}
      </div>

      {/* 帳號列表 */}
      <div className="flex-1 px-4 pb-8 space-y-3">
        {loading ? (
          <div className="text-gray-500 text-center py-12">載入中...</div>
        ) : currentList.length === 0 ? (
          <div className="text-gray-600 text-center py-12">
            <div className="text-3xl mb-2">👤</div>
            <div>尚無{roleLabel[tab]}帳號</div>
            <button onClick={openAdd} className="mt-3 text-blue-400 text-sm">+ 新增一個</button>
          </div>
        ) : (
          currentList.map((acc) => (
            <div key={acc.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gray-800 flex items-center justify-center text-xl">
                    {acc.role === 'driver' ? '🚌' : acc.role === 'parent' ? '👨‍👩‍👧' : '🏫'}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{acc.name}</div>
                    <div className="text-gray-400 text-sm mt-0.5">帳號：{acc.account}</div>
                    {acc.phone && <div className="text-gray-500 text-xs mt-0.5">📱 {acc.phone}</div>}
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-xs border ${roleColor[acc.role]}`}>
                  {roleLabel[acc.role]}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => openEdit(acc)}
                  className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
                >
                  ✏️ 修改
                </button>
                <button
                  onClick={() => handleDelete(acc)}
                  className="flex-1 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-400 text-sm border border-red-900/30"
                >
                  🗑️ 刪除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新增/修改表單 Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-gray-900 border-t border-gray-700 rounded-t-3xl w-full max-w-lg mx-auto px-4 py-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-white font-bold text-lg">
                {editing ? '修改帳號' : '新增帳號'}
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl">×</button>
            </div>

            {/* 角色選擇（新增時） */}
            {!editing && (
              <div>
                <label className="text-gray-400 text-xs px-1">角色</label>
                <div className="flex gap-2 mt-1">
                  {tabs.map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(p => ({ ...p, role: t }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${form.role === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                    >
                      {roleLabel[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {[
              { key: 'name',     label: '姓名 *',   type: 'text',     placeholder: '王小明' },
              { key: 'account',  label: '帳號 *',   type: 'text',     placeholder: 'parent1' },
              { key: 'password', label: editing ? '新密碼（留空不修改）' : '密碼 *', type: 'password', placeholder: '請輸入密碼' },
              { key: 'phone',    label: '手機號碼',  type: 'tel',      placeholder: '0912345678' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-gray-400 text-xs px-1">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                             text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}

            {err && <div className="text-red-400 text-sm text-center">{err}</div>}
            {msg && <div className="text-emerald-400 text-sm text-center">{msg}</div>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-2xl bg-gray-800 text-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                {editing ? '儲存修改' : '新增帳號'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {(msg || err) && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full
                        shadow-2xl text-sm text-white
                        ${err ? 'bg-red-700' : 'bg-emerald-700'}`}>
          {msg || err}
        </div>
      )}
    </div>
  );
}
