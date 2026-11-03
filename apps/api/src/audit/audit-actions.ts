/** Acciones que se registran en la auditoría. */
export const AuditAction = {
  REGISTER: 'REGISTER',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  ROLE_CHANGED: 'ROLE_CHANGED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  ACCESS_DENIED_401: 'ACCESS_DENIED_401',
  ACCESS_DENIED_403: 'ACCESS_DENIED_403',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AUDIT_ACTIONS = Object.values(AuditAction);
