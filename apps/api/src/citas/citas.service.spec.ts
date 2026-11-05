import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CITA_AJENA,
  CITA_CAMBIO_CONCURRENTE,
  CitasService,
  HORARIO_TOMADO,
} from './citas.service';

const AHORA = new Date('2026-11-04T14:00:00Z'); // mié 10:00 RD
const LUNES_9AM = '2026-11-09T09:00:00-04:00';

const paciente: AuthUser = {
  id: 'pac-1',
  email: 'paciente@medicita.test',
  fullName: 'Paciente',
  role: Role.PACIENTE,
};
const otroPaciente: AuthUser = { ...paciente, id: 'pac-2', email: 'otro@x.do' };
const centro: AuthUser = {
  id: 'cen-1',
  email: 'centro@medicita.test',
  fullName: 'Centro',
  role: Role.CENTRO_MEDICO,
};

const medico = {
  id: 'med-1',
  centroId: 'cen-1',
  nombre: 'Dra. Laura Fernández',
  especialidad: 'Medicina General',
  precioConsulta: new Prisma.Decimal(1500),
  duracionMin: 30,
  diasSemana: [1, 2, 3, 4, 5],
  horaInicio: '08:00',
  horaFin: '17:00',
  activo: true,
};

function cita(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cita-1',
    codigo: 'CIT-0001',
    pacienteId: 'pac-1',
    medicoId: 'med-1',
    centroId: 'cen-1',
    fechaHora: new Date(LUNES_9AM),
    tipo: 'CONSULTA',
    motivo: 'Chequeo',
    estado: 'PENDIENTE',
    costo: new Prisma.Decimal(1500),
    notasCierre: null,
    motivoCancelacion: null,
    createdAt: AHORA,
    updatedAt: AHORA,
    medico,
    paciente: { id: 'pac-1', fullName: 'Paciente', email: 'p@x.do' },
    centro: { id: 'cen-1', fullName: 'Centro' },
    ...overrides,
  };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('error', {
    code,
    clientVersion: 'test',
  });

