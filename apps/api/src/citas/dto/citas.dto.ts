import { EstadoCita, TipoCita } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { FECHA_REGEX } from '../../common/rd-time';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const FECHA_HORA_MSG =
  'La fecha y hora deben venir en formato ISO 8601 (por ejemplo 2026-11-10T08:30:00-04:00).';

export class CreateCitaDto {
  @IsUUID('4', { message: 'Debes elegir un médico válido.' })
  medicoId!: string;

  @IsISO8601({ strict: true }, { message: FECHA_HORA_MSG })
  fechaHora!: string;

  @IsOptional()
  @IsEnum(TipoCita, { message: 'El tipo debe ser CONSULTA o ESTUDIO.' })
  tipo?: TipoCita;

  @Transform(trim)
  @IsString({ message: 'Indica el motivo de la cita.' })
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres.' })
  @MaxLength(500, { message: 'El motivo no puede pasar de 500 caracteres.' })
  motivo!: string;
}

export class UpdateCitaDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres.' })
  @MaxLength(500, { message: 'El motivo no puede pasar de 500 caracteres.' })
  motivo?: string;

  @IsOptional()
  @IsEnum(TipoCita, { message: 'El tipo debe ser CONSULTA o ESTUDIO.' })
  tipo?: TipoCita;
}

export class ReprogramarCitaDto {
  @IsISO8601({ strict: true }, { message: FECHA_HORA_MSG })
  fechaHora!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

export class ConfirmarCitaDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

export class CerrarCitaDto {
  @IsIn([EstadoCita.ATENDIDA, EstadoCita.NO_ASISTIO], {
    message: 'El resultado debe ser ATENDIDA o NO_ASISTIO.',
  })
  resultado!: 'ATENDIDA' | 'NO_ASISTIO';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, {
    message: 'Las notas de cierre no pueden pasar de 1000 caracteres.',
  })
  notas?: string;
}

export class CancelarCitaDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'El motivo no puede pasar de 500 caracteres.' })
  motivo?: string;
}

/** Filtros de consulta: estado, fecha, responsable (médico o centro) y texto. */
export class ListCitasQueryDto extends PaginationQueryDto {
  /** Uno o varios estados separados por coma */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsEnum(EstadoCita, { each: true, message: 'Estado no válido.' })
  estado?: EstadoCita[];

  @IsOptional()
  @Matches(FECHA_REGEX, { message: 'desde debe tener el formato AAAA-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: 'hasta debe tener el formato AAAA-MM-DD.' })
  hasta?: string;

  @IsOptional()
  @IsUUID('4', { message: 'medicoId no es válido.' })
  medicoId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'centroId no es válido.' })
  centroId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'pacienteId no es válido.' })
  pacienteId?: string;

  /** Busca en código, motivo, paciente y médico */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  texto?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'El orden debe ser asc o desc.' })
  orden?: 'asc' | 'desc';
}
