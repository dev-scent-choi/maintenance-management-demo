import {
  LayoutDashboard,
  Building2,
  Settings,
  Wrench,
  Users,
  Shield,
  UserCog,
  MessageSquare,
  FolderOpen,
  ClipboardList,
  ScanText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Permission } from '../utils/permissions';

export interface MenuItem {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  permission: Permission;
  adminOnly?: boolean;
  allowedLoginIds?: string[]; // admin이 아니어도 접근 허용할 loginId 목록
}

export interface MenuSection {
  sectionKey: string;
  items: MenuItem[];
}

// 그룹화된 메뉴 구조
export const menuSections: MenuSection[] = [
  {
    sectionKey: 'work',
    items: [
      { icon: LayoutDashboard, labelKey: 'dashboard', path: '/', permission: 'view_dashboard' },
      { icon: Building2, labelKey: 'companyManagement', path: '/companies', permission: 'view_companies' },
      { icon: Wrench, labelKey: 'maintenance', path: '/maintenance', permission: 'view_maintenance' },
      { icon: FolderOpen, labelKey: 'projectsMenu', path: '/projects', permission: 'view_projects' },
      { icon: MessageSquare, labelKey: 'collaboration', path: '/collaboration', permission: 'view_collaboration' },
      // { icon: ClipboardList, labelKey: 'weeklyReport', path: '/weekly-report', permission: 'view_weekly_report' },
      // { icon: ScanText, labelKey: 'pdfOcr', path: '/pdf-ocr', permission: 'view_dashboard', adminOnly: true },
    ]
  },
  {
    sectionKey: 'admin',
    items: [
      { icon: Users, labelKey: 'userManagement', path: '/users', permission: 'view_users' },
      { icon: UserCog, labelKey: 'rolesMenu', path: '/roles', permission: 'view_roles' },
      { icon: Shield, labelKey: 'logs', path: '/audit-logs', permission: 'view_audit_logs' },
    ]
  },
  {
    sectionKey: 'system',
    items: [
      { icon: Settings, labelKey: 'settings', path: '/settings', permission: 'manage_settings' },
    ]
  }
];

// 기존 호환성을 위한 flat 메뉴 아이템
export const menuItems: MenuItem[] = menuSections.flatMap(section => section.items);

// 섹션 라벨 매핑
export const sectionLabels: Record<string, string> = {
  work: 'sectionWork',
  admin: 'sectionAdmin',
  system: 'sectionSystem',
};

// 브레드크럼브용 섹션 매핑 (경로 -> 섹션키)
export const pathToSection: Record<string, string> = {
  '/': 'work',
  '/companies': 'work',
  '/maintenance': 'work',
  '/projects': 'work',
  '/weekly-report': 'work',
  '/collaboration': 'work',
  '/pdf-ocr': 'work',
  '/users': 'admin',
  '/roles': 'admin',
  '/audit-logs': 'admin',
  '/settings': 'system',
};

// 브레드크럼브 부모 라벨 (섹션별)
export const breadcrumbParentLabels: Record<string, string> = {
  work: 'home',
  admin: 'sectionAdmin',
  system: 'sectionSystem',
};
