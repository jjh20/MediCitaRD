import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthService,
  ACCOUNT_DISABLED,
  INVALID_CREDENTIALS,
} from './auth.service';
import { RegisterDto } from './dto/register.dto';

const PASSWORD = 'Paciente-Prueba-1!';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    fullName: 'Ana Gómez',
    email: 'ana@correo.do',
    passwordHash: bcrypt.hashSync(PASSWORD, 4),
    role: Role.PACIENTE,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let audit: { record: jest.Mock };
  const jwt = new JwtService({
    secret: 'secreto-de-pruebas-unitarias-con-32-caracteres',
    signOptions: { expiresIn: '8h' },
  });

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    audit = { record: jest.fn() };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      audit as unknown as AuditService,
      new ConfigService({ NODE_ENV: 'test' }),
    );
  });

  describe('register', () => {
    const dto: RegisterDto = {
      fullName: 'Ana Gómez',
      email: 'ana@correo.do',
      password: PASSWORD,
      role: Role.PACIENTE,
    };

    it('crea al usuario con la contraseña hasheada y audita REGISTER', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve(buildUser({ ...data, id: 'nuevo' })),
      );

      const user = await service.register(dto, '127.0.0.1');

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data.passwordHash).not.toBe(PASSWORD);
      expect(await bcrypt.compare(PASSWORD, data.passwordHash)).toBe(true);
      expect(user.role).toBe(Role.PACIENTE);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.REGISTER,
          userId: 'nuevo',
        }),
      );
    });

    it('rechaza registrarse como ADMIN aunque se salte el DTO', async () => {
      await expect(
        service.register({ ...dto, role: Role.ADMIN }, null),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rechaza un correo duplicado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existente' });
      await expect(service.register(dto, null)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('acepta credenciales válidas y audita LOGIN_SUCCESS', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      const user = await service.login(
        { email: 'ana@correo.do', password: PASSWORD },
        null,
      );
      expect(user.id).toBe('u-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.LOGIN_SUCCESS }),
      );
    });

    it('rechaza una contraseña incorrecta con mensaje genérico y audita LOGIN_FAILED', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      await expect(
        service.login(
          { email: 'ana@correo.do', password: 'Otra-Clave-99!' },
          null,
        ),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS));
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_FAILED,
          userId: 'u-1',
        }),
      );
    });

    it('rechaza un correo inexistente con el mismo mensaje genérico', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nadie@correo.do', password: PASSWORD }, null),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS));
    });

    it('impide entrar a un usuario desactivado', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
      await expect(
        service.login({ email: 'ana@correo.do', password: PASSWORD }, null),
      ).rejects.toThrow(new ForbiddenException(ACCOUNT_DISABLED));
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.LOGIN_FAILED }),
      );
    });
  });

  describe('sesión', () => {
    it('emite un JWT que expira y lo verifica', async () => {
      const { token, maxAge } = await service.issueToken(buildUser());
      expect(maxAge).toBeGreaterThan(7.9 * 3600 * 1000);
      expect(maxAge).toBeLessThanOrEqual(8 * 3600 * 1000);
      const payload = await service.tryVerify(token);
      expect(payload).toMatchObject({ sub: 'u-1', role: Role.PACIENTE });
    });

    it('rechaza un token manipulado', async () => {
      const { token } = await service.issueToken(buildUser());
      expect(await service.tryVerify(token.slice(0, -2) + 'xx')).toBeNull();
    });

    it('la cookie es httpOnly, sameSite=lax y secure solo en producción', () => {
      expect(service.cookieOptions(1000)).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000,
      });
      const prod = new AuthService(
        prisma as unknown as PrismaService,
        jwt,
        audit as unknown as AuditService,
        new ConfigService({ NODE_ENV: 'production' }),
      );
      expect(prod.cookieOptions().secure).toBe(true);
    });

    it('audita el logout solo si el token es válido', async () => {
      const { token } = await service.issueToken(buildUser());
      await service.logout(token, null);
      await service.logout('basura', null);
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.LOGOUT, userId: 'u-1' }),
      );
    });
  });
});
