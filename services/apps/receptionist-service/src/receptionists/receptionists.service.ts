import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  ReceptionistGender,
  ReceptionistStatus,
} from '../../../../generated/receptionist-client';
import type { AuthContext } from '../auth/auth-context';
import { DomainException } from '../common/domain.exception';
import {
  assertMatchingRequestHash,
  hashRequest,
  validateIdempotencyKey,
} from '../common/idempotency.util';
import { PrismaService } from '../database/prisma.service';
import type { DeactivateReceptionistDto } from './dto/deactivate-receptionist.dto';
import type { ListReceptionistsQuery } from './dto/list-receptionists.query';
import type { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import type { UpdateReceptionistDto } from './dto/update-receptionist.dto';
import { presentReceptionist } from './receptionist.presenter';

const receptionistWithProfile = { profile: true } as const;

@Injectable()
export class ReceptionistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(query: ListReceptionistsQuery): Promise<object> {
    const search = query.q?.trim();
    const records = await this.prisma.receptionist.findMany({
      where: {
        status: query.status,
        ...(search
          ? {
              OR: [
                {
                  employeeCode: {
                    contains: search.toUpperCase(),
                    mode: 'insensitive' as const,
                  },
                },
                {
                  profile: {
                    fullName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
                {
                  profile: {
                    loginEmail: {
                      contains: search.toLowerCase(),
                      mode: 'insensitive' as const,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: receptionistWithProfile,
      orderBy: { id: 'asc' },
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
    });
    const hasMore = records.length > query.limit;
    const page = hasMore ? records.slice(0, query.limit) : records;

    return {
      items: page.map((record) => presentReceptionist(record, true)),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async getOwn(auth: AuthContext): Promise<object> {
    const record = await this.findByAccountId(auth.userId);
    return presentReceptionist(record, false);
  }

  async getById(id: string, auth: AuthContext): Promise<object> {
    const record = await this.findById(id);
    this.assertOwnOrAdmin(record.accountId, auth);
    return presentReceptionist(record, auth.role === 'ADMIN');
  }

  async updateOwn(
    auth: AuthContext,
    dto: UpdateOwnProfileDto,
    requestId: string,
  ): Promise<object> {
    const current = await this.findByAccountId(auth.userId);
    const avatarUrl = dto.avatarUrl === null ? null : dto.avatarUrl.trim();

    if (current.version !== dto.version) {
      throw this.versionConflict();
    }
    if (current.profile?.avatarUrl === avatarUrl) {
      return presentReceptionist(current, false);
    }

    await this.prisma.$transaction(async (transaction) => {
      const update = await transaction.receptionist.updateMany({
        where: { id: current.id, version: dto.version },
        data: { version: { increment: 1 }, updatedByAccountId: auth.userId },
      });
      if (update.count !== 1) {
        throw this.versionConflict();
      }
      await transaction.receptionistProfile.update({
        where: { receptionistId: current.id },
        data: { avatarUrl },
      });
      await transaction.receptionAuditLog.create({
        data: {
          eventType: 'RECEPTIONIST_PROFILE_UPDATED',
          actorId: auth.userId,
          receptionistId: current.id,
          changedFields: ['profile.avatarUrl'],
          requestId,
        },
      });
    });

    return presentReceptionist(await this.findById(current.id), false);
  }

  async updateByAdmin(
    id: string,
    auth: AuthContext,
    dto: UpdateReceptionistDto,
    requestId: string,
  ): Promise<object> {
    const current = await this.findById(id);
    if (current.version !== dto.version) {
      throw this.versionConflict();
    }

    const employeeCode =
      dto.employeeCode === undefined
        ? current.employeeCode
        : this.normalizeEmployeeCode(dto.employeeCode);
    const fullName =
      dto.profile?.fullName === undefined
        ? current.profile?.fullName
        : this.normalizeFullName(dto.profile.fullName);
    const loginEmail =
      dto.profile?.loginEmail === undefined
        ? (current.profile?.loginEmail ?? null)
        : this.normalizeEmail(dto.profile.loginEmail);
    const workPhone =
      dto.profile?.workPhone === undefined
        ? (current.profile?.workPhone ?? null)
        : this.normalizePhone(dto.profile.workPhone);
    const address =
      dto.profile?.address === undefined
        ? (current.profile?.address ?? null)
        : this.normalizeOptionalText(dto.profile.address);
    const department =
      dto.profile?.department === undefined
        ? (current.profile?.department ?? null)
        : this.normalizeOptionalText(dto.profile.department);
    const gender =
      dto.profile?.gender === undefined
        ? (current.profile?.gender ?? null)
        : (dto.profile.gender as ReceptionistGender | null);

    if (!current.profile || !fullName) {
      throw new DomainException(
        'RECEPTIONIST_PROFILE_NOT_FOUND',
        'Receptionist profile was not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const changedFields: string[] = [];
    if (employeeCode !== current.employeeCode)
      changedFields.push('employeeCode');
    if (fullName !== current.profile.fullName)
      changedFields.push('profile.fullName');
    if (loginEmail !== current.profile.loginEmail)
      changedFields.push('profile.loginEmail');
    if (workPhone !== current.profile.workPhone)
      changedFields.push('profile.workPhone');
    if (address !== current.profile.address)
      changedFields.push('profile.address');
    if (department !== current.profile.department)
      changedFields.push('profile.department');
    if (gender !== current.profile.gender)
      changedFields.push('profile.gender');
    if (changedFields.length === 0) {
      return presentReceptionist(current, true);
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        const update = await transaction.receptionist.updateMany({
          where: { id, version: dto.version },
          data: {
            employeeCode,
            version: { increment: 1 },
            updatedByAccountId: auth.userId,
          },
        });
        if (update.count !== 1) {
          throw this.versionConflict();
        }
        await transaction.receptionistProfile.update({
          where: { receptionistId: id },
          data: {
            fullName,
            loginEmail,
            workPhone,
            address,
            department,
            gender,
          },
        });
        await transaction.receptionAuditLog.create({
          data: {
            eventType: 'RECEPTIONIST_UPDATED',
            actorId: auth.userId,
            receptionistId: id,
            changedFields,
            reasonCode: 'ADMIN_PROFILE_UPDATE',
            requestId,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;
        if (
          Array.isArray(target) &&
          target.some((field) => String(field).includes('login_email'))
        ) {
          throw new DomainException(
            'LOGIN_EMAIL_EXISTS',
            'Login email is already in use',
            HttpStatus.CONFLICT,
          );
        }
        throw new DomainException(
          'EMPLOYEE_CODE_EXISTS',
          'Employee code is already in use',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }

    return presentReceptionist(await this.findById(id), true);
  }

  async deactivate(
    id: string,
    auth: AuthContext,
    dto: DeactivateReceptionistDto,
    suppliedKey: string | undefined,
    requestId: string,
  ): Promise<object> {
    const idempotencyKey = validateIdempotencyKey(suppliedKey);
    const operation = `receptionist.deactivate:${id}`;
    const requestHash = hashRequest(dto);
    const existing = await this.prisma.receptionIdempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId: auth.userId,
          operation,
          idempotencyKey,
        },
      },
    });
    if (existing) return this.replayReceptionist(existing, requestHash);

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        await transaction.receptionIdempotencyRecord.create({
          data: {
            actorId: auth.userId,
            operation,
            idempotencyKey,
            requestHash,
            resourceId: id,
            responseStatus: 200,
            expiresAt: this.idempotencyExpiry(),
          },
        });
        const current = await transaction.receptionist.findUnique({
          where: { id },
          include: receptionistWithProfile,
        });
        if (!current) {
          throw new DomainException(
            'RECEPTIONIST_NOT_FOUND',
            'Receptionist was not found',
            HttpStatus.NOT_FOUND,
          );
        }
        if (current.status === ReceptionistStatus.INACTIVE) return current;
        if (current.version !== dto.version) throw this.versionConflict();

        const update = await transaction.receptionist.updateMany({
          where: { id, version: dto.version },
          data: {
            status: ReceptionistStatus.INACTIVE,
            version: { increment: 1 },
            updatedByAccountId: auth.userId,
          },
        });
        if (update.count !== 1) throw this.versionConflict();
        await transaction.receptionAuditLog.create({
          data: {
            eventType: 'RECEPTIONIST_DEACTIVATED',
            actorId: auth.userId,
            receptionistId: id,
            changedFields: ['status'],
            reasonCode: 'ADMIN_DEACTIVATION',
            requestId,
          },
        });
        return transaction.receptionist.findUniqueOrThrow({
          where: { id },
          include: receptionistWithProfile,
        });
      });
      return presentReceptionist(updated, true);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.receptionIdempotencyRecord.findUnique({
          where: {
            actorId_operation_idempotencyKey: {
              actorId: auth.userId,
              operation,
              idempotencyKey,
            },
          },
        });
        if (raced) return this.replayReceptionist(raced, requestHash);
      }
      throw error;
    }
  }

  async assertAccessible(id: string, auth: AuthContext): Promise<void> {
    const record = await this.findById(id);
    this.assertOwnOrAdmin(record.accountId, auth);
  }

  async findAccountId(id: string): Promise<string> {
    return (await this.findById(id)).accountId;
  }

  private async findByAccountId(accountId: string) {
    const record = await this.prisma.receptionist.findUnique({
      where: { accountId },
      include: receptionistWithProfile,
    });
    if (!record) {
      throw new DomainException(
        'RECEPTIONIST_PROFILE_NOT_FOUND',
        'Receptionist profile was not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return record;
  }

  private async findById(id: string) {
    const record = await this.prisma.receptionist.findUnique({
      where: { id },
      include: receptionistWithProfile,
    });
    if (!record) {
      throw new DomainException(
        'RECEPTIONIST_NOT_FOUND',
        'Receptionist was not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return record;
  }

  private assertOwnOrAdmin(accountId: string, auth: AuthContext): void {
    if (auth.role !== 'ADMIN' && accountId !== auth.userId) {
      throw new ForbiddenException(
        'Receptionists may only access their own record',
      );
    }
  }

  private normalizeEmployeeCode(value: string): string {
    return value.trim().toUpperCase();
  }

  private normalizeFullName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizePhone(value: string | null): string | null {
    if (value === null) return null;
    let normalized = value.trim().replace(/[ .()-]/g, '');
    if (normalized.startsWith('0')) normalized = `+84${normalized.slice(1)}`;
    else if (normalized.startsWith('84')) normalized = `+${normalized}`;
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new DomainException(
        'VALIDATION_FAILED',
        'workPhone must be a valid E.164 or Vietnamese phone number',
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalized;
  }

  private normalizeEmail(value: string | null): string | null {
    return value === null ? null : value.trim().toLowerCase();
  }

  private normalizeOptionalText(value: string | null): string | null {
    if (value === null) return null;
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized || null;
  }

  private versionConflict(): DomainException {
    return new DomainException(
      'VERSION_CONFLICT',
      'The receptionist record was updated by another request',
      HttpStatus.CONFLICT,
    );
  }

  private async replayReceptionist(
    record: { requestHash: string; resourceId: string | null },
    requestHash: string,
  ): Promise<object> {
    assertMatchingRequestHash(record.requestHash, requestHash);
    if (!record.resourceId) {
      throw new DomainException(
        'IDEMPOTENCY_RESULT_NOT_FOUND',
        'The original request result is unavailable',
        HttpStatus.CONFLICT,
      );
    }
    return presentReceptionist(await this.findById(record.resourceId), true);
  }

  private idempotencyExpiry(): Date {
    const configured = Number(
      this.config.get<string>('RECEPTION_IDEMPOTENCY_TTL_HOURS') ?? 24,
    );
    const hours =
      Number.isFinite(configured) && configured > 0 ? configured : 24;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
}
