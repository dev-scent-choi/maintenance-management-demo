import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { X, Wrench, Save, Upload, FileText, Image as ImageIcon, File as FileGeneric, Archive, Video, Trash2, Building2, Download, CheckCircle, XCircle, History, ChevronRight, Plus, PenLine, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { isAdminAccount } from '../utils/permissions';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../hooks/useToast';
import JSZip from 'jszip';
import FileViewer from '../components/FileViewer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { normalizeFileUrl } from '../config';
import type { MaintenanceRecord, MaintenanceFile, StatusHistory } from '../types';
import type { UploadQueueItem } from '../utils/uploadWithProgress';

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
  onClose: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  onReady?: () => void;
  recordId?: string | null;
}

const MaintenanceCreateModal: React.FC<Props> = ({ isOpen, onClose, onCreated, onUpdated, onReady, recordId }) => {
  const t = useLanguage();
  const theme = useSettingsStore((s) => s.settings.theme);
  const { language } = useSettingsStore((s) => s.settings);
  const themeColors = themeConfigs[theme];
  const { user, token } = useAuthStore();
  const {
    maintenanceRecords,
    addMaintenanceRecord,
    updateMaintenanceRecord,
    deleteMaintenanceRecord,
    uploadFile,
    deleteFile,
    fetchMaintenanceRecords,
    companies,
    users,
    fetchCompanies,
    fetchUsers,
  } = useMaintenanceStore();
  const toast = useToast();
  const isDark = theme !== 'light';
  const onPrimaryText = theme === 'yellow' ? '#333' : '#fff';

  const isEditMode = !!recordId;

  const [isSaving, setIsSaving] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isWide, setIsWide] = useState(false);
  const [companyInputMode, setCompanyInputMode] = useState<'list' | 'manual'>('list');
  const [requesterMode, setRequesterMode] = useState<'list' | 'manual'>('list');
  const [companyContacts, setCompanyContacts] = useState<{ id: string; name: string; role?: string }[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [descFocused, setDescFocused] = useState(false);
  const [files, setFiles] = useState<MaintenanceFile[]>([]);
  const descRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** contenteditable의 innerHTML을 가져올 때 <br> 등 빈 상태를 빈 문자열로 정규화 */
  const getDescHtml = () => {
    const raw = descRef.current?.innerHTML ?? '';
    const stripped = raw.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').trim();
    return stripped === '' ? '' : raw;
  };

  // edit mode state
  const [formData, setFormData] = useState<Partial<MaintenanceRecord>>({});
  const [isDataReady, setIsDataReady] = useState(false);
  const [loadedRecordId, setLoadedRecordId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewerFile, setViewerFile] = useState<MaintenanceFile | null>(null);
  const hasLoadedRef = useRef(false);

  // create mode state
  const [form, setForm] = useState({
    companyId: '',
    companyName: '',
    description: '',
    status: 'pending' as MaintenanceRecord['status'],
    priority: 'medium' as MaintenanceRecord['priority'],
    workType: '버그',
    requesterName: '',
    assignedToId: '',
    assignedToName: '',
    startDate: new Date().toISOString().split('T')[0],
    expectedCompletionDate: '',
    estimatedHours: '',
    actualHours: '',
    completionResult: '',
    testStatus: '',
    deploymentLocation: '',
    actualCompletionDate: '',
  });

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

  // 업체 선택 시 담당자 목록 fetch
  const currentCompanyId = isEditMode ? formData.companyId : form.companyId;
  useEffect(() => {
    setRequesterMode('list');
    if (!currentCompanyId || !token) { setCompanyContacts([]); return; }
    fetch(`${import.meta.env.VITE_API_URL}/companies/${currentCompanyId}/contacts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCompanyContacts(Array.isArray(data) ? data : []))
      .catch(() => setCompanyContacts([]));
  }, [currentCompanyId, token]);

  // open effect
  useEffect(() => {
    if (!isOpen) return;
    fetchCompanies();
    fetchUsers();
    setModalPos(null);
    setShowHistoryModal(false);
    setShowDeleteConfirm(false);
    setHistoryLogs([]);

    if (isEditMode) {
      hasLoadedRef.current = false;
      setFormData({});
      setSaveState('idle');
      setDescFocused(false);
      setIsDataReady(false);
      setFiles([]);
    } else {
      setForm({
        companyId: '', companyName: '', description: '',
        status: 'pending', priority: 'medium', workType: '버그', requesterName: '',
        assignedToId: '', assignedToName: '',
        startDate: new Date().toISOString().split('T')[0],
        expectedCompletionDate: '',
        estimatedHours: '', actualHours: '',
        completionResult: '', testStatus: '', deploymentLocation: '', actualCompletionDate: '',
      });
      setFiles([]);
      setCompanyInputMode('list');
      setTimeout(() => { if (descRef.current) descRef.current.innerHTML = ''; }, 0);
    }
  }, [isOpen, recordId]);

  const existingRecord = recordId ? maintenanceRecords.find((r) => r.id === recordId) : null;

  // load existing record into formData (edit mode)
  // companies.length 조건 제거 — 대시보드에서 companies가 아직 로딩 중이어도 레코드 데이터를 즉시 로드
  useEffect(() => {
    if (!isEditMode) return;
    if (!existingRecord) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const matchedCompany = companies.find((c) => c.name === existingRecord.companyName);
    setCompanyInputMode(matchedCompany ? 'list' : 'manual');
    // companies가 아직 없으면 existingRecord.companyId를 fallback으로 사용
    const companyId = matchedCompany ? matchedCompany.id : (existingRecord.companyId || '');
    setFormData({
      title: existingRecord.title || '',
      description: existingRecord.description || '',
      companyId,
      companyName: existingRecord.companyName || '',
      status: existingRecord.status || 'pending',
      priority: existingRecord.priority || 'medium',
      assignedToName: existingRecord.assignedToName || '',
      assignedToId: existingRecord.assignedToId || '',
      startDate: existingRecord.startDate,
      expectedCompletionDate: existingRecord.expectedCompletionDate,
      actualCompletionDate: existingRecord.actualCompletionDate,
      category: existingRecord.category,
      workType: existingRecord.workType,
      requesterName: existingRecord.requesterName,
      estimatedHours: existingRecord.estimatedHours,
      actualHours: existingRecord.actualHours,
      completionResult: existingRecord.completionResult,
      testStatus: existingRecord.testStatus,
      deploymentLocation: existingRecord.deploymentLocation,
      files: existingRecord.files || [],
      comments: existingRecord.comments || [],
    });

    // 업체 담당자(요청자) 목록을 먼저 로딩한 뒤 팝업 표시
    if (companyId && token) {
      setRequesterMode('list');
      fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setCompanyContacts(Array.isArray(data) ? data : []))
        .catch(() => setCompanyContacts([]))
        .finally(() => { setIsDataReady(true); setLoadedRecordId(recordId ?? null); });
    } else {
      setCompanyContacts([]);
      setIsDataReady(true);
      setLoadedRecordId(recordId ?? null);
    }
  }, [existingRecord, companies, isEditMode, isOpen]);

  // 레코드 미발견 빈 상태 처리: companies가 로드됐는데도 record가 없으면 로딩 스피너 해제
  useEffect(() => {
    if (!isEditMode || !isOpen || !recordId) return;
    if (existingRecord) return;          // 정상 경로에서 처리됨
    if (hasLoadedRef.current) return;    // 이미 처리됨
    if (companies.length === 0) return;  // companies 로딩 대기
    // companies는 로드됐지만 해당 record가 store에 없는 경우 → 로딩 스피너 해제
    hasLoadedRef.current = true;
    setLoadedRecordId(recordId);
    setIsDataReady(true);
  }, [isEditMode, isOpen, recordId, existingRecord, companies]);

  // 렌더 후 descRef에 HTML 주입 (isDataReady → DOM 마운트 후)
  useEffect(() => {
    if (!isDataReady || !isEditMode) return;
    if (descRef.current && existingRecord?.description) {
      descRef.current.innerHTML = existingRecord.description;
    }
  }, [isDataReady, isEditMode]);

  useEffect(() => {
    if (isOpen && isDataReady) onReady?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataReady, isOpen]);

  if (!isOpen) return null;

  // ── helpers ──────────────────────────────────────────────────────────────

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const processNewFiles = (rawFiles: FileList | File[]) => {
    const arr = Array.from(rawFiles);

    // 파일 선택 즉시 리스트에 표시 (flushSync → 강제 동기 렌더)
    const queueItems: UploadQueueItem[] = arr.map((f, i) => ({
      key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      name: f.name, size: f.size, progress: 0, status: 'pending' as const,
    }));
    flushSync(() => setUploadQueue(queueItems));

    // FileReader로 병렬 읽기
    const promises = arr.map((file, idx) =>
      new Promise<MaintenanceFile>((resolve) => {
        const key = queueItems[idx].key;
        setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, status: 'uploading' } : x));
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, progress: 100, status: 'done' } : x));
          resolve({
            id: `tmp-${Date.now()}-${Math.random()}`,
            maintenanceId: '',
            filename: file.name,
            fileUrl: e.target?.result as string,
            fileType: file.type,
            size: file.size,
            uploadedAt: new Date(),
            uploadedBy: user?.name || '',
            uploadedById: user?.id || '',
            isImage: file.type.startsWith('image/'),
            version: 1,
            file,
          });
        };
        reader.readAsDataURL(file);
      })
    );

    const successKeys = new Set(queueItems.map(q => q.key));
    Promise.all(promises).then((newFiles) => {
      // formData 추가 + 큐 항목 즉시 제거 (동일 렌더 = 중복 없음)
      setFiles(prev => [...prev, ...newFiles]);
      setUploadQueue(prev => prev.filter(x => !successKeys.has(x.key)));
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processNewFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) processNewFiles(e.dataTransfer.files);
  };

  const removeNewFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleFilePreview = async (file: MaintenanceFile) => {
    if (!file.fileUrl) { toast.error(t('fileUrlMissing')); return; }
    const normalizedUrl = normalizeFileUrl(file.fileUrl);
    const normalizedFile = { ...file, fileUrl: normalizedUrl };
    // 백엔드 서버 변환 필요 파일: 원본 URL 그대로 전달 (blob 변환 시 서버 접근 불가)
    if (file.filename.toLowerCase().match(/\.(xlsx|xls|xlsm|xlsb|dwg|dxf|ppt|pptx)$/)) { setViewerFile(normalizedFile); return; }
    if (normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('blob:')) { setViewerFile(normalizedFile); return; }
    try {
      const response = await fetch(normalizedUrl, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Failed to fetch');
      const blob = await response.blob();
      setViewerFile({ ...normalizedFile, fileUrl: URL.createObjectURL(blob) });
    } catch { toast.error(t('fileLoadFailed')); }
  };

  const handleFileDownload = async (file: MaintenanceFile) => {
    try {
      if (!file.fileUrl) { toast.error(t('fileUrlMissing')); return; }
      if (file.fileUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = file.fileUrl; link.download = file.filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        toast.success(t('fileDownloadSuccess', { name: file.filename }));
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
      toast.success(t('fileDownloadSuccess', { name: file.filename }));
    } catch (error) {
      toast.error(`${t('fileDownloadFailed')}: ${error instanceof Error ? error.message : t('unknown')}`);
    }
  };

  const handleDeleteExistingFile = async (fileId: string) => {
    if (!recordId) return;
    try {
      await deleteFile(fileId);
      setFormData((prev) => ({ ...prev, files: prev.files?.filter((f) => f.id !== fileId) || [] }));
      await fetchMaintenanceRecords();
      toast.success(t('fileDeleteSuccess'));
    } catch { toast.error(t('fileDeleteFailed')); }
  };

  const toggleFileSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const handleBulkFileDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const selected = existingFiles.filter((f) => selectedFileIds.has(f.id));
    if (selected.length === 0) return;
    if (selected.length === 1) { await handleFileDownload(selected[0]); return; }
    const toastId = toast.loading(t('zipCompressing', { count: selected.length }));
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
      const companyName = (isEditMode ? formData.companyName : form.companyName) || '유지보수';
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const zipName = `유지보수_${companyName}_첨부파일_${dateStr}.zip`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content); a.download = zipName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.dismiss(toastId);
      toast.success(t('zipDownloaded', { count: selected.length }));
    } catch {
      toast.dismiss(toastId);
      toast.error(t('zipFailed'));
    }
  };

  const handleBulkFileDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const selectedExisting = existingFiles.filter((f) => selectedFileIds.has(f.id));
    const selectedNew = files.filter((f) => selectedFileIds.has(f.id));
    for (const f of selectedExisting) await handleDeleteExistingFile(f.id);
    for (const f of selectedNew) removeNewFile(f.id);
    setSelectedFileIds(new Set());
  };

  const handleDeleteRecord = async () => {
    if (!recordId) return;
    try {
      await deleteMaintenanceRecord(recordId);
      toast.success(t('maintenanceDeleteSuccess'));
      setShowDeleteConfirm(false);
      onClose();
    } catch { toast.error(t('deleteFailed')); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const statusLabel: Record<string, string> = {
      pending: '대기', 'in-progress': '진행중', completed: '완료', urgent: '긴급', 'on-hold': '보류',
    };
    try {
      let auditEntries: any[] = [];
      try {
        const res = await fetch(import.meta.env.VITE_API_URL + '/audit-logs', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          auditEntries = data
            .filter((l: any) => String(l.resourceId) === String(recordId) && l.resourceType === 'maintenance')
            .map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
        }
      } catch { /* silent */ }

      // Merge statusHistory from the record itself (deduped by timestamp+status)
      const statusEntries: any[] = (existingRecord?.statusHistory || []).map((h) => ({
        action: 'update',
        userName: h.changedBy,
        timestamp: h.changedAt instanceof Date ? h.changedAt : new Date(h.changedAt),
        details: `상태: ${statusLabel[h.status] || h.status}`,
        resourceId: recordId,
        resourceType: 'maintenance',
        _fromStatusHistory: true,
      }));

      // Prefer audit entries for same timestamp; dedupe by rounded timestamp
      const auditTimes = new Set(auditEntries.map((e) => Math.round(e.timestamp.getTime() / 1000)));
      const dedupedStatus = statusEntries.filter(
        (e) => !auditTimes.has(Math.round(e.timestamp.getTime() / 1000))
      );

      const merged = [...auditEntries, ...dedupedStatus].sort((a, b) => b.timestamp - a.timestamp);
      setHistoryLogs(merged);
    } finally { setHistoryLoading(false); }
  };

  // ── description 이미지 paste ──────────────────────────────────────────────
  const handleDescPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const img = document.createElement('img');
          img.src = dataUrl;
          img.style.cssText = 'max-width:100%;height:auto;border-radius:6px;margin:8px 0;display:block;border:1px solid rgba(0,0,0,0.08);';
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
          // 붙여넣기 후 상태 동기화
          const html = descRef.current?.innerHTML || '';
          if (isEditMode) setFormData((prev) => ({ ...prev, description: html }));
          else setForm((prev) => ({ ...prev, description: html }));
        };
        reader.readAsDataURL(blob);
        return; // 첫 번째 이미지만 처리
      }
    }
  };

  // ── create submit ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) { toast.error(t('companySelectOrInput')); return; }
    if (!form.workType.trim()) { toast.error(t('workTypeSelectRequired')); return; }
    if (!form.requesterName.trim()) { toast.error(t('requesterRequired')); return; }
    setIsSaving(true);
    const autoTitle = form.companyName
      ? `${form.companyName} 유지보수 요청`
      : `유지보수 요청 ${new Date().toLocaleDateString('ko-KR')}`;
    try {
      const record: MaintenanceRecord = {
        id: Date.now().toString(),
        title: autoTitle,
        description: getDescHtml(),
        companyId: form.companyId,
        companyName: form.companyName,
        status: form.status,
        priority: form.priority,
        workType: form.workType || undefined,
        requesterName: form.requesterName || undefined,
        assignedToId: form.assignedToId,
        assignedToName: form.assignedToName,
        startDate: form.startDate ? new Date(form.startDate) : new Date(),
        expectedCompletionDate: form.expectedCompletionDate ? new Date(form.expectedCompletionDate) : undefined,
        estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
        actualHours: form.actualHours ? parseFloat(form.actualHours) : undefined,
        completionResult: form.completionResult || undefined,
        testStatus: form.testStatus || undefined,
        deploymentLocation: form.deploymentLocation || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        files: [],
        comments: [],
        statusHistory: [],
      };
      const created = await addMaintenanceRecord(record);

      if (files.length > 0) {
        await Promise.all(
          files.filter(f => f.file).map(f => uploadFile(created.id, f.file!).catch(() => {}))
        );
        await fetchMaintenanceRecords();
      }

      toast.success(t('maintenanceRegistered'));
      onCreated?.();
      onClose();
    } catch {
      toast.error(t('registrationFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── edit save ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!recordId) return;
    setIsSaving(true);
    setSaveState('saving');
    const description = getDescHtml();

    // 상태 변경 이력 추가
    let updatedStatusHistory = existingRecord?.statusHistory || [];
    if (formData.status && formData.status !== existingRecord?.status) {
      updatedStatusHistory = [
        ...updatedStatusHistory,
        {
          id: Date.now().toString(),
          status: formData.status,
          comment: '',
          changedAt: new Date(),
          changedBy: user?.name || '',
          changedById: user?.id || '',
        },
      ];
    }

    try {
      await updateMaintenanceRecord(recordId, {
        title: formData.title || '',
        description,
        companyId: formData.companyId,
        companyName: formData.companyName,
        status: formData.status,
        priority: formData.priority,
        workType: formData.workType,
        requesterName: formData.requesterName,
        assignedToId: formData.assignedToId,
        assignedToName: formData.assignedToName,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        expectedCompletionDate: formData.expectedCompletionDate ? new Date(formData.expectedCompletionDate) : undefined,
        actualCompletionDate: formData.actualCompletionDate,
        estimatedHours: formData.estimatedHours,
        actualHours: formData.actualHours,
        completionResult: formData.completionResult,
        testStatus: formData.testStatus,
        deploymentLocation: formData.deploymentLocation,
        statusHistory: updatedStatusHistory,
      });

      // upload new (tmp) files — 병렬 처리
      const tmpFiles = files.filter(f => f.id.startsWith('tmp-') && f.file);
      if (tmpFiles.length > 0) {
        await Promise.all(tmpFiles.map(f => uploadFile(recordId, f.file!).catch(() => {})));
      }
      setFiles([]);

      setSaveState('saved');
      toast.success(t('saveSuccess'));
      onUpdated?.();
      onClose();
    } catch {
      setSaveState('failed');
      setTimeout(() => setSaveState('idle'), 3000);
      toast.error(t('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── styles ────────────────────────────────────────────────────────────────

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
    padding: '0.875rem 1rem',
  };

  const sectionHead = (_icon: React.ReactNode, label: string, badge?: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      <span style={{ color: themeColors.textSecondary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', lineHeight: 1.6 }}>
          {badge}
        </span>
      )}
    </div>
  );

  const STATUS_OPTIONS = [
    { key: 'pending',     label: t('statusWaiting') },
    { key: 'in-progress', label: t('statusProcessing') },
    { key: 'completed',   label: t('statusCompleted') },
    { key: 'urgent',      label: t('statusUrgent') },
    { key: 'on-hold',     label: t('statusOnHold') },
  ] as const;

  const PRIORITY_OPTIONS = [
    { key: 'low',    label: t('priorityLow'), color: '#64748B' },
    { key: 'medium', label: t('priorityMedium'), color: '#D97706' },
    { key: 'high',   label: t('priorityHigh'), color: '#EA580C' },
    { key: 'urgent', label: t('priorityUrgent'), color: '#DC2626' },
  ] as const;

  const WORK_TYPE_OPTIONS = ['버그', '기능 개선', '신규 요청', '문의/지원', '기타'];
  const WORK_TYPE_LABELS: Record<string, string> = {
    '버그': t('workTypeBug'),
    '기능 개선': t('workTypeImprovement'),
    '신규 요청': t('workTypeNewRequest'),
    '문의/지원': t('workTypeInquiry'),
    '기타': t('other'),
  };
  const TEST_STATUS_OPTIONS = [
    { key: 'not-tested', label: t('testStatusNotTested') },
    { key: 'tested', label: t('testStatusTested') },
    { key: 'not-applicable', label: t('testStatusNotApplicable') },
  ] as const;
  const DEPLOY_OPTIONS = [
    { key: 'development', label: t('deployDevelopment') },
    { key: 'production', label: t('deployProduction') },
    { key: 'both', label: t('deployBoth') },
  ] as const;

  const currentStatus = isEditMode ? formData.status : form.status;
  const currentPriority = isEditMode ? (formData.priority || 'medium') : form.priority;
  const currentWorkType = isEditMode ? (formData.workType || '') : form.workType;
  const currentRequester = isEditMode ? (formData.requesterName || '') : form.requesterName;
  const currentTestStatus = isEditMode ? (formData.testStatus || '') : form.testStatus;
  const currentDeploy = isEditMode ? (formData.deploymentLocation || '') : form.deploymentLocation;
  const isCompleted = currentStatus === 'completed';

  const existingFiles: MaintenanceFile[] = isEditMode ? (formData.files || []) : [];
  const totalFileBadge = existingFiles.length + files.length;

  return (
    <>
      <style>{`
        @keyframes historySlideIn { from { transform: translateX(100%); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
        @keyframes sidePanelIn { from { transform: translateX(100%); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } }
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .history-slide { animation: historySlideIn 0.2s cubic-bezier(0.22,1,0.36,1); }
        .side-panel-anim { animation: sidePanelIn 0.22s cubic-bezier(0.22,1,0.36,1); }
        .modal-fade-anim { animation: modalFadeIn 0.16s ease; }
      `}</style>

      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 49, backgroundColor: 'rgba(0,0,0,0.28)' }}
        onClick={onClose}
      />

      {/* 편집 모드: 데이터 로딩 중 스피너 */}
      {isEditMode && loadedRecordId !== recordId && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50, pointerEvents: 'none' }}>
          <LoadingSpinner />
        </div>
      )}

      {/* 편집 모드: 레코드 미발견 빈 상태 */}
      {isEditMode && loadedRecordId === recordId && !existingRecord && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50, pointerEvents: 'none' }}>
          <div className="rounded-xl p-8 flex flex-col items-center gap-3 text-center" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, maxWidth: '320px', pointerEvents: 'auto' }}>
            <Wrench size={32} style={{ color: themeColors.textSecondary, opacity: 0.4 }} />
            <p className="text-sm font-semibold" style={{ color: themeColors.text }}>데이터를 불러올 수 없습니다</p>
            <p className="text-xs" style={{ color: themeColors.textSecondary }}>해당 유지보수 정보가 존재하지 않거나 삭제된 항목입니다.</p>
            <button onClick={onClose} className="mt-1 px-4 py-1.5 rounded text-xs font-semibold" style={{ backgroundColor: themeColors.primary, color: onPrimaryText }}>닫기</button>
          </div>
        </div>
      )}

      {/* 데이터 준비 완료 후 사이드 패널 (편집/생성 모두) */}
      {(isEditMode ? loadedRecordId === recordId && !!existingRecord : true) && (
      <div
        ref={modalRef}
        className="side-panel-anim"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          zIndex: 50,
          width: isWide ? 'min(40rem, calc(100vw - 2rem))' : 'min(480px, calc(100vw - 2rem))',
          height: '100vh',
          backgroundColor: themeColors.surface,
          borderLeft: `1px solid ${themeColors.border}`,
          borderRadius: '12px 0 0 12px',
          boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(15,15,15,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3.5 flex-shrink-0"
          style={{
            borderBottom: `1px solid ${themeColors.border}`,
            background: isDark
              ? `linear-gradient(135deg, ${themeColors.primary}14 0%, transparent 100%)`
              : `linear-gradient(135deg, ${themeColors.primary}0C 0%, transparent 100%)`,
          }}
        >
          <h2 className="text-sm font-semibold leading-tight truncate max-w-[500px]" style={{ color: themeColors.text }}>
            {isEditMode ? t('taskDetail') : t('maintenanceAdd')}
          </h2>

          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            {isEditMode && saveState !== 'idle' && (
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded" style={{
                color: saveState === 'saved' ? themeColors.primary : saveState === 'failed' ? '#EF4444' : themeColors.textSecondary,
                backgroundColor: saveState === 'saved' ? `${themeColors.primary}12` : saveState === 'failed' ? 'rgba(239,68,68,0.1)' : 'transparent',
                transition: 'all 0.2s ease',
              }}>
                {saveState === 'saving' ? (
                  <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z"/></svg>{t('savingInProgress')}</>
                ) : saveState === 'failed' ? (
                  <><X size={12} />{t('saveFailedShort')}</>
                ) : (
                  <><CheckCircle size={12} />{t('savedLabel')}</>
                )}
              </span>
            )}

            <button type="button" onClick={() => setIsWide(w => !w)} title={isWide ? t('panelShrink') : t('panelExpand')}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-60 transition-opacity"
              style={{ color: themeColors.textSecondary, cursor: 'pointer' }}>
              {isWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            {isEditMode && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
              >
                <Trash2 size={13} />
                <span>{t('delete')}</span>
              </button>
            )}
            <button type="button" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-60 transition-opacity"
              style={{ color: themeColors.textSecondary, cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <form
          id="maint-create-form"
          onSubmit={isEditMode ? (e) => { e.preventDefault(); handleSave(); } : handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto"
        >
          {/* 상단 섹션 1-3 */}
          <div className="px-6 pt-5 flex flex-col gap-3">

            {/* ── 1. 요청 정보 ── */}
            <div style={sectionCard}>
              {sectionHead(<Building2 size={13} />, t('requestInfo'))}
              <div className="flex flex-col gap-3">

                {/* 업체 선택 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem' }}>{t('companyName')} <span style={{ color: '#EF4444' }}>*</span></p>
                    <div className="flex gap-1">
                      {(['list', 'manual'] as const).map((mode) => (
                        <button key={mode} type="button" onClick={() => setCompanyInputMode(mode)}
                          className="px-2 py-0.5 rounded text-xs font-medium transition-all"
                          style={{
                            backgroundColor: companyInputMode === mode ? themeColors.primary : 'transparent',
                            color: companyInputMode === mode ? onPrimaryText : themeColors.textSecondary,
                            border: `1px solid ${companyInputMode === mode ? themeColors.primary : themeColors.border}`,
                          }}>
                          {mode === 'list' ? t('list') : t('directInput')}
                        </button>
                      ))}
                    </div>
                  </div>
                  {companyInputMode === 'list' ? (
                    <select
                      value={isEditMode ? (formData.companyId || '') : form.companyId}
                      onChange={(e) => {
                        const c = companies.find((c) => c.id === e.target.value);
                        if (isEditMode) setFormData({ ...formData, companyId: e.target.value, companyName: c?.name || '' });
                        else setForm({ ...form, companyId: e.target.value, companyName: c?.name || '' });
                      }}
                      style={inputStyle}>
                      <option value="">{t('selectCompany')}</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id} style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text"
                      value={isEditMode ? (formData.companyName || '') : form.companyName}
                      onChange={(e) => {
                        if (isEditMode) setFormData({ ...formData, companyName: e.target.value, companyId: '' });
                        else setForm({ ...form, companyName: e.target.value, companyId: '' });
                      }}
                      placeholder={t('companyDirectInput')} style={inputStyle} />
                  )}
                </div>

                {/* 작업 유형 */}
                <div>
                  <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('workTypeLabel')} <span style={{ color: '#EF4444' }}>*</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {WORK_TYPE_OPTIONS.map((wt) => {
                      const isActive = currentWorkType === wt;
                      return (
                        <button key={wt} type="button"
                          onClick={() => {
                            if (isEditMode) setFormData({ ...formData, workType: wt });
                            else setForm({ ...form, workType: wt });
                          }}
                          className="px-2.5 py-1 text-xs font-medium transition-all"
                          style={{
                            borderRadius: '4px',
                            border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
                            backgroundColor: isActive ? `${themeColors.primary}18` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)'),
                            color: isActive ? themeColors.primary : themeColors.textSecondary,
                          }}>
                          {WORK_TYPE_LABELS[wt] ?? wt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 요청자 */}
                <div>
                  <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('requester')} <span style={{ color: '#EF4444' }}>*</span></p>
                  {companyContacts.length > 0 ? (
                    <>
                      <select
                        value={requesterMode === 'manual' ? '__manual__' : currentRequester}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__manual__') {
                            setRequesterMode('manual');
                            if (isEditMode) setFormData({ ...formData, requesterName: '' });
                            else setForm({ ...form, requesterName: '' });
                          } else {
                            setRequesterMode('list');
                            if (isEditMode) setFormData({ ...formData, requesterName: val });
                            else setForm({ ...form, requesterName: val });
                          }
                        }}
                        style={inputStyle}>
                        <option value="">{t('selectRequesterPlaceholder')}</option>
                        {companyContacts.map((c) => (
                          <option key={c.id} value={c.name} style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>
                            {c.name}{c.role ? ` (${c.role})` : ''}
                          </option>
                        ))}
                        <option value="__manual__" style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>
                          {t('directInput')}
                        </option>
                      </select>
                      {requesterMode === 'manual' && (
                        <input type="text"
                          value={currentRequester}
                          onChange={(e) => {
                            if (isEditMode) setFormData({ ...formData, requesterName: e.target.value });
                            else setForm({ ...form, requesterName: e.target.value });
                          }}
                          placeholder={t('requesterDirectInput')}
                          style={{ ...inputStyle, marginTop: '6px' }} />
                      )}
                    </>
                  ) : (
                    <input type="text"
                      value={currentRequester}
                      onChange={(e) => {
                        if (isEditMode) setFormData({ ...formData, requesterName: e.target.value });
                        else setForm({ ...form, requesterName: e.target.value });
                      }}
                      placeholder={t('requesterNameInput')}
                      style={inputStyle} />
                  )}
                </div>
              </div>
            </div>

            {/* ── 2. 요청 내용 ── */}
            <div style={sectionCard}>
              {sectionHead(<FileText size={13} />, t('requestContent'))}
              <style>{`[data-maint-ph]:empty:before { content: attr(data-maint-ph); color: ${themeColors.textSecondary}; opacity: 0.45; pointer-events: none; } [contenteditable] img { max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; border: 1px solid ${themeColors.border}; display: block; }`}</style>
              <div
                ref={descRef}
                contentEditable
                suppressContentEditableWarning
                data-maint-ph={t('maintenanceDescriptionPlaceholder')}
                onPaste={handleDescPaste}
                onFocus={() => setDescFocused(true)}
                onBlur={(e) => {
                  const html = e.currentTarget.innerHTML;
                  setDescFocused(false);
                  if (isEditMode) setFormData((prev) => ({ ...prev, description: html }));
                  else setForm((prev) => ({ ...prev, description: html }));
                }}
                onInput={(e) => {
                  const html = e.currentTarget.innerHTML;
                  if (isEditMode) setFormData((prev) => ({ ...prev, description: html }));
                  else setForm((prev) => ({ ...prev, description: html }));
                }}
                style={{
                  minHeight: '140px',
                  padding: '8px 12px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)',
                  border: `1px solid ${descFocused ? themeColors.primary : themeColors.border}`,
                  borderRadius: '6px',
                  color: themeColors.text,
                  fontSize: '0.8125rem',
                  lineHeight: 1.7,
                  outline: 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowY: 'auto',
                  transition: 'border-color 0.15s',
                }}
              />
            </div>

            {/* ── 3. 설정 (접을 수 있음) ── */}
            <div style={sectionCard}>
              <button type="button"
                onClick={() => setSettingsOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: settingsOpen ? '12px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={themeColors.textSecondary} strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round"/></svg>
                  <span style={{ color: themeColors.textSecondary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('settings')}</span>
                </div>
                <ChevronRight size={13} style={{ color: themeColors.textSecondary, transform: settingsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {settingsOpen && (
                <div className="flex flex-col gap-3">
                  {/* 상태 */}
                  <div>
                    <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('status')}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {STATUS_OPTIONS.map((opt) => {
                        const isActive = currentStatus === opt.key;
                        return (
                          <button key={opt.key} type="button"
                            onClick={() => {
                              const today = new Date().toISOString().split('T')[0];
                              const leavingCompleted = opt.key !== 'completed';
                              if (isEditMode) {
                                const autoComplete = opt.key === 'completed' && !formData.actualCompletionDate;
                                setFormData({
                                  ...formData,
                                  status: opt.key as MaintenanceRecord['status'],
                                  ...(autoComplete ? { actualCompletionDate: new Date(today) } : {}),
                                  ...(leavingCompleted ? { actualCompletionDate: undefined, completionResult: '', testStatus: '', deploymentLocation: '' } : {}),
                                });
                              } else {
                                const autoComplete = opt.key === 'completed' && !form.actualCompletionDate;
                                setForm({
                                  ...form,
                                  status: opt.key,
                                  ...(autoComplete ? { actualCompletionDate: today } : {}),
                                  ...(leavingCompleted ? { actualCompletionDate: undefined, completionResult: '', testStatus: '', deploymentLocation: '' } : {}),
                                });
                              }
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
                  </div>

                  {/* 우선순위 */}
                  <div>
                    <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('priority')}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PRIORITY_OPTIONS.map((opt) => {
                        const isActive = currentPriority === opt.key;
                        return (
                          <button key={opt.key} type="button"
                            onClick={() => {
                              if (isEditMode) setFormData({ ...formData, priority: opt.key as MaintenanceRecord['priority'] });
                              else setForm({ ...form, priority: opt.key as MaintenanceRecord['priority'] });
                            }}
                            className="py-1.5 text-xs font-medium transition-all text-center"
                            style={{
                              borderRadius: '4px',
                              border: `1px solid ${isActive ? opt.color : themeColors.border}`,
                              backgroundColor: isActive ? `${opt.color}18` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)'),
                              color: isActive ? opt.color : themeColors.textSecondary,
                            }}>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 담당자 */}
                  <div>
                    <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('assignee')}</p>
                    <select
                      value={isEditMode ? (formData.assignedToId || '') : form.assignedToId}
                      onChange={(e) => {
                        const u = users.find((u) => u.id === e.target.value);
                        if (isEditMode) setFormData({ ...formData, assignedToId: e.target.value, assignedToName: u?.name || '' });
                        else setForm({ ...form, assignedToId: e.target.value, assignedToName: u?.name || '' });
                      }}
                      style={inputStyle}>
                      <option value="">{t('selectManagerPlaceholder')}</option>
                      {users.filter((u, i, arr) => i === arr.findIndex((x) => x.id === u.id)).map((u) => (
                        <option key={u.id} value={u.id} style={{ backgroundColor: isDark ? '#1f2937' : 'white', color: isDark ? '#fff' : '#000' }}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 일정 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('requestDate')}</p>
                      <input type="date"
                        value={isEditMode ? (formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : '') : form.startDate}
                        onChange={(e) => {
                          if (isEditMode) setFormData({ ...formData, startDate: e.target.value ? new Date(e.target.value) : undefined });
                          else setForm({ ...form, startDate: e.target.value });
                        }}
                        style={{ ...inputStyle, colorScheme: isDark ? 'dark' : 'light' }} />
                    </div>
                    <div>
                      <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('expectedCompletionDate')}</p>
                      <input type="date"
                        value={isEditMode ? (formData.expectedCompletionDate ? new Date(formData.expectedCompletionDate).toISOString().split('T')[0] : '') : form.expectedCompletionDate}
                        onChange={(e) => {
                          if (isEditMode) setFormData({ ...formData, expectedCompletionDate: e.target.value ? new Date(e.target.value) : undefined });
                          else setForm({ ...form, expectedCompletionDate: e.target.value });
                        }}
                        style={{ ...inputStyle, colorScheme: isDark ? 'dark' : 'light' }} />
                    </div>
                  </div>


                  {/* 완료 결과 — completed일 때만 */}
                  {isCompleted && (
                    <div style={{ borderTop: `1px solid ${themeColors.border}`, paddingTop: '12px' }} className="flex flex-col gap-3">
                      <p style={{ color: themeColors.primary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('completionResult')}</p>
                      <div>
                        <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('processingResult')}</p>
                        <textarea
                          value={isEditMode ? (formData.completionResult || '') : form.completionResult}
                          onChange={(e) => {
                            if (isEditMode) setFormData({ ...formData, completionResult: e.target.value });
                            else setForm({ ...form, completionResult: e.target.value });
                          }}
                          placeholder={t('processingContentPlaceholder')}
                          rows={3}
                          style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('testStatus')}</p>
                          <div className="flex flex-col gap-1">
                            {TEST_STATUS_OPTIONS.map((opt) => {
                              const isActive = currentTestStatus === opt.key;
                              return (
                                <button key={opt.key} type="button"
                                  onClick={() => {
                                    const val = isActive ? '' : opt.key;
                                    if (isEditMode) setFormData({ ...formData, testStatus: val });
                                    else setForm({ ...form, testStatus: val });
                                  }}
                                  style={{
                                    padding: '4px 0', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 500,
                                    border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
                                    backgroundColor: isActive ? `${themeColors.primary}18` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)'),
                                    color: isActive ? themeColors.primary : themeColors.textSecondary,
                                    cursor: 'pointer',
                                  }}>
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <p style={{ color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px' }}>{t('deploymentLocation')}</p>
                          <div className="flex flex-col gap-1">
                            {DEPLOY_OPTIONS.map((opt) => {
                              const isActive = currentDeploy === opt.key;
                              return (
                                <button key={opt.key} type="button"
                                  onClick={() => {
                                    const val = isActive ? '' : opt.key;
                                    if (isEditMode) setFormData({ ...formData, deploymentLocation: val });
                                    else setForm({ ...form, deploymentLocation: val });
                                  }}
                                  style={{
                                    padding: '4px 0', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 500,
                                    border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
                                    backgroundColor: isActive ? `${themeColors.primary}18` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)'),
                                    color: isActive ? themeColors.primary : themeColors.textSecondary,
                                    cursor: 'pointer',
                                  }}>
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>{/* end 상단 섹션 1-3 */}

          {/* ── 4. 첨부파일 ── */}
          <div className="px-6 pb-5 pt-3">
            {/* 카드 전체가 드롭존 */}
            <div
              style={{
                ...sectionCard,
                display: 'flex', flexDirection: 'column', gap: '0.375rem',
                border: isDragOver ? `1px dashed ${themeColors.primary}` : (sectionCard as any).border,
                backgroundColor: isDragOver ? `${themeColors.primary}08` : (sectionCard as any).backgroundColor,
                transition: 'border-color 0.15s, background-color 0.15s',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => { if (!isDragOver) { e.currentTarget.style.borderColor = themeColors.primary + '60'; e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.045)' : 'rgba(55,53,47,0.035)'; } }}
              onMouseLeave={(e) => { if (!isDragOver) { e.currentTarget.style.borderColor = themeColors.border; e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(55,53,47,0.02)'; } }}
              onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {/* 첨부파일 헤더 — 프로젝트 상세 스타일 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {(() => {
                    const allFiles = [...existingFiles, ...files];
                    const allSel = allFiles.length > 0 && allFiles.every(f => selectedFileIds.has(f.id));
                    const someSel = !allSel && allFiles.some(f => selectedFileIds.has(f.id));
                    return (
                      <input type="checkbox" checked={allSel}
                        ref={el => { if (el) el.indeterminate = someSel; }}
                        onChange={e => { e.stopPropagation(); allSel ? setSelectedFileIds(new Set()) : setSelectedFileIds(new Set(allFiles.map(f => f.id))); }}
                        onClick={e => e.stopPropagation()}
                        className="w-3 h-3" style={{ accentColor: themeColors.primary, cursor: 'pointer' }} />
                    );
                  })()}
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text }}>{t('attachments')}</span>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 5px', borderRadius: '10px', backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>
                    {totalFileBadge + uploadQueue.length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {selectedFileIds.size > 0 && (
                    <button type="button" onClick={handleBulkFileDownload}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: themeColors.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '3px' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <Download size={11} /> {selectedFileIds.size}개 다운
                    </button>
                  )}
                  {selectedFileIds.size > 0 && (
                    <button type="button" onClick={handleBulkFileDelete}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '3px' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <Trash2 size={11} /> 삭제
                    </button>
                  )}
                  <button type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: themeColors.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '3px' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <Upload size={11} /> 업로드
                  </button>
                </div>
              </div>

              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

              {/* 업로드 중인 항목 인라인 표시 — 프로젝트 상세 스타일 */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, minWidth: '110px' }}>
                      <div style={{ flex: 1, height: '3px', borderRadius: '99px', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.status === 'done' ? 100 : item.progress}%`, borderRadius: '99px', backgroundColor: barColor, transition: 'width 0.15s ease' }} />
                      </div>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: barColor, flexShrink: 0, minWidth: '30px', textAlign: 'right' }}>
                        {item.status === 'done' ? '완료' : item.status === 'error' ? '실패' : item.status === 'pending' ? '대기' : `${item.progress}%`}
                      </span>
                    </div>
                    <div style={{ flexShrink: 0, width: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.status === 'done' && <CheckCircle size={14} style={{ color: '#10B981' }} />}
                      {item.status === 'error' && <XCircle size={14} style={{ color: '#EF4444' }} />}
                      {(item.status === 'uploading' || item.status === 'pending') && <RefreshCw size={13} className={item.status === 'uploading' ? 'animate-spin' : ''} style={{ color: themeColors.textSecondary, opacity: item.status === 'pending' ? 0.35 : 1 }} />}
                    </div>
                  </div>
                );
              })}

              {/* 파일 없을 때: 드롭존 전체 표시 */}
              {(() => {
                const hasFiles = (isEditMode && existingFiles.length > 0) || files.length > 0;
                const dropColor = isDragOver ? themeColors.primary : themeColors.textSecondary;
                if (!hasFiles) {
                  return (
                    <div style={{
                      minHeight: '100px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      padding: '1.5rem',
                    }}>
                      <Upload size={22} style={{ color: dropColor, opacity: isDragOver ? 1 : 0.4 }} />
                      <span style={{ fontSize: '0.8125rem', color: dropColor, fontWeight: 500, opacity: isDragOver ? 1 : 0.7 }}>
                        {isDragOver ? t('dropHere') : t('dropOrClickUpload')}
                      </span>
                    </div>
                  );
                }
                return (
                  <>
                    {/* 파일 추가 힌트 */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', padding: '0.375rem 0.75rem', borderRadius: '4px',
                        border: `1px dashed ${isDragOver ? themeColors.primary : themeColors.border}`,
                        backgroundColor: isDragOver ? `${themeColors.primary}10` : 'transparent',
                      }}
                    >
                      <Upload size={12} style={{ color: isDragOver ? themeColors.primary : themeColors.textSecondary }} />
                      <span style={{ fontSize: '0.75rem', color: isDragOver ? themeColors.primary : themeColors.textSecondary }}>
                        {isDragOver ? t('dropHere') : t('dropOrClickAdd')}
                      </span>
                    </div>
                    {/* 파일 목록 — 자연스럽게 늘어남 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
              {isEditMode && existingFiles.map((f) => {
                const { Icon: FileIconComp, color: iconColor } = getFileIconInfo(f.filename || '');
                const rowBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)';
                return (
                  <div key={f.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: '4px', backgroundColor: selectedFileIds.has(f.id) ? `${themeColors.primary}08` : rowBg, cursor: 'pointer' }}
                    onClick={() => handleFilePreview(f)}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = selectedFileIds.has(f.id) ? `${themeColors.primary}12` : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedFileIds.has(f.id) ? `${themeColors.primary}08` : rowBg)}>
                    <input type="checkbox" checked={selectedFileIds.has(f.id)} onChange={() => {}} onClick={(e) => toggleFileSelect(f.id, e)} className="w-3 h-3 flex-shrink-0" style={{ accentColor: themeColors.primary, cursor: 'pointer' }} />
                    <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', backgroundColor: f.isImage ? 'transparent' : `${iconColor}15` }}>
                      {f.isImage && f.fileUrl ? (
                        <img src={f.fileUrl} alt={f.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px' }} />
                      ) : (
                        <FileIconComp size={10} style={{ color: iconColor }} />
                      )}
                    </div>
                    <span style={{ flex: 1, fontSize: '0.8125rem', color: themeColors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</span>
                    <span style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, flexShrink: 0 }}>{formatFileSize(f.size)}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleFilePreview(f); }}
                      style={{ display: 'flex', alignItems: 'center', padding: '5px', borderRadius: '3px', backgroundColor: 'transparent', color: themeColors.textSecondary, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                      title={t('preview')}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = themeColors.primary; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = themeColors.textSecondary; }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleFileDownload(f); }}
                      style={{ display: 'flex', alignItems: 'center', padding: '5px', borderRadius: '3px', backgroundColor: 'transparent', color: themeColors.textSecondary, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                      title={t('download')}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = themeColors.primary; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = themeColors.textSecondary; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteExistingFile(f.id); }}
                      style={{ display: 'flex', padding: '5px', borderRadius: '3px', backgroundColor: 'transparent', color: themeColors.textSecondary, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = themeColors.textSecondary; }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}

              {files.map((f) => {
                const { Icon: FileIconComp, color: iconColor } = getFileIconInfo(f.filename || '');
                const rowBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)';
                return (
                  <div key={f.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: '4px', backgroundColor: selectedFileIds.has(f.id) ? `${themeColors.primary}08` : rowBg }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = selectedFileIds.has(f.id) ? `${themeColors.primary}12` : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedFileIds.has(f.id) ? `${themeColors.primary}08` : rowBg)}>
                    <input type="checkbox" checked={selectedFileIds.has(f.id)} onChange={() => {}} onClick={(e) => toggleFileSelect(f.id, e)} className="w-3 h-3 flex-shrink-0" style={{ accentColor: themeColors.primary, cursor: 'pointer' }} />
                    <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', backgroundColor: f.isImage ? 'transparent' : `${iconColor}15` }}>
                      {f.isImage && f.fileUrl ? (
                        <img src={f.fileUrl} alt={f.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px' }} />
                      ) : (
                        <FileIconComp size={10} style={{ color: iconColor }} />
                      )}
                    </div>
                    <span style={{ flex: 1, fontSize: '0.8125rem', color: themeColors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</span>
                    <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, flexShrink: 0 }}>{formatFileSize(f.size)}</span>
                    <button type="button" onClick={() => removeNewFile(f.id)}
                      style={{ display: 'flex', padding: '5px', borderRadius: '3px', backgroundColor: 'transparent', color: themeColors.textSecondary, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = themeColors.textSecondary; }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
                    </div>{/* end 파일 목록 */}
                  </>
                );
              })()}
            </div>{/* end 첨부파일 카드 */}
          </div>{/* end 첨부파일 섹션 */}
        </form>

        {/* 변경 이력 — 오른쪽 슬라이드 오버레이 패널 */}
        {isEditMode && showHistoryModal && (() => {
          const relTime = (d: Date) => { const diff = Date.now() - d.getTime(), m = Math.floor(diff / 60000); if (m < 1) return t('justNow'); if (m < 60) return t('minutesAgo', { count: m }); const h = Math.floor(m / 60); if (h < 24) return t('hoursAgo', { count: h }); const day = Math.floor(h / 24); if (day < 7) return t('daysAgo', { count: day }); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
          const fullTime = (d: Date) => d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          return (
            <div className="history-slide" style={{ position: 'absolute' as const, top: 0, right: 0, bottom: 0, width: '288px', backgroundColor: isDark ? 'rgba(22,27,34,0.97)' : 'rgba(255,255,255,0.97)', borderLeft: `1px solid ${themeColors.border}`, display: 'flex', flexDirection: 'column' as const, zIndex: 10, backdropFilter: 'blur(6px)' }}>
              <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${themeColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={13} style={{ color: themeColors.primary }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.text, letterSpacing: '0.03em' }}>{t('changeHistory')}</span>
                  {historyLogs.length > 0 && <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 5px', borderRadius: '10px', backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>{historyLogs.length}</span>}
                </div>
                <button onClick={() => setShowHistoryModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}><X size={14} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' as const, padding: '8px 16px 12px' }}>
                {historyLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                    <svg className="animate-spin" style={{ width: '1.25rem', height: '1.25rem', color: themeColors.primary }} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z"/></svg>
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
                        const parsedChanges: { field: string; oldValue: string; newValue: string }[] = [];
                        if (log.details && log.details.includes(' → ')) {
                          log.details.split(' / ').forEach((part: string) => {
                            const colonIdx = part.indexOf(': '); if (colonIdx === -1) return;
                            const field = part.slice(0, colonIdx).trim();
                            const rest = part.slice(colonIdx + 2);
                            const arrowIdx = rest.indexOf(' → '); if (arrowIdx === -1) return;
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
                                {(isCreate || isDelete) && <span style={{ fontSize: '0.5625rem', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', backgroundColor: `${dotColor}15`, color: dotColor }}>{isCreate ? t('logCreated') : t('delete')}</span>}
                              </div>
                              {parsedChanges.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '3px' }}>
                                  {parsedChanges.map((c, ci) => (
                                    <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' as const, fontSize: '0.625rem', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderRadius: '4px', padding: '3px 6px' }}>
                                      <span style={{ fontWeight: 600, color: themeColors.textSecondary, flexShrink: 0 }}>{c.field}</span>
                                      {c.oldValue ? <span style={{ padding: '0 3px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: isDark ? '#F87171' : '#DC2626', textDecoration: 'line-through', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.oldValue}</span> : <span style={{ color: themeColors.textSecondary, opacity: 0.4 }}>{t('noneLabel')}</span>}
                                      <span style={{ color: themeColors.textSecondary, flexShrink: 0 }}>→</span>
                                      <span style={{ padding: '0 3px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(63,185,80,0.12)' : 'rgba(34,197,94,0.08)', color: isDark ? '#3FB950' : '#16A34A', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.newValue || t('noneLabel')}</span>
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

        {/* Footer */}
        <div
          className="flex items-center px-6 py-3 flex-shrink-0"
          style={{
            borderTop: `1px solid ${themeColors.border}`,
            justifyContent: isEditMode ? 'space-between' : 'flex-end',
          }}
        >
          {isEditMode && isAdminAccount(user) && (
            <button
              type="button"
              onClick={() => { setShowHistoryModal((v) => !v); if (!showHistoryModal) fetchHistory(); }}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: showHistoryModal ? themeColors.primary : themeColors.textSecondary }}
            >
              <History size={13} />
              {t('changeHistory')}
              <ChevronRight size={12} style={{ transition: 'transform 0.2s', transform: showHistoryModal ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>
          )}

          <div className="flex items-center gap-2">
            {isEditMode ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: themeColors.primary, color: onPrimaryText, borderRadius: '4px' }}
              >
                {isSaving
                  ? <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" /></svg>{t('savingInProgress')}</>
                  : <><Save size={13} />{t('save')}</>}
              </button>
            ) : (
              <>
                <button type="button" onClick={onClose}
                  className="px-4 py-1.5 text-sm font-medium rounded transition-opacity hover:opacity-60"
                  style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}`, borderRadius: '4px' }}>
                  {t('cancel')}
                </button>
                <button type="submit" form="maint-create-form"
                  disabled={isSaving || !form.companyName.trim() || !form.workType.trim() || !form.requesterName.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: themeColors.primary, color: onPrimaryText, borderRadius: '4px' }}>
                  {isSaving
                    ? <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" /></svg>{t('addingLabel')}</>
                    : <><Save size={13} />{t('maintenanceAdd')}</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      )}

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

export default MaintenanceCreateModal;
