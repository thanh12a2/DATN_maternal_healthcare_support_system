import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory, dateToTimestamp } from '@platform';

type SearchAppointmentInput = {
  patientId: string;
  appointmentCode?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

type SearchBookableSlotsInput = {
  serviceId: string;
  selectionMode: 'DOCTOR' | 'RANK';
  requestedDoctorId?: string;
  requestedRankCode?: string;
  from: string;
  to: string;
  limit?: number;
};

type BookAppointmentInput = {
  patientId: string;
  serviceId: string;
  selectionMode: 'DOCTOR' | 'RANK';
  requestedDoctorId?: string;
  requestedRankCode?: string;
  startAt: string;
  endAt: string;
  channel: 'RECEPTION' | 'WALK_IN';
};

@Injectable()
export class AdmissionGrpcGateway {
  constructor(
    private readonly config: ConfigService,
    private readonly grpc: GrpcClientFactory,
  ) {}

  private context(actorAccountId: string, key: string) {
    return {
      requestId: key,
      correlationId: key,
      idempotencyKey: key,
      actorAccountId,
      actorRole: 'RECEPTIONIST',
    };
  }

  private async call(
    clientKey: string,
    targetKey: string,
    proto: string,
    packageName: string,
    service: string,
    method: string,
    request: any,
    audience: string,
    scopes: string[],
    write = true,
  ): Promise<any> {
    const target =
      this.config.get<string>(targetKey) ?? this.fallbackTarget(targetKey);
    const client = this.grpc.client({
      key: clientKey,
      target,
      proto,
      package: packageName,
      service,
    });
    const metadata = this.grpc.metadata(
      audience,
      scopes,
      {
        requestId: request.context.requestId,
        correlationId: request.context.correlationId,
        idempotencyKey: write ? request.context.idempotencyKey : undefined,
      },
    );
    return this.grpc.unary(
      client,
      method,
      request,
      metadata,
      write ? 3_000 : 2_000,
    );
  }

  searchPatients(phoneNumber: string, actor: string, key: string) {
    return this.call(
      'patient-search',
      'PATIENT_GRPC_TARGET',
      'patient/v1/patient_internal.proto',
      'maternal.patient.v1',
      'PatientInternalService',
      'searchPatients',
      {
        context: this.context(actor, key),
        normalizedPhone: phoneNumber,
        page: { pageSize: 50 },
      },
      'patient-service',
      ['patient:search'],
      false,
    );
  }

  searchAppointments(
    input: SearchAppointmentInput,
    actor: string,
    key: string,
  ) {
    return this.call(
      'appointment-search',
      'APPOINTMENT_GRPC_TARGET',
      'appointment/v1/appointment_internal.proto',
      'maternal.appointment.v1',
      'AppointmentInternalService',
      'searchForReception',
      {
        context: this.context(actor, key),
        patientId: input.patientId,
        appointmentCode: input.appointmentCode ?? '',
        from: input.from ? dateToTimestamp(new Date(input.from)) : undefined,
        to: input.to ? dateToTimestamp(new Date(input.to)) : undefined,
        page: {
          pageSize: input.limit ?? 20,
          pageToken: input.cursor ?? '',
        },
      },
      'appointment-service',
      ['appointment:admission:read'],
      false,
    );
  }

  searchBookableSlots(
    input: SearchBookableSlotsInput,
    actor: string,
    key: string,
  ) {
    return this.call(
      'appointment-bookable-slots',
      'APPOINTMENT_GRPC_TARGET',
      'appointment/v1/appointment_internal.proto',
      'maternal.appointment.v1',
      'AppointmentInternalService',
      'searchBookableSlotsForReception',
      {
        context: this.context(actor, key),
        serviceId: input.serviceId,
        selectionMode: `SELECTION_MODE_${input.selectionMode}`,
        requestedDoctorId: input.requestedDoctorId ?? '',
        requestedRankCode: input.requestedRankCode ?? '',
        from: dateToTimestamp(new Date(input.from)),
        to: dateToTimestamp(new Date(input.to)),
        page: { pageSize: input.limit ?? 20, pageToken: '' },
      },
      'appointment-service',
      ['appointment:booking:read'],
      false,
    );
  }

  bookAppointment(input: BookAppointmentInput, actor: string, key: string) {
    return this.call(
      'appointment-book-for-reception',
      'APPOINTMENT_GRPC_TARGET',
      'appointment/v1/appointment_internal.proto',
      'maternal.appointment.v1',
      'AppointmentInternalService',
      'bookForReception',
      {
        context: this.context(actor, key),
        patientId: input.patientId,
        serviceId: input.serviceId,
        selectionMode: `SELECTION_MODE_${input.selectionMode}`,
        requestedDoctorId: input.requestedDoctorId ?? '',
        requestedRankCode: input.requestedRankCode ?? '',
        startAt: dateToTimestamp(new Date(input.startAt)),
        endAt: dateToTimestamp(new Date(input.endAt)),
        channel: `BOOKING_CHANNEL_${input.channel}`,
      },
      'appointment-service',
      ['appointment:booking:write'],
    );
  }

  validateAppointment(
    appointmentId: string,
    patientId: string,
    caseId: string,
    actor: string,
    key: string,
  ) {
    return this.call(
      'appointment-validate',
      'APPOINTMENT_GRPC_TARGET',
      'appointment/v1/appointment_internal.proto',
      'maternal.appointment.v1',
      'AppointmentInternalService',
      'validateForAdmission',
      {
        context: this.context(actor, key),
        appointmentId,
        patientId,
        receptionCaseId: caseId,
      },
      'appointment-service',
      ['appointment:admission:read'],
      false,
    );
  }

  getAppointment(appointmentId: string, actor: string, key: string) {
    return this.call(
      'appointment-read',
      'APPOINTMENT_GRPC_TARGET',
      'appointment/v1/appointment_internal.proto',
      'maternal.appointment.v1',
      'AppointmentInternalService',
      'getAppointment',
      {
        context: this.context(actor, key),
        appointmentId,
      },
      'appointment-service',
      ['appointment:internal:read'],
      false,
    );
  }

  patientIdentity(patientId: string, actor: string, key: string) {
    return this.call(
      'patient-identity',
      'PATIENT_GRPC_TARGET',
      'patient/v1/patient_internal.proto',
      'maternal.patient.v1',
      'PatientInternalService',
      'getPatientIdentity',
      {
        context: this.context(actor, key),
        patientId,
        purpose: 'ADMISSION_IDENTITY_VERIFICATION',
      },
      'patient-service',
      ['patient:identity:read'],
      false,
    );
  }

  createInvoice(appointment: any, caseId: string, actor: string, key: string) {
    const pricing = appointment.pricing;
    return this.call(
      'billing-write',
      'BILLING_GRPC_TARGET',
      'billing/v1/billing_internal.proto',
      'maternal.billing.v1',
      'BillingInternalService',
      'createOrGetBaseInvoice',
      {
        context: this.context(actor, key),
        appointmentId: appointment.appointmentId,
        patientId: appointment.patientId,
        appointmentVersion: appointment.version,
        receptionCaseId: caseId,
        pricing: {
          serviceId: appointment.serviceId,
          serviceName: pricing.serviceName,
          serviceVersion: pricing.serviceVersion,
          assignedRankCode: appointment.assignedRankCode,
          basePriceId: pricing.basePriceId,
          baseAmount: pricing.baseAmount,
          rankSurchargePriceId: pricing.rankSurchargePriceId,
          rankSurchargeAmount: pricing.rankSurchargeAmount,
          estimatedTotal: pricing.estimatedTotal,
        },
      },
      'billing-service',
      ['billing:invoice:write'],
    );
  }

  paymentCondition(
    invoiceId: string,
    appointmentId: string,
    actor: string,
    key: string,
  ) {
    return this.call(
      'billing-read',
      'BILLING_GRPC_TARGET',
      'billing/v1/billing_internal.proto',
      'maternal.billing.v1',
      'BillingInternalService',
      'getAdmissionPaymentCondition',
      {
        context: this.context(actor, key),
        invoiceId,
        appointmentId,
      },
      'billing-service',
      ['billing:read'],
      false,
    );
  }

  getInvoice(invoiceId: string, actor: string, key: string) {
    return this.call(
      'billing-invoice-read',
      'BILLING_GRPC_TARGET',
      'billing/v1/billing_internal.proto',
      'maternal.billing.v1',
      'BillingInternalService',
      'getInvoice',
      {
        context: this.context(actor, key),
        invoiceId,
      },
      'billing-service',
      ['billing:read'],
      false,
    );
  }

  recordAdmissionPayment(
    input: {
      invoiceId: string;
      method: 'CASH' | 'MANUAL_BANK_TRANSFER';
      amountMinor: number;
      receivedAt: string;
      reference?: string;
      manualTransferReference?: string;
      expectedInvoiceVersion: number;
    },
    actor: string,
    key: string,
  ) {
    return this.call(
      'billing-payment-write',
      'BILLING_GRPC_TARGET',
      'billing/v1/billing_internal.proto',
      'maternal.billing.v1',
      'BillingInternalService',
      'recordAdmissionPayment',
      {
        context: this.context(actor, key),
        invoiceId: input.invoiceId,
        method: `PAYMENT_METHOD_${input.method}`,
        amount: { amountMinor: String(input.amountMinor), currencyCode: 'VND' },
        receivedAt: dateToTimestamp(new Date(input.receivedAt)),
        reference: input.reference ?? '',
        manualTransferReference: input.manualTransferReference ?? '',
        expectedInvoiceVersion: String(input.expectedInvoiceVersion),
      },
      'billing-service',
      ['billing:payment:write'],
    );
  }

  openEncounter(
    appointment: any,
    invoiceId: string,
    paymentCondition: string,
    caseId: string,
    actor: string,
    key: string,
  ) {
    return this.call(
      'medical-write',
      'MEDICAL_RECORD_GRPC_TARGET',
      'medical_record/v1/medical_record_internal.proto',
      'maternal.medical_record.v1',
      'MedicalRecordInternalService',
      'openOrGetEncounter',
      {
        context: this.context(actor, key),
        appointmentId: appointment.appointmentId,
        patientId: appointment.patientId,
        primaryDoctorId: appointment.assignedDoctorId,
        admission: {
          receptionCaseId: caseId,
          invoiceId,
          paymentCondition,
          checkedInAt: dateToTimestamp(new Date()),
        },
      },
      'medical-record-service',
      ['medical:encounter:open'],
    );
  }

  checkIn(
    appointment: any,
    caseId: string,
    invoiceId: string,
    encounterId: string,
    paymentCondition: string,
    actor: string,
    key: string,
  ) {
    return this.call(
      'appointment-checkin',
      'APPOINTMENT_GRPC_TARGET',
      'appointment/v1/appointment_internal.proto',
      'maternal.appointment.v1',
      'AppointmentInternalService',
      'checkInAppointment',
      {
        context: this.context(actor, key),
        appointmentId: appointment.appointmentId,
        receptionCaseId: caseId,
        invoiceId,
        paymentCondition: `ADMISSION_PAYMENT_CONDITION_${paymentCondition}`,
        encounterId,
        checkedInAt: dateToTimestamp(new Date()),
        expectedVersion: appointment.version,
      },
      'appointment-service',
      ['appointment:checkin'],
    );
  }

  createQueue(
    appointment: any,
    caseId: string,
    invoiceId: string,
    encounterId: string,
    paymentCondition: string,
    actor: string,
    key: string,
  ) {
    return this.call(
      'queue-write',
      'QUEUE_GRPC_TARGET',
      'queue/v1/queue_internal.proto',
      'maternal.queue.v1',
      'QueueInternalService',
      'createOrGetJourney',
      {
        context: this.context(actor, key),
        appointmentId: appointment.appointmentId,
        patientId: appointment.patientId,
        encounterId,
        initialStageCode: 'CONSULTATION',
        roomCode: '',
        scheduledAt: appointment.startAt,
        arrivalAt: dateToTimestamp(new Date()),
        admission: {
          receptionCaseId: caseId,
          invoiceId,
          paymentCondition,
          checkedInAt: dateToTimestamp(new Date()),
        },
      },
      'queue-service',
      ['queue:journey:create'],
    );
  }

  private fallbackTarget(key: string): string {
    return (
      {
        APPOINTMENT_GRPC_TARGET: 'appointment-service:6008',
        PATIENT_GRPC_TARGET: 'patient-service:6004',
        BILLING_GRPC_TARGET: 'billing-service:6009',
        MEDICAL_RECORD_GRPC_TARGET: 'medical-record-service:6011',
        QUEUE_GRPC_TARGET: 'queue-service:6012',
      } as Record<string, string>
    )[key];
  }
}
