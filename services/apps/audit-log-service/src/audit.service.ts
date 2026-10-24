import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  RabbitMqConsumer,
  type DomainEventEnvelope,
  dateToTimestamp,
} from '@platform';
import { AppPrismaService } from './database/prisma.service';

export interface AuditLogQueryDto {
  page?: number;
  pageSize?: number;
  action?: string;
  aggregateType?: string;
  sourceService?: string;
  actorId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CreateAuditEntryInput {
  eventType?: string;
  sourceService: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string | null;
  actorType?: string;
  action: string;
  result?: string;
  patientId?: string | null;
  changedFields?: string[];
  metadata?: Record<string, any>;
  ipAddress?: string;
  occurredAt?: Date;
}

@Injectable()
export class AuditService implements OnModuleInit {
  constructor(
    private readonly db: AppPrismaService,
    private readonly mq: RabbitMqConsumer,
    private readonly cfg: ConfigService,
  ) {}

  async onModuleInit() {
    if (!this.cfg.get('RABBITMQ_URL')) return;
    try {
      await this.mq.subscribe({
        queue: 'maternal.audit.recorded.v1',
        routingKeys: ['#'],
        handler: (e) => this.ingest(e),
      });
    } catch {
      // MQ subscription fallback
    }
  }

  async ingest(e: DomainEventEnvelope) {
    const occurredAt = new Date(e.occurredAt || Date.now());
    await this.db.auditEntry.upsert({
      where: { eventId: e.eventId },
      create: {
        eventId: e.eventId,
        eventType: e.eventType,
        eventVersion: e.eventVersion || 1,
        sourceService: e.producer || 'unknown',
        aggregateType: e.aggregateType || 'GENERAL',
        aggregateId: e.aggregateId || 'unknown',
        actorId: (e.data as any)?.actorId || null,
        actorType: (e.data as any)?.actorType || 'SERVICE',
        action: e.eventType,
        result: (e.data as any)?.result || 'SUCCESS',
        patientId: (e.data as any)?.patientId || null,
        changedFields: (e.data as any)?.changedFields || [],
        metadata: (e.data as any) || {},
        payloadHash: createHash('sha256')
          .update(JSON.stringify(e))
          .digest('hex'),
        occurredAt,
      },
      update: {},
    });
  }

  async recordDirect(input: CreateAuditEntryInput) {
    const eventId = randomUUID();
    const occurredAt = input.occurredAt || new Date();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const actorId = input.actorId && uuidRegex.test(input.actorId) ? input.actorId : null;
    const patientId = input.patientId && uuidRegex.test(input.patientId) ? input.patientId : null;

    const meta = {
      ...(input.metadata || {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.actorId && !actorId ? { rawActorId: input.actorId } : {}),
      ...(input.patientId && !patientId ? { rawPatientId: input.patientId } : {}),
    };
    return this.db.auditEntry.create({
      data: {
        eventId,
        eventType: input.eventType || input.action,
        eventVersion: 1,
        sourceService: input.sourceService,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        actorId,
        actorType: input.actorType || 'USER',
        action: input.action,
        result: input.result || 'SUCCESS',
        patientId,
        changedFields: input.changedFields || [],
        metadata: meta,
        payloadHash: createHash('sha256')
          .update(JSON.stringify({ eventId, input }))
          .digest('hex'),
        occurredAt,
      },
    });
  }

  async get(id: string) {
    const x = await this.db.auditEntry.findUnique({ where: { id } });
    if (!x) throw new NotFoundException('AUDIT_NOT_FOUND');
    return { auditLog: this.view(x) };
  }

  async list(r: any) {
    const take = Math.min(r.page?.pageSize || 20, 100);
    const rows = await this.db.auditEntry.findMany({
      where: {
        ...(r.actorId ? { actorId: r.actorId } : {}),
        ...(r.action ? { action: r.action } : {}),
        ...(r.resourceType ? { aggregateType: r.resourceType } : {}),
        ...(r.resourceId ? { aggregateId: r.resourceId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take,
    });
    return {
      auditLogs: rows.map((x) => this.view(x)),
      page: { nextPageToken: '', totalSize: String(rows.length) },
    };
  }

  async listRest(query: AuditLogQueryDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 15, 1), 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.aggregateType) {
      where.aggregateType = { contains: query.aggregateType, mode: 'insensitive' };
    }
    if (query.sourceService) {
      where.sourceService = { contains: query.sourceService, mode: 'insensitive' };
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.fromDate || query.toDate) {
      where.occurredAt = {};
      if (query.fromDate) where.occurredAt.gte = new Date(query.fromDate);
      if (query.toDate) {
        const to = new Date(query.toDate);
        if (query.toDate.length <= 10) to.setHours(23, 59, 59, 999);
        where.occurredAt.lte = to;
      }
    }
    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { aggregateType: { contains: query.search, mode: 'insensitive' } },
        { aggregateId: { contains: query.search, mode: 'insensitive' } },
        { sourceService: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.db.auditEntry.count({ where }),
      this.db.auditEntry.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((x) => ({
        id: x.id,
        eventId: x.eventId,
        eventType: x.eventType,
        sourceService: x.sourceService,
        aggregateType: x.aggregateType,
        aggregateId: x.aggregateId,
        actorId: x.actorId,
        actorType: x.actorType,
        action: x.action,
        result: x.result,
        patientId: x.patientId,
        changedFields: x.changedFields,
        sensitivity: x.sensitivity,
        ipAddress: (x.metadata as any)?.ipAddress || (x.metadata as any)?.ip || '127.0.0.1',
        metadata: x.metadata,
        occurredAt: x.occurredAt.toISOString(),
        ingestedAt: x.ingestedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStats() {
    const totalCount = await this.db.auditEntry.count();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayCount = await this.db.auditEntry.count({
      where: { occurredAt: { gte: oneDayAgo } },
    });

    const topActions = await this.db.auditEntry.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 5,
    });

    return {
      totalLogs: totalCount,
      todayLogs: todayCount,
      topActions: topActions.map((a) => ({
        action: a.action,
        count: a._count.action,
      })),
    };
  }

  private view(x: any) {
    return {
      id: x.id,
      eventId: x.eventId,
      occurredAt: dateToTimestamp(x.occurredAt),
      recordedAt: dateToTimestamp(x.ingestedAt),
      actor: {
        id: x.actorId ?? '',
        type: 'ACTOR_TYPE_' + x.actorType,
        role: '',
      },
      action: x.action,
      resource: { type: x.aggregateType, id: x.aggregateId },
      outcome: 'AUDIT_OUTCOME_' + x.result,
      sourceService: x.sourceService,
      metadata: Object.fromEntries(
        Object.entries((x.metadata ?? {}) as any).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
    };
  }
}
