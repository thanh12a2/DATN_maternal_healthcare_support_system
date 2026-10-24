import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../../generated/receptionist-client';
import {
  AdmissionStatus,
  AdmissionStep,
  IdentityVerificationResult,
  ReceptionCaseStatus,
  ReceptionCaseType,
} from '../../../../generated/receptionist-client';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../database/prisma.service';
import { ReceptionistsService } from '../receptionists/receptionists.service';
import type { SearchAppointmentsDto } from './dto/search-appointments.dto';
import type { BookAppointmentDto } from './dto/book-appointment.dto';
import type { SearchBookableSlotsDto } from './dto/search-bookable-slots.dto';
import type { RecordAdmissionPaymentDto } from './dto/record-admission-payment.dto';
import type { OpenReceptionCaseDto } from './dto/open-reception-case.dto';
import type { VerifyIdentityDto } from './dto/verify-identity.dto';
import type { ListReceptionCasesDto } from './dto/list-reception-cases.dto';
import type { CaseTransitionDto } from './dto/case-transition.dto';
import type { SearchReceptionPatientsDto } from './dto/search-reception-patients.dto';
import type { CreateWalkInPatientDto } from './dto/create-walk-in-patient.dto';
import { AdmissionGrpcGateway } from './admission-grpc.gateway';

@Injectable()
export class AdmissionService {
  constructor(
    private readonly db: PrismaService,
    private readonly remote: AdmissionGrpcGateway,
    private readonly receptionists: ReceptionistsService,
  ) {}

  async searchPatientsForReception(input: SearchReceptionPatientsDto, auth: AuthContext) {
    await this.assertOperational(auth);
    const response: any = await this.remote.searchPatients(
      input.phoneNumber,
      auth.userId,
      `${randomUUID()}:patient-search`,
    );
    return { items: (response.patients ?? []).map((patient: any) => this.presentPatient(patient)) };
  }

  async createWalkInPatient(
    input: CreateWalkInPatientDto,
    idempotencyKey: string | undefined,
    auth: AuthContext,
  ) {
    await this.assertOperational(auth);
    const key = this.requiredIdempotencyKey(idempotencyKey);
    const response: any = await this.remote.createWalkInPatient(input, auth.userId, key);
    return { patient: this.presentPatient(response.patient), created: Boolean(response.created) };
  }

  async searchAppointments(input: SearchAppointmentsDto, auth: AuthContext) {
    await this.assertOperational(auth);
    if (!input.patientId && !input.phoneNumber) {
      throw new BadRequestException({
        code: 'SEARCH_FILTER_REQUIRED',
        message: 'patientId or phoneNumber is required',
      });
    }

    const key = `${randomUUID()}:appointment-search`;
    const patients = input.patientId
      ? [
          (
            await this.remote.patientIdentity(
              input.patientId,
              auth.userId,
              `${key}:patient`,
            )
          ).patient,
        ].filter(Boolean)
      : ((await this.remote.searchPatients(input.phoneNumber!, auth.userId, key))
          .patients ?? []);

    const results = await Promise.all(
      patients.map(async (patient: any) => {
        const response = await this.remote.searchAppointments(
          {
            patientId: patient.patientId,
            appointmentCode: input.appointmentCode,
            from: input.from,
            to: input.to,
            limit: input.limit,
          },
          auth.userId,
          `${key}:${patient.patientId}`,
        );
        return {
          patient: this.presentPatient(patient),
          appointments: (response.appointments ?? []).map((appointment: any) =>
            this.presentAppointment(appointment),
          ),
        };
      }),
    );

    return { items: results };
  }

  async searchBookableSlots(input: SearchBookableSlotsDto, auth: AuthContext) {
    await this.assertOperational(auth);
    const key = `${randomUUID()}:bookable-slots`;
    return this.remote.searchBookableSlots(input, auth.userId, key);
  }

