import { SetMetadata } from '@nestjs/common';

export const SERVICE_SCOPES_KEY = 'platform:service-scopes';
export const SERVICE_CALLERS_KEY = 'platform:service-callers';
export const PUBLIC_GRPC_KEY = 'platform:public-grpc';

export const ServiceScopes = (...scopes: string[]) =>
  SetMetadata(SERVICE_SCOPES_KEY, scopes);
export const ServiceCallers = (...serviceIds: string[]) =>
  SetMetadata(SERVICE_CALLERS_KEY, serviceIds);
export const PublicGrpc = () => SetMetadata(PUBLIC_GRPC_KEY, true);
