import { UnauthorizedException } from '@nestjs/common';

export function extractBearerToken(authorizationHeader: string | string[] | undefined): string {
  const authorization = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;

  if (!authorization) {
    throw new UnauthorizedException('Missing bearer token');
  }

  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);

  if (scheme !== 'Bearer' || !token || extra.length > 0) {
    throw new UnauthorizedException('Invalid bearer token');
  }

  return token;
}
