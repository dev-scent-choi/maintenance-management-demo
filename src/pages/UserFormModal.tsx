import React, { useState, useEffect, useRef } from 'react';
import { X, Save, User, History, ChevronRight, CheckCircle, AlertCircle, Trash2, Plus, PenLine, Maximize2, Minimize2 } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { themeConfigs } from '../utils/themeConfig';
import { useToast } from '../hooks/useToast';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface Props {
  isOpen: boolean;
  userId: string | null; // null = 신규 등록
  onClose: () => void;
  onSaved: () => void;
  /** 수정 모드: 변경된 필드만 전달 → 목록 부분 업데이트 (전체 재조회 없음) */
  onUpdated?: (userId: string, changes: Partial<{
    name: string; email: string; phone: string;
    department: string; position: string;
    role: string; accountStatus: string;
  }>) => void;
}

interface RoleInfo { id: string; name: string; description: string; }

const loadAvailableRoles = (): RoleInfo[] => {
  const stored = localStorage.getItem('role_list');
  if (stored) {
    return JSON.parse(stored).map((r: RoleInfo) => ({ id: r.id, name: r.name, description: r.description }));
  }
  return [
    { id: 'admin', name: '관리자', description: '전체 시스템 접근 권한' },
    { id: 'user',  name: '사용자',  description: '일반 사용자 권한' },
  ];
};

const KO_ROLE_LABELS: Record<string, string> = {
  admin: '관리자', manager: '매니저', user: '사용자', readonly: '읽기 전용',
};

type FormData = {
  name: string; email: string; phone: string;
  loginId: string;
  department: string; position: string;
  adminMemo: string; role: string;
  accountStatus: 'active' | 'inactive';
  passwordSet: boolean;
};

const EMPTY_FORM: FormData = {
  name: '', email: '', phone: '', loginId: '',
  department: '', position: '',
  adminMemo: '', role: 'user', accountStatus: 'active',
  passwordSet: false,
};


