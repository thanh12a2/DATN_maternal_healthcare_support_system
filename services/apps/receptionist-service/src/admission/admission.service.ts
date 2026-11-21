import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  AdmissionStep,
  IdentityVerificationResult,
  Prisma,
  ReceptionCaseStatus,
  ReceptionCaseType,
} from '../../../../generated/receptionist-client';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../database/prisma.service';
import { AdmissionGrpcGateway } from './admission-grpc.gateway';
import {
  ReceptionWorkService,
  receptionCaseCode,
} from './reception-work.service';

@Injectable()
export class AdmissionService {
  constructor(
    private readonly db: PrismaService,
    private readonly remote: AdmissionGrpcGateway,
    private readonly work: ReceptionWorkService,
  ) {}

  async openCase(
    input: { appointmentId: string; patientId: string; arrivalAt?: string },
    auth: AuthContext,
  ) {
    const provisional = randomUUID();
    let existing = await this.db.receptionCase.findFirst({
      where: {
        appointmentId: input.appointmentId,
        patientId: input.patientId,
        status: { not: ReceptionCaseStatus.CANCELLED },
      },
    });
    let valid: any;
    if (
      !existing ||
      existing.status !== ReceptionCaseStatus.ADMISSION_IN_PROGRESS
    ) {
      valid = await this.remote.validateAppointment(
        input.appointmentId,
        input.patientId,
        provisional,
        auth.userId,
        provisional + ':validate',
      );
      if (!valid.valid)
        throw new ConflictException(valid.failureCode || 'APPOINTMENT_INVALID');
    }
    const identity: any = await this.remote.patientIdentity(
      input.patientId,
      auth.userId,
      provisional + ':identity-read',
    );
    let replayed = Boolean(existing);
    if (!existing) {
      const appointment: any = (
        await this.remote.getAppointment(
          input.appointmentId,
          auth.userId,
          provisional + ':appointment',
        )
      ).appointment;
      const type = ['WALK_IN', 'BOOKING_CHANNEL_WALK_IN'].includes(
        String(appointment?.channel),
      )
        ? ReceptionCaseType.WALK_IN
        : ReceptionCaseType.SCHEDULED;
      try {
        existing = await this.db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.appointmentId}, 0))::text`;
          if (
            await tx.receptionAppointmentOperation.findUnique({
              where: { appointmentId: input.appointmentId },
            })
          )
            throw new ConflictException(
              'Lịch hẹn đang được xử lý. Vui lòng thử lại.',
            );
          const created = await tx.receptionCase.create({
            data: {
              type,
              appointmentId: input.appointmentId,
              patientId: input.patientId,
              status: ReceptionCaseStatus.OPEN,
              arrivalAt: input.arrivalAt
                ? new Date(input.arrivalAt)
                : new Date(),
              scheduledStartAtSnapshot: new Date(
                Number(valid.startAt.seconds) * 1000,
              ),
              appointmentTypeSnapshot: 'SERVICE',
              openedByAccountId: auth.userId,
              lastHandledByAccountId: auth.userId,
              workClaimedBy: auth.userId,
            },
          });
          await tx.receptionAuditLog.create({
            data: {
              eventType: 'reception.work_claimed.v1',
              actorId: auth.userId,
              caseId: created.id,
              requestId: provisional,
            },
          });
          return created;
        });
      } catch (error) {
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ))
          throw error;
        existing = await this.db.receptionCase.findFirst({
          where: {
            appointmentId: input.appointmentId,
            patientId: input.patientId,
            status: { not: ReceptionCaseStatus.CANCELLED },
          },
        });
        if (!existing) throw error;
        replayed = true;
      }
    }
    if (
      replayed &&
      new Set<ReceptionCaseStatus>([
        ReceptionCaseStatus.OPEN,
        ReceptionCaseStatus.IDENTITY_VERIFIED,
        ReceptionCaseStatus.ADMISSION_IN_PROGRESS,
      ]).has(existing.status)
    )
      await this.work.claim(existing.id, auth);
    return {
      ...existing,
      caseCode: receptionCaseCode(existing.id),
      identity: identity.patient,
      replayed,
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
    return this.db.$transaction(async (tx) => {
      const result = await tx.receptionCase.updateMany({
        where: {
          id: caseId,
          status: ReceptionCaseStatus.OPEN,
          workClaimedBy: auth.userId,
          workRunningToken: null,
        },
        data: {
          ...(input.result === IdentityVerificationResult.VERIFIED
            ? { status: ReceptionCaseStatus.IDENTITY_VERIFIED }
            : {}),
          lastHandledByAccountId: auth.userId,
          version: { increment: 1 },
        },
      });
      if (!result.count)
        throw new ConflictException(
          'Case đã thay đổi hoặc bạn chưa nhận công việc.',
        );
      return tx.identityVerification.create({
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
    });
  }

  async get(caseId: string) {
    const item = await this.db.receptionCase.findUnique({
      where: { id: caseId },
      include: {
        identityVerifications: true,
        admission: { include: { history: true } },
      },
    });
    return item ? { ...item, caseCode: receptionCaseCode(item.id) } : null;
  }

  async admit(caseId: string, auth: AuthContext) {
    const token = randomUUID();
    const acquired = await this.db.receptionCase.updateMany({
      where: {
        id: caseId,
        status: {
          in: [
            ReceptionCaseStatus.IDENTITY_VERIFIED,
            ReceptionCaseStatus.ADMISSION_IN_PROGRESS,
          ],
        },
        workClaimedBy: auth.userId,
        workRunningToken: null,
      },
      data: {
        workRunningToken: token,
        workRunningAt: new Date(),
        status: ReceptionCaseStatus.ADMISSION_IN_PROGRESS,
        lastHandledByAccountId: auth.userId,
      },
    });
    if (!acquired.count)
      throw new ConflictException(
        'Case đã thay đổi, đang xử lý hoặc bạn chưa nhận công việc.',
      );
    let admissionId: string | undefined;
    try {
      const c = await this.db.receptionCase.findUniqueOrThrow({
        where: { id: caseId },
      });
      const admission = await this.db.admission.upsert({
        where: { receptionCaseId: caseId },
        create: { receptionCaseId: caseId },
        update: {},
      });
      admissionId = admission.id;
      const key = (step: string) => admission.id + ':' + step;
      await this.assertRunning(caseId, token, auth);
      const app: any = (
        await this.remote.getAppointment(
          c.appointmentId!,
          auth.userId,
          key('appointment'),
        )
      ).appointment;
      const alreadyCheckedIn =
        ['CHECKED_IN', 'APPOINTMENT_STATUS_CHECKED_IN'].includes(
          String(app?.status),
        ) &&
        app.patientId === c.patientId &&
        app.receptionCaseId === caseId &&
        Boolean(app.encounterId);
      if (alreadyCheckedIn) {
        if (!admission.invoiceId)
          throw new ConflictException('Thiếu hóa đơn để tiếp tục tiếp nhận.');
        await this.assertRunning(caseId, token, auth);
        const clearance: any = await this.remote.paymentCondition(
          admission.invoiceId,
          c.appointmentId!,
          auth.userId,
          key('payment'),
        );
        const raw = String(clearance?.condition ?? '');
        const condition = [
          '1',
          'ADMISSION_PAYMENT_CONDITION_PAID',
          'PAID',
        ].includes(raw)
          ? 'PAID'
          : [
                '2',
                'ADMISSION_PAYMENT_CONDITION_APPROVED_CREDIT',
                'APPROVED_CREDIT',
              ].includes(raw)
            ? 'APPROVED_CREDIT'
            : '';
        if (!condition) throw new ConflictException('PAYMENT_NOT_CLEARED');
        await this.step(
          admission.id,
          caseId,
          token,
          auth,
          AdmissionStep.CREATE_AUTHORITATIVE_QUEUE_TICKET,
          {
            appointmentCheckedInAt:
              admission.appointmentCheckedInAt ?? new Date(),
            encounterId: app.encounterId,
          },
        );
        const queued: any = await this.remote.createQueue(
          app,
          caseId,
          admission.invoiceId,
          app.encounterId,
          condition,
          auth.userId,
          key('queue'),
        );
        await this.finish(admission.id, caseId, token, auth, queued);
        return this.get(caseId);
      }
      await this.assertRunning(caseId, token, auth);
      const valid: any = await this.remote.validateAppointment(
        c.appointmentId!,
        c.patientId,
        caseId,
        auth.userId,
        key('validate'),
      );
      if (!valid.valid) throw new ConflictException(valid.failureCode);
      await this.step(
        admission.id,
        caseId,
        token,
        auth,
        AdmissionStep.CREATE_OR_GET_BASE_INVOICE,
        {},
      );
      const inv: any = await this.remote.createInvoice(
        app,
        caseId,
        auth.userId,
        key('invoice'),
      );
      const invoice = inv.invoice;
      const invoiceId =
        (invoice?.invoiceId || invoice?.id || '').trim() || null;
      await this.step(
        admission.id,
        caseId,
        token,
        auth,
        AdmissionStep.VERIFY_PAYMENT_OR_APPROVED_CREDIT,
        { invoiceId },
      );
      const clearance: any = await this.remote.paymentCondition(
        invoiceId || invoice.invoiceId,
        c.appointmentId!,
        auth.userId,
        key('payment'),
      );
      const raw = String(clearance?.condition ?? '');
      const condition = [
        '1',
        'ADMISSION_PAYMENT_CONDITION_PAID',
        'PAID',
      ].includes(raw)
        ? 'PAID'
        : [
              '2',
              'ADMISSION_PAYMENT_CONDITION_APPROVED_CREDIT',
              'APPROVED_CREDIT',
            ].includes(raw)
          ? 'APPROVED_CREDIT'
          : raw.replace('ADMISSION_PAYMENT_CONDITION_', '');
      if (!['PAID', 'APPROVED_CREDIT'].includes(condition)) {
        await this.step(
          admission.id,
          caseId,
          token,
          auth,
          AdmissionStep.VERIFY_PAYMENT_OR_APPROVED_CREDIT,
          {
            status: AdmissionStatus.AWAITING_PAYMENT,
            lastErrorCode: 'PAYMENT_NOT_CLEARED',
          },
        );
        return this.get(caseId);
      }
      await this.step(
        admission.id,
        caseId,
        token,
        auth,
        AdmissionStep.OPEN_CLINICAL_ENCOUNTER_DRAFT,
        { status: AdmissionStatus.IN_PROGRESS, lastErrorCode: null },
      );
      const opened: any = await this.remote.openEncounter(
        app,
        invoiceId || invoice.invoiceId,
        caseId,
        auth.userId,
        key('encounter'),
      );
      const encounterId = opened.encounter.encounterId;
      await this.step(
        admission.id,
        caseId,
        token,
        auth,
        AdmissionStep.CHECK_IN_APPOINTMENT,
        { encounterId, medicalRecordId: encounterId },
      );
      const checked: any = await this.remote.checkIn(
        app,
        caseId,
        invoiceId || invoice.invoiceId,
        encounterId,
        condition,
        auth.userId,
        key('checkin'),
      );
      await this.step(
        admission.id,
        caseId,
        token,
        auth,
        AdmissionStep.CREATE_AUTHORITATIVE_QUEUE_TICKET,
        { appointmentCheckedInAt: new Date() },
      );
      const queued: any = await this.remote.createQueue(
        checked.appointment,
        caseId,
        invoiceId || invoice.invoiceId,
        encounterId,
        condition,
        auth.userId,
        key('queue'),
      );
      await this.finish(admission.id, caseId, token, auth, queued);
      return this.get(caseId);
    } catch (error) {
      if (admissionId)
        await this.db.admission.updateMany({
          where: {
            id: admissionId,
            receptionCase: {
              workRunningToken: token,
              workClaimedBy: auth.userId,
            },
          },
          data: {
            status: AdmissionStatus.FAILED_RETRYABLE,
            lastErrorCode:
              error instanceof Error ? error.message.slice(0, 100) : 'UNKNOWN',
            retryCount: { increment: 1 },
          },
        });
      throw error;
    } finally {
      await this.db.receptionCase.updateMany({
        where: { id: caseId, workRunningToken: token },
        data: { workRunningToken: null, workRunningAt: null },
      });
    }
  }

  private async assertRunning(
    caseId: string,
    token: string,
    auth: AuthContext,
  ) {
    const owned = await this.db.receptionCase.findFirst({
      where: {
        id: caseId,
        workRunningToken: token,
        workClaimedBy: auth.userId,
      },
      select: { id: true },
    });
    if (!owned) throw new ConflictException('Quyền xử lý case đã hết hạn.');
  }
  private async finish(
    id: string,
    caseId: string,
    token: string,
    auth: AuthContext,
    queued: any,
  ) {
    await this.db.$transaction(async (tx) => {
      const completed = await tx.receptionCase.updateMany({
        where: {
          id: caseId,
          workRunningToken: token,
          workClaimedBy: auth.userId,
        },
        data: { status: ReceptionCaseStatus.ADMITTED },
      });
      if (!completed.count)
        throw new ConflictException('Quyền xử lý case đã hết hạn.');
      await tx.admission.update({
        where: { id },
        data: {
          currentStep: AdmissionStep.DONE,
          queueJourneyId: queued.journey.journeyId,
          queueTicketId: queued.initialTicket.ticketId,
          queueTicketCode: queued.initialTicket.ticketCode || null,
          queueRoomCode: queued.initialTicket.roomCode || null,
          notificationDismissedAt: null,
          status: AdmissionStatus.COMPLETED,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
    });
  }
  private async step(
    id: string,
    caseId: string,
    token: string,
    auth: AuthContext,
    currentStep: AdmissionStep,
    data: any,
  ) {
    const updated = await this.db.admission.updateMany({
      where: {
        id,
        receptionCaseId: caseId,
        receptionCase: { workRunningToken: token, workClaimedBy: auth.userId },
      },
      data: { ...data, currentStep, version: { increment: 1 } },
    });
    if (!updated.count)
      throw new ConflictException('Quyền xử lý case đã hết hạn.');
  }
}
