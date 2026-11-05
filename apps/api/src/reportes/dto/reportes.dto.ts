import { IsOptional, IsUUID, Matches } from 'class-validator';
import { FECHA_REGEX } from '../../common/rd-time';

export class ReporteCitasQueryDto {
  @IsOptional()
  @Matches(FECHA_REGEX, { message: 'desde debe tener el formato AAAA-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_REGEX, { message: 'hasta debe tener el formato AAAA-MM-DD.' })
  hasta?: string;

  @IsOptional()
  @IsUUID('4', { message: 'centroId no es válido.' })
  centroId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'medicoId no es válido.' })
  medicoId?: string;
}
