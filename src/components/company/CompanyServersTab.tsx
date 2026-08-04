import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Save, Server, Eye, EyeOff } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { themeConfigs } from '../../utils/themeConfig';
import type { ServerInfo, ServerType } from '../../types';

interface Props {
  companyId: string;
  readOnly?: boolean;
}

const SERVER_TYPE_OPTIONS: { value: ServerType; label: string; group: 'OS' | 'DB' | '기타' }[] = [
  { value: 'windows', label: 'Windows', group: 'OS' },
  { value: 'linux', label: 'Linux', group: 'OS' },
  { value: 'mac', label: 'macOS', group: 'OS' },
  { value: 'mysql', label: 'MySQL', group: 'DB' },
  { value: 'mssql', label: 'MSSQL (SQL Server)', group: 'DB' },
  { value: 'oracle', label: 'Oracle DB', group: 'DB' },
  { value: 'postgresql', label: 'PostgreSQL', group: 'DB' },
  { value: 'mariadb', label: 'MariaDB', group: 'DB' },
  { value: 'mongodb', label: 'MongoDB', group: 'DB' },
  { value: 'redis', label: 'Redis', group: 'DB' },
  { value: 'other', label: '기타', group: '기타' },
];

const getTypeLabel = (t: ServerType) => SERVER_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
const isDbType = (t: ServerType) => !['windows', 'linux', 'mac', 'other'].includes(t);

const TYPE_COLORS: Record<string, string> = {
  windows: '#0078D4',
  linux: '#E95420',
  mac: '#999',
  mysql: '#4479A1',
  mssql: '#CC2927',
  oracle: '#F80000',
  postgresql: '#336791',
  mariadb: '#003545',
  mongodb: '#4DB33D',
  redis: '#DC382D',
  other: '#888',
};

const EMPTY_SERVER: Omit<ServerInfo, 'id' | 'companyId'> = {
  name: '',
  serverType: 'windows',
  hostname: '',
  port: undefined,
  osVersion: '',
  dbName: '',
  username: '',
  password: '',
  description: '',
  notes: '',
};

