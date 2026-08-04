import { useCallback } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import type { Notification } from '../types';

export const useNotification = () => {
  const { addNotification } = useNotificationStore();

  const notify = useCallback(
    (
      userId: string,
      type: Notification['type'],
      title: string,
      message: string,
      options?: {
        priority?: Notification['priority'];
        relatedResourceType?: Notification['relatedResourceType'];
        relatedResourceId?: string;
        actionUrl?: string;
      }
    ) => {
      addNotification({
        userId,
        type,
        title,
        message,
        priority: options?.priority || 'normal',
        relatedResourceType: options?.relatedResourceType,
        relatedResourceId: options?.relatedResourceId,
        actionUrl: options?.actionUrl,
        isRead: false,
      });
    },
    [addNotification]
  );

  const notifyMaintenanceCreated = useCallback(
    (userId: string, maintenanceId: string, maintenanceTitle: string, companyName: string) => {
      notify(
        userId,
        'maintenance_created',
        '새 유지보수 접수',
        `${companyName}에서 "${maintenanceTitle}" 유지보수가 접수되었습니다.`,
        {
          priority: 'normal',
          relatedResourceType: 'maintenance',
          relatedResourceId: maintenanceId,
          actionUrl: `/maintenance/${maintenanceId}`,
        }
      );
    },
    [notify]
  );

  const notifyMaintenanceAssigned = useCallback(
    (userId: string, maintenanceId: string, maintenanceTitle: string, assignedBy: string) => {
      notify(
        userId,
        'maintenance_assigned',
        '유지보수 작업 배정',
        `${assignedBy}님이 "${maintenanceTitle}" 작업을 배정했습니다.`,
        {
          priority: 'high',
          relatedResourceType: 'maintenance',
          relatedResourceId: maintenanceId,
          actionUrl: `/maintenance/${maintenanceId}`,
        }
      );
    },
    [notify]
  );

  const notifyMaintenanceStatusChanged = useCallback(
    (
      userId: string,
      maintenanceId: string,
      maintenanceTitle: string,
      oldStatus: string,
      newStatus: string
    ) => {
      notify(
        userId,
        'maintenance_status_changed',
        '유지보수 상태 변경',
        `"${maintenanceTitle}"의 상태가 ${oldStatus}에서 ${newStatus}(으)로 변경되었습니다.`,
        {
          priority: 'normal',
          relatedResourceType: 'maintenance',
          relatedResourceId: maintenanceId,
          actionUrl: `/maintenance/${maintenanceId}`,
        }
      );
    },
    [notify]
  );

  const notifyMaintenanceCompleted = useCallback(
    (userId: string, maintenanceId: string, maintenanceTitle: string, completedBy: string) => {
      notify(
        userId,
        'maintenance_completed',
        '유지보수 작업 완료',
        `${completedBy}님이 "${maintenanceTitle}" 작업을 완료했습니다.`,
        {
          priority: 'normal',
          relatedResourceType: 'maintenance',
          relatedResourceId: maintenanceId,
          actionUrl: `/maintenance/${maintenanceId}`,
        }
      );
    },
    [notify]
  );

  const notifyUserCreated = useCallback(
    (userId: string, newUserName: string, createdBy: string) => {
      notify(
        userId,
        'user_created',
        '새 사용자 등록',
        `${createdBy}님이 ${newUserName} 사용자를 등록했습니다.`,
        {
          priority: 'low',
          relatedResourceType: 'user',
        }
      );
    },
    [notify]
  );

  const notifyCompanyCreated = useCallback(
    (userId: string, companyName: string, createdBy: string) => {
      notify(
        userId,
        'company_created',
        '새 업체 추가',
        `${createdBy}님이 ${companyName} 업체를 등록했습니다.`,
        {
          priority: 'low',
          relatedResourceType: 'company',
        }
      );
    },
    [notify]
  );

  const notifySystemAlert = useCallback(
    (userId: string, title: string, message: string, priority: Notification['priority'] = 'high') => {
      notify(userId, 'system_alert', title, message, {
        priority,
      });
    },
    [notify]
  );

  return {
    notify,
    notifyMaintenanceCreated,
    notifyMaintenanceAssigned,
    notifyMaintenanceStatusChanged,
    notifyMaintenanceCompleted,
    notifyUserCreated,
    notifyCompanyCreated,
    notifySystemAlert,
  };
};
