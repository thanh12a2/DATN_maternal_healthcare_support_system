import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { PUBLIC_HTTP_KEY } from './public.decorator';

export interface PublicAuthContext { userId: string; role: string; tokenId?: string }
export interface AuthenticatedHttpRequest { headers: Record<string, string | string[] | undefined>; auth?: PublicAuthContext }

@Injectable()
export class PublicJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_HTTP_KEY, [context.getHandler(), context.getClass()])) return true;
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    const raw = request.headers.authorization;
    const header = Array.isArray(raw) ? raw[0] : raw;
    const parts = header?.split(' ') ?? [];
    if (parts[0] !== 'Bearer' || !parts[1]) throw new UnauthorizedException('Missing bearer token');
    try {
      const payload = jwt.verify(parts[1], this.pem(this.required('AUTH_JWT_PUBLIC_KEY')), {
        algorithms: ['RS256'],
        issuer: this.config.get('AUTH_JWT_ISSUER', 'maternal-healthcare-auth'),
        audience: this.config.get('AUTH_JWT_AUDIENCE', 'maternal-healthcare-api'),
      }) as JwtPayload & { role?: string };
      if (!payload.sub || !payload.role) throw new Error('claims');
      request.auth = { userId: payload.sub, role: payload.role, tokenId: payload.jti };
      return true;
    } catch { throw new UnauthorizedException('Invalid access token'); }
  }
  private required(key: string): string { const value=this.config.get<string>(key); if(!value) throw new UnauthorizedException('JWT validation unavailable'); return value; }
  private pem(value: string): string {
    const slash = String.fromCharCode(92);
    const newline = String.fromCharCode(10);
    return value.trim().split(slash + 'r' + slash + 'n').join(newline).split(slash + 'n').join(newline);
  }
}
