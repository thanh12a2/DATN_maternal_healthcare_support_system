import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, AuthRoleCode, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PasswordHasherService } from '../security/password-hasher.service';
import { AuthRole } from '../auth/dto/auth-role.enum';
import {
  CreateUserDto,
  QueryUsersDto,
  UpdateUserDto,
  UserListResponseDto,
  UserSummaryDto,
} from './dto/admin-user.dto';

const ROLE_PRIORITY: Record<AuthRole, number> = {
  [AuthRole.Admin]: 1,
  [AuthRole.ClinicManager]: 2,
  [AuthRole.Doctor]: 3,
  [AuthRole.Receptionist]: 4,
  [AuthRole.Nurse]: 5,
  [AuthRole.Patient]: 6,
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async listUsers(query: QueryUsersDto): Promise<UserListResponseDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AccountWhereInput = {};

    if (query.search?.trim()) {
      where.email = { contains: query.search.trim(), mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.roles = {
        some: {
          role: {
            code: query.role as unknown as AuthRoleCode,
          },
        },
      };
    }

    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.account.count({ where }),
    ]);

    const items = accounts.map((account) => this.mapToSummary(account));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getUserById(id: string): Promise<UserSummaryDto> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID: ${id}`);
    }

    return this.mapToSummary(account);
  }

  async createUser(dto: CreateUserDto): Promise<UserSummaryDto> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.account.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký trong hệ thống');
    }

    const role = await this.prisma.role.findUnique({
      where: { code: dto.role as unknown as AuthRoleCode },
    });
    if (!role) {
      throw new BadRequestException(`Vai trò ${dto.role} chưa được khởi tạo`);
    }

    const passwordHash = await this.passwordHasher.hashPassword(dto.password);

    const account = await this.prisma.$transaction(async (tx) => {
      return tx.account.create({
        data: {
          email,
          status: dto.status ?? AccountStatus.ACTIVE,
          credential: {
            create: {
              passwordHash,
            },
          },
          roles: {
            create: {
              roleId: role.id,
            },
          },
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    });

    return this.mapToSummary(account);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserSummaryDto> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID: ${id}`);
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      if (email !== account.email) {
        const existing = await this.prisma.account.findUnique({
          where: { email },
        });
        if (existing) {
          throw new ConflictException('Email mới đã được sử dụng bởi tài khoản khác');
        }
      }
    }

    if (dto.role) {
      const currentRole = account.roles[0]?.role?.code;
      if (dto.role !== (currentRole as unknown as AuthRole)) {
        throw new BadRequestException('Vai trò của tài khoản được gắn cố định và không thể thay đổi.');
      }
    }

    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await this.passwordHasher.hashPassword(dto.password);
    }

    const updatedAccount = await this.prisma.$transaction(async (tx) => {
      if (passwordHash) {
        await tx.credential.upsert({
          where: { accountId: id },
          create: {
            accountId: id,
            passwordHash,
          },
          update: {
            passwordHash,
            passwordUpdatedAt: new Date(),
          },
        });
      }

      const updateData: Prisma.AccountUpdateInput = {};
      if (dto.email) updateData.email = dto.email.trim().toLowerCase();
      if (dto.status) updateData.status = dto.status;

      return tx.account.update({
        where: { id },
        data: updateData,
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    });

    return this.mapToSummary(updatedAccount);
  }

  async deleteUser(id: string, currentAdminId?: string): Promise<{ success: boolean; message: string }> {
    if (currentAdminId && id === currentAdminId) {
      throw new BadRequestException('Bạn không thể tự xóa tài khoản của chính mình');
    }

    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID: ${id}`);
    }

    const role = this.selectRole(account.roles.map((r) => r.role.code));
    if (role === AuthRole.Admin) {
      const adminCount = await this.prisma.accountRole.count({
        where: {
          role: {
            code: AuthRoleCode.ADMIN,
          },
        },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Không thể xóa quản trị viên duy nhất còn lại trong hệ thống');
      }
    }

    await this.prisma.account.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Đã xóa người dùng thành công',
    };
  }

  private mapToSummary(
    account: Prisma.AccountGetPayload<{
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    }>,
  ): UserSummaryDto {
    const role = this.selectRole(account.roles.map((item) => item.role.code)) ?? AuthRole.Patient;
    return {
      id: account.id,
      email: account.email,
      role,
      status: account.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastLoginAt: account.lastLoginAt,
    };
  }

  private selectRole(codes?: AuthRoleCode[]): AuthRole | null {
    if (!codes?.length) return null;
    return (
      codes
        .map((code) => code as unknown as AuthRole)
        .sort((left, right) => ROLE_PRIORITY[left] - ROLE_PRIORITY[right])[0] ?? null
    );
  }
}
