import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import type { AuthRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { clientIp } from '../common/request';
import {
  AjusteDto,
  AsignacionDto,
  ConsumoDto,
  CreateRecursoDto,
  DevolucionDto,
  EntradaDto,
  ListMovimientosQueryDto,
  ListRecursosQueryDto,
  ReporteExistenciasQueryDto,
  ReporteMovimientosQueryDto,
  SalidaDto,
  UpdateRecursoDto,
  UpdateRecursoEstadoDto,
} from './dto/inventario.dto';
import { InventarioReportesService } from './inventario-reportes.service';
import { MovimientosService } from './movimientos.service';
import { RecursosService } from './recursos.service';

/**
 * Recursos del inventario. El centro gestiona los suyos; el admin consulta
 * todos (solo lectura); el paciente no tiene acceso (403 auditado).
 */
@Controller('recursos')
@Roles(Role.CENTRO_MEDICO, Role.ADMIN)
export class RecursosController {
  constructor(
    private readonly recursos: RecursosService,
    private readonly movimientos: MovimientosService,
  ) {}

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query() query: ListRecursosQueryDto) {
    return this.recursos.list(actor, query);
  }

  @Get(':id')
  get(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.recursos.get(actor, id, clientIp(req));
  }

  @Get(':id/disponibilidad')
  disponibilidad(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.recursos.disponibilidad(actor, id, clientIp(req));
  }

  @Get(':id/movimientos')
  historial(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.movimientos.historial(actor, id, clientIp(req));
  }

  @Post()
  @Roles(Role.CENTRO_MEDICO)
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateRecursoDto,
    @Req() req: AuthRequest,
  ) {
    return this.recursos.create(actor, dto, clientIp(req));
  }

  @Patch(':id')
  @Roles(Role.CENTRO_MEDICO)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRecursoDto,
    @Req() req: AuthRequest,
  ) {
    return this.recursos.update(actor, id, dto, clientIp(req));
  }

  @Patch(':id/estado')
  @Roles(Role.CENTRO_MEDICO)
  setEstado(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRecursoEstadoDto,
    @Req() req: AuthRequest,
  ) {
    return this.recursos.setActivo(
      actor,
      id,
      dto.activo,
      dto.motivo,
      clientIp(req),
    );
  }
}

/** Movimientos de inventario (inmutables: no hay PATCH ni DELETE). */
@Controller('movimientos')
@Roles(Role.CENTRO_MEDICO, Role.ADMIN)
export class MovimientosController {
  constructor(private readonly movimientos: MovimientosService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthUser,
    @Query() query: ListMovimientosQueryDto,
  ) {
    return this.movimientos.list(actor, query);
  }

  @Post('entrada')
  @Roles(Role.CENTRO_MEDICO)
  entrada(
    @CurrentUser() actor: AuthUser,
    @Body() dto: EntradaDto,
    @Req() req: AuthRequest,
  ) {
    return this.movimientos.entrada(actor, dto, clientIp(req));
  }

  @Post('salida')
  @Roles(Role.CENTRO_MEDICO)
  salida(
    @CurrentUser() actor: AuthUser,
    @Body() dto: SalidaDto,
    @Req() req: AuthRequest,
  ) {
    return this.movimientos.salida(actor, dto, clientIp(req));
  }

  @Post('consumo')
  @Roles(Role.CENTRO_MEDICO)
  consumo(
    @CurrentUser() actor: AuthUser,
    @Body() dto: ConsumoDto,
    @Req() req: AuthRequest,
  ) {
    return this.movimientos.consumo(actor, dto, clientIp(req));
  }

  @Post('ajuste')
  @Roles(Role.CENTRO_MEDICO)
  ajuste(
    @CurrentUser() actor: AuthUser,
    @Body() dto: AjusteDto,
    @Req() req: AuthRequest,
  ) {
    return this.movimientos.ajuste(actor, dto, clientIp(req));
  }

  @Post('asignacion')
  @Roles(Role.CENTRO_MEDICO)
  asignacion(
    @CurrentUser() actor: AuthUser,
    @Body() dto: AsignacionDto,
    @Req() req: AuthRequest,
  ) {
    return this.movimientos.asignacion(actor, dto, clientIp(req));
  }

  @Post('devolucion')
  @Roles(Role.CENTRO_MEDICO)
  devolucion(
    @CurrentUser() actor: AuthUser,
    @Body() dto: DevolucionDto,
    @Req() req: AuthRequest,
  ) {
    return this.movimientos.devolucion(actor, dto, clientIp(req));
  }
}

/** Reportes logísticos: global para el admin, de su centro para el centro. */
@Controller('reportes')
@Roles(Role.CENTRO_MEDICO, Role.ADMIN)
export class InventarioReportesController {
  constructor(private readonly reportes: InventarioReportesService) {}

  @Get('existencias')
  existencias(
    @CurrentUser() actor: AuthUser,
    @Query() query: ReporteExistenciasQueryDto,
  ) {
    return this.reportes.existencias(actor, query);
  }

  @Get('existencias.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async existenciasCsv(
    @CurrentUser() actor: AuthUser,
    @Query() query: ReporteExistenciasQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.reportes.existencias(actor, query);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="existencias_${r.generadoEn.slice(0, 10)}.csv"`,
    );
    return this.reportes.existenciasCsv(r);
  }

  @Get('movimientos')
  movimientos(
    @CurrentUser() actor: AuthUser,
    @Query() query: ReporteMovimientosQueryDto,
  ) {
    return this.reportes.movimientos(actor, query);
  }

  @Get('movimientos.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async movimientosCsv(
    @CurrentUser() actor: AuthUser,
    @Query() query: ReporteMovimientosQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.reportes.movimientos(actor, query);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="movimientos_${r.filtros.desde}_${r.filtros.hasta}.csv"`,
    );
    return this.reportes.movimientosCsv(r);
  }
}
