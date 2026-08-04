import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { themeConfigs } from '../../utils/themeConfig';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => {
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: `${themeColors.primary}15` }}
      >
        <Icon size={40} style={{ color: themeColors.primary }} className="opacity-60" />
      </div>
      <h3
        className="text-xl font-semibold mb-2 text-center"
        style={{ color: themeColors.text }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-center mb-6 max-w-md"
          style={{ color: themeColors.textSecondary }}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 rounded-xl font-medium text-white transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
