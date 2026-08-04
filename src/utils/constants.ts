export const MAINTENANCE_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    URGENT: 'urgent',
    ON_HOLD: 'on-hold'
  } as const;
  
  export const PRIORITY_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  } as const;
  
  export const USER_ROLES = {
    ADMIN: 'admin',
    USER: 'user'
  } as const;