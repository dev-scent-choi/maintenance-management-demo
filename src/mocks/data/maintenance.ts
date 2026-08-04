import { companiesData } from './companies';
import { usersData } from './users';

// 목업 유지보수 데이터 (백엔드 MaintenanceResponse 형태)
export interface MockComment { id: number; maintenanceId: number; content: string; createdAt: string; createdBy: string; createdById: string; }
export interface MockFile { id: number; maintenanceId: number; filename: string; fileUrl: string; fileType: string; size: number; uploadedAt: string; uploadedBy: string; uploadedById: string; isImage: boolean; version: number; }
export interface MockStatusHistory { id: number; status: string; comment: string; changedAt: string; changedBy: string; changedById: string; }

export interface MockMaintenance {
  id: number;
  title: string;
  description: string;
  category?: string;
  companyName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'URGENT' | 'ON_HOLD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo: string | null;
  assignedToId: string | null;
  startDate: string | null;
  expectedCompletionDate: string | null;
  actualCompletionDate: string | null;
  workType?: string;
  requesterName?: string;
  completionResult?: string | null;
  testStatus?: string | null;
  deploymentLocation?: string | null;
  estimatedHours?: number;
  actualHours?: number;
  createdAt: string;
  updatedAt: string;
  files: MockFile[];
  comments: MockComment[];
  statusHistory: MockStatusHistory[];
}

const engineers = usersData.filter((u) => u.department === '유지보수팀' || u.department === '개발팀' || u.department === '인프라팀');
const titles = [
  '결제 모듈 오류 수정', '로그인 세션 만료 이슈', 'DB 커넥션 풀 튜닝', '월간 리포트 자동화 개선',
  '파일 업로드 용량 제한 조정', 'API 응답 속도 저하 점검', '알림 발송 실패 건 조치', '엑셀 다운로드 인코딩 오류',
  '재고 동기화 배치 오류', '모바일 화면 레이아웃 깨짐', '방화벽 정책 변경 적용', 'SSL 인증서 갱신',
  '사용자 권한 설정 오류', '검색 기능 성능 개선', '백업 스케줄 실패 조치', '대시보드 차트 렌더링 오류',
  '신규 지점 시스템 셋업', '연동 API 스펙 변경 대응', '서버 디스크 용량 확보', '정기 보안 패치 적용',
  '주문 취소 프로세스 개선', '푸시 알림 미발송 이슈', '데이터 마이그레이션 검증', '접속 로그 이상 탐지 조치',
  '월말 정산 배치 지연 조치',
];
const workTypes = ['버그수정', '기능개선', '정기점검', '긴급대응', '신규구축', '보안패치'];
const statuses: MockMaintenance['status'][] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'URGENT', 'ON_HOLD'];
const priorities: MockMaintenance['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function pad(n: number) { return n.toString().padStart(2, '0'); }
function dateStr(month: number, day: number) { return `2026-${pad(month)}-${pad(day)}`; }
function dateTimeStr(month: number, day: number, hour = 10) { return `2026-${pad(month)}-${pad(day)}T${pad(hour)}:00:00`; }

export const maintenanceData: MockMaintenance[] = titles.map((title, i) => {
  const id = i + 1;
  const company = companiesData[i % companiesData.length];
  const engineer = engineers[i % engineers.length];
  const status = statuses[i % statuses.length];
  const priority = priorities[(i * 3) % priorities.length];
  const month = 1 + Math.floor(i / 4); // 2026-01 ~ 2026-08 분산
  const startDay = 2 + (i % 24);
  const isDone = status === 'COMPLETED';
  const isCancelledLike = status === 'ON_HOLD';

  const record: MockMaintenance = {
    id,
    title,
    description: `${company.name} 시스템 - "${title}" 관련 요청입니다. 현상 확인 후 조치 진행합니다.`,
    category: workTypes[i % workTypes.length],
    companyName: company.name,
    status,
    priority,
    assignedTo: engineer.name,
    assignedToId: engineer.id,
    startDate: dateStr(month, startDay),
    expectedCompletionDate: dateStr(month, Math.min(startDay + 5, 28)),
    actualCompletionDate: isDone ? dateStr(month, Math.min(startDay + 4, 28)) : null,
    workType: workTypes[i % workTypes.length],
    requesterName: company.contact,
    completionResult: isDone ? '정상 조치 완료, 재발 방지 조치 적용함' : null,
    testStatus: isDone ? '테스트 완료' : status === 'IN_PROGRESS' ? '테스트 진행중' : null,
    deploymentLocation: i % 2 === 0 ? '운영서버' : '스테이징서버',
    estimatedHours: 2 + (i % 6),
    actualHours: isDone ? 2 + (i % 5) : undefined,
    createdAt: dateTimeStr(month, startDay, 9),
    updatedAt: dateTimeStr(month, Math.min(startDay + (isDone ? 4 : 1), 28), 15),
    files: [
      {
        id: id * 10 + 1,
        maintenanceId: id,
        filename: `점검보고서_${company.name}_${month}월.pdf`,
        fileUrl: `/mock-files/report-${id}.pdf`,
        fileType: 'application/pdf',
        size: 245_000 + i * 1000,
        uploadedAt: dateTimeStr(month, startDay, 11),
        uploadedBy: engineer.name,
        uploadedById: engineer.id,
        isImage: false,
        version: 1,
      },
    ],
    comments: [
      {
        id: id * 10 + 1,
        maintenanceId: id,
        content: '현상 확인했습니다. 원인 파악 중입니다.',
        createdAt: dateTimeStr(month, startDay, 10),
        createdBy: engineer.name,
        createdById: engineer.id,
      },
      ...(isDone
        ? [
            {
              id: id * 10 + 2,
              maintenanceId: id,
              content: '조치 완료했습니다. 확인 부탁드립니다.',
              createdAt: dateTimeStr(month, Math.min(startDay + 4, 28), 16),
              createdBy: engineer.name,
              createdById: engineer.id,
            },
          ]
        : []),
    ],
    statusHistory: [
      {
        id: id * 10 + 1,
        status: 'PENDING',
        comment: '접수되었습니다.',
        changedAt: dateTimeStr(month, startDay, 9),
        changedBy: company.contact,
        changedById: engineer.id,
      },
      ...(status !== 'PENDING'
        ? [
            {
              id: id * 10 + 2,
              status,
              comment: isDone ? '조치 완료' : isCancelledLike ? '고객 요청으로 보류' : '처리 진행중',
              changedAt: dateTimeStr(month, Math.min(startDay + 1, 28), 14),
              changedBy: engineer.name,
              changedById: engineer.id,
            },
          ]
        : []),
    ],
  };
  return record;
});

export const findMaintenance = (id: number | string) => maintenanceData.find((m) => m.id === Number(id));
