import {
  CategoriaRecurso,
  EstadoEquipo,
  TipoMovimiento,
  TipoRecurso,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { FECHA_REGEX } from '../../common/rd-time';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const CANTIDAD_MSG = 'La cantidad debe ser un número entero mayor que 0.';
const FECHA_MSG = 'La fecha debe tener el formato AAAA-MM-DD.';

// ─── Recursos ────────────────────────────────────────────────────────

export class CreateRecursoDto {
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120)
  nombre!: string;

  @IsEnum(TipoRecurso, { message: 'El tipo debe ser INSUMO o EQUIPO.' })
  tipo!: TipoRecurso;

  @IsEnum(CategoriaRecurso, { message: 'Categoría no válida.' })
  categoria!: CategoriaRecurso;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Indica la unidad (unidad, caja, frasco…).' })
  @MaxLength(30)
  unidad!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El stock mínimo debe ser un número entero.' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  @Max(1_000_000)
  stockMinimo?: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El costo debe ser un número.' },
  )
  @Min(0, { message: 'El costo no puede ser negativo.' })
  @Max(10_000_000)
  costoUnitario!: number;

  @IsOptional()
  @IsBoolean({ message: 'requiereVencimiento debe ser verdadero o falso.' })
  requiereVencimiento?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  numeroSerie?: string;
}

export class UpdateRecursoDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsEnum(CategoriaRecurso, { message: 'Categoría no válida.' })
  categoria?: CategoriaRecurso;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  unidad?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El stock mínimo debe ser un número entero.' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  @Max(1_000_000)
  stockMinimo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El costo debe ser un número.' },
  )
  @Min(0, { message: 'El costo no puede ser negativo.' })
  @Max(10_000_000)
  costoUnitario?: number;

  @IsOptional()
  @IsBoolean()
  requiereVencimiento?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  numeroSerie?: string;
}

export class UpdateRecursoEstadoDto {
  @IsBoolean({ message: 'activo debe ser verdadero o falso.' })
  activo!: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export const FILTROS_ESTADO = [
  'bajo_stock',
  'proximo_vencer',
  'vencido',
  'disponible',
  'asignado',
  'mantenimiento',
  'inactivo',
] as const;
export type FiltroEstado = (typeof FILTROS_ESTADO)[number];

export class ListRecursosQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TipoRecurso, { message: 'Tipo no válido.' })
  tipo?: TipoRecurso;

  @IsOptional()
  @IsEnum(CategoriaRecurso, { message: 'Categoría no válida.' })
  categoria?: CategoriaRecurso;

  /** Busca en código, nombre o número de serie */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  texto?: string;

  @IsOptional()
  @IsUUID('4', { message: 'centroId no es válido.' })
  centroId?: string;

  @IsOptional()
  @IsIn(FILTROS_ESTADO, { message: 'Estado no válido.' })
  estado?: FiltroEstado;
}

// ─── Movimientos ─────────────────────────────────────────────────────

class BaseMovimientoDto {
  @IsUUID('4', { message: 'Debes elegir un recurso válido.' })
  recursoId!: string;
}

export class EntradaDto extends BaseMovimientoDto {
  @Type(() => Number)
  @IsInt({ message: CANTIDAD_MSG })
  @Min(1, { message: CANTIDAD_MSG })
  @Max(1_000_000)
  cantidad!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  numeroLote?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: FECHA_MSG })
  fechaVencimiento?: string;

  /** Factura o proveedor */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  referencia?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El costo debe ser un número.' },
  )
  @Min(0, { message: 'El costo no puede ser negativo.' })
  costoUnitario?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class SalidaDto extends BaseMovimientoDto {
  @Type(() => Number)
  @IsInt({ message: CANTIDAD_MSG })
  @Min(1, { message: CANTIDAD_MSG })
  @Max(1_000_000)
  cantidad!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  motivo?: string;

  /** Consumo ligado a una cita (L8) */
  @IsOptional()
  @IsUUID('4', { message: 'citaId no es válido.' })
  citaId?: string;
}

export class AjusteDto extends BaseMovimientoDto {
  /** Insumos: aumentar o disminuir el stock */
  @IsOptional()
  @IsIn(['AUMENTO', 'DISMINUCION'], {
    message: 'El sentido debe ser AUMENTO o DISMINUCION.',
  })
  sentido?: 'AUMENTO' | 'DISMINUCION';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: CANTIDAD_MSG })
  @Min(1, { message: CANTIDAD_MSG })
  @Max(1_000_000)
  cantidad?: number;

  /** Insumos con vencimiento: lote a ajustar */
  @IsOptional()
  @IsUUID('4', { message: 'loteId no es válido.' })
  loteId?: string;

  /** Equipos: nuevo estado (mantenimiento ↔ disponible) */
  @IsOptional()
  @IsIn([EstadoEquipo.DISPONIBLE, EstadoEquipo.MANTENIMIENTO], {
    message: 'El estado del equipo debe ser DISPONIBLE o MANTENIMIENTO.',
  })
  estadoEquipo?: EstadoEquipo;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class AsignacionDto extends BaseMovimientoDto {
  @IsUUID('4', { message: 'Debes elegir un médico válido.' })
  medicoId!: string;

  @IsISO8601(
    { strict: true },
    { message: 'La fecha de devolución prevista no es válida.' },
  )
  fechaDevolucionPrevista!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class DevolucionDto extends BaseMovimientoDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ConsumoItemDto {
  @IsUUID('4', { message: 'Debes elegir un insumo válido.' })
  recursoId!: string;

  @Type(() => Number)
  @IsInt({ message: CANTIDAD_MSG })
  @Min(1, { message: CANTIDAD_MSG })
  @Max(1_000_000)
  cantidad!: number;
}

export class ConsumoDto {
  @IsUUID('4', { message: 'citaId no es válido.' })
  citaId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un insumo.' })
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ConsumoItemDto)
  items!: ConsumoItemDto[];
}

export class ListMovimientosQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TipoMovimiento, { message: 'Tipo de movimiento no válido.' })
  tipo?: TipoMovimiento;

  @IsOptional()
  @IsUUID('4', { message: 'recursoId no es válido.' })
  recursoId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'medicoId no es válido.' })
  medicoId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'citaId no es válido.' })
  citaId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'centroId no es válido.' })
  centroId?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: 'desde debe tener el formato AAAA-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: 'hasta debe tener el formato AAAA-MM-DD.' })
  hasta?: string;

  /** Usuario que registró el movimiento (correo o nombre) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  usuario?: string;

  /** Código del movimiento, o código o nombre del recurso */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  texto?: string;
}

// ─── Reportes ────────────────────────────────────────────────────────

export class ReporteExistenciasQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'centroId no es válido.' })
  centroId?: string;
}

export class ReporteMovimientosQueryDto {
  @IsOptional()
  @Matches(FECHA_REGEX, { message: 'desde debe tener el formato AAAA-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: 'hasta debe tener el formato AAAA-MM-DD.' })
  hasta?: string;

  @IsOptional()
  @IsUUID('4', { message: 'centroId no es válido.' })
  centroId?: string;
}
