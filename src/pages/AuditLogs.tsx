import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, ChevronDown,
  Plus, Trash2, Edit2, Save, X, Lock, RefreshCw,
  LayoutList, BarChart2, Check, Globe,
  FileDown, Settings2,
} from 'lucide-react';
import { useColumnConfig } from '../hooks/useColumnConfig';
import type { ColumnDef } from '../hooks/useColumnConfig';
import { computeAggregations, computeMergeSpans, fmtAggLabel } from '../utils/gridUtils';
import ColumnConfigPanel from '../components/common/ColumnConfigPanel';
import { useAuditLogStore } from '../store/auditLogStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import ProtectedComponent from '../components/ProtectedComponent';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useReportTemplateStore } from '../store/reportTemplateStore';
import type { ReportTemplate, TemplateColumn, TemplateAggregation } from '../store/reportTemplateStore';
import { useToast } from '../hooks/useToast';
import * as XLSX from 'xlsx';
import type { AuditLog } from '../types';

// 집계 결과 타입 (computeAggregations 반환)
type AggregationResult = TemplateAggregation & { data: [string, number][] };

// ── 로그 컬럼 정의 (useColumnConfig 에 전달) ────────────────────────────────
const AUDIT_COL_DEFS: ColumnDef[] = [
  { key: 'timestamp',    label: '시간',        type: 'date',   always: true },
  { key: 'userName',     label: '사용자',       type: 'string', mergeable: true },
  { key: 'action',       label: '작업',         type: 'string', mergeable: true },
  { key: 'resourceType', label: '리소스 유형',  type: 'string', mergeable: true },
  { key: 'resourceName', label: '리소스명',     type: 'string' },
  { key: 'details',      label: '상세',         type: 'string' },
  { key: 'ipAddress',    label: 'IP 주소',      type: 'string', mergeable: true },
  { key: 'userId',       label: '사용자 ID',    type: 'string' },
  { key: 'resourceId',   label: '리소스 ID',    type: 'string' },
  { key: 'userAgent',    label: 'User Agent',  type: 'string' },
];

// DEFAULT_SELECTED_KEYS는 useColumnConfig 초기값으로 대체됨

const ACTION_OPTIONS = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'DOWNLOAD', 'UPLOAD'];
const RESOURCE_OPTIONS = ['USER', 'COMPANY', 'MAINTENANCE', 'PROJECT', 'FILE', 'SYSTEM', 'TASK', 'ISSUE'];

// ── 액션 배지 색상 ────────────────────────────────────────────────────────────
const actionColor = (action: string, isDark: boolean) => {
  const map: Record<string, { bg: string; text: string }> = {
    LOGIN:    { bg: isDark ? '#1A3A1A' : '#D3EDDA', text: isDark ? '#6DC47A' : '#1D6A35' },
    LOGOUT:   { bg: isDark ? '#2B2B2B' : '#E3E2E0', text: isDark ? '#999898' : '#787774' },
    CREATE:   { bg: isDark ? '#0D2A4A' : '#D3E5EF', text: isDark ? '#5AAFCC' : '#0B6E99' },
    UPDATE:   { bg: isDark ? '#2D2040' : '#EAE4F2', text: isDark ? '#A98ED6' : '#6940A5' },
    DELETE:   { bg: isDark ? '#3D1A1A' : '#FFE2DC', text: isDark ? '#E07070' : '#C0392B' },
    VIEW:     { bg: isDark ? '#1A2A3A' : '#E8F1FB', text: isDark ? '#7AB2E8' : '#2563EB' },
    DOWNLOAD: { bg: isDark ? '#2A1A3D' : '#F0E8FF', text: isDark ? '#C084FC' : '#7C3AED' },
    UPLOAD:   { bg: isDark ? '#1A2D1A' : '#D1FAE5', text: isDark ? '#34D399' : '#059669' },
  };
  return map[action] || { bg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.08)', text: isDark ? '#999' : '#555' };
};

const fmtDate = (d: any) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
};

const getCellValue = (log: AuditLog, key: string): string => {
  switch (key) {
    case 'timestamp':    return fmtDate(log.timestamp);
    case 'userName':     return log.userName || '';
    case 'userId':       return log.userId || '';
    case 'action':       return log.action || '';
    case 'resourceType': return log.resourceType || '';
    case 'resourceName': return log.resourceName || '';
    case 'resourceId':   return log.resourceId || '';
    case 'details':      return log.details || '';
    case 'ipAddress':    return log.ipAddress || '';
    case 'userAgent':    return log.userAgent || '';
    default:             return '';
  }
};

