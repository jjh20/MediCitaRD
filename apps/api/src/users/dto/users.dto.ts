import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  /** Busca en nombre o correo */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Rol no válido.' })
  role?: Role;

  @IsOptional()
  @IsIn(['active', 'inactive'], { message: 'Estado no válido.' })
  status?: 'active' | 'inactive';
}

export class UpdateRoleDto {
  @IsEnum(Role, {
    message: 'El rol debe ser ADMIN, PACIENTE o CENTRO_MEDICO.',
  })
  role!: Role;
}

export class UpdateStatusDto {
  @IsBoolean({ message: 'isActive debe ser verdadero o falso.' })
  isActive!: boolean;
}
