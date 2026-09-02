import { createHash } from 'crypto';
import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
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
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
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
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
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
    return presentPatient(patient, this.crypto);
  }

  async search(
    dto: SearchPatientsDto,
    auth: PatientAuthContext,
    requestId: string,
  ) {
    this.receptionistOnly(auth);
    if (!dto.phoneNumber && !dto.nationalId && !dto.fullName) {
      throw new DomainException(
        'SEARCH_FILTER_REQUIRED',
        'At least one search filter is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filters: Prisma.PatientWhereInput[] = [];
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
    const where: Prisma.PatientWhereInput = { AND: filters };
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
    return {
      items: result.patients.map((patient) =>
        presentSearchPatient(patient, this.crypto),
      ),
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
    const reason = normalizeReason(dto.reason);
    const requestHash = this.requestHash(data, reason);
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
              authAccountId: null,
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
    const reason = normalizeReason(dto.reason);
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
          where: { id: patientId, version: dto.version },
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

  async getEligibility(patientId: string) {
    this.uuid(patientId, 'INVALID_PATIENT_ID');
    const exists = Boolean(
      await this.db.patient.findUnique({
        where: { id: patientId },
        select: { id: true },
      }),
    );
    return {
      patientId,
      exists,
      profileStatus: exists ? ('COMPLETE' as const) : null,
      eligibleForBooking: exists,
      missingFields: [],
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
      if (
        (await transaction.emergencyContact.count({ where: { patientId } })) >=
        3
      ) {
        throw new DomainException(
          'EMERGENCY_CONTACT_LIMIT_REACHED',
          'A patient can have at most three emergency contacts',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (dto.isPrimary) {
        await transaction.emergencyContact.updateMany({
          where: { patientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      const contact = await transaction.emergencyContact.create({
        data: {
          patientId,
          fullName: normalizeFullName(dto.fullName),
          relationship: normalizeRelationship(dto.relationship),
          phoneNumber: normalizePhone(dto.phoneNumber),
          isPrimary: dto.isPrimary ?? false,
        },
      });
      await this.auditContact(
        transaction,
        auth,
        patientId,
        contact.id,
        'CREATE',
        requestId,
      );
      return presentContact(contact);
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
      if (dto.isPrimary === true) {
        await transaction.emergencyContact.updateMany({
          where: { patientId, isPrimary: true, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }
      const contact = await transaction.emergencyContact.update({
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
          ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
        },
      });
      const changed =
        old.fullName !== contact.fullName ||
        old.relationship !== contact.relationship ||
        old.phoneNumber !== contact.phoneNumber ||
        old.isPrimary !== contact.isPrimary;
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
      if (deleted.count)
        await this.auditContact(
          transaction,
          auth,
          patientId,
          contactId,
          'DELETE',
          requestId,
        );
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
    if (auth.role === 'RECEPTIONIST') return;
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
    if (auth.role !== 'RECEPTIONIST')
      throw new ForbiddenException('Receptionist role is required');
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
}
