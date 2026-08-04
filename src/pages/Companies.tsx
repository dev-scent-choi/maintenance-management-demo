import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Building2, Search, Download, Trash2, X, List, LayoutGrid, Filter, ChevronLeft, User, Briefcase, Smartphone, Mail, Tag, CalendarDays, Check, ChevronRight } from 'lucide-react';
import ListTabBar from '../components/common/ListTabBar';
import ListPagination from '../components/common/ListPagination';
import CompanyCreateModal from './CompanyCreateModal';
import ConfirmPopover from '../components/common/ConfirmPopover';

import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { usePermission } from '../hooks/usePermission';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { exportToExcelWithHeaders } from '../utils/excelExport';
import type { Company } from '../types';


const Companies: React.FC = () => {
  const navigate = useNavigate();
  const t = useLanguage();
  const { can } = usePermission();
  const canCreateCompany = can('create_companies');
  const theme = useSettingsStore((state) => state.settings.theme);
  const fontSize = useSettingsStore((state) => state.settings.fontSize);
  const tableStyle = useSettingsStore((state) => state.settings.tableStyle);
  const themeColors = themeConfigs[theme];
  const iconSize = fontSize === 'small' ? 13 : fontSize === 'large' ? 17 : 15;
  const onGradientText = theme === 'yellow' ? '#333333' : '#FFFFFF';
  const compGridCols = '40px 56px 220px 100px 90px 150px 200px 110px 195px';
  const { token } = useAuthStore();
  const user = useAuthStore((state) => state.user);
  const { addLog } = useAuditLogStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [detailCompanyData, setDetailCompanyData] = useState<any | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'maintenance' | 'project' | 'ended'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [listSortCol, setListSortCol] = useState<string | null>(null);
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc');
  const [hoveredCompanyId, setHoveredCompanyId] = useState<string | null>(null);
  const itemsPerPage = viewMode === 'list' ? 15 : 6;

  type CompanyChip =
    | { id: string; type: 'companyName'; label: string; values: string[] }
    | { id: string; type: 'assignee'; label: string; values: string[] }
    | { id: string; type: 'role'; label: string; values: string[] }
    | { id: string; type: 'phone'; label: string; values: string[] }
    | { id: string; type: 'email'; label: string; values: string[] }
    | { id: string; type: 'contractStatus'; label: string; values: string[] }
    | { id: string; type: 'date'; label: string; dateFrom: string; dateTo: string };

  const [activeChips, setActiveChips] = useState<CompanyChip[]>([]);
  const [showChipMenu, setShowChipMenu] = useState(false);
  const [chipMenuType, setChipMenuType] = useState<'companyName' | 'assignee' | 'role' | 'phone' | 'email' | 'contractStatus' | 'date' | null>(null);
  const [pendingDate, setPendingDate] = useState({ from: '', to: '' });
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [filterMenuPos, setFilterMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [multiSelectSearch, setMultiSelectSearch] = useState('');

  const convertCompany = (company: any): Company => ({
    id: company.id.toString(),
    name: company.name,
    businessNumber: company.businessNumber || '',
    representative: company.representative || '',
    contact: company.contact || '',
    contactRole: company.contactRole || '',
    phone: company.phone || '',
    mobile: company.mobile || '',
    email: company.email || '',
    companyEmail: company.companyEmail || '',
    address: company.address || '',
    notes: company.notes || '',
    projectStartDate: company.projectStartDate || '',
    projectEndDate: company.projectEndDate || '',
    projectStatus: company.projectStatus || 'active',
    contractStatus: company.contractStatus || (company.maintenanceContract ? 'maintenance' : 'project'),
    maintenanceContract: company.maintenanceContract || false,
    maintenanceStartDate: company.maintenanceStartDate || '',
    maintenanceEndDate: company.maintenanceEndDate || '',
    maintenanceCycle: (company.maintenanceCycle || 'monthly') as 'monthly' | 'quarterly' | 'biannual' | 'annual',
    maintenanceType: (company.maintenanceType || 'onsite') as 'onsite' | 'remote' | 'hybrid',
    remoteAccessMethod: company.remoteAccessMethod || '',
    assignedManagerId: company.assignedManagerId || '',
    assignedManagerName: company.assignedManagerName || '',
    projectMembers: [],
    sourceControl: { type: 'git', url: '', username: '', password: '' },
    documentStorage: { type: 'nas', url: '', path: '' },
    createdAt: company.createdAt ? new Date(company.createdAt) : new Date()
  });

  const loadCompanies = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(import.meta.env.VITE_API_URL + '/companies', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
        const data = await response.json();
        setCompanies(data.map(convertCompany));
      } catch (error) {
        console.error('Error fetching companies:', error);
      } finally {
        setIsLoading(false);
      }
  }, [token]);

  const handleCompanyCreated = useCallback((created: any) => {
    if (created) {
      setCompanies((prev) => {
        const exists = prev.some(c => String(c.id) === String(created.id));
        if (exists) {
          return prev.map(c => String(c.id) === String(created.id) ? convertCompany(created) : c);
        }
        return [convertCompany(created), ...prev];
      });
    } else {
      loadCompanies();
    }
  }, [loadCompanies]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  // 필터 패널 외부 클릭 시 닫기
  useEffect(() => {
    if (!showChipMenu) return;
    const handler = (e: MouseEvent) => {
      if (filterMenuRef.current?.contains(e.target as Node) || filterBtnRef.current?.contains(e.target as Node)) return;
      setShowChipMenu(false);
      setChipMenuType(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showChipMenu]);

  const openDetail = useCallback(async (id: string) => {
    setLoadingDetailId(id);
    try {
      const base = import.meta.env.VITE_API_URL;
      const headers = { 'Authorization': `Bearer ${token}` };
      const [companyRes, contactsRes, serversRes, vpnRes] = await Promise.all([
        fetch(`${base}/companies/${id}`, { headers }),
        fetch(`${base}/companies/${id}/contacts`, { headers }),
        fetch(`${base}/companies/${id}/servers`, { headers }),
        fetch(`${base}/companies/${id}/vpn-accounts`, { headers }),
      ]);
      if (!companyRes.ok) throw new Error();
      const data = await companyRes.json();
      data.contacts = contactsRes.ok ? await contactsRes.json() : [];
      data.servers = serversRes.ok ? await serversRes.json() : [];
      data.vpnAccounts = vpnRes.ok ? await vpnRes.json() : [];
      setDetailCompanyData(data);
      setDetailCompanyId(id);
    } catch {
      toast.error(t('companyLoadFailed'));
    } finally {
      setLoadingDetailId(null);
    }
  }, [token]);


  const getStatusLabel = (company: Company) => {
    const status = company.contractStatus || (company.maintenanceContract ? 'maintenance' : 'project');
    switch (status) {
      case 'maintenance': return t('maintenance');
      case 'project': return t('projectsMenu');
      case 'ended': return t('contractEnded');
      default: return '-';
    }
  };

  const isDark = theme !== 'light';
  const notionContract = {
    maintenance: isDark ? { bg: '#143D6B', text: '#82BFDF' } : { bg: '#D3E5EF', text: '#0B6E99' },
    project:     isDark ? { bg: '#2D2040', text: '#A98ED6' } : { bg: '#EAE4F2', text: '#6940A5' },
    ended:       isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' },
  };
  const getStatusStyle = (company: Company) => {
    const status = company.contractStatus || (company.maintenanceContract ? 'maintenance' : 'project');
    if (status === 'maintenance') return notionContract.maintenance;
    if (status === 'project')     return notionContract.project;
    if (status === 'ended')       return notionContract.ended;
    return notionContract.ended;
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateShort = (date: string | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toISOString().slice(0, 10);
  };

  const companyNameChip    = activeChips.find(c => c.type === 'companyName')    as (CompanyChip & { type: 'companyName' })    | undefined;
  const assigneeChip       = activeChips.find(c => c.type === 'assignee')       as (CompanyChip & { type: 'assignee' })       | undefined;
  const roleChip           = activeChips.find(c => c.type === 'role')           as (CompanyChip & { type: 'role' })           | undefined;
  const phoneChip          = activeChips.find(c => c.type === 'phone')          as (CompanyChip & { type: 'phone' })          | undefined;
  const emailChip          = activeChips.find(c => c.type === 'email')          as (CompanyChip & { type: 'email' })          | undefined;
  const contractStatusChip = activeChips.find(c => c.type === 'contractStatus') as (CompanyChip & { type: 'contractStatus' }) | undefined;
  const dateChip           = activeChips.find(c => c.type === 'date')           as (CompanyChip & { type: 'date' })           | undefined;

  const uniqueCompanyNames    = [...new Set(companies.map(c => c.name).filter(Boolean))].sort() as string[];
  const uniqueAssignees       = [...new Set(companies.map(c => c.contact).filter(Boolean))].sort() as string[];
  const uniqueRoles           = [...new Set(companies.map(c => c.contactRole).filter(Boolean))].sort() as string[];
  const uniquePhones          = [...new Set(companies.map(c => c.mobile || c.phone).filter(Boolean))].sort() as string[];
  const uniqueEmails          = [...new Set(companies.map(c => c.email).filter(Boolean))].sort() as string[];

  const activeCompanies = companies.filter(c => c.status !== 'inactive');
  const maintenanceCount = activeCompanies.filter(c => (c.contractStatus || (c.maintenanceContract ? 'maintenance' : 'project')) === 'maintenance').length;
  const projectCount = activeCompanies.filter(c => (c.contractStatus || (c.maintenanceContract ? 'maintenance' : 'project')) === 'project').length;
  const endedCount = activeCompanies.filter(c => (c.contractStatus || (c.maintenanceContract ? 'maintenance' : 'project')) === 'ended').length;

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.contact && company.contact.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (company.representative && company.representative.toLowerCase().includes(searchTerm.toLowerCase()));
    const isActive = company.status !== 'inactive';
    const companyStatus = company.contractStatus || (company.maintenanceContract ? 'maintenance' : 'project');
    const matchesStatus = statusFilter === 'all' || companyStatus === statusFilter;
    if (!matchesSearch || !isActive || !matchesStatus) return false;
    // 칩 필터 적용
    if (companyNameChip && !companyNameChip.values.includes(company.name)) return false;
    if (assigneeChip && !assigneeChip.values.includes(company.contact || '')) return false;
    if (roleChip && !roleChip.values.includes(company.contactRole || '')) return false;
    if (phoneChip && !phoneChip.values.includes(company.mobile || company.phone || '')) return false;
    if (emailChip && !emailChip.values.includes(company.email || '')) return false;
    if (contractStatusChip) {
      const cs = company.contractStatus || (company.maintenanceContract ? 'maintenance' : 'project');
      if (!contractStatusChip.values.includes(cs)) return false;
    }
    if (dateChip) {
      const startDate = company.maintenanceStartDate || '';
      if (!startDate) return false;
      if (dateChip.dateFrom && startDate < dateChip.dateFrom) return false;
      if (dateChip.dateTo && startDate > dateChip.dateTo) return false;
    }
    return true;
  });

  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (listSortCol) {
      const dir = listSortDir === 'asc' ? 1 : -1;
      switch (listSortCol) {
        case 'name': return a.name.localeCompare(b.name, 'ko') * dir;
        case 'representative': return (a.representative || '').localeCompare(b.representative || '', 'ko') * dir;
        case 'phone': return (a.phone || '').localeCompare(b.phone || '') * dir;
        case 'email': return (a.email || '').localeCompare(b.email || '') * dir;
        case 'status': return (a.contractStatus || '').localeCompare(b.contractStatus || '') * dir;
        default: return 0;
      }
    }
    // 기본 정렬: 업체명 오름차순
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });

  // 페이징
  const totalPages = Math.ceil(sortedCompanies.length / itemsPerPage);
  const paginatedCompanies = sortedCompanies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 필터/검색 변경 시 페이지 초기화
  useEffect(() => {
    setCurrentPage(1);
    setSelectedCompanies(new Set());
  }, [searchTerm, statusFilter, activeChips]);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/companies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to delete company');
      const deletedCompany = companies.find(c => c.id === id);
      setCompanies(prev => prev.filter(c => c.id !== id));
      setDeleteConfirmId(null);
      addLog({ userId: user?.id, userName: user?.name, action: 'delete', resourceType: 'company', resourceId: id, resourceName: deletedCompany?.name, details: `업체가 삭제되었습니다: ${deletedCompany?.name || id}` });
      toast.success(t('companyDeleteSuccess'));
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error(t('deleteFailed'));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedCompanies);
    const results = await Promise.allSettled(
      ids.map(id =>
        fetch(`${import.meta.env.VITE_API_URL}/companies/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      )
    );
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failedCount = ids.length - succeeded.length;
    setCompanies(prev => prev.filter(c => !succeeded.includes(c.id)));
    setSelectedCompanies(new Set());
    setShowBulkDeleteConfirm(false);
    if (failedCount === 0) {
      addLog({ userId: user?.id, userName: user?.name, action: 'delete', resourceType: 'company', details: `업체 ${succeeded.length}개가 일괄 삭제되었습니다.` });
      toast.success(`${succeeded.length}개 업체가 삭제되었습니다.`);
    } else {
      toast.error(`${succeeded.length}개 삭제 완료, ${failedCount}개 실패`);
    }
  };

  const toggleSelectAll = (paginatedList: Company[]) => {
    if (selectedCompanies.size === paginatedList.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(paginatedList.map(c => c.id)));
    }
  };

  const toggleSelectCompany = (id: string) => {
    const next = new Set(selectedCompanies);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedCompanies(next);
  };

  const handleListSort = (col: string) => {
    if (listSortCol === col) {
      setListSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setListSortCol(col);
      setListSortDir('asc');
    }
  };

  const handleExcelDownload = () => {
    const excelData = filteredCompanies.map(company => ({
      업체명: company.name,
      담당자: company.contact || '-',
      직책: company.contactRole || '-',
      휴대폰: company.mobile || company.phone || '-',
      이메일: company.email || '-',
      계약상태: getStatusLabel(company),
      계약기간: (company.maintenanceStartDate || company.maintenanceEndDate)
        ? `${formatDateShort(company.maintenanceStartDate)} ~ ${formatDateShort(company.maintenanceEndDate)}`
        : '-',
    }));
    const headers = {
      업체명: '업체명', 담당자: '담당자', 직책: '직책',
      휴대폰: '휴대폰', 이메일: '이메일', 계약상태: '계약상태', 계약기간: '계약기간',
    };
    // 화면 컬럼 너비(px)를 wch 단위로 환산: [220, 100, 90, 150, 200, 110, 195] / 7
    exportToExcelWithHeaders(excelData, headers, '업체관리', '업체목록', [32, 14, 13, 21, 28, 15, 27]);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style>{`
        .comp-col-sep{gap:0!important;padding:0!important;align-items:stretch!important;min-height:40px}
        .comp-col-sep>*{display:flex!important;align-items:center;padding:10px 12px;border-right:1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)'};min-width:0;overflow:hidden}
        .comp-col-sep>*:first-child{padding-left:16px}
        .comp-col-sep>*:last-child{border-right:none!important;padding-right:16px}
      `}</style>
      {/* 탭 + 액션 버튼 */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        {/* 탭 - 언더라인 스타일 */}
        <ListTabBar
          tabs={[
            { key: 'all', label: t('all'), count: activeCompanies.length, isActive: statusFilter === 'all', onClick: () => setStatusFilter('all') },
            { key: 'maintenance', label: t('maintenance'), count: maintenanceCount, isActive: statusFilter === 'maintenance', onClick: () => setStatusFilter('maintenance') },
            { key: 'project', label: t('projectsMenu'), count: projectCount, isActive: statusFilter === 'project', onClick: () => setStatusFilter('project') },
            { key: 'ended', label: t('contractEnded'), count: endedCount, isActive: statusFilter === 'ended', onClick: () => setStatusFilter('ended') },
          ]}
        />

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2" style={{ height: '36px' }}>
          {canCreateCompany && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: themeColors.primary, color: onGradientText, borderRadius: '4px' }}
            >
              <Building2 size={15} />
              <span>{t('newCompany')}</span>
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
        <div
          className="px-3 py-2.5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${themeColors.border}` }}
        >
          {selectedCompanies.size > 0 ? (
            /* 컨텍스트 액션 바 — 검색창 대체 */
            <div
              className="flex items-center gap-2 px-3 rounded-lg w-full"
              style={{
                height: '36px',
                backgroundColor: theme !== 'light' ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.30)',
              }}
            >
              <span className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                {selectedCompanies.size}개 선택됨
              </span>
              <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(239,68,68,0.30)' }} />
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-2.5 rounded text-sm font-medium transition-colors"
                style={{ height: '28px', color: '#EF4444' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 size={14} /><span>삭제</span>
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedCompanies(new Set())}
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
              className="flex items-center gap-1.5 px-2 rounded-lg transition-all"
              style={{
                border: `1px solid ${themeColors.border}`,
                backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                height: '36px',
              }}
            >
              <Search size={15} className="flex-shrink-0" style={{ color: themeColors.textSecondary }} />

              {/* 활성 필터 칩 토큰 */}
              {activeChips.map(chip => (
                <div
                  key={chip.id}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium flex-shrink-0"
                  style={{
                    backgroundColor: `${themeColors.primary}15`,
                    color: themeColors.primary,
                    border: `1px solid ${themeColors.primary}40`,
                    borderRadius: '4px',
                    maxWidth: '160px',
                  }}
                >
                  <span className="truncate">{chip.label}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveChips(prev => prev.filter(c => c.id !== chip.id)); }}
                    className="flex-shrink-0 hover:opacity-60 transition-opacity ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {/* 텍스트 검색 입력 */}
              <div className="flex-1 flex items-center min-w-0">
                <input
                  type="text"
                  placeholder={t('searchCompanies')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                  style={{ color: themeColors.text }}
                />
              </div>

              {/* 필터 버튼 */}
              <button
                ref={filterBtnRef}
                type="button"
                onClick={() => {
                  const next = !showChipMenu;
                  if (next && filterBtnRef.current) {
                    const rect = filterBtnRef.current.getBoundingClientRect();
                    setFilterMenuPos({ top: rect.bottom + 4, left: rect.left + rect.width / 2 - 110 });
                  }
                  setShowChipMenu(next);
                  if (!next) setChipMenuType(null);
                }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  color: activeChips.length > 0 || showChipMenu ? themeColors.primary : themeColors.textSecondary,
                  backgroundColor: showChipMenu || activeChips.length > 0 ? `${themeColors.primary}12` : 'transparent',
                }}
                onMouseEnter={(e) => { if (!activeChips.length && !showChipMenu) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                onMouseLeave={(e) => { if (!activeChips.length && !showChipMenu) e.currentTarget.style.backgroundColor = 'transparent'; }}
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

              <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: themeColors.border }} />

              {/* 엑셀 내보내기 */}
              <button
                onClick={handleExcelDownload}
                className="p-1.5 rounded transition-all flex-shrink-0"
                style={{ color: themeColors.textSecondary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title={t('export')}
              >
                <Download size={15} />
              </button>

              <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: themeColors.border }} />

              {/* 뷰 토글 */}
              <button
                onClick={() => setViewMode('list')}
                className="p-1.5 rounded transition-all flex-shrink-0"
                style={{ color: viewMode === 'list' ? themeColors.primary : themeColors.textSecondary }}
                onMouseEnter={(e) => { if (viewMode !== 'list') e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                onMouseLeave={(e) => { if (viewMode !== 'list') e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="리스트 보기"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => { setViewMode('grid'); setCurrentPage(1); }}
                className="p-1.5 rounded transition-all flex-shrink-0"
                style={{ color: viewMode === 'grid' ? themeColors.primary : themeColors.textSecondary }}
                onMouseEnter={(e) => { if (viewMode !== 'grid') e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
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
            {loadingDetailId && (
              <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ backgroundColor: theme !== 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)' }}>
                <LoadingSpinner message={`${companies.find(c => c.id === loadingDetailId)?.name ?? ''} 정보를 불러오는 중...`} />
              </div>
            )}
            {isLoading ? (
              <LoadingSpinner />
            ) : paginatedCompanies.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center" style={{ position: 'absolute', inset: 0 }}>
                <Building2 size={48} className="mb-4 opacity-30" style={{ color: themeColors.textSecondary }} />
                <p className="text-base font-semibold mb-1" style={{ color: themeColors.text }}>{companies.length === 0 ? t('noCompanies') : t('searchNoResults')}</p>
                <p className="text-sm" style={{ color: themeColors.textSecondary }}>{companies.length === 0 ? t('addNewCompany') : t('tryDifferentSearch')}</p>
              </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginatedCompanies.map((company) => {
                    const statusLabel = getStatusLabel(company);
                    const statusStyle = getStatusStyle(company);
                    return (
                      <div
                        key={company.id}
                        className="rounded p-4 cursor-pointer transition-all"
                        style={{
                          backgroundColor: themeColors.surface,
                          border: `1px solid ${themeColors.border}`,
                        }}
                        onClick={() => openDetail(company.id)}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = themeColors.primary + '60'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = themeColors.border}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.8125rem] font-semibold truncate" style={{ color: themeColors.primary }}>{company.name}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: themeColors.textSecondary }}>{company.businessNumber || '-'}</p>
                          </div>
                          <span
                            className="ml-2 flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, borderRadius: '3px' }}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium flex-shrink-0" style={{ color: themeColors.textSecondary }}>담당</span>
                            <span className="text-xs truncate" style={{ color: themeColors.text }}>{company.representative || company.contact || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium flex-shrink-0" style={{ color: themeColors.textSecondary }}>전화</span>
                            <span className="text-xs truncate" style={{ color: themeColors.text }}>{company.phone || company.mobile || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium flex-shrink-0" style={{ color: themeColors.textSecondary }}>이메일</span>
                            <span className="text-xs truncate" style={{ color: themeColors.primary }}>{company.email || '-'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            )}
            </div>
            {!isLoading && paginatedCompanies.length > 0 && (
              <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </div>
        ) : (
        <div className="flex-1 flex flex-col min-h-0">
        <div className="relative flex-1 overflow-auto min-h-0 scroll-area">
          {/* 테이블 헤더 — sticky so it stays visible while scrolling vertically,
              but moves with horizontal scroll (single scroll container = columns align) */}
          <div
            className="comp-col-sep grid"
            style={{
              gridTemplateColumns: compGridCols,
              minHeight: '36px',
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
                checked={paginatedCompanies.length > 0 && selectedCompanies.size === paginatedCompanies.length}
                onChange={() => toggleSelectAll(paginatedCompanies)}
              />
            </div>
            <div style={{ justifyContent: 'center' }}>순번</div>
            <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('name')}>
              {t('companyName')} {listSortCol === 'name' && <span className="text-[10px]">{listSortDir === 'asc' ? '↑' : '↓'}</span>}
            </div>
            <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('representative')}>
              {t('assignee')} {listSortCol === 'representative' && <span className="text-[10px]">{listSortDir === 'asc' ? '↑' : '↓'}</span>}
            </div>
            <div className="relative gap-1">
              {t('position')}
            </div>
            <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('phone')}>
              {t('mobile')} {listSortCol === 'phone' && <span className="text-[10px]">{listSortDir === 'asc' ? '↑' : '↓'}</span>}
            </div>
            <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleListSort('email')}>
              {t('email')} {listSortCol === 'email' && <span className="text-[10px]">{listSortDir === 'asc' ? '↑' : '↓'}</span>}
            </div>
            <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" style={{ justifyContent: 'center' }} onClick={() => handleListSort('status')}>
              {t('contractStatus')} {listSortCol === 'status' && <span className="text-[10px]">{listSortDir === 'asc' ? '↑' : '↓'}</span>}
            </div>
            <div className="relative gap-1">
              {t('contractPeriod')}
            </div>
          </div>

          {/* 레코드 목록 */}
          {loadingDetailId && (
            <div className="fixed inset-0 z-20 flex items-center justify-center" style={{ backgroundColor: theme !== 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)' }}>
              <LoadingSpinner message={`${companies.find(c => c.id === loadingDetailId)?.name ?? ''} 정보를 불러오는 중...`} />
            </div>
          )}
          {isLoading ? (
            <LoadingSpinner message="업체 목록을 불러오는 중..." />
          ) : paginatedCompanies.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center" style={{ position: 'absolute', top: '36px', left: 0, right: 0, bottom: 0 }}>
                <Building2 size={48} className="mb-4 opacity-30" style={{ color: themeColors.textSecondary }} />
                {companies.length === 0 ? (
                  <>
                    <p className="text-base font-semibold mb-2" style={{ color: themeColors.text }}>{t('noCompanies')}</p>
                    <p className="text-sm mb-4" style={{ color: themeColors.textSecondary }}>{t('addNewCompany')}</p>
                    {canCreateCompany && <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: themeColors.primary, color: onGradientText }}
                    >
                      <Building2 size={15} /><span>{t('newCompany')}</span>
                    </button>}
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
                {paginatedCompanies.map((company, rowIdx) => {
                  const statusLabel = getStatusLabel(company);
                  const statusStyle = getStatusStyle(company);
                  const isSelected = selectedCompanies.has(company.id);
                  const rowNum = (currentPage - 1) * itemsPerPage + rowIdx + 1;
                  return (
                    <div
                      key={company.id}
                      className="comp-col-sep grid cursor-pointer transition-colors"
                      style={{
                        gridTemplateColumns: compGridCols,
                        borderBottom: `1px solid ${themeColors.border}`,
                        backgroundColor: isSelected
                          ? `${themeColors.primary}08`
                          : hoveredCompanyId === company.id
                            ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')
                            : 'transparent',
                      }}
                      onClick={() => openDetail(company.id)}
                      onMouseEnter={() => setHoveredCompanyId(company.id)}
                      onMouseLeave={() => setHoveredCompanyId(null)}
                    >
                      <div style={{ justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                          style={{ accentColor: themeColors.primary }}
                          checked={isSelected}
                          onChange={() => toggleSelectCompany(company.id)}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: themeColors.text, fontVariantNumeric: 'tabular-nums' }}>{rowNum}</span>
                      </div>

                      {/* 업체명 */}
                      <div className="min-w-0 flex-col !items-start">
                        <p className="text-[0.8125rem] font-semibold truncate w-full" style={{ color: themeColors.primary }}>{company.name}</p>
                        {company.businessNumber && (
                          <p className="text-xs truncate w-full" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(55,53,47,0.4)' }}>{company.businessNumber}</p>
                        )}
                      </div>
                      {/* 담당자 */}
                      <div className="min-w-0">
                        <span className="text-[0.8125rem] truncate" style={{ color: company.contact ? themeColors.text : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(55,53,47,0.3)') }}>
                          {company.contact || '—'}
                        </span>
                      </div>
                      {/* 직책 */}
                      <div className="min-w-0">
                        <span className="text-[0.8125rem] truncate" style={{ color: company.contactRole ? themeColors.text : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(55,53,47,0.3)') }}>
                          {company.contactRole || '—'}
                        </span>
                      </div>
                      {/* 연락처 */}
                      <div className="min-w-0">
                        <span className="text-[0.8125rem] truncate" style={{ color: (company.mobile || company.phone) ? themeColors.text : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(55,53,47,0.3)') }}>
                          {company.mobile || company.phone || '—'}
                        </span>
                      </div>
                      {/* 이메일 */}
                      <div className="min-w-0">
                        <span className="text-[0.8125rem] truncate" style={{ color: company.email ? themeColors.text : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(55,53,47,0.3)') }}>
                          {company.email || '—'}
                        </span>
                      </div>
                      {/* 계약상태 */}
                      <div style={{ justifyContent: 'center' }}>
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, borderRadius: '3px' }}>
                          {statusLabel}
                        </span>
                      </div>
                      {/* 계약기간 */}
                      <div>
                        <span className="text-[0.8125rem]" style={{ color: (company.maintenanceStartDate || company.maintenanceEndDate) ? (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(55,53,47,0.75)') : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(55,53,47,0.3)') }}>
                          {company.maintenanceStartDate || company.maintenanceEndDate
                            ? `${formatDateShort(company.maintenanceStartDate)} ~ ${formatDateShort(company.maintenanceEndDate)}`
                            : '—'}
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* 페이징 */}
          <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
        )} {/* end viewMode === 'grid' ? ... : */}
      </div>

      {/* ── 필터 패널 드롭다운 ── */}
      {showChipMenu && filterMenuPos && (
        <div
          ref={filterMenuRef}
          style={{
            position: 'fixed',
            top: filterMenuPos.top,
            left: filterMenuPos.left,
            zIndex: 9999,
            backgroundColor: themeColors.surface,
            border: `1px solid ${themeColors.border}`,
            borderRadius: '6px',
            minWidth: '220px',
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {/* 1단계: 필터 유형 선택 */}
          {chipMenuType === null && (() => {
            const contractStatusDisplayMap: Record<string, string> = { maintenance: t('workTypeMaintenance'), project: t('projectsMenu'), ended: t('contractEnded') };
            const getSummary = (type: string): string | null => {
              if (type === 'companyName' && companyNameChip) {
                return companyNameChip.values.length > 1 ? `${companyNameChip.values[0]} 외 ${companyNameChip.values.length - 1}` : companyNameChip.values[0];
              }
              if (type === 'assignee' && assigneeChip) {
                return assigneeChip.values.length > 1 ? `${assigneeChip.values[0]} 외 ${assigneeChip.values.length - 1}` : assigneeChip.values[0];
              }
              if (type === 'role' && roleChip) {
                return roleChip.values.length > 1 ? `${roleChip.values[0]} 외 ${roleChip.values.length - 1}` : roleChip.values[0];
              }
              if (type === 'phone' && phoneChip) {
                return phoneChip.values.length > 1 ? `${phoneChip.values[0]} 외 ${phoneChip.values.length - 1}` : phoneChip.values[0];
              }
              if (type === 'email' && emailChip) {
                return emailChip.values.length > 1 ? `${emailChip.values[0]} 외 ${emailChip.values.length - 1}` : emailChip.values[0];
              }
              if (type === 'contractStatus' && contractStatusChip) {
                const displays = contractStatusChip.values.map(v => contractStatusDisplayMap[v] || v);
                return displays.length > 1 ? `${displays[0]} 외 ${displays.length - 1}` : displays[0];
              }
              if (type === 'date' && dateChip) {
                const from = dateChip.dateFrom || '';
                const to = dateChip.dateTo || '';
                if (from && to) return `${from} ~ ${to}`;
                if (from) return `${from} ~`;
                if (to) return `~ ${to}`;
              }
              return null;
            };
            return (
              <div className="py-1">
                {([
                  { type: 'companyName'    as const, label: t('companyName'),    icon: <Building2 size={14} />,   active: !!companyNameChip,    onClick: () => { setPendingValues([...(companyNameChip?.values    || [])]); setMultiSelectSearch(''); setChipMenuType('companyName'); } },
                  { type: 'assignee'       as const, label: t('assignee'),       icon: <User size={14} />,        active: !!assigneeChip,       onClick: () => { setPendingValues([...(assigneeChip?.values       || [])]); setMultiSelectSearch(''); setChipMenuType('assignee'); } },
                  { type: 'role'           as const, label: t('position'),       icon: <Briefcase size={14} />,   active: !!roleChip,           onClick: () => { setPendingValues([...(roleChip?.values           || [])]); setMultiSelectSearch(''); setChipMenuType('role'); } },
                  { type: 'phone'          as const, label: t('mobile'),         icon: <Smartphone size={14} />,  active: !!phoneChip,          onClick: () => { setPendingValues([...(phoneChip?.values          || [])]); setMultiSelectSearch(''); setChipMenuType('phone'); } },
                  { type: 'email'          as const, label: t('email'),          icon: <Mail size={14} />,        active: !!emailChip,          onClick: () => { setPendingValues([...(emailChip?.values          || [])]); setMultiSelectSearch(''); setChipMenuType('email'); } },
                  { type: 'contractStatus' as const, label: t('contractStatus'), icon: <Tag size={14} />,         active: !!contractStatusChip, onClick: () => { setPendingValues([...(contractStatusChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('contractStatus'); } },
                  { type: 'date'           as const, label: t('contractPeriod'), icon: <CalendarDays size={14} />,active: !!dateChip,           onClick: () => { setPendingDate({ from: dateChip?.dateFrom || '', to: dateChip?.dateTo || '' }); setChipMenuType('date'); } },
                ] as { type: 'companyName' | 'assignee' | 'role' | 'phone' | 'email' | 'contractStatus' | 'date'; label: string; icon: React.ReactNode; active: boolean; onClick: () => void }[]).map(item => {
                  const summary = getSummary(item.type);
                  return (
                    <button
                      key={item.type}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all text-left rounded-sm mx-1"
                      style={{ color: item.active ? themeColors.primary : themeColors.text, width: 'calc(100% - 8px)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = item.active ? `${themeColors.primary}12` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)')}
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

          {/* 2단계: 멀티셀렉트 공통 (업체명 / 담당자 / 직책 / 휴대폰 / 이메일 / 계약상태) */}
          {(chipMenuType === 'companyName' || chipMenuType === 'assignee' || chipMenuType === 'role' || chipMenuType === 'phone' || chipMenuType === 'email' || chipMenuType === 'contractStatus') && (() => {
            const metaMap: Record<string, { label: string; values: string[] | { key: string; display: string }[] }> = {
              companyName:    { label: t('companyName'),    values: uniqueCompanyNames },
              assignee:       { label: t('assignee'),       values: uniqueAssignees },
              role:           { label: t('position'),       values: uniqueRoles },
              phone:          { label: t('mobile'),         values: uniquePhones },
              email:          { label: t('email'),          values: uniqueEmails },
              contractStatus: { label: t('contractStatus'), values: [
                { key: 'maintenance', display: t('workTypeMaintenance') },
                { key: 'project',     display: t('projectsMenu') },
                { key: 'ended',       display: t('contractEnded') },
              ]},
            };
            const meta = metaMap[chipMenuType!];
            const existingChip = activeChips.find(c => c.type === chipMenuType);
            const rawValues: string[] = typeof meta.values[0] === 'string'
              ? meta.values as string[]
              : (meta.values as { key: string; display: string }[]).map(v => v.key);
            const getDisplay = (key: string) => {
              if (typeof meta.values[0] !== 'string') {
                const found = (meta.values as { key: string; display: string }[]).find(v => v.key === key);
                return found?.display || key;
              }
              return key;
            };
            const filteredRawValues = rawValues.filter(val =>
              getDisplay(val).toLowerCase().includes(multiSelectSearch.toLowerCase())
            );
            const metaIcons: Record<string, React.ReactNode> = {
              companyName: <Building2 size={13} />, assignee: <User size={13} />, role: <Briefcase size={13} />, phone: <Smartphone size={13} />,
              email: <Mail size={13} />, contractStatus: <Tag size={13} />,
            };
            return (
              <div className="p-1">
                {/* 헤더 */}
                <div className="flex items-center gap-1 px-1 py-1">
                  <button
                    onClick={() => { setChipMenuType(null); setMultiSelectSearch(''); }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm transition-colors"
                    style={{ color: themeColors.text, background: 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <ChevronLeft size={14} style={{ color: themeColors.textSecondary }} />
                    <span style={{ color: themeColors.textSecondary }}>{metaIcons[chipMenuType!]}</span>
                    <span className="text-sm font-semibold">{meta.label}</span>
                  </button>
                  <div className="flex-1" />
                  {pendingValues.length > 0 && (
                    <button onClick={() => setPendingValues([])} className="text-sm px-2" style={{ color: themeColors.primary }}>전체 해제</button>
                  )}
                </div>
                {/* 검색 인풋 */}
                {rawValues.length > 5 && (
                  <div className="px-2 pb-1.5">
                    <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: themeColors.textSecondary }} />
                    <input
                      type="text"
                      placeholder="검색..."
                      value={multiSelectSearch}
                      onChange={(e) => setMultiSelectSearch(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1.5 text-sm focus:outline-none transition-colors"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}`,
                        borderRadius: '6px',
                        color: themeColors.text,
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = themeColors.primary}
                      onBlur={(e) => e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}
                      autoFocus
                    />
                    </div>
                  </div>
                )}
                {/* 항목 리스트 */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredRawValues.length === 0 ? (
                    <p className="px-3 py-2 text-sm" style={{ color: themeColors.textSecondary }}>{rawValues.length === 0 ? t('noItems') : t('noSearchResults')}</p>
                  ) : filteredRawValues.map(val => {
                    const isChecked = pendingValues.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => setPendingValues(prev => isChecked ? prev.filter(v => v !== val) : [...prev, val])}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-sm transition-all text-left"
                        style={{ backgroundColor: isChecked ? `${themeColors.primary}12` : 'transparent', color: themeColors.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isChecked ? `${themeColors.primary}18` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)')}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked ? `${themeColors.primary}12` : 'transparent'}
                      >
                        <span
                          className="flex-shrink-0 flex items-center justify-center"
                          style={{
                            width: '15px', height: '15px', borderRadius: '3px',
                            border: `1.5px solid ${isChecked ? themeColors.primary : (isDark ? 'rgba(255,255,255,0.3)' : '#c0c0c0')}`,
                            backgroundColor: isChecked ? themeColors.primary : 'transparent',
                          }}
                        >
                          {isChecked && <Check size={10} strokeWidth={3} color="#fff" />}
                        </span>
                        <span className="truncate">{getDisplay(val)}</span>
                      </button>
                    );
                  })}
                </div>
                {/* 하단 버튼 */}
                <div className="flex gap-2 p-2 pt-1.5" style={{ borderTop: `1px solid ${themeColors.border}` }}>
                  {existingChip && (
                    <button
                      onClick={() => { setActiveChips(prev => prev.filter(c => c.type !== chipMenuType)); setShowChipMenu(false); setChipMenuType(null); }}
                      className="flex-1 py-1.5 text-sm font-medium transition-all"
                      style={{ border: `1px solid ${themeColors.border}`, color: themeColors.textSecondary, borderRadius: '6px' }}
                    >
                      초기화
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const type = chipMenuType!;
                      if (pendingValues.length === 0) {
                        setActiveChips(prev => prev.filter(c => c.type !== type));
                      } else {
                        const displayVals = pendingValues.map(getDisplay);
                        const label = `${meta.label}: ${displayVals.slice(0, 2).join(', ')}${displayVals.length > 2 ? ` 외 ${displayVals.length - 2}` : ''}`;
                        setActiveChips(prev => [...prev.filter(c => c.type !== type), { id: type, type, label, values: pendingValues } as CompanyChip]);
                      }
                      setShowChipMenu(false); setChipMenuType(null);
                    }}
                    disabled={pendingValues.length === 0 && !existingChip}
                    className="flex-1 py-1.5 text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', borderRadius: '6px' }}
                  >
                    적용
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 2단계: 계약기간 날짜 범위 */}
          {chipMenuType === 'date' && (
            <div className="p-1">
              {/* 헤더 */}
              <div className="flex items-center gap-1 px-1 py-1 mb-1">
                <button
                  onClick={() => setChipMenuType(null)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm transition-colors"
                  style={{ color: themeColors.text, background: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <ChevronLeft size={14} style={{ color: themeColors.textSecondary }} />
                  <span style={{ color: themeColors.textSecondary }}><CalendarDays size={13} /></span>
                  <span className="text-sm font-semibold">계약기간</span>
                </button>
              </div>
              {/* 날짜 입력 */}
              <div className="space-y-2 px-2 mb-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: themeColors.textSecondary }}>시작일 이후</label>
                  <input
                    type="date"
                    value={pendingDate.from}
                    onChange={(e) => setPendingDate(prev => ({ ...prev, from: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm focus:outline-none transition-colors"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}`, borderRadius: '6px', color: themeColors.text, colorScheme: isDark ? 'dark' : 'light' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = themeColors.primary}
                    onBlur={(e) => e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: themeColors.textSecondary }}>시작일 이전</label>
                  <input
                    type="date"
                    value={pendingDate.to}
                    onChange={(e) => setPendingDate(prev => ({ ...prev, to: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm focus:outline-none transition-colors"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}`, borderRadius: '6px', color: themeColors.text, colorScheme: isDark ? 'dark' : 'light' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = themeColors.primary}
                    onBlur={(e) => e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0'}
                  />
                </div>
              </div>
              {/* 하단 버튼 */}
              <div className="flex gap-2 p-2 pt-1.5" style={{ borderTop: `1px solid ${themeColors.border}` }}>
                {dateChip && (
                  <button
                    onClick={() => { setActiveChips(prev => prev.filter(c => c.type !== 'date')); setShowChipMenu(false); setChipMenuType(null); }}
                    className="flex-1 py-1.5 text-sm font-medium transition-all"
                    style={{ border: `1px solid ${themeColors.border}`, color: themeColors.textSecondary, borderRadius: '6px' }}
                  >
                    {t('reset')}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!pendingDate.from && !pendingDate.to) return;
                    const fmt = (d: string) => d.replace(/-/g, '.');
                    let label = t('contractPeriod') + ': ';
                    if (pendingDate.from && pendingDate.to) label += `${fmt(pendingDate.from)} ~ ${fmt(pendingDate.to)}`;
                    else if (pendingDate.from) label += `${fmt(pendingDate.from)} 이후`;
                    else label += `${fmt(pendingDate.to)} 이전`;
                    setActiveChips(prev => [...prev.filter(c => c.type !== 'date'), { id: 'date', type: 'date', label, dateFrom: pendingDate.from, dateTo: pendingDate.to }]);
                    setShowChipMenu(false); setChipMenuType(null); setPendingDate({ from: '', to: '' });
                  }}
                  disabled={!pendingDate.from && !pendingDate.to}
                  className="flex-1 py-1.5 text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff', borderRadius: '6px' }}
                >
                  적용
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 삭제 확인 팝오버 (단일) */}
      <ConfirmPopover
        isOpen={!!deleteConfirmId}
        variant="delete"
        title="선택한 업체가 삭제됩니다."
        description="삭제하면 복구할 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* 일괄 삭제 확인 팝오버 */}
      <ConfirmPopover
        isOpen={showBulkDeleteConfirm}
        variant="warn"
        title="선택한 모든 업체가 삭제됩니다."
        description="삭제하면 복구할 수 없습니다."
        confirmLabel="모두 삭제"
        cancelLabel="취소"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {/* 업체 등록 / 상세 모달 */}
      <CompanyCreateModal
        isOpen={showCreateModal || detailCompanyId !== null}
        companyId={detailCompanyId}
        initialCompany={detailCompanyData}
        onClose={() => { setShowCreateModal(false); setDetailCompanyId(null); setDetailCompanyData(null); }}
        onCreated={handleCompanyCreated}
        onDeleted={loadCompanies}
      />

    </div>
  );
};

export default Companies;
