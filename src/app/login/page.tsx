'use client';
// src/app/login/page.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole]       = useState<'parent' | 'driver' | 'admin'>('parent');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const roleLabels = { parent: '家長', driver: '司機', admin: '管理員' };
  const roleIcons  = { parent: '👨‍👩‍👧', driver: '🚌', admin: '🏫' };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password, role }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || '登入失敗'); return; }

      localStorage.setItem('token', d.token);
      localStorage.setItem('role', d.role);
      localStorage.setItem('name', d.name);

      const redirect = { parent: '/parent', driver: '/driver', admin: '/admin' };
      router.push(redirect[role]);
    } catch { setError('無法連線，請稍後再試'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🚌</div>
          <div className="text-white font-bold text-2xl">校車定位系統</div>
          <div className="text-gray-500 text-sm mt-1">安全接送，掌握位置</div>
        </div>

        {/* 角色選擇 */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {(['parent', 'driver', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`py-3 rounded-2xl text-sm font-medium transition-all
                ${role === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              <div className="text-xl mb-1">{roleIcons[r]}</div>
              {roleLabels[r]}
            </button>
          ))}
        </div>

        {/* 表單 */}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="帳號"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4
                       text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4
                       text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !account || !password}
            className="w-full py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95
                       text-white font-bold text-lg transition-all disabled:opacity-50"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </div>
      </div>
    </div>
  );
}
