import { afterEach, describe, expect, it, vi } from 'vitest';
import { appointmentAdmissionWarning, checkInAppointment, payAndCheckInAppointment, type DeskAppointment } from './receptionDesk';

const visit = { id: 'visit', patientId: 'patient', date: '2026-11-17', startAt: '2026-11-17T13:00:00+07:00' } as DeskAppointment;
afterEach(() => vi.useRealTimers());

describe('reception admission hospital date', () => {
  it('blocks tomorrow with a readable date and keeps the existing reschedule route', () => {
    expect(appointmentAdmissionWarning(visit, new Date('2026-11-16T16:59:00Z'))).toContain('17/11/2026');
    expect(appointmentAdmissionWarning(visit, new Date('2026-11-16T16:59:00Z'))).toContain('đổi lịch');
  });
  it('allows the visit from midnight Vietnam time even before its appointment hour', () => {
    expect(appointmentAdmissionWarning(visit, new Date('2026-11-16T17:00:00Z'))).toBeNull();
    expect(appointmentAdmissionWarning(visit, new Date('2026-11-17T17:00:00Z'))).toBeNull();
  });
  it('uses the actual start instant rather than a stale display date', () => {
    expect(appointmentAdmissionWarning({ ...visit, date: '2026-11-16' }, new Date('2026-11-16T16:59:00Z'))).not.toBeNull();
  });
  it('does not open a case, invoice or take cash for a future visit', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-16T15:00:00Z'));
    const request = vi.fn();
    await expect(checkInAppointment(request, visit)).rejects.toThrow('Chưa đến ngày hẹn');
    await expect(payAndCheckInAppointment(request, visit)).rejects.toThrow('Chưa đến ngày hẹn');
    expect(request).not.toHaveBeenCalled();
  });
});
