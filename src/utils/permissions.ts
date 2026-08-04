import type { User } from '../types';
// 순환 의존 주의: permissionStore → permissions (DEFAULT_ROLE_PERMISSIONS)
//                permissions → permissionStore (getRolePermissions 함수 내부에서만 접근)
// ESModules live binding 특성상 런타임에서는 안전하게 동작합니다.
import { usePermissionStore } from '../store/permissionStore';

// ── 권한 타입 정의 ────────────────────────────────────────────────
export type Permission =
  | 'view_weekly_report'
  | 'view_dashboard'
  | 'view_companies'
  | 'create_companies'
  | 'update_companies'
  | 'delete_companies'
  | 'view_maintenance'
  | 'create_maintenance'
  | 'update_maintenance'
  | 'delete_maintenance'
  | 'view_users'
  | 'create_users'
  | 'update_users'
  | 'delete_users'
  | 'view_collaboration'
  | 'create_collaboration'
  | 'update_collaboration'
  | 'delete_collaboration'
  | 'view_projects'
  | 'create_projects'
  | 'update_projects'
  | 'delete_projects'
  | 'view_roles'
  | 'view_audit_logs'
  | 'export_data'
  | 'manage_settings'
  | 'download_files'
  | 'upload_files'
  | 'delete_files';

// ── 기본 권한 (DB 미연결 시 폴백) ────────────────────────────────
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'view_weekly_report', 'view_dashboard',
    'view_companies',    'create_companies',  'update_companies',  'delete_companies',
    'view_maintenance',  'create_maintenance','update_maintenance','delete_maintenance',
    'view_users',        'create_users',      'update_users',      'delete_users',
    'view_collaboration','create_collaboration','update_collaboration','delete_collaboration',
    'view_projects',     'create_projects',   'update_projects',   'delete_projects',
    'view_roles', 'view_audit_logs', 'export_data', 'manage_settings',
    'download_files', 'upload_files', 'delete_files',
  ],
  user: [
    'view_weekly_report', 'view_dashboard',
    'view_companies',
    'view_maintenance',   'create_maintenance', 'update_maintenance',
    'view_collaboration', 'create_collaboration',
    'view_projects',      'create_projects',    'update_projects',
    'download_files',     'upload_files',
  ],
};

// ── 현재 역할별 권한 반환 (DB store → 폴백: 기본값) ────────────
export const getRolePermissions = (): Record<string, Permission[]> => {
  try {
    const { rolePermissions, loaded } = usePermissionStore.getState();
    if (loaded) return rolePermissions;
  } catch {
    // store 미초기화 시 기본값 사용
  }
  return { ...DEFAULT_ROLE_PERMISSIONS };
};

// ── admin 계정 판별 ───────────────────────────────────────────────
export const isAdminAccount = (user: User | null | undefined): boolean => {
  if (!user) return false;
  const fromId    = (user.id    ?? '').split('@')[0].toLowerCase();
  const fromEmail = (user.email ?? '').split('@')[0].toLowerCase();
  return fromId === 'admin' || fromEmail === 'admin' || user.role === 'admin';
};

// ── 권한 확인 함수 ────────────────────────────────────────────────
export const hasPermission = (user: User | null, permission: Permission): boolean => {
  if (!user) return false;
  if (isAdminAccount(user)) return true;
  const perms = getRolePermissions();
  return (perms[user.role] as Permission[] | undefined)?.includes(permission) ?? false;
};

export const hasAnyPermission = (user: User | null, permissions: Permission[]): boolean => {
  if (!user) return false;
  if (isAdminAccount(user)) return true;
  return permissions.some((p) => hasPermission(user, p));
};

export const hasAllPermissions = (user: User | null, permissions: Permission[]): boolean => {
  if (!user) return false;
  if (isAdminAccount(user)) return true;
  return permissions.every((p) => hasPermission(user, p));
};

// ── 메뉴×기능 매트릭스 메타데이터 ────────────────────────────────
export type ActionType = 'view' | 'create' | 'update' | 'delete' | 'export';

export interface MenuDef {
  key: string;
  label: string;
  labelKey: string;
  icon: string;
  actions: ActionType[];
  permissionMap: Partial<Record<ActionType, Permission>>;
}

