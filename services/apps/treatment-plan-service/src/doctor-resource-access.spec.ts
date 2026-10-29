import { ForbiddenException } from '@nestjs/common';
import { TreatmentController } from './treatment.controller';

describe('doctor treatment plan access', () => {
  it('does not return a plan when its encounter assignment is denied', async () => {
    const controller = new TreatmentController({ getRest: jest.fn().mockResolvedValue({ data: { sourceEncounterId: 'other', patientId: 'p' } }) } as any, { assertEncounter: jest.fn().mockRejectedValue(new ForbiddenException()) } as any);
    await expect(controller.getTreatmentPlan('id', { role: 'DOCTOR', userId: 'a' } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
