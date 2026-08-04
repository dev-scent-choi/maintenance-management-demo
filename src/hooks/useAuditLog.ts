import { useCallback } from 'react';
import { useAuditLogStore } from '../store/auditLogStore';
import { useAuthStore } from '../store/authStore';
import type { AuditLog } from '../types';

export const useAuditLog = () => {
  const { addLog } = useAuditLogStore();
  const { user } = useAuthStore();

  const log = useCallback(
    (
      action: AuditLog['action'],
      resourceType: AuditLog['resourceType'],
      details: string,
      resourceId?: string,
      resourceName?: string,
      changes?: AuditLog['changes']
    ) => {
      if (!user) return;

      addLog({
        userId: user.id,
        userName: user.name,
        action,
        resourceType,
        resourceId,
        resourceName,
        details,
        changes,
      });
    },
    [user, addLog]
  );

  return { log };
};
