import { AuthRole } from './auth-role.enum';

export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    userId: string;
    email: string;
    role: AuthRole;
  };
}
