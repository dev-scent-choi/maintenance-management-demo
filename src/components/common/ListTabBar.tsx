import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { themeConfigs } from '../../utils/themeConfig';

export interface ListTab {
  key: string;
  label: string;
  count?: number;
  /** Optional override for active color (e.g. status-colored tabs in MaintenanceList) */
  color?: string;
  isActive: boolean;
  onClick: () => void;
}

interface ListTabBarProps {
  tabs: ListTab[];
  className?: string;
}

/**
 * Unified tab bar for all list pages.
 * Renders a flex container with bottom border containing underline-style tab buttons.
 */
const ListTabBar: React.FC<ListTabBarProps> = ({ tabs, className }) => {
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const isDark = theme !== 'light';

  return (
    <div
      className={`flex items-center gap-1 overflow-x-auto${className ? ` ${className}` : ''}`}
      style={{ borderBottom: `1px solid ${themeColors.border}` }}
    >
      {tabs.map((tab) => {
        const activeColor = tab.color || themeColors.primary;
        const badgeText = tab.isActive
          ? (tab.color ? '#fff' : (theme === 'yellow' ? '#333333' : '#fff'))
          : themeColors.textSecondary;

        return (
          <button
            key={tab.key}
            onClick={tab.onClick}
            className="relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all flex-shrink-0"
            style={{ color: tab.isActive ? activeColor : themeColors.textSecondary }}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className="min-w-[18px] h-[18px] px-1 rounded text-[11px] font-semibold flex items-center justify-center"
                style={{
                  backgroundColor: tab.isActive
                    ? activeColor
                    : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                  color: badgeText,
                }}
              >
                {tab.count}
              </span>
            )}
            {tab.isActive && (
              <span
                className="absolute bottom-0 left-3 right-3 h-0.5"
                style={{ backgroundColor: activeColor }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ListTabBar;
