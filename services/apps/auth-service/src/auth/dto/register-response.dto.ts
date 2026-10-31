import { AuthRole } from './auth-role.enum';

export interface RegisterResponseDto {
  user: {
    userId: string;
    email: string;
    role: AuthRole;
  };
}
