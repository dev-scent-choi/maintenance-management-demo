import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import JSZip from 'jszip';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Upload, Paperclip, FileText, Image as ImageIcon, File as FileGeneric, Archive, Video, Download, Trash2, Eye, CheckCircle, XCircle, History, X, RefreshCw, ChevronDown } from 'lucide-react';
import type { ChangeEntry } from '../components/InlineEditField';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useAuthStore } from '../store/authStore';
import { isAdminAccount } from '../utils/permissions';
import { usePermission } from '../hooks/usePermission';
import { useSettingsStore } from '../store/settingsStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { themeConfigs } from '../utils/themeConfig';
import { useToast } from '../hooks/useToast';
import { useLanguage } from '../contexts/LanguageContext';
import FileViewer from '../components/FileViewer';
import LoadingButton from '../components/LoadingButton';
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

const MaintenanceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromCalendar = searchParams.get('from') === 'calendar';
  const fromDashboard = searchParams.get('from') === 'dashboard';
  const backPath = fromCalendar ? '/maintenance/calendar' : fromDashboard ? '/' : '/maintenance';
  const { maintenanceRecords, addMaintenanceRecord, updateMaintenanceRecord, deleteMaintenanceRecord, companies, users, fetchCompanies, fetchUsers, uploadFile, deleteFile, fetchMaintenanceRecords } = useMaintenanceStore();
  const { user, token } = useAuthStore();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const toast = useToast();

  const onPrimaryText = theme === 'yellow' ? '#333333' : '#fff';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const isNewRecord = !id || id === 'new';
  const existingRecord = isNewRecord ? null : maintenanceRecords.find(r => r.id === id);

  // 최초 1회만 formData 동기화 (자동저장 후 재동기화 방지)
  const hasLoadedRef = useRef(false);

  // 드래그앤드롭 상태
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // 업체명 입력 모드 (list: 목록 선택, manual: 직접입력) - 기본값: 목록 선택
  const [companyInputMode, setCompanyInputMode] = useState<'list' | 'manual'>('list');

  const [formData, setFormData] = useState<Partial<MaintenanceRecord>>({
    title: existingRecord?.title || '',
    description: existingRecord?.description || '',
    companyId: existingRecord?.companyId || '',
    companyName: existingRecord?.companyName || '',
    status: existingRecord?.status || 'pending',
    priority: existingRecord?.priority || 'medium',
    assignedToName: existingRecord?.assignedToName || '',
    assignedToId: existingRecord?.assignedToId || '',
    startDate: existingRecord?.startDate || (isNewRecord ? new Date() : undefined), // 신규 등록시 현재 날짜 자동 설정
    expectedCompletionDate: existingRecord?.expectedCompletionDate,
    actualCompletionDate: existingRecord?.actualCompletionDate,
    category: existingRecord?.category,
    files: existingRecord?.files || [],
    comments: existingRecord?.comments || [],
  });

  const [viewerFile, setViewerFile] = useState<MaintenanceFile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const isDark = theme !== 'light';
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(55,53,47,0.04)';

  // 상태 변경 관련
  const [originalStatus, setOriginalStatus] = useState<MaintenanceRecord['status'] | undefined>(existingRecord?.status);
  const [statusChangeComment, setStatusChangeComment] = useState('');

  // 변경 이력 / 저장 상태
  const [changeHistory, setChangeHistory] = useState<ChangeEntry[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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
    setSaveState('saving');
    try {
      // 현재 formData 기반으로 병합 (자동저장 후 재동기화 없이 최신 상태 유지)
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
      setChangeHistory(prev => [{
        id: Date.now().toString(),
        fieldLabel,
        oldValue: oldStr,
        newValue: newStr,
        timestamp: new Date(),
        userName: user?.name || '-',
      }, ...prev]);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('idle');
      toast.error('저장에 실패했습니다.');
    }
  };

  // URL에 edit=true가 있으면 데이터 로드 후 편집 모드로 전환
  // edit=true 파라미터는 더 이상 필요하지 않음 (인라인 편집 방식)

  // existingRecord 최초 1회만 formData에 동기화 (자동저장 후 재동기화 방지)
  useEffect(() => {
    if (isNewRecord || !existingRecord || companies.length === 0) return;
    if (hasLoadedRef.current) return; // 이미 로드됨 - 자동저장 후 재동기화 방지
    hasLoadedRef.current = true;

      // DB의 companyName으로 업체 목록에서 찾기
      const matchedCompany = companies.find(c => c.name === existingRecord.companyName);

      if (matchedCompany) {
        // 업체 목록에서 찾은 경우 → 목록 선택 모드
        setCompanyInputMode('list');
        setFormData({
          title: existingRecord.title || '',
          description: existingRecord.description || '',
          companyId: matchedCompany.id, // 찾은 업체의 ID 설정
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
      } else {
        // 업체 목록에서 못 찾은 경우 → 직접입력 모드
        setCompanyInputMode('manual');
        setFormData({
          title: existingRecord.title || '',
          description: existingRecord.description || '',
          companyId: '',
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
      }

      // 원래 상태 저장 (상태 변경 감지용)
      setOriginalStatus(existingRecord.status);

      // 설명란 HTML 설정 (딜레이를 두어 DOM 준비 후 설정)
      setTimeout(() => {
        if (descriptionRef.current && existingRecord.description) {
          descriptionRef.current.innerHTML = existingRecord.description;
        }
      }, 0);
  }, [existingRecord, isNewRecord, companies]);

  // 업체 및 사용자 목록 로드 (컴포넌트 마운트 시 한 번만 실행)
  useEffect(() => {
    fetchCompanies();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열 = 마운트 시 한 번만 실행

  // 업체 목록 변경 추적
  useEffect(() => {
  }, [companies]);

  // 권한 확인: 관리자만 편집 가능
  const canEdit = isAdminAccount(user);
  const { can } = usePermission();
  const canDownloadFile = can('download_files');
  const canUploadFile   = can('upload_files');
  const canDeleteFile   = can('delete_files');


  // 파일 다운로드 핸들러
  const handleFileDownload = async (file: MaintenanceFile) => {
    try {
      if (!file.fileUrl) {
        toast.error('파일 URL이 없습니다.');
        return;
      }

      // Data URL인 경우 (신규 등록 시 임시 파일)
      if (file.fileUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = file.fileUrl;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`${file.filename} 다운로드 완료`);
        return;
      }

      // 일반 URL인 경우
      const response = await fetch(normalizeFileUrl(file.fileUrl));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Content-Disposition 헤더에서 파일명 추출 시도
      const contentDisposition = response.headers.get('content-disposition');
      let downloadFilename = file.filename;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename;
      link.setAttribute('download', downloadFilename); // 명시적으로 다운로드 속성 설정
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // 다운로드 감사 로그 기록
      if (user) {
        useAuditLogStore.getState().addLog({
          userId: user.id,
          userName: user.name,
          action: 'download',
          resourceType: 'file',
          resourceId: file.id,
          resourceName: file.filename,
          details: `유지보수 접수 "${formData.title}"의 파일 "${file.filename}"을 다운로드했습니다.`,
        });
      }

      toast.success(`${file.filename} 다운로드 완료`);
    } catch (error) {
      console.error('[handleFileDownload] Download error:', error);
      toast.error(`파일 다운로드에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 설명란에 이미지 붙여넣기 핸들러
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

            // contenteditable div에 이미지 삽입
            if (descriptionRef.current) {
              const selection = window.getSelection();
              const range = selection?.getRangeAt(0);

              const img = document.createElement('img');
              img.src = base64Image;
              img.style.maxWidth = '100%';
              img.style.height = 'auto';
              img.style.margin = '10px 0';
              img.style.borderRadius = '8px';
              img.style.border = `1px solid ${themeColors.border}`;

              if (range) {
                range.deleteContents();
                range.insertNode(img);
                range.collapse(false);
              } else {
                descriptionRef.current.appendChild(img);
              }

              // formData 업데이트
              setFormData(prev => ({
                ...prev,
                description: descriptionRef.current?.innerHTML || '',
              }));

              toast.success('이미지가 설명란에 추가되었습니다.');
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  // 파일 처리 공통 함수
  const processFiles = async (files: File[]) => {
    setIsUploadingFile(true);
    try {
    // 신규 등록인 경우 로컬에 임시 저장
    if (isNewRecord) {
      // 파일 선택 즉시 리스트에 표시 (flushSync → 강제 동기 렌더)
      const queueItems: UploadQueueItem[] = files.map((f, i) => ({
        key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        name: f.name, size: f.size, progress: 0, status: 'pending' as const,
      }));
      flushSync(() => setUploadQueue(queueItems));

      // FileReader로 병렬 읽기
      const readPromises = Array.from(files).map((file, index) => {
        return new Promise<MaintenanceFile>((resolve) => {
          const key = queueItems[index].key;
          setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, status: 'uploading' } : x));
          const reader = new FileReader();
          reader.onload = (event) => {
            const newFile: MaintenanceFile = {
              id: `${Date.now()}-${Math.random()}-${index}`,
              maintenanceId: id || '',
              filename: file.name,
              fileUrl: event.target?.result as string,
              fileType: file.type,
              size: file.size,
              uploadedAt: new Date(),
              uploadedBy: user?.name || '사용자',
              uploadedById: user?.id || '',
              isImage: file.type.startsWith('image/'),
              version: 1,
              versions: [],
              file: file,
            };
            setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, progress: 100, status: 'done' } : x));
            resolve(newFile);
          };
          reader.readAsDataURL(file);
        });
      });

      const loadedFiles = await Promise.all(readPromises);

      // formData 업데이트 + 큐 항목 즉시 제거 (동일 렌더 = 중복 없음)
      const successKeys = new Set(queueItems.map(q => q.key));
      setFormData(prev => ({ ...prev, files: [...(prev.files || []), ...loadedFiles] }));
      setUploadQueue(prev => prev.filter(x => !successKeys.has(x.key)));

      toast.success(`${loadedFiles.length}개 파일 추가됨 (등록 시 업로드됩니다)`);
    } else {
      // 기존 레코드 수정인 경우 서버로 병렬 업로드
      const queueItems: UploadQueueItem[] = files.map(f => ({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: f.name, size: f.size, progress: 0, status: 'pending' as const,
      }));

      // 파일 선택 즉시 리스트에 표시 (React 18 자동 배치 우회 → 강제 동기 렌더)
      flushSync(() => setUploadQueue(queueItems));

      const results = await Promise.allSettled(
        files.map(async (file, i) => {
          const key = queueItems[i].key;
          flushSync(() => setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, status: 'uploading' } : x)));
          try {
            const uploadedFile = await uploadFile(id!, file, (pct) => {
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

      // 성공 항목 추출
      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<{ key: string; file: any }> => r.status === 'fulfilled')
        .map(r => r.value);
      const successKeys = new Set(succeeded.map(s => s.key));
      const uploadedFiles = succeeded.map(s => s.file);

      // formData 업데이트 + 성공 큐 항목 즉시 제거 (React 18 배치 → 단일 렌더 = 중복 row 없음)
      if (uploadedFiles.length > 0) {
        setFormData(prev => ({ ...prev, files: [...(prev.files || []), ...uploadedFiles] }));
        fetchMaintenanceRecords();
      }
      setUploadQueue(prev => prev.filter(x => !successKeys.has(x.key)));

      // 실패 항목만 3초 후 제거
      if (results.some(r => r.status === 'rejected')) {
        setTimeout(() => setUploadQueue([]), 3000);
      }
    }
    } finally {
      setIsUploadingFile(false);
    }
  };

  // 파일 미리보기 핸들러 (인증 헤더 포함)
  const handleFilePreview = async (file: MaintenanceFile) => {
    if (!file.fileUrl) { toast.error('파일 URL이 없습니다.'); return; }
    const normalizedUrl = normalizeFileUrl(file.fileUrl);
    const normalizedFile = { ...file, fileUrl: normalizedUrl };
    // data: URL (신규 등록 임시 파일) — 직접 뷰어에 전달
    if (normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('blob:')) {
      setViewerFile(normalizedFile);
      return;
    }
    // PPT/PPTX: 백엔드 서버 변환이 필요하므로 원본 URL 그대로 전달 (blob 변환 시 서버 접근 불가)
    const lowerName = (file.filename || '').toLowerCase();
    if (lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx')) {
      setViewerFile(normalizedFile);
      return;
    }
    try {
      const response = await fetch(normalizedUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setViewerFile({ ...normalizedFile, fileUrl: blobUrl });
    } catch {
      toast.error('파일을 불러올 수 없습니다.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      processFiles(files);

      // input 값 초기화 (같은 파일을 다시 선택할 수 있도록)
      e.target.value = '';
    }
  };

  // 드래그앤드롭 핸들러
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 자식 요소로 이동할 때도 이벤트가 발생하므로, 실제로 영역을 벗어났는지 확인
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
      // processFiles 내부에서 toast를 표시하므로 여기서는 제거
    }
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
    const selected = formData.files?.filter(f => selectedFileIds.has(f.id)) ?? [];
    if (selected.length === 0) return;

    if (isNewRecord) {
      // 신규 등록: 로컬에서 일괄 제거
      setFormData(prev => ({
        ...prev,
        files: prev.files?.filter(f => !selectedFileIds.has(f.id)) || [],
      }));
    } else {
      // 기존 레코드: 병렬 삭제 (Promise.all)
      try {
        await Promise.all(selected.map(f => deleteFile(f.id)));
        toast.success(`${selected.length}개 파일이 삭제되었습니다.`);
        fetchMaintenanceRecords();
      } catch {
        toast.error('일부 파일 삭제에 실패했습니다.');
      }
    }
    setSelectedFileIds(new Set());
  };

  const handleRemoveFile = async (fileId: string) => {
    // 신규 등록인 경우 로컬에서만 삭제
    if (isNewRecord) {
      setFormData(prev => ({
        ...prev,
        files: prev.files?.filter(f => f.id !== fileId) || [],
      }));
    } else {
      // 기존 레코드인 경우 서버에서 삭제
      try {
        await deleteFile(fileId);
        toast.success('파일이 삭제되었습니다.');
      } catch (error) {
        toast.error('파일 삭제에 실패했습니다.');
        console.error('File delete error:', error);
      }
    }
  };

  const handleDeleteRecord = async () => {
    if (!id || isNewRecord) return;

    const confirmed = window.confirm('정말로 이 유지보수 요청을 취소하시겠습니까?\n상태가 "취소됨"으로 변경됩니다.');

    if (!confirmed) return;

    try {
      await deleteMaintenanceRecord(id);
      toast.success('유지보수 요청이 취소되었습니다.');
      navigate(backPath);
    } catch (error) {
      toast.error('유지보수 요청 취소에 실패했습니다.');
      console.error('Delete error:', error);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 필수 필드 검증
    if (!formData.title || !formData.title.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }

    if (!formData.companyName || !formData.companyName.trim()) {
      toast.error('업체명을 입력해주세요.');
      return;
    }

    // 상태 변경 사유는 선택 사항이므로 검증 제거

    // 시작일, 종료일 유효성 검사
    if (formData.startDate && formData.expectedCompletionDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.expectedCompletionDate);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        toast.error('올바른 날짜 형식을 입력해주세요.');
        return;
      }

      if (startDate > endDate) {
        toast.error('시작일은 완료 예정일보다 빨라야 합니다.');
        return;
      }
    }

    setIsSaving(true);
    try {
      // ID 생성을 위한 타임스탬프 (렌더링 외부에서 생성)
      const timestamp = Date.now().toString();

      // 상태 변경 이력 처리
      const statusHistory: StatusHistory[] = existingRecord?.statusHistory || [];

      // 상태가 변경된 경우 이력 추가
      if (!isNewRecord && originalStatus && formData.status !== originalStatus) {
        const newHistory: StatusHistory = {
          id: `${timestamp}-${statusHistory.length}`,
          status: formData.status || 'pending',
          comment: statusChangeComment.trim() || '',
          changedAt: new Date(),
          changedBy: user?.name || '관리자',
          changedById: user?.id || '',
        };
        statusHistory.push(newHistory);
      }

      const record: MaintenanceRecord = {
        id: existingRecord?.id || timestamp,
        title: formData.title,
        description: formData.description || '',
        companyId: formData.companyId,
        companyName: formData.companyName,
        status: formData.status || 'pending',
        priority: formData.priority || 'medium',
        assignedToName: formData.assignedToName,
        assignedToId: formData.assignedToId,
        category: formData.category,
        createdAt: existingRecord?.createdAt || new Date(),
        updatedAt: new Date(),
        startDate: formData.startDate,
        expectedCompletionDate: formData.expectedCompletionDate,
        actualCompletionDate: formData.actualCompletionDate,
        files: formData.files || [],
        comments: formData.comments || [],
        statusHistory: statusHistory,
      };

      if (isNewRecord) {
        // 1. 먼저 레코드 생성 (백엔드에서 생성된 실제 ID를 받음)
        const createdRecord = await addMaintenanceRecord(record);

        // 2. 파일이 있으면 업로드 (백엔드에서 받은 실제 ID 사용)
        if (formData.files && formData.files.length > 0) {
          for (const fileData of formData.files) {
            // File 객체가 있는 경우만 업로드 (로컬에 임시 저장된 파일)
            if (fileData.file) {
              try {
                await uploadFile(createdRecord.id, fileData.file); // 실제 ID 사용
              } catch (error) {
                console.error('[handleSubmit] 파일 업로드 실패:', fileData.filename, error);
              }
            }
          }

          // 3. 파일 업로드 완료 후 최신 데이터 가져오기
          await fetchMaintenanceRecords();
        }

        toast.success('유지보수 요청이 성공적으로 등록되었습니다.');
      } else {
        await updateMaintenanceRecord(record.id, record);

        toast.success('유지보수 요청이 성공적으로 수정되었습니다.');
      }

      navigate(backPath);
    } catch (error) {
      toast.error('유지보수 요청 저장 중 오류가 발생했습니다.');
      console.error('Error saving maintenance record:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="w-8 h-8 flex items-center justify-center rounded transition-opacity hover:opacity-60"
            style={{ color: themeColors.textSecondary }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>
            {isNewRecord ? t('newMaintenance') : t('requestInfo')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* 기존 레코드: 자동저장 표시 + 삭제 버튼 */}
          {!isNewRecord && (
            <>
              {saveState !== 'idle' && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded" style={{
                  color: saveState === 'saved' ? themeColors.primary : themeColors.textSecondary,
                  backgroundColor: saveState === 'saved' ? `${themeColors.primary}12` : 'transparent',
                  transition: 'all 0.2s ease',
                }}>
                  {saveState === 'saving' ? (
                    <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z"/></svg>저장 중...</>
                  ) : (
                    <><CheckCircle size={12} />저장됨</>
                  )}
                </span>
              )}
              {isAdminAccount(user) && (
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="flex items-center gap-1.5 px-4 rounded-lg font-semibold text-sm transition-all"
                  style={{
                    height: '36px',
                    backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    color: themeColors.textSecondary,
                    border: `1px solid ${themeColors.border}`,
                  }}
                >
                  <History size={15} />
                  <span>변경 이력</span>
                </button>
              )}
              {canEdit && (
                <button
                  onClick={handleDeleteRecord}
                  className="flex items-center gap-1.5 px-4 rounded-lg font-semibold text-sm transition-all"
                  style={{ height: '36px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                >
                  <Trash2 size={15} />
                  <span>{t('delete')}</span>
                </button>
              )}
            </>
          )}

          {/* 신규 등록 모드: 등록/취소 버튼 */}
          {isNewRecord && (
            <>
              <LoadingButton
                type="submit"
                form="maintenance-form"
                isLoading={isSaving}
                loadingText={t('registering')}
                disabled={!formData.title?.trim() || !formData.companyName?.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
              >
                <Save size={15} />
                <span>{t('register')}</span>
              </LoadingButton>
              <button
                type="button"
                onClick={() => navigate(backPath)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-60"
                style={{
                  backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  color: themeColors.text,
                  border: `1px solid ${themeColors.border}`,
                  borderRadius: '4px',
                }}
              >
                {t('cancel')}
              </button>
            </>
          )}
        </div>
      </div>


      {/* 유지보수 폼 (신규/기존 공통) */}
      {(isNewRecord || !!existingRecord) && (
        <form id="maintenance-form" onSubmit={isNewRecord ? handleSubmit : (e) => e.preventDefault()} className="flex-1 min-h-0 flex flex-col">
          {/* 2단 레이아웃: 메인 콘텐츠 + 사이드바 */}
          <div className="flex gap-3 flex-1 min-h-0">
            {/* 메인 콘텐츠 영역 (좌측) */}
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {/* 제목 카드 */}
              <div
                className="rounded overflow-hidden flex-shrink-0"
                style={{
                  backgroundColor: themeColors.surface,
                  border: `1px solid ${themeColors.border}`,
                }}
              >
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: `1px solid ${themeColors.border}` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                    <h2 className="text-base font-bold" style={{ color: themeColors.text }}>
                      {t('requestInfo')}
                    </h2>
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  {/* 제목 */}
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>
                      {t('title')} <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required={isNewRecord}
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      onBlur={() => { if (!isNewRecord) handleFieldUpdate('title', formData.title, '제목'); }}
                      placeholder={t('enterMaintenanceTitle')}
                      className="w-full px-4 py-2.5 rounded focus:outline-none focus:ring-2 transition-all text-sm"
                      style={{
                        backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${themeColors.border}`,
                        color: themeColors.text
                      }}
                    />
                  </div>

                  {/* 업체명 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold" style={{ color: themeColors.text }}>
                        {t('companyName')} <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setCompanyInputMode('list')}
                          className="px-3 py-1 rounded text-xs font-medium transition-all"
                          style={{
                            backgroundColor: companyInputMode === 'list' ? themeColors.primary : (theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                            color: companyInputMode === 'list' ? onPrimaryText : themeColors.text,
                            border: companyInputMode === 'list' ? 'none' : `1px solid ${themeColors.border}`,
                          }}
                        >
                          {t('listSelection')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyInputMode('manual')}
                          className="px-3 py-1 rounded text-xs font-medium transition-all"
                          style={{
                            backgroundColor: companyInputMode === 'manual' ? themeColors.primary : (theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                            color: companyInputMode === 'manual' ? onPrimaryText : themeColors.text,
                            border: companyInputMode === 'manual' ? 'none' : `1px solid ${themeColors.border}`,
                          }}
                        >
                          {t('manualInput')}
                        </button>
                      </div>
                    </div>
                    {companyInputMode === 'list' ? (
                      <select
                        required={isNewRecord}
                        value={formData.companyId}
                        onChange={(e) => {
                          const selectedCompany = companies.find(c => c.id === e.target.value);
                          const newCompanyId = e.target.value;
                          const newCompanyName = selectedCompany?.name || '';
                          setFormData({ ...formData, companyId: newCompanyId, companyName: newCompanyName });
                          if (!isNewRecord) {
                            handleFieldUpdate('companyName', newCompanyName, '업체명', newCompanyName, formData.companyName || '없음', { companyId: newCompanyId });
                          }
                        }}
                        className="w-full px-4 rounded focus:outline-none focus:ring-2 transition-all text-sm"
                        style={{
                          height: '42px',
                          backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${themeColors.border}`,
                          color: themeColors.text
                        }}
                      >
                        <option value="" style={{ backgroundColor: theme !== 'light' ? '#1f2937' : 'white', color: theme !== 'light' ? '#fff' : '#000' }}>{t('selectCompany')}</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.id} style={{ backgroundColor: theme !== 'light' ? '#1f2937' : 'white', color: theme !== 'light' ? '#fff' : '#000' }}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required={isNewRecord}
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value, companyId: '' })}
                        onBlur={() => { if (!isNewRecord) handleFieldUpdate('companyName', formData.companyName, '업체명', formData.companyName || '없음', undefined, { companyId: '' }); }}
                        placeholder="예: ABC 주식회사"
                        className="w-full px-4 rounded focus:outline-none focus:ring-2 transition-all text-sm"
                        style={{
                          height: '42px',
                          backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${themeColors.border}`,
                          color: themeColors.text
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 설명 + 첨부파일 나란히 */}
              <div className="flex gap-3 flex-1 min-h-0">
                {/* 설명 카드 */}
                <div
                  className="flex-[6] min-w-0 rounded overflow-hidden flex flex-col"
                  style={{
                    backgroundColor: themeColors.surface,
                    border: `1px solid ${themeColors.border}`,
                  }}
                >
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: `1px solid ${themeColors.border}` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                      <h2 className="text-base font-bold" style={{ color: themeColors.text }}>
                        {t('detailedDescription')}
                      </h2>
                    </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div
                      ref={descriptionRef}
                      contentEditable
                      suppressContentEditableWarning
                      onPaste={handleDescriptionPaste}
                      onInput={(e) => { const html = e.currentTarget.innerHTML; setFormData(prev => ({ ...prev, description: html })); }}
                      onBlur={(e) => { if (!isNewRecord) { const html = e.currentTarget.innerHTML; handleFieldUpdate('description', html, '상세 설명'); } }}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
                          return;
                        }
                      }}
                      data-placeholder={t('maintenanceDescriptionPlaceholder')}
                      className="w-full px-4 py-2.5 rounded focus:outline-none focus:ring-2 transition-all overflow-y-auto flex-1"
                      style={{
                        backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${themeColors.border}`,
                        color: themeColors.text,
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        minHeight: '120px',
                        fontSize: '14px',
                        lineHeight: '1.6'
                      }}
                    />
                    <style>{`
                      [contenteditable] img {
                        max-width: 100%;
                        height: auto;
                        margin: 10px 0;
                        border-radius: 8px;
                        border: 1px solid ${themeColors.border};
                        display: block;
                      }
                      [contenteditable]:empty:before {
                        content: attr(data-placeholder);
                        color: ${themeColors.textSecondary};
                        opacity: 0.6;
                      }
                    `}</style>
                  </div>
                </div>

                {/* 첨부파일 카드 — 프로젝트 상세 스타일 */}
                <div
                  className="flex-[4] min-w-0"
                  style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  onDragOver={e => { if (!canUploadFile) return; handleDragOver(e); }}
                  onDragLeave={handleDragLeave}
                  onDrop={e => { if (!canUploadFile) { e.preventDefault(); return; } handleDrop(e); }}
                >
                  {canUploadFile && (
                    <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
                  )}

                  {/* 헤더 */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 1rem', borderBottom: filesCollapsed ? 'none' : `1px solid ${themeColors.border}`, cursor: 'pointer' }}
                    onClick={() => setFilesCollapsed(v => !v)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ChevronDown size={15} style={{ color: themeColors.textSecondary, opacity: 0.7, transition: 'transform 0.2s', transform: filesCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                      <input
                        type="checkbox"
                        checked={(formData.files?.length ?? 0) > 0 && (formData.files ?? []).every(f => selectedFileIds.has(f.id))}
                        ref={el => { if (el) el.indeterminate = selectedFileIds.size > 0 && !(formData.files ?? []).every(f => selectedFileIds.has(f.id)); }}
                        onChange={e => { e.stopPropagation(); const allSel = (formData.files ?? []).every(f => selectedFileIds.has(f.id)); allSel ? setSelectedFileIds(new Set()) : setSelectedFileIds(new Set((formData.files ?? []).map(f => f.id))); }}
                        onClick={e => e.stopPropagation()}
                        className="w-3 h-3" style={{ accentColor: themeColors.primary, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text }}>{t('attachments')}</span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 5px', borderRadius: '10px', backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>
                        {(formData.files?.length ?? 0) + uploadQueue.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                      {selectedFileIds.size > 0 && !isNewRecord && canDownloadFile && (
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
                    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                      {(!formData.files?.length && uploadQueue.length === 0) ? (
                        canUploadFile ? (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '1.5rem 1rem', cursor: 'pointer', border: `1px dashed ${isDragging ? themeColors.primary : themeColors.border}`, borderRadius: '0 0 4px 4px', backgroundColor: isDragging ? `${themeColors.primary}0A` : 'transparent', transition: 'all 0.15s' }}
                            onMouseEnter={e => { if (!isDragging) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)'; }}
                            onMouseLeave={e => { if (!isDragging) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Upload size={18} style={{ color: isDragging ? themeColors.primary : themeColors.textSecondary, opacity: isDragging ? 1 : 0.4 }} />
                            <span style={{ fontSize: '0.75rem', color: isDragging ? themeColors.primary : themeColors.textSecondary, fontWeight: 500 }}>
                              {isDragging ? '여기에 놓으세요' : t('dragOrClickToUpload')}
                            </span>
                          </div>
                        ) : (
                          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, opacity: 0.45 }}>첨부된 파일이 없습니다</span>
                          </div>
                        )
                      ) : (
                        <>
                          {isDragging && canUploadFile && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', pointerEvents: 'none', zIndex: 2, backgroundColor: `${themeColors.primary}10`, border: `1px dashed ${themeColors.primary}`, borderRadius: '0 0 4px 4px' }}>
                              <Upload size={20} style={{ color: themeColors.primary }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.primary }}>여기에 파일을 놓으세요</span>
                            </div>
                          )}
                          <div style={{ overflowY: 'auto', flex: 1 }}>
                            {/* 업로드 중 항목 */}
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
                            {/* 실제 파일 목록 */}
                            {(formData.files || []).map(file => {
                              const { Icon: FileIconComp, color: iconColor } = getFileIconInfo(file.filename || '');
                              const isSelected = selectedFileIds.has(file.id);
                              return (
                                <div key={file.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderTop: `1px solid ${themeColors.border}`, backgroundColor: isSelected ? `${themeColors.primary}08` : 'transparent', transition: 'background-color 0.1s', cursor: !isNewRecord ? 'pointer' : 'default' }}
                                  onClick={() => { if (!isNewRecord) handleFilePreview(file); }}
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
                                    {!isNewRecord && (
                                      <button onClick={e => { e.stopPropagation(); handleFilePreview(file); }} title="미리보기"
                                        style={{ padding: '5px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; (e.currentTarget.style.color as any) = themeColors.primary; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; (e.currentTarget.style.color as any) = themeColors.textSecondary; }}>
                                        <Eye size={14} />
                                      </button>
                                    )}
                                    {!isNewRecord && canDownloadFile && (
                                      <button onClick={e => { e.stopPropagation(); handleFileDownload(file); }} title="다운로드"
                                        style={{ padding: '5px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; (e.currentTarget.style.color as any) = themeColors.primary; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; (e.currentTarget.style.color as any) = themeColors.textSecondary; }}>
                                        <Download size={14} />
                                      </button>
                                    )}
                                    {canDeleteFile && (
                                      <button onClick={e => { e.stopPropagation(); handleRemoveFile(file.id); }} title="삭제"
                                        style={{ padding: '5px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; (e.currentTarget.style.color as any) = '#EF4444'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; (e.currentTarget.style.color as any) = themeColors.textSecondary; }}>
                                        <Trash2 size={14} />
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
            </div>

            {/* 사이드바 영역 (우측) */}
            <div className="w-80 flex-shrink-0 space-y-3 overflow-y-auto">
              {/* 상태 카드 */}
              <div
                className="rounded overflow-hidden"
                style={{
                  backgroundColor: themeColors.surface,
                  border: `1px solid ${themeColors.border}`,
                }}
              >
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: `1px solid ${themeColors.border}` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                    <h3 className="text-base font-bold" style={{ color: themeColors.text }}>{t('status')}</h3>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {[
                    { value: 'pending', label: t('statusWaiting') },
                    { value: 'in-progress', label: t('statusProcessing') },
                    { value: 'completed', label: t('statusCompleted') },
                    { value: 'urgent', label: t('statusUrgent') },
                    { value: 'on-hold', label: t('statusOnHold') }
                  ].map((option) => {
                    const isSelected = formData.status === option.value;
                    return (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 px-4 py-3 rounded cursor-pointer transition-all"
                      style={{
                        backgroundColor: isSelected ? themeColors.primary : (theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                        border: `1px solid ${isSelected ? themeColors.primary : themeColors.border}`,
                      }}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={option.value}
                        checked={isSelected}
                        onChange={(e) => {
                          const newStatus = e.target.value as MaintenanceRecord['status'];
                          setFormData({ ...formData, status: newStatus });
                          if (!isNewRecord) {
                            handleFieldUpdate('status', newStatus, '상태', option.label,
                              [{ value: 'pending', label: t('statusWaiting') }, { value: 'in-progress', label: t('statusProcessing') }, { value: 'completed', label: t('statusCompleted') }, { value: 'urgent', label: t('statusUrgent') }, { value: 'on-hold', label: t('statusOnHold') }].find(o => o.value === formData.status)?.label || formData.status
                            );
                          }
                        }}
                        className="hidden"
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: isSelected ? onPrimaryText : themeColors.text }}
                      >
                        {option.label}
                      </span>
                    </label>
                    );
                  })}
                </div>

                {/* 상태 변경 사유 */}
                {!isNewRecord && originalStatus && formData.status !== originalStatus && (
                  <div className="px-3 pb-3">
                    <div
                      className="p-3 rounded"
                      style={{
                        backgroundColor: theme !== 'light' ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 215, 0, 0.05)',
                        border: `1px solid ${theme !== 'light' ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.2)'}`
                      }}
                    >
                      <label className="block text-xs font-medium mb-2" style={{ color: themeColors.text }}>
                        {t('statusChangeReason')}
                      </label>
                      <textarea
                        value={statusChangeComment}
                        onChange={(e) => setStatusChangeComment(e.target.value)}
                        placeholder="예: 개발 완료로 테스트 진행 예정"
                        rows={2}
                        className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 transition-all resize-none"
                        style={{
                          backgroundColor: themeColors.surface,
                          border: `1px solid ${themeColors.border}`,
                          color: themeColors.text
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 담당자 카드 */}
              <div
                className="rounded overflow-hidden"
                style={{
                  backgroundColor: themeColors.surface,
                  border: `1px solid ${themeColors.border}`,
                }}
              >
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: `1px solid ${themeColors.border}` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                    <h3 className="text-base font-bold" style={{ color: themeColors.text }}>{t('assignee')}</h3>
                  </div>
                </div>
                <div className="p-3">
                  <select
                    value={formData.assignedToId}
                    onChange={(e) => {
                      const selectedUser = users.find(u => u.id === e.target.value);
                      const newId = e.target.value;
                      const newName = selectedUser?.name || '';
                      setFormData({ ...formData, assignedToId: newId, assignedToName: newName });
                      if (!isNewRecord) {
                        handleFieldUpdate('assignedToName', newName, '담당자', newName || '없음', formData.assignedToName || '없음', { assignedToId: newId });
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded focus:outline-none focus:ring-2 transition-all text-sm"
                    style={{
                      backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${themeColors.border}`,
                      color: themeColors.text
                    }}
                  >
                    <option value="" style={{ backgroundColor: theme !== 'light' ? '#1f2937' : 'white', color: theme !== 'light' ? '#fff' : '#000' }}>{t('selectAssignee')}</option>
                    {users
                      .filter((user, index, self) =>
                        index === self.findIndex(u => u.id === user.id)
                      )
                      .map(user => (
                        <option key={user.id} value={user.id} style={{ backgroundColor: theme !== 'light' ? '#1f2937' : 'white', color: theme !== 'light' ? '#fff' : '#000' }}>
                          {user.name} ({user.department})
                        </option>
                      ))
                    }
                  </select>
                  {formData.assignedToName && (
                    <div
                      className="flex items-center gap-3 mt-2 p-2.5 rounded"
                      style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
                      >
                        {formData.assignedToName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: themeColors.text }}>
                          {formData.assignedToName}
                        </p>
                        <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                          {t('assignee')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 일정 카드 */}
              <div
                className="rounded overflow-hidden"
                style={{
                  backgroundColor: themeColors.surface,
                  border: `1px solid ${themeColors.border}`,
                }}
              >
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: `1px solid ${themeColors.border}` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                    <h3 className="text-base font-bold" style={{ color: themeColors.text }}>{t('schedule')}</h3>
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                      {t('requestDate')}
                    </label>
                    <input
                      type="date"
                      value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const newDate = e.target.value ? new Date(e.target.value) : undefined;
                        setFormData({ ...formData, startDate: newDate });
                        if (!isNewRecord) handleFieldUpdate('startDate', newDate, '요청일', e.target.value ? new Date(e.target.value).toLocaleDateString('ko-KR') : '-');
                      }}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      className="w-full px-4 py-2.5 rounded focus:outline-none focus:ring-2 transition-all text-sm"
                      style={{
                        backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${themeColors.border}`,
                        color: themeColors.text,
                        colorScheme: theme !== 'light' ? 'dark' : 'light'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                      {t('expectedCompletionDate')}
                    </label>
                    <input
                      type="date"
                      value={formData.expectedCompletionDate ? new Date(formData.expectedCompletionDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const newDate = e.target.value ? new Date(e.target.value) : undefined;
                        setFormData({ ...formData, expectedCompletionDate: newDate });
                        if (!isNewRecord) handleFieldUpdate('expectedCompletionDate', newDate, '완료 예정일', e.target.value ? new Date(e.target.value).toLocaleDateString('ko-KR') : '-');
                      }}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      className="w-full px-4 py-2.5 rounded focus:outline-none focus:ring-2 transition-all text-sm"
                      style={{
                        backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${themeColors.border}`,
                        color: themeColors.text,
                        colorScheme: theme !== 'light' ? 'dark' : 'light'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}


      {/* 파일 뷰어 */}
      {viewerFile && (
        <FileViewer
          fileUrl={viewerFile.fileUrl}
          filename={viewerFile.filename}
          onClose={() => {
            if (viewerFile.fileUrl.startsWith('blob:')) URL.revokeObjectURL(viewerFile.fileUrl);
            setViewerFile(null);
          }}
        />
      )}

      {/* 변경 이력 모달 */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowHistoryModal(false); }}
        >
          <div
            className="w-full rounded-lg overflow-hidden"
            style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, height: '92vh', maxWidth: '720px', display: 'flex', flexDirection: 'column' }}
          >
            {/* 모달 헤더 */}
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-2.5">
                <History size={16} style={{ color: themeColors.primary }} />
                <h2 className="text-base font-bold" style={{ color: themeColors.text }}>변경 이력</h2>
                {existingRecord?.statusHistory && existingRecord.statusHistory.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: '#9CA3AF' }}>
                    {existingRecord.statusHistory.length}건
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded flex items-center justify-center transition-all"
                style={{ color: themeColors.textSecondary, backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
              >
                <X size={16} />
              </button>
            </div>
            {/* 모달 본문 */}
            <div className="overflow-y-auto flex-1 p-4">
              {existingRecord?.statusHistory && existingRecord.statusHistory.length > 0 ? (
                <div className="space-y-3">
                  {existingRecord.statusHistory.map((history, index) => {
                    const statusLabels: Record<string, string> = { 'pending': t('statusWaiting'), 'in-progress': t('statusProcessing'), 'completed': t('statusCompleted'), 'urgent': t('statusUrgent'), 'on-hold': t('statusOnHold') };
                    const statusColors: Record<string, string> = { 'pending': '#F59E0B', 'in-progress': '#3B82F6', 'completed': '#10B981', 'urgent': '#EF4444', 'on-hold': '#6B7280' };
                    return (
                      <div key={history.id} className="flex gap-4">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: `${statusColors[history.status]}20`, color: statusColors[history.status] }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 pb-4" style={{ borderBottom: index < existingRecord.statusHistory!.length - 1 ? `1px solid ${themeColors.border}` : 'none' }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2.5 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${statusColors[history.status]}20`, color: statusColors[history.status] }}>
                              {statusLabels[history.status] || history.status}
                            </span>
                            <span className="text-xs" style={{ color: themeColors.textSecondary }}>
                              {new Date(history.changedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>· {history.changedBy}</span>
                          </div>
                          {history.comment && (
                            <p className="text-sm mt-1" style={{ color: themeColors.text }}>{history.comment}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: themeColors.textSecondary }}>
                  <History size={48} className="mb-4 opacity-20" />
                  <p className="text-base">변경 이력이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 저장 중 로딩 오버레이 */}
      {isSaving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <LoadingSpinner
            size="lg"
            message={isNewRecord ? t('registering') : t('savingInProgress')}
          />
        </div>
      )}
    </div>
  );
};

export default MaintenanceDetail;
