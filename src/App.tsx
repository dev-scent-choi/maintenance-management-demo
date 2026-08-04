import React, { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import './styles/mobile.css';
import Layout from './components/common/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'));
const CompanyForm = lazy(() => import('./pages/CompanyForm'));
const MaintenanceList = lazy(() => import('./pages/MaintenanceList'));
const MaintenanceCalendar = lazy(() => import('./pages/MaintenanceCalendar'));
const Collaboration = lazy(() => import('./pages/Collaboration'));
const ProjectList = lazy(() => import('./pages/ProjectList'));
const ProjectForm = lazy(() => import('./pages/ProjectForm'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const ProjectBoard = lazy(() => import('./pages/ProjectBoard'));
const MilestoneManagement = lazy(() => import('./pages/MilestoneManagement'));
const IssueForm = lazy(() => import('./pages/IssueForm'));
const TaskForm = lazy(() => import('./pages/TaskForm'));
const Settings = lazy(() => import('./pages/Settings'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const UserForm = lazy(() => import('./pages/UserForm'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const RoleManagement = lazy(() => import('./pages/RoleManagement'));
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));
const WeeklyReport = lazy(() => import('./pages/WeeklyReport'));
const PdfOcr = lazy(() => import('./pages/PdfOcr'));
import { useAuthStore } from './store/authStore';
import { usePermissionStore } from './store/permissionStore';
import { isAdminAccount, hasPermission, type Permission } from './utils/permissions';
import { useSettingsStore } from './store/settingsStore';
import { useMaintenanceStore } from './store/maintenanceStore';
import { applyTheme } from './utils/themeConfig';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { isTokenValid, getTokenLifetime } from './utils/jwtUtils';

const queryClient = new QueryClient();

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const token = useAuthStore(state => state.token);

  // onRehydrateStorage에서 만료 토큰을 정리하므로 여기서는 체크만 수행
  // 렌더링 중 logout() 호출 금지 (무한 루프 유발)
  if (!isAuthenticated || !isTokenValid(token)) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

const AdminOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore(state => state.user);
  const t = useLanguage();
  if (!isAdminAccount(user)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9CA3AF', opacity: 0.5 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#6B7280' }}>{t('adminOnlyTitle')}</p>
        <p style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>{t('adminOnlyDesc')}</p>
      </div>
    );
  }
  return <>{children}</>;
};

const PermissionRoute: React.FC<{ permission: Permission; children: React.ReactNode }> = ({ permission, children }) => {
  const user = useAuthStore(state => state.user);
  const t = useLanguage();
  // permissionStore 구독 — 권한 변경/로드 시 즉시 재렌더링하여 반영
  usePermissionStore(state => state.rolePermissions);
  if (!hasPermission(user, permission)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9CA3AF', opacity: 0.5 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#6B7280' }}>{t('noPermissionTitle')}</p>
        <p style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>{t('noPermissionDesc')}</p>
      </div>
    );
  }
  return <>{children}</>;
};

