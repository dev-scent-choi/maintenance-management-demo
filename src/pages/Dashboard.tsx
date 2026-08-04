import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowUpRight, ArrowDownRight, Calendar, ExternalLink,
  Clock, CheckCircle2, Activity, FolderKanban,
  AlertTriangle, Users, BarChart2, PauseCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettingsStore } from '../store/settingsStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useProjectStore } from '../store/projectStore';
import { themeConfigs } from '../utils/themeConfig';
import MaintenanceCreateModal from './MaintenanceCreateModal';

type TabType = 'overview' | 'maintenance' | 'project';

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const language = useSettingsStore((state) => state.settings.language);
  const themeColors = themeConfigs[theme];
  const { maintenanceRecords, fetchMaintenanceRecords, fetchCompanies, isLoading: maintenanceLoading } = useMaintenanceStore();
  const { projects, fetchProjects, isLoading: projectLoading } = useProjectStore();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [maintenanceModalId, setMaintenanceModalId] = useState<string | null>(null);
  const [overviewTrendPeriod, setOverviewTrendPeriod] = useState<'month' | 'quarter' | 'half' | 'year'>('month');
  const [maintenanceTrendPeriod, setMaintenanceTrendPeriod] = useState<'month' | 'quarter' | 'half' | 'year'>('month');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'in_progress' | 'planning' | 'on_hold' | 'completed' | 'cancelled' | 'all'>('all');
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchMaintenanceRecords(),
      fetchProjects(),
      fetchCompanies(),
    ]).finally(() => setDataLoaded(true));
  }, [fetchMaintenanceRecords, fetchProjects, fetchCompanies]);

  const isLoading = !dataLoaded || maintenanceLoading || projectLoading;

  const isDark = theme !== 'light';

  // Semantic colors (theme-aware)
  const sc = {
    pending:  isDark ? '#D29922' : '#9A6700',
    progress: isDark ? '#58A6FF' : '#2F9E44',
    done:     isDark ? '#3FB950' : '#0F7B6C',
    cancel:   isDark ? '#8B949E' : '#787774',
    urgent:   isDark ? '#F85149' : '#E03E3E',
    high:     isDark ? '#F0883E' : '#D9730D',
    bg: (c: string) => `${c}18`,
  };

  const cardStyle = {
    backgroundColor: themeColors.surface,
    borderRadius: '4px',
    border: `1px solid ${themeColors.border}`,
    boxShadow: 'none',
  };
  const liftBorder = isDark ? `1px solid rgba(255,255,255,0.12)` : `1px solid rgba(55,53,47,0.2)`;
  const cardHoverEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.border    = liftBorder;
    e.currentTarget.style.backgroundColor = themeColors.cardHover;
  };
  const cardHoverLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = '';
    e.currentTarget.style.border    = `1px solid ${themeColors.border}`;
    e.currentTarget.style.backgroundColor = themeColors.surface;
  };
  const subtleBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(55,53,47,0.03)';

  // ── 유지보수 통계 ──────────────────────────────────────────
  const maintenanceStats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthRecords = maintenanceRecords.filter(r => new Date(r.createdAt) >= thisMonth);
    const lastMonthRecords = maintenanceRecords.filter(
      r => new Date(r.createdAt) >= lastMonth && new Date(r.createdAt) <= lastMonthEnd
    );

    const pending = maintenanceRecords.filter(r => r.status === 'pending').length;
    const inProgress = maintenanceRecords.filter(r => r.status === 'in-progress').length;
    const completed = maintenanceRecords.filter(r => r.status === 'completed').length;
    const urgent = maintenanceRecords.filter(r => r.status === 'urgent').length;
    const onHold = maintenanceRecords.filter(r => r.status === 'on-hold').length;

    const thisMonthCount = thisMonthRecords.length;
    const lastMonthCount = lastMonthRecords.length;
    const monthChange = lastMonthCount > 0
      ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)
      : thisMonthCount > 0 ? 100 : 0;

    const completedThisMonth = thisMonthRecords.filter(r => r.status === 'completed').length;
    const completedLastMonth = lastMonthRecords.filter(r => r.status === 'completed').length;
    const completedChange = completedLastMonth > 0
      ? Math.round(((completedThisMonth - completedLastMonth) / completedLastMonth) * 100)
      : completedThisMonth > 0 ? 100 : 0;

    const completionRate = maintenanceRecords.length > 0
      ? Math.round((completed / maintenanceRecords.length) * 100)
      : 0;

    return {
      total: maintenanceRecords.length,
      pending, inProgress, completed, urgent, onHold,
      thisMonthCount, monthChange,
      completedThisMonth, completedChange,
      completionRate,
    };
  }, [maintenanceRecords]);

  // ── 프로젝트 통계 ──────────────────────────────────────────
  const projectStats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const planning = projects.filter(p => p.status === 'planning').length;
    const inProgress = projects.filter(p => p.status === 'in_progress').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const onHold = projects.filter(p => p.status === 'on_hold').length;

    const thisMonthProjects = projects.filter(p => new Date(p.createdAt) >= thisMonth);
    const lastMonthProjects = projects.filter(
      p => new Date(p.createdAt) >= lastMonth && new Date(p.createdAt) <= lastMonthEnd
    );
    const monthChange = lastMonthProjects.length > 0
      ? Math.round(((thisMonthProjects.length - lastMonthProjects.length) / lastMonthProjects.length) * 100)
      : thisMonthProjects.length > 0 ? 100 : 0;

    const avgProgress = projects.length > 0
      ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length)
      : 0;

    return { total: projects.length, planning, inProgress, completed, onHold, thisMonthCount: thisMonthProjects.length, monthChange, avgProgress };
  }, [projects]);

  // ── 월별 트렌드 ──────────────────────────────────────────
  const monthlyMaintenanceTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
      const recs = maintenanceRecords.filter(r => {
        const c = new Date(r.createdAt);
        return c >= date && c <= nextMonth;
      });
      return {
        shortMonth: date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short' }),
        total: recs.length,
        completed: recs.filter(r => r.status === 'completed').length,
      };
    });
  }, [maintenanceRecords, language]);

  // ── 기간별 트렌드 계산 ─────────────────────────────────────
  const computeTrend = (records: typeof maintenanceRecords, period: 'month' | 'quarter' | 'half' | 'year', lang: string) => {
    const now = new Date();
    const isKo = lang === 'ko';
    if (period === 'month') {
      return Array.from({ length: 6 }, (_, i) => {
        const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
        const recs = records.filter(r => { const c = new Date(r.createdAt); return c >= start && c <= end; });
        return { label: start.toLocaleDateString(isKo ? 'ko-KR' : 'en-US', { month: 'short' }), total: recs.length, completed: recs.filter(r => r.status === 'completed').length };
      });
    }
    if (period === 'quarter') {
      return Array.from({ length: 4 }, (_, i) => {
        const currentQ = Math.floor(now.getMonth() / 3);
        let q = currentQ - (3 - i);
        let y = now.getFullYear();
        while (q < 0) { q += 4; y--; }
        const startMonth = q * 3;
        const start = new Date(y, startMonth, 1);
        const end = new Date(y, startMonth + 3, 0);
        const recs = records.filter(r => { const c = new Date(r.createdAt); return c >= start && c <= end; });
        const label = isKo ? `${q + 1}분기 '${String(y).slice(2)}` : `Q${q + 1} '${String(y).slice(2)}`;
        return { label, total: recs.length, completed: recs.filter(r => r.status === 'completed').length };
      });
    }
    if (period === 'half') {
      return Array.from({ length: 4 }, (_, i) => {
        const currentH = now.getMonth() < 6 ? 0 : 1;
        let h = currentH - (3 - i);
        let y = now.getFullYear();
        while (h < 0) { h += 2; y--; }
        h = ((h % 2) + 2) % 2;
        const startMonth = h === 0 ? 0 : 6;
        const start = new Date(y, startMonth, 1);
        const end = new Date(y, startMonth + 6, 0);
        const recs = records.filter(r => { const c = new Date(r.createdAt); return c >= start && c <= end; });
        const label = isKo ? `${h === 0 ? '상' : '하'}반기 '${String(y).slice(2)}` : `H${h + 1} '${String(y).slice(2)}`;
        return { label, total: recs.length, completed: recs.filter(r => r.status === 'completed').length };
      });
    }
    // year
    return Array.from({ length: 4 }, (_, i) => {
      const y = now.getFullYear() - (3 - i);
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      const recs = records.filter(r => { const c = new Date(r.createdAt); return c >= start && c <= end; });
      return { label: String(y), total: recs.length, completed: recs.filter(r => r.status === 'completed').length };
    });
  };

  const overviewTrendData = useMemo(() => computeTrend(maintenanceRecords, overviewTrendPeriod, language), [maintenanceRecords, overviewTrendPeriod, language]);
  const maintenanceTrendData = useMemo(() => computeTrend(maintenanceRecords, maintenanceTrendPeriod, language), [maintenanceRecords, maintenanceTrendPeriod, language]);

  const monthlyProjectTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
      const monthProjects = projects.filter(p => {
        const c = new Date(p.createdAt);
        return c >= date && c <= nextMonth;
      });
      return {
        shortMonth: date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short' }),
        total: monthProjects.length,
        completed: monthProjects.filter(p => p.status === 'completed').length,
      };
    });
  }, [projects, language]);

  // ── 업체별 유지보수 현황 ──────────────────────────────────
  const companyMaintenanceDetails = useMemo(() => {
    const map = new Map<string, { companyId: string; companyName: string; count: number; completed: number; pending: number; inProgress: number; lastDate: Date | null; lastAssignedName: string | null }>();
    maintenanceRecords.forEach(r => {
      if (!r.companyId) return;
      const ex = map.get(r.companyId) || { companyId: r.companyId, companyName: r.companyName || t('unassigned'), count: 0, completed: 0, pending: 0, inProgress: 0, lastDate: null, lastAssignedName: null };
      ex.count++;
      if (r.status === 'completed') ex.completed++;
      if (r.status === 'pending') ex.pending++;
      if (r.status === 'in-progress') ex.inProgress++;
      const d = new Date(r.createdAt);
      if (!ex.lastDate || d > ex.lastDate) { ex.lastDate = d; ex.lastAssignedName = r.assignedToName || null; }
      map.set(r.companyId, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [maintenanceRecords, t]);


  // ── 사용자별 처리 현황 ────────────────────────────────────
  const userMaintenanceRanking = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; inProgress: number; pending: number }>();
    maintenanceRecords.forEach(r => {
      if (!r.assignedToName) return;
      const ex = map.get(r.assignedToName) || { name: r.assignedToName, total: 0, completed: 0, inProgress: 0, pending: 0 };
      ex.total++;
      if (r.status === 'completed') ex.completed++;
      if (r.status === 'in-progress') ex.inProgress++;
      if (r.status === 'pending') ex.pending++;
      map.set(r.assignedToName, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.completed - a.completed);
  }, [maintenanceRecords]);

  // ── 처리 필요 항목 (우선순위 정렬) ───────────────────────
  const actionRequiredItems = useMemo(() => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return maintenanceRecords
      .filter(r => r.status === 'pending' || r.status === 'in-progress')
      .sort((a, b) => {
        const ap = priorityOrder[a.priority] ?? 3;
        const bp = priorityOrder[b.priority] ?? 3;
        if (ap !== bp) return ap - bp;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [maintenanceRecords]);

  // ── 긴급 카운트 ──────────────────────────────────────
  const urgentAndDelayedCount = useMemo(() => {
    return maintenanceRecords.filter(r =>
      r.priority === 'urgent' && r.status !== 'completed'
    ).length;
  }, [maintenanceRecords]);

  // ── 최근 유지보수 (모바일·데스크톱 공용) ───────────────────
  const recentMaintenance = useMemo(() =>
    [...maintenanceRecords]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [maintenanceRecords]
  );

  // ── 진행중 프로젝트 (전체) ────────────────────────────────
  const allInProgressProjects = useMemo(() =>
    projects.filter(p => p.status === 'in_progress').sort((a, b) => (b.progress || 0) - (a.progress || 0)),
    [projects]
  );

  // ── 종료 임박 (D-7, 아직 미초과) ────────────────────────
  const upcomingDeadlineCount = useMemo(() => {
    const now = Date.now();
    const sevenDaysLater = now + 7 * 24 * 60 * 60 * 1000;
    return projects.filter(p =>
      p.status === 'in_progress' && p.dueDate &&
      new Date(p.dueDate as Date).getTime() >= now &&
      new Date(p.dueDate as Date).getTime() <= sevenDaysLater
    ).length;
  }, [projects]);

  // ── 지연 프로젝트 (마감일 초과, 아직 진행중) ─────────────
  const delayedProjectCount = useMemo(() =>
    projects.filter(p =>
      p.status === 'in_progress' && p.dueDate &&
      new Date(p.dueDate as Date).getTime() < Date.now()
    ).length,
    [projects]
  );

  // ── 상태별 필터링 프로젝트 ────────────────────────────────
  const filteredProjectsByStatus = useMemo(() => {
    let filtered = projectStatusFilter === 'all' ? [...projects] : projects.filter(p => p.status === projectStatusFilter);
    if (projectStatusFilter === 'in_progress') {
      const withDate = filtered.filter(p => p.dueDate).sort((a, b) => new Date(a.dueDate as Date).getTime() - new Date(b.dueDate as Date).getTime());
      return [...withDate, ...filtered.filter(p => !p.dueDate)];
    }
    if (projectStatusFilter === 'all') {
      const order: Record<string, number> = { in_progress: 0, planning: 1, on_hold: 2, completed: 3, cancelled: 4 };
      return filtered.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
    }
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [projects, projectStatusFilter]);


  const tabs = [
    { key: 'overview' as const, label: t('overview') },
    { key: 'maintenance' as const, label: t('maintenance') },
    { key: 'project' as const, label: t('projectsMenu') },
  ];

  const getMobileStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':     return { label: t('statusWaiting'),    color: sc.pending,  bg: sc.bg(sc.pending) };
      case 'in-progress': return { label: t('statusProcessing'),  color: sc.progress, bg: sc.bg(sc.progress) };
      case 'completed':   return { label: t('statusCompleted'),   color: sc.done,     bg: sc.bg(sc.done) };
      case 'cancelled':   return { label: t('statusCancelled'),   color: sc.cancel,   bg: sc.bg(sc.cancel) };
      default:            return { label: status, color: themeColors.textSecondary, bg: subtleBg };
    }
  };

  // ── 헬퍼 함수 ─────────────────────────────────────────────
  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });

  const getDaysAgo = (date: Date) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days === 0) return t('today');
    if (days === 1) return t('daysAgo1');
    return t('daysAgoN', { count: days });
  };

  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case 'urgent': return { label: t('priorityUrgent'), color: sc.urgent,  bg: sc.bg(sc.urgent) };
      case 'high':   return { label: t('priorityHigh'),   color: sc.high,    bg: sc.bg(sc.high) };
      case 'medium': return { label: t('priorityMedium'), color: sc.pending, bg: sc.bg(sc.pending) };
      default:       return { label: t('priorityLow'),    color: sc.cancel,  bg: sc.bg(sc.cancel) };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': case 'planning': return sc.pending;
      case 'in-progress': case 'in_progress': return sc.progress;
      case 'completed': return sc.done;
      case 'cancelled': case 'on_hold': return sc.cancel;
      default: return themeColors.textSecondary;
    }
  };
  const getNotionBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending')                            return isDark ? { bg: '#3A2D0F', text: '#E3B060' } : { bg: '#FAF3DD', text: '#C17F2A' };
    if (s === 'in-progress' || s === 'in_progress' || s === 'active') return isDark ? { bg: '#1C3829', text: '#6DC47A' } : { bg: '#DBEDDB', text: '#1D7B52' };
    if (s === 'completed')                          return isDark ? { bg: '#1B3C32', text: '#4DC09F' } : { bg: '#D3F0E5', text: '#0F7B6C' };
    if (s === 'cancelled')                          return isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' };
    if (s === 'urgent')                             return isDark ? { bg: '#3B1219', text: '#F85149' } : { bg: '#FDECEA', text: '#C5221F' };
    if (s === 'on-hold')                            return isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' };
    if (s === 'planning')                           return isDark ? { bg: '#3A2D0F', text: '#E3B060' } : { bg: '#FAF3DD', text: '#C17F2A' };
    if (s === 'on_hold')                            return isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' };
    return isDark ? { bg: '#2F2F2F', text: '#999898' } : { bg: '#E3E2E0', text: '#787774' };
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t('statusWaiting');
      case 'in-progress': case 'in_progress': return t('inProgress');
      case 'completed': return t('statusCompleted');
      case 'cancelled': return t('statusCancelled');
      case 'urgent': return t('statusUrgent');
      case 'on-hold': return t('statusOnHold');
      case 'planning': return t('planning');
      case 'on_hold': return t('onHold');
      default: return status;
    }
  };

  const getDDay = (dueDate: Date | string) => {
    const days = Math.ceil((new Date(dueDate as Date).getTime() - Date.now()) / 86400000);
    if (days < 0)  return { label: `D+${Math.abs(days)}`, color: sc.urgent,   urgent: true };
    if (days === 0) return { label: 'D-Day',              color: sc.urgent,   urgent: true };
    if (days <= 7)  return { label: `D-${days}`,          color: sc.high,     urgent: true };
    if (days <= 30) return { label: `D-${days}`,          color: sc.pending,  urgent: false };
    return              { label: `D-${days}`,              color: sc.done,     urgent: false };
  };

  const getCompanyBadgeColor = (id: string) => {
    const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // ══════════════════════════════════════════════════════════
  //  차트 컴포넌트
  // ══════════════════════════════════════════════════════════

  const BarChart = ({ data, height = 200 }: { data: { label: string; value: number; value2?: number }[]; height?: number }) => {
    const [hovBarIdx, setHovBarIdx] = useState<number | null>(null);
    const maxValue = Math.max(...data.flatMap(d => [d.value, d.value2 || 0]), 1);
    const hasSecondary = data.some(d => d.value2 !== undefined);
    const barAreaH = height - 28;
    const tooltipBg = isDark ? '#C9D1D9' : '#37352F';
    const tooltipColor = isDark ? '#0D1117' : '#FFFFFF';
    return (
      <div style={{ height }}>
        <div className="relative" style={{ height: barAreaH }}>
          {[0.25, 0.5, 0.75].map(ratio => (
            <div key={ratio} className="absolute left-0 right-0 pointer-events-none" style={{ height: '1px', bottom: `${ratio * 100}%`, background: themeColors.border }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1.5">
            {data.map((item, i) => {
              const primaryH = Math.max((item.value / maxValue) * 100, 1.5);
              const secondaryH = item.value2 !== undefined ? Math.max((item.value2 / maxValue) * 100, 1.5) : 0;
              const isHov = hovBarIdx === i;
              return (
                <div key={i} className="flex-1 h-full flex items-end justify-center gap-0.5 relative"
                  onMouseEnter={() => setHovBarIdx(i)} onMouseLeave={() => setHovBarIdx(null)}>
                  {isHov && (
                    <div className="absolute pointer-events-none z-10" style={{ bottom: `calc(${primaryH}% + 6px)`, left: '50%', transform: 'translateX(-50%)', backgroundColor: tooltipBg, color: tooltipColor, fontSize: '10px', fontWeight: 700, padding: '3px 7px', borderRadius: '4px', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
                      {item.label}: {item.value}{hasSecondary && item.value2 !== undefined ? ` / ${item.value2}` : ''}
                    </div>
                  )}
                  {!isHov && item.value > 0 && (
                    <span className="absolute pointer-events-none" style={{ bottom: `${primaryH}%`, right: hasSecondary ? '38%' : '18%', transform: 'translateY(-3px)', fontSize: '9px', fontWeight: 700, color: themeColors.textSecondary, lineHeight: 1 }}>
                      {item.value}
                    </span>
                  )}
                  {hasSecondary && item.value2 !== undefined && (
                    <div style={{ width: '38%', height: `${secondaryH}%`, backgroundColor: `${themeColors.primary}${isHov ? '80' : '59'}`, borderRadius: '4px 4px 0 0', transition: 'background-color 150ms' }} />
                  )}
                  <div style={{ width: hasSecondary ? '38%' : '55%', height: `${primaryH}%`, backgroundColor: themeColors.primary, borderRadius: '4px 4px 0 0', opacity: isHov ? 0.72 : 1, transition: 'opacity 150ms' }} />
                </div>
              );
            })}
          </div>
          <div className="absolute bottom-0 left-0 right-0" style={{ height: '1px', background: themeColors.border }} />
        </div>
        <div className="flex gap-1.5 mt-2">
          {data.map((d, i) => (
            <span key={i} className="flex-1 text-center" style={{ fontSize: '10px', color: hovBarIdx === i ? themeColors.primary : themeColors.textSecondary, fontWeight: hovBarIdx === i ? 700 : 400 }}>{d.label}</span>
          ))}
        </div>
      </div>
    );
  };

  const DonutChart = ({ segments, size = 120, hoveredIdx = null }: { segments: { value: number; color: string; label: string }[]; size?: number; hoveredIdx?: number | null }) => {
    const total = segments.reduce((acc, s) => acc + s.value, 0);
    if (total === 0) return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xs" style={{ color: themeColors.textSecondary }}>No data</span>
      </div>
    );
    const gapPct = 0.8;
    let cumulative = 0;
    const gradientParts: string[] = [];
    segments.forEach(s => {
      if (s.value === 0) return;
      const pct = (s.value / total) * 100;
      const start = cumulative;
      const end = cumulative + pct;
      const halfGap = gapPct / 2;
      gradientParts.push(`${themeColors.surface} ${start}% ${Math.min(start + halfGap, end)}%`);
      gradientParts.push(`${s.color} ${Math.min(start + halfGap, end)}% ${Math.max(end - halfGap, start + halfGap)}%`);
      gradientParts.push(`${themeColors.surface} ${Math.max(end - halfGap, start + halfGap)}% ${end}%`);
      cumulative = end;
    });
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <div className="rounded-full" style={{ width: size, height: size, background: `conic-gradient(${gradientParts.join(', ')})` }} />
        <div className="absolute rounded-full flex items-center justify-center" style={{ width: size * 0.58, height: size * 0.58, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: themeColors.surface, boxShadow: `0 0 0 1px ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`, transition: 'all 150ms' }}>
          <div className="text-center">
            {hoveredIdx !== null && segments[hoveredIdx] ? (
              <>
                <p style={{ fontSize: '16px', fontWeight: 700, color: segments[hoveredIdx].color, lineHeight: 1.1 }}>{segments[hoveredIdx].value}</p>
                <p style={{ fontSize: '8px', color: themeColors.textSecondary, lineHeight: 1.3, maxWidth: `${size * 0.48}px` }}>{segments[hoveredIdx].label}</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '18px', fontWeight: 700, color: themeColors.text, lineHeight: 1.1 }}>{total}</p>
                <p style={{ fontSize: '9px', color: themeColors.textSecondary }}>{t('total')}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const LineChart = ({ data, height = 160 }: { data: { label: string; value: number }[]; height?: number }) => {
    const [hovLineIdx, setHovLineIdx] = useState<number | null>(null);
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const padding = { top: 15, bottom: 8, left: 5, right: 5 };
    const chartHeight = height - padding.top - padding.bottom;
    const svgH = height - 18;
    const getX = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * (100 - padding.left - padding.right);
    const getY = (v: number) => padding.top + (1 - v / maxValue) * chartHeight;
    const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
    const smoothPath = (pts: { x: number; y: number }[]) => {
      if (pts.length < 2) return '';
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const cpX = (pts[i].x + pts[i + 1].x) / 2;
        d += ` C ${cpX},${pts[i].y} ${cpX},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
      }
      return d;
    };
    const linePath = smoothPath(points);
    const lastPt = points[points.length - 1] ?? { x: 0, y: 0 };
    const firstPt = points[0] ?? { x: 0, y: 0 };
    const areaPath = points.length >= 2 ? `${linePath} L ${lastPt.x},${padding.top + chartHeight} L ${firstPt.x},${padding.top + chartHeight} Z` : '';
    const tooltipBg = isDark ? '#C9D1D9' : '#37352F';
    const tooltipColor = isDark ? '#0D1117' : '#FFFFFF';
    return (
      <div style={{ height }}>
        <svg className="w-full" style={{ height: svgH }} viewBox={`0 0 100 ${svgH}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={themeColors.primary} stopOpacity="0.35" />
              <stop offset="75%" stopColor={themeColors.primary} stopOpacity="0.05" />
              <stop offset="100%" stopColor={themeColors.primary} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((ratio, i) => (
            <line key={i} x1={padding.left} y1={padding.top + ratio * chartHeight} x2={100 - padding.right} y2={padding.top + ratio * chartHeight} stroke={themeColors.border} strokeWidth="0.4" />
          ))}
          {areaPath && <path d={areaPath} fill="url(#lineAreaGradient)" />}
          {linePath && <path d={linePath} fill="none" stroke={themeColors.primary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.18" />}
          {linePath && <path d={linePath} fill="none" stroke={themeColors.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={hovLineIdx === i ? 4.5 : 2.8} fill={themeColors.surface} stroke={themeColors.primary} strokeWidth="1.5" style={{ transition: 'r 150ms' }} />
              <circle cx={p.x} cy={p.y} r={hovLineIdx === i ? 2.2 : 1.2} fill={themeColors.primary} style={{ transition: 'r 150ms' }} />
              {/* invisible hover target */}
              <circle cx={p.x} cy={p.y} r="5" fill="transparent" onMouseEnter={() => setHovLineIdx(i)} onMouseLeave={() => setHovLineIdx(null)} style={{ cursor: 'pointer' }} />
              {hovLineIdx === i && (
                <foreignObject x={Math.min(Math.max(p.x - 18, 0), 60)} y={Math.max(p.y - 26, 0)} width="36" height="20">
                  <div style={{ backgroundColor: tooltipBg, color: tooltipColor, fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '3px', textAlign: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
                    {data[i].value}
                  </div>
                </foreignObject>
              )}
            </g>
          ))}
        </svg>
        <div className="flex justify-between px-1 mt-0.5">
          {data.map((d, i) => <span key={i} style={{ fontSize: '9px', color: hovLineIdx === i ? themeColors.primary : themeColors.textSecondary, fontWeight: hovLineIdx === i ? 700 : 400 }}>{d.label}</span>)}
        </div>
      </div>
    );
  };

  // ── 업체 테이블 ───────────────────────────────────────────
  const CompanyTable = ({
    items,
    type,
  }: {
    items: { companyId: string; companyName: string; count: number; completed: number; inProgress?: number; pending?: number; lastDate: Date | null; lastAssignedName?: string | null }[];
    type: 'maintenance' | 'project';
  }) => {
    const getStatusInfo = (item: typeof items[0]) => {
      if ((item.inProgress || 0) > 0) return { label: t('inProgress'), color: sc.progress };
      if ((item.pending || 0) > 0) return { label: t('statusWaiting'), color: sc.pending };
      if (item.completed > 0) return { label: t('statusCompleted'), color: sc.done };
      return { label: '-', color: themeColors.textSecondary };
    };
    const cols = type === 'maintenance' ? '1fr 60px 60px 96px' : '1fr 60px 60px 90px';
    const lastColHeader = type === 'maintenance' ? t('lastProcessedDate') : t('recentDate');
    if (items.length === 0) return (
      <div className="flex items-center justify-center h-full">
        <p className="text-center text-xs" style={{ color: themeColors.textSecondary }}>{t('noData')}</p>
      </div>
    );
    return (
      <div className="overflow-hidden">
        <div className="grid gap-3 px-2 py-2 text-xs font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: cols, color: themeColors.textSecondary, borderBottom: `1px solid ${themeColors.border}` }}>
          <div>{t('company')}</div>
          <div className="text-center">{t('caseCount')}</div>
          <div className="text-center">{t('status')}</div>
          <div className="text-right">{lastColHeader}</div>
        </div>
        <div className="divide-y" style={{ borderColor: themeColors.border }}>
          {items.map(item => {
            const statusInfo = getStatusInfo(item);
            return (
              <div key={item.companyId} className="grid gap-3 px-2 py-2.5 items-center cursor-pointer transition-colors" style={{ gridTemplateColumns: cols }}
                onClick={() => navigate(`/companies/${item.companyId}`)}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = subtleBg)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block" style={{ color: themeColors.text }}>{item.companyName}</span>
                </div>
                <div className="text-center"><span className="text-sm font-bold" style={{ color: themeColors.text }}>{item.count}</span></div>
                <div className="text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `${statusInfo.color}15`, color: statusInfo.color }}>{statusInfo.label}</span>
                </div>
                <div className="text-right">
                  {type === 'maintenance' ? (
                    <>
                      {item.lastAssignedName && (
                        <p className="text-xs font-medium truncate" style={{ color: themeColors.text }}>{item.lastAssignedName}</p>
                      )}
                      {item.lastDate ? (
                        <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>
                          {new Date(item.lastDate).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { day: '2-digit', month: 'short' })}
                        </p>
                      ) : <span className="text-xs" style={{ color: themeColors.textSecondary }}>-</span>}
                    </>
                  ) : (
                    item.lastDate ? (
                      <p className="text-xs font-medium" style={{ color: themeColors.text }}>
                        {new Date(item.lastDate).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { day: '2-digit', month: 'short' })}
                      </p>
                    ) : <span className="text-xs" style={{ color: themeColors.textSecondary }}>-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  //  공통 UI 컴포넌트
  // ══════════════════════════════════════════════════════════

  const MetricCard = ({
    label, value, change, suffix,
    icon: Icon, iconColor,
  }: {
    label: string; value: number | string; change?: number; suffix?: string;
    icon?: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
    iconColor?: string;
  }) => (
    <div className="p-5" style={cardStyle}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>{label}</p>
        {Icon && (
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${iconColor || themeColors.primary}15` }}>
            <Icon size={16} color={iconColor || themeColors.primary} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-semibold tracking-tight" style={{ color: themeColors.text }}>{value}{suffix}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1 mb-1">
            {change >= 0 ? <ArrowUpRight size={15} strokeWidth={2.5} color={sc.done} /> : <ArrowDownRight size={15} strokeWidth={2.5} color={sc.urgent} />}
            <span className="text-sm font-semibold" style={{ color: change >= 0 ? sc.done : sc.urgent }}>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
    </div>
  );

  const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: () => void }) => (
    <div className="flex items-start justify-between mb-2">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: themeColors.text }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={action} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
          <span className="text-xs font-semibold" style={{ color: themeColors.primary }}>{t('viewAll')}</span>
          <ExternalLink size={12} style={{ color: themeColors.primary }} />
        </button>
      )}
    </div>
  );

  const periodOptions: Array<{ key: 'month' | 'quarter' | 'half' | 'year'; label: string }> = [
    { key: 'month',   label: t('periodMonth') },
    { key: 'quarter', label: t('periodQuarter') },
    { key: 'half',    label: t('periodHalf') },
    { key: 'year',    label: t('periodYear') },
  ];

  const PeriodToggle = ({ value, onChange }: { value: 'month' | 'quarter' | 'half' | 'year'; onChange: (p: 'month' | 'quarter' | 'half' | 'year') => void }) => (
    <div className="flex items-center gap-0.5 p-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.06)' }}>
      {periodOptions.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="px-2 py-0.5 text-xs rounded-lg transition-colors"
          style={{
            backgroundColor: value === o.key ? themeColors.primary : 'transparent',
            color: value === o.key ? '#fff' : themeColors.textSecondary,
            fontWeight: value === o.key ? 600 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════════
  //  렌더
  // ══════════════════════════════════════════════════════════
  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-10 py-8 rounded"
          style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <svg className="animate-spin w-9 h-9" viewBox="0 0 24 24" fill="none" style={{ color: themeColors.primary }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" />
          </svg>
          <span className="font-medium text-sm" style={{ color: themeColors.textSecondary }}>
            대시보드 데이터를 불러오는 중...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ═══ 모바일 뷰 (md 미만) ═══ */}
      <div className="md:hidden overflow-y-auto pb-6 space-y-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>
              {t('greeting')}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>
              {new Date().toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* 통계 카드 2×2 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4" style={{ ...cardStyle }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={13} style={{ color: sc.pending }} />
              <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
                {t('statusWaiting')}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: themeColors.text }}>{maintenanceStats.pending}</p>
          </div>
          <div className="p-4" style={{ ...cardStyle }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={13} style={{ color: sc.progress }} />
              <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
                {t('statusProcessing')}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: themeColors.text }}>{maintenanceStats.inProgress}</p>
          </div>
          <div className="p-4" style={{ ...cardStyle }}>
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 size={13} style={{ color: sc.done }} />
              <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
                {t('doneThisMonth')}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: themeColors.text }}>{maintenanceStats.completedThisMonth}</p>
          </div>
          <div className="p-4" style={{ ...cardStyle }}>
            <div className="flex items-center gap-1.5 mb-2">
              <FolderKanban size={13} style={{ color: themeColors.primary }} />
              <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
                {t('activeProjectsLabel')}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: themeColors.text }}>{projectStats.inProgress}</p>
          </div>
        </div>

        {/* 최근 유지보수 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: themeColors.text }}>
              {t('recentMaintenance')}
            </h2>
            <button onClick={() => navigate('/maintenance')} className="text-xs font-semibold" style={{ color: themeColors.primary }}>
              {t('viewAll')}
            </button>
          </div>
          <div className="space-y-2">
            {recentMaintenance.length === 0 ? (
              <div className="flex items-center justify-center text-sm rounded" style={{ color: themeColors.textSecondary, backgroundColor: subtleBg, minHeight: '120px' }}>
                {t('noMaintenanceRecords')}
              </div>
            ) : recentMaintenance.map((record) => {
              const badge = getMobileStatusBadge(record.status);
              return (
                <div
                  key={record.id}
                  onClick={() => setMaintenanceModalId(record.id)}
                  className="flex items-center justify-between p-3 rounded cursor-pointer active:opacity-70 transition-opacity"
                  style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-semibold truncate" style={{ color: themeColors.text }}>{record.companyName}{record.workType ? ` · ${record.workType}` : ''}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: themeColors.textSecondary }}>{stripHtml(record.description) || record.title}</p>
                  </div>
                  <span className="flex-shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ═══ 데스크톱 뷰 (md 이상) ═══ */}
      <div className="hidden md:flex flex-col gap-3 h-full overflow-hidden">

      {/* ── 탭 헤더 ── */}
      <div className="flex items-center justify-between" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-5 py-3.5 text-sm font-medium transition-all"
              style={activeTab === tab.key ? { color: themeColors.primary } : { color: themeColors.textSecondary }}
            >
              <span>{tab.label}</span>
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: themeColors.primary }} />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 rounded-lg text-xs" style={{ height: '36px', backgroundColor: subtleBg, color: themeColors.textSecondary }}>
          <Calendar size={13} />
          <span>{new Date().toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          개요 탭
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">

          {/* 현재 상태 — 4등분 균일 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">

            {/* 유지보수 대기 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/maintenance?status=pending')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('maintenancePending')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.pending}15` }}>
                  <Clock size={14} color={sc.pending} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{maintenanceStats.pending}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('ofTotalCount', { count: maintenanceStats.total })}
              </p>
            </div>

            {/* 유지보수 진행중 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/maintenance?status=in-progress')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('maintenanceInProgress')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.progress}15` }}>
                  <Activity size={14} color={sc.progress} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{maintenanceStats.inProgress}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('currentWorkload')}
              </p>
            </div>

            {/* 프로젝트 진행중 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/projects?status=in_progress')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('projectsActiveCount')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${themeColors.primary}15` }}>
                  <FolderKanban size={14} color={themeColors.primary} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{projectStats.inProgress}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('ofTotalCount', { count: projectStats.total })}
              </p>
            </div>

            {/* 이번달 유지보수 완료 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/maintenance?status=completed')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('maintenanceCompletedMonth')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.done}15` }}>
                  <CheckCircle2 size={14} color={sc.done} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{maintenanceStats.completedThisMonth}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {maintenanceStats.completedChange > 0 ? '+' : ''}{maintenanceStats.completedChange}%{' '}
                {t('vsLastMonth')}
              </p>
            </div>

          </div>

          {/* 차트 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-2">
            {/* 유지보수 추이 */}
            <div className="lg:col-span-3 p-3 pb-2" style={cardStyle}>
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: themeColors.text }}>{t('maintenanceTrend')}</h3>
                  <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>{t('monthlyRequestAndCompletion')}</p>
                </div>
                <PeriodToggle value={overviewTrendPeriod} onChange={setOverviewTrendPeriod} />
              </div>
              <div className="flex items-center gap-5 mb-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: `${themeColors.primary}59` }} />
                  <span style={{ color: themeColors.textSecondary }}>{t('request')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: themeColors.primary }} />
                  <span style={{ color: themeColors.textSecondary }}>{t('statusCompleted')}</span>
                </div>
              </div>
              <BarChart data={overviewTrendData.map(m => ({ label: m.label, value: m.completed, value2: m.total }))} height={130} />
            </div>

            {/* 현재 상태 요약 (게이지 대신 명확한 수치+바) */}
            <div className="lg:col-span-2 p-3 pb-2" style={cardStyle}>
              <SectionHeader title={t('statusOverview')} />
              <div className="space-y-2 mt-1.5">
                {[
                  { label: t('maintenancePending'), value: maintenanceStats.pending, total: maintenanceStats.total, color: sc.pending, path: '/maintenance?status=pending' },
                  { label: t('maintenanceInProgress'), value: maintenanceStats.inProgress, total: maintenanceStats.total, color: sc.progress, path: '/maintenance?status=in-progress' },
                  { label: t('projectInProgress'), value: projectStats.inProgress, total: Math.max(projectStats.total, 1), color: themeColors.primary, path: '/projects?status=in_progress' },
                  { label: t('statusCompleted'), value: maintenanceStats.completed, total: maintenanceStats.total, color: sc.done, path: '/maintenance?status=completed' },
                ].map(item => {
                  const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                  return (
                    <div key={item.label} className="px-2 py-1.5 rounded transition-colors" style={{ cursor: 'pointer' }}
                      onClick={() => navigate(item.path)}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = subtleBg)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: themeColors.textSecondary }}>{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                          <span className="text-xs" style={{ color: themeColors.textSecondary }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: themeColors.border }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 최근 유지보수 + 진행중 프로젝트 */}
          <div className="flex flex-col lg:flex-row gap-2 flex-1 min-h-0">
            <div className="lg:flex-1 overflow-hidden flex flex-col min-h-0" style={cardStyle}>
              <div className="p-3 flex-none" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                <SectionHeader title={t('recentMaintenance')} action={() => navigate('/maintenance')} />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {recentMaintenance.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs" style={{ color: themeColors.textSecondary, minHeight: '80px' }}>{t('noData')}</div>
                ) : recentMaintenance.map(record => (
                  <div key={record.id} onClick={() => setMaintenanceModalId(record.id)} className="flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors duration-150"
                    style={{ borderBottom: `1px solid ${themeColors.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = subtleBg)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: themeColors.text }}>{record.companyName}{record.workType ? ` · ${record.workType}` : ''}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: themeColors.textSecondary }}>{stripHtml(record.description) || record.title}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {(() => { const nb = getNotionBadge(record.status); return (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: nb.bg, color: nb.text, borderRadius: '3px' }}>
                          {getStatusLabel(record.status)}
                        </span>
                      ); })()}
                      <span className="text-sm w-14 text-right" style={{ color: themeColors.textSecondary }}>{formatDate(record.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:flex-1 p-3 flex flex-col min-h-0" style={cardStyle}>
              <SectionHeader title={t('inProgressProjects')} action={() => navigate('/projects')} />
              <div className={`mt-2 flex-1 overflow-y-auto min-h-0 ${allInProgressProjects.length === 0 ? 'flex flex-col items-center justify-center' : 'space-y-2'}`}>
                {allInProgressProjects.slice(0, 5).length === 0 ? (
                  <>
                    <FolderKanban size={32} style={{ color: themeColors.textSecondary, marginBottom: '10px' }} />
                    <p className="text-sm font-medium mb-3" style={{ color: themeColors.text }}>
                      {t('noProjectsInProgress')}
                    </p>
                    <button
                      onClick={() => navigate('/projects/new')}
                      className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}
                    >
                      {'+ ' + t('newProjectRegistration')}
                    </button>
                  </>
                ) : allInProgressProjects.slice(0, 5).map(project => (
                  <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="px-3 py-2.5 rounded cursor-pointer"
                    style={{ backgroundColor: subtleBg, transition: 'transform 200ms ease, background-color 150ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.backgroundColor = subtleBg; }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: themeColors.text }}>{project.name}</p>
                        <p className="text-xs truncate" style={{ color: themeColors.textSecondary }}>{project.companyName || '-'}</p>
                      </div>
                      <span className="text-sm font-bold ml-2 flex-shrink-0" style={{ color: themeColors.primary }}>{project.progress || 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ backgroundColor: themeColors.border }}>
                      <div className="h-full rounded-full" style={{ width: `${project.progress || 0}%`, backgroundColor: themeColors.primary }} />
                    </div>
                    <div className="flex items-center justify-between text-xs mt-0.5">
                      <span style={{ color: themeColors.textSecondary }}>
                        {project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : ''}{(project.startDate || project.dueDate) ? ' ~ ' : ''}{project.dueDate ? new Date(project.dueDate).toISOString().slice(0, 10) : ''}
                      </span>
                      {project.managerName && (
                        <span className="font-medium" style={{ color: themeColors.textSecondary }}>PM: {project.managerName}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          유지보수 탭
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'maintenance' && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">

          {/* ── 1. 상태 카드 5개: 대기, 진행중, 완료, 긴급, 보류 ── */}
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">

            {/* 대기 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/maintenance?status=pending')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('statusWaiting')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.pending}15` }}>
                  <Clock size={14} color={sc.pending} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{maintenanceStats.pending}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('awaitingAction')}
              </p>
            </div>

            {/* 진행중 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/maintenance?status=in-progress')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('statusProcessing')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.progress}15` }}>
                  <Activity size={14} color={sc.progress} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{maintenanceStats.inProgress}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('currentWorkload')}
              </p>
            </div>

            {/* 완료 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/maintenance?status=completed')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('statusCompleted')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.done}15` }}>
                  <CheckCircle2 size={14} color={sc.done} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{maintenanceStats.completed}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('ofTotalCount', { count: maintenanceStats.total })}
              </p>
            </div>

            {/* 긴급 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/maintenance?status=urgent')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('statusUrgent')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.urgent}15` }}>
                  <AlertTriangle size={14} color={sc.urgent} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: maintenanceStats.urgent > 0 ? sc.urgent : themeColors.text }}>{maintenanceStats.urgent}</p>
              <p className="text-xs mt-1" style={{ color: maintenanceStats.urgent > 0 ? sc.urgent : themeColors.textSecondary }}>
                {t('urgentNeedsAttention')}
              </p>
            </div>

            {/* 보류 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/maintenance?status=on-hold')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('statusOnHold')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.cancel}15` }}>
                  <PauseCircle size={14} color={sc.cancel} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{maintenanceStats.onHold}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('currentlyOnHold')}
              </p>
            </div>

          </div>

          {/* ── 2. 차트 (좌 60% / 우 40%) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-2">

            {/* 좌측: 월별 추이 바 차트 */}
            <div className="lg:col-span-3 p-3" style={cardStyle}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: themeColors.text }}>{t('monthlyStatus')}</h3>
                  <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>{t('requestAndCompletionTrend')}</p>
                </div>
                <PeriodToggle value={maintenanceTrendPeriod} onChange={setMaintenanceTrendPeriod} />
              </div>
              <div className="flex items-center gap-5 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: `${themeColors.primary}59` }} />
                  <span style={{ color: themeColors.textSecondary }}>{t('request')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: themeColors.primary }} />
                  <span style={{ color: themeColors.textSecondary }}>{t('statusCompleted')}</span>
                </div>
              </div>
              <BarChart data={maintenanceTrendData.map(m => ({ label: m.label, value: m.completed, value2: m.total }))} height={130} />
            </div>

            {/* 우측: 현재 상태 요약 */}
            <div className="lg:col-span-2 p-3" style={cardStyle}>
              <SectionHeader title={t('statusOverview')} />
              <div className="space-y-1.5 mt-1.5">
                {[
                  { label: t('statusWaiting'), value: maintenanceStats.pending, color: sc.pending },
                  { label: t('inProgress'), value: maintenanceStats.inProgress, color: sc.progress },
                  { label: t('statusCompleted'), value: maintenanceStats.completed, color: sc.done },
                  { label: t('statusUrgent'), value: maintenanceStats.urgent, color: sc.urgent },
                  { label: t('statusOnHold'), value: maintenanceStats.onHold, color: sc.cancel },
                ].map(item => {
                  const pct = maintenanceStats.total > 0 ? Math.round((item.value / maintenanceStats.total) * 100) : 0;
                  return (
                    <div key={item.label} className="px-2 py-1.5 rounded transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = subtleBg)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: themeColors.textSecondary }}>{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                          <span className="text-xs" style={{ color: themeColors.textSecondary }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: themeColors.border }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* ── 3/4/5. 하단 2단 레이아웃 ── */}
          <div className="flex flex-col lg:flex-row gap-2 flex-1 min-h-0">

            {/* ── 좌 (55%): 처리 필요 ── */}
            <div className="lg:flex-[5_5_0%] flex flex-col min-h-0" style={cardStyle}>

              {/* 헤더 */}
              <div className="px-4 py-3 flex-none flex items-center justify-between" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: themeColors.text }}>
                      {t('actionRequiredLabel')}{actionRequiredItems.length > 0 && <> <span className="font-bold">({actionRequiredItems.length}{language === 'ko' ? '건' : ''})</span></>}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>
                      {actionRequiredItems.length > 0 ? t('sortedByPriority') : t('allItemsResolved')}
                    </p>
                  </div>
                </div>
                <button onClick={() => navigate('/maintenance')} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                  <span className="text-xs font-semibold" style={{ color: themeColors.primary }}>{t('viewAll')}</span>
                  <ExternalLink size={12} style={{ color: themeColors.primary }} />
                </button>
              </div>

              {/* 목록 or 빈 상태 */}
              {actionRequiredItems.length === 0 ? (
                <div className="py-12 text-center flex-1">
                  <CheckCircle2 size={36} color={sc.done} style={{ margin: '0 auto 12px' }} />
                  <p className="text-sm font-medium" style={{ color: themeColors.text }}>
                    {t('noItemsRequireAction')}
                  </p>
                  <p className="text-xs mt-1.5" style={{ color: themeColors.textSecondary }}>
                    {t('allRequestsResolved')}
                  </p>
                  <button
                    onClick={() => navigate('/maintenance/new')}
                    className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}
                  >
                    {t('newRequestBtn')}
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto min-h-0">
                  {actionRequiredItems.map(record => {
                    const priorityInfo = getPriorityInfo(record.priority);
                    const isInProgress = record.status === 'in-progress';
                    const leftBarColor = isInProgress ? sc.progress : sc.pending;
                    return (
                      <div
                        key={record.id}
                        onClick={() => navigate(`/maintenance/${record.id}`)}
                        className="flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors duration-150"
                        style={{ borderBottom: `1px solid ${themeColors.border}` }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = subtleBg)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* [업체명 · 작업유형] + 내용 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug font-medium truncate" style={{ color: themeColors.text }}>
                            <span className="font-semibold">{record.companyName || '-'}</span>
                            {record.workType && <><span style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }}> · </span><span style={{ color: themeColors.textSecondary }}>{record.workType}</span></>}
                          </p>
                          <p className="text-xs truncate mt-0.5" style={{ color: themeColors.textSecondary }}>{stripHtml(record.description) || record.title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {(() => { const nb = getNotionBadge(record.status); return (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: nb.bg, color: nb.text, borderRadius: '3px' }}>
                                {getStatusLabel(record.status)}
                              </span>
                            ); })()}
                          </div>
                        </div>
                        {/* 담당자 + 경과일 */}
                        <div className="text-right flex-shrink-0">
                          {record.assignedToName && (
                            <p className="text-xs font-medium" style={{ color: themeColors.text }}>{record.assignedToName}</p>
                          )}
                          <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>{getDaysAgo(record.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── 우 (45%): 업체별 현황 + 사용자별 처리 현황 ── */}
            <div className="lg:flex-[4_4_0%] flex flex-col gap-3 min-h-0">

              {/* 업체별 현황 */}
              <div className="flex flex-col flex-1" style={cardStyle}>
                <div className="px-3 pt-3 pb-2 flex-none" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                  <SectionHeader title={t('companyStatus')} subtitle={t('top5Companies')} action={() => navigate('/companies')} />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 p-3">
                  <CompanyTable items={companyMaintenanceDetails} type="maintenance" />
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          프로젝트 탭
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'project' && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">

          {/* ── 1. 위기 관리 지표 4카드 ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">

            {/* 지연 */}
            <div className="p-2.5" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('projectDelayed')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.urgent}15` }}>
                  <AlertTriangle size={14} color={sc.urgent} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: delayedProjectCount > 0 ? sc.urgent : themeColors.text }}>{delayedProjectCount}</p>
              <p className="text-xs mt-1" style={{ color: delayedProjectCount > 0 ? sc.urgent : themeColors.textSecondary }}>
                {t('pastDueDate')}
              </p>
            </div>

            {/* 종료 임박 */}
            <div className="p-2.5" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('dueSoonD7')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.high}15` }}>
                  <Clock size={14} color={sc.high} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: upcomingDeadlineCount > 0 ? sc.high : themeColors.text }}>{upcomingDeadlineCount}</p>
              <p className="text-xs mt-1" style={{ color: upcomingDeadlineCount > 0 ? sc.high : themeColors.textSecondary }}>
                {t('dueWithin7Days')}
              </p>
            </div>

            {/* 진행중 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/projects?status=in_progress')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('statusProcessing')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.progress}15` }}>
                  <Activity size={14} color={sc.progress} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{projectStats.inProgress}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('currentlyActive')}
              </p>
            </div>

            {/* 완료 */}
            <div className="p-2.5 cursor-pointer" style={{ ...cardStyle, transition: 'transform 200ms ease, box-shadow 200ms ease, border 200ms ease' }} onClick={() => navigate('/projects?status=completed')} onMouseEnter={cardHoverEnter} onMouseLeave={cardHoverLeave}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
                  {t('statusCompleted')}
                </p>
                <div className="p-1.5 rounded" style={{ backgroundColor: `${sc.done}15` }}>
                  <CheckCircle2 size={14} color={sc.done} strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: themeColors.text }}>{projectStats.completed}</p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {t('ofTotalCount', { count: projectStats.total })}
              </p>
            </div>

          </div>

          {/* ── 2. 프로젝트 현황 (상태 필터) ── */}
          <div className="flex-1 min-h-0 flex flex-col" style={cardStyle}>
            {/* 헤더 + 상태 필터 */}
            <div className="px-4 py-3 flex-none flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: sc.bg(sc.progress) }}>
                  <Calendar size={16} color={sc.progress} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: themeColors.text }}>
                    {t('dashboardProjectStatus')}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>
                    {t('sortedByDueDate')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {([
                  { key: 'all',         label: t('all') },
                  { key: 'planning',    label: t('projectStatusPlanning') },
                  { key: 'in_progress', label: t('statusProcessing') },
                  { key: 'on_hold',     label: t('statusOnHold') },
                  { key: 'completed',   label: t('statusCompleted') },
                  { key: 'cancelled',   label: t('statusCancelled') },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setProjectStatusFilter(f.key)}
                    className="px-2.5 py-1 text-xs rounded-lg transition-all"
                    style={{
                      backgroundColor: projectStatusFilter === f.key ? themeColors.primary : 'transparent',
                      color: projectStatusFilter === f.key ? (theme === 'yellow' ? '#333' : '#fff') : themeColors.textSecondary,
                      fontWeight: projectStatusFilter === f.key ? 600 : 400,
                      border: `1px solid ${projectStatusFilter === f.key ? themeColors.primary : themeColors.border}`,
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 목록 */}
            {filteredProjectsByStatus.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1">
                <FolderKanban size={36} style={{ color: themeColors.textSecondary, marginBottom: '12px' }} />
                <p className="text-sm font-medium mb-4" style={{ color: themeColors.text }}>
                  {t('noProjectsFound')}
                </p>
                <button onClick={() => navigate('/projects/new')} className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80" style={{ backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>
                  {'+ ' + t('newProjectRegistration')}
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredProjectsByStatus.map(project => {
                  const isCompleted = project.status === 'completed';
                  const progress = isCompleted ? 100 : (project.progress || 0);
                  const deadline = (!isCompleted && project.dueDate) ? getDDay(project.dueDate) : null;
                  const isOverdue = deadline?.label.startsWith('D+');
                  const progressColor = isCompleted ? sc.done : isOverdue ? sc.urgent : deadline?.urgent ? sc.high : getStatusColor(project.status);
                  const nb = getNotionBadge(project.status);
                  return (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-150"
                      style={{ borderBottom: `1px solid ${themeColors.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = subtleBg)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* 상태 뱃지 */}
                      <div className="flex-shrink-0 pt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: nb.bg, color: nb.text, borderRadius: '3px', whiteSpace: 'nowrap' }}>
                          {getStatusLabel(project.status)}
                        </span>
                      </div>
                      {/* 프로젝트명 + 업체 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: themeColors.text }}>{project.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs truncate" style={{ color: themeColors.textSecondary }}>{project.companyName || '-'}</span>
                          {project.managerName && (
                            <span className="text-xs font-medium flex-shrink-0" style={{ color: themeColors.textSecondary }}>
                              PM: {project.managerName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: themeColors.textSecondary }}>
                            {project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : ''}
                            {(project.startDate || project.dueDate) ? ' ~ ' : ''}
                            {project.dueDate ? new Date(project.dueDate as Date).toISOString().slice(0, 10) : ''}
                          </span>
                          {deadline && (
                            <span className="text-xs font-bold flex-shrink-0" style={{ color: deadline.color }}>
                              {deadline.label}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* 진척도 */}
                      <div className="w-20 flex-shrink-0 pt-1">
                        <div className="flex items-center justify-end mb-1">
                          <span className="text-xs font-bold" style={{ color: progressColor }}>{progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: themeColors.border }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: progressColor }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
      </div>

      <MaintenanceCreateModal
        isOpen={maintenanceModalId !== null}
        recordId={maintenanceModalId}
        onClose={() => setMaintenanceModalId(null)}
        onUpdated={() => setMaintenanceModalId(null)}
      />
    </>
  );
};

export default Dashboard;
