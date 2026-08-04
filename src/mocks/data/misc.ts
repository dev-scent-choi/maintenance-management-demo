import { usersData } from './users';
import { companiesData } from './companies';
import { maintenanceData } from './maintenance';

// ── 감사 로그 ──────────────────────────────────────────────────────
export interface MockAuditLog {
  id: number;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'download' | 'upload';
  resourceType: 'user' | 'company' | 'maintenance' | 'project' | 'file' | 'system';
  resourceId?: string;
  resourceName?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
}

const actions: MockAuditLog['action'][] = ['login', 'create', 'update', 'view', 'download', 'logout'];
let auditId = 1;
export const auditLogsData: MockAuditLog[] = [];
for (let i = 0; i < 24; i++) {
  const user = usersData[i % usersData.length];
  const action = actions[i % actions.length];
  const month = 1 + (i % 7);
  const day = 2 + (i % 26);
  const company = companiesData[i % companiesData.length];
  auditLogsData.push({
    id: auditId++,
    timestamp: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
    userId: user.id,
    userName: user.name,
    action,
    resourceType: (['maintenance', 'company', 'user', 'project', 'system'] as const)[i % 5],
    resourceId: String((i % 10) + 1),
    resourceName: company.name,
    details: `${user.name}님이 ${company.name} 관련 작업을 수행했습니다.`,
    ipAddress: `192.168.10.${10 + (i % 40)}`,
    userAgent: 'Mozilla/5.0',
  });
}

// ── 권한 (역할 기반) ──────────────────────────────────────────────
export const rolesData = [
  { id: 'admin', name: '관리자', isSystem: true },
  { id: 'user', name: '일반 사용자', isSystem: true },
];

// ── 보고서 템플릿 ─────────────────────────────────────────────────
export const reportTemplatesData = [
  {
    id: 'tpl-1',
    name: '월간 유지보수 현황',
    description: '월별 유지보수 처리 현황 요약',
    columns: JSON.stringify([
      { key: 'companyName', label: '업체명', order: 1 },
      { key: 'status', label: '상태', order: 2 },
      { key: 'assignedTo', label: '담당자', order: 3 },
    ]),
    defaultFilters: JSON.stringify({ action: null, resourceType: 'maintenance' }),
    aggregations: JSON.stringify([{ groupBy: 'status', metric: 'COUNT', label: '상태별 건수' }]),
    isShared: true,
    createdBy: 'admin@maintenance-site.com',
    createdByName: '관리자',
    createdAt: '2026-01-05T09:00:00',
    updatedAt: '2026-01-05T09:00:00',
  },
  {
    id: 'tpl-2',
    name: '업체별 계약 현황',
    description: '업체별 유지보수 계약 상태',
    columns: JSON.stringify([
      { key: 'name', label: '업체명', order: 1 },
      { key: 'contractStatus', label: '계약상태', order: 2 },
    ]),
    defaultFilters: JSON.stringify({}),
    aggregations: JSON.stringify([]),
    isShared: false,
    createdBy: 'admin@maintenance-site.com',
    createdByName: '관리자',
    createdAt: '2026-02-01T09:00:00',
    updatedAt: '2026-02-01T09:00:00',
  },
];

// ── 협업 채널 / 메시지 (간단 정적 샘플) ────────────────────────────
export const channelsData = [
  {
    id: 1,
    name: '전체 공지',
    description: '전사 공지 채널',
    type: 'PUBLIC',
    projectId: null,
    companyId: null,
    memberIds: usersData.map((u) => u.id),
    createdBy: 'admin@maintenance-site.com',
    createdAt: '2026-01-02T09:00:00',
    updatedAt: '2026-08-01T09:00:00',
    lastMessageAt: '2026-08-01T09:00:00',
    isArchived: false,
    pinnedMessages: [],
  },
  {
    id: 2,
    name: '유지보수팀',
    description: '유지보수팀 업무 채널',
    type: 'PRIVATE',
    projectId: null,
    companyId: null,
    memberIds: usersData.filter((u) => u.department === '유지보수팀').map((u) => u.id),
    createdBy: 'dohyun.kim@maintenance-site.com',
    createdAt: '2026-01-03T09:00:00',
    updatedAt: '2026-07-20T09:00:00',
    lastMessageAt: '2026-07-20T09:00:00',
    isArchived: false,
    pinnedMessages: [],
  },
];

export const messagesByChannel: Record<number, any[]> = {
  1: [
    { id: 1, channelId: 1, content: '2026년 상반기 유지보수 정책 안내드립니다.', senderId: 'admin@maintenance-site.com', senderName: '관리자', createdAt: '2026-01-02T09:10:00', isEdited: false, isPinned: true, isDeleted: false, mentions: [] },
    { id: 2, channelId: 1, content: '확인했습니다!', senderId: 'dohyun.kim@maintenance-site.com', senderName: '김도현', createdAt: '2026-01-02T09:20:00', isEdited: false, isPinned: false, isDeleted: false, mentions: [] },
  ],
  2: [
    { id: 3, channelId: 2, content: '한빛물류 건 오늘 중 처리 부탁드립니다.', senderId: 'dohyun.kim@maintenance-site.com', senderName: '김도현', createdAt: '2026-07-20T09:00:00', isEdited: false, isPinned: false, isDeleted: false, mentions: [] },
  ],
};

export const maintenanceCompanyIndex = maintenanceData; // re-export for convenience
