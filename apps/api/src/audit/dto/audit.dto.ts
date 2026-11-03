import { Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { AUDIT_ACTIONS, type AuditAction } from '../audit-actions';

export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(AUDIT_ACTIONS, { message: 'Acción no válida.' })
  action?: AuditAction;

  /** Correo o nombre del usuario (también busca en el detalle) */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  user?: string;

  /** Fecha/hora ISO 8601 inicial (inclusive) */
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha "desde" no es válida.' })
  from?: string;

  /** Fecha/hora ISO 8601 final (inclusive) */
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha "hasta" no es válida.' })
  to?: string;
}

/** Acceso denegado detectado por el middleware de Next.js. */
export class AccessDeniedDto {
  @IsString()
  @MaxLength(300)
  @Matches(/^\//, { message: 'path debe empezar por "/".' })
  path!: string;

  @Type(() => Number)
  @IsInt()
  @IsIn([401, 403])
  status!: 401 | 403;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ip?: string;
}
