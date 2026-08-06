import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  User,
  LogOut,
  Menu,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Clock,
  CheckCheck,
  Trash2,
  AlertCircle,
  Settings,
  CheckCircle2,
  Globe,
  RefreshCw,
  Check
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { themeConfigs } from '../../utils/themeConfig';
import { getTokenRemainingTime } from '../../utils/jwtUtils';
import { usePageRefresh } from '../../contexts/PageRefreshContext';
// breadcrumb 설정은 Header 내부에서 직접 관리
import type { Theme, Language } from '../../types/settings';

// 국기 이미지 컴포넌트
const FlagImage: React.FC<{ country: 'kr' | 'us'; size?: number }> = ({ country, size = 20 }) => (
  <img
    src={`${import.meta.env.BASE_URL}${country}.svg`}
    alt={country === 'kr' ? '한국어' : 'English'}
    style={{ width: size, height: size * 0.67, objectFit: 'contain' }}
    className="rounded-sm"
  />
);

// 경로별 브레드크럼브 매핑
const pathLabels: Record<string, string> = {
  '/': 'dashboard',
  '/companies': 'companyManagement',
  '/companies/new': 'newCompany',
  '/maintenance': 'maintenance',
  '/maintenance/new': 'newMaintenance',
  '/maintenance/calendar': 'calendar',
  '/projects': 'projectsMenu',
  '/projects/new': 'newProject',
  '/weekly-report': 'weeklyReport',
  '/collaboration': 'collaboration',
  '/users': 'userManagement',
  '/users/new': 'newUser',
  '/roles': 'rolesMenu',
  '/audit-logs': 'logs',
  '/settings': 'settings',
};

// 경로별 상위 카테고리 매핑 (홈 > [카테고리] > 페이지)
const pathParentCategory: Record<string, string> = {
  '/users': 'admin',
  '/audit-logs': 'admin',
  '/settings': 'system',
};

// 등록 페이지 매핑 (부모 경로 포함)
const newPageMappings: Record<string, { parentPath: string; labelKey: string }> = {
  '/companies/new': { parentPath: '/companies', labelKey: 'newCompany' },
  '/maintenance/new': { parentPath: '/maintenance', labelKey: 'newMaintenance' },
  '/projects/new': { parentPath: '/projects', labelKey: 'newProject' },
  '/users/new': { parentPath: '/users', labelKey: 'newUser' },
  '/maintenance/calendar': { parentPath: '/maintenance', labelKey: 'calendar' },
};

