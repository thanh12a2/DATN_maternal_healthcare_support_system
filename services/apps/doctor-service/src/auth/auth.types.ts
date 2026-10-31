import { Request } from 'express';

export type DoctorRole =
  'PATIENT' | 'DOCTOR' | 'ADMIN' | 'NURSE' | 'RECEPTIONIST' | 'CLINIC_MANAGER';

export interface Identity {
  userId: string;
  role: DoctorRole;
  tokenId?: string;
}

export type AuthenticatedRequest = Request & {
  identity?: Identity;
  requestId?: string;
};
