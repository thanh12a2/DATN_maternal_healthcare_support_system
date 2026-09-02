import type { Request } from 'express';
import type { PatientAuthContext } from '../auth/auth-context';
export interface PatientRequest extends Request {
  patientAuth?: PatientAuthContext;
  requestId: string;
}
