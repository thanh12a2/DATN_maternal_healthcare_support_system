import { Injectable } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';
import { SessionsRepository } from './sessions.repository';
import { RefreshSessionRecord } from './sessions.types';

const LOGOUT_REVOKED_REASON = 'logout';

export interface CreatedRefreshSession {
  refreshToken: string;
  expiresAt: Date;
  sessionId: string;
}

export interface RefreshedSession {
  accountId: string;
  refreshToken: string;
  expiresAt: Date;
  sessionId: string;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly refreshTokenService: RefreshTokenService,
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async createRefreshSession(accountId: string): Promise<CreatedRefreshSession> {
    const issuedRefreshToken = this.refreshTokenService.issueRefreshToken();
    const createdSession = await this.sessionsRepository.createSession({
      accountId,
      refreshTokenHash: issuedRefreshToken.refreshTokenHash,
      expiresAt: issuedRefreshToken.expiresAt,
    });

    return {
      refreshToken: issuedRefreshToken.refreshToken,
      expiresAt: issuedRefreshToken.expiresAt,
      sessionId: createdSession.sessionId,
    };
  }

  async refreshSession(refreshToken: string, now = new Date()): Promise<RefreshedSession> {
    const refreshTokenHash = this.refreshTokenService.hashRefreshToken(refreshToken);
    const session = await this.sessionsRepository.findSessionByRefreshTokenHash(refreshTokenHash);

    this.assertRefreshSessionIsUsable(session, now);

    const issuedRefreshToken = this.refreshTokenService.issueRefreshToken(now);

    await this.sessionsRepository.rotateRefreshSession({
      sessionId: session.sessionId,
      refreshTokenHash: issuedRefreshToken.refreshTokenHash,
      expiresAt: issuedRefreshToken.expiresAt,
      lastUsedAt: now,
    });

    return {
      accountId: session.accountId,
      refreshToken: issuedRefreshToken.refreshToken,
      expiresAt: issuedRefreshToken.expiresAt,
      sessionId: session.sessionId,
    };
  }

  async logoutSession(refreshToken: string, now = new Date()): Promise<void> {
    const refreshTokenHash = this.refreshTokenService.hashRefreshToken(refreshToken);
    const session = await this.sessionsRepository.findSessionByRefreshTokenHash(refreshTokenHash);

    this.assertRefreshSessionIsUsable(session, now);

    await this.sessionsRepository.revokeRefreshSession({
      sessionId: session.sessionId,
      revokedAt: now,
      revokedReason: LOGOUT_REVOKED_REASON,
    });
  }

  private assertRefreshSessionIsUsable(
    session: RefreshSessionRecord | null,
    now: Date,
  ): asserts session is RefreshSessionRecord {
    if (!session) {
      throw new InvalidRefreshSessionError();
    }

    if (session.revokedAt) {
      throw new InvalidRefreshSessionError();
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      throw new InvalidRefreshSessionError();
    }
  }
}

export class InvalidRefreshSessionError extends Error {
  constructor() {
    super('Invalid refresh session');
    this.name = 'InvalidRefreshSessionError';
  }
}
