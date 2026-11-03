import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public, Roles } from '../auth/decorators';
import { ROLE_LABELS } from '../auth/permissions';
import { AuditAction } from './audit-actions';
import { AuditService } from './audit.service';
import { AccessDeniedDto, AuditQueryDto } from './dto/audit.dto';
import { InternalKeyGuard } from './internal-key.guard';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(Role.ADMIN)
  find(@Query() query: AuditQueryDto) {
    return this.audit.find({
      action: query.action,
      user: query.user,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * Lo llama únicamente el middleware de Next.js (con la clave interna)
   * cuando niega una página: 401 sin sesión, 403 por rol incorrecto.
   */
  @Public()
  @UseGuards(InternalKeyGuard)
  @Post('access-denied')
  @HttpCode(HttpStatus.NO_CONTENT)
  async accessDenied(@Body() dto: AccessDeniedDto) {
    const reason =
      dto.status === 401
        ? 'sin sesión'
        : `rol ${dto.role ? ROLE_LABELS[dto.role] : 'desconocido'} sin permiso`;
    await this.audit.record({
      action:
        dto.status === 401
          ? AuditAction.ACCESS_DENIED_401
          : AuditAction.ACCESS_DENIED_403,
      userId: dto.userId,
      detail: `Web: ${dto.path} — ${reason}`,
      ip: dto.ip,
    });
  }
}
