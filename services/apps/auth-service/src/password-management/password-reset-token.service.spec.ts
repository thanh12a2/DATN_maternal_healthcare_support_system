import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetTokenService } from './password-reset-token.service';

describe('PasswordResetTokenService', () => {
  const values: Record<string, string> = {
    AUTH_PASSWORD_RESET_PEPPER: 'test-reset-pepper',
    AUTH_PASSWORD_RESET_TTL_MINUTES: '15',
    AUTH_PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS: '60',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  const service = new PasswordResetTokenService(config);

  it('issues an opaque token, stores a deterministic hash and applies TTL', () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    const issued = service.issueToken(now);

    expect(issued.token).not.toEqual(issued.tokenHash);
    expect(issued.tokenHash).toEqual(service.hashToken(issued.token));
    expect(issued.expiresAt).toEqual(new Date('2026-09-06T12:15:00.000Z'));
  });

  it('calculates the request cooldown threshold', () => {
    expect(
      service.getCooldownThreshold(new Date('2026-09-06T12:00:00.000Z')),
    ).toEqual(new Date('2026-09-06T11:59:00.000Z'));
  });

  it('requires a reset-token pepper', () => {
    const missingConfig = { get: jest.fn() } as unknown as ConfigService;
    expect(() =>
      new PasswordResetTokenService(missingConfig).hashToken('token'),
    ).toThrow(InternalServerErrorException);
  });
});
