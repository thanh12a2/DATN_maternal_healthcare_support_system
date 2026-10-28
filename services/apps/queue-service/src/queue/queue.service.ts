import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BasePriority,
  JourneyState,
  Prisma,
  TicketState,
} from '../../../../generated/queue-client';
import { QueuePrismaService } from '../database/prisma.service';

@Injectable()
export class QueueDomainService {
  constructor(private readonly db: QueuePrismaService) {}

  async create(input: any) {
    const old = await this.db.queueJourney.findUnique({
      where: { appointmentId: input.appointmentId },
      include: { tickets: { include: { stage: true } } },
    });
    if (old) {
      if (input.encounterId && old.encounterId !== input.encounterId) {
        await this.db.queueJourney.update({
          where: { id: old.id },
          data: { encounterId: input.encounterId },
        });
        old.encounterId = input.encounterId;
      }
      return {
        journey: this.viewJourney(old),
        initialTicket: this.viewTicket(old.tickets[0]),
        created: false,
        idempotentReplay: true,
      };
    }
    if (
      ![
        'PAID',
        'APPROVED_CREDIT',
        'ADMISSION_PAYMENT_CONDITION_PAID',
        'ADMISSION_PAYMENT_CONDITION_APPROVED_CREDIT',
      ].includes(input.admission?.paymentCondition)
    ) {
      throw new ConflictException('PAYMENT_REQUIRED');
    }
    const stage = await this.db.queueStage.upsert({
      where: { code: input.initialStageCode },
      create: {
        code: input.initialStageCode,
        name: input.initialStageCode,
        roomCode: input.roomCode || null,
      },
      update: { active: true },
    });
    const arrival = this.date(input.arrivalAt) ?? new Date();
    const scheduled = this.date(input.scheduledAt) ?? arrival;
    const late = Math.max(
      0,
      Math.floor((arrival.getTime() - scheduled.getTime()) / 60000),
    );
    const day = new Date(
      Date.UTC(
        arrival.getUTCFullYear(),
        arrival.getUTCMonth(),
        arrival.getUTCDate(),
      ),
    );

    const ticketRoomCode = input.roomCode || stage.roomCode || null;

    return this.db.$transaction(
      async (tx) => {
        const max = await tx.stageTicket.aggregate({
          where: { stageId: stage.id, businessDate: day },
          _max: { ordinal: true, enqueueSequence: true },
        });
        const ordinal = (max._max.ordinal ?? 0) + 1;
        const seq = (max._max.enqueueSequence ?? 0n) + 1n;
        const journey = await tx.queueJourney.create({
          data: {
            appointmentId: input.appointmentId,
            patientId: input.patientId,
            encounterId: input.encounterId,
            businessDate: day,
            lateMinutes: late,
            lateDemoted: late > 30,
            tickets: {
              create: {
                stageId: stage.id,
                roomCode: ticketRoomCode,
                businessDate: day,
                ordinal,
                ticketCode: stage.code + '-' + String(ordinal).padStart(3, '0'),
                lateDemotion: late > 30,
                enqueueSequence: seq,
              },
            },
          },
          include: { tickets: { include: { stage: true } } },
        });
        await this.event(tx, journey, 'queue.journey_created.v1');
        return {
          journey: this.viewJourney(journey),
          initialTicket: this.viewTicket(journey.tickets[0]),
          created: true,
          idempotentReplay: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async enqueue(input: any) {
    const journey = await this.getRaw(input.journeyId);
    const stage = await this.db.queueStage.upsert({
      where: { code: input.stageCode },
      create: {
        code: input.stageCode,
        name: input.stageCode,
        roomCode: input.roomCode || null,
      },
      update: { active: true },
    });
    const max = await this.db.stageTicket.aggregate({
      where: { stageId: stage.id, businessDate: journey.businessDate },
      _max: { ordinal: true, enqueueSequence: true },
    });
    const ticketRoomCode = input.roomCode || stage.roomCode || null;
    return this.viewTicket(
      await this.db.stageTicket.create({
        data: {
          journeyId: journey.id,
          stageId: stage.id,
          roomCode: ticketRoomCode,
          sourceOrderId: input.sourceOrderId || null,
          businessDate: journey.businessDate,
          ordinal: (max._max.ordinal ?? 0) + 1,
          ticketCode:
            stage.code +
            '-' +
            String((max._max.ordinal ?? 0) + 1).padStart(3, '0'),
          basePriority: String(input.priority).includes('URGENT')
            ? BasePriority.URGENT
            : BasePriority.ROUTINE,
          lateDemotion: journey.lateDemoted,
          enqueueSequence: (max._max.enqueueSequence ?? 0n) + 1n,
        },
        include: { stage: true },
      }),
    );
  }

  async get(id?: string, appointmentId?: string) {
    const x = id
      ? await this.db.queueJourney.findUnique({
          where: { id },
          include: {
            tickets: {
              include: { stage: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : await this.db.queueJourney.findUnique({
          where: { appointmentId: appointmentId! },
          include: {
            tickets: {
              include: { stage: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        });
    if (!x) throw new NotFoundException('QUEUE_JOURNEY_NOT_FOUND');
    return this.viewJourney(x);
  }

  async estimate(stageCode: string) {
    const stage = await this.db.queueStage.findUnique({
      where: { code: stageCode },
    });
    if (!stage) {
      return {
        estimatedWaitMinutes: 0,
        lowerBoundMinutes: 0,
        upperBoundMinutes: 0,
        calculatedAt: this.time(new Date()),
        authoritative: false,
      };
    }
    const count = await this.db.stageTicket.count({
      where: { stageId: stage.id, state: TicketState.WAITING },
    });
    const value = count * 15;
    return {
      estimatedWaitMinutes: value,
      lowerBoundMinutes: Math.max(0, value - 10),
      upperBoundMinutes: value + 15,
      calculatedAt: this.time(new Date()),
      authoritative: false,
    };
  }

  async callNext(
    stageId: string,
    actor: string,
    overrideId?: string,
    reason?: string,
    roomCode?: string,
  ) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        stageId,
      );
    const stage = await this.db.queueStage.findFirst({
      where: isUuid
        ? { OR: [{ id: stageId }, { code: stageId }] }
        : { code: stageId },
    });
    const targetStageId = stage?.id ?? stageId;

    return this.db.$transaction(async (tx) => {
      let ticket;
      if (overrideId) {
        if (!reason) throw new ConflictException('OVERRIDE_REASON_REQUIRED');
        ticket = await tx.stageTicket.findFirst({
          where: {
            id: overrideId,
            stageId: targetStageId,
            state: TicketState.WAITING,
          },
        });
      } else {
        ticket = await tx.stageTicket.findFirst({
          where: {
            stageId: targetStageId,
            state: TicketState.WAITING,
            ...(roomCode ? { roomCode } : {}),
          },
          orderBy: [
            { basePriority: 'desc' },
            { lateDemotion: 'asc' },
            { enqueueSequence: 'asc' },
          ],
        });
      }
      if (!ticket) return null;
      const effectiveRoomCode =
        roomCode || ticket.roomCode || stage?.roomCode || null;
      const expires = new Date(Date.now() + 300000);
      const u = await tx.stageTicket.updateMany({
        where: {
          id: ticket.id,
          state: TicketState.WAITING,
          version: ticket.version,
        },
        data: {
          state: TicketState.CALLED,
          ...(effectiveRoomCode ? { roomCode: effectiveRoomCode } : {}),
          calledAt: new Date(),
          callExpiresAt: expires,
          callCount: { increment: 1 },
          version: { increment: 1 },
        },
      });
      if (!u.count) throw new ConflictException('QUEUE_RACE');
      await tx.callAttempt.create({
        data: {
          ticketId: ticket.id,
          attemptNumber: ticket.callCount + 1,
          expiresAt: expires,
          callerAccountId: actor,
          roomCode: effectiveRoomCode,
        },
      });
      return this.viewTicket(
        await tx.stageTicket.findUnique({
          where: { id: ticket.id },
          include: { stage: true },
        }),
      );
    });
  }

  async transition(
    id: string,
    state: TicketState,
    version: number,
    reason?: string,
  ) {
    const data: any = { state, version: { increment: 1 } };
    if (state === TicketState.IN_SERVICE) data.serviceStartedAt = new Date();
    if (state === TicketState.COMPLETED) data.completedAt = new Date();
    if (state === TicketState.WAITING)
      data.enqueueSequence = BigInt(Date.now());
    const u = await this.db.stageTicket.updateMany({
      where: { id, version },
      data,
    });
    if (!u.count) throw new ConflictException('VERSION_CONFLICT');
    return this.viewTicket(
      await this.db.stageTicket.findUnique({
        where: { id },
        include: { stage: true },
      }),
    );
  }

  async cancelWaiting(journeyId: string, reason: string) {
    const n = await this.db.stageTicket.updateMany({
      where: {
        journeyId,
        state: { in: [TicketState.WAITING, TicketState.CALLED] },
      },
      data: { state: TicketState.CANCELLED, version: { increment: 1 } },
    });
    return { cancelledCount: n.count, journey: await this.get(journeyId) };
  }

  private async getRaw(id: string) {
    const x = await this.db.queueJourney.findUnique({ where: { id } });
    if (!x) throw new NotFoundException('QUEUE_JOURNEY_NOT_FOUND');
    return x;
  }

  private async event(tx: any, x: any, type: string) {
    await tx.queueOutbox.create({
      data: {
        eventType: type,
        aggregateId: x.id,
        aggregateVersion: x.version,
        payload: {
          eventVersion: 1,
          aggregateType: 'queue_journey',
          aggregateId: x.id,
          data: {
            journeyId: x.id,
            appointmentId: x.appointmentId,
            state: x.state,
          },
        },
      },
    });
  }

  private viewJourney(x: any) {
    return {
      id: x.id,
      journeyId: x.id,
      appointmentId: x.appointmentId,
      patientId: x.patientId,
      encounterId: x.encounterId,
      businessDate: x.businessDate.toISOString().slice(0, 10),
      lateMinutes: x.lateMinutes,
      lateDemoted: x.lateDemoted,
      state: 'JOURNEY_STATE_' + x.state,
      version: String(x.version),
      tickets: (x.tickets ?? []).map((t: any) => this.viewTicket(t)),
    };
  }

  private viewTicket(t: any) {
    if (!t) return null;
    return {
      id: t.id,
      ticketId: t.id,
      journeyId: t.journeyId,
      stageId: t.stageId,
      sourceOrderId: t.sourceOrderId ?? '',
      stageCode: t.stage?.code ?? '',
      roomCode: t.roomCode || t.stage?.roomCode || '',
      ordinal: t.ordinal,
      ticketCode: t.ticketCode,
      state: 'TICKET_STATE_' + t.state,
      basePriority: 'BASE_PRIORITY_' + t.basePriority,
      lateDemotion: t.lateDemotion,
      callCount: t.callCount,
      version: String(t.version),
      enqueuedAt: this.time(t.createdAt),
      calledAt: t.calledAt ? this.time(t.calledAt) : undefined,
      callExpiresAt: t.callExpiresAt ? this.time(t.callExpiresAt) : undefined,
    };
  }

  private date(x: any) {
    return x?.seconds !== undefined
      ? new Date(Number(x.seconds) * 1000)
      : x
        ? new Date(x)
        : undefined;
  }

  private time(d: Date) {
    return {
      seconds: Math.floor(d.getTime() / 1000).toString(),
      nanos: (d.getTime() % 1000) * 1000000,
    };
  }

  async listStages() {
    let s = await this.db.queueStage.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });
    if (s.length === 0) {
      s = [
        await this.db.queueStage.upsert({
          where: { code: 'CONSULTATION' },
          create: {
            code: 'CONSULTATION',
            name: 'Phòng khám sản',
            roomCode: 'P.101',
            active: true,
          },
          update: { active: true },
        }),
      ];
    }
    return s;
  }

  async listStageTickets(stageId: string, query?: any) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        stageId,
      );
    const stage = await this.db.queueStage.findFirst({
      where: isUuid
        ? { OR: [{ id: stageId }, { code: stageId }] }
        : { code: stageId },
    });

    const resolvedStageId = stage?.id ?? (isUuid ? stageId : null);
    if (!resolvedStageId) {
      throw new NotFoundException('STAGE_NOT_FOUND');
    }

    const where: Prisma.StageTicketWhereInput = {
      stageId: resolvedStageId,
    };

    if (query?.roomCode) {
      where.roomCode = String(query.roomCode).trim();
    }

    if (query?.state) {
      const parts = String(query.state).split(',');
      const cleanStates: TicketState[] = [];
      for (const p of parts) {
        const raw = p.trim().replace(/^TICKET_STATE_/, '');
        if (Object.values(TicketState).includes(raw as TicketState)) {
          cleanStates.push(raw as TicketState);
        }
      }
      if (cleanStates.length === 1) {
        where.state = cleanStates[0];
      } else if (cleanStates.length > 1) {
        where.state = { in: cleanStates };
      }
    }

    const limit = query?.limit
      ? Math.min(Math.max(1, Number(query.limit) || 20), 100)
      : 20;
    const page = query?.page ? Math.max(1, Number(query.page) || 1) : null;
    const skip = page && page > 1 ? (page - 1) * limit : undefined;
    const cursor = query?.cursor ? { id: String(query.cursor) } : undefined;

    const tickets = await this.db.stageTicket.findMany({
      where,
      include: {
        stage: true,
        journey: true,
      },
      orderBy: [
        { basePriority: 'desc' },
        { lateDemotion: 'asc' },
        { enqueueSequence: 'asc' },
        { ordinal: 'asc' },
        { id: 'asc' },
      ],
      take: limit + 1,
      skip: skip ?? (cursor ? 1 : undefined),
      cursor,
    });

    let nextCursor: string | null = null;
    if (tickets.length > limit) {
      const nextItem = tickets.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    const data = tickets.map((t) => ({
      id: t.id,
      ticketId: t.id,
      journeyId: t.journeyId,
      stageId: t.stageId,
      sourceOrderId: t.sourceOrderId ?? null,
      stageCode: t.stage?.code ?? '',
      stageName: t.stage?.name ?? '',
      roomCode: t.roomCode ?? t.stage?.roomCode ?? null,
      ordinal: t.ordinal,
      ticketCode: t.ticketCode,
      state: t.state,
      basePriority: t.basePriority,
      lateDemotion: t.lateDemotion,
      callCount: t.callCount,
      calledAt: t.calledAt ? t.calledAt.toISOString() : null,
      callExpiresAt: t.callExpiresAt ? t.callExpiresAt.toISOString() : null,
      serviceStartedAt: t.serviceStartedAt
        ? t.serviceStartedAt.toISOString()
        : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      appointmentId: t.journey?.appointmentId ?? null,
      patientId: t.journey?.patientId ?? null,
      encounterId: t.journey?.encounterId ?? null,
    }));

    return {
      data,
      nextCursor,
      total: await this.db.stageTicket.count({ where }),
    };
  }

  async getActiveJourney(patientId: string) {
    const x = await this.db.queueJourney.findFirst({
      where: { patientId, state: JourneyState.ACTIVE },
      include: {
        tickets: { include: { stage: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!x) throw new NotFoundException('ACTIVE_JOURNEY_NOT_FOUND');
    return this.viewJourney(x);
  }

  async getJourneyById(id: string) {
    const x = await this.db.queueJourney.findUnique({
      where: { id },
      include: {
        tickets: { include: { stage: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!x) throw new NotFoundException('QUEUE_JOURNEY_NOT_FOUND');
    return this.viewJourney(x);
  }

  async createOrGetJourneyRest(b: any) {
    const appointmentId = b?.appointmentId;
    if (!appointmentId)
      throw new NotFoundException('appointmentId is required');
    const existing = await this.db.queueJourney.findUnique({
      where: { appointmentId },
      include: { tickets: { include: { stage: true } } },
    });
    if (existing) return this.viewJourney(existing);
    const stage = await this.db.queueStage.upsert({
      where: { code: b?.initialStageCode || 'CONSULTATION' },
      create: {
        code: b?.initialStageCode || 'CONSULTATION',
        name: 'Phòng khám sản',
        roomCode: b?.roomCode || 'P.101',
        active: true,
      },
      update: { active: true },
    });
    const arr = new Date();
    const day = new Date(
      Date.UTC(arr.getUTCFullYear(), arr.getUTCMonth(), arr.getUTCDate()),
    );
    const max = await this.db.stageTicket.aggregate({
      where: { stageId: stage.id, businessDate: day },
      _max: { ordinal: true, enqueueSequence: true },
    });
    const ord = (max._max.ordinal ?? 0) + 1;
    const seq = (max._max.enqueueSequence ?? 0n) + 1n;
    const ticketRoomCode = b?.roomCode || stage.roomCode || 'P.101';
    const j = await this.db.queueJourney.create({
      data: {
        appointmentId,
        patientId: b?.patientId || '439845ce-926e-4633-96f0-a6331010bade',
        encounterId: b?.encounterId || '00000000-0000-0000-0000-000000000000',
        businessDate: day,
        lateMinutes: 0,
        lateDemoted: false,
        tickets: {
          create: {
            stageId: stage.id,
            roomCode: ticketRoomCode,
            businessDate: day,
            ordinal: ord,
            ticketCode: stage.code + '-' + String(ord).padStart(3, '0'),
            lateDemotion: false,
            enqueueSequence: seq,
          },
        },
      },
      include: { tickets: { include: { stage: true } } },
    });
    return this.viewJourney(j);
  }
}
