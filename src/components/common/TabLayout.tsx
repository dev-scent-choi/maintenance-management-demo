import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { PageRefreshProvider, usePageRefresh } from '../../contexts/PageRefreshContext';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { themeConfigs } from '../../utils/themeConfig';
import { hasPermission, isAdminAccount } from '../../utils/permissions';
import { menuItems as allMenuItems } from '../../config/menuItems';
import { usePermissionStore } from '../../store/permissionStore';
import Header from './Header';

const TabLayoutContent: React.FC = () => {
  const { refreshKey } = usePageRefresh();
  const { user } = useAuthStore();
  const t = useLanguage();
  const { settings } = useSettingsStore();
  const { theme } = settings;
  const themeColors = themeConfigs[theme];

  // permissionStore 구독 — DB 권한 변경 시 자동 리렌더링
  usePermissionStore(state => state.rolePermissions);

  const menuItems = allMenuItems.filter(item => {
    if (item.adminOnly || item.allowedLoginIds) {
      const isAdmin = isAdminAccount(user);
      const loginId = user?.email?.split('@')[0] ?? '';
      const isAllowed = item.allowedLoginIds?.includes(loginId) ?? false;
      if (!isAdmin && !isAllowed) return false;
    }
    return hasPermission(user, item.permission);
  });

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: themeColors.background }}>
      {/* 공유 헤더 (로고 + 우측 메뉴) */}
      <Header key={theme} />

      {/* 탭 메뉴 */}
      <div
        className="relative z-30 backdrop-blur-lg"
        style={{
          backgroundColor: theme === 'dark' ? themeColors.surface : `${themeColors.surface}CC`,
          borderBottom: `1px solid ${themeColors.border}`,
        }}
      >
        <div className="px-6">
          <nav className="flex space-x-1 pt-2 pb-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                style={({ isActive }) => ({
                  color: isActive ? themeColors.primary : themeColors.textSecondary,
                  borderBottom: `2px solid ${isActive ? themeColors.primary : 'transparent'}`,
                  marginBottom: '-1px',
                  fontWeight: isActive ? '600' : '500',
                  backgroundColor: 'transparent',
                })}
                className="flex items-center space-x-2 px-4 py-3 transition-colors duration-150"
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={16} style={{ color: isActive ? themeColors.primary : themeColors.textSecondary }} />
                    <span className="text-sm">{t(item.labelKey)}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto p-6 relative z-10">
        <div className="max-w-[95%] mx-auto h-full">
          <Outlet key={refreshKey} />
        </div>
      </main>
    </div>
  );
};

const TabLayout: React.FC = () => (
  <PageRefreshProvider>
    <TabLayoutContent />
  </PageRefreshProvider>
);

export default TabLayout;
