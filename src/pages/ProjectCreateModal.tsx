import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, FolderOpen, Maximize2, Minimize2 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useSettingsStore } from '../store/settingsStore';
import { useLanguage } from '../contexts/LanguageContext';
import { themeConfigs } from '../utils/themeConfig';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Project } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  preloadedUsers?: any[];
  preloadedCompanies?: any[];
}

const ProjectCreateModal: React.FC<Props> = ({ isOpen, onClose, onSaved, preloadedUsers, preloadedCompanies }) => {
  const { user, token } = useAuthStore();
  const { addLog } = useAuditLogStore();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const onPrimaryText = theme === 'yellow' ? '#333333' : '#fff';
  const { addProject } = useProjectStore();

  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'planning' as Project['status'],
    companyId: '',
    startDate: '',
    dueDate: '',
    managerId: '',
    memberIds: [] as string[],
  });

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, bx: 0, by: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const statusOptions = [
    { value: 'planning', label: t('planning') },
    { value: 'in_progress', label: t('inProgressProject') },
    { value: 'on_hold', label: t('onHold') },
    { value: 'completed', label: t('completed') },
    { value: 'cancelled', label: t('cancelled') },
  ];

  const inputStyle = {
    backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    border: `1px solid ${themeColors.border}`,
    color: themeColors.text,
  };

  const optionStyle = {
    backgroundColor: theme !== 'light' ? '#1f2937' : 'white',
    color: theme !== 'light' ? '#fff' : '#000',
  };

  // Reset and load on open
  useEffect(() => {
    if (!isOpen) return;
    setPos({ x: 0, y: 0 });
    setIsDataReady(false);
    setFormData({ name: '', description: '', status: 'planning', companyId: '', startDate: '', dueDate: '', managerId: '', memberIds: [] });

    if (preloadedUsers && preloadedCompanies) {
      setUsers(preloadedUsers);
      setCompanies(preloadedCompanies);
      setIsDataReady(true);
      return;
    }
    const fetchData = async () => {
      if (!token) { setIsDataReady(true); return; }
      try {
        const [uRes, cRes] = await Promise.all([
          fetch(import.meta.env.VITE_API_URL + '/users', { headers: { Authorization: `Bearer ${token}` } }),
          fetch(import.meta.env.VITE_API_URL + '/companies', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (uRes.ok) { const allUsers = await uRes.json(); setUsers(allUsers.filter((u: any) => u.active !== false)); }
        if (cRes.ok) setCompanies(await cRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setIsDataReady(true);
      }
    };
    fetchData();
  }, [isOpen, token]);

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, label')) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: pos.x, by: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({ x: dragStart.current.bx + e.clientX - dragStart.current.mx, y: dragStart.current.by + e.clientY - dragStart.current.my });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting || !formData.name.trim() || !formData.startDate || !formData.managerId || !user || !token) return;
    setIsSubmitting(true);
    try {
      const ownerId = formData.managerId;
      await addProject({
        name: formData.name,
        description: formData.description,
        status: formData.status,
        companyId: formData.companyId,
        ownerId,
        memberIds: [ownerId, ...formData.memberIds.filter(id => id !== ownerId)],
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        progress: 0,
      });
      addLog({ userId: user.id, userName: user.name, action: 'create', resourceType: 'project', resourceName: formData.name, details: `새 프로젝트가 등록되었습니다: ${formData.name}` });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedPM = users.find(u => u.id.toString() === formData.managerId);
  const isDark = theme !== 'light';

  return (
    <>
      <style>{`@keyframes sidePanelIn { from { transform: translateX(100%); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } } .project-panel-anim { animation: sidePanelIn 0.22s cubic-bezier(0.22,1,0.36,1); }`}</style>

      {/* 배경 오버레이 */}
      <div className="fixed inset-0" style={{ zIndex: 49, backgroundColor: 'rgba(0,0,0,0.28)' }} onClick={handleClose} />

      {/* 로딩 중 카드 스피너 */}
      {!isDataReady && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50, pointerEvents: 'none' }}>
          <LoadingSpinner message="불러오는 중..." />
        </div>
      )}

      {/* 데이터 준비 완료 후 사이드 패널 */}
      {isDataReady && (
      <div
        ref={modalRef}
        className="project-panel-anim"
        style={{
          position: 'fixed', right: 0, top: 0, zIndex: 50,
          width: isWide ? 'min(53.75rem, calc(100vw - 2rem))' : 'min(520px, calc(100vw - 2rem))',
          height: '100vh',
          display: 'flex', flexDirection: 'column',
          backgroundColor: themeColors.surface,
          borderLeft: `1px solid ${themeColors.border}`,
          borderRadius: '12px 0 0 12px',
          boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(15,15,15,0.15)',
          overflow: 'hidden',
          transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: `1px solid ${themeColors.border}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: themeColors.text }}>{t('newProject')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsWide(w => !w)}
              title={isWide ? '패널 축소' : '패널 확장'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
            >
              {isWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={handleClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>

            {/* 기본 정보 */}
            <div style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderRadius: '4px', border: `1px solid ${themeColors.border}`, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span style={{ color: themeColors.textSecondary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('basicInfo')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 프로젝트명 */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, marginBottom: '6px' }}>
                    {t('projectName')} <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('projectNamePlaceholder')}
                    className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  />
                </div>
                {/* 설명 */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: themeColors.textSecondary, marginBottom: '6px' }}>
                    {t('description')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('projectDescriptionPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 transition-all resize-none"
                    style={inputStyle}
                  />
                </div>
                {/* 업체 */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: themeColors.textSecondary, marginBottom: '6px' }}>
                    {t('company')}
                  </label>
                  <select
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  >
                    <option value="" style={optionStyle}>
                      {companies.length === 0 ? t('noCompaniesAvailable') : t('selectCompanyOptional')}
                    </option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id} style={optionStyle}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 팀 구성 */}
            <div style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderRadius: '4px', border: `1px solid ${themeColors.border}`, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span style={{ color: themeColors.textSecondary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('teamStructure')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* PM */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, marginBottom: '6px' }}>
                    {t('projectManager')} <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    value={formData.managerId}
                    onChange={(e) => {
                      const newManagerId = e.target.value;
                      setFormData({ ...formData, managerId: newManagerId, memberIds: formData.memberIds.filter(id => id !== newManagerId) });
                    }}
                    className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  >
                    <option value="" style={optionStyle}>{t('selectManager')}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id.toString()} style={optionStyle}>
                        {u.name} ({u.department || u.email})
                      </option>
                    ))}
                  </select>
                  {selectedPM && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', padding: '10px', borderRadius: '4px', backgroundColor: `${themeColors.primary}12` }}>
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPM.id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                        alt={selectedPM.name}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${themeColors.primary}40` }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: themeColors.text }}>{selectedPM.name}</span>
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', backgroundColor: themeColors.primary, color: '#fff' }}>PM</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary }}>{selectedPM.department || selectedPM.email}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* 팀원 */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 500, color: themeColors.textSecondary }}>{t('selectTeamMember')}</label>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', color: themeColors.textSecondary }}>
                      {formData.memberIds.length}{t('people')} {t('selected')}
                    </span>
                  </div>
                  {formData.memberIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', padding: '10px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)' }}>
                      {formData.memberIds.map(memberId => {
                        const m = users.find(u => u.id.toString() === memberId);
                        if (!m) return null;
                        return (
                          <span key={memberId} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500, backgroundColor: '#22c55e', color: '#fff' }}>
                            {m.name}
                            <button type="button" onClick={() => setFormData({ ...formData, memberIds: formData.memberIds.filter(id => id !== memberId) })} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0 }}>
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '220px', overflowY: 'auto', padding: '2px' }}>
                    {users.filter(u => u.id.toString() !== formData.managerId).length === 0 ? (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px', fontSize: '0.8125rem', color: themeColors.textSecondary }}>
                        {formData.managerId ? t('noOtherUsers') : t('noUsersAvailable')}
                      </div>
                    ) : users.filter(u => u.id.toString() !== formData.managerId).sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(member => {
                      const memberId = member.id.toString();
                      const isSelected = formData.memberIds.includes(memberId);
                      return (
                        <label
                          key={member.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                            borderRadius: '4px', cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(34,197,94,0.1)' : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            border: `2px solid ${isSelected ? '#22c55e' : 'transparent'}`,
                          }}
                        >
                          <input type="checkbox" checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setFormData({ ...formData, memberIds: [...formData.memberIds, memberId] });
                              else setFormData({ ...formData, memberIds: formData.memberIds.filter(id => id !== memberId) });
                            }}
                            style={{ display: 'none' }}
                          />
                          <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                            alt={member.name}
                            style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSelected ? '#22c55e' : 'transparent'}` }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: isSelected ? '#22c55e' : themeColors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</p>
                            <p style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.department || member.email}</p>
                          </div>
                          {isSelected && (
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg style={{ width: '11px', height: '11px', color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 일정 */}
            <div style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderRadius: '4px', border: `1px solid ${themeColors.border}`, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span style={{ color: themeColors.textSecondary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('schedule')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, marginBottom: '6px' }}>
                    {t('startDate')} <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                    className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                    style={{ ...inputStyle, colorScheme: isDark ? 'dark' : 'light' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: themeColors.textSecondary, marginBottom: '6px' }}>
                    {t('dueDate')}
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                    className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                    style={{ ...inputStyle, colorScheme: isDark ? 'dark' : 'light' }}
                  />
                </div>
              </div>
            </div>

            {/* 상태 */}
            <div style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderRadius: '4px', border: `1px solid ${themeColors.border}`, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span style={{ color: themeColors.textSecondary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('status')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {statusOptions.map(opt => {
                  const isSelected = formData.status === opt.value;
                  return (
                    <label
                      key={opt.value}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '4px', cursor: 'pointer',
                        backgroundColor: isSelected ? themeColors.primary : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${isSelected ? themeColors.primary : themeColors.border}`,
                      }}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={opt.value}
                        checked={isSelected}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                        style={{ display: 'none' }}
                      />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: isSelected ? onPrimaryText : themeColors.text }}>
                        {opt.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
          padding: '12px 20px', borderTop: `1px solid ${themeColors.border}`, flexShrink: 0,
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: '6px 14px', borderRadius: '4px', fontSize: '0.8125rem', fontWeight: 500,
              backgroundColor: 'transparent', color: themeColors.textSecondary,
              border: `1px solid ${themeColors.border}`, cursor: 'pointer',
            }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.name.trim() || !formData.startDate || !formData.managerId || isSubmitting}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '4px',
              backgroundColor: themeColors.primary, color: onPrimaryText,
              fontSize: '0.8125rem', fontWeight: 600,
              opacity: (!formData.name.trim() || !formData.startDate || !formData.managerId || isSubmitting) ? 0.5 : 1,
              cursor: (!formData.name.trim() || !formData.startDate || !formData.managerId || isSubmitting) ? 'not-allowed' : 'pointer',
              border: 'none',
            }}
          >
            <Save size={14} />
            {isSubmitting ? t('processing') : t('add')}
          </button>
        </div>

        </div>
      </div>
      )}
    </>
  );
};

export default ProjectCreateModal;
