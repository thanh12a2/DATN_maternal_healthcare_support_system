import { Injectable } from '@nestjs/common';
import { Prisma, AuthRoleCode } from '@prisma/client';
import { AuthRole } from '../auth/dto/auth-role.enum';
import { PrismaService } from '../database/prisma.service';
import { AccountForLogin, RegisteredAccount, RegisterAccountInput } from './accounts.types';

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAccountWithCredential(input: RegisterAccountInput): Promise<RegisteredAccount> {
    const roleCode = this.toPrismaRoleCode(input.role);

    return this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findUnique({
        where: { code: roleCode },
      });

      if (!role) {
        throw new AuthRoleNotSeededError(input.role);
      }

      const account = await transaction.account.create({
        data: {
          email: input.email,
          credential: {
            create: {
              passwordHash: input.passwordHash,
            },
          },
          roles: {
            create: {
              roleId: role.id,
            },
          },
        },
      });

      return {
        userId: account.id,
        email: account.email,
        role: input.role,
      };
    });
  }

  async findAccountForLoginByEmail(email: string): Promise<AccountForLogin | null> {
    const account = await this.prisma.account.findUnique({
      where: { email },
      include: {
        credential: true,
        roles: {
          include: {
            role: true,
          },
          take: 1,
        },
      },
    });

    const credential = account?.credential;
    const accountRole = account?.roles[0];

    if (!account || !credential || !accountRole) {
      return null;
    }

    return {
      userId: account.id,
      email: account.email,
      status: account.status,
      passwordHash: credential.passwordHash,
      role: accountRole.role.code as unknown as AuthRole,
    };
  }

  async markLastLoginAt(accountId: string, lastLoginAt: Date): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: { lastLoginAt },
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private toPrismaRoleCode(role: AuthRole): AuthRoleCode {
    return role as unknown as AuthRoleCode;
  }
}

export class AuthRoleNotSeededError extends Error {
  constructor(role: AuthRole) {
    super(`Auth role is not seeded: ${role}`);
    this.name = 'AuthRoleNotSeededError';
  }
}
