import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../config';
import {
  Upload, FileText, Image, CheckCircle, XCircle,
  Loader2, Download, Copy, Trash2, ChevronDown, ChevronUp,
  AlertCircle, AlertTriangle, Search, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

type JobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
type PdfType   = 'TEXT_BASED' | 'IMAGE_BASED' | 'UNKNOWN';

interface PageResult {
  pageNumber: number;
  text: string;
  skipped: boolean;
  confidence: number; // 0–100, -1 = text-based (N/A)
}

interface OcrJob {
  jobId: string;
  status: JobStatus;
  pdfType: PdfType;
  progress: number;
  pageCount: number;
  message: string;
  fullText?: string;
  pages?: PageResult[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: 'kor+eng', label: '한국어 + 영어' },
  { value: 'kor',     label: '한국어만' },
  { value: 'eng',     label: '영어만' },
];

const DPI_OPTIONS = [
  { value: 200, labelKey: 'ocrDpi200', speed: 3, quality: 1 },
  { value: 300, labelKey: 'ocrDpi300', speed: 2, quality: 2 },
  { value: 400, labelKey: 'ocrDpi400', speed: 1, quality: 3 },
  { value: 600, labelKey: 'ocrDpi600', speed: 0, quality: 4 },
] as const;

/** 속도/품질 도트 시각화 */
const DotRow: React.FC<{ filled: number; total: number; color: string }> = ({ filled, total, color }) => (
  <span className="inline-flex gap-0.5">
    {Array.from({ length: total }).map((_, i) => (
      <span key={i} className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: i < filled ? color : '#D1D5DB' }} />
    ))}
  </span>
);

/** 신뢰도 색상 반환 */
function confColor(conf: number): string {
  if (conf < 0)   return '#6B7280'; // N/A (텍스트 PDF)
  if (conf >= 75) return '#10B981'; // 초록 — 양호
  if (conf >= 50) return '#F59E0B'; // 주황 — 보통
  return '#EF4444';                 // 빨강 — 낮음
}

