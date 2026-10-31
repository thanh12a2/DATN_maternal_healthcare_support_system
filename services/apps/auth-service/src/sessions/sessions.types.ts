export interface CreateSessionInput {
  accountId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export interface CreatedSession {
  sessionId: string;
}

export interface RefreshSessionRecord {
  sessionId: string;
  accountId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RotateRefreshSessionInput {
  sessionId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
}

export interface RevokeRefreshSessionInput {
  sessionId: string;
  revokedAt: Date;
  revokedReason: string;
}
