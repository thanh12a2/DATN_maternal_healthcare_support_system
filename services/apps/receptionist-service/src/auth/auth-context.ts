export type AuthRole =
  'PATIENT' | 'RECEPTIONIST' | 'DOCTOR' | 'NURSE' | 'ADMIN';

export interface AuthContext {
  userId: string;
  role: AuthRole;
  tokenId: string;
}
