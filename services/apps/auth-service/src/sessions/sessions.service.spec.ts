import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { InvalidRefreshSessionError, SessionsService } from './sessions.service';
import { RefreshTokenService } from './refresh-token.service';
import { SessionsRepository } from './sessions.repository';

const refreshTokenServiceMock = () => ({
  issueRefreshToken: jest.fn(),
  hashRefreshToken: jest.fn(),
});

const sessionsRepositoryMock = () => ({
  createSession: jest.fn(),
  findSessionByRefreshTokenHash: jest.fn(),
  rotateRefreshSession: jest.fn(),
  revokeRefreshSession: jest.fn(),
});

describe('SessionsService', () => {
  let sessionsService: SessionsService;
  let refreshTokenService: ReturnType<typeof refreshTokenServiceMock>;
  let sessionsRepository: ReturnType<typeof sessionsRepositoryMock>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: RefreshTokenService, useFactory: refreshTokenServiceMock },
        { provide: SessionsRepository, useFactory: sessionsRepositoryMock },
      ],
    }).compile();

    sessionsService = moduleRef.get<SessionsService>(SessionsService);
    refreshTokenService = moduleRef.get(RefreshTokenService);
    sessionsRepository = moduleRef.get(SessionsRepository);
  });

  it('should create refresh session with hashed token only', async () => {
    const expiresAt = new Date('2026-01-31T00:00:00.000Z');

    refreshTokenService.issueRefreshToken.mockReturnValue({
      refreshToken: 'opaque-refresh-token',
      refreshTokenHash: 'refresh-token-hash',
      expiresAt,
    } as never);
    sessionsRepository.createSession.mockResolvedValue({ sessionId: 'session-id' } as never);

    await expect(sessionsService.createRefreshSession('account-id')).resolves.toEqual({
      refreshToken: 'opaque-refresh-token',
      expiresAt,
      sessionId: 'session-id',
    });

    expect(sessionsRepository.createSession).toHaveBeenCalledWith({
      accountId: 'account-id',
      refreshTokenHash: 'refresh-token-hash',
      expiresAt,
    });
  });

  it('should rotate valid refresh session', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiresAt = new Date('2026-01-31T00:00:00.000Z');

    refreshTokenService.hashRefreshToken.mockReturnValue('old-refresh-token-hash' as never);
    sessionsRepository.findSessionByRefreshTokenHash.mockResolvedValue({
      sessionId: 'session-id',
      accountId: 'account-id',
      expiresAt,
      revokedAt: null,
    } as never);
    refreshTokenService.issueRefreshToken.mockReturnValue({
      refreshToken: 'new-refresh-token',
      refreshTokenHash: 'new-refresh-token-hash',
      expiresAt,
    } as never);
    sessionsRepository.rotateRefreshSession.mockResolvedValue(undefined as never);

    await expect(sessionsService.refreshSession('old-refresh-token', now)).resolves.toEqual({
      accountId: 'account-id',
      refreshToken: 'new-refresh-token',
      expiresAt,
      sessionId: 'session-id',
    });

    expect(refreshTokenService.hashRefreshToken).toHaveBeenCalledWith('old-refresh-token');
    expect(sessionsRepository.findSessionByRefreshTokenHash).toHaveBeenCalledWith(
      'old-refresh-token-hash',
    );
    expect(sessionsRepository.rotateRefreshSession).toHaveBeenCalledWith({
      sessionId: 'session-id',
      refreshTokenHash: 'new-refresh-token-hash',
      expiresAt,
      lastUsedAt: now,
    });
  });

  it('should reject missing refresh session', async () => {
    refreshTokenService.hashRefreshToken.mockReturnValue('missing-hash' as never);
    sessionsRepository.findSessionByRefreshTokenHash.mockResolvedValue(null as never);

    await expect(sessionsService.refreshSession('missing-token')).rejects.toBeInstanceOf(
      InvalidRefreshSessionError,
    );
  });

  it('should reject revoked refresh session', async () => {
    refreshTokenService.hashRefreshToken.mockReturnValue('hash' as never);
    sessionsRepository.findSessionByRefreshTokenHash.mockResolvedValue({
      sessionId: 'session-id',
      accountId: 'account-id',
      expiresAt: new Date('2026-01-31T00:00:00.000Z'),
      revokedAt: new Date('2026-01-02T00:00:00.000Z'),
    } as never);

    await expect(
      sessionsService.refreshSession('token', new Date('2026-01-01T00:00:00.000Z')),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  it('should reject expired refresh session', async () => {
    refreshTokenService.hashRefreshToken.mockReturnValue('hash' as never);
    sessionsRepository.findSessionByRefreshTokenHash.mockResolvedValue({
      sessionId: 'session-id',
      accountId: 'account-id',
      expiresAt: new Date('2025-12-31T00:00:00.000Z'),
      revokedAt: null,
    } as never);

    await expect(
      sessionsService.refreshSession('token', new Date('2026-01-01T00:00:00.000Z')),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  describe('logoutSession', () => {
    it('should revoke a valid refresh session', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      refreshTokenService.hashRefreshToken.mockReturnValue('refresh-token-hash' as never);
      sessionsRepository.findSessionByRefreshTokenHash.mockResolvedValue({
        sessionId: 'session-id',
        accountId: 'account-id',
        expiresAt: new Date('2026-01-31T00:00:00.000Z'),
        revokedAt: null,
      } as never);
      sessionsRepository.revokeRefreshSession.mockResolvedValue(undefined as never);

      await expect(sessionsService.logoutSession('refresh-token', now)).resolves.toBeUndefined();

      expect(sessionsRepository.revokeRefreshSession).toHaveBeenCalledWith({
        sessionId: 'session-id',
        revokedAt: now,
        revokedReason: 'logout',
      });
    });

    it('should reject missing refresh session on logout', async () => {
      refreshTokenService.hashRefreshToken.mockReturnValue('missing-hash' as never);
      sessionsRepository.findSessionByRefreshTokenHash.mockResolvedValue(null as never);

      await expect(sessionsService.logoutSession('missing-token')).rejects.toBeInstanceOf(
        InvalidRefreshSessionError,
      );
    });
  });

});
