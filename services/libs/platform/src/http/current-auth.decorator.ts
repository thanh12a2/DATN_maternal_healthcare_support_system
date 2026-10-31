import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedHttpRequest, PublicAuthContext } from './public-jwt.guard';
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): PublicAuthContext => {
  const auth = context.switchToHttp().getRequest<AuthenticatedHttpRequest>().auth;
  if (!auth) throw new Error('Authenticated context is missing');
  return auth;
});
