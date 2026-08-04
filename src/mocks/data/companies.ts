// 목업 업체 데이터 (백엔드 CompanyResponse 형태)
export interface MockCompany {
  id: number;
  name: string;
  businessNumber: string;
  representative: string;
  contact: string;
  contactRole?: string;
  email: string;
  companyEmail?: string;
  phone: string;
  mobile?: string;
  address: string;
  logoUrl?: string;
  notes: string;
  projectStartDate: string;
  projectEndDate: string;
  projectStatus: 'active' | 'completed' | 'onHold';
  contractStatus?: 'maintenance' | 'project' | 'ended';
  maintenanceContract: boolean;
  maintenanceStartDate: string;
  maintenanceEndDate: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export const companiesData: MockCompany[] = [
  { id: 1, name: '한빛물류', businessNumber: '123-45-67890', representative: '서정민', contact: '이하늘', contactRole: '전산팀장', email: 'it@hanbit-logi.co.kr', phone: '02-1234-5678', mobile: '010-1111-2222', address: '서울특별시 강남구 테헤란로 123', notes: '물류 관리 시스템 유지보수 계약 고객', projectStartDate: '2025-03-01', projectEndDate: '2026-02-28', projectStatus: 'active', contractStatus: 'maintenance', maintenanceContract: true, maintenanceStartDate: '2026-01-01', maintenanceEndDate: '2026-12-31', status: 'active', createdAt: '2025-03-01T09:00:00' },
  { id: 2, name: '그린푸드', businessNumber: '234-56-78901', representative: '박지수', contact: '김도윤', contactRole: 'IT 담당', email: 'system@greenfood.co.kr', phone: '02-2345-6789', mobile: '010-2222-3333', address: '경기도 성남시 분당구 판교로 45', notes: '식자재 유통 ERP 시스템', projectStartDate: '2025-06-15', projectEndDate: '2026-06-14', projectStatus: 'active', contractStatus: 'maintenance', maintenanceContract: true, maintenanceStartDate: '2026-01-01', maintenanceEndDate: '2026-12-31', status: 'active', createdAt: '2025-06-15T09:00:00' },
  { id: 3, name: '스마트팩토리코리아', businessNumber: '345-67-89012', representative: '이현우', contact: '정수빈', contactRole: '생산관리팀', email: 'support@sfk.co.kr', phone: '031-345-6789', mobile: '010-3333-4444', address: '경기도 화성시 동탄산업로 88', notes: '스마트 팩토리 MES 시스템', projectStartDate: '2024-11-01', projectEndDate: '2025-10-31', projectStatus: 'completed', contractStatus: 'ended', maintenanceContract: false, maintenanceStartDate: '', maintenanceEndDate: '', status: 'inactive', createdAt: '2024-11-01T09:00:00' },
  { id: 4, name: '한울건설', businessNumber: '456-78-90123', representative: '최영수', contact: '한지민', contactRole: '경영지원팀', email: 'admin@hanwool-c.co.kr', phone: '02-4567-8901', mobile: '010-4444-5555', address: '서울특별시 송파구 올림픽로 300', notes: '건설 현장관리 시스템', projectStartDate: '2025-09-01', projectEndDate: '2026-08-31', projectStatus: 'active', contractStatus: 'maintenance', maintenanceContract: true, maintenanceStartDate: '2026-01-01', maintenanceEndDate: '2026-12-31', status: 'active', createdAt: '2025-09-01T09:00:00' },
  { id: 5, name: '메디케어병원', businessNumber: '567-89-01234', representative: '강민준', contact: '오세영', contactRole: '전산실장', email: 'it@medicare-h.co.kr', phone: '02-5678-9012', mobile: '010-5555-6666', address: '서울특별시 서초구 반포대로 200', notes: '병원 예약/전자차트 시스템', projectStartDate: '2025-01-10', projectEndDate: '2025-12-31', projectStatus: 'active', contractStatus: 'maintenance', maintenanceContract: true, maintenanceStartDate: '2026-01-01', maintenanceEndDate: '2026-12-31', status: 'active', createdAt: '2025-01-10T09:00:00' },
  { id: 6, name: '퍼스트뱅크저축은행', businessNumber: '678-90-12345', representative: '윤성호', contact: '배지훈', contactRole: 'IT보안팀', email: 'security@firstbank.co.kr', phone: '02-6789-0123', mobile: '010-6666-7777', address: '서울특별시 영등포구 여의대로 50', notes: '금융권 보안 규정 준수 필요, 원격 접속 제한', projectStartDate: '2025-04-01', projectEndDate: '2026-03-31', projectStatus: 'active', contractStatus: 'maintenance', maintenanceContract: true, maintenanceStartDate: '2026-01-01', maintenanceEndDate: '2026-12-31', status: 'active', createdAt: '2025-04-01T09:00:00' },
  { id: 7, name: '오션테크', businessNumber: '789-01-23456', representative: '조은서', contact: '남기범', contactRole: '개발팀장', email: 'dev@oceantech.io', phone: '051-789-0123', mobile: '010-7777-8888', address: '부산광역시 해운대구 센텀중앙로 60', notes: '해운 물류 트래킹 시스템', projectStartDate: '2025-07-01', projectEndDate: '2026-06-30', projectStatus: 'onHold', contractStatus: 'project', maintenanceContract: false, maintenanceStartDate: '', maintenanceEndDate: '', status: 'active', createdAt: '2025-07-01T09:00:00' },
  { id: 8, name: '유니온리테일', businessNumber: '890-12-34567', representative: '임재현', contact: '서다인', contactRole: 'POS운영팀', email: 'pos@unionretail.co.kr', phone: '02-8901-2345', mobile: '010-8888-9999', address: '서울특별시 마포구 월드컵로 396', notes: '전국 매장 POS 통합 관리 시스템', projectStartDate: '2025-02-01', projectEndDate: '2026-01-31', projectStatus: 'active', contractStatus: 'maintenance', maintenanceContract: true, maintenanceStartDate: '2026-01-01', maintenanceEndDate: '2026-12-31', status: 'active', createdAt: '2025-02-01T09:00:00' },
];

export interface MockContact { id: number; companyId: number; name: string; role: string; phone?: string; mobile?: string; email?: string; notes?: string; }
export interface MockServer { id: number; companyId: number; name: string; serverType: string; hostname: string; port?: number; osVersion?: string; dbName?: string; username: string; password: string; description?: string; notes?: string; }
export interface MockVpn { id: number; companyId: number; name: string; vpnType: string; server: string; port?: number; username: string; password: string; notes?: string; }

export const contactsData: MockContact[] = [
  { id: 1, companyId: 1, name: '이하늘', role: '전산팀장', phone: '02-1234-5678', mobile: '010-1111-2222', email: 'haneul.lee@hanbit-logi.co.kr' },
  { id: 2, companyId: 1, name: '문가영', role: '운영담당', mobile: '010-1111-3333', email: 'gayoung.moon@hanbit-logi.co.kr' },
  { id: 3, companyId: 2, name: '김도윤', role: 'IT 담당', mobile: '010-2222-3333', email: 'doyoon.kim@greenfood.co.kr' },
  { id: 4, companyId: 4, name: '한지민', role: '경영지원팀', mobile: '010-4444-5555', email: 'jimin.han@hanwool-c.co.kr' },
  { id: 5, companyId: 5, name: '오세영', role: '전산실장', mobile: '010-5555-6666', email: 'seyoung.oh@medicare-h.co.kr' },
  { id: 6, companyId: 6, name: '배지훈', role: 'IT보안팀', mobile: '010-6666-7777', email: 'jihoon.bae@firstbank.co.kr' },
  { id: 7, companyId: 8, name: '서다인', role: 'POS운영팀', mobile: '010-8888-9999', email: 'dain.seo@unionretail.co.kr' },
];

export const serversData: MockServer[] = [
  { id: 1, companyId: 1, name: '운영 웹서버', serverType: 'linux', hostname: '10.20.1.11', port: 22, osVersion: 'Ubuntu 22.04', username: 'deploy', password: '****', description: 'Nginx + Node 운영 서버' },
  { id: 2, companyId: 1, name: '운영 DB서버', serverType: 'postgresql', hostname: '10.20.1.12', port: 5432, dbName: 'hanbit_logistics', username: 'dbadmin', password: '****', description: '메인 물류 DB' },
  { id: 3, companyId: 4, name: '현장관리 API서버', serverType: 'linux', hostname: '10.20.2.11', port: 22, osVersion: 'CentOS 8', username: 'admin', password: '****' },
  { id: 4, companyId: 5, name: '전자차트 DB', serverType: 'mssql', hostname: '10.20.3.10', port: 1433, dbName: 'medicare_emr', username: 'sa', password: '****', description: '접근 시 사전 승인 필요' },
  { id: 5, companyId: 6, name: '내부망 API서버', serverType: 'windows', hostname: '10.20.4.10', port: 3389, osVersion: 'Windows Server 2022', username: 'operator', password: '****', description: '보안 규정상 VPN 필수' },
];

export const vpnAccountsData: MockVpn[] = [
  { id: 1, companyId: 1, name: '유지보수 접속용', vpnType: 'OpenVPN', server: 'vpn.hanbit-logi.co.kr', port: 1194, username: 'msite_vpn', password: '****' },
  { id: 2, companyId: 6, name: '보안망 접속용', vpnType: 'FortiClient', server: 'vpn.firstbank.co.kr', port: 10443, username: 'msite_secure', password: '****', notes: '접속 전 사전 승인 요청 필요' },
  { id: 3, companyId: 4, name: '현장 접속용', vpnType: 'Cisco AnyConnect', server: 'vpn.hanwool-c.co.kr', port: 443, username: 'msite_field', password: '****' },
];