export const MENU_DEFINITIONS: MenuDef[] = [
  { key: 'dashboard',    label: '대시보드',   labelKey: 'dashboard',       icon: 'LayoutDashboard', actions: ['view'],                             permissionMap: { view: 'view_dashboard' } },
  { key: 'companies',    label: '업체',       labelKey: 'companyManagement',icon: 'Building2',       actions: ['view','create','update','delete','export'], permissionMap: { view: 'view_companies', create: 'create_companies', update: 'update_companies', delete: 'delete_companies', export: 'export_data' } },
  { key: 'maintenance',  label: '유지보수',   labelKey: 'maintenance',     icon: 'Wrench',          actions: ['view','create','update','delete','export'], permissionMap: { view: 'view_maintenance', create: 'create_maintenance', update: 'update_maintenance', delete: 'delete_maintenance', export: 'export_data' } },
  { key: 'projects',     label: '프로젝트',   labelKey: 'projectsMenu',    icon: 'FolderKanban',    actions: ['view','create','update','delete'],          permissionMap: { view: 'view_projects', create: 'create_projects', update: 'update_projects', delete: 'delete_projects' } },
  { key: 'weekly_report',label: '주간보고',   labelKey: 'weeklyReport',    icon: 'FileBarChart',    actions: ['view'],                             permissionMap: { view: 'view_weekly_report' } },
  { key: 'collaboration',label: '채팅',       labelKey: 'collaboration',   icon: 'MessageSquare',   actions: ['view','create','update','delete'],          permissionMap: { view: 'view_collaboration', create: 'create_collaboration', update: 'update_collaboration', delete: 'delete_collaboration' } },
  { key: 'users',        label: '사용자',     labelKey: 'userManagement',  icon: 'Users',           actions: ['view','create','update','delete'],          permissionMap: { view: 'view_users', create: 'create_users', update: 'update_users', delete: 'delete_users' } },
  { key: 'roles',        label: '권한',       labelKey: 'rolesMenu',       icon: 'ShieldCheck',     actions: ['view'],                             permissionMap: { view: 'view_roles' } },
  { key: 'audit_logs',   label: '로그',       labelKey: 'logs',            icon: 'ClipboardList',   actions: ['view'],                             permissionMap: { view: 'view_audit_logs' } },
  { key: 'settings',     label: '설정',       labelKey: 'settings',        icon: 'Settings2',       actions: ['view'],                             permissionMap: { view: 'manage_settings' } },
];

export interface FilePermDef {
  permission: Permission;
  label: string;
  description: string;
}

export const FILE_PERMISSION_DEFS: FilePermDef[] = [
  { permission: 'download_files', label: '파일 다운로드', description: '첨부파일을 다운로드할 수 있습니다' },
  { permission: 'upload_files',   label: '파일 업로드',   description: '첨부파일을 업로드·추가할 수 있습니다' },
  { permission: 'delete_files',   label: '파일 삭제',     description: '첨부파일을 삭제할 수 있습니다' },
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_weekly_report: '주간보고 조회',    view_dashboard: '대시보드 조회',
  view_companies:     '업체 조회',        create_companies:  '업체 생성',    update_companies:  '업체 수정',    delete_companies:  '업체 삭제',
  view_maintenance:   '유지보수 조회',    create_maintenance:'유지보수 생성',update_maintenance:'유지보수 수정',delete_maintenance:'유지보수 삭제',
  view_users:         '사용자 조회',      create_users:      '사용자 생성',  update_users:      '사용자 수정',  delete_users:      '사용자 삭제',
  view_collaboration: '협업 채널 조회',   create_collaboration:'협업 채널 생성', update_collaboration:'협업 메시지 작성', delete_collaboration:'협업 채널 삭제',
  view_projects:      '프로젝트 조회',    create_projects:   '프로젝트 생성',update_projects:   '프로젝트 수정',delete_projects:   '프로젝트 삭제',
  view_roles:         '권한 관리 조회',   view_audit_logs:   '로그 조회',
  export_data:        '데이터 내보내기',  manage_settings:   '설정 관리',
  download_files:     '파일 다운로드',    upload_files:      '파일 업로드',  delete_files: '파일 삭제',
};
