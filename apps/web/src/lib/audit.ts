export const AUDIT_ACTIONS = {
  REGISTER: { label: "Registro", tone: "info" },
  LOGIN_SUCCESS: { label: "Inicio de sesión", tone: "success" },
  LOGIN_FAILED: { label: "Inicio de sesión fallido", tone: "danger" },
  LOGOUT: { label: "Cierre de sesión", tone: "neutral" },
  ROLE_CHANGED: { label: "Cambio de rol", tone: "info" },
  USER_ACTIVATED: { label: "Usuario activado", tone: "success" },
  USER_DEACTIVATED: { label: "Usuario desactivado", tone: "warning" },
  ACCESS_DENIED_401: { label: "Acceso denegado (401)", tone: "danger" },
  ACCESS_DENIED_403: { label: "Acceso denegado (403)", tone: "danger" },
  MEDICO_CREADO: { label: "Médico creado", tone: "info" },
  MEDICO_ACTUALIZADO: { label: "Médico actualizado", tone: "info" },
  MEDICO_ACTIVADO: { label: "Médico activado", tone: "success" },
  MEDICO_DESACTIVADO: { label: "Médico desactivado", tone: "warning" },
  CITA_CREADA: { label: "Cita creada", tone: "info" },
  CITA_ACTUALIZADA: { label: "Cita actualizada", tone: "neutral" },
  CITA_REPROGRAMADA: { label: "Cita reprogramada", tone: "warning" },
  CITA_CONFIRMADA: { label: "Cita confirmada", tone: "info" },
  CITA_CERRADA: { label: "Cita cerrada", tone: "success" },
  CITA_CANCELADA: { label: "Cita cancelada", tone: "danger" },
} as const;

export type AuditActionKey = keyof typeof AUDIT_ACTIONS;

export const TONE_CLASSES = {
  info: "bg-brand-soft text-brand",
  success: "bg-success/15 text-success",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/20 text-[#8a5d00]",
  neutral: "bg-muted text-muted-foreground",
} as const;
