import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentRole,
  AssignmentStatus,
  EncounterState,
  Prisma,
} from '../../../../generated/medical-record-client';
import { MedicalPrismaService } from '../database/prisma.service';
import { DoctorIdentityGateway } from './doctor-identity.gateway';

@Injectable()
export class MedicalDomainService {
  constructor(private readonly db: MedicalPrismaService, private readonly doctorIdentity: DoctorIdentityGateway) {}

  async doctorIdForAccount(accountId: string) { return this.doctorIdentity.resolve(accountId); }

  async assertDoctorAssigned(id: string, accountId: string) {
    const doctorId = await this.doctorIdentity.resolve(accountId);
    const assignment = await this.db.encounterAssignment.findFirst({ where: { encounterId: id, staffId: doctorId, status: AssignmentStatus.ACTIVE } });
    if (!assignment) throw new ForbiddenException('NOT_ASSIGNED');
  }

  async open(input: any) {
    const appointmentId = input.appointmentId || input.appointment_id;
    const patientId = input.patientId || input.patient_id;
    const primaryDoctorId = input.primaryDoctorId || input.primary_doctor_id;

    const old = await this.db.clinicalEncounter.findUnique({
      where: { appointmentId },
    });
    if (old) {
      return {
        encounter: this.summary(old),
        created: false,
        idempotentReplay: true,
      };
    }
    return this.db.$transaction(
      async (tx) => {
        const x = await tx.clinicalEncounter.create({
          data: {
            appointmentId,
            patientId,
            primaryDoctorId,
            assignments: {
              create: {
                staffId: primaryDoctorId,
                role: AssignmentRole.PRIMARY,
                status: AssignmentStatus.ACTIVE,
              },
            },
          },
        });
        await this.event(tx, x, 'medical.encounter_opened.v1');
        return {
          encounter: this.summary(x),
          created: true,
          idempotentReplay: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async get(id?: string, appointmentId?: string) {
    const x = id
      ? await this.db.clinicalEncounter.findUnique({ where: { id } })
      : await this.db.clinicalEncounter.findUnique({
          where: { appointmentId: appointmentId! },
        });
    if (!x) throw new NotFoundException('ENCOUNTER_NOT_FOUND');
    return x;
  }

  async summaryBy(id?: string, a?: string) {
    return this.summary(await this.get(id, a));
  }

  async validate(input: any) {
    const x = await this.get(input.encounterId);
    const assigned = input.doctorId
      ? Boolean(
          await this.db.encounterAssignment.findFirst({
            where: {
              encounterId: x.id,
              staffId: input.doctorId,
              status: AssignmentStatus.ACTIVE,
            },
          }),
        )
      : false;
    const patient = Boolean(input.patientId && x.patientId === input.patientId);
    return {
      allowed: assigned || patient,
      denialCode: assigned || patient ? '' : 'RELATIONSHIP_NOT_FOUND',
      encounter: this.summary(x),
      assignmentRole: assigned ? 'CLINICAL' : '',
    };
  }

  async link(input: any) {
    const x = await this.get(input.encounterId);
    if (x.state === EncounterState.FINALIZED) {
      throw new ConflictException('ENCOUNTER_FINALIZED');
    }
    await this.db.externalClinicalReference.upsert({
      where: {
        resourceType_resourceId: {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        },
      },
      create: {
        encounterId: x.id,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
      update: { encounterId: x.id },
    });
    return this.summary(await this.bump(x.id, input.expectedVersion));
  }

  async pregnancy(patientId: string, id?: string) {
    const x = id
      ? await this.db.pregnancyEpisode.findFirst({ where: { id, patientId } })
      : await this.db.pregnancyEpisode.findFirst({
          where: { patientId, status: 'ACTIVE' },
        });
    if (!x) throw new NotFoundException('PREGNANCY_EPISODE_NOT_FOUND');
    return {
      pregnancyEpisodeId: x.id,
      patientId: x.patientId,
      status: x.status,
      riskLevel: x.riskLevel,
      estimatedDueDate: x.estimatedDueDate?.toISOString().slice(0, 10) ?? '',
      version: String(x.version),
    };
  }

  async createPregnancyEpisode(b: any, actor: string) {
    if (!b?.patientId) throw new ConflictException('PATIENT_ID_REQUIRED');
    const existing = await this.db.pregnancyEpisode.findFirst({
      where: { patientId: b.patientId, status: 'ACTIVE' },
    });
    if (existing) {
      return { data: this.viewPregnancy(existing, b) };
    }
    const x = await this.db.pregnancyEpisode.create({
      data: {
        patientId: b.patientId,
        status: 'ACTIVE',
        estimatedDueDate: b.estimatedDueDate ? new Date(b.estimatedDueDate) : null,
        lastMenstrualPeriod: b.lastMenstrualPeriod ? new Date(b.lastMenstrualPeriod) : null,
        riskLevel: b.riskLevel || 'UNKNOWN',
      },
    });
    await this.db.clinicalEncounter.updateMany({
      where: {
        patientId: b.patientId,
        pregnancyEpisodeId: null,
        state: { in: [EncounterState.DRAFT, EncounterState.IN_PROGRESS] },
      },
      data: { pregnancyEpisodeId: x.id },
    });
    return { data: this.viewPregnancy(x, b) };
  }

  async listPregnancyEpisodes(query: any) {
    const where: any = {};
    if (query?.patientId) where.patientId = String(query.patientId);
    const items = await this.db.pregnancyEpisode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query?.limit ? Number(query.limit) : 20,
    });
    return {
      data: items.map((x) => this.viewPregnancy(x)),
    };
  }

  async updatePregnancyEpisode(id: string, b: any, actor: string) {
    const ep = await this.db.pregnancyEpisode.findUnique({ where: { id } });
    if (!ep) throw new NotFoundException('PREGNANCY_EPISODE_NOT_FOUND');
    if (b.expectedVersion && ep.version !== Number(b.expectedVersion)) {
      throw new ConflictException('VERSION_CONFLICT');
    }
    const data: any = { version: { increment: 1 } };
    if (b.estimatedDueDate) data.estimatedDueDate = new Date(b.estimatedDueDate);
    if (b.lastMenstrualPeriod) data.lastMenstrualPeriod = new Date(b.lastMenstrualPeriod);
    if (b.riskLevel) data.riskLevel = b.riskLevel;
    if (b.status) data.status = b.status;
    const updated = await this.db.pregnancyEpisode.update({
      where: { id },
      data,
    });
    return { data: this.viewPregnancy(updated, b) };
  }

  private viewPregnancy(x: any, extra?: any) {
    return {
      id: x.id,
      patientId: x.patientId,
      status: x.status,
      estimatedDueDate: x.estimatedDueDate
        ? x.estimatedDueDate.toISOString().slice(0, 10)
        : null,
      lastMenstrualPeriod: x.lastMenstrualPeriod
        ? x.lastMenstrualPeriod.toISOString().slice(0, 10)
        : null,
      riskLevel: x.riskLevel,
      version: x.version,
      gravida: extra?.gravida ?? undefined,
      para: extra?.para ?? undefined,
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
    };
  }

  async listEncounters(query?: any, doctorId?: string) {
    const where: Prisma.ClinicalEncounterWhereInput = {};

    if (query?.patientId) {
      where.patientId = String(query.patientId);
    }

    if (query?.appointmentId) {
      where.appointmentId = String(query.appointmentId);
    }

    if (doctorId) {
      where.assignments = { some: { staffId: doctorId, status: AssignmentStatus.ACTIVE } };
    } else if (query?.doctorId || query?.primaryDoctorId) {
      where.primaryDoctorId = String(query.doctorId || query.primaryDoctorId);
    }

    if (query?.state) {
      const parts = String(query.state).split(',');
      const cleanStates: EncounterState[] = [];
      for (const p of parts) {
        const raw = p.trim().replace(/^ENCOUNTER_STATE_/, '');
        if (Object.values(EncounterState).includes(raw as EncounterState)) {
          cleanStates.push(raw as EncounterState);
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

    const encounters = await this.db.clinicalEncounter.findMany({
      where,
      include: {
        externalReferences: true,
        vitalSigns: true,
        notes: true,
        diagnoses: true,
        orders: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
      cursor,
    });

    const data = encounters.map((e) => this.viewEncounter(e));
    const total = await this.db.clinicalEncounter.count({ where });

    return {
      data,
      total,
      limit,
    };
  }

  async getEncounter(id: string) {
    const x = await this.db.clinicalEncounter.findUnique({
      where: { id },
      include: {
        externalReferences: true,
        vitalSigns: true,
        notes: true,
        diagnoses: true,
        orders: true,
        amendments: true,
      },
    });
    if (!x) throw new NotFoundException('ENCOUNTER_NOT_FOUND');
    const data = this.viewEncounter(x);
    return { data };
  }

  async start(id: string, version: number, actor: string, role?: string) {
    await this.access(id, actor, role);
    if (role === 'DOCTOR') {
      this.requireVersion(version);
      const encounter = await this.get(id);
      const doctorId = await this.doctorIdentity.resolve(actor);
      if (!await this.doctorIdentity.checkedIn(encounter.appointmentId, id, doctorId)) throw new ConflictException('APPOINTMENT_NOT_CHECKED_IN');
    }
    const x = await this.transition(
      id,
      version,
      [EncounterState.DRAFT],
      EncounterState.IN_PROGRESS,
      { startedAt: new Date() },
      actor,
      'medical.encounter_started.v1',
    );
    return { data: this.viewEncounter(x) };
  }

  async ready(id: string, version: number, actor: string, role?: string) {
    if (role === 'DOCTOR') { this.requireVersion(version); await this.assertDoctorAssigned(id, actor); }
    const pending = await this.db.clinicalServiceOrder.count({
      where: {
        encounterId: id,
        requiredResult: true,
        status: { not: 'VERIFIED' },
      },
    });
    if (pending) throw new ConflictException('REQUIRED_RESULTS_PENDING');
    const x = await this.transition(
      id,
      version,
      [EncounterState.IN_PROGRESS],
      EncounterState.READY_FOR_REVIEW,
      { reviewReadyAt: new Date() },
      actor,
      'medical.encounter_ready.v1',
    );
    return { data: this.viewEncounter(x) };
  }

  async finalize(id: string, version: number, actor: string, role?: string) {
    if (role === 'DOCTOR') { this.requireVersion(version); await this.assertDoctorAssigned(id, actor); }
    const x = await this.transition(
      id,
      version,
      [EncounterState.READY_FOR_REVIEW],
      EncounterState.FINALIZED,
      { finalizedAt: new Date() },
      actor,
      'medical.encounter_finalized.v1',
    );
    return { data: this.viewEncounter(x) };
  }

  async addVital(id: string, data: any, actor: string, role?: string) {
    if (role === 'DOCTOR') {
      const numbers: Record<string, number> = {};
      for (const [field, min, max] of [['systolic', 40, 300], ['diastolic', 20, 200], ['heartRate', 20, 250], ['temperature', 30, 45], ['weight', 1, 500]] as const) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
          const value = Number(data[field]);
          if (!Number.isFinite(value) || value < min || value > max || (['systolic', 'diastolic', 'heartRate'].includes(field) && !Number.isInteger(value))) throw new BadRequestException('INVALID_VITAL_SIGN');
          numbers[field] = value;
        }
      }
      if (!Object.keys(numbers).length) throw new BadRequestException('VITAL_SIGN_REQUIRED');
      return this.doctorClinicalWrite(id, actor, data.expectedVersion, async (tx, version) => {
        const item = await tx.vitalSign.create({ data: { encounterId: id, ...numbers, recordedBy: actor } });
        return { data: { id: item.id, version } };
      });
    }
    await this.access(id, actor, role);
    let systolic = data.systolicBloodPressure ?? data.systolic;
    let diastolic = data.diastolicBloodPressure ?? data.diastolic;
    let heartRate = data.heartRate;
    let temperature = data.temperatureCelsius ?? data.temperature;
    let weight = data.weightKg ?? data.weight;

    if (data.type) {
      const val = data.valueNumeric ?? data.value;
      if (data.type === 'WEIGHT') weight = val;
      else if (data.type === 'TEMPERATURE') temperature = val;
      else if (data.type === 'HEART_RATE' || data.type === 'PULSE') heartRate = val;
      else if (data.type === 'BLOOD_PRESSURE') {
        if (data.systolic) systolic = data.systolic;
        if (data.diastolic) diastolic = data.diastolic;
      }
    }

    const recordedAt = data.measuredAt ? new Date(data.measuredAt) : new Date();

    const v = await this.db.vitalSign.create({
      data: {
        encounterId: id,
        systolic: systolic ? Number(systolic) : undefined,
        diastolic: diastolic ? Number(diastolic) : undefined,
        heartRate: heartRate ? Number(heartRate) : undefined,
        temperature:
          temperature !== undefined && temperature !== null
            ? Number(temperature)
            : undefined,
        weight:
          weight !== undefined && weight !== null ? Number(weight) : undefined,
        recordedBy: actor,
        recordedAt,
      },
    });

    if (data.expectedVersion) {
      await this.bump(id, Number(data.expectedVersion)).catch(() => null);
    }

    return {
      data: {
        id: v.id,
        encounterId: v.encounterId,
        systolic: v.systolic,
        diastolic: v.diastolic,
        heartRate: v.heartRate,
        temperature: v.temperature ? Number(v.temperature) : null,
        weight: v.weight ? Number(v.weight) : null,
        recordedBy: v.recordedBy,
        recordedAt: v.recordedAt.toISOString(),
      },
    };
  }

  async addNote(id: string, data: any, actor: string, role?: string) {
    if (role === 'DOCTOR') {
      const text = String(data?.content ?? data?.text ?? '').trim();
      if (!text || text.length > 10000) throw new BadRequestException('INVALID_NOTE');
      return this.doctorClinicalWrite(id, actor, data.expectedVersion, async (tx, version) => {
        const item = await tx.clinicalNote.create({ data: { encounterId: id, text, authorId: actor } });
        return { data: { id: item.id, version } };
      });
    }
    await this.access(id, actor, role);
    const text =
      typeof data === 'string'
        ? data
        : (data?.content ?? data?.text ?? data?.note ?? '');
    const n = await this.db.clinicalNote.create({
      data: {
        encounterId: id,
        text: String(text),
        authorId: actor,
      },
    });

    if (data?.expectedVersion !== undefined && data?.expectedVersion !== null) {
      await this.bump(id, Number(data.expectedVersion)).catch(() => null);
    }
    const currentEncounter = await this.get(id);

    return {
      data: {
        id: n.id,
        encounterId: n.encounterId,
        noteType: data?.noteType ?? 'SUBJECTIVE',
        content: n.text,
        text: n.text,
        authorId: n.authorId,
        createdAt: n.createdAt.toISOString(),
        version: currentEncounter.version,
      },
    };
  }

  async addDiagnosis(id: string, data: any, actor: string, role?: string) {
    if (role === 'DOCTOR') {
      const code = String(data?.code ?? '').trim();
      const description = String(data?.description ?? '').trim();
      if (!code || code.length > 50 || !description || description.length > 2000) throw new BadRequestException('INVALID_DIAGNOSIS');
      return this.doctorClinicalWrite(id, actor, data.expectedVersion, async (tx, version) => {
        const item = await tx.diagnosis.create({ data: { encounterId: id, code, description, doctorId: actor } });
        return { data: { id: item.id, version } };
      });
    }
    await this.access(id, actor, role);
    const code = data?.code ?? data?.icdCode ?? data?.diagnosisCode ?? 'O26.9';
    const description =
      data?.description ?? data?.text ?? data?.name ?? data?.diagnosis ?? '';
    const d = await this.db.diagnosis.create({
      data: {
        encounterId: id,
        code: String(code),
        description: String(description),
        doctorId: actor,
      },
    });

    if (data?.expectedVersion !== undefined && data?.expectedVersion !== null) {
      await this.bump(id, Number(data.expectedVersion)).catch(() => null);
    }
    const currentEncounter = await this.get(id);

    return {
      data: {
        id: d.id,
        encounterId: d.encounterId,
        code: d.code,
        description: d.description,
        doctorId: d.doctorId,
        createdAt: d.createdAt.toISOString(),
        version: currentEncounter.version,
      },
    };
  }

  async order(id: string, data: any, actor: string, role?: string) {
    await this.access(id, actor, role);
    const o = await this.db.clinicalServiceOrder.create({
      data: {
        encounterId: id,
        catalogServiceId: data.catalogServiceId,
        stageCode: data.stageCode,
        orderedByDoctorId: actor,
        requiredResult:
          typeof data.requiredResult === 'boolean'
            ? data.requiredResult
            : true,
        billableSnapshot:
          typeof data.billableSnapshot === 'boolean'
            ? data.billableSnapshot
            : true,
      },
    });

    if (data?.expectedVersion !== undefined && data?.expectedVersion !== null) {
      await this.bump(id, Number(data.expectedVersion)).catch(() => null);
    }
    const currentEncounter = await this.get(id);

    return {
      data: {
        id: o.id,
        encounterId: o.encounterId,
        catalogServiceId: o.catalogServiceId,
        stageCode: o.stageCode,
        orderedByDoctorId: o.orderedByDoctorId,
        requiredResult: o.requiredResult,
        billableSnapshot: o.billableSnapshot,
        status: o.status,
        version: currentEncounter.version,
        createdAt: o.createdAt.toISOString(),
      },
    };
  }

  async orderState(orderId: string, state: any, data?: any) {
    const order = await this.db.clinicalServiceOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    const updated = await this.db.clinicalServiceOrder.update({
      where: { id: orderId },
      data: {
        status: state,
        performedAt: state === 'PERFORMED' ? new Date() : undefined,
        verifiedAt: state === 'VERIFIED' ? new Date() : undefined,
        structuredResult: data,
        version: { increment: 1 },
      },
    });
    return { data: updated };
  }

  async amend(id: string, data: any, actor: string, role?: string) {
    if (role === 'DOCTOR') await this.assertDoctorAssigned(id, actor);
    const x = await this.get(id);
    if (x.state !== EncounterState.FINALIZED) {
      throw new ConflictException('NOT_FINALIZED');
    }
    return this.db.encounterAmendment.create({
      data: {
        encounterId: id,
        section: data.section,
        reason: data.reason,
        patch: data.patch,
        authorDoctorId: actor,
      },
    });
  }

  private viewEncounter(x: any) {
    const documentIds = (x.externalReferences ?? [])
      .filter((r: any) => r.resourceType === 'DOCUMENT')
      .map((r: any) => r.resourceId);
    const prescriptionIds = (x.externalReferences ?? [])
      .filter((r: any) => r.resourceType === 'PRESCRIPTION')
      .map((r: any) => r.resourceId);
    const treatmentPlanIds = (x.externalReferences ?? [])
      .filter((r: any) => r.resourceType === 'TREATMENT_PLAN')
      .map((r: any) => r.resourceId);

    return {
      id: x.id,
      appointmentId: x.appointmentId,
      patientId: x.patientId,
      pregnancyEpisodeId: x.pregnancyEpisodeId ?? null,
      primaryDoctorId: x.primaryDoctorId,
      state: x.state,
      version: x.version,
      chiefComplaint: x.chiefComplaint ?? null,
      clinicalSummary: x.clinicalSummary ?? null,
      startedAt: x.startedAt ? x.startedAt.toISOString() : null,
      reviewReadyAt: x.reviewReadyAt ? x.reviewReadyAt.toISOString() : null,
      finalizedAt: x.finalizedAt ? x.finalizedAt.toISOString() : null,
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
      documentIds,
      prescriptionIds,
      treatmentPlanIds,
      vitalSigns: x.vitalSigns ?? undefined,
      notes: x.notes
        ? x.notes.map((n: any) => ({
            ...n,
            content: n.text,
            noteType: n.noteType ?? 'SUBJECTIVE',
          }))
        : undefined,
      diagnoses: x.diagnoses ?? undefined,
      orders: x.orders ?? undefined,
    };
  }

  private requireVersion(version: unknown): asserts version is number {
    if (!Number.isInteger(version) || Number(version) < 1) throw new BadRequestException('EXPECTED_VERSION_REQUIRED');
  }

  private async doctorClinicalWrite(id: string, actor: string, version: unknown, create: (tx: Prisma.TransactionClient, nextVersion: number) => Promise<any>) {
    this.requireVersion(version);
    const doctorId = await this.doctorIdentity.resolve(actor);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.clinicalEncounter.updateMany({ where: { id, version, state: EncounterState.IN_PROGRESS, assignments: { some: { staffId: doctorId, status: AssignmentStatus.ACTIVE } } }, data: { version: { increment: 1 } } });
      if (!changed.count) throw new ConflictException('NOT_ASSIGNED_OR_INVALID_STATE_OR_VERSION');
      return create(tx, version + 1);
    });
  }

  private async access(id: string, actor: string, role?: string) {
    if (role === 'DOCTOR') await this.assertDoctorAssigned(id, actor);
    const x = await this.get(id);
    if (x.state === EncounterState.FINALIZED) {
      throw new ConflictException('ENCOUNTER_FINALIZED');
    }
    if (role === 'ADMIN' || role === 'NURSE' || role === 'CLINICAL_STAFF') {
      return;
    }
    if (role === 'DOCTOR') {
      return;
    }
    const a = await this.db.encounterAssignment.findFirst({
      where: {
        encounterId: id,
        status: AssignmentStatus.ACTIVE,
      },
    });
    if (!a) throw new ForbiddenException('NOT_ASSIGNED');
    if (a.staffId === actor) return;
    throw new ForbiddenException('NOT_ASSIGNED');
  }

  private async bump(id: string, v?: number) {
    const enc = await this.get(id);
    const targetVersion =
      v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : enc.version;
    const u = await this.db.clinicalEncounter.updateMany({
      where: { id, version: targetVersion },
      data: { version: { increment: 1 } },
    });
    if (!u.count) {
      await this.db.clinicalEncounter.update({
        where: { id },
        data: { version: { increment: 1 } },
      });
    }
    return this.get(id);
  }

  private async transition(
    id: string,
    v: number,
    from: EncounterState[],
    to: EncounterState,
    data: any,
    actor: string,
    event: string,
  ) {
    const current = await this.get(id);
    const versionToUse =
      v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : current.version;
    return this.db.$transaction(async (tx) => {
      const u = await tx.clinicalEncounter.updateMany({
        where: { id, version: versionToUse, state: { in: from } },
        data: { ...data, state: to, version: { increment: 1 } },
      });
      if (!u.count) throw new ConflictException('INVALID_STATE_TRANSITION');
      const x = await tx.clinicalEncounter.findUnique({
        where: { id },
        include: { externalReferences: true },
      });
      await tx.medicalAudit.create({
        data: { eventType: event, actorId: actor, encounterId: id },
      });
      await this.event(tx, x!, event);
      return x!;
    });
  }

  private async event(tx: any, x: any, type: string) {
    await tx.medicalOutbox.create({
      data: {
        eventType: type,
        aggregateId: x.id,
        aggregateVersion: x.version,
        payload: {
          eventVersion: 1,
          aggregateType: 'clinical_encounter',
          aggregateId: x.id,
          data: {
            encounterId: x.id,
            appointmentId: x.appointmentId,
            patientId: x.patientId,
            state: x.state,
          },
        },
      },
    });
  }

  private summary(x: any) {
    return {
      encounterId: x.id,
      appointmentId: x.appointmentId,
      patientId: x.patientId,
      pregnancyEpisodeId: x.pregnancyEpisodeId ?? '',
      primaryDoctorId: x.primaryDoctorId,
      state: 'ENCOUNTER_STATE_' + x.state,
      version: String(x.version),
      startedAt: x.startedAt ? this.time(x.startedAt) : undefined,
      finalizedAt: x.finalizedAt ? this.time(x.finalizedAt) : undefined,
    };
  }

  private time(d: Date) {
    return {
      seconds: Math.floor(d.getTime() / 1000).toString(),
      nanos: (d.getTime() % 1000) * 1000000,
    };
  }
}
