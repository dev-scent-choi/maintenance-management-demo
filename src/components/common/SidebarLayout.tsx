import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileBottomNav from '../MobileBottomNav';
import { useSettingsStore } from '../../store/settingsStore';
import { themeConfigs } from '../../utils/themeConfig';
import { PageRefreshProvider, usePageRefresh } from '../../contexts/PageRefreshContext';

const SidebarContent: React.FC<{ isMobileMenuOpen: boolean; setIsMobileMenuOpen: (v: boolean) => void }> = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const { refreshKey } = usePageRefresh();
  const location = useLocation();
  const isFullBleed = location.pathname.startsWith('/collaboration');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className="flex h-screen relative overflow-hidden"
      style={{ backgroundColor: themeColors.background }}
    >
      {/* Desktop Sidebar */}
      <div className="hidden md:block flex-shrink-0">
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} />
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header
          key={theme}
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <main
          className={`flex-1 ${isFullBleed ? 'overflow-hidden' : 'overflow-y-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6'}`}
          style={{ backgroundColor: themeColors.background }}
        >
          <div className={isFullBleed ? 'h-full' : 'max-w-[95%] mx-auto h-full'}>
            {/* refreshKey가 변경되면 현재 페이지 컴포넌트만 리마운트 */}
            <Outlet key={refreshKey} />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
};

const SidebarLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <PageRefreshProvider>
      <SidebarContent
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
    </PageRefreshProvider>
  );
};

export default SidebarLayout;
