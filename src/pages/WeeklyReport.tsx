import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, BarChart2, Maximize2, Minimize2, Trash2, Minus, Check, Lock, History, ChevronDown, User } from 'lucide-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { useSettingsStore } from '../store/settingsStore';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../store/authStore';
import { themeConfigs } from '../utils/themeConfig';
import { isAdminAccount } from '../utils/permissions';

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month' | 'year';

export type WorkCategory =
  | 'development'
  | 'maintenance'
  | 'meeting'
  | 'review'
  | 'docs'
  | 'remote'
  | 'vacation'
  | 'etc';

export interface ChangeRecord {
  id: string;
  changedAt: string; // ISO datetime
  changedById: string;
  changedByName: string;
  changes: { field: string; from: string; to: string }[];
}

export interface WorkEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  category: WorkCategory;
  memberId: string;
  memberName: string;
  hours: number;
  createdAt?: string; // ISO datetime
  history?: ChangeRecord[];
}

// ── Category Config ────────────────────────────────────────────────────────────

const CATEGORIES: Record<WorkCategory, { label: string; color: string }> = {
  development:  { label: '개발',     color: '#3B82F6' },
  maintenance:  { label: '유지보수', color: '#F59E0B' },
  meeting:      { label: '회의',     color: '#8B5CF6' },
  review:       { label: '검토',     color: '#EC4899' },
  docs:         { label: '문서작성',     color: '#10B981' },
  remote:       { label: '재택근무', color: '#06B6D4' },
  vacation:     { label: '휴가',     color: '#6B7280' },
  etc:          { label: '기타',     color: '#64748B' },
};

const CAT_LABEL_KEYS: Record<WorkCategory, string> = {
  development: 'catDevelopment',
  maintenance: 'catMaintenance',
  meeting: 'catMeeting',
  review: 'catReview',
  docs: 'catDocs',
  remote: 'catRemote',
  vacation: 'catVacation',
  etc: 'catEtc',
};

// ── Zustand Store (persisted) ──────────────────────────────────────────────────

interface WorkReportState {
  entries: WorkEntry[];
  addEntry: (e: WorkEntry) => void;
  updateEntry: (id: string, patch: Partial<WorkEntry>, changedBy?: { id: string; name: string }) => void;
  deleteEntry: (id: string) => void;
}

const useWorkReportStore = create<WorkReportState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (e) => set((s) => ({ entries: [...s.entries, e] })),
      updateEntry: (id, patch, changedBy) =>
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== id) return e;
            if (!changedBy) return { ...e, ...patch };
            // 변경된 필드만 이력 기록
            const FIELD_LABELS: Partial<Record<string, string>> = {
              title: '제목', description: '상세 내용',
              category: '업무 유형', hours: '소요 시간', date: '날짜',
            };
            const fmtVal = (key: string, val: any): string => {
              if (key === 'category') return CATEGORIES[val as WorkCategory]?.label || String(val);
              if (key === 'hours') return `${val}h`;
              return String(val ?? '');
            };
            const changes: ChangeRecord['changes'] = [];
            for (const key of Object.keys(patch) as (keyof WorkEntry)[]) {
              if (!FIELD_LABELS[key]) continue;
              const ov = fmtVal(key, e[key]);
              const nv = fmtVal(key, patch[key]);
              if (ov !== nv) changes.push({ field: FIELD_LABELS[key]!, from: ov, to: nv });
            }
            const record: ChangeRecord | null = changes.length > 0 ? {
              id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
              changedAt: new Date().toISOString(),
              changedById: changedBy.id,
              changedByName: changedBy.name,
              changes,
            } : null;
            return {
              ...e, ...patch,
              history: record ? [...(e.history || []), record] : (e.history || []),
            };
          }),
        })),
      deleteEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    }),
    { name: 'weekly-report-store-v1' }
  )
);

// ── Date Helpers ───────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

const getMondayOf = (d: Date) => {
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

// ISO 8601 기준: 그 주의 목요일이 속한 달 = 해당 주의 달
// 그 달의 첫 번째 목요일을 포함한 주 = 1주차
const getWeekOfMonth = (monday: Date): { weekNum: number; displayMonth: number; displayYear: number } => {
  const thursday = addDays(monday, 3); // 월요일 + 3 = 목요일
  const m = thursday.getMonth();
  const y = thursday.getFullYear();

  // 해당 달의 첫 번째 목요일 구하기 (0=일, 4=목)
  const firstOfMonth = new Date(y, m, 1);
  const dow = firstOfMonth.getDay();
  const firstThursdayDate = ((4 - dow + 7) % 7) + 1;
  const firstThursday = new Date(y, m, firstThursdayDate);

  // 1주차 시작 월요일
  const week1Monday = getMondayOf(firstThursday);

  const weekNum = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86400000)) + 1;
  return { weekNum, displayMonth: m, displayYear: y };
};

const isToday = (dateStr: string) => dateStr === toDateStr(new Date());

