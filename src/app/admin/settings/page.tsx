'use client';
// src/app/admin/settings/page.tsx — 系統設定(車隊參數)
// 階段 3a — 給老師調車隊規模、載客上限、排車門檻

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchConfig, updateConfig } from '@/lib/busApi';
import type { SystemConfigRow } from '@/types/bus';

// 設定的顯示順序 + 群組
const CONFIG_GROUPS = [
  {
    title: '車隊規模',
    emoji: '🚌',
    keys: ['FLEET_BIG_BUS', 'FLEET_VAN'],
    note: '老師上線後實際數量,排車引擎會用這個值',
  },
  {
    title: '載客上限',
    emoji: '👥',
    keys: ['BIG_BUS_CAP_MORNING', 'BIG_BUS_CAP_AFTERNOON', 'VAN_CAP'],
    note: '硬規則,排車引擎不會超過這個數字',
  },
  {
    title: '排車門檻',
    emoji: '⚙️',
    keys: ['BIG_BUS_THRESHOLD'],
    note: '同站學生超過此數則強制中巴(硬規則)',
  },
];

const LABELS: Record<string, string> = {
  FLEET_BIG_BUS: '中巴總台數',
  FLEET_VAN: '廂型車總台數',
  BIG_BUS_CAP_MORNING: '中巴上學上限',
  BIG_BUS_CAP_AFTERNOON: '中巴下午/晚上上限',
  VAN_CAP: '廂型車上限',
  BIG_BUS_THRESHOLD: '同站必中巴門檻',
};

export default function SettingsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<SystemConfigRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
      router.push('/admin/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchConfig();
      setConfigs(data);
    } catch (e) {
      setMsg(`✗ 載入失敗:${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const getValue = (key: string): string => {
    if (edits[key] !== undefined) return edits[key];
    return configs.find((c) => c.config_key === key)?.config_value ?? '';
  };

  const hasUnsaved = Object.keys(edits).some((key) => {
    const original = configs.find((c) => c.config_key === key)?.config_value;
    return edits[key] !== original;
  });

  const handleChange = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const changed = Object.entries(edits)
      .filter(([key, val]) => {
        const original = configs.find((c) => c.config_key === key)?.config_value;
        return val !== original;
      })
      .map(([key, value]) => ({ key, value }));

    if (changed.length === 0) {
      setMsg('沒有變更');
      return;
    }

    // 驗證:都要是非負整數
    for (const c of changed) {
      const n = Number(c.value);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        setMsg(`✗「${LABELS[c.key] || c.key}」必須是非負整數`);
        return;
      }
    }

    setSaving(true);
    setMsg(null);
    try {
      const newConfigs = await updateConfig(changed);
      setConfigs(newConfigs);
      setEdits({});
      setMsg(`✓ 已存 ${changed.length} 筆`);
    } catch (e) {
      setMsg(`✗ 存檔失敗:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-950 text-gray-400 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: '3px solid #1f2937', borderTopColor: '#3b82f6' }}
          />
          <div className="text-sm">載入中…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-950 pb-32">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-400 hover:text-white text-sm"
          >
            ‹ 返回
          </button>
          <div>
            <div className="text-white font-bold text-lg">⚙️ 系統設定</div>
            <div className="text-gray-500 text-xs">車隊參數 · 排車門檻</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <p className="text-gray-400 text-xs px-1">
          排車引擎會用這些參數計算車輛容量。改完按「儲存變更」生效。
        </p>

        {CONFIG_GROUPS.map((group) => (
          <div
            key={group.title}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{group.emoji}</span>
              <h2 className="text-white font-bold text-sm">{group.title}</h2>
            </div>
            <p className="text-gray-500 text-xs mb-3">{group.note}</p>

            <div className="space-y-2">
              {group.keys.map((key) => {
                const c = configs.find((c) => c.config_key === key);
                const isDirty =
                  edits[key] !== undefined && edits[key] !== c?.config_value;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 bg-gray-950 rounded-xl px-3 py-2 border border-gray-800"
                  >
                    <label className="flex-1 text-sm text-gray-200">
                      {LABELS[key] || key}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={getValue(key)}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className={`w-20 bg-gray-800 border rounded-lg px-2 py-1 text-white text-right text-sm focus:outline-none focus:ring-1 ${
                        isDirty
                          ? 'border-amber-500 ring-amber-500/40'
                          : 'border-gray-700 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                    />
                    {isDirty && (
                      <span className="text-amber-400 text-xs">●</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex items-center gap-3 z-10">
        <button
          onClick={handleSave}
          disabled={!hasUnsaved || saving}
          className="bg-blue-700 hover:bg-blue-600 active:scale-95 transition-all disabled:bg-gray-700 disabled:text-gray-500 text-white px-5 py-2 rounded-xl text-sm font-bold"
        >
          {saving ? '儲存中…' : '儲存變更'}
        </button>
        {hasUnsaved && (
          <button
            onClick={() => {
              setEdits({});
              setMsg(null);
            }}
            disabled={saving}
            className="text-sm text-gray-400 underline"
          >
            放棄
          </button>
        )}
        {msg && (
          <span
            className={`text-xs ${
              msg.startsWith('✗') ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
