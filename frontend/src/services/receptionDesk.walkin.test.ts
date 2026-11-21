import { describe, expect, it, vi } from 'vitest';
import { createWalkInAppointment } from './receptionDesk';

describe('walk-in reception', () => {
  it('creates a walk-in appointment and queues its case without verifying or admitting', async () => {
    const request = vi.fn(async (path: string, _init?: RequestInit) => {
      if (path.endsWith('/slot-holds')) return { id: 'hold' };
      if (path.endsWith('/appointments')) return { id: 'appointment', appointmentCode: 'AP123' };
      if (path.endsWith('/cases')) return { data: { id: 'case' } };
      throw new Error(`unexpected ${path}`);
    });
    await createWalkInAppointment(request as never, { patientId: 'patient', serviceId: 'service', doctorId: 'doctor' });
    expect(request).toHaveBeenCalledTimes(3);
    expect(JSON.parse((request.mock.calls[1][1] as RequestInit).body as string)).toMatchObject({ channel: 'WALK_IN' });
    expect(JSON.parse((request.mock.calls[2][1] as RequestInit).body as string)).toMatchObject({ patientId: 'patient', appointmentId: 'appointment' });
  });
});
