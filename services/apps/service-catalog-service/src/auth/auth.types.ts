export type CatalogRole = 'ADMIN' | 'CLINIC_MANAGER' | 'DOCTOR' | 'PATIENT' | 'RECEPTIONIST';

export interface CatalogIdentity {
  userId: string;
  role: CatalogRole;
  tokenId: string;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  identity?: CatalogIdentity;
  requestId?: string;
}
