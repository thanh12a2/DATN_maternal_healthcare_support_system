import { AuthRole } from '../auth/dto/auth-role.enum';

export interface AccessTokenSubject {
  userId: string;
  role: AuthRole;
}

export interface AccessTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  role: AuthRole;
}

export interface SignedAccessToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface VerifiedAccessToken {
  userId: string;
  role: AuthRole;
  tokenId: string;
}
