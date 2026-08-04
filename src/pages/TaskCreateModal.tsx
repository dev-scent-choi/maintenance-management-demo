import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, FileText, ListTodo, Image as ImageIcon, Trash2, Film, Archive, ChevronDown, ChevronRight, Calendar, Flag, User, TrendingUp, History, Plus, PenLine, Maximize2, Minimize2, Zap, Bug, HelpCircle } from 'lucide-react';

const getFileIconInfo = (name: string) => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return { Icon: ImageIcon, color: '#8B5CF6' };
  if (['mp4','avi','mov','webm'].includes(ext)) return { Icon: Film, color: '#F59E0B' };
  if (['zip','rar','7z','tar','gz'].includes(ext)) return { Icon: Archive, color: '#F97316' };
  if (['pdf'].includes(ext)) return { Icon: FileText, color: '#EF4444' };
  if (['xls','xlsx','csv'].includes(ext)) return { Icon: FileText, color: '#10B981' };
  if (['doc','docx','txt'].includes(ext)) return { Icon: FileText, color: '#3B82F6' };
  if (['ppt','pptx'].includes(ext)) return { Icon: FileText, color: '#F97316' };
  return { Icon: FileText, color: '#6B7280' };
};
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { isAdminAccount } from '../utils/permissions';
import { useProjectStore } from '../store/projectStore';
import { useNotificationStore } from '../store/notificationStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import ListTabBar from '../components/common/ListTabBar';
import ConfirmPopover from '../components/common/ConfirmPopover';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Task, Issue } from '../types';

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  department?: string;
}

type CategoryType = 'bug' | 'feature' | 'improvement' | 'other';

interface Props {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
  task?: Task | null;   // 있으면 상세/수정 모드
  issue?: Issue | null; // 있으면 이슈 상세/수정 모드
}

