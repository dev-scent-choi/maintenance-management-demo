import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, List, Settings, Plus } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useSettingsStore((state) => state.settings.theme);
  const { user } = useAuthStore();
  const t = useLanguage();
  const themeColors = themeConfigs[theme];

  const navItems = [
    { path: '/', icon: Home, label: t('home') },
    { path: '/maintenance', icon: List, label: t('list') },
    { path: '/maintenance/new', icon: Plus, label: t('register'), isPrimary: true },
    { path: '/maintenance/calendar', icon: Calendar, label: t('calendar') },
    { path: '/settings', icon: Settings, label: t('settings') },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t"
      style={{
        backgroundColor: themeColors.surface,
        borderTopColor: themeColors.border,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
      }}
    >
      <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          if (item.isPrimary) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center p-2 transition-transform active:scale-90"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
                  }}
                >
                  <Icon size={24} className="text-white" />
                </div>
                <span
                  className="text-xs mt-1 font-medium"
                  style={{ color: themeColors.primary }}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center p-2 min-w-[60px] transition-all active:scale-95"
            >
              <Icon
                size={22}
                style={{
                  color: active ? themeColors.primary : themeColors.textSecondary,
                }}
              />
              <span
                className="text-xs mt-1"
                style={{
                  color: active ? themeColors.primary : themeColors.textSecondary,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
