import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';

interface MobileStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

const MobileStatCard: React.FC<MobileStatCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  trend,
  onClick
}) => {
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const t = useLanguage();

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
      style={{
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs font-medium mb-1" style={{ color: themeColors.textSecondary }}>
            {title}
          </div>
          <div className="text-2xl font-bold mb-1" style={{ color: themeColors.text }}>
            {value}
          </div>
          {subtitle && (
            <div className="text-xs" style={{ color: themeColors.textSecondary }}>
              {subtitle}
            </div>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className="text-xs font-medium"
                style={{ color: trend.isPositive ? '#10B981' : '#EF4444' }}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs" style={{ color: themeColors.textSecondary }}>
                {t('vsLastMonth')}
              </span>
            </div>
          )}
        </div>
        <div
          className="flex items-center justify-center w-12 h-12 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={24} style={{ color }} />
        </div>
      </div>
    </div>
  );
};

export default MobileStatCard;
