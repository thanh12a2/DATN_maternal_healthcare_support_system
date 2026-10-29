import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicAuthContext } from '@platform';
import type { ConsultationAccessGateway } from './consultation-access.gateway';
import { createHash, randomUUID } from 'node:crypto';
import {
  ConsultationStatus,
  EscalationStatus,
} from '../../../generated/consultation-client';
import { AppPrismaService } from './database/prisma.service';

@Injectable()
export class ConsultationService {
  constructor(private readonly db: AppPrismaService) {}

  async create(r: any) {
    const doctorId = r.doctorId || r.assignedDoctorId || null;
    const status = doctorId
      ? ConsultationStatus.ASSIGNED
      : ConsultationStatus.OPEN;

    const thread = await this.db.consultationThread.create({
      data: {
        patientId: r.patientId,
        appointmentId: r.appointmentId || null,
        subject: r.subject || r.topic || 'Hỏi đáp thai kỳ',
        status,
        assignedDoctorId: doctorId,
        createdByAccountId: r.actorId,
        assignments: doctorId
          ? {
              create: {
                doctorId,
                assignedBy: r.actorId,
                status: 'ACTIVE',
              },
            }
          : undefined,
      },
      include: { assignments: true },
    });

    return { data: this.view(thread) };
  }

  async list(q: any, auth: PublicAuthContext, access: ConsultationAccessGateway) {
    const where: any = {};
    if (auth.role === 'PATIENT') {
      const patientId = await access.assertPatientOwner(undefined, auth);
      where.patientId = patientId;
    } else if (auth.role === 'DOCTOR') {
      const doctorId = await access.doctorId(auth);
      where.assignedDoctorId = doctorId;
      where.OR = [{ status: ConsultationStatus.CLOSED }, { assignments: { some: { doctorId, status: 'ACTIVE' } } }];
    }
    if (q?.status) where.status = q.status;

    const limit = Math.min(Math.max(Number(q?.limit) || 50, 1), 100);
    const found = await this.db.consultationThread.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(q?.cursor ? { cursor: { id: String(q.cursor) }, skip: 1 } : {}),
    });
    const rows = found.slice(0, limit);
    const meta = { nextCursor: found.length > limit ? rows[rows.length - 1].id : null };
    if (auth.role !== 'DOCTOR') return { data: rows.map((x) => this.view(x)), meta };
    const data = await Promise.all(rows.map(async (x) => {
      const receipt = await this.db.consultationReadReceipt.findUnique({ where: { threadId_accountId: { threadId: x.id, accountId: auth.userId } } });
      const unreadCount = await this.db.consultationMessage.count({ where: { threadId: x.id, sequenceNo: { gt: receipt?.lastReadSequence ?? 0n }, senderAccountId: { not: auth.userId } } });
      return { ...this.view(x), unreadCount };
    }));
    return { data, meta };
  }

  async assign(id: string, doctorId: string, actor: string) {
    const updated = await this.db.$transaction(async (tx) => {
      await tx.consultationAssignment.updateMany({
        where: { threadId: id, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      await tx.consultationAssignment.create({
        data: { threadId: id, doctorId, assignedBy: actor },
      });
      return tx.consultationThread.update({
        where: { id },
        data: {
          assignedDoctorId: doctorId,
          status: ConsultationStatus.ASSIGNED,
          version: { increment: 1 },
        },
      });
    });
    return { data: this.view(updated) };
  }

  async message(id: string, r: any) {
    const t = await this.raw(id);
    if (t.status === ConsultationStatus.CLOSED) throw new ConflictException('CONSULTATION_CLOSED');
    const next = t.lastSequenceNo + 1n;
    const body = String(r.body ?? r.content ?? '').trim();
    const clientMessageId = r.clientMessageId || randomUUID();
    const m = await this.db.consultationMessage.upsert({
      where: {
        threadId_senderAccountId_clientMessageId: {
          threadId: id,
          senderAccountId: r.senderAccountId,
          clientMessageId,
        },
      },
      create: {
        threadId: id,
        sequenceNo: next,
        senderAccountId: r.senderAccountId,
        senderType: r.senderType,
        clientMessageId,
        body,
        bodyHash: createHash('sha256').update(body).digest('hex'),
      },
      update: {},
    });
    await this.db.consultationThread.update({
      where: { id },
      data: {
        lastSequenceNo: next,
        lastMessageAt: new Date(),
        status:
          r.senderType === 'DOCTOR'
            ? ConsultationStatus.ANSWERED
            : t.status,
        version: { increment: 1 },
      },
    });
    return {
      data: {
        id: m.id,
        threadId: m.threadId,
        sequenceNo: Number(m.sequenceNo),
        senderAccountId: m.senderAccountId,
        senderType: m.senderType,
        body: m.body,
        sentAt: m.sentAt ? m.sentAt.toISOString() : null,
      },
    };
  }

  async close(id: string) {
    const t = await this.raw(id);
    if (t.status === ConsultationStatus.CLOSED) return { data: this.view(t) };
    const updated = await this.db.consultationThread.update({
      where: { id },
      data: { status: ConsultationStatus.CLOSED, version: { increment: 1 } },
    });
    return { data: this.view(updated) };
  }

  async get(id: string) {
    const t = await this.db.consultationThread.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('CONSULTATION_NOT_FOUND');
    return this.view(t);
  }

  async getRest(id: string) {
    return { data: await this.get(id) };
  }

  async byAppointment(id: string) {
    const t = await this.db.consultationThread.findFirst({
      where: { appointmentId: id },
    });
    return { consultation: t ? this.view(t) : undefined, found: Boolean(t) };
  }

  async messages(id: string, limit = 50) {
    const rows = await this.db.consultationMessage.findMany({
      where: { threadId: id },
      orderBy: { sequenceNo: 'desc' },
      take: Math.min(limit, 100),
    });
    return {
      messages: rows.reverse().map((x) => ({
        id: x.id,
        consultationId: x.threadId,
        senderId: x.senderAccountId,
        senderRole: 'PARTICIPANT_ROLE_' + x.senderType,
        type: 'MESSAGE_TYPE_TEXT',
        content: x.body,
        createdAt: this.time(x.sentAt),
      })),
      hasMore: rows.length >= limit,
    };
  }

  async messagesRest(id: string, limit = 50, afterSequence = 0) {
    const rows = await this.db.consultationMessage.findMany({
      where: { threadId: id, sequenceNo: { gt: BigInt(afterSequence) } },
      orderBy: { sequenceNo: 'asc' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 100),
    });
    return {
      data: rows.map((x) => ({
        id: x.id,
        threadId: x.threadId,
        sequenceNo: Number(x.sequenceNo),
        senderAccountId: x.senderAccountId,
        senderType: x.senderType,
        body: x.body,
        sentAt: x.sentAt ? x.sentAt.toISOString() : null,
      })),
    };
  }

  async markRead(id: string, accountId: string, sequence: number) {
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new ConflictException('INVALID_SEQUENCE');
    const thread = await this.raw(id);
    if (BigInt(sequence) > thread.lastSequenceNo) throw new ConflictException('INVALID_SEQUENCE');
    await this.db.consultationReadReceipt.createMany({ data: [{ threadId: id, accountId, lastReadSequence: 0n }], skipDuplicates: true });
    await this.db.consultationReadReceipt.updateMany({ where: { threadId: id, accountId, lastReadSequence: { lt: BigInt(sequence) } }, data: { lastReadSequence: BigInt(sequence), updatedAt: new Date() } });
    return { data: { lastReadSequence: sequence } };
  }

  async authorizeParticipant(
    id: string,
    auth: PublicAuthContext,
    access: ConsultationAccessGateway,
  ) {
    const thread = await this.raw(id);
    if (auth.role === 'PATIENT') {
      await access.assertPatientOwner(thread.patientId, auth);
      return;
    }
    if (auth.role === 'DOCTOR') {
      const doctorId = await access.doctorId(auth);
      if (thread.assignedDoctorId !== doctorId) throw new ForbiddenException('NOT_ASSIGNED');
      if (thread.status === ConsultationStatus.CLOSED) return;
      const assigned = await this.db.consultationAssignment.findFirst({ where: { threadId: id, doctorId, status: 'ACTIVE' } });
      if (assigned) return;
      throw new ForbiddenException('NOT_ASSIGNED');
    }
    if (['RECEPTIONIST', 'ADMIN'].includes(auth.role)) return;
    throw new ForbiddenException('NOT_A_PARTICIPANT');
  }

  private raw(id: string) {
    return this.db.consultationThread.findUnique({ where: { id } }).then((x) => {
      if (!x) throw new NotFoundException('CONSULTATION_NOT_FOUND');
      return x;
    });
  }

  private view(t: any) {
    return {
      id: t.id,
      consultationId: t.id,
      appointmentId: t.appointmentId ?? '',
      patientId: t.patientId,
      doctorId: t.assignedDoctorId ?? '',
      assignedDoctorId: t.assignedDoctorId ?? '',
      lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : null,
      subject: t.subject,
      status: t.status,
      version: t.version,
      createdAt: t.createdAt ? t.createdAt.toISOString() : null,
      updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
    };
  }

  async raiseEscalation(threadId: string, r: any, actorAccountId: string) {
    const thread = await this.raw(threadId);
    if (thread.status === ConsultationStatus.CLOSED) {
      throw new ConflictException('INVALID_STATE_TRANSITION');
    }

    const activeEsc = await this.db.consultationEscalation.findFirst({
      where: {
        threadId,
        status: { in: [EscalationStatus.OPEN, EscalationStatus.ACKNOWLEDGED] },
      },
    });
    if (activeEsc) {
      throw new ConflictException('ACTIVE_ESCALATION_EXISTS');
    }

    const escalation = await this.db.consultationEscalation.create({
      data: {
        threadId,
        reasonCode: r.reasonCode || 'OTHER',
        detail: r.detail || r.details || null,
        status: EscalationStatus.OPEN,
        raisedByAccountId: actorAccountId,
      },
    });

    return { data: this.viewEscalation(escalation) };
  }

  async acknowledgeEscalation(
    threadId: string,
    escalationId: string,
    actorAccountId: string,
  ) {
    await this.raw(threadId);
    const esc = await this.db.consultationEscalation.findUnique({
      where: { id: escalationId },
    });
    if (!esc || esc.threadId !== threadId) {
      throw new NotFoundException('ESCALATION_NOT_FOUND');
    }

    if (esc.status === EscalationStatus.ACKNOWLEDGED) {
      return { data: this.viewEscalation(esc) };
    }
    if (esc.status !== EscalationStatus.OPEN) {
      throw new ConflictException('INVALID_STATE_TRANSITION');
    }

    const updated = await this.db.consultationEscalation.update({
      where: { id: escalationId },
      data: {
        status: EscalationStatus.ACKNOWLEDGED,
        acknowledgedByAccountId: actorAccountId,
        acknowledgedAt: new Date(),
        version: { increment: 1 },
      },
    });

    return { data: this.viewEscalation(updated) };
  }

  async resolveEscalation(
    threadId: string,
    escalationId: string,
    r: any,
    actorAccountId: string,
  ) {
    await this.raw(threadId);
    const esc = await this.db.consultationEscalation.findUnique({
      where: { id: escalationId },
    });
    if (!esc || esc.threadId !== threadId) {
      throw new NotFoundException('ESCALATION_NOT_FOUND');
    }

    if (esc.status === EscalationStatus.RESOLVED) {
      return { data: this.viewEscalation(esc) };
    }

    const updated = await this.db.consultationEscalation.update({
      where: { id: escalationId },
      data: {
        status: EscalationStatus.RESOLVED,
        resolvedByAccountId: actorAccountId,
        resolvedAt: new Date(),
        resolutionNote: r.resolutionNote || r.resolution || null,
        version: { increment: 1 },
      },
    });

    return { data: this.viewEscalation(updated) };
  }

  async listEscalations(threadId: string) {
    await this.raw(threadId);
    const rows = await this.db.consultationEscalation.findMany({
      where: { threadId },
      orderBy: { raisedAt: 'desc' },
    });
    return { data: rows.map((x) => this.viewEscalation(x)) };
  }

  private viewEscalation(e: any) {
    return {
      id: e.id,
      threadId: e.threadId,
      consultationId: e.threadId,
      reasonCode: e.reasonCode,
      detail: e.detail,
      status: e.status,
      raisedByAccountId: e.raisedByAccountId,
      raisedAt: e.raisedAt ? e.raisedAt.toISOString() : null,
      acknowledgedByAccountId: e.acknowledgedByAccountId,
      acknowledgedAt: e.acknowledgedAt ? e.acknowledgedAt.toISOString() : null,
      resolvedByAccountId: e.resolvedByAccountId,
      resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
      resolutionNote: e.resolutionNote,
      version: e.version,
      createdAt: e.createdAt ? e.createdAt.toISOString() : null,
      updatedAt: e.updatedAt ? e.updatedAt.toISOString() : null,
    };
  }

  private time(d: Date) {
    return {
      seconds: Math.floor(d.getTime() / 1000).toString(),
      nanos: 0,
    };
  }
}
