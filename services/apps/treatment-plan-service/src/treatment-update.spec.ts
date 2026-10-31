import { ConflictException } from '@nestjs/common';
import { TreatmentService } from './treatment.service';

describe('treatment plan updates', () => {
  it('does not replace plan items when the version was concurrently changed', async () => {
    const tx = {
      treatmentPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'p', version: 2, status: 'DRAFT', items: [] }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      treatmentPlanItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      treatmentPlanVersion: { create: jest.fn() },
    };
    const service = new TreatmentService({ $transaction: (fn: any) => fn(tx) } as any);
    await expect(service.updateRest('p', { version: 2, items: [{ title: 'Theo dõi' }] })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.treatmentPlanItem.deleteMany).not.toHaveBeenCalled();
  });
  it('rejects edits to completed plans', async () => {
    const tx = { treatmentPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'p', version: 2, status: 'COMPLETED', items: [] }), updateMany: jest.fn() } };
    const service = new TreatmentService({ $transaction: (fn: any) => fn(tx) } as any);
    await expect(service.updateRest('p', { version: 2, title: 'Khác' })).rejects.toThrow('PLAN_NOT_EDITABLE');
    expect(tx.treatmentPlan.updateMany).not.toHaveBeenCalled();
  });
});
