import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Flag } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import type { Timeline } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; date: string; status: Timeline['status']; description: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  milestone?: Timeline | null; // 있으면 수정 모드
}

const MilestoneSidePanel: React.FC<Props> = ({ isOpen, onClose, onSave, onDelete, milestone }) => {
  const t = useLanguage();
  const { theme } = useSettingsStore((state) => state.settings);
  const themeColors = themeConfigs[theme];
  const isDark = theme !== 'light';
  const isEditMode = !!milestone;

  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(55,53,47,0.04)';

  const emptyForm = { title: '', date: '', status: 'upcoming' as Timeline['status'], description: '' };
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (milestone) {
        setFormData({
          title: milestone.title,
          date: new Date(milestone.date).toISOString().split('T')[0],
          status: milestone.status,
          description: milestone.description || '',
        });
      } else {
        setFormData(emptyForm);
      }
      setShowDeleteConfirm(false);
    }
  }, [isOpen, milestone]);

  if (!isOpen) return null;

  const statusOptions: { value: Timeline['status']; label: string; color: string }[] = [
    { value: 'upcoming',    label: t('milestoneUpcoming')   || '예정',    color: '#6B7280' },
    { value: 'in_progress', label: t('milestoneInProgress') || '진행 중', color: '#3B82F6' },
    { value: 'completed',   label: t('milestoneCompleted')  || '완료',    color: '#10B981' },
    { value: 'missed',      label: t('milestoneDelayed')    || '지연',    color: '#EF4444' },
  ];

  const fieldInput: React.CSSProperties = {
    display: 'block', width: '100%',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(55,53,47,0.03)',
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px', color: themeColors.text,
    fontSize: '0.875rem', padding: '0.4375rem 0.625rem',
    outline: 'none', colorScheme: isDark ? 'dark' as const : 'light' as const,
  };

  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: themeColors.textSecondary, marginBottom: '0.375rem', letterSpacing: '0.02em',
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.date) return;
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const selStatus = statusOptions.find(o => o.value === formData.status) || statusOptions[0];

  return (
    <>
      <style>{`
        @keyframes milestonePanelIn { from { transform: translateX(100%); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } }
        .milestone-panel-anim { animation: milestonePanelIn 0.22s cubic-bezier(0.22,1,0.36,1); }
      `}</style>

      {/* 오버레이 */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 49, backgroundColor: 'rgba(0,0,0,0.28)' }}
        onClick={onClose}
      />

      {/* 사이드 패널 */}
      <div
        className="milestone-panel-anim"
        style={{
          position: 'fixed', right: 0, top: 0, zIndex: 50,
          width: 'min(440px, calc(100vw - 2rem))',
          height: '100vh',
          display: 'flex', flexDirection: 'column',
          backgroundColor: themeColors.surface,
          borderLeft: `1px solid ${themeColors.border}`,
          borderRadius: '12px 0 0 12px',
          boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(15,15,15,0.15)',
          overflow: 'hidden',
        }}
      >
        {/* ── 헤더 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 1rem 0.5rem 1.25rem',
          borderBottom: `1px solid ${themeColors.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Flag size={12} style={{ color: themeColors.textSecondary, opacity: 0.45 }} />
            <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, opacity: 0.55 }}>
              {isEditMode ? '마일스톤 수정' : '새 마일스톤'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isEditMode && onDelete && (
              showDeleteConfirm ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary }}>삭제하시겠습니까?</span>
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.625rem', borderRadius: '4px', backgroundColor: '#EF4444', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.18)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
                >
                  <Trash2 size={12} /> 삭제
                </button>
              )
            )}
            <button
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── 바디 ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* 제목 */}
          <div>
            <label style={fieldLabel}>
              제목 <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="마일스톤 제목을 입력하세요"
              style={fieldInput}
              autoFocus
            />
          </div>

          {/* 날짜 */}
          <div>
            <label style={fieldLabel}>
              목표일 <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              max="9999-12-31"
              style={fieldInput}
            />
          </div>

          {/* 상태 */}
          <div>
            <label style={fieldLabel}>상태</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {statusOptions.map(opt => {
                const isSelected = formData.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFormData({ ...formData, status: opt.value })}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.3125rem 0.75rem', borderRadius: '4px',
                      fontSize: '0.8125rem', fontWeight: isSelected ? 600 : 400,
                      border: `1px solid ${isSelected ? opt.color + '80' : themeColors.border}`,
                      backgroundColor: isSelected ? opt.color + '18' : 'transparent',
                      color: isSelected ? opt.color : themeColors.textSecondary,
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = hoverBg; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: opt.color, flexShrink: 0 }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label style={fieldLabel}>설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="마일스톤에 대한 설명을 입력하세요..."
              rows={4}
              style={{ ...fieldInput, resize: 'vertical' as const, minHeight: '80px' }}
            />
          </div>

        </div>

        {/* ── 푸터 ── */}
        <div style={{
          padding: '0.875rem 1.75rem',
          borderTop: `1px solid ${themeColors.border}`,
          flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.4375rem 1rem', borderRadius: '4px',
              fontSize: '0.8125rem', fontWeight: 500,
              backgroundColor: 'transparent',
              border: `1px solid ${themeColors.border}`,
              color: themeColors.textSecondary, cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.title.trim() || !formData.date || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4375rem 1.125rem', borderRadius: '4px',
              fontSize: '0.8125rem', fontWeight: 600,
              backgroundColor: (!formData.title.trim() || !formData.date || saving) ? themeColors.border : themeColors.primary,
              color: (!formData.title.trim() || !formData.date || saving) ? themeColors.textSecondary : (theme === 'yellow' ? '#333' : '#fff'),
              border: 'none', cursor: (!formData.title.trim() || !formData.date || saving) ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Save size={13} />
            {saving ? '저장 중...' : isEditMode ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </>
  );
};

export default MilestoneSidePanel;
