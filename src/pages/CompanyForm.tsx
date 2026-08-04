import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Search, X, Mail, Trash2, CheckCircle } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../hooks/useToast';
import InlineEditField from '../components/InlineEditField';
import ConfirmPopover from '../components/common/ConfirmPopover';
import DaumPostcode from 'react-daum-postcode';
import CompanyContactsTab from '../components/company/CompanyContactsTab';
import CompanyServersTab from '../components/company/CompanyServersTab';
import CompanyVpnTab from '../components/company/CompanyVpnTab';

const CompanyForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const { addLog } = useAuditLogStore();
  const toast = useToast();

  const isNewRecord = !id || id === 'new';
  const notesRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [showPostcode, setShowPostcode] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editingNotes, setEditingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'contacts' | 'servers' | 'vpn'>('basic');

  const [formData, setFormData] = useState({
    name: '', businessNumber: '', representative: '', contact: '',
    phone: '', mobile: '', email: '', address: '', notes: '',
    contractStatus: 'project' as 'maintenance' | 'project' | 'ended',
    maintenanceStartDate: '', maintenanceEndDate: '',
  });

  useEffect(() => {
    if (!isNewRecord && id) fetchCompanyData(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNewRecord]);

  const fetchCompanyData = async (companyId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to fetch company data');
      const company = await response.json();
      const data = {
        name: company.name || '', businessNumber: company.businessNumber || '',
        representative: company.representative || '', contact: company.contact || '',
        phone: company.phone || '', mobile: company.mobile || '',
        email: company.email || '', address: company.address || '',
        notes: company.notes || '',
        contractStatus: (company.contractStatus || (company.maintenanceContract ? 'maintenance' : 'project')) as 'maintenance' | 'project' | 'ended',
        maintenanceStartDate: company.maintenanceStartDate || '',
        maintenanceEndDate: company.maintenanceEndDate || '',
      };
      setFormData(data);
      if (notesRef.current && company.notes) notesRef.current.innerHTML = company.notes;
    } catch (error) {
      console.error('Error fetching company:', error);
      toast.error('업체 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 기존 레코드: 단일 필드 변경 후 자동저장
  const handleFieldSave = async (updates: Partial<typeof formData>) => {
    if (isNewRecord || !id || !token) return;
    const updated = { ...formData, ...updates };
    setFormData(updated);
    setSaveState('saving');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/companies/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updated.name.trim(),
          businessNumber: updated.businessNumber.trim() || null,
          representative: updated.representative.trim() || null,
          contact: updated.contact.trim() || null,
          email: updated.email.trim() || null,
          phone: updated.phone.trim() || null,
          mobile: updated.mobile?.trim() || null,
          address: updated.address.trim() || null,
          notes: updated.notes || null,
          contractStatus: updated.contractStatus,
          maintenanceContract: updated.contractStatus === 'maintenance',
          maintenanceStartDate: updated.maintenanceStartDate || null,
          maintenanceEndDate: updated.maintenanceEndDate || null,
        })
      });
      if (!response.ok) throw new Error('저장 실패');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
      addLog({ userId: user?.id, userName: user?.name, action: 'update', resourceType: 'company', resourceId: id, resourceName: updated.name, details: `업체 정보가 수정되었습니다: ${updated.name}` });
    } catch {
      setSaveState('idle');
      toast.error('저장에 실패했습니다.');
    }
  };

  // 신규 등록 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('업체명을 입력해주세요.'); return; }
    if (!token) { toast.error('로그인이 필요합니다.'); navigate('/login'); return; }
    try {
      setIsLoading(true);
      const response = await fetch(import.meta.env.VITE_API_URL + '/companies', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          businessNumber: formData.businessNumber.trim() || null,
          representative: formData.representative.trim() || null,
          contact: formData.contact.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          mobile: formData.mobile?.trim() || null,
          address: formData.address.trim() || null,
          notes: formData.notes || null,
          contractStatus: formData.contractStatus,
          maintenanceContract: formData.contractStatus === 'maintenance',
          maintenanceStartDate: formData.maintenanceStartDate || null,
          maintenanceEndDate: formData.maintenanceEndDate || null,
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '알 수 없는 오류' }));
        throw new Error(errorData.message || `서버 오류: ${response.status}`);
      }
      const created = await response.json().catch(() => null);
      addLog({ userId: user?.id, userName: user?.name, action: 'create', resourceType: 'company', resourceId: created?.id?.toString(), resourceName: formData.name, details: `새 업체가 등록되었습니다: ${formData.name}` });
      toast.success('업체가 등록되었습니다.');
      navigate('/companies');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '저장 중 오류 발생');
    } finally {
      setIsLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!id || isNewRecord) return;
    try {
      setIsLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/companies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('삭제에 실패했습니다.');
      addLog({ userId: user?.id, userName: user?.name, action: 'delete', resourceType: 'company', resourceId: id, resourceName: formData.name, details: `업체가 삭제되었습니다: ${formData.name}` });
      toast.success('업체가 삭제되었습니다.');
      navigate('/companies');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '삭제 중 오류 발생');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!id || isNewRecord) return;
    setConfirmConfig({
      title: '선택한 업체가 삭제됩니다.',
      description: '삭제하면 복구할 수 없습니다.',
      onConfirm: async () => { setConfirmConfig(null); await executeDelete(); },
    });
  };

  const handlePostcodeComplete = (data: { address: string; addressType: string; bname: string; buildingName: string }) => {
    let fullAddress = data.address;
    let extraAddress = '';
    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
      fullAddress += extraAddress !== '' ? ` (${extraAddress})` : '';
    }
    if (isNewRecord) {
      setFormData(prev => ({ ...prev, address: fullAddress }));
    } else {
      handleFieldSave({ address: fullAddress });
    }
    setShowPostcode(false);
  };

  const handleNotesPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (notesRef.current) {
              const img = document.createElement('img');
              img.src = event.target?.result as string;
              img.style.maxWidth = '100%';
              img.style.borderRadius = '4px';
              img.style.margin = '10px 0';
              const selection = window.getSelection();
              const range = selection?.getRangeAt(0);
              if (range) { range.deleteContents(); range.insertNode(img); range.collapse(false); }
              else notesRef.current.appendChild(img);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const formatPhone = (value: string) => {
    const n = value.replace(/[^0-9]/g, '');
    if (n.length <= 3) return n;
    if (n.length <= 7) return `${n.slice(0, 3)}-${n.slice(3)}`;
    return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7, 11)}`;
  };

  const isDark = theme === 'dark' || theme === 'yellow';
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const onPrimaryText = theme === 'yellow' ? '#333333' : '#FFFFFF';

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.surface,
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px',
    boxShadow: 'none',
  };

  // 신규 등록 시 일반 input 스타일
  const newInputStyle: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border: `1.5px solid ${themeColors.border}`,
    color: themeColors.text,
    transition: 'border-color 0.15s ease',
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/companies')}
            className="w-8 h-8 flex items-center justify-center rounded transition-opacity hover:opacity-60"
            style={{ color: themeColors.textSecondary }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" style={{ color: themeColors.text }}>
                {isNewRecord ? t('newCompany') : formData.name || t('editCompany')}
              </h1>
              {!isNewRecord && formData.contractStatus && (
                <span className="px-2 py-0.5 text-xs font-semibold" style={{ borderRadius: '3px', backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>
                  {formData.contractStatus === 'maintenance' ? t('maintenance') : formData.contractStatus === 'project' ? t('projectsMenu') : t('contractInactive')}
                </span>
              )}
            </div>
            {!isNewRecord && (
              <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>클릭하여 바로 수정할 수 있습니다</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 기존 레코드: 자동저장 표시 + 삭제 */}
          {!isNewRecord && (
            <>
              {saveState !== 'idle' && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded" style={{
                  color: saveState === 'saved' ? themeColors.primary : themeColors.textSecondary,
                  backgroundColor: saveState === 'saved' ? `${themeColors.primary}12` : 'transparent',
                  transition: 'all 0.2s ease',
                }}>
                  {saveState === 'saving' ? (
                    <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" /></svg>저장 중...</>
                  ) : (
                    <><CheckCircle size={12} />저장됨</>
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 rounded-lg text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ height: '36px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
              >
                <Trash2 size={15} />
                <span>{t('delete')}</span>
              </button>
            </>
          )}

          {/* 신규 등록: 등록 + 취소 */}
          {isNewRecord && (
            <>
              <button
                type="submit"
                form="company-form"
                disabled={isLoading || !formData.name.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
              >
                <Save size={15} />
                <span>{t('register')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/companies')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-60"
                style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', color: themeColors.text, border: `1px solid ${themeColors.border}`, borderRadius: '4px' }}
              >
                <span>{t('cancel')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 (편집 모드 전용) */}
      {!isNewRecord && (
        <div className="flex gap-0 mb-5" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
          {([
            { key: 'basic', label: '기본 정보' },
            { key: 'contacts', label: '담당자' },
            { key: 'servers', label: '서버 정보' },
            { key: 'vpn', label: 'VPN 정보' },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: isActive ? themeColors.primary : themeColors.textSecondary,
                  borderBottom: isActive ? `2px solid ${themeColors.primary}` : '2px solid transparent',
                  marginBottom: '-1px',
                  background: 'transparent',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 담당자 탭 */}
      {!isNewRecord && activeTab === 'contacts' && id && (
        <CompanyContactsTab companyId={id} />
      )}

      {/* 서버 정보 탭 */}
      {!isNewRecord && activeTab === 'servers' && id && (
        <CompanyServersTab companyId={id} />
      )}

      {/* VPN 정보 탭 */}
      {!isNewRecord && activeTab === 'vpn' && id && (
        <CompanyVpnTab companyId={id} />
      )}

      {/* 폼/인라인 편집 영역 */}
      <form id="company-form" onSubmit={handleSubmit} autoComplete="off"
        style={{ display: !isNewRecord && activeTab !== 'basic' ? 'none' : undefined }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 왼쪽: 기본 정보 + 연락처 */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* 기본 정보 카드 */}
            <div className="rounded p-4" style={cardStyle}>
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                <div style={{ width: '3px', alignSelf: 'stretch', backgroundColor: themeColors.primary, borderRadius: '2px', flexShrink: 0 }} />
                <div>
                  <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('basicInfo')}</h2>
                  <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('companyBasicInfo')}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* 업체명 */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>
                    {t('companyName')} {isNewRecord && <span style={{ color: '#EF4444' }}>*</span>}
                  </label>
                  {isNewRecord ? (
                    <input
                      type="text" required autoComplete="off"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('enterCompanyName')}
                      className="w-full px-4 py-3.5 rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all"
                      style={newInputStyle}
                    />
                  ) : (
                    <InlineEditField
                      value={formData.name}
                      onSave={(v) => handleFieldSave({ name: v })}
                      placeholder={t('enterCompanyName')}
                      style={{ fontSize: '14px', fontWeight: '600', color: themeColors.primary }}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 사업자번호 */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('businessNumber')}</label>
                    {isNewRecord ? (
                      <input
                        type="text" autoComplete="off"
                        value={formData.businessNumber}
                        onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                        placeholder="000-00-00000"
                        className="w-full px-4 py-3.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                        style={newInputStyle}
                      />
                    ) : (
                      <InlineEditField
                        value={formData.businessNumber}
                        onSave={(v) => handleFieldSave({ businessNumber: v })}
                        placeholder="000-00-00000"
                        style={{ fontSize: '14px', color: themeColors.text }}
                      />
                    )}
                  </div>
                  {/* 대표자 */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('representative')}</label>
                    {isNewRecord ? (
                      <input
                        type="text" autoComplete="off"
                        value={formData.representative}
                        onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                        placeholder={t('representative')}
                        className="w-full px-4 py-3.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                        style={newInputStyle}
                      />
                    ) : (
                      <InlineEditField
                        value={formData.representative}
                        onSave={(v) => handleFieldSave({ representative: v })}
                        placeholder={t('representative')}
                        style={{ fontSize: '14px', color: themeColors.text }}
                      />
                    )}
                  </div>
                </div>

                {/* 주소 */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('address')}</label>
                  <div className="flex gap-3">
                    {isNewRecord ? (
                      <>
                        <input
                          type="text" autoComplete="off" readOnly
                          value={formData.address}
                          placeholder={t('clickToSearchAddress')}
                          className="flex-1 px-4 py-3.5 rounded text-sm focus:outline-none cursor-pointer"
                          style={newInputStyle}
                          onClick={() => setShowPostcode(true)}
                        />
                        <button
                          type="button" onClick={() => setShowPostcode(true)}
                          className="flex items-center gap-2 px-5 py-3.5 rounded text-sm font-semibold transition-all hover:opacity-90"
                          style={{ backgroundColor: themeColors.primary, color: onPrimaryText }}
                        >
                          <Search size={16} />
                          <span>{t('search')}</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className="flex-1 px-2 py-1.5 rounded text-sm cursor-pointer block"
                          style={{
                            color: formData.address ? themeColors.text : themeColors.textSecondary,
                            opacity: formData.address ? 1 : 0.5,
                            borderRadius: '4px',
                            border: '1.5px solid transparent',
                            transition: 'background 0.1s',
                          }}
                          onClick={() => setShowPostcode(true)}
                          title="클릭하여 주소 검색"
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.08)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {formData.address || '클릭하여 주소 검색'}
                        </span>
                        <button
                          type="button" onClick={() => setShowPostcode(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all hover:opacity-80"
                          style={{ backgroundColor: `${themeColors.primary}15`, color: themeColors.primary }}
                        >
                          <Search size={14} />
                          <span>검색</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 연락처 정보 카드 */}
            <div className="rounded p-4 flex-1" style={cardStyle}>
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                <div style={{ width: '3px', alignSelf: 'stretch', backgroundColor: themeColors.primary, borderRadius: '2px', flexShrink: 0 }} />
                <div>
                  <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('contactInfo')}</h2>
                  <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('companyContact')} &amp; {t('companyPhone')}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 이메일 */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('email')}</label>
                    {isNewRecord ? (
                      <div className="relative">
                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: themeColors.textSecondary }} />
                        <input
                          type="email" autoComplete="new-email-field"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="email@example.com"
                          className="w-full pl-11 pr-4 py-3.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                          style={newInputStyle}
                        />
                      </div>
                    ) : (
                      <InlineEditField
                        value={formData.email}
                        type="email"
                        onSave={(v) => handleFieldSave({ email: v })}
                        placeholder="email@example.com"
                        style={{ fontSize: '14px', color: themeColors.text }}
                      />
                    )}
                  </div>
                  {/* 담당자 */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('companyContact')}</label>
                    {isNewRecord ? (
                      <input
                        type="text" autoComplete="off"
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        placeholder={t('companyContact')}
                        className="w-full px-4 py-3.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                        style={newInputStyle}
                      />
                    ) : (
                      <InlineEditField
                        value={formData.contact}
                        onSave={(v) => handleFieldSave({ contact: v })}
                        placeholder={t('companyContact')}
                        style={{ fontSize: '14px', color: themeColors.text }}
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 전화 */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('phone')}</label>
                    {isNewRecord ? (
                      <input
                        type="tel" autoComplete="new-phone-field"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                        placeholder="02-000-0000"
                        className="w-full px-4 py-3.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                        style={newInputStyle}
                      />
                    ) : (
                      <InlineEditField
                        value={formData.phone}
                        type="tel"
                        onSave={(v) => handleFieldSave({ phone: formatPhone(v) })}
                        placeholder="02-000-0000"
                        style={{ fontSize: '14px', color: themeColors.text }}
                      />
                    )}
                  </div>
                  {/* 휴대폰 */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('mobile')}</label>
                    {isNewRecord ? (
                      <input
                        type="tel" autoComplete="new-mobile-field"
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: formatPhone(e.target.value) })}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-3.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                        style={newInputStyle}
                      />
                    ) : (
                      <InlineEditField
                        value={formData.mobile}
                        type="tel"
                        onSave={(v) => handleFieldSave({ mobile: formatPhone(v) })}
                        placeholder="010-0000-0000"
                        style={{ fontSize: '14px', color: themeColors.text }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 계약 정보 + 비고 */}
          <div className="flex flex-col gap-4">
            {/* 계약 정보 카드 */}
            <div className="rounded p-4" style={cardStyle}>
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                <div style={{ width: '3px', alignSelf: 'stretch', backgroundColor: themeColors.primary, borderRadius: '2px', flexShrink: 0 }} />
                <div>
                  <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('contractInfo')}</h2>
                  <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('contractStatus')} &amp; {t('period')}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* 계약 상태 */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('contractStatus')}</label>
                  <div className="flex overflow-hidden" style={{ border: `1px solid ${themeColors.border}`, borderRadius: '4px' }}>
                    {[
                      { key: 'maintenance', label: t('maintenance') },
                      { key: 'project', label: t('projectsMenu') },
                      { key: 'ended', label: t('contractInactive') }
                    ].map((item) => {
                      const isActive = formData.contractStatus === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            const next = item.key as typeof formData.contractStatus;
                            if (isNewRecord) {
                              setFormData({ ...formData, contractStatus: next });
                            } else {
                              handleFieldSave({ contractStatus: next });
                            }
                          }}
                          className="flex-1 py-3 text-center text-sm font-medium transition-all"
                          style={{
                            background: isActive ? themeColors.primary : 'transparent',
                            color: isActive ? onPrimaryText : themeColors.textSecondary,
                            borderRight: item.key !== 'ended' ? `1px solid ${themeColors.border}` : 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 계약 시작일 */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('contractStartDate')}</label>
                  {isNewRecord ? (
                    <input
                      type="date"
                      value={formData.maintenanceStartDate}
                      onChange={(e) => setFormData({ ...formData, maintenanceStartDate: e.target.value })}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      className="w-full px-4 py-3.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ ...newInputStyle, colorScheme: isDark ? 'dark' : 'light' }}
                    />
                  ) : (
                    <InlineEditField
                      type="date"
                      value={formData.maintenanceStartDate}
                      displayValue={formData.maintenanceStartDate ? new Date(formData.maintenanceStartDate).toLocaleDateString('ko-KR') : '-'}
                      onSave={(v) => handleFieldSave({ maintenanceStartDate: v })}
                      style={{ fontSize: '14px', color: themeColors.text }}
                    />
                  )}
                </div>

                {/* 계약 종료일 */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>{t('contractEndDate')}</label>
                  {isNewRecord ? (
                    <input
                      type="date"
                      value={formData.maintenanceEndDate}
                      onChange={(e) => setFormData({ ...formData, maintenanceEndDate: e.target.value })}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      className="w-full px-4 py-3.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ ...newInputStyle, colorScheme: isDark ? 'dark' : 'light' }}
                    />
                  ) : (
                    <InlineEditField
                      type="date"
                      value={formData.maintenanceEndDate}
                      displayValue={formData.maintenanceEndDate ? new Date(formData.maintenanceEndDate).toLocaleDateString('ko-KR') : '-'}
                      onSave={(v) => handleFieldSave({ maintenanceEndDate: v })}
                      style={{ fontSize: '14px', color: themeColors.text }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 비고 카드 */}
            <div className="rounded p-4 flex-1 flex flex-col" style={cardStyle}>
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                <div style={{ width: '3px', alignSelf: 'stretch', backgroundColor: themeColors.primary, borderRadius: '2px', flexShrink: 0 }} />
                <div>
                  <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('notes')}</h2>
                  <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('notesPlaceholder')}</p>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <div
                  ref={notesRef}
                  contentEditable
                  suppressContentEditableWarning
                  onPaste={handleNotesPaste}
                  onFocus={() => setEditingNotes(true)}
                  onBlur={(e) => {
                    setEditingNotes(false);
                    const newHtml = e.currentTarget.innerHTML;
                    if (!isNewRecord && newHtml !== formData.notes) {
                      handleFieldSave({ notes: newHtml });
                    } else if (isNewRecord) {
                      setFormData(prev => ({ ...prev, notes: newHtml }));
                    }
                  }}
                  className="w-full px-3 py-3 rounded text-sm focus:outline-none flex-1 min-h-[150px] max-h-[400px] overflow-y-auto"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    border: editingNotes ? `1.5px solid ${themeColors.primary}` : `1.5px solid ${themeColors.border}`,
                    boxShadow: editingNotes ? `0 0 0 3px ${themeColors.primary}20` : 'none',
                    color: themeColors.text,
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    cursor: 'text',
                    transition: 'border-color 0.1s, box-shadow 0.1s',
                  }}
                  data-placeholder="비고 내용을 입력하세요..."
                />
                <style>{`
                  [data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: ${themeColors.textSecondary};
                    opacity: 0.5;
                    pointer-events: none;
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* 주소 검색 모달 */}
      {showPostcode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPostcode(false)}>
          <div
            className="rounded max-w-lg w-full mx-4 overflow-hidden"
            style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, boxShadow: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: `${themeColors.primary}20` }}>
                  <Search size={16} style={{ color: themeColors.primary }} />
                </div>
                <h3 className="text-base font-bold" style={{ color: themeColors.text }}>주소 검색</h3>
              </div>
              <button
                onClick={() => setShowPostcode(false)}
                className="p-2 rounded transition-all duration-200"
                style={{ color: themeColors.textSecondary }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <DaumPostcode onComplete={handlePostcodeComplete} autoClose={false} style={{ height: '450px' }} />
            </div>
          </div>
        </div>
      )}
      <ConfirmPopover
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        description={confirmConfig?.description}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />
    </div>
  );
};

export default CompanyForm;
