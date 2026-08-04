import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { themeConfigs } from '../../utils/themeConfig';
import { hasPermission, isAdminAccount } from '../../utils/permissions';
import { menuSections, sectionLabels } from '../../config/menuItems';
import { usePageRefresh } from '../../contexts/PageRefreshContext';
import { usePermissionStore } from '../../store/permissionStore';

interface SidebarProps {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose, collapsed = false, onToggleCollapse }) => {
  const t = useLanguage();
  const { user } = useAuthStore();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const location = useLocation();
  const { triggerRefresh } = usePageRefresh();

  // permissionStore 구독 — DB 권한 변경 시 자동 리렌더링
  usePermissionStore(state => state.rolePermissions);

  const filteredSections = menuSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.adminOnly || item.allowedLoginIds) {
          const isAdmin = isAdminAccount(user);
          const loginId = user?.email?.split('@')[0] ?? '';
          const isAllowed = item.allowedLoginIds?.includes(loginId) ?? false;
          if (!isAdmin && !isAllowed) return false;
        }
        return hasPermission(user, item.permission);
      })
    }))
    .filter(section => section.items.length > 0);

  return (
    <div
      className="flex flex-col h-full transition-all duration-200"
      style={{
        width: collapsed ? '52px' : '256px',
        background: themeColors.sidebarBg,
        color: themeColors.sidebarText,
        borderRight: `1px solid ${themeColors.border}`,
        overflow: 'hidden',
      }}
    >
      {/* 로고 헤더 */}
      <div
        className="flex items-center justify-between flex-shrink-0 relative"
        style={{ borderBottom: `1px solid ${themeColors.border}`, height: '57px', padding: collapsed ? '0 0 0 14px' : '0 12px 0 24px' }}
      >
        {!collapsed && (
          <h1 className="text-sm font-bold whitespace-nowrap truncate" style={{ color: themeColors.text }}>
            유지보수사이트
          </h1>
        )}
        {/* 토글 버튼 (데스크톱) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex items-center justify-center w-6 h-6 rounded transition-opacity hover:opacity-70 flex-shrink-0"
            style={{ color: themeColors.sidebarText, marginLeft: collapsed ? '0' : '4px' }}
            title={collapsed ? t('openSidebar') : t('closeSidebar')}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: themeColors.sidebarText, backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)' }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
        {filteredSections.map((section, sectionIndex) => (
          <div key={section.sectionKey} className={sectionIndex > 0 ? 'mt-6' : ''}>
            {/* 섹션 라벨 */}
            {section.sectionKey !== 'work' && !collapsed && (
              <div className="px-4 mb-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}
                >
                  {t(sectionLabels[section.sectionKey]) || section.sectionKey}
                </span>
              </div>
            )}

            <ul className="space-y-1" style={{ padding: collapsed ? '0 6px' : '0 12px' }}>
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={(e) => {
                      const isExactMatch = item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname === item.path;
                      if (isExactMatch) {
                        e.preventDefault();
                        triggerRefresh();
                      }
                      onClose?.();
                    }}
                    className="flex items-center rounded-lg transition-all duration-200 relative"
                    style={({ isActive }) => ({
                      padding: collapsed ? '9px 10px' : '9px 12px',
                      gap: collapsed ? '0' : '12px',
                      background: isActive
                        ? (theme === 'light' ? 'rgba(55, 53, 47, 0.08)' : 'rgba(177, 186, 196, 0.12)')
                        : 'transparent',
                      color: isActive ? themeColors.primary : themeColors.sidebarText,
                      fontWeight: isActive ? '500' : 'normal',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                    })}
                    onMouseEnter={(e) => {
                      const link = e.currentTarget;
                      const isActive = link.getAttribute('aria-current') === 'page';
                      if (!isActive) link.style.background = theme === 'light' ? 'rgba(55, 53, 47, 0.05)' : 'rgba(177, 186, 196, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      const link = e.currentTarget;
                      const isActive = link.getAttribute('aria-current') === 'page';
                      if (!isActive) link.style.background = 'transparent';
                      else link.style.background = theme === 'light' ? 'rgba(55, 53, 47, 0.08)' : 'rgba(177, 186, 196, 0.12)';
                    }}
                    title={collapsed ? t(item.labelKey) : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !collapsed && (
                          <div className="absolute left-0 top-1.5 bottom-1.5 rounded-r" style={{ width: '2px', backgroundColor: themeColors.primary }} />
                        )}
                        <div style={{ color: isActive ? themeColors.primary : themeColors.sidebarText, opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>
                          <item.icon size={17} />
                        </div>
                        {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{t(item.labelKey)}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* 버전 정보 */}
      {!collapsed && (
        <div className="px-4 py-3" style={{ borderTop: `1px solid ${themeColors.border}` }}>
          <p className="text-xs" style={{ color: theme === 'light' ? 'rgba(55,53,47,0.35)' : 'rgba(255,255,255,0.25)' }}>v1.1.0</p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
