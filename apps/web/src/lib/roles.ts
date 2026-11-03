export const ROLES = ["ADMIN", "PACIENTE", "CENTRO_MEDICO"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  PACIENTE: "Paciente",
  CENTRO_MEDICO: "Centro médico",
};

/** Página de inicio de cada rol después de iniciar sesión. */
export const ROLE_HOME: Record<Role, string> = {
  PACIENTE: "/paciente/citas",
  CENTRO_MEDICO: "/centro/agenda",
  ADMIN: "/admin/usuarios",
};

export type NavIcon =
  | "calendar"
  | "search"
  | "credit-card"
  | "calendar-clock"
  | "stethoscope"
  | "users"
  | "scroll-text";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

/** Menú por rol: cada perfil solo ve sus opciones. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  PACIENTE: [
    { href: "/paciente/citas", label: "Mis citas", icon: "calendar" },
    { href: "/paciente/buscar-medico", label: "Buscar médico", icon: "search" },
    { href: "/paciente/pagos", label: "Pagos", icon: "credit-card" },
  ],
  CENTRO_MEDICO: [
    { href: "/centro/agenda", label: "Agenda del centro", icon: "calendar-clock" },
    { href: "/centro/medicos", label: "Médicos y horarios", icon: "stethoscope" },
  ],
  ADMIN: [
    { href: "/admin/usuarios", label: "Usuarios y roles", icon: "users" },
    { href: "/admin/auditoria", label: "Auditoría", icon: "scroll-text" },
  ],
};

/** Reglas de acceso por prefijo de ruta (las aplica middleware.ts). */
export const ROUTE_RULES: { prefix: string; roles: readonly Role[] }[] = [
  { prefix: "/paciente", roles: ["PACIENTE"] },
  { prefix: "/centro", roles: ["CENTRO_MEDICO"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/panel", roles: ROLES },
];

export function findRouteRule(pathname: string) {
  return ROUTE_RULES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  );
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Acepta solo rutas internas ("/algo"), nunca "//dominio" ni URLs absolutas. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}
