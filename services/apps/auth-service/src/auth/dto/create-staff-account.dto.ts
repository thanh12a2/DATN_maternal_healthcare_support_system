import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { AuthRole } from './auth-role.enum';

export class CreateStaffAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(AuthRole)
  role!: AuthRole;
}
