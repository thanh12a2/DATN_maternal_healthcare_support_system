import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrescriptionStatus } from '../../../generated/prescription-client';
import { PrescriptionPrismaService } from './database/prisma.service';
import { randomUUID } from 'node:crypto';
import type { PublicAuthContext } from '@platform';

@Injectable()
export class PrescriptionService {
  constructor(private readonly db: PrescriptionPrismaService) {}

  // ─── REST Handlers ────────────────────────────────────────────────────────

  async createRest(b: any, auth?: PublicAuthContext) {
    const prescribingDoctorId = auth?.userId || b.prescribingDoctorId || b.doctorId || randomUUID();
    const p = await this.db.prescription.create({
      data: {
        encounterId: b.encounterId,
        patientId: b.patientId,
        pregnancyEpisodeId: b.pregnancyEpisodeId || null,
        prescribingDoctorId,
        items: {
          create: (b.items ?? []).map((x: any, i: number) => ({
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
    const p = await this.db.prescription.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!p) throw new NotFoundException('PRESCRIPTION_NOT_FOUND');
    if (b.version && p.version !== Number(b.version)) {
      throw new ConflictException('VERSION_CONFLICT');
    }
    if (p.status !== PrescriptionStatus.DRAFT) {
      throw new ConflictException('PRESCRIPTION_NOT_DRAFT');
    }

    if (b.items && Array.isArray(b.items)) {
      await this.db.prescriptionItem.deleteMany({
        where: { prescriptionId: id },
      });
      await this.db.prescriptionItem.createMany({
        data: b.items.map((x: any, i: number) => ({
          prescriptionId: id,
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
      });
    }

    const updated = await this.db.prescription.update({
      where: { id },
      data: { version: { increment: 1 } },
      include: { items: true },
    });

    const res = this.view(updated);
    return { data: res };
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

    const updated = await this.db.prescription.update({
      where: { id },
      data: {
        status: PrescriptionStatus.ISSUED,
        issuedAt: new Date(),
        version: { increment: 1 },
      },
      include: { items: true },
    });

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

    const updated = await this.db.prescription.update({
      where: { id },
      data: {
        status: PrescriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: b?.reason || null,
        version: { increment: 1 },
      },
      include: { items: true },
    });

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