const UserFormModal: React.FC<Props> = ({ isOpen, userId, onClose, onSaved, onUpdated }) => {
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const companyEmail = useSettingsStore((state) => state.settings.companyEmail);
  const companyEmailDomain = companyEmail && companyEmail.includes('@') ? companyEmail.split('@')[1] : '';
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const { addLog } = useAuditLogStore();
  const toast = useToast();
  const t = useLanguage();

  const isDark = theme !== 'light';
  const onPrimaryText = theme === 'yellow' ? '#333333' : '#fff';
  const isNewRecord = !userId;
  const availableRoles = loadAvailableRoles();

  const [isLoading, setIsLoading] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const originalDataRef = useRef<FormData>(EMPTY_FORM);

  // 비밀번호 설정/재설정 입력값 (FormData와 분리)
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordResetState, setPasswordResetState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  // 자동저장 상태 (수정 모드)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 삭제 확인
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteUser = async () => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete user');
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  // 변경 이력
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // draggable
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

  // 열릴 때 초기화
  useEffect(() => {
    if (!isOpen) return;
    setModalPos(null);
    setShowDeleteConfirm(false);
    setShowHistory(false);
    setHistoryLogs([]);
    setFormData(EMPTY_FORM);
    originalDataRef.current = { ...EMPTY_FORM };
    setSaveState('idle');
    setIsDataReady(false);
    if (!isNewRecord && userId) {
      fetchUser(userId);
    } else {
      setIsDataReady(true);
    }
  }, [isOpen, userId]);

  const fetchUser = async (id: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const u = await res.json();
      const loaded: FormData = {
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        loginId: u.loginId || (u.email?.split('@')[0] ?? ''),
        department: u.department || '',
        position: u.position || '',
        adminMemo: u.adminMemo || '',
        role: (u.role || 'user').toLowerCase(),
        accountStatus: u.active !== false ? 'active' : 'inactive',
        passwordSet: !!u.passwordSet,
      };
      setFormData(loaded);
      originalDataRef.current = { ...loaded };
    } catch {
      toast.error(t('fetchUserFailed'));
    } finally {
      setIsLoading(false);
      setIsDataReady(true);
    }
  };

  const fetchHistory = async () => {
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const filtered = data
          .filter((l: any) => String(l.resourceId) === String(userId) && l.resourceType === 'user')
          .map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }))
          .sort((a: any, b: any) => b.timestamp - a.timestamp);
        setHistoryLogs(filtered);
      }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) fetchHistory();
  };

  const formatPhone = (v: string) => {
    const n = v.replace(/[^\d]/g, '');
    if (n.length <= 3) return n;
    if (n.length <= 7) return `${n.slice(0, 3)}-${n.slice(3)}`;
    return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7, 11)}`;
  };

  const roleLabels: Record<string, string> = {
    admin: t('roleAdmin'), manager: t('roleManager'),
    user: t('roleUser'), readonly: t('roleReadonly'),
  };
  const statusLabels: Record<string, string> = { active: t('activeLabel'), inactive: t('inactiveLabel') };

  // ── 자동저장 (수정 모드 전용) ─────────────────────────────
  const handleFieldUpdate = async (
    field: keyof FormData,
    newValue: string,
    fieldLabel: string,
    merged: FormData,
  ) => {
    const oldValue = originalDataRef.current[field] as string;
    if (oldValue === newValue) return; // 변경 없음

    clearTimeout(saveTimerRef.current ?? undefined);
    setSaveState('saving');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: merged.loginId,
          email: companyEmailDomain ? merged.loginId.trim() + '@' + companyEmailDomain : merged.email,
          name: merged.name, phone: merged.phone,
          department: merged.department, position: merged.position,
          role: (merged.role || 'user').toUpperCase(), active: merged.accountStatus === 'active',
        }),
      });
      if (!res.ok) throw new Error();

      // 변경이력 기록
      const fmt = (f: keyof FormData, v: string) => {
        if (f === 'role') return roleLabels[v] || v;
        if (f === 'accountStatus') return statusLabels[v] || v;
        return v || '-';
      };
      addLog({
        userId: currentUser?.id, userName: currentUser?.name,
        action: 'update', resourceType: 'user',
        resourceId: userId!,
        resourceName: merged.name,
        details: `${fieldLabel}: ${fmt(field, oldValue)} → ${fmt(field, newValue)}`,
      });

      originalDataRef.current = { ...merged };
      setSaveState('saved');
      if (showHistory) fetchHistory();
      // 변경 필드만 부모 목록에 즉시 반영 (전체 재조회 없음)
      if (onUpdated && userId) {
        onUpdated(userId, {
          name:          merged.name,
          email:         companyEmailDomain
                           ? merged.loginId.trim() + '@' + companyEmailDomain
                           : merged.email,
          phone:         merged.phone,
          department:    merged.department,
          position:      merged.position,
          role:          (merged.role || 'user').toLowerCase(),
          accountStatus: merged.accountStatus,
        });
      }
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('failed');
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  // ── 비밀번호 재설정 (수정 모드) ──────────────────────────
  const handlePasswordReset = async () => {
    if (!newPasswordInput.trim()) { toast.error('새 비밀번호를 입력해주세요'); return; }
    if (newPasswordInput.length < 6) { toast.error('비밀번호는 6자 이상이어야 합니다'); return; }
    if (newPasswordInput !== confirmPasswordInput) { toast.error('비밀번호가 일치하지 않습니다'); return; }
    setPasswordResetState('saving');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}/password`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPasswordInput }),
      });
      if (!res.ok) throw new Error();
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setFormData(prev => ({ ...prev, passwordSet: true }));
      setPasswordResetState('saved');
      toast.success('비밀번호가 재설정되었습니다');
      setTimeout(() => setPasswordResetState('idle'), 2000);
    } catch {
      setPasswordResetState('failed');
      toast.error('비밀번호 재설정에 실패했습니다');
      setTimeout(() => setPasswordResetState('idle'), 3000);
    }
  };

  // ── 신규 등록 submit ──────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const composedEmail = companyEmailDomain
      ? formData.loginId.trim() + '@' + companyEmailDomain
      : formData.email.trim();
    if (!formData.loginId.trim() || !formData.name.trim() || !composedEmail) {
      toast.error(t('loginIdRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(composedEmail)) {
      toast.error(t('invalidEmailFormat'));
      return;
    }
    // loginId 중복 체크
    setIsLoading(true);
    try {
      const checkRes = await fetch(import.meta.env.VITE_API_URL + '/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (checkRes.ok) {
        const allUsers: any[] = await checkRes.json();
        const normalizedId = formData.loginId.trim().toLowerCase();
        const isDuplicate = allUsers.some((u: any) => {
          const storedId = (u.loginId || u.username || '').toLowerCase();
          return storedId !== '' && storedId === normalizedId;
        });
        if (isDuplicate) {
          toast.error(t('loginIdDuplicate'));
          setIsLoading(false);
          return;
        }
      }
      const res = await fetch(import.meta.env.VITE_API_URL + '/users', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: formData.loginId, email: composedEmail, name: formData.name, phone: formData.phone,
          department: formData.department, position: formData.position,
          role: formData.role.toUpperCase(), emailNotificationEnabled: true,
          active: formData.accountStatus === 'active',
          ...(newPasswordInput.trim() ? { password: newPasswordInput.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '사용자 생성에 실패했습니다.');
      }
      const created = await res.json().catch(() => null);
      addLog({
        userId: currentUser?.id, userName: currentUser?.name,
        action: 'create', resourceType: 'user',
        resourceId: created?.id?.toString(),
        resourceName: formData.name,
        details: `새 사용자가 등록되었습니다: ${formData.name} (${formData.email})`,
      });
      toast.success(t('userCreateSuccess'));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const sectionCard: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(55,53,47,0.02)',
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px',
    padding: '0.875rem 1rem',
  };

  const sectionHead = (icon: React.ReactNode, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      <span style={{ color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ color: themeColors.textSecondary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
        {label}
      </span>
    </div>
  );

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.4375rem 0.75rem', borderRadius: '4px', fontSize: '0.875rem',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
    border: `1px solid ${themeColors.border}`, color: themeColors.text, outline: 'none',
    colorScheme: isDark ? 'dark' : 'light',
  };

  const modalStyle: React.CSSProperties = modalPos
    ? { position: 'fixed', left: modalPos.x, top: modalPos.y, transform: 'none', zIndex: 51 }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 51 };

  // blur 시 자동저장 헬퍼 (controlled input: formData가 이미 최신값)
  const onBlurSave = (field: keyof FormData, fieldLabel: string) => () => {
    if (isNewRecord) return;
    handleFieldUpdate(field, formData[field] as string, fieldLabel, formData);
  };

  // 라디오 change 시 자동저장
  const onRadioSave = (field: keyof FormData, fieldLabel: string, newVal: string) => {
    if (isNewRecord) return;
    const merged = { ...formData, [field]: newVal };
    setFormData(merged);
    handleFieldUpdate(field, newVal, fieldLabel, merged);
  };

  return (
    <>
      <style>{`
        @keyframes historySlideIn { from { transform: translateX(100%); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
        @keyframes sidePanelIn { from { transform: translateX(100%); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } }
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .side-panel-anim { animation: sidePanelIn 0.22s cubic-bezier(0.22,1,0.36,1); }
        .modal-fade-anim { animation: modalFadeIn 0.16s ease; }
      `}</style>

      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 49, backgroundColor: 'rgba(0,0,0,0.28)' }}
        onClick={onClose}
      />

      {/* 편집 모드: 로딩 중 카드 스피너 */}
      {!isNewRecord && !isDataReady && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50, pointerEvents: 'none' }}>
          <LoadingSpinner message="불러오는 중..." />
        </div>
      )}

      {/* 데이터 준비 완료 후 사이드 패널 (등록/편집 모두) */}
      {(!isNewRecord && !isDataReady) ? null : (
      <div
        ref={modalRef}
        className="side-panel-anim"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          zIndex: 50,
          width: isWide ? 'min(47.5rem, calc(100vw - 2rem))' : 'min(520px, calc(100vw - 2rem))',
          height: '100vh',
          backgroundColor: themeColors.surface,
          borderLeft: `1px solid ${themeColors.border}`,
          borderRadius: '12px 0 0 12px',
          boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(15,15,15,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${themeColors.border}` }}
        >
          <h2 className="text-sm font-semibold leading-tight" style={{ color: themeColors.text }}>
            {isNewRecord ? t('newUser') : t('userInfo')}
          </h2>

          <div className="flex items-center gap-2">
            {/* 자동저장 상태 표시 (수정 모드) */}
            {!isNewRecord && saveState !== 'idle' && (
              <div className="flex items-center gap-1.5">
                {saveState === 'saving' && (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" style={{ color: themeColors.textSecondary }}>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z"/>
                    </svg>
                    <span className="text-xs" style={{ color: themeColors.textSecondary }}>저장 중...</span>
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <CheckCircle size={14} style={{ color: isDark ? '#3FB950' : '#2F9E44' }} />
                    <span className="text-xs" style={{ color: isDark ? '#3FB950' : '#2F9E44' }}>저장됨</span>
                  </>
                )}
                {saveState === 'failed' && (
                  <>
                    <AlertCircle size={14} style={{ color: '#EF4444' }} />
                    <span className="text-xs" style={{ color: '#EF4444' }}>저장 실패</span>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => setIsWide(w => !w)}
              title={isWide ? '패널 축소' : '패널 확장'}
              className="w-7 h-7 flex items-center justify-center rounded transition-colors"
              style={{ color: themeColors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {isWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            {!isNewRecord && (
              showDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: themeColors.textSecondary }}>삭제하시겠습니까?</span>
                  <button
                    onClick={handleDeleteUser}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                    style={{ backgroundColor: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >삭제</button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="w-6 h-6 flex items-center justify-center rounded transition-colors"
                    style={{ color: themeColors.textSecondary, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  ><X size={13} /></button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-opacity"
                  style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.18)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
                >
                  <Trash2 size={12} />삭제
                </button>
              )
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded transition-colors"
              style={{ color: themeColors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 바디 */}
        <form id="user-modal-form" onSubmit={handleSubmit} className="flex flex-1 min-h-0 overflow-hidden">

          <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* ── 기본 정보 블록 ── */}
            <div style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : '#FAFAFA',
              border: `1px solid ${themeColors.border}`,
              borderRadius: '6px',
              padding: '16px',
            }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: themeColors.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '14px' }}>{t('basicInfo')}</p>

              {/* 아이디 — 강조 */}
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.text, marginBottom: '6px' }}>
                  {t('loginId')} <span style={{ color: '#EF4444' }}>*</span>
                </p>
                <input
                  type="text" required
                  value={formData.loginId}
                  onChange={(e) => setFormData(prev => ({ ...prev, loginId: e.target.value }))}
                  onBlur={onBlurSave('loginId', t('loginId'))}
                  placeholder={t('loginIdPlaceholder')}
                  style={{
                    width: '100%', padding: '0.5625rem 0.75rem',
                    fontSize: '0.9375rem', fontWeight: 500,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                    border: `1.5px solid ${themeColors.border}`,
                    borderRadius: '4px', color: themeColors.text, outline: 'none',
                    colorScheme: isDark ? 'dark' : 'light',
                  }}
                />
              </div>

              {/* 이름 | 이메일 — 중간 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, marginBottom: '5px' }}>
                    {t('name')} <span style={{ color: '#EF4444' }}>*</span>
                  </p>
                  <input type="text" required value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    onBlur={onBlurSave('name', '이름')}
                    placeholder={t('namePlaceholder')}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, marginBottom: '5px' }}>
                    {t('email')} {!companyEmailDomain && <span style={{ color: '#EF4444' }}>*</span>}
                  </p>
                  {companyEmailDomain ? (
                    <input type="text" readOnly
                      value={formData.loginId.trim() ? formData.loginId.trim() + '@' + companyEmailDomain : ''}
                      placeholder={`아이디@${companyEmailDomain}`}
                      style={{ ...inputStyle, opacity: 0.6, cursor: 'default' }}
                    />
                  ) : (
                    <input type="email" required value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      onBlur={onBlurSave('email', '이메일')}
                      placeholder="example@company.com"
                      style={inputStyle}
                    />
                  )}
                </div>
              </div>

              {/* 연락처 | 부서 | 직책 — 보조 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { label: t('contactInfo'), value: formData.phone, type: 'tel', placeholder: '010-0000-0000', field: 'phone', onChange: (v: string) => setFormData(prev => ({ ...prev, phone: formatPhone(v) })) },
                  { label: t('department'), value: formData.department, type: 'text', placeholder: t('department'), field: 'department', onChange: (v: string) => setFormData(prev => ({ ...prev, department: v })) },
                  { label: t('position'), value: formData.position, type: 'text', placeholder: t('position'), field: 'position', onChange: (v: string) => setFormData(prev => ({ ...prev, position: v })) },
                ].map(({ label, value, type, placeholder, field, onChange }) => (
                  <div key={field}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: themeColors.textSecondary, marginBottom: '4px', opacity: 0.8 }}>{label}</p>
                    <input type={type} value={value} placeholder={placeholder}
                      maxLength={field === 'phone' ? 13 : undefined}
                      onChange={(e) => onChange(e.target.value)}
                      onBlur={onBlurSave(field as any, label)}
                      style={{ ...inputStyle, fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── 계정 설정 블록 ── */}
            <div style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : '#FAFAFA',
              border: `1px solid ${themeColors.border}`,
              borderRadius: '6px',
              padding: '16px',
            }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: themeColors.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '14px' }}>{t('accountSettings')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* 권한 행 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '56px', fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, flexShrink: 0 }}>{t('role')}</span>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      if (isNewRecord) {
                        setFormData(prev => ({ ...prev, role: e.target.value }));
                      } else {
                        onRadioSave('role', '권한', e.target.value);
                      }
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    {availableRoles.map(role => (
                      <option key={role.id} value={role.id}
                        style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>
                        {KO_ROLE_LABELS[role.id] || role.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 계정 상태 행 — 토글 */}
                {(() => {
                  const isActive = formData.accountStatus === 'active';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ width: '56px', fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, flexShrink: 0 }}>{t('status')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const next = isActive ? 'inactive' : 'active';
                            if (isNewRecord) setFormData(prev => ({ ...prev, accountStatus: next }));
                            else onRadioSave('accountStatus', '계정 상태', next);
                          }}
                          style={{
                            position: 'relative', display: 'inline-flex', alignItems: 'center',
                            width: '38px', height: '22px', borderRadius: '11px', border: 'none',
                            backgroundColor: isActive ? themeColors.primary : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'),
                            cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, padding: 0,
                          }}
                        >
                          <span style={{
                            position: 'absolute',
                            left: isActive ? '18px' : '2px',
                            width: '18px', height: '18px', borderRadius: '50%',
                            backgroundColor: '#fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                            transition: 'left 0.18s cubic-bezier(0.22,1,0.36,1)',
                          }} />
                        </button>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: isActive ? themeColors.primary : themeColors.textSecondary, transition: 'color 0.15s' }}>
                          {isActive ? t('activeLabel') : t('inactiveLabel')}
                        </span>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

            {/* ── 비밀번호 블록 ── */}
            <div style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : '#FAFAFA',
              border: `1px solid ${themeColors.border}`,
              borderRadius: '6px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: themeColors.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                  비밀번호 {isNewRecord ? '설정' : '재설정'}
                </p>
                {!isNewRecord && (
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                    backgroundColor: formData.passwordSet ? `${isDark ? '#3FB950' : '#2F9E44'}18` : `${themeColors.primary}12`,
                    color: formData.passwordSet ? (isDark ? '#3FB950' : '#2F9E44') : themeColors.textSecondary,
                  }}>
                    {formData.passwordSet ? '설정됨' : '미설정'}
                  </span>
                )}
              </div>
              {isNewRecord && (
                <p style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, marginBottom: '10px', opacity: 0.75 }}>
                  미입력 시 사용자가 최초 로그인 시 직접 설정합니다.
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: themeColors.textSecondary, marginBottom: '4px' }}>
                    {isNewRecord ? '비밀번호 (선택)' : '새 비밀번호'}
                  </p>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="6자 이상"
                    autoComplete="new-password"
                    style={{ ...inputStyle, fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
                  />
                </div>
                <div>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: themeColors.textSecondary, marginBottom: '4px' }}>비밀번호 확인</p>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="비밀번호 재입력"
                    autoComplete="new-password"
                    style={{ ...inputStyle, fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
                  />
                </div>
              </div>
              {!isNewRecord && newPasswordInput && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={passwordResetState === 'saving'}
                  style={{
                    marginTop: '10px', padding: '0.375rem 1rem', borderRadius: '4px', fontSize: '0.8125rem',
                    fontWeight: 600, cursor: 'pointer', border: 'none',
                    backgroundColor: passwordResetState === 'saved' ? (isDark ? '#3FB950' : '#2F9E44') : themeColors.primary,
                    color: '#fff', opacity: passwordResetState === 'saving' ? 0.6 : 1,
                    transition: 'background 0.2s',
                  }}
                >
                  {passwordResetState === 'saving' ? '재설정 중...' : passwordResetState === 'saved' ? '재설정 완료' : '비밀번호 재설정'}
                </button>
              )}
            </div>

            {/* ── 관리자 메모 블록 ── */}
            <div style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : '#FAFAFA',
              border: `1px solid ${themeColors.border}`,
              borderRadius: '6px',
              padding: '16px',
            }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: themeColors.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>{t('adminMemo')}</p>
              <textarea
                value={formData.adminMemo}
                placeholder={t('adminMemoPlaceholder')}
                rows={6}
                onChange={(e) => setFormData(prev => ({ ...prev, adminMemo: e.target.value }))}
                onBlur={onBlurSave('adminMemo', '메모')}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '144px' }}
              />
            </div>

          </div>
        </form>

        {/* 변경 이력 — 오른쪽 슬라이드 오버레이 패널 */}
        {!isNewRecord && showHistory && (() => {
          const relTime = (d: Date) => { const diff = Date.now() - d.getTime(), m = Math.floor(diff / 60000); if (m < 1) return '방금 전'; if (m < 60) return `${m}분 전`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; const day = Math.floor(h / 24); if (day < 7) return `${day}일 전`; return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }); };
          const fullTime = (d: Date) => d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          return (
            <div style={{ position: 'absolute' as const, top: 0, right: 0, bottom: 0, width: '272px', backgroundColor: isDark ? 'rgba(22,27,34,0.97)' : 'rgba(255,255,255,0.97)', borderLeft: `1px solid ${themeColors.border}`, display: 'flex', flexDirection: 'column' as const, zIndex: 10, backdropFilter: 'blur(6px)', animation: 'historySlideIn 0.2s cubic-bezier(0.22,1,0.36,1)' }}>
              <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${themeColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={13} style={{ color: themeColors.primary }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.text, letterSpacing: '0.03em' }}>변경 이력</span>
                  {historyLogs.length > 0 && <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 5px', borderRadius: '10px', backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>{historyLogs.length}</span>}
                </div>
                <button onClick={() => setShowHistory(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}><X size={14} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' as const, padding: '8px 16px 12px' }}>
                {historyLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                    <svg className="animate-spin" style={{ width: '1.25rem', height: '1.25rem', color: themeColors.primary }} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" /></svg>
                  </div>
                ) : historyLogs.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '6px', padding: '2rem 0' }}>
                    <History size={20} style={{ color: themeColors.textSecondary, opacity: 0.25 }} />
                    <p style={{ fontSize: '0.75rem', color: themeColors.textSecondary, opacity: 0.45 }}>변경 이력이 없습니다</p>
                  </div>
                ) : (
                  <div style={{ position: 'relative' as const }}>
                    <div style={{ position: 'absolute' as const, left: '9px', top: '10px', bottom: '10px', width: '1px', backgroundColor: themeColors.border }} />
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                      {historyLogs.map((log, i) => {
                        const isCreate = log.action === 'create', isDelete = log.action === 'delete';
                        const dotColor = isCreate ? themeColors.primary : isDelete ? '#EF4444' : (isDark ? '#6B7280' : '#9CA3AF');
                        const DotIcon = isCreate ? Plus : isDelete ? Trash2 : PenLine;
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
                        const ts = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                        return (
                          <div key={i} style={{ display: 'flex', gap: '10px', padding: '6px 0', alignItems: 'flex-start' }}>
                            <div style={{ width: '19px', height: '19px', borderRadius: '50%', backgroundColor: `${dotColor}18`, border: `1.5px solid ${dotColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', position: 'relative' as const, zIndex: 1 }}>
                              <DotIcon size={9} style={{ color: dotColor }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, paddingBottom: i < historyLogs.length - 1 ? '4px' : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' as const, marginBottom: parsedChanges.length > 0 ? '4px' : 0 }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: `${themeColors.primary}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: '0.5rem', fontWeight: 700, color: themeColors.primary }}>{(log.userName || '?').charAt(0)}</span>
                                </div>
                                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: themeColors.text }}>{log.userName || '-'}</span>
                                <span style={{ fontSize: '0.625rem', color: themeColors.textSecondary, opacity: 0.5 }}>·</span>
                                <span title={fullTime(ts)} style={{ fontSize: '0.625rem', color: themeColors.textSecondary, cursor: 'default' }}>{relTime(ts)}</span>
                                {(isCreate || isDelete) && <span style={{ fontSize: '0.5625rem', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', backgroundColor: `${dotColor}15`, color: dotColor }}>{isCreate ? '등록' : '삭제'}</span>}
                              </div>
                              {parsedChanges.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '3px' }}>
                                  {parsedChanges.map((c, ci) => (
                                    <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' as const, fontSize: '0.625rem', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderRadius: '4px', padding: '3px 6px' }}>
                                      <span style={{ fontWeight: 600, color: themeColors.textSecondary, flexShrink: 0 }}>{c.field}</span>
                                      {c.oldValue ? <span style={{ padding: '0 3px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: isDark ? '#F87171' : '#DC2626', textDecoration: 'line-through', maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.oldValue}</span> : <span style={{ color: themeColors.textSecondary, opacity: 0.4 }}>없음</span>}
                                      <span style={{ color: themeColors.textSecondary, flexShrink: 0 }}>→</span>
                                      <span style={{ padding: '0 3px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(63,185,80,0.12)' : 'rgba(34,197,94,0.08)', color: isDark ? '#3FB950' : '#16A34A', maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.newValue || '없음'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {parsedChanges.length === 0 && log.details && <p style={{ fontSize: '0.625rem', color: themeColors.textSecondary, marginTop: '2px', lineHeight: 1.5 }}>{log.details}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 푸터 */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderTop: `1px solid ${themeColors.border}` }}
        >
          {/* 변경 이력 토글 (수정 모드 + admin만) */}
          {!isNewRecord && currentUser?.role === 'admin' ? (
            <button type="button" onClick={toggleHistory}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: showHistory ? themeColors.primary : themeColors.textSecondary }}
            >
              <History size={13} />
              변경 이력
              <ChevronRight size={12} style={{ transition: 'transform 0.2s', transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {!isNewRecord && (
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                필드를 수정하고 포커스를 이동하면 자동 저장됩니다
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-sm transition-opacity hover:opacity-70"
              style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}`, borderRadius: '4px' }}
            >
              {t('cancel')}
            </button>
            {/* 신규 등록만 추가 버튼 표시 */}
            {isNewRecord && (
              <button
                type="submit"
                form="user-modal-form"
                disabled={isLoading || !formData.name.trim() || !formData.loginId.trim() || (!companyEmailDomain && !formData.email.trim())}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: themeColors.primary, color: onPrimaryText, borderRadius: '4px' }}
              >
                <Save size={13} />
                {isLoading ? t('processing') : t('add')}
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
};

export default UserFormModal;
