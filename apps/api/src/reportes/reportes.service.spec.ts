import { EstadoCita, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ReportesService } from './reportes.service';

const admin: AuthUser = {
  id: 'adm',
  email: 'admin@x.do',
  fullName: 'Admin',
  role: Role.ADMIN,
};
const centro: AuthUser = {
  id: 'cen-1',
  email: 'centro@x.do',
  fullName: 'Centro',
  role: Role.CENTRO_MEDICO,
};

const fila = (
  codigo: string,
  fechaHora: string,
  estado: EstadoCita,
  costo: number,
  medico = { id: 'm1', nombre: 'Dra. Laura', especialidad: 'General' },
) => ({
  codigo,
  fechaHora: new Date(fechaHora),
  estado,
  tipo: 'CONSULTA',
  costo: new Prisma.Decimal(costo),
  paciente: { fullName: 'Paciente, "Demo"' },
  medico,
  centro: { fullName: 'Centro Uno' },
});

const cardio = { id: 'm2', nombre: 'Dr. Ricardo', especialidad: 'Cardiología' };

describe('ReportesService', () => {
  let service: ReportesService;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([
      fila('CIT-0001', '2026-11-02T13:00:00Z', 'ATENDIDA', 1500),
      fila('CIT-0002', '2026-11-02T14:00:00Z', 'NO_ASISTIO', 1500),
      fila('CIT-0003', '2026-11-03T13:00:00Z', 'ATENDIDA', 2500, cardio),
      fila('CIT-0004', '2026-11-03T14:00:00Z', 'CANCELADA', 2500, cardio),
      // 23:30 RD del día 4 = 03:30 UTC del día 5: cuenta para el 4 (hora de RD)
      fila('CIT-0005', '2026-11-05T03:30:00Z', 'PENDIENTE', 1500),
    ]);
    service = new ReportesService({
      cita: { findMany },
    } as unknown as PrismaService);
  });

  it('TU-28 calcula totales por estado, tasas e ingresos de citas atendidas', async () => {
    const r = await service.citas(admin, {});
    expect(r.total).toBe(5);
    expect(r.porEstado).toEqual({
      PENDIENTE: 1,
      CONFIRMADA: 0,
      ATENDIDA: 2,
      NO_ASISTIO: 1,
      CANCELADA: 1,
    });
    expect(r.tasaAsistencia).toBe(0.6667); // 2 / (2 + 1)
    expect(r.tasaCancelacion).toBe(0.2); // 1 / 5
    expect(r.ingresos).toBe(4000); // 1500 + 2500
  });

  it('TU-29 agrupa por médico y por día en hora de RD, con los días vacíos del rango', async () => {
    const r = await service.citas(admin, {
      desde: '2026-11-02',
      hasta: '2026-11-05',
    });
    expect(r.porMedico.map((m) => [m.nombre, m.total, m.ingresos])).toEqual([
      ['Dra. Laura', 3, 1500],
      ['Dr. Ricardo', 2, 2500],
    ]);
    expect(r.porMedico[1].tasaAsistencia).toBe(1);
    expect(r.porDia.map((d) => [d.fecha, d.total])).toEqual([
      ['2026-11-02', 2],
      ['2026-11-03', 2],
      ['2026-11-04', 1],
      ['2026-11-05', 0],
    ]);
  });

  it('TU-30 el centro solo ve su propio centro aunque pida otro', async () => {
    await service.citas(centro, {
      centroId: '00000000-0000-4000-8000-000000000000',
    });
    expect(findMany.mock.calls[0][0].where.centroId).toBe('cen-1');
  });

  it('TU-31 sin citas las tasas son N/D (null)', async () => {
    findMany.mockResolvedValue([]);
    const r = await service.citas(admin, {});
    expect(r.tasaAsistencia).toBeNull();
    expect(r.tasaCancelacion).toBeNull();
    expect(r.ingresos).toBe(0);
  });

  it('TU-32 rechaza un rango invertido', async () => {
    await expect(
      service.citas(admin, { desde: '2026-11-10', hasta: '2026-11-01' }),
    ).rejects.toThrow('La fecha "desde" no puede ser posterior a "hasta".');
  });

  it('TU-33 genera el CSV con BOM, secciones y celdas escapadas', async () => {
    const csv = service.toCsv(await service.citas(admin, {}));
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lineas = csv.slice(1).split('\r\n');
    expect(lineas).toContain('Total de citas,5');
    expect(lineas).toContain('Tasa de asistencia,66.7%');
    expect(lineas).toContain('Ingresos de citas atendidas (DOP),4000.00');
    expect(lineas).toContain('Por médico');
    expect(lineas).toContain('Detalle de citas');
    expect(csv).toContain(
      'CIT-0001,2026-11-02 09:00,Atendida,CONSULTA,"Paciente, ""Demo""",Dra. Laura,General,Centro Uno,1500.00',
    );
  });
});
