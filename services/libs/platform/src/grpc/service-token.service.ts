import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { ServiceAuthContext } from './grpc-context';

interface ServiceTokenClaims extends JwtPayload {
  sub: string;
  scope: string;
  jti: string;
}

@Injectable()
export class ServiceTokenService {
  constructor(private readonly config: ConfigService) {}

  sign(input: { serviceId: string; audience: string; scopes: string[]; ttlSeconds?: number }): string {
    const privateKey = this.required('INTERNAL_SERVICE_JWT_PRIVATE_KEY');
    const issuer = this.config.get<string>('INTERNAL_SERVICE_JWT_ISSUER') ?? 'maternal-healthcare-internal';
    const keyid = this.config.get<string>('INTERNAL_SERVICE_JWT_KEY_ID') ?? 'internal-dev-key';
    const expiresIn = input.ttlSeconds ?? Number(this.config.get('INTERNAL_SERVICE_JWT_TTL_SECONDS') ?? 60);
    const options: SignOptions = { algorithm: 'RS256', issuer, audience: input.audience, keyid, expiresIn };
    return jwt.sign(
      { sub: input.serviceId, scope: input.scopes.join(' '), jti: randomUUID() },
      this.pem(privateKey),
      options,
    );
  }

  verify(token: string, audience?: string): ServiceAuthContext {
    try {
      const publicKey = this.required('INTERNAL_SERVICE_JWT_PUBLIC_KEY');
      const issuer = this.config.get<string>('INTERNAL_SERVICE_JWT_ISSUER') ?? 'maternal-healthcare-internal';
      const expectedAudience = audience ?? this.required('INTERNAL_SERVICE_JWT_AUDIENCE');
      const keyId = this.config.get<string>('INTERNAL_SERVICE_JWT_KEY_ID');
      const decoded = jwt.verify(token, this.pem(publicKey), {
        algorithms: ['RS256'],
        issuer,
        audience: expectedAudience,
        complete: true,
      });
      if (typeof decoded === 'string' || typeof decoded.payload === 'string') throw new Error('bad payload');
      if (keyId && decoded.header.kid !== keyId) throw new Error('bad key id');
      const claims = decoded.payload as ServiceTokenClaims;
      if (!claims.sub || !claims.jti || typeof claims.scope !== 'string') throw new Error('missing claims');
      return {
        serviceId: claims.sub,
        scopes: claims.scope.split(/\s+/).filter(Boolean),
        tokenId: claims.jti,
        audience: claims.aud ?? expectedAudience,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new UnauthorizedException('Invalid internal service token');
    }
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new InternalServerErrorException(`Missing required configuration: ${key}`);
    return value;
  }

  private pem(value: string): string {
    return value
      .trim()
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');
  }
}
