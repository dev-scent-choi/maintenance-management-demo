import React from 'react';
import { ShieldOff } from 'lucide-react';
import { usePermission } from '../hooks/usePermission';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import type { Permission } from '../utils/permissions';
import { useLanguage } from '../contexts/LanguageContext';

interface ProtectedComponentProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean; // true면 모든 권한 필요, false면 하나만 있어도 됨
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  permission,
  permissions,
  requireAll = false,
  fallback,
  children,
}) => {
  const { can, canAny, canAll } = usePermission();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const t = useLanguage();

  let hasAccess = false;

  if (permission) {
    hasAccess = can(permission);
  } else if (permissions) {
    hasAccess = requireAll ? canAll(permissions) : canAny(permissions);
  } else {
    // 권한 지정이 없으면 접근 허용
    hasAccess = true;
  }

  if (!hasAccess) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <ShieldOff size={48} className="mx-auto mb-4 opacity-30" style={{ color: themeColors.textSecondary }} />
          <p className="text-sm font-medium" style={{ color: themeColors.text }}>
            {t('accessDenied')}
          </p>
          <p className="text-xs mt-2" style={{ color: themeColors.textSecondary }}>
            {t('noPermissionDesc')}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedComponent;
