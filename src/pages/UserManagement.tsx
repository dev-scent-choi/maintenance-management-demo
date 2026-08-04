import React, { useState, useEffect, useRef } from 'react';
import { Users as UsersIcon, UserPlus, Trash2, Search, X, List, LayoutGrid, Filter, Phone, Mail, Building2, Briefcase, Shield, ChevronLeft, ChevronRight, Check, Hash, User as UserIcon, Activity } from 'lucide-react';
import ListTabBar from '../components/common/ListTabBar';
import ListPagination from '../components/common/ListPagination';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { isAdminAccount } from '../utils/permissions';
import { usePermission } from '../hooks/usePermission';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmPopover from '../components/common/ConfirmPopover';
import UserFormModal from './UserFormModal';
import type { User } from '../types';

// 랜덤 캐릭터 아바타 이미지 URL 생성 (DiceBear 일러스트 스타일)
const getAvatarUrl = (id: string) => {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

interface UserFilterChip {
  id: string;
  type: 'id' | 'name' | 'department' | 'position' | 'role' | 'status' | 'phone' | 'email';
  label: string;
  values: string[];
}

const UserManagement: React.FC = () => {
  const theme = useSettingsStore((state) => state.settings.theme);
  const fontSize = useSettingsStore((state) => state.settings.fontSize);
  const tableStyle = useSettingsStore((state) => state.settings.tableStyle);
  const themeColors = themeConfigs[theme];
  const onGradientText = theme === 'yellow' ? '#333333' : '#FFFFFF';
  const iconSize = fontSize === 'small' ? 13 : fontSize === 'large' ? 17 : 15;
  const userGridCols = '40px 170px 120px 120px 140px 100px 140px 210px';
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const { addLog } = useAuditLogStore();

  const [showModal, setShowModal] = useState(false);
  const [modalUserId, setModalUserId] = useState<string | null>(null);

  const openCreate = () => { setModalUserId(null); setShowModal(true); };
  const openEdit   = (id: string) => { setModalUserId(id); setShowModal(true); };

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [activeChips, setActiveChips] = useState<UserFilterChip[]>([]);
  const [showChipMenu, setShowChipMenu] = useState(false);
  const [chipMenuType, setChipMenuType] = useState<'id' | 'name' | 'department' | 'position' | 'role' | 'status' | 'phone' | 'email' | null>(null);
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const [multiSelectSearch, setMultiSelectSearch] = useState('');
  const chipMenuRef = useRef<HTMLDivElement>(null);

  const itemsPerPage = viewMode === 'list' ? 15 : 6;

  const t = useLanguage();
  const isAdmin = isAdminAccount(currentUser);
  const { can } = usePermission();
  const canCreateUser = isAdmin || can('create_users');

  useEffect(() => {
    fetchUsers();
  }, []);

  // 필터 변경 시 선택 해제
  useEffect(() => {
    setSelectedUsers(new Set());
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

  // 뷰모드/칩 변경 시 페이지 + 선택 초기화
  useEffect(() => {
    setCurrentPage(1);
    setSelectedUsers(new Set());
  }, [viewMode, activeChips]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chipMenuRef.current && !chipMenuRef.current.contains(e.target as Node)) {
        setShowChipMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(import.meta.env.VITE_API_URL + '/users', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errBody || response.statusText}`);
      }
      const data = await response.json();
      const convertedUsers: User[] = data.map((user: any) => ({
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase(),
        phone: user.phone || '',
        department: user.department || '',
        position: user.position || '',
        projectAssignments: [],
        accountStatus: user.active ? 'active' : 'inactive'
      }));
      setUsers(convertedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to delete user');
      const deletedUser = users.find(u => u.id === id);
      addLog({ userId: currentUser?.id, userName: currentUser?.name, action: 'delete', resourceType: 'user', resourceId: id, resourceName: deletedUser?.name, details: `사용자가 삭제되었습니다: ${deletedUser?.name || id}` });
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleDelete = (id: string) => {
    const targetUser = users.find(u => u.id === id);
    setConfirmConfig({
      title: '선택한 사용자가 삭제됩니다.',
      description: '삭제하면 복구할 수 없습니다.',
      onConfirm: async () => {
        setConfirmConfig(null);
        await executeDelete(id);
      },
    });
  };

  const executeBulkDelete = async () => {
    const ids = Array.from(selectedUsers);
    await Promise.allSettled(
      ids.map(id =>
        fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      )
    );
    await fetchUsers();
    setSelectedUsers(new Set());
  };

  const handleBulkDelete = () => {
    setConfirmConfig({
      title: '선택한 모든 사용자가 삭제됩니다.',
      description: '삭제하면 복구할 수 없습니다.',
      onConfirm: async () => {
        setConfirmConfig(null);
        await executeBulkDelete();
      },
    });
  };

  const generateUserId = (email: string) => {
    if (email && email.includes('@')) {
      return email.split('@')[0];
    }
    return email;
  };

  const isDark = theme !== 'light';
  const notionRole = {
    admin:    isDark ? { bg: '#3D1A17', text: '#F87171' } : { bg: '#FFE2DD', text: '#C4463A' },
    manager:  isDark ? { bg: '#143D6B', text: '#82BFDF' } : { bg: '#D3E5EF', text: '#0B6E99' },
    user:     isDark ? { bg: '#1C3829', text: '#6DC47A' } : { bg: '#DBEDDB', text: '#1D7B52' },
    readonly: isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' },
  };
  const getRoleConfig = (role: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin')    return { label: t('roleAdmin'),    ...notionRole.admin };
    if (r === 'manager')  return { label: t('roleManager'),  ...notionRole.manager };
    if (r === 'user')     return { label: t('roleUser'),     ...notionRole.user };
    if (r === 'readonly') return { label: t('roleReadonly'), ...notionRole.readonly };
    return { label: role, ...notionRole.readonly };
  };
  const getRoleLabel = (role: string) => getRoleConfig(role).label;

  // Status tabs
  const statusTabs = [
    { key: 'all', label: t('all'), count: users.length },
    { key: 'active', label: t('activeLabel'), count: users.filter(u => u.accountStatus === 'active').length },
    { key: 'inactive', label: t('inactiveLabel'), count: users.filter(u => u.accountStatus === 'inactive').length },
  ];

  // 역할 필터 옵션
  const roleOptions = [
    { value: 'admin', label: t('roleAdmin') },
    { value: 'manager', label: t('roleManager') },
    { value: 'user', label: t('roleUser') },
    { value: 'readonly', label: t('roleReadonly') },
  ];

  const idChip         = activeChips.find(c => c.type === 'id');
  const nameChip       = activeChips.find(c => c.type === 'name');
  const departmentChip = activeChips.find(c => c.type === 'department');
  const positionChip   = activeChips.find(c => c.type === 'position');
  const roleChip       = activeChips.find(c => c.type === 'role');
  const statusChip     = activeChips.find(c => c.type === 'status');
  const phoneChip      = activeChips.find(c => c.type === 'phone');
  const emailChip      = activeChips.find(c => c.type === 'email');

  const uniqueIds         = [...new Set(users.map(u => generateUserId(u.email)).filter(Boolean))].sort() as string[];
  const uniqueNames       = [...new Set(users.map(u => u.name).filter(Boolean))].sort() as string[];
  const uniqueDepartments = [...new Set(users.map(u => u.department).filter(Boolean))].sort() as string[];
  const uniquePositions   = [...new Set(users.map(u => u.position).filter(Boolean))].sort() as string[];
  const uniqueRoles       = [...new Set(users.map(u => u.role).filter(Boolean))].sort() as string[];
  const uniqueStatuses    = ['active', 'inactive'];
  const uniquePhones      = [...new Set(users.map(u => u.phone).filter(Boolean))].sort() as string[];
  const uniqueEmails      = [...new Set(users.map(u => u.email).filter(Boolean))].sort() as string[];

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.accountStatus === statusFilter;
    if (!matchesSearch || !matchesStatus) return false;
    if (idChip?.values?.length && !idChip.values.includes(generateUserId(user.email))) return false;
    if (nameChip?.values?.length && !nameChip.values.includes(user.name)) return false;
    if (departmentChip?.values?.length && !departmentChip.values.includes(user.department || '')) return false;
    if (positionChip?.values?.length && !positionChip.values.includes(user.position || '')) return false;
    if (roleChip?.values?.length && !roleChip.values.includes(user.role)) return false;
    if (statusChip?.values?.length && !statusChip.values.includes(user.accountStatus || '')) return false;
    if (phoneChip?.values?.length && !phoneChip.values.includes(user.phone || '')) return false;
    if (emailChip?.values?.length && !emailChip.values.includes(user.email || '')) return false;
    return true;
  });

  // 정렬
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortColumn) return a.name.localeCompare(b.name, 'ko');
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortColumn) {
      case 'name': return a.name.localeCompare(b.name, 'ko') * dir;
      case 'phone': return (a.phone || '').localeCompare(b.phone || '', 'ko') * dir;
      case 'email': return a.email.localeCompare(b.email, 'ko') * dir;
      case 'department': return (a.department || '').localeCompare(b.department || '', 'ko') * dir;
      case 'position': return (a.position || '').localeCompare(b.position || '', 'ko') * dir;
      case 'role': return a.role.localeCompare(b.role, 'ko') * dir;
      case 'status': return (a.accountStatus || '').localeCompare(b.accountStatus || '', 'ko') * dir;
      default: return 0;
    }
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Pagination
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = sortedUsers.slice(startIndex, startIndex + itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedUsers.size === paginatedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginatedUsers.map(u => u.id)));
    }
  };

  const toggleSelectUser = (id: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedUsers(newSelected);
  };

  const paginationBar = (
    <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}>
      <style>{`
        .user-col-sep{gap:0!important;padding:0!important;align-items:stretch!important}
        .user-col-sep>*{display:flex!important;align-items:center;padding:8px 12px;border-right:1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)'};min-width:0;overflow:hidden}
        .user-col-sep>*:first-child{padding-left:16px}
        .user-col-sep>*:last-child{border-right:none!important;padding-right:16px}
      `}</style>
      {/* 탭 + 액션 버튼 */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        {/* 탭 - 언더라인 스타일 */}
        <ListTabBar
          tabs={statusTabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: tab.count,
            isActive: statusFilter === tab.key,
            onClick: () => { setStatusFilter(tab.key); setCurrentPage(1); },
          }))}
        />

        {/* 액션 버튼 */}
        {canCreateUser && (
          <div className="flex items-center gap-2" style={{ height: '36px' }}>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: themeColors.primary, color: onGradientText, borderRadius: '4px' }}
            >
              <UserPlus size={15} />
              <span>{t('addUser')}</span>
            </button>
          </div>
        )}
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
          {selectedUsers.size > 0 ? (
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
                {selectedUsers.size}명 선택됨
              </span>
              <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(239,68,68,0.30)' }} />
              <button
                onClick={() => handleBulkDelete()}
                className="flex items-center gap-1.5 px-2.5 rounded text-sm font-medium transition-colors"
                style={{ height: '28px', color: '#EF4444' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 size={14} /><span>삭제</span>
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedUsers(new Set())}
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
            /* 통합 검색바 */
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
                      className="flex items-center gap-1 pl-2 pr-1 rounded text-sm font-medium flex-shrink-0"
                      style={{
                        height: '24px',
                        backgroundColor: `${themeColors.primary}18`,
                        color: themeColors.primary,
                        border: `1px solid ${themeColors.primary}30`,
                      }}
                    >
                      <span>{chip.label}</span>
                      <button
                        onClick={() => setActiveChips(prev => prev.filter(c => c.id !== chip.id))}
                        className="flex items-center opacity-60 hover:opacity-100 transition-all ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <input
                    type="text"
                    placeholder={t('searchByIdOrName')}
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px]"
                    style={{ color: themeColors.text }}
                  />
                </div>

                {/* 필터 버튼 */}
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 1단계: 필터 유형 선택 */}
                        {chipMenuType === null && (() => {
                          const getSummary = (type: string): string | null => {
                            const chip = activeChips.find(c => c.type === type);
                            if (!chip?.values?.length) return null;
                            return chip.values.length > 1 ? `${chip.values[0]} 외 ${chip.values.length - 1}` : chip.values[0];
                          };
                          return (
                            <div className="py-1">
                              {([
                                { type: 'id'         as const, label: '아이디',   icon: <Hash size={14} />,      active: !!idChip,         onClick: () => { setPendingValues([...(idChip?.values         || [])]); setMultiSelectSearch(''); setChipMenuType('id'); } },
                                { type: 'name'       as const, label: '이름',     icon: <UserIcon size={14} />,      active: !!nameChip,       onClick: () => { setPendingValues([...(nameChip?.values       || [])]); setMultiSelectSearch(''); setChipMenuType('name'); } },
                                { type: 'department' as const, label: '부서',     icon: <Building2 size={14} />, active: !!departmentChip, onClick: () => { setPendingValues([...(departmentChip?.values || [])]); setMultiSelectSearch(''); setChipMenuType('department'); } },
                                { type: 'position'   as const, label: '직책',     icon: <Briefcase size={14} />, active: !!positionChip,   onClick: () => { setPendingValues([...(positionChip?.values   || [])]); setMultiSelectSearch(''); setChipMenuType('position'); } },
                                { type: 'role'       as const, label: '권한',     icon: <Shield size={14} />,    active: !!roleChip,       onClick: () => { setPendingValues([...(roleChip?.values       || [])]); setMultiSelectSearch(''); setChipMenuType('role'); } },
                                { type: 'status'     as const, label: '상태',     icon: <Activity size={14} />,  active: !!statusChip,     onClick: () => { setPendingValues([...(statusChip?.values     || [])]); setMultiSelectSearch(''); setChipMenuType('status'); } },
                                { type: 'phone'      as const, label: '전화번호',  icon: <Phone size={14} />,     active: !!phoneChip,      onClick: () => { setPendingValues([...(phoneChip?.values      || [])]); setMultiSelectSearch(''); setChipMenuType('phone'); } },
                                { type: 'email'      as const, label: '이메일',   icon: <Mail size={14} />,      active: !!emailChip,      onClick: () => { setPendingValues([...(emailChip?.values      || [])]); setMultiSelectSearch(''); setChipMenuType('email'); } },
                              ] as { type: UserFilterChip['type']; label: string; icon: React.ReactNode; active: boolean; onClick: () => void }[]).map(item => {
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

                        {/* 2단계: 멀티셀렉트 */}
                        {(chipMenuType === 'id' || chipMenuType === 'name' || chipMenuType === 'department' || chipMenuType === 'position' || chipMenuType === 'role' || chipMenuType === 'status' || chipMenuType === 'phone' || chipMenuType === 'email') && (() => {
                          const roleDisplayMap: Record<string, string> = { admin: t('roleAdmin'), manager: t('roleManager'), user: t('roleUser'), readonly: t('roleReadonly') };
                          const statusDisplayMap: Record<string, string> = { active: '활성', inactive: '비활성' };
                          const typeInfoMap = {
                            id:         { label: '아이디',   icon: <Hash size={13} />,      allVals: uniqueIds,         currentChip: idChip },
                            name:       { label: '이름',     icon: <UserIcon size={13} />,      allVals: uniqueNames,       currentChip: nameChip },
                            department: { label: '부서',     icon: <Building2 size={13} />, allVals: uniqueDepartments, currentChip: departmentChip },
                            position:   { label: '직책',     icon: <Briefcase size={13} />, allVals: uniquePositions,   currentChip: positionChip },
                            role:       { label: '권한',     icon: <Shield size={13} />,    allVals: uniqueRoles,       currentChip: roleChip },
                            status:     { label: '상태',     icon: <Activity size={13} />,  allVals: uniqueStatuses,    currentChip: statusChip },
                            phone:      { label: '전화번호',  icon: <Phone size={13} />,     allVals: uniquePhones,      currentChip: phoneChip },
                            email:      { label: '이메일',   icon: <Mail size={13} />,      allVals: uniqueEmails,      currentChip: emailChip },
                          };
                          const typeInfo = typeInfoMap[chipMenuType];
                          const getDisplay = (val: string) => {
                            if (chipMenuType === 'role') return roleDisplayMap[val] || val;
                            if (chipMenuType === 'status') return statusDisplayMap[val] || val;
                            return val;
                          };
                          const filteredVals = typeInfo.allVals.filter(v => getDisplay(v).toLowerCase().includes(multiSelectSearch.toLowerCase()));
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
                                      <span className="truncate">{getDisplay(val)}</span>
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
                                      const labelMap: Record<string, string> = { id: '아이디', name: '이름', department: '부서', position: '직책', role: '권한', status: '상태', phone: '전화번호', email: '이메일' };
                                      const displayVals = chipMenuType === 'role' ? pendingValues.map(v => roleDisplayMap[v] || v) : chipMenuType === 'status' ? pendingValues.map(v => statusDisplayMap[v] || v) : pendingValues;
                                      const label = `${labelMap[chipMenuType]}: ${displayVals.slice(0, 2).join(', ')}${displayVals.length > 2 ? ` 외 ${displayVals.length - 2}` : ''}`;
                                      setActiveChips(prev => [...prev.filter(c => c.type !== chipMenuType), { id: chipMenuType, type: chipMenuType, label, values: pendingValues }]);
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
                onClick={() => { setViewMode('list'); setCurrentPage(1); }}
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

        {viewMode === 'list' ? (
          /* 리스트 뷰 */
          <div className="flex-1 flex flex-col min-h-0">
          <div className="relative flex-1 overflow-auto min-h-0 scroll-area">
            {/* 테이블 헤더 */}
            <div
              className="user-col-sep grid select-none"
              style={{
                gridTemplateColumns: userGridCols,
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
                  checked={paginatedUsers.length > 0 && selectedUsers.size === paginatedUsers.length}
                  onChange={toggleSelectAll}
                />
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleSort('name')}>
                {t('userId')} / {t('name')} {sortColumn === 'name' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleSort('department')}>
                {t('department')} {sortColumn === 'department' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleSort('position')}>
                {t('position')} {sortColumn === 'position' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" style={{ justifyContent: 'center' }} onClick={() => handleSort('role')}>
                {t('role')} {sortColumn === 'role' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" style={{ justifyContent: 'center' }} onClick={() => handleSort('status')}>
                {t('status')} {sortColumn === 'status' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleSort('phone')}>
                {t('phone')} {sortColumn === 'phone' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
              </div>
              <div className="relative gap-1 cursor-pointer select-none hover:opacity-70" onClick={() => handleSort('email')}>
                {t('email')} {sortColumn === 'email' && <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
              </div>
            </div>

            {/* 레코드 목록 */}
            {isLoading ? (
              <LoadingSpinner message="사용자 정보를 불러오는 중..." />
            ) : filteredUsers.length === 0 ? (
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center text-center" style={{ top: '40px' }}>
                <UsersIcon size={48} className="mb-4 opacity-30" style={{ color: themeColors.textSecondary }} />
                <p className="text-base font-semibold mb-2" style={{ color: themeColors.text }}>{t('noUsers')}</p>
                <p className="text-sm mb-4" style={{ color: themeColors.textSecondary }}>{t('addNewUser')}</p>
                {canCreateUser && (
                  <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: themeColors.primary, color: onGradientText }}
                  >
                    <UserPlus size={15} /><span>{t('addUser')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div>
                {paginatedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="user-col-sep grid transition-colors cursor-pointer"
                    style={{
                      gridTemplateColumns: userGridCols,
                      borderBottom: `1px solid ${themeColors.border}`,
                      backgroundColor: selectedUsers.has(user.id) ? `${themeColors.primary}08` : 'transparent',
                    }}
                    onClick={() => openEdit(user.id)}
                    onMouseEnter={(e) => { if (!selectedUsers.has(user.id)) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                    onMouseLeave={(e) => { if (!selectedUsers.has(user.id)) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {/* 체크박스 */}
                    <div style={{ justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded cursor-pointer"
                        style={{ accentColor: themeColors.primary }}
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleSelectUser(user.id)}
                      />
                    </div>

                    {/* ID / 이름 + 아바타 */}
                    <div className="gap-3 min-w-0">
                      <img
                        src={getAvatarUrl(user.id)}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                        }}
                      />
                      <div
                        className="hidden w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: themeColors.primary }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] font-semibold truncate" style={{ color: themeColors.text }}>{user.name}</p>
                        <p className="text-xs truncate mt-0.5" style={{ color: themeColors.textSecondary }}>{generateUserId(user.email)}</p>
                      </div>
                    </div>

                    {/* 부서 */}
                    <div className="min-w-0">
                      <span className="text-[0.8125rem] truncate" style={{ color: themeColors.text }}>{user.department || '-'}</span>
                    </div>

                    {/* 직책 */}
                    <div className="min-w-0">
                      <span className="text-[0.8125rem] truncate" style={{ color: themeColors.text }}>{user.position || '-'}</span>
                    </div>

                    {/* 권한 */}
                    <div style={{ justifyContent: 'center' }}>
                      {(() => { const rc = getRoleConfig(user.role); return (
                        <span
                          className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: rc.bg, color: rc.text, borderRadius: '3px' }}
                        >
                          {rc.label}
                        </span>
                      ); })()}
                    </div>

                    {/* 상태 */}
                    <div style={{ justifyContent: 'center' }}>
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                        style={{
                          borderRadius: '3px',
                          backgroundColor: user.accountStatus === 'active'
                            ? (isDark ? '#1C3829' : '#DBEDDB')
                            : (isDark ? '#2F2F2F' : '#E3E2E0'),
                          color: user.accountStatus === 'active'
                            ? (isDark ? '#6DC47A' : '#1D7B52')
                            : (isDark ? '#999898' : '#787774'),
                        }}
                      >
                        {user.accountStatus === 'active' ? t('activeLabel') : t('inactiveLabel')}
                      </span>
                    </div>

                    {/* 전화번호 */}
                    <div>
                      <span className="text-[0.8125rem]" style={{ color: themeColors.text }}>{user.phone || '-'}</span>
                    </div>

                    {/* 이메일 */}
                    <div className="min-w-0">
                      <span className="text-[0.8125rem] truncate" style={{ color: themeColors.primary }}>{user.email}</span>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

            {paginationBar}
          </div>
        ) : (
          /* 카드(그리드) 뷰 */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="relative flex-1 overflow-y-auto min-h-0 p-4 scroll-area">
              {isLoading ? (
                <LoadingSpinner message="사용자 정보를 불러오는 중..." />
              ) : filteredUsers.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <UsersIcon size={48} className="mb-4 opacity-30" style={{ color: themeColors.textSecondary }} />
                  <p className="text-base font-semibold mb-2" style={{ color: themeColors.text }}>{t('noUsers')}</p>
                  <p className="text-sm mb-4" style={{ color: themeColors.textSecondary }}>{t('addNewUser')}</p>
                  {canCreateUser && <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: themeColors.primary, color: onGradientText }}
                  >
                    <UserPlus size={15} /><span>{t('addUser')}</span>
                  </button>}
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {paginatedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="rounded p-4 cursor-pointer transition-all"
                      style={{
                        backgroundColor: selectedUsers.has(user.id) ? `${themeColors.primary}08` : themeColors.surface,
                        border: selectedUsers.has(user.id)
                          ? `1px solid ${themeColors.primary}40`
                          : `1px solid ${themeColors.border}`,
                      }}
                      onClick={() => openEdit(user.id)}
                      onMouseEnter={(e) => {
                        if (!selectedUsers.has(user.id)) {
                          e.currentTarget.style.backgroundColor = theme !== 'light' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                          e.currentTarget.style.borderColor = theme !== 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(55,53,47,0.20)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedUsers.has(user.id)) {
                          e.currentTarget.style.backgroundColor = themeColors.surface;
                          e.currentTarget.style.borderColor = themeColors.border;
                        }
                      }}
                    >
                      {/* 카드 헤더: 아바타 + (체크박스 + 액션) */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={getAvatarUrl(user.id)}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                            }}
                          />
                          <div
                            className="hidden w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{ backgroundColor: themeColors.primary }}
                          >
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded cursor-pointer flex-shrink-0"
                            style={{ accentColor: themeColors.primary }}
                            checked={selectedUsers.has(user.id)}
                            onChange={() => toggleSelectUser(user.id)}
                          />
                      </div>
                      </div>

                      {/* 이름 + 역할 */}
                      <p className="text-[0.8125rem] font-semibold truncate mb-0.5" style={{ color: themeColors.primary }}>{user.name}</p>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs truncate" style={{ color: themeColors.textSecondary }}>{generateUserId(user.email)}</span>
                        {(() => { const rc = getRoleConfig(user.role); return (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0"
                            style={{ backgroundColor: rc.bg, color: rc.text, borderRadius: '3px' }}
                          >
                            {rc.label}
                          </span>
                        ); })()}
                      </div>

                      {/* 연락처 */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Mail size={iconSize - 3} style={{ color: themeColors.textSecondary, flexShrink: 0 }} />
                          <span className="text-xs truncate" style={{ color: themeColors.textSecondary }}>{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={iconSize - 3} style={{ color: themeColors.textSecondary, flexShrink: 0 }} />
                            <span className="text-xs truncate" style={{ color: themeColors.textSecondary }}>{user.phone}</span>
                          </div>
                        )}
                        {user.department && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs flex-shrink-0" style={{ color: themeColors.textSecondary }}>부서</span>
                            <span className="text-xs truncate" style={{ color: themeColors.text }}>{user.department}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {paginationBar}
          </div>
        )}
      </div>

      <UserFormModal
        isOpen={showModal}
        userId={modalUserId}
        onClose={() => setShowModal(false)}
        onSaved={fetchUsers}
        onUpdated={(uid, changes) => {
          // 해당 유저 항목만 로컬 state 즉시 업데이트 (전체 재조회 없음)
          setUsers(prev => prev.map(u =>
            u.id === uid ? { ...u, ...changes } as User : u
          ));
        }}
      />

      <ConfirmPopover
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        description={confirmConfig?.description}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />
    </div>
  );
};

export default UserManagement;
