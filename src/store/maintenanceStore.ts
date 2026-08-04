import { create } from 'zustand';
import { useNotificationStore } from './notificationStore';
import { useAuthStore } from './authStore';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiClient';
import { uploadWithProgress } from '../utils/uploadWithProgress';
import type { MaintenanceRecord, Company, User } from '../types';

// Enum conversion helpers
const backendToFrontendStatus = (status: string): MaintenanceRecord['status'] => {
  const map: Record<string, MaintenanceRecord['status']> = {
    'PENDING': 'pending',
    'IN_PROGRESS': 'in-progress',
    'COMPLETED': 'completed',
    'CANCELLED': 'on-hold',
    'URGENT': 'urgent',
    'ON_HOLD': 'on-hold',
  };
  const result = map[status] || 'pending';
  return result;
};

const backendToFrontendPriority = (priority: string): MaintenanceRecord['priority'] => {
  const map: Record<string, MaintenanceRecord['priority']> = {
    'LOW': 'low',
    'MEDIUM': 'medium',
    'HIGH': 'high',
    'URGENT': 'urgent'
  };
  return map[priority] || 'medium';
};

const frontendToBackendStatus = (status: string): string => {
  const map: Record<string, string> = {
    'pending': 'PENDING',
    'in-progress': 'IN_PROGRESS',
    'completed': 'COMPLETED',
    'cancelled': 'CANCELLED',
    'urgent': 'URGENT',
    'on-hold': 'ON_HOLD',
  };
  const result = map[status] || 'PENDING';
  return result;
};

const frontendToBackendPriority = (priority: string): string => {
  const map: Record<string, string> = {
    'low': 'LOW',
    'medium': 'MEDIUM',
    'high': 'HIGH',
    'urgent': 'URGENT'
  };
  return map[priority] || 'MEDIUM';
};

