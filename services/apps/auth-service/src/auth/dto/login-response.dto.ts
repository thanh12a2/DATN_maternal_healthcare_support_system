import { AuthRole } from './auth-role.enum';

export interface LoginResponseDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    userId: string;
    email: string;
    role: AuthRole;
  };
}
