import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { LAST_ADMIN_MESSAGE, UsersService } from './users.service';

const admin: AuthUser = {
  id: 'admin-1',
  email: 'admin@medicita.local',
  fullName: 'Admin',
  role: Role.ADMIN,
};

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-2',
    fullName: 'Pedro Díaz',
    email: 'pedro@correo.do',
    passwordHash: 'hash',
    role: Role.PACIENTE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let audit: { record: jest.Mock };
  let user: { findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };

  beforeEach(() => {
    user = {
      findUnique: jest.fn(),
      update: jest.fn(({ data }) => Promise.resolve(buildUser(data))),
      count: jest.fn(),
    };
    // $transaction(fn) ejecuta el callback con el mismo cliente simulado
    const prisma = {
      user,
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({ user })),
    };
    audit = { record: jest.fn() };
    service = new UsersService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('changeRole', () => {
    it('cambia el rol y lo audita con el actor y el detalle', async () => {
      user.findUnique.mockResolvedValue(buildUser());
      const result = await service.changeRole(
        admin,
        'u-2',
        Role.CENTRO_MEDICO,
        '10.0.0.1',
      );
      expect(result.role).toBe(Role.CENTRO_MEDICO);
      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.ROLE_CHANGED,
        userId: 'admin-1',
        detail: expect.stringContaining('Paciente → Centro médico'),
        ip: '10.0.0.1',
      });
    });

    it('impide que el admin cambie su propio rol', async () => {
      await expect(
        service.changeRole(admin, 'admin-1', Role.PACIENTE, null),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(user.update).not.toHaveBeenCalled();
    });

    it('devuelve 404 si el usuario no existe', async () => {
      user.findUnique.mockResolvedValue(null);
      await expect(
        service.changeRole(admin, 'u-x', Role.PACIENTE, null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza asignar el mismo rol que ya tiene', async () => {
      user.findUnique.mockResolvedValue(buildUser());
      await expect(
        service.changeRole(admin, 'u-2', Role.PACIENTE, null),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no permite quitar el rol al último administrador activo', async () => {
      user.findUnique.mockResolvedValue(buildUser({ role: Role.ADMIN }));
      user.count.mockResolvedValue(0);
      await expect(
        service.changeRole(admin, 'u-2', Role.PACIENTE, null),
      ).rejects.toThrow(new ConflictException(LAST_ADMIN_MESSAGE));
      expect(user.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('sí permite quitar el rol a un admin si queda otro activo', async () => {
      user.findUnique.mockResolvedValue(buildUser({ role: Role.ADMIN }));
      user.count.mockResolvedValue(1);
      await service.changeRole(admin, 'u-2', Role.PACIENTE, null);
      expect(user.count).toHaveBeenCalledWith({
        where: { role: Role.ADMIN, isActive: true, id: { not: 'u-2' } },
      });
      expect(user.update).toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    it('desactiva un usuario y audita USER_DEACTIVATED', async () => {
      user.findUnique.mockResolvedValue(buildUser());
      const result = await service.setActive(admin, 'u-2', false, null);
      expect(result.isActive).toBe(false);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.USER_DEACTIVATED }),
      );
    });

    it('activa un usuario y audita USER_ACTIVATED', async () => {
      user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
      await service.setActive(admin, 'u-2', true, null);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.USER_ACTIVATED }),
      );
    });

    it('impide que el admin se desactive a sí mismo', async () => {
      await expect(
        service.setActive(admin, 'admin-1', false, null),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no permite desactivar al último administrador activo', async () => {
      user.findUnique.mockResolvedValue(buildUser({ role: Role.ADMIN }));
      user.count.mockResolvedValue(0);
      await expect(
        service.setActive(admin, 'u-2', false, null),
      ).rejects.toThrow(LAST_ADMIN_MESSAGE);
      expect(user.update).not.toHaveBeenCalled();
    });

    it('rechaza un cambio sin efecto (ya estaba activo)', async () => {
      user.findUnique.mockResolvedValue(buildUser());
      await expect(
        service.setActive(admin, 'u-2', true, null),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('expone el catálogo de roles con permisos', () => {
    const roles = service.rolesCatalog();
    expect(roles.map((r) => r.role)).toEqual([
      Role.ADMIN,
      Role.PACIENTE,
      Role.CENTRO_MEDICO,
    ]);
    expect(roles.find((r) => r.role === Role.ADMIN)?.permissions).toContain(
      'auditoria:ver',
    );
  });
});
