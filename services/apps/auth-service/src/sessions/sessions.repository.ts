import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreatedSession,
  CreateSessionInput,
  RefreshSessionRecord,
  RevokeRefreshSessionInput,
  RotateRefreshSessionInput,
} from './sessions.types';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    const session = await this.prisma.authSession.create({
      data: {
        accountId: input.accountId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
      },
    });

    return {
      sessionId: session.id,
    };
  }

  async findSessionByRefreshTokenHash(refreshTokenHash: string): Promise<RefreshSessionRecord | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      accountId: session.accountId,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    };
  }

  async rotateRefreshSession(input: RotateRefreshSessionInput): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: input.sessionId },
      data: {
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        lastUsedAt: input.lastUsedAt,
      },
    });
  }

  async revokeRefreshSession(input: RevokeRefreshSessionInput): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: input.sessionId },
      data: {
        revokedAt: input.revokedAt,
        revokedReason: input.revokedReason,
      },
    });
  }
}
