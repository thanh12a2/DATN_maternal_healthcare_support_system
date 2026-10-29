import { ForbiddenException } from '@nestjs/common';
import { PrescriptionController } from './prescription.controller';

describe('doctor prescription access', () => {
  it('requires encounter authorization before listing', async () => {
    const assertEncounter = jest.fn().mockRejectedValue(new ForbiddenException());
    const listRest = jest.fn();
    const controller = new PrescriptionController({ listRest } as any, { assertEncounter } as any);
    await expect(controller.listPrescriptions({ encounterId: 'other' }, { role: 'DOCTOR', userId: 'a' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(listRest).not.toHaveBeenCalled();
  });

  it('blocks doctor writes until clinical write safeguards are implemented', () => {
    const createRest = jest.fn();
    const controller = new PrescriptionController({ createRest } as any, {} as any);
    expect(() => controller.createPrescription({}, { role: 'DOCTOR', userId: 'a' } as any)).toThrow(ForbiddenException);
    expect(createRest).not.toHaveBeenCalled();
  });
});
