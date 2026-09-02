import type { Request } from 'express';
import type { AuthContext } from '../auth/auth-context';

export interface ReceptionRequest extends Request {
  requestId: string;
  auth?: AuthContext;
}
