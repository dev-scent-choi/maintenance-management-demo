import React, { useState, useEffect, useRef } from 'react';
import { Wrench, Search, Calendar, AlertCircle, CheckCircle2, Clock, XCircle, Trash2, Download, FileText, ChevronLeft, User, X, Filter, Building2, CalendarDays, Check, ChevronRight, CalendarClock, CalendarCheck2, FlaskConical, MapPin } from 'lucide-react';
import MaintenanceCreateModal from './MaintenanceCreateModal';

interface MaintFilterChip {
  id: string;
  type: 'date' | 'expectedDate' | 'actualDate' | 'priority' | 'workType' | 'companyName' | 'assignedToName' | 'testStatus' | 'deploymentLocation';
  label: string;
  dateFrom?: string;
  dateTo?: string;
  priority?: string;
  values?: string[];
}
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { usePermission } from '../hooks/usePermission';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmPopover from '../components/common/ConfirmPopover';
import ListTabBar from '../components/common/ListTabBar';
import ListPagination from '../components/common/ListPagination';
import { exportToExcelWithHeaders } from '../utils/excelExport';
import ExcelEditor from '../components/ExcelEditor';
import FileViewer from '../components/FileViewer';
import type { MaintenanceRecord } from '../types';

const MaintenanceList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { maintenanceRecords, fetchMaintenanceRecords, deleteMaintenanceRecord, updateMaintenanceRecord, isLoading } = useMaintenanceStore();
  const { user, token } = useAuthStore();
  const theme = useSettingsStore((state) => state.settings.theme);
  const fontSize = useSettingsStore((state) => state.settings.fontSize);
  const tableStyle = useSettingsStore((state) => state.settings.tableStyle);
  const themeColors = themeConfigs[theme];
  const iconSize = fontSize === 'small' ? 13 : fontSize === 'large' ? 17 : 15;
  const t = useLanguage();
  const { can } = usePermission();
  const canCreateMaintenance = can('create_maintenance');
  const gridTemplateColumns = '40px 56px 110px 400px 160px 100px 90px 75px 105px 105px 105px 110px 100px 160px';

  const initialStatus = (searchParams.get('status') || 'all') as 'all' | MaintenanceRecord['status'];
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | MaintenanceRecord['status']>(initialStatus);
  const [assignedFilter] = useState<'all' | 'my'>('all');
  const [activeChips, setActiveChips] = useState<MaintFilterChip[]>([]);
  const [showChipMenu, setShowChipMenu] = useState(false);
  const [chipMenuType, setChipMenuType] = useState<'date' | 'expectedDate' | 'actualDate' | 'priority' | 'workType' | 'companyName' | 'assignedToName' | 'testStatus' | 'deploymentLocation' | null>(null);
  const [pendingDate, setPendingDate] = useState({ from: '', to: '' });
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const [multiSelectSearch, setMultiSelectSearch] = useState('');
  const chipMenuRef = useRef<HTMLDivElement>(null);
  const chipMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [chipMenuPos, setChipMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [excelEditorFile, setExcelEditorFile] = useState<{ fileUrl: string; filename: string } | null>(null);
  const [viewerFile, setViewerFile] = useState<{ fileUrl: string; filename: string } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const handleFileDownload = async (f: { fileUrl: string; filename: string }) => {
    if (!f.fileUrl) return;
    try {
      if (f.fileUrl.startsWith('data:') || f.fileUrl.startsWith('blob:')) {
        const a = document.createElement('a');
        a.href = f.fileUrl;
        a.download = f.filename;
        a.click();
        return;
      }
      const res = await fetch(f.fileUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error(t('downloadFailed')); }
  };

  useEffect(() => {
    fetchMaintenanceRecords();
  }, [fetchMaintenanceRecords]);

  // 외부 클릭 감지
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

  const isDark = theme !== 'light';
  const notionMaintenance = {
    pending:    isDark ? { bg: '#3A2D0F', text: '#E3B060' } : { bg: '#FAF3DD', text: '#C17F2A' },
    inProgress: isDark ? { bg: '#1C3829', text: '#6DC47A' } : { bg: '#DBEDDB', text: '#1D7B52' },
    completed:  isDark ? { bg: '#1B3C32', text: '#4DC09F' } : { bg: '#D3F0E5', text: '#0F7B6C' },
    urgent:     isDark ? { bg: '#3B1219', text: '#F85149' } : { bg: '#FDECEA', text: '#C5221F' },
    onHold:     isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' },
  };
  const getStatusConfig = (status: MaintenanceRecord['status']) => {
    switch (status) {
      case 'pending':     return { ...notionMaintenance.pending,    label: t('statusWaiting') };
      case 'in-progress': return { ...notionMaintenance.inProgress, label: t('inProgressMaintenance') };
      case 'completed':   return { ...notionMaintenance.completed,  label: t('completed') };
      case 'urgent':      return { ...notionMaintenance.urgent,     label: t('statusUrgent') };
      case 'on-hold':     return { ...notionMaintenance.onHold,     label: t('statusOnHold') };
      default:            return { bg: notionMaintenance.onHold.bg, text: notionMaintenance.onHold.text, label: status };
    }
  };

  const getStatusStats = () => {
    const filtered = maintenanceRecords.filter(r => assignedFilter === 'my' ? r.assignedToId === user?.id : true);
    return {
      total: filtered.length,
      pending: filtered.filter(r => r.status === 'pending').length,
      inProgress: filtered.filter(r => r.status === 'in-progress').length,
      completed: filtered.filter(r => r.status === 'completed').length,
      urgent: filtered.filter(r => r.status === 'urgent').length,
      onHold: filtered.filter(r => r.status === 'on-hold').length,
    };
  };

  const stats = getStatusStats();

  const dateChip = activeChips.find(c => c.type === 'date');
  const expectedDateChip = activeChips.find(c => c.type === 'expectedDate');
  const actualDateChip = activeChips.find(c => c.type === 'actualDate');
  const priorityChip = activeChips.find(c => c.type === 'priority');
  const workTypeChip = activeChips.find(c => c.type === 'workType');
  const companyChip = activeChips.find(c => c.type === 'companyName');
  const assignedChip = activeChips.find(c => c.type === 'assignedToName');
  const testStatusChip = activeChips.find(c => c.type === 'testStatus');
  const deployLocationChip = activeChips.find(c => c.type === 'deploymentLocation');
  const dateFrom = dateChip?.dateFrom || '';
  const dateTo = dateChip?.dateTo || '';

  const filteredRecords = maintenanceRecords.filter(record => {
    const matchesSearch = record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.assignedToName && record.assignedToName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesAssigned = assignedFilter === 'all' || record.assignedToId === user?.id;
    const recordDate = record.requestDate ? new Date(record.requestDate) : null;
    const matchesDateFrom = !dateFrom || (recordDate && recordDate >= new Date(dateFrom));
    const matchesDateTo = !dateTo || (recordDate && recordDate <= new Date(dateTo + 'T23:59:59'));
    const matchesPriority = !priorityChip || record.priority === priorityChip.priority;
    const matchesWorkType = !workTypeChip?.values?.length || workTypeChip.values.includes(record.workType || '');
    const matchesCompany = !companyChip?.values?.length || companyChip.values.includes(record.companyName);
    const matchesAssignedChip = !assignedChip?.values?.length || assignedChip.values.includes(record.assignedToName || '');
    const expDate = record.expectedCompletionDate ? new Date(record.expectedCompletionDate) : null;
    const matchesExpectedFrom = !expectedDateChip?.dateFrom || (expDate && expDate >= new Date(expectedDateChip.dateFrom));
    const matchesExpectedTo = !expectedDateChip?.dateTo || (expDate && expDate <= new Date(expectedDateChip.dateTo + 'T23:59:59'));
    const actDate = record.actualCompletionDate ? new Date(record.actualCompletionDate) : null;
    const matchesActualFrom = !actualDateChip?.dateFrom || (actDate && actDate >= new Date(actualDateChip.dateFrom));
    const matchesActualTo = !actualDateChip?.dateTo || (actDate && actDate <= new Date(actualDateChip.dateTo + 'T23:59:59'));
    const matchesTestStatus = !testStatusChip?.values?.length || testStatusChip.values.includes(record.testStatus || '');
    const matchesDeployLocation = !deployLocationChip?.values?.length || deployLocationChip.values.includes((record as any).deploymentLocation || '');
    return matchesSearch && matchesStatus && matchesAssigned && matchesDateFrom && matchesDateTo && matchesPriority && matchesWorkType && matchesCompany && matchesAssignedChip && matchesExpectedFrom && matchesExpectedTo && matchesActualFrom && matchesActualTo && matchesTestStatus && matchesDeployLocation;
  });

  // 정렬
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    if (!sortColumn) {
      // 기본 정렬: 요청일 desc → 작업유형 asc
      const aDate = a.requestDate ? new Date(a.requestDate).getTime() : 0;
      const bDate = b.requestDate ? new Date(b.requestDate).getTime() : 0;
      if (bDate !== aDate) return bDate - aDate;
      return (a.workType || '').localeCompare(b.workType || '');
    }
    const dir = sortDirection === 'asc' ? 1 : -1;
    let aVal: any, bVal: any;
    switch (sortColumn) {
      case 'companyName': aVal = a.companyName; bVal = b.companyName; break;
      case 'description': aVal = a.description || ''; bVal = b.description || ''; break;
      case 'assignedToName': aVal = a.assignedToName || ''; bVal = b.assignedToName || ''; break;
      case 'workType': aVal = a.workType || ''; bVal = b.workType || ''; break;
      case 'requestDate': aVal = a.requestDate ? new Date(a.requestDate).getTime() : 0; bVal = b.requestDate ? new Date(b.requestDate).getTime() : 0; break;
      case 'requesterName': aVal = a.requesterName || ''; bVal = b.requesterName || ''; break;
      case 'priority': { const po = { urgent: 0, high: 1, medium: 2, low: 3 }; aVal = po[a.priority as keyof typeof po] ?? 9; bVal = po[b.priority as keyof typeof po] ?? 9; break; }
      case 'actualCompletionDate': aVal = a.actualCompletionDate ? new Date(a.actualCompletionDate).getTime() : 0; bVal = b.actualCompletionDate ? new Date(b.actualCompletionDate).getTime() : 0; break;
      case 'estimatedHours': aVal = a.estimatedHours ?? 0; bVal = b.estimatedHours ?? 0; break;
      case 'actualHours': aVal = a.actualHours ?? 0; bVal = b.actualHours ?? 0; break;
      case 'filesCount': aVal = (a.files?.length ?? 0) + (a.attachments?.length ?? 0); bVal = (b.files?.length ?? 0) + (b.attachments?.length ?? 0); break;
      case 'expectedCompletionDate': aVal = a.expectedCompletionDate ? new Date(a.expectedCompletionDate).getTime() : 0; bVal = b.expectedCompletionDate ? new Date(b.expectedCompletionDate).getTime() : 0; break;
      case 'status': aVal = a.status; bVal = b.status; break;
      default: return 0;
    }
    if (aVal < bVal) return -1 * dir;
    if (aVal > bVal) return 1 * dir;
    return 0;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // 페이징
  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);
  const paginatedRecords = sortedRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 필터/검색 변경 시 페이지 초기화 + URL 파라미터 동기화
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
    const params: Record<string, string> = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (searchTerm) params.search = searchTerm;
    setSearchParams(params, { replace: true });
  }, [searchTerm, statusFilter, activeChips, sortColumn, sortDirection, setSearchParams]);

  const getUniqueValues = (col: string): string[] => {
    const vals = new Set<string>();
    maintenanceRecords.forEach(r => { const v = (r as any)[col]; if (v) vals.add(String(v)); });
    return Array.from(vals).sort();
  };

  const priorityLabel: Record<string, string> = { urgent: t('priorityUrgent'), high: t('priorityHigh'), medium: t('priorityMedium'), low: t('priorityLow') };
  const priorityColor: Record<string, string> = { urgent: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#6B7280' };
  const workTypeKorean: Record<string, string> = { maintenance: t('workTypeMaintenance'), installation: t('workTypeInstallation'), repair: t('workTypeRepair'), inspection: t('workTypeInspection') };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const executeDelete = async (id: string) => {
    try {
      await deleteMaintenanceRecord(id);
      selectedRows.delete(id);
      setSelectedRows(new Set(selectedRows));
      toast.success(t('maintenanceDeleteSuccess'));
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error(t('deleteFailed'));
    }
  };

  const handleDelete = (id: string) => {
    setConfirmConfig({
      title: t('maintenanceDeleteConfirm'),
      description: t('deleteCannotUndo'),
      onConfirm: async () => {
        setConfirmConfig(null);
        await executeDelete(id);
      },
    });
  };

  const executeBulkDelete = async () => {
    const ids = Array.from(selectedRows);
    try {
      const results = await Promise.allSettled(ids.map(id => deleteMaintenanceRecord(id)));
      const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
      const failed = ids.length - succeeded.length;
      setSelectedRows(new Set());
      if (succeeded.length > 0) toast.success(t('maintenanceDeleteSuccess'));
      if (failed > 0) toast.error(t('deleteFailed'));
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      toast.error(t('maintenanceBulkDeleteFailed'));
    }
  };

  const handleBulkDelete = () => {
    setConfirmConfig({
      title: t('maintenanceBulkDeleteConfirm'),
      description: t('deleteCannotUndo'),
      onConfirm: async () => {
        setConfirmConfig(null);
        await executeBulkDelete();
      },
    });
  };

  const handleExcelDownload = () => {
    const excelData = sortedRecords.map(record => ({
      작업유형: record.workType ? (workTypeKorean[record.workType] || record.workType) : '-',
      내용: (record.description || '').replace(/<[^>]+>/g, ' ').trim() || '',
      업체명: record.companyName,
      요청자: record.requesterName || '-',
      상태: getStatusConfig(record.status).label,
      우선순위: priorityLabel[record.priority] || record.priority,
      요청일: formatDate(record.requestDate),
      완료예정일: formatDate(record.expectedCompletionDate),
      완료일: formatDate(record.actualCompletionDate),
      담당자: record.assignedToName || '-',
      테스트여부: record.testStatus || '-',
      반영위치: record.deploymentLocation || '-',
    }));
    const headers: Record<string, string> = {
      작업유형: t('workTypeLabel'), 내용: t('description'), 업체명: t('companyName'), 요청자: t('requester'), 상태: t('status'),
      우선순위: t('priority'), 요청일: t('requestDate'), 완료예정일: t('expectedCompletionDate'),
      완료일: t('completionDate'), 담당자: t('assignee'), 테스트여부: t('testStatus'), 반영위치: t('deploymentLocation'),
    };
    // 화면 컬럼 너비에 비례한 Excel 컬럼 너비 (wch)
    const colWidths = [15, 50, 22, 12, 10, 13, 13, 13, 15, 14, 22];
    exportToExcelWithHeaders(excelData, headers, t('maintenanceManagement'), t('maintenanceList'), colWidths);
  };

  const canPreviewFile = (filename: string) => {
    if (!filename) return false;
    const ext = filename.toLowerCase();
    return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif') ||
           ext.endsWith('.bmp') || ext.endsWith('.webp') || ext.endsWith('.pdf') ||
           ext.endsWith('.txt') || ext.endsWith('.log') || ext.endsWith('.md') ||
           ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.xlsm') || ext.endsWith('.xlsb');
  };

  const handleFileClick = (fileUrl: string, filename: string) => {
    if (canPreviewFile(filename)) {
      if (filename.toLowerCase().match(/\.(xlsx|xls|xlsm|xlsb)$/)) {
        setExcelEditorFile({ fileUrl, filename });
      } else {
        setViewerFile({ fileUrl, filename });
      }
    } else {
      handleDownloadFile(fileUrl, filename);
    }
  };

  const handleDownloadFile = async (fileUrl: string, filename: string) => {
    try {
      const response = await fetch(fileUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl; link.download = filename; link.style.display = 'none';
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl);
    } catch (error) { console.error('File download error:', error); }
  };

  const toggleRowSelect = (id: string) => {
    const newSelected = new Set(selectedRows);
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
    setSelectedRows(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === paginatedRecords.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedRecords.map(r => r.id)));
    }
  };


  // 상태 필터 탭
  const statusTabs = [
    { key: 'all' as const,        label: t('all'),              count: stats.total,     color: themeColors.primary },
    { key: 'pending' as const,    label: t('statusWaiting'),    count: stats.pending,   color: themeColors.primary },
    { key: 'in-progress' as const,label: t('inProgressMaintenance'), count: stats.inProgress, color: themeColors.primary },
    { key: 'completed' as const,  label: t('completed'),        count: stats.completed, color: themeColors.primary },
    { key: 'urgent' as const,     label: t('statusUrgent'),     count: stats.urgent,    color: themeColors.primary },
    { key: 'on-hold' as const,    label: t('statusOnHold'),     count: stats.onHold,    color: themeColors.primary },
  ];

  return (
    <>
      <style>{`
        .maint-col-sep{gap:0!important;padding:0!important;align-items:stretch!important}
        .maint-col-sep>*{display:flex!important;align-items:center;padding:8px 12px;border-right:1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)'};min-width:0;overflow:hidden}
        .maint-col-sep>*:first-child{padding-left:16px}
        .maint-col-sep>*:last-child{border-right:none!important;padding-right:16px}
      `}</style>
      {/* ═══ 모바일 카드 뷰 (md 미만) ═══ */}
      <div className="md:hidden flex flex-col">

        {/* 상태 필터 탭 (가로 스크롤) */}
        <div className="flex overflow-x-auto gap-0.5 mb-3 flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium flex-shrink-0 transition-all"
                style={isActive ? { color: tab.color } : { color: themeColors.textSecondary }}
              >
                <span>{tab.label}</span>
                <span
                  className="min-w-[18px] h-4 px-1 rounded-full text-xs font-semibold flex items-center justify-center"
                  style={{
                    background: isActive ? tab.color : (theme !== 'light' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                    color: isActive ? (theme === 'yellow' ? '#333333' : '#fff') : themeColors.textSecondary,
                  }}
                >
                  {tab.count}
                </span>
                {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: tab.color }} />}
              </button>
            );
          })}
        </div>

        {/* 검색창 */}
        <div className="relative mb-3 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: themeColors.textSecondary }} />
          <input
            type="text"
            placeholder={t('searchByTitleCompanyAssignee')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
            style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', border: `1px solid ${themeColors.border}`, color: themeColors.text }}
          />
        </div>

        {/* 카드 목록 */}
        <div className="space-y-2">
          {isLoading ? (
            <LoadingSpinner />
          ) : paginatedRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full py-16 text-center">
              <FileText size={40} className="mb-3 opacity-30" style={{ color: themeColors.textSecondary }} />
              <p className="text-sm font-medium" style={{ color: themeColors.text }}>{t('noMaintenance')}</p>
            </div>
          ) : paginatedRecords.map((record) => {
            const statusConfig = getStatusConfig(record.status);
            return (
              <div
                key={record.id}
                onClick={() => setDetailId(record.id)}
                className="p-3.5 rounded cursor-pointer active:opacity-70 transition-opacity"
                style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold flex-1 min-w-0 leading-snug" style={{ color: themeColors.text }}>{record.title}</p>
                  <span
                    className="flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: statusConfig.bg, color: statusConfig.text, borderRadius: '3px' }}
                  >
                    {statusConfig.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap" style={{ color: themeColors.textSecondary }}>
                  <div className="flex items-center gap-1 text-xs">
                    <span>{record.companyName}</span>
                  </div>
                  {record.assignedToName && (
                    <div className="flex items-center gap-1 text-xs">
                      <User size={iconSize - 4} /><span>{record.assignedToName}</span>
                    </div>
                  )}
                  {record.requestDate && (
                    <span className="text-xs">{formatDate(record.requestDate)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 페이징 */}
        <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      {/* ═══ 데스크톱 테이블 뷰 (md 이상) ═══ */}
      <div className="hidden md:flex flex-col" style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}>
      {/* 탭 + 등록 버튼 */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        {/* 탭 - 언더라인 스타일 */}
        <ListTabBar
          tabs={statusTabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: tab.count,
            color: tab.color,
            isActive: statusFilter === tab.key,
            onClick: () => setStatusFilter(tab.key),
          }))}
        />

        <div className="flex items-center gap-2">
          {/* 등록 버튼 */}
          {canCreateMaintenance && (
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}>
              <Wrench size={14} />
              <span>{t('newMaintenance')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 메인 컨테이너 */}
      <div
        className="flex flex-col flex-1 min-h-0"
        style={tableStyle === 'card' ? {
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
          borderRadius: '4px',
        } : {}}
      >
        {/* 통합 검색 + 필터 바 / 컨텍스트 액션 바 */}
        <div className="px-3 py-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
          {/* 컨텍스트 액션 바 — 체크 시 검색창 대체 */}
          {selectedRows.size > 0 ? (
            <div
              className="flex items-center gap-2 px-3 rounded-lg"
              style={{
                height: '36px',
                backgroundColor: theme !== 'light' ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.30)',
              }}
            >
              <span className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                {t('selectedCount', { count: selectedRows.size })}
              </span>
              <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(239,68,68,0.30)' }} />
              <button
                onClick={() => handleBulkDelete()}
                className="flex items-center gap-1.5 px-2.5 rounded text-sm font-medium transition-colors"
                style={{ height: '28px', color: '#EF4444' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 size={14} /><span>{t('delete')}</span>
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedRows(new Set())}
                className="p-1.5 rounded transition-colors"
                style={{ color: '#EF4444' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title={t('deselectAll')}
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
            {/* 검색 아이콘 */}
            <Search size={15} className="flex-shrink-0" style={{ color: themeColors.textSecondary }} />

            {/* 칩 + 텍스트 입력 영역 */}
            <div className="flex-1 flex flex-wrap items-center gap-1.5 py-1 min-w-0">
              {/* 활성 필터 칩 */}
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
                    setChipMenuType(chip.type);
                    if (chip.type === 'date') setPendingDate({ from: chip.dateFrom || '', to: chip.dateTo || '' });
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

              {/* 텍스트 입력 */}
              <input
                type="text"
                placeholder={activeChips.length > 0 ? t('search') + '...' : t('searchByTitleCompanyAssignee')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px]"
                style={{ color: themeColors.text }}
              />
            </div>

            {/* 오른쪽: 필터 추가 + 구분선 + 액션 버튼들 */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* 필터 추가 드롭다운 */}
              <div className="relative" ref={chipMenuRef}>
                <button
                  ref={chipMenuBtnRef}
                  onClick={() => {
                    const isOpen = !showChipMenu;
                    if (isOpen && chipMenuBtnRef.current) {
                      const rect = chipMenuBtnRef.current.getBoundingClientRect();
                      setChipMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                    }
                    setShowChipMenu(isOpen);
                    setChipMenuType(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm font-medium transition-all"
                  style={{
                    color: (activeChips.length > 0 || showChipMenu) ? themeColors.primary : themeColors.textSecondary,
                    backgroundColor: (activeChips.length > 0 || showChipMenu) ? `${themeColors.primary}12` : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!showChipMenu && activeChips.length === 0) e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
                  onMouseLeave={(e) => { if (!showChipMenu && activeChips.length === 0) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  title={t('advancedFilter')}
                >
                  <Filter size={15} />
                  {activeChips.length > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff' }}>
                      {activeChips.length}
                    </span>
                  )}
                </button>

                {/* 드롭다운 패널 */}
                {showChipMenu && chipMenuPos && (
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{
                      position: 'fixed',
                      top: chipMenuPos.top,
                      right: chipMenuPos.right,
                      zIndex: 9999,
                      backgroundColor: themeColors.surface,
                      border: `1px solid ${themeColors.border}`,
                      minWidth: '200px',
                      boxShadow: theme !== 'light' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
                    }}
                  >
                    {/* 1단계: 필터 유형 선택 */}
                    {chipMenuType === null && (() => {
                      const getDateSummary = (chip?: MaintFilterChip) => {
                        if (!chip) return null;
                        const from = chip.dateFrom || ''; const to = chip.dateTo || '';
                        if (from && to) return `${from} ~ ${to}`;
                        if (from) return `${from} ${t('dateAfter')}`;
                        if (to) return `${to} ${t('dateBefore')}`;
                        return null;
                      };
                      const getSummary = (type: string): string | null => {
                        if (type === 'date') return getDateSummary(dateChip);
                        if (type === 'expectedDate') return getDateSummary(expectedDateChip);
                        if (type === 'actualDate') return getDateSummary(actualDateChip);
                        if (type === 'priority' && priorityChip) return priorityLabel[priorityChip.priority!] || priorityChip.priority || null;
                        if (type === 'workType' && workTypeChip) {
                          const d = workTypeChip.values!.map(v => workTypeKorean[v] || v);
                          return d.length > 1 ? `${d[0]} ${t('andMoreCount', { count: d.length - 1 })}` : d[0];
                        }
                        if (type === 'companyName' && companyChip) return companyChip.values!.length > 1 ? `${companyChip.values![0]} ${t('andMoreCount', { count: companyChip.values!.length - 1 })}` : companyChip.values![0];
                        if (type === 'assignedToName' && assignedChip) return assignedChip.values!.length > 1 ? `${assignedChip.values![0]} ${t('andMoreCount', { count: assignedChip.values!.length - 1 })}` : assignedChip.values![0];
                        if (type === 'testStatus' && testStatusChip) return testStatusChip.values!.length > 1 ? `${testStatusChip.values![0]} ${t('andMoreCount', { count: testStatusChip.values!.length - 1 })}` : testStatusChip.values![0];
                        if (type === 'deploymentLocation' && deployLocationChip) return deployLocationChip.values!.length > 1 ? `${deployLocationChip.values![0]} ${t('andMoreCount', { count: deployLocationChip.values!.length - 1 })}` : deployLocationChip.values![0];
                        return null;
                      };
                      return (
                        <div className="py-1">
                          {([
                            { type: 'workType' as const,           label: t('workTypeLabel'),         icon: <Wrench size={14} />,         active: !!workTypeChip,       onClick: () => { setPendingValues([...(workTypeChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('workType'); } },
                            { type: 'companyName' as const,        label: t('companyName'),            icon: <Building2 size={14} />,      active: !!companyChip,        onClick: () => { setPendingValues([...(companyChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('companyName'); } },
                            { type: 'priority' as const,           label: t('priority'),               icon: <AlertCircle size={14} />,    active: !!priorityChip,       onClick: () => setChipMenuType('priority') },
                            { type: 'date' as const,               label: t('requestDate'),            icon: <CalendarDays size={14} />,   active: !!dateChip,           onClick: () => { setChipMenuType('date'); setPendingDate({ from: dateChip?.dateFrom || '', to: dateChip?.dateTo || '' }); } },
                            { type: 'expectedDate' as const,       label: t('expectedCompletionDate'), icon: <CalendarClock size={14} />,  active: !!expectedDateChip,   onClick: () => { setChipMenuType('expectedDate'); setPendingDate({ from: expectedDateChip?.dateFrom || '', to: expectedDateChip?.dateTo || '' }); } },
                            { type: 'actualDate' as const,         label: t('completionDate'),         icon: <CalendarCheck2 size={14} />, active: !!actualDateChip,     onClick: () => { setChipMenuType('actualDate'); setPendingDate({ from: actualDateChip?.dateFrom || '', to: actualDateChip?.dateTo || '' }); } },
                            { type: 'assignedToName' as const,     label: t('assignee'),               icon: <User size={14} />,           active: !!assignedChip,       onClick: () => { setPendingValues([...(assignedChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('assignedToName'); } },
                            { type: 'testStatus' as const,         label: t('testStatus'),             icon: <FlaskConical size={14} />,   active: !!testStatusChip,     onClick: () => { setPendingValues([...(testStatusChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('testStatus'); } },
                            { type: 'deploymentLocation' as const, label: t('deploymentLocation'),     icon: <MapPin size={14} />,         active: !!deployLocationChip, onClick: () => { setPendingValues([...(deployLocationChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('deploymentLocation'); } },
                          ] as { type: MaintFilterChip['type']; label: string; icon: React.ReactNode; active: boolean; onClick: () => void }[]).map(item => {
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
                                  <span className="text-xs truncate max-w-[90px]" style={{ color: themeColors.primary, opacity: 0.75 }}>{summary}</span>
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
                                {t('resetFilters')}
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* 2단계: 날짜 범위 (요청일 / 완료예정일 / 완료일 공통) */}
                    {(chipMenuType === 'date' || chipMenuType === 'expectedDate' || chipMenuType === 'actualDate') && (() => {
                      const dateTypeMap = {
                        date:         { label: t('requestDate'),            icon: <CalendarDays size={13} />,   existingChip: dateChip },
                        expectedDate: { label: t('expectedCompletionDate'), icon: <CalendarClock size={13} />,  existingChip: expectedDateChip },
                        actualDate:   { label: t('completionDate'),         icon: <CalendarCheck2 size={13} />, existingChip: actualDateChip },
                      };
                      const info = dateTypeMap[chipMenuType as keyof typeof dateTypeMap];
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
                              <label className="text-xs mb-1 block" style={{ color: themeColors.textSecondary }}>{t('dateAfter')}</label>
                              <input type="date" value={pendingDate.from}
                                onChange={(e) => setPendingDate(prev => ({ ...prev, from: e.target.value }))}
                                className="w-full px-3 py-1.5 text-sm focus:outline-none transition-colors"
                                style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${theme !== 'light' ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}`, borderRadius: '6px', color: themeColors.text, colorScheme: theme !== 'light' ? 'dark' : 'light' }}
                                onFocus={(e) => e.currentTarget.style.borderColor = themeColors.primary}
                                onBlur={(e) => e.currentTarget.style.borderColor = theme !== 'light' ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}
                              />
                            </div>
                            <div>
                              <label className="text-xs mb-1 block" style={{ color: themeColors.textSecondary }}>{t('dateBefore')}</label>
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
                                {t('reset')}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (!pendingDate.from && !pendingDate.to) return;
                                const type = chipMenuType!;
                                const fmt = (d: string) => d.replace(/-/g, '.');
                                let label = `${info.label}: `;
                                if (pendingDate.from && pendingDate.to) label += `${fmt(pendingDate.from)} ~ ${fmt(pendingDate.to)}`;
                                else if (pendingDate.from) label += `${fmt(pendingDate.from)} ${t('dateAfter')}`;
                                else label += `${fmt(pendingDate.to)} ${t('dateBefore')}`;
                                setActiveChips(prev => [...prev.filter(c => c.type !== type), { id: type, type, label, dateFrom: pendingDate.from, dateTo: pendingDate.to }]);
                                setShowChipMenu(false); setChipMenuType(null); setPendingDate({ from: '', to: '' });
                              }}
                              disabled={!pendingDate.from && !pendingDate.to}
                              className="flex-1 py-1.5 text-sm font-semibold transition-all disabled:opacity-40"
                              style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', borderRadius: '6px' }}>
                              {t('apply')}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 2단계: 우선순위 */}
                    {chipMenuType === 'priority' && (
                      <div className="p-1">
                        <div className="flex items-center gap-1 px-1 py-1">
                          <button
                            onClick={() => setChipMenuType(null)}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm transition-colors"
                            style={{ color: themeColors.text, background: 'transparent' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <ChevronLeft size={14} style={{ color: themeColors.textSecondary }} />
                            <span style={{ color: themeColors.textSecondary }}><AlertCircle size={13} /></span>
                            <span className="text-sm font-semibold">{t('priority')}</span>
                          </button>
                        </div>
                        {[
                          { value: '', label: t('all') },
                          { value: 'urgent', label: t('priorityUrgent'), color: '#EF4444' },
                          { value: 'high', label: t('priorityHigh'), color: '#F97316' },
                          { value: 'medium', label: t('priorityMedium'), color: '#F59E0B' },
                          { value: 'low', label: t('priorityLow'), color: '#6B7280' },
                        ].map(opt => {
                          const isSelected = !opt.value ? !priorityChip : priorityChip?.priority === opt.value;
                          return (
                            <button key={opt.value}
                              onClick={() => {
                                if (!opt.value) {
                                  setActiveChips(prev => prev.filter(c => c.type !== 'priority'));
                                } else {
                                  setActiveChips(prev => [...prev.filter(c => c.type !== 'priority'), { id: 'priority', type: 'priority', label: `${t('priority')}: ${opt.label}`, priority: opt.value }]);
                                }
                                setShowChipMenu(false); setChipMenuType(null);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-sm transition-all text-left mx-1"
                              style={{ backgroundColor: isSelected ? `${themeColors.primary}12` : 'transparent', color: isSelected ? themeColors.primary : themeColors.text, width: 'calc(100% - 8px)' }}
                              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; }}
                              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? `${themeColors.primary}12` : 'transparent'; }}
                            >
                              <div className="flex items-center gap-2">
                                {opt.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />}
                                <span>{opt.label}</span>
                              </div>
                              {isSelected && <Check size={13} style={{ color: themeColors.primary }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 2단계: 멀티셀렉트 */}
                    {(chipMenuType === 'workType' || chipMenuType === 'companyName' || chipMenuType === 'assignedToName' || chipMenuType === 'testStatus' || chipMenuType === 'deploymentLocation') && (() => {
                      const typeIconMap: Record<string, React.ReactNode> = { workType: <Wrench size={13} />, companyName: <Building2 size={13} />, assignedToName: <User size={13} />, testStatus: <FlaskConical size={15} />, deploymentLocation: <MapPin size={13} /> };
                      const typeLabelMap: Record<string, string> = { workType: t('workTypeLabel'), companyName: t('companyName'), assignedToName: t('assignee'), testStatus: t('testStatus'), deploymentLocation: t('deploymentLocation') };
                      const typeLabel = typeLabelMap[chipMenuType] ?? chipMenuType;
                      const allVals = getUniqueValues(chipMenuType);
                      const filteredVals = allVals.filter(v => {
                        const display = chipMenuType === 'workType' ? (workTypeKorean[v] || v) : v;
                        return display.toLowerCase().includes(multiSelectSearch.toLowerCase());
                      });
                      const currentChipMap: Record<string, MaintFilterChip | undefined> = { workType: workTypeChip, companyName: companyChip, assignedToName: assignedChip, testStatus: testStatusChip, deploymentLocation: deployLocationChip };
                      const currentChip = currentChipMap[chipMenuType];
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
                              <span style={{ color: themeColors.textSecondary }}>{typeIconMap[chipMenuType]}</span>
                              <span className="text-sm font-semibold">{typeLabel}</span>
                            </button>
                            <div className="flex-1" />
                            {pendingValues.length > 0 && (
                              <button onClick={() => setPendingValues([])} className="text-sm px-2" style={{ color: themeColors.primary }}>{t('deselectAll')}</button>
                            )}
                          </div>
                          {/* 검색 */}
                          {allVals.length > 5 && (
                            <div className="px-2 pb-1.5">
                              <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: themeColors.textSecondary }} />
                                <input
                                  type="text"
                                  placeholder={t('search') + '...'}
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
                              <p className="px-3 py-2 text-sm" style={{ color: themeColors.textSecondary }}>{allVals.length === 0 ? t('noItems') : t('noSearchResults')}</p>
                            ) : filteredVals.map(val => {
                              const isChecked = pendingValues.includes(val);
                              const displayVal = chipMenuType === 'workType' ? (workTypeKorean[val] || val) : val;
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
                                  <span className="truncate">{displayVal}</span>
                                </button>
                              );
                            })}
                          </div>
                          {/* 하단 버튼 */}
                          <div className="flex gap-2 p-2 pt-1.5" style={{ borderTop: `1px solid ${themeColors.border}` }}>
                            {currentChip && (
                              <button
                                onClick={() => { setActiveChips(prev => prev.filter(c => c.type !== chipMenuType)); setShowChipMenu(false); setChipMenuType(null); }}
                                className="flex-1 py-1.5 text-sm font-medium transition-all"
                                style={{ border: `1px solid ${themeColors.border}`, color: themeColors.textSecondary, borderRadius: '6px' }}>
                                {t('reset')}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (pendingValues.length === 0) {
                                  setActiveChips(prev => prev.filter(c => c.type !== chipMenuType));
                                } else {
                                  const displayVals = chipMenuType === 'workType'
                                    ? pendingValues.map(v => workTypeKorean[v] || v)
                                    : pendingValues;
                                  const label = `${typeLabel}: ${displayVals.slice(0, 2).join(', ')}${displayVals.length > 2 ? ` ${t('andMoreCount', { count: displayVals.length - 2 })}` : ''}`;
                                  setActiveChips(prev => [...prev.filter(c => c.type !== chipMenuType), { id: chipMenuType, type: chipMenuType, label, values: pendingValues }]);
                                }
                                setShowChipMenu(false); setChipMenuType(null); setMultiSelectSearch('');
                              }}
                              disabled={pendingValues.length === 0 && !currentChip}
                              className="flex-1 py-1.5 text-sm font-semibold transition-all disabled:opacity-40"
                              style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', borderRadius: '6px' }}>
                              {t('apply')}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* 구분선 */}
              <div className="w-px self-stretch mx-1" style={{ backgroundColor: themeColors.border }} />

              {/* 내보내기 */}
              <button
                onClick={handleExcelDownload}
                className="p-2 rounded transition-all"
                style={{ color: themeColors.textSecondary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title={t('export')}
              >
                <Download size={16} />
              </button>

              {/* 캘린더 뷰 */}
              <button
                onClick={() => navigate('/maintenance/calendar')}
                className="p-2 rounded transition-all"
                style={{ color: themeColors.textSecondary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title={t('calendar')}
              >
                <Calendar size={16} />
              </button>
            </div>
          </div>
          )}
        </div>

        {/* 테이블 */}
        <div className="overflow-auto flex-1 min-h-0 relative scroll-area">
          <div style={{ minWidth: '1640px' }}>
          {/* 테이블 헤더 */}
          <div
            className="maint-col-sep grid flex-shrink-0 select-none"
            style={{
              gridTemplateColumns,
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
            {/* checkbox — select all */}
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 rounded cursor-pointer"
                style={{ accentColor: themeColors.primary }}
                checked={paginatedRecords.length > 0 && selectedRows.size === paginatedRecords.length}
                onChange={toggleSelectAll}
              />
            </div>
            {/* 순번 */}
            <div className="flex items-center justify-center">순번</div>
            {/* 작업유형 */}
            <div className="relative flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('workType')}>
              {t('workTypeLabel')} {sortColumn === 'workType' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('title')}>
              {t('description')} {sortColumn === 'title' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('companyName')}>
              {t('companyName')}
            </div>
            <div className="relative flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('requesterName')}>
              {t('requester')} {sortColumn === 'requesterName' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('status')}>
              {t('status')} {sortColumn === 'status' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('priority')}>
              {t('priority')} {sortColumn === 'priority' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('requestDate')}>
              {t('requestDate')} {sortColumn === 'requestDate' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('expectedCompletionDate')}>
              {t('expectedCompletionDate')} {sortColumn === 'expectedCompletionDate' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('actualCompletionDate')}>
              {t('completionDate')} {sortColumn === 'actualCompletionDate' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => handleSort('assignedToName')}>
              {t('assignee')} {sortColumn === 'assignedToName' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className="relative flex items-center justify-center gap-1">
              {t('testStatus')}
            </div>
            <div className="relative flex items-center gap-1">
              {t('deploymentLocation')}
            </div>
          </div>

          {/* 레코드 목록 */}
          <div className="relative">
            {isSaving && (
              <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ backgroundColor: theme !== 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)' }}>
                <LoadingSpinner message={t('savingInProgress')} />
              </div>
            )}

            {isLoading && !isSaving ? (
              <LoadingSpinner />
            ) : (
              paginatedRecords.map((record, rowIdx) => {
                const statusConfig = getStatusConfig(record.status);
                const isSelected = selectedRows.has(record.id);
                const rowTextColor = themeColors.text;
                const rowTextSecondary = themeColors.textSecondary;
                const rowNum = (currentPage - 1) * itemsPerPage + rowIdx + 1;

                return (
                  <div key={record.id} className="group/row">
                    {/* 메인 행 */}
                    <div
                      className="maint-col-sep grid transition-colors duration-100 cursor-pointer"
                      style={{
                        gridTemplateColumns,
                        borderBottom: `1px solid ${themeColors.border}`,
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)')
                          : hoveredRowId === record.id
                            ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)')
                            : 'transparent',
                      }}
                      onMouseEnter={() => setHoveredRowId(record.id)}
                      onMouseLeave={() => setHoveredRowId(null)}
                      onClick={() => setDetailId(record.id)}
                    >
                      {/* 체크박스 */}
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                          style={{ accentColor: themeColors.primary }}
                          checked={isSelected}
                          onChange={() => toggleRowSelect(record.id)}
                        />
                      </div>
                      {/* 순번 */}
                      <div className="flex items-center justify-center">
                        <span style={{ fontSize: '0.75rem', color: themeColors.text, fontVariantNumeric: 'tabular-nums' }}>{rowNum}</span>
                      </div>

                      {/* 작업유형 */}
                      <div className="flex justify-center">
                        {record.workType ? (
                          <span className="text-[0.75rem] px-1.5 py-0.5" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.08)', color: themeColors.text, borderRadius: '4px', fontWeight: 500 }}>{record.workType}</span>
                        ) : <span style={{ color: rowTextSecondary, fontSize: '0.8125rem' }}>-</span>}
                      </div>
                      {/* 내용 */}
                      <div className="min-w-0 flex-col !items-start">
                        <p className="text-[0.8125rem] font-medium truncate w-full" style={{ color: rowTextColor }}
                          dangerouslySetInnerHTML={{ __html: (record.description || '').replace(/<[^>]+>/g, ' ').trim() || '-' }} />
                      </div>
                      {/* 업체명 */}
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] font-semibold truncate" style={{ color: themeColors.primary }}>{record.companyName}</p>
                      </div>
                      {/* 요청자 */}
                      <div className="flex justify-center">
                        <span className="text-[0.8125rem] truncate" style={{ color: record.requesterName ? rowTextColor : rowTextSecondary }}>{record.requesterName || '-'}</span>
                      </div>
                      {/* 상태 */}
                      <div className="flex justify-center">
                        <span className="text-[0.75rem] px-1.5 py-0.5" style={{ backgroundColor: statusConfig.bg, color: statusConfig.text, borderRadius: '4px', fontWeight: 500 }}>{statusConfig.label}</span>
                      </div>
                      {/* 우선순위 */}
                      <div className="flex justify-center">
                        {(() => { const pc = { urgent: { label: t('priorityUrgent'), color: '#EF4444' }, high: { label: t('priorityHigh'), color: '#F97316' }, medium: { label: t('priorityMedium'), color: '#F59E0B' }, low: { label: t('priorityLow'), color: '#6B7280' } }; const p = pc[record.priority as keyof typeof pc]; return p ? <span className="text-[0.75rem] px-1.5 py-0.5" style={{ backgroundColor: `${p.color}18`, color: p.color, borderRadius: '3px', fontWeight: 500 }}>{p.label}</span> : <span style={{ color: rowTextSecondary, fontSize: '0.8125rem' }}>-</span>; })()}
                      </div>
                      {/* 요청일 */}
                      <div className="flex justify-center"><span className="text-[0.8125rem]" style={{ color: rowTextSecondary }}>{formatDate(record.requestDate)}</span></div>
                      {/* 완료예정일 */}
                      <div className="flex justify-center"><span className="text-[0.8125rem]" style={{ color: rowTextSecondary }}>{formatDate(record.expectedCompletionDate)}</span></div>
                      {/* 완료일 */}
                      <div className="flex justify-center"><span className="text-[0.8125rem]" style={{ color: rowTextSecondary }}>{formatDate(record.actualCompletionDate)}</span></div>
                      {/* 담당자 */}
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        {record.assignedToName ? (
                          <span className="text-[0.8125rem]" style={{ color: rowTextColor }}>{record.assignedToName}</span>
                        ) : user ? (
                          <button onClick={async () => { await updateMaintenanceRecord(record.id, { assignedToId: user.id, assignedToName: user.name }); }} className="px-2 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-80" style={{ backgroundColor: `${themeColors.primary}18`, color: themeColors.primary, borderRadius: '3px' }}>{t('assigned')}</button>
                        ) : <span className="text-[0.8125rem]" style={{ color: rowTextSecondary }}>-</span>}
                      </div>
                      {/* 테스트 여부 */}
                      <div className="flex justify-center">
                        {record.testStatus ? <span className="text-[0.75rem] px-1.5 py-0.5" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.08)', color: themeColors.text, borderRadius: '4px', fontWeight: 500 }}>{record.testStatus === 'not-tested' ? t('testStatusNotTested') : record.testStatus === 'tested' ? t('testStatusTested') : record.testStatus === 'not-applicable' ? t('testStatusNotApplicable') : record.testStatus}</span> : <span style={{ color: rowTextSecondary, fontSize: '0.8125rem' }}>-</span>}
                      </div>
                      {/* 반영 위치 */}
                      <div className="min-w-0">
                        <span className="text-[0.8125rem] truncate block" style={{ color: record.deploymentLocation ? rowTextSecondary : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(55,53,47,0.3)') }}>{record.deploymentLocation === 'development' ? t('deployDevelopment') : record.deploymentLocation === 'production' ? t('deployProduction') : record.deploymentLocation === 'both' ? t('deployBoth') : record.deploymentLocation || '-'}</span>
                      </div>

                    </div>

                  </div>
                );
              })
            )}
          </div>
          </div>
          {/* 빈 상태 — minWidth div 밖, overflow-x-auto 기준으로 항상 가시 영역 중앙 */}
          {!isLoading && !isSaving && paginatedRecords.length === 0 && (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center text-center" style={{ top: '40px' }}>
              <FileText size={48} className="mb-4 opacity-30" style={{ color: themeColors.textSecondary }} />
              <p className="text-base font-semibold mb-2" style={{ color: themeColors.text }}>
                {t('noMaintenance')}
              </p>
              <p className="text-sm mb-4" style={{ color: themeColors.textSecondary }}>
                {t('createNewRequest')}
              </p>
              {canCreateMaintenance && <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333333' : '#FFFFFF' }}
              >
                <Wrench size={15} />
                <span>{t('newMaintenance')}</span>
              </button>}
            </div>
          )}
        </div>

        {/* 페이징 */}
        <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      <ConfirmPopover
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        description={confirmConfig?.description}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />

      {/* Excel Editor & File Viewer */}
      {excelEditorFile && <ExcelEditor fileUrl={excelEditorFile.fileUrl} filename={excelEditorFile.filename} onClose={() => setExcelEditorFile(null)} />}
      {viewerFile && <FileViewer fileUrl={viewerFile.fileUrl} filename={viewerFile.filename} onClose={() => setViewerFile(null)} />}
      </div>

      {/* 유지보수 등록/상세 모달 */}
      <MaintenanceCreateModal
        isOpen={detailId !== null || showCreateModal}
        recordId={detailId}
        onClose={() => { setDetailId(null); setShowCreateModal(false); }}
        onReady={() => {}}
        onCreated={async () => { setIsSaving(true); await fetchMaintenanceRecords(); setIsSaving(false); }}
        onUpdated={() => {}}
      />

    </>
  );
};

export default MaintenanceList;
