import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_REGEX,
} from '../../common/password-policy';
import { SELF_REGISTER_ROLES } from '../permissions';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim)
  @IsString({ message: 'El nombre es obligatorio.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  fullName!: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido.' })
  @MaxLength(254, { message: 'El correo es demasiado largo.' })
  email!: string;

  @IsString({ message: 'La contraseña es obligatoria.' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;

  @IsIn(SELF_REGISTER_ROLES, {
    message: 'Solo puedes registrarte como Paciente o Centro médico.',
  })
  role!: Role;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido.' })
  email!: string;

  @IsString({ message: 'La contraseña es obligatoria.' })
  @Length(1, 200, { message: 'La contraseña es obligatoria.' })
  password!: string;
}
