import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { useAuditLogStore } from './auditLogStore';
import { isTokenValid, isTokenExpiringSoon } from '../utils/jwtUtils';
import { usePermissionStore } from './permissionStore';
import { setAuthStateGetter } from '../utils/apiClient';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isRefreshing: boolean;
  lastActivityTime: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkTokenValidity: () => void;
  refreshToken: () => Promise<void>;
  checkAndRefreshToken: () => Promise<void>;
  updateLastActivity: () => void;
  updateToken: (newToken: string) => void;
  updateCurrentUserProfile: (profileImage: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isRefreshing: false,
      lastActivityTime: Date.now(),
      login: async (email: string, password: string) => {
        try {
          // 백엔드 API 호출
          const response = await fetch(import.meta.env.VITE_API_URL + '/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              password,
            }),
          });

          if (!response.ok) {
            let errorData;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              errorData = await response.json();
            } else {
              errorData = { message: '로그인에 실패했습니다.' };
            }
            throw new Error(errorData.message || '로그인에 실패했습니다.');
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('서버 응답 형식이 올바르지 않습니다.');
          }

          const data = await response.json();

          // 사용자 정보 매핑 (백엔드 응답의 user 객체 사용)
          const userData = data.user;
          const user: User = {
            id: userData.id?.toString() || '1',
            email: userData.email || email,
            name: userData.name,
            role: userData.role?.toLowerCase() || 'user',
            phone: userData.phone || '',
            department: userData.department || '',
            position: userData.position || '',
            projectAssignments: [],
            accountStatus: userData.active ? 'active' : 'inactive'
          };

          // 인증 완료 (토큰 + 사용자 + isAuthenticated 동시 설정)
          set({ user, token: data.token, isAuthenticated: true, lastActivityTime: Date.now() });

          // 로그인 직후 DB 권한 로드 — 완료 후 Sidebar/PermissionRoute 즉시 갱신
          await usePermissionStore.getState().fetchPermissions();

          // 로그인 감사 로그 기록
          useAuditLogStore.getState().addLog({
            userId: user.id,
            userName: user.name,
            action: 'login',
            resourceType: 'system',
            details: `${user.name}(${email})이(가) 로그인했습니다.`,
          });
        } catch (error) {
          console.error('로그인 오류:', error);
          throw error;
        }
      },
      logout: () => {
        const currentUser = get().user;

        // 로그아웃 감사 로그 기록
        if (currentUser) {
          useAuditLogStore.getState().addLog({
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'logout',
            resourceType: 'system',
            details: `${currentUser.name}이(가) 로그아웃했습니다.`,
          });
        }

        set({ user: null, token: null, isAuthenticated: false });
        // 로그아웃 시 권한 store 초기화
        usePermissionStore.getState().reset();
      },
      checkTokenValidity: () => {
        const { token, isAuthenticated } = get();

        // 인증 상태이지만 토큰이 유효하지 않으면 로그아웃
        if (isAuthenticated && !isTokenValid(token)) {
          get().logout();
        }
      },
      refreshToken: async () => {
        const { token, isRefreshing } = get();

        // 이미 갱신 중이면 무시
        if (isRefreshing) {
          return;
        }

        if (!token) {
          return;
        }

        try {
          set({ isRefreshing: true });

          const response = await fetch(import.meta.env.VITE_API_URL + '/auth/refresh-token', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('토큰 갱신에 실패했습니다.');
          }

          const data = await response.json();

          // 새 토큰으로 업데이트
          const userData = data.user;
          const user: User = {
            id: userData.id?.toString() || get().user?.id || '1',
            email: userData.email || get().user?.email || '',
            name: userData.name || get().user?.name || '',
            role: userData.role?.toLowerCase() || get().user?.role || 'user',
            phone: userData.phone || get().user?.phone || '',
            department: userData.department || get().user?.department || '',
            position: userData.position || get().user?.position || '',
            projectAssignments: get().user?.projectAssignments || [],
            accountStatus: (userData.active ? 'active' : 'inactive') as 'active' | 'inactive' | 'suspended'
          };

          set({
            user,
            token: data.token,
            isAuthenticated: true
          });

        } catch (error) {
          console.error('[authStore] 토큰 갱신 실패:', error);
          // 토큰이 실제로 만료된 경우에만 로그아웃
          // (네트워크 에러 등 일시적 오류로 인한 불필요한 로그아웃 방지)
          if (!isTokenValid(get().token)) {
            get().logout();
          }
        } finally {
          set({ isRefreshing: false });
        }
      },
      checkAndRefreshToken: async () => {
        const { token, isAuthenticated, isRefreshing } = get();

        if (!isAuthenticated || !token || isRefreshing) {
          return;
        }

        // 토큰이 15분 이내로 만료될 예정이면 갱신
        // (기존 10분에서 확대 — 활동 감지 throttle 5분 + interval 1분 여유 포함)
        if (isTokenExpiringSoon(token, 15)) {
          await get().refreshToken();
        }
      },
      updateLastActivity: () => {
        set({ lastActivityTime: Date.now() });
      },
      updateToken: (newToken: string) => {
        // 응답 헤더에서 받은 새 토큰으로 즉시 교체 (세션 유효 시간 초기화)
        set({ token: newToken, lastActivityTime: Date.now() });
      },
      updateCurrentUserProfile: (profileImage: string) => {
        const current = get().user;
        if (current) set({ user: { ...current, profileImage } });
      },
    }),
    {
      name: 'auth-storage',
      // lastActivityTime, isRefreshing은 localStorage에 저장하지 않음
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // localStorage에서 복구된 직후 토큰 유효성 검사
        if (state && state.isAuthenticated && !isTokenValid(state.token)) {
          state.isAuthenticated = false;
          state.token = null;
          state.user = null;
        }
        // 페이지 복원 시 활동 시간 초기화
        if (state) {
          state.lastActivityTime = Date.now();
        }
        // 새로고침 후 세션이 유효하면 DB 권한 재로드
        // queueMicrotask: onRehydrateStorage는 create() 안에서 동기 실행됨
        // setAuthStateGetter()는 create() 이후 실행 → microtask 큐로 밀어야 _getAuthState가 세팅된 후 호출됨
        if (state && state.isAuthenticated && isTokenValid(state.token)) {
          queueMicrotask(() => usePermissionStore.getState().fetchPermissions());
        }
      },
    }
  )
);

// authStore 초기화 완료 후 apiClient에 getter 등록 → 순환 의존성 해소
setAuthStateGetter(() => useAuthStore.getState());
