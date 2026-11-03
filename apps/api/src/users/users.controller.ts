import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthRequest, AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { clientIp } from '../common/request';
import {
  ListUsersQueryDto,
  UpdateRoleDto,
  UpdateStatusDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get('roles')
  roles() {
    return this.users.rolesCatalog();
  }

  @Patch(':id/role')
  changeRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthRequest,
  ) {
    return this.users.changeRole(actor, id, dto.role, clientIp(req));
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.users.setActive(actor, id, dto.isActive, clientIp(req));
  }
}
