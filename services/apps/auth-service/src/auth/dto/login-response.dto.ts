import { AuthRole } from './auth-role.enum';

export interface LoginResponseDto {
  user: {
    userId: string;
    email: string;
    role: AuthRole;
  };
}
