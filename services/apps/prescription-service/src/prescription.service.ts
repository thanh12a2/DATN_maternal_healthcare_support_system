import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrescriptionStatus } from '../../../generated/prescription-client';
import { PrescriptionPrismaService } from './database/prisma.service';
import { randomUUID } from 'node:crypto';
import type { PublicAuthContext } from '@platform';
import { MedicationCatalogService } from './medications/medication-catalog.service';

@Injectable()
export class PrescriptionService {
  constructor(private readonly db: PrescriptionPrismaService, @Optional() private readonly catalog?: MedicationCatalogService) {}

  private async resolveItems(items: any[]) {
    if (!items.some((x) => x.medicationCode)) return items;
    if (!this.catalog) throw new ServiceUnavailableException('MEDICATION_CATALOG_UNAVAILABLE');
    return this.catalog.resolveActiveMedicationSnapshots(items);
  }

  // ─── REST Handlers ────────────────────────────────────────────────────────

  async createRest(b: any, auth?: PublicAuthContext, assignedDoctorId?: string) {
    const prescribingDoctorId = assignedDoctorId || auth?.userId || b.prescribingDoctorId || b.doctorId || randomUUID();
    const items = await this.resolveItems(b.items ?? []);
    const p = await this.db.prescription.create({
      data: {
        encounterId: b.encounterId,
        patientId: b.patientId,
        pregnancyEpisodeId: b.pregnancyEpisodeId || null,
        prescribingDoctorId,
        items: {
          create: items.map((x: any, i: number) => ({
            medicationCode: x.medicationCode || null,
            medicationName: x.medicationName,
            strength: x.strength || null,
            dosageForm: x.dosageForm || null,
            route: x.route || 'Đường uống',
            dose: x.dose || '1 viên',
            frequency: x.frequency || '1 lần mỗi ngày',
            durationDays: x.durationDays ? Number(x.durationDays) : null,
            instruction: x.instruction || '',
            sortOrder: x.sortOrder !== undefined ? Number(x.sortOrder) : i + 1,
          })),
        },
      },
      include: { items: true },
    });

    const res = this.view(p);
    return { data: res };
  }

  async listRest(q: any) {
    const where: any = {};
    if (q?.encounterId) where.encounterId = String(q.encounterId);
    if (q?.patientId) where.patientId = String(q.patientId);

    const items = await this.db.prescription.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    const list = items.map((p) => this.view(p));
    return { data: list };
  }

  async getRest(id: string) {
    const p = await this.db.prescription.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PRESCRIPTION_NOT_FOUND');
    const res = this.view(p);
    return { data: res };
  }

