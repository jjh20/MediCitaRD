import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CookieOptions } from 'express';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { BCRYPT_ROUNDS } from '../common/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth.types';
import { LoginDto, RegisterDto } from './dto/register.dto';
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  SELF_REGISTER_ROLES,
} from './permissions';

export const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos.';
export const ACCOUNT_DISABLED =
  'Tu cuenta está desactivada. Contacta al administrador.';

@Injectable()
export class AuthService {
  /** Hash de relleno: compara aunque el correo no exista (tiempos parejos). */
  private dummyHash?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ip: string | null): Promise<User> {
    // Defensa adicional al DTO: el registro público nunca crea administradores.
    if (!SELF_REGISTER_ROLES.includes(dto.role)) {
      throw new BadRequestException(
        'Solo puedes registrarte como Paciente o Centro médico.',
      );
    }
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (exists) throw this.duplicateEmail();

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          passwordHash,
          role: dto.role,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.duplicateEmail();
      }
      throw error;
    }

    await this.audit.record({
      action: AuditAction.REGISTER,
      userId: user.id,
      detail: `Nueva cuenta ${user.email} como ${ROLE_LABELS[user.role]}`,
      ip,
    });
    return user;
  }

  async login(dto: LoginDto, ip: string | null): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? (await this.getDummyHash()),
    );

    if (!user || !passwordOk) {
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        userId: user?.id,
        detail: `Credenciales inválidas para ${dto.email}`,
        ip,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    // Solo se revela que la cuenta está desactivada si la contraseña es correcta.
    if (!user.isActive) {
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        userId: user.id,
        detail: `Intento de acceso con cuenta desactivada: ${user.email}`,
        ip,
      });
      throw new ForbiddenException(ACCOUNT_DISABLED);
    }

    await this.audit.record({
      action: AuditAction.LOGIN_SUCCESS,
      userId: user.id,
      detail: `Inicio de sesión de ${user.email}`,
      ip,
    });
    return user;
  }

  /** Cierra la sesión: audita si el token aún es válido (la cookie se borra siempre). */
  async logout(token: string | undefined, ip: string | null): Promise<void> {
    const payload = token ? await this.tryVerify(token) : null;
    if (!payload) return;
    await this.audit.record({
      action: AuditAction.LOGOUT,
      userId: payload.sub,
      detail: `Cierre de sesión de ${payload.email}`,
      ip,
    });
  }

  async issueToken(user: User): Promise<{ token: string; maxAge: number }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
    };
    const token = await this.jwt.signAsync(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return { token, maxAge: exp * 1000 - Date.now() };
  }

  async tryVerify(token: string): Promise<JwtPayload | null> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  cookieOptions(maxAge?: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
      ...(maxAge !== undefined && { maxAge }),
    };
  }

  toPublicUser(
    user: Pick<
      User,
      'id' | 'fullName' | 'email' | 'role' | 'isActive' | 'createdAt'
    >,
  ) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      isActive: user.isActive,
      createdAt: user.createdAt,
      permissions: ROLE_PERMISSIONS[user.role],
    };
  }

  private duplicateEmail() {
    return new ConflictException(
      'Ya existe una cuenta registrada con ese correo electrónico.',
    );
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHash ??= await bcrypt.hash('MediCita-relleno-1!', BCRYPT_ROUNDS);
    return this.dummyHash;
  }
}
