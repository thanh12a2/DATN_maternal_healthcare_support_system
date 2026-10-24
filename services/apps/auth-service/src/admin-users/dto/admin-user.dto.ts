import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountStatus } from '@prisma/client';
import { AuthRole } from '../../auth/dto/auth-role.enum';

export class QueryUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AuthRole)
  role?: AuthRole;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có tối thiểu 8 ký tự' })
  password!: string;

  @IsEnum(AuthRole, { message: 'Vai trò người dùng không hợp lệ' })
  role!: AuthRole;

  @IsOptional()
  @IsEnum(AccountStatus, { message: 'Trạng thái tài khoản không hợp lệ' })
  status?: AccountStatus;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có tối thiểu 8 ký tự' })
  password?: string;

  @IsOptional()
  @IsEnum(AuthRole, { message: 'Vai trò người dùng không hợp lệ' })
  role?: AuthRole;

  @IsOptional()
  @IsEnum(AccountStatus, { message: 'Trạng thái tài khoản không hợp lệ' })
  status?: AccountStatus;
}

export interface UserSummaryDto {
  id: string;
  email: string;
  role: AuthRole;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface UserListResponseDto {
  items: UserSummaryDto[];
  total: number;
  page: number;
  limit: number;
}
