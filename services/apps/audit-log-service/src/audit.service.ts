import { BadRequestException, Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  RabbitMqConsumer,
  type DomainEventEnvelope,
  timestampToDate,
  dateToTimestamp,
} from '@platform';
import { AppPrismaService } from './database/prisma.service';
@Injectable()
export class AuditService implements OnModuleInit {
  constructor(
    private readonly db: AppPrismaService,
    private readonly mq: RabbitMqConsumer,
    private readonly cfg: ConfigService,
  ) {}
  async onModuleInit() {
    if (!this.cfg.get('RABBITMQ_URL')) return;
    await this.mq.subscribe({
      queue: 'maternal.audit.recorded.v1',
      routingKeys: ['#'],
      handler: (e) => this.ingest(e),
    });
  }
  async ingest(e: DomainEventEnvelope) {
    await this.db.auditEntry.upsert({
      where: { eventId: e.eventId },
      create: {
        eventId: e.eventId,
        eventType: e.eventType,
        eventVersion: e.eventVersion,
        sourceService: e.producer,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        actorId: (e.data as any).actorId || null,
        actorType: (e.data as any).actorType || 'SERVICE',
        action: e.eventType,
        result: 'SUCCESS',
        patientId: (e.data as any).patientId || null,
        changedFields: (e.data as any).changedFields || [],
        metadata: e.data as any,
        payloadHash: createHash('sha256')
          .update(JSON.stringify(e))
          .digest('hex'),
        occurredAt: new Date(e.occurredAt),
      },
      update: {},
    });
  }
  async recordAdminClientLog(
    input: {
      action: string;
      aggregateType: string;
      aggregateId: string;
      result: 'SUCCESS' | 'FAILED';
      changedFields?: string[];
      metadata?: Record<string, unknown>;
    },
    actorId: string,
  ) {
    const eventId = randomUUID();
    const occurredAt = new Date();
    const description = typeof input.metadata?.description === 'string'
      ? input.metadata.description.slice(0, 500) : '';
    const targetService = typeof input.metadata?.targetService === 'string'
      ? input.metadata.targetService.slice(0, 80) : '';
    const metadata = { description, targetService, origin: 'client-reported' };
    const data = {
      eventId,
      eventType: `admin.client.${input.action}`,
      eventVersion: 1,
      sourceService: 'admin-frontend',
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actorId,
      actorType: 'ADMIN',
      action: input.action,
      result: input.result,
      changedFields: input.changedFields ?? [],
      metadata,
      payloadHash: createHash('sha256').update(JSON.stringify({ eventId, actorId, input: {
        action: input.action, aggregateType: input.aggregateType, aggregateId: input.aggregateId,
        result: input.result, changedFields: input.changedFields ?? [], metadata,
      } })).digest('hex'),
      occurredAt,
    };
    const entry = await this.db.auditEntry.create({ data });
    return { id: entry.id, eventId: entry.eventId };
  }
  async get(id: string) {
    const x = await this.db.auditEntry.findUnique({ where: { id } });
    if (!x) throw new NotFoundException('AUDIT_NOT_FOUND');
    return { auditLog: this.view(x) };
  }
  async list(r: any) {
    const take = Math.min(r.page?.pageSize || 20, 100),
      rows = await this.db.auditEntry.findMany({
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
  async listRest(q: any) {
    const page = Number(q?.page ?? 1);
    const pageSize = Number(q?.pageSize ?? 20);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw new BadRequestException('INVALID_PAGINATION');
    const from = q?.fromDate ? new Date(q.fromDate) : undefined;
    const to = q?.toDate ? new Date(q.toDate) : undefined;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())))
      throw new BadRequestException('INVALID_DATE');
    const where: any = {
      ...(q?.action ? { action: q.action } : {}),
      ...(q?.aggregateType ? { aggregateType: q.aggregateType } : {}),
      ...(q?.sourceService ? { sourceService: q.sourceService } : {}),
      ...(from || to ? { occurredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(q?.search ? { OR: [
        { action: { contains: String(q.search), mode: 'insensitive' } },
        { eventType: { contains: String(q.search), mode: 'insensitive' } },
        { aggregateId: { contains: String(q.search), mode: 'insensitive' } },
      ] } : {}),
    };
    const [total, rows] = await this.db.$transaction([
      this.db.auditEntry.count({ where }),
      this.db.auditEntry.findMany({ where, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items: rows.map(x => ({
      id: x.id, eventId: x.eventId, eventType: x.eventType, sourceService: x.sourceService,
      aggregateType: x.aggregateType, aggregateId: x.aggregateId, actorId: x.actorId,
      actorType: x.actorType, action: x.action, result: x.result, patientId: x.patientId,
      changedFields: x.changedFields, sensitivity: x.sensitivity, ipAddress: '', metadata: x.metadata,
      occurredAt: x.occurredAt.toISOString(), ingestedAt: x.ingestedAt.toISOString(),
    })), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
  async statsRest() {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [totalLogs, todayLogs, grouped] = await this.db.$transaction([
      this.db.auditEntry.count(),
      this.db.auditEntry.count({ where: { occurredAt: { gte: today } } }),
      this.db.auditEntry.groupBy({ by: ['action'], _count: { action: true }, orderBy: { _count: { action: 'desc' } }, take: 10 }),
    ]);
    return { totalLogs, todayLogs, topActions: grouped.map(x => ({ action: x.action, count: Number((x._count as any)?.action ?? 0) })) };
  }
  async systemHealthRest() {
    const targets: Array<[string, number, 'core' | 'clinical' | 'operational' | 'support']> = [
      ['auth-service', 5003, 'core'], ['patient-service', 5004, 'core'],
      ['doctor-service', 5005, 'clinical'], ['receptionist-service', 5006, 'operational'],
      ['service-catalog-service', 5007, 'core'], ['appointment-service', 5008, 'operational'],
      ['billing-service', 5009, 'operational'], ['medical-record-service', 5011, 'clinical'],
      ['queue-service', 5012, 'operational'], ['document-service', 5013, 'clinical'],
      ['prescription-service', 5014, 'clinical'], ['treatment-plan-service', 5015, 'clinical'],
      ['notification-service', 5016, 'support'], ['audit-log-service', 5017, 'support'],
      ['reporting-service', 5018, 'support'], ['consultation-service', 5019, 'clinical'],
      ['sample-service', 5000, 'support'],
    ];
    const checkedAt = new Date().toISOString();
    const services = await Promise.all(targets.map(async ([host, port, category]) => {
      const started = Date.now();
      let statusCode: number | undefined;
      try {
        const healthPath = host === 'sample-service' ? '/' : '/health';
        const response = await fetch(`http://${host}:${port}${healthPath}`, { signal: AbortSignal.timeout(1500) });
        statusCode = response.status;
      } catch { /* Unreachable is reported as DOWN. */ }
      const responseTimeMs = Date.now() - started;
      const status = statusCode === 200 ? (responseTimeMs > 800 ? 'DEGRADED' : 'HEALTHY') : 'DOWN';
      return { id: host, name: host, displayName: host, host, port, category, description: '', status, statusCode, responseTimeMs, lastCheckedAt: checkedAt };
    }));
    const healthyCount = services.filter(x => x.status === 'HEALTHY').length;
    const degradedCount = services.filter(x => x.status === 'DEGRADED').length;
    const downCount = services.length - healthyCount - degradedCount;
    const overallStatus = downCount > services.length / 2 ? 'CRITICAL' : (downCount || degradedCount ? 'DEGRADED' : 'OPERATIONAL');
    return { overallStatus, totalServices: services.length, healthyCount, degradedCount, downCount,
      uptimePercentage: Math.round(((healthyCount + degradedCount) / services.length) * 100), lastCheckedAt: checkedAt, services };
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
