import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicAuthContext } from '@platform';
import { PrescriptionPrismaService } from '../database/prisma.service';
import {
  ChangeMedicationStatusDto,
  CreateMedicationDto,
  ListMedicationsQueryDto,
  UpdateMedicationDto,
} from './medication.dto';

type CatalogRole = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'PATIENT';

@Injectable()
export class MedicationCatalogService {
  constructor(private readonly db: PrescriptionPrismaService) {}

  async list(query: ListMedicationsQueryDto, auth: PublicAuthContext) {
    this.allow(auth, ['ADMIN', 'DOCTOR', 'RECEPTIONIST']);
    if (auth.role !== 'ADMIN' && query.isActive === false) {
      throw new ForbiddenException('INACTIVE_MEDICATIONS_REQUIRE_ADMIN');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {
      ...(auth.role === 'ADMIN' && query.isActive !== undefined
        ? { isActive: query.isActive }
        : { isActive: true }),
      ...(query.pregnancyCategory
        ? { pregnancyCategory: query.pregnancyCategory }
        : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q.trim(), mode: 'insensitive' } },
              { name: { contains: query.q.trim(), mode: 'insensitive' } },
              {
                activeIngredient: {
                  contains: query.q.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.db.$transaction([
      this.db.medicationCatalog.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.medicationCatalog.count({ where }),
    ]);

    return {
      data: items.map((item) => this.view(item)),
      meta: { page, limit, total },
    };
  }

  async get(id: string, auth: PublicAuthContext) {
    this.allow(auth, ['ADMIN', 'DOCTOR', 'PATIENT']);
    const medication = await this.db.medicationCatalog.findUnique({ where: { id } });
    if (!medication || (!medication.isActive && auth.role !== 'ADMIN')) {
      throw new NotFoundException('MEDICATION_NOT_FOUND');
    }
    return { data: this.view(medication) };
  }

  async create(dto: CreateMedicationDto, auth: PublicAuthContext) {
    this.allow(auth, ['ADMIN', 'DOCTOR']);
    try {
      const medication = await this.db.medicationCatalog.create({
        data: {
          code: this.code(dto.code),
          name: this.text(dto.name),
          activeIngredient: this.text(dto.activeIngredient),
          strength: this.text(dto.strength),
          dosageForm: this.text(dto.dosageForm),
          route: this.text(dto.route),
          defaultDose: this.optionalText(dto.defaultDose),
          defaultFrequency: this.optionalText(dto.defaultFrequency),
          defaultInstruction: this.optionalText(dto.defaultInstruction),
          pregnancyCategory: dto.pregnancyCategory,
          pregnancyWarning: this.optionalText(dto.pregnancyWarning),
        },
      });
      return { data: this.view(medication) };
    } catch (error: any) {
      this.mapDatabaseError(error);
    }
  }

  async update(id: string, dto: UpdateMedicationDto, auth: PublicAuthContext) {
    this.allow(auth, ['ADMIN', 'DOCTOR']);
    const { version, ...changes } = dto;
    if (!Object.keys(changes).length) {
      throw new BadRequestException('MEDICATION_UPDATE_EMPTY');
    }
    const result = await this.db.medicationCatalog.updateMany({
      where: { id, version },
      data: {
        ...(changes.name !== undefined ? { name: this.text(changes.name) } : {}),
        ...(changes.activeIngredient !== undefined
          ? { activeIngredient: this.text(changes.activeIngredient) }
          : {}),
        ...(changes.strength !== undefined
          ? { strength: this.text(changes.strength) }
          : {}),
        ...(changes.dosageForm !== undefined
          ? { dosageForm: this.text(changes.dosageForm) }
          : {}),
        ...(changes.route !== undefined ? { route: this.text(changes.route) } : {}),
        ...(changes.defaultDose !== undefined
          ? { defaultDose: this.optionalText(changes.defaultDose) }
          : {}),
        ...(changes.defaultFrequency !== undefined
          ? { defaultFrequency: this.optionalText(changes.defaultFrequency) }
          : {}),
        ...(changes.defaultInstruction !== undefined
          ? { defaultInstruction: this.optionalText(changes.defaultInstruction) }
          : {}),
        ...(changes.pregnancyCategory !== undefined
          ? { pregnancyCategory: changes.pregnancyCategory }
          : {}),
        ...(changes.pregnancyWarning !== undefined
          ? { pregnancyWarning: this.optionalText(changes.pregnancyWarning) }
          : {}),
        version: { increment: 1 },
      },
    });
    if (!result.count) await this.notFoundOrConflict(id);
    return this.getForStaff(id);
  }

  async changeStatus(
    id: string,
    isActive: boolean,
    dto: ChangeMedicationStatusDto,
    auth: PublicAuthContext,
  ) {
    this.allow(auth, ['ADMIN']);
    const result = await this.db.medicationCatalog.updateMany({
      where: { id, version: dto.version },
      data: { isActive, version: { increment: 1 } },
    });
    if (!result.count) await this.notFoundOrConflict(id);
    return this.getForStaff(id);
  }

  async resolveActiveMedicationSnapshots(items: any[]) {
    const codes = [
      ...new Set(
        items
          .map((item) => item.medicationCode)
          .filter((code): code is string => Boolean(code))
          .map((code) => this.code(code)),
      ),
    ];
    if (!codes.length) return items;

    const medications = await this.db.medicationCatalog.findMany({
      where: { code: { in: codes }, isActive: true },
    });
    const byCode = new Map(medications.map((medication) => [medication.code, medication]));
    const missingCode = codes.find((code) => !byCode.has(code));
    if (missingCode) throw new ConflictException(`MEDICATION_NOT_AVAILABLE:${missingCode}`);

    return items.map((item) => {
      if (!item.medicationCode) return item;
      const medication = byCode.get(this.code(item.medicationCode))!;
      return {
        ...item,
        medicationCode: medication.code,
        medicationName: medication.name,
        strength: medication.strength,
        dosageForm: medication.dosageForm,
        route: item.route || medication.route,
        dose: item.dose || medication.defaultDose || '1 viên',
        frequency: item.frequency || medication.defaultFrequency || '1 lần mỗi ngày',
        instruction: item.instruction || medication.defaultInstruction || '',
      };
    });
  }

  private async getForStaff(id: string) {
    const medication = await this.db.medicationCatalog.findUnique({ where: { id } });
    if (!medication) throw new NotFoundException('MEDICATION_NOT_FOUND');
    return { data: this.view(medication) };
  }

  private async notFoundOrConflict(id: string) {
    const exists = await this.db.medicationCatalog.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('MEDICATION_NOT_FOUND');
    throw new ConflictException('VERSION_CONFLICT');
  }

  private allow(auth: PublicAuthContext, roles: CatalogRole[]) {
    if (!roles.includes(auth.role as CatalogRole)) {
      throw new ForbiddenException('FORBIDDEN');
    }
  }

  private code(value: string) {
    return this.text(value).toUpperCase().replace(/\s+/g, '-');
  }

  private text(value: string) {
    if (typeof value !== 'string') throw new BadRequestException('INVALID_MEDICATION_TEXT');
    return value.trim().replace(/\s+/g, ' ');
  }

  private optionalText(value?: string | null) {
    if (value === undefined || value === null) return null;
    const normalized = this.text(value);
    return normalized || null;
  }

  private view(medication: any) {
    return {
      id: medication.id,
      code: medication.code,
      name: medication.name,
      activeIngredient: medication.activeIngredient,
      strength: medication.strength,
      dosageForm: medication.dosageForm,
      route: medication.route,
      defaultDose: medication.defaultDose,
      defaultFrequency: medication.defaultFrequency,
      defaultInstruction: medication.defaultInstruction,
      pregnancyCategory: medication.pregnancyCategory,
      pregnancyWarning: medication.pregnancyWarning,
      isActive: medication.isActive,
      version: medication.version,
      createdAt: medication.createdAt.toISOString(),
      updatedAt: medication.updatedAt.toISOString(),
    };
  }

  private mapDatabaseError(error: any): never {
    if (error?.code === 'P2002') throw new ConflictException('MEDICATION_CODE_EXISTS');
    throw error;
  }
}