describe('CitasService', () => {
  let service: CitasService;
  let db: {
    cita: Record<string, jest.Mock>;
    medico: Record<string, jest.Mock>;
    citaHistorial: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let audit: { record: jest.Mock; forbidden: jest.Mock };
  let orden: string[];

  beforeEach(() => {
    orden = [];
    db = {
      cita: {
        findUnique: jest.fn().mockResolvedValue(cita()),
        findUniqueOrThrow: jest.fn().mockResolvedValue(cita()),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) => {
          orden.push('cita.create');
          return Promise.resolve(cita({ ...data }));
        }),
        updateMany: jest.fn(() => {
          orden.push('cita.updateMany');
          return Promise.resolve({ count: 1 });
        }),
      },
      medico: { findUnique: jest.fn().mockResolvedValue(medico) },
      citaHistorial: {
        create: jest.fn(() => {
          orden.push('historial.create');
          return Promise.resolve({});
        }),
      },
      // $transaction(fn) ejecuta el callback con el mismo cliente simulado
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => {
        orden.push('tx');
        return fn(db);
      }),
    };
    audit = {
      record: jest.fn(),
      forbidden: jest.fn((_a, _r, msg: string) =>
        Promise.resolve(new ForbiddenException(msg)),
      ),
    };
    service = new CitasService(
      db as unknown as PrismaService,
      audit as unknown as AuditService,
    );
    jest.spyOn(service, 'now').mockReturnValue(AHORA);
  });

  describe('crear', () => {
    const dto = { medicoId: 'med-1', fechaHora: LUNES_9AM, motivo: 'Chequeo' };

    it('TU-17 crea la cita PENDIENTE, copia el precio y escribe el historial en la misma transacción serializable', async () => {
      const result = await service.create(paciente, dto, '127.0.0.1');

      expect(db.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }),
      );
      expect(db.cita.create.mock.calls[0][0].data).toMatchObject({
        pacienteId: 'pac-1',
        centroId: 'cen-1',
        costo: medico.precioConsulta,
      });
      expect(orden).toEqual(['tx', 'cita.create', 'historial.create']);
      expect(db.citaHistorial.create.mock.calls[0][0].data).toMatchObject({
        accion: 'CREADA',
        estadoNuevo: 'PENDIENTE',
        usuarioId: 'pac-1',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.CITA_CREADA }),
      );
      expect(result.costo).toBe(1500);
    });

    it('TU-18 R3 rechaza si el médico ya tiene una cita activa a esa hora (409)', async () => {
      db.cita.findFirst.mockResolvedValueOnce({ codigo: 'CIT-0002' });
      await expect(service.create(paciente, dto, null)).rejects.toThrow(
        'Dra. Laura Fernández ya tiene una cita el lun 09/11/2026 09:00. Elige otro horario.',
      );
      expect(db.cita.findFirst.mock.calls[0][0].where).toMatchObject({
        medicoId: 'med-1',
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
      });
      expect(db.cita.create).not.toHaveBeenCalled();
    });

    it('TU-19 R4 rechaza si el paciente ya tiene otra cita activa a esa hora (409)', async () => {
      db.cita.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ codigo: 'CIT-0009' });
      const error = await service.create(paciente, dto, null).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.message).toBe(
        'Ya tienes otra cita activa el lun 09/11/2026 09:00 (CIT-0009).',
      );
      expect(db.cita.findFirst.mock.calls[1][0].where).toMatchObject({
        pacienteId: 'pac-1',
      });
    });

    it('TU-20 R5 rechaza un médico inactivo (400)', async () => {
      db.medico.findUnique.mockResolvedValue({ ...medico, activo: false });
      await expect(service.create(paciente, dto, null)).rejects.toThrow(
        BadRequestException,
      );
      expect(db.cita.create).not.toHaveBeenCalled();
    });

    it('TU-20b R1 rechaza el pasado antes de abrir la transacción', async () => {
      await expect(
        service.create(
          paciente,
          { ...dto, fechaHora: '2026-11-02T09:00:00-04:00' },
          null,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it.each(['P2002', 'P2034'])(
      'TU-21 R10 convierte una reserva simultánea (%s) en 409',
      async (code) => {
        db.$transaction.mockRejectedValue(prismaError(code));
        const error = await service.create(paciente, dto, null).catch((e) => e);
        expect(error).toBeInstanceOf(ConflictException);
        expect(error.message).toBe(HORARIO_TOMADO);
        expect(audit.record).not.toHaveBeenCalled();
      },
    );
  });

  describe('operaciones sobre una cita', () => {
    it('TU-22 un paciente que no es el dueño recibe 403 y queda auditado', async () => {
      await expect(
        service.get(otroPaciente, 'cita-1', '10.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
      expect(audit.forbidden).toHaveBeenCalledWith(
        otroPaciente,
        'la cita CIT-0001',
        CITA_AJENA,
        '10.0.0.1',
      );
    });

    it('TU-22b un centro que no es el de la cita recibe 403', async () => {
      await expect(
        service.confirmar(
          { ...centro, id: 'cen-2' },
          'cita-1',
          undefined,
          null,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('TU-23 confirmar actualiza con bloqueo optimista y registra el historial en la misma transacción', async () => {
      await service.confirmar(centro, 'cita-1', 'Le esperamos', null);
      expect(orden).toEqual(['tx', 'cita.updateMany', 'historial.create']);
      expect(db.cita.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 'cita-1', estado: 'PENDIENTE', updatedAt: AHORA },
        data: { estado: 'CONFIRMADA' },
      });
      expect(db.citaHistorial.create.mock.calls[0][0].data).toMatchObject({
        accion: 'CONFIRMADA',
        estadoAnterior: 'PENDIENTE',
        estadoNuevo: 'CONFIRMADA',
        comentario: 'Le esperamos',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.CITA_CONFIRMADA }),
      );
    });

    it('TU-24 R10 si otra persona modificó la cita al mismo tiempo responde 409', async () => {
      db.cita.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.confirmar(centro, 'cita-1', undefined, null),
      ).rejects.toThrow(CITA_CAMBIO_CONCURRENTE);
      expect(db.citaHistorial.create).not.toHaveBeenCalled();
    });

    it('TU-25 reprogramar una cita CONFIRMADA la deja PENDIENTE y guarda el cambio de fecha', async () => {
      const confirmada = cita({ estado: 'CONFIRMADA' });
      db.cita.findUniqueOrThrow.mockResolvedValueOnce(confirmada);
      await service.reprogramar(
        paciente,
        'cita-1',
        { fechaHora: '2026-11-10T10:30:00-04:00' },
        null,
      );
      expect(db.cita.updateMany.mock.calls[0][0].data).toMatchObject({
        estado: 'PENDIENTE',
        fechaHora: new Date('2026-11-10T14:30:00Z'),
      });
      const h = db.citaHistorial.create.mock.calls[0][0].data;
      expect(h).toMatchObject({
        accion: 'REPROGRAMADA',
        estadoAnterior: 'CONFIRMADA',
        estadoNuevo: 'PENDIENTE',
      });
      expect(h.cambios).toEqual({
        fechaHora: {
          antes: '2026-11-09T13:00:00.000Z',
          despues: '2026-11-10T14:30:00.000Z',
        },
      });
      // R3/R4 excluyen la propia cita
      expect(db.cita.findFirst.mock.calls[0][0].where).toMatchObject({
        id: { not: 'cita-1' },
      });
    });

    it('TU-26 R7 no se puede editar una cita cerrada (409)', async () => {
      db.cita.findUniqueOrThrow.mockResolvedValueOnce(
        cita({ estado: 'ATENDIDA' }),
      );
      await expect(
        service.update(paciente, 'cita-1', { motivo: 'Otro' }, null),
      ).rejects.toThrow(ConflictException);
      expect(db.cita.updateMany).not.toHaveBeenCalled();
    });

    it('TU-27 el historial de un PATCH guarda campo: {antes, despues}', async () => {
      await service.update(
        paciente,
        'cita-1',
        { motivo: 'Dolor de espalda', tipo: 'ESTUDIO' },
        null,
      );
      expect(db.citaHistorial.create.mock.calls[0][0].data.cambios).toEqual({
        motivo: { antes: 'Chequeo', despues: 'Dolor de espalda' },
        tipo: { antes: 'CONSULTA', despues: 'ESTUDIO' },
      });
    });

    it('TU-27b un PATCH sin cambios reales responde 400', async () => {
      await expect(
        service.update(paciente, 'cita-1', { motivo: 'Chequeo' }, null),
      ).rejects.toThrow('No hay cambios para guardar.');
    });
  });
});