const CompanyServersTab: React.FC<Props> = ({ companyId, readOnly = false }) => {
  const theme = useSettingsStore((s) => s.settings.theme);
  const themeColors = themeConfigs[theme];
  const token = useAuthStore((s) => s.token);
  const isDark = theme !== 'light';

  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ServerInfo | null>(null);
  const [form, setForm] = useState<Omit<ServerInfo, 'id' | 'companyId'>>(EMPTY_SERVER);
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

  const fetchServers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setServers(await res.json());
    } catch {
      setServers([]);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_SERVER);
    setShowModal(true);
  };

  const openEdit = (s: ServerInfo) => {
    setEditing(s);
    setForm({
      name: s.name, serverType: s.serverType, hostname: s.hostname,
      port: s.port, osVersion: s.osVersion || '', dbName: s.dbName || '',
      username: s.username, password: s.password,
      description: s.description || '', notes: s.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.hostname.trim()) return;
    setSaving(true);
    try {
      const url = editing
        ? `${import.meta.env.VITE_API_URL}/companies/${companyId}/servers/${editing.id}`
        : `${import.meta.env.VITE_API_URL}/companies/${companyId}/servers`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, port: form.port || null }),
      });
      if (!res.ok) throw new Error();
      setShowModal(false);
      fetchServers();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}/servers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchServers();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const typeColor = (t: ServerType) => TYPE_COLORS[t] || '#888';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold" style={{ color: themeColors.text }}>서버 접속 정보</h2>
          <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>OS 서버 및 DB 서버 접속 정보를 관리합니다</p>
        </div>
        {!readOnly && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
          >
            <Plus size={15} />
            서버 추가
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm" style={{ color: themeColors.textSecondary }}>불러오는 중...</div>
      ) : servers.length === 0 ? (
        <div className="py-14 text-center" style={cardStyle}>
          <Server size={32} className="mx-auto mb-3 opacity-20" style={{ color: themeColors.textSecondary }} />
          <p className="text-sm" style={{ color: themeColors.textSecondary }}>등록된 서버 정보가 없습니다</p>
          {!readOnly && <button onClick={openAdd} className="mt-3 text-sm font-medium" style={{ color: themeColors.primary }}>+ 서버 추가</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {servers.map((s) => (
            <div key={s.id} className="rounded px-4 py-3" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${typeColor(s.serverType)}20` }}
                  >
                    <Server size={16} style={{ color: typeColor(s.serverType) }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: themeColors.text }}>{s.name}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${typeColor(s.serverType)}18`, color: typeColor(s.serverType), border: `1px solid ${typeColor(s.serverType)}40` }}
                      >
                        {getTypeLabel(s.serverType)}
                      </span>
                      {isDbType(s.serverType) && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: themeColors.textSecondary }}>
                          DB
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: themeColors.textSecondary }}>
                      <span className="font-mono">{s.hostname}{s.port ? `:${s.port}` : ''}</span>
                      {s.dbName && <span>DB: {s.dbName}</span>}
                      {s.osVersion && <span>{s.osVersion}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: themeColors.textSecondary }}>
                      <span>ID: <span className="font-mono" style={{ color: themeColors.text }}>{s.username}</span></span>
                      <span className="flex items-center gap-1">
                        PW:{' '}
                        <span className="font-mono" style={{ color: themeColors.text }}>
                          {showPassMap[s.id] ? s.password : '••••••••'}
                        </span>
                        <button
                          onClick={() => setShowPassMap((p) => ({ ...p, [s.id]: !p[s.id] }))}
                          className="ml-0.5"
                          style={{ color: themeColors.textSecondary }}
                          title={showPassMap[s.id] ? '숨기기' : '보기'}
                        >
                          {showPassMap[s.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </span>
                    </div>
                    {s.description && <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>{s.description}</p>}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: themeColors.textSecondary }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(s.id)}
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
            className="rounded w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ borderBottom: `1px solid ${themeColors.border}`, backgroundColor: themeColors.surface }}>
              <h3 className="text-base font-bold" style={{ color: themeColors.text }}>{editing ? '서버 수정' : '서버 추가'}</h3>
              <button onClick={() => setShowModal(false)} style={{ color: themeColors.textSecondary }}><X size={18} /></button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>서버명 <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="웹 서버 1"
                    className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>서버 타입</label>
                  <select
                    value={form.serverType}
                    onChange={(e) => setForm({ ...form, serverType: e.target.value as ServerType })}
                    className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    <optgroup label="OS 서버">
                      {SERVER_TYPE_OPTIONS.filter((o) => o.group === 'OS').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="DB 서버">
                      {SERVER_TYPE_OPTIONS.filter((o) => o.group === 'DB').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="기타">
                      {SERVER_TYPE_OPTIONS.filter((o) => o.group === '기타').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>호스트/IP <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text" value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                    placeholder="192.168.1.10"
                    className="w-full px-3 py-2.5 rounded text-sm font-mono focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>포트</label>
                  <input
                    type="number" value={form.port ?? ''} onChange={(e) => setForm({ ...form, port: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="3306"
                    className="w-full px-3 py-2.5 rounded text-sm font-mono focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              {!isDbType(form.serverType) && form.serverType !== 'other' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>OS 버전</label>
                  <input
                    type="text" value={form.osVersion ?? ''} onChange={(e) => setForm({ ...form, osVersion: e.target.value })}
                    placeholder="Windows Server 2019"
                    className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              )}

              {isDbType(form.serverType) && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>DB명</label>
                  <input
                    type="text" value={form.dbName ?? ''} onChange={(e) => setForm({ ...form, dbName: e.target.value })}
                    placeholder="production_db"
                    className="w-full px-3 py-2.5 rounded text-sm font-mono focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>접속 ID</label>
                  <input
                    type="text" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="admin"
                    className="w-full px-3 py-2.5 rounded text-sm font-mono focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>접속 PW</label>
                  <PasswordInput
                    value={form.password}
                    onChange={(v) => setForm({ ...form, password: v })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>설명</label>
                <input
                  type="text" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="서버 용도 설명"
                  className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                  style={inputStyle}
                />
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
                disabled={saving || !form.name.trim() || !form.hostname.trim()}
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
            <p className="text-sm font-medium mb-4" style={{ color: themeColors.text }}>이 서버 정보를 삭제하시겠습니까?</p>
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

// 비밀번호 입력 (show/hide 토글)
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

export default CompanyServersTab;
