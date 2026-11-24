import { describe, expect, it, vi } from 'vitest';
import type { Requester } from './catalog';
import {
  cancelManagedDoctorSchedule,
  createManagerAppointment,
  createManagedDoctorSchedule,
  listManagedReceptionists,
  updateManagedDoctorSchedule,
} from './clinicManager';

describe('Clinic Manager API', () => {
  it('reads receptionist items from the nested backend envelope', async () => {
    const request = vi.fn(async () => ({ data: { items: [{ id: 'r1', profile: { fullName: 'Lễ tân A' } }], nextCursor: null } })) as Requester;
    expect(await listManagedReceptionists(request)).toEqual([{ id: 'r1', profile: { fullName: 'Lễ tân A' } }]);
  });

  it('uses idempotency and version headers for schedule changes', async () => {
    const request = vi.fn(async () => ({ data: { id: 's1', version: 2 } })) as Requester;
    const input = { dayOfWeek: 1, startTime: '18:00', endTime: '20:00', slotDurationMinutes: 30, effectiveFrom: '2026-11-30' };
    await createManagedDoctorSchedule(request, 'doctor-1', input);
    expect(request).toHaveBeenCalledWith('/api/doctors/doctor-1/schedules', expect.objectContaining({ method: 'POST', headers: { 'idempotency-key': expect.any(String) } }));
    const schedule = { id: 's1', dayOfWeek: 1, startTime: '18:00', endTime: '20:00', version: 2 };
    await updateManagedDoctorSchedule(request, 'doctor-1', schedule, { startTime: '19:00' });
    expect(request).toHaveBeenCalledWith('/api/doctors/doctor-1/schedules/s1', expect.objectContaining({ method: 'PATCH', headers: { 'if-match': '2' } }));
    await cancelManagedDoctorSchedule(request, 'doctor-1', schedule, 'Đổi ca');
    expect(request).toHaveBeenCalledWith('/api/doctors/doctor-1/schedules/s1/cancel', expect.objectContaining({ method: 'POST', headers: { 'if-match': '2' } }));
  });

  it('releases a held slot when appointment creation fails', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/api/appointment/slot-holds') return { id: 'hold-1' };
      if (path === '/api/appointment/appointments') throw new Error('Booking failed');
      return undefined;
    }) as Requester;
    await expect(createManagerAppointment(request, 'patient-1', {
      serviceId: 'service-1', doctorId: 'doctor-1', startAt: '2026-11-30T08:00:00.000Z', endAt: '2026-11-30T08:30:00.000Z',
    })).rejects.toThrow('Booking failed');
    expect(request).toHaveBeenCalledWith('/api/appointment/slot-holds/hold-1', { method: 'DELETE' });
  });
});
