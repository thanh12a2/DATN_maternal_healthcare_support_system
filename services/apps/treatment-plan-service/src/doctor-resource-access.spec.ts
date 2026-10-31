import { ForbiddenException } from '@nestjs/common';
import { TreatmentController } from './treatment.controller';

describe('doctor treatment plan access', () => {
  it('does not return a plan when its encounter assignment is denied', async () => {
    const controller = new TreatmentController({ getRest: jest.fn().mockResolvedValue({ data: { sourceEncounterId: 'other', patientId: 'p' } }) } as any, { assertEncounter: jest.fn().mockRejectedValue(new ForbiddenException()) } as any);
    await expect(controller.getTreatmentPlan('id', { role: 'DOCTOR', userId: 'a' } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects writes when the assigned encounter is not in progress', async () => {
    const createRest = jest.fn();
    const controller = new TreatmentController({ createRest } as any, { assertEncounter: jest.fn().mockResolvedValue({ state: 'ENCOUNTER_STATE_FINALIZED' }) } as any);
    await expect(controller.createTreatmentPlan({ encounterId: 'e', patientId: 'p', title: 'Kế hoạch', items: [{ title: 'Theo dõi' }] }, { role: 'DOCTOR', userId: 'a' } as any)).rejects.toThrow('ENCOUNTER_NOT_IN_PROGRESS');
    expect(createRest).not.toHaveBeenCalled();
  });

  it('allows an assigned doctor to update an active plan after the encounter is finalized', async () => {
    const getRest = jest.fn().mockResolvedValue({ data: { sourceEncounterId: 'e', patientId: 'p', status: 'ACTIVE' } });
    const updateRest = jest.fn().mockResolvedValue({ data: {} });
    const controller = new TreatmentController({ getRest, updateRest } as any, { assertEncounter: jest.fn().mockResolvedValue({ state: 'ENCOUNTER_STATE_FINALIZED' }) } as any);
    const auth = { role: 'DOCTOR', userId: 'a' } as any;
    await controller.updateTreatmentPlan('plan', { version: 2, reason: 'Cập nhật' }, auth);
    expect(updateRest).toHaveBeenCalledWith('plan', { version: 2, reason: 'Cập nhật' }, auth);
  });
});
