import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dateToTimestamp, GrpcClientFactory, type DomainEventEnvelope } from '@platform';
import { AppPrismaService } from '../database/prisma.service';
import { renderAppointmentEmail, renderClinicalEmail, renderResultsEmail } from './email-templates';
import { SmtpEmailService } from './smtp-email.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class EmailDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailDeliveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: AppPrismaService, private readonly config: ConfigService, private readonly grpc: GrpcClientFactory, private readonly smtp: SmtpEmailService) {}
  onModuleInit() { this.timer = setInterval(() => void this.flush(), 10000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async enqueuePayment(event: DomainEventEnvelope) {
    const data = event.data as { patientId?: string; appointmentId?: string; status?: string };
    if (event.eventType !== 'billing.payment_recorded.v1' || event.eventVersion !== 1 || data?.status !== 'PAID' || !UUID.test(event.eventId ?? '') || !UUID.test(data.patientId ?? '') || !UUID.test(data.appointmentId ?? '') || !Number.isFinite(Date.parse(event.occurredAt))) return;
    await this.db.notificationEmailJob.upsert({ where: { eventId_kind: { eventId: event.eventId, kind: 'APPOINTMENT_PAID' } }, create: { eventId: event.eventId, kind: 'APPOINTMENT_PAID', appointmentId: data.appointmentId!, patientId: data.patientId!, occurredAt: new Date(event.occurredAt) }, update: {} });
  }

  async enqueueClinical(event: DomainEventEnvelope) {
    const data = event.data as { patientId?: string; appointmentId?: string; encounterId?: string; state?: string };
    if (event.eventType !== 'medical.encounter_finalized.v1' || event.eventVersion !== 1 || data?.state !== 'FINALIZED' || !UUID.test(event.eventId ?? '') || !UUID.test(data.patientId ?? '') || !UUID.test(data.appointmentId ?? '') || !UUID.test(data.encounterId ?? '') || !Number.isFinite(Date.parse(event.occurredAt))) return;
    await this.db.$transaction(async tx => {
      for (const kind of ['CLINICAL_SUMMARY', 'CLINICAL_RESULTS']) await tx.notificationEmailJob.upsert({ where: { eventId_kind: { eventId: event.eventId, kind } }, create: { eventId: event.eventId, kind, appointmentId: data.appointmentId!, patientId: data.patientId!, encounterId: data.encounterId!, occurredAt: new Date(event.occurredAt) }, update: {} });
    });
  }

  async flush() {
    if (this.running || !this.config.get('NOTIFICATION_SMTP_HOST')) return;
    this.running = true;
    try {
      for (let i = 0; i < 10; i++) {
        let jobId = '';
        try {
          const processed = await this.db.$transaction(async tx => {
            const rows = await tx.$queryRaw<{ id: string; kind: string; event_id: string; appointment_id: string; patient_id: string; encounter_id: string | null; occurred_at: Date }[]>`SELECT id, kind, event_id, appointment_id, patient_id, encounter_id, occurred_at FROM notification_email_jobs WHERE kind IN ('APPOINTMENT_PAID', 'CLINICAL_SUMMARY', 'CLINICAL_RESULTS') AND status = 'PENDING' AND next_attempt_at <= now() ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`;
            const job = rows[0]; if (!job) return false;
            jobId = job.id;
            const patient = await this.call<any>('patient-email', 'PATIENT_GRPC_TARGET', 'patient-service:6004', 'patient/v1/patient_internal.proto', 'maternal.patient.v1', 'PatientInternalService', 'resolveNotificationAccount', { patientId: job.patient_id }, 'patient-service', 'patient:notification-account:read');
            if (!patient.found || !patient.accountId || !patient.patientName) { await tx.notificationEmailJob.update({ where: { id: job.id }, data: { lastError: 'PATIENT_ACCOUNT_UNAVAILABLE', nextAttemptAt: new Date(Date.now() + 3600000) } }); return true; }
            const recipient = await this.call<any>('auth-email', 'AUTH_GRPC_TARGET', 'auth-service:6003', 'auth/v1/auth_internal.proto', 'maternal.auth.v1', 'AuthInternalService', 'getVerifiedPatientEmail', { accountId: patient.accountId }, 'auth-service', 'auth:verified-patient-email:read');
            if (!recipient.found || !recipient.email) { await tx.notificationEmailJob.update({ where: { id: job.id }, data: { lastError: 'EMAIL_NOT_VERIFIED', nextAttemptAt: new Date(Date.now() + 3600000) } }); return true; }
            const response = await this.call<any>('appointment-email', 'APPOINTMENT_GRPC_TARGET', 'appointment-service:6008', 'appointment/v1/appointment_internal.proto', 'maternal.appointment.v1', 'AppointmentInternalService', 'getAppointment', { appointmentId: job.appointment_id }, 'appointment-service', 'appointment:internal:read');
            const appointment = response.appointment;
            if (!appointment || appointment.patientId !== job.patient_id) throw new Error('APPOINTMENT_PATIENT_MISMATCH');
            if (appointment.status === 'APPOINTMENT_STATUS_CANCELLED') { await tx.notificationEmailJob.update({ where: { id: job.id }, data: { status: 'SUPPRESSED', lastError: 'APPOINTMENT_CANCELLED' } }); return true; }
            if (!appointment.appointmentCode) throw new Error('APPOINTMENT_DATA_INCOMPLETE');
            let sent: { providerMessageId: string };
            if (job.kind === 'APPOINTMENT_PAID') {
              let doctorName = '';
              if (appointment.assignedDoctorId) {
                const doctor = await this.call<any>('doctor-email', 'DOCTOR_GRPC_TARGET', 'doctor-service:6005', 'doctor/v1/doctor_internal.proto', 'maternal.doctor.v1', 'DoctorInternalService', 'getDoctorEligibility', { doctorId: appointment.assignedDoctorId }, 'doctor-service', 'doctor:internal:read');
                doctorName = doctor.doctor?.displayName ?? '';
              }
              const startAt = new Date(Number(appointment.startAt?.seconds) * 1000);
              if (!Number.isFinite(startAt.getTime()) || !appointment.pricing?.serviceName) throw new Error('APPOINTMENT_DATA_INCOMPLETE');
              const endSeconds = Number(appointment.endAt?.seconds);
              const endAt = Number.isFinite(endSeconds) && endSeconds > 0 ? new Date(endSeconds * 1000) : undefined;
              const email = renderAppointmentEmail({ patientName: patient.patientName, patientCode: `PA-${job.patient_id.slice(0, 8).toUpperCase()}`, dateOfBirth: patient.dateOfBirth, address: patient.address, appointmentCode: appointment.appointmentCode, serviceName: appointment.pricing.serviceName, startAt, endAt, doctorName, roomName: appointment.roomName || appointment.roomCode });
              sent = await this.smtp.send(recipient.email, email, `<${job.id}@notification.local>`);
            } else {
              if (!job.encounter_id || !UUID.test(job.encounter_id)) throw new Error('INVALID_ENCOUNTER');
              const request = { encounterId: job.encounter_id, patientId: job.patient_id, cutoff: dateToTimestamp(job.occurred_at) };
              if (job.kind === 'CLINICAL_SUMMARY') {
                const prescriptions = await this.call<any>('prescription-email', 'PRESCRIPTION_GRPC_TARGET', 'prescription-service:6014', 'prescription/v1/prescription_internal.proto', 'maternal.prescription.v1', 'PrescriptionInternalService', 'listIssuedForEmail', request, 'prescription-service', 'prescription:email:read');
                const plans = await this.call<any>('treatment-email', 'TREATMENT_PLAN_GRPC_TARGET', 'treatment-plan-service:6015', 'treatment_plan/v1/treatment_plan_internal.proto', 'maternal.treatment_plan.v1', 'TreatmentPlanInternalService', 'listForEmail', request, 'treatment-plan-service', 'treatment:email:read');
                if ((prescriptions.prescriptions ?? []).some((p: any) => p.patientId !== job.patient_id || p.encounterId !== job.encounter_id) || (plans.plans ?? []).some((p: any) => p.patientId !== job.patient_id || p.sourceEncounterId !== job.encounter_id)) throw new Error('CLINICAL_PATIENT_MISMATCH');
                const email = renderClinicalEmail({ patientName: patient.patientName, appointmentCode: appointment.appointmentCode, prescriptions: (prescriptions.prescriptions ?? []).map((p: any) => ({ items: (p.items ?? []).map((item: any) => ({ name: item.medicationName, strength: item.strength, dose: item.dose, route: item.route, frequency: item.frequency, durationDays: item.durationDays, instruction: item.instruction })) })), treatmentPlans: (plans.plans ?? []).map((plan: any) => ({ title: plan.title, summary: plan.summary, items: plan.items ?? [] })) });
                sent = await this.smtp.send(recipient.email, email, `<${job.id}@notification.local>`);
              } else {
                const files = await this.call<any>('document-email', 'DOCUMENT_GRPC_TARGET', 'document-service:6013', 'document/v1/document_internal.proto', 'maternal.document.v1', 'DocumentInternalService', 'getClinicalFilesForEmail', request, 'document-service', 'document:clinical-email:read', 12 * 1024 * 1024);
                if (!files.files?.length) { await tx.notificationEmailJob.update({ where: { id: job.id }, data: { status: 'SUPPRESSED', lastError: 'NO_RESULTS_AT_FINALIZATION' } }); return true; }
                sent = await this.smtp.send(recipient.email, renderResultsEmail(patient.patientName, appointment.appointmentCode), `<${job.id}@notification.local>`, files.files.map((file: any) => ({ fileName: file.fileName, mediaType: file.mediaType, content: Buffer.from(file.content) })));
              }
            }
            await tx.notificationEmailJob.update({ where: { id: job.id }, data: { status: 'SENT', sentAt: new Date(), providerMessageId: sent.providerMessageId.slice(0, 200), lastError: null, attempts: { increment: 1 } } });
            return true;
          }, { timeout: 60000 });
          if (!processed) break;
        } catch (error) {
          this.logger.warn(`Email delivery failed: ${error instanceof Error ? error.name : 'unknown'}`);
          if (jobId) await this.db.notificationEmailJob.updateMany({ where: { id: jobId, status: 'PENDING' }, data: { attempts: { increment: 1 }, lastError: 'DELIVERY_FAILED', nextAttemptAt: new Date(Date.now() + 60000) } });
          else break;
        }
      }
    } catch { this.logger.warn('Email job worker unavailable'); }
    finally { this.running = false; }
  }

  private call<T>(key: string, env: string, target: string, proto: string, pkg: string, service: string, method: string, data: object, audience: string, scope: string, maxReceiveBytes?: number) {
    const client = this.grpc.client({ key, target: this.config.get<string>(env) ?? target, proto, package: pkg, service, maxReceiveBytes });
    return this.grpc.unary<object, T>(client, method, data, this.grpc.metadata(audience, [scope]));
  }
}
