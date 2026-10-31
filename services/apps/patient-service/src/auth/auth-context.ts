export type PatientAuthRole =
  | 'PATIENT'
  | 'RECEPTIONIST'
  | 'DOCTOR'
  | 'NURSE'
  | 'ADMIN';

export interface PatientAuthContext {
  userId: string;
  role: PatientAuthRole;
  tokenId: string;
}

export interface PatientAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  patientAuth?: PatientAuthContext;
}
