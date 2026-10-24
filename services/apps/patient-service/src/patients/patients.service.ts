import { createHash } from 'crypto';
import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Patient } from '@prisma/patient-client';
import type { PatientAuthContext } from '../auth/auth-context';
import { DomainException } from '../common/domain.exception';
import {
  cleanOptional,
  normalizeFullName,
  normalizeNationalId,
  normalizePhone,
  normalizeReason,
  normalizeRelationship,
  normalizeSearchName,
  parseBusinessDate,
} from '../common/normalization';
import { PatientDatabaseService } from '../database/patient-database.service';
import { NationalIdCryptoService } from '../security/national-id-crypto.service';
import {
  CreateContactDto,
  ReorderContactsDto,
  UpdateContactDto,
} from './dto/contact.dto';
import {
  CreatePatientDto,
  PatchPatientDto,
  SearchPatientsDto,
} from './dto/staff-patient.dto';
import { UpsertMyPatientDto } from './dto/upsert-my-patient.dto';
import {
  presentContact,
  presentPatient,
  presentSearchPatient,
} from './patient-presenter';

type NormalizedPatient = {
  fullName: string;
  normalizedFullName: string;
  dateOfBirth: Date;
  phoneNumber: string;
  nationalIdCiphertext: string | null;
  nationalIdLookupHash: string | null;
  address: string | null;
};

@Injectable()
export class PatientsService {
  constructor(
    private readonly db: PatientDatabaseService,
    private readonly crypto: NationalIdCryptoService,
    private readonly config: ConfigService,
  ) {}

  async upsertMe(
    dto: UpsertMyPatientDto,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.patientOnly(auth);
    const data = this.normalize(dto);
    const current = await this.db.patient.findUnique({
      where: { authAccountId: auth.userId },
      include: { emergencyContacts: true },
    });
    if (!current) return this.createOwn(data, auth, requestId);
    if (this.same(current, data)) {
      return { created: false, data: presentPatient(current, this.crypto) };
    }
    if (dto.version === undefined) {
      throw new DomainException(
        'VERSION_REQUIRED',
        'version is required when changing an existing profile',
        HttpStatus.CONFLICT,
      );
    }
    try {
      const patient = await this.db.$transaction(async (transaction) => {
        const changed = await transaction.patient.updateMany({
          where: { id: current.id, version: dto.version },
          data: {
            ...data,
            version: { increment: 1 },
            updatedByAccountId: auth.userId,
          },
        });
        if (changed.count !== 1) {
          throw new DomainException(
            'CONCURRENT_UPDATE',
            'Patient profile was updated by another request',
            HttpStatus.CONFLICT,
          );
        }
        await transaction.patientAuditLog.create({
          data: {
            eventType: 'patient.updated',
            actorId: auth.userId,
            actorRole: auth.role,
            patientId: current.id,
            changedFields: this.changed(current, data),
            requestId,
          },
        });
        return transaction.patient.findUniqueOrThrow({
          where: { id: current.id },
          include: { emergencyContacts: true },
        });
      });
      return { created: false, data: presentPatient(patient, this.crypto) };
    } catch (error) {
      this.mapUnique(error);
      throw error;
    }
  }

