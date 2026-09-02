import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify, type JwtPayload } from 'jsonwebtoken';
import type { AuthContext, AuthRole } from './auth-context';

const SUPPORTED_ROLES: AuthRole[] = [
  'PATIENT',
  'RECEPTIONIST',
  'DOCTOR',
  'NURSE',
  'ADMIN',
];

@Injectable()
export class JwtVerifierService {
  constructor(private readonly configService: ConfigService) {}

  verifyAccessToken(accessToken: string): AuthContext {
    const publicKey = this.getRequiredConfig('AUTH_JWT_PUBLIC_KEY');
    const issuer = this.getRequiredConfig('AUTH_JWT_ISSUER');
    const audience = this.getRequiredConfig('AUTH_JWT_AUDIENCE');
    const expectedKeyId = this.getRequiredConfig('AUTH_JWT_KEY_ID');

    try {
      const decoded = verify(accessToken, this.normalizePem(publicKey), {
        algorithms: ['RS256'],
        issuer,
        audience,
        complete: true,
      });

      if (typeof decoded === 'string' || decoded.header.kid !== expectedKeyId) {
        throw new UnauthorizedException('Invalid access token');
      }

      const payload = decoded.payload as JwtPayload;
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string' ||
        !this.isSupportedRole(payload.role)
      ) {
        throw new UnauthorizedException('Invalid access token');
      }

      return { userId: payload.sub, role: payload.role, tokenId: payload.jti };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private isSupportedRole(role: unknown): role is AuthRole {
    return (
      typeof role === 'string' && SUPPORTED_ROLES.includes(role as AuthRole)
    );
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(
        `Missing required configuration: ${key}`,
      );
    }
    return value;
  }

  private normalizePem(value: string): string {
    let normalized = value.trim();
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1);
    }
    return normalized
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }
}
