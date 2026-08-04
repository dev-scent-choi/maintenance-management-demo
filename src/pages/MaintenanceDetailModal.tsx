import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import JSZip from 'jszip';
import { X, Upload, FileText, Image as ImageIcon, File as FileGeneric, Archive, Video, Download, Trash2, Eye, CheckCircle, XCircle, History, Wrench, Building2, User, Calendar, ChevronDown, RefreshCw } from 'lucide-react';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useAuthStore } from '../store/authStore';
import { isAdminAccount } from '../utils/permissions';
import { usePermission } from '../hooks/usePermission';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { useToast } from '../hooks/useToast';
import { useLanguage } from '../contexts/LanguageContext';
import FileViewer from '../components/FileViewer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { normalizeFileUrl } from '../config';
import type { UploadQueueItem } from '../utils/uploadWithProgress';
import type { MaintenanceRecord, MaintenanceFile, StatusHistory } from '../types';

const getFileIconInfo = (filename: string) => {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return { Icon: ImageIcon, color: '#8B5CF6' };
  if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) return { Icon: Video, color: '#F59E0B' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { Icon: Archive, color: '#F97316' };
  if (ext === 'pdf') return { Icon: FileText, color: '#EF4444' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { Icon: FileText, color: '#10B981' };
  if (['doc', 'docx', 'txt'].includes(ext)) return { Icon: FileText, color: '#3B82F6' };
  if (['ppt', 'pptx'].includes(ext)) return { Icon: FileText, color: '#F97316' };
  return { Icon: FileGeneric, color: '#6B7280' };
};

interface Props {
  isOpen: boolean;
  recordId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const MaintenanceDetailModal: React.FC<Props> = ({ isOpen, recordId, onClose, onUpdated }) => {
  const { maintenanceRecords, updateMaintenanceRecord, deleteMaintenanceRecord, companies, users, fetchCompanies, fetchUsers, uploadFile, deleteFile, fetchMaintenanceRecords } = useMaintenanceStore();
  const { user, token } = useAuthStore();
  const t = useLanguage();
  const { theme, language } = useSettingsStore((state) => state.settings);
  const themeColors = themeConfigs[theme];
  const toast = useToast();
  const isDark = theme !== 'light';
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(55,53,47,0.04)';
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const onPrimaryText = theme === 'yellow' ? '#333333' : '#fff';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const existingRecord = recordId ? maintenanceRecords.find(r => r.id === recordId) : null;

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [companyInputMode, setCompanyInputMode] = useState<'list' | 'manual'>('list');
  const [viewerFile, setViewerFile] = useState<MaintenanceFile | null>(null);
  const [originalStatus, setOriginalStatus] = useState<MaintenanceRecord['status'] | undefined>();
  const [statusChangeComment, setStatusChangeComment] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<MaintenanceRecord>>({});

  // draggable modal
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleDragStart = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDraggingModal(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDraggingModal) return;
    const onMove = (e: MouseEvent) => setModalPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    const onUp = () => setIsDraggingModal(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isDraggingModal]);

  // reset when recordId changes
  useEffect(() => {
    if (isOpen && recordId) {
      hasLoadedRef.current = false;
      setFormData({});
      setModalPos(null);
      setShowHistoryModal(false);
      setShowDeleteConfirm(false);
      setSaveState('idle');
      setStatusChangeComment('');
      setDescFocused(false);
      setIsDataReady(false);
      setHistoryLogs([]);
      fetchCompanies();
      fetchUsers();
    }
  }, [isOpen, recordId]);

  // load existing record into formData
  useEffect(() => {
    if (!existingRecord || companies.length === 0) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const matchedCompany = companies.find(c => c.name === existingRecord.companyName);
    setCompanyInputMode(matchedCompany ? 'list' : 'manual');
    setFormData({
      title: existingRecord.title || '',
      description: existingRecord.description || '',
      companyId: matchedCompany ? matchedCompany.id : '',
      companyName: existingRecord.companyName || '',
      status: existingRecord.status || 'pending',
      priority: existingRecord.priority || 'medium',
      assignedToName: existingRecord.assignedToName || '',
      assignedToId: existingRecord.assignedToId || '',
      startDate: existingRecord.startDate,
      expectedCompletionDate: existingRecord.expectedCompletionDate,
      actualCompletionDate: existingRecord.actualCompletionDate,
      category: existingRecord.category,
      files: existingRecord.files || [],
      comments: existingRecord.comments || [],
    });
    setOriginalStatus(existingRecord.status);

    setTimeout(() => {
      if (descriptionRef.current && existingRecord.description) {
        descriptionRef.current.innerHTML = existingRecord.description;
        // 설명 안의 이미지가 모두 로드된 후 모달 표시
        const imgs = Array.from(descriptionRef.current.querySelectorAll('img'));
        const unloaded = imgs.filter(img => !img.complete);
        if (unloaded.length === 0) {
          setIsDataReady(true);
        } else {
          Promise.all(
            unloaded.map(img => new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }))
          ).then(() => setIsDataReady(true));
        }
      } else {
        setIsDataReady(true);
      }
    }, 0);
  }, [existingRecord, companies]);

  const { can } = usePermission();

  if (!isOpen || !recordId || !isDataReady) return null;

  const canEdit = isAdminAccount(user);
  const canDownloadFile = can('download_files');
  const canUploadFile   = can('upload_files');
  const canDeleteFile   = can('delete_files');

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const filtered = data
          .filter((l: any) => String(l.resourceId) === String(recordId) && l.resourceType === 'maintenance')
          .map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }))
          .sort((a: any, b: any) => b.timestamp - a.timestamp);
        setHistoryLogs(filtered);
      }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  };

  const handleFieldUpdate = async (
    field: keyof MaintenanceRecord,
    newValue: MaintenanceRecord[keyof MaintenanceRecord],
    fieldLabel: string,
    displayNew?: string,
    displayOld?: string,
    additionalUpdates?: Partial<MaintenanceRecord>
  ) => {
    if (!existingRecord) return;
    const oldRaw = existingRecord[field];
    const oldStr = displayOld ?? String(oldRaw ?? '');
    const newStr = displayNew ?? String(newValue ?? '');
    if (String(oldRaw ?? '') === String(newValue ?? '') && !additionalUpdates) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    setSaveState('saving');
    try {
      let updatedStatusHistory = existingRecord.statusHistory || [];
      if (field === 'status') {
        const newEntry: StatusHistory = {
          id: Date.now().toString(),
          status: newValue as MaintenanceRecord['status'],
          comment: '',
          changedAt: new Date(),
          changedBy: user?.name || '관리자',
          changedById: user?.id || '',
        };
        updatedStatusHistory = [...updatedStatusHistory, newEntry];
      }
      const merged: Partial<MaintenanceRecord> = {
        title: formData.title,
        description: formData.description,
        companyName: formData.companyName,
        companyId: formData.companyId,
        priority: formData.priority,
        status: formData.status,
        assignedToId: formData.assignedToId,
        assignedToName: formData.assignedToName,
        startDate: formData.startDate,
        expectedCompletionDate: formData.expectedCompletionDate,
        category: formData.category,
        statusHistory: updatedStatusHistory,
        ...additionalUpdates,
        [field]: newValue,
      };
      await updateMaintenanceRecord(existingRecord.id, merged);
      // audit log 기록
      try {
        await fetch(import.meta.env.VITE_API_URL + '/audit-logs', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id, userName: user?.name, action: 'update',
            resourceType: 'maintenance', resourceId: existingRecord.id,
            resourceName: existingRecord.title || '',
            details: `${fieldLabel}: ${oldStr} → ${newStr}`,
          }),
        });
        if (showHistoryModal) fetchHistory();
      } catch { /* audit log 실패는 무시 */ }
      setSaveState('saved');
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
      onUpdated?.();
    } catch {
      setSaveState('failed');
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 3000);
      toast.error('저장에 실패했습니다.');
    }
  };

  const handleFileDownload = async (file: MaintenanceFile) => {
    try {
      if (!file.fileUrl) { toast.error('파일 URL이 없습니다.'); return; }
      if (file.fileUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = file.fileUrl; link.download = file.filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        toast.success(`${file.filename} 다운로드 완료`);
        return;
      }
      const response = await fetch(normalizeFileUrl(file.fileUrl));
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const contentDisposition = response.headers.get('content-disposition');
      let downloadFilename = file.filename;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match?.[1]) downloadFilename = match[1].replace(/['"]/g, '');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = downloadFilename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(url);
      if (user) {
        fetch(import.meta.env.VITE_API_URL + '/audit-logs', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id, userName: user.name, action: 'download',
            resourceType: 'file', resourceId: file.id, resourceName: file.filename,
            details: `유지보수 "${formData.title}"의 파일 "${file.filename}"을 다운로드했습니다.`,
          }),
        }).catch(() => {});
      }
      toast.success(`${file.filename} 다운로드 완료`);
    } catch (error) {
      toast.error(`파일 다운로드에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const handleDescriptionPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Image = event.target?.result as string;
            if (descriptionRef.current) {
              const selection = window.getSelection();
              const range = selection?.getRangeAt(0);
              const img = document.createElement('img');
              img.src = base64Image; img.style.maxWidth = '100%'; img.style.height = 'auto';
              img.style.margin = '10px 0'; img.style.borderRadius = '8px';
              img.style.border = `1px solid ${themeColors.border}`;
              if (range) { range.deleteContents(); range.insertNode(img); range.collapse(false); }
              else { descriptionRef.current.appendChild(img); }
              setFormData(prev => ({ ...prev, description: descriptionRef.current?.innerHTML || '' }));
              toast.success('이미지가 설명란에 추가되었습니다.');
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const processFiles = async (files: File[]) => {
    const queueItems: UploadQueueItem[] = files.map(f => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name, size: f.size, progress: 0, status: 'pending' as const,
    }));
    // 파일 선택 즉시 리스트에 표시 (React 18 자동 배치 우회 → 강제 동기 렌더)
    flushSync(() => setUploadQueue(queueItems));
    setIsUploadingFile(true);

    try {
      const results = await Promise.allSettled(
        files.map(async (file, i) => {
          const key = queueItems[i].key;
          flushSync(() => setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, status: 'uploading' } : x)));
          try {
            const uploadedFile = await uploadFile(recordId!, file, (pct) => {
              setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, progress: pct } : x));
            });
            setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, progress: 100, status: 'done' } : x));
            return { key, file: uploadedFile };
          } catch (err) {
            setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, status: 'error' } : x));
            toast.error(`${file.name} 업로드 실패`);
            throw err;
          }
        })
      );

      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<{ key: string; file: any }> => r.status === 'fulfilled')
        .map(r => r.value);
      const successKeys = new Set(succeeded.map(s => s.key));
      const uploadedFiles = succeeded.map(s => s.file);

      if (uploadedFiles.length > 0) {
        setFormData(prev => ({ ...prev, files: [...(prev.files || []), ...uploadedFiles] }));
        fetchMaintenanceRecords();
        onUpdated?.();
      }
      // 성공 항목 즉시 제거 → formData 업데이트와 동일 렌더 = 중복 row 없음
      setUploadQueue(prev => prev.filter(x => !successKeys.has(x.key)));
      if (results.some(r => r.status === 'rejected')) {
        setTimeout(() => setUploadQueue([]), 3000);
      }
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFilePreview = async (file: MaintenanceFile) => {
    if (!file.fileUrl) { toast.error('파일 URL이 없습니다.'); return; }
    const normalizedUrl = normalizeFileUrl(file.fileUrl);
    const normalizedFile = { ...file, fileUrl: normalizedUrl };
    if (normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('blob:')) { setViewerFile(normalizedFile); return; }
    // 백엔드 서버 변환 필요 파일: 원본 URL 그대로 전달 (blob 변환 시 서버 접근 불가)
    if (file.filename.toLowerCase().match(/\.(xlsx|xls|xlsm|xlsb|dwg|dxf|ppt|pptx)$/)) { setViewerFile(normalizedFile); return; }
    try {
      const response = await fetch(normalizedUrl, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Failed to fetch');
      const blob = await response.blob();
      setViewerFile({ ...normalizedFile, fileUrl: URL.createObjectURL(blob) });
    } catch { toast.error('파일을 불러올 수 없습니다.'); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { processFiles(Array.from(e.target.files)); e.target.value = ''; }
  };

  const handleRemoveFile = async (fileId: string) => {
    try {
      await deleteFile(fileId);
      setFormData(prev => ({ ...prev, files: prev.files?.filter(f => f.id !== fileId) || [] }));
      toast.success('파일이 삭제되었습니다.');
      onUpdated?.();
    } catch { toast.error('파일 삭제에 실패했습니다.'); }
  };

  const toggleFileSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const handleBulkFileDownload = async () => {
    const selected = formData.files?.filter((f) => selectedFileIds.has(f.id)) ?? [];
    if (selected.length === 0) return;
    if (selected.length === 1) { await handleFileDownload(selected[0]); return; }
    const toastId = toast.loading(`${selected.length}개 파일을 압축 중...`);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const zip = new JSZip();
      for (const f of selected) {
        if (!f.fileUrl) continue;
        const url = normalizeFileUrl(f.fileUrl.startsWith('http') ? f.fileUrl : `${apiBase}${f.fileUrl.startsWith('/') ? '' : '/'}${f.fileUrl}`);
        try {
          const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (!res.ok) continue;
          zip.file(f.filename, await res.blob());
        } catch { /* 개별 파일 실패 무시 */ }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const companyName = formData.companyName || '유지보수';
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const zipName = `유지보수_${companyName}_첨부파일_${dateStr}.zip`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content); a.download = zipName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.dismiss(toastId);
      toast.success(`${selected.length}개 파일을 ${zipName}으로 다운로드했습니다.`);
    } catch {
      toast.dismiss(toastId);
      toast.error('ZIP 파일 생성에 실패했습니다.');
    }
  };

  const handleBulkFileDelete = async () => {
    const files = formData.files?.filter(f => selectedFileIds.has(f.id)) ?? [];
    if (files.length === 0) return;
    try {
      // 병렬 삭제 (Promise.all)
      await Promise.all(files.map(f => deleteFile(f.id)));
      setFormData(prev => ({
        ...prev,
        files: prev.files?.filter(f => !selectedFileIds.has(f.id)) || [],
      }));
      toast.success(`${files.length}개 파일이 삭제되었습니다.`);
      fetchMaintenanceRecords();
      onUpdated?.();
    } catch {
      toast.error('일부 파일 삭제에 실패했습니다.');
    }
    setSelectedFileIds(new Set());
  };

  const handleDeleteRecord = async () => {
    if (!recordId) return;
    try {
      await deleteMaintenanceRecord(recordId);
      toast.success('유지보수 요청이 삭제되었습니다.');
      setShowDeleteConfirm(false);
      onUpdated?.();
      onClose();
    } catch { toast.error('삭제에 실패했습니다.'); }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.875rem',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.04)',
    border: `1px solid ${themeColors.border}`, color: themeColors.text, outline: 'none',
    colorScheme: isDark ? 'dark' : 'light',
  };

  const sectionCard: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(55,53,47,0.02)',
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px',
    padding: '14px 16px',
  };

  const sectionHead = (icon: React.ReactNode, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      <span style={{ color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ color: themeColors.textSecondary, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
        {label}
      </span>
    </div>
  );

  const STATUS_OPTIONS = [
    { key: 'pending',     label: t('statusWaiting') },
    { key: 'in-progress', label: t('statusProcessing') },
    { key: 'completed',   label: t('statusCompleted') },
    { key: 'urgent',      label: t('statusUrgent') },
    { key: 'on-hold',     label: t('statusOnHold') },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div
        ref={modalRef}
        className="fixed z-50 flex flex-col"
        style={{
          left: modalPos ? modalPos.x : '50%',
          top: modalPos ? modalPos.y : '50%',
          transform: modalPos ? 'none' : 'translate(-50%, -50%)',
          width: 'min(57.5rem, calc(100vw - 2rem))',
          height: 'min(42.5rem, calc(100vh - 3rem))',
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
          borderRadius: '14px',
          boxShadow: isDark
            ? '0 2px 4px rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.65)'
            : '0 2px 8px rgba(15,15,15,0.07), 0 8px 24px rgba(15,15,15,0.13)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3.5 flex-shrink-0"
          style={{
            borderBottom: `1px solid ${themeColors.border}`,
            cursor: isDraggingModal ? 'grabbing' : 'grab',
            userSelect: 'none',
            background: isDark
              ? `linear-gradient(135deg, ${themeColors.primary}14 0%, transparent 100%)`
              : `linear-gradient(135deg, ${themeColors.primary}0C 0%, transparent 100%)`,
          }}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${themeColors.primary}18` }}>
              <Wrench size={13} style={{ color: themeColors.primary }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>유지보수 관리</p>
              <h2 className="text-sm font-semibold leading-tight truncate max-w-[500px]" style={{ color: themeColors.text }}>
                {formData.title || existingRecord?.title || t('maintenanceDetail')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            {saveState !== 'idle' && (
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded" style={{
                color: saveState === 'saved' ? themeColors.primary : saveState === 'failed' ? '#EF4444' : themeColors.textSecondary,
                backgroundColor: saveState === 'saved' ? `${themeColors.primary}12` : saveState === 'failed' ? 'rgba(239,68,68,0.1)' : 'transparent',
                transition: 'all 0.2s ease',
              }}>
                {saveState === 'saving' ? (
                  <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z"/></svg>저장 중...</>
                ) : saveState === 'failed' ? (
                  <><X size={12} />저장 실패</>
                ) : (
                  <><CheckCircle size={12} />저장됨</>
                )}
              </span>
            )}

            {canEdit && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
              >
                <Trash2 size={13} />
                <span>{t('delete')}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-60 transition-opacity"
              style={{ color: themeColors.textSecondary, cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        {existingRecord ? (
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left: 업체 + 설명 + 첨부파일 */}
            <div
              className="flex-1 flex flex-col min-w-0 overflow-hidden px-5 py-4 gap-3"
            >

              {/* 업체 정보 */}
              <div style={sectionCard} className="flex-shrink-0">
                {sectionHead(<Building2 size={13} />, '업체 정보')}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-1">
                    {(['list', 'manual'] as const).map((mode) => (
                      <button key={mode} type="button"
                        onClick={() => setCompanyInputMode(mode)}
                        className="px-2 py-0.5 rounded text-xs font-medium transition-all"
                        style={{
                          backgroundColor: companyInputMode === mode ? themeColors.primary : 'transparent',
                          color: companyInputMode === mode ? onPrimaryText : themeColors.textSecondary,
                          border: `1px solid ${companyInputMode === mode ? themeColors.primary : themeColors.border}`,
                        }}>
                        {mode === 'list' ? '목록 선택' : '직접 입력'}
                      </button>
                    ))}
                  </div>
                </div>
                {companyInputMode === 'list' ? (
                  <select
                    value={formData.companyId || ''}
                    onChange={(e) => {
                      const c = companies.find(c => c.id === e.target.value);
                      const newName = c?.name || '';
                      setFormData({ ...formData, companyId: e.target.value, companyName: newName });
                      handleFieldUpdate('companyName', newName, '업체명', newName, formData.companyName || '없음', { companyId: e.target.value });
                    }}
                    style={{ ...inputStyle, height: '36px' }}
                  >
                    <option value="" style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>{t('selectCompany')}</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id} style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.companyName || ''}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value, companyId: '' })}
                    onBlur={() => handleFieldUpdate('companyName', formData.companyName, '업체명', formData.companyName || '없음', undefined, { companyId: '' })}
                    placeholder="예: ABC 주식회사"
                    style={inputStyle}
                  />
                )}
              </div>

              {/* 상세 설명 */}
              <div style={sectionCard} className="flex-shrink-0">
                {sectionHead(<FileText size={13} />, '상세 설명')}
                <style>{`[contenteditable] img { max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; border: 1px solid ${themeColors.border}; display: block; } [data-detail-ph]:empty:before { content: attr(data-detail-ph); color: ${themeColors.textSecondary}; opacity: 0.45; pointer-events: none; }`}</style>
                <div
                  ref={descriptionRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-detail-ph={t('maintenanceDescriptionPlaceholder')}
                  onFocus={() => setDescFocused(true)}
                  onBlur={(e) => {
                    const html = e.currentTarget.innerHTML;
                    setDescFocused(false);
                    handleFieldUpdate('description', html, '상세 설명');
                  }}
                  onPaste={handleDescriptionPaste}
                  onInput={(e) => { const html = e.currentTarget.innerHTML; setFormData(prev => ({ ...prev, description: html })); }}
                  style={{
                    height: '140px',
                    padding: '8px 12px',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)',
                    border: `1px solid ${descFocused ? themeColors.primary : themeColors.border}`,
                    borderRadius: '6px',
                    color: themeColors.text,
                    fontSize: '13px',
                    lineHeight: 1.7,
                    outline: 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowY: 'auto',
                    transition: 'border-color 0.15s',
                  }}
                />
              </div>

              {/* 첨부파일 — 프로젝트 상세 스타일 */}
              <div
                style={{ ...sectionCard, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
                onDragEnter={(e) => { if (!canUploadFile) return; e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingFile(false); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); setIsDraggingFile(false); if (!canUploadFile) return; const f = Array.from(e.dataTransfer.files); if (f.length > 0) processFiles(f); }}
              >
                {canUploadFile && (
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
                )}

                {/* 헤더 */}
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderBottom: filesCollapsed ? 'none' : `1px solid ${themeColors.border}`, cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => setFilesCollapsed(v => !v)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ChevronDown size={14} style={{ color: themeColors.textSecondary, opacity: 0.7, transition: 'transform 0.2s', transform: filesCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                    <input
                      type="checkbox"
                      checked={(formData.files?.length ?? 0) > 0 && (formData.files ?? []).every(f => selectedFileIds.has(f.id))}
                      ref={el => { if (el) el.indeterminate = selectedFileIds.size > 0 && !(formData.files ?? []).every(f => selectedFileIds.has(f.id)); }}
                      onChange={e => { e.stopPropagation(); const allSel = (formData.files ?? []).every(f => selectedFileIds.has(f.id)); allSel ? setSelectedFileIds(new Set()) : setSelectedFileIds(new Set((formData.files ?? []).map(f => f.id))); }}
                      onClick={e => e.stopPropagation()}
                      className="w-3 h-3" style={{ accentColor: themeColors.primary, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text }}>첨부파일</span>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 5px', borderRadius: '10px', backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>
                      {(formData.files?.length ?? 0) + uploadQueue.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                    {selectedFileIds.size > 0 && canDownloadFile && (
                      <button onClick={handleBulkFileDownload}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: themeColors.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '3px' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <Download size={11} /> {selectedFileIds.size}개 다운
                      </button>
                    )}
                    {selectedFileIds.size > 0 && canDeleteFile && (
                      <button onClick={handleBulkFileDelete}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '3px' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <Trash2 size={11} /> 삭제
                      </button>
                    )}
                    {canUploadFile && (
                      <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: themeColors.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '3px' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <Upload size={11} /> 업로드
                      </button>
                    )}
                  </div>
                </div>

                {/* 파일 영역 */}
                {!filesCollapsed && (
                  <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(!formData.files?.length && uploadQueue.length === 0) ? (
                      canUploadFile ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '1.25rem 1rem', cursor: 'pointer', border: `1px dashed ${isDraggingFile ? themeColors.primary : themeColors.border}`, borderRadius: '0 0 4px 4px', backgroundColor: isDraggingFile ? `${themeColors.primary}0A` : 'transparent', transition: 'all 0.15s' }}
                          onMouseEnter={e => { if (!isDraggingFile) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)'; }}
                          onMouseLeave={e => { if (!isDraggingFile) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Upload size={16} style={{ color: isDraggingFile ? themeColors.primary : themeColors.textSecondary, opacity: isDraggingFile ? 1 : 0.4 }} />
                          <span style={{ fontSize: '0.75rem', color: isDraggingFile ? themeColors.primary : themeColors.textSecondary, fontWeight: 500 }}>
                            {isDraggingFile ? '여기에 놓으세요' : '클릭하거나 드래그하여 파일 첨부'}
                          </span>
                        </div>
                      ) : (
                        <div style={{ padding: '1.25rem', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, opacity: 0.45 }}>첨부된 파일이 없습니다</span>
                        </div>
                      )
                    ) : (
                      <>
                        {isDraggingFile && canUploadFile && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', pointerEvents: 'none', zIndex: 2, backgroundColor: `${themeColors.primary}10`, border: `1px dashed ${themeColors.primary}`, borderRadius: '0 0 4px 4px' }}>
                            <Upload size={18} style={{ color: themeColors.primary }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.primary }}>여기에 파일을 놓으세요</span>
                          </div>
                        )}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                          {uploadQueue.map(item => {
                            const { Icon: UpIcon, color: upColor } = getFileIconInfo(item.name);
                            const barColor = item.status === 'done' ? '#10B981' : item.status === 'error' ? '#EF4444' : themeColors.primary;
                            return (
                              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderTop: `1px solid ${themeColors.border}`, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(55,53,47,0.015)' }}>
                                <div style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0 }} />
                                <div style={{ flexShrink: 0, width: '1.25rem', height: '1.25rem', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${upColor}15` }}>
                                  <UpIcon size={10} style={{ color: upColor }} />
                                </div>
                                <p style={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, color: themeColors.text }}>{item.name}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, minWidth: '100px' }}>
                                  <div style={{ flex: 1, height: '3px', borderRadius: '99px', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.06)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${item.status === 'done' ? 100 : item.progress}%`, borderRadius: '99px', backgroundColor: barColor, transition: 'width 0.15s ease' }} />
                                  </div>
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: barColor, flexShrink: 0, minWidth: '28px', textAlign: 'right' }}>
                                    {item.status === 'done' ? '완료' : item.status === 'error' ? '실패' : item.status === 'pending' ? '대기' : `${item.progress}%`}
                                  </span>
                                </div>
                                <div style={{ flexShrink: 0, width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {item.status === 'done' && <CheckCircle size={13} style={{ color: '#10B981' }} />}
                                  {item.status === 'error' && <XCircle size={13} style={{ color: '#EF4444' }} />}
                                  {(item.status === 'uploading' || item.status === 'pending') && <RefreshCw size={12} className={item.status === 'uploading' ? 'animate-spin' : ''} style={{ color: themeColors.textSecondary, opacity: item.status === 'pending' ? 0.35 : 1 }} />}
                                </div>
                              </div>
                            );
                          })}
                          {(formData.files || []).map(file => {
                            const { Icon: FileIconComp, color: iconColor } = getFileIconInfo(file.filename || '');
                            const isSelected = selectedFileIds.has(file.id);
                            return (
                              <div key={file.id}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderTop: `1px solid ${themeColors.border}`, backgroundColor: isSelected ? `${themeColors.primary}08` : 'transparent', transition: 'background-color 0.1s', cursor: 'pointer' }}
                                onClick={() => handleFilePreview(file)}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isSelected ? `${themeColors.primary}12` : hoverBg)}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isSelected ? `${themeColors.primary}08` : 'transparent')}
                              >
                                <input type="checkbox" checked={isSelected} onChange={() => {}} onClick={e => toggleFileSelect(file.id, e)} className="w-3 h-3 flex-shrink-0" style={{ accentColor: themeColors.primary, cursor: 'pointer' }} />
                                <div style={{ flexShrink: 0, width: '1.25rem', height: '1.25rem', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: file.isImage ? 'transparent' : `${iconColor}15` }}>
                                  {file.isImage && file.fileUrl
                                    ? <img src={file.fileUrl} alt={file.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px' }} />
                                    : <FileIconComp size={10} style={{ color: iconColor }} />}
                                </div>
                                <p style={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, color: themeColors.text }}>{file.filename}</p>
                                {file.size != null && <span style={{ fontSize: '0.6875rem', flexShrink: 0, color: themeColors.textSecondary, marginRight: '0.25rem' }}>{formatFileSize(file.size)}</span>}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                  <button onClick={e => { e.stopPropagation(); handleFilePreview(file); }} title="미리보기"
                                    style={{ padding: '4px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; (e.currentTarget.style.color as any) = themeColors.primary; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; (e.currentTarget.style.color as any) = themeColors.textSecondary; }}>
                                    <Eye size={13} />
                                  </button>
                                  {canDownloadFile && (
                                    <button onClick={e => { e.stopPropagation(); handleFileDownload(file); }} title="다운로드"
                                      style={{ padding: '4px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; (e.currentTarget.style.color as any) = themeColors.primary; }}
                                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; (e.currentTarget.style.color as any) = themeColors.textSecondary; }}>
                                      <Download size={13} />
                                    </button>
                                  )}
                                  {canDeleteFile && (
                                    <button onClick={e => { e.stopPropagation(); handleRemoveFile(file.id); }} title="삭제"
                                      style={{ padding: '4px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; (e.currentTarget.style.color as any) = '#EF4444'; }}
                                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; (e.currentTarget.style.color as any) = themeColors.textSecondary; }}>
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 세로 구분선 */}
            <div className="flex-shrink-0" style={{ width: '1px', backgroundColor: themeColors.border, marginTop: '16px', marginBottom: '16px' }} />

            {/* Right: 메타 정보 */}
            <div className="w-[268px] flex-shrink-0 px-5 py-4 flex flex-col gap-3 overflow-y-auto">

              {/* 상태 */}
              <div style={sectionCard}>
                {sectionHead(
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" strokeLinecap="round"/></svg>,
                  '상태'
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const isActive = formData.status === opt.key;
                    return (
                      <button key={opt.key} type="button"
                        onClick={() => {
                          const newStatus = opt.key as MaintenanceRecord['status'];
                          setFormData({ ...formData, status: newStatus });
                          handleFieldUpdate('status', newStatus, '상태', opt.label,
                            STATUS_OPTIONS.find(o => o.key === formData.status)?.label || formData.status
                          );
                        }}
                        className="py-1.5 text-xs font-medium transition-all text-center"
                        style={{
                          borderRadius: '4px',
                          border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
                          backgroundColor: isActive ? `${themeColors.primary}18` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)'),
                          color: isActive ? themeColors.primary : themeColors.textSecondary,
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {originalStatus && formData.status !== originalStatus && (
                  <div className="mt-3 p-3 rounded"
                    style={{ backgroundColor: isDark ? 'rgba(255,215,0,0.08)' : 'rgba(255,215,0,0.05)', border: `1px solid ${isDark ? 'rgba(255,215,0,0.25)' : 'rgba(200,160,0,0.2)'}` }}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>{t('statusChangeReason')}</label>
                    <textarea value={statusChangeComment} onChange={(e) => setStatusChangeComment(e.target.value)}
                      placeholder="예: 작업 완료로 상태 변경" rows={2}
                      className="w-full px-3 py-2 rounded text-xs focus:outline-none resize-none"
                      style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, color: themeColors.text }} />
                  </div>
                )}
              </div>

              {/* 담당자 */}
              <div style={sectionCard}>
                {sectionHead(<User size={13} />, '담당자')}
                <select value={formData.assignedToId || ''}
                  onChange={(e) => {
                    const u = users.find(u => u.id === e.target.value);
                    const newName = u?.name || '';
                    setFormData({ ...formData, assignedToId: e.target.value, assignedToName: newName });
                    handleFieldUpdate('assignedToName', newName, '담당자', newName || '없음', formData.assignedToName || '없음', { assignedToId: e.target.value });
                  }}
                  style={{ ...inputStyle, height: '36px' }}>
                  <option value="" style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>{t('selectAssignee')}</option>
                  {users.filter((u, i, arr) => i === arr.findIndex(x => x.id === u.id)).map(u => (
                    <option key={u.id} value={u.id} style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>
                      {u.name} ({u.department})
                    </option>
                  ))}
                </select>
                {formData.assignedToName && (
                  <div className="flex items-center gap-2.5 mt-2.5 p-2.5 rounded"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-xs"
                      style={{ backgroundColor: themeColors.primary }}>
                      {formData.assignedToName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: themeColors.text }}>{formData.assignedToName}</p>
                      <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('assignee')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 일정 */}
              <div style={sectionCard}>
                {sectionHead(<Calendar size={13} />, '일정')}
                <div className="space-y-2.5">
                  <div>
                    <p style={{ color: themeColors.textSecondary, fontSize: '11px', marginBottom: '5px' }}>요청일</p>
                    <input type="date"
                      value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const newDate = e.target.value ? new Date(e.target.value) : undefined;
                        setFormData({ ...formData, startDate: newDate });
                        handleFieldUpdate('startDate', newDate, '요청일', e.target.value ? new Date(e.target.value).toLocaleDateString('ko-KR') : '-');
                      }}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      style={inputStyle} />
                  </div>
                  <div>
                    <p style={{ color: themeColors.textSecondary, fontSize: '11px', marginBottom: '5px' }}>완료 예정일</p>
                    <input type="date"
                      value={formData.expectedCompletionDate ? new Date(formData.expectedCompletionDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const newDate = e.target.value ? new Date(e.target.value) : undefined;
                        setFormData({ ...formData, expectedCompletionDate: newDate });
                        handleFieldUpdate('expectedCompletionDate', newDate, '완료 예정일', e.target.value ? new Date(e.target.value).toLocaleDateString('ko-KR') : '-');
                      }}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      style={inputStyle} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <LoadingSpinner variant="inline" size="md" message="불러오는 중..." />
        )}

      {/* 변경 이력 패널 (하단 인라인) */}
      {showHistoryModal && (
        <div className="flex-shrink-0" style={{ borderTop: `1px solid ${themeColors.border}`, maxHeight: '220px', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
            <div className="flex items-center gap-2">
              <History size={13} style={{ color: themeColors.primary }} />
              <span className="text-xs font-semibold" style={{ color: themeColors.text }}>{language === 'ko' ? '변경 이력' : 'Change History'}</span>
              {historyLogs.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: themeColors.textSecondary }}>
                  {historyLogs.length}건
                </span>
              )}
            </div>
            <button onClick={() => setShowHistoryModal(false)}
              className="w-6 h-6 rounded flex items-center justify-center transition-all hover:opacity-60"
              style={{ color: themeColors.textSecondary }}>
              <X size={13} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-5 py-2">
            {historyLoading ? (
              <div className="flex items-center justify-center py-4">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" style={{ color: themeColors.primary }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z"/>
                </svg>
              </div>
            ) : historyLogs.length > 0 ? (
              <div className="space-y-0">
                {historyLogs.map((log, i) => {
                  const actionColor = log.action === 'create' ? themeColors.primary : log.action === 'delete' ? '#EF4444' : themeColors.textSecondary;
                  const actionLabel = log.action === 'create' ? '등록' : log.action === 'delete' ? '삭제' : '수정';
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
                    <div key={i} className="py-2" style={{ borderBottom: i < historyLogs.length - 1 ? `1px solid ${themeColors.border}` : 'none' }}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${actionColor}18`, color: actionColor }}>{actionLabel}</span>
                        <span className="text-xs font-medium" style={{ color: themeColors.text }}>{log.userName || '-'}</span>
                        <span className="text-xs" style={{ color: themeColors.textSecondary }}>
                          {log.timestamp instanceof Date
                            ? log.timestamp.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </span>
                      </div>
                      {parsedChanges.length > 0 ? (
                        <div className="flex flex-col gap-0.5 pl-1">
                          {parsedChanges.map((c, ci) => (
                            <div key={ci} className="flex items-baseline gap-1.5 text-xs flex-wrap">
                              <span className="font-medium flex-shrink-0" style={{ color: themeColors.textSecondary }}>{c.field}</span>
                              {c.oldValue ? (<span className="px-1 rounded" style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: isDark ? '#F87171' : '#DC2626', textDecoration: 'line-through' }}>{c.oldValue}</span>) : (<span style={{ color: themeColors.textSecondary, opacity: 0.5 }}>없음</span>)}
                              <span style={{ color: themeColors.textSecondary }}>→</span>
                              <span className="px-1 rounded" style={{ backgroundColor: isDark ? 'rgba(63,185,80,0.12)' : 'rgba(34,197,94,0.08)', color: isDark ? '#3FB950' : '#16A34A' }}>{c.newValue || '없음'}</span>
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
            ) : (
              <div className="flex items-center justify-center py-4" style={{ color: themeColors.textSecondary }}>
                <p className="text-xs">{language === 'ko' ? '변경 이력이 없습니다.' : 'No change history.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderTop: `1px solid ${themeColors.border}` }}>
        {isAdminAccount(user) ? (
          <button type="button" onClick={() => { setShowHistoryModal(v => !v); if (!showHistoryModal) fetchHistory(); }}
            className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
            style={{ color: showHistoryModal ? themeColors.primary : themeColors.textSecondary }}>
            <History size={13} />
            {language === 'ko' ? '변경 이력' : 'Change History'}
            <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: showHistoryModal ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>
        ) : <div />}
        <button type="button" onClick={onClose}
          className="px-4 py-1.5 text-sm font-medium rounded transition-opacity hover:opacity-60"
          style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}`, borderRadius: '4px' }}>
          {language === 'ko' ? '닫기' : 'Close'}
        </button>
      </div>
      </div>

      {/* 파일 뷰어 */}
      {viewerFile && (
        <FileViewer
          fileUrl={viewerFile.fileUrl}
          filename={viewerFile.filename}
          onClose={() => { if (viewerFile.fileUrl.startsWith('blob:')) URL.revokeObjectURL(viewerFile.fileUrl); setViewerFile(null); }}
        />
      )}

      {/* 삭제 확인 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div className="rounded max-w-sm w-full p-5"
            style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                <Trash2 size={18} style={{ color: '#EF4444' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('deleteConfirmTitle')}</h3>
                <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('irreversibleWarning')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDeleteRecord} className="flex-1 px-3 py-2 rounded font-medium text-white text-xs bg-red-500 hover:bg-red-600 transition-colors">
                {t('delete')}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-3 py-2 rounded font-medium text-xs transition-colors"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', color: themeColors.text }}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MaintenanceDetailModal;
