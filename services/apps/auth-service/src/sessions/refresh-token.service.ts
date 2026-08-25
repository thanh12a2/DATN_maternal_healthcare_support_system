import { createHmac, randomBytes } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IssuedRefreshToken } from './refresh-token.types';

const REFRESH_TOKEN_BYTES = 64;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class RefreshTokenService {
  constructor(private readonly configService: ConfigService) {}

  issueRefreshToken(now = new Date()): IssuedRefreshToken {
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    return {
      refreshToken,
      refreshTokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: this.calculateExpiresAt(now),
    };
  }

  hashRefreshToken(refreshToken: string): string {
    const pepper = this.getRequiredConfig('AUTH_REFRESH_TOKEN_PEPPER');

    return createHmac('sha256', pepper).update(refreshToken).digest('hex');
  }

  private calculateExpiresAt(now: Date): Date {
    const ttlDays = this.getRefreshTokenTtlDays();

    return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  }

  private getRefreshTokenTtlDays(): number {
    const configuredTtl = this.configService.get<string>('AUTH_REFRESH_TOKEN_TTL_DAYS');

    if (!configuredTtl) {
      return DEFAULT_REFRESH_TOKEN_TTL_DAYS;
    }

    const ttlDays = Number(configuredTtl);

    if (!Number.isInteger(ttlDays) || ttlDays <= 0) {
      throw new InternalServerErrorException('Invalid AUTH_REFRESH_TOKEN_TTL_DAYS configuration');
    }

    return ttlDays;
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new InternalServerErrorException(`Missing required configuration: ${key}`);
    }

    return value;
  }
}
