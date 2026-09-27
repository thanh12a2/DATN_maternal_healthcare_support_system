import { Injectable } from '@nestjs/common';
import { AccountStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface PasswordResetAccount {
  accountId: string;
  email: string;
}

export interface PasswordCredential {
  passwordHash: string;
}

export interface StorePasswordResetTokenInput {
  accountId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  cooldownThreshold: Date;
}

const PASSWORD_RESET_REVOKED_REASON = 'password_reset';
const PASSWORD_CHANGE_REVOKED_REASON = 'password_change';

@Injectable()
export class PasswordManagementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEligibleAccountByEmail(
    email: string,
  ): Promise<PasswordResetAccount | null> {
    const account = await this.prisma.account.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
        credential: { select: { accountId: true } },
      },
    });

    if (
      !account ||
      account.status !== AccountStatus.ACTIVE ||
      !account.credential
    ) {
      return null;
    }
    return { accountId: account.id, email: account.email };
  }

  async storePasswordResetToken(
    input: StorePasswordResetTokenInput,
  ): Promise<boolean> {
    const updated = await this.prisma.passwordResetToken.updateMany({
      where: {
        accountId: input.accountId,
        createdAt: { lte: input.cooldownThreshold },
      },
      data: {
        tokenHash: input.tokenHash,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      },
    });
    if (updated.count === 1) return true;

    try {
      await this.prisma.passwordResetToken.create({
        data: {
          accountId: input.accountId,
          tokenHash: input.tokenHash,
          createdAt: input.createdAt,
          expiresAt: input.expiresAt,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  async deletePasswordResetTokenIfMatches(
    accountId: string,
    tokenHash: string,
  ): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({
      where: { accountId, tokenHash },
    });
  }

  async resetPasswordWithToken(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const resetToken = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { account: { include: { credential: true } } },
      });

      if (
        !resetToken ||
        resetToken.expiresAt.getTime() <= now.getTime() ||
        resetToken.account.status !== AccountStatus.ACTIVE ||
        !resetToken.account.credential
      ) {
        throw new InvalidPasswordResetTokenError();
      }

      const consumed = await transaction.passwordResetToken.deleteMany({
        where: { accountId: resetToken.accountId, tokenHash },
      });
      if (consumed.count !== 1) throw new InvalidPasswordResetTokenError();

      await transaction.credential.update({
        where: { accountId: resetToken.accountId },
        data: {
          passwordHash,
          passwordUpdatedAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });

      await transaction.authSession.updateMany({
        where: { accountId: resetToken.accountId, revokedAt: null },
        data: { revokedAt: now, revokedReason: PASSWORD_RESET_REVOKED_REASON },
      });
    });
  }

  async findActiveCredentialByAccountId(
    accountId: string,
  ): Promise<PasswordCredential | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { status: true, credential: { select: { passwordHash: true } } },
    });
    if (
      !account ||
      account.status !== AccountStatus.ACTIVE ||
      !account.credential
    ) {
      return null;
    }
    return account.credential;
  }

  async changePassword(
    accountId: string,
    currentPasswordHash: string,
    newPasswordHash: string,
    now: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const account = await transaction.account.findUnique({
        where: { id: accountId },
        select: { status: true },
      });
      if (!account || account.status !== AccountStatus.ACTIVE) {
        throw new PasswordChangeAccountUnavailableError();
      }

      const updatedCredential = await transaction.credential.updateMany({
        where: { accountId, passwordHash: currentPasswordHash },
        data: {
          passwordHash: newPasswordHash,
          passwordUpdatedAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      if (updatedCredential.count !== 1) {
        throw new PasswordChangeAccountUnavailableError();
      }
      await transaction.passwordResetToken.deleteMany({ where: { accountId } });
      await transaction.authSession.updateMany({
        where: { accountId, revokedAt: null },
        data: { revokedAt: now, revokedReason: PASSWORD_CHANGE_REVOKED_REASON },
      });
    });
  }
}

export class InvalidPasswordResetTokenError extends Error {
  constructor() {
    super('Invalid or expired password reset token');
    this.name = 'InvalidPasswordResetTokenError';
  }
}

export class PasswordChangeAccountUnavailableError extends Error {
  constructor() {
    super('Account is unavailable for password change');
    this.name = 'PasswordChangeAccountUnavailableError';
  }
}
