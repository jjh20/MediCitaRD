import { Role } from '@prisma/client';

/** Etiquetas visibles de cada rol. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  PACIENTE: 'Paciente',
  CENTRO_MEDICO: 'Centro médico',
};

/**
 * Permisos por rol. El frontend arma el menú con esta lista y la API
 * protege cada recurso con @Roles(); ambos parten de la misma matriz.
 */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  PACIENTE: ['citas:ver', 'medicos:buscar', 'pagos:ver'],
  CENTRO_MEDICO: ['agenda:gestionar', 'medicos:gestionar'],
  ADMIN: ['usuarios:gestionar', 'auditoria:ver'],
};

/** Roles que se pueden elegir en el registro público (nunca ADMIN). */
export const SELF_REGISTER_ROLES: Role[] = [Role.PACIENTE, Role.CENTRO_MEDICO];
