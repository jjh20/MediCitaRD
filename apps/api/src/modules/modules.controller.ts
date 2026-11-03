import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';

/**
 * Módulos de negocio aún no implementados (épicas siguientes).
 * Existen para demostrar que la API también restringe por rol.
 */
@Controller('modules')
export class ModulesController {
  @Get('paciente')
  @Roles(Role.PACIENTE)
  paciente(@CurrentUser() user: AuthUser) {
    return {
      modulo: 'Paciente',
      usuario: user.fullName,
      secciones: ['Mis citas', 'Buscar médico', 'Pagos'],
      estado: 'En construcción: disponible en próximas épicas.',
    };
  }

  @Get('centro')
  @Roles(Role.CENTRO_MEDICO)
  centro(@CurrentUser() user: AuthUser) {
    return {
      modulo: 'Centro médico',
      usuario: user.fullName,
      secciones: ['Agenda del centro', 'Médicos y horarios'],
      estado: 'En construcción: disponible en próximas épicas.',
    };
  }
}
