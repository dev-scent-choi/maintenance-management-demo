import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MaintenanceCreateModal from './MaintenanceCreateModal';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Grid3X3, List, LayoutGrid, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import type { MaintenanceRecord } from '../types';

const MaintenanceCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const language = useSettingsStore((state) => state.settings.language);
  const themeColors = themeConfigs[theme];
  const locale = language === 'ko' ? 'ko-KR' : 'en-US';
  const { maintenanceRecords, fetchMaintenanceRecords } = useMaintenanceStore();

  useEffect(() => { fetchMaintenanceRecords(); }, [fetchMaintenanceRecords]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // 현재 월의 시작일과 마지막일
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // 달력 시작일 (월요일 시작)
  const calendarStart = new Date(monthStart);
  const dayOfWeek = monthStart.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  calendarStart.setDate(calendarStart.getDate() - daysToSubtract);

  // 달력 종료일 (일요일 종료)
  const calendarEnd = new Date(monthEnd);
  const endDayOfWeek = monthEnd.getDay();
  const daysToAdd = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
  calendarEnd.setDate(calendarEnd.getDate() + daysToAdd);

  // 필터링된 유지보수 기록
  const filteredRecords = useMemo(() => {
    return maintenanceRecords.filter((record) => {
      if (selectedStatus !== 'all' && record.status !== selectedStatus) return false;
      if (user?.role === 'user' && record.assignedToId !== user.id) return false;
      return true;
    });
  }, [maintenanceRecords, selectedStatus, user]);

  // 레코드의 주요 날짜 가져오기 (requestDate > startDate > createdAt 순)
  const getRecordDate = (record: MaintenanceRecord): Date | null => {
    const date = record.requestDate || record.startDate || record.createdAt;
    return date ? new Date(date) : null;
  };

  // 날짜별 유지보수 기록 그룹화
  const recordsByDate = useMemo(() => {
    const map = new Map<string, MaintenanceRecord[]>();

    filteredRecords.forEach((record) => {
      const primaryDate = getRecordDate(record);
      if (primaryDate) {
        const dateKey = primaryDate.toDateString();
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(record);
      }
      if (record.expectedCompletionDate) {
        const dateKey = new Date(record.expectedCompletionDate).toDateString();
        if (!map.has(dateKey)) map.set(dateKey, []);
        if (!map.get(dateKey)!.find((r) => r.id === record.id)) {
          map.get(dateKey)!.push(record);
        }
      }
    });

    return map;
  }, [filteredRecords]);

  // 달력 날짜 생성
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(calendarStart);

    while (current <= calendarEnd) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [calendarStart, calendarEnd]);

  // 이전/다음 월 이동
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // 오늘로 이동
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 이벤트 색상
  const getEventColor = (record: MaintenanceRecord) => {
    const colors = [
      { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },     // blue
      { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },     // pink
      { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },     // amber
      { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },     // green
      { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' },     // indigo
      { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },     // red
    ];
    const index = parseInt(record.id, 10) % colors.length || 0;
    return colors[index];
  };

  // 시간 포맷
  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    const hours = d.getHours();
    const minutes = d.getMinutes();
    if (hours === 0 && minutes === 0) return '';
    const period = hours >= 12 ? 'p' : 'a';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${String(minutes).padStart(2, '0')}${period}`;
  };

  // rgb()/hex 색상에 투명도를 적용해 rgba() 반환
  const toRgba = (color: string, opacity: number) => {
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
  };

  const todayBackground = theme === 'light'
    ? `linear-gradient(135deg, ${toRgba(themeColors.primary, 0.18)}, ${toRgba(themeColors.secondary, 0.12)})`
    : `linear-gradient(135deg, ${toRgba(themeColors.primary, 0.72)}, ${toRgba(themeColors.secondary, 0.62)})`;

  // 요일 헤더 (월요일 시작) — 언어 설정에 따라 표시
  const weekDays = [
    t('monday'), t('tuesday'), t('wednesday'), t('thursday'),
    t('friday'), t('saturday'), t('sunday'),
  ];

  return (
    <div className="flex flex-col md:h-[calc(100vh-120px)]" style={{ minHeight: '0' }}>
      {/* Calendar Container */}
      <div
        className="rounded-xl overflow-hidden flex flex-col flex-1"
        style={{
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
        }}
      >
        {/* Header */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 flex-shrink-0"
          style={{ borderBottom: `1px solid ${themeColors.border}` }}
        >
          {/* Left: Back Button + View Mode Toggles */}
          <div className="flex items-center gap-2">
            {/* Back Button */}
            <button
              onClick={() => navigate('/maintenance')}
              className="w-8 h-8 flex items-center justify-center rounded transition-opacity hover:opacity-60"
              style={{ color: themeColors.textSecondary }}
            >
              <ArrowLeft size={18} />
            </button>

            {/* View Mode Toggles */}
            <div className="flex items-center gap-1">
              {[
                { mode: 'month' as const, icon: CalendarIcon, label: 'Month' },
                { mode: 'week' as const, icon: Grid3X3, label: 'Week' },
                { mode: 'day' as const, icon: LayoutGrid, label: 'Day' },
                { mode: 'list' as const, icon: List, label: 'Agenda' },
              ].map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => {
                    if (mode === 'month') {
                      setViewMode(mode);
                    } else {
                      toast('추후 개발할 예정입니다.', {
                        icon: '🚧',
                        style: {
                          borderRadius: '10px',
                          background: theme !== 'light' ? '#333' : '#fff',
                          color: theme !== 'light' ? '#fff' : '#333',
                        },
                      });
                    }
                  }}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    backgroundColor: viewMode === mode
                      ? (theme !== 'light' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                      : 'transparent',
                    color: viewMode === mode ? themeColors.text : themeColors.textSecondary,
                  }}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg transition-all hover:bg-opacity-10"
              style={{ color: themeColors.textSecondary }}
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold min-w-[160px] text-center" style={{ color: themeColors.text }}>
              {language === 'ko'
                ? `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`
                : `${currentDate.toLocaleString(locale, { month: 'long' })} ${currentDate.getFullYear()}`}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg transition-all hover:bg-opacity-10"
              style={{ color: themeColors.textSecondary }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
            >
              {t('today')}
            </button>
            <button
              onClick={() => {
                toast('추후 개발할 예정입니다.', {
                  icon: '🚧',
                  style: {
                    borderRadius: '10px',
                    background: theme !== 'light' ? '#333' : '#fff',
                    color: theme !== 'light' ? '#fff' : '#333',
                  },
                });
              }}
              className="p-2 rounded-lg transition-all"
              style={{
                backgroundColor: showFilter ? `${themeColors.primary}20` : 'transparent',
                color: showFilter ? themeColors.primary : themeColors.textSecondary,
              }}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div
          className="grid grid-cols-7 flex-shrink-0"
          style={{ borderBottom: `1px solid ${themeColors.border}` }}
        >
          {weekDays.map((day, index) => (
            <div
              key={day}
              className="py-3 text-center text-sm font-medium"
              style={{
                color: index === 5 ? '#3B82F6' : index === 6 ? '#EF4444' : themeColors.textSecondary,
                borderRight: index < 6 ? `1px solid ${themeColors.border}` : 'none',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {calendarDays.map((date, index) => {
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isToday = date.toDateString() === new Date().toDateString();
            const dayRecords = recordsByDate.get(date.toDateString()) || [];
            const dayOfWeek = date.getDay();
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const maxVisible = 3;

            return (
              <div
                key={index}
                className="min-h-[70px] md:min-h-[100px] p-1 relative"
                style={{
                  borderRight: (index + 1) % 7 !== 0 ? `1px solid ${themeColors.border}` : 'none',
                  borderBottom: `1px solid ${themeColors.border}`,
                  background: isToday
                    ? todayBackground
                    : !isCurrentMonth
                    ? (theme !== 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)')
                    : 'transparent',
                }}
              >
                {/* Date Number */}
                <div className="flex justify-end mb-1">
                  <span
                    className="text-sm font-medium"
                    style={{
                      backgroundColor: 'transparent',
                      color: !isCurrentMonth
                        ? themeColors.textSecondary
                        : isSunday
                        ? '#EF4444'
                        : isSaturday
                        ? '#3B82F6'
                        : themeColors.text,
                      opacity: isCurrentMonth ? 1 : 0.5,
                    }}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {dayRecords.slice(0, maxVisible).map((record) => {
                    const eventColor = getEventColor(record);
                    const eventDate = getRecordDate(record);
                    return (
                      <div
                        key={record.id}
                        onClick={(e) => { e.stopPropagation(); setDetailId(record.id); }}
                        className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] cursor-pointer truncate transition-all hover:opacity-75"
                        style={{
                          backgroundColor: eventColor.bg,
                          color: eventColor.text,
                          borderLeft: `3px solid ${eventColor.border}`,
                        }}
                        title={record.title}
                      >
                        <span className="font-bold flex-shrink-0">{formatTime(eventDate)}</span>
                        <span className="truncate">{record.title}</span>
                      </div>
                    );
                  })}
                  {dayRecords.length > maxVisible && (
                    <button
                      className="text-[11px] px-1.5 py-0.5 font-medium transition-all hover:underline"
                      style={{ color: themeColors.textSecondary }}
                    >
                      +{dayRecords.length - maxVisible} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        <Plus size={24} />
      </button>

      <MaintenanceCreateModal
        isOpen={detailId !== null || showCreateModal}
        recordId={detailId}
        onClose={() => { setDetailId(null); setShowCreateModal(false); }}
        onCreated={fetchMaintenanceRecords}
        onUpdated={fetchMaintenanceRecords}
      />
    </div>
  );
};

export default MaintenanceCalendar;
