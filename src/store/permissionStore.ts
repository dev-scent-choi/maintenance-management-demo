import { create } from 'zustand';
import { DEFAULT_ROLE_PERMISSIONS, type Permission } from '../utils/permissions';
import { apiGet, apiPut } from '../utils/apiClient';

export interface RoleInfo {
  id: string;
  name: string;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PermissionState {
  rolePermissions: Record<string, Permission[]>;
  roles: RoleInfo[];
  loaded: boolean;
  fetchPermissions: () => Promise<void>;
  saveAll: (permissions: Record<string, Permission[]>, roles: RoleInfo[]) => Promise<void>;
  reset: () => void;
}

const DEFAULT_ROLES: RoleInfo[] = [
  { id: 'admin', name: '관리자',      isSystem: true },
  { id: 'user',  name: '일반 사용자', isSystem: true },
];

export const usePermissionStore = create<PermissionState>()((set) => ({
  rolePermissions: { ...DEFAULT_ROLE_PERMISSIONS },
  roles: DEFAULT_ROLES,
  loaded: false,

  fetchPermissions: async () => {
    try {
      const response = await apiGet(import.meta.env.VITE_API_URL + '/role-permissions');
      if (!response.ok) throw new Error('permission fetch failed');
      const data = await response.json();
      set({
        rolePermissions: data.permissions ?? { ...DEFAULT_ROLE_PERMISSIONS },
        roles: data.roles ?? DEFAULT_ROLES,
        loaded: true,
      });
    } catch (err) {
      console.warn('[permissionStore] API 조회 실패, 기본값 사용:', err);
      set({ loaded: true });
    }
  },

  saveAll: async (permissions, roles) => {
    const response = await apiPut(
      import.meta.env.VITE_API_URL + '/role-permissions',
      { permissions, roles },
    );
    if (!response.ok) throw new Error('permission save failed');
    set({ rolePermissions: permissions, roles });
  },

  reset: () => set({
    rolePermissions: { ...DEFAULT_ROLE_PERMISSIONS },
    roles: DEFAULT_ROLES,
    loaded: false,
  }),
}));
