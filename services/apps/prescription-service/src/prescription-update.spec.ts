import { ConflictException } from '@nestjs/common';
import { PrescriptionService } from './prescription.service';

describe('prescription draft updates', () => {
  it('does not replace items when the version was concurrently changed', async () => {
    const tx = {
      prescription: { findUnique: jest.fn().mockResolvedValue({ id: 'p', version: 2, status: 'DRAFT' }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      prescriptionItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const service = new PrescriptionService({ $transaction: (fn: any) => fn(tx) } as any);
    await expect(service.updateRest('p', { version: 2, items: [{ medicationName: 'Thuốc' }] })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.prescriptionItem.deleteMany).not.toHaveBeenCalled();
  });
});