  async updateRest(id: string, b: any) {
    const items = Array.isArray(b.items) ? await this.resolveItems(b.items) : undefined;
    return this.db.$transaction(async (tx) => {
      const p = await tx.prescription.findUnique({ where: { id } });
      if (!p) throw new NotFoundException('PRESCRIPTION_NOT_FOUND');
      if (b.version && p.version !== Number(b.version)) throw new ConflictException('VERSION_CONFLICT');
      if (p.status !== PrescriptionStatus.DRAFT) throw new ConflictException('PRESCRIPTION_NOT_DRAFT');
      const changed = await tx.prescription.updateMany({ where: { id, version: p.version, status: PrescriptionStatus.DRAFT }, data: { version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('VERSION_CONFLICT');
      if (items) {
        await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
        await tx.prescriptionItem.createMany({ data: items.map((x: any, i: number) => ({
          prescriptionId: id, medicationCode: x.medicationCode || null, medicationName: x.medicationName,
          strength: x.strength || null, dosageForm: x.dosageForm || null, route: x.route || 'Đường uống',
          dose: x.dose || '1 viên', frequency: x.frequency || '1 lần mỗi ngày',
          durationDays: x.durationDays ? Number(x.durationDays) : null, instruction: x.instruction || '',
          sortOrder: x.sortOrder !== undefined ? Number(x.sortOrder) : i + 1,
        })) });
      }
      const updated = await tx.prescription.findUniqueOrThrow({ where: { id }, include: { items: true } });
      return { data: this.view(updated) };
    });
  }

  async issueRest(id: string, b?: any) {
    const p = await this.db.prescription.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PRESCRIPTION_NOT_FOUND');
    if (b?.version && p.version !== Number(b.version)) {
      throw new ConflictException('VERSION_CONFLICT');
    }
    if (p.status !== PrescriptionStatus.DRAFT) {
      throw new ConflictException('INVALID_STATE');
    }

    if (!p.items.length) throw new ConflictException('PRESCRIPTION_ITEMS_REQUIRED');
    const changed = await this.db.prescription.updateMany({ where: { id, version: p.version, status: PrescriptionStatus.DRAFT }, data: { status: PrescriptionStatus.ISSUED, issuedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictException('VERSION_CONFLICT');
    const updated = await this.db.prescription.findUniqueOrThrow({ where: { id }, include: { items: true } });

    const res = this.view(updated);
    return { data: res };
  }

  async cancelRest(id: string, b: any) {
    const p = await this.db.prescription.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PRESCRIPTION_NOT_FOUND');
    if (b?.version && p.version !== Number(b.version)) {
      throw new ConflictException('VERSION_CONFLICT');
    }

    if (p.status === PrescriptionStatus.CANCELLED) throw new ConflictException('INVALID_STATE');
    const changed = await this.db.prescription.updateMany({ where: { id, version: p.version, status: p.status }, data: { status: PrescriptionStatus.CANCELLED, cancelledAt: new Date(), cancelReason: b?.reason || null, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictException('VERSION_CONFLICT');
    const updated = await this.db.prescription.findUniqueOrThrow({ where: { id }, include: { items: true } });

    const res = this.view(updated);
    return { data: res };
  }

  // ─── gRPC Handlers ────────────────────────────────────────────────────────

  async create(r: any) {
    const p = await this.db.prescription.create({
      data: {
        encounterId: r.encounterId,
        patientId: r.patientId,
        pregnancyEpisodeId: r.pregnancyEpisodeId || null,
        prescribingDoctorId: r.doctorId || randomUUID(),
        items: {
          create: (r.items ?? []).map((x: any, i: number) => ({
            ...x,
            sortOrder: i,
          })),
        },
      },
      include: { items: true },
    });
    return this.view(p);
  }

  async get(id: string) {
    const p = await this.db.prescription.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PRESCRIPTION_NOT_FOUND');
    return this.view(p);
  }

  async list(e: string) {
    return {
      prescriptions: (
        await this.db.prescription.findMany({
          where: { encounterId: e },
          include: { items: true },
        })
      ).map((x) => this.view(x)),
    };
  }

  async command(
    id: string,
    v: number,
    to: PrescriptionStatus,
    reason?: string,
  ) {
    const p = await this.db.prescription.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p || (v && p.version !== v)) throw new ConflictException('VERSION_CONFLICT');
    if (
      to === PrescriptionStatus.ISSUED &&
      (!p.items.length || p.status !== PrescriptionStatus.DRAFT)
    )
      throw new ConflictException('INVALID_STATE');
    if (to === PrescriptionStatus.CANCELLED && p.status === PrescriptionStatus.CANCELLED)
      return this.view(p);
    return this.view(
      await this.db.prescription.update({
        where: { id },
        data: {
          status: to,
          issuedAt: to === PrescriptionStatus.ISSUED ? new Date() : undefined,
          cancelledAt:
            to === PrescriptionStatus.CANCELLED ? new Date() : undefined,
          cancelReason: reason,
          version: { increment: 1 },
        },
        include: { items: true },
      }),
    );
  }

  validate(r: any) {
    return this.db.prescription
      .findFirst({
        where: {
          id: r.prescriptionId,
          encounterId: r.encounterId,
          patientId: r.patientId,
        },
      })
      .then((x) => ({ valid: Boolean(x), status: x?.status ?? 'NOT_FOUND' }));
  }

  private view(p: any) {
    return {
      id: p.id,
      prescriptionId: p.id,
      encounterId: p.encounterId,
      patientId: p.patientId,
      pregnancyEpisodeId: p.pregnancyEpisodeId,
      prescribingDoctorId: p.prescribingDoctorId,
      doctorId: p.prescribingDoctorId,
      status: p.status,
      version: p.version,
      items: (p.items ?? []).map((x: any) => ({
        id: x.id,
        medicationCode: x.medicationCode,
        medicationName: x.medicationName,
        strength: x.strength,
        dosageForm: x.dosageForm,
        route: x.route,
        dose: x.dose,
        frequency: x.frequency,
        durationDays: x.durationDays,
        instruction: x.instruction,
        sortOrder: x.sortOrder,
      })),
      issuedAt: p.issuedAt ? p.issuedAt.toISOString() : null,
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
