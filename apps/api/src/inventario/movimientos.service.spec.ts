import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EstadoCita, Prisma, Role } from '@prisma/client';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CITA_OTRO_CENTRO, MovimientosService } from './movimientos.service';
import { RecursosService } from './recursos.service';

const centro: AuthUser = {
  id: 'cen-1',
  email: 'centro@medicita.test',
  fullName: 'Centro',
  role: Role.CENTRO_MEDICO,
};

function recurso(o: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    codigo: 'REC-0001',
    centroId: 'cen-1',
    nombre: 'Gasas',
    tipo: 'INSUMO',
    categoria: 'MATERIAL_MEDICO',
    unidad: 'paquete',
    stockActual: 10,
    stockMinimo: 2,
    costoUnitario: new Prisma.Decimal(85),
    requiereVencimiento: false,
    estadoEquipo: null,
    numeroSerie: null,
    medicoAsignadoId: null,
    medicoAsignado: null,
    devolucionPrevista: null,
    activo: true,
    centro: { id: 'cen-1', fullName: 'Centro' },
    lotes: [],
    ...o,
  };
}

describe('MovimientosService', () => {
  let service: MovimientosService;
  let orden: string[];
  let db: {
    recurso: Record<string, jest.Mock>;
    lote: Record<string, jest.Mock>;
    movimiento: Record<string, jest.Mock>;
    cita: Record<string, jest.Mock>;
    medico: Record<string, jest.Mock>;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let audit: { record: jest.Mock; forbidden: jest.Mock };
  let recursos: { cargar: jest.Mock };
  let n: number;

  beforeEach(() => {
    orden = [];
    n = 0;
    db = {
      recurso: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(
            (where.id.in as string[]).map((id) =>
              recurso({ id, codigo: `REC-${id}` }),
            ),
          ),
        ),
        update: jest.fn(({ data }) => {
          orden.push(`recurso.update:${JSON.stringify(data)}`);
          return Promise.resolve({});
        }),
      },
      lote: { update: jest.fn(), create: jest.fn() },
      movimiento: {
        create: jest.fn(({ data }) => {
          orden.push(`movimiento.create:${data.tipo}`);
          n++;
          return Promise.resolve({
            ...data,
            id: `m${n}`,
            codigo: `MOV-000${n}`,
            recurso: {
              id: data.recursoId,
              codigo: 'REC',
              nombre: 'Gasas',
              tipo: 'INSUMO',
              unidad: 'paquete',
            },
            usuario: {
              id: 'cen-1',
              fullName: 'Centro',
              email: 'c@x',
              role: 'CENTRO_MEDICO',
            },
            lote: null,
            medico: null,
            cita: data.citaId
              ? { id: data.citaId, codigo: 'CIT-0001', fechaHora: new Date() }
              : null,
            centro: { id: 'cen-1', fullName: 'Centro' },
            costoUnitario: data.costoUnitario ?? null,
            estadoEquipoNuevo: data.estadoEquipoNuevo ?? null,
            estadoEquipoAnterior: data.estadoEquipoAnterior ?? null,
          });
        }),
      },
      cita: { findUnique: jest.fn() },
      medico: { findUnique: jest.fn() },
      $queryRaw: jest.fn((strings: TemplateStringsArray, id: string) => {
        orden.push(`lock:${id}`);
        return Promise.resolve([]);
      }),
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
    recursos = { cargar: jest.fn().mockResolvedValue(recurso()) };
    service = new MovimientosService(
      db as unknown as PrismaService,
      audit as unknown as AuditService,
      recursos as unknown as RecursosService,
    );
    jest
      .spyOn(service, 'now')
      .mockReturnValue(new Date('2026-11-11T14:00:00Z'));
  });

  it('TU-43 L9 bloquea la fila del recurso antes de leer el stock y actualiza en la misma transacción', async () => {
    const res = await service.salida(
      centro,
      { recursoId: 'rec-1', cantidad: 4 },
      null,
    );
    expect(orden).toEqual([
      'tx',
      'lock:rec-1',
      'movimiento.create:SALIDA',
      'recurso.update:{"stockActual":6}',
    ]);
    expect(res[0]).toMatchObject({
      stockAnterior: 10,
      stockNuevo: 6,
      cantidad: 4,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.MOV_SALIDA }),
    );
  });

  it('TU-44 L9 con varios recursos bloquea en orden de id (evita interbloqueos) y es todo o nada', async () => {
    db.cita.findUnique.mockResolvedValue({
      id: 'cita-1',
      codigo: 'CIT-0001',
      centroId: 'cen-1',
      estado: EstadoCita.ATENDIDA,
    });
    db.recurso.findMany.mockResolvedValue([
      recurso({ id: 'b' }),
      recurso({ id: 'a', stockActual: 1 }),
    ]);
    await expect(
      service.consumo(
        centro,
        {
          citaId: 'cita-1',
          items: [
            { recursoId: 'b', cantidad: 2 },
            { recursoId: 'a', cantidad: 5 },
          ],
        },
        null,
      ),
    ).rejects.toThrow('Stock insuficiente (disponible: 1).');
    expect(orden.filter((x) => x.startsWith('lock'))).toEqual([
      'lock:a',
      'lock:b',
    ]);
    // La transacción falla completa: nada se audita
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('TU-45 L8 cita de otro centro → 403 auditado; cita pendiente → 409', async () => {
    db.cita.findUnique.mockResolvedValueOnce({
      id: 'c',
      codigo: 'CIT-0009',
      centroId: 'cen-2',
      estado: EstadoCita.ATENDIDA,
    });
    await expect(
      service.salida(
        centro,
        {
          recursoId: 'rec-1',
          cantidad: 1,
          citaId: '00000000-0000-4000-8000-000000000000',
        },
        '1.2.3.4',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(audit.forbidden).toHaveBeenCalledWith(
      centro,
      'la cita CIT-0009',
      CITA_OTRO_CENTRO,
      '1.2.3.4',
    );

    db.cita.findUnique.mockResolvedValueOnce({
      id: 'c',
      codigo: 'CIT-0010',
      centroId: 'cen-1',
      estado: EstadoCita.PENDIENTE,
    });
    await expect(
      service.salida(
        centro,
        { recursoId: 'rec-1', cantidad: 1, citaId: 'c' },
        null,
      ),
    ).rejects.toThrow(ConflictException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('TU-46 la salida ligada a una cita guarda el citaId y el motivo "Consumo en la cita"', async () => {
    db.cita.findUnique.mockResolvedValue({
      id: 'cita-1',
      codigo: 'CIT-0001',
      centroId: 'cen-1',
      estado: EstadoCita.ATENDIDA,
    });
    const [m] = await service.salida(
      centro,
      { recursoId: 'rec-1', cantidad: 2, citaId: 'cita-1' },
      null,
    );
    expect(m).toMatchObject({
      citaId: 'cita-1',
      motivo: 'Consumo en la cita CIT-0001',
    });
  });

  it('TU-47 el acceso se verifica (403 auditado) antes de abrir la transacción', async () => {
    recursos.cargar.mockRejectedValue(new ForbiddenException('ajeno'));
    await expect(
      service.entrada(centro, { recursoId: 'rec-1', cantidad: 1 }, null),
    ).rejects.toThrow(ForbiddenException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
