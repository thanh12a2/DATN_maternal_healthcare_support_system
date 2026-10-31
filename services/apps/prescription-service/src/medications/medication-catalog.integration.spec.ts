import { ConflictException } from '@nestjs/common';
import { MedicationCatalogService } from './medication-catalog.service';

describe('prescription medication catalog snapshots', () => {
  it('uses the active catalog identity while preserving the prescribed dose', async () => {
    const db = { medicationCatalog: { findMany: jest.fn().mockResolvedValue([{ code: 'MED_1', name: 'Catalog name', strength: '10 mg', dosageForm: 'Tablet', route: 'Oral' }]) } };
    const service = new MedicationCatalogService(db as any);
    const [item] = await service.resolveActiveMedicationSnapshots([{ medicationCode: 'MED_1', medicationName: 'Old name', dose: '2 tablets', frequency: 'Daily', route: 'Oral' }]);
    expect(item).toMatchObject({ medicationCode: 'MED_1', medicationName: 'Catalog name', strength: '10 mg', dose: '2 tablets', frequency: 'Daily' });
    expect(db.medicationCatalog.findMany).toHaveBeenCalledWith({ where: { code: { in: ['MED_1'] }, isActive: true } });
  });

  it('rejects a medication that is inactive or missing', async () => {
    const service = new MedicationCatalogService({ medicationCatalog: { findMany: jest.fn().mockResolvedValue([]) } } as any);
    await expect(service.resolveActiveMedicationSnapshots([{ medicationCode: 'MED_1' }])).rejects.toBeInstanceOf(ConflictException);
  });
});