  async getMe(auth: PatientAuthContext) {
    this.patientOnly(auth);
    const patient = await this.db.patient.findUnique({
      where: { authAccountId: auth.userId },
      include: {
        emergencyContacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!patient) {
      throw new DomainException(
        'PATIENT_PROFILE_NOT_FOUND',
        'Patient profile was not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return presentPatient(patient, this.crypto);
  }

  async getPatientByAuthAccountId(authAccountId: string) {
    return this.db.patient.findUnique({
      where: { authAccountId },
    });
  }

  async getById(
    patientId: string,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.receptionistOnly(auth);
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    const patient = await this.db.$transaction(async (transaction) => {
      const found = await transaction.patient.findUnique({
        where: { id: patientId },
        include: {
          emergencyContacts: {
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      if (!found) this.notFound();
      await transaction.patientAuditLog.create({
        data: {
          eventType: 'patient.viewed',
          actorId: auth.userId,
          actorRole: auth.role,
          patientId,
          requestId,
          metadata: { purpose: 'CHECK_IN' },
        },
      });
      return found;
    });
    const accountInfo = patient.authAccountId ? await this.getAccountInfo(patient.authAccountId) : null;
    return presentPatient(patient, this.crypto, accountInfo?.email, accountInfo?.status);
  }

  async search(
    dto: SearchPatientsDto,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.receptionistOnly(auth);
    if (!dto.phoneNumber && !dto.nationalId && !dto.fullName && !dto.query?.trim()) {
      if (auth.role !== 'ADMIN' && auth.role !== 'RECEPTIONIST') {
        throw new DomainException(
          'SEARCH_FILTER_REQUIRED',
          'At least one search filter is required',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filters: Prisma.PatientWhereInput[] = [];
    if (dto.query?.trim()) {
      const q = dto.query.trim();
      const orConditions: Prisma.PatientWhereInput[] = [];
      const normName = normalizeSearchName(q);
      if (normName) {
        orConditions.push({
          normalizedFullName: {
            contains: normName,
            mode: 'insensitive',
          },
        });
      }
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 3) {
        orConditions.push({
          phoneNumber: {
            contains: digits,
          },
        });
      }
      if (digits.length >= 8) {
        try {
          const normNid = normalizeNationalId(digits);
          orConditions.push({
            nationalIdLookupHash: this.crypto.lookupHash(normNid),
          });
        } catch {
          // ignore invalid nid formatting
        }
      }
      if (orConditions.length > 0) {
        filters.push({ OR: orConditions });
      }
    }
    if (dto.phoneNumber)
      filters.push({ phoneNumber: normalizePhone(dto.phoneNumber) });
    if (dto.nationalId) {
      const normalized = normalizeNationalId(dto.nationalId);
      filters.push({
        nationalIdLookupHash: this.crypto.lookupHash(normalized),
      });
    }
    if (dto.fullName) {
      filters.push({
        normalizedFullName: {
          contains: normalizeSearchName(dto.fullName),
          mode: 'insensitive',
        },
      });
    }
    const where: Prisma.PatientWhereInput = filters.length > 0 ? { AND: filters } : {};
    const result = await this.db.$transaction(async (transaction) => {
      const [patients, total] = await Promise.all([
        transaction.patient.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        transaction.patient.count({ where }),
      ]);
      await transaction.patientAuditLog.create({
        data: {
          eventType: 'patient.searched',
          actorId: auth.userId,
          actorRole: auth.role,
          patientId: patients[0]?.id,
          requestId,
          metadata: {
            searchType: [
              ...(dto.phoneNumber ? ['PHONE'] : []),
              ...(dto.nationalId ? ['NATIONAL_ID'] : []),
              ...(dto.fullName ? ['FULL_NAME'] : []),
            ],
            resultCount: total,
          },
        },
      });
      return { patients, total };
    });
    const accountIds = result.patients
      .map((p) => p.authAccountId)
      .filter((id): id is string => Boolean(id));
    const accountMap = await this.batchLookupAccounts(accountIds);

    return {
      items: result.patients.map((patient) => {
        const acc = patient.authAccountId ? accountMap[patient.authAccountId] : undefined;
        return presentSearchPatient(
          patient,
          this.crypto,
          acc?.email ?? null,
          acc?.status ?? (patient.authAccountId ? 'ACTIVE' : 'DRAFT'),
        );
      }),
      page,
      limit,
      total: result.total,
    };
  }

  async createByReceptionist(
    dto: CreatePatientDto,
    idempotencyKey: string | undefined,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.receptionistOnly(auth);
    if (!idempotencyKey) {
      throw new DomainException(
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key header is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    this.uuid(idempotencyKey, 'INVALID_IDEMPOTENCY_KEY');
    const data = this.normalize(dto);
    const reason = normalizeReason(dto.reason || 'Tạo hồ sơ bệnh nhân');
    const requestHash = this.requestHash(data, reason);

    let authAccountId: string | null = null;
    if (dto.email?.trim()) {
      const email = dto.email.trim();
      const password = dto.phoneNumber.trim();
      const account = await this.createAuthAccount(email, password, 'PATIENT');
      authAccountId = account.userId;
    }

    try {
      const result = await this.db.$transaction(
        async (transaction) => {
          const existing = await transaction.idempotencyRecord.findUnique({
            where: {
              actorId_operation_idempotencyKey: {
                actorId: auth.userId,
                operation: 'patient.create',
                idempotencyKey,
              },
            },
          });
          if (existing) {
            if (existing.requestHash !== requestHash)
              this.idempotencyConflict();
            if (!existing.patientId) this.idempotencyInProgress();
            return {
              created: false,
              patient: await transaction.patient.findUniqueOrThrow({
                where: { id: existing.patientId },
                include: { emergencyContacts: true },
              }),
            };
          }
          await transaction.idempotencyRecord.create({
            data: {
              actorId: auth.userId,
              operation: 'patient.create',
              idempotencyKey,
              requestHash,
              status: 'IN_PROGRESS',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
          const created = await transaction.patient.create({
            data: {
              ...data,
              authAccountId,
              createdByAccountId: auth.userId,
              updatedByAccountId: auth.userId,
            },
          });
          await transaction.patientAuditLog.create({
            data: {
              eventType: 'patient.created',
              actorId: auth.userId,
              actorRole: auth.role,
              patientId: created.id,
              requestId,
              metadata: { reason },
            },
          });
          await transaction.idempotencyRecord.update({
            where: {
              actorId_operation_idempotencyKey: {
                actorId: auth.userId,
                operation: 'patient.create',
                idempotencyKey,
              },
            },
            data: { patientId: created.id, status: 'COMPLETED' },
          });
          return {
            created: true,
            patient: await transaction.patient.findUniqueOrThrow({
              where: { id: created.id },
              include: { emergencyContacts: true },
            }),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return {
        created: result.created,
        data: presentPatient(result.patient, this.crypto),
      };
    } catch (error) {
      if (this.unique(error, 'idempotency_records_actor_operation_key')) {
        const existing = await this.db.idempotencyRecord.findUnique({
          where: {
            actorId_operation_idempotencyKey: {
              actorId: auth.userId,
              operation: 'patient.create',
              idempotencyKey,
            },
          },
        });
        if (!existing || existing.requestHash !== requestHash)
          this.idempotencyConflict();
        if (!existing.patientId) this.idempotencyInProgress();
        const patient = await this.db.patient.findUniqueOrThrow({
          where: { id: existing.patientId },
          include: { emergencyContacts: true },
        });
        return { created: false, data: presentPatient(patient, this.crypto) };
      }
      this.mapUnique(error);
      throw error;
    }
  }

  async patchByReceptionist(
    patientId: string,
    dto: PatchPatientDto,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.receptionistOnly(auth);
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    const fields = [
      'fullName',
      'dateOfBirth',
      'phoneNumber',
      'nationalId',
      'address',
    ] as const;
    if (!fields.some((field) => dto[field] !== undefined)) {
      throw new DomainException(
        'VALIDATION_FAILED',
        'At least one mutable field is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const reason = normalizeReason(dto.reason || 'Cập nhật hồ sơ bệnh nhân');
    const current = await this.db.patient.findUnique({
      where: { id: patientId },
    });
    if (!current) this.notFound();
    const data = this.applyPatch(current, dto);
    if (this.same(current, data)) {
      const patient = await this.db.patient.findUniqueOrThrow({
        where: { id: patientId },
        include: { emergencyContacts: true },
      });
      return presentPatient(patient, this.crypto);
    }
    try {
      const patient = await this.db.$transaction(async (transaction) => {
        const result = await transaction.patient.updateMany({
          where: { id: patientId, version: dto.version ?? current.version },
          data: {
            ...data,
            version: { increment: 1 },
            updatedByAccountId: auth.userId,
          },
        });
        if (result.count !== 1) {
          throw new DomainException(
            'CONCURRENT_UPDATE',
            'Patient profile was updated by another request',
            HttpStatus.CONFLICT,
          );
        }
        await transaction.patientAuditLog.create({
          data: {
            eventType: 'patient.updated',
            actorId: auth.userId,
            actorRole: auth.role,
            patientId,
            requestId,
            changedFields: this.changed(current, data),
            metadata: { reason },
          },
        });
        return transaction.patient.findUniqueOrThrow({
          where: { id: patientId },
          include: { emergencyContacts: true },
        });
      });
      return presentPatient(patient, this.crypto);
    } catch (error) {
      this.mapUnique(error);
      throw error;
    }
  }

  async getEligibility(patientId: string, actorAccountId?: string) {
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    const patient = await this.db.patient.findUnique({
      where: { id: patientId },
      select: { id: true, authAccountId: true, version: true },
    });
    return {
      patientId,
      exists: Boolean(patient),
      active: Boolean(patient),
      profileComplete: Boolean(patient),
      profileStatus: patient ? ('COMPLETE' as const) : null,
      eligibleForBooking: Boolean(patient),
      missingFields: [],
      profileVersion: patient?.version ?? 0,
      callerOwnsPatient: Boolean(
        actorAccountId && patient?.authAccountId === actorAccountId,
      ),
    };
  }

  async getInternalIdentity(patientId: string, _purpose: string) {
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    const patient = await this.db.patient.findUnique({
      where: { id: patientId },
      select: { id: true, fullName: true, dateOfBirth: true, phoneNumber: true, nationalIdCiphertext: true, version: true },
    });
    if (!patient) this.notFound();
    const maskedId = this.crypto.maskCiphertext(patient.nationalIdCiphertext);
    return {
      patientId: patient.id,
      fullName: patient.fullName,
      dateOfBirth: { seconds: Math.floor(patient.dateOfBirth.getTime() / 1000).toString(), nanos: 0 },
      maskedPhone: '*'.repeat(Math.max(0, patient.phoneNumber.length - 4)) + patient.phoneNumber.slice(-4),
      nationalIdLast4: maskedId?.slice(-4) ?? '',
      active: true,
      profileVersion: patient.version,
    };
  }

  async searchInternal(phone?: string, pageSize = 20, pageToken?: string) {
    const take = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
    const rows = await this.db.patient.findMany({
      where: phone ? { phoneNumber: normalizePhone(phone) } : {},
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(pageToken ? { cursor: { id: pageToken }, skip: 1 } : {}),
      select: { id: true, fullName: true, dateOfBirth: true, phoneNumber: true, nationalIdCiphertext: true, version: true },
    });
    const hasNext = rows.length > take;
    const items = rows.slice(0, take);
    return {
      patients: items.map((patient) => {
        const maskedId = this.crypto.maskCiphertext(patient.nationalIdCiphertext);
        return {
          patientId: patient.id,
          fullName: patient.fullName,
          dateOfBirth: { seconds: Math.floor(patient.dateOfBirth.getTime() / 1000).toString(), nanos: 0 },
          maskedPhone: '*'.repeat(Math.max(0, patient.phoneNumber.length - 4)) + patient.phoneNumber.slice(-4),
          nationalIdLast4: maskedId?.slice(-4) ?? '',
          active: true,
          profileVersion: patient.version,
        };
      }),
      page: { nextPageToken: hasNext ? items[items.length - 1]?.id ?? '' : '', totalSize: '0' },
    };
  }

  async addContact(
    patientId: string,
    dto: CreateContactDto,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM patients WHERE id = ${patientId}::uuid FOR UPDATE`;
      await this.authorizePatient(transaction, patientId, auth);
      const existing = await transaction.emergencyContact.findMany({
        where: { patientId },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      if (existing.length >= 3) {
        throw new DomainException(
          'EMERGENCY_CONTACT_LIMIT_REACHED',
          'A patient can have at most three emergency contacts',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const shouldBeFirst = existing.length === 0 || dto.isPrimary === true;
      const contact = await transaction.emergencyContact.create({
        data: {
          patientId,
          fullName: normalizeFullName(dto.fullName),
          relationship: normalizeRelationship(dto.relationship),
          phoneNumber: normalizePhone(dto.phoneNumber),
          isPrimary: false,
          priority: shouldBeFirst ? 1 : existing.length + 1,
        },
      });
      const orderedIds = shouldBeFirst
        ? [contact.id, ...existing.map((item) => item.id)]
        : [...existing.map((item) => item.id), contact.id];
      await this.applyContactOrder(transaction, patientId, orderedIds);
      await this.auditContact(
        transaction,
        auth,
        patientId,
        contact.id,
        'CREATE',
        requestId,
      );
      return presentContact(
        await transaction.emergencyContact.findUniqueOrThrow({
          where: { id: contact.id },
        }),
      );
    });
  }

  async reorderContacts(
    patientId: string,
    dto: ReorderContactsDto,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM patients WHERE id = ${patientId}::uuid FOR UPDATE`;
      await this.authorizePatient(transaction, patientId, auth);
      const existing = await transaction.emergencyContact.findMany({
        where: { patientId },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const expectedIds = new Set(existing.map((contact) => contact.id));
      const submittedIds = new Set(dto.contactIds);
      if (
        dto.contactIds.length === 0 ||
        submittedIds.size !== dto.contactIds.length ||
        submittedIds.size !== expectedIds.size ||
        dto.contactIds.some((id) => !expectedIds.has(id))
      ) {
        throw new DomainException(
          'CONTACT_ORDER_INVALID',
          'contactIds must contain every emergency contact exactly once',
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.applyContactOrder(transaction, patientId, dto.contactIds);
      await this.auditContact(
        transaction,
        auth,
        patientId,
        dto.contactIds[0],
        'REORDER',
        requestId,
      );
      return (
        await transaction.emergencyContact.findMany({
          where: { patientId },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        })
      ).map(presentContact);
    });
  }

  async updateContact(
    patientId: string,
    contactId: string,
    dto: UpdateContactDto,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    this.uuid(contactId, 'INVALID_CONTACT_ID');
    if (!Object.keys(dto).length) {
      throw new DomainException(
        'VALIDATION_FAILED',
        'At least one contact field is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM patients WHERE id = ${patientId}::uuid FOR UPDATE`;
      await this.authorizePatient(transaction, patientId, auth);
      const old = await transaction.emergencyContact.findFirst({
        where: { id: contactId, patientId },
      });
      if (!old) this.contactNotFound();
      await transaction.emergencyContact.update({
        where: { id: contactId },
        data: {
          ...(dto.fullName !== undefined && {
            fullName: normalizeFullName(dto.fullName),
          }),
          ...(dto.relationship !== undefined && {
            relationship: normalizeRelationship(dto.relationship),
          }),
          ...(dto.phoneNumber !== undefined && {
            phoneNumber: normalizePhone(dto.phoneNumber),
          }),
        },
      });
      if (dto.isPrimary === true && !old.isPrimary) {
        const contacts = await transaction.emergencyContact.findMany({
          where: { patientId },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        });
        await this.applyContactOrder(transaction, patientId, [
          contactId,
          ...contacts
            .filter((item) => item.id !== contactId)
            .map((item) => item.id),
        ]);
      }
      const contact = await transaction.emergencyContact.findUniqueOrThrow({
        where: { id: contactId },
      });
      const changed =
        old.fullName !== contact.fullName ||
        old.relationship !== contact.relationship ||
        old.phoneNumber !== contact.phoneNumber ||
        old.isPrimary !== contact.isPrimary ||
        old.priority !== contact.priority;
      if (changed)
        await this.auditContact(
          transaction,
          auth,
          patientId,
          contactId,
          'UPDATE',
          requestId,
        );
      return presentContact(contact);
    });
  }

  async deleteContact(
    patientId: string,
    contactId: string,
    auth: PatientAuthContext,
    requestId: string,
  ): Promise<void> {
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    this.uuid(contactId, 'INVALID_CONTACT_ID');
    await this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM patients WHERE id = ${patientId}::uuid FOR UPDATE`;
      await this.authorizePatient(transaction, patientId, auth);
      const contact = await transaction.emergencyContact.findUnique({
        where: { id: contactId },
        select: { patientId: true },
      });
      if (contact && contact.patientId !== patientId) this.contactNotFound();
      const deleted = await transaction.emergencyContact.deleteMany({
        where: { id: contactId, patientId },
      });
      if (deleted.count) {
        const remaining = await transaction.emergencyContact.findMany({
          where: { patientId },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        });
        await this.applyContactOrder(
          transaction,
          patientId,
          remaining.map((item) => item.id),
        );
        await this.auditContact(
          transaction,
          auth,
          patientId,
          contactId,
          'DELETE',
          requestId,
        );
      }
    });
  }

  private async createOwn(
    data: NormalizedPatient,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    try {
      const patient = await this.db.$transaction(async (transaction) => {
        const created = await transaction.patient.create({
          data: {
            ...data,
            authAccountId: auth.userId,
            createdByAccountId: auth.userId,
            updatedByAccountId: auth.userId,
          },
        });
        await transaction.patientAuditLog.create({
          data: {
            eventType: 'patient.created',
            actorId: auth.userId,
            actorRole: auth.role,
            patientId: created.id,
            requestId,
          },
        });
        return transaction.patient.findUniqueOrThrow({
          where: { id: created.id },
          include: { emergencyContacts: true },
        });
      });
      return { created: true, data: presentPatient(patient, this.crypto) };
    } catch (error) {
      if (this.unique(error, 'auth_account')) {
        const patient = await this.db.patient.findUniqueOrThrow({
          where: { authAccountId: auth.userId },
          include: { emergencyContacts: true },
        });
        if (this.same(patient, data)) {
          return { created: false, data: presentPatient(patient, this.crypto) };
        }
        throw new DomainException(
          'CONCURRENT_CREATE_CONFLICT',
          'Concurrent profile creation used different data',
          HttpStatus.CONFLICT,
        );
      }
      this.mapUnique(error);
      throw error;
    }
  }

  private normalize(
    dto: Pick<
      CreatePatientDto,
      'fullName' | 'dateOfBirth' | 'phoneNumber' | 'nationalId' | 'address'
    >,
  ): NormalizedPatient {
    const nationalId =
      dto.nationalId == null ? null : normalizeNationalId(dto.nationalId);
    return {
      fullName: normalizeFullName(dto.fullName),
      normalizedFullName: normalizeSearchName(dto.fullName),
      dateOfBirth: parseBusinessDate(dto.dateOfBirth),
      phoneNumber: normalizePhone(dto.phoneNumber),
      nationalIdCiphertext: nationalId ? this.crypto.encrypt(nationalId) : null,
      nationalIdLookupHash: nationalId
        ? this.crypto.lookupHash(nationalId)
        : null,
      address: cleanOptional(dto.address),
    };
  }

  private applyPatch(
    patient: Patient,
    dto: PatchPatientDto,
  ): NormalizedPatient {
    let nationalIdCiphertext = patient.nationalIdCiphertext;
    let nationalIdLookupHash = patient.nationalIdLookupHash;
    if (dto.nationalId !== undefined) {
      if (dto.nationalId === null) {
        nationalIdCiphertext = null;
        nationalIdLookupHash = null;
      } else {
        const nationalId = normalizeNationalId(dto.nationalId);
        nationalIdCiphertext = this.crypto.encrypt(nationalId);
        nationalIdLookupHash = this.crypto.lookupHash(nationalId);
      }
    }
    const fullName =
      dto.fullName === undefined
        ? patient.fullName
        : normalizeFullName(dto.fullName);
    return {
      fullName,
      normalizedFullName: normalizeSearchName(fullName),
      dateOfBirth:
        dto.dateOfBirth === undefined
          ? patient.dateOfBirth
          : parseBusinessDate(dto.dateOfBirth),
      phoneNumber:
        dto.phoneNumber === undefined
          ? patient.phoneNumber
          : normalizePhone(dto.phoneNumber),
      nationalIdCiphertext,
      nationalIdLookupHash,
      address:
        dto.address === undefined
          ? patient.address
          : cleanOptional(dto.address),
    };
  }

  private same(patient: Patient, data: NormalizedPatient): boolean {
    return (
      patient.fullName === data.fullName &&
      patient.dateOfBirth.toISOString().slice(0, 10) ===
        data.dateOfBirth.toISOString().slice(0, 10) &&
      patient.phoneNumber === data.phoneNumber &&
      patient.nationalIdLookupHash === data.nationalIdLookupHash &&
      patient.address === data.address
    );
  }

  private changed(patient: Patient, data: NormalizedPatient): string[] {
    return [
      'fullName',
      'dateOfBirth',
      'phoneNumber',
      'nationalId',
      'address',
    ].filter((field) => {
      if (field === 'nationalId')
        return patient.nationalIdLookupHash !== data.nationalIdLookupHash;
      if (field === 'dateOfBirth')
        return (
          patient.dateOfBirth.toISOString().slice(0, 10) !==
          data.dateOfBirth.toISOString().slice(0, 10)
        );
      if (field === 'fullName') return patient.fullName !== data.fullName;
      if (field === 'phoneNumber')
        return patient.phoneNumber !== data.phoneNumber;
      return patient.address !== data.address;
    });
  }

  private requestHash(data: NormalizedPatient, reason: string): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          fullName: data.fullName,
          dateOfBirth: data.dateOfBirth.toISOString().slice(0, 10),
          phoneNumber: data.phoneNumber,
          nationalIdLookupHash: data.nationalIdLookupHash,
          address: data.address,
          reason: normalizeFullName(reason),
        }),
      )
      .digest('hex');
  }

  private async applyContactOrder(
    transaction: Prisma.TransactionClient,
    patientId: string,
    contactIds: string[],
  ): Promise<void> {
    await transaction.emergencyContact.updateMany({
      where: { patientId, isPrimary: true },
      data: { isPrimary: false },
    });
    for (const [index, id] of contactIds.entries()) {
      await transaction.emergencyContact.update({
        where: { id },
        data: { priority: index + 1, isPrimary: index === 0 },
      });
    }
  }

  private async authorizePatient(
    transaction: Prisma.TransactionClient,
    patientId: string,
    auth: PatientAuthContext,
  ): Promise<void> {
    const patient = await transaction.patient.findUnique({
      where: { id: patientId },
      select: { authAccountId: true },
    });
    if (!patient) this.notFound();
    if (auth.role === 'RECEPTIONIST' || auth.role === 'ADMIN') return;
    if (auth.role !== 'PATIENT' || patient.authAccountId !== auth.userId) {
      throw new ForbiddenException();
    }
  }

  private async auditContact(
    transaction: Prisma.TransactionClient,
    auth: PatientAuthContext,
    patientId: string,
    contactId: string,
    action: string,
    requestId: string,
  ): Promise<void> {
    await transaction.patientAuditLog.create({
      data: {
        eventType: 'emergency_contact.changed',
        actorId: auth.userId,
        actorRole: auth.role,
        patientId,
        requestId,
        metadata: { contactId, action },
      },
    });
  }

  private patientOnly(auth: PatientAuthContext): void {
    if (auth.role !== 'PATIENT')
      throw new ForbiddenException('Patient role is required');
  }

  private receptionistOnly(auth: PatientAuthContext): void {
    if (auth.role !== 'RECEPTIONIST' && auth.role !== 'ADMIN')
      throw new ForbiddenException('Receptionist or admin role is required');
  }

  private notFound(): never {
    throw new DomainException(
      'PATIENT_NOT_FOUND',
      'Patient was not found',
      HttpStatus.NOT_FOUND,
    );
  }

  private contactNotFound(): never {
    throw new DomainException(
      'CONTACT_NOT_FOUND',
      'Emergency contact was not found',
      HttpStatus.NOT_FOUND,
    );
  }

  private idempotencyConflict(): never {
    throw new DomainException(
      'IDEMPOTENCY_KEY_REUSED',
      'Idempotency key was already used with a different request',
      HttpStatus.CONFLICT,
    );
  }

  private idempotencyInProgress(): never {
    throw new DomainException(
      'IDEMPOTENCY_REQUEST_IN_PROGRESS',
      'Idempotent request is still in progress',
      HttpStatus.CONFLICT,
    );
  }

  private uuid(value: string, code: string): void {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      throw new DomainException(
        code,
        'Resource identifier is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private unique(error: unknown, target: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      JSON.stringify(error.meta?.target ?? '').includes(target)
    );
  }

  private mapUnique(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DomainException(
        'PATIENT_IDENTITY_CONFLICT',
        'nationalId already belongs to another patient',
        HttpStatus.CONFLICT,
      );
    }
  }

  async deletePatient(
    patientId: string,
    auth: PatientAuthContext,
    requestId: string,
  ): Promise<void> {
    this.receptionistOnly(auth);
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    const patient = await this.db.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) this.notFound();

    await this.db.$transaction(async (transaction) => {
      await transaction.idempotencyRecord.deleteMany({
        where: { patientId },
      });
      await transaction.patientAuditLog.deleteMany({
        where: { patientId },
      });
      await transaction.emergencyContact.deleteMany({
        where: { patientId },
      });
      await transaction.patient.delete({
        where: { id: patientId },
      });
      await transaction.patientAuditLog.create({
        data: {
          eventType: 'patient.deleted',
          actorId: auth.userId,
          actorRole: auth.role,
          patientId: null,
          requestId,
          metadata: {
            deletedPatientId: patient.id,
            fullName: patient.fullName,
            authAccountId: patient.authAccountId,
          },
        },
      });
    });

    if (patient.authAccountId) {
      try {
        await this.deleteAuthAccount(patient.authAccountId);
      } catch (err) {
        console.warn(`Failed to delete auth account ${patient.authAccountId}:`, err);
      }
    }
  }

  private async getAccountInfo(
    accountId: string,
  ): Promise<{ email: string | null; status: string | null } | null> {
    const configuredUrl =
      this.config.get<string>('AUTH_ACCOUNT_LOOKUP_URL') ??
      'http://auth-service:5003/internal/accounts';
    const secret =
      this.config.get<string>('INTERNAL_SERVICE_AUTH_SECRET') ??
      'local-dev-internal-secret';

    const urlsToTry = [
      configuredUrl.replace('localhost:5003', 'auth-service:5003').replace('127.0.0.1:5003', 'auth-service:5003'),
      'http://auth-service:5003/internal/accounts',
      configuredUrl,
    ];

    for (const baseUrl of urlsToTry) {
      try {
        const res = await fetch(`${baseUrl}/${accountId}`, {
          method: 'GET',
          headers: { 'x-internal-service-secret': secret },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = (await res.json()) as { email?: string; status?: string };
          return {
            email: data.email ?? null,
            status: data.status ?? null,
          };
        }
      } catch {
        // try next
      }
    }
    return null;
  }

  private async batchLookupAccounts(
    accountIds: string[],
  ): Promise<Record<string, { email: string; role: string; status: string }>> {
    if (accountIds.length === 0) return {};
    const configuredUrl =
      this.config.get<string>('AUTH_ACCOUNT_LOOKUP_URL') ??
      'http://auth-service:5003/internal/accounts';
    const secret =
      this.config.get<string>('INTERNAL_SERVICE_AUTH_SECRET') ??
      'local-dev-internal-secret';

    const urlsToTry = [
      configuredUrl.replace('localhost:5003', 'auth-service:5003').replace('127.0.0.1:5003', 'auth-service:5003'),
      'http://auth-service:5003/internal/accounts',
      configuredUrl,
    ];

    for (const baseUrl of urlsToTry) {
      try {
        const res = await fetch(`${baseUrl}/batch-lookup`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-service-secret': secret,
          },
          body: JSON.stringify({ accountIds }),
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          return (await res.json()) as Record<string, { email: string; role: string; status: string }>;
        }
      } catch {
        // try next
      }
    }
    return {};
  }

  private async deleteAuthAccount(accountId: string): Promise<void> {
    const configuredUrl =
      this.config.get<string>('AUTH_ACCOUNT_LOOKUP_URL') ??
      'http://auth-service:5003/internal/accounts';
    const secret =
      this.config.get<string>('INTERNAL_SERVICE_AUTH_SECRET') ??
      'local-dev-internal-secret';

    const urlsToTry = [
      configuredUrl.replace('localhost:5003', 'auth-service:5003').replace('127.0.0.1:5003', 'auth-service:5003'),
      'http://auth-service:5003/internal/accounts',
      configuredUrl,
    ];

    for (const baseUrl of urlsToTry) {
      try {
        const res = await fetch(`${baseUrl}/${accountId}`, {
          method: 'DELETE',
          headers: { 'x-internal-service-secret': secret },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return;
      } catch {
        // try next
      }
    }
  }

  private async createAuthAccount(
    email: string,
    password: string,
    role: string,
  ): Promise<{ userId: string; email: string; role: string }> {
    const configuredUrl =
      this.config.get<string>('AUTH_ACCOUNT_LOOKUP_URL') ??
      'http://auth-service:5003/internal/accounts';
    const secret =
      this.config.get<string>('INTERNAL_SERVICE_AUTH_SECRET') ??
      'local-dev-internal-secret';

    const urlsToTry = [
      configuredUrl
        .replace('localhost:5003', 'auth-service:5003')
        .replace('127.0.0.1:5003', 'auth-service:5003'),
      'http://auth-service:5003/internal/accounts',
      configuredUrl,
    ];

    let lastError: Error | null = null;
    for (const baseUrl of urlsToTry) {
      try {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-service-secret': secret,
          },
          body: JSON.stringify({ email, password, role }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.status === 409) {
          throw new DomainException(
            'EMAIL_ALREADY_EXISTS',
            'Email này đã được đăng ký tài khoản trong hệ thống',
            HttpStatus.CONFLICT,
          );
        }
        if (res.ok) {
          return (await res.json()) as { userId: string; email: string; role: string };
        }
        const errorText = await res.text();
        lastError = new Error(`Auth service returned status ${res.status}: ${errorText}`);
      } catch (err) {
        if (err instanceof DomainException) throw err;
        lastError = err as Error;
      }
    }
    throw new DomainException(
      'AUTH_SERVICE_UNAVAILABLE',
      lastError?.message || 'Không thể kết nối đến Auth Service để tạo tài khoản bệnh nhân',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