// ※ computeAggregations は gridUtils から import

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
const AuditLogs: React.FC = () => {
  const theme = useSettingsStore(s => s.settings.theme);
  const themeColors = themeConfigs[theme];
  const isDark = theme !== 'light';
  const { user } = useAuthStore();
  const { logs, loading, fetchLogs } = useAuditLogStore();
  const { templates, fetchTemplates, createTemplate, updateTemplate, deleteTemplate } = useReportTemplateStore();
  const toast = useToast();
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(55,53,47,0.04)';

  // ── 필터 state ──────────────────────────────────────────────────────────────
  const [filterUser,     setFilterUser]     = useState('');
  const [filterAction,   setFilterAction]   = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [filterText,     setFilterText]     = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');

  // ── Dynamic Column Mapper (useColumnConfig 훅) ──────────────────────────────
  const {
    columns: colConfigs, visibleColumns,
    toggleVisible, reorder, setAggregation, toggleMerge, reset: resetCols,
    applyFromTemplate,
  } = useColumnConfig('audit_logs', AUDIT_COL_DEFS);
  const [showColConfig, setShowColConfig] = useState(false);

  // ── 템플릿 state ────────────────────────────────────────────────────────────
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateSearch,   setTemplateSearch]   = useState('');
  const [showSaveModal,    setShowSaveModal]     = useState(false);
  const [editingTemplate,  setEditingTemplate]   = useState<ReportTemplate | null>(null);
  const [saveName,         setSaveName]          = useState('');
  const [saveDesc,         setSaveDesc]          = useState('');
  const [saveShared,       setSaveShared]        = useState(false);
  const [isSaving,         setIsSaving]          = useState(false);

  // ── 페이지네이션 ─────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // ── 초기 로드 ───────────────────────────────────────────────────────────────
  useEffect(() => { fetchLogs(); fetchTemplates(); }, []);

  // ── 필터 적용 ───────────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterUser     && !log.userName?.toLowerCase().includes(filterUser.toLowerCase())) return false;
      if (filterAction   && log.action !== filterAction) return false;
      if (filterResource && log.resourceType !== filterResource) return false;
      if (filterText && !(
        log.details?.toLowerCase().includes(filterText.toLowerCase()) ||
        log.resourceName?.toLowerCase().includes(filterText.toLowerCase())
      )) return false;
      if (filterDateFrom) {
        const from = new Date(filterDateFrom + 'T00:00:00');
        if (new Date(log.timestamp) < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo + 'T23:59:59');
        if (new Date(log.timestamp) > to) return false;
      }
      return true;
    });
  }, [logs, filterUser, filterAction, filterResource, filterText, filterDateFrom, filterDateTo]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const pagedLogs  = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Aggregation Engine — 필터된 전체 행 기준으로 계산 (Memoization) ──────────
  const aggResults = useMemo(
    () => computeAggregations(filteredLogs as any[], colConfigs),
    [filteredLogs, colConfigs]
  );
  const headerAggs = useMemo(
    () => Object.entries(aggResults).filter(([, v]) => v.placement === 'header'),
    [aggResults]
  );
  const footerAggs = useMemo(
    () => Object.entries(aggResults).filter(([, v]) => v.placement === 'footer'),
    [aggResults]
  );

  // ── Smart Merging — 현재 페이지 행 기준 rowSpan 계산 (Memoization) ──────────
  const mergeSpans = useMemo(
    () => computeMergeSpans(pagedLogs as any[], colConfigs),
    [pagedLogs, colConfigs]
  );

  // ── 템플릿 불러오기 ──────────────────────────────────────────────────────────
  const loadTemplate = useCallback((tpl: ReportTemplate) => {
    setActiveTemplateId(tpl.id);
    // useColumnConfig 훅에 템플릿 컬럼/집계 일괄 적용
    applyFromTemplate(
      tpl.columns.map(c => ({ key: c.key, order: c.order })),
      tpl.aggregations.map(a => ({
        key: a.groupBy,
        fn: (a.metric as any) || 'COUNT',
        placement: 'footer' as const,
      }))
    );
    if (tpl.defaultFilters?.action)       setFilterAction(tpl.defaultFilters.action || '');
    if (tpl.defaultFilters?.resourceType) setFilterResource(tpl.defaultFilters.resourceType || '');
    setCurrentPage(1);
  }, [applyFromTemplate]);

  // ── 템플릿 저장 ──────────────────────────────────────────────────────────────
  const openSaveModal = (existing?: ReportTemplate) => {
    setEditingTemplate(existing || null);
    setSaveName(existing?.name || '');
    setSaveDesc(existing?.description || '');
    setSaveShared(existing?.isShared || false);
    setShowSaveModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) { toast.error('템플릿명을 입력해주세요.'); return; }
    setIsSaving(true);
    try {
      // visibleColumns → TemplateColumn 변환
      const cols: TemplateColumn[] = visibleColumns.map((c, i) => ({
        key: c.key, label: c.label, order: i,
      }));
      // colConfigs의 집계 정보 → TemplateAggregation 변환
      const aggs = colConfigs
        .filter(c => c.visible && c.aggregation)
        .map(c => ({ groupBy: c.key, metric: c.aggregation as any, label: fmtAggLabel(c.aggregation!) }));
      const payload = {
        name: saveName.trim(),
        description: saveDesc.trim(),
        isShared: saveShared,
        columns: cols,
        defaultFilters: { action: filterAction || null, resourceType: filterResource || null },
        aggregations: aggs,
      };
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload);
        toast.success('템플릿이 수정되었습니다.');
      } else {
        const created = await createTemplate(payload as any);
        setActiveTemplateId(created.id);
        toast.success('템플릿이 저장되었습니다.');
      }
      setShowSaveModal(false);
    } catch { toast.error('저장에 실패했습니다.'); }
    finally { setIsSaving(false); }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('이 템플릿을 삭제하시겠습니까?')) return;
    try {
      await deleteTemplate(id);
      if (activeTemplateId === id) setActiveTemplateId(null);
      toast.success('템플릿이 삭제되었습니다.');
    } catch { toast.error('삭제에 실패했습니다.'); }
  };

  // ── 엑셀 다운로드 (템플릿 컬럼 + 집계 블록 포함) ──────────────────────────────
  const handleExcelDownload = () => {
    const headers = visibleColumns.map(c => c.label);
    const dataRows = filteredLogs.map(log =>
      visibleColumns.map(c => getCellValue(log as AuditLog, c.key))
    );
    // 집계 블록
    const aggRows: string[][] = [];
    const allAggs = Object.entries(aggResults);
    if (allAggs.length > 0) {
      aggRows.push([]);
      aggRows.push(['[집계 요약]']);
      allAggs.forEach(([key, { fn, value, placement }]) => {
        const col = visibleColumns.find(c => c.key === key);
        aggRows.push([`${col?.label || key} (${fmtAggLabel(fn)}, ${placement === 'header' ? '상단' : '하단'})`, String(value)]);
      });
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, ...aggRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '로그 리포트');
    XLSX.writeFile(wb, `로그_리포트_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── (미사용 stub — 컬럼 설정은 ColumnConfigPanel에서 처리) ──────────────────
  const addAgg = (groupBy: string) => {
    setAggregation(groupBy, 'COUNT', 'footer');
  };

  // ── 필터 초기화 ──────────────────────────────────────────────────────────────
  const resetFilters = () => {
    setFilterUser(''); setFilterAction(''); setFilterResource('');
    setFilterText(''); setFilterDateFrom(''); setFilterDateTo('');
    setCurrentPage(1);
  };

  // ── 템플릿 분류 ──────────────────────────────────────────────────────────────
  const myUserId = user?.id || '';
  const filteredTpls = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase())
  );
  const myTemplates     = filteredTpls.filter(t => t.createdBy === myUserId && !t.isShared);
  const sharedTemplates = filteredTpls.filter(t => t.isShared);

  // ── 스타일 상수 ──────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: themeColors.surface,
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px',
  };
  const inputStyle: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(55,53,47,0.04)',
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px',
    color: themeColors.text,
    padding: '5px 9px',
    fontSize: '0.8125rem',
    outline: 'none',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
  const btnPrimary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '4px', border: 'none',
    backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff',
    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
  };
  const btnSecondary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '5px 10px', borderRadius: '4px',
    border: `1px solid ${themeColors.border}`, backgroundColor: 'transparent',
    color: themeColors.textSecondary, fontSize: '0.8125rem', cursor: 'pointer',
  };

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <ProtectedComponent permission="view_audit_logs">
      <div style={{ display: 'flex', gap: '12px', height: 'calc(100vh - 112px)', minHeight: 0 }}>

        {/* ══ 왼쪽: 템플릿 패널 ══ */}
        <div style={{ ...card, width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 헤더 */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${themeColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <LayoutList size={12} style={{ display: 'inline', marginRight: 5 }} />리포트 템플릿
            </span>
            <button style={{ ...btnPrimary, padding: '3px 8px', fontSize: '0.6875rem' }} onClick={() => openSaveModal()}>
              <Plus size={11} /> 새 템플릿
            </button>
          </div>

          {/* 템플릿 검색 */}
          <div style={{ padding: '8px 10px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: themeColors.textSecondary }} />
              <input
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="템플릿 검색..."
                style={{ ...inputStyle, width: '100%', paddingLeft: 24, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* 기본 조회 버튼 */}
          <div style={{ padding: '0 10px 6px', flexShrink: 0 }}>
            <button
              style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, backgroundColor: activeTemplateId === null ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.06)') : 'transparent', color: activeTemplateId === null ? themeColors.text : themeColors.textSecondary }}
              onClick={() => { setActiveTemplateId(null); resetCols(); }}
            >
              전체 로그 조회
            </button>
          </div>

          {/* 템플릿 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
            {/* 내 템플릿 */}
            {myTemplates.length > 0 && (
              <>
                <p style={{ fontSize: '0.625rem', fontWeight: 700, color: themeColors.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '8px 4px 4px' }}>
                  <Lock size={10} style={{ display: 'inline', marginRight: 4 }} />내 템플릿
                </p>
                {myTemplates.map(tpl => (
                  <TemplateItem key={tpl.id} tpl={tpl} active={activeTemplateId === tpl.id} isDark={isDark} themeColors={themeColors} hoverBg={hoverBg}
                    onLoad={loadTemplate} onEdit={() => openSaveModal(tpl)} onDelete={() => handleDeleteTemplate(tpl.id)} userId={myUserId} />
                ))}
              </>
            )}
            {/* 공용 템플릿 */}
            {sharedTemplates.length > 0 && (
              <>
                <p style={{ fontSize: '0.625rem', fontWeight: 700, color: themeColors.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '10px 4px 4px' }}>
                  <Globe size={10} style={{ display: 'inline', marginRight: 4 }} />공용 템플릿
                </p>
                {sharedTemplates.map(tpl => (
                  <TemplateItem key={tpl.id} tpl={tpl} active={activeTemplateId === tpl.id} isDark={isDark} themeColors={themeColors} hoverBg={hoverBg}
                    onLoad={loadTemplate} onEdit={() => openSaveModal(tpl)} onDelete={() => handleDeleteTemplate(tpl.id)} userId={myUserId} />
                ))}
              </>
            )}
            {filteredTpls.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: themeColors.textSecondary, textAlign: 'center', marginTop: 16, opacity: 0.5 }}>
                템플릿이 없습니다
              </p>
            )}
          </div>
        </div>

        {/* ══ 오른쪽: 메인 영역 ══ */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>

          {/* 필터 바 */}
          <div style={{ ...card, padding: '12px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, flexShrink: 0 }}>필터</span>
              {/* 날짜 */}
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...inputStyle, fontSize: '0.75rem' }} />
              <span style={{ color: themeColors.textSecondary, fontSize: '0.75rem' }}>~</span>
              <input type="date" value={filterDateTo}   onChange={e => setFilterDateTo(e.target.value)}   style={{ ...inputStyle, fontSize: '0.75rem' }} />
              {/* 사용자 */}
              <input placeholder="사용자명" value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ ...inputStyle, width: '100px', fontSize: '0.75rem' }} />
              {/* 작업 */}
              <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ ...selectStyle, fontSize: '0.75rem' }}>
                <option value="">모든 작업</option>
                {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {/* 리소스 */}
              <select value={filterResource} onChange={e => setFilterResource(e.target.value)} style={{ ...selectStyle, fontSize: '0.75rem' }}>
                <option value="">모든 유형</option>
                {RESOURCE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {/* 텍스트 검색 */}
              <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: themeColors.textSecondary }} />
                <input placeholder="상세 검색..." value={filterText} onChange={e => setFilterText(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 26, boxSizing: 'border-box', fontSize: '0.75rem' }} />
              </div>
              <button style={{ ...btnSecondary, fontSize: '0.75rem', padding: '4px 8px' }} onClick={resetFilters}><X size={11} /> 초기화</button>
              <button style={{ ...btnSecondary, fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => fetchLogs()}><RefreshCw size={11} /> 새로고침</button>
            </div>
          </div>

          {/* ── 헤더 집계 요약 (상단 배치 집계) ────────────────────────────── */}
          {headerAggs.length > 0 && (
            <div style={{ ...card, padding: '8px 14px', flexShrink: 0, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: themeColors.textSecondary, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <BarChart2 size={11} style={{ display: 'inline', marginRight: 4 }} />집계 (상단)
              </span>
              {headerAggs.map(([key, { fn, value }]) => {
                const col = visibleColumns.find(c => c.key === key);
                return (
                  <div key={key} style={{ padding: '4px 12px', borderRadius: '99px', backgroundColor: `${themeColors.primary}15`, fontSize: '0.75rem', fontWeight: 600, color: themeColors.primary }}>
                    {col?.label} {fmtAggLabel(fn)}: <strong>{value}</strong>
                  </div>
                );
              })}
            </div>
          )}

          {/* 결과 테이블 */}
          <div style={{ ...card, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 테이블 헤더 바 */}
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${themeColors.border}`, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text }}>
                결과 <span style={{ fontSize: '0.75rem', color: themeColors.primary, fontWeight: 700 }}>{filteredLogs.length.toLocaleString()}건</span>
              </span>
              {/* 컬럼 설정 버튼 */}
              <button
                style={{ ...btnSecondary, fontSize: '0.75rem', padding: '3px 8px', ...(showColConfig ? { borderColor: themeColors.primary, color: themeColors.primary } : {}) }}
                onClick={() => setShowColConfig(true)}
              >
                <Settings2 size={12} /> 컬럼 설정 ({visibleColumns.length})
              </button>
              {activeTemplateId && (
                <button style={{ ...btnSecondary, fontSize: '0.75rem', padding: '3px 8px' }} onClick={() => openSaveModal(templates.find(t => t.id === activeTemplateId))}>
                  <Save size={11} /> 템플릿 수정
                </button>
              )}
              <button style={{ ...btnSecondary, fontSize: '0.75rem', padding: '3px 8px' }} onClick={() => openSaveModal()}>
                <Save size={11} /> 저장
              </button>
              <button style={{ ...btnPrimary, fontSize: '0.75rem', padding: '4px 10px', marginLeft: 'auto' }} onClick={handleExcelDownload}>
                <FileDown size={13} /> 엑셀 다운로드
              </button>
            </div>

            {/* 테이블 본문 */}
            {loading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner message="로그 조회 중..." />
              </div>
            ) : (
              <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${visibleColumns.length * 120}px` }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr style={{ backgroundColor: isDark ? '#1D2229' : '#F7F6F3', borderBottom: `1px solid ${themeColors.border}` }}>
                      {visibleColumns.map(col => (
                        <th key={col.key} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '32px', color: themeColors.textSecondary, fontSize: '0.875rem' }}>
                          조회된 로그가 없습니다.
                        </td>
                      </tr>
                    ) : pagedLogs.map((log, ri) => (
                      <tr key={log.id}
                        style={{ borderBottom: `1px solid ${themeColors.border}`, backgroundColor: ri % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(55,53,47,0.015)') }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = ri % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(55,53,47,0.015)'))}
                      >
                        {visibleColumns.map((col, ci) => {
                          const span = mergeSpans[ri]?.[ci] ?? 1;
                          if (span === 0) return null; // 스마트 병합: 숨김 셀
                          return (
                            <td key={col.key} rowSpan={span > 1 ? span : undefined}
                              style={{ padding: '7px 12px', fontSize: '0.8125rem', color: themeColors.text, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: span > 1 ? 'top' : undefined }}>
                              {col.key === 'action' ? (
                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, ...actionColor(log.action, isDark) }}>
                                  {log.action}
                                </span>
                              ) : col.key === 'resourceType' ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.6875rem', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.08)', color: themeColors.textSecondary }}>
                                  {getCellValue(log, col.key)}
                                </span>
                              ) : (
                                <span title={getCellValue(log, col.key)}>{getCellValue(log, col.key)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  {/* 푸터 집계 행 */}
                  {footerAggs.length > 0 && (
                    <tfoot>
                      <tr style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(55,53,47,0.04)', borderTop: `2px solid ${themeColors.border}` }}>
                        {visibleColumns.map((col, ci) => {
                          const agg = footerAggs.find(([key]) => key === col.key);
                          return (
                            <td key={col.key} style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, color: agg ? themeColors.primary : themeColors.textSecondary }}>
                              {agg ? `${fmtAggLabel(agg[1].fn)}: ${agg[1].value}` : (ci === 0 ? '집계' : '')}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div style={{ padding: '8px 14px', borderTop: `1px solid ${themeColors.border}`, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexShrink: 0 }}>
                <button style={{ ...btnSecondary, padding: '3px 8px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>《</button>
                <button style={{ ...btnSecondary, padding: '3px 8px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  return (
                    <button key={p} style={{ ...btnSecondary, padding: '3px 9px', ...(p === currentPage ? { backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', borderColor: themeColors.primary } : {}) }} onClick={() => setCurrentPage(p)}>{p}</button>
                  );
                })}
                <button style={{ ...btnSecondary, padding: '3px 8px' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                <button style={{ ...btnSecondary, padding: '3px 8px' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>》</button>
                <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, marginLeft: 6 }}>{currentPage} / {totalPages} 페이지</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ 템플릿 저장 모달 ══ */}
      {/* ══ Dynamic Column Mapper 패널 ══ */}
      <ColumnConfigPanel
        open={showColConfig}
        onClose={() => setShowColConfig(false)}
        columns={colConfigs}
        onToggleVisible={toggleVisible}
        onReorder={reorder}
        onSetAggregation={setAggregation}
        onToggleMerge={toggleMerge}
        onReset={resetCols}
      />

      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, width: '420px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: themeColors.text }}>{editingTemplate ? '템플릿 수정' : '템플릿 저장'}</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeColors.textSecondary }} onClick={() => setShowSaveModal(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 4 }}>템플릿명 *</label>
                <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="예: 월간 로그인 리포트" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 4 }}>설명</label>
                <input value={saveDesc} onChange={e => setSaveDesc(e.target.value)} placeholder="간단한 설명 (선택)" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 4 }}>저장될 컬럼</label>
                <p style={{ fontSize: '0.8125rem', color: themeColors.text }}>{visibleColumns.map(c => c.label).join(' · ')}</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={saveShared} onChange={e => setSaveShared(e.target.checked)} style={{ accentColor: themeColors.primary }} />
                <span style={{ fontSize: '0.875rem', color: themeColors.text }}>
                  <Globe size={13} style={{ display: 'inline', marginRight: 4 }} />공용 템플릿으로 공유
                </span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setShowSaveModal(false)}>취소</button>
              <button style={{ ...btnPrimary, opacity: isSaving ? 0.7 : 1 }} onClick={handleSaveTemplate} disabled={isSaving}>
                <Save size={13} />{isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedComponent>
  );
};

// ── 템플릿 아이템 컴포넌트 ─────────────────────────────────────────────────────
const TemplateItem: React.FC<{
  tpl: ReportTemplate; active: boolean; isDark: boolean;
  themeColors: any; hoverBg: string; userId: string;
  onLoad: (t: ReportTemplate) => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ tpl, active, isDark, themeColors, hoverBg, userId, onLoad, onEdit, onDelete }) => (
  <div
    style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: '5px', marginBottom: '2px', cursor: 'pointer', backgroundColor: active ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.06)') : 'transparent', borderLeft: `3px solid ${active ? themeColors.primary : 'transparent'}` }}
    onClick={() => onLoad(tpl)}
    onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = hoverBg; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: active ? 600 : 400, color: active ? themeColors.primary : themeColors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</p>
      {tpl.description && <p style={{ fontSize: '0.625rem', color: themeColors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.description}</p>}
    </div>
    {tpl.createdBy === userId && (
      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button style={{ padding: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, borderRadius: '3px' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.color = themeColors.primary; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = themeColors.textSecondary; }}
          onClick={onEdit} title="수정">
          <Edit2 size={11} />
        </button>
        <button style={{ padding: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, borderRadius: '3px' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = themeColors.textSecondary; }}
          onClick={onDelete} title="삭제">
          <Trash2 size={11} />
        </button>
      </div>
    )}
  </div>
);

export default AuditLogs;
