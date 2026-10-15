import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TreatmentPlanItemStatus,
  TreatmentPlanStatus,
} from '../../../generated/treatment-plan-client';
import { TreatmentPlanPrismaService } from './database/prisma.service';
import { randomUUID } from 'node:crypto';
import type { PublicAuthContext } from '@platform';

@Injectable()
export class TreatmentService {
  constructor(private readonly db: TreatmentPlanPrismaService) {}

  // ─── REST Handlers ────────────────────────────────────────────────────────

  async createRest(b: any, auth?: PublicAuthContext) {
    const authorDoctorId = auth?.userId || b.doctorId || randomUUID();
    const effectiveFrom = b.effectiveFrom ? new Date(b.effectiveFrom) : new Date();
    const effectiveTo = b.effectiveTo ? new Date(b.effectiveTo) : null;

    const p = await this.db.treatmentPlan.create({
      data: {
        patientId: b.patientId,
        pregnancyEpisodeId: b.pregnancyEpisodeId || null,
        sourceEncounterId: b.sourceEncounterId || b.encounterId,
        authorDoctorId,
        title: b.title,
        summary: b.summary || '',
        effectiveFrom,
        effectiveTo,
        items: {
          create: (b.items ?? []).map((x: any, i: number) => ({
            type: x.type || 'MEDICATION',
            title: x.title,
            description: x.description || '',
            dueAt: x.dueAt ? new Date(x.dueAt) : null,
            sortOrder: x.sortOrder !== undefined ? Number(x.sortOrder) : i + 1,
            status: TreatmentPlanItemStatus.PENDING,
          })),
        },
        versions: {
          create: {
            version: 1,
            snapshot: {
              title: b.title,
              summary: b.summary || '',
              items: b.items ?? [],
            },
            changedBy: authorDoctorId,
            changeReason: 'CREATED',
          },
        },
      },
      include: { items: true },
    });

    const res = this.view(p);
    return { data: res };
  }

  async listRest(q: any) {
    const where: any = {};
    if (q?.patientId) where.patientId = String(q.patientId);
    if (q?.pregnancyEpisodeId) where.pregnancyEpisodeId = String(q.pregnancyEpisodeId);

    const items = await this.db.treatmentPlan.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    const list = items.map((p) => this.view(p));
    return { data: list };
  }

  async getRest(id: string) {
    const p = await this.db.treatmentPlan.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PLAN_NOT_FOUND');
    const res = this.view(p);
    return { data: res };
  }

  async updateRest(id: string, b: any, auth?: PublicAuthContext) {
    const p = await this.db.treatmentPlan.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PLAN_NOT_FOUND');
    if (b.version && p.version !== Number(b.version)) {
      throw new ConflictException('VERSION_CONFLICT');
    }

    const nextVer = p.version + 1;
    const authorId = auth?.userId || randomUUID();

    if (b.items && Array.isArray(b.items)) {
      await this.db.treatmentPlanItem.deleteMany({ where: { planId: id } });
      await this.db.treatmentPlanItem.createMany({
        data: b.items.map((x: any, i: number) => ({
          planId: id,
          type: x.type || 'MEDICATION',
          title: x.title,
          description: x.description || '',
          dueAt: x.dueAt ? new Date(x.dueAt) : null,
          sortOrder: x.sortOrder !== undefined ? Number(x.sortOrder) : i + 1,
          status: TreatmentPlanItemStatus.PENDING,
        })),
      });
    }

    await this.db.treatmentPlanVersion.create({
      data: {
        planId: id,
        version: nextVer,
        snapshot: {
          title: b.title ?? p.title,
          summary: b.summary ?? p.summary,
          items: b.items ?? p.items,
        },
        changedBy: authorId,
        changeReason: b.reason || 'UPDATED',
      },
    });

    const updated = await this.db.treatmentPlan.update({
      where: { id },
      data: {
        title: b.title ?? undefined,
        summary: b.summary ?? undefined,
        version: { increment: 1 },
      },
      include: { items: true },
    });

    const res = this.view(updated);
    return { data: res };
  }

  async commandRest(
    id: string,
    to: TreatmentPlanStatus,
    b?: any,
  ) {
    const p = await this.db.treatmentPlan.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PLAN_NOT_FOUND');
    if (b?.version && p.version !== Number(b.version)) {
      throw new ConflictException('VERSION_CONFLICT');
    }

    const updated = await this.db.treatmentPlan.update({
      where: { id },
      data: {
        status: to,
        activatedAt: to === TreatmentPlanStatus.ACTIVE ? new Date() : undefined,
        completedAt: to === TreatmentPlanStatus.COMPLETED ? new Date() : undefined,
        cancelledAt: to === TreatmentPlanStatus.CANCELLED ? new Date() : undefined,
        cancelReason: b?.reason || null,
        version: { increment: 1 },
      },
      include: { items: true },
    });

    const res = this.view(updated);
    return { data: res };
  }

