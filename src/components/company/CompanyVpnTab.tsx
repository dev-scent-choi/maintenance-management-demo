import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Save, Shield, Eye, EyeOff } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { themeConfigs } from '../../utils/themeConfig';
import type { VpnAccount } from '../../types';

interface Props {
  companyId: string;
  readOnly?: boolean;
}

const VPN_TYPE_OPTIONS = [
  'Cisco AnyConnect',
  'FortiClient',
  'OpenVPN',
  'WireGuard',
  'L2TP/IPSec',
  'PPTP',
  '기타',
];

const EMPTY_VPN: Omit<VpnAccount, 'id' | 'companyId'> = {
  name: '',
  vpnType: 'Cisco AnyConnect',
  server: '',
  port: undefined,
  username: '',
  password: '',
  notes: '',
};

const CompanyVpnTab: React.FC<Props> = ({ companyId, readOnly = false }) => {
  const theme = useSettingsStore((s) => s.settings.theme);
  const themeColors = themeConfigs[theme];
  const token = useAuthStore((s) => s.token);
  const isDark = theme !== 'light';

  const [accounts, setAccounts] = useState<VpnAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<VpnAccount | null>(null);
  const [form, setForm] = useState<Omit<VpnAccount, 'id' | 'companyId'>>(EMPTY_VPN);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPassMap, setShowPassMap] = useState<Record<string, boolean>>({});

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.surface,
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px',
    boxShadow: 'none',
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border: `1.5px solid ${themeColors.border}`,
    color: themeColors.text,
    borderRadius: '4px',
  };

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}/vpn-accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setAccounts(await res.json());
    } catch {
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openAdd = () => { setEditing(null); setForm(EMPTY_VPN); setShowModal(true); };
  const openEdit = (a: VpnAccount) => {
    setEditing(a);
    setForm({ name: a.name, vpnType: a.vpnType, server: a.server, port: a.port, username: a.username, password: a.password, notes: a.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.server.trim()) return;
    setSaving(true);
    try {
      const url = editing
        ? `${import.meta.env.VITE_API_URL}/companies/${companyId}/vpn-accounts/${editing.id}`
        : `${import.meta.env.VITE_API_URL}/companies/${companyId}/vpn-accounts`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, port: form.port || null }),
      });
      if (!res.ok) throw new Error();
      setShowModal(false);
      fetchAccounts();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}/vpn-accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchAccounts();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold" style={{ color: themeColors.text }}>VPN 접속 정보</h2>
          <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>VPN 계정 정보를 관리합니다</p>
        </div>
        {!readOnly && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
          >
            <Plus size={15} />
            VPN 계정 추가
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm" style={{ color: themeColors.textSecondary }}>불러오는 중...</div>
      ) : accounts.length === 0 ? (
        <div className="py-14 text-center" style={cardStyle}>
          <Shield size={32} className="mx-auto mb-3 opacity-20" style={{ color: themeColors.textSecondary }} />
          <p className="text-sm" style={{ color: themeColors.textSecondary }}>등록된 VPN 계정이 없습니다</p>
          {!readOnly && <button onClick={openAdd} className="mt-3 text-sm font-medium" style={{ color: themeColors.primary }}>+ VPN 계정 추가</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {accounts.map((a) => (
            <div key={a.id} className="rounded px-4 py-3" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${themeColors.primary}15` }}
                  >
                    <Shield size={16} style={{ color: themeColors.primary }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: themeColors.text }}>{a.name}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${themeColors.primary}12`, color: themeColors.primary }}
                      >
                        {a.vpnType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: themeColors.textSecondary }}>
                      <span className="font-mono">{a.server}{a.port ? `:${a.port}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: themeColors.textSecondary }}>
                      <span>ID: <span className="font-mono" style={{ color: themeColors.text }}>{a.username}</span></span>
                      <span className="flex items-center gap-1">
                        PW:{' '}
                        <span className="font-mono" style={{ color: themeColors.text }}>
                          {showPassMap[a.id] ? a.password : '••••••••'}
                        </span>
                        <button
                          onClick={() => setShowPassMap((p) => ({ ...p, [a.id]: !p[a.id] }))}
                          className="ml-0.5"
                          style={{ color: themeColors.textSecondary }}
                          title={showPassMap[a.id] ? '숨기기' : '보기'}
                        >
                          {showPassMap[a.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </span>
                    </div>
                    {a.notes && <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>{a.notes}</p>}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(a)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: themeColors.textSecondary }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(a.id)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: '#EF4444' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div
            className="rounded w-full max-w-md"
            style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <h3 className="text-base font-bold" style={{ color: themeColors.text }}>{editing ? 'VPN 계정 수정' : 'VPN 계정 추가'}</h3>
              <button onClick={() => setShowModal(false)} style={{ color: themeColors.textSecondary }}><X size={18} /></button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>계정명/설명 <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="메인 VPN"
                  className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>VPN 종류</label>
                <select
                  value={form.vpnType}
                  onChange={(e) => setForm({ ...form, vpnType: e.target.value })}
                  className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                  style={{ ...inputStyle, appearance: 'auto' }}
                >
                  {VPN_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>VPN 서버 주소 <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text" value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })}
                    placeholder="vpn.example.com"
                    className="w-full px-3 py-2.5 rounded text-sm font-mono focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>포트</label>
                  <input
                    type="number" value={form.port ?? ''} onChange={(e) => setForm({ ...form, port: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="443"
                    className="w-full px-3 py-2.5 rounded text-sm font-mono focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>접속 ID</label>
                  <input
                    type="text" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="username"
                    className="w-full px-3 py-2.5 rounded text-sm font-mono focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>접속 PW</label>
                  <PasswordInput value={form.password} onChange={(v) => setForm({ ...form, password: v })} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>메모</label>
                <textarea
                  value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="추가 정보"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded text-sm focus:outline-none resize-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.server.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
              >
                <Save size={14} />
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-sm font-medium" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: themeColors.text, borderRadius: '4px' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteId(null)}>
          <div
            className="rounded max-w-sm w-full mx-4 p-5"
            style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium mb-4" style={{ color: themeColors.text }}>이 VPN 계정을 삭제하시겠습니까?</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2 rounded text-sm font-medium text-white bg-red-500 hover:bg-red-600">삭제</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded text-sm font-medium" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: themeColors.text }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PasswordInput: React.FC<{ value: string; onChange: (v: string) => void; style: React.CSSProperties }> = ({ value, onChange, style }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className="w-full px-3 py-2.5 pr-9 rounded text-sm font-mono focus:outline-none"
        style={style}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
        tabIndex={-1}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
};

export default CompanyVpnTab;
