'use client';
// src/app/admin/bus/buses/page.tsx
// v4 階段 2 — 路線屬性編輯

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBuses, updateBus } from '@/lib/busApi';
import type { BusInfo } from '@/types/bus';

export default function BusBusesPage() {
  const router = useRouter();
  const [buses, setBuses] = useState<BusInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BusInfo | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') { router.push('/admin/login'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchBuses();
      setBuses(data);
    } catch (e) {
      console.error(e);
      alert('載入失敗:' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/bus')}
            className="text-gray-400 hover:text-white text-sm">‹ 返回</button>
          <div>
            <div className="text-white font-bold text-lg">🛣️ 路線屬性</div>
            <div className="text-gray-500 text-xs">上車時間 · 交通公司 · 司機 · 車號 · 帳密</div>
          </div>
        </div>
        <div className="text-gray-500 text-xs">共 {buses.length} 條路線</div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-spin"
            style={{ border: '3px solid #1f2937', borderTopColor: '#3b82f6' }} />
          <div className="text-sm">載入中…</div>
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-300 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">路線</th>
                  <th className="px-4 py-3 text-left font-semibold">上車時間</th>
                  <th className="px-4 py-3 text-left font-semibold">交通公司</th>
                  <th className="px-4 py-3 text-left font-semibold">司機/電話</th>
                  <th className="px-4 py-3 text-left font-semibold">車號</th>
                  <th className="px-4 py-3 text-left font-semibold">帳號</th>
                  <th className="px-4 py-3 text-left font-semibold">密碼</th>
                  <th className="px-4 py-3 text-center font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-200 font-medium whitespace-nowrap">{b.bus_name}</td>
                    <Cell value={b.pickup_time} />
                    <Cell value={b.company} />
                    <Cell value={b.driver_phone} />
                    <Cell value={b.plate_number} />
                    <Cell value={b.account_id} />
                    <Cell value={b.account_pass} mask />
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => setEditing(b)}
                        className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg px-3 py-1.5 active:scale-95 transition-all">
                        編輯
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <EditModal
          bus={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Cell({ value, mask }: { value: string | null; mask?: boolean }) {
  if (!value) return <td className="px-4 py-2.5 text-gray-600">—</td>;
  return (
    <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">
      {mask ? '••••••' : value}
    </td>
  );
}

// ============================================================
// Edit Modal
// ============================================================
interface EditModalProps {
  bus: BusInfo;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}
function EditModal({ bus, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    pickup_time:   bus.pickup_time   || '',
    company:       bus.company       || '',
    driver_phone:  bus.driver_phone  || '',
    plate_number:  bus.plate_number  || '',
    account_id:    bus.account_id    || '',
    account_pass:  bus.account_pass  || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // 把空字串視為 null
      const payload: any = {};
      (Object.keys(form) as (keyof typeof form)[]).forEach((k) => {
        payload[k] = form[k].trim() === '' ? null : form[k].trim();
      });
      await updateBus(bus.id, payload);
      await onSaved();
    } catch (e) {
      console.error(e);
      alert('儲存失敗:' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <div className="text-white font-bold">🛣️ 編輯路線屬性</div>
          <div className="text-gray-500 text-xs mt-0.5">{bus.bus_name}</div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <Field label="上車時間" placeholder="0710"
            value={form.pickup_time}
            onChange={(v) => setForm({ ...form, pickup_time: v })} />
          <Field label="交通公司" placeholder="新濱"
            value={form.company}
            onChange={(v) => setForm({ ...form, company: v })} />
          <Field label="司機/電話" placeholder="蔡先生/0932-561-664"
            value={form.driver_phone}
            onChange={(v) => setForm({ ...form, driver_phone: v })} />
          <Field label="車號" placeholder="KAC-0993"
            value={form.plate_number}
            onChange={(v) => setForm({ ...form, plate_number: v })} />
          <Field label="帳號" placeholder=""
            value={form.account_id}
            onChange={(v) => setForm({ ...form, account_id: v })} />
          <Field label="密碼" placeholder=""
            value={form.account_pass}
            onChange={(v) => setForm({ ...form, account_pass: v })} />
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex gap-2 sticky bottom-0 bg-gray-900">
          <button onClick={onClose} disabled={saving}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-bold rounded-xl py-2.5 border border-gray-700 active:scale-95 transition-all">
            取消
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white text-sm font-bold rounded-xl py-2.5 active:scale-95 transition-all">
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}
function Field({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
