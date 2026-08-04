import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Save, User } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { themeConfigs } from '../../utils/themeConfig';
import type { CompanyContact } from '../../types';

interface Props {
  companyId: string;
  readOnly?: boolean;
}

const EMPTY_CONTACT: Omit<CompanyContact, 'id' | 'companyId'> = {
  name: '',
  role: '',
  phone: '',
  mobile: '',
  email: '',
  notes: '',
};

const CompanyContactsTab: React.FC<Props> = ({ companyId, readOnly = false }) => {
  const theme = useSettingsStore((s) => s.settings.theme);
  const themeColors = themeConfigs[theme];
  const token = useAuthStore((s) => s.token);
  const isDark = theme !== 'light';

  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CompanyContact | null>(null);
  const [form, setForm] = useState(EMPTY_CONTACT);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const fetchContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setContacts(await res.json());
    } catch {
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const openAdd = () => { setEditing(null); setForm(EMPTY_CONTACT); setShowModal(true); };
  const openEdit = (c: CompanyContact) => { setEditing(c); setForm({ name: c.name, role: c.role, phone: c.phone || '', mobile: c.mobile || '', email: c.email || '', notes: c.notes || '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = editing
        ? `${import.meta.env.VITE_API_URL}/companies/${companyId}/contacts/${editing.id}`
        : `${import.meta.env.VITE_API_URL}/companies/${companyId}/contacts`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setShowModal(false);
      fetchContacts();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchContacts();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold" style={{ color: themeColors.text }}>담당자</h2>
          <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>업체 담당자를 관리합니다</p>
        </div>
        {!readOnly && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
          >
            <Plus size={15} />
            담당자 추가
          </button>
        )}
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="py-12 text-center text-sm" style={{ color: themeColors.textSecondary }}>불러오는 중...</div>
      ) : contacts.length === 0 ? (
        <div className="py-14 text-center" style={cardStyle}>
          <User size={32} className="mx-auto mb-3 opacity-20" style={{ color: themeColors.textSecondary }} />
          <p className="text-sm" style={{ color: themeColors.textSecondary }}>등록된 담당자가 없습니다</p>
          {!readOnly && <button onClick={openAdd} className="mt-3 text-sm font-medium" style={{ color: themeColors.primary }}>+ 담당자 추가</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded" style={cardStyle}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ backgroundColor: `${themeColors.primary}20`, color: themeColors.primary }}
                >
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: themeColors.text }}>{c.name}</span>
                    {c.role && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${themeColors.primary}15`, color: themeColors.primary }}>
                        {c.role}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: themeColors.textSecondary }}>
                    {c.mobile && <span>{c.mobile}</span>}
                    {c.phone && <span>{c.phone}</span>}
                    {c.email && <span>{c.email}</span>}
                  </div>
                  {c.notes && <p className="text-xs mt-0.5 truncate" style={{ color: themeColors.textSecondary }}>{c.notes}</p>}
                </div>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: themeColors.textSecondary }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteId(c.id)}
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
          ))}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div
            className="rounded w-full max-w-md mx-4"
            style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, boxShadow: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <h3 className="text-base font-bold" style={{ color: themeColors.text }}>{editing ? '담당자 수정' : '담당자 추가'}</h3>
              <button onClick={() => setShowModal(false)} style={{ color: themeColors.textSecondary }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>이름 <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="홍길동"
                    className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>역할/직책</label>
                  <input
                    type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="IT 담당자"
                    className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>전화</label>
                  <input
                    type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="02-000-0000"
                    className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>휴대폰</label>
                  <input
                    type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>이메일</label>
                <input
                  type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2.5 rounded text-sm focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>메모</label>
                <textarea
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                disabled={saving || !form.name.trim()}
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
            <p className="text-sm font-medium mb-4" style={{ color: themeColors.text }}>이 담당자를 삭제하시겠습니까?</p>
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

export default CompanyContactsTab;
