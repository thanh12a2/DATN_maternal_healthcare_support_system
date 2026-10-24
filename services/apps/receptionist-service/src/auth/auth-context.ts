export type AuthRole =
  'PATIENT' | 'RECEPTIONIST' | 'DOCTOR' | 'NURSE' | 'CLINIC_MANAGER' | 'ADMIN';

export interface AuthContext {
  userId: string;
  role: AuthRole;
  tokenId: string;
}
