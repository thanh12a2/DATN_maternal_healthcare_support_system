import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { AdmissionGrpcGateway } from './admission-grpc.gateway';

@Injectable()
export class AdmissionService {
  constructor(
    private readonly db: PrismaService,
    private readonly remote: AdmissionGrpcGateway,
    private readonly receptionists: ReceptionistsService,
  ) {}

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
    input: { appointmentId: string; patientId: string; arrivalAt?: string },
    auth: AuthContext,
  ) {
    await this.assertOperational(auth);

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
    const caseRecord = await this.db.receptionCase.create({
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
    input: {
      method: any;
      result: any;
      verifiedFields?: string[];
      reasonCode?: string;
      note?: string;
    },
    auth: AuthContext,
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

    const verification = await this.db.identityVerification.create({
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

    if (input.result === IdentityVerificationResult.VERIFIED) {
      await this.db.receptionCase.update({
        where: { id: caseId },
        data: {
          status: ReceptionCaseStatus.IDENTITY_VERIFIED,
          lastHandledByAccountId: auth.userId,
          version: { increment: 1 },
        },
      });
    }
    return verification;
  }

  async recordPayment(
    caseId: string,
    input: RecordAdmissionPaymentDto,
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

    const receptionCase: any = await this.getCase(caseId);
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

    admission = await this.db.admission.update({
      where: { id: admission.id },
      data: {
        paymentId: paymentId || undefined,
        status: condition ? AdmissionStatus.IN_PROGRESS : AdmissionStatus.AWAITING_PAYMENT,
        currentStep: condition
          ? AdmissionStep.OPEN_CLINICAL_ENCOUNTER_DRAFT
          : AdmissionStep.VERIFY_PAYMENT_OR_APPROVED_CREDIT,
        lastErrorCode: condition ? null : 'PAYMENT_NOT_CLEARED',
        version: { increment: 1 },
      },
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

  async admit(caseId: string, auth: AuthContext) {
    await this.assertOperational(auth);
    const receptionCase: any = await this.getCase(caseId);
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
    await this.db.receptionCase.update({
      where: { id: caseId },
      data: {
        status: ReceptionCaseStatus.ADMISSION_IN_PROGRESS,
        lastHandledByAccountId: auth.userId,
      },
    });

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
        await this.db.admission.update({
          where: { id: admission.id },
          data: {
            status: AdmissionStatus.AWAITING_PAYMENT,
            currentStep: AdmissionStep.VERIFY_PAYMENT_OR_APPROVED_CREDIT,
            lastErrorCode: 'PAYMENT_NOT_CLEARED',
            version: { increment: 1 },
          },
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

      await this.db.admission.update({
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
      await this.db.receptionCase.update({
        where: { id: caseId },
        data: {
          status: ReceptionCaseStatus.ADMITTED,
          lastHandledByAccountId: auth.userId,
          version: { increment: 1 },
        },
      });
      return this.get(caseId);
    } catch (error) {
      await this.db.admission.update({
        where: { id: admission.id },
        data: {
          status: AdmissionStatus.FAILED_RETRYABLE,
          lastErrorCode:
            error instanceof Error ? error.message.slice(0, 100) : 'UNKNOWN',
          retryCount: { increment: 1 },
          version: { increment: 1 },
        },
      });
      throw error;
    }
  }

  private async assertOperational(auth: AuthContext): Promise<void> {
    if (auth.role === 'RECEPTIONIST') {
      await this.receptionists.assertOperational(auth);
    }
  }

  private async getCase(caseId: string): Promise<any> {
    const record = await this.db.receptionCase.findUnique({ where: { id: caseId } });
    if (!record) throw new NotFoundException('RECEPTION_CASE_NOT_FOUND');
    return record;
  }

  private async ensureBaseInvoice(receptionCase: any, auth: AuthContext) {
    let admission: any = await this.db.admission.upsert({
      where: { receptionCaseId: receptionCase.id },
      create: { receptionCaseId: receptionCase.id },
      update: {},
    });
    await this.db.receptionCase.update({
      where: { id: receptionCase.id },
      data: {
        status: ReceptionCaseStatus.ADMISSION_IN_PROGRESS,
        lastHandledByAccountId: auth.userId,
        version: { increment: 1 },
      },
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

  private timestampToDate(value: any): Date {
    return new Date(
      Number(value.seconds) * 1_000 + Math.floor(Number(value.nanos ?? 0) / 1_000_000),
    );
  }

  private timestampToIso(value: any): string | null {
    return value ? this.timestampToDate(value).toISOString() : null;
  }
}
