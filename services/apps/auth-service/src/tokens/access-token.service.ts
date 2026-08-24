import { randomUUID } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { AccessTokenClaims, AccessTokenSubject, SignedAccessToken } from './access-token.types';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

@Injectable()
export class AccessTokenService {
  constructor(private readonly configService: ConfigService) {}

  signAccessToken(subject: AccessTokenSubject): SignedAccessToken {
    const privateKey = this.getRequiredConfig('AUTH_JWT_PRIVATE_KEY');
    const issuer = this.getConfigOrDefault('AUTH_JWT_ISSUER', 'maternal-healthcare-auth');
    const audience = this.getConfigOrDefault('AUTH_JWT_AUDIENCE', 'maternal-healthcare-api');
    const keyId = this.getConfigOrDefault('AUTH_JWT_KEY_ID', 'local-dev-key');
    const expiresIn = this.getAccessTokenTtlSeconds();
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      iss: issuer,
      aud: audience,
      sub: subject.userId,
      jti: randomUUID(),
      iat: nowInSeconds,
      exp: nowInSeconds + expiresIn,
      role: subject.role,
    };

    const accessToken = jwt.sign(claims, this.normalizePem(privateKey), {
      algorithm: 'RS256',
      keyid: keyId,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  private getAccessTokenTtlSeconds(): number {
    const configuredTtl = this.configService.get<string>('AUTH_ACCESS_TOKEN_TTL_SECONDS');

    if (!configuredTtl) {
      return DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
    }

    const ttl = Number(configuredTtl);

    if (!Number.isInteger(ttl) || ttl <= 0) {
      throw new InternalServerErrorException('Invalid AUTH_ACCESS_TOKEN_TTL_SECONDS configuration');
    }

    return ttl;
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new InternalServerErrorException(`Missing required configuration: ${key}`);
    }

    return value;
  }

  private getConfigOrDefault(key: string, defaultValue: string): string {
    return this.configService.get<string>(key) ?? defaultValue;
  }

  private normalizePem(value: string): string {
    return value.replace(/\\n/g, '\n');
  }
}
