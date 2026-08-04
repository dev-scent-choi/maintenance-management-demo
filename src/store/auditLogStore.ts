import { create } from 'zustand';
import type { AuditLog } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL + '';

interface AuditLogState {
  logs: AuditLog[];
  loading: boolean;
  error: string | null;
  fetchLogs: (filters?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
  }) => Promise<void>;
  addLog: (log: {
    userId?: string;
    userName?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    details: string;
    changes?: { field: string; oldValue: string; newValue: string; }[];
  }) => Promise<void>;
  clearLogs: () => Promise<void>;
  setLogs: (logs: AuditLog[]) => void;
}

const getAuthToken = () => {
  const authData = localStorage.getItem('auth-storage');
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed.state?.token;
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const useAuditLogStore = create<AuditLogState>()((set) => ({
  logs: [],
  loading: false,
  error: null,

  fetchLogs: async (filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.action) params.append('action', filters.action);
      if (filters?.resourceType) params.append('resourceType', filters.resourceType);
      if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/audit-logs?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('로그를 가져오는데 실패했습니다.');
      }

      const data = await response.json();

      // 백엔드에서 받은 데이터를 프론트엔드 형식으로 변환, 토큰 갱신 이력 제외
      const isTokenRefreshLog = (log: any) => {
        const action = (log.action || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        return (
          action === 'token_refresh' ||
          action === 'refresh' ||
          details.includes('토큰 갱신') ||
          details.includes('token refresh') ||
          details.includes('refresh-token') ||
          details.includes('refresh token')
        );
      };

      const logs = data
        .filter((log: any) => !isTokenRefreshLog(log))
        .map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));

      set({ logs, loading: false });
    } catch (error: any) {
      set({ error: error.message || '로그를 가져오는데 실패했습니다.', loading: false });
    }
  },

  addLog: async (log) => {
    try {
      const token = getAuthToken();
      await fetch(`${API_BASE}/audit-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(log),
      });
    } catch (error: any) {
      console.error('로그 기록 실패:', error);
    }
  },

  clearLogs: async () => {
    set({ loading: true, error: null });
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/audit-logs`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('로그 삭제에 실패했습니다.');
      }

      set({ logs: [], loading: false });
    } catch (error: any) {
      set({ error: error.message || '로그 삭제에 실패했습니다.', loading: false });
    }
  },

  setLogs: (logs) => set({ logs }),
}));
