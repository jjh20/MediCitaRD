import { BadRequestException, ConflictException } from '@nestjs/common';
import { EstadoCita, Role } from '@prisma/client';
import {
  ESTADOS_CERRADOS,
  HorarioMedico,
  TRANSICIONES,
  validarCancelacion,
  validarCierre,
  validarHorario,
  validarMedicoActivo,
  validarModificable,
  validarReprogramable,
  validarTransicion,
  validarVentana,
} from './cita-rules';

const H = 3_600_000;
const D = 24 * H;
/** Miércoles 4 de noviembre de 2026, 10:00 en RD (14:00 UTC). */
const AHORA = new Date('2026-11-04T14:00:00Z');
/** Instante en hora de RD (UTC−4). */
const rd = (fechaHora: string) => new Date(`${fechaHora}:00-04:00`);

const medico: HorarioMedico = {
  nombre: 'Dra. Laura Fernández',
  diasSemana: [1, 2, 3, 4, 5],
  horaInicio: '08:00',
  horaFin: '17:00',
  duracionMin: 30,
  activo: true,
};

function mensaje(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  return '';
}

describe('Reglas de negocio de las citas', () => {
  describe('TU-10 R1 ventana de fechas', () => {
    it('acepta una fecha futura dentro de 90 días', () => {
      expect(() =>
        validarVentana(new Date(AHORA.getTime() + D), AHORA),
      ).not.toThrow();
      expect(() =>
        validarVentana(new Date(AHORA.getTime() + 90 * D), AHORA),
      ).not.toThrow();
    });

    it('rechaza el pasado y el momento actual', () => {
      expect(() =>
        validarVentana(new Date(AHORA.getTime() - 60_000), AHORA),
      ).toThrow(BadRequestException);
      expect(mensaje(() => validarVentana(AHORA, AHORA))).toMatch(/ya pasó/);
    });

    it('rechaza más de 90 días de anticipación', () => {
      expect(
        mensaje(() =>
          validarVentana(new Date(AHORA.getTime() + 90 * D + 60_000), AHORA),
        ),
      ).toMatch(/90 días/);
    });
  });

  describe('TU-11 R2 horario del médico y alineación', () => {
    it('acepta turnos alineados dentro del horario (8:00, 8:30… 16:30)', () => {
      for (const h of ['08:00', '08:30', '12:00', '16:30']) {
        expect(() =>
          validarHorario(medico, rd(`2026-11-09T${h}`)),
        ).not.toThrow();
      }
    });

    it('rechaza un día en que el médico no atiende (sábado)', () => {
      expect(
        mensaje(() => validarHorario(medico, rd('2026-11-07T09:00'))),
      ).toMatch(/no atiende ese día.*lunes a viernes/);
    });

    it('rechaza horas fuera del horario (antes de abrir o turno que termina después del cierre)', () => {
      expect(
        mensaje(() => validarHorario(medico, rd('2026-11-09T07:30'))),
      ).toMatch(/fuera del horario/);
      expect(
        mensaje(() => validarHorario(medico, rd('2026-11-09T17:00'))),
      ).toMatch(/fuera del horario/);
    });

    it('rechaza horas no alineadas a la duración (8:15) y con segundos', () => {
      expect(
        mensaje(() => validarHorario(medico, rd('2026-11-09T08:15'))),
      ).toMatch(/turno de 30 minutos \(por ejemplo 08:00 o 08:30\)/);
      expect(() =>
        validarHorario(medico, new Date('2026-11-09T12:00:30Z')),
      ).toThrow(BadRequestException);
    });

    it('interpreta el horario en hora de RD, no en UTC', () => {
      // 08:00 RD = 12:00 UTC; 08:00 UTC = 04:00 RD (fuera de horario)
      expect(() =>
        validarHorario(medico, new Date('2026-11-09T12:00:00Z')),
      ).not.toThrow();
      expect(() =>
        validarHorario(medico, new Date('2026-11-09T08:00:00Z')),
      ).toThrow(BadRequestException);
    });
  });

  describe('TU-12 R5 médico inactivo', () => {
    it('rechaza agendar con un médico inactivo', () => {
      expect(
        mensaje(() => validarMedicoActivo({ ...medico, activo: false })),
      ).toMatch(/no está disponible/);
      expect(() => validarMedicoActivo(medico)).not.toThrow();
    });
  });

  describe('TU-13 R6 transiciones de estado', () => {
    const todos = Object.values(EstadoCita);
    const permitidas: [EstadoCita, EstadoCita][] = [
      ['PENDIENTE', 'CONFIRMADA'],
      ['PENDIENTE', 'CANCELADA'],
      ['CONFIRMADA', 'ATENDIDA'],
      ['CONFIRMADA', 'NO_ASISTIO'],
      ['CONFIRMADA', 'CANCELADA'],
    ];

    it.each(permitidas)('permite %s → %s', (de, a) => {
      expect(() => validarTransicion('CIT-0001', de, a)).not.toThrow();
    });

    const prohibidas = todos.flatMap((de) =>
      todos
        .filter((a) => !permitidas.some(([x, y]) => x === de && y === a))
        .map((a) => [de, a] as [EstadoCita, EstadoCita]),
    );

    it.each(prohibidas)('rechaza %s → %s con 409', (de, a) => {
      expect(() => validarTransicion('CIT-0001', de, a)).toThrow(
        ConflictException,
      );
    });

    it('la matriz declarada coincide con las transiciones permitidas', () => {
      const declaradas = todos.flatMap((de) =>
        TRANSICIONES[de].map((a) => `${de}>${a}`),
      );
      expect(declaradas.sort()).toEqual(
        permitidas.map(([a, b]) => `${a}>${b}`).sort(),
      );
    });

    it('explica que una pendiente debe confirmarse antes de cerrarse', () => {
      expect(
        mensaje(() => validarTransicion('CIT-0007', 'PENDIENTE', 'ATENDIDA')),
      ).toBe(
        'No se puede pasar la cita CIT-0007 de Pendiente a Atendida. Primero hay que confirmarla.',
      );
    });

    it('reprogramar solo en PENDIENTE o CONFIRMADA', () => {
      expect(() => validarReprogramable('CIT-1', 'PENDIENTE')).not.toThrow();
      expect(() => validarReprogramable('CIT-1', 'CONFIRMADA')).not.toThrow();
      for (const e of ESTADOS_CERRADOS) {
        expect(() => validarReprogramable('CIT-1', e)).toThrow(
          ConflictException,
        );
      }
    });
  });

  describe('TU-14 R7 cita cerrada no se modifica', () => {
    it.each(ESTADOS_CERRADOS)(
      'rechaza modificar una cita %s (409)',
      (estado) => {
        expect(mensaje(() => validarModificable('CIT-0003', estado))).toMatch(
          /CIT-0003 ya está cerrada .* no se puede modificar/,
        );
      },
    );

    it('permite modificar citas activas', () => {
      expect(() => validarModificable('CIT-1', 'PENDIENTE')).not.toThrow();
      expect(() => validarModificable('CIT-1', 'CONFIRMADA')).not.toThrow();
    });
  });

  describe('TU-15 R8 cancelación', () => {
    const enTresHoras = new Date(AHORA.getTime() + 3 * H);
    const enUnaHora = new Date(AHORA.getTime() + H);

    it('exige motivo (vacío o solo espacios)', () => {
      expect(
        mensaje(() =>
          validarCancelacion(Role.CENTRO_MEDICO, undefined, enTresHoras, AHORA),
        ),
      ).toBe('Debes indicar el motivo de la cancelación.');
      expect(() =>
        validarCancelacion(Role.PACIENTE, '   ', enTresHoras, AHORA),
      ).toThrow(BadRequestException);
    });

    it('el paciente puede cancelar con 2 horas o más de anticipación', () => {
      expect(
        validarCancelacion(Role.PACIENTE, ' Viaje ', enTresHoras, AHORA),
      ).toBe('Viaje');
      expect(() =>
        validarCancelacion(
          Role.PACIENTE,
          'x',
          new Date(AHORA.getTime() + 2 * H),
          AHORA,
        ),
      ).not.toThrow();
    });

    it('el paciente no puede cancelar con menos de 2 horas', () => {
      expect(
        mensaje(() =>
          validarCancelacion(Role.PACIENTE, 'Viaje', enUnaHora, AHORA),
        ),
      ).toMatch(/hasta 2 horas antes/);
    });

    it('el centro sí puede cancelar con menos de 2 horas', () => {
      expect(() =>
        validarCancelacion(
          Role.CENTRO_MEDICO,
          'Médico enfermo',
          enUnaHora,
          AHORA,
        ),
      ).not.toThrow();
    });
  });

  describe('TU-16 R9 cierre', () => {
    const antes = new Date(AHORA.getTime() - H);
    const despues = new Date(AHORA.getTime() + H);

    it('ATENDIDA exige notas de cierre', () => {
      expect(
        mensaje(() => validarCierre('ATENDIDA', undefined, antes, AHORA)),
      ).toMatch(/debes escribir las notas de cierre/);
      expect(validarCierre('ATENDIDA', ' Todo bien ', antes, AHORA)).toBe(
        'Todo bien',
      );
    });

    it('NO_ASISTIO no exige notas', () => {
      expect(validarCierre('NO_ASISTIO', undefined, antes, AHORA)).toBeNull();
    });

    it('no se puede cerrar antes de la hora de la cita', () => {
      expect(
        mensaje(() => validarCierre('NO_ASISTIO', undefined, despues, AHORA)),
      ).toMatch(/solo se puede cerrar después de su hora/);
      expect(() => validarCierre('ATENDIDA', 'Notas', despues, AHORA)).toThrow(
        BadRequestException,
      );
    });
  });
});
