import { ReceptionWorkService } from './reception-work.service';

describe('appointment reception ownership', () => {
  const findFirst = jest.fn();
  const service = new ReceptionWorkService({ receptionCase: { findFirst } } as any);

  beforeEach(() => findFirst.mockReset());

  it('distinguishes a missing case from an unassigned case', async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ workClaimedBy: null });
    await expect(service.getAppointmentOwner('appointment')).resolves.toEqual({ hasActiveCase: false, ownerAccountId: '' });
    await expect(service.getAppointmentOwner('appointment')).resolves.toEqual({ hasActiveCase: true, ownerAccountId: '' });
  });

  it('returns the owner of an active case', async () => {
    findFirst.mockResolvedValue({ workClaimedBy: 'account' });
    await expect(service.getAppointmentOwner('appointment')).resolves.toEqual({ hasActiveCase: true, ownerAccountId: 'account' });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ appointmentId: 'appointment', status: expect.any(Object) }) }));
  });
});
