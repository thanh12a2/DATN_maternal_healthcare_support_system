import { Injectable } from '@nestjs/common';
import { AccountStatus, Prisma, AuthRoleCode } from '@prisma/client';
import { AuthRole } from '../auth/dto/auth-role.enum';
import { PrismaService } from '../database/prisma.service';
import {
  AccountAuthProfile,
  AccountForLogin,
  InternalAccountLookup,
  RegisteredAccount,
  RegisterAccountInput,
} from './accounts.types';

const ROLE_PRIORITY: Record<AuthRole, number> = {
  [AuthRole.Admin]: 1,
  [AuthRole.ClinicManager]: 2,
  [AuthRole.Doctor]: 3,
  [AuthRole.Receptionist]: 4,
  [AuthRole.Nurse]: 5,
  [AuthRole.Patient]: 6,
};

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAccountWithCredential(
    input: RegisterAccountInput,
  ): Promise<RegisteredAccount> {
    const roleCode = this.toPrismaRoleCode(input.role);
    return this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findUnique({
        where: { code: roleCode },
      });
      if (!role) throw new AuthRoleNotSeededError(input.role);

      const account = await transaction.account.create({
        data: {
          email: input.email,
          credential: { create: { passwordHash: input.passwordHash } },
          roles: { create: { roleId: role.id } },
        },
      });
      return { userId: account.id, email: account.email, role: input.role };
    });
  }

  async findAccountForLoginByEmail(
    email: string,
  ): Promise<AccountForLogin | null> {
    const account = await this.prisma.account.findUnique({
      where: { email },
      include: { credential: true, roles: { include: { role: true } } },
    });
    const credential = account?.credential;
    const accountRole = this.selectRole(
      account?.roles.map((item) => item.role.code),
    );
    if (!account || !credential || !accountRole) return null;

    if (!account || !credential || account.roles.length !== 1) return null;
    return {
      userId: account.id,
      email: account.email,
      status: account.status,
      passwordHash: credential.passwordHash,
      role: accountRole,
    };
  }

  async findAuthProfileById(
    accountId: string,
  ): Promise<AccountAuthProfile | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { roles: { include: { role: true } } },
    });
    const accountRole = this.selectRole(
      account?.roles.map((item) => item.role.code),
    );
    if (!account || !accountRole) return null;

    return {
      userId: account.id,
      email: account.email,
      status: account.status,
      role: accountRole,
    };
  }

  async findInternalAccountById(
    accountId: string,
  ): Promise<InternalAccountLookup | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { roles: { include: { role: true } } },
    });
    const accountRole = this.selectRole(
      account?.roles.map((item) => item.role.code),
    );
    if (!account || !accountRole) return null;
    return { accountId: account.id, status: account.status, role: accountRole };
  }

  async markLastLoginAt(accountId: string, lastLoginAt: Date): Promise<void> {
    await this.prisma.account.update({ where: { id: accountId }, data: { lastLoginAt } });
  }

  async listManagedStaff() {
    const accounts = await this.prisma.account.findMany({
      where: {
        roles: {
          some: {
            role: {
              code: { in: [AuthRoleCode.DOCTOR, AuthRoleCode.NURSE, AuthRoleCode.RECEPTIONIST] },
            },
          },
        },
      },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return accounts.map((account) => ({
      userId: account.id,
      email: account.email,
      status: account.status,
      role: this.selectRole(account.roles.map((item) => item.role.code)),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  }

  async changeManagedStaffStatus(
    accountId: string,
    status: Extract<AccountStatus, 'ACTIVE' | 'DISABLED'>,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { roles: { include: { role: true } } },
    });
    const role = this.selectRole(account?.roles.map((item) => item.role.code));
    if (
      !account ||
      !role ||
      ![AuthRole.Doctor, AuthRole.Nurse, AuthRole.Receptionist].includes(role)
    ) {
      return null;
    }
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { status },
    });
    return { userId: updated.id, email: updated.email, status: updated.status, role };
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private selectRole(codes?: AuthRoleCode[]): AuthRole | null {
    if (!codes?.length) return null;
    return (
      codes
        .map((code) => code as unknown as AuthRole)
        .sort((left, right) => ROLE_PRIORITY[left] - ROLE_PRIORITY[right])[0] ??
      null
    );
  }

  private toPrismaRoleCode(role: AuthRole): AuthRoleCode {
    return role;
  }
}

export class AuthRoleNotSeededError extends Error {
  constructor(role: AuthRole) {
    super(`Auth role is not seeded: ${role}`);
    this.name = 'AuthRoleNotSeededError';
  }
}
