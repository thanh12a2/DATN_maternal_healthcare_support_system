import { AuthRole } from './auth-role.enum';

export interface MeResponseDto {
  user: {
    userId: string;
    email: string;
    role: AuthRole;
  };
}
