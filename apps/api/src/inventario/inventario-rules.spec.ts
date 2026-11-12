import { BadRequestException, ConflictException } from '@nestjs/common';
import { EstadoCita, EstadoEquipo, TipoRecurso } from '@prisma/client';
import {
  alertas,
  estadoLote,
  fefo,
  LoteRegla,
  RecursoRegla,
  stockDisponible,
  validarAjuste,
  validarAsignacion,
  validarCambioEstadoEquipo,
  validarCantidad,
  validarCitaConsumo,
  validarDevolucion,
  validarEsInsumo,
  validarLoteEntrada,
  validarOperable,
  validarStockSuficiente,
} from './inventario-rules';

const HOY = '2026-11-11';
const AHORA = new Date('2026-11-11T14:00:00Z'); // 10:00 en RD
const fecha = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

const insumo = (o: Partial<RecursoRegla> = {}): RecursoRegla => ({
  codigo: 'REC-0001',
  nombre: 'Paracetamol 500 mg',
  tipo: TipoRecurso.INSUMO,
  activo: true,
  requiereVencimiento: true,
  stockActual: 30,
  stockMinimo: 10,
  estadoEquipo: null,
  ...o,
});

const equipo = (o: Partial<RecursoRegla> = {}) => ({
  codigo: 'REC-0011',
  nombre: 'Electrocardiógrafo',
  tipo: TipoRecurso.EQUIPO,
  activo: true,
  requiereVencimiento: false,
  stockActual: null,
  stockMinimo: null,
  estadoEquipo: EstadoEquipo.DISPONIBLE as EstadoEquipo | null,
  centroId: 'cen-1',
  medicoAsignado: null as { nombre: string } | null,
  ...o,
});

const lote = (id: string, vence: string, cantidad: number): LoteRegla => ({
  id,
  numeroLote: id,
  fechaVencimiento: fecha(vence),
  cantidadDisponible: cantidad,
});

function mensaje(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  return '';
}

