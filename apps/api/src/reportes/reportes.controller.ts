import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ReporteCitasQueryDto } from './dto/reportes.dto';
import { ReportesService } from './reportes.service';

/** Reporte de operaciones: global para el admin, de su centro para el centro. */
@Controller('reportes')
@Roles(Role.ADMIN, Role.CENTRO_MEDICO)
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('citas')
  async citas(
    @CurrentUser() actor: AuthUser,
    @Query() query: ReporteCitasQueryDto,
  ) {
    // El detalle de citas solo se usa en el CSV
    const { citas: _detalle, ...reporte } = await this.reportes.citas(
      actor,
      query,
    );
    void _detalle;
    return reporte;
  }

  @Get('citas.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(
    @CurrentUser() actor: AuthUser,
    @Query() query: ReporteCitasQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reporte = await this.reportes.citas(actor, query);
    const nombre = `reporte-citas_${query.desde ?? 'inicio'}_${query.hasta ?? 'fin'}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    return this.reportes.toCsv(reporte);
  }
}
