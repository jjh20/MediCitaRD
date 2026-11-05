import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { FECHA_REGEX, HORA_REGEX } from '../../common/rd-time';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const HORA_MSG = 'La hora debe tener el formato HH:mm (por ejemplo 08:00).';

export class CreateMedicoDto {
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120)
  nombre!: string;

  @Transform(trim)
  @IsString()
  @MinLength(3, {
    message: 'La especialidad debe tener al menos 3 caracteres.',
  })
  @MaxLength(80)
  especialidad!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número.' },
  )
  @Min(0, { message: 'El precio no puede ser negativo.' })
  @Max(1_000_000)
  precioConsulta!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La duración debe ser un número entero de minutos.' })
  @Min(10, { message: 'La duración mínima es de 10 minutos.' })
  @Max(240, { message: 'La duración máxima es de 240 minutos.' })
  duracionMin?: number;

  @IsArray({ message: 'Indica los días de atención.' })
  @ArrayMinSize(1, { message: 'Elige al menos un día de atención.' })
  @ArrayMaxSize(7)
  @ArrayUnique({ message: 'Los días de atención no se pueden repetir.' })
  @IsInt({ each: true })
  @Min(1, { each: true, message: 'Los días van de 1 (lunes) a 7 (domingo).' })
  @Max(7, { each: true, message: 'Los días van de 1 (lunes) a 7 (domingo).' })
  diasSemana!: number[];

  @Matches(HORA_REGEX, { message: HORA_MSG })
  horaInicio!: string;

  @Matches(HORA_REGEX, { message: HORA_MSG })
  horaFin!: string;
}

export class UpdateMedicoDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3, {
    message: 'La especialidad debe tener al menos 3 caracteres.',
  })
  @MaxLength(80)
  especialidad?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número.' },
  )
  @Min(0, { message: 'El precio no puede ser negativo.' })
  @Max(1_000_000)
  precioConsulta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La duración debe ser un número entero de minutos.' })
  @Min(10, { message: 'La duración mínima es de 10 minutos.' })
  @Max(240, { message: 'La duración máxima es de 240 minutos.' })
  duracionMin?: number;

  @IsOptional()
  @IsArray({ message: 'Indica los días de atención.' })
  @ArrayMinSize(1, { message: 'Elige al menos un día de atención.' })
  @ArrayMaxSize(7)
  @ArrayUnique({ message: 'Los días de atención no se pueden repetir.' })
  @IsInt({ each: true })
  @Min(1, { each: true, message: 'Los días van de 1 (lunes) a 7 (domingo).' })
  @Max(7, { each: true, message: 'Los días van de 1 (lunes) a 7 (domingo).' })
  diasSemana?: number[];

  @IsOptional()
  @Matches(HORA_REGEX, { message: HORA_MSG })
  horaInicio?: string;

  @IsOptional()
  @Matches(HORA_REGEX, { message: HORA_MSG })
  horaFin?: string;
}

export class UpdateMedicoEstadoDto {
  @IsBoolean({ message: 'activo debe ser verdadero o falso.' })
  activo!: boolean;
}

export class ListMedicosQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  especialidad?: string;

  /** Busca en nombre, especialidad o nombre del centro */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  texto?: string;

  @IsOptional()
  @IsUUID('4', { message: 'centroId no es válido.' })
  centroId?: string;
}

export class DisponibilidadQueryDto {
  @Matches(FECHA_REGEX, {
    message: 'La fecha debe tener el formato AAAA-MM-DD.',
  })
  fecha!: string;
}