interface MaintenanceState {
  maintenanceRecords: MaintenanceRecord[];
  companies: Company[];
  users: User[];
  isLoading: boolean;
  fetchMaintenanceRecords: () => Promise<void>;
  fetchCompanies: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  addMaintenanceRecord: (record: MaintenanceRecord) => Promise<MaintenanceRecord>;
  updateMaintenanceRecord: (id: string, record: Partial<MaintenanceRecord>) => Promise<void>;
  updateSingleRecord: (id: string, updates: Partial<MaintenanceRecord>) => void;
  deleteMaintenanceRecord: (id: string) => Promise<void>;
  uploadFile: (maintenanceId: string, file: File, onProgress?: (pct: number) => void) => Promise<any>;
  deleteFile: (fileId: string) => Promise<void>;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, company: Partial<Company>) => void;
  deleteCompany: (id: string) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set, get) => ({
  maintenanceRecords: [],
  companies: [],
  users: [],
  isLoading: false,

  fetchMaintenanceRecords: async () => {
    set({ isLoading: true });
    try {
      const response = await apiGet(import.meta.env.VITE_API_URL + '/maintenance');

      if (!response.ok) {
        console.error('[fetchMaintenanceRecords] API 응답 실패:', response.status);
        throw new Error('Failed to fetch maintenance records');
      }

      const data = await response.json();

      // 첫 번째 레코드의 전체 구조 확인 (삭제 관련 필드 확인용)
      if (data.length > 0) {
      }

      // 백엔드에서 CANCELLED 상태를 제외하고 반환 (논리적 삭제된 항목 제외)
      const convertedRecords: MaintenanceRecord[] = data
        .map((record: any) => ({
          id: record.id.toString(),
          title: record.title,
          description: record.description,
          category: record.category,
          priority: backendToFrontendPriority(record.priority),
          status: backendToFrontendStatus(record.status),
          companyId: record.companyId?.toString(),
          companyName: record.companyName,
          assignedToId: record.assignedToId?.toString(),
          assignedToName: record.assignedTo,
          requestDate: record.startDate,
          completedDate: record.actualCompletionDate,
          actualCompletionDate: record.actualCompletionDate,
          scheduledDate: record.scheduledDate,
          estimatedHours: record.estimatedHours,
          actualHours: record.actualHours,
          startDate: record.startDate,
          expectedCompletionDate: record.expectedCompletionDate,
          workType: record.workType,
          requesterName: record.requesterName,
          completionResult: record.completionResult,
          testStatus: record.testStatus,
          deploymentLocation: record.deploymentLocation,
          files: record.files || [],
          comments: record.comments || [],
          attachments: record.attachments || record.files || [],
          createdBy: record.createdBy,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          statusHistory: record.statusHistory?.map((h: any) => ({
            id: h.id.toString(),
            status: backendToFrontendStatus(h.status),
            comment: h.comment,
            changedAt: new Date(h.changedAt),
            changedBy: h.changedBy,
            changedById: h.changedById?.toString(),
          })) || [],
          priorityHistory: record.priorityHistory?.map((h: any) => ({
            id: h.id.toString(),
            previousPriority: h.previousPriority,
            newPriority: h.newPriority,
            comment: h.comment,
            changedAt: new Date(h.changedAt),
            changedBy: h.changedBy,
            changedById: h.changedById?.toString(),
          })) || [],
        }))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // 등록일 기준 내림차순 정렬
      set({ maintenanceRecords: convertedRecords });
    } catch (error) {
      console.error('[fetchMaintenanceRecords] 에러 발생:', error);
      // 401 에러는 apiClient에서 이미 처리됨 (자동 로그아웃 + 리다이렉트)
      // 다른 에러의 경우에만 여기서 처리
      if (error instanceof Error && !error.message.includes('인증이 만료')) {
        console.error('[fetchMaintenanceRecords] 예상치 못한 에러:', error);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCompanies: async () => {
    try {
      const response = await apiGet(import.meta.env.VITE_API_URL + '/companies');

      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }

      const data = await response.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convertedCompanies: Company[] = data.map((company: any) => ({
        id: company.id.toString(),
        name: company.name,
        businessNumber: company.businessNumber || '',
        representative: company.representative || '',
        contact: company.contact || '',
        email: company.email || '',
        phone: company.phone || '',
        mobile: company.mobile || '',
        address: company.address || '',
        logoUrl: company.logoUrl || '',
        notes: company.notes || '',
        projectStartDate: company.projectStartDate || '',
        projectEndDate: company.projectEndDate || '',
        projectStatus: company.projectStatus || 'active',
        maintenanceContract: company.maintenanceContract || false,
        maintenanceStartDate: company.maintenanceStartDate || '',
        maintenanceEndDate: company.maintenanceEndDate || '',
        maintenanceCycle: 'monthly',
        maintenanceType: 'onsite',
        remoteAccessMethod: '',
        projectMembers: [],
        sourceControl: { type: 'git', url: '', username: '', password: '' },
        documentStorage: { type: 'nas', url: '', path: '' },
        createdAt: new Date(company.createdAt || Date.now())
      }));


      // 중복 제거 (id 기준)
      const uniqueCompanies = convertedCompanies.reduce((acc, company) => {
        if (!acc.find(c => c.id === company.id)) {
          acc.push(company);
        }
        return acc;
      }, [] as Company[]);


      // store 업데이트 시 기존 데이터와 병합하지 않고 완전히 교체
      set((state) => {
        return { companies: uniqueCompanies };
      });

    } catch (error) {
      console.error('[fetchCompanies] Error:', error);
    }
  },

  fetchUsers: async () => {
    try {
      const response = await apiGet(import.meta.env.VITE_API_URL + '/users');

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convertedUsers: User[] = data.map((user: any) => ({
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role?.toLowerCase() || 'user',
        phone: user.phone || '',
        department: user.department || '',
        position: user.position || '',
        projectAssignments: [],
        accountStatus: user.active ? 'active' : 'inactive'
      }));


      // 중복 제거 (id 기준)
      const uniqueUsers = convertedUsers.reduce((acc, user) => {
        if (!acc.find(u => u.id === user.id)) {
          acc.push(user);
        }
        return acc;
      }, [] as User[]);

      set({ users: uniqueUsers });
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  },

  addMaintenanceRecord: async (record) => {
    try {
      const toDateStr = (d: any): string | null => {
        if (!d) return null;
        if (typeof d === 'string') return d.split('T')[0];
        if (d instanceof Date) return d.toISOString().split('T')[0];
        return null;
      };
      const requestData = {
        title: record.title,
        description: record.description || '',
        companyName: record.companyName, // Required by backend
        priority: frontendToBackendPriority(record.priority),
        status: frontendToBackendStatus(record.status),
        companyId: record.companyId ? parseInt(record.companyId) : null,
        assignedToId: record.assignedToId || null, // String ID - no conversion
        startDate: toDateStr(record.startDate),
        expectedCompletionDate: toDateStr(record.expectedCompletionDate),
        actualCompletionDate: toDateStr(record.actualCompletionDate) || toDateStr(record.completedDate) || null,
        workType: record.workType,
        requesterName: record.requesterName,
        completionResult: record.completionResult || null,
        testStatus: record.testStatus || null,
        deploymentLocation: record.deploymentLocation || null,
        estimatedHours: record.estimatedHours || null,
        actualHours: record.actualHours || null,
      };


      const response = await apiPost(import.meta.env.VITE_API_URL + '/maintenance', requestData);


      if (!response.ok) {
        const errorText = await response.text();
        console.error('[addMaintenanceRecord] Error response:', errorText);
        throw new Error(`Failed to create maintenance record: ${errorText}`);
      }

      const createdRecord = await response.json();

      const convertedRecord: MaintenanceRecord = {
        id: createdRecord.id.toString(),
        title: createdRecord.title,
        description: createdRecord.description,
        category: createdRecord.category,
        priority: backendToFrontendPriority(createdRecord.priority),
        status: backendToFrontendStatus(createdRecord.status),
        companyId: createdRecord.companyId?.toString(),
        companyName: createdRecord.companyName,
        assignedToId: createdRecord.assignedToId?.toString(),
        assignedToName: createdRecord.assignedTo,
        requestDate: createdRecord.startDate,
        completedDate: createdRecord.actualCompletionDate,
        actualCompletionDate: createdRecord.actualCompletionDate,
        scheduledDate: createdRecord.scheduledDate,
        estimatedHours: createdRecord.estimatedHours,
        actualHours: createdRecord.actualHours,
        startDate: createdRecord.startDate,
        expectedCompletionDate: createdRecord.expectedCompletionDate,
        workType: createdRecord.workType,
        requesterName: createdRecord.requesterName,
        completionResult: createdRecord.completionResult,
        testStatus: createdRecord.testStatus,
        deploymentLocation: createdRecord.deploymentLocation,
        files: createdRecord.files || [],
        comments: createdRecord.comments || [],
        attachments: createdRecord.attachments || createdRecord.files || [],
        createdBy: createdRecord.createdBy,
        createdAt: createdRecord.createdAt,
        updatedAt: createdRecord.updatedAt,
        statusHistory: createdRecord.statusHistory?.map((h: any) => ({
          id: h.id.toString(),
          status: backendToFrontendStatus(h.status),
          comment: h.comment,
          changedAt: new Date(h.changedAt),
          changedBy: h.changedBy,
          changedById: h.changedById?.toString(),
        })) || [],
        priorityHistory: createdRecord.priorityHistory?.map((h: any) => ({
          id: h.id.toString(),
          previousPriority: h.previousPriority,
          newPriority: h.newPriority,
          comment: h.comment,
          changedAt: new Date(h.changedAt),
          changedBy: h.changedBy,
          changedById: h.changedById?.toString(),
        })) || [],
      };

      set((state) => ({ maintenanceRecords: [...state.maintenanceRecords, convertedRecord] }));

      // 알림 전송
      const currentUser = useAuthStore.getState().user;
      const { addNotification } = useNotificationStore.getState();
      const { users } = get();


      if (currentUser && convertedRecord.assignedToId) {
        // 배정된 사용자에게 알림
        addNotification({
          userId: convertedRecord.assignedToId,
          type: 'maintenance_assigned',
          title: '새 유지보수 작업 배정',
          message: `${currentUser.name}님이 "${convertedRecord.title}" 작업을 배정했습니다.`,
          priority: convertedRecord.priority === 'urgent' || convertedRecord.priority === 'high' ? 'high' : 'normal',
          relatedResourceType: 'maintenance',
          relatedResourceId: convertedRecord.id,
          actionUrl: `/maintenance/${convertedRecord.id}`,
          isRead: false,
        });
      }

      // 관리자에게 알림
      users.forEach((user) => {
        if (user.role === 'admin' && user.id !== currentUser?.id) {
          addNotification({
            userId: user.id,
            type: 'maintenance_created',
            title: '새 유지보수 접수',
            message: `${convertedRecord.companyName}에서 "${convertedRecord.title}" 유지보수가 접수되었습니다.`,
            priority: 'normal',
            relatedResourceType: 'maintenance',
            relatedResourceId: convertedRecord.id,
            actionUrl: `/maintenance/${convertedRecord.id}`,
            isRead: false,
          });
        }
      });

      // 생성된 레코드 반환 (파일 업로드 시 실제 ID 사용을 위해)
      return convertedRecord;
    } catch (error) {
      console.error('Error creating maintenance record:', error);
      throw error;
    }
  },

  updateMaintenanceRecord: async (id, updates) => {
    const oldRecord = get().maintenanceRecords.find((r) => r.id === id);
    const merged = oldRecord ? { ...oldRecord, ...updates } : updates;

    try {
      const toDateStr = (d: any): string | null => {
        if (!d) return null;
        if (typeof d === 'string') return d.split('T')[0];
        if (d instanceof Date) return d.toISOString().split('T')[0];
        return null;
      };
      const response = await apiPut(`${import.meta.env.VITE_API_URL}/maintenance/${id}`, {
        title: merged.title,
        description: merged.description ?? '',
        companyName: merged.companyName, // Required by backend
        priority: merged.priority ? frontendToBackendPriority(merged.priority) : undefined,
        status: merged.status ? frontendToBackendStatus(merged.status) : undefined,
        companyId: merged.companyId ? parseInt(merged.companyId) : null,
        assignedToId: merged.assignedToId || null,
        startDate: toDateStr(merged.startDate),
        expectedCompletionDate: toDateStr(merged.expectedCompletionDate),
        actualCompletionDate: toDateStr(merged.actualCompletionDate) || toDateStr(merged.completedDate) || null,
        category: merged.category,
        workType: merged.workType,
        requesterName: merged.requesterName,
        completionResult: merged.completionResult,
        testStatus: merged.testStatus,
        deploymentLocation: merged.deploymentLocation,
        statusHistory: updates.statusHistory?.map(h => ({
          status: frontendToBackendStatus(h.status),
          comment: h.comment,
          changedAt: h.changedAt,
          changedBy: h.changedBy,
          changedById: h.changedById ? parseInt(h.changedById) : null,
        })),
        priorityHistory: updates.priorityHistory?.map(h => ({
          previousPriority: h.previousPriority,
          newPriority: h.newPriority,
          comment: h.comment,
          changedAt: h.changedAt,
          changedBy: h.changedBy,
          changedById: h.changedById ? parseInt(h.changedById) : null,
        })),
      });

      let updatedRecord: any = null;
      if (!response.ok) {
        // 이메일 발송 오류 등 일부 5xx 경우에도 DB 저장은 성공했을 수 있음
        // 응답 텍스트 확인 후 이메일 관련 오류면 저장 성공으로 처리
        const errText = await response.text().catch(() => '');
        const isEmailError = /mail|email|smtp|authentication/i.test(errText);
        if (!isEmailError) {
          throw new Error('Failed to update maintenance record');
        }
        // 이메일 오류는 저장 성공으로 처리 (로컬 상태만 업데이트)
        const finalRecord: MaintenanceRecord = {
          ...merged,
          id,
          workType: merged.workType,
          requesterName: merged.requesterName,
          completionResult: merged.completionResult,
          testStatus: merged.testStatus,
          deploymentLocation: merged.deploymentLocation,
          files: merged.files || [],
          comments: merged.comments || [],
        } as MaintenanceRecord;
        set((state) => ({
          maintenanceRecords: state.maintenanceRecords.map((r) =>
            r.id === id ? finalRecord : r
          )
        }));
        return;
      }

      updatedRecord = await response.json();
      const convertedRecord: MaintenanceRecord = {
        id: updatedRecord.id.toString(),
        title: updatedRecord.title,
        description: updatedRecord.description,
        category: updatedRecord.category,
        priority: backendToFrontendPriority(updatedRecord.priority),
        status: backendToFrontendStatus(updatedRecord.status),
        companyId: updatedRecord.companyId?.toString(),
        companyName: updatedRecord.companyName,
        assignedToId: updatedRecord.assignedToId?.toString(),
        assignedToName: updatedRecord.assignedTo,
        requestDate: updatedRecord.startDate,
        completedDate: updatedRecord.actualCompletionDate,
        actualCompletionDate: updatedRecord.actualCompletionDate,
        scheduledDate: updatedRecord.scheduledDate,
        estimatedHours: updatedRecord.estimatedHours,
        actualHours: updatedRecord.actualHours,
        startDate: updatedRecord.startDate,
        expectedCompletionDate: updatedRecord.expectedCompletionDate,
        // 백엔드가 반환하지 않는 경우 전송한 값으로 보존
        workType: updatedRecord.workType ?? merged.workType,
        requesterName: updatedRecord.requesterName ?? merged.requesterName,
        completionResult: updatedRecord.completionResult ?? merged.completionResult,
        testStatus: updatedRecord.testStatus ?? merged.testStatus,
        deploymentLocation: updatedRecord.deploymentLocation ?? merged.deploymentLocation,
        files: updatedRecord.files || [],
        comments: updatedRecord.comments || [],
        attachments: updatedRecord.attachments || updatedRecord.files || [],
        createdBy: updatedRecord.createdBy,
        createdAt: updatedRecord.createdAt,
        updatedAt: updatedRecord.updatedAt,
        statusHistory: updatedRecord.statusHistory?.map((h: any) => ({
          id: h.id.toString(),
          status: backendToFrontendStatus(h.status),
          comment: h.comment,
          changedAt: new Date(h.changedAt),
          changedBy: h.changedBy,
          changedById: h.changedById?.toString(),
        })) || [],
        priorityHistory: updatedRecord.priorityHistory?.map((h: any) => ({
          id: h.id.toString(),
          previousPriority: h.previousPriority,
          newPriority: h.newPriority,
          comment: h.comment,
          changedAt: new Date(h.changedAt),
          changedBy: h.changedBy,
          changedById: h.changedById?.toString(),
        })) || [],
      };

      set((state) => ({
        maintenanceRecords: state.maintenanceRecords.map((r) =>
          r.id === id ? convertedRecord : r
        )
      }));

      // 알림 전송
      const currentUser = useAuthStore.getState().user;
      const { addNotification } = useNotificationStore.getState();
      const { users } = get();

      if (oldRecord && currentUser) {
        // 상태 변경 알림
        if (updates.status && updates.status !== oldRecord.status) {
          const statusLabels: Record<string, string> = {
            'pending': '대기',
            'in-progress': '처리중',
            'completed': '완료',
            'cancelled': '취소',
          };

          // 배정된 사용자에게 알림 (본인이 아닌 경우)
          if (oldRecord.assignedToId && oldRecord.assignedToId !== currentUser.id) {
            addNotification({
              userId: oldRecord.assignedToId,
              type: 'maintenance_status_changed',
              title: '유지보수 상태 변경',
              message: `"${oldRecord.title}"의 상태가 ${statusLabels[oldRecord.status]}에서 ${statusLabels[updates.status]}(으)로 변경되었습니다.`,
              priority: 'normal',
              relatedResourceType: 'maintenance',
              relatedResourceId: id,
              actionUrl: `/maintenance/${id}`,
              isRead: false,
            });
          }

          // 완료 시 관리자에게 알림
          if (updates.status === 'completed') {
            users.forEach((user) => {
              if (user.role === 'admin' && user.id !== currentUser.id) {
                addNotification({
                  userId: user.id,
                  type: 'maintenance_completed',
                  title: '유지보수 작업 완료',
                  message: `${currentUser.name}님이 "${oldRecord.title}" 작업을 완료했습니다.`,
                  priority: 'normal',
                  relatedResourceType: 'maintenance',
                  relatedResourceId: id,
                  actionUrl: `/maintenance/${id}`,
                  isRead: false,
                });
              }
            });
          }
        }

        // 담당자 변경 알림
        if (updates.assignedToId && updates.assignedToId !== oldRecord.assignedToId) {
          addNotification({
            userId: updates.assignedToId,
            type: 'maintenance_assigned',
            title: '유지보수 작업 재배정',
            message: `${currentUser.name}님이 "${oldRecord.title}" 작업을 재배정했습니다.`,
            priority: 'high',
            relatedResourceType: 'maintenance',
            relatedResourceId: id,
            actionUrl: `/maintenance/${id}`,
            isRead: false,
          });
        }
      }
    } catch (error) {
      console.error('Error updating maintenance record:', error);
      throw error;
    }
  },

  updateSingleRecord: (id, updates) => {
    set((state) => ({
      maintenanceRecords: state.maintenanceRecords.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      )
    }));
  },

  deleteMaintenanceRecord: async (id) => {
    try {
      const response = await apiDelete(`${import.meta.env.VITE_API_URL}/maintenance/${id}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[deleteMaintenanceRecord] 삭제 실패:', errorText);
        throw new Error('Failed to delete maintenance record');
      }

      set((state) => ({
        maintenanceRecords: state.maintenanceRecords.filter((r) => r.id !== id)
      }));
    } catch (error) {
      console.error('Error deleting maintenance record:', error);
      throw error;
    }
  },

  uploadFile: async (maintenanceId, file, onProgress) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = useAuthStore.getState().token;
      if (!token) throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');

      const uploadedFile = await uploadWithProgress(
        `${import.meta.env.VITE_API_URL}/maintenance/${maintenanceId}/files`,
        formData,
        token,
        onProgress,
      );

      // 해당 레코드의 파일만 업데이트 (전체 목록 재조회 불필요)
      set((state) => ({
        maintenanceRecords: state.maintenanceRecords.map((r) =>
          r.id === maintenanceId
            ? { ...r, files: [...(r.files || []), uploadedFile] }
            : r
        ),
      }));

      return uploadedFile;
    } catch (error) {
      console.error('[uploadFile] Error uploading file:', error);
      throw error;
    }
  },

  deleteFile: async (fileId) => {
    try {
      const response = await apiDelete(`${import.meta.env.VITE_API_URL}/maintenance/files/${fileId}`);

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      // 해당 파일만 제거 (전체 목록 재조회 불필요)
      set((state) => ({
        maintenanceRecords: state.maintenanceRecords.map((r) => ({
          ...r,
          files: (r.files || []).filter((f) => f.id !== fileId),
        })),
      }));
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  addCompany: (company) => {
    set((state) => ({ companies: [...state.companies, company] }));

    // 알림 전송
    const currentUser = useAuthStore.getState().user;
    const { addNotification } = useNotificationStore.getState();
    const { users } = get();

    if (currentUser) {
      users.forEach((user) => {
        if (user.role === 'admin' && user.id !== currentUser.id) {
          addNotification({
            userId: user.id,
            type: 'company_created',
            title: '새 업체 추가',
            message: `${currentUser.name}님이 "${company.name}" 업체를 등록했습니다.`,
            priority: 'low',
            relatedResourceType: 'company',
            relatedResourceId: company.id,
            actionUrl: `/companies/${company.id}/edit`,
            isRead: false,
          });
        }
      });
    }
  },

  updateCompany: (id, company) =>
    set((state) => ({
      companies: state.companies.map((c) =>
        c.id === id ? { ...c, ...company } : c
      )
    })),

  deleteCompany: (id) =>
    set((state) => ({
      companies: state.companies.filter((c) => c.id !== id)
    })),

  addUser: (user) => {
    set((state) => ({ users: [...state.users, user] }));

    // 알림 전송
    const currentUser = useAuthStore.getState().user;
    const { addNotification } = useNotificationStore.getState();
    const { users } = get();

    if (currentUser) {
      users.forEach((u) => {
        if (u.role === 'admin' && u.id !== currentUser.id) {
          addNotification({
            userId: u.id,
            type: 'user_created',
            title: '새 사용자 등록',
            message: `${currentUser.name}님이 "${user.name}" 사용자를 등록했습니다.`,
            priority: 'low',
            relatedResourceType: 'user',
            relatedResourceId: user.id,
            actionUrl: `/users/${user.id}/edit`,
            isRead: false,
          });
        }
      });

      // 신규 사용자에게 환영 알림
      addNotification({
        userId: user.id,
        type: 'system_alert',
        title: '',
        message: `유지보수 관리 시스템에 오신 것을 환영합니다.`,
        priority: 'normal',
        isRead: false,
      });
    }
  },

  updateUser: (id, user) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, ...user } : u
      )
    })),

  deleteUser: (id) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== id)
    }))
}));
