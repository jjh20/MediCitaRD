import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { clientIp } from '../common/request';
import { CitasService } from './citas.service';
import {
  CancelarCitaDto,
  CerrarCitaDto,
  ConfirmarCitaDto,
  CreateCitaDto,
  ListCitasQueryDto,
  ReprogramarCitaDto,
  UpdateCitaDto,
} from './dto/citas.dto';

/**
 * Citas médicas (la "operación" de MediCita RD).
 * Lectura: cada rol dentro de su alcance (paciente → las suyas, centro → las
 * de su centro, admin → todas). Escritura según la tabla de "quién hace qué".
 */
@Controller('citas')
export class CitasController {
  constructor(private readonly citas: CitasService) {}

  @Post()
  @Roles(Role.PACIENTE)
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateCitaDto,
    @Req() req: AuthRequest,
  ) {
    return this.citas.create(actor, dto, clientIp(req));
  }

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query() query: ListCitasQueryDto) {
    return this.citas.list(actor, query);
  }

  @Get(':id')
  get(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.citas.get(actor, id, clientIp(req));
  }

  @Get(':id/historial')
  historial(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.citas.historial(actor, id, clientIp(req));
  }

  @Patch(':id')
  @Roles(Role.PACIENTE, Role.CENTRO_MEDICO)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCitaDto,
    @Req() req: AuthRequest,
  ) {
    return this.citas.update(actor, id, dto, clientIp(req));
  }

  @Post(':id/reprogramar')
  @HttpCode(200)
  @Roles(Role.PACIENTE, Role.CENTRO_MEDICO)
  reprogramar(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReprogramarCitaDto,
    @Req() req: AuthRequest,
  ) {
    return this.citas.reprogramar(actor, id, dto, clientIp(req));
  }

  @Post(':id/confirmar')
  @HttpCode(200)
  @Roles(Role.CENTRO_MEDICO)
  confirmar(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConfirmarCitaDto,
    @Req() req: AuthRequest,
  ) {
    return this.citas.confirmar(actor, id, dto.comentario, clientIp(req));
  }

  @Post(':id/cerrar')
  @HttpCode(200)
  @Roles(Role.CENTRO_MEDICO)
  cerrar(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CerrarCitaDto,
    @Req() req: AuthRequest,
  ) {
    return this.citas.cerrar(actor, id, dto, clientIp(req));
  }

  @Post(':id/cancelar')
  @HttpCode(200)
  @Roles(Role.PACIENTE, Role.CENTRO_MEDICO)
  cancelar(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelarCitaDto,
    @Req() req: AuthRequest,
  ) {
    return this.citas.cancelar(actor, id, dto.motivo, clientIp(req));
  }
}
