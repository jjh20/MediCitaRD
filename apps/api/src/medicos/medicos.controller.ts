import {
  Body,
  Controller,
  Get,
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
import {
  CreateMedicoDto,
  DisponibilidadQueryDto,
  ListMedicosQueryDto,
  UpdateMedicoDto,
  UpdateMedicoEstadoDto,
} from './dto/medicos.dto';
import { MedicosService } from './medicos.service';

/** Médicos: cualquier usuario autenticado busca; el centro gestiona los suyos. */
@Controller('medicos')
export class MedicosController {
  constructor(private readonly medicos: MedicosService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query() query: ListMedicosQueryDto) {
    return this.medicos.list(actor, query);
  }

  @Get('especialidades')
  especialidades(@CurrentUser() actor: AuthUser) {
    return this.medicos.especialidades(actor);
  }

  @Get(':id')
  get(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.medicos.get(actor, id, clientIp(req));
  }

  @Get(':id/disponibilidad')
  disponibilidad(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: DisponibilidadQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.medicos.disponibilidad(actor, id, query.fecha, clientIp(req));
  }

  @Post()
  @Roles(Role.CENTRO_MEDICO)
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateMedicoDto,
    @Req() req: AuthRequest,
  ) {
    return this.medicos.create(actor, dto, clientIp(req));
  }

  @Patch(':id')
  @Roles(Role.CENTRO_MEDICO)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMedicoDto,
    @Req() req: AuthRequest,
  ) {
    return this.medicos.update(actor, id, dto, clientIp(req));
  }

  @Patch(':id/estado')
  @Roles(Role.CENTRO_MEDICO)
  setEstado(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMedicoEstadoDto,
    @Req() req: AuthRequest,
  ) {
    return this.medicos.setActivo(actor, id, dto.activo, clientIp(req));
  }
}
