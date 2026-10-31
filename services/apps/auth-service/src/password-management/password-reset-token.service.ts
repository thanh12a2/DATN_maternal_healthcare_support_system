import { createHmac, randomBytes } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESET_TOKEN_BYTES = 32;
const DEFAULT_RESET_TOKEN_TTL_MINUTES = 15;
const DEFAULT_REQUEST_COOLDOWN_SECONDS = 60;

export interface IssuedPasswordResetToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetTokenService {
  constructor(private readonly configService: ConfigService) {}

  issueToken(now = new Date()): IssuedPasswordResetToken {
    const token = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
    const ttlMinutes = this.getPositiveIntegerConfig(
      'AUTH_PASSWORD_RESET_TTL_MINUTES',
      DEFAULT_RESET_TOKEN_TTL_MINUTES,
    );

    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
    };
  }

  hashToken(token: string): string {
    const pepper = this.getRequiredConfig('AUTH_PASSWORD_RESET_PEPPER');
    return createHmac('sha256', pepper).update(token).digest('hex');
  }

  getCooldownThreshold(now = new Date()): Date {
    const cooldownSeconds = this.getPositiveIntegerConfig(
      'AUTH_PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS',
      DEFAULT_REQUEST_COOLDOWN_SECONDS,
    );
    return new Date(now.getTime() - cooldownSeconds * 1000);
  }

  private getPositiveIntegerConfig(key: string, defaultValue: number): number {
    const configuredValue = this.configService.get<string>(key);
    if (!configuredValue) return defaultValue;

    const value = Number(configuredValue);
    if (!Number.isInteger(value) || value <= 0) {
      throw new InternalServerErrorException(
        'Invalid ' + key + ' configuration',
      );
    }
    return value;
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(
        'Missing required configuration: ' + key,
      );
    }
    return value;
  }
}
