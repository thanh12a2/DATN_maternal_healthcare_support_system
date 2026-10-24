import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CatalogStatus,
  DoctorRankSelectionPolicy,
  MedicalService,
  Prisma,
  PriceStatus,
} from '../../../../generated/catalog-client';
import { DomainException } from '../common/domain.exception';
import { CatalogDatabaseService } from '../database/catalog-database.service';
import {
  CreateCategoryDto,
  CreateServiceDto,
  CreateTagDto,
  EligibilityQueryDto,
  ListAdminServicesQueryDto,
  ListServicesQueryDto,
  ResolveServicesDto,
  ScheduleBasePriceDto,
  ScheduleRankSurchargeDto,
  UpdateCategoryDto,
  UpdateServiceDto,
  UpdateTagDto,
} from './dto';

type ServiceWithRelations = Prisma.MedicalServiceGetPayload<{
  include: {
    categories: { include: { category: true } };
    tags: { include: { tag: true } };
    basePrices: true;
  };
}>;

const DEFAULT_RANK_CODE = 'BASIC';
const ACTIVE_PRICE_STATUSES: PriceStatus[] = ['ACTIVE', 'SCHEDULED'];

@Injectable()
export class CatalogService {
  constructor(private readonly db: CatalogDatabaseService) {}

  async listPublicServices(query: ListServicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.MedicalServiceWhereInput = {
      status: 'ACTIVE',
      ...(query.bookingEnabled === undefined ? {} : { bookingEnabled: query.bookingEnabled }),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.specialtyId ? { specialtyId: query.specialtyId } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.category
        ? { categories: { some: { category: { OR: this.categoryIdentifierWhere(query.category) } } } }
        : {}),
      ...(query.tag
        ? { tags: { some: { tag: { OR: this.tagIdentifierWhere(query.tag) } } } }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.medicalService.findMany({
        where,
        include: this.serviceIncludes(true),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.medicalService.count({ where }),
    ]);
    return { data: items.map((item) => this.presentService(item)), meta: { page, limit, total } };
  }

  async listAdminServices(query: ListAdminServicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.MedicalServiceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.bookingEnabled === undefined ? {} : { bookingEnabled: query.bookingEnabled }),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.specialtyId ? { specialtyId: query.specialtyId } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.category
        ? { categories: { some: { category: { OR: this.categoryIdentifierWhere(query.category) } } } }
        : {}),
      ...(query.tag
        ? { tags: { some: { tag: { OR: this.tagIdentifierWhere(query.tag) } } } }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.medicalService.findMany({
        where,
        include: {
          categories: { include: { category: true }, orderBy: [{ category: { sortOrder: 'asc' } }] },
          tags: { include: { tag: true }, orderBy: [{ tag: { group: 'asc' } }, { tag: { sortOrder: 'asc' } }] },
          basePrices: { orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.medicalService.count({ where }),
    ]);
    return { data: items.map((item) => this.presentService(item)), meta: { page, limit, total } };
  }

  async getAdminService(serviceId: string) {
    const service = await this.db.medicalService.findUnique({
      where: { id: serviceId },
      include: {
        categories: { include: { category: true }, orderBy: [{ category: { sortOrder: 'asc' } }] },
        tags: { include: { tag: true }, orderBy: [{ tag: { group: 'asc' } }, { tag: { sortOrder: 'asc' } }] },
        basePrices: { orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!service) this.notFound('SERVICE_NOT_FOUND', 'Medical service was not found');
    return { data: this.presentService(service) };
  }

  async deleteService(serviceId: string) {
    await this.ensureServiceExists(serviceId);
    try {
      await this.db.medicalService.delete({ where: { id: serviceId } });
      return { success: true, message: 'Đã xóa dịch vụ thành công' };
    } catch {
      await this.db.medicalService.update({
        where: { id: serviceId },
        data: { status: 'ARCHIVED', version: { increment: 1 } },
      });
      return { success: true, message: 'Dịch vụ đã có dữ liệu liên kết, đã chuyển sang trạng thái Lưu trữ (ARCHIVED)' };
    }
  }

  async getPublicService(idOrSlug: string) {
    const service = await this.findServiceByIdOrSlug(idOrSlug, { status: 'ACTIVE' }, true);
    return { data: this.presentService(service) };
  }

  async listPublicCategories() {
    const categories = await this.db.serviceCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { data: categories.map((category) => this.presentCategory(category)) };
  }

  async getFilters() {
    const [categories, tags] = await Promise.all([
      this.db.serviceCategory.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.db.catalogTag.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] }),
    ]);
    return {
      data: {
        categories: categories.map((category) => this.presentCategory(category)),
        tags: tags.map((tag) => this.presentTag(tag)),
      },
    };
  }

  async createService(dto: CreateServiceDto) {
    try {
      const service = await this.db.$transaction(async (tx) => {
        const created = await tx.medicalService.create({
          data: {
            code: this.normalizeCode(dto.code),
            slug: this.normalizeSlug(dto.slug ?? dto.name),
            name: dto.name.trim(),
            summary: this.clean(dto.summary),
            description: this.clean(dto.description),
            kind: dto.kind,
            specialtyId: dto.specialtyId,
            thumbnailUrl: dto.thumbnailUrl,
            durationMinutes: dto.durationMinutes,
            bookingEnabled: dto.bookingEnabled ?? true,
            doctorRankSelectionPolicy: dto.doctorRankSelectionPolicy ?? 'NOT_REQUIRED',
            status: dto.status ?? 'DRAFT',
          },
        });
        await this.replaceServiceLinks(tx, created.id, dto.primaryCategoryId, dto.categoryIds, dto.tagIds);
        if (dto.initialPriceMinor !== undefined && dto.initialPriceMinor >= 0) {
          await tx.basePrice.create({
            data: {
              medicalServiceId: created.id,
              amountMinor: BigInt(dto.initialPriceMinor),
              currency: 'VND',
              effectiveFrom: new Date(),
              status: 'ACTIVE',
            },
          });
        }
        return tx.medicalService.findUniqueOrThrow({ where: { id: created.id }, include: this.serviceIncludes() });
      });
      return { data: this.presentService(service) };
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async updateService(serviceId: string, dto: UpdateServiceDto) {
    await this.ensureServiceExists(serviceId);
    try {
      const service = await this.db.$transaction(async (tx) => {
        await tx.medicalService.update({
          where: { id: serviceId },
          data: {
            ...(dto.code ? { code: this.normalizeCode(dto.code) } : {}),
            ...(dto.slug ? { slug: this.normalizeSlug(dto.slug) } : {}),
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(dto.summary !== undefined ? { summary: this.clean(dto.summary) } : {}),
            ...(dto.description !== undefined ? { description: this.clean(dto.description) } : {}),
            ...(dto.kind ? { kind: dto.kind } : {}),
            ...(dto.specialtyId !== undefined ? { specialtyId: dto.specialtyId } : {}),
            ...(dto.thumbnailUrl !== undefined ? { thumbnailUrl: dto.thumbnailUrl } : {}),
            ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
            ...(dto.bookingEnabled !== undefined ? { bookingEnabled: dto.bookingEnabled } : {}),
            ...(dto.doctorRankSelectionPolicy ? { doctorRankSelectionPolicy: dto.doctorRankSelectionPolicy } : {}),
            ...(dto.status ? { status: dto.status } : {}),
            version: { increment: 1 },
          },
        });
        if (dto.primaryCategoryId !== undefined || dto.categoryIds !== undefined || dto.tagIds !== undefined) {
          await this.replaceServiceLinks(tx, serviceId, dto.primaryCategoryId, dto.categoryIds, dto.tagIds);
        }
        return tx.medicalService.findUniqueOrThrow({ where: { id: serviceId }, include: this.serviceIncludes() });
      });
      return { data: this.presentService(service) };
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async changeServiceStatus(serviceId: string, status: CatalogStatus) {
    const service = await this.db.medicalService.findUnique({ where: { id: serviceId }, include: this.serviceIncludes() });
    if (!service) this.notFound('SERVICE_NOT_FOUND', 'Medical service was not found');
    if (status === 'ACTIVE') await this.validateActivation(service);
    const updated = await this.db.medicalService.update({
      where: { id: serviceId },
      data: {
        status,
        publishedAt: status === 'ACTIVE' && !service.publishedAt ? new Date() : service.publishedAt,
        version: { increment: 1 },
      },
      include: this.serviceIncludes(),
    });
    return { data: this.presentService(updated) };
  }

  async createCategory(dto: CreateCategoryDto) {
    try {
      const category = await this.db.serviceCategory.create({
        data: {
          code: this.normalizeCode(dto.code),
          slug: this.normalizeSlug(dto.slug ?? dto.name),
          name: dto.name.trim(),
          description: this.clean(dto.description),
          parentId: dto.parentId,
          status: dto.status ?? 'DRAFT',
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return { data: this.presentCategory(category) };
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async updateCategory(categoryId: string, dto: UpdateCategoryDto) {
    try {
      const category = await this.db.serviceCategory.update({
        where: { id: categoryId },
        data: {
          ...(dto.code ? { code: this.normalizeCode(dto.code) } : {}),
          ...(dto.slug ? { slug: this.normalizeSlug(dto.slug) } : {}),
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: this.clean(dto.description) } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
      return { data: this.presentCategory(category) };
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async listAdminCategories() {
    const categories = await this.db.serviceCategory.findMany({
      include: {
        parent: { select: { id: true, name: true, code: true } },
        _count: { select: { services: true, children: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return {
      data: categories.map((cat) => ({
        ...this.presentCategory(cat),
        parent: cat.parent,
        servicesCount: cat._count.services,
        childrenCount: cat._count.children,
      })),
    };
  }

  async deleteCategory(categoryId: string) {
    const cat = await this.db.serviceCategory.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { children: true } } },
    });
    if (!cat) this.notFound('CATEGORY_NOT_FOUND', 'Category was not found');
    if (cat._count.children > 0) {
      throw new DomainException('CATEGORY_HAS_CHILDREN', 'Không thể xóa nhóm dịch vụ đang chứa nhóm dịch vụ con', HttpStatus.CONFLICT);
    }
    // Gỡ bỏ toàn bộ liên kết của các dịch vụ với nhóm dịch vụ này trước khi xóa
    await this.db.medicalServiceCategory.deleteMany({ where: { categoryId } });
    await this.db.serviceCategory.delete({ where: { id: categoryId } });
    return { success: true, message: 'Đã xóa nhóm dịch vụ thành công' };
  }

  async changeCategoryStatus(categoryId: string, status: CatalogStatus) {
    const category = await this.db.serviceCategory.update({
      where: { id: categoryId },
      data: { status },
    });
    return { data: this.presentCategory(category) };
  }

  async createTag(dto: CreateTagDto) {
    try {
      const tag = await this.db.catalogTag.create({
        data: {
          code: this.normalizeCode(dto.code),
          slug: this.normalizeSlug(dto.slug ?? dto.name),
          name: dto.name.trim(),
          group: dto.group,
          description: this.clean(dto.description),
          status: dto.status ?? 'DRAFT',
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return { data: this.presentTag(tag) };
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async updateTag(tagId: string, dto: UpdateTagDto) {
    try {
      const tag = await this.db.catalogTag.update({
        where: { id: tagId },
        data: {
          ...(dto.code ? { code: this.normalizeCode(dto.code) } : {}),
          ...(dto.slug ? { slug: this.normalizeSlug(dto.slug) } : {}),
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.group ? { group: dto.group } : {}),
          ...(dto.description !== undefined ? { description: this.clean(dto.description) } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
      return { data: this.presentTag(tag) };
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async listAdminTags() {
    const tags = await this.db.catalogTag.findMany({
      include: {
        _count: { select: { services: true } },
      },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return {
      data: tags.map((t) => ({
        ...this.presentTag(t),
        servicesCount: t._count.services,
      })),
    };
  }

  async deleteTag(tagId: string) {
    const tag = await this.db.catalogTag.findUnique({ where: { id: tagId } });
    if (!tag) this.notFound('TAG_NOT_FOUND', 'Tag was not found');
    await this.db.medicalServiceTag.deleteMany({ where: { tagId } });
    await this.db.catalogTag.delete({ where: { id: tagId } });
    return { success: true, message: 'Đã xóa thẻ tag thành công' };
  }

  async changeTagStatus(tagId: string, status: CatalogStatus) {
    const tag = await this.db.catalogTag.update({
      where: { id: tagId },
      data: { status },
    });
    return { data: this.presentTag(tag) };
  }

  async scheduleBasePrice(serviceId: string, dto: ScheduleBasePriceDto) {
    await this.ensureServiceExists(serviceId);
    const currency = this.normalizeCurrency(dto.currency);
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    this.validateInterval(effectiveFrom, effectiveTo);

    const now = new Date();
    // Tự động đóng khoảng hiệu lực và chuyển trạng thái EXPIRED cho giá cũ nếu giá mới có hiệu lực ngay
    const isEffectiveNow = effectiveFrom <= now;
    await this.db.basePrice.updateMany({
      where: {
        medicalServiceId: serviceId,
        currency,
        status: { in: ACTIVE_PRICE_STATUSES },
        effectiveFrom: { lt: effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
      data: {
        effectiveTo: effectiveFrom,
        ...(isEffectiveNow ? { status: 'EXPIRED' } : {}),
      },
    });

    await this.ensureNoBasePriceOverlap(serviceId, currency, effectiveFrom, effectiveTo);
    const price = await this.db.basePrice.create({
      data: {
        medicalServiceId: serviceId,
        amountMinor: BigInt(dto.amountMinor),
        currency,
        effectiveFrom,
        effectiveTo,
        status: dto.status ?? (isEffectiveNow ? 'ACTIVE' : 'SCHEDULED'),
      },
    });
    return { data: this.presentPrice(price) };
  }

  async scheduleRankSurcharge(dto: ScheduleRankSurchargeDto) {
    const currency = this.normalizeCurrency(dto.currency);
    const rankCode = this.normalizeCode(dto.rankCode);
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    this.validateInterval(effectiveFrom, effectiveTo);

    const now = new Date();
    const isEffectiveNow = effectiveFrom <= now;
    // Tự động đóng khoảng hiệu lực và chuyển trạng thái EXPIRED cho phụ thu cũ nếu phụ thu mới có hiệu lực ngay
    await this.db.doctorRankSurcharge.updateMany({
      where: {
        rankCode,
        currency,
        status: { in: ACTIVE_PRICE_STATUSES },
        effectiveFrom: { lt: effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
      data: {
        effectiveTo: effectiveFrom,
        ...(isEffectiveNow ? { status: 'EXPIRED' } : {}),
      },
    });

    await this.ensureNoSurchargeOverlap(rankCode, currency, effectiveFrom, effectiveTo);
    const surcharge = await this.db.doctorRankSurcharge.create({
      data: {
        rankCode,
        amountMinor: BigInt(dto.amountMinor),
        currency,
        effectiveFrom,
        effectiveTo,
        status: dto.status ?? (isEffectiveNow ? 'ACTIVE' : 'SCHEDULED'),
      },
    });
    return { data: this.presentSurcharge(surcharge) };
  }

  async cancelPrice(priceId: string) {
    try {
      const price = await this.db.basePrice.update({ where: { id: priceId }, data: { status: 'CANCELLED', version: { increment: 1 } } });
      return { data: this.presentPrice(price) };
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async cancelRankSurcharge(surchargeId: string) {
    try {
      const surcharge = await this.db.doctorRankSurcharge.update({ where: { id: surchargeId }, data: { status: 'CANCELLED', version: { increment: 1 } } });
      return { data: this.presentSurcharge(surcharge) };
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async listServicePrices(serviceId: string) {
    await this.ensureServiceExists(serviceId);
    const prices = await this.db.basePrice.findMany({
      where: { medicalServiceId: serviceId },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    return { data: prices.map((p) => this.presentPrice(p)) };
  }

  async listRankSurcharges() {
    const surcharges = await this.db.doctorRankSurcharge.findMany({
      orderBy: [{ rankCode: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return { data: surcharges.map((s) => this.presentSurcharge(s)) };
  }

  async resolveEligibility(serviceId: string, query: EligibilityQueryDto) {
    const at = query.at ? new Date(query.at) : new Date();
    const currency = this.normalizeCurrency(query.currency);
    const service = await this.db.medicalService.findUnique({ where: { id: serviceId } });
    if (!service || service.status !== 'ACTIVE') this.notFound('SERVICE_NOT_AVAILABLE', 'Medical service is not active');
    if (!service.bookingEnabled) throw new DomainException('BOOKING_DISABLED', 'Medical service is not enabled for booking', HttpStatus.CONFLICT);
    const basePrice = await this.findEffectiveBasePrice(service.id, currency, at);
    if (!basePrice) throw new DomainException('BASE_PRICE_NOT_FOUND', 'No effective base price was found', HttpStatus.CONFLICT);
    const selectedRankCode = this.normalizeCode(query.doctorRankCode ?? DEFAULT_RANK_CODE);
    const surcharge = await this.resolveSurcharge(service.doctorRankSelectionPolicy, selectedRankCode, currency, at);
    const surchargeAmount = surcharge ? Number(surcharge.amountMinor) : 0;
    const baseAmount = Number(basePrice.amountMinor);
    return {
      data: {
        service: this.presentSnapshotService(service),
        basePrice: this.presentSnapshotPrice(basePrice),
        doctorRankSurcharge: surcharge
          ? {
              rankCode: selectedRankCode,
              priceId: surcharge.id,
              amountMinor: surchargeAmount,
              currency: surcharge.currency,
              version: surcharge.version,
            }
          : null,
        estimatedTotal: { amountMinor: baseAmount + surchargeAmount, currency },
      },
    };
  }

  async resolveMany(dto: ResolveServicesDto) {
    const results: unknown[] = [];
    for (const serviceId of dto.serviceIds) {
      results.push((await this.resolveEligibility(serviceId, dto)).data);
    }
    return { data: results };
  }

  private async resolveSurcharge(policy: DoctorRankSelectionPolicy, rankCode: string, currency: string, at: Date) {
    if (policy === 'NOT_REQUIRED' || policy === 'BASIC_INCLUDED') return null;
    const surcharge = await this.findEffectiveSurcharge(rankCode, currency, at);
    if (!surcharge) throw new DomainException('RANK_SURCHARGE_NOT_FOUND', 'No effective doctor rank surcharge was found', HttpStatus.CONFLICT);
    if (rankCode === DEFAULT_RANK_CODE && Number(surcharge.amountMinor) !== 0) {
      throw new DomainException('BASIC_RANK_SURCHARGE_INVALID', 'Basic rank surcharge must be 0', HttpStatus.CONFLICT);
    }
    return surcharge;
  }

  private async validateActivation(service: ServiceWithRelations) {
    if (service.categories.length === 0) {
      throw new DomainException('CATEGORY_REQUIRED', 'Active service must have at least one category', HttpStatus.CONFLICT);
    }
    const hasActiveCategory = service.categories.some((item) => item.category.status === 'ACTIVE');
    if (!hasActiveCategory) {
      throw new DomainException('ACTIVE_CATEGORY_REQUIRED', 'At least one category of the service must be active', HttpStatus.CONFLICT);
    }
    if (service.doctorRankSelectionPolicy === 'RANK_UPGRADE_ALLOWED') {
      const basic = await this.findEffectiveSurcharge(DEFAULT_RANK_CODE, 'VND', new Date());
      if (!basic || Number(basic.amountMinor) !== 0) {
        throw new DomainException('BASIC_RANK_SURCHARGE_REQUIRED', 'BASIC rank must have an active 0 surcharge before activation', HttpStatus.CONFLICT);
      }
    }
  }

  private async replaceServiceLinks(
    tx: Prisma.TransactionClient,
    serviceId: string,
    primaryCategoryId?: string,
    categoryIds?: string[],
    tagIds?: string[],
  ) {
    if (primaryCategoryId !== undefined || categoryIds !== undefined) {
      const categorySet = new Set([...(categoryIds ?? []), ...(primaryCategoryId ? [primaryCategoryId] : [])]);
      await tx.medicalServiceCategory.deleteMany({ where: { medicalServiceId: serviceId } });
      for (const categoryId of categorySet) {
        await tx.medicalServiceCategory.create({ data: { medicalServiceId: serviceId, categoryId } });
      }
    }
    if (tagIds !== undefined) {
      await tx.medicalServiceTag.deleteMany({ where: { medicalServiceId: serviceId } });
      for (const tagId of new Set(tagIds)) {
        await tx.medicalServiceTag.create({ data: { medicalServiceId: serviceId, tagId } });
      }
    }
  }

  private serviceIncludes(onlyActive = false) {
    return {
      categories: {
        ...(onlyActive ? { where: { category: { status: 'ACTIVE' as const } } } : {}),
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' as const } }],
      },
      tags: {
        ...(onlyActive ? { where: { tag: { status: 'ACTIVE' as const } } } : {}),
        include: { tag: true },
        orderBy: [{ tag: { group: 'asc' as const } }, { tag: { sortOrder: 'asc' as const } }],
      },
      basePrices: { where: { status: { in: ACTIVE_PRICE_STATUSES } }, orderBy: [{ effectiveFrom: 'desc' as const }] },
    };
  }

  private async findServiceByIdOrSlug(idOrSlug: string, extra?: Prisma.MedicalServiceWhereInput, onlyActive = false): Promise<ServiceWithRelations> {
    const service = await this.db.medicalService.findFirst({
      where: { AND: [{ OR: this.serviceIdentifierWhere(idOrSlug) }, extra ?? {}] },
      include: this.serviceIncludes(onlyActive),
    });
    if (!service) this.notFound('SERVICE_NOT_FOUND', 'Medical service was not found');
    return service;
  }

  private serviceIdentifierWhere(value: string): Prisma.MedicalServiceWhereInput[] {
    const terms: Prisma.MedicalServiceWhereInput[] = [
      { slug: value },
      { code: this.normalizeCode(value) },
    ];
    if (this.isUuid(value)) terms.unshift({ id: value });
    return terms;
  }

  private categoryIdentifierWhere(value: string): Prisma.ServiceCategoryWhereInput[] {
    const terms: Prisma.ServiceCategoryWhereInput[] = [
      { slug: value },
      { code: this.normalizeCode(value) },
    ];
    if (this.isUuid(value)) terms.unshift({ id: value });
    return terms;
  }

  private tagIdentifierWhere(value: string): Prisma.CatalogTagWhereInput[] {
    const terms: Prisma.CatalogTagWhereInput[] = [
      { slug: value },
      { code: this.normalizeCode(value) },
    ];
    if (this.isUuid(value)) terms.unshift({ id: value });
    return terms;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private async ensureServiceExists(serviceId: string): Promise<MedicalService> {
    const service = await this.db.medicalService.findUnique({ where: { id: serviceId } });
    if (!service) this.notFound('SERVICE_NOT_FOUND', 'Medical service was not found');
    return service;
  }

  private async findEffectiveBasePrice(serviceId: string, currency: string, at: Date) {
    return this.db.basePrice.findFirst({
      where: {
        medicalServiceId: serviceId,
        currency,
        status: { in: ACTIVE_PRICE_STATUSES },
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async findEffectiveSurcharge(rankCode: string, currency: string, at: Date) {
    return this.db.doctorRankSurcharge.findFirst({
      where: {
        rankCode,
        currency,
        status: { in: ACTIVE_PRICE_STATUSES },
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async ensureNoBasePriceOverlap(serviceId: string, currency: string, from: Date, to: Date | null) {
    const existing = await this.db.basePrice.findFirst({
      where: { medicalServiceId: serviceId, currency, status: { in: ACTIVE_PRICE_STATUSES }, AND: this.overlapWhere<Prisma.BasePriceWhereInput>(from, to) },
    });
    if (existing) throw new DomainException('BASE_PRICE_OVERLAP', 'Base price interval overlaps with an existing price', HttpStatus.CONFLICT);
  }

  private async ensureNoSurchargeOverlap(rankCode: string, currency: string, from: Date, to: Date | null) {
    const existing = await this.db.doctorRankSurcharge.findFirst({
      where: { rankCode, currency, status: { in: ACTIVE_PRICE_STATUSES }, AND: this.overlapWhere<Prisma.DoctorRankSurchargeWhereInput>(from, to) },
    });
    if (existing) throw new DomainException('RANK_SURCHARGE_OVERLAP', 'Rank surcharge interval overlaps with an existing surcharge', HttpStatus.CONFLICT);
  }

  private overlapWhere<T>(from: Date, to: Date | null): T[] {
    return [
      ...(to ? [{ effectiveFrom: { lt: to } }] : []),
      { OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] },
    ] as T[];
  }

  private validateInterval(from: Date, to: Date | null): void {
    if (Number.isNaN(from.getTime()) || (to && Number.isNaN(to.getTime())) || (to && to <= from)) {
      throw new DomainException('INVALID_PRICE_INTERVAL', 'effectiveTo must be later than effectiveFrom', HttpStatus.BAD_REQUEST);
    }
  }

  private presentService(service: ServiceWithRelations) {
    return {
      id: service.id,
      code: service.code,
      slug: service.slug,
      name: service.name,
      summary: service.summary,
      description: service.description,
      kind: service.kind,
      specialtyId: service.specialtyId,
      thumbnailUrl: service.thumbnailUrl,
      durationMinutes: service.durationMinutes,
      bookingEnabled: service.bookingEnabled,
      doctorRankSelectionPolicy: service.doctorRankSelectionPolicy,
      status: service.status,
      version: service.version,
      publishedAt: service.publishedAt,
      categories: service.categories.map((link) => ({ ...this.presentCategory(link.category) })),
      tags: service.tags.map((link) => this.presentTag(link.tag)),
      prices: service.basePrices.map((price) => this.presentPrice(price)),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private presentCategory(category: { id: string; code: string; slug: string; name: string; description: string | null; parentId: string | null; status: CatalogStatus; sortOrder: number }) {
    return { id: category.id, code: category.code, slug: category.slug, name: category.name, description: category.description, parentId: category.parentId, status: category.status, sortOrder: category.sortOrder };
  }

  private presentTag(tag: { id: string; code: string; slug: string; name: string; group: string; description: string | null; status: CatalogStatus; sortOrder: number }) {
    return { id: tag.id, code: tag.code, slug: tag.slug, name: tag.name, group: tag.group, description: tag.description, status: tag.status, sortOrder: tag.sortOrder };
  }

  private presentPrice(price: { id: string; amountMinor: bigint; currency: string; effectiveFrom: Date; effectiveTo: Date | null; status: PriceStatus; version: number }) {
    return { id: price.id, amountMinor: Number(price.amountMinor), currency: price.currency, effectiveFrom: price.effectiveFrom, effectiveTo: price.effectiveTo, status: price.status, version: price.version };
  }

  private presentSurcharge(surcharge: { id: string; rankCode: string; amountMinor: bigint; currency: string; effectiveFrom: Date; effectiveTo: Date | null; status: PriceStatus; version: number; createdAt?: Date; updatedAt?: Date }) {
    return { id: surcharge.id, rankCode: surcharge.rankCode, amountMinor: Number(surcharge.amountMinor), currency: surcharge.currency, effectiveFrom: surcharge.effectiveFrom, effectiveTo: surcharge.effectiveTo, status: surcharge.status, version: surcharge.version, createdAt: surcharge.createdAt, updatedAt: surcharge.updatedAt };
  }

  private presentSnapshotService(service: MedicalService) {
    return {
      id: service.id,
      code: service.code,
      name: service.name,
      kind: service.kind,
      specialtyId: service.specialtyId,
      bookingEnabled: service.bookingEnabled,
      durationMinutes: service.durationMinutes,
      doctorRankSelectionPolicy: service.doctorRankSelectionPolicy,
      version: service.version,
    };
  }

  private presentSnapshotPrice(price: { id: string; amountMinor: bigint; currency: string; version: number }) {
    return { id: price.id, amountMinor: Number(price.amountMinor), currency: price.currency, version: price.version };
  }

  private normalizeCode(value: string): string {
    return value.trim().replace(/[-\s]+/g, '_').toUpperCase();
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 160);
  }

  private normalizeCurrency(value?: string): string {
    return (value ?? 'VND').trim().toUpperCase();
  }

  private clean(value?: string): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private notFound(code: string, message: string): never {
    throw new DomainException(code, message, HttpStatus.NOT_FOUND);
  }

  private mapPrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') this.notFound('RESOURCE_NOT_FOUND', 'Resource was not found');
      if (error.code === 'P2002') throw new DomainException('UNIQUE_CONSTRAINT_VIOLATION', 'Code or slug already exists', HttpStatus.CONFLICT, error.meta);
      if (error.code === 'P2003') throw new DomainException('RELATED_RESOURCE_NOT_FOUND', 'Related resource was not found', HttpStatus.BAD_REQUEST, error.meta);
    }
    throw error;
  }
}