function App() {
  const theme = useSettingsStore(state => state.settings.theme);
  const fontSize = useSettingsStore(state => state.settings.fontSize);
  const { user, checkTokenValidity, checkAndRefreshToken, isAuthenticated, updateLastActivity } = useAuthStore();
  const { users, addUser } = useMaintenanceStore();

  // 앱 시작 시 토큰 유효성 검증
  useEffect(() => {
    checkTokenValidity();
  }, [checkTokenValidity]);

  // 비활성 세션 만료 감지 — 타이머가 0이 되면 자동 로그아웃
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkInactivity = () => {
      const { token: t, lastActivityTime, isAuthenticated: auth } = useAuthStore.getState();
      if (!auth) return;
      const lifetime = getTokenLifetime(t);
      const secsSinceActivity = Math.floor((Date.now() - lastActivityTime) / 1000);
      if (secsSinceActivity >= lifetime) {
        useAuthStore.getState().logout();
      }
    };

    const inactivityId = setInterval(checkInactivity, 10000); // 10초마다 체크
    return () => clearInterval(inactivityId);
  }, [isAuthenticated]);

  // 사용자 활동 감지 및 토큰 자동 갱신
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // 초기 토큰 체크
    checkAndRefreshToken();

    // 주기적으로 토큰 체크 (1분마다)
    const intervalId = setInterval(() => {
      checkAndRefreshToken();
    }, 60000); // 1분

    // 사용자 활동 감지 (마우스 클릭, 키보드 입력 등)
    // 토큰 갱신은 apiClient가 매 응답마다 처리 — 여기서는 lastActivityTime만 갱신
    const activityEvents = ['mousedown', 'keydown', 'touchstart'];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleUserActivity = () => {
      // 연속 이벤트 디바운스 (300ms)
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        updateLastActivity(); // 마지막 활동 시간 갱신 (비활동 타임아웃 체크용)
      }, 300);
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      clearInterval(intervalId);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [isAuthenticated, checkAndRefreshToken, updateLastActivity]);

  // 로그인한 사용자를 users 목록에 추가
  useEffect(() => {
    if (user && !users.find(u => u.id === user.id)) {
      addUser(user);
    }
  }, [user, users, addUser]);

  // 테마 적용
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 폰트 크기 적용
  useEffect(() => {
    const fontSizeMap: Record<string, string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    document.documentElement.style.fontSize = fontSizeMap[fontSize] ?? '16px';
  }, [fontSize]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <HashRouter>
          <Toaster
            position="bottom-right"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
              duration: 3000,
            }}
          />
          <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="companies" element={<PermissionRoute permission="view_companies"><Companies /></PermissionRoute>} />
              <Route path="companies/new" element={<CompanyForm />} />
              <Route path="companies/:id" element={<PermissionRoute permission="view_companies"><CompanyDetail /></PermissionRoute>} />
              <Route path="companies/:id/edit" element={<CompanyForm />} />
              <Route path="maintenance" element={<PermissionRoute permission="view_maintenance"><MaintenanceList /></PermissionRoute>} />
              <Route path="maintenance/calendar" element={<PermissionRoute permission="view_maintenance"><MaintenanceCalendar /></PermissionRoute>} />
              <Route path="collaboration" element={<PermissionRoute permission="view_collaboration"><Collaboration /></PermissionRoute>} />
              <Route path="pdf-ocr" element={<AdminOnlyRoute><PdfOcr /></AdminOnlyRoute>} />
              <Route path="projects" element={<PermissionRoute permission="view_projects"><ProjectList /></PermissionRoute>} />
              <Route path="projects/new" element={<ProjectForm />} />
              <Route path="projects/:id" element={<PermissionRoute permission="view_projects"><ProjectDetail /></PermissionRoute>} />
              <Route path="projects/:id/edit" element={<ProjectForm />} />
              <Route path="projects/:id/board" element={<PermissionRoute permission="view_projects"><ProjectBoard /></PermissionRoute>} />
              <Route path="weekly-report" element={<PermissionRoute permission="view_weekly_report"><WeeklyReport /></PermissionRoute>} />

              <Route path="projects/:id/milestones" element={<PermissionRoute permission="view_projects"><MilestoneManagement /></PermissionRoute>} />
              <Route path="projects/:id/issues/new" element={<IssueForm />} />
              <Route path="projects/:id/issues/:issueId/edit" element={<IssueForm />} />
              <Route path="projects/:projectId/tasks/new" element={<TaskForm />} />
              <Route path="users" element={<PermissionRoute permission="view_users"><UserManagement /></PermissionRoute>} />
              <Route path="users/new" element={<UserForm />} />
              <Route path="users/:id/edit" element={<UserForm />} />
              <Route path="audit-logs" element={<PermissionRoute permission="view_audit_logs"><AuditLogs /></PermissionRoute>} />
              <Route path="roles" element={<PermissionRoute permission="view_roles"><RoleManagement /></PermissionRoute>} />
              <Route path="settings" element={<PermissionRoute permission="manage_settings"><Settings /></PermissionRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </HashRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;