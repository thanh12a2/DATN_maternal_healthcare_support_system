import { beforeEach, describe, expect, it } from '@jest/globals';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from './refresh-token.service';

describe('RefreshTokenService', () => {
  let refreshTokenService: RefreshTokenService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                AUTH_REFRESH_TOKEN_PEPPER: 'test-refresh-token-pepper',
                AUTH_REFRESH_TOKEN_TTL_DAYS: '30',
              })[key],
          },
        },
      ],
    }).compile();

    refreshTokenService = moduleRef.get<RefreshTokenService>(RefreshTokenService);
  });

  it('should issue opaque refresh token and store only a deterministic hash', () => {
    const issued = refreshTokenService.issueRefreshToken(new Date('2026-01-01T00:00:00.000Z'));

    expect(issued.refreshToken).toEqual(expect.any(String));
    expect(issued.refreshToken.length).toBeGreaterThan(60);
    expect(issued.refreshTokenHash).toEqual(expect.any(String));
    expect(issued.refreshTokenHash).not.toBe(issued.refreshToken);
    expect(issued.refreshTokenHash).toBe(refreshTokenService.hashRefreshToken(issued.refreshToken));
    expect(issued.expiresAt).toEqual(new Date('2026-01-31T00:00:00.000Z'));
  });

  it('should generate different refresh tokens each time', () => {
    const first = refreshTokenService.issueRefreshToken();
    const second = refreshTokenService.issueRefreshToken();

    expect(first.refreshToken).not.toBe(second.refreshToken);
    expect(first.refreshTokenHash).not.toBe(second.refreshTokenHash);
  });

  it('should throw when refresh token pepper is missing', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
      ],
    }).compile();

    const service = moduleRef.get<RefreshTokenService>(RefreshTokenService);

    expect(() => service.issueRefreshToken()).toThrow(InternalServerErrorException);
  });
});
