import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedRequest, CatalogRole } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawHeader = request.headers.authorization;
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('UNAUTHENTICATED');
    try {
      const publicKey = this.config.get<string>('AUTH_JWT_PUBLIC_KEY');
      if (!publicKey) throw new Error('missing public key');
      const claims = jwt.verify(header.slice(7), this.normalizePem(publicKey), {
        algorithms: ['RS256'],
        issuer: this.config.get('AUTH_JWT_ISSUER', 'maternal-healthcare-auth'),
        audience: this.config.get('AUTH_JWT_AUDIENCE', 'maternal-healthcare-api'),
      }) as jwt.JwtPayload & { role?: CatalogRole };
      if (typeof claims.sub !== 'string' || typeof claims.role !== 'string' || typeof claims.jti !== 'string') {
        throw new Error('invalid claims');
      }
      request.identity = { userId: claims.sub, role: claims.role, tokenId: claims.jti };
      return true;
    } catch {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }
  }

  private normalizePem(value: string): string {
    const trimmed = value.trim();
    const unquoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ? trimmed.slice(1, -1)
        : trimmed;
    return unquoted.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  }
}
