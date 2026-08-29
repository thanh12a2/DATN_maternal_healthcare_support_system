import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify, type JwtPayload } from 'jsonwebtoken';
import type { PatientAuthContext, PatientAuthRole } from './auth-context';

const SUPPORTED_ROLES: PatientAuthRole[] = ['PATIENT', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'ADMIN'];

@Injectable()
export class JwtVerifierService {
  constructor(private readonly configService: ConfigService) {}

  verifyAccessToken(accessToken: string): PatientAuthContext {
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

      if (typeof decoded === 'string') {
        throw new UnauthorizedException('Invalid access token');
      }

      if (decoded.header.kid !== expectedKeyId) {
        throw new UnauthorizedException('Invalid access token');
      }

      const payload = decoded.payload as JwtPayload;
      const userId = payload.sub;
      const tokenId = payload.jti;
      const role = payload.role;

      if (!userId || typeof userId !== 'string') {
        throw new UnauthorizedException('Invalid access token');
      }

      if (!tokenId || typeof tokenId !== 'string') {
        throw new UnauthorizedException('Invalid access token');
      }

      if (!this.isSupportedRole(role)) {
        throw new UnauthorizedException('Invalid access token');
      }

      return {
        userId,
        role,
        tokenId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }

  private isSupportedRole(role: unknown): role is PatientAuthRole {
    return typeof role === 'string' && SUPPORTED_ROLES.includes(role as PatientAuthRole);
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new InternalServerErrorException(`Missing required configuration: ${key}`);
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