// 상세/수정 페이지 패턴 매핑
const detailPatterns: Array<{ pattern: RegExp; parentPath: string; labelKey: string }> = [
  { pattern: /^\/companies\/(\d+)$/, parentPath: '/companies', labelKey: 'companyDetail' },
  { pattern: /^\/companies\/(\d+)\/edit$/, parentPath: '/companies', labelKey: 'editCompany' },
  { pattern: /^\/maintenance\/([^/]+)$/, parentPath: '/maintenance', labelKey: 'maintenanceDetail' },
  { pattern: /^\/projects\/(\d+)$/, parentPath: '/projects', labelKey: 'projectDetail' },
  { pattern: /^\/projects\/(\d+)\/edit$/, parentPath: '/projects', labelKey: 'editProject' },
  { pattern: /^\/users\/([^/]+)\/edit$/, parentPath: '/users', labelKey: 'editUser' },
];

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, token } = useAuthStore();
  const t = useLanguage();
  const {
    settings,
    updateTheme,
    updateLanguage,
    updateLayoutType,
  } = useSettingsStore();
  const { theme, language, layoutType } = settings;
  const themeColors = themeConfigs[theme];

  // 알림 스토어
  const { getUserNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore();

  // 드롭다운 상태
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showLanguageSubmenu, setShowLanguageSubmenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 세션 타이머
  const [sessionTime, setSessionTime] = useState(() => getTokenRemainingTime(useAuthStore.getState().token));

  // 알림 상태
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 알림 로드
  useEffect(() => {
    if (!user) return;
    const userNotifications = getUserNotifications(user.id);
    setNotifications(userNotifications);
    setUnreadCount(getUnreadCount(user.id));
  }, [user, getUserNotifications, getUnreadCount]);

  // 실시간 알림 업데이트
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const userNotifications = getUserNotifications(user.id);
      setNotifications(userNotifications);
      setUnreadCount(getUnreadCount(user.id));
    }, 1000);
    return () => clearInterval(interval);
  }, [user, getUserNotifications, getUnreadCount]);

  // 세션 타이머 (1초마다 업데이트) — JWT 남은 유효시간 표시
  // 로그인 직후 60:00, 이후 매초 차감
  useEffect(() => {
    const computeSessionTime = () => getTokenRemainingTime(useAuthStore.getState().token);

    setSessionTime(computeSessionTime());
    const interval = setInterval(() => {
      setSessionTime(computeSessionTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
        setShowLanguageSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 세션 시간 포맷
  const formatSessionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 브레드크럼브 아이템 생성
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const path = location.pathname;
    const items: BreadcrumbItem[] = [];

    // 1. 항상 "홈"을 첫 번째에 대시보드 링크로 추가 (대시보드 페이지가 아닌 경우)
    if (path !== '/') {
      items.push({ label: t('home'), path: '/' });
    }

    // 2. 대시보드 페이지인 경우
    if (path === '/') {
      items.push({ label: t('home'), path: '/' });
      items.push({ label: t('dashboard') });
      return items;
    }

    // 2.5. 작업 추가 페이지 (projects/:id/tasks/new) 처리
    const taskNewMatch = path.match(/^\/projects\/(\d+)\/tasks\/new$/);
    if (taskNewMatch) {
      items.push({ label: t('projectsMenu'), path: '/projects' });
      items.push({ label: t('projectDetail'), path: `/projects/${taskNewMatch[1]}` });
      items.push({ label: t('addTask') });
      return items;
    }

    // 3. 등록 페이지 (new) 처리 - 부모 페이지도 포함
    if (newPageMappings[path]) {
      const mapping = newPageMappings[path];
      const parentLabel = pathLabels[mapping.parentPath];
      if (parentLabel) {
        if (pathParentCategory[mapping.parentPath]) {
          items.push({ label: t(pathParentCategory[mapping.parentPath]) });
        }
        items.push({ label: t(parentLabel), path: mapping.parentPath });
      }
      items.push({ label: t(mapping.labelKey) });
      return items;
    }

    // 4. 상세/수정 페이지 패턴 매칭
    for (const detail of detailPatterns) {
      if (detail.pattern.test(path)) {
        const parentPageLabel = pathLabels[detail.parentPath];
        if (parentPageLabel) {
          if (pathParentCategory[detail.parentPath]) {
            items.push({ label: t(pathParentCategory[detail.parentPath]) });
          }
          items.push({ label: t(parentPageLabel), path: detail.parentPath });
        }
        items.push({ label: t(detail.labelKey) });
        return items;
      }
    }

    // 5. 일반 페이지 - 현재 페이지 라벨만 추가 (상위 카테고리 포함)
    if (pathLabels[path]) {
      if (pathParentCategory[path]) {
        items.push({ label: t(pathParentCategory[path]) });
      }
      items.push({ label: t(pathLabels[path]) });
      return items;
    }

    // 6. 기본적으로 경로 세그먼트 기반 처리
    const segments = path.split('/').filter(Boolean);
    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      if (/^\d+$/.test(segment)) {
        items.push({ label: t('detail'), path: isLast ? undefined : currentPath });
      } else {
        const label = pathLabels[currentPath] || segment;
        items.push({ label: t(label), path: isLast ? undefined : currentPath });
      }
    });

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  // 알림 스타일
  const getNotificationStyle = (notification: any) => {
    const typeConfigs: Record<string, { color: string; bg: string }> = {
      maintenance_created: { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
      maintenance_assigned: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
      maintenance_status_changed: { color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
      maintenance_completed: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' },
      system_alert: { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
    };
    return typeConfigs[notification.type] || typeConfigs.system_alert;
  };

  // 시간 포맷
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('daysAgo', { count: diffDays });
    return new Date(date).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  // 알림 클릭 핸들러
  const handleNotificationClick = (notification: any) => {
    if (!user) return;
    markAsRead(notification.id);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
    setActiveDropdown(null);
  };

  const [isPageRefreshing, setIsPageRefreshing] = useState(false);
  const { triggerRefresh } = usePageRefresh();

  const handlePageRefresh = () => {
    setIsPageRefreshing(true);
    triggerRefresh(); // 콘텐츠 영역(Outlet)만 리마운트
    setTimeout(() => setIsPageRefreshing(false), 500);
  };

  const buttonHoverStyle = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  // 현재 테마 색상 가져오기
  const getThemeColor = (themeValue: Theme) => {
    switch (themeValue) {
      case 'light': return '#F6F8FA';
      case 'dark': return '#161B22';
      case 'yellow': return '#E3B341';
      default: return '#FFFFFF';
    }
  };

  return (
    <header
      className="backdrop-blur-lg sticky top-0 z-40"
      style={{
        backgroundColor: themeColors.background,
        borderBottom: `1px solid ${themeColors.border}`
      }}
    >
      <div className="flex items-center justify-between px-3 sm:px-6" style={{ height: '56px' }}>
        {/* 왼쪽: 탭 모드에서는 로고, 사이드바 모드에서는 모바일 메뉴 + 브레드크럼브 */}
        <div className="flex items-center gap-3">
          {layoutType === 'tabs' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateLayoutType('sidebar')}
                className="p-1 rounded transition-opacity hover:opacity-60"
                title={t('switchToSidebarMode')}
                style={{ color: themeColors.textSecondary }}
              >
                <ChevronLeft size={16} />
              </button>
              <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>
                유지보수사이트
              </h1>
            </div>
          ) : (
            <>
              {onMobileMenuToggle && (
                <button
                  onClick={onMobileMenuToggle}
                  className="md:hidden p-2 rounded-lg transition-colors"
                  style={{
                    color: themeColors.text,
                    backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'
                  }}
                >
                  <Menu size={20} />
                </button>
              )}
              <nav className="hidden sm:flex items-center space-x-1 text-sm">
                {breadcrumbItems.map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <ChevronRight
                        size={14}
                        style={{ color: themeColors.textSecondary }}
                        className="mx-1"
                      />
                    )}
                    {item.path ? (
                      <Link
                        to={item.path}
                        className="hover:underline transition-colors"
                        style={{ color: themeColors.textSecondary }}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        className={index === breadcrumbItems.length - 1 ? 'font-medium' : ''}
                        style={{ color: index === breadcrumbItems.length - 1 ? themeColors.text : themeColors.textSecondary }}
                      >
                        {item.label}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </>
          )}
        </div>

        {/* 오른쪽 영역 */}
        <div className="flex items-center gap-2" ref={dropdownRef}>
          {/* 세션 시간 */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
            style={{
              color: sessionTime < 300 ? '#EF4444' : themeColors.textSecondary,
              backgroundColor: sessionTime < 300 ? 'rgba(239, 68, 68, 0.1)' : 'transparent'
            }}
            title={t('remainingSessionTime')}
          >
            <Clock size={14} />
            <span className="font-mono">{formatSessionTime(sessionTime)}</span>
          </div>

          {/* 새로고침 */}
          <button
            onClick={handlePageRefresh}
            className="p-2 rounded-lg transition-all duration-200"
            style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}` }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={t('refresh') || '새로고침'}
          >
            <RefreshCw
              size={18}
              style={{
                transition: 'transform 0.3s ease',
                transform: isPageRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {/* 테마 토글 - 색상 스와치 */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'theme' ? null : 'theme')}
              className="p-2 rounded-lg transition-all duration-200"
              style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}` }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
              onMouseLeave={(e) => {
                if (activeDropdown !== 'theme') e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={t('theme')}
            >
              <div
                className="w-5 h-5 rounded-full"
                style={{
                  backgroundColor: getThemeColor(theme),
                  border: theme === 'light' ? '2px solid #B0B5F1' : theme === 'dark' ? '2px solid #64748B' : '2px solid #D97706',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.05)',
                }}
              />
            </button>
            {activeDropdown === 'theme' && (
              <div
                className="absolute right-0 mt-1 py-2 rounded-xl shadow-2xl overflow-hidden"
                style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, minWidth: '140px', zIndex: 9999 }}
              >
                {[
                  { value: 'light' as Theme, color: '#F6F8FA', label: t('light'), border: '#D0D7DE' },
                  { value: 'dark' as Theme, color: '#161B22', label: t('dark'), border: '#30363D' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { updateTheme(option.value); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors"
                    style={{
                      color: theme === option.value ? themeColors.primary : themeColors.text,
                      backgroundColor: theme === option.value ? `${themeColors.primary}10` : 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === option.value ? `${themeColors.primary}15` : buttonHoverStyle}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme === option.value ? `${themeColors.primary}10` : 'transparent'}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor: option.color,
                        border: `2px solid ${option.border}`
                      }}
                    />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 알림 */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'notifications' ? null : 'notifications')}
              className="relative p-2 rounded-lg transition-all duration-200"
              style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}` }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
              onMouseLeave={(e) => {
                if (activeDropdown !== 'notifications') e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={t('notifications')}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ fontSize: '10px' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {activeDropdown === 'notifications' && (
              <div
                className="absolute right-0 mt-1 rounded-xl shadow-2xl overflow-hidden"
                style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, maxHeight: '400px', minWidth: '320px', zIndex: 9999 }}
              >
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: themeColors.border }}>
                  <div className="flex items-center gap-2">
                    <Bell size={16} style={{ color: themeColors.primary }} />
                    <span className="font-semibold text-sm" style={{ color: themeColors.text }}>{t('notifications')}</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => user && markAllAsRead(user.id)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={t('markAllRead')}
                      >
                        <CheckCheck size={16} style={{ color: themeColors.textSecondary }} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: '300px' }}>
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" style={{ color: themeColors.textSecondary }} />
                      <p className="text-sm" style={{ color: themeColors.textSecondary }}>{t('noNotifications')}</p>
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notification) => {
                      const style = getNotificationStyle(notification);
                      return (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className="px-4 py-3 border-b cursor-pointer transition-colors"
                          style={{
                            borderColor: themeColors.border,
                            backgroundColor: notification.isRead ? 'transparent' : `${themeColors.primary}05`
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = notification.isRead ? 'transparent' : `${themeColors.primary}05`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: style.bg, width: 32, height: 32 }}
                            >
                              {notification.priority === 'high' ? (
                                <AlertCircle size={16} style={{ color: style.color }} />
                              ) : (
                                <Bell size={16} style={{ color: style.color }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: themeColors.text }}>
                                {notification.title}
                              </p>
                              <p className="text-xs truncate opacity-70" style={{ color: themeColors.textSecondary }}>
                                {notification.message}
                              </p>
                              <p className="text-xs mt-1 opacity-50" style={{ color: themeColors.textSecondary }}>
                                {formatTime(notification.createdAt)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                            >
                              <Trash2 size={14} style={{ color: '#EF4444' }} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 사용자 메뉴 */}
          <div className="relative">
            <button
              onClick={() => { setActiveDropdown(activeDropdown === 'user' ? null : 'user'); setShowLanguageSubmenu(false); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200"
              style={{
                backgroundColor: activeDropdown === 'user' ? buttonHoverStyle : 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
              onMouseLeave={(e) => {
                if (activeDropdown !== 'user') e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                <img
                  src={user?.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || '0'}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                  alt={user?.name || ''}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium leading-tight" style={{ color: themeColors.text }}>
                  {user?.name || t.user}
                </span>
                <span className="text-xs leading-tight" style={{ color: themeColors.textSecondary }}>
                  {user?.role === 'admin' ? t('superAdmin') : user?.role || ''}
                </span>
              </div>
              <ChevronDown
                size={14}
                style={{ color: themeColors.textSecondary }}
                className={`transition-transform duration-200 ${activeDropdown === 'user' ? 'rotate-180' : ''}`}
              />
            </button>
            {activeDropdown === 'user' && (
              <div
                className="absolute right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50"
                style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, minWidth: '240px' }}
              >
                {!showLanguageSubmenu ? (
                  <>
                    {/* 사용자 프로필 */}
                    <div className="p-4 text-center" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                      <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-3">
                        <img
                          src={user?.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || '0'}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                          alt={user?.name || ''}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: themeColors.text }}>
                        {user?.name || t.user}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>
                        {user?.role === 'admin' ? t('superAdmin') : user?.role || ''}
                      </p>
                    </div>

                    {/* 메뉴 옵션 */}
                    <div className="py-2">
                      {/* 언어 설정 */}
                      <button
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                        style={{ color: themeColors.text }}
                        onClick={() => setShowLanguageSubmenu(true)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="flex items-center gap-3">
                          <Globe size={16} style={{ color: themeColors.textSecondary }} />
                          <span>{t('language')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FlagImage country={language === 'ko' ? 'kr' : 'us'} size={16} />
                          <span style={{ fontSize: '0.8125rem', color: themeColors.textSecondary }}>
                            {language === 'ko' ? '한국어' : 'English'}
                          </span>
                          <ChevronRight size={12} style={{ color: themeColors.textSecondary }} />
                        </div>
                      </button>

                      {/* 설정 */}
                      <button
                        onClick={() => { navigate('/settings'); setActiveDropdown(null); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                        style={{ color: themeColors.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Settings size={16} style={{ color: themeColors.textSecondary }} />
                        <span>{t('settings')}</span>
                      </button>
                    </div>

                    {/* 로그아웃 */}
                    <div className="py-2" style={{ borderTop: `1px solid ${themeColors.border}` }}>
                      <button
                        onClick={() => { setActiveDropdown(null); logout(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                        style={{ color: themeColors.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <LogOut size={16} style={{ color: themeColors.textSecondary }} />
                        <span>{t('logout')}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 언어 선택 패널 */}
                    <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                      <button
                        className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                        style={{ color: themeColors.textSecondary }}
                        onClick={() => setShowLanguageSubmenu(false)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = buttonHoverStyle}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-medium" style={{ color: themeColors.text }}>{t('language')}</span>
                    </div>
                    <div className="py-2">
                      {([{ value: 'ko', label: '한국어', country: 'kr' }, { value: 'en', label: 'English', country: 'us' }] as { value: Language; label: string; country: 'kr' | 'us' }[]).map((lang) => {
                        const isActive = language === lang.value;
                        return (
                          <button
                            key={lang.value}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                            style={{ color: isActive ? themeColors.primary : themeColors.text, backgroundColor: isActive ? `${themeColors.primary}0E` : 'transparent' }}
                            onClick={() => { updateLanguage(lang.value as Language); setShowLanguageSubmenu(false); setActiveDropdown(null); }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = buttonHoverStyle; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <div className="flex items-center gap-3">
                              <FlagImage country={lang.country} size={16} />
                              <span style={{ fontWeight: isActive ? 600 : 400 }}>{lang.label}</span>
                            </div>
                            {isActive && <Check size={14} style={{ color: themeColors.primary }} />}
                          </button>
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
    </header>
  );
};

export default Header;
