import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { sumarDias } from '../common/rd-time';
import { PrismaService } from '../prisma/prisma.service';
import { InventarioReportesService } from './inventario-reportes.service';
import { hoyRd } from './inventario-rules';

const admin: AuthUser = {
  id: 'adm',
  email: 'a@x',
  fullName: 'Admin',
  role: Role.ADMIN,
};
const centro: AuthUser = {
  id: 'cen-1',
  email: 'c@x',
  fullName: 'Centro',
  role: Role.CENTRO_MEDICO,
};

const hoy = hoyRd();
const lote = (numero: string, dias: number, cantidad: number) => ({
  id: numero,
  recursoId: 'r',
  numeroLote: numero,
  fechaVencimiento: new Date(`${sumarDias(hoy, dias)}T00:00:00Z`),
  cantidadDisponible: cantidad,
  createdAt: new Date(),
});

function recurso(o: Record<string, unknown>) {
  return {
    id: String(o.nombre),
    codigo: 'REC',
    centroId: 'cen-1',
    tipo: 'INSUMO',
    categoria: 'MATERIAL_MEDICO',
    unidad: 'u',
    stockMinimo: 10,
    costoUnitario: new Prisma.Decimal(100),
    requiereVencimiento: false,
    estadoEquipo: null,
    numeroSerie: null,
    medicoAsignadoId: null,
    medicoAsignado: null,
    devolucionPrevista: null,
    activo: true,
    centro: { id: 'cen-1', fullName: 'Centro Uno' },
    lotes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  };
}

describe('InventarioReportesService', () => {
  let service: InventarioReportesService;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([
      recurso({ nombre: 'Guantes', stockActual: 5 }), // bajo stock, 500
      recurso({
        nombre: 'Paracetamol',
        requiereVencimiento: true,
        stockActual: 30,
        lotes: [lote('V', -3, 10), lote('P', 12, 8), lote('OK', 200, 12)],
      }), // 3000 (10 vencidas; disponible 20)
      recurso({
        nombre: 'ECG',
        tipo: 'EQUIPO',
        categoria: 'EQUIPO_MEDICO',
        stockActual: null,
        stockMinimo: null,
        estadoEquipo: 'ASIGNADO',
        costoUnitario: new Prisma.Decimal(150000),
      }),
    ]);
    count = jest.fn().mockResolvedValue(1);
    service = new InventarioReportesService({
      recurso: { findMany, count },
    } as unknown as PrismaService);
  });

  it('TU-48 existencias: valor total, bajo stock, próximos a vencer, vencidos y equipos por estado', async () => {
    const r = await service.existencias(admin, {});
    expect(r.totales).toMatchObject({
      recursos: 3,
      insumos: 2,
      equipos: 1,
      valorInsumos: 3500,
      valorEquipos: 150000,
      valorTotal: 153500,
      bajoStock: 1,
      proximoAVencer: 1,
      unidadesProximasAVencer: 8,
      vencido: 1,
      unidadesVencidas: 10,
      valorVencido: 1000,
    });
    expect(r.equiposPorEstado).toEqual({
      DISPONIBLE: 0,
      ASIGNADO: 1,
      MANTENIMIENTO: 0,
      BAJA: 1,
    });
    expect(r.proximosAVencer[0]).toMatchObject({
      numeroLote: 'P',
      dias: 12,
      cantidad: 8,
    });
    expect(r.bajoStock.map((b) => b.nombre)).toEqual(['Guantes']);
  });

  it('TU-49 el centro solo ve su centro aunque pida otro', async () => {
    await service.existencias(centro, {
      centroId: '00000000-0000-4000-8000-000000000000',
    });
    expect(findMany.mock.calls[0][0].where.centroId).toBe('cen-1');
  });

  it('TU-50 el CSV de existencias trae el resumen con el valor total y las alertas', async () => {
    const csv = service.existenciasCsv(await service.existencias(admin, {}));
    const lineas = csv.slice(1).split('\r\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lineas).toEqual(
      expect.arrayContaining([
        'Valor total del inventario (DOP),153500.00',
        'Bajo stock (insumos),1',
        '"Próximo a vencer (lotes, 30 días)",1',
        'Vencido (lotes),1',
        'Equipos: Asignado,1',
      ]),
    );
  });
});