/** 신뢰도 레이블 */
function confLabel(conf: number, t: (k: string) => string): string {
  if (conf < 0)   return 'N/A';
  if (conf >= 75) return t('ocrConfGood');
  if (conf >= 50) return t('ocrConfFair');
  return t('ocrConfPoor');
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const ConfBadge: React.FC<{ conf: number; t: (k: string) => string }> = ({ conf, t }) => {
  const color = confColor(conf);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium tabular-nums"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {conf >= 0 ? `${conf}%` : 'N/A'}
      <span className="hidden sm:inline opacity-70">· {confLabel(conf, t)}</span>
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PdfOcr: React.FC = () => {
  const t      = useLanguage();
  const theme  = useSettingsStore(s => s.settings.theme);
  const colors = themeConfigs[theme];
  const token  = useAuthStore(s => s.token);

  const [isDragging,    setIsDragging]    = useState(false);
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [language,      setLanguage]      = useState('kor+eng');
  const [dpi,           setDpi]           = useState<200|300|400|600>(400);
  const [job,           setJob]           = useState<OcrJob | null>(null);
  const [editedText,    setEditedText]    = useState('');
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());
  const [itemViewPages, setItemViewPages] = useState<Set<number>>(new Set());
  const [isUploading,   setIsUploading]   = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [activeTab,     setActiveTab]     = useState<'full' | 'pages'>('full');

  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ─── Polling ─────────────────────────────────────────────────────────────
  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/ocr/status/${jobId}`,
          { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data: OcrJob = await res.json();
        setJob(data);

        if (data.status === 'DONE' || data.status === 'FAILED') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (data.status === 'DONE') {
            const r = await fetch(`${API_BASE_URL}/ocr/result/${jobId}`,
              { headers: { Authorization: `Bearer ${token}` } });
            if (r.ok) {
              const result: OcrJob = await r.json();
              setJob(result);
              setEditedText(result.fullText ?? '');
            }
          }
        }
      } catch { /* network error — keep polling */ }
    }, 1500);
  }, [token]);

  // ─── File handling ───────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (file.type !== 'application/pdf') { toast.error(t('ocrOnlyPdf')); return; }
    setSelectedFile(file);
    setJob(null);
    setEditedText('');
    setExpandedPages(new Set());
    setSearchQuery('');
    setActiveTab('full');
  }, [t]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  // ─── Start OCR ───────────────────────────────────────────────────────────
  const startOcr = async () => {
    if (!selectedFile) return;
    setIsUploading(true); setJob(null); setEditedText('');
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('language', language);
      form.append('dpi', String(dpi));
      const res = await fetch(`${API_BASE_URL}/ocr/extract`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? t('ocrUploadFailed'));
      }
      const data = await res.json();
      setJob({ jobId: data.jobId, status: 'PENDING', pdfType: 'UNKNOWN', progress: 0, pageCount: 0, message: data.message });
      startPolling(data.jobId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('ocrUploadFailed'));
    } finally { setIsUploading(false); }
  };

  // ─── Download / Copy ─────────────────────────────────────────────────────
  const downloadTxt = () => {
    const blob = new Blob([editedText], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile?.name.replace(/\.pdf$/i, '') ?? 'ocr_result'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = () =>
    navigator.clipboard.writeText(editedText).then(() => toast.success(t('ocrCopied')));

  const copyPage = (text: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(t('ocrCopied')));

  const resetAll = async () => {
    if (job?.jobId)
      fetch(`${API_BASE_URL}/ocr/${job.jobId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    if (pollRef.current) clearInterval(pollRef.current);
    setSelectedFile(null); setJob(null); setEditedText('');
    setExpandedPages(new Set()); setSearchQuery('');
  };

  const togglePage = (n: number) =>
    setExpandedPages(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });

  const toggleItemView = (n: number) =>
    setItemViewPages(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });

  const expandAll = () => job?.pages && setExpandedPages(new Set(job.pages.map(p => p.pageNumber)));
  const collapseAll = () => setExpandedPages(new Set());

  // ─── Derived stats ───────────────────────────────────────────────────────
  const isRunning = job?.status === 'PENDING' || job?.status === 'PROCESSING';
  const isDone    = job?.status === 'DONE';
  const isFailed  = job?.status === 'FAILED';

  const ocrPages      = job?.pages?.filter(p => p.confidence >= 0) ?? [];
  const avgConf       = ocrPages.length > 0
    ? Math.round(ocrPages.reduce((s, p) => s + p.confidence, 0) / ocrPages.length)
    : -1;
  const lowConfPages  = ocrPages.filter(p => p.confidence < 50);
  const hasLowConf    = lowConfPages.length > 0;

  // 검색 필터
  const filteredPages = searchQuery.trim()
    ? (job?.pages ?? []).filter(p =>
        p.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(p.pageNumber).includes(searchQuery))
    : (job?.pages ?? []);

  const pdfTypeBadge = (type: PdfType) => {
    if (type === 'TEXT_BASED')  return { label: t('ocrPdfTypeText'),  color: '#10B981', Icon: FileText };
    if (type === 'IMAGE_BASED') return { label: t('ocrPdfTypeImage'), color: '#F59E0B', Icon: Image };
    return null;
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl" style={{ color: colors.text }}>

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: colors.text }}>{t('ocrTitle')}</h1>
        <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>{t('ocrSubtitle')}</p>
      </div>

      {/* ── Upload zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !isRunning && fileInputRef.current?.click()}
        className="rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3 py-10"
        style={{
          borderColor: isDragging ? colors.primary : colors.border,
          backgroundColor: isDragging ? `${colors.primary}10` : colors.surface,
          cursor: isRunning ? 'not-allowed' : 'pointer',
        }}
      >
        <Upload size={34} style={{ color: isDragging ? colors.primary : colors.textSecondary }} />
        <div className="text-center px-4">
          <p className="font-medium" style={{ color: colors.text }}>
            {selectedFile ? selectedFile.name : t('ocrDropOrClick')}
          </p>
          {selectedFile
            ? <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            : <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>{t('ocrPdfOnly')}</p>}
        </div>
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
      </div>

      {/* ── Options ── */}
      {selectedFile && !isRunning && (
        <div className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${colors.border}` }}>

          {/* 언어 + DPI 행 */}
          <div className="p-4 flex flex-wrap items-start gap-5"
            style={{ backgroundColor: colors.surface }}>

            {/* 언어 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap" style={{ color: colors.text }}>
                {t('ocrLanguage')}
              </label>
              <select value={language} onChange={e => setLanguage(e.target.value)}
                className="text-sm rounded-lg px-3 py-1.5 outline-none"
                style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.text }}>
                {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* DPI 선택 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium" style={{ color: colors.text }}>
                {t('ocrDpiLabel')}
              </span>
              <div className="flex items-stretch gap-2 flex-wrap">
                {DPI_OPTIONS.map(opt => {
                  const isSelected = dpi === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setDpi(opt.value)}
                      className="flex flex-col items-start gap-1 px-3 py-2 rounded-lg text-left transition-all"
                      style={{
                        border: `1.5px solid ${isSelected ? colors.primary : colors.border}`,
                        backgroundColor: isSelected ? `${colors.primary}10` : colors.background,
                        minWidth: 88,
                      }}
                    >
                      <span className="text-sm font-bold tabular-nums"
                        style={{ color: isSelected ? colors.primary : colors.text }}>
                        {opt.value} DPI
                        {opt.value === 400 && (
                          <span className="ml-1 text-xs font-normal"
                            style={{ color: '#10B981' }}>✓</span>
                        )}
                      </span>
                      <span className="text-xs" style={{ color: colors.textSecondary }}>
                        {t(opt.labelKey)}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: colors.textSecondary }}>
                          {t('ocrQuality')}
                        </span>
                        <DotRow filled={opt.quality} total={4} color={colors.primary} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: colors.textSecondary }}>
                          {t('ocrSpeed')}
                        </span>
                        <DotRow filled={opt.speed} total={3} color="#10B981" />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                {t(`ocrDpiHint${dpi}`)}
              </p>
            </div>
          </div>

          {/* 액션 버튼 행 */}
          <div className="px-4 py-3 flex items-center justify-end gap-2"
            style={{ borderTop: `1px solid ${colors.border}`, backgroundColor: colors.background }}>
            <button onClick={resetAll}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
              style={{ color: colors.textSecondary, border: `1px solid ${colors.border}` }}>
              <Trash2 size={14} />{t('cancel')}
            </button>
            <button onClick={startOcr} disabled={isUploading}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50"
              style={{ backgroundColor: colors.primary, color: '#fff' }}>
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {t('ocrStart')} ({dpi} DPI)
            </button>
          </div>
        </div>
      )}

      {/* ── Progress ── */}
      {job && (isRunning || isFailed) && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {isRunning && <Loader2 size={15} className="animate-spin flex-shrink-0" style={{ color: colors.primary }} />}
              {isFailed  && <XCircle size={15} className="flex-shrink-0" style={{ color: '#EF4444' }} />}
              <span className="text-sm font-medium truncate" style={{ color: colors.text }}>{job.message}</span>
            </div>
            {job.pageCount > 0 && (
              <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: colors.textSecondary }}>
                {t('ocrPages')} {job.pageCount}
              </span>
            )}
          </div>
          {isRunning && (
            <>
              <div className="rounded-full h-2 overflow-hidden" style={{ backgroundColor: colors.border }}>
                <div className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${job.progress}%`,
                    background: job.progress > 90
                      ? `linear-gradient(90deg, ${colors.primary}, #10B981)` : colors.primary,
                  }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: colors.textSecondary }}>
                  {job.pdfType === 'IMAGE_BASED' ? t('ocrPdfTypeImage')
                    : job.pdfType === 'TEXT_BASED' ? t('ocrPdfTypeText') : ''}
                </span>
                <span className="text-xs font-mono tabular-nums" style={{ color: colors.textSecondary }}>
                  {job.progress}%
                </span>
              </div>
            </>
          )}
          {isFailed && (
            <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
              style={{ color: '#EF4444', backgroundColor: '#EF444410' }}>
              <AlertCircle size={14} />{t('ocrFailed')}
            </div>
          )}
        </div>
      )}

      {/* ── Result ── */}
      {isDone && job && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>

          {/* ── 결과 헤더 ── */}
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{ backgroundColor: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
            <div className="flex items-center flex-wrap gap-2">
              <CheckCircle size={16} style={{ color: '#10B981' }} />
              <span className="text-sm font-semibold" style={{ color: colors.text }}>{t('ocrDone')}</span>

              {/* PDF 유형 배지 */}
              {(() => { const b = pdfTypeBadge(job.pdfType); return b ? (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${b.color}20`, color: b.color }}>
                  <b.Icon size={11} />{b.label}
                </span>
              ) : null; })()}

              {/* 통계 */}
              <span className="text-xs" style={{ color: colors.textSecondary }}>
                {job.pageCount}{t('ocrPages')} · {editedText.length.toLocaleString()}{t('ocrChars')}
              </span>

              {/* 평균 신뢰도 */}
              {avgConf >= 0 && (
                <span className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: confColor(avgConf) }}>
                  {t('ocrAvgConf')} <strong>{avgConf}%</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyAll}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                style={{ color: colors.textSecondary, border: `1px solid ${colors.border}` }}>
                <Copy size={13} />{t('ocrCopy')}
              </button>
              <button onClick={downloadTxt}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                style={{ backgroundColor: colors.primary, color: '#fff' }}>
                <Download size={13} />{t('download')} TXT
              </button>
              <button onClick={resetAll}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                style={{ color: colors.textSecondary, border: `1px solid ${colors.border}` }}>
                <Trash2 size={13} />{t('ocrReset')}
              </button>
            </div>
          </div>

          {/* ── 낮은 신뢰도 경고 ── */}
          {hasLowConf && (
            <div className="px-4 py-2.5 flex items-center gap-2 text-xs"
              style={{ backgroundColor: '#F59E0B10', borderBottom: `1px solid ${colors.border}`, color: '#B45309' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              {t('ocrLowConfWarn', { count: lowConfPages.length })}
              <span style={{ color: '#92400E' }}>
                ({lowConfPages.map(p => `${p.pageNumber}p`).join(', ')})
              </span>
            </div>
          )}

          {/* ── 탭 ── */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-0"
            style={{ backgroundColor: colors.background }}>
            {(['full', 'pages'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="text-xs font-medium px-3 py-1.5 rounded-t-lg transition-colors"
                style={{
                  color:           activeTab === tab ? colors.primary : colors.textSecondary,
                  backgroundColor: activeTab === tab ? `${colors.primary}12` : 'transparent',
                  borderBottom:    activeTab === tab ? `2px solid ${colors.primary}` : '2px solid transparent',
                }}>
                {tab === 'full'  ? t('ocrFullText') : t('ocrByPage')}
                {tab === 'pages' && job.pages && (
                  <span className="ml-1.5 tabular-nums opacity-60">({job.pages.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* ── 탭: 전체 텍스트 ── */}
          {activeTab === 'full' && (
            <div style={{ backgroundColor: colors.background }}>
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                rows={18}
                className="w-full p-4 text-sm resize-y outline-none font-mono leading-relaxed"
                style={{ backgroundColor: colors.background, color: colors.text, border: 'none' }}
                placeholder={t('ocrNoText')}
              />
            </div>
          )}

          {/* ── 탭: 페이지별 ── */}
          {activeTab === 'pages' && job.pages && (
            <div style={{ backgroundColor: colors.background }}>

              {/* 검색 + 전체 열기/닫기 */}
              <div className="px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: `1px solid ${colors.border}` }}>
                <div className="flex items-center gap-1.5 flex-1 rounded-lg px-2.5 py-1.5"
                  style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
                  <Search size={13} style={{ color: colors.textSecondary, flexShrink: 0 }} />
                  <input
                    type="text" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('ocrSearchPages')}
                    className="flex-1 text-xs bg-transparent outline-none"
                    style={{ color: colors.text }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}>
                      <X size={13} style={{ color: colors.textSecondary }} />
                    </button>
                  )}
                </div>
                <button onClick={expandAll}
                  className="text-xs px-2 py-1.5 rounded-lg whitespace-nowrap"
                  style={{ color: colors.textSecondary, border: `1px solid ${colors.border}` }}>
                  {t('ocrExpandAll')}
                </button>
                <button onClick={collapseAll}
                  className="text-xs px-2 py-1.5 rounded-lg whitespace-nowrap"
                  style={{ color: colors.textSecondary, border: `1px solid ${colors.border}` }}>
                  {t('ocrCollapseAll')}
                </button>
              </div>

              {/* 검색 결과 카운트 */}
              {searchQuery && (
                <div className="px-4 py-1.5 text-xs"
                  style={{ color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>
                  {filteredPages.length > 0
                    ? t('ocrSearchResult', { count: filteredPages.length })
                    : t('ocrNoSearchResult')}
                </div>
              )}

              {/* 페이지 목록 */}
              {filteredPages.map(page => {
                const isExpanded = expandedPages.has(page.pageNumber);
                const isLow      = page.confidence >= 0 && page.confidence < 50;
                return (
                  <div key={page.pageNumber}
                    style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: isLow ? '#F59E0B08' : colors.surface,
                      }}
                      onClick={() => togglePage(page.pageNumber)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isLow
                          ? <AlertTriangle size={13} style={{ color: '#F59E0B', flexShrink: 0 }} />
                          : <FileText size={13} style={{ color: colors.textSecondary, flexShrink: 0 }} />}
                        <span className="text-sm font-medium" style={{ color: colors.text }}>
                          {t('ocrPage')} {page.pageNumber}
                        </span>
                        <ConfBadge conf={page.confidence} t={t} />
                        {page.text.length > 0 && (
                          <span className="text-xs tabular-nums hidden sm:inline"
                            style={{ color: colors.textSecondary }}>
                            {page.text.length.toLocaleString()}{t('ocrChars')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded && (
                          <button
                            onClick={e => { e.stopPropagation(); copyPage(page.text); }}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                            style={{ color: colors.textSecondary, border: `1px solid ${colors.border}` }}>
                            <Copy size={11} />{t('ocrCopy')}
                          </button>
                        )}
                        {isExpanded
                          ? <ChevronUp   size={14} style={{ color: colors.textSecondary, flexShrink: 0 }} />
                          : <ChevronDown size={14} style={{ color: colors.textSecondary, flexShrink: 0 }} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ backgroundColor: colors.background }}>
                        {page.text ? (
                          <>
                            {/* 보기 모드 전환 */}
                            <div className="px-4 pt-3 pb-1 flex justify-end">
                              <button
                                onClick={() => toggleItemView(page.pageNumber)}
                                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                                style={{
                                  border: `1px solid ${colors.border}`,
                                  color: itemViewPages.has(page.pageNumber) ? colors.primary : colors.textSecondary,
                                  backgroundColor: itemViewPages.has(page.pageNumber) ? `${colors.primary}10` : 'transparent',
                                }}>
                                {itemViewPages.has(page.pageNumber) ? '텍스트 보기' : '항목별 보기'}
                              </button>
                            </div>
                            {itemViewPages.has(page.pageNumber) ? (
                              /* 항목별 보기: 줄 단위로 분리, 개별 복사 */
                              <div className="px-4 pb-4 space-y-1">
                                {page.text.split('\n').filter(l => l.trim()).map((line, i) => (
                                  <div key={i}
                                    className="flex items-start justify-between gap-2 px-2.5 py-1.5 rounded"
                                    style={{ backgroundColor: colors.surface }}>
                                    <span className="text-sm flex-1 break-all" style={{ color: colors.text }}>{line}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(line).then(() => toast.success(t('ocrCopied')))}
                                      className="flex-shrink-0 p-0.5 rounded hover:opacity-70"
                                      style={{ color: colors.textSecondary }}>
                                      <Copy size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              /* 텍스트 보기: 기존 raw text */
                              <div className="px-4 pb-4">
                                <HighlightedText text={page.text} query={searchQuery} textColor={colors.text} />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="px-4 py-4">
                            <p className="text-sm italic" style={{ color: colors.textSecondary }}>{t('ocrNoText')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredPages.length === 0 && searchQuery && (
                <div className="py-10 text-center text-sm" style={{ color: colors.textSecondary }}>
                  {t('ocrNoSearchResult')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 검색어 하이라이트 ─────────────────────────────────────────────────────────

const HighlightedText: React.FC<{ text: string; query: string; textColor: string }> = ({
  text, query, textColor,
}) => {
  if (!query.trim()) {
    return (
      <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed"
        style={{ color: textColor }}>{text}</pre>
    );
  }
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed" style={{ color: textColor }}>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} style={{ backgroundColor: '#FDE68A', color: '#78350F', borderRadius: 2 }}>{part}</mark>
          : part
      )}
    </pre>
  );
};

export default PdfOcr;
