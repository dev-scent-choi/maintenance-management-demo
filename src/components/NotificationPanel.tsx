import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCircle2, AlertCircle, Trash2, Settings, CheckCheck } from 'lucide-react';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import type { Notification } from '../types';

const NotificationPanel: React.FC = () => {
  const navigate = useNavigate();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const language = useSettingsStore((state) => state.settings.language);
  const themeColors = themeConfigs[theme];
  const { user } = useAuthStore();
  const { getUserNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // 알림 로드
  useEffect(() => {
    if (!user) return;

    const userNotifications = getUserNotifications(user.id);
    setNotifications(userNotifications);
    setUnreadCount(getUnreadCount(user.id));
  }, [user, getUserNotifications, getUnreadCount]);

  // 실시간 업데이트 (1초마다 체크)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const userNotifications = getUserNotifications(user.id);
      setNotifications(userNotifications);
      setUnreadCount(getUnreadCount(user.id));
    }, 1000);

    return () => clearInterval(interval);
  }, [user, getUserNotifications, getUnreadCount]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 알림 클릭 핸들러
  const handleNotificationClick = (notification: Notification) => {
    if (!user) return;

    markAsRead(notification.id);

    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    } else if (notification.relatedResourceId) {
      if (notification.relatedResourceType === 'maintenance') {
        navigate(`/maintenance/${notification.relatedResourceId}`);
      } else if (notification.relatedResourceType === 'company') {
        navigate(`/companies/${notification.relatedResourceId}/edit`);
      } else if (notification.relatedResourceType === 'user') {
        navigate(`/users/${notification.relatedResourceId}/edit`);
      }
    }

    setIsOpen(false);
  };

  // 알림 삭제
  const handleDelete = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    deleteNotification(notificationId);
  };

  // 모두 읽음 표시
  const handleMarkAllAsRead = () => {
    if (!user) return;
    markAllAsRead(user.id);
  };

  // 타입별 아이콘 및 색상
  const getNotificationStyle = (notification: Notification) => {
    const typeConfigs = {
      maintenance_created: {
        color: '#3B82F6',
        bg: 'rgba(59, 130, 246, 0.1)',
        label: t('created'),
      },
      maintenance_assigned: {
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.1)',
        label: t('taskAssigned'),
      },
      maintenance_status_changed: {
        color: '#8B5CF6',
        bg: 'rgba(139, 92, 246, 0.1)',
        label: t('statusChange'),
      },
      maintenance_completed: {
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.1)',
        label: t('statusCompleted'),
      },
      user_created: {
        color: '#06B6D4',
        bg: 'rgba(6, 182, 212, 0.1)',
        label: t('users'),
      },
      user_updated: {
        color: '#06B6D4',
        bg: 'rgba(6, 182, 212, 0.1)',
        label: t('users'),
      },
      company_created: {
        color: '#14B8A6',
        bg: 'rgba(20, 184, 166, 0.1)',
        label: t('company'),
      },
      company_updated: {
        color: '#14B8A6',
        bg: 'rgba(20, 184, 166, 0.1)',
        label: t('company'),
      },
      system_alert: {
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        label: t('system'),
      },
      task_assigned: {
        color: '#8B5CF6',
        bg: 'rgba(139, 92, 246, 0.1)',
        label: t('taskAssignment'),
      },
      system: {
        color: '#6B7280',
        bg: 'rgba(107, 114, 128, 0.1)',
        label: t('system'),
      },
    };

    return typeConfigs[notification.type];
  };

  // 우선순위 배지
  const getPriorityColor = (priority: Notification['priority']) => {
    const colors = {
      high: '#EF4444',
      normal: '#3B82F6',
      low: '#6B7280',
    };
    return colors[priority];
  };

  // 시간 포맷
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('daysAgo', { count: diffDays });

    return new Date(date).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div ref={panelRef} className="relative">
      {/* 알림 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl transition-all duration-200 group"
        style={{
          backgroundColor: isOpen
            ? theme === 'dark'
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.05)'
            : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor =
              theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <Bell size={20} className="transition-colors" style={{ color: themeColors.textSecondary }} />
        {unreadCount > 0 && (
          <>
            <span
              className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"
              style={{ boxShadow: `0 0 0 2px ${themeColors.surface}` }}
            ></span>
            <span
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ boxShadow: `0 0 0 2px ${themeColors.surface}` }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        )}
      </button>

      {/* 알림 패널 */}
      {isOpen && (
        <div
          className="fixed sm:absolute right-0 sm:right-0 left-0 sm:left-auto top-16 sm:top-auto sm:mt-2 w-full sm:w-96 sm:max-w-96 rounded-none sm:rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            backgroundColor: themeColors.surface,
            border: `1px solid ${themeColors.border}`,
            maxHeight: '600px',
          }}
        >
          {/* 헤더 */}
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderColor: themeColors.border,
            }}
          >
            <div className="flex items-center space-x-2">
              <Bell size={18} style={{ color: themeColors.primary }} />
              <h3 className="font-semibold text-sm" style={{ color: themeColors.text }}>
                {t('notifications')}
              </h3>
              {unreadCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: '#EF4444', color: 'white' }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1.5 rounded-md hover:bg-opacity-10 transition-colors"
                  style={{ color: themeColors.textSecondary }}
                  title={t('markAllReadTitle')}
                >
                  <CheckCheck size={16} />
                </button>
              )}
              <button
                onClick={() => {
                  navigate('/settings');
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-md hover:bg-opacity-10 transition-colors"
                style={{ color: themeColors.textSecondary }}
                title={t('notificationSettings')}
              >
                <Settings size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-opacity-10 transition-colors"
                style={{ color: themeColors.textSecondary }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
            {notifications.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" style={{ color: themeColors.textSecondary }} />
                <p className="text-sm font-medium mb-2" style={{ color: themeColors.text }}>
                  {t('noNotifications')}
                </p>
                <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                  {t('newNotificationHint')}
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const style = getNotificationStyle(notification);
                const priorityColor = getPriorityColor(notification.priority);

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="group px-3 sm:px-4 py-2.5 sm:py-3 border-b cursor-pointer transition-all duration-150"
                    style={{
                      borderColor: themeColors.border,
                      backgroundColor: notification.isRead
                        ? 'transparent'
                        : theme === 'dark'
                        ? 'rgba(59, 130, 246, 0.05)'
                        : 'rgba(59, 130, 246, 0.03)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = notification.isRead
                        ? 'transparent'
                        : theme === 'dark'
                        ? 'rgba(59, 130, 246, 0.05)'
                        : 'rgba(59, 130, 246, 0.03)';
                    }}
                  >
                    <div className="flex items-start space-x-2 sm:space-x-3">
                      {/* 읽음 상태 표시 */}
                      <div className="flex items-center justify-center w-1.5 sm:w-2 mt-1.5 sm:mt-2">
                        {!notification.isRead && (
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>

                      {/* 아이콘 */}
                      <div
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: style.bg }}
                      >
                        {notification.priority === 'high' ? (
                          <AlertCircle size={16} className="sm:w-[18px] sm:h-[18px]" style={{ color: style.color }} />
                        ) : (
                          <Bell size={16} className="sm:w-[18px] sm:h-[18px]" style={{ color: style.color }} />
                        )}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        {/* 타이틀 */}
                        <p className="text-sm font-medium mb-1 truncate" style={{ color: themeColors.text }}>
                          {notification.title}
                        </p>

                        {/* 메시지 */}
                        <p className="text-xs line-clamp-2 mb-2" style={{ color: themeColors.textSecondary }}>
                          {notification.message}
                        </p>

                        {/* 배지와 날짜 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: style.color + '20',
                              color: style.color,
                            }}
                          >
                            {style.label}
                          </span>
                          {notification.priority === 'high' && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: priorityColor + '20',
                                color: priorityColor,
                              }}
                            >
                              {t('important')}
                            </span>
                          )}
                          <span className="text-xs whitespace-nowrap" style={{ color: themeColors.textSecondary }}>
                            {formatTime(notification.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={(e) => handleDelete(e, notification.id)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 sm:p-1.5 rounded-md hover:bg-red-500 hover:bg-opacity-10 transition-all flex-shrink-0"
                        style={{ color: '#EF4444' }}
                        title={t('delete')}
                      >
                        <Trash2 size={14} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 푸터 */}
          {notifications.length > 0 && (
            <div
              className="px-4 py-3 border-t text-center"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                borderColor: themeColors.border,
              }}
            >
              <button
                onClick={() => {
                  navigate('/settings');
                  setIsOpen(false);
                }}
                className="text-xs font-medium transition-colors"
                style={{ color: themeColors.primary }}
              >
                {t('notificationSettings')} →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
