import { CatalogService } from './catalog.service';
import { CreateServiceDto } from './dto';
import { CatalogDatabaseService } from '../database/catalog-database.service';

describe('CatalogService.createService', () => {
  it('creates the initial price in the same transaction as the service', async () => {
    const created = { id: 'service-id' };
    const full = {
      ...created,
      tags: [],
      basePrices: [],
    };
    const tx = {
      medicalService: {
        create: jest.fn().mockResolvedValue(created),
        findUniqueOrThrow: jest.fn().mockResolvedValue(full),
      },
      basePrice: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      $transaction: jest.fn().mockImplementation((operation) => operation(tx)),
    };
    const service = new CatalogService(db as unknown as CatalogDatabaseService);
    jest.spyOn(service as never, 'presentService' as never).mockReturnValue(full as never);

    const payload = {
      code: 'QA_SERVICE',
      name: 'QA service',
      kind: 'CONSULTATION',
      initialPriceMinor: 10_000,
    } as CreateServiceDto;
    await service.createService(payload);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.basePrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        medicalServiceId: 'service-id',
        amountMinor: 10_000n,
        currency: 'VND',
        effectiveFrom: expect.any(Date),
        status: 'ACTIVE',
      }),
    });
  });
});

describe('CatalogService admin catalog data', () => {
  it('returns the real number of services linked to each tag', async () => {
    const tag = {
      id: 'tag-id', code: 'QA', slug: 'qa', name: 'QA', group: 'LABEL',
      description: null, status: 'ACTIVE', sortOrder: 0,
      _count: { services: 3 },
    };
    const db = { catalogTag: { findMany: jest.fn().mockResolvedValue([tag]) } };
    const service = new CatalogService(db as unknown as CatalogDatabaseService);

    const result = await service.listAdminTags();
    expect(result.data[0].servicesCount).toBe(3);
  });

  it('rejects deletion of a published service', async () => {
    const db = {
      medicalService: {
        findUnique: jest.fn().mockResolvedValue({ id: 'service-id', status: 'ACTIVE', publishedAt: new Date() }),
        delete: jest.fn(),
      },
    };
    const service = new CatalogService(db as unknown as CatalogDatabaseService);

    await expect(service.deleteDraftService('service-id')).rejects.toMatchObject({ status: 409 });
    expect(db.medicalService.delete).not.toHaveBeenCalled();
  });
});
