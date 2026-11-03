import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from './audit-actions';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };

  beforeEach(() => {
    auditLog = {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const prisma = {
      auditLog,
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  describe('record', () => {
    it('guarda acción, usuario, detalle e IP', async () => {
      await service.record({
        action: AuditAction.LOGIN_SUCCESS,
        userId: 'u-1',
        detail: 'Inicio de sesión',
        ip: '127.0.0.1',
      });
      expect(auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'LOGIN_SUCCESS',
          userId: 'u-1',
          detail: 'Inicio de sesión',
          ip: '127.0.0.1',
        },
      });
    });

    it('permite eventos anónimos y recorta detalles largos', async () => {
      await service.record({
        action: AuditAction.ACCESS_DENIED_401,
        detail: 'x'.repeat(800),
      });
      const { data } = auditLog.create.mock.calls[0][0];
      expect(data.userId).toBeNull();
      expect(data.ip).toBeNull();
      expect(data.detail).toHaveLength(500);
    });

    it('no rompe la operación si la base de datos falla', async () => {
      auditLog.create.mockRejectedValue(new Error('sin conexión'));
      jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
      await expect(
        service.record({ action: AuditAction.LOGOUT }),
      ).resolves.toBeUndefined();
    });
  });

  describe('find', () => {
    it('filtra por acción, usuario y rango de fechas, y pagina', async () => {
      const from = new Date('2026-11-01T04:00:00Z');
      const to = new Date('2026-11-02T03:59:59Z');
      auditLog.count.mockResolvedValue(42);

      const result = await service.find({
        action: AuditAction.ROLE_CHANGED,
        user: 'pedro',
        from,
        to,
        page: 3,
        pageSize: 10,
      });

      const args = auditLog.findMany.mock.calls[0][0];
      expect(args.where.action).toBe('ROLE_CHANGED');
      expect(args.where.createdAt).toEqual({ gte: from, lte: to });
      expect(JSON.stringify(args.where.OR)).toContain('pedro');
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
      expect(result).toMatchObject({ total: 42, page: 3, pageSize: 10 });
    });

    it('sin filtros consulta todo', async () => {
      await service.find({ page: 1, pageSize: 20 });
      expect(auditLog.findMany.mock.calls[0][0].where).toEqual({});
    });
  });
});