  async bookAppointment(
    input: BookAppointmentDto,
    idempotencyKey: string | undefined,
    auth: AuthContext,
  ) {
    await this.assertOperational(auth);
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required',
      });
    }
    return this.remote.bookAppointment(input, auth.userId, idempotencyKey.trim());
  }

  async openCase(
    input: OpenReceptionCaseDto,
    idempotencyKey: string | undefined,
    auth: AuthContext,
    requestId: string,
  ) {
    await this.assertOperational(auth);
    const key = this.requiredIdempotencyKey(idempotencyKey);
    const operation = `reception.case.open:${input.appointmentId}`;
    const requestHash = this.hash({ input });
    const replay = await this.db.receptionIdempotencyRecord.findUnique({
      where: { actorId_operation_idempotencyKey: { actorId: auth.userId, operation, idempotencyKey: key } },
    });
    if (replay) {
      if (replay.requestHash !== requestHash) throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
      if (replay.resourceId) return this.get(replay.resourceId);
    }

    const existing = await this.db.receptionCase.findFirst({
      where: {
        appointmentId: input.appointmentId,
        status: { not: ReceptionCaseStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return this.get(existing.id);

    const provisionalCaseId = randomUUID();
    const validation: any = await this.remote.validateAppointment(
      input.appointmentId,
      input.patientId,
      provisionalCaseId,
      auth.userId,
      `${provisionalCaseId}:validate`,
    );
    if (!validation.valid || !validation.startAt) {
      throw new ConflictException(
        validation.failureCode ?? 'APPOINTMENT_INVALID',
      );
    }

    const identity: any = await this.remote.patientIdentity(
      input.patientId,
      auth.userId,
      `${provisionalCaseId}:identity`,
    );
    const appointment: any = (
      await this.remote.getAppointment(
        input.appointmentId,
        auth.userId,
        `${provisionalCaseId}:appointment`,
      )
    ).appointment;
    if (!appointment) throw new ConflictException('APPOINTMENT_NOT_FOUND');
    let caseRecord: any;
    try {
      caseRecord = await this.db.$transaction(async (tx) => {
        const created = await tx.receptionCase.create({
          data: {
            appointmentId: input.appointmentId,
            patientId: input.patientId,
            type: this.caseType(appointment.channel),
            status: ReceptionCaseStatus.OPEN,
            arrivalAt: input.arrivalAt ? new Date(input.arrivalAt) : new Date(),
            scheduledStartAtSnapshot: this.timestampToDate(validation.startAt),
            appointmentTypeSnapshot: String(appointment.channel ?? 'BOOKING_CHANNEL_RECEPTION'),
            openedByAccountId: auth.userId,
            lastHandledByAccountId: auth.userId,
          },
        });
        await tx.receptionIdempotencyRecord.create({
          data: {
            actorId: auth.userId,
            operation,
            idempotencyKey: key,
            requestHash,
            resourceId: created.id,
            responseStatus: 201,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        await this.audit(tx, 'RECEPTION_CASE_OPENED', auth.userId, requestId, created.id, null, ['status']);
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const active = await this.db.receptionCase.findFirst({
          where: { appointmentId: input.appointmentId, status: { not: ReceptionCaseStatus.CANCELLED } },
          orderBy: { createdAt: 'desc' },
        });
        if (active) return this.get(active.id);
      }
      throw error;
    }

    return {
      ...caseRecord,
      identity: identity.patient,
      appointment: {
        serviceId: validation.serviceId,
        assignedDoctorId: validation.assignedDoctorId,
        startAt: this.timestampToIso(validation.startAt),
        endAt: this.timestampToIso(validation.endAt),
        status: validation.status,
        late: validation.late,
        lateMinutes: validation.lateMinutes,
      },
    };
  }

  async verify(
    caseId: string,
    input: VerifyIdentityDto,
    auth: AuthContext,
    requestId: string,
  ) {
    await this.assertOperational(auth);
    const receptionCase = await this.getCase(caseId);
    if (
      receptionCase.status === ReceptionCaseStatus.ADMITTED ||
      receptionCase.status === ReceptionCaseStatus.CANCELLED ||
      receptionCase.status === ReceptionCaseStatus.MANUAL_REVIEW
    ) {
      throw new ConflictException('RECEPTION_CASE_NOT_VERIFIABLE');
    }

    if (receptionCase.version !== input.expectedVersion) throw new ConflictException('VERSION_CONFLICT');
    const nextStatus = input.result === IdentityVerificationResult.VERIFIED
      ? ReceptionCaseStatus.IDENTITY_VERIFIED
      : ReceptionCaseStatus.MANUAL_REVIEW;
    return this.db.$transaction(async (tx) => {
      const update = await tx.receptionCase.updateMany({
        where: { id: caseId, version: input.expectedVersion, status: { in: [ReceptionCaseStatus.OPEN, ReceptionCaseStatus.IDENTITY_VERIFIED] } },
        data: { status: nextStatus, lastHandledByAccountId: auth.userId, version: { increment: 1 } },
      });
      if (update.count !== 1) throw new ConflictException('VERSION_CONFLICT');
      const verification = await tx.identityVerification.create({
        data: {
          receptionCaseId: caseId,
          method: input.method,
          result: input.result,
          verifiedFields: input.verifiedFields ?? [],
          reasonCode: input.reasonCode,
          note: input.note,
          performedByAccountId: auth.userId,
        },
      });
      await this.audit(tx, 'RECEPTION_CASE_IDENTITY_VERIFIED', auth.userId, requestId, caseId, null, ['status'], input.reasonCode);
      return verification;
    });
  }

  async listCases(input: ListReceptionCasesDto, auth: AuthContext) {
    await this.assertOperational(auth);
    const limit = input.limit ?? 20;
    const rows = await this.db.receptionCase.findMany({
      where: {
        ...(input.status ? { status: input.status as ReceptionCaseStatus } : {}),
        ...(input.admissionStatus ? { admission: { is: { status: input.admissionStatus as AdmissionStatus } } } : {}),
        ...(input.patientId ? { patientId: input.patientId } : {}),
        ...(input.from || input.to
          ? { arrivalAt: { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lte: new Date(input.to) } : {}) } }
          : {}),
      },
      include: { admission: true },
      orderBy: [{ arrivalAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, limit).map((item) => this.presentCase(item));
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
  }

  async getCaseDetail(caseId: string, auth: AuthContext) {
    await this.assertOperational(auth);
    const record = await this.get(caseId);
    if (!record) throw new NotFoundException('RECEPTION_CASE_NOT_FOUND');
    return record;
  }

  async queueStatus(caseId: string, auth: AuthContext) {
    await this.assertOperational(auth);
    const receptionCase: any = await this.getCase(caseId);
    const journeyId = receptionCase.admission?.queueJourneyId;
    if (!journeyId) throw new ConflictException('QUEUE_NOT_CREATED');
    const journey: any = await this.remote.getQueue(
      journeyId,
      auth.userId,
      `${receptionCase.admission.id}:queue-read`,
    );
    return journey;
  }

  async recordPayment(
    caseId: string,
    input: RecordAdmissionPaymentDto,
    idempotencyKey: string | undefined,
    auth: AuthContext,
    requestId: string,
  ) {
    await this.assertOperational(auth);
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required',
      });
    }

    const receptionCase: any = await this.getCase(caseId);
    if (receptionCase.version !== input.expectedCaseVersion) {
      throw new ConflictException('VERSION_CONFLICT');
    }
    if (receptionCase.status === ReceptionCaseStatus.ADMITTED) {
      throw new ConflictException('CASE_ALREADY_ADMITTED');
    }
    if (
      receptionCase.status !== ReceptionCaseStatus.IDENTITY_VERIFIED &&
      receptionCase.status !== ReceptionCaseStatus.ADMISSION_IN_PROGRESS
    ) {
      throw new ConflictException('IDENTITY_NOT_VERIFIED');
    }
    if (!receptionCase.appointmentId) {
      throw new ConflictException('APPOINTMENT_REQUIRED_FOR_PAYMENT');
    }

    const prepared = await this.ensureBaseInvoice(receptionCase, auth);
    let admission: any = prepared.admission;
    const invoiceId = prepared.invoiceId;
    const invoiceResponse: any = await this.remote.getInvoice(
      invoiceId,
      auth.userId,
      `${admission.id}:invoice-before-payment`,
    );
    const invoice = invoiceResponse.invoice;
    if (!invoice) throw new ConflictException('INVOICE_NOT_FOUND');
    const expectedInvoiceVersion = Number(invoice.version);
    if (!Number.isSafeInteger(expectedInvoiceVersion) || expectedInvoiceVersion < 1) {
      throw new ConflictException('INVOICE_VERSION_INVALID');
    }

    const paymentResponse: any = invoice.payment
      ? { invoice, payment: invoice.payment, idempotentReplay: true }
      : await this.remote.recordAdmissionPayment(
          {
            invoiceId,
            ...input,
            expectedInvoiceVersion,
          },
          auth.userId,
          idempotencyKey.trim(),
        );
    const paymentId = String(
      paymentResponse.payment?.paymentId ?? paymentResponse.payment?.id ?? '',
    ).trim();
    const conditionResponse: any = await this.remote.paymentCondition(
      invoiceId,
      receptionCase.appointmentId,
      auth.userId,
      `${admission.id}:payment-condition`,
    );
    const condition = this.paymentCondition(conditionResponse.condition);

    admission = await this.db.$transaction(async (tx) => {
      const nextStatus = condition ? AdmissionStatus.IN_PROGRESS : AdmissionStatus.AWAITING_PAYMENT;
      const updated = await tx.admission.update({
        where: { id: admission.id },
        data: {
          paymentId: paymentId || undefined,
          status: nextStatus,
          currentStep: condition
            ? AdmissionStep.OPEN_CLINICAL_ENCOUNTER_DRAFT
            : AdmissionStep.VERIFY_PAYMENT_OR_APPROVED_CREDIT,
          lastErrorCode: condition ? null : 'PAYMENT_NOT_CLEARED',
          version: { increment: 1 },
        },
      });
      if (admission.status !== nextStatus) {
        await this.history(tx, admission.id, admission.status, nextStatus, updated.currentStep, auth.userId, condition ? 'PAYMENT_CLEARED' : 'PAYMENT_NOT_CLEARED');
      }
      await this.audit(tx, 'RECEPTION_CASE_PAYMENT_RECORDED', auth.userId, requestId, caseId, admission.id, ['admission.status'], condition ? 'PAYMENT_CLEARED' : 'PAYMENT_NOT_CLEARED');
      return updated;
    });
    return {
      invoice: paymentResponse.invoice,
      payment: paymentResponse.payment,
      paymentCondition: condition ?? 'NOT_SATISFIED',
      readyForAdmission: Boolean(condition),
      admission: {
        id: admission.id,
        status: admission.status,
        currentStep: admission.currentStep,
      },
      case: this.presentCase(await this.getCase(caseId)),
    };
  }

  async prepareInvoice(caseId: string, auth: AuthContext) {
    await this.assertOperational(auth);
    const receptionCase: any = await this.getCase(caseId);
    if (
      receptionCase.status !== ReceptionCaseStatus.IDENTITY_VERIFIED &&
      receptionCase.status !== ReceptionCaseStatus.ADMISSION_IN_PROGRESS
    ) {
      throw new ConflictException('IDENTITY_NOT_VERIFIED');
    }
    if (!receptionCase.appointmentId) {
      throw new ConflictException('APPOINTMENT_REQUIRED_FOR_PAYMENT');
    }
    const prepared = await this.ensureBaseInvoice(receptionCase, auth);
    const response: any = await this.remote.getInvoice(
      prepared.invoiceId,
      auth.userId,
      `${prepared.admission.id}:invoice-summary`,
    );
    if (!response.invoice) throw new ConflictException('INVOICE_NOT_FOUND');
    return {
      invoice: response.invoice,
      admission: {
        id: prepared.admission.id,
        status: prepared.admission.status,
        currentStep: prepared.admission.currentStep,
      },
    };
  }

  async get(caseId: string) {
    return this.db.receptionCase.findUnique({
      where: { id: caseId },
      include: {
        identityVerifications: true,
        admission: { include: { history: true } },
      },
    });
  }

  async admit(caseId: string, expectedVersion: number, auth: AuthContext, requestId: string) {
    await this.assertOperational(auth);
    const receptionCase: any = await this.getCase(caseId);
    if (receptionCase.version !== expectedVersion) throw new ConflictException('VERSION_CONFLICT');
    if (!receptionCase.appointmentId) {
      throw new ConflictException('APPOINTMENT_REQUIRED_FOR_ADMISSION');
    }
    if (receptionCase.status === ReceptionCaseStatus.ADMITTED) {
      return this.get(caseId);
    }
    if (
      receptionCase.status !== ReceptionCaseStatus.IDENTITY_VERIFIED &&
      receptionCase.status !== ReceptionCaseStatus.ADMISSION_IN_PROGRESS
    ) {
      throw new ConflictException('IDENTITY_NOT_VERIFIED');
    }

    let admission: any = await this.db.admission.upsert({
      where: { receptionCaseId: caseId },
      create: { receptionCaseId: caseId },
      update: {},
    });
    const claimed = await this.db.receptionCase.updateMany({
      where: {
        id: caseId,
        version: expectedVersion,
        status: { in: [ReceptionCaseStatus.IDENTITY_VERIFIED, ReceptionCaseStatus.ADMISSION_IN_PROGRESS] },
      },
      data: {
        status: ReceptionCaseStatus.ADMISSION_IN_PROGRESS,
        lastHandledByAccountId: auth.userId,
        version: { increment: 1 },
      },
    });
    if (claimed.count !== 1) throw new ConflictException('VERSION_CONFLICT');

    const key = (step: string) => `${admission.id}:${step}`;
    try {
      const validation: any = await this.remote.validateAppointment(
        receptionCase.appointmentId,
        receptionCase.patientId,
        caseId,
        auth.userId,
        key('validate'),
      );
      if (!validation.valid) {
        throw new ConflictException(validation.failureCode ?? 'APPOINTMENT_INVALID');
      }

      const appointment: any = (
        await this.remote.getAppointment(
          receptionCase.appointmentId,
          auth.userId,
          key('appointment'),
        )
      ).appointment;
      if (!appointment) throw new ConflictException('APPOINTMENT_NOT_FOUND');

      let invoiceId = admission.invoiceId as string | null;
      if (!invoiceId) {
        admission = await this.checkpoint(
          admission.id,
          AdmissionStep.CREATE_OR_GET_BASE_INVOICE,
          {},
        );
        const invoiceResponse: any = await this.remote.createInvoice(
          appointment,
          caseId,
          auth.userId,
          key('invoice'),
        );
        invoiceId = String(
          invoiceResponse.invoice?.invoiceId ?? invoiceResponse.invoice?.id ?? '',
        ).trim();
        if (!invoiceId) throw new ConflictException('INVOICE_ID_MISSING');
        admission = await this.checkpoint(
          admission.id,
          AdmissionStep.VERIFY_PAYMENT_OR_APPROVED_CREDIT,
          { invoiceId },
        );
      }

      const payment: any = await this.remote.paymentCondition(
        invoiceId,
        receptionCase.appointmentId,
        auth.userId,
        key('payment'),
      );
      const condition = this.paymentCondition(payment.condition);
      if (!condition) {
        await this.db.$transaction(async (tx) => {
          const updated = await tx.admission.update({
            where: { id: admission.id },
            data: {
              status: AdmissionStatus.AWAITING_PAYMENT,
              currentStep: AdmissionStep.VERIFY_PAYMENT_OR_APPROVED_CREDIT,
              lastErrorCode: 'PAYMENT_NOT_CLEARED',
              version: { increment: 1 },
            },
          });
          if (admission.status !== AdmissionStatus.AWAITING_PAYMENT) {
            await this.history(tx, admission.id, admission.status, AdmissionStatus.AWAITING_PAYMENT, updated.currentStep, auth.userId, 'PAYMENT_NOT_CLEARED');
          }
          await this.audit(tx, 'RECEPTION_CASE_AWAITING_PAYMENT', auth.userId, requestId, caseId, admission.id, ['admission.status'], 'PAYMENT_NOT_CLEARED');
        });
        return this.get(caseId);
      }

      let encounterId = admission.encounterId as string | null;
      if (!encounterId) {
        admission = await this.checkpoint(
          admission.id,
          AdmissionStep.OPEN_CLINICAL_ENCOUNTER_DRAFT,
          {},
        );
        const encounterResponse: any = await this.remote.openEncounter(
          appointment,
          invoiceId,
          condition,
          caseId,
          auth.userId,
          key('encounter'),
        );
        encounterId = String(encounterResponse.encounter?.encounterId ?? '').trim();
        if (!encounterId) throw new ConflictException('ENCOUNTER_ID_MISSING');
        admission = await this.checkpoint(
          admission.id,
          AdmissionStep.CHECK_IN_APPOINTMENT,
          { encounterId, medicalRecordId: encounterId },
        );
      }

      let queueJourneyId = admission.queueJourneyId as string | null;
      let queueTicketId = admission.queueTicketId as string | null;
      if (!queueJourneyId) {
        let checkedAppointment = appointment;
        if (!admission.appointmentCheckedInAt) {
          admission = await this.checkpoint(
            admission.id,
            AdmissionStep.CHECK_IN_APPOINTMENT,
            {},
          );
          const checkedIn: any = await this.remote.checkIn(
            appointment,
            caseId,
            invoiceId,
            encounterId,
            condition,
            auth.userId,
            key('checkin'),
          );
          checkedAppointment = checkedIn.appointment ?? appointment;
          admission = await this.checkpoint(
            admission.id,
            AdmissionStep.CREATE_AUTHORITATIVE_QUEUE_TICKET,
            { appointmentCheckedInAt: new Date() },
          );
        } else {
          const currentAppointment: any = (
            await this.remote.getAppointment(
              receptionCase.appointmentId,
              auth.userId,
              key('appointment-outcome'),
            )
          ).appointment;
          if (currentAppointment) checkedAppointment = currentAppointment;
        }

        const queued: any = await this.remote.createQueue(
          checkedAppointment,
          caseId,
          invoiceId,
          encounterId,
          condition,
          auth.userId,
          key('queue'),
        );
        queueJourneyId = String(queued.journey?.journeyId ?? '').trim() || null;
        queueTicketId = String(queued.initialTicket?.ticketId ?? '').trim() || null;
        if (!queueJourneyId || !queueTicketId) {
          throw new ConflictException('QUEUE_RESULT_MISSING');
        }
      }

      await this.db.$transaction(async (tx) => {
        const updated = await tx.admission.update({
          where: { id: admission.id },
          data: {
            status: AdmissionStatus.COMPLETED,
            currentStep: AdmissionStep.DONE,
            queueJourneyId,
            queueTicketId,
            completedAt: new Date(),
            lastErrorCode: null,
            version: { increment: 1 },
          },
        });
        if (admission.status !== AdmissionStatus.COMPLETED) {
          await this.history(tx, admission.id, admission.status, AdmissionStatus.COMPLETED, updated.currentStep, auth.userId, 'ADMISSION_COMPLETED');
        }
        await tx.receptionCase.update({
          where: { id: caseId },
          data: {
            status: ReceptionCaseStatus.ADMITTED,
            lastHandledByAccountId: auth.userId,
            version: { increment: 1 },
          },
        });
        await this.audit(tx, 'RECEPTION_CASE_ADMITTED', auth.userId, requestId, caseId, admission.id, ['status', 'admission.status'], 'ADMISSION_COMPLETED');
      });
      return this.get(caseId);
    } catch (error) {
      await this.db.$transaction(async (tx) => {
        const updated = await tx.admission.update({
          where: { id: admission.id },
          data: {
            status: AdmissionStatus.FAILED_RETRYABLE,
            lastErrorCode:
              error instanceof Error ? error.message.slice(0, 100) : 'UNKNOWN',
            retryCount: { increment: 1 },
            version: { increment: 1 },
          },
        });
        if (admission.status !== AdmissionStatus.FAILED_RETRYABLE) {
          await this.history(tx, admission.id, admission.status, AdmissionStatus.FAILED_RETRYABLE, updated.currentStep, auth.userId, 'DOWNSTREAM_FAILURE');
        }
        await this.audit(tx, 'RECEPTION_CASE_ADMISSION_FAILED', auth.userId, requestId, caseId, admission.id, ['admission.status'], 'DOWNSTREAM_FAILURE');
      });
      throw error;
    }
  }

  async retry(caseId: string, expectedVersion: number, auth: AuthContext, requestId: string) {
    await this.assertOperational(auth);
    const receptionCase: any = await this.getCase(caseId);
    if (receptionCase.admission?.status !== AdmissionStatus.FAILED_RETRYABLE) {
      throw new ConflictException('ADMISSION_NOT_RETRYABLE');
    }
    return this.admit(caseId, expectedVersion, auth, requestId);
  }

  async cancel(caseId: string, input: CaseTransitionDto, auth: AuthContext, requestId: string) {
    return this.resolveCase(caseId, ReceptionCaseStatus.CANCELLED, AdmissionStatus.CANCELLED, input, auth, requestId);
  }

  async manualReview(caseId: string, input: CaseTransitionDto, auth: AuthContext, requestId: string) {
    return this.resolveCase(caseId, ReceptionCaseStatus.MANUAL_REVIEW, AdmissionStatus.MANUAL_REVIEW, input, auth, requestId);
  }

  private async resolveCase(
    caseId: string,
    nextCaseStatus: ReceptionCaseStatus,
    nextAdmissionStatus: AdmissionStatus,
    input: CaseTransitionDto,
    auth: AuthContext,
    requestId: string,
  ) {
    await this.assertOperational(auth);
    const receptionCase: any = await this.getCase(caseId);
    if (receptionCase.version !== input.expectedVersion) throw new ConflictException('VERSION_CONFLICT');
    if ([ReceptionCaseStatus.ADMITTED, ReceptionCaseStatus.CANCELLED].includes(receptionCase.status)) {
      throw new ConflictException('RECEPTION_CASE_NOT_RESOLVABLE');
    }
    const admission = receptionCase.admission;
    if (admission?.queueJourneyId && receptionCase.appointmentId) {
      await this.remote.cancelQueue(
        admission.queueJourneyId,
        receptionCase.appointmentId,
        input.reasonCode,
        auth.userId,
        `${admission.id}:queue-cancel:${input.expectedVersion}`,
      );
    }
    await this.db.$transaction(async (tx) => {
      const updatedCase = await tx.receptionCase.updateMany({
        where: {
          id: caseId,
          version: input.expectedVersion,
          status: { in: [ReceptionCaseStatus.OPEN, ReceptionCaseStatus.IDENTITY_VERIFIED, ReceptionCaseStatus.ADMISSION_IN_PROGRESS, ReceptionCaseStatus.MANUAL_REVIEW] },
        },
        data: {
          status: nextCaseStatus,
          lastHandledByAccountId: auth.userId,
          version: { increment: 1 },
        },
      });
      if (updatedCase.count !== 1) throw new ConflictException('VERSION_CONFLICT');
      if (admission) {
        const updatedAdmission = await tx.admission.update({
          where: { id: admission.id },
          data: { status: nextAdmissionStatus, lastErrorCode: input.reasonCode, version: { increment: 1 } },
        });
        if (admission.status !== nextAdmissionStatus) {
          await this.history(tx, admission.id, admission.status, nextAdmissionStatus, updatedAdmission.currentStep, auth.userId, input.reasonCode);
        }
      }
      await this.audit(
        tx,
        nextCaseStatus === ReceptionCaseStatus.CANCELLED ? 'RECEPTION_CASE_CANCELLED' : 'RECEPTION_CASE_MANUAL_REVIEW',
        auth.userId,
        requestId,
        caseId,
        admission?.id ?? null,
        ['status', ...(admission ? ['admission.status'] : [])],
        input.reasonCode,
      );
    });
    return this.get(caseId);
  }

  private async assertOperational(auth: AuthContext): Promise<void> {
    if (auth.role === 'RECEPTIONIST') {
      await this.receptionists.assertOperational(auth);
    }
  }

  private async getCase(caseId: string): Promise<any> {
    const record = await this.db.receptionCase.findUnique({ where: { id: caseId }, include: { admission: true } });
    if (!record) throw new NotFoundException('RECEPTION_CASE_NOT_FOUND');
    return record;
  }

  private async ensureBaseInvoice(receptionCase: any, auth: AuthContext) {
    let admission: any = await this.db.admission.upsert({
      where: { receptionCaseId: receptionCase.id },
      create: { receptionCaseId: receptionCase.id },
      update: {},
    });
    let invoiceId = admission.invoiceId as string | null;
    if (!invoiceId) {
      const validation: any = await this.remote.validateAppointment(
        receptionCase.appointmentId,
        receptionCase.patientId,
        receptionCase.id,
        auth.userId,
        `${admission.id}:validate-invoice`,
      );
      if (!validation.valid) {
        throw new ConflictException(validation.failureCode ?? 'APPOINTMENT_INVALID');
      }
      const appointment: any = (
        await this.remote.getAppointment(
          receptionCase.appointmentId,
          auth.userId,
          `${admission.id}:appointment-for-invoice`,
        )
      ).appointment;
      if (!appointment) throw new ConflictException('APPOINTMENT_NOT_FOUND');
      const invoiceResponse: any = await this.remote.createInvoice(
        appointment,
        receptionCase.id,
        auth.userId,
        `${admission.id}:invoice`,
      );
      invoiceId = String(
        invoiceResponse.invoice?.invoiceId ?? invoiceResponse.invoice?.id ?? '',
      ).trim();
      if (!invoiceId) throw new ConflictException('INVOICE_ID_MISSING');
      admission = await this.checkpoint(
        admission.id,
        AdmissionStep.VERIFY_PAYMENT_OR_APPROVED_CREDIT,
        { invoiceId },
      );
    }
    return { admission, invoiceId };
  }

  private async checkpoint(id: string, step: AdmissionStep, data: any) {
    return this.db.admission.update({
      where: { id },
      data: { ...data, currentStep: step, version: { increment: 1 } },
    });
  }

  private paymentCondition(value: any): 'PAID' | 'APPROVED_CREDIT' | null {
    const normalized = String(value ?? '').toUpperCase();
    if (
      normalized === 'PAID' ||
      normalized.endsWith('ADMISSION_PAYMENT_CONDITION_PAID')
    ) {
      return 'PAID';
    }
    if (
      normalized === 'APPROVED_CREDIT' ||
      normalized.endsWith('ADMISSION_PAYMENT_CONDITION_APPROVED_CREDIT')
    ) {
      return 'APPROVED_CREDIT';
    }
    return null;
  }

  private caseType(channel: unknown): ReceptionCaseType {
    return String(channel).endsWith('WALK_IN')
      ? ReceptionCaseType.WALK_IN
      : ReceptionCaseType.SCHEDULED;
  }

  private presentPatient(patient: any) {
    return {
      patientId: patient.patientId,
      fullName: patient.fullName,
      dateOfBirth: this.timestampToIso(patient.dateOfBirth),
      maskedPhone: patient.maskedPhone,
      nationalIdLast4: patient.nationalIdLast4,
      active: patient.active,
      profileVersion: patient.profileVersion,
    };
  }

  private presentAppointment(appointment: any) {
    return {
      appointmentId: appointment.appointmentId,
      appointmentCode: appointment.appointmentCode,
      patientId: appointment.patientId,
      serviceId: appointment.serviceId,
      serviceName: appointment.pricing?.serviceName,
      channel: appointment.channel,
      assignedDoctorId: appointment.assignedDoctorId,
      assignedRankCode: appointment.assignedRankCode,
      startAt: this.timestampToIso(appointment.startAt),
      endAt: this.timestampToIso(appointment.endAt),
      status: appointment.status,
      version: appointment.version,
    };
  }

  private presentCase(item: any) {
    return {
      id: item.id,
      patientId: item.patientId,
      appointmentId: item.appointmentId,
      type: item.type,
      status: item.status,
      arrivalAt: item.arrivalAt?.toISOString?.() ?? item.arrivalAt,
      scheduledStartAt: item.scheduledStartAtSnapshot?.toISOString?.() ?? null,
      version: item.version,
      admission: item.admission
        ? {
            id: item.admission.id,
            status: item.admission.status,
            currentStep: item.admission.currentStep,
            queueJourneyId: item.admission.queueJourneyId,
            queueTicketId: item.admission.queueTicketId,
            retryCount: item.admission.retryCount,
          }
        : null,
    };
  }

  private async history(
    tx: any,
    admissionId: string,
    fromStatus: AdmissionStatus,
    toStatus: AdmissionStatus,
    step: AdmissionStep,
    actorId: string,
    reasonCode: string,
  ) {
    await tx.admissionStatusHistory.create({
      data: { admissionId, fromStatus, toStatus, step, actorId, reasonCode },
    });
  }

  private async audit(
    tx: any,
    eventType: string,
    actorId: string,
    requestId: string,
    caseId: string | null,
    admissionId: string | null,
    changedFields: string[],
    reasonCode?: string,
  ) {
    await tx.receptionAuditLog.create({
      data: { eventType, actorId, caseId, admissionId, changedFields, reasonCode: reasonCode ?? null, requestId },
    });
  }

  private requiredIdempotencyKey(value: string | undefined): string {
    const key = value?.trim() ?? '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A UUID Idempotency-Key header is required' });
    }
    return key;
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private timestampToDate(value: any): Date {
    return new Date(
      Number(value.seconds) * 1_000 + Math.floor(Number(value.nanos ?? 0) / 1_000_000),
    );
  }

  private timestampToIso(value: any): string | null {
    return value ? this.timestampToDate(value).toISOString() : null;
  }
}