const getAvatarUrl = (id: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ── Entry Modal ────────────────────────────────────────────────────────────────

interface EntryModalProps {
  date?: string;
  entry?: WorkEntry;
  canEdit: boolean;
  onAutoSave: (e: WorkEntry, isNew: boolean) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
  themeColors: ReturnType<typeof Object.values<(typeof themeConfigs)[keyof typeof themeConfigs]>>[number];
  isDark: boolean;
  user: { id: string; name: string } | null;
}

const EntryModal: React.FC<EntryModalProps> = ({
  date,
  entry,
  canEdit,
  onAutoSave,
  onClose,
  onDelete,
  themeColors,
  isDark,
  user,
}) => {
  const [form, setForm] = useState({
    title: entry?.title || '',
    description: entry?.description || '',
    category: (entry?.category || 'development') as WorkCategory,
    hours: (entry?.hours ?? 1).toString(),
    date: entry?.date || date || toDateStr(new Date()),
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const [isWide, setIsWide] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const t = useLanguage();

  // Stable refs for auto-save (avoid stale closures)
  const entryIdRef = useRef(entry?.id || (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)));
  const isNewRef = useRef(!entry); // true = not yet persisted to store
  const onAutoSaveRef = useRef(onAutoSave);
  const entryPropRef = useRef(entry);
  const userRef = useRef(user);
  const formRef = useRef(form);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstRef = useRef(true);

  useEffect(() => { onAutoSaveRef.current = onAutoSave; }, [onAutoSave]);
  useEffect(() => { formRef.current = form; }, [form]);

  const doSave = useCallback(() => {
    const f = formRef.current;
    if (!f.title.trim()) return;
    const e: WorkEntry = {
      id: entryIdRef.current,
      title: f.title.trim(),
      description: f.description,
      category: f.category,
      hours: parseFloat(f.hours) || 0,
      date: f.date,
      memberId: entryPropRef.current?.memberId || userRef.current?.id || '',
      memberName: entryPropRef.current?.memberName || userRef.current?.name || t('unknown'),
    };
    onAutoSaveRef.current(e, isNewRef.current);
    isNewRef.current = false;
    setSaveStatus('saved');
  }, []);

  // Auto-save debounce: fires 800ms after last change (편집 권한 있을 때만)
  useEffect(() => {
    if (!canEdit) return;
    if (skipFirstRef.current) { skipFirstRef.current = false; return; }
    setSaveStatus('pending');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { doSave(); }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [form.title, form.description, form.category, form.hours, form.date, doSave, canEdit]);

  // Flush pending save before closing
  const handleClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      doSave();
    }
    onClose();
  }, [doSave, onClose]);

  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(55,53,47,0.04)';
  const inputStyle: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    border: `1px solid ${themeColors.border}`,
    color: themeColors.text,
    borderRadius: '4px',
    outline: 'none',
    fontSize: '0.875rem',
    padding: '6px 10px',
    width: '100%',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: themeColors.textSecondary,
    marginBottom: '6px',
    display: 'block',
  };

  // Header context: date + member for edit mode
  const displayDate = (() => {
    const d = new Date(form.date + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'short' });
  })();
  const displayMember = entry?.memberName || user?.name || '';

  return (
    <>
      <style>{`@keyframes sidePanelIn { from { transform: translateX(100%); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } } .task-panel-anim { animation: sidePanelIn 0.22s cubic-bezier(0.22,1,0.36,1); }`}</style>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
        onClick={handleClose}
      />
      {/* 사이드 패널 */}
      <div
        className="task-panel-anim"
        style={{
          position: 'fixed', right: 0, top: 0, zIndex: 50,
          width: isWide ? 'min(46rem, calc(100vw - 2rem))' : 'min(480px, calc(100vw - 2rem))',
          transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
          height: '100vh',
          display: 'flex', flexDirection: 'column',
          backgroundColor: themeColors.surface,
          borderLeft: `1px solid ${themeColors.border}`,
          borderRadius: '12px 0 0 12px',
          boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(15,15,15,0.15)',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 1rem 0.5rem 1.25rem',
          borderBottom: `1px solid ${themeColors.border}`,
          flexShrink: 0,
          gap: '0.5rem',
        }}>
          {/* 왼쪽: 컨텍스트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, opacity: 0.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {entry
                ? `${displayDate}${displayMember ? ` · ${displayMember}` : ''}`
                : t('newWork')}
            </span>
            <span style={{ fontSize: '0.75rem', color: themeColors.text, fontWeight: 600, opacity: 0.85 }}>
              {!canEdit ? t('readOnly') : entry ? t('editing') : t('writing')}
            </span>
          </div>
          {/* 오른쪽: 저장 상태 + 버튼들 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* 자동 저장 상태 표시 (편집 모드만) */}
            {canEdit && saveStatus !== 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: themeColors.textSecondary, opacity: 0.65 }}>
                {saveStatus === 'pending'
                  ? <><span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B', flexShrink: 0 }} />{t('savingInProgress')}</>
                  : <><Check size={11} style={{ color: '#10B981', flexShrink: 0 }} />{t('savedLabel')}</>
                }
              </div>
            )}
            {/* 늘리기 */}
            <button
              onClick={() => setIsWide(w => !w)}
              title={isWide ? t('panelShrink') : t('panelExpand')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {isWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            {/* 삭제 — 수정 모드 + 편집 권한 있을 때만 */}
            {canEdit && entry && onDelete && (
              <button
                onClick={() => { onDelete(entry.id); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.18)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
              >
                <Trash2 size={12} /> {t('delete')}
              </button>
            )}
            {/* 닫기 */}
            <button
              onClick={handleClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 바디 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

          {/* ── 읽기 전용 모드 ── */}
          {!canEdit && entry && (
            <>
              {/* 읽기 전용 안내 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.625rem 0.875rem', borderRadius: '4px', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${themeColors.border}` }}>
                <Lock size={12} style={{ color: themeColors.textSecondary, flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary }}>
                  {t('readOnlyWrittenBy', { name: entry.memberName })}
                </span>
              </div>
              {/* 제목 */}
              <div>
                <span style={labelStyle}>{t('title')}</span>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: themeColors.text, lineHeight: 1.4 }}>{entry.title}</p>
              </div>
              {/* 날짜 + 시간 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={labelStyle}>{t('workDate')}</span>
                  <p style={{ fontSize: '0.875rem', color: themeColors.text }}>{entry.date}</p>
                </div>
                <div>
                  <span style={labelStyle}>{t('hoursLabel')}</span>
                  <p style={{ fontSize: '0.875rem', color: themeColors.text }}>{entry.hours}h</p>
                </div>
              </div>
              {/* 업무 유형 */}
              <div>
                <span style={labelStyle}>{t('workCategoryLabel')}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: '3px', fontSize: '0.8125rem', fontWeight: 600, backgroundColor: `${(CATEGORIES[entry.category] ?? CATEGORIES.etc).color}20`, color: (CATEGORIES[entry.category] ?? CATEGORIES.etc).color, border: `1px solid ${(CATEGORIES[entry.category] ?? CATEGORIES.etc).color}40` }}>
                  {t(CAT_LABEL_KEYS[entry.category] ?? CAT_LABEL_KEYS.etc)}
                </span>
              </div>
              {/* 상세 내용 */}
              {entry.description && (
                <div>
                  <span style={labelStyle}>{t('detailedContent')}</span>
                  <p style={{ fontSize: '0.875rem', color: themeColors.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.description}</p>
                </div>
              )}
            </>
          )}

          {/* ── 편집 모드 ── */}
          {canEdit && (
            <>
              {/* 제목 */}
              <div>
                <label style={labelStyle}>{t('title')} <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder={t('workTitlePlaceholder')}
                  autoFocus
                  style={{ ...inputStyle, fontSize: '1rem', fontWeight: 600, padding: '8px 12px' }}
                />
              </div>

              {/* 날짜 + 소요 시간 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>{t('workDate')}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: isDark ? 'dark' : 'light' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t('hoursLabel')} (h)</label>
                  <input
                    type="number"
                    min="0" max="24" step="0.5"
                    value={form.hours}
                    onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* 업무 유형 */}
              <div>
                <label style={labelStyle}>{t('workCategoryLabel')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {(Object.keys(CATEGORIES) as WorkCategory[]).map((cat) => {
                    const isActive = form.category === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setForm((p) => ({ ...p, category: cat }))}
                        style={{
                          padding: '5px 14px', borderRadius: '3px', fontSize: '0.8125rem',
                          fontWeight: isActive ? 700 : 500,
                          border: isActive ? `2px solid ${CATEGORIES[cat].color}` : `1px solid ${themeColors.border}`,
                          backgroundColor: isActive ? (isDark ? `${CATEGORIES[cat].color}30` : `${CATEGORIES[cat].color}20`) : 'transparent',
                          color: isActive ? CATEGORIES[cat].color : themeColors.textSecondary,
                          cursor: 'pointer', transition: 'all 0.12s',
                          boxShadow: isActive ? `0 0 0 3px ${CATEGORIES[cat].color}18` : 'none',
                        }}
                      >
                        {t(CAT_LABEL_KEYS[cat])}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 상세 내용 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>{t('detailedContent')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder={t('workDescPlaceholder')}
                  style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit', minHeight: '140px', flex: 1, lineHeight: '1.6' }}
                />
              </div>
            </>
          )}

          {/* ── 변경 이력 (편집/읽기 전용 공통) ── */}
          {entry && entry.history && entry.history.length > 0 && (
            <div style={{ borderTop: `1px solid ${themeColors.border}`, paddingTop: '1.25rem' }}>
              <button
                onClick={() => setShowHistory(h => !h)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <History size={13} />
                {t('changeHistory')} ({entry.history.length})
                <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: showHistory ? 'rotate(180deg)' : 'none' }} />
              </button>
              {showHistory && (
                <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {[...entry.history].reverse().map((rec) => (
                    <div
                      key={rec.id}
                      style={{ padding: '0.625rem 0.75rem', borderRadius: '4px', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', border: `1px solid ${themeColors.border}` }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.text }}>{rec.changedByName}</span>
                        <span style={{ fontSize: '0.6875rem', color: themeColors.textSecondary }}>{formatDateTime(rec.changedAt)}</span>
                      </div>
                      {rec.changes.map((c, i) => (
                        <div key={i} style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: themeColors.primary }}>{c.field}</span>
                          <span style={{ opacity: 0.7 }}>{c.from || t('noneLabel')}</span>
                          <span style={{ opacity: 0.45 }}>→</span>
                          <span style={{ fontWeight: 500, color: themeColors.text }}>{c.to || t('noneLabel')}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {/* 자동 저장 — 푸터 버튼 없음 */}
      </div>
    </>
  );
};

// ── Entry Card ─────────────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: WorkEntry;
  isSelected?: boolean;
  canEdit?: boolean;
  showAuthor?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onHoursChange?: (delta: number) => void;
  themeColors: any;
  isDark: boolean;
}

const EntryCard: React.FC<EntryCardProps> = ({ entry, isSelected, canEdit = true, showAuthor = false, onEdit, onDelete, onHoursChange, themeColors, isDark }) => {
  const t = useLanguage();
  const cat = CATEGORIES[entry.category] ?? CATEGORIES.etc;
  return (
    <div
      className="group relative rounded overflow-hidden"
      style={{
        backgroundColor: isSelected
          ? (isDark ? `${cat.color}22` : `${cat.color}14`)
          : (isDark ? `${cat.color}0F` : `${cat.color}09`),
        border: isSelected ? `1.5px solid ${cat.color}70` : `1px solid ${cat.color}30`,
        borderRadius: '6px',
        boxShadow: isSelected ? `0 0 0 2px ${cat.color}14` : 'none',
        transition: 'border-color 0.12s, box-shadow 0.12s, background-color 0.12s',
        cursor: canEdit ? 'pointer' : 'default',
      }}
      onClick={canEdit ? onEdit : undefined}
    >
      {/* 카테고리 색상 왼쪽 바 */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: cat.color, borderRadius: '6px 0 0 6px', opacity: isSelected ? 1 : 0.6 }} />

      <div style={{ padding: '6px 8px 6px 10px' }}>
        {/* 상단: 작성자(전체 뷰) + 삭제/잠금 */}
        {(showAuthor || !canEdit) && (
          <div className="flex items-center justify-between gap-1 mb-1">
            {showAuthor && entry.memberName ? (
              <div className="flex items-center gap-1 min-w-0">
                <img
                  src={getAvatarUrl(entry.memberId)}
                  alt={entry.memberName}
                  className="w-4 h-4 rounded-full flex-shrink-0 object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="text-[10px] font-medium truncate" style={{ color: themeColors.textSecondary }}>
                  {entry.memberName}
                </span>
              </div>
            ) : <span />}
            {!canEdit && <Lock size={9} style={{ color: themeColors.textSecondary, opacity: 0.4, flexShrink: 0 }} />}
          </div>
        )}

        {/* 제목 + 삭제 버튼 */}
        <div className="flex items-start justify-between gap-1">
          <p
            className="text-xs font-semibold leading-snug flex-1"
            style={{
              color: isSelected ? cat.color : themeColors.text,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            {entry.title}
          </p>
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity mt-0.5"
              style={{ color: themeColors.textSecondary }}
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* 설명 */}
        {entry.description && (
          <p
            className="text-[11px] mt-1 leading-snug"
            style={{
              color: themeColors.textSecondary,
              opacity: 0.8,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            {entry.description}
          </p>
        )}

        {/* 하단: 카테고리 뱃지 + 시간 */}
        <div className="flex items-center justify-between gap-1 mt-1.5">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-sm font-semibold"
            style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
          >
            {t(CAT_LABEL_KEYS[entry.category] ?? CAT_LABEL_KEYS.etc)}
          </span>
          {/* 인라인 시간 편집 */}
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {canEdit && onHoursChange && (
              <button
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded"
                style={{ color: themeColors.textSecondary }}
                onClick={() => onHoursChange(-0.5)}
              >
                <Minus size={8} />
              </button>
            )}
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{ color: isSelected ? cat.color : themeColors.textSecondary }}
            >
              {entry.hours}h
            </span>
            {canEdit && onHoursChange && (
              <button
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded"
                style={{ color: themeColors.textSecondary }}
                onClick={() => onHoursChange(0.5)}
              >
                <Plus size={8} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Weekly View ────────────────────────────────────────────────────────────────

interface WeeklyViewProps {
  weekStart: Date;
  entries: WorkEntry[];
  selectedMembers: string[];
  selectedEntryId?: string;
  canEditEntry: (e: WorkEntry) => boolean;
  onAddEntry: (date: string) => void;
  onEditEntry: (e: WorkEntry) => void;
  onDeleteEntry: (id: string) => void;
  onHoursChange: (entryId: string, delta: number) => void;
  themeColors: any;
  isDark: boolean;
}

const WeeklyView: React.FC<WeeklyViewProps> = ({
  weekStart,
  entries,
  selectedMembers,
  selectedEntryId,
  canEditEntry,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onHoursChange,
  themeColors,
  isDark,
}) => {
  const t = useLanguage();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const DAY_LABELS = [t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'), t('dayFri'), t('daySat'), t('daySun')];

  return (
    <div className="grid gap-2 h-full overflow-hidden" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
      {days.map((day, i) => {
        const dateStr = toDateStr(day);
        const dayEntries = entries.filter(
          (e) => e.date === dateStr && (selectedMembers.length === 0 || selectedMembers.includes(e.memberId))
        );
        const todayFlag = isToday(dateStr);
        const isWeekend = i >= 5;

        return (
          <div
            key={dateStr}
            className="flex flex-col overflow-hidden rounded"
            style={{
              border: `1px solid ${todayFlag ? themeColors.primary + '50' : themeColors.border}`,
              backgroundColor: isWeekend
                ? isDark
                  ? 'rgba(255,255,255,0.015)'
                  : 'rgba(0,0,0,0.01)'
                : 'transparent',
              opacity: isWeekend ? 0.8 : 1,
            }}
          >
            {/* Day header */}
            <div
              className="flex items-center justify-between px-2.5 py-2 flex-shrink-0"
              style={{
                borderBottom: `1px solid ${themeColors.border}`,
                backgroundColor: todayFlag
                  ? `${themeColors.primary}12`
                  : isDark
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(0,0,0,0.02)',
              }}
            >
              <div>
                <span
                  className="text-[10px] font-semibold uppercase"
                  style={{
                    color: isWeekend
                      ? isDark
                        ? 'rgba(255,100,100,0.7)'
                        : '#EF4444'
                      : themeColors.textSecondary,
                  }}
                >
                  {DAY_LABELS[i]}
                </span>
                <p
                  className="text-base font-bold leading-none mt-0.5"
                  style={{ color: todayFlag ? themeColors.primary : themeColors.text }}
                >
                  {day.getDate()}
                </p>
              </div>
              {dayEntries.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    backgroundColor: `${themeColors.primary}20`,
                    color: themeColors.primary,
                  }}
                >
                  {dayEntries.length}
                </span>
              )}
            </div>

            {/* Entries scroll area */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0 scroll-area">
              {dayEntries.map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  isSelected={e.id === selectedEntryId}
                  canEdit={canEditEntry(e)}
                  showAuthor={selectedMembers.length !== 1}
                  onEdit={() => onEditEntry(e)}
                  onDelete={() => onDeleteEntry(e.id)}
                  onHoursChange={(delta) => onHoursChange(e.id, delta)}
                  themeColors={themeColors}
                  isDark={isDark}
                />
              ))}
            </div>

            {/* Add button */}
            <button
              onClick={() => onAddEntry(dateStr)}
              className="flex items-center justify-center gap-1 w-full py-1.5 flex-shrink-0 transition-all text-xs"
              style={{
                borderTop: `1px dashed ${themeColors.border}`,
                color: themeColors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = themeColors.primary;
                e.currentTarget.style.backgroundColor = `${themeColors.primary}08`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = themeColors.textSecondary;
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Plus size={12} />
              <span>{t('add')}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

// ── Monthly View ───────────────────────────────────────────────────────────────

interface MonthlyViewProps {
  year: number;
  month: number; // 0-based
  entries: WorkEntry[];
  selectedMembers: string[];
  selectedEntryId?: string;
  canEditEntry: (e: WorkEntry) => boolean;
  onAddEntry: (date: string) => void;
  onEditEntry: (e: WorkEntry) => void;
  onDeleteEntry: (id: string) => void;
  onHoursChange: (entryId: string, delta: number) => void;
  themeColors: any;
  isDark: boolean;
}

const MonthlyView: React.FC<MonthlyViewProps> = ({
  year,
  month,
  entries,
  selectedMembers,
  selectedEntryId,
  canEditEntry,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onHoursChange,
  themeColors,
  isDark,
}) => {
  const t = useLanguage();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const lastDay = new Date(year, month + 1, 0);

  // 달력 시작일: 해당 월 1일이 속한 주의 월요일
  const calStart = new Date(year, month, 1);
  const csOff = calStart.getDay() === 0 ? 6 : calStart.getDay() - 1;
  calStart.setDate(calStart.getDate() - csOff);

  // 달력 종료일: 마지막 날이 속한 주의 일요일
  const calEnd = new Date(lastDay);
  const ceOff = calEnd.getDay() === 0 ? 0 : 7 - calEnd.getDay();
  calEnd.setDate(calEnd.getDate() + ceOff);

  // 전체 날짜 배열 생성
  const calDays: Date[] = [];
  const cur = new Date(calStart);
  while (cur <= calEnd) { calDays.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }

  const getDayEntries = (d: Date) => {
    const ds = toDateStr(d);
    return entries.filter((e) => e.date === ds && (selectedMembers.length === 0 || selectedMembers.includes(e.memberId)));
  };

  const selectedEntries = selectedDate
    ? entries.filter((e) => e.date === selectedDate && (selectedMembers.length === 0 || selectedMembers.includes(e.memberId)))
    : [];

  // 오늘 셀 배경 (MaintenanceCalendar 동일)
  const toRgba = (hex: string, opacity: number) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  };
  const todayBg = isDark
    ? `linear-gradient(135deg, ${toRgba(themeColors.primary, 0.72)}, ${toRgba(themeColors.secondary || themeColors.primary, 0.50)})`
    : `linear-gradient(135deg, ${toRgba(themeColors.primary, 0.15)}, ${toRgba(themeColors.secondary || themeColors.primary, 0.08)})`;

  const DAY_LABELS = [t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'), t('dayFri'), t('daySat'), t('daySun')];

  return (
    <div className="flex gap-3 h-full overflow-hidden">
      {/* ── 캘린더 그리드 ── */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden rounded-xl"
        style={{ border: `1px solid ${themeColors.border}`, backgroundColor: themeColors.surface }}
      >
        {/* 요일 헤더 */}
        <div
          className="grid grid-cols-7 flex-shrink-0"
          style={{ borderBottom: `1px solid ${themeColors.border}` }}
        >
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className="py-3 text-center text-sm font-medium"
              style={{
                color: i === 5 ? '#3B82F6' : i === 6 ? '#EF4444' : themeColors.textSecondary,
                borderRight: i < 6 ? `1px solid ${themeColors.border}` : 'none',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-hidden">
          {calDays.map((day, idx) => {
            const dateStr = toDateStr(day);
            const inMonth = day.getMonth() === month;
            const todayFlag = isToday(dateStr);
            const isSelected = selectedDate === dateStr;
            const dayEntries = getDayEntries(day);
            const dow = day.getDay(); // 0=Sun
            const isSat = dow === 6;
            const isSun = dow === 0;
            const maxVisible = 3;

            return (
              <div
                key={idx}
                className="relative p-1 cursor-pointer group"
                style={{
                  minHeight: '80px',
                  borderRight: (idx + 1) % 7 !== 0 ? `1px solid ${themeColors.border}` : 'none',
                  borderBottom: `1px solid ${themeColors.border}`,
                  background: todayFlag
                    ? todayBg
                    : isSelected
                    ? `${themeColors.primary}0D`
                    : !inMonth
                    ? isDark ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.02)'
                    : 'transparent',
                  outline: isSelected ? `2px solid ${themeColors.primary}40` : 'none',
                  outlineOffset: '-2px',
                }}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                onDoubleClick={() => { setSelectedDate(dateStr); onAddEntry(dateStr); }}
              >
                {/* 날짜 숫자 */}
                <div className="flex justify-end mb-1 pr-0.5">
                  <span
                    className="text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: todayFlag ? themeColors.primary : 'transparent',
                      color: todayFlag
                        ? '#fff'
                        : !inMonth
                        ? themeColors.textSecondary
                        : isSun ? '#EF4444'
                        : isSat ? '#3B82F6'
                        : themeColors.text,
                      opacity: inMonth ? 1 : 0.45,
                    }}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* 업무 이벤트 pill */}
                <div className="space-y-0.5 px-0.5">
                  {dayEntries.slice(0, maxVisible).map((e) => {
                    const cat = CATEGORIES[e.category] ?? CATEGORIES.etc;
                    const bgHex = cat.color;
                    const bgRgba = toRgba(bgHex, isDark ? 0.22 : 0.14);
                    return (
                      <div
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); onEditEntry(e); }}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] cursor-pointer truncate transition-opacity hover:opacity-75"
                        style={{
                          backgroundColor: bgRgba,
                          color: isDark ? cat.color : cat.color,
                          borderLeft: `2.5px solid ${cat.color}`,
                        }}
                        title={`${e.title}${e.memberName ? ' · ' + e.memberName : ''}`}
                      >
                        {/* 작성자 아바타 (전체 보기) */}
                        {selectedMembers.length !== 1 && (
                          <img
                            src={getAvatarUrl(e.memberId)}
                            alt={e.memberName}
                            className="w-3 h-3 rounded-full flex-shrink-0 object-cover"
                            onError={(ev) => { ev.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <span className="truncate font-medium">{e.title}</span>
                        <span className="flex-shrink-0 opacity-60">{e.hours}h</span>
                      </div>
                    );
                  })}
                  {dayEntries.length > maxVisible && (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setSelectedDate(dateStr); }}
                      className="text-[11px] px-1.5 font-medium hover:underline"
                      style={{ color: themeColors.textSecondary }}
                    >
                      {t('moreItems', { count: dayEntries.length - maxVisible })}
                    </button>
                  )}
                </div>

                {/* 호버 시 + 버튼 */}
                <button
                  onClick={(ev) => { ev.stopPropagation(); onAddEntry(dateStr); }}
                  className="absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                  style={{ color: themeColors.primary, backgroundColor: `${themeColors.primary}18` }}
                >
                  <Plus size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 사이드 패널 ── */}
      {selectedDate && (
        <div
          className="flex-shrink-0 w-64 flex flex-col overflow-hidden rounded-xl"
          style={{ border: `1px solid ${themeColors.border}`, backgroundColor: themeColors.surface }}
        >
          {/* 패널 헤더 */}
          <div
            className="flex items-start justify-between px-3 py-2.5 flex-shrink-0"
            style={{ borderBottom: `1px solid ${themeColors.border}` }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold" style={{ color: themeColors.text }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'short' })}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: themeColors.textSecondary }}>
                {t('itemCount', { count: selectedEntries.length })}
              </p>
              {/* 작성자 아바타 스택 */}
              {selectedMembers.length !== 1 && selectedEntries.length > 0 && (() => {
                const uniq = Array.from(new Map(selectedEntries.map((e) => [e.memberId, e.memberName])).entries());
                return (
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex">
                      {uniq.slice(0, 5).map(([id, name], i) => (
                        <img key={id} src={getAvatarUrl(id)} alt={name} title={name}
                          className="w-6 h-6 rounded-full object-cover border-2"
                          style={{ borderColor: themeColors.surface, marginLeft: i > 0 ? '-8px' : '0' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ))}
                    </div>
                    {uniq.length > 1 && (
                      <span className="text-[11px]" style={{ color: themeColors.textSecondary }}>
                        {uniq.map(([, n]) => n).join(', ')}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <button
                onClick={() => onAddEntry(selectedDate)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}
              >
                <Plus size={11} /><span>{t('add')}</span>
              </button>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 rounded hover:opacity-70 transition-opacity"
                style={{ color: themeColors.textSecondary }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {/* 항목 목록 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scroll-area">
            {selectedEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <p className="text-xs mb-2" style={{ color: themeColors.textSecondary }}>{t('noWorkEntries')}</p>
                <button onClick={() => onAddEntry(selectedDate)} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: themeColors.primary }}>
                  + {t('workAdd')}
                </button>
              </div>
            ) : (
              selectedEntries.map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  isSelected={e.id === selectedEntryId}
                  canEdit={canEditEntry(e)}
                  showAuthor={selectedMembers.length !== 1}
                  onEdit={() => onEditEntry(e)}
                  onDelete={() => onDeleteEntry(e.id)}
                  onHoursChange={(delta) => onHoursChange(e.id, delta)}
                  themeColors={themeColors}
                  isDark={isDark}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Yearly View ────────────────────────────────────────────────────────────────

interface YearlyViewProps {
  year: number;
  entries: WorkEntry[];
  selectedMembers: string[];
  canEditEntry: (e: WorkEntry) => boolean;
  selectedEntryId?: string;
  onAddEntry: (date: string) => void;
  onEditEntry: (e: WorkEntry) => void;
  onDeleteEntry: (id: string) => void;
  onHoursChange: (entryId: string, delta: number) => void;
  themeColors: any;
  isDark: boolean;
}

const YearlyView: React.FC<YearlyViewProps> = ({
  year,
  entries,
  selectedMembers,
  canEditEntry,
  selectedEntryId,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onHoursChange,
  themeColors,
  isDark,
}) => {
  const t = useLanguage();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const MONTH_NAMES = Array.from({ length: 12 }, (_, m) =>
    new Date(year, m, 1).toLocaleString(undefined, { month: 'long' })
  );

  const yearEntries = entries.filter(
    (e) =>
      e.date.startsWith(String(year)) &&
      (selectedMembers.length === 0 || selectedMembers.includes(e.memberId))
  );

  const totalHours = yearEntries.reduce((s, e) => s + (e.hours || 0), 0);

  const categoryTotals = (Object.keys(CATEGORIES) as WorkCategory[]).reduce(
    (acc, cat) => {
      acc[cat] = yearEntries.filter((e) => e.category === cat).length;
      return acc;
    },
    {} as Record<WorkCategory, number>
  );

  const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];

  const getMonthData = (m: number) => {
    const monthStr = `${year}-${String(m + 1).padStart(2, '0')}`;
    const mEntries = yearEntries.filter((e) => e.date.startsWith(monthStr));
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const activity = Array<number>(daysInMonth).fill(0);
    mEntries.forEach((e) => {
      const day = parseInt(e.date.split('-')[2]) - 1;
      if (day >= 0 && day < daysInMonth) activity[day]++;
    });
    const maxAct = Math.max(...activity, 1);
    return { mEntries, activity, maxAct, daysInMonth };
  };

  const selectedDateEntries = selectedDate
    ? entries.filter((e) => e.date === selectedDate && (selectedMembers.length === 0 || selectedMembers.includes(e.memberId)))
    : [];

  return (
    <div className="flex gap-3 h-full overflow-hidden">
      {/* 왼쪽: 연간 콘텐츠 */}
      <div className="flex flex-col flex-1 min-w-0 overflow-auto scroll-area gap-4">
      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: t('totalWorkLabel'), value: `${yearEntries.length}${t('count')}`, color: themeColors.primary },
          {
            label: t('totalHoursLabel'),
            value: `${totalHours}h`,
            color: '#8B5CF6',
          },
          {
            label: t('mostCommonType'),
            value: topCategory
              ? `${t(CAT_LABEL_KEYS[topCategory[0] as WorkCategory])} (${topCategory[1]}${t('count')})`
              : '-',
            color: '#F59E0B',
          },
          {
            label: t('monthlyAverage'),
            value: `${Math.round(yearEntries.length / 12)}${t('count')}`,
            color: '#10B981',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-3 rounded"
            style={{
              backgroundColor: themeColors.surface,
              border: `1px solid ${themeColors.border}`,
            }}
          >
            <p
              className="text-[11px] font-medium mb-1"
              style={{ color: themeColors.textSecondary }}
            >
              {stat.label}
            </p>
            <p className="text-base font-bold" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {yearEntries.length > 0 && (
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          {(Object.keys(CATEGORIES) as WorkCategory[])
            .filter((cat) => categoryTotals[cat] > 0)
            .map((cat) => {
              const pct = Math.round((categoryTotals[cat] / yearEntries.length) * 100);
              return (
                <div
                  key={cat}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded"
                  style={{
                    backgroundColor: `${CATEGORIES[cat].color}14`,
                    border: `1px solid ${CATEGORIES[cat].color}35`,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORIES[cat].color }}
                  />
                  <span className="text-xs font-medium" style={{ color: CATEGORIES[cat].color }}>
                    {t(CAT_LABEL_KEYS[cat])}
                  </span>
                  <span className="text-xs" style={{ color: themeColors.textSecondary }}>
                    {categoryTotals[cat]}{t('count')} ({pct}%)
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* 12-month grid */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0 pb-2">
        {MONTH_NAMES.map((mName, m) => {
          const { mEntries, activity, maxAct, daysInMonth } = getMonthData(m);
          const isCurrentMonth =
            new Date().getFullYear() === year && new Date().getMonth() === m;

          return (
            <div
              key={m}
              className="p-3 rounded flex flex-col gap-2"
              style={{
                backgroundColor: themeColors.surface,
                border: `1px solid ${
                  isCurrentMonth ? themeColors.primary + '55' : themeColors.border
                }`,
              }}
            >
              {/* Month header */}
              <div className="flex items-center justify-between">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: isCurrentMonth ? themeColors.primary : themeColors.text,
                  }}
                >
                  {mName}
                </p>
                <span
                  className="text-[11px]"
                  style={{ color: themeColors.textSecondary }}
                >
                  {mEntries.length}{t('count')}
                  {mEntries.length > 0 &&
                    ` · ${mEntries.reduce((s, e) => s + (e.hours || 0), 0)}h`}
                </span>
              </div>

              {/* Heatmap dots */}
              <div className="flex flex-wrap gap-0.5">
                {activity.map((count, d) => {
                  const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
                  const opacity = count === 0
                    ? 1
                    : Math.round(40 + (count / maxAct) * 200);
                  return (
                    <div
                      key={d}
                      title={new Date(year, m, d + 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + `: ${count}${t('count')}`}
                      className="w-3 h-3 rounded-sm cursor-pointer transition-all hover:scale-110"
                      style={{
                        backgroundColor:
                          count === 0
                            ? isDark
                              ? 'rgba(255,255,255,0.07)'
                              : 'rgba(0,0,0,0.07)'
                            : `${themeColors.primary}${opacity.toString(16).padStart(2, '0')}`,
                        outline: selectedDate === dateStr ? `2px solid ${themeColors.primary}` : 'none',
                        outlineOffset: '1px',
                      }}
                      onClick={() => {
                        if (count > 0) setSelectedDate(selectedDate === dateStr ? null : dateStr);
                        else onAddEntry(dateStr);
                      }}
                    />
                  );
                })}
              </div>

              {/* Category bar */}
              {mEntries.length > 0 && (
                <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                  {(Object.keys(CATEGORIES) as WorkCategory[]).map((cat) => {
                    const n = mEntries.filter((e) => e.category === cat).length;
                    if (!n) return null;
                    return (
                      <div
                        key={cat}
                        style={{ flex: n, backgroundColor: CATEGORIES[cat].color }}
                        title={`${t(CAT_LABEL_KEYS[cat])}: ${n}${t('count')}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>{/* end 왼쪽 콘텐츠 */}

      {/* 오른쪽: 날짜 선택 사이드 패널 */}
      {selectedDate && (
        <div
          className="flex-shrink-0 flex flex-col overflow-hidden rounded"
          style={{
            width: '15rem',
            border: `1px solid ${themeColors.border}`,
            backgroundColor: themeColors.surface,
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
            style={{ borderBottom: `1px solid ${themeColors.border}` }}
          >
            <div>
              <p className="text-xs font-semibold" style={{ color: themeColors.text }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'short' })}
              </p>
              <p className="text-[11px]" style={{ color: themeColors.textSecondary }}>
                {t('itemCount', { count: selectedDateEntries.length })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAddEntry(selectedDate)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: `${themeColors.primary}15`, color: themeColors.primary }}
              >
                <Plus size={11} />{t('add')}
              </button>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 rounded hover:opacity-70 transition-opacity"
                style={{ color: themeColors.textSecondary }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scroll-area">
            {selectedDateEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <p className="text-xs mb-2" style={{ color: themeColors.textSecondary }}>{t('noWorkEntries')}</p>
                <button
                  onClick={() => onAddEntry(selectedDate)}
                  className="text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: themeColors.primary }}
                >
                  + {t('workAdd')}
                </button>
              </div>
            ) : (
              selectedDateEntries.map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  isSelected={e.id === selectedEntryId}
                  canEdit={canEditEntry(e)}
                  showAuthor={selectedMembers.length !== 1}
                  onEdit={() => onEditEntry(e)}
                  onDelete={() => onDeleteEntry(e.id)}
                  onHoursChange={(delta) => onHoursChange(e.id, delta)}
                  themeColors={themeColors}
                  isDark={isDark}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const WeeklyReport: React.FC = () => {
  const theme = useSettingsStore((s) => s.settings.theme);
  const themeColors = themeConfigs[theme];
  const isDark = theme !== 'light';
  const t = useLanguage();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const { entries, addEntry, updateEntry, deleteEntry } = useWorkReportStore();
  const isAdmin = isAdminAccount(user);
  const canEditEntry = useCallback((entry: WorkEntry) =>
    isAdmin || entry.memberId === user?.id,
    [isAdmin, user?.id]
  );

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<WorkCategory[]>(Object.keys(CATEGORIES) as WorkCategory[]);
  const [apiMembers, setApiMembers] = useState<{ id: string; name: string }[]>([]);
  const [memberMenuOpen, setMemberMenuOpen] = useState(false);
  const memberBtnRef = useRef<HTMLButtonElement>(null);
  const memberMenuRef = useRef<HTMLDivElement>(null);
  const [memberMenuPos, setMemberMenuPos] = useState<{ top: number; left: number } | null>(null);

  // 사용자 관리에 등록된 모든 사용자 로드
  useEffect(() => {
    if (!token) return;
    fetch(import.meta.env.VITE_API_URL + '/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setApiMembers(data.map((u: any) => ({ id: String(u.id), name: u.name })));
      })
      .catch(() => {});
  }, [token]);

  // 멤버 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        memberMenuRef.current && !memberMenuRef.current.contains(e.target as Node) &&
        memberBtnRef.current && !memberBtnRef.current.contains(e.target as Node)
      ) {
        setMemberMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // 전체 멤버: API 사용자 + 항목에 있는 사용자 병합
  const allMembers = useMemo(() => {
    const map = new Map<string, string>();
    if (user?.id && user?.name) map.set(user.id, user.name);
    apiMembers.forEach((m) => map.set(m.id, m.name));
    entries.forEach((e) => { if (e.memberId && e.memberName) map.set(e.memberId, e.memberName); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [entries, user, apiMembers]);

  // 카테고리 필터 적용된 항목 (sub-components에 전달)
  const displayEntries = useMemo(
    () => entries.filter(e => selectedCategories.includes(e.category)),
    [entries, selectedCategories]
  );

  const [modalState, setModalState] = useState<{
    open: boolean;
    date?: string;
    entry?: WorkEntry;
    canEdit?: boolean;
  }>({ open: false });

  const weekStart = getMondayOf(currentDate);
  const weekEnd = addDays(weekStart, 6);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const { weekNum: weekOfMonth, displayMonth, displayYear } = getWeekOfMonth(weekStart);

  const navLabel = useMemo(() => {
    if (viewMode === 'week') {
      return t('navWeekLabel', { year: displayYear, month: displayMonth + 1, week: weekOfMonth });
    }
    if (viewMode === 'month') return t('navMonthLabel', { year, month: month + 1 });
    return t('navYearLabel', { year });
  }, [viewMode, displayYear, displayMonth, weekOfMonth, year, month, t]);

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((prev) => {
      if (viewMode === 'week') return addDays(prev, 7 * dir);
      if (viewMode === 'month') return new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
      return new Date(prev.getFullYear() + dir, prev.getMonth(), 1);
    });
  };

  const handleAutoSave = useCallback((entry: WorkEntry, isNew: boolean) => {
    if (isNew) {
      addEntry({ ...entry, createdAt: new Date().toISOString() });
    } else {
      updateEntry(entry.id, entry, user ? { id: user.id, name: user.name } : undefined);
    }
  }, [addEntry, updateEntry, user]);

  const handleDeleteEntry = (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (entry && !canEditEntry(entry)) return; // 권한 없으면 무시
    deleteEntry(id);
    toast.success(t('workDeleted'));
  };

  const handleHoursChange = useCallback((entryId: string, delta: number) => {
    const e = entries.find((x) => x.id === entryId);
    if (!e) return;
    const newHours = Math.max(0, Math.round((e.hours + delta) * 2) / 2);
    updateEntry(entryId, { hours: newHours });
  }, [entries, updateEntry]);

  const selectedEntryId = modalState.entry?.id;

  const openAddModal = (date: string) => setModalState({ open: true, date });
  const openEditModal = (entry: WorkEntry) => setModalState({ open: true, entry, canEdit: canEditEntry(entry) });
  const closeModal = () => setModalState({ open: false });

  const viewBtnActive: React.CSSProperties = {
    backgroundColor: themeColors.primary,
    color: theme === 'yellow' ? '#333' : '#fff',
    fontWeight: 600,
  };
  const viewBtnInactive: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: themeColors.textSecondary,
    fontWeight: 400,
  };

  // 현재 기간 업무 수
  const periodCount = (() => {
    const base = selectedMembers.length === 0 ? displayEntries : displayEntries.filter((e) => selectedMembers.includes(e.memberId));
    if (viewMode === 'week') {
      const ws = toDateStr(weekStart); const we = toDateStr(weekEnd);
      return base.filter((e) => e.date >= ws && e.date <= we).length;
    }
    if (viewMode === 'month') return base.filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
    return base.filter((e) => e.date.startsWith(String(year))).length;
  })();

  const sep = (
    <span style={{ width: '1px', height: '16px', backgroundColor: themeColors.border, flexShrink: 0, opacity: 0.7 }} />
  );
  const hoverStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Control Bar ── */}
      <div
        className="flex items-center gap-0 flex-shrink-0 flex-wrap"
        style={{
          padding: '6px 0 10px',
          borderBottom: `1px solid ${themeColors.border}`,
          marginBottom: '10px',
          gap: '6px',
        }}
      >
        {/* ─ 뷰 토글 ─ */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.05)',
            borderRadius: '6px',
            padding: '2px',
            gap: '1px',
          }}
        >
          {(['week', 'month', 'year'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className="transition-all"
              style={{
                padding: '4px 14px',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                fontWeight: viewMode === v ? 600 : 400,
                backgroundColor: viewMode === v ? themeColors.primary : 'transparent',
                color: viewMode === v ? (theme === 'yellow' ? '#333' : '#fff') : themeColors.textSecondary,
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              {v === 'week' ? t('viewWeekly') : v === 'month' ? t('viewMonthly') : t('viewYearly')}
            </button>
          ))}
        </div>

        {sep}

        {/* ─ 기간 내비게이션 ─ */}
        <div className="flex items-center flex-shrink-0" style={{ gap: '2px' }}>
          {[[-1, ChevronLeft], [1, ChevronRight]].map(([dir, Icon], i) => (
            i === 0 ? (
              <button
                key="prev"
                onClick={() => navigate(-1)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverStyle)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ChevronLeft size={15} />
              </button>
            ) : (
              <button
                key="next"
                onClick={() => navigate(1)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverStyle)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ChevronRight size={15} />
              </button>
            )
          ))}
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: themeColors.text,
              minWidth: '200px',
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}
          >
            {navLabel}
          </span>
          <button
            key="next2"
            onClick={() => navigate(1)}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => setCurrentDate(new Date())}
            style={{
              padding: '3px 10px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 500,
              border: `1px solid ${themeColors.border}`,
              background: 'transparent',
              cursor: 'pointer',
              color: themeColors.textSecondary,
              marginLeft: '2px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = themeColors.primary;
              e.currentTarget.style.color = themeColors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = themeColors.border;
              e.currentTarget.style.color = themeColors.textSecondary;
            }}
          >
            {t('today')}
          </button>
        </div>

        {sep}

        {/* ─ 멤버 필터 ─ */}
        {allMembers.length > 1 && (
          <>
            <button
              ref={memberBtnRef}
              onClick={() => {
                const next = !memberMenuOpen;
                if (next && memberBtnRef.current) {
                  const rect = memberBtnRef.current.getBoundingClientRect();
                  setMemberMenuPos({ top: rect.bottom + 6, left: rect.left });
                }
                setMemberMenuOpen(next);
              }}
              className="flex items-center gap-1.5 flex-shrink-0 transition-all"
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: `1px solid ${selectedMembers.length > 0 ? themeColors.primary : themeColors.border}`,
                color: selectedMembers.length > 0 ? themeColors.primary : themeColors.textSecondary,
                backgroundColor: selectedMembers.length > 0 ? `${themeColors.primary}12` : 'transparent',
                fontSize: '0.8125rem',
                fontWeight: selectedMembers.length > 0 ? 600 : 400,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { if (selectedMembers.length === 0) e.currentTarget.style.backgroundColor = hoverStyle; }}
              onMouseLeave={(e) => { if (selectedMembers.length === 0) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <User size={12} />
              <span>{selectedMembers.length === 0 ? t('allMembers') : t('memberCountLabel', { count: selectedMembers.length })}</span>
              <ChevronDown size={11} style={{ opacity: 0.6 }} />
            </button>

            {memberMenuOpen && memberMenuPos && (
              <div
                ref={memberMenuRef}
                style={{
                  position: 'fixed',
                  top: memberMenuPos.top,
                  left: memberMenuPos.left,
                  zIndex: 9999,
                  backgroundColor: themeColors.surface,
                  border: `1px solid ${themeColors.border}`,
                  borderRadius: '8px',
                  minWidth: '188px',
                  boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.5)' : '0 8px 28px rgba(0,0,0,0.13)',
                  overflow: 'hidden',
                }}
              >
                {/* 드롭다운 헤더 */}
                <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${themeColors.border}` }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('memberFilter')}</span>
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }} className="py-1">
                  <button
                    onClick={() => { setSelectedMembers([]); setMemberMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-all text-left"
                    style={{ color: selectedMembers.length === 0 ? themeColors.primary : themeColors.text, backgroundColor: selectedMembers.length === 0 ? `${themeColors.primary}0E` : 'transparent' }}
                    onMouseEnter={(e) => { if (selectedMembers.length > 0) e.currentTarget.style.backgroundColor = hoverStyle; }}
                    onMouseLeave={(e) => { if (selectedMembers.length > 0) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center"
                      style={{ borderColor: selectedMembers.length === 0 ? themeColors.primary : themeColors.border, backgroundColor: selectedMembers.length === 0 ? themeColors.primary : 'transparent', color: '#fff', fontSize: '9px' }}>
                      {selectedMembers.length === 0 ? '✓' : ''}
                    </span>
                    <span style={{ fontWeight: selectedMembers.length === 0 ? 600 : 400 }}>{t('all')}</span>
                  </button>
                  {allMembers.map((m) => {
                    const isChecked = selectedMembers.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMembers(prev => isChecked ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-all text-left"
                        style={{ color: isChecked ? themeColors.primary : themeColors.text, backgroundColor: isChecked ? `${themeColors.primary}0E` : 'transparent' }}
                        onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.backgroundColor = hoverStyle; }}
                        onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center"
                          style={{ borderColor: isChecked ? themeColors.primary : themeColors.border, backgroundColor: isChecked ? themeColors.primary : 'transparent', color: '#fff', fontSize: '9px' }}>
                          {isChecked ? '✓' : ''}
                        </span>
                        <img src={getAvatarUrl(m.id)} alt={m.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <span style={{ fontWeight: isChecked ? 600 : 400 }}>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {sep}

        {/* ─ 카테고리 필터 칩 ─ */}
        <div className="hidden lg:flex items-center flex-shrink-0" style={{ gap: '3px', flexWrap: 'wrap' }}>
          {(Object.keys(CATEGORIES) as WorkCategory[]).map((cat) => {
            const isActive = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategories(prev => isActive ? prev.filter(c => c !== cat) : [...prev, cat])}
                className="flex items-center transition-all"
                style={{
                  gap: '5px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  border: `1px solid ${isActive ? CATEGORIES[cat].color + '60' : themeColors.border}`,
                  backgroundColor: isActive ? `${CATEGORIES[cat].color}18` : 'transparent',
                  color: isActive ? CATEGORIES[cat].color : themeColors.textSecondary,
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.75,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = hoverStyle;
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.borderColor = `${CATEGORIES[cat].color}40`;
                    e.currentTarget.style.color = CATEGORIES[cat].color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.opacity = '0.75';
                    e.currentTarget.style.borderColor = themeColors.border;
                    e.currentTarget.style.color = themeColors.textSecondary;
                  }
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: CATEGORIES[cat].color, flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                {t(CAT_LABEL_KEYS[cat])}
              </button>
            );
          })}
          <button
            onClick={() => { setSelectedCategories(Object.keys(CATEGORIES) as WorkCategory[]); setSelectedMembers([]); }}
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 400,
              border: `1px solid transparent`,
              background: 'transparent',
              cursor: 'pointer',
              color: themeColors.textSecondary,
              opacity: 0.65,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverStyle; e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = themeColors.border; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '0.65'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            {t('reset')}
          </button>
        </div>

        <div className="flex-1" />

        {/* ─ 기간 통계 ─ */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            gap: '5px',
            padding: '3px 10px',
            borderRadius: '4px',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(55,53,47,0.04)',
            border: `1px solid ${themeColors.border}`,
          }}
        >
          <BarChart2 size={12} style={{ color: themeColors.textSecondary, opacity: 0.7 }} />
          <span style={{ fontSize: '0.8125rem', color: themeColors.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {periodCount}
          </span>
          <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, opacity: 0.7 }}>{t('count')}</span>
        </div>

        {/* ─ 업무 추가 버튼 ─ */}
        <button
          onClick={() => openAddModal(toDateStr(new Date()))}
          className="flex items-center flex-shrink-0 transition-opacity hover:opacity-85"
          style={{
            gap: '6px',
            padding: '5px 14px',
            borderRadius: '4px',
            backgroundColor: themeColors.primary,
            color: theme === 'yellow' ? '#333' : '#fff',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          <Plus size={13} />
          <span>{t('workAdd')}</span>
        </button>
      </div>

      {/* ── Main View ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'week' && (
          <WeeklyView
            weekStart={weekStart}
            entries={displayEntries}
            selectedMembers={selectedMembers}
            selectedEntryId={selectedEntryId}
            canEditEntry={canEditEntry}
            onAddEntry={openAddModal}
            onEditEntry={openEditModal}
            onDeleteEntry={handleDeleteEntry}
            onHoursChange={handleHoursChange}
            themeColors={themeColors}
            isDark={isDark}
          />
        )}
        {viewMode === 'month' && (
          <MonthlyView
            year={year}
            month={month}
            entries={displayEntries}
            selectedMembers={selectedMembers}
            selectedEntryId={selectedEntryId}
            canEditEntry={canEditEntry}
            onAddEntry={openAddModal}
            onEditEntry={openEditModal}
            onDeleteEntry={handleDeleteEntry}
            onHoursChange={handleHoursChange}
            themeColors={themeColors}
            isDark={isDark}
          />
        )}
        {viewMode === 'year' && (
          <YearlyView
            year={year}
            entries={displayEntries}
            selectedMembers={selectedMembers}
            canEditEntry={canEditEntry}
            selectedEntryId={selectedEntryId}
            onAddEntry={openAddModal}
            onEditEntry={openEditModal}
            onDeleteEntry={handleDeleteEntry}
            onHoursChange={handleHoursChange}
            themeColors={themeColors}
            isDark={isDark}
          />
        )}
      </div>

      {/* ── Entry Modal ── */}
      {modalState.open && (
        <EntryModal
          date={modalState.date}
          entry={modalState.entry}
          canEdit={modalState.canEdit ?? true}
          onAutoSave={handleAutoSave}
          onClose={closeModal}
          onDelete={handleDeleteEntry}
          themeColors={themeColors}
          isDark={isDark}
          user={user}
        />
      )}
    </div>
  );
};

export default WeeklyReport;
