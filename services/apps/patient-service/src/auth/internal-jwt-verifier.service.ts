import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import type { InternalAuthContext } from './internal-auth';

@Injectable()
export class InternalJwtVerifierService {
  constructor(private readonly configService: ConfigService) {}

  verify(token: string): InternalAuthContext {
    try {
      const decoded = verify(token, this.normalizePem(this.required('PATIENT_INTERNAL_JWT_PUBLIC_KEY')), {
        algorithms: ['RS256'],
        issuer: this.required('PATIENT_INTERNAL_JWT_ISSUER'),
        audience: this.required('PATIENT_INTERNAL_JWT_AUDIENCE'),
        complete: true,
      });
      if (typeof decoded === 'string' || typeof decoded.payload === 'string') {
        throw new UnauthorizedException('Invalid internal access token');
      }
      if (decoded.header.kid !== this.required('PATIENT_INTERNAL_JWT_KEY_ID')) {
        throw new UnauthorizedException('Invalid internal access token');
      }
      const claims = decoded.payload as Record<string, unknown>;
      const serviceId = claims.sub;
      const tokenId = claims.jti;
      const rawScope = claims.scope;
      if (
        !['appointment-service', 'check-in-service'].includes(
          typeof serviceId === 'string' ? serviceId : '',
        ) ||
        typeof tokenId !== 'string' ||
        typeof rawScope !== 'string'
      ) {
        throw new UnauthorizedException('Invalid internal access token');
      }
      const scopes = rawScope.split(/\s+/).filter(Boolean);
      if (!scopes.includes('patient:eligibility:read')) {
        throw new UnauthorizedException('Invalid internal access token');
      }
      return {
        serviceId: serviceId as InternalAuthContext['serviceId'],
        scopes,
        tokenId,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) throw error;
      throw new UnauthorizedException('Invalid internal access token');
    }
  }

  private required(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(
        `Missing required configuration: ${key}`,
      );
    }
    return value;
  }

  private normalizePem(value: string): string {
    return value
      .trim()
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');
  }
}
