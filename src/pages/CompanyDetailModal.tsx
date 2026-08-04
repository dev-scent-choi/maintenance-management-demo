import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Trash2, AlertCircle, Search, ZoomIn, ZoomOut, RotateCw, CheckCircle, Building2, Phone, FileText, History, ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { usePermission } from '../hooks/usePermission';
import { isAdminAccount } from '../utils/permissions';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../hooks/useToast';
import InlineEditField from '../components/InlineEditField';
import DaumPostcode from 'react-daum-postcode';
import ConfirmPopover from '../components/common/ConfirmPopover';

interface Props {
  companyId: string | null;
  initialCompany?: any;
  onClose: () => void;
  onDeleted: () => void;
}

const CompanyDetailModal: React.FC<Props> = ({ companyId, initialCompany, onClose, onDeleted }) => {
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const { token } = useAuthStore();
  const user = useAuthStore((state) => state.user);
  const { addLog } = useAuditLogStore();
  const { can } = usePermission();
  const toast = useToast();
  const isDark = theme !== 'light';

  const [company, setCompany] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [showPostcode, setShowPostcode] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // image lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const [imgDragging, setImgDragging] = useState(false);
  const [imgDragStart, setImgDragStart] = useState({ x: 0, y: 0 });

  // draggable modal
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleDragStart = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => setModalPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  // 데이터 로드 완료 후 transform 방식 → left/top 픽셀 방식으로 전환하여 높이 변화에 따른 위치 이동 방지
  useLayoutEffect(() => {
    if (company && modalPos === null && modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setModalPos({ x: rect.left, y: rect.top });
    }
  }, [company?.id]);

  useEffect(() => {
    if (!lightboxSrc) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [lightboxSrc]);

  useEffect(() => {
    if (!companyId) return;
    setModalPos(null);
    setSaveState('idle');
    if (initialCompany) {
      setCompany(initialCompany);
      setIsLoading(false);
      return;
    }
    setCompany(null);
    setIsLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setCompany(data); setIsLoading(false); })
      .catch(() => { toast.error('업체 정보를 불러오지 못했습니다.'); setIsLoading(false); });
  }, [companyId, token]);

  // notes innerHTML — only reset when a different company loads, not on field updates
  useEffect(() => {
    if (notesRef.current && company !== null) {
      notesRef.current.innerHTML = company.notes || '';
    }
  }, [company?.id]);

  if (!companyId || isLoading) return null;

  const FIELD_LABELS: Record<string, string> = {
    name: '업체명', businessNumber: '사업자번호', representative: '담당자',
    contact: '담당자 연락처', email: '이메일', phone: '유선번호', mobile: '휴대번호',
    address: '주소', notes: '메모', contractStatus: '계약상태',
    maintenanceStartDate: '계약 시작일', maintenanceEndDate: '계약 종료일',
  };
  const CONTRACT_LABELS: Record<string, string> = { maintenance: '유지보수', project: '프로젝트', ended: '계약종료' };
  const stripHtml = (v: string) => v?.replace(/<[^>]*>/g, '').trim() || '';
  const displayVal = (key: string, val: any) => {
    if (key === 'contractStatus') return CONTRACT_LABELS[val] || val || '-';
    if (key === 'notes') return stripHtml(String(val || '')) || '-';
    return String(val || '').trim() || '-';
  };

  const handleFieldSave = async (updates: Record<string, any>) => {
    if (!companyId || !token || !company) return;
    const updated = { ...company, ...updates };

    // 변경된 필드 diff 계산
    const changes = Object.keys(updates)
      .filter((key) => String(company[key] || '') !== String(updates[key] || ''))
      .map((key) => ({
        field: FIELD_LABELS[key] || key,
        oldValue: displayVal(key, company[key]),
        newValue: displayVal(key, updates[key]),
      }));
    const details = changes.length > 0
      ? changes.map((c) => `${c.field}: ${c.oldValue} → ${c.newValue}`).join(' / ')
      : `업체 정보 수정: ${updated.name}`;

    setCompany(updated);
    setSaveState('saving');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updated.name, businessNumber: updated.businessNumber || null,
          representative: updated.representative || null, contact: updated.contact || null,
          email: updated.email || null, phone: updated.phone || null, mobile: updated.mobile || null,
          address: updated.address || null, notes: updated.notes || null,
          contractStatus: updated.contractStatus,
          maintenanceContract: updated.contractStatus === 'maintenance',
          maintenanceStartDate: updated.maintenanceStartDate || null,
          maintenanceEndDate: updated.maintenanceEndDate || null,
        })
      });
      if (!res.ok) throw new Error();
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
      try {
        const logRes = await fetch(import.meta.env.VITE_API_URL + '/audit-logs', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id, userName: user?.name, action: 'update',
            resourceType: 'company', resourceId: companyId,
            resourceName: updated.name, details,
          }),
        });
        if (!logRes.ok) {
          const errText = await logRes.text();
        }
      } catch (e) {
      }
      if (showHistory) fetchHistory();
    } catch { setSaveState('idle'); toast.error('저장에 실패했습니다.'); }
  };

  const executeDelete = async () => {
    if (!companyId || !token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' })
      });
      if (!res.ok) throw new Error();
      addLog({ userId: user?.id, userName: user?.name, action: 'delete', resourceType: 'company', resourceId: companyId, resourceName: company?.name, details: `업체 삭제: ${company?.name}` });
      toast.success('업체가 삭제되었습니다.');
      onDeleted(); onClose();
    } catch { toast.error('삭제에 실패했습니다.'); }
  };

  const formatPhone = (v: string) => {
    const n = v.replace(/[^0-9]/g, '');
    if (n.length <= 3) return n;
    if (n.length <= 7) return `${n.slice(0, 3)}-${n.slice(3)}`;
    return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7, 11)}`;
  };

  const handlePostcodeComplete = (data: any) => {
    let full = data.address;
    let extra = '';
    if (data.addressType === 'R') {
      if (data.bname) extra += data.bname;
      if (data.buildingName) extra += extra ? `, ${data.buildingName}` : data.buildingName;
      if (extra) full += ` (${extra})`;
    }
    handleFieldSave({ address: full });
    setShowPostcode(false);
  };

  const openLightbox = (src: string) => { setLightboxSrc(src); setZoom(100); setRotation(0); setImgPos({ x: 0, y: 0 }); };

  const fetchHistory = async () => {
    if (!companyId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/audit-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const filtered = data
          .filter((l: any) => String(l.resourceId) === String(companyId) && l.resourceType === 'company')
          .map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }))
          .sort((a: any, b: any) => b.timestamp - a.timestamp);
        setHistoryLogs(filtered);
      }
    } catch (error) {
    } finally { setHistoryLoading(false); }
  };

  const toggleHistory = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) fetchHistory();
  };

  const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('ko-KR') : '-';
  const contractStatus = company?.contractStatus || (company?.maintenanceContract ? 'maintenance' : 'project');
  const statusLabel = contractStatus === 'maintenance' ? '유지보수' : contractStatus === 'project' ? '프로젝트' : '계약종료';

  // shared styles
  const sectionCard: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(55,53,47,0.02)',
    border: `1px solid ${themeColors.border}`, borderRadius: '4px', padding: '16px',
  };
  const fl: React.CSSProperties = { color: themeColors.textSecondary, fontSize: '11px', marginBottom: '4px' };
  const sectionHead = (icon: React.ReactNode, label: string) => (
    <div className="flex items-center gap-1.5 mb-3.5">
      <span style={{ color: themeColors.textSecondary, display: 'flex' }}>{icon}</span>
      <span style={{ color: themeColors.textSecondary, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );

  return (
    <>
      <style>{`.notes-detail img { cursor: zoom-in !important; }`}</style>

      <div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div
        ref={modalRef}
        className="fixed z-50 flex flex-col"
        style={{
          left: modalPos ? modalPos.x : '50%',
          top: modalPos ? modalPos.y : '50%',
          transform: modalPos ? 'none' : 'translate(-50%, -50%)',
          width: 'min(840px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 64px)',
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
          borderRadius: '14px',
          boxShadow: isDark
            ? '0 2px 4px rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.65)'
            : '0 2px 8px rgba(15,15,15,0.07), 0 8px 24px rgba(15,15,15,0.13), 0 24px 56px rgba(15,15,15,0.12)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{
            borderBottom: `1px solid ${themeColors.border}`,
            cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none',
            background: isDark ? `linear-gradient(135deg, ${themeColors.primary}14 0%, transparent 100%)` : `linear-gradient(135deg, ${themeColors.primary}0C 0%, transparent 100%)`,
          }}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${themeColors.primary}18` }}>
              <Building2 size={14} style={{ color: themeColors.primary }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>업체 관리</p>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold leading-tight" style={{ color: themeColors.text }}>
                  {isLoading ? '불러오는 중...' : (company?.name || '업체 상세')}
                </h2>
                {company && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>
                    {statusLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            {saveState !== 'idle' && (
              <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded"
                style={{ color: saveState === 'saved' ? themeColors.primary : themeColors.textSecondary, backgroundColor: saveState === 'saved' ? `${themeColors.primary}12` : 'transparent' }}>
                {saveState === 'saving'
                  ? <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" /></svg>저장 중...</>
                  : <><CheckCircle size={12} />저장됨</>}
              </span>
            )}
            {can('delete_companies') && company && (
              <button type="button" onClick={() => setConfirmConfig({ title: '선택한 업체가 삭제됩니다.', description: '삭제하면 복구할 수 없습니다.', onConfirm: async () => { setConfirmConfig(null); await executeDelete(); } })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer' }}>
                <Trash2 size={13} />삭제
              </button>
            )}
            <button type="button" onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-60 transition-opacity"
              style={{ color: themeColors.textSecondary, cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {!company ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: themeColors.textSecondary }}>
              업체 정보를 찾을 수 없습니다.
            </div>
          ) : (
            <div className="flex gap-4" style={{ gap: 0 }}>
              {/* 왼쪽 2/3 */}
              <div className="flex-1 flex flex-col gap-4 min-w-0" style={{ paddingRight: '20px' }}>

                {/* 기본 정보 */}
                <div style={sectionCard}>
                  {sectionHead(<Building2 size={12} />, '기본 정보')}
                  <div className="space-y-3">
                    <div>
                      <p style={fl}>{t('companyName')}</p>
                      <InlineEditField value={company.name} onSave={(v) => handleFieldSave({ name: v })}
                        placeholder={t('companyName')} style={{ fontSize: '14px', fontWeight: 600, color: themeColors.primary }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p style={fl}>{t('businessNumber')}</p>
                        <InlineEditField value={company.businessNumber} onSave={(v) => handleFieldSave({ businessNumber: v })}
                          placeholder="000-00-00000" style={{ fontSize: '14px', color: themeColors.text }} />
                      </div>
                      <div>
                        <p style={fl}>{t('representative')}</p>
                        <InlineEditField value={company.representative} onSave={(v) => handleFieldSave({ representative: v })}
                          placeholder={t('representative')} style={{ fontSize: '14px', color: themeColors.text }} />
                      </div>
                    </div>
                    <div>
                      <p style={fl}>{t('address')}</p>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 px-2 py-1.5 text-sm cursor-pointer block"
                          style={{ color: company.address ? themeColors.text : themeColors.textSecondary, opacity: company.address ? 1 : 0.5, border: '1.5px solid transparent', borderRadius: '4px', transition: 'background 0.1s', fontSize: '14px' }}
                          onClick={() => setShowPostcode(true)}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.08)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                          {company.address || '클릭하여 주소 검색'}
                        </span>
                        <button type="button" onClick={() => setShowPostcode(true)}
                          className="flex items-center gap-1 flex-shrink-0 text-xs font-medium transition-opacity hover:opacity-70"
                          style={{ color: themeColors.primary }}>
                          <Search size={11} />검색
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 연락처 */}
                <div style={sectionCard}>
                  {sectionHead(<Phone size={12} />, '연락처')}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p style={fl}>{t('companyContact')}</p>
                        <InlineEditField value={company.contact} onSave={(v) => handleFieldSave({ contact: v })}
                          placeholder={t('companyContact')} style={{ fontSize: '14px', color: themeColors.text }} />
                      </div>
                      <div>
                        <p style={fl}>{t('email')}</p>
                        <InlineEditField value={company.email} type="email" onSave={(v) => handleFieldSave({ email: v })}
                          placeholder="email@example.com" style={{ fontSize: '14px', color: themeColors.text }} />
                      </div>
                    </div>
                    <div>
                      <p style={{ ...fl, marginBottom: '6px' }}>전화번호</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p style={{ ...fl, fontSize: '10px', opacity: 0.7 }}>유선</p>
                          <InlineEditField value={company.phone} type="tel" onSave={(v) => handleFieldSave({ phone: formatPhone(v) })}
                            placeholder="02-000-0000" style={{ fontSize: '14px', color: themeColors.text }} />
                        </div>
                        <div>
                          <p style={{ ...fl, fontSize: '10px', opacity: 0.7 }}>휴대</p>
                          <InlineEditField value={company.mobile} type="tel" onSave={(v) => handleFieldSave({ mobile: formatPhone(v) })}
                            placeholder="010-0000-0000" style={{ fontSize: '14px', color: themeColors.text }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 세로 구분선 */}
              <div className="flex-shrink-0" style={{ width: '1px', backgroundColor: themeColors.border }} />

              {/* 오른쪽 1/3 */}
              <div className="w-64 flex-shrink-0 flex flex-col gap-4" style={{ paddingLeft: '20px' }}>

                {/* 계약 정보 */}
                <div style={sectionCard}>
                  {sectionHead(<FileText size={12} />, '계약 정보')}
                  <div className="space-y-3">
                    <div>
                      <p style={fl}>{t('contractStatus')}</p>
                      <div className="flex flex-col gap-1.5 mt-1.5">
                        {([
                          { key: 'maintenance', label: '유지보수' },
                          { key: 'project', label: '프로젝트' },
                          { key: 'ended', label: '계약종료' },
                        ] as const).map((item) => {
                          const isActive = contractStatus === item.key;
                          return (
                            <button key={item.key} type="button"
                              onClick={() => handleFieldSave({ contractStatus: item.key })}
                              className="w-full py-1.5 text-xs font-medium transition-all text-center"
                              style={{
                                borderRadius: '999px',
                                border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
                                backgroundColor: isActive ? `${themeColors.primary}18` : 'transparent',
                                color: isActive ? themeColors.primary : themeColors.textSecondary,
                              }}>
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p style={fl}>{t('contractStartDate')}</p>
                      <InlineEditField type="date" value={company.maintenanceStartDate}
                        displayValue={formatDate(company.maintenanceStartDate)}
                        onSave={(v) => handleFieldSave({ maintenanceStartDate: v })}
                        style={{ fontSize: '14px', color: themeColors.text }} />
                    </div>
                    <div>
                      <p style={fl}>{t('contractEndDate')}</p>
                      <InlineEditField type="date" value={company.maintenanceEndDate}
                        displayValue={formatDate(company.maintenanceEndDate)}
                        onSave={(v) => handleFieldSave({ maintenanceEndDate: v })}
                        style={{ fontSize: '14px', color: themeColors.text }} />
                    </div>
                  </div>
                </div>

                {/* 메모 */}
                <div style={{ ...sectionCard, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {sectionHead(<FileText size={12} />, t('notes'))}
                  <div
                    ref={notesRef}
                    contentEditable={can('update_companies')}
                    suppressContentEditableWarning
                    className="notes-detail flex-1 text-sm focus:outline-none"
                    style={{
                      minHeight: '80px',
                      padding: '8px 10px',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)',
                      border: `1px solid ${editingNotes ? themeColors.primary : themeColors.border}`,
                      borderRadius: '6px',
                      color: themeColors.text,
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      cursor: can('update_companies') ? 'text' : 'default',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={() => setEditingNotes(true)}
                    onBlur={(e) => {
                      setEditingNotes(false);
                      const html = e.currentTarget.innerHTML;
                      if (html !== (company.notes || '')) handleFieldSave({ notes: html });
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'IMG') openLightbox((target as HTMLImageElement).src);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 변경 이력 패널 */}
        {showHistory && (
          <div className="flex-shrink-0 border-t" style={{ borderColor: themeColors.border, maxHeight: '220px', overflowY: 'auto' }}>
            <div className="px-6 py-3">
              {historyLoading ? (
                <div className="flex items-center justify-center py-4">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" style={{ color: themeColors.primary }}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" />
                  </svg>
                </div>
              ) : historyLogs.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: themeColors.textSecondary }}>변경 이력이 없습니다.</p>
              ) : (
                <div className="space-y-0">
                  {historyLogs.map((log, i) => {
                    const actionColor = log.action === 'create' ? themeColors.primary : log.action === 'delete' ? '#EF4444' : themeColors.textSecondary;
                    const actionLabel = log.action === 'create' ? '등록' : log.action === 'delete' ? '삭제' : '수정';
                    // "필드명: 이전값 → 이후값 / ..." 형식 파싱
                    const parsedChanges: { field: string; oldValue: string; newValue: string }[] = [];
                    if (log.details && log.details.includes(' → ')) {
                      log.details.split(' / ').forEach((part: string) => {
                        const colonIdx = part.indexOf(': ');
                        if (colonIdx === -1) return;
                        const field = part.slice(0, colonIdx).trim();
                        const rest = part.slice(colonIdx + 2);
                        const arrowIdx = rest.indexOf(' → ');
                        if (arrowIdx === -1) return;
                        parsedChanges.push({ field, oldValue: rest.slice(0, arrowIdx).trim(), newValue: rest.slice(arrowIdx + 3).trim() });
                      });
                    }
                    return (
                      <div key={i} className="py-2.5"
                        style={{ borderBottom: i < historyLogs.length - 1 ? `1px solid ${themeColors.border}` : 'none' }}>
                        {/* 헤더: 액션 · 작성자 · 시각 */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${actionColor}18`, color: actionColor }}>
                            {actionLabel}
                          </span>
                          <span className="text-xs font-medium" style={{ color: themeColors.text }}>{log.userName || '-'}</span>
                          <span className="text-xs" style={{ color: themeColors.textSecondary }}>
                            {log.timestamp instanceof Date
                              ? log.timestamp.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                              : '-'}
                          </span>
                        </div>
                        {/* 변경 내용 */}
                        {parsedChanges.length > 0 ? (
                          <div className="flex flex-col gap-0.5 pl-1">
                            {parsedChanges.map((c, ci) => (
                              <div key={ci} className="flex items-baseline gap-1.5 text-xs flex-wrap">
                                <span className="font-medium flex-shrink-0" style={{ color: themeColors.textSecondary }}>{c.field}</span>
                                <span className="px-1 rounded" style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: isDark ? '#F87171' : '#DC2626', textDecoration: 'line-through' }}>{c.oldValue}</span>
                                <span style={{ color: themeColors.textSecondary }}>→</span>
                                <span className="px-1 rounded" style={{ backgroundColor: isDark ? 'rgba(63,185,80,0.12)' : 'rgba(34,197,94,0.08)', color: isDark ? '#3FB950' : '#16A34A' }}>{c.newValue}</span>
                              </div>
                            ))}
                          </div>
                        ) : log.details ? (
                          <p className="text-xs pl-1" style={{ color: themeColors.textSecondary }}>{log.details}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderTop: `1px solid ${themeColors.border}` }}>
          {isAdminAccount(user) && (
            <button type="button" onClick={toggleHistory}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: showHistory ? themeColors.primary : themeColors.textSecondary }}>
              <History size={13} />
              변경 이력
              <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <p className="text-xs" style={{ color: themeColors.textSecondary }}>
              {can('update_companies') && company ? '필드를 수정하고 포커스를 이동하면 자동 저장됩니다' : ''}
            </p>
            <button type="button" onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-lg transition-opacity hover:opacity-70"
              style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}` }}>
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* 주소 검색 */}
      {showPostcode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={(e) => { e.stopPropagation(); setShowPostcode(false); }}>
          <div className="overflow-hidden w-full mx-4"
            style={{ maxWidth: '480px', backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-2">
                <Search size={13} style={{ color: themeColors.primary }} />
                <span className="text-sm font-semibold" style={{ color: themeColors.text }}>주소 검색</span>
              </div>
              <button type="button" onClick={() => setShowPostcode(false)} className="hover:opacity-60" style={{ color: themeColors.textSecondary }}><X size={15} /></button>
            </div>
            <div className="p-3">
              <DaumPostcode onComplete={handlePostcodeComplete} autoClose={false} style={{ height: '400px' }} />
            </div>
          </div>
        </div>
      )}

      <ConfirmPopover
        isOpen={!!confirmConfig}
        title={confirmConfig?.title ?? ''}
        description={confirmConfig?.description}
        onConfirm={() => confirmConfig?.onConfirm()}
        onCancel={() => setConfirmConfig(null)}
      />

      {/* 이미지 뷰어 */}
      {lightboxSrc && ReactDOM.createPortal(
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999 }}>
          <div className="rounded-xl w-[95vw] h-[90vh] flex flex-col overflow-hidden"
            style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <span className="text-sm font-semibold" style={{ color: themeColors.text }}>이미지 뷰어</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setZoom(p => Math.max(25, p - 25))} className="p-1.5 rounded hover:opacity-70" style={{ color: themeColors.text }}><ZoomOut size={16} /></button>
                <span className="text-xs min-w-[40px] text-center" style={{ color: themeColors.textSecondary }}>{zoom}%</span>
                <button onClick={() => setZoom(p => Math.min(300, p + 25))} className="p-1.5 rounded hover:opacity-70" style={{ color: themeColors.text }}><ZoomIn size={16} /></button>
                <button onClick={() => setRotation(p => (p + 90) % 360)} className="p-1.5 rounded hover:opacity-70" style={{ color: themeColors.text }}><RotateCw size={16} /></button>
                <button onClick={() => { setZoom(100); setRotation(0); setImgPos({ x: 0, y: 0 }); }} className="px-2 py-1 rounded text-xs hover:opacity-70" style={{ color: themeColors.text }}>초기화</button>
                <button onClick={() => setLightboxSrc(null)} className="px-2 py-1 rounded text-xs hover:opacity-70" style={{ color: themeColors.text }}>닫기</button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex items-center justify-center"
              style={{ cursor: imgDragging ? 'grabbing' : 'grab' }}
              onWheel={(e) => { e.preventDefault(); setZoom(p => Math.max(25, Math.min(300, p + (e.deltaY > 0 ? -10 : 10)))); }}
              onMouseDown={(e) => { if (e.button === 0) { setImgDragging(true); setImgDragStart({ x: e.clientX - imgPos.x, y: e.clientY - imgPos.y }); } }}
              onMouseMove={(e) => { if (imgDragging) setImgPos({ x: e.clientX - imgDragStart.x, y: e.clientY - imgDragStart.y }); }}
              onMouseUp={() => setImgDragging(false)} onMouseLeave={() => setImgDragging(false)}>
              <img src={lightboxSrc} alt="" draggable={false}
                style={{ transform: `translate(${imgPos.x}px,${imgPos.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`, transition: imgDragging ? 'none' : 'transform 0.1s', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none' }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default CompanyDetailModal;