describe('Reglas de negocio del inventario', () => {
  describe('TU-34 L1 cantidades enteras mayores que 0', () => {
    it.each([1, 5, 1000])('acepta %p', (n) => {
      expect(() => validarCantidad(n)).not.toThrow();
    });
    it.each([0, -3, 1.5, Number.NaN])('rechaza %p con 400', (n) => {
      expect(mensaje(() => validarCantidad(n))).toBe(
        'La cantidad debe ser un número entero mayor que 0.',
      );
    });
  });

  describe('TU-35 L2 stock suficiente', () => {
    it('permite sacar justo lo disponible', () => {
      expect(() => validarStockSuficiente(8, 8)).not.toThrow();
    });
    it('rechaza sacar más con 409 y el disponible en el mensaje', () => {
      expect(() => validarStockSuficiente(8, 9)).toThrow(ConflictException);
      expect(mensaje(() => validarStockSuficiente(8, 9))).toBe(
        'Stock insuficiente (disponible: 8).',
      );
    });
  });

  describe('TU-36 L3 lotes y FEFO', () => {
    const lotes = [
      lote('C', '2027-06-01', 10),
      lote('VENCIDO', '2026-11-05', 50),
      lote('A', '2026-11-20', 4),
      lote('B', '2027-01-15', 6),
      lote('VACIO', '2026-11-12', 0),
    ];

    it('estado del lote: vencido, próximo a vencer (≤ 30 días) o vigente', () => {
      expect(estadoLote(fecha('2026-11-10'), HOY)).toBe('VENCIDO');
      expect(estadoLote(fecha(HOY), HOY)).toBe('PROXIMO_A_VENCER');
      expect(estadoLote(fecha('2026-12-11'), HOY)).toBe('PROXIMO_A_VENCER');
      expect(estadoLote(fecha('2026-12-12'), HOY)).toBe('VIGENTE');
    });

    it('descuenta primero el lote que vence antes y salta los vencidos y vacíos', () => {
      const reparto = fefo(lotes, 12, HOY);
      expect(reparto.map((p) => [p.lote.id, p.cantidad])).toEqual([
        ['A', 4],
        ['B', 6],
        ['C', 2],
      ]);
    });

    it('el disponible excluye las unidades vencidas', () => {
      expect(stockDisponible(insumo(), lotes, HOY)).toBe(20);
      expect(
        stockDisponible(
          insumo({ requiereVencimiento: false, stockActual: 7 }),
          [],
          HOY,
        ),
      ).toBe(7);
    });

    it('nunca toma lotes vencidos aunque tengan stock (L2 con 409)', () => {
      expect(mensaje(() => fefo(lotes, 21, HOY))).toBe(
        'Stock insuficiente (disponible: 20).',
      );
    });

    it('la entrada exige lote y vencimiento futuro', () => {
      expect(
        mensaje(() => validarLoteEntrada(insumo(), undefined, undefined, HOY)),
      ).toMatch(/requiere vencimiento: indica el número de lote/);
      expect(mensaje(() => validarLoteEntrada(insumo(), 'L1', HOY, HOY))).toBe(
        'La fecha de vencimiento debe ser futura: no se reciben lotes vencidos.',
      );
      expect(validarLoteEntrada(insumo(), ' L1 ', '2027-01-01', HOY)).toEqual({
        numeroLote: 'L1',
        fechaVencimiento: '2027-01-01',
      });
      expect(
        validarLoteEntrada(
          insumo({ requiereVencimiento: false }),
          undefined,
          undefined,
          HOY,
        ),
      ).toBeNull();
    });
  });

  describe('TU-37 L4 asignación de equipos', () => {
    const medico = {
      nombre: 'Dr. Ricardo Gómez',
      centroId: 'cen-1',
      activo: true,
    };
    const futuro = new Date('2026-11-18T21:00:00Z');

    it('asigna un equipo disponible a un médico activo del centro con devolución futura', () => {
      expect(() =>
        validarAsignacion(equipo(), medico, futuro, AHORA),
      ).not.toThrow();
    });
    it('solo los equipos se asignan (400)', () => {
      expect(() =>
        validarAsignacion(
          { ...insumo(), centroId: 'cen-1' },
          medico,
          futuro,
          AHORA,
        ),
      ).toThrow(BadRequestException);
    });
    it('rechaza un equipo ya asignado o en mantenimiento (409)', () => {
      expect(
        mensaje(() =>
          validarAsignacion(
            equipo({
              estadoEquipo: EstadoEquipo.ASIGNADO,
              medicoAsignado: { nombre: 'Dra. Laura' },
            } as never),
            medico,
            futuro,
            AHORA,
          ),
        ),
      ).toBe(
        'Electrocardiógrafo ya está asignado a Dra. Laura. Primero registra la devolución.',
      );
      expect(() =>
        validarAsignacion(
          equipo({ estadoEquipo: EstadoEquipo.MANTENIMIENTO }),
          medico,
          futuro,
          AHORA,
        ),
      ).toThrow(ConflictException);
    });
    it('rechaza médico de otro centro, inactivo o devolución en el pasado (400)', () => {
      expect(
        mensaje(() =>
          validarAsignacion(
            equipo(),
            { ...medico, centroId: 'cen-2' },
            futuro,
            AHORA,
          ),
        ),
      ).toBe('El médico no pertenece a este centro.');
      expect(
        mensaje(() =>
          validarAsignacion(
            equipo(),
            { ...medico, activo: false },
            futuro,
            AHORA,
          ),
        ),
      ).toMatch(/está inactivo/);
      expect(
        mensaje(() => validarAsignacion(equipo(), medico, AHORA, AHORA)),
      ).toBe('La fecha de devolución prevista debe ser futura.');
    });
  });

  describe('TU-38 L5 devolución y estados del equipo', () => {
    it('solo se devuelve un equipo asignado (409)', () => {
      expect(() =>
        validarDevolucion(equipo({ estadoEquipo: EstadoEquipo.ASIGNADO })),
      ).not.toThrow();
      expect(mensaje(() => validarDevolucion(equipo()))).toBe(
        'Solo se puede devolver un equipo asignado (estado actual: Disponible).',
      );
    });
    it('mantenimiento ↔ disponible por ajuste; desde asignado no (409)', () => {
      expect(() =>
        validarCambioEstadoEquipo(equipo(), EstadoEquipo.MANTENIMIENTO),
      ).not.toThrow();
      expect(() =>
        validarCambioEstadoEquipo(
          equipo({ estadoEquipo: EstadoEquipo.MANTENIMIENTO }),
          EstadoEquipo.DISPONIBLE,
        ),
      ).not.toThrow();
      expect(
        mensaje(() =>
          validarCambioEstadoEquipo(
            equipo({ estadoEquipo: EstadoEquipo.ASIGNADO }),
            EstadoEquipo.MANTENIMIENTO,
          ),
        ),
      ).toMatch(/Primero registra la devolución/);
    });
  });

  describe('TU-39 L6 recurso inactivo o dado de baja', () => {
    it('rechaza movimientos con 409', () => {
      expect(mensaje(() => validarOperable(insumo({ activo: false })))).toBe(
        'Paracetamol 500 mg (REC-0001) está inactivo y no admite movimientos.',
      );
      expect(
        mensaje(() =>
          validarOperable(equipo({ estadoEquipo: EstadoEquipo.BAJA })),
        ),
      ).toMatch(/dado de baja/);
      expect(() => validarOperable(insumo())).not.toThrow();
    });
    it('entradas y salidas solo para insumos (400)', () => {
      expect(() => validarEsInsumo(equipo(), 'La salida')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('TU-40 L7 ajustes', () => {
    it('exige motivo', () => {
      expect(mensaje(() => validarAjuste('  ', 'AUMENTO', 1, 5))).toBe(
        'El ajuste exige un motivo.',
      );
    });
    it('no puede dejar el stock negativo (409)', () => {
      expect(mensaje(() => validarAjuste('Conteo', 'DISMINUCION', 6, 5))).toBe(
        'El ajuste dejaría el stock negativo (disponible: 5).',
      );
      expect(validarAjuste(' Conteo ', 'DISMINUCION', 5, 5)).toBe('Conteo');
      expect(() => validarAjuste('Conteo', 'AUMENTO', 100, 0)).not.toThrow();
    });
  });

  describe('TU-41 L8 consumo ligado a una cita', () => {
    it('solo citas ATENDIDAS (409 en los demás estados)', () => {
      expect(() =>
        validarCitaConsumo({ codigo: 'CIT-1', estado: EstadoCita.ATENDIDA }),
      ).not.toThrow();
      expect(
        mensaje(() =>
          validarCitaConsumo({ codigo: 'CIT-2', estado: EstadoCita.PENDIENTE }),
        ),
      ).toBe(
        'Solo se registran insumos usados en una cita Atendida (CIT-2 está Pendiente).',
      );
      expect(() =>
        validarCitaConsumo({ codigo: 'CIT-3', estado: EstadoCita.NO_ASISTIO }),
      ).toThrow(ConflictException);
    });
  });

  describe('TU-42 L10 alertas', () => {
    it('bajo stock cuando el disponible es ≤ mínimo', () => {
      const r = insumo({
        requiereVencimiento: false,
        stockActual: 10,
        stockMinimo: 10,
      });
      expect(alertas(r, [], HOY).bajoStock).toBe(true);
      expect(alertas({ ...r, stockActual: 11 }, [], HOY).bajoStock).toBe(false);
    });
    it('los vencidos no cuentan para el disponible (pueden provocar bajo stock)', () => {
      const r = insumo({ stockActual: 25, stockMinimo: 10 });
      const a = alertas(
        r,
        [lote('V', '2026-11-01', 20), lote('A', '2027-03-01', 5)],
        HOY,
      );
      expect(a).toEqual({
        bajoStock: true,
        proximoAVencer: false,
        vencido: true,
      });
    });
    it('próximo a vencer con lotes que vencen en 30 días o menos', () => {
      const a = alertas(insumo(), [lote('P', '2026-12-01', 30)], HOY);
      expect(a).toEqual({
        bajoStock: false,
        proximoAVencer: true,
        vencido: false,
      });
    });
    it('los lotes vacíos no generan alertas y los equipos no tienen alertas', () => {
      expect(
        alertas(
          insumo(),
          [lote('V', '2026-01-01', 0), lote('A', '2027-03-01', 30)],
          HOY,
        ),
      ).toEqual({
        bajoStock: false,
        proximoAVencer: false,
        vencido: false,
      });
      expect(alertas(equipo(), [], HOY).bajoStock).toBe(false);
    });
  });
});
