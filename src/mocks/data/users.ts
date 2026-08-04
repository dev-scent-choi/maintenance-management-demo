// 목업 사용자 데이터 (백엔드 UserResponse 형태: id = 이메일)
export interface MockUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: 'ADMIN' | 'USER';
  active: boolean;
  passwordSet: boolean;
  createdAt: string;
  updatedAt: string;
}

const mk = (u: Omit<MockUser, 'id' | 'passwordSet' | 'createdAt' | 'updatedAt'>): MockUser => ({
  ...u,
  id: u.email,
  passwordSet: true,
  createdAt: '2026-01-05T09:00:00',
  updatedAt: '2026-01-05T09:00:00',
});

export const usersData: MockUser[] = [
  mk({ name: '관리자', email: 'admin@maintenance-site.com', phone: '010-0000-0000', department: '관리부', position: '시스템 관리자', role: 'ADMIN', active: true }),
  mk({ name: '김도현', email: 'dohyun.kim@maintenance-site.com', phone: '010-1234-5678', department: '유지보수팀', position: '팀장', role: 'ADMIN', active: true }),
  mk({ name: '이서연', email: 'seoyeon.lee@maintenance-site.com', phone: '010-2345-6789', department: '유지보수팀', position: '대리', role: 'USER', active: true }),
  mk({ name: '박준호', email: 'junho.park@maintenance-site.com', phone: '010-3456-7890', department: '개발팀', position: '주임', role: 'USER', active: true }),
  mk({ name: '최민아', email: 'mina.choi@maintenance-site.com', phone: '010-4567-8901', department: '개발팀', position: '과장', role: 'USER', active: true }),
  mk({ name: '정우진', email: 'woojin.jung@maintenance-site.com', phone: '010-5678-9012', department: '인프라팀', position: '사원', role: 'USER', active: true }),
  mk({ name: '한소희', email: 'sohee.han@maintenance-site.com', phone: '010-6789-0123', department: '인프라팀', position: '대리', role: 'USER', active: true }),
  mk({ name: '오지훈', email: 'jihoon.oh@maintenance-site.com', phone: '010-7890-1234', department: '영업팀', position: '과장', role: 'USER', active: true }),
  mk({ name: '강나윤', email: 'nayoon.kang@maintenance-site.com', phone: '010-8901-2345', department: '품질관리팀', position: '주임', role: 'USER', active: true }),
  mk({ name: '윤태호', email: 'taeho.yoon@maintenance-site.com', phone: '010-9012-3456', department: '유지보수팀', position: '사원', role: 'USER', active: false }),
];

export const findUser = (id: string) => usersData.find((u) => u.id === id || u.email === id);
