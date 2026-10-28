import { Injectable, HttpException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { GrpcClientFactory } from '@platform';
import { ConfigService } from '@nestjs/config';
import {
  AvailabilityStatus,
  AvailabilityType,
  DoctorStatus,
  Prisma,
  RoomStatus,
  ScheduleStatus,
  SpecialtyStatus,
} from '../../../../generated/doctor-client';
import { Identity } from '../auth/auth.types';
import {
  AvailabilityQueryDto,
  CreateAvailabilityDto,
  CreateDoctorDto,
  CreateRoomDto,
  CreateScheduleDto,
  CreateSpecialtyDto,
  ListQueryDto,
  ReasonDto,
  RoomListQueryDto,
  ScheduleListQueryDto,
  SpecialtyLinkDto,
  SpecialtyListQueryDto,
  UpdateDoctorDto,
  UpdateRoomDto,
  UpdateScheduleDto,
} from '../common/dto';

const PUBLIC_INCLUDE = {
  profile: true,
  specialties: { include: { specialty: true } },
  schedules: { include: { room: true } },
} as const;
const FULL_INCLUDE = {
  ...PUBLIC_INCLUDE,
  availabilities: { include: { room: true } },
} as const;

type Tx = Prisma.TransactionClient;
type AnyRecord = Record<string, any>;

@Injectable()
export class DoctorDomainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grpc: GrpcClientFactory,
    private readonly config: ConfigService,
  ) {}

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' as const };
  }

  async createRoom(dto: CreateRoomDto, actor: Identity, key?: string) {
    this.requireClinicOperator(actor);
    if (key !== undefined && (!key || key.length > 128))
      this.fail(400, 'VALIDATION_FAILED');
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const duplicate = await this.prisma.clinicRoom.findFirst({
      where: {
        OR: [{ code }, { name: { equals: name, mode: 'insensitive' } }],
      },
    });
    if (duplicate?.code === code) this.fail(409, 'ROOM_CODE_EXISTS');
    if (duplicate) this.fail(409, 'ROOM_NAME_EXISTS');
    const room = await this.prisma.clinicRoom.create({
      data: {
        code,
        name,
        status: dto.status ?? RoomStatus.ACTIVE,
      },
    });
    return { data: room };
  }

  async listRooms(query: RoomListQueryDto, actor?: Identity) {
    const isOperator = this.isClinicOperator(actor);
    const where: AnyRecord =
      isOperator && query.status
        ? { status: query.status }
        : isOperator
          ? {}
          : { status: RoomStatus.ACTIVE };
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.clinicRoom.findMany({
      where,
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      take: query.limit ?? 50,
    });
    return {
      data: rows,
      meta: {
        nextCursor: null,
        limit: query.limit ?? 50,
        requestId: randomUUID(),
      },
    };
  }

  async getRoom(idOrCode: string, actor?: Identity) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrCode,
      );
    const room = await this.prisma.clinicRoom.findFirst({
      where: isUuid
        ? { id: idOrCode }
        : { code: { equals: idOrCode.trim(), mode: 'insensitive' } },
      include: {
        schedules: {
          where: { status: ScheduleStatus.ACTIVE },
          include: { doctor: { include: { profile: true } } },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });
    if (!room) this.fail(404, 'ROOM_NOT_FOUND');
    if (room.status !== RoomStatus.ACTIVE && !this.isClinicOperator(actor))
      this.fail(404, 'ROOM_NOT_FOUND');
    return {
      data: {
        id: room.id,
        code: room.code,
        name: room.name,
        status: room.status,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        schedules: room.schedules.map((s) => ({
          id: s.id,
          doctorId: s.doctorId,
          doctorName: s.doctor?.profile?.fullName ?? null,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          slotDurationMinutes: s.slotDurationMinutes,
          effectiveFrom: s.effectiveFrom,
          effectiveTo: s.effectiveTo,
          status: s.status,
        })),
      },
    };
  }

  async updateRoom(idOrCode: string, dto: UpdateRoomDto, actor: Identity) {
    this.requireClinicOperator(actor);
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrCode,
      );
    const existing = await this.prisma.clinicRoom.findFirst({
      where: isUuid
        ? { id: idOrCode }
        : { code: { equals: idOrCode.trim(), mode: 'insensitive' } },
    });
    if (!existing) this.fail(404, 'ROOM_NOT_FOUND');
    const data: AnyRecord = {};
    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      if (code !== existing.code) {
        const dup = await this.prisma.clinicRoom.findUnique({ where: { code } });
        if (dup) this.fail(409, 'ROOM_CODE_EXISTS');
      }
      data.code = code;
    }
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    const updated = await this.prisma.clinicRoom.update({
      where: { id: existing.id },
      data,
    });
    return { data: updated };
  }

  private async resolveRoomId(
    roomId?: string,
    roomCode?: string,
  ): Promise<string | undefined> {
    if (!roomId && !roomCode) return undefined;
    const room = await this.prisma.clinicRoom.findFirst({
      where: roomId
        ? { id: roomId }
        : { code: { equals: roomCode!.trim(), mode: 'insensitive' } },
    });
    if (!room) this.fail(404, 'ROOM_NOT_FOUND');
    if (room.status !== RoomStatus.ACTIVE) this.fail(422, 'ROOM_INACTIVE');
    return room.id;
  }

  async createDoctor(
    dto: CreateDoctorDto,
    actor: Identity,
    key?: string,
    requestId?: string,
  ) {
    this.requireClinicOperator(actor);
    this.requireKey(key);
    try {
      await this.verifyAccount(dto.accountId);
      const normalized = this.normalizeLicense(dto.licenseNumber);
      this.validateProfile(dto.profile);
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.doctor.findFirst({
          where: {
            OR: [{ accountId: dto.accountId }, { licenseNumber: normalized }],
          },
        });
        if (existing?.accountId === dto.accountId)
          this.fail(409, 'DOCTOR_ACCOUNT_EXISTS');
        if (existing?.licenseNumber === normalized)
          this.fail(409, 'LICENSE_NUMBER_EXISTS');
        const doctor = await tx.doctor.create({
          data: {
            accountId: dto.accountId,
            licenseNumber: normalized,
            profile: { create: this.profileData(dto.profile) },
          },
          include: FULL_INCLUDE,
        });
        await this.auditOutbox(
          tx,
          'doctor.created',
          actor.userId,
          doctor.id,
          doctor.version,
          requestId,
          { doctorId: doctor.id },
        );
        return doctor;
      });
      return { data: this.adminView(result) };
    } catch (err) {
      console.error('ERROR IN CREATEDOCTOR:', err);
      throw err;
    }
  }

  async listDoctors(query: ListQueryDto, actor?: Identity) {
    const admin = this.isClinicOperator(actor);
    const where: AnyRecord =
      admin && query.status
        ? { status: query.status }
        : { status: DoctorStatus.ACTIVE };
    if (query.specialtyId)
      where.specialties = {
        some: {
          specialtyId: query.specialtyId,
          specialty: { status: SpecialtyStatus.ACTIVE },
        },
      };
    if (query.q)
      where.profile = {
        fullName: { contains: query.q.trim(), mode: 'insensitive' },
      };
    const rows = await this.prisma.doctor.findMany({
      where,
      include: PUBLIC_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: Math.min(query.limit ?? 20, 100) + 1,
    });
    const hasNext = rows.length > (query.limit ?? 20);
    const data = rows
      .slice(0, query.limit ?? 20)
      .map((x) => this.publicView(x));
    return {
      data,
      meta: {
        nextCursor: hasNext ? rows[rows.length - 2].id : null,
        limit: query.limit ?? 20,
        requestId: randomUUID(),
      },
    };
  }

  async getDoctor(id: string, actor?: Identity) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: FULL_INCLUDE,
    });
    if (!doctor) this.notFound();
    const own = actor?.userId === doctor.accountId;
    if (
      doctor.status !== DoctorStatus.ACTIVE &&
      !own &&
      !this.isClinicOperator(actor)
    )
      this.notFound();
    return {
      data:
        own || actor?.role === 'ADMIN'
          ? this.adminView(doctor)
          : actor?.role === 'CLINIC_MANAGER'
            ? this.managerView(doctor)
            : this.publicView(doctor),
    };
  }

  async updateDoctor(
    id: string,
    dto: UpdateDoctorDto,
    actor: Identity,
    version: number,
    requestId?: string,
  ) {
    if (!Number.isInteger(version)) this.fail(400, 'VALIDATION_FAILED');
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!doctor) this.notFound();
    const admin = actor.role === 'ADMIN';
    const manager = actor.role === 'CLINIC_MANAGER';
    if (!admin && !manager && actor.userId !== doctor.accountId)
      this.fail(403, 'FORBIDDEN');
    const allowed = admin
      ? [
          'fullName',
          'professionalTitle',
          'biography',
          'practiceStartYear',
          'languages',
          'photoUrl',
          'licenseNumber',
        ]
      : manager
        ? [
            'fullName',
            'professionalTitle',
            'biography',
            'practiceStartYear',
            'languages',
            'photoUrl',
          ]
        : ['biography', 'languages', 'photoUrl'];
    const sent = Object.keys(dto).filter(
      (x) => (dto as AnyRecord)[x] !== undefined,
    );
    if (!sent.length || sent.some((x) => !allowed.includes(x)))
      this.fail(400, 'FIELD_NOT_ALLOWED');
    if (dto.licenseNumber)
      dto.licenseNumber = this.normalizeLicense(dto.licenseNumber);
    if (
      dto.fullName ||
      dto.biography ||
      dto.languages ||
      dto.photoUrl ||
      dto.practiceStartYear ||
      dto.professionalTitle
    )
      this.validateProfile({
        ...doctor.profile,
        ...dto,
        fullName: dto.fullName ?? doctor.profile?.fullName,
      });
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.doctor.updateMany({
        where: { id, version },
        data: {
          ...(dto.licenseNumber ? { licenseNumber: dto.licenseNumber } : {}),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) this.fail(409, 'VERSION_CONFLICT');
      await tx.doctorProfile.update({
        where: { doctorId: id },
        data: this.profilePatch(dto),
      });
      const current = await tx.doctor.findUnique({
        where: { id },
        include: FULL_INCLUDE,
      });
      await this.auditOutbox(
        tx,
        'doctor.profile_updated',
        actor.userId,
        id,
        current!.version,
        requestId,
        { changedFieldNames: sent },
      );
      return current!;
    });
    return {
      data: admin
        ? this.adminView(updated)
        : manager
          ? this.managerView(updated)
          : this.adminView(updated),
    };
  }

  async changeStatus(
    id: string,
    activate: boolean,
    actor: Identity,
    version: number,
    reason?: string,
    requestId?: string,
  ) {
    this.requireClinicOperator(actor);
    if (!Number.isInteger(version)) this.fail(400, 'VALIDATION_FAILED');
    if (
      !activate &&
      (!reason || reason.trim().length < 3 || reason.trim().length > 500)
    )
      this.fail(400, 'VALIDATION_FAILED');
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: { profile: true, specialties: { include: { specialty: true } } },
    });
    if (!doctor) this.notFound();
    const target = activate ? DoctorStatus.ACTIVE : DoctorStatus.INACTIVE;
    if (doctor.status === target)
      return { data: { id, status: target, version: doctor.version } };
    if (
      activate &&
      !([DoctorStatus.DRAFT, DoctorStatus.INACTIVE] as DoctorStatus[]).includes(
        doctor.status,
      )
    )
      this.fail(409, 'INVALID_STATE_TRANSITION');
    if (
      !activate &&
      !([DoctorStatus.DRAFT, DoctorStatus.ACTIVE] as DoctorStatus[]).includes(
        doctor.status,
      )
    )
      this.fail(409, 'INVALID_STATE_TRANSITION');
    if (activate) {
      if (!doctor.profile?.fullName)
        this.fail(422, 'DOCTOR_PROFILE_INCOMPLETE');
      if (
        doctor.specialties.filter(
          (x) => x.isPrimary && x.specialty.status === SpecialtyStatus.ACTIVE,
        ).length !== 1
      )
        this.fail(422, 'PRIMARY_SPECIALTY_REQUIRED');
      await this.verifyAccount(doctor.accountId);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.doctor.updateMany({
        where: { id, version },
        data: { status: target, version: { increment: 1 } },
      });
      if (result.count !== 1) this.fail(409, 'VERSION_CONFLICT');
      const current = await tx.doctor.findUnique({ where: { id } });
      await this.auditOutbox(
        tx,
        'doctor.status_changed',
        actor.userId,
        id,
        current!.version,
        requestId,
        { from: doctor.status, to: target, reason: reason?.trim() },
      );
      return current!;
    });
    return {
      data: {
        id: updated.id,
        status: updated.status,
        version: updated.version,
      },
    };
  }

  async createSpecialty(
    dto: CreateSpecialtyDto,
    actor: Identity,
    key?: string,
    requestId?: string,
  ) {
    this.requireAdmin(actor);
    this.requireKey(key);
    const code = dto.code.trim().toUpperCase(),
      name = dto.name.trim();
    const duplicate = await this.prisma.specialty.findFirst({
      where: {
        OR: [{ code }, { name: { equals: name, mode: 'insensitive' } }],
      },
    });
    if (duplicate?.code === code) this.fail(409, 'SPECIALTY_CODE_EXISTS');
    if (duplicate) this.fail(409, 'SPECIALTY_NAME_EXISTS');
    const specialty = await this.prisma.specialty.create({
      data: { code, name, description: dto.description?.trim() },
    });
    return { data: specialty };
  }

  async listSpecialties(query: SpecialtyListQueryDto, actor: Identity) {
    const where =
      actor.role === 'ADMIN' && query.status
        ? { status: query.status }
        : { status: SpecialtyStatus.ACTIVE };
    const rows = await this.prisma.specialty.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit ?? 20,
    });
    return {
      data: rows,
      meta: {
        nextCursor: null,
        limit: query.limit ?? 20,
        requestId: randomUUID(),
      },
    };
  }

  async linkSpecialty(
    doctorId: string,
    specialtyId: string,
    dto: SpecialtyLinkDto,
    actor: Identity,
    requestId?: string,
  ) {
    this.requireClinicOperator(actor);
    const [doctor, specialty] = await Promise.all([
      this.prisma.doctor.findUnique({ where: { id: doctorId } }),
      this.prisma.specialty.findUnique({ where: { id: specialtyId } }),
    ]);
    if (!doctor) this.notFound();
    if (!specialty) this.fail(404, 'SPECIALTY_NOT_FOUND');
    if (specialty.status !== SpecialtyStatus.ACTIVE)
      this.fail(422, 'SPECIALTY_INACTIVE');
    const relation = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary)
        await tx.doctorSpecialty.updateMany({
          where: { doctorId, isPrimary: true },
          data: { isPrimary: false },
        });
      const item = await tx.doctorSpecialty.upsert({
        where: { doctorId_specialtyId: { doctorId, specialtyId } },
        update: { isPrimary: dto.isPrimary },
        create: { doctorId, specialtyId, isPrimary: dto.isPrimary },
        include: { specialty: true },
      });
      await this.auditOutbox(
        tx,
        'doctor.specialties_changed',
        actor.userId,
        doctorId,
        doctor.version,
        requestId,
        { specialtyId, action: 'UPSERT' },
      );
      return item;
    });
    return { data: relation };
  }

  async unlinkSpecialty(
    doctorId: string,
    specialtyId: string,
    actor: Identity,
    requestId?: string,
  ) {
    this.requireClinicOperator(actor);
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) this.notFound();
    const relation = await this.prisma.doctorSpecialty.findUnique({
      where: { doctorId_specialtyId: { doctorId, specialtyId } },
    });
    if (!relation) return;
    if (
      doctor.status === DoctorStatus.ACTIVE &&
      relation.isPrimary &&
      (await this.prisma.doctorSpecialty.count({
        where: { doctorId, isPrimary: true },
      })) === 1
    )
      this.fail(422, 'PRIMARY_SPECIALTY_REQUIRED');
    await this.prisma.$transaction(async (tx) => {
      await tx.doctorSpecialty.delete({
        where: { doctorId_specialtyId: { doctorId, specialtyId } },
      });
      await this.auditOutbox(
        tx,
        'doctor.specialties_changed',
        actor.userId,
        doctorId,
        doctor.version,
        requestId,
        { specialtyId, action: 'DELETE' },
      );
    });
  }

  async createSchedule(
    doctorId: string,
    dto: CreateScheduleDto,
    actor: Identity,
    key?: string,
    requestId?: string,
  ) {
    this.requireClinicOperator(actor);
    this.requireKey(key);
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) this.notFound();
    if (doctor.status !== DoctorStatus.ACTIVE)
      this.fail(422, 'DOCTOR_NOT_ACTIVE');
    const resolvedRoomId = await this.resolveRoomId(dto.roomId, dto.roomCode);
    const input = this.scheduleInput({ ...dto, roomId: resolvedRoomId });
    this.validateSchedule(input);
    const schedule = await this.prisma.$transaction(async (tx) => {
      await this.lockDoctor(tx, doctorId);
      await this.assertNoScheduleOverlap(tx, doctorId, input);
      const value = await tx.doctorSchedule.create({
        data: {
          doctorId,
          ...input,
        } as Prisma.DoctorScheduleUncheckedCreateInput,
        include: { room: true },
      });
      await this.auditOutbox(
        tx,
        'doctor.schedule_changed',
        actor.userId,
        doctorId,
        doctor.version,
        requestId,
        { scheduleId: value.id, roomId: value.roomId, action: 'CREATE' },
      );
      return value;
    });
    return { data: this.formatSchedule(schedule) };
  }

  async listSchedules(
    doctorId: string,
    query: ScheduleListQueryDto,
    actor: Identity,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) this.notFound();
    const isPrivileged =
      this.isClinicOperator(actor) ||
      actor?.role === 'RECEPTIONIST' ||
      actor?.userId === doctor.accountId;
    const rows = await this.prisma.doctorSchedule.findMany({
      where: {
        doctorId,
        ...(isPrivileged && query.status
          ? { status: query.status }
          : isPrivileged
            ? {}
            : { status: ScheduleStatus.ACTIVE }),
        ...(query.roomId ? { roomId: query.roomId } : {}),
        ...(query.from
          ? {
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date(query.from) } },
              ],
            }
          : {}),
        ...(query.to ? { effectiveFrom: { lte: new Date(query.to) } } : {}),
      },
      include: { room: true },
      orderBy: [{ effectiveFrom: 'asc' }, { dayOfWeek: 'asc' }],
      take: query.limit ?? 20,
    });
    return {
      data: rows.map((r) => this.formatSchedule(r)),
      meta: {
        nextCursor: null,
        limit: query.limit ?? 20,
        requestId: randomUUID(),
      },
    };
  }

  async updateSchedule(
    doctorId: string,
    scheduleId: string,
    dto: UpdateScheduleDto,
    actor: Identity,
    version: number,
    requestId?: string,
  ) {
    this.requireClinicOperator(actor);
    const old = await this.prisma.doctorSchedule.findFirst({
      where: { id: scheduleId, doctorId },
    });
    if (!old) this.fail(404, 'DOCTOR_NOT_FOUND');
    if (old.status === ScheduleStatus.CANCELLED)
      this.fail(409, 'INVALID_STATE_TRANSITION');
    if (old.effectiveFrom <= new Date())
      this.fail(422, 'SCHEDULE_ALREADY_STARTED');
    const resolvedRoomId =
      dto.roomId !== undefined || dto.roomCode !== undefined
        ? await this.resolveRoomId(dto.roomId, dto.roomCode)
        : old.roomId;
    const input: AnyRecord = {
      startTime: dto.startTime ?? old.startTime,
      endTime: dto.endTime ?? old.endTime,
      slotDurationMinutes: dto.slotDurationMinutes ?? old.slotDurationMinutes,
      effectiveFrom: dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : old.effectiveFrom,
      effectiveTo: dto.effectiveTo
        ? new Date(dto.effectiveTo)
        : old.effectiveTo,
      departmentId: dto.departmentId ?? old.departmentId,
      roomId: resolvedRoomId ?? null,
      timezone: old.timezone,
      dayOfWeek: old.dayOfWeek,
    };
    this.validateSchedule(input);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockDoctor(tx, doctorId);
      await this.assertNoScheduleOverlap(tx, doctorId, input, scheduleId);
      const updated = await tx.doctorSchedule.updateMany({
        where: { id: scheduleId, version },
        data: { ...input, version: { increment: 1 } },
      });
      if (updated.count !== 1) this.fail(409, 'VERSION_CONFLICT');
      const value = await tx.doctorSchedule.findUnique({
        where: { id: scheduleId },
        include: { room: true },
      });
      await this.auditOutbox(
        tx,
        'doctor.schedule_changed',
        actor.userId,
        doctorId,
        value!.version,
        requestId,
        { scheduleId, roomId: value!.roomId, action: 'UPDATE' },
      );
      return value!;
    });
    return { data: this.formatSchedule(result) };
  }

  async cancelSchedule(
    doctorId: string,
    scheduleId: string,
    actor: Identity,
    version: number,
    dto: ReasonDto,
    requestId?: string,
  ) {
    this.requireClinicOperator(actor);
    if (dto.reason.trim().length < 3) this.fail(400, 'VALIDATION_FAILED');
    const old = await this.prisma.doctorSchedule.findFirst({
      where: { id: scheduleId, doctorId },
      include: { room: true },
    });
    if (!old) this.fail(404, 'DOCTOR_NOT_FOUND');
    if (old.status === ScheduleStatus.CANCELLED)
      return {
        data: {
          id: scheduleId,
          status: ScheduleStatus.CANCELLED,
          version: old.version,
        },
      };
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.doctorSchedule.updateMany({
        where: { id: scheduleId, version },
        data: { status: ScheduleStatus.CANCELLED, version: { increment: 1 } },
      });
      if (updated.count !== 1) this.fail(409, 'VERSION_CONFLICT');
      const value = await tx.doctorSchedule.findUnique({
        where: { id: scheduleId },
        include: { room: true },
      });
      await this.auditOutbox(
        tx,
        'doctor.schedule_changed',
        actor.userId,
        doctorId,
        value!.version,
        requestId,
        { scheduleId, action: 'CANCEL' },
      );
      return value!;
    });
    return { data: this.formatSchedule(result) };
  }

  async createAvailability(
    doctorId: string,
    dto: CreateAvailabilityDto,
    actor: Identity,
    key?: string,
    requestId?: string,
  ) {
    this.requireKey(key);
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) this.notFound();
    if (doctor.status !== DoctorStatus.ACTIVE)
      this.fail(422, 'DOCTOR_NOT_ACTIVE');
    this.requireOwnerOrClinicOperator(actor, doctor.accountId);
    if (
      !this.isClinicOperator(actor) &&
      dto.type !== AvailabilityType.UNAVAILABLE
    )
      this.fail(403, 'FORBIDDEN');
    const startAt = new Date(dto.startAt),
      endAt = new Date(dto.endAt),
      now = new Date();
    if (!(startAt < endAt) || startAt <= now)
      this.fail(422, 'INVALID_TIME_RANGE');
    if (endAt.getTime() - startAt.getTime() > 31 * 86400000)
      this.fail(422, 'TIME_RANGE_TOO_LARGE');
    const resolvedRoomId = await this.resolveRoomId(dto.roomId, dto.roomCode);
    const duplicate = await this.prisma.doctorAvailability.findFirst({
      where: {
        doctorId,
        type: dto.type,
        startAt,
        endAt,
        status: AvailabilityStatus.ACTIVE,
      },
    });
    if (duplicate) this.fail(409, 'AVAILABILITY_DUPLICATE');
    if (
      dto.type === AvailabilityType.EXTRA_AVAILABLE &&
      (await this.prisma.doctorAvailability.findFirst({
        where: {
          doctorId,
          type: AvailabilityType.UNAVAILABLE,
          status: AvailabilityStatus.ACTIVE,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      }))
    )
      this.fail(409, 'AVAILABILITY_CONFLICT');
    const value = await this.prisma.$transaction(async (tx) => {
      const item = await tx.doctorAvailability.create({
        data: {
          doctorId,
          type: dto.type,
          startAt,
          endAt,
          reasonCode: dto.reasonCode,
          note: dto.note?.trim(),
          roomId: resolvedRoomId,
          createdBy: actor.userId,
        },
        include: { room: true },
      });
      await this.auditOutbox(
        tx,
        'doctor.availability_changed',
        actor.userId,
        doctorId,
        doctor.version,
        requestId,
        {
          overrideId: item.id,
          type: item.type,
          roomId: item.roomId,
          startAt,
          endAt,
        },
      );
      return item;
    });
    const formatted = this.formatAvailability(value);
    return {
      data:
        this.isClinicOperator(actor) || actor.userId === value.createdBy
          ? formatted
          : { ...formatted, note: undefined },
    };
  }

  async listAvailability(
    doctorId: string,
    query: AvailabilityQueryDto,
    actor: Identity,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) this.notFound();
    const from = new Date(query.from),
      to = new Date(query.to);
    if (!(from < to)) this.fail(400, 'VALIDATION_FAILED');
    if (to.getTime() - from.getTime() > 31 * 86400000)
      this.fail(400, 'TIME_RANGE_TOO_LARGE');
    const schedules = await this.prisma.doctorSchedule.findMany({
      where: { doctorId, status: ScheduleStatus.ACTIVE },
      include: { room: true },
    });
    const overrides = await this.prisma.doctorAvailability.findMany({
      where: {
        doctorId,
        status: AvailabilityStatus.ACTIVE,
        startAt: { lt: to },
        endAt: { gt: from },
      },
      include: { room: true },
    });
    const defaultRoom = schedules.find((s) => s.room)?.room ?? null;
    const intervals: AnyRecord[] = [];
    for (const date of this.localDates(from, to)) {
      const weekday = this.weekday(date);
      for (const schedule of schedules) {
        if (
          schedule.dayOfWeek === weekday &&
          this.dateInRange(date, schedule.effectiveFrom, schedule.effectiveTo)
        ) {
          const s = this.localToUtc(date, schedule.startTime),
            e = this.localToUtc(date, schedule.endTime);
          const startAt = new Date(Math.max(s.getTime(), from.getTime())),
            endAt = new Date(Math.min(e.getTime(), to.getTime()));
          if (startAt < endAt) {
            const room = schedule.room ?? defaultRoom;
            intervals.push({
              startAt,
              endAt,
              slotDurationMinutes:
                query.slotDurationMinutes ?? schedule.slotDurationMinutes,
              source: 'RECURRING_SCHEDULE',
              roomId: room?.id ?? schedule.roomId ?? null,
              roomCode: room?.code ?? null,
              roomName: room?.name ?? null,
            });
          }
        }
      }
    }
    for (const x of overrides.filter(
      (v) => v.type === AvailabilityType.EXTRA_AVAILABLE,
    )) {
      const startAt = new Date(Math.max(x.startAt.getTime(), from.getTime())),
        endAt = new Date(Math.min(x.endAt.getTime(), to.getTime()));
      if (startAt < endAt) {
        const room = x.room ?? defaultRoom;
        intervals.push({
          startAt,
          endAt,
          slotDurationMinutes: query.slotDurationMinutes ?? 30,
          source: 'EXTRA_AVAILABLE',
          roomId: room?.id ?? x.roomId ?? null,
          roomCode: room?.code ?? null,
          roomName: room?.name ?? null,
        });
      }
    }
    const unavailable = overrides
      .filter((v) => v.type === AvailabilityType.UNAVAILABLE)
      .map((v) => ({ startAt: v.startAt, endAt: v.endAt }));
    const result: AnyRecord[] = [];
    for (const interval of intervals) {
      let pieces = [interval];
      for (const block of unavailable) {
        const next: AnyRecord[] = [];
        for (const piece of pieces) {
          if (block.endAt <= piece.startAt || block.startAt >= piece.endAt)
            next.push(piece);
          else {
            if (piece.startAt < block.startAt)
              next.push({ ...piece, endAt: block.startAt });
            if (block.endAt < piece.endAt)
              next.push({ ...piece, startAt: block.endAt });
          }
        }
        pieces = next;
      }
      result.push(...pieces.filter((p) => p.startAt < p.endAt));
    }
    result.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return {
      data: {
        doctorId,
        timezone: 'Asia/Ho_Chi_Minh',
        intervals: result,
        generatedAt: new Date(),
        bookingOccupancyApplied: false,
      },
    };
  }

  async cancelAvailability(
    doctorId: string,
    overrideId: string,
    actor: Identity,
    version: number,
    dto: ReasonDto,
    requestId?: string,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) this.notFound();
    const old = await this.prisma.doctorAvailability.findFirst({
      where: { id: overrideId, doctorId },
      include: { room: true },
    });
    if (!old) this.fail(404, 'DOCTOR_NOT_FOUND');
    this.requireOwnerOrClinicOperator(actor, doctor.accountId);
    if (!this.isClinicOperator(actor) && actor.userId !== old.createdBy)
      this.fail(403, 'FORBIDDEN');
    if (old.status === AvailabilityStatus.CANCELLED)
      return { data: this.formatAvailability(old) };
    if (old.endAt <= new Date()) this.fail(409, 'AVAILABILITY_ALREADY_ENDED');
    const value = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.doctorAvailability.updateMany({
        where: { id: overrideId, version },
        data: {
          status: AvailabilityStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) this.fail(409, 'VERSION_CONFLICT');
      const item = await tx.doctorAvailability.findUnique({
        where: { id: overrideId },
        include: { room: true },
      });
      await this.auditOutbox(
        tx,
        'doctor.availability_changed',
        actor.userId,
        doctorId,
        doctor.version,
        requestId,
        { overrideId, action: 'CANCEL' },
      );
      return item!;
    });
    return { data: this.formatAvailability(value) };
  }

  async eligibility(
    doctorId: string,
    specialtyId: string,
    startAtText: string,
    endAtText: string,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { specialties: true },
    });
    if (!doctor) this.notFound();
    const startAt = new Date(startAtText),
      endAt = new Date(endAtText);
    const availability = await this.listAvailability(
      doctorId,
      { from: startAtText, to: endAtText },
      { userId: '', role: 'ADMIN' },
    );
    const specialtyMatched = doctor.specialties.some(
      (x) => x.specialtyId === specialtyId,
    );
    const matchedInterval = availability.data.intervals.find(
      (x: AnyRecord) => x.startAt <= startAt && x.endAt >= endAt,
    );
    const within = Boolean(matchedInterval);
    const reasons = [
      ...(doctor.status !== DoctorStatus.ACTIVE ? ['DOCTOR_INACTIVE'] : []),
      ...(!specialtyMatched ? ['SPECIALTY_NOT_MATCHED'] : []),
      ...(!within ? ['OUTSIDE_WORKING_AVAILABILITY'] : []),
    ];
    return {
      data: {
        doctorId,
        eligible: reasons.length === 0,
        doctorStatus: doctor.status,
        specialtyMatched,
        withinWorkingAvailability: within,
        bookingOccupancyChecked: false,
        roomId: matchedInterval?.roomId ?? null,
        roomCode: matchedInterval?.roomCode ?? null,
        roomName: matchedInterval?.roomName ?? null,
        version: doctor.version,
        ...(reasons.length ? { reasons } : {}),
      },
    };
  }

  async getInternalEligibility(doctorId: string, requiredSpecialtyId?: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: PUBLIC_INCLUDE,
    });
    if (!doctor) this.notFound();
    const specialtyIds = doctor.specialties
      .filter((item) => item.specialty.status === SpecialtyStatus.ACTIVE)
      .map((item) => item.specialtyId);
    return {
      doctorId: doctor.id,
      status: 'DOCTOR_OPERATIONAL_STATUS_' + doctor.status,
      displayName: doctor.profile?.fullName ?? '',
      specialtyIds,
      consultationRankCode: doctor.consultationRank,
      profileVersion: String(doctor.version),
      availabilityVersion: String(doctor.version),
      eligible:
        doctor.status === DoctorStatus.ACTIVE &&
        (!requiredSpecialtyId || specialtyIds.includes(requiredSpecialtyId)),
    };
  }

  async listInternalEligibleDoctors(
    specialtyId: string,
    consultationRankCode: string | undefined,
    intervalStart: Date | undefined,
    intervalEnd: Date | undefined,
    limit: number,
  ) {
    const rank = consultationRankCode
      ? (consultationRankCode as any)
      : undefined;
    const doctors = await this.prisma.doctor.findMany({
      where: {
        status: DoctorStatus.ACTIVE,
        ...(rank ? { consultationRank: rank } : {}),
        specialties: {
          some: {
            specialtyId,
            specialty: { status: SpecialtyStatus.ACTIVE },
          },
        },
      },
      include: PUBLIC_INCLUDE,
      orderBy: { id: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    const result: any[] = [];
    for (const doctor of doctors) {
      if (intervalStart && intervalEnd) {
        const availability = await this.getInternalAvailability(
          doctor.id,
          intervalStart,
          intervalEnd,
        );
        const covers = availability.intervals.some(
          (item: any) =>
            item.startAt <= intervalStart && item.endAt >= intervalEnd,
        );
        if (!covers) continue;
      }
      result.push(await this.getInternalEligibility(doctor.id, specialtyId));
    }
    return result;
  }

  async getInternalAvailability(doctorId: string, from: Date, to: Date) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) this.notFound();
    const response = await this.listAvailability(
      doctorId,
      { from: from.toISOString(), to: to.toISOString() },
      { userId: '', role: 'ADMIN' },
    );
    return { intervals: response.data.intervals, version: doctor.version };
  }

  private async verifyAccount(accountId: string) {
    try {
      const client = this.grpc.client({
        key: 'auth',
        target:
          this.config.get<string>('AUTH_GRPC_TARGET') ?? 'auth-service:6003',
        proto: 'auth/v1/auth_internal.proto',
        package: 'maternal.auth.v1',
        service: 'AuthInternalService',
      });
      const context = {
        requestId: randomUUID(),
        correlationId: randomUUID(),
        actorRole: 'ADMIN',
      };
      const response = await this.grpc.unary<any, any>(
        client,
        'getAccountAuthorization',
        { context, accountId },
        this.grpc.metadata('auth-service', ['auth:account:read'], context),
        1500,
      );
      const account = response.account;
      const roles = account?.roles ?? [];
      if (
        account?.status !== 'ACCOUNT_STATUS_ACTIVE' ||
        !roles.includes('DOCTOR')
      )
        this.fail(422, 'ACCOUNT_NOT_DOCTOR');
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.fail(503, 'DEPENDENCY_UNAVAILABLE');
    }
  }

  private async auditOutbox(
    tx: Tx,
    eventType: string,
    actorId: string,
    doctorId: string,
    version: number,
    requestId: string | undefined,
    details: AnyRecord,
  ) {
    await tx.auditRecord.create({
      data: { eventType, actorId, doctorId, requestId, details },
    });
    await tx.outboxEvent.create({
      data: {
        eventType,
        aggregateType: 'Doctor',
        aggregateId: doctorId,
        aggregateVersion: version,
        correlationId: requestId,
        payload: {
          eventId: randomUUID(),
          eventType,
          eventVersion: 1,
          aggregateType: 'Doctor',
          aggregateId: doctorId,
          aggregateVersion: version,
          occurredAt: new Date(),
          correlationId: requestId,
          data: { doctorId, ...details },
        },
      },
    });
  }
  private async lockDoctor(tx: Tx, doctorId: string) {
    await tx.$queryRaw`SELECT id FROM doctors WHERE id = ${doctorId}::uuid FOR UPDATE`;
  }
  private async assertNoScheduleOverlap(
    tx: Tx,
    doctorId: string,
    input: AnyRecord,
    excludeId?: string,
  ) {
    const rows = await tx.doctorSchedule.findMany({
      where: {
        doctorId,
        status: ScheduleStatus.ACTIVE,
        dayOfWeek: input.dayOfWeek ?? undefined,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    for (const row of rows) {
      const datesOverlap =
        (!input.effectiveTo || row.effectiveFrom <= input.effectiveTo) &&
        (!row.effectiveTo || input.effectiveFrom <= row.effectiveTo);
      const timesOverlap =
        input.startTime < row.endTime && row.startTime < input.endTime;
      if (datesOverlap && timesOverlap) this.fail(409, 'SCHEDULE_OVERLAP');
    }
    if (input.roomId) {
      const roomRows = await tx.doctorSchedule.findMany({
        where: {
          roomId: input.roomId,
          status: ScheduleStatus.ACTIVE,
          dayOfWeek: input.dayOfWeek ?? undefined,
          doctorId: { not: doctorId },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      for (const row of roomRows) {
        const datesOverlap =
          (!input.effectiveTo || row.effectiveFrom <= input.effectiveTo) &&
          (!row.effectiveTo || input.effectiveFrom <= row.effectiveTo);
        const timesOverlap =
          input.startTime < row.endTime && row.startTime < input.endTime;
        if (datesOverlap && timesOverlap)
          this.fail(409, 'ROOM_SCHEDULE_CONFLICT');
      }
    }
  }
  private scheduleInput(dto: CreateScheduleDto): AnyRecord {
    return {
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      slotDurationMinutes: dto.slotDurationMinutes ?? 30,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
      departmentId: dto.departmentId,
      roomId: dto.roomId,
    };
  }
  private validateSchedule(v: AnyRecord) {
    if (
      v.timezone !== 'Asia/Ho_Chi_Minh' ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v.startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v.endTime) ||
      v.startTime >= v.endTime
    )
      this.fail(422, 'BUSINESS_RULE_VIOLATION');
    if (
      ![15, 20, 30, 45, 60].includes(v.slotDurationMinutes) ||
      (this.minutes(v.endTime) - this.minutes(v.startTime)) %
        v.slotDurationMinutes !==
        0
    )
      this.fail(422, 'SLOT_DURATION_NOT_DIVISIBLE');
    if (v.effectiveTo && v.effectiveTo < v.effectiveFrom)
      this.fail(422, 'INVALID_DATE_RANGE');
  }
  private validateProfile(p: AnyRecord) {
    if (
      !p.fullName?.trim() ||
      p.fullName.trim().length < 2 ||
      p.fullName.trim().length > 150
    )
      this.fail(400, 'VALIDATION_FAILED');
    if (
      p.languages &&
      new Set(p.languages.map((x: string) => x.trim().toLowerCase())).size !==
        p.languages.length
    )
      this.fail(400, 'VALIDATION_FAILED');
  }
  private profileData(p: AnyRecord) {
    return {
      fullName: p.fullName.trim(),
      professionalTitle: p.professionalTitle?.trim(),
      biography: p.biography?.trim(),
      practiceStartYear: p.practiceStartYear,
      languages: (p.languages ?? []).map((x: string) => x.trim().toLowerCase()),
      photoUrl: p.photoUrl,
    };
  }
  private profilePatch(p: AnyRecord) {
    const x: AnyRecord = {};
    for (const k of [
      'fullName',
      'professionalTitle',
      'biography',
      'practiceStartYear',
      'photoUrl',
    ])
      if (p[k] !== undefined)
        x[k] = typeof p[k] === 'string' ? p[k].trim() : p[k];
    if (p.languages !== undefined)
      x.languages = p.languages.map((v: string) => v.trim().toLowerCase());
    return x;
  }
  private normalizeLicense(value: string) {
    return value.trim().toUpperCase();
  }
  private minutes(value: string) {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  }
  private dateInRange(date: Date, from: Date, to: Date | null) {
    const d = date.toISOString().slice(0, 10);
    return (
      d >= from.toISOString().slice(0, 10) &&
      (!to || d <= to.toISOString().slice(0, 10))
    );
  }
  private localDates(from: Date, to: Date) {
    const result: Date[] = [];
    const d = new Date(from.getTime() + 7 * 3600000);
    d.setUTCHours(0, 0, 0, 0);
    const end = new Date(to.getTime() + 7 * 3600000);
    end.setUTCHours(0, 0, 0, 0);
    for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) result.push(new Date(d));
    return result;
  }
  private weekday(date: Date) {
    const day = date.getUTCDay();
    return day === 0 ? 7 : day;
  }
  private localToUtc(date: Date, time: string) {
    const [h, m, s = 0] = time.split(':').map(Number);
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        h - 7,
        m,
        s,
      ),
    );
  }
  private formatRoom(r?: AnyRecord | null) {
    if (!r) return null;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      status: r.status,
    };
  }
  private formatSchedule(s: AnyRecord) {
    if (!s) return s;
    return {
      ...s,
      roomId: s.roomId ?? null,
      roomCode: s.room?.code ?? null,
      roomName: s.room?.name ?? null,
      room: this.formatRoom(s.room),
    };
  }
  private formatAvailability(a: AnyRecord) {
    if (!a) return a;
    return {
      ...a,
      roomId: a.roomId ?? null,
      roomCode: a.room?.code ?? null,
      roomName: a.room?.name ?? null,
      room: this.formatRoom(a.room),
    };
  }
  private publicView(x: AnyRecord) {
    const primaryRoom =
      x.schedules?.find(
        (s: AnyRecord) => s.status === ScheduleStatus.ACTIVE && s.room,
      )?.room ?? null;
    return {
      id: x.id,
      status: x.status,
      consultationRank: x.consultationRank,
      roomId: primaryRoom?.id ?? null,
      roomCode: primaryRoom?.code ?? null,
      roomName: primaryRoom?.name ?? null,
      room: this.formatRoom(primaryRoom),
      profile: x.profile,
      specialties:
        x.specialties
          ?.filter(
            (s: AnyRecord) => s.specialty.status === SpecialtyStatus.ACTIVE,
          )
          .map((s: AnyRecord) => ({
            id: s.specialty.id,
            code: s.specialty.code,
            name: s.specialty.name,
            isPrimary: s.isPrimary,
          })) ?? [],
    };
  }
  private adminView(x: AnyRecord) {
    return {
      ...this.publicView(x),
      accountId: x.accountId,
      licenseNumber: x.licenseNumber,
      version: x.version,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      ...(x.schedules
        ? { schedules: x.schedules.map((s: AnyRecord) => this.formatSchedule(s)) }
        : {}),
      ...(x.availabilities
        ? {
            availabilities: x.availabilities.map((a: AnyRecord) =>
              this.formatAvailability(a),
            ),
          }
        : {}),
    };
  }
  private managerView(x: AnyRecord) {
    return {
      ...this.publicView(x),
      version: x.version,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      ...(x.schedules
        ? { schedules: x.schedules.map((s: AnyRecord) => this.formatSchedule(s)) }
        : {}),
      ...(x.availabilities
        ? {
            availabilities: x.availabilities.map((a: AnyRecord) =>
              this.formatAvailability(a),
            ),
          }
        : {}),
    };
  }
  private isClinicOperator(actor?: Identity): boolean {
    return actor?.role === 'ADMIN' || actor?.role === 'CLINIC_MANAGER';
  }
  private requireClinicOperator(actor: Identity) {
    if (!this.isClinicOperator(actor)) this.fail(403, 'FORBIDDEN');
  }
  private requireAdmin(actor: Identity) {
    if (actor.role !== 'ADMIN') this.fail(403, 'FORBIDDEN');
  }
  private requireOwnerOrClinicOperator(actor: Identity, accountId: string) {
    if (!this.isClinicOperator(actor) && actor.userId !== accountId)
      this.fail(403, 'FORBIDDEN');
  }
  private requireKey(key?: string) {
    if (!key || key.length > 128) this.fail(400, 'VALIDATION_FAILED');
  }
  private notFound(): never {
    this.fail(404, 'DOCTOR_NOT_FOUND');
  }
  private fail(status: number, code: string): never {
    throw new HttpException(code, status);
  }
}
