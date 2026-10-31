export interface InternalAuthContext {
  serviceId: 'appointment-service' | 'check-in-service';
  scopes: string[];
  tokenId: string;
}

export interface InternalAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  internalAuth?: InternalAuthContext;
}