const TaskCreateModal: React.FC<Props> = ({ isOpen, projectId, onClose, onSaved, task, issue }) => {
  const t = useLanguage();
  const { theme } = useSettingsStore((state) => state.settings);
  const themeColors = themeConfigs[theme];
  const { user, token } = useAuthStore();
  const { addIssue, updateTask, updateIssue, deleteTask, deleteIssue } = useProjectStore();
  const { addLog } = useAuditLogStore();
  const isEditMode = !!(task || issue);
  const isReadOnly = isEditMode && task?.status === 'done';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);

  const isDark = theme !== 'light';
  const onPrimaryText = theme === 'yellow' ? '#333' : '#fff';
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(55,53,47,0.04)';
  const optionStyle = { backgroundColor: themeColors.surface, color: themeColors.text };

  const priorityOptions = [
    { value: 'low',    label: t('priorityLow'),    color: '#64748B' },
    { value: 'medium', label: t('priorityMedium'), color: '#D97706' },
    { value: 'high',   label: t('priorityHigh'),   color: '#EA580C' },
    { value: 'urgent', label: t('priorityUrgent'), color: '#DC2626' },
  ];

  const statusOptions = [
    { value: 'todo',        label: t('todoStatus'),        color: '#6B7280' },
    { value: 'in_progress', label: t('inProgressStatus'), color: '#3B82F6' },
    { value: 'review',      label: t('reviewStatus'),      color: '#F59E0B' },
    { value: 'done',        label: t('doneStatus'),        color: '#10B981' },
  ];

  // priority → severity 매핑 (Issue 백엔드는 severity 필드 사용)
  const priorityToSeverity: Record<string, string> = {
    low: 'minor', medium: 'major', high: 'critical', urgent: 'blocker',
  };
  const severityToPriority: Record<string, string> = {
    minor: 'low', major: 'medium', critical: 'high', blocker: 'urgent',
  };

  const issueStatusOptions = [
    { value: 'in_progress', label: t('statusProcessing'), color: '#3B82F6' },
    { value: 'open',        label: t('statusOnHold'), color: '#D97706' },
    { value: 'resolved',    label: t('statusCompleted'), color: '#10B981' },
  ];

  // ── 필드 레이블 / 입력 스타일 ────────────────────────────────
  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: themeColors.textSecondary, marginBottom: '0.375rem', letterSpacing: '0.02em',
  };

  const fieldInput: React.CSSProperties = {
    display: 'block', width: '100%',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(55,53,47,0.03)',
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px', color: themeColors.text,
    fontSize: '0.875rem', padding: '0.4375rem 0.625rem',
    outline: 'none', colorScheme: isDark ? 'dark' as const : 'light' as const,
  };

  // ── 옵션 칩 ──────────────────────────────────────────────────
  const [hoveredChip, setHoveredChip] = useState<string | null>(null);

  const chip = (id: string, isSelected: boolean): React.CSSProperties => {
    const isHovered = hoveredChip === id;
    return {
      display: 'inline-flex', alignItems: 'center',
      padding: '0.1875rem 0.625rem', borderRadius: '3px',
      fontSize: '0.8125rem', fontWeight: isSelected ? 600 : 500,
      border: `1px solid ${isSelected ? themeColors.primary + '90' : isHovered ? themeColors.primary + '50' : themeColors.border}`,
      backgroundColor: isSelected
        ? (isDark ? `${themeColors.primary}25` : `${themeColors.primary}18`)
        : isHovered ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.05)') : 'transparent',
      color: isSelected ? themeColors.primary : isHovered ? themeColors.text : themeColors.textSecondary,
      cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
    };
  };

  // ── State ────────────────────────────────────────────────────
  const [category, setCategory] = useState<CategoryType>('bug');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [descFocused, setDescFocused] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    title: '', description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'todo' as 'todo' | 'in_progress' | 'review' | 'done',
    severity: 'major' as 'minor' | 'major' | 'critical' | 'blocker',
    dueDate: '', assigneeId: '', weight: 10,
    files: [] as any[],
  });

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, bx: 0, by: 0 });

  const isIssueType = (_cat: CategoryType) => true;

  const categories: { value: CategoryType; label: string; icon: React.ReactNode }[] = [
    { value: 'feature',     label: t('issueTypeFeature'),     icon: <Zap size={12} style={{ display: 'block' }} /> },
    { value: 'improvement', label: t('issueTypeImprovement'), icon: <TrendingUp size={12} style={{ display: 'block' }} /> },
    { value: 'bug',         label: t('issueTypeBug'),         icon: <Bug size={12} style={{ display: 'block' }} /> },
    { value: 'other',       label: t('issueTypeOther'),       icon: <HelpCircle size={12} style={{ display: 'block' }} /> },
  ];

  const toDateStr = (d?: Date | string | null) => {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (!isOpen) return;
    setPos({ x: 0, y: 0 });
    setShowHistory(false);
    setHistoryLogs([]);

    if (task) {
      setCategory('feature');
      setFormData({
        title: task.title || '', description: task.description || '',
        priority: task.priority || 'medium', status: task.status || 'todo',
        severity: 'major', dueDate: toDateStr(task.dueDate),
        assigneeId: task.assigneeId?.toString() || '', weight: task.weight ?? 0, files: [],
      });
    } else if (issue) {
      setCategory((issue.type as CategoryType) || 'feature');
      setFormData({
        title: issue.title || '', description: issue.description || '',
        priority: (severityToPriority[issue.severity || ''] || issue.priority || 'medium') as any, status: (issue.status as any) || 'open',
        severity: 'major', dueDate: toDateStr(issue.dueDate),
        assigneeId: issue.assigneeId?.toString() || '', weight: 10, files: [],
      });
    } else {
      setCategory('feature');
      setFormData({ title: '', description: '', priority: 'medium', status: 'todo', severity: 'major', dueDate: '', assigneeId: '', weight: 10, files: [] });
    }
    // 담당자 목록 로딩 완료 후 패널 표시
    const fetchMembers = async () => {
      if (!token) { setIsDataReady(true); return; }
      try {
        const projectRes = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          const memberIds = [projectData.managerId, ...(projectData.members || [])];
          const usersRes = await fetch(import.meta.env.VITE_API_URL + '/users', { headers: { Authorization: `Bearer ${token}` } });
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            setProjectMembers(
              usersData
                .filter((u: any) => memberIds.includes(u.id))
                .map((u: any) => ({ id: u.id.toString(), name: u.name, email: u.email, department: u.department }))
            );
          }
        }
      } catch (e) { console.error(e); }
      finally { setIsDataReady(true); }
    };
    fetchMembers();
  }, [isOpen, projectId, token]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: pos.x, by: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setPos({ x: dragStart.current.bx + e.clientX - dragStart.current.mx, y: dragStart.current.by + e.clientY - dragStart.current.my });
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  useEffect(() => {
    if (isDataReady && descRef.current) {
      descRef.current.innerHTML = formData.description || '';
    }
  }, [isDataReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDescPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob || !token) continue;

        // 서버에 이미지 업로드
        const fd = new FormData();
        fd.append('file', blob, `paste-${Date.now()}.png`);
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/files/inline-image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (!res.ok) throw new Error('upload failed');
          const { url } = await res.json();

          // 커서 위치에 img 태그 삽입
          const img = document.createElement('img');
          img.src = url;
          img.style.cssText = 'max-width:100%;height:auto;border-radius:4px;margin:6px 0;display:block;';
          const selection = window.getSelection();
          const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
          if (range && descRef.current?.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            range.insertNode(img);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          } else {
            descRef.current?.appendChild(img);
          }
          const html = descRef.current?.innerHTML || '';
          setFormData(prev => ({ ...prev, description: html }));
        } catch {
          alert(t('imageUploadFailed'));
        }
        return;
      }
    }
  };

  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest('[data-dd]')) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); processFiles(Array.from(e.dataTransfer.files)); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) processFiles(Array.from(e.target.files)); };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          files: [...prev.files, {
            id: `temp-${Date.now()}-${Math.random()}`,
            name: file.name, url: e.target?.result as string,
            type: file.type, size: file.size,
            uploadedAt: new Date(), uploadedBy: user?.name || '', uploadedById: user?.id || '',
            isImage: file.type.startsWith('image/'), file,
          }],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (fileId: string) => setFormData(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }));

  const handleDownloadAttachment = async (attId: string, fileName: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/tasks/attachments/${attId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
      } else { alert(t('downloadFailed')); }
    } catch { alert(t('fileDownloadError')); }
  };

  const fetchHistory = async () => {
    const resourceId = task ? String(task.id) : issue ? String(issue.id) : null;
    const resourceType = task ? 'task' : 'issue';
    if (!resourceId || !token) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/audit-logs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const filtered = data
          .filter((l: any) => String(l.resourceId) === resourceId && l.resourceType === resourceType)
          .map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }))
          .sort((a: any, b: any) => b.timestamp - a.timestamp);
        setHistoryLogs(filtered);
      }
    } catch (error) {
    } finally { setHistoryLoading(false); }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) fetchHistory();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // ── 수정 모드 ────────────────────────────────────
      if (isEditMode) {
        if (task) {
          await updateTask(task.id, {
            title: task.title, description: formData.description,
            priority: formData.priority, status: formData.status,
            assigneeId: formData.assigneeId || null,
            dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
            weight: formData.weight,
          });
          addLog({ userId: user?.id, userName: user?.name, action: 'update', resourceType: 'task', resourceId: String(task.id), resourceName: task.title, details: `작업 수정: ${task.title}` });
        } else if (issue) {
          await updateIssue(issue.id, {
            title: issue.title, description: formData.description,
            type: category as any,
            status: formData.status as any,
            priority: formData.priority as any,
            severity: (priorityToSeverity[formData.priority] || 'major') as Issue['severity'],
            assigneeId: formData.assigneeId || null,
            dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          });
          addLog({ userId: user?.id, userName: user?.name, action: 'update', resourceType: 'issue', resourceId: String(issue.id), resourceName: issue.title, details: `이슈 수정: ${issue.title}` });
        }
        onSaved(); onClose();
        return;
      }
      // ── 등록 모드 — 작업으로 통일 (tasks API 직접 호출) ──────
      const autoTitle = formData.title.trim() || (categories.find(c => c.value === category)?.label ?? t('newTask'));
      const descHtml = descRef.current?.innerHTML || formData.description;
      const backendStatus = formData.status === 'review' ? 'IN_REVIEW' : formData.status.toUpperCase();
      const createRes = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: autoTitle,
          description: descHtml,
          priority: formData.priority.toUpperCase(),
          status: backendStatus,
          dueDate: formData.dueDate || null,
          assigneeId: formData.assigneeId ? parseInt(formData.assigneeId, 10) : null,
          reporterId: user?.id ? parseInt(user.id, 10) : null,
          weight: formData.weight,
          projectId: projectId,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({ message: t('addError') }));
        throw new Error(err.message || t('addError'));
      }
      onSaved(); onClose();
    } catch (e) {
      console.error(e);
      alert(t('addError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Notion-style helpers ──────────────────────────────────────
  const dot: React.CSSProperties = { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, display: 'inline-block' };
  const ddMenu: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 100, minWidth: '150px',
    backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`,
    borderRadius: '6px', boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.12)',
    padding: '0.25rem', overflow: 'hidden',
  };
  const mkTrigBtn = (hasValue: boolean, selColor?: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '3px 8px 3px 6px', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 400,
    background: 'transparent', border: 'none', cursor: isReadOnly ? 'default' : 'pointer',
    color: selColor ? selColor : hasValue ? themeColors.text : themeColors.textSecondary,
    transition: 'background 0.1s',
  });
  const mkDdItem = (isSelected: boolean, color?: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    width: '100%', padding: '0.375rem 0.625rem', borderRadius: '4px',
    background: isSelected ? (color ? `${color}18` : `${themeColors.primary}15`) : 'transparent',
    border: 'none', cursor: 'pointer', textAlign: 'left' as const,
    color: isSelected ? (color || themeColors.primary) : themeColors.text,
    fontSize: '0.875rem', fontWeight: isSelected ? 600 : 400,
  });
  const propRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => {
    const hasAsterisk = label.endsWith(' *');
    const displayLabel = hasAsterisk ? label.slice(0, -2) : label;
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: '2rem', padding: '0.0625rem 0' }}>
        <div style={{ width: '8.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, color: themeColors.textSecondary, fontSize: '0.8125rem', fontWeight: 600, opacity: 0.85 }}>
          <span style={{ display: 'flex', alignItems: 'center', opacity: 0.65, fontSize: '0.75rem' }}>{icon}</span>
          {displayLabel}{hasAsterisk && <span style={{ color: '#EF4444', marginLeft: '1px' }}>*</span>}
        </div>
        {value}
      </div>
    );
  };
  const propPair = (
    a: { icon: React.ReactNode; label: string; value: React.ReactNode },
    b: { icon: React.ReactNode; label: string; value: React.ReactNode }
  ) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0.0625rem 0' }}>
      {[a, b].map(({ icon, label, value }, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', minHeight: '2rem', overflow: 'hidden' }}>
          <div style={{ width: '5.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, color: themeColors.textSecondary, fontSize: '0.8125rem', fontWeight: 600, opacity: 0.85 }}>
            <span style={{ display: 'flex', alignItems: 'center', opacity: 0.65, fontSize: '0.75rem' }}>{icon}</span>
            {label}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>{value}</div>
        </div>
      ))}
    </div>
  );
  const selPriority = priorityOptions.find(o => o.value === formData.priority) || priorityOptions[1];
  const selStatus = statusOptions.find(o => o.value === formData.status) || statusOptions[0];
  const selIssueStatus = issueStatusOptions.find(o => o.value === formData.status) || issueStatusOptions[0];
  const selMember = projectMembers.find(m => m.id === formData.assigneeId);

  if (!isOpen) return null;

  return (
    <>
    <style>{`
      @keyframes historySlideIn { from { transform: translateX(100%); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
      @keyframes sidePanelIn { from { transform: translateX(100%); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } }
      .history-slide { animation: historySlideIn 0.2s cubic-bezier(0.22,1,0.36,1); }
      .task-panel-anim { animation: sidePanelIn 0.22s cubic-bezier(0.22,1,0.36,1); }
    `}</style>

    {/* 배경 오버레이 */}
    <div className="fixed inset-0" style={{ zIndex: 49, backgroundColor: 'rgba(0,0,0,0.28)' }} onClick={onClose} />

    {/* 로딩 중 카드 스피너 */}
    {!isDataReady && (
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50, pointerEvents: 'none' }}>
        <LoadingSpinner />
      </div>
    )}

    {/* 데이터 준비 완료 후 사이드 패널 */}
    {isDataReady && (
      <div
        className="task-panel-anim"
        style={{
          position: 'fixed', right: 0, top: 0, zIndex: 50,
          width: isWide ? 'min(46rem, calc(100vw - 2rem))' : 'min(480px, calc(100vw - 2rem))',
          height: '100vh',
          transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
          display: 'flex', flexDirection: 'column',
          backgroundColor: themeColors.surface,
          borderLeft: `1px solid ${themeColors.border}`,
          borderRadius: '12px 0 0 12px',
          boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(15,15,15,0.15)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          {/* ── 헤더 ── */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.5rem 1rem 0.5rem 1.25rem',
              borderBottom: `1px solid ${themeColors.border}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text }}>
                {isEditMode ? t('taskEdit') : t('taskAdd')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onMouseDown={e => e.stopPropagation()}>
              <button
                onClick={() => setIsWide(w => !w)}
                title={isWide ? t('panelShrink') : t('panelExpand')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {isWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              {isEditMode && !isReadOnly && (
                <button
                  onClick={() => {
                    setConfirmConfig({
                      title: task ? t('taskDeleteConfirm') : t('issueDeleteConfirm'),
                      description: t('irreversibleWarning'),
                      onConfirm: async () => {
                        setConfirmConfig(null);
                        try {
                          if (task) await deleteTask(task.id);
                          else if (issue) await deleteIssue(issue.id);
                          onSaved(); onClose();
                        } catch { alert(t('deleteError')); }
                      },
                    });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.18)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
                >
                  <Trash2 size={12} />
                  {t('delete')}
                </button>
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

          {/* 완료 상태 읽기 전용 배너 */}
          {isReadOnly && (
            <div style={{ margin: '0.5rem 1.5rem 0', padding: '0.4rem 0.875rem', borderRadius: '4px', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span style={{ fontSize: '0.8125rem', color: '#10B981', fontWeight: 600 }}>{t('taskCompletedBanner')}</span>
            </div>
          )}

          {/* ── 스크롤 바디 ── */}
          <div
            style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.5rem 1.25rem' }}
          >
            {/* 카테고리 탭 — 등록 모드 + 이슈 편집 모드 */}
            {(!isEditMode || !!issue) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', borderBottom: `1px solid ${themeColors.border}`, marginBottom: '1.25rem' }}>
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    style={{
                      position: 'relative', display: 'flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500,
                      background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                      color: category === cat.value ? themeColors.primary : themeColors.textSecondary,
                    }}
                  >
                    {cat.label}
                    {category === cat.value && (
                      <span style={{ position: 'absolute', bottom: 0, left: '0.5rem', right: '0.5rem', height: '2px', backgroundColor: themeColors.primary, borderRadius: '1px' }} />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── 속성 행 ── */}
            <div style={{ marginTop: '1rem', paddingBottom: '0.25rem' }}>

              {/* 담당자 */}
              {propRow(
                <User size={13} />, t('assignee'),
                <div data-dd="true" style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    onClick={() => !isReadOnly && setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
                    style={mkTrigBtn(!!selMember)}
                    onMouseEnter={(e) => { if (!isReadOnly) e.currentTarget.style.backgroundColor = hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {selMember ? selMember.name : t('noSelection')}
                    {!isReadOnly && <ChevronDown size={11} style={{ opacity: 0.4 }} />}
                  </button>
                  {openDropdown === 'assignee' && !isReadOnly && (
                    <div style={{ ...ddMenu, minWidth: '180px' }}>
                      <button
                        onClick={() => { setFormData({ ...formData, assigneeId: '' }); setOpenDropdown(null); }}
                        style={mkDdItem(!formData.assigneeId)}
                        onMouseEnter={(e) => { if (formData.assigneeId) e.currentTarget.style.backgroundColor = hoverBg; }}
                        onMouseLeave={(e) => { if (formData.assigneeId) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >선택 안 함</button>
                      {projectMembers.map(m => (
                        <button key={m.id}
                          onClick={() => { setFormData({ ...formData, assigneeId: m.id }); setOpenDropdown(null); }}
                          style={mkDdItem(formData.assigneeId === m.id)}
                          onMouseEnter={(e) => { if (formData.assigneeId !== m.id) e.currentTarget.style.backgroundColor = hoverBg; }}
                          onMouseLeave={(e) => { if (formData.assigneeId !== m.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <User size={12} style={{ opacity: 0.45 }} />
                          {m.name}{m.department ? ` (${m.department})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 완료일 */}
              {propRow(
                <Calendar size={13} />, t('dueDate'),
                <input
                  type="date"
                  value={formData.dueDate}
                  max="9999-12-31"
                  onChange={(e) => !isReadOnly && setFormData({ ...formData, dueDate: e.target.value })}
                  disabled={isReadOnly}
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    padding: '3px 8px 3px 6px',
                    color: formData.dueDate ? themeColors.text : themeColors.textSecondary,
                    fontSize: '0.875rem', width: 'auto',
                    colorScheme: isDark ? 'dark' : 'light',
                    cursor: isReadOnly ? 'default' : 'pointer',
                    opacity: isReadOnly ? 0.5 : 1,
                  }}
                />
              )}

              {/* 우선순위 */}
              {propRow(
                <Flag size={13} />, t('priority'),
                <div data-dd="true" style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    onClick={() => !isReadOnly && setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                    style={mkTrigBtn(true, selPriority.color)}
                    onMouseEnter={(e) => { if (!isReadOnly) e.currentTarget.style.backgroundColor = hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {selPriority.label}
                    {!isReadOnly && <ChevronDown size={11} style={{ opacity: 0.4 }} />}
                  </button>
                  {openDropdown === 'priority' && !isReadOnly && (
                    <div style={ddMenu}>
                      {priorityOptions.map(opt => (
                        <button key={opt.value}
                          onClick={() => { setFormData({ ...formData, priority: opt.value as any }); setOpenDropdown(null); }}
                          style={mkDdItem(formData.priority === opt.value, opt.color)}
                          onMouseEnter={(e) => { if (formData.priority !== opt.value) e.currentTarget.style.backgroundColor = hoverBg; }}
                          onMouseLeave={(e) => { if (formData.priority !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}


              {/* 상태 */}
              {propRow(
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 6v4l3 3"/></svg>,
                t('status'),
                <div data-dd="true" style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    onClick={() => !isReadOnly && setOpenDropdown(openDropdown === 'issueStatus' ? null : 'issueStatus')}
                    style={mkTrigBtn(true, selIssueStatus.color)}
                    onMouseEnter={(e) => { if (!isReadOnly) e.currentTarget.style.backgroundColor = hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {selIssueStatus.label}
                    {!isReadOnly && <ChevronDown size={11} style={{ opacity: 0.4 }} />}
                  </button>
                  {openDropdown === 'issueStatus' && !isReadOnly && (
                    <div style={ddMenu}>
                      {issueStatusOptions.map(opt => (
                        <button key={opt.value}
                          onClick={() => { setFormData({ ...formData, status: opt.value as any }); setOpenDropdown(null); }}
                          style={mkDdItem(formData.status === opt.value, opt.color)}
                          onMouseEnter={(e) => { if (formData.status !== opt.value) e.currentTarget.style.backgroundColor = hoverBg; }}
                          onMouseLeave={(e) => { if (formData.status !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 가중치 — 작업/이슈 구분 없이 항상 표시 */}
              {propRow(
                <TrendingUp size={13} />, t('weight'),
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', paddingLeft: '0.375rem', opacity: isReadOnly ? 0.5 : 1 }}>
                  {/* 슬림 진행바 */}
                  <div style={{ position: 'relative', width: '110px', height: '4px', borderRadius: '2px', backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(55,53,47,0.1)', flexShrink: 0, cursor: isReadOnly ? 'default' : 'pointer' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${formData.weight}%`, backgroundColor: themeColors.primary, borderRadius: '2px', transition: 'width 0.05s' }} />
                    <input
                      type="range" min="0" max="100" step="0.1"
                      value={formData.weight}
                      onChange={(e) => !isReadOnly && setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                      disabled={isReadOnly}
                      style={{ position: 'absolute', inset: '-6px 0', width: '100%', height: '16px', opacity: 0, cursor: isReadOnly ? 'default' : 'pointer', margin: 0 }}
                    />
                  </div>
                  {/* 직접 입력 */}
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={formData.weight}
                    onChange={(e) => !isReadOnly && setFormData({ ...formData, weight: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                    disabled={isReadOnly}
                    style={{ width: '3.25rem', textAlign: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.04)', border: `1px solid ${themeColors.border}`, borderRadius: '4px', color: themeColors.text, fontSize: '0.8125rem', padding: '0.1875rem 0.25rem', outline: 'none', cursor: isReadOnly ? 'default' : 'text' }}
                  />
                  <span style={{ fontSize: '0.8125rem', color: themeColors.textSecondary, opacity: 0.6 }}>%</span>
                </div>
              )}

            </div>{/* end 속성 행 */}

            {/* ── 설명 ── */}
            <div style={{ borderTop: `1px solid ${themeColors.border}`, marginTop: '1.25rem', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.625rem' }}>
                <FileText size={13} style={{ color: themeColors.textSecondary, opacity: 0.55 }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.textSecondary, opacity: 0.65 }}>{t('description')}</span>
              </div>
              <div style={{ position: 'relative', minHeight: '0.75rem' }}>
                {!formData.description && !descFocused && (
                  <div style={{ position: 'absolute', top: 0, left: 0, color: themeColors.textSecondary, opacity: 0.3, pointerEvents: 'none', fontSize: '0.9375rem', lineHeight: 1.75, userSelect: 'none' }}>
                    {t('descriptionContentPlaceholder')}
                  </div>
                )}
                <style>{`[data-desc-editor] img { max-width: 100%; height: auto; border-radius: 4px; margin: 6px 0; display: block; border: 1px solid ${themeColors.border}; cursor: zoom-in; }`}</style>
                <div
                  ref={descRef}
                  data-desc-editor
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning
                  onFocus={() => setDescFocused(true)}
                  onBlur={() => { setDescFocused(false); if (descRef.current) setFormData(prev => ({ ...prev, description: descRef.current!.innerHTML })); }}
                  onPaste={handleDescPaste}
                  style={{ outline: 'none', fontSize: '0.9375rem', lineHeight: 1.75, color: themeColors.text, minHeight: '0.625rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap', cursor: isReadOnly ? 'default' : 'text' }}
                />
              </div>
            </div>

            {/* ── 체크리스트 (상세 모드) ── */}
            {isEditMode && task && task.checklistItems && task.checklistItems.length > 0 && (
              <div style={{ borderTop: `1px solid ${themeColors.border}`, paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.textSecondary, opacity: 0.65 }}>{t('taskChecklist')}</span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: themeColors.textSecondary }}>
                    {task.checklistItems.filter(c => c.completed).length}/{task.checklistItems.length} {t('statusCompleted')}
                  </span>
                </div>
                <div style={{ height: '4px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.08)', marginBottom: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ width: `${task.checklistItems.length > 0 ? (task.checklistItems.filter(c => c.completed).length / task.checklistItems.length * 100) : 0}%`, height: '100%', backgroundColor: themeColors.primary, borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {task.checklistItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.3125rem 0.5rem', borderRadius: '4px' }}>
                      <div style={{ width: '15px', height: '15px', borderRadius: '3px', border: `1.5px solid ${item.completed ? themeColors.primary : themeColors.border}`, backgroundColor: item.completed ? themeColors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.completed && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke={theme === 'yellow' ? '#333' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ fontSize: '0.875rem', color: item.completed ? themeColors.textSecondary : themeColors.text, textDecoration: item.completed ? 'line-through' : 'none' }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 댓글 / 답변 (질문 타입 상세) ── */}
            {isEditMode && issue?.type === 'question' && (
              <div style={{ borderTop: `1px solid ${themeColors.border}`, paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: themeColors.textSecondary, opacity: 0.55 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.textSecondary, opacity: 0.65 }}>{t('commentsAnswers')}</span>
                </div>
                {(issue.comments || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {(issue.comments || []).map((c: any) => (
                      <div key={c.id} style={{ padding: '0.625rem 0.875rem', borderRadius: '4px', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(55,53,47,0.03)', border: `1px solid ${themeColors.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.text }}>{c.authorName}</span>
                          <span style={{ fontSize: '0.625rem', color: themeColors.textSecondary, opacity: 0.6 }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: themeColors.text, lineHeight: 1.6 }}>{c.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: themeColors.textSecondary, opacity: 0.5, marginBottom: '0.75rem' }}>{t('noAnswers')}</p>
                )}
                <textarea
                  value={answerInput}
                  onChange={e => setAnswerInput(e.target.value)}
                  placeholder={t('answerPlaceholder')}
                  rows={3}
                  style={{ ...fieldInput, resize: 'none' as const, marginBottom: '0.5rem' }}
                />
                <button
                  disabled={!answerInput.trim()}
                  onClick={async () => {
                    if (!answerInput.trim() || !issue?.id) return;
                    try {
                      const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issue.id}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ content: answerInput.trim(), authorId: user?.id, authorName: user?.name }),
                      });
                      if (res.ok) { setAnswerInput(''); onSaved(); }
                      else { alert(t('submitAnswer') + ' ' + t('saveFailed')); }
                    } catch { alert(t('addError')); }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', borderRadius: '4px', fontSize: '0.8125rem', fontWeight: 600, backgroundColor: answerInput.trim() ? themeColors.primary : themeColors.border, color: answerInput.trim() ? (theme === 'yellow' ? '#333' : '#fff') : themeColors.textSecondary, border: 'none', cursor: answerInput.trim() ? 'pointer' : 'default', opacity: answerInput.trim() ? 1 : 0.6 }}>
                  {t('submitAnswer')}
                </button>
              </div>
            )}

          </div>{/* end 스크롤 바디 */}

          {/* 변경 이력 — 오른쪽 슬라이드 오버레이 패널 */}
          {isEditMode && showHistory && (() => {
            const relTime = (d: Date) => { const diff = Date.now() - d.getTime(), m = Math.floor(diff / 60000); if (m < 1) return t('justNow'); if (m < 60) return t('minutesAgo', { count: m }); const h = Math.floor(m / 60); if (h < 24) return t('hoursAgo', { count: h }); const day = Math.floor(h / 24); if (day < 7) return t('daysAgo', { count: day }); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
            const fullTime = (d: Date) => d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            return (
              <div className="history-slide" style={{ position: 'absolute' as const, top: 0, right: 0, bottom: 0, width: '272px', backgroundColor: isDark ? 'rgba(22,27,34,0.97)' : 'rgba(255,255,255,0.97)', borderLeft: `1px solid ${themeColors.border}`, display: 'flex', flexDirection: 'column' as const, zIndex: 10, backdropFilter: 'blur(6px)' }}>
                <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${themeColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={13} style={{ color: themeColors.primary }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.text, letterSpacing: '0.03em' }}>{t('changeHistory')}</span>
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
                      <p style={{ fontSize: '0.75rem', color: themeColors.textSecondary, opacity: 0.45 }}>{t('noHistory')}</p>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' as const }}>
                      <div style={{ position: 'absolute' as const, left: '9px', top: '10px', bottom: '10px', width: '1px', backgroundColor: themeColors.border }} />
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                        {historyLogs.map((log, i) => {
                          const isCreate = log.action === 'create', isDelete = log.action === 'delete';
                          const dotColor = isCreate ? themeColors.primary : isDelete ? '#EF4444' : (isDark ? '#6B7280' : '#9CA3AF');
                          const DotIcon = isCreate ? Plus : isDelete ? Trash2 : PenLine;
                          const ts = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                          return (
                            <div key={i} style={{ display: 'flex', gap: '10px', padding: '6px 0', alignItems: 'flex-start' }}>
                              <div style={{ width: '19px', height: '19px', borderRadius: '50%', backgroundColor: `${dotColor}18`, border: `1.5px solid ${dotColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', position: 'relative' as const, zIndex: 1 }}>
                                <DotIcon size={9} style={{ color: dotColor }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0, paddingBottom: i < historyLogs.length - 1 ? '4px' : 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' as const, marginBottom: '2px' }}>
                                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: `${themeColors.primary}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.5rem', fontWeight: 700, color: themeColors.primary }}>{(log.userName || '?').charAt(0)}</span>
                                  </div>
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: themeColors.text }}>{log.userName || '-'}</span>
                                  <span style={{ fontSize: '0.625rem', color: themeColors.textSecondary, opacity: 0.5 }}>·</span>
                                  <span title={fullTime(ts)} style={{ fontSize: '0.625rem', color: themeColors.textSecondary, cursor: 'default' }}>{relTime(ts)}</span>
                                  {(isCreate || isDelete) && <span style={{ fontSize: '0.5625rem', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', backgroundColor: `${dotColor}15`, color: dotColor }}>{isCreate ? t('logCreated') : t('delete')}</span>}
                                </div>
                                {log.details && <p style={{ fontSize: '0.625rem', color: themeColors.textSecondary, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderRadius: '4px', padding: '3px 6px', lineHeight: 1.5 }}>{log.details}</p>}
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

          {/* ── 하단 버튼 ── */}
          <div style={{ padding: '0.75rem 1.5rem', borderTop: `1px solid ${themeColors.border}`, display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            {/* 변경이력 토글 (edit 모드 + admin만) */}
            {isEditMode && isAdminAccount(user) && (
              <button
                onClick={toggleHistory}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer', color: showHistory ? themeColors.primary : themeColors.textSecondary, padding: '0.25rem 0' }}
              >
                <History size={13} />
                {t('changeHistory')}
                <ChevronRight size={12} style={{ transition: 'transform 0.2s', transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
            )}
            {/* 취소 / 추가·저장 */}
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              <button
                onClick={onClose}
                style={{ padding: '0.4375rem 1rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 500, backgroundColor: 'transparent', color: themeColors.textSecondary, border: `1px solid ${themeColors.border}`, cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >{t('cancel')}</button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isReadOnly}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.4375rem 1rem', borderRadius: '4px',
                  backgroundColor: themeColors.primary, color: onPrimaryText,
                  fontSize: '0.875rem', fontWeight: 600, border: 'none',
                  opacity: (isSubmitting || isReadOnly) ? 0.4 : 1,
                  cursor: (isSubmitting || isReadOnly) ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.1s',
                }}
              >
                <Save size={13} />
                {isSubmitting ? t('processing') : isEditMode ? t('save') : t('maintenanceAdd')}
              </button>
            </div>
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
    </>
  );
};

export default TaskCreateModal;
