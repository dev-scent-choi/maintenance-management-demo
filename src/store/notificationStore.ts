import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notification, NotificationSettings } from '../types';
import { useAuthStore } from './authStore';

interface NotificationState {
  notifications: Notification[];
  settings: Record<string, NotificationSettings>;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (userId: string) => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: (userId: string) => void;
  getUnreadCount: (userId: string) => number;
  getUserNotifications: (userId: string) => Notification[];
  updateSettings: (userId: string, settings: Partial<NotificationSettings>) => void;
  getSettings: (userId: string) => NotificationSettings;
}

const defaultSettings: Omit<NotificationSettings, 'userId'> = {
  emailEnabled: true,
  webEnabled: true,
  notificationTypes: {
    maintenanceCreated: true,
    maintenanceAssigned: true,
    maintenanceStatusChanged: true,
    maintenanceCompleted: true,
    userChanges: true,
    companyChanges: true,
    systemAlerts: true,
  },
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      settings: {},

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          createdAt: new Date(),
          isRead: false,
        };

        // Check if notifications are enabled for this user and event type
        const settings = get().getSettings(notification.userId);

        // Map notification type to settings key
        const typeToSettingKey: { [key: string]: keyof NotificationSettings['notificationTypes'] } = {
          'maintenance_created': 'maintenanceCreated',
          'maintenance_assigned': 'maintenanceAssigned',
          'maintenance_status_changed': 'maintenanceStatusChanged',
          'maintenance_completed': 'maintenanceCompleted',
          'user_created': 'userChanges',
          'user_updated': 'userChanges',
          'company_created': 'companyChanges',
          'company_updated': 'companyChanges',
          'system_alert': 'systemAlerts',
          'task_assigned': 'systemAlerts',
          'system': 'systemAlerts',
        };

        const settingKey = typeToSettingKey[notification.type];
        const isTypeEnabled = settingKey ? settings.notificationTypes[settingKey] : true;

        // Check if at least one notification channel is enabled for this event type
        const shouldSendEmail = settings.emailEnabled && isTypeEnabled;
        const shouldSendWeb = settings.webEnabled && isTypeEnabled;

        // If neither channel is enabled for this event type, skip notification
        if (!shouldSendEmail && !shouldSendWeb) {
          return;
        }

        // Add notification to store (for web notification display)
        if (shouldSendWeb) {
          set((state) => ({
            notifications: [newNotification, ...state.notifications].slice(0, 500), // Keep last 500
          }));

          // Send browser notification only for the current logged-in user
          const currentUserId = useAuthStore.getState().user?.id;
          if (currentUserId && notification.userId === currentUserId &&
              'Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: newNotification.id,
            });
          }
        }

        // 이메일 발송은 백엔드(MaintenanceService → EmailService)에서 직접 처리됨
        // emailEnabled 설정은 User.emailNotificationEnabled 필드로 백엔드에 동기화됨 (Settings.tsx)
      },

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date() } : n
          ),
        })),

      markAllAsRead: (userId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.userId === userId ? { ...n, isRead: true, readAt: new Date() } : n
          ),
        })),

      deleteNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearAllNotifications: (userId) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.userId !== userId),
        })),

      getUnreadCount: (userId) => {
        const notifications = get().notifications.filter(
          (n) => n.userId === userId && !n.isRead
        );
        return notifications.length;
      },

      getUserNotifications: (userId) => {
        return get()
          .notifications.filter((n) => n.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      updateSettings: (userId, newSettings) => {

        set((state) => {
          const updatedSettings = {
            ...state.settings,
            [userId]: {
              ...defaultSettings,
              ...state.settings[userId],
              ...newSettings,
              // Ensure notificationTypes are properly merged
              notificationTypes: {
                ...defaultSettings.notificationTypes,
                ...(state.settings[userId]?.notificationTypes || {}),
                ...(newSettings.notificationTypes || {}),
              },
              userId,
            },
          };


          return { settings: updatedSettings };
        });
      },

      getSettings: (userId) => {
        const state = get();
        if (!state.settings[userId]) {
          return { ...defaultSettings, userId };
        }
        return state.settings[userId];
      },
    }),
    {
      name: 'notification-storage',
    }
  )
);
