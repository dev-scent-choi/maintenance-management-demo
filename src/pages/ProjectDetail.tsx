import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Building2, Clock, AlertCircle, Plus, RefreshCw, FileText,
  Calendar, Image, File, Archive, Video, Download, UserPlus, X,
  Target, Users, Bug, Lightbulb, Zap, HelpCircle, MoreVertical,
  ChevronRight, ChevronDown, Shield, AlertTriangle, CheckCircle2, CheckCircle, XCircle, Circle, Timer, Upload, Folder, Search,
  Activity, FolderKanban, Pencil, TrendingUp,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { isAdminAccount } from '../utils/permissions';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuditLog } from '../hooks/useAuditLog';
import { toast } from 'react-hot-toast';
import type { UploadQueueItem } from '../utils/uploadWithProgress';
import JSZip from 'jszip';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FileViewer from '../components/FileViewer';
import ConfirmPopover from '../components/common/ConfirmPopover';
import TaskCreateModal from './TaskCreateModal';
import ProjectEditModal from './ProjectEditModal';
import MilestoneSidePanel from './MilestoneSidePanel';
import type { Task, Issue, Timeline, AuditLog } from '../types';

// Avatar generation
const getMemberAvatarUrl = (memberId: string) => {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${memberId}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

// File type icon mapping
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return Image;
  if (['mp4', 'avi', 'mov', 'webm'].includes(ext || '')) return Video;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return Archive;
  if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'].includes(ext || '')) return FileText;
  return File;
};

const getFileIconColor = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext || '')) return '#EF4444';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '#10B981';
  if (['doc', 'docx', 'txt'].includes(ext || '')) return '#3B82F6';
  if (['ppt', 'pptx'].includes(ext || '')) return '#F97316';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return '#8B5CF6';
  if (['mp4', 'avi', 'mov', 'webm'].includes(ext || '')) return '#F59E0B';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return '#F97316';
  return '#6B7280';
};

const formatFileSize = (size?: number) => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

