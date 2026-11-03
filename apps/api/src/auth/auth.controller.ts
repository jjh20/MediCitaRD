import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { User } from '@prisma/client';
import type { Response } from 'express';
import { clientIp } from '../common/request';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AUTH_COOKIE } from './auth.types';
import type { AuthRequest, AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';
import { LoginDto, RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /** Registro público como Paciente o Centro médico; inicia sesión al terminar. */
  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(dto, clientIp(req));
    await this.startSession(user, res);
    return { user: this.auth.toPublicUser(user) };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.login(dto, clientIp(req));
    await this.startSession(user, res);
    return { user: this.auth.toPublicUser(user) };
  }

  /** Pública a propósito: siempre borra la cookie, aunque el token ya haya expirado. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      AUTH_COOKIE
    ];
    await this.auth.logout(token, clientIp(req));
    res.clearCookie(AUTH_COOKIE, this.auth.cookieOptions());
    return { message: 'Sesión cerrada.' };
  }

  @Get('me')
  async me(@CurrentUser() current: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: current.id },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return { user: this.auth.toPublicUser(user) };
  }

  private async startSession(user: User, res: Response) {
    const { token, maxAge } = await this.auth.issueToken(user);
    res.cookie(AUTH_COOKIE, token, this.auth.cookieOptions(maxAge));
  }
}
