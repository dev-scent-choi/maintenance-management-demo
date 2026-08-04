import { companiesData } from './companies';
import { usersData } from './users';

const devUsers = usersData.filter((u) => u.department === '개발팀' || u.department === '유지보수팀' || u.department === '인프라팀');

export interface MockProject {
  id: number;
  name: string;
  description: string;
  status: 'PLANNING' | 'ACTIVE' | 'HOLD' | 'COMPLETED' | 'CANCELLED';
  progress: number;
  companyId: number;
  companyName: string;
  managerId: string;
  managerName: string;
  members: string[];
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

const projectNames = [
  '물류관리시스템 고도화', '식자재 ERP 리뉴얼', '건설현장 관리 앱 구축', '병원 예약시스템 개선',
  '금융권 보안 인프라 강화', 'POS 통합관리 2단계', '해운 물류 트래킹 구축', '사내 그룹웨어 전환',
];
const statusCycle: MockProject['status'][] = ['ACTIVE', 'ACTIVE', 'PLANNING', 'ACTIVE', 'HOLD', 'ACTIVE', 'COMPLETED', 'ACTIVE'];

export const projectsData: MockProject[] = projectNames.map((name, i) => {
  const company = companiesData[i % companiesData.length];
  const manager = devUsers[i % devUsers.length];
  const members = [manager.id, devUsers[(i + 1) % devUsers.length].id, devUsers[(i + 2) % devUsers.length].id];
  const month = 1 + (i % 6);
  return {
    id: i + 1,
    name,
    description: `${company.name}의 "${name}" 프로젝트입니다.`,
    status: statusCycle[i],
    progress: statusCycle[i] === 'COMPLETED' ? 100 : statusCycle[i] === 'PLANNING' ? 5 : 20 + i * 8,
    companyId: company.id,
    companyName: company.name,
    managerId: manager.id,
    managerName: manager.name,
    members,
    startDate: `2026-${String(month).padStart(2, '0')}-01T09:00:00`,
    endDate: `2026-${String(Math.min(month + 5, 12)).padStart(2, '0')}-28T18:00:00`,
    createdAt: `2026-${String(month).padStart(2, '0')}-01T09:00:00`,
    updatedAt: `2026-${String(Math.min(month + 1, 8)).padStart(2, '0')}-15T09:00:00`,
  };
});

export interface MockTask {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId: string | null;
  reporterId: string;
  labels: string[];
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours?: number;
  actualHours?: number;
  weight?: number;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

const taskTitleSets = [
  ['요구사항 분석', 'DB 스키마 설계', 'API 명세 작성', '화면 UI 개발', '연동 테스트', '배포 및 안정화'],
];
const taskStatuses: MockTask['status'][] = ['DONE', 'DONE', 'IN_PROGRESS', 'IN_PROGRESS', 'REVIEW', 'TODO'];

let taskId = 1;
export const tasksByProject: Record<number, MockTask[]> = {};
projectsData.forEach((p, pi) => {
  const list: MockTask[] = taskTitleSets[0].map((title, ti) => {
    const assignee = devUsers[(pi + ti) % devUsers.length];
    const status = taskStatuses[ti];
    const month = 1 + (pi % 6);
    const day = 3 + ti * 4 > 28 ? 28 : 3 + ti * 4;
    return {
      id: taskId++,
      projectId: p.id,
      title: `${title}`,
      description: `${p.name} - ${title} 작업입니다.`,
      status,
      priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const)[ti % 4],
      assigneeId: assignee.id,
      reporterId: p.managerId,
      labels: ti % 2 === 0 ? ['기획'] : ['개발'],
      dueDate: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T18:00:00`,
      completedAt: status === 'DONE' ? `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T17:00:00` : null,
      estimatedHours: 8 + ti * 2,
      actualHours: status === 'DONE' ? 8 + ti : undefined,
      weight: 1,
      attachments: [],
      createdAt: `2026-${String(month).padStart(2, '0')}-01T09:00:00`,
      updatedAt: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T17:00:00`,
    };
  });
  tasksByProject[p.id] = list;
});

export interface MockIssue {
  id: number;
  projectId: number;
  title: string;
  description: string;
  type: 'FEATURE' | 'IMPROVEMENT' | 'BUG' | 'ISSUE' | 'QUESTION' | 'OTHER';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL' | 'BLOCKER';
  assigneeId: string | null;
  reporterId: string;
  dueDate: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

const issueTitles = [
  '로그인 후 화면 깜빡임 현상', '엑셀 다운로드 시 한글 깨짐', '모바일에서 버튼 클릭 안됨',
  '검색 결과 페이징 오류', '알림 중복 발송', '파일 업로드 500 에러', '통계 수치 불일치',
];
let issueId = 1;
export const issuesData: MockIssue[] = [];
projectsData.slice(0, 6).forEach((p, pi) => {
  const count = 1 + (pi % 3);
  for (let k = 0; k < count; k++) {
    const title = issueTitles[(pi + k) % issueTitles.length];
    const reporter = devUsers[(pi + k) % devUsers.length];
    const assignee = devUsers[(pi + k + 1) % devUsers.length];
    const status = (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const)[(pi + k) % 4];
    const month = 1 + (pi % 6);
    issuesData.push({
      id: issueId++,
      projectId: p.id,
      title,
      description: `${p.name} 진행 중 발견된 이슈: ${title}`,
      type: (['BUG', 'IMPROVEMENT', 'ISSUE'] as const)[(pi + k) % 3],
      status,
      severity: (['MINOR', 'MAJOR', 'CRITICAL', 'BLOCKER'] as const)[(pi + k) % 4],
      assigneeId: assignee.id,
      reporterId: reporter.id,
      dueDate: `2026-${String(month).padStart(2, '0')}-20T18:00:00`,
      resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? `2026-${String(month).padStart(2, '0')}-18T17:00:00` : null,
      closedAt: status === 'CLOSED' ? `2026-${String(month).padStart(2, '0')}-19T17:00:00` : null,
      attachments: [],
      createdAt: `2026-${String(month).padStart(2, '0')}-05T09:00:00`,
      updatedAt: `2026-${String(month).padStart(2, '0')}-18T17:00:00`,
    });
  }
});

export interface MockMilestone {
  id: number;
  projectId: number;
  title: string;
  description: string;
  milestoneDate: string;
  milestoneStatus: 'upcoming' | 'in_progress' | 'completed' | 'missed';
  actorId: string;
  actorName: string;
  createdAt: string;
}

let milestoneId = 1;
export const milestonesByProject: Record<number, MockMilestone[]> = {};
projectsData.forEach((p, pi) => {
  const month = 1 + (pi % 6);
  const list: MockMilestone[] = [
    { id: milestoneId++, projectId: p.id, title: '요구사항 확정', description: '고객사 요구사항 최종 확정', milestoneDate: `2026-${String(month).padStart(2, '0')}-10`, milestoneStatus: 'completed', actorId: p.managerId, actorName: p.managerName, createdAt: `2026-${String(month).padStart(2, '0')}-01T09:00:00` },
    { id: milestoneId++, projectId: p.id, title: '1차 배포', description: '스테이징 서버 1차 배포', milestoneDate: `2026-${String(Math.min(month + 1, 8)).padStart(2, '0')}-15`, milestoneStatus: p.status === 'COMPLETED' ? 'completed' : 'in_progress', actorId: p.managerId, actorName: p.managerName, createdAt: `2026-${String(month).padStart(2, '0')}-01T09:00:00` },
    { id: milestoneId++, projectId: p.id, title: '최종 오픈', description: '운영 서버 최종 오픈', milestoneDate: `2026-${String(Math.min(month + 3, 8)).padStart(2, '0')}-28`, milestoneStatus: p.status === 'COMPLETED' ? 'completed' : 'upcoming', actorId: p.managerId, actorName: p.managerName, createdAt: `2026-${String(month).padStart(2, '0')}-01T09:00:00` },
  ];
  milestonesByProject[p.id] = list;
});

export interface MockTimelineEvent { id: number; projectId: number; title: string; description: string; relatedId: number | null; actorId: string; createdAt: string; }
let timelineId = 1;
export const timelineByProject: Record<number, MockTimelineEvent[]> = {};
projectsData.forEach((p, pi) => {
  const month = 1 + (pi % 6);
  timelineByProject[p.id] = [
    { id: timelineId++, projectId: p.id, title: '프로젝트가 생성되었습니다', description: `${p.name} 프로젝트 시작`, relatedId: null, actorId: p.managerId, createdAt: `2026-${String(month).padStart(2, '0')}-01T09:00:00` },
    { id: timelineId++, projectId: p.id, title: '팀원이 합류했습니다', description: `${p.members.length}명의 팀원이 참여 중입니다`, relatedId: null, actorId: p.managerId, createdAt: `2026-${String(month).padStart(2, '0')}-02T09:00:00` },
  ];
});

export interface MockProjectDocument { id: number; projectId: number; fileName: string; fileUrl: string; fileType: string; fileSize: number; folderName: string | null; uploadedBy: string; uploadedByName: string; uploadedAt: string; }
let docId = 1;
export const documentsByProject: Record<number, MockProjectDocument[]> = {};
projectsData.forEach((p, pi) => {
  const month = 1 + (pi % 6);
  documentsByProject[p.id] = [
    { id: docId++, projectId: p.id, fileName: `${p.name}_기획서.pdf`, fileUrl: `/mock-files/project-${p.id}-plan.pdf`, fileType: 'application/pdf', fileSize: 512_000, folderName: null, uploadedBy: p.managerId, uploadedByName: p.managerName, uploadedAt: `2026-${String(month).padStart(2, '0')}-03T10:00:00` },
  ];
});
export const foldersByProject: Record<number, string[]> = Object.fromEntries(projectsData.map((p) => [p.id, ['기획', '설계', '산출물']]));
