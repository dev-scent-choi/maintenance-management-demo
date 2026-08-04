import { useAuthStore } from '../store/authStore';
import { usePermissionStore } from '../store/permissionStore';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAdminAccount,
  type Permission,
} from '../utils/permissions';

export const usePermission = () => {
  const user = useAuthStore((state) => state.user);

  // permissionStore 구독 — 권한 로드/변경 시 이 훅을 사용하는 컴포넌트 즉시 재렌더링
  // (미구독 시: fetchPermissions 완료 후 can()/canAny() 결과가 반영되지 않음)
  usePermissionStore((state) => state.rolePermissions);

  const isAdmin = isAdminAccount(user);

  return {
    can:    (permission: Permission)    => hasPermission(user, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),
    canAll: (permissions: Permission[]) => hasAllPermissions(user, permissions),
    isAdmin,
    isUser: !isAdmin && user?.role === 'user',
  };
};
