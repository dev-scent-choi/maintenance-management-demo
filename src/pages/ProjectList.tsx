import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FolderOpen, Search, AlertCircle, Folder, MoreVertical, Eye, Edit2, Trash2,
  ChevronLeft, X, Filter, Calendar, List, LayoutGrid,
  Building2, User, CalendarDays, CalendarClock, Check, ChevronRight,
} from 'lucide-react';
import ListTabBar from '../components/common/ListTabBar';
import ListPagination from '../components/common/ListPagination';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useSettingsStore } from '../store/settingsStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useLanguage } from '../contexts/LanguageContext';
import { themeConfigs } from '../utils/themeConfig';
import { usePermission } from '../hooks/usePermission';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmPopover from '../components/common/ConfirmPopover';
import ProjectCreateModal from './ProjectCreateModal';
import ProjectEditModal from './ProjectEditModal';
import type { Project } from '../types';

interface ProjectFilterChip {
  id: string;
  type: 'projectName' | 'companyName' | 'startDate' | 'dueDate' | 'managerName';
  label: string;
  dateFrom?: string;
  dateTo?: string;
  values?: string[];
}

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuthStore();
  const currentUser = useAuthStore((state) => state.user);
  const { addLog } = useAuditLogStore();
  const t = useLanguage();
  const { can } = usePermission();
  const canCreateProject = can('create_projects');
  const theme = useSettingsStore((state) => state.settings.theme);
  const fontSize = useSettingsStore((state) => state.settings.fontSize);
  const tableStyle = useSettingsStore((state) => state.settings.tableStyle);
  const language = useSettingsStore((state) => state.settings.language);
  const themeColors = themeConfigs[theme];
  const onGradientText = theme === 'yellow' ? '#333333' : '#FFFFFF';
  const projGridCols = '40px 56px 240px 280px 160px 90px 130px 120px 120px 140px 50px';
  const iconSize = fontSize === 'small' ? 13 : fontSize === 'large' ? 17 : 15;
  const { projects, fetchProjects, deleteProject, isLoading } = useProjectStore();
  const { fetchCompanies } = useMaintenanceStore();

  const initialStatus = (searchParams.get('status') || 'all') as 'all' | Project['status'];
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Project['status']>(initialStatus);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [listSortCol, setListSortCol] = useState<string | null>(null);
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [activeChips, setActiveChips] = useState<ProjectFilterChip[]>([]);
  const [showChipMenu, setShowChipMenu] = useState(false);
  const [chipMenuType, setChipMenuType] = useState<'projectName' | 'companyName' | 'startDate' | 'dueDate' | 'managerName' | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [preloadedUsers, setPreloadedUsers] = useState<any[] | undefined>(undefined);
  const [preloadedCompanies, setPreloadedCompanies] = useState<any[] | undefined>(undefined);
  const [pendingDate, setPendingDate] = useState({ from: '', to: '' });
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const [multiSelectSearch, setMultiSelectSearch] = useState('');
  const chipMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const itemsPerPage = viewMode === 'list' ? 15 : 6;

  useEffect(() => {
    fetchProjects();
    fetchCompanies();
  }, [fetchProjects, fetchCompanies]);

  const openModalWithPreload = async (project?: Project | null) => {
    setLoadingModal(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [uRes, cRes] = await Promise.all([
        fetch(import.meta.env.VITE_API_URL + '/users', { headers }),
        fetch(import.meta.env.VITE_API_URL + '/companies', { headers }),
      ]);
      const users = uRes.ok ? (await uRes.json()).filter((u: any) => u.active !== false) : [];
      const companies = cRes.ok ? await cRes.json() : [];
      setPreloadedUsers(users);
      setPreloadedCompanies(companies);
      if (project) setEditProject(project);
      else setShowCreateModal(true);
    } catch {
      if (project) setEditProject(project);
      else setShowCreateModal(true);
    } finally {
      setLoadingModal(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (chipMenuRef.current && !chipMenuRef.current.contains(e.target as Node)) {
        setShowChipMenu(false);
        setChipMenuType(null);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedProjects(new Set());
  }, [searchTerm, statusFilter, viewMode, activeChips]);

  const stats = {
    total: projects.length,
    planning: projects.filter((p) => p.status === 'planning').length,
    in_progress: projects.filter((p) => p.status === 'in_progress').length,
    on_hold: projects.filter((p) => p.status === 'on_hold').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  };

  const projectNameChip = activeChips.find(c => c.type === 'projectName');
  const companyNameChip = activeChips.find(c => c.type === 'companyName');
  const startDateChip   = activeChips.find(c => c.type === 'startDate');
  const dueDateChip     = activeChips.find(c => c.type === 'dueDate');
  const managerChip     = activeChips.find(c => c.type === 'managerName');

  const uniqueProjectNames = [...new Set(projects.map(p => p.name).filter(Boolean))].sort() as string[];
  const uniqueCompanyNames = [...new Set(projects.map(p => p.companyName).filter(Boolean))].sort() as string[];
  const uniqueManagers     = [...new Set(projects.map(p => p.managerName).filter(Boolean))].sort() as string[];

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.companyName && project.companyName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    if (!matchesSearch || !matchesStatus) return false;
    if (projectNameChip?.values?.length && !projectNameChip.values.includes(project.name)) return false;
    if (companyNameChip?.values?.length && !companyNameChip.values.includes(project.companyName || '')) return false;
    if (managerChip?.values?.length && !managerChip.values.includes(project.managerName || '')) return false;
    const startD = project.startDate ? new Date(project.startDate) : null;
    if (startDateChip?.dateFrom && (!startD || startD < new Date(startDateChip.dateFrom))) return false;
    if (startDateChip?.dateTo && (!startD || startD > new Date(startDateChip.dateTo + 'T23:59:59'))) return false;
    const dueD = project.dueDate ? new Date(project.dueDate) : null;
    if (dueDateChip?.dateFrom && (!dueD || dueD < new Date(dueDateChip.dateFrom))) return false;
    if (dueDateChip?.dateTo && (!dueD || dueD > new Date(dueDateChip.dateTo + 'T23:59:59'))) return false;
    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (listSortCol) {
      const dir = listSortDir === 'asc' ? 1 : -1;
      switch (listSortCol) {
        case 'name': return a.name.localeCompare(b.name, 'ko') * dir;
        case 'company': return (a.companyName || '').localeCompare(b.companyName || '', 'ko') * dir;
        case 'progress': return (a.progress - b.progress) * dir;
        case 'status': return a.status.localeCompare(b.status) * dir;
        case 'startDate': return (new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime()) * dir;
        case 'dueDate': return (new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime()) * dir;
        default: return 0;
      }
    }
    // 기본 정렬: 시작일 내림차순 → 프로젝트명 오름차순
    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
    if (dateB !== dateA) return dateB - dateA;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });

  const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);
  const paginatedProjects = sortedProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  };

  const formatDateShort = (date: string | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toISOString().slice(0, 10);
  };

  const executeDelete = async (id: string) => {
    try {
      const deletedProject = projects.find(p => p.id === id);
      await deleteProject(id);
      addLog({ userId: currentUser?.id, userName: currentUser?.name, action: 'delete', resourceType: 'project', resourceId: id, resourceName: deletedProject?.name, details: `프로젝트가 삭제되었습니다: ${deletedProject?.name || id}` });
      await fetchProjects();
      toast.success(t('deleteProjectSuccess'));
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error(t('deleteProjectFailed'));
    }
  };

  const handleDelete = (id: string) => {
    setConfirmConfig({
      title: '선택한 프로젝트가 삭제됩니다.',
      description: '삭제하면 복구할 수 없습니다.',
      onConfirm: async () => {
        setConfirmConfig(null);
        await executeDelete(id);
      },
    });
  };

  const handleListSort = (col: string) => {
    if (listSortCol === col) {
      setListSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setListSortCol(col);
      setListSortDir('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedProjects.size === paginatedProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(paginatedProjects.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedProjects);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedProjects(next);
  };

  const isDark = theme !== 'light';
  const notionStatus = {
    planning:    isDark ? { bg: '#143D6B', text: '#82BFDF' } : { bg: '#D3E5EF', text: '#0B6E99' },
    in_progress: isDark ? { bg: '#1C3829', text: '#6DC47A' } : { bg: '#DBEDDB', text: '#1D7B52' },
    on_hold:     isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' },
    completed:   isDark ? { bg: '#1B3C32', text: '#4DC09F' } : { bg: '#D3F0E5', text: '#0F7B6C' },
    default:     isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' },
  };
  const getStatusConfig = (status: Project['status'] | string) => {
    const s = (status || '').toLowerCase();
    if (s === 'in_progress' || s === 'active') return { label: t('inProgress'), ...notionStatus.in_progress };
    if (s === 'planning')                      return { label: t('planning'),   ...notionStatus.planning };
    if (s === 'on_hold')                       return { label: t('onHold'),     ...notionStatus.on_hold };
    if (s === 'completed')                     return { label: t('completed'),  ...notionStatus.completed };
    return { label: status, ...notionStatus.default };
  };

  const tabs = [
    { key: 'all' as const, label: t('all'), count: stats.total },
    { key: 'in_progress' as const, label: t('inProgress'), count: stats.in_progress },
    { key: 'planning' as const, label: t('planning'), count: stats.planning },
    { key: 'on_hold' as const, label: t('onHold'), count: stats.on_hold },
    { key: 'completed' as const, label: t('completed'), count: stats.completed },
  ];

  const paginationBar = (
    <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style>{`
        .proj-col-sep{gap:0!important;padding:0!important;align-items:stretch!important}
        .proj-col-sep>*{display:flex!important;align-items:center;padding:8px 12px;border-right:1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)'};min-width:0;overflow:hidden}
        .proj-col-sep>*:first-child{padding-left:16px}
        .proj-col-sep>*:last-child{border-right:none!important;padding-right:16px}
      `}</style>
      {/* 탭 + 액션 버튼 */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <ListTabBar
          tabs={tabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: tab.count,
            isActive: statusFilter === tab.key,
            onClick: () => { setStatusFilter(tab.key); setCurrentPage(1); },
          }))}
        />

        <div className="flex items-center gap-2" style={{ height: '36px' }}>
          {canCreateProject && (
            <button
              onClick={() => openModalWithPreload()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: themeColors.primary, color: onGradientText, borderRadius: '4px' }}
            >
              <FolderOpen size={15} />
              <span>{t('createProject')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 메인 컨테이너 */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={tableStyle === 'card' ? {
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
          borderRadius: '4px',
        } : {}}
      >
        {/* 툴바 */}
        <div className="px-3 py-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
          {selectedProjects.size > 0 ? (
            <div
              className="flex items-center gap-2 px-3 rounded-lg w-full"
              style={{
                height: '36px',
                backgroundColor: theme !== 'light' ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.30)',
              }}
            >
              <span className="text-sm font-semibold" style={{ color: '#EF4444' }}>{selectedProjects.size}개 선택됨</span>
              <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(239,68,68,0.30)' }} />
              <button
                onClick={() => {
                  setConfirmConfig({
                    title: '선택한 모든 프로젝트가 삭제됩니다.',
                    description: '삭제하면 복구할 수 없습니다.',
                    onConfirm: async () => {
                      setConfirmConfig(null);
                      Array.from(selectedProjects).forEach(id => deleteProject(id));
                      setSelectedProjects(new Set());
                      fetchProjects();
                    },
                  });
                }}
                className="flex items-center gap-1.5 px-2.5 rounded text-sm font-medium transition-colors"
                style={{ height: '28px', color: '#EF4444' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 size={14} /><span>삭제</span>
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedProjects(new Set())}
                className="p-1.5 rounded transition-colors"
                style={{ color: '#EF4444' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="선택 해제"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
              <div
                className="flex items-center gap-2 px-2 rounded-lg transition-all"
                style={{
                  border: `1px solid ${themeColors.border}`,
                  backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  height: '36px',
                }}
              >
                <Search size={15} className="flex-shrink-0" style={{ color: themeColors.textSecondary }} />

                {/* 칩 + 텍스트 입력 영역 */}
                <div className="flex-1 flex flex-wrap items-center gap-1.5 py-1 min-w-0">
                  {activeChips.map(chip => (
                    <div
                      key={chip.id}
                      className="flex items-center gap-1 pl-2 pr-1 rounded text-sm font-medium flex-shrink-0 cursor-pointer transition-all hover:opacity-80"
                      style={{
                        height: '24px',
                        backgroundColor: `${themeColors.primary}18`,
                        color: themeColors.primary,
                        border: `1px solid ${themeColors.primary}30`,
                      }}
                      onClick={() => {
                        if (chip.type === 'companyName' || chip.type === 'managerName') {
                          setPendingValues([...(chip.values || [])]);
                          setMultiSelectSearch('');
                        } else {
                          setPendingDate({ from: chip.dateFrom || '', to: chip.dateTo || '' });
                        }
                        setChipMenuType(chip.type);
                        setShowChipMenu(true);
                      }}
                    >
                      <span>{chip.label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveChips(prev => prev.filter(c => c.id !== chip.id)); }}
                        className="flex items-center opacity-60 hover:opacity-100 transition-all ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <input
                    type="text"
                    placeholder={activeChips.length > 0 ? '추가 검색...' : t('searchProjects')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px]"
                    style={{ color: themeColors.text }}
                  />
                </div>

                {/* 필터 버튼 + 구분선 */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <div className="relative" ref={chipMenuRef}>
                    <button
                      onClick={() => { setShowChipMenu(prev => !prev); setChipMenuType(null); }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm font-medium transition-all"
                      style={{
                        color: (activeChips.length > 0 || showChipMenu) ? themeColors.primary : themeColors.textSecondary,
                        backgroundColor: (activeChips.length > 0 || showChipMenu) ? `${themeColors.primary}12` : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (!showChipMenu && activeChips.length === 0) e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
                      onMouseLeave={(e) => { if (!showChipMenu && activeChips.length === 0) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      title="고급 필터"
                    >
                      <Filter size={15} />
                      {activeChips.length > 0 && (
                        <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff' }}>
                          {activeChips.length}
                        </span>
                      )}
                    </button>

                    {showChipMenu && (
                      <div
                        className="absolute right-0 top-full mt-1 z-50 overflow-hidden"
                        style={{
                          backgroundColor: themeColors.surface,
                          border: `1px solid ${themeColors.border}`,
                          borderRadius: '6px',
                          minWidth: '220px',
                          boxShadow: theme !== 'light' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
                        }}
                      >
                        {/* 1단계: 필터 유형 선택 */}
                        {chipMenuType === null && (() => {
                          const getDateSummary = (chip?: ProjectFilterChip) => {
                            if (!chip) return null;
                            const from = chip.dateFrom || ''; const to = chip.dateTo || '';
                            if (from && to) return `${from} ~ ${to}`;
                            if (from) return `${from} 이후`;
                            if (to) return `${to} 이전`;
                            return null;
                          };
                          const getSummary = (type: string): string | null => {
                            if (type === 'projectName' && projectNameChip) return projectNameChip.values!.length > 1 ? `${projectNameChip.values![0]} 외 ${projectNameChip.values!.length - 1}` : projectNameChip.values![0];
                            if (type === 'companyName' && companyNameChip) return companyNameChip.values!.length > 1 ? `${companyNameChip.values![0]} 외 ${companyNameChip.values!.length - 1}` : companyNameChip.values![0];
                            if (type === 'startDate') return getDateSummary(startDateChip);
                            if (type === 'dueDate') return getDateSummary(dueDateChip);
                            if (type === 'managerName' && managerChip) return managerChip.values!.length > 1 ? `${managerChip.values![0]} 외 ${managerChip.values!.length - 1}` : managerChip.values![0];
                            return null;
                          };
                          return (
                            <div className="py-1">
                              {([
                                { type: 'projectName' as const, label: '프로젝트명',    icon: <FolderOpen size={14} />,   active: !!projectNameChip, onClick: () => { setPendingValues([...(projectNameChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('projectName'); } },
                                { type: 'companyName' as const, label: '업체명',        icon: <Building2 size={14} />,    active: !!companyNameChip, onClick: () => { setPendingValues([...(companyNameChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('companyName'); } },
                                { type: 'startDate'   as const, label: '시작일',        icon: <CalendarDays size={14} />, active: !!startDateChip,   onClick: () => { setChipMenuType('startDate'); setPendingDate({ from: startDateChip?.dateFrom || '', to: startDateChip?.dateTo || '' }); } },
                                { type: 'dueDate'     as const, label: '완료일',        icon: <CalendarClock size={14} />,active: !!dueDateChip,     onClick: () => { setChipMenuType('dueDate'); setPendingDate({ from: dueDateChip?.dateFrom || '', to: dueDateChip?.dateTo || '' }); } },
                                { type: 'managerName' as const, label: '프로젝트 관리자', icon: <User size={14} />,        active: !!managerChip,     onClick: () => { setPendingValues([...(managerChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('managerName'); } },
                              ] as { type: ProjectFilterChip['type']; label: string; icon: React.ReactNode; active: boolean; onClick: () => void }[]).map(item => {
                                const summary = getSummary(item.type);
                                return (
                                  <button
                                    key={item.type}
                                    onClick={item.onClick}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all text-left rounded-sm mx-1"
                                    style={{ color: item.active ? themeColors.primary : themeColors.text, width: 'calc(100% - 8px)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = item.active ? `${themeColors.primary}12` : (theme !== 'light' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)')}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <span style={{ color: item.active ? themeColors.primary : themeColors.textSecondary, flexShrink: 0 }}>{item.icon}</span>
                                    <span className="flex-1">{item.label}</span>
                                    {item.active && summary && (
                                      <span className="text-xs truncate max-w-[80px]" style={{ color: themeColors.primary, opacity: 0.75 }}>{summary}</span>
                                    )}
                                    {item.active
                                      ? <Check size={13} style={{ color: themeColors.primary, flexShrink: 0 }} />
                                      : <ChevronRight size={13} style={{ color: themeColors.textSecondary, flexShrink: 0, opacity: 0.5 }} />
                                    }
                                  </button>
                                );
                              })}
                              {activeChips.length > 0 && (
                                <>
                                  <div style={{ borderTop: `1px solid ${themeColors.border}`, margin: '4px 8px' }} />
                                  <button
                                    onClick={() => { setActiveChips([]); setShowChipMenu(false); setChipMenuType(null); }}
                                    className="w-full flex items-center px-3 py-2 text-sm transition-all text-left rounded-sm mx-1"
                                    style={{ color: '#EF4444', width: 'calc(100% - 8px)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    전체 초기화
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })()}

                        {/* 2단계: 날짜 범위 (시작일 / 완료일 공통) */}
                        {(chipMenuType === 'startDate' || chipMenuType === 'dueDate') && (() => {
                          const info = chipMenuType === 'startDate'
                            ? { label: '시작일', icon: <CalendarDays size={13} />, existingChip: startDateChip }
                            : { label: '완료일', icon: <CalendarClock size={13} />, existingChip: dueDateChip };
                          return (
                            <div className="p-1">
                              <div className="flex items-center gap-1 px-1 py-1 mb-1">
                                <button
                                  onClick={() => setChipMenuType(null)}
                                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm transition-colors"
                                  style={{ color: themeColors.text, background: 'transparent' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <ChevronLeft size={14} style={{ color: themeColors.textSecondary }} />
                                  <span style={{ color: themeColors.textSecondary }}>{info.icon}</span>
                                  <span className="text-sm font-semibold">{info.label}</span>
                                </button>
                              </div>
                              <div className="space-y-2 px-2 mb-2">
                                <div>
                                  <label className="text-xs mb-1 block" style={{ color: themeColors.textSecondary }}>이후</label>
                                  <input type="date" value={pendingDate.from}
                                    onChange={(e) => setPendingDate(prev => ({ ...prev, from: e.target.value }))}
                                    className="w-full px-3 py-1.5 text-sm focus:outline-none transition-colors"
                                    style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${theme !== 'light' ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}`, borderRadius: '6px', color: themeColors.text, colorScheme: theme !== 'light' ? 'dark' : 'light' }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = themeColors.primary}
                                    onBlur={(e) => e.currentTarget.style.borderColor = theme !== 'light' ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs mb-1 block" style={{ color: themeColors.textSecondary }}>이전</label>
                                  <input type="date" value={pendingDate.to}
                                    onChange={(e) => setPendingDate(prev => ({ ...prev, to: e.target.value }))}
                                    className="w-full px-3 py-1.5 text-sm focus:outline-none transition-colors"
                                    style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${theme !== 'light' ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}`, borderRadius: '6px', color: themeColors.text, colorScheme: theme !== 'light' ? 'dark' : 'light' }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = themeColors.primary}
                                    onBlur={(e) => e.currentTarget.style.borderColor = theme !== 'light' ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 p-2 pt-1.5" style={{ borderTop: `1px solid ${themeColors.border}` }}>
                                {info.existingChip && (
                                  <button
                                    onClick={() => { setActiveChips(prev => prev.filter(c => c.type !== chipMenuType)); setShowChipMenu(false); setChipMenuType(null); }}
                                    className="flex-1 py-1.5 text-sm font-medium transition-all"
                                    style={{ border: `1px solid ${themeColors.border}`, color: themeColors.textSecondary, borderRadius: '6px' }}>
                                    초기화
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (!pendingDate.from && !pendingDate.to) return;
                                    const type = chipMenuType!;
                                    const fmt = (d: string) => d.replace(/-/g, '.');
                                    let label = `${info.label}: `;
                                    if (pendingDate.from && pendingDate.to) label += `${fmt(pendingDate.from)} ~ ${fmt(pendingDate.to)}`;
                                    else if (pendingDate.from) label += `${fmt(pendingDate.from)} 이후`;
                                    else label += `${fmt(pendingDate.to)} 이전`;
                                    setActiveChips(prev => [...prev.filter(c => c.type !== type), { id: type, type, label, dateFrom: pendingDate.from, dateTo: pendingDate.to }]);
                                    setShowChipMenu(false); setChipMenuType(null); setPendingDate({ from: '', to: '' });
                                  }}
                                  disabled={!pendingDate.from && !pendingDate.to}
                                  className="flex-1 py-1.5 text-sm font-semibold transition-all disabled:opacity-40"
                                  style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', borderRadius: '6px' }}>
                                  적용
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 2단계: 멀티셀렉트 (프로젝트명 / 업체명 / 프로젝트 관리자) */}
                        {(chipMenuType === 'projectName' || chipMenuType === 'companyName' || chipMenuType === 'managerName') && (() => {
                          const typeInfo = chipMenuType === 'projectName'
                            ? { label: '프로젝트명', icon: <FolderOpen size={13} />, allVals: uniqueProjectNames, currentChip: projectNameChip }
                            : chipMenuType === 'companyName'
                            ? { label: '업체명', icon: <Building2 size={13} />, allVals: uniqueCompanyNames, currentChip: companyNameChip }
                            : { label: '프로젝트 관리자', icon: <User size={13} />, allVals: uniqueManagers, currentChip: managerChip };
                          const filteredVals = typeInfo.allVals.filter(v => v.toLowerCase().includes(multiSelectSearch.toLowerCase()));
                          return (
                            <div className="p-1">
                              {/* 헤더 */}
                              <div className="flex items-center gap-1 px-1 py-1">
                                <button
                                  onClick={() => { setChipMenuType(null); setMultiSelectSearch(''); }}
                                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm transition-colors"
                                  style={{ color: themeColors.text, background: 'transparent' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <ChevronLeft size={14} style={{ color: themeColors.textSecondary }} />
                                  <span style={{ color: themeColors.textSecondary }}>{typeInfo.icon}</span>
                                  <span className="text-sm font-semibold">{typeInfo.label}</span>
                                </button>
                                <div className="flex-1" />
                                {pendingValues.length > 0 && (
                                  <button onClick={() => setPendingValues([])} className="text-sm px-2" style={{ color: themeColors.primary }}>전체 해제</button>
                                )}
                              </div>
                              {/* 검색 */}
                              {typeInfo.allVals.length > 5 && (
                                <div className="px-2 pb-1.5">
                                  <div className="relative">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: themeColors.textSecondary }} />
                                    <input
                                      type="text"
                                      placeholder="검색..."
                                      value={multiSelectSearch}
                                      onChange={(e) => setMultiSelectSearch(e.target.value)}
                                      className="w-full pl-7 pr-2.5 py-1.5 text-sm focus:outline-none transition-colors"
                                      style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${theme !== 'light' ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}`, borderRadius: '6px', color: themeColors.text }}
                                      onFocus={(e) => e.currentTarget.style.borderColor = themeColors.primary}
                                      onBlur={(e) => e.currentTarget.style.borderColor = theme !== 'light' ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}
                                      autoFocus
                                    />
                                  </div>
                                </div>
                              )}
                              {/* 항목 리스트 */}
                              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {filteredVals.length === 0 ? (
                                  <p className="px-3 py-2 text-sm" style={{ color: themeColors.textSecondary }}>{typeInfo.allVals.length === 0 ? '항목 없음' : '검색 결과 없음'}</p>
                                ) : filteredVals.map(val => {
                                  const isChecked = pendingValues.includes(val);
                                  return (
                                    <button key={val}
                                      onClick={() => setPendingValues(prev => isChecked ? prev.filter(v => v !== val) : [...prev, val])}
                                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-sm transition-all text-left"
                                      style={{ backgroundColor: isChecked ? `${themeColors.primary}12` : 'transparent', color: themeColors.text }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isChecked ? `${themeColors.primary}18` : (theme !== 'light' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)')}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked ? `${themeColors.primary}12` : 'transparent'}
                                    >
                                      <span
                                        className="flex-shrink-0 flex items-center justify-center"
                                        style={{ width: '15px', height: '15px', borderRadius: '3px', border: `1.5px solid ${isChecked ? themeColors.primary : (theme !== 'light' ? 'rgba(255,255,255,0.3)' : '#c0c0c0')}`, backgroundColor: isChecked ? themeColors.primary : 'transparent' }}
                                      >
                                        {isChecked && <Check size={10} strokeWidth={3} color="#fff" />}
                                      </span>
                                      <span className="truncate">{val}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {/* 하단 버튼 */}
                              <div className="flex gap-2 p-2 pt-1.5" style={{ borderTop: `1px solid ${themeColors.border}` }}>
                                {typeInfo.currentChip && (
                                  <button
                                    onClick={() => { setActiveChips(prev => prev.filter(c => c.type !== chipMenuType)); setShowChipMenu(false); setChipMenuType(null); }}
                                    className="flex-1 py-1.5 text-sm font-medium transition-all"
                                    style={{ border: `1px solid ${themeColors.border}`, color: themeColors.textSecondary, borderRadius: '6px' }}>
                                    초기화
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (pendingValues.length === 0) {
                                      setActiveChips(prev => prev.filter(c => c.type !== chipMenuType));
                                    } else {
                                      const label = `${typeInfo.label}: ${pendingValues.slice(0, 2).join(', ')}${pendingValues.length > 2 ? ` 외 ${pendingValues.length - 2}` : ''}`;
                                      setActiveChips(prev => [...prev.filter(c => c.type !== chipMenuType), { id: chipMenuType!, type: chipMenuType!, label, values: pendingValues }]);
                                    }
                                    setShowChipMenu(false); setChipMenuType(null); setMultiSelectSearch('');
                                  }}
                                  disabled={pendingValues.length === 0 && !typeInfo.currentChip}
                                  className="flex-1 py-1.5 text-sm font-semibold transition-all disabled:opacity-40"
                                  style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', borderRadius: '6px' }}>
                                  적용
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              <div className="w-px h-4 mx-1" style={{ backgroundColor: themeColors.border }} />
              <button
                onClick={() => setViewMode('list')}
                className="p-2 rounded transition-all"
                style={{ color: viewMode === 'list' ? themeColors.primary : themeColors.textSecondary }}
                onMouseEnter={(e) => { if (viewMode !== 'list') e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                onMouseLeave={(e) => { if (viewMode !== 'list') e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="리스트 보기"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => { setViewMode('grid'); setCurrentPage(1); }}
                className="p-2 rounded transition-all"
                style={{ color: viewMode === 'grid' ? themeColors.primary : themeColors.textSecondary }}
                onMouseEnter={(e) => { if (viewMode !== 'grid') e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                onMouseLeave={(e) => { if (viewMode !== 'grid') e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="카드 보기"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          )}
        </div>

        {viewMode === 'grid' ? (
          /* 카드 뷰 */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="relative flex-1 overflow-y-auto p-4 scroll-area">
            {loadingModal && (
              <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ backgroundColor: theme !== 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)' }}>
                <LoadingSpinner message="프로젝트 정보를 불러오는 중..." />
              </div>
            )}
            {isLoading ? (
              <LoadingSpinner message="프로젝트 목록을 불러오는 중..." />
            ) : paginatedProjects.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <Folder size={48} className="mb-4 opacity-30" style={{ color: themeColors.textSecondary }} />
                <p className="text-base font-semibold mb-1" style={{ color: themeColors.text }}>{projects.length === 0 ? t('noProjects') : '검색 결과가 없습니다'}</p>
                <p className="text-sm" style={{ color: themeColors.textSecondary }}>{projects.length === 0 ? t('createProjectToStart') : '다른 검색어나 필터를 사용해 보세요'}</p>
              </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginatedProjects.map((project) => {
                    const statusCfg = getStatusConfig(project.status);
                    return (
                      <div
                        key={project.id}
                        className="rounded p-4 cursor-pointer transition-all"
                        style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = themeColors.primary + '60'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = themeColors.border}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.8125rem] font-semibold truncate" style={{ color: themeColors.primary }}>{project.name}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: themeColors.textSecondary }}>{project.companyName || '-'}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span
                              className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: statusCfg.bg, color: statusCfg.text, borderRadius: '3px' }}
                            >
                              {statusCfg.label}
                            </span>
                            <div className="relative" ref={openMenuId === project.id ? menuRef : null}>
                              <button
                                onClick={(e) => { if (openMenuId === project.id) { setOpenMenuId(null); setMenuPos(null); } else { const r = e.currentTarget.getBoundingClientRect(); setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right }); setOpenMenuId(project.id); } }}
                                className="p-1 rounded transition-all"
                                style={{ color: themeColors.textSecondary }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <MoreVertical size={iconSize} />
                              </button>
                              {openMenuId === project.id && (
                                <div className="py-1 rounded min-w-[100px]"
                                  style={{ position: 'fixed', top: menuPos?.top, right: menuPos?.right, zIndex: 9999, backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, boxShadow: theme !== 'light' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)' }}>
                                  <button onClick={() => { navigate(`/projects/${project.id}`); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                                    style={{ color: themeColors.text }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <Eye size={12} /><span>{t('viewDetails')}</span>
                                  </button>
                                  <button onClick={() => { openModalWithPreload(project); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                                    style={{ color: themeColors.text }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <Edit2 size={12} /><span>{t('edit')}</span>
                                  </button>
                                  <div style={{ borderTop: `1px solid ${themeColors.border}`, margin: '4px 0' }} />
                                  <button onClick={() => { setOpenMenuId(null); handleDelete(project.id); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                                    style={{ color: '#EF4444' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <Trash2 size={12} /><span>{t('delete')}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-xs mb-3 line-clamp-2 leading-relaxed" style={{ color: themeColors.textSecondary }}>
                          {project.description || t('noDescriptionMsg')}
                        </p>

                        <div className="mb-3">
                          {(() => {
                            const dp = project.status === 'completed' ? 100 : project.progress;
                            const pc = project.status === 'completed' ? (isDark ? '#3FB950' : '#0F7B6C') : themeColors.primary;
                            return (<>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-semibold" style={{ color: themeColors.text }}>{t('progress')}</span>
                                <span className="text-xs font-bold" style={{ color: pc }}>{dp}%</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                                <div className="h-full rounded-full" style={{ width: `${dp}%`, backgroundColor: pc }} />
                              </div>
                            </>);
                          })()}
                        </div>

                        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px dashed ${themeColors.border}` }}>
                          <span className="text-xs" style={{ color: themeColors.textSecondary }}>{formatDate(project.dueDate)}</span>
                          <span className="text-xs" style={{ color: themeColors.textSecondary }}>{project.memberIds.length}명</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
            )}
            </div>
            {!isLoading && paginatedProjects.length > 0 && (
              <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </div>
        ) : (
          /* 리스트 뷰 */
          <div className="flex-1 flex flex-col min-h-0">
          <div className="relative flex-1 overflow-auto min-h-0 scroll-area">
            {/* 테이블 헤더 */}
            <div
              className="proj-col-sep grid select-none"
              style={{
                gridTemplateColumns: projGridCols,
                minHeight: '40px',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: isDark ? '#1D2229' : '#F7F6F3',
                borderBottom: `1px solid ${themeColors.border}`,
                color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(55,53,47,0.65)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <div style={{ justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded cursor-pointer"
                  style={{ accentColor: themeColors.primary }}
                  checked={paginatedProjects.length > 0 && selectedProjects.size === paginatedProjects.length}
                  onChange={toggleSelectAll}
                />
              </div>
              <div style={{ justifyContent: 'center' }}>순번</div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('name')}>
                {t('projectName')} {listSortCol === 'name' && <span className="text-[10px]">{listSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1">
                {t('description')}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('company')}>
                {t('companyName')} {listSortCol === 'company' && <span className="text-[10px]">{listSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" style={{ justifyContent: 'center' }} onClick={() => handleListSort('status')}>
                {t('status')} {listSortCol === 'status' && <span className="text-[10px]">{listSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('progress')}>
                {t('progress')} {listSortCol === 'progress' && <span className="text-[10px]">{listSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('startDate')}>
                {t('startDate')} {listSortCol === 'startDate' && <span className="text-[10px]">{listSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('dueDate')}>
                {t('dueDate')} {listSortCol === 'dueDate' && <span className="text-[10px]">{listSortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1">
                {t('projectManager')}
              </div>
              <div></div>
            </div>

            {/* 레코드 목록 */}
            {loadingModal && (
              <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ backgroundColor: theme !== 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)' }}>
                <LoadingSpinner message="프로젝트 정보를 불러오는 중..." />
              </div>
            )}
            {isLoading ? (
                <LoadingSpinner message="프로젝트 목록을 불러오는 중..." />
              ) : paginatedProjects.length === 0 ? (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center text-center" style={{ top: '40px' }}>
                  <Folder size={48} className="mb-4 opacity-30" style={{ color: themeColors.textSecondary }} />
                  {projects.length === 0 ? (
                    <>
                      <p className="text-base font-semibold mb-2" style={{ color: themeColors.text }}>{t('noProjects')}</p>
                      <p className="text-sm mb-4" style={{ color: themeColors.textSecondary }}>{t('createProjectToStart')}</p>
                      {canCreateProject && (
                        <button
                          onClick={() => openModalWithPreload()}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
                          style={{ backgroundColor: themeColors.primary, color: onGradientText }}
                        >
                          <FolderOpen size={15} /><span>{t('createProject')}</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold mb-2" style={{ color: themeColors.text }}>검색 결과가 없습니다</p>
                      <p className="text-sm" style={{ color: themeColors.textSecondary }}>다른 검색어나 필터를 사용해 보세요</p>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {paginatedProjects.map((project, rowIdx) => {
                    const statusCfg = getStatusConfig(project.status);
                    const isSelected = selectedProjects.has(project.id);
                    const rowNum = (currentPage - 1) * itemsPerPage + rowIdx + 1;
                    return (
                      <div
                        key={project.id}
                        className="proj-col-sep grid transition-colors cursor-pointer"
                        style={{
                          gridTemplateColumns: projGridCols,
                          borderBottom: `1px solid ${themeColors.border}`,
                          backgroundColor: isSelected
                            ? `${themeColors.primary}08`
                            : hoveredId === project.id
                              ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')
                              : 'transparent',
                        }}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        onMouseEnter={() => setHoveredId(project.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <div style={{ justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded cursor-pointer"
                            style={{ accentColor: themeColors.primary }}
                            checked={isSelected}
                            onChange={() => toggleSelect(project.id)}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: themeColors.text, fontVariantNumeric: 'tabular-nums' }}>{rowNum}</span>
                        </div>

                        {/* 프로젝트명 */}
                        <div className="min-w-0">
                          <p className="text-[0.8125rem] font-semibold truncate" style={{ color: themeColors.primary }}>{project.name}</p>
                        </div>
                        {/* 설명 */}
                        <div className="min-w-0">
                          <span className="text-[0.8125rem] truncate" style={{ color: themeColors.textSecondary }}>{project.description || '-'}</span>
                        </div>
                        {/* 업체명 */}
                        <div className="min-w-0">
                          <span className="text-[0.8125rem] truncate" style={{ color: themeColors.text }}>{project.companyName || '-'}</span>
                        </div>
                        {/* 상태 */}
                        <div style={{ justifyContent: 'center' }}>
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: statusCfg.bg, color: statusCfg.text, borderRadius: '3px' }}>{statusCfg.label}</span>
                        </div>
                        {/* 진행률 */}
                        <div className="min-w-0">
                          {(() => { const dp = project.status === 'completed' ? 100 : project.progress; const pc = project.status === 'completed' ? (isDark ? '#3FB950' : '#0F7B6C') : themeColors.primary; return <div className="flex items-center gap-2 w-full"><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}><div className="h-full rounded-full" style={{ width: `${dp}%`, backgroundColor: pc }} /></div><span className="text-[0.8125rem] flex-shrink-0 w-8 text-right" style={{ color: pc }}>{dp}%</span></div>; })()}
                        </div>
                        {/* 시작일 */}
                        <div><span className="text-[0.8125rem]" style={{ color: themeColors.textSecondary }}>{formatDate(project.startDate)}</span></div>
                        {/* 완료일 */}
                        <div><span className="text-[0.8125rem]" style={{ color: themeColors.textSecondary }}>{formatDate(project.dueDate)}</span></div>
                        {/* 담당자 */}
                        <div className="min-w-0">
                          <span className="text-[0.8125rem] truncate" style={{ color: themeColors.text }}>{project.managerName || '-'}</span>
                        </div>

                        {/* 액션 */}
                        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                          <div className="relative" ref={openMenuId === project.id ? menuRef : null}>
                            <button
                              onClick={(e) => { if (openMenuId === project.id) { setOpenMenuId(null); setMenuPos(null); } else { const r = e.currentTarget.getBoundingClientRect(); setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right }); setOpenMenuId(project.id); } }}
                              className="p-1.5 rounded-lg transition-all"
                              style={{
                                color: themeColors.textSecondary,
                                opacity: hoveredId === project.id || openMenuId === project.id ? 1 : 0,
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <MoreVertical size={iconSize} />
                            </button>
                            {openMenuId === project.id && (
                              <div
                                className="py-1 rounded min-w-[100px]"
                                style={{ position: 'fixed', top: menuPos?.top, right: menuPos?.right, zIndex: 9999, backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, boxShadow: theme !== 'light' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)' }}
                              >
                                <button onClick={() => { navigate(`/projects/${project.id}`); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                                  style={{ color: themeColors.text }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                  <Eye size={12} /><span>{t('viewDetails')}</span>
                                </button>
                                <button onClick={() => { openModalWithPreload(project); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                                  style={{ color: themeColors.text }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                  <Edit2 size={12} /><span>{t('edit')}</span>
                                </button>
                                <div style={{ borderTop: `1px solid ${themeColors.border}`, margin: '4px 0' }} />
                                <button onClick={() => { setOpenMenuId(null); handleDelete(project.id); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                                  style={{ color: '#EF4444' }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                  <Trash2 size={12} /><span>{t('delete')}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

            {/* 페이징 */}
            {paginationBar}
          </div>
        )}
      </div>

      <ConfirmPopover
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        description={confirmConfig?.description}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />

      <ProjectCreateModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setPreloadedUsers(undefined); setPreloadedCompanies(undefined); }}
        onSaved={fetchProjects}
        preloadedUsers={preloadedUsers}
        preloadedCompanies={preloadedCompanies}
      />
      <ProjectEditModal
        isOpen={editProject !== null}
        onClose={() => { setEditProject(null); setPreloadedUsers(undefined); setPreloadedCompanies(undefined); }}
        onSaved={() => { setEditProject(null); fetchProjects(); setPreloadedUsers(undefined); setPreloadedCompanies(undefined); }}
        project={editProject}
        preloadedUsers={preloadedUsers}
        preloadedCompanies={preloadedCompanies}
      />

    </div>
  );
};

export default ProjectList;