  async completeItemRest(planId: string | undefined, itemId: string, b?: any) {
    const item = await this.db.treatmentPlanItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('ITEM_NOT_FOUND');

    const targetPlanId = planId || item.planId;
    const p = await this.db.treatmentPlan.findUnique({
      where: { id: targetPlanId },
    });
    if (!p) throw new NotFoundException('PLAN_NOT_FOUND');
    if (b?.version && p.version !== Number(b.version)) {
      throw new ConflictException('VERSION_CONFLICT');
    }

    await this.db.treatmentPlanItem.update({
      where: { id: itemId },
      data: {
        status: TreatmentPlanItemStatus.DONE,
        completedAt: new Date(),
      },
    });

    await this.db.treatmentPlan.update({
      where: { id: targetPlanId },
      data: { version: { increment: 1 } },
    });

    return this.getRest(targetPlanId);
  }

  // ─── gRPC Handlers ────────────────────────────────────────────────────────

  async create(r: any) {
    const p = await this.db.treatmentPlan.create({
      data: {
        patientId: r.patientId,
        pregnancyEpisodeId: r.pregnancyEpisodeId || null,
        sourceEncounterId: r.sourceEncounterId,
        authorDoctorId: r.doctorId,
        title: r.title,
        summary: r.summary,
        effectiveFrom: new Date(),
        items: {
          create: (r.items ?? []).map((x: any, i: number) => ({
            ...x,
            dueAt: x.dueAt ? new Date(Number(x.dueAt.seconds) * 1000) : null,
            sortOrder: i,
          })),
        },
        versions: {
          create: {
            version: 1,
            snapshot: {
              title: r.title,
              summary: r.summary,
              items: r.items ?? [],
            },
            changedBy: r.doctorId,
            changeReason: 'CREATED',
          },
        },
      },
      include: { items: true },
    });
    return this.view(p);
  }

  async get(id: string) {
    const p = await this.db.treatmentPlan.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PLAN_NOT_FOUND');
    return this.view(p);
  }

  async list(patientId: string, episode?: string) {
    return {
      plans: (
        await this.db.treatmentPlan.findMany({
          where: {
            patientId,
            ...(episode ? { pregnancyEpisodeId: episode } : {}),
          },
          include: { items: true },
        })
      ).map((x) => this.view(x)),
    };
  }

  async command(
    id: string,
    v: number,
    to: TreatmentPlanStatus,
    reason?: string,
  ) {
    const p = await this.db.treatmentPlan.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p || (v && p.version !== v)) throw new ConflictException('VERSION_CONFLICT');
    return this.view(
      await this.db.treatmentPlan.update({
        where: { id },
        data: {
          status: to,
          activatedAt: to === TreatmentPlanStatus.ACTIVE ? new Date() : undefined,
          completedAt:
            to === TreatmentPlanStatus.COMPLETED ? new Date() : undefined,
          cancelledAt:
            to === TreatmentPlanStatus.CANCELLED ? new Date() : undefined,
          cancelReason: reason,
          version: { increment: 1 },
        },
        include: { items: true },
      }),
    );
  }

  validate(r: any) {
    return this.db.treatmentPlan
      .findFirst({
        where: {
          id: r.planId,
          patientId: r.patientId,
          sourceEncounterId: r.encounterId,
        },
      })
      .then((x) => ({ valid: Boolean(x), status: x?.status ?? 'NOT_FOUND' }));
  }

  private view(p: any) {
    return {
      id: p.id,
      planId: p.id,
      patientId: p.patientId,
      pregnancyEpisodeId: p.pregnancyEpisodeId ?? null,
      sourceEncounterId: p.sourceEncounterId,
      authorDoctorId: p.authorDoctorId,
      doctorId: p.authorDoctorId,
      status: p.status,
      version: p.version,
      title: p.title,
      summary: p.summary,
      effectiveFrom: p.effectiveFrom ? p.effectiveFrom.toISOString().slice(0, 10) : null,
      effectiveTo: p.effectiveTo ? p.effectiveTo.toISOString().slice(0, 10) : null,
      items: (p.items ?? []).map((x: any) => ({
        id: x.id,
        type: x.type,
        title: x.title,
        description: x.description,
        dueAt: x.dueAt ? x.dueAt.toISOString() : null,
        status: x.status,
        sortOrder: x.sortOrder,
        completedAt: x.completedAt ? x.completedAt.toISOString() : null,
      })),
      activatedAt: p.activatedAt ? p.activatedAt.toISOString() : null,
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
      cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
      cancelReason: p.cancelReason,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    };
  }

  private time(d: Date) {
    return {
      seconds: Math.floor(d.getTime() / 1000).toString(),
      nanos: 0,
    };
  }
}