// HTML 태그 제거 + 엔티티 디코딩 헬퍼 (리스트 설명 표시용)
const stripHtml = (html: string): string => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || el.innerText || '').trim();
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useLanguage();
  const { token, user } = useAuthStore();
  const { log: auditLog } = useAuditLog();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const {
    projects, fetchProjects, deleteProject,
    tasks, fetchProjectTasks, updateProjectProgress, deleteTask,
    issues, fetchProjectIssues, deleteIssue,
    timelines, fetchProjectTimeline,
    getProjectStats, getOverdueTasks,
    fetchProjectDocuments, uploadProjectDocument, deleteProjectDocument,
    renameProjectDocument, fetchProjectFolders, createProjectFolder, renameProjectFolder, deleteProjectFolder,
    milestones, fetchProjectMilestones, addMilestone, updateMilestone, deleteMilestone,
  } = useProjectStore();

  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const isInitialized = useRef(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [projectDocuments, setProjectDocuments] = useState<any[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isDragOverDoc, setIsDragOverDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  // null = not creating; '' = root level; 'path' = subfolder under path
  const [addingSubfolderTo, setAddingSubfolderTo] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [hoverFolder, setHoverFolder] = useState<string | null>(null);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameDocValue, setRenameDocValue] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());
  const [virtualFolders, setVirtualFolders] = useState<string[]>([]);
  const [projectMembers, setProjectMembers] = useState<Array<{id: string, name: string, email: string, department?: string, position?: string}>>([]);
  const [docSearch, setDocSearch] = useState('');
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'delayed' | 'in_progress' | 'review' | 'todo' | 'done' | 'all'>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | 'feature' | 'improvement' | 'bug' | 'task'>('all');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFullDocs, setShowFullDocs] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [projectAuditLogs, setProjectAuditLogs] = useState<AuditLog[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'task' | 'project'>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showFullTasks, setShowFullTasks] = useState(false);
  // Milestone side panel
  const [msPanelOpen, setMsPanelOpen] = useState(false);
  const [msPanelMilestone, setMsPanelMilestone] = useState<Timeline | null>(null);
  const [issueCollapsed, setIssueCollapsed] = useState(false);
  const [docCollapsed, setDocCollapsed] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const [taskCollapsed, setTaskCollapsed] = useState(false);
  const taskGridCols = '28px 56px 72px 72px 72px 500px 90px 60px 80px 80px';
  const [questionCollapsed, setQuestionCollapsed] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const cardStyle = {
    backgroundColor: themeColors.surface,
    border: `1px solid ${themeColors.border}`,
  };

  const subtleBg = theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  useEffect(() => {
    const fetchProjectDetail = async () => {
      if (!id || !token) { setIsLoading(false); setIsMembersLoading(false); return; }
      isInitialized.current = false;
      setIsLoading(true);
      try {
        // 스토어에서 최신 상태 직접 조회 (클로저 stale 방지)
        let storeProjects = useProjectStore.getState().projects;
        if (storeProjects.length === 0) {
          await fetchProjects();
          storeProjects = useProjectStore.getState().projects;
        }
        const foundProject = storeProjects.find((p: any) => p.id === id);
        if (!foundProject) {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setProject({
              id: data.id.toString(), name: data.name, description: data.description || '',
              status: data.status.toLowerCase(), progress: data.progress,
              companyId: data.companyId?.toString(), companyName: data.companyName,
              ownerId: data.managerId.toString(),
              memberIds: data.members?.filter((m: string | null) => m != null) || [],
              startDate: data.startDate ? new Date(data.startDate) : undefined,
              dueDate: data.endDate ? new Date(data.endDate) : undefined,
              createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt),
            });
          }
        } else {
          setProject(foundProject);
        }
        isInitialized.current = true;
        await fetchProjectTasks(id);
        await fetchProjectIssues(id);
        await fetchProjectTimeline(id);
        await fetchProjectMilestones(id);
        const [docs, folders] = await Promise.all([
          fetchProjectDocuments(id),
          fetchProjectFolders(id),
        ]);
        setProjectDocuments(docs);
        setVirtualFolders(folders);
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjectDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  // 스토어 projects 변경 시 로컬 project 상태만 동기화 (tasks 재조회 없음)
  useEffect(() => {
    if (!id || !isInitialized.current || projects.length === 0) return;
    const foundProject = projects.find((p) => p.id === id);
    if (foundProject) setProject(foundProject);
  }, [projects, id]);

  // Authorization check — runs whenever project or user changes
  useEffect(() => {
    if (!project || !user) return;
    const authorized =
      isAdminAccount(user) ||
      project.ownerId === user.id ||
      (project.memberIds || []).includes(user.id);
    if (!authorized) setIsUnauthorized(true);
  }, [project, user]);

  // Fetch project audit logs
  const fetchProjectAuditLogs = async () => {
    if (!id || !token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const projectName = project?.name || '';
        const filtered: AuditLog[] = data
          .filter((l: any) => {
            const rid = l.resourceId;
            // 1. resourceType이 project이고 resourceId가 프로젝트 ID와 일치
            if (l.resourceType === 'project' && rid !== null && rid !== undefined && rid.toString() === id) return true;
            // 2. resourceType이 project이고 resourceName이 프로젝트명과 일치
            if (l.resourceType === 'project' && projectName && l.resourceName === projectName) return true;
            // 3. details에 [프로젝트: 프로젝트명] 포함 (파일·작업 등 하위 활동)
            if (projectName && l.details && l.details.includes(`[프로젝트: ${projectName}]`)) return true;
            return false;
          })
          .map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
        setProjectAuditLogs(filtered);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    }
  };

  useEffect(() => {
    if (id && token) fetchProjectAuditLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  // Fetch project members
  useEffect(() => {
    const fetchMembers = async () => {
      if (!project || !token) return;
      setIsMembersLoading(true);
      try {
        const usersRes = await fetch(import.meta.env.VITE_API_URL + '/users', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const memberIds = [project.ownerId, ...(project.memberIds || [])];
          const members = usersData
            .filter((u: any) => memberIds.includes(u.id.toString()))
            .map((u: any) => ({
              id: u.id.toString(), name: u.name, email: u.email,
              department: u.department, position: u.position,
            }));
          setProjectMembers(members);
        }
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setIsMembersLoading(false);
      }
    };
    fetchMembers();
  }, [project?.id, token]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteProject(id);
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(t('deleteProjectFailed'));
    }
  };

  const refreshProjectProgress = async () => {
    if (!id) return;
    try {
      await updateProjectProgress(id);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProject({
          id: data.id.toString(), name: data.name, description: data.description || '',
          status: data.status.toLowerCase(), progress: data.progress,
          companyId: data.companyId?.toString(), companyName: data.companyName,
          ownerId: data.managerId.toString(),
          memberIds: data.members?.filter((m: string | null) => m != null) || [],
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          dueDate: data.endDate ? new Date(data.endDate) : undefined,
          createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt),
        });
      }
    } catch (error) {
      console.error('Error refreshing progress:', error);
    }
  };

  const handleRefreshProgress = async () => {
    if (!id) return;
    setIsUpdatingProgress(true);
    try { await refreshProjectProgress(); }
    finally { setIsUpdatingProgress(false); }
  };

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/tasks/attachments/${attachmentId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        auditLog('download', 'file', `"${fileName}" 작업 첨부파일을 다운로드했습니다. [프로젝트: ${project?.name || id}]`, attachmentId, fileName);
      } else { alert(t('downloadFailed')); }
    } catch (error) { alert(t('fileDownloadError')); }
  };

  const handleDocumentUpload = async (files: FileList | File[]) => {
    if (!id || !token) return;
    const fileArray = Array.from(files);
    const queueItems: UploadQueueItem[] = fileArray.map(f => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name, size: f.size, progress: 0, status: 'pending' as const,
    }));
    // 파일 선택 즉시 리스트에 표시 (React 18 자동 배치 우회 → 강제 동기 렌더)
    flushSync(() => setUploadQueue(queueItems));
    setIsUploadingDoc(true);

    try {
      const results = await Promise.allSettled(
        fileArray.map(async (file, i) => {
          const key = queueItems[i].key;
          flushSync(() => setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, status: 'uploading' } : x)));
          try {
            const doc = await uploadProjectDocument(id, file, currentFolder, (pct) => {
              setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, progress: pct } : x));
            });
            setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, progress: 100, status: 'done' } : x));
            const folderInfo = currentFolder ? ` (폴더: ${currentFolder})` : '';
            auditLog('upload', 'file', `"${file.name}" 파일을 업로드했습니다.${folderInfo} [프로젝트: ${project?.name || id}]`, doc.id, file.name);
            return { key, doc };
          } catch (err: any) {
            setUploadQueue(prev => prev.map(x => x.key === key ? { ...x, status: 'error' } : x));
            toast.error(err?.message || `${file.name} 업로드 실패`);
            throw err;
          }
        })
      );

      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<{ key: string; doc: any }> => r.status === 'fulfilled')
        .map(r => r.value);
      const successKeys = new Set(succeeded.map(s => s.key));
      const uploadedDocs = succeeded.map(s => s.doc);

      if (uploadedDocs.length > 0) {
        setProjectDocuments(prev => [...prev, ...uploadedDocs]);
      }
      // 성공 항목 즉시 제거 → setProjectDocuments와 동일 렌더 = 중복 row 없음
      setUploadQueue(prev => prev.filter(x => !successKeys.has(x.key)));
      if (results.some(r => r.status === 'rejected')) {
        setTimeout(() => setUploadQueue([]), 3000);
      }
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleCreateSubfolder = async () => {
    if (!id) return;
    const name = newSubfolderName.trim();
    if (!name) { setAddingSubfolderTo(null); setNewSubfolderName(''); return; }
    const fullPath = addingSubfolderTo ? `${addingSubfolderTo}/${name}` : name;
    const allExistingFolders = Array.from(new Set([
      ...projectDocuments.filter(d => d.folderName).map(d => d.folderName as string),
      ...virtualFolders,
    ]));
    if (allExistingFolders.includes(fullPath)) { alert('이미 존재하는 폴더 이름입니다.'); return; }
    try {
      await createProjectFolder(id, fullPath);
    } catch {
      // 서버 저장 실패해도 로컬에는 추가 (서버 미구현 대비)
    }
    setVirtualFolders(prev => [...prev, fullPath]);
    setCurrentFolder(fullPath);
    setNewSubfolderName('');
    setAddingSubfolderTo(null);
    auditLog('create', 'file', `"${fullPath}" 폴더를 생성했습니다. [프로젝트: ${project?.name || id}]`, undefined, fullPath);
  };

  const handleFolderRename = async (oldPath: string, newDisplayName: string) => {
    if (!id) { setRenamingFolder(null); return; }
    const trimmedDisplay = newDisplayName.trim();
    // Reconstruct full path: keep parent prefix, replace last segment
    const parts = oldPath.split('/');
    const parentPrefix = parts.slice(0, -1).join('/');
    const newPath = parentPrefix ? `${parentPrefix}/${trimmedDisplay}` : trimmedDisplay;
    if (!trimmedDisplay || newPath === oldPath) { setRenamingFolder(null); return; }
    const allFolderNames = Array.from(new Set(projectDocuments.filter(d => d.folderName).map(d => d.folderName as string)));
    if (allFolderNames.includes(newPath)) { alert('이미 존재하는 폴더 이름입니다.'); return; }
    try {
      await renameProjectFolder(id, oldPath, newPath);
      // Frontend: update exact match + update children paths
      setProjectDocuments(prev => prev.map(d => {
        if (d.folderName === oldPath) return { ...d, folderName: newPath };
        if (d.folderName?.startsWith(oldPath + '/')) return { ...d, folderName: newPath + d.folderName.slice(oldPath.length) };
        return d;
      }));
      setVirtualFolders(prev => prev.map(f => {
        if (f === oldPath) return newPath;
        if (f.startsWith(oldPath + '/')) return newPath + f.slice(oldPath.length);
        return f;
      }));
      if (currentFolder === oldPath) setCurrentFolder(newPath);
      else if (currentFolder?.startsWith(oldPath + '/')) setCurrentFolder(newPath + currentFolder.slice(oldPath.length));
      setRenamingFolder(null);
    } catch {
      alert('폴더 이름 변경에 실패했습니다.');
      setRenamingFolder(null);
    }
  };

  const executeFolderDelete = async (folderPath: string) => {
    if (!id) return;
    const childPrefix = folderPath + '/';
    try {
      await deleteProjectFolder(id, folderPath);
      setProjectDocuments(prev => prev.filter(d => d.folderName !== folderPath && !d.folderName?.startsWith(childPrefix)));
      setVirtualFolders(prev => prev.filter(f => f !== folderPath && !f.startsWith(childPrefix)));
      if (currentFolder === folderPath || currentFolder?.startsWith(childPrefix)) setCurrentFolder(null);
      setFolderMenuOpen(null);
    } catch {
      alert('폴더 삭제에 실패했습니다.');
    }
  };

  const handleFolderDelete = (folderPath: string) => {
    if (!id) return;
    const childPrefix = folderPath + '/';
    const count = projectDocuments.filter(d => d.folderName === folderPath || d.folderName?.startsWith(childPrefix)).length;
    const folderName = folderPath.split('/').pop() || folderPath;
    setConfirmConfig({
      title: `"${folderName}" 폴더가 삭제됩니다.`,
      description: count > 0 ? `하위 파일 ${count}개도 함께 삭제됩니다. 삭제하면 복구할 수 없습니다.` : '삭제하면 복구할 수 없습니다.',
      onConfirm: async () => {
        setConfirmConfig(null);
        await executeFolderDelete(folderPath);
      },
    });
  };

  const handleDocRename = async (docId: string, newName: string) => {
    if (!id || !newName.trim()) { setRenamingDocId(null); return; }
    try {
      await renameProjectDocument(id, docId, newName.trim());
      setProjectDocuments(prev => prev.map(d => d.id === docId ? { ...d, name: newName.trim() } : d));
      setRenamingDocId(null);
    } catch {
      alert('파일 이름 변경에 실패했습니다.');
      setRenamingDocId(null);
    }
  };

  const handleBulkDownload = async () => {
    const docs = projectDocuments.filter(d => selectedDocIds.has(d.id));
    if (docs.length === 0) return;
    if (docs.length === 1) {
      handleDocumentDownload(docs[0]);
      toast.success('파일을 다운로드했습니다.');
      return;
    }
    const toastId = toast.loading(`${docs.length}개 파일을 압축 중...`);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const zip = new JSZip();
      for (const doc of docs) {
        const rawUrl = doc.url || doc.fileUrl;
        if (!rawUrl) continue;
        const fileUrl = rawUrl.startsWith('http') ? rawUrl : `${apiBase}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
        try {
          const res = await fetch(fileUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (!res.ok) continue;
          const blob = await res.blob();
          zip.file(doc.name, blob);
        } catch { /* 개별 파일 실패 무시 */ }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const zipName = `${project?.name || 'project'}_${dateStr}.zip`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`${docs.length}개 파일을 ${zipName}으로 다운로드했습니다.`, { id: toastId });
      auditLog('download', 'file', `${docs.length}개 파일을 ZIP으로 다운로드했습니다. [프로젝트: ${project?.name || id}]`);
    } catch {
      toast.error('ZIP 파일 생성에 실패했습니다.', { id: toastId });
    }
  };

  const executeBulkDelete = async () => {
    if (!id || selectedDocIds.size === 0) return;
    const ids = Array.from(selectedDocIds);
    try {
      for (const docId of ids) {
        await deleteProjectDocument(id, docId);
      }
      setProjectDocuments(prev => prev.filter(d => !selectedDocIds.has(d.id)));
      setSelectedDocIds(new Set());
      toast.success(`${ids.length}개 파일이 삭제되었습니다.`);
      auditLog('delete', 'file', `${ids.length}개 파일을 삭제했습니다. [프로젝트: ${project?.name || id}]`);
    } catch {
      toast.error('일부 파일 삭제에 실패했습니다.');
    }
  };

  const handleBulkDelete = () => {
    if (!id || selectedDocIds.size === 0) return;
    setConfirmConfig({
      title: '선택한 모든 파일이 삭제됩니다.',
      description: '삭제하면 복구할 수 없습니다.',
      onConfirm: async () => {
        setConfirmConfig(null);
        await executeBulkDelete();
      },
    });
  };

  const toggleDocSelect = (docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const executeDocumentDelete = async (documentId: string) => {
    if (!id) return;
    const docToDelete = projectDocuments.find(d => d.id === documentId);
    try {
      await deleteProjectDocument(id, documentId);
      setProjectDocuments(prev => prev.filter(d => d.id !== documentId));
      toast.success('파일이 삭제되었습니다.');
      if (docToDelete) {
        auditLog('delete', 'file', `"${docToDelete.name}" 파일을 삭제했습니다. [프로젝트: ${project?.name || id}]`, documentId, docToDelete.name);
      }
    } catch {
      toast.error('파일 삭제에 실패했습니다.');
    }
  };

  const handleDocumentDelete = (documentId: string) => {
    if (!id) return;
    const docToDelete = projectDocuments.find(d => d.id === documentId);
    setConfirmConfig({
      title: `"${docToDelete?.name || '파일'}"이 삭제됩니다.`,
      description: '삭제하면 복구할 수 없습니다.',
      onConfirm: async () => {
        setConfirmConfig(null);
        await executeDocumentDelete(documentId);
      },
    });
  };

  const handleDocView = async (doc: any) => {
    const fileUrl = doc.url || doc.fileUrl || '';
    if (!fileUrl) return;
    // xlsx/dwg: 원본 URL 그대로 전달 (백엔드 직접 접근)
    if ((doc.name || '').toLowerCase().match(/\.(xlsx|xls|xlsm|xlsb|dwg|dxf)$/)) {
      setViewingDoc(doc); return;
    }
    if (fileUrl.startsWith('data:') || fileUrl.startsWith('blob:')) { setViewingDoc(doc); return; }
    try {
      const response = await fetch(fileUrl, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Failed to fetch');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setViewingDoc({ ...doc, url: blobUrl, fileUrl: blobUrl });
    } catch { setViewingDoc(doc); }
  };

  const handleDocumentDownload = (doc: any) => {
    const fileUrl = doc.url || doc.fileUrl;
    if (!fileUrl) return;
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    auditLog('download', 'file', `"${doc.name}" 파일을 다운로드했습니다. [프로젝트: ${project?.name || id}]`, doc.id, doc.name);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDoc(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOverDoc(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDoc(false);
    if (e.dataTransfer.files.length > 0) {
      handleDocumentUpload(e.dataTransfer.files);
    }
  };

  // --- Helper functions ---
  const _dark = theme !== 'light';
  const hoverBg = _dark ? 'rgba(177,186,196,0.08)' : 'rgba(55,53,47,0.06)';
  const projectNotionStatus = {
    planning:    _dark ? { bg: '#143D6B', text: '#82BFDF' } : { bg: '#D3E5EF', text: '#0B6E99' },
    in_progress: _dark ? { bg: '#1C3829', text: '#6DC47A' } : { bg: '#DBEDDB', text: '#1D7B52' },
    on_hold:     _dark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' },
    completed:   _dark ? { bg: '#1B3C32', text: '#4DC09F' } : { bg: '#D3F0E5', text: '#0F7B6C' },
    cancelled:   _dark ? { bg: '#3D1515', text: '#E07070' } : { bg: '#FDDEDE', text: '#C0392B' },
  };
  const getProjectStatusConfig = (status: string) => {
    const s = status === 'active' ? 'in_progress' : status;
    const colors = projectNotionStatus[s as keyof typeof projectNotionStatus] || projectNotionStatus.on_hold;
    const labelMap: Record<string, string> = {
      planning: t('planning'), in_progress: t('inProgressProject'), active: t('inProgressProject'),
      on_hold: t('hold'), completed: t('completedProject'), cancelled: t('cancelledProject'),
    };
    return { ...colors, label: labelMap[status] || status };
  };

  const getTaskStatusColor = (status: string): { bg: string; text: string } => {
    const colors: Record<string, { bg: string; text: string }> = {
      todo:        { bg: _dark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.06)', text: _dark ? '#999898' : '#787774' },
      in_progress: { bg: _dark ? '#1C3829' : '#DBEDDB', text: _dark ? '#6DC47A' : '#1D7B52' },
      review:      { bg: _dark ? '#3A2D0F' : '#FAF3DD',  text: _dark ? '#E3B060' : '#C17F2A' },
      done:        { bg: _dark ? '#1B3C32' : '#D3F0E5', text: _dark ? '#4DC09F' : '#0F7B6C' },
    };
    return colors[status] || colors.todo;
  };

  const getTaskStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      todo: t('todoStatus'), in_progress: t('inProgressStatus'), review: t('reviewStatus'), done: t('doneStatus'),
    };
    return labels[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#EF4444';
      case 'high': return '#F97316';
      case 'medium': return '#EAB308';
      default: return '#94A3B8';
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatRelativeDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return t('justNow');
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return formatDate(date);
  };

  // Health status
  const getProjectHealthStatus = () => {
    if (!id || !project) return 'normal';
    if (project.status === 'on_hold') return 'hold';
    if (project.status === 'completed') return 'completed';
    if (project.status === 'cancelled') return 'completed';
    const now = new Date();
    const dueDate = project.dueDate ? new Date(project.dueDate) : null;
    const overdueTasks = getOverdueTasks(id);
    if (dueDate && now > dueDate) return 'danger';
    if (overdueTasks.length > 0) return 'warning';
    return 'normal';
  };

  const getHealthConfig = (health: string) => {
    switch (health) {
      case 'normal': return { label: t('healthNormal'), color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', icon: CheckCircle2 };
      case 'warning': return { label: t('healthWarning'), color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', icon: AlertTriangle };
      case 'danger': return { label: t('healthDanger'), color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', icon: AlertCircle };
      case 'hold': return { label: t('healthHold'), color: '#6B7280', bg: 'rgba(107, 114, 128, 0.1)', icon: Circle };
      case 'completed': return { label: t('healthCompleted'), color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', icon: CheckCircle2 };
      default: return { label: t('healthNormal'), color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', icon: CheckCircle2 };
    }
  };

  // D-day
  const getDDay = () => {
    if (!project || !project.dueDate) return null;
    const diff = Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / 86400000);
    return diff;
  };

  // Derived data
  const projectTasksRaw: Task[] = id ? tasks[id] || [] : [];
  const projectIssuesRaw: Issue[] = id ? issues.filter((i: Issue) => i.projectId === id) : [];
  const projectTimelinesRaw: Timeline[] = id ? milestones[id] || [] : [];

  const projectTasks: Task[] = projectTasksRaw;
  const projectIssues: Issue[] = projectIssuesRaw;
  const projectTimelines: Timeline[] = projectTimelinesRaw;
  const effectiveMembers = projectMembers;
  const stats = id ? getProjectStats(id) : { totalTasks: 0, completedTasks: 0, inProgressTasks: 0, openIssues: 0, overdueItems: 0 };
  const overdueTasks = id ? getOverdueTasks(id) : [];
  const waitingTasks = projectTasks.filter(t => t.status === 'todo').length;

  // Collect all attachments from tasks
  const allAttachments = projectTasks.reduce((acc: any[], task) => {
    if (task.attachments && task.attachments.length > 0) {
      return [...acc, ...task.attachments.map((att: any) => ({ ...att, taskTitle: task.title, taskId: task.id }))];
    }
    return acc;
  }, []);

  const health = getProjectHealthStatus();
  const healthConfig = getHealthConfig(health);
  const dDay = getDDay();
  const HealthIcon = healthConfig.icon;

  const isCompleted = project !== null && (project.status === 'completed' || project.status === 'cancelled');
  const displayProgress = project?.status === 'completed' ? 100 : (project?.progress ?? 0);
  const progressColor = isCompleted ? (_dark ? '#3FB950' : '#0F7B6C') : themeColors.primary;
  const projectDays = project?.startDate && project?.dueDate
    ? Math.ceil((new Date(project.dueDate).getTime() - new Date(project.startDate).getTime()) / 86400000)
    : null;
  const ganttStart = project?.startDate ? new Date(project.startDate).getTime() : null;
  const ganttEnd = project?.dueDate ? new Date(project.dueDate).getTime() : null;
  const ganttRange = ganttStart && ganttEnd ? ganttEnd - ganttStart : null;
  const todayPct = ganttRange ? Math.max(0, Math.min(100, (Date.now() - ganttStart!) / ganttRange * 100)) : null;
  const sortedTasks = [...projectTasks]
    .filter(t => !myTasksOnly || !user || t.assigneeId === user.id)
    .sort((a, b) => {
      const aOverdue = a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'done' ? -100 : 0;
      const bOverdue = b.dueDate && new Date(b.dueDate) < new Date() && b.status !== 'done' ? -100 : 0;
      const p: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (aOverdue + (p[a.priority] ?? 3)) - (bOverdue + (p[b.priority] ?? 3));
    });

  const filteredTasks = sortedTasks.filter(t => {
    if (taskStatusFilter === 'all') return true;
    if (taskStatusFilter === 'delayed') return !!(t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');
    if (taskStatusFilter === 'in_progress') return t.status === 'in_progress';
    if (taskStatusFilter === 'review') return t.status === 'review';
    if (taskStatusFilter === 'todo') return t.status === 'todo';
    if (taskStatusFilter === 'done') return t.status === 'done';
    return true;
  });

  // Combined work items: tasks + feature/improvement issues
  const _issueStToTaskSt = (s: string): 'todo' | 'in_progress' | 'review' | 'done' =>
    s === 'in_progress' ? 'in_progress' : (s === 'resolved' || s === 'closed') ? 'done' : 'todo';
  const featureWorkItems = projectIssues
    .filter(i => (!myTasksOnly || !user || i.assigneeId === user.id))
    .map(i => {
      const sevToP: Record<string, string> = { minor: 'low', major: 'medium', critical: 'high', blocker: 'urgent' };
      return { id: i.id, kind: i.type as string, title: i.title, description: i.description || '', status: _issueStToTaskSt(i.status), issueStatus: i.status as string, priority: sevToP[i.severity || ''] || i.priority, assigneeId: i.assigneeId, dueDate: i.dueDate as Date | undefined, createdAt: i.createdAt as Date | undefined, completedAt: undefined as Date | undefined, weight: undefined as number | undefined };
    });
  const allWorkItems = [
    ...sortedTasks.map(t => ({ id: t.id, kind: 'task' as string, title: t.title, description: t.description || '', status: t.status, issueStatus: undefined as string | undefined, priority: t.priority, assigneeId: t.assigneeId, dueDate: t.dueDate, createdAt: t.createdAt as Date | undefined, completedAt: t.completedAt as Date | undefined, weight: t.weight as number | undefined, severity: undefined as string | undefined })),
    ...featureWorkItems,
  ];
  const kindOrder: Record<string, number> = { bug: 0, feature: 1, improvement: 2, task: 3, other: 4 };
  const prioOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const stOrder: Record<string, number> = { in_progress: 0, todo: 1, review: 2, done: 3 };
  const filteredWorkItems = allWorkItems
    .filter(wi => {
      if (taskTypeFilter !== 'all' && wi.kind !== taskTypeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      // 기본 정렬: 등록일(createdAt) 내림차순 → 유형(kind) 오름차순 → 설명(title) 오름차순
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (bDate !== aDate) return bDate - aDate;
      const k = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
      if (k !== 0) return k;
      return (a.title || '').localeCompare(b.title || '', 'ko');
    });

  // Section title component
  const SectionTitle = ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
      <div className="flex items-center gap-2.5">
        <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
        <h3 className="text-sm font-bold" style={{ color: themeColors.text }}>{title}</h3>
      </div>
      {action}
    </div>
  );

  // Issue type icon
  const getIssueTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return Bug;
      case 'feature': return Lightbulb;
      case 'improvement': return Zap;
      case 'question': return HelpCircle;
      default: return AlertCircle;
    }
  };

  const getIssueTypeLabel = (type: string) => {
    switch (type) {
      case 'bug': return t('issueTypeBug');
      case 'feature': return t('issueTypeFeature');
      case 'improvement': return t('issueTypeImprovement');
      case 'other': return t('issueTypeOther');
      default: return t('issueTypeOther');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'blocker': return '#EF4444';
      case 'critical': return '#F97316';
      case 'major': return '#EAB308';
      default: return '#6B7280';
    }
  };

  const getTimelineStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return { icon: CheckCircle2, color: _dark ? '#4DC09F' : '#0F7B6C' };
      case 'in_progress': return { icon: Timer, color: _dark ? '#6DC47A' : '#1D7B52' };
      case 'missed': return { icon: AlertCircle, color: '#EF4444' };
      default: return { icon: Circle, color: '#6B7280' };
    }
  };

  if (isLoading || isMembersLoading) return <LoadingSpinner message="프로젝트 상세 정보를 불러오는 중..." />;

  if (isUnauthorized) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.75rem' }}>
        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.08)', marginBottom: '0.25rem' }}>
          <Shield size={28} style={{ color: '#EF4444', opacity: 0.7 }} />
        </div>
        <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: themeColors.text, margin: 0 }}>접근 권한이 없습니다</p>
        <p style={{ fontSize: '0.875rem', color: themeColors.textSecondary, opacity: 0.7, margin: 0 }}>이 프로젝트의 팀원(담당자 또는 참여자)만 접근할 수 있습니다.</p>
        <button
          onClick={() => navigate('/projects')}
          style={{ marginTop: '0.5rem', padding: '0.4375rem 1.25rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 600, backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', border: 'none', cursor: 'pointer' }}
        >
          프로젝트 목록으로
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 rounded flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${themeColors.primary}10` }}>
            <AlertCircle size={32} style={{ color: themeColors.primary, opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: themeColors.text }}>{t('projectNotFound')}</p>
          <button onClick={() => navigate('/projects')}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: themeColors.primary }}>
            {t('goToProjectList')}
          </button>
        </div>
      </div>
    );
  }

  const ownerMember = projectMembers.find(m => m.id === project.ownerId);

  const onPrimaryText = theme === 'yellow' ? '#333' : '#fff';
  const sectionLabel: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: themeColors.textSecondary,
  };
  const containerStyle: React.CSSProperties = {
    border: `1px solid ${themeColors.border}`,
    borderRadius: '6px',
    overflow: 'hidden',
  };

  // ── Notion-style helpers ────────────────────────────────────
  const notionPropRow = (icon: React.ReactNode, label: string, content: React.ReactNode) => (
    <div
      style={{ display: 'flex', alignItems: 'center', minHeight: '2rem', padding: '0.1875rem 0.375rem', borderRadius: '4px', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <div style={{ width: '9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, color: themeColors.textSecondary, fontSize: '0.875rem' }}>
        <span style={{ opacity: 0.6, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ flex: 1, fontSize: '0.875rem', color: themeColors.text }}>{content}</div>
    </div>
  );

  const secDivider = (title: string, action?: React.ReactNode, collapsed?: boolean, onToggle?: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', margin: '2rem 0 1rem', cursor: onToggle ? 'pointer' : 'default' }}
      onClick={onToggle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
        {onToggle !== undefined && <ChevronDown size={15} style={{ color: themeColors.textSecondary, opacity: 0.7, transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }} />}
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text, whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      <div style={{ flex: 1, height: '1px', backgroundColor: themeColors.border }} />
      {action && <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>{action}</div>}
    </div>
  );

  const sideCard: React.CSSProperties = {
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px', overflow: 'hidden',
    backgroundColor: themeColors.surface,
  };

  return (
    <div className="flex flex-col pb-8" style={{ paddingTop: '0.25rem' }}>
      <input ref={fileInputRef} type="file" multiple className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleDocumentUpload(e.target.files);
            e.target.value = ''; // 동일 파일 삭제 후 재업로드 허용
          }
        }} />

      {/* ─── BREADCRUMB ─── */}
      <div style={{ marginBottom: '0.625rem' }}>
        <button onClick={() => navigate('/projects')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: themeColors.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.375rem', borderRadius: '4px', opacity: 0.7 }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = hoverBg; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
          <ArrowLeft size={13} /> 프로젝트 목록
        </button>
      </div>

      {/* ─── TITLE BLOCK ─── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: '1.2', color: isCompleted ? themeColors.textSecondary : themeColors.text, marginBottom: '0.5rem' }}>
            {project.name}
          </h1>
          {project.description && (
            <p style={{ fontSize: '0.9375rem', color: themeColors.textSecondary, lineHeight: '1.65', maxWidth: '560px' }}>
              {project.description}
            </p>
          )}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, paddingTop: '0.25rem' }}>
          <button onClick={() => setShowTaskModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 600, backgroundColor: themeColors.primary, color: onPrimaryText, border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            <Plus size={13} /> 작업 추가
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ padding: '0.375rem 0.75rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 500, background: 'transparent', color: themeColors.textSecondary, border: `1px solid ${themeColors.border}`, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            문서 업로드
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMoreMenu(v => !v)}
              style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', background: 'transparent', border: `1px solid ${themeColors.border}`, color: themeColors.textSecondary, cursor: 'pointer' }}>
              <MoreVertical size={15} />
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20, minWidth: '140px', backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, borderRadius: '6px', padding: '4px 0', boxShadow: _dark ? '0 4px 16px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.12)' }}>
                  {[
                    { label: '편집', icon: <Edit size={12} />, onClick: () => { setShowEditModal(true); setShowMoreMenu(false); } },
                    { label: '진행률 갱신', icon: <RefreshCw size={12} className={isUpdatingProgress ? 'animate-spin' : ''} />, onClick: () => { setShowMoreMenu(false); handleRefreshProgress(); } },
                    { label: '링크 복사', icon: <UserPlus size={12} />, onClick: () => { navigator.clipboard.writeText(window.location.href); setShowMoreMenu(false); } },
                  ].map(item => (
                    <button key={item.label} onClick={item.onClick}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer', color: themeColors.text }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <span style={{ color: themeColors.textSecondary }}>{item.icon}</span>{item.label}
                    </button>
                  ))}
                  <div style={{ height: '1px', backgroundColor: themeColors.border, margin: '4px 0' }} />
                  <button onClick={() => { setShowMoreMenu(false); setConfirmConfig({ title: '선택한 프로젝트가 삭제됩니다.', description: '삭제하면 복구할 수 없습니다.', onConfirm: async () => { setConfirmConfig(null); await handleDelete(); } }); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <Trash2 size={12} /> 삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── INFO + MILESTONE two-column ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 6fr', gap: '1.5rem', marginBottom: '0.75rem', alignItems: 'start' }}>

        {/* Left: 기본 정보 (Notion property rows) */}
        <div style={{ borderTop: `1px solid ${themeColors.border}`, paddingTop: '0.5rem', paddingBottom: '0.75rem' }}>
          {notionPropRow(<Target size={13} />, '상태',
            (() => { const sc = getProjectStatusConfig(project.status); return (
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: '3px', fontSize: '0.8125rem', fontWeight: 600, backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
            ); })()
          )}
          {notionPropRow(<Building2 size={13} />, '업체',
            project.companyName
              ? <span style={{ color: themeColors.text }}>{project.companyName}</span>
              : <span style={{ color: themeColors.textSecondary, opacity: 0.5 }}>없음</span>
          )}
          {notionPropRow(<Calendar size={13} />, '기간',
            (project.startDate || project.dueDate) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span>{project.startDate ? formatDate(project.startDate) : ''}{(project.startDate || project.dueDate) ? ' ~ ' : ''}{project.dueDate ? formatDate(project.dueDate) : ''}</span>
                {dDay !== null && !isCompleted && (
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: dDay < 0 ? '#EF4444' : dDay <= 7 ? '#F59E0B' : themeColors.textSecondary }}>
                    {dDay >= 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`}
                  </span>
                )}
                {projectDays !== null && (
                  <span style={{ fontSize: '0.8125rem', color: themeColors.textSecondary, opacity: 0.6 }}>({projectDays}일)</span>
                )}
              </div>
            ) : <span style={{ color: themeColors.textSecondary, opacity: 0.5 }}>미설정</span>
          )}
          {notionPropRow(<Users size={13} />, '담당자',
            ownerMember ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src={getMemberAvatarUrl(ownerMember.id)} alt={ownerMember.name} style={{ width: '1.375rem', height: '1.375rem', borderRadius: '50%' }} />
                <span>{ownerMember.name}</span>
              </div>
            ) : <span style={{ color: themeColors.textSecondary, opacity: 0.5 }}>없음</span>
          )}
          {notionPropRow(<Users size={13} />, `참여자 (${projectMembers.length}명)`,
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {projectMembers.length === 0
                ? <span style={{ color: themeColors.textSecondary, opacity: 0.5 }}>없음</span>
                : projectMembers
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '2px 6px 2px 3px', borderRadius: '12px', backgroundColor: hoverBg }}>
                    <img src={getMemberAvatarUrl(m.id)} alt={m.name} title={m.name}
                      style={{ width: '1.125rem', height: '1.125rem', borderRadius: '50%' }} />
                    <span style={{ fontSize: '0.8125rem', color: themeColors.text, whiteSpace: 'nowrap' }}>{m.name}</span>
                  </div>
                ))
              }
            </div>
          )}
          {notionPropRow(<TrendingUp size={13} />, '진행률',
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
              <div style={{ flex: 1, maxWidth: '200px', height: '5px', borderRadius: '3px', backgroundColor: _dark ? 'rgba(255,255,255,0.1)' : 'rgba(55,53,47,0.1)', overflow: 'hidden' }}>
                <div style={{ width: `${displayProgress}%`, height: '100%', borderRadius: '3px', backgroundColor: progressColor, transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: progressColor }}>{displayProgress}%</span>
            </div>
          )}
        </div>

        {/* Right: 마일스톤 */}
        <div style={{ borderTop: `1px solid ${themeColors.border}`, paddingTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', paddingTop: '0.125rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text }}>마일스톤</span>
            <button onClick={() => { setMsPanelMilestone(null); setMsPanelOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: `${themeColors.primary}15`, color: themeColors.primary, border: 'none', cursor: 'pointer' }}>
              <Plus size={11} /> 추가
            </button>
          </div>
          {/* milestone area */}
          <div>
            {projectTimelines.length > 0 ? (
            <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                {[...projectTimelines].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()).map((tl, idx, arr) => {
                  const isDone = tl.status === 'completed';
                  const isIP = tl.status === 'in_progress';
                  const isMissed = tl.status === 'missed';
                  const isLast = idx === arr.length - 1;
                  const dotColor = isDone ? (_dark ? '#4DC09F' : '#0F7B6C') : isIP ? (_dark ? '#6DC47A' : '#1D7B52') : isMissed ? '#EF4444' : (themeColors.textSecondary as string);
                  const lineColor = _dark ? 'rgba(255,255,255,0.12)' : 'rgba(55,53,47,0.12)';
                  const prevDone = idx > 0 && arr[idx - 1].status === 'completed';
                  const statusLabel = isDone ? '완료' : isIP ? '진행 중' : isMissed ? '지연' : '예정';
                  const statusBg = isDone ? (_dark ? '#1B3C32' : '#D3F0E5') : isIP ? (_dark ? '#1C3829' : '#DBEDDB') : isMissed ? 'rgba(239,68,68,0.12)' : _dark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.06)';
                  return (
                    <div key={tl.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: '160px' }}
                      onMouseEnter={e => { (e.currentTarget.querySelectorAll('.ms-edit-btn') as NodeListOf<HTMLElement>).forEach(b => b.style.opacity = '1'); }}
                      onMouseLeave={e => { (e.currentTarget.querySelectorAll('.ms-edit-btn') as NodeListOf<HTMLElement>).forEach(b => b.style.opacity = '0'); }}>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '32px', marginBottom: '10px' }}>
                        <div style={{ flex: 1, height: '2px', backgroundColor: idx === 0 ? 'transparent' : (prevDone ? (_dark ? '#4DC09F' : '#0F7B6C') : lineColor) }} />
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2.5px solid ${dotColor}`, backgroundColor: isDone ? dotColor : isIP ? `${dotColor}20` : 'transparent', flexShrink: 0 }}>
                          {isDone && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          {isIP && <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dotColor }} />}
                          {isMissed && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="19"/></svg>}
                          {!isDone && !isIP && !isMissed && <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dotColor, opacity: 0.4 }} />}
                        </div>
                        <div style={{ flex: 1, height: '2px', backgroundColor: isLast ? 'transparent' : (isDone ? (_dark ? '#4DC09F' : '#0F7B6C') : lineColor) }} />
                      </div>
                      <div style={{ textAlign: 'center', padding: '0 10px', width: '100%' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: isDone ? 500 : 600, color: isDone ? themeColors.textSecondary : themeColors.text, textDecoration: isDone ? 'line-through' : 'none', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tl.title}</p>
                        <p style={{ fontSize: '0.75rem', color: themeColors.textSecondary, marginBottom: '5px', opacity: 0.7 }}>{tl.date ? formatDate(tl.date) : '-'}</p>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: statusBg, color: dotColor, whiteSpace: 'nowrap' }}>{statusLabel}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                        <button className="ms-edit-btn" onClick={() => { setMsPanelMilestone(tl); setMsPanelOpen(true); }}
                          style={{ opacity: 0, transition: 'opacity 0.15s', padding: '2px', borderRadius: '3px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}>
                          <Pencil size={11} />
                        </button>
                        <button className="ms-edit-btn" onClick={() => { setConfirmConfig({ title: '선택한 마일스톤이 삭제됩니다.', description: '삭제하면 복구할 수 없습니다.', onConfirm: async () => { setConfirmConfig(null); if (id) deleteMilestone(tl.id, id); } }); }}
                          style={{ opacity: 0, transition: 'opacity 0.15s', padding: '2px', borderRadius: '3px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: themeColors.textSecondary, padding: '0.5rem 0.25rem', opacity: 0.6 }}>마일스톤이 없습니다</p>
          )}
          </div>{/* closes milestone area */}
        </div>{/* closes Right: 마일스톤 */}

      </div>{/* closes INFO + MILESTONE two-column grid */}

      {/* ─── MAIN GRID BODY ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 6fr) minmax(0, 5fr)', gap: '1rem 1.25rem', marginTop: '0.25rem', minWidth: 0, width: '100%' }}>

        {/* ── CELL (1,1): 작업 현황 (full width) ── */}
        <div className="flex flex-col min-w-0 overflow-hidden" style={{ gridColumn: '1 / -1' }}>

          {/* 작업 현황 */}
          {secDivider('작업 현황',
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', cursor: 'pointer', color: themeColors.textSecondary }}>
              <input type="checkbox" checked={myTasksOnly} onChange={e => setMyTasksOnly(e.target.checked)} className="w-3.5 h-3.5" />
              내 작업만
            </label>,
            taskCollapsed, () => setTaskCollapsed(v => !v)
          )}
          {/* Task table + tab filter */}
          {!taskCollapsed && (<>
          {/* 탭바 */}
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.5rem', marginBottom: '0.5rem' }}>
            {([
              { key: 'all',         label: '전체',         count: allWorkItems.length },
              { key: 'feature',     label: '기능',      count: allWorkItems.filter(wi => wi.kind === 'feature').length },
              { key: 'improvement', label: '개선',      count: allWorkItems.filter(wi => wi.kind === 'improvement').length },
              { key: 'bug',         label: '버그',      count: allWorkItems.filter(wi => wi.kind === 'bug').length },
              { key: 'task',        label: '기타 작업', count: allWorkItems.filter(wi => wi.kind === 'task').length },
            ] as { key: string; label: string; count: number }[]).map(f => {
              const isActive = taskTypeFilter === f.key;
              return (
                <button key={f.key} onClick={() => setTaskTypeFilter(f.key as typeof taskTypeFilter)}
                  style={{ padding: '0.5rem 0.875rem', fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400, cursor: 'pointer', backgroundColor: 'transparent', color: isActive ? themeColors.primary : themeColors.textSecondary, border: 'none', borderBottom: isActive ? `2px solid ${themeColors.primary}` : '2px solid transparent', transition: 'all 0.1s', whiteSpace: 'nowrap' }}>
                  {f.label}{f.count > 0 ? <span style={{ marginLeft: '4px', fontSize: '0.75rem', opacity: 0.8 }}>{f.count}</span> : null}
                </button>
              );
            })}
            {/* 선택 액션바 — MaintenanceList 스타일 */}
            {selectedWorkIds.size > 0 && (
              <div style={{ marginLeft: 'auto', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem', height: '28px', padding: '0 0.625rem', backgroundColor: _dark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: '4px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#EF4444', whiteSpace: 'nowrap' }}>{selectedWorkIds.size}개 선택됨</span>
                <div style={{ width: '1px', height: '14px', margin: '0 2px', backgroundColor: 'rgba(239,68,68,0.30)' }} />
                <button
                  onClick={() => {
                    const ids = Array.from(selectedWorkIds);
                    setConfirmConfig({
                      title: '선택한 모든 항목이 삭제됩니다.',
                      description: '삭제하면 복구할 수 없습니다.',
                      onConfirm: async () => {
                        setConfirmConfig(null);
                        for (const wid of ids) {
                          const task = projectTasks.find(t => t.id === wid);
                          const issue = projectIssues.find(i => i.id === wid);
                          try {
                            if (task) { await deleteTask(task.id, true); auditLog('delete', 'project', `작업 삭제: "${task.title}" [프로젝트: ${project?.name || id}]`, task.id, task.title); }
                            else if (issue) { await deleteIssue(issue.id, true); auditLog('delete', 'project', `작업 삭제: "${issue.title}" [프로젝트: ${project?.name || id}]`, issue.id, issue.title); }
                          } catch { /* continue */ }
                        }
                        toast.success(`${ids.length}개 항목이 삭제되었습니다.`);
                        setSelectedWorkIds(new Set());
                        if (id) { fetchProjectTasks(id); fetchProjectIssues(id); }
                      },
                    });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', height: '22px', padding: '0 0.5rem', fontSize: '0.8125rem', fontWeight: 500, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Trash2 size={13} /> 삭제
                </button>
                <button
                  onClick={() => setSelectedWorkIds(new Set())}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', padding: 0, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  title="선택 해제"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>{/* 탭바 닫기 */}
          {/* 테이블 */}
          <div style={{ border: `1px solid ${themeColors.border}`, borderRadius: '4px', overflowX: 'auto', minWidth: 0, minHeight: '280px', marginBottom: '0.5rem' }}>
            <div style={{ minWidth: '1126px' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: taskGridCols, columnGap: '0.75rem', padding: '0 0.75rem', minHeight: '32px', alignItems: 'center', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: themeColors.textSecondary, borderBottom: `1px solid ${themeColors.border}`, backgroundColor: _dark ? 'rgba(255,255,255,0.02)' : 'rgba(55,53,47,0.02)' }}>
                  {/* Master checkbox */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={filteredWorkItems.length > 0 && filteredWorkItems.every(wi => selectedWorkIds.has(wi.id))}
                      ref={el => { if (el) el.indeterminate = selectedWorkIds.size > 0 && !filteredWorkItems.every(wi => selectedWorkIds.has(wi.id)); }}
                      onChange={() => {
                        const allSelected = filteredWorkItems.every(wi => selectedWorkIds.has(wi.id));
                        setSelectedWorkIds(allSelected ? new Set() : new Set(filteredWorkItems.map(wi => wi.id)));
                      }}
                      className="w-3 h-3"
                      style={{ accentColor: themeColors.primary, cursor: 'pointer' }}
                    />
                  </div>
                  {/* 순번 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>순번</span>
                  </div>
                  {(['유형','우선순위','상태','설명','담당자','가중치','마감일','등록일'] as const).map((label, i) => (
                    <div key={label} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: i === 3 ? 'flex-start' : 'center', overflow: 'hidden' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    </div>
                  ))}
                </div>
                {filteredWorkItems.length > 0 && filteredWorkItems.map((wi, wiIdx) => {
                    const isOverdue = wi.kind === 'task' && !!(wi.dueDate && new Date(wi.dueDate) < new Date() && wi.status !== 'done');
                    const assignee = effectiveMembers.find(m => m.id === wi.assigneeId?.toString());
                    const sc = getTaskStatusColor(wi.status);
                    const kindCfgMap: Record<string, { label: string; color: string; bg: string }> = {
                      feature:     { label: '기능',      color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
                      improvement: { label: '개선',      color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
                      bug:         { label: '버그',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
                      task:        { label: '기타 작업', color: themeColors.textSecondary, bg: _dark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.08)' },
                    };
                    const kindCfg = kindCfgMap[wi.kind] ?? { label: '기타 작업', color: themeColors.textSecondary, bg: _dark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.08)' };
                    const priorityMap: Record<string, { label: string; color: string }> = {
                      low:    { label: '낮음', color: '#64748B' },
                      medium: { label: '보통', color: '#D97706' },
                      high:   { label: '높음', color: '#EA580C' },
                      urgent: { label: '긴급', color: '#DC2626' },
                    };
                    const pc = (wi.priority && priorityMap[wi.priority]) ? priorityMap[wi.priority] : null;
                    const isWiSelected = selectedWorkIds.has(wi.id);
                    return (
                      <div key={wi.id}
                        style={{ display: 'grid', gridTemplateColumns: taskGridCols, columnGap: '0.75rem', padding: '0.5rem 0.75rem', borderBottom: `1px solid ${themeColors.border}`, alignItems: 'center', cursor: 'pointer', backgroundColor: isWiSelected ? `${themeColors.primary}08` : 'transparent', transition: 'background-color 0.1s' }}
                        onClick={() => {
                          if (wi.kind === 'task') { setSelectedTask(projectTasks.find(t => t.id === wi.id) || null); }
                          else { setSelectedIssue(projectIssues.find(i => i.id === wi.id) || null); }
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = isWiSelected ? `${themeColors.primary}12` : hoverBg)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = isWiSelected ? `${themeColors.primary}08` : 'transparent')}>
                        <div style={{ display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isWiSelected} onChange={() => setSelectedWorkIds(prev => { const n = new Set(prev); n.has(wi.id) ? n.delete(wi.id) : n.add(wi.id); return n; })} className="w-3 h-3" style={{ accentColor: themeColors.primary, cursor: 'pointer' }} />
                        </div>
                        {/* 순번 */}
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: themeColors.text, fontVariantNumeric: 'tabular-nums' }}>{wiIdx + 1}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><span style={{ fontSize: '0.75rem', color: kindCfg.color, whiteSpace: 'nowrap' }}>{kindCfg.label}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {pc ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.6875rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px', backgroundColor: `${pc.color}18`, color: pc.color, whiteSpace: 'nowrap' }}>
                              {pc.label}
                            </span>
                          ) : <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary }}>-</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {(() => {
                            const issueStatusMap: Record<string, { label: string; color: string }> = {
                              in_progress: { label: '진행중', color: '#3B82F6' },
                              open:        { label: '보류',   color: '#D97706' },
                              resolved:    { label: '완료',   color: '#10B981' },
                              closed:      { label: '완료',   color: '#10B981' },
                            };
                            const st = wi.issueStatus ? issueStatusMap[wi.issueStatus] : null;
                            return st
                              ? <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px', backgroundColor: `${st.color}18`, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                              : <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary }}>-</span>;
                          })()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, paddingRight: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', color: themeColors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stripHtml(wi.description || wi.title)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', minWidth: 0 }}>
                          {assignee ? (
                            <>
                              <img src={getMemberAvatarUrl(assignee.id)} alt={assignee.name} style={{ width: '1.125rem', height: '1.125rem', borderRadius: '50%', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignee.name}</span>
                            </>
                          ) : <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary }}>-</span>}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, textAlign: 'center' }}>
                          {wi.kind === 'task'
                            ? `${wi.weight ?? 0}%`
                            : (wi.weight != null ? `${wi.weight}%` : '-')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: isOverdue ? '#EF4444' : themeColors.textSecondary, textAlign: 'center' }}>{wi.dueDate ? formatDate(wi.dueDate) : '-'}</span>
                        <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, textAlign: 'center' }}>{wi.createdAt ? formatDate(wi.createdAt) : '-'}</span>
                      </div>
                    );
                  })}
              </div>
              {/* 빈 상태 — minWidth div 밖, bordered 컨테이너 안 중앙 */}
              {filteredWorkItems.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '0.75rem' }}>
                  <p style={{ fontSize: '0.875rem', color: themeColors.textSecondary }}>{taskStatusFilter !== 'all' ? '해당 조건의 작업이 없습니다' : '작업이 없습니다'}</p>
                  {taskStatusFilter === 'all' && (
                    <button onClick={() => setShowTaskModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', fontSize: '0.875rem', fontWeight: 600, backgroundColor: themeColors.primary, color: onPrimaryText, borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                      <Plus size={14} /> 작업 추가
                    </button>
                  )}
                </div>
              )}
            </div>
          </>)}

        </div>{/* ── closes CELL (1,1): 작업 현황 ── */}


        {/* ── CELL (2,1): 최근 활동 ── */}
        <div className="flex flex-col min-w-0">
          <div style={{ ...sideCard, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.625rem 1rem', borderBottom: activityCollapsed ? 'none' : `1px solid ${themeColors.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}
              onClick={() => setActivityCollapsed(v => !v)}>
              <ChevronDown size={15} style={{ color: themeColors.textSecondary, opacity: 0.7, transition: 'transform 0.2s', transform: activityCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text }}>최근 활동</span>
            </div>
            {!activityCollapsed && (
              <div style={{ overflowY: 'auto', maxHeight: '220px' }}>
              {(() => {
                const actionCfg: Record<string, { label: string; color: string }> = {
                  create: { label: '추가', color: '#10B981' },
                  update: { label: '수정', color: themeColors.primary },
                  delete: { label: '삭제', color: '#EF4444' },
                };
                const logsSource = [...projectAuditLogs];
                const feed = [...logsSource]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 30);
                if (feed.length === 0) return (
                  <div style={{ padding: '1.5rem 0.875rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.875rem', color: themeColors.textSecondary, opacity: 0.6 }}>활동이 없습니다</p>
                  </div>
                );
                const fmtTs = (ts: any) => { const d = new Date(ts); const pad = (n: number) => String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
                return feed.map((log, idx) => {
                  const isLast = idx === feed.length - 1;
                  const cfg = actionCfg[log.action] || { label: log.action, color: themeColors.textSecondary };
                  const isTaskType = log.resourceType === 'maintenance';
                  const resourceLabel = isTaskType ? '작업' : log.resourceType === 'project' ? '프로젝트' : log.resourceType === 'file' ? '파일' : '';
                  return (
                    <div key={log.id} style={{ padding: '0.5rem 1rem', borderBottom: isLast ? 'none' : `1px solid ${themeColors.border}`, backgroundColor: 'transparent', transition: 'background-color 0.1s', display: 'flex', alignItems: 'center', gap: '0.375rem', overflow: 'hidden', minWidth: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', backgroundColor: `${cfg.color}20`, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.text, flexShrink: 0 }}>{log.userName}</span>
                      {(log.resourceName || resourceLabel) && (
                        <span style={{ fontSize: '0.75rem', color: themeColors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>
                          {resourceLabel ? `${resourceLabel}: ` : ''}{log.resourceName ? `"${log.resourceName}"` : ''}
                        </span>
                      )}
                      {log.changes && log.changes.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
                          {log.changes.slice(0, 3).map((c, ci) => (
                            <React.Fragment key={ci}>
                              {ci > 0 && <span style={{ color: themeColors.textSecondary, opacity: 0.35, fontSize: '0.625rem' }}>|</span>}
                              <span style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, whiteSpace: 'nowrap' }}>
                                {c.field}: <span style={{ color: _dark ? '#F87171' : '#E03E3E', textDecoration: 'line-through' }}>{c.oldValue}</span> → <span style={{ color: _dark ? '#34D399' : '#0F7B6C' }}>{c.newValue}</span>
                              </span>
                            </React.Fragment>
                          ))}
                        </span>
                      )}
                      {(!log.changes || log.changes.length === 0) && log.details && (
                        <span style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>{log.details}</span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: themeColors.textSecondary, opacity: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtTs(log.timestamp)}</span>
                    </div>
                  );
                });
              })()}
              </div>
            )}
          </div>
        </div>{/* ── closes CELL (2,1): 최근 활동 ── */}

        {/* ── CELL (2,2): 첨부파일 ── */}
        <div className="flex flex-col min-w-0" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div style={{ ...sideCard, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 1rem', borderBottom: docCollapsed ? 'none' : `1px solid ${themeColors.border}`, cursor: 'pointer' }}
              onClick={() => setDocCollapsed(v => !v)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ChevronDown size={15} style={{ color: themeColors.textSecondary, opacity: 0.7, transition: 'transform 0.2s', transform: docCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                <input
                  type="checkbox"
                  checked={projectDocuments.length > 0 && projectDocuments.every(d => selectedDocIds.has(d.id))}
                  ref={el => { if (el) el.indeterminate = selectedDocIds.size > 0 && !projectDocuments.every(d => selectedDocIds.has(d.id)); }}
                  onChange={e => { e.stopPropagation(); const allSel = projectDocuments.every(d => selectedDocIds.has(d.id)); setSelectedDocIds(allSel ? new Set() : new Set(projectDocuments.map(d => d.id))); }}
                  onClick={e => e.stopPropagation()}
                  className="w-3 h-3" style={{ accentColor: themeColors.primary, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: themeColors.text }}>첨부파일</span>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 5px', borderRadius: '10px', backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>{projectDocuments.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                {selectedDocIds.size > 0 && (
                  <>
                    <button onClick={handleBulkDownload}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: themeColors.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '3px' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <Download size={11} /> {selectedDocIds.size}개 다운
                    </button>
                    <button onClick={handleBulkDelete}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '3px' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <Trash2 size={11} /> 삭제
                    </button>
                  </>
                )}
                <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: themeColors.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Upload size={11} /> 업로드
                </button>
              </div>
            </div>
            {!docCollapsed && (
              <div style={{ position: 'relative' }}>
              {/* 드롭존: 파일 없을 때 항상 표시 / 파일 있을 때 드래그 중에만 오버레이 */}
              {(projectDocuments.length === 0 && uploadQueue.length === 0) ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '0.375rem', padding: '1.5rem 1rem', cursor: 'pointer',
                    border: `1px dashed ${isDragOverDoc ? themeColors.primary : themeColors.border}`,
                    borderRadius: '0 0 4px 4px', margin: '0',
                    backgroundColor: isDragOverDoc ? `${themeColors.primary}0A` : 'transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isDragOverDoc) e.currentTarget.style.backgroundColor = _dark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)'; }}
                  onMouseLeave={e => { if (!isDragOverDoc) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Upload size={18} style={{ color: isDragOverDoc ? themeColors.primary : themeColors.textSecondary, opacity: isDragOverDoc ? 1 : 0.4 }} />
                  <span style={{ fontSize: '0.75rem', color: isDragOverDoc ? themeColors.primary : themeColors.textSecondary, fontWeight: 500 }}>
                    {isDragOverDoc ? '여기에 놓으세요' : '파일을 드래그하거나 클릭해서 업로드'}
                  </span>
                </div>
              ) : (
                <>
                {isDragOverDoc && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', pointerEvents: 'none', zIndex: 2, backgroundColor: `${themeColors.primary}10`, border: `1px dashed ${themeColors.primary}`, borderRadius: '0 0 4px 4px' }}>
                    <Upload size={20} style={{ color: themeColors.primary }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.primary }}>여기에 파일을 놓으세요</span>
                  </div>
                )}
                <div style={{ overflowY: 'auto', maxHeight: '220px' }}>
              {/* 업로드 중인 항목 인라인 표시 */}
              {uploadQueue.map(item => {
                const FileIconComp = getFileIcon(item.name);
                const iconColor = getFileIconColor(item.name);
                const barColor = item.status === 'done' ? '#10B981' : item.status === 'error' ? '#EF4444' : themeColors.primary;
                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderTop: `1px solid ${themeColors.border}`, backgroundColor: _dark ? 'rgba(255,255,255,0.02)' : 'rgba(55,53,47,0.015)' }}>
                    <div style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0 }} />
                    <div style={{ flexShrink: 0, width: '1.25rem', height: '1.25rem', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${iconColor}15` }}>
                      <FileIconComp size={10} style={{ color: iconColor }} />
                    </div>
                    <p style={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, color: themeColors.text }}>{item.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, minWidth: '110px' }}>
                      <div style={{ flex: 1, height: '3px', borderRadius: '99px', backgroundColor: _dark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.06)', overflow: 'hidden' }}>
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
              {[...projectDocuments].sort((a: any, b: any) => new Date(b.uploadedAt || b.createdAt || 0).getTime() - new Date(a.uploadedAt || a.createdAt || 0).getTime()).map((doc: any) => {
                const FileIconComp = getFileIcon(doc.name || ''); const iconColor = getFileIconColor(doc.name || '');
                const isSelected = selectedDocIds.has(doc.id);
                return (
                  <div key={doc.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderTop: `1px solid ${themeColors.border}`, backgroundColor: isSelected ? `${themeColors.primary}08` : 'transparent', transition: 'background-color 0.1s', cursor: 'pointer' }}
                    onClick={() => handleDocView(doc)}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = isSelected ? `${themeColors.primary}12` : hoverBg)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = isSelected ? `${themeColors.primary}08` : 'transparent')}>
                    <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); toggleDocSelect(doc.id); }} onClick={e => e.stopPropagation()} className="w-3 h-3 flex-shrink-0" style={{ accentColor: themeColors.primary }} />
                    <div style={{ flexShrink: 0, width: '1.25rem', height: '1.25rem', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${iconColor}15` }}>
                      <FileIconComp size={10} style={{ color: iconColor }} />
                    </div>
                    <p style={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, color: themeColors.text }}>{doc.name}</p>
                    {doc.size && <span style={{ fontSize: '0.6875rem', flexShrink: 0, color: themeColors.textSecondary, marginRight: '0.25rem' }}>{formatFileSize(doc.size)}</span>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                      <button title="보기" onClick={e => { e.stopPropagation(); handleDocView(doc); }}
                        style={{ padding: '5px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.color = themeColors.primary; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = themeColors.textSecondary as string; }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button title="다운로드" onClick={e => { e.stopPropagation(); handleDocumentDownload(doc); }}
                        style={{ padding: '5px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.color = themeColors.primary; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = themeColors.textSecondary as string; }}>
                        <Download size={14} />
                      </button>
                      <button title="삭제" onClick={e => { e.stopPropagation(); handleDocumentDelete(doc.id); }}
                        style={{ padding: '5px', borderRadius: '3px', border: 'none', background: 'none', cursor: 'pointer', color: themeColors.textSecondary, display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = themeColors.textSecondary as string; }}>
                        <Trash2 size={14} />
                      </button>
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
        </div>{/* closes CELL (2,2) */}

      </div>{/* closes grid body */}

      {/* ─── TASK DETAIL / EDIT POPUP ─── */}
      {id && selectedTask && (
        <TaskCreateModal
          isOpen={!!selectedTask}
          projectId={id}
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSaved={() => { if (id) fetchProjectTasks(id); setSelectedTask(null); }}
        />
      )}

      {/* ─── ISSUE DETAIL / EDIT POPUP ─── */}
      {id && selectedIssue && (
        <TaskCreateModal
          isOpen={!!selectedIssue}
          projectId={id}
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onSaved={() => { setSelectedIssue(null); }}
        />
      )}

      <ConfirmPopover
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        description={confirmConfig?.description}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />

      {id && (
        <TaskCreateModal isOpen={showTaskModal} projectId={id} onClose={() => setShowTaskModal(false)} onSaved={() => { if (id) { fetchProjectTasks(id); fetchProjectIssues(id); } setShowTaskModal(false); }} />
      )}

      {/* ─── DOCUMENT VIEWER MODAL ─── */}
      {viewingDoc && (
        <FileViewer
          fileUrl={viewingDoc.url || viewingDoc.fileUrl || ''}
          filename={viewingDoc.name || ''}
          onClose={() => setViewingDoc(null)}
        />
      )}

      <ProjectEditModal
        isOpen={showEditModal}
        project={project}
        onClose={() => setShowEditModal(false)}
        onSaved={() => { fetchProjects(); setTimeout(fetchProjectAuditLogs, 500); }}
      />

      <MilestoneSidePanel
        isOpen={msPanelOpen}
        onClose={() => setMsPanelOpen(false)}
        onSave={async (data) => {
          if (!id) return;
          if (msPanelMilestone) {
            await updateMilestone(msPanelMilestone.id, { title: data.title, date: data.date, status: data.status, description: data.description || undefined });
          } else {
            await addMilestone(id, { title: data.title, date: data.date, status: data.status, description: data.description || undefined });
          }
        }}
        onDelete={msPanelMilestone ? async () => {
          if (id) await deleteMilestone(msPanelMilestone.id, id);
        } : undefined}
        milestone={msPanelMilestone}
      />
    </div>
  );
};

export default ProjectDetail;
