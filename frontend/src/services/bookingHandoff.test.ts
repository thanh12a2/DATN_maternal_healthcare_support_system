import { describe, expect, it } from 'vitest';
import { resolveBookingPrefill, isBookingHandoffUrl } from './bookingHandoff';
const serviceId = '421179bf-19d1-436d-948f-65a61f7c35d7';
const specialtyId = 'cb62b6a3-f1eb-407b-95f1-29f3f0b14de8';
const doctorId = '11111111-1111-4111-8111-111111111111';
const services = [{ id: serviceId, status: 'ACTIVE', bookingEnabled: true, specialtyId }];
const specialties = [{ id: specialtyId, status: 'ACTIVE' }];
const doctors = [{ id: doctorId, status: 'ACTIVE', specialties: [{ id: specialtyId }] }];
const params = (extra: Record<string,string> = {}) => new URLSearchParams({ serviceId, specialtyId, ...extra });
describe('Booking handoff boundaries', () => {
  it('uses RANK without doctor and preserves explicit DOCTOR only when eligible', () => {
    expect(resolveBookingPrefill(params(), services, specialties, doctors)).toMatchObject({ serviceId, specialtyId, doctorId: '', selectionMode: 'RANK', notice: '' });
    expect(resolveBookingPrefill(params({ doctorId }), services, specialties, doctors)).toMatchObject({ serviceId, specialtyId, doctorId, selectionMode: 'DOCTOR', notice: '' });
  });
  it('rejects inactive/disabled/missing service instead of keeping a phantom ID', () => {
    for (const rows of [[], [{ ...services[0], status: 'INACTIVE' }], [{ ...services[0], bookingEnabled: false }]]) {
      const result = resolveBookingPrefill(params({ doctorId }), rows, specialties, doctors);
      expect(result.serviceId).toBe(''); expect(result.doctorId).toBe(''); expect(result.notice).not.toBe('');
    }
  });
  it('clears invalid doctor and keeps DOCTOR intent for explicit reselection', () => {
    const result = resolveBookingPrefill(params({ doctorId }), services, specialties, [{ ...doctors[0], specialties: [] }]);
    expect(result).toMatchObject({ serviceId, doctorId: '', selectionMode: 'DOCTOR' });
    expect(result.notice).not.toBe('');
  });
  it('resolves specialty from the service and invalidates stale linked doctor', () => {
    const result = resolveBookingPrefill(params({ specialtyId: doctorId, doctorId }), services, specialties, doctors);
    expect(result).toMatchObject({ serviceId, specialtyId, doctorId: '', selectionMode: 'DOCTOR' });
  });
  it('preserves existing doctor-only and specialty-only entry points', () => {
    expect(resolveBookingPrefill(new URLSearchParams({ doctorId, specialtyId }), services, specialties, doctors)).toMatchObject({ serviceId: '', doctorId, specialtyId, selectionMode: 'DOCTOR' });
    expect(resolveBookingPrefill(new URLSearchParams({ specialtyId }), services, specialties, doctors)).toMatchObject({ serviceId: '', specialtyId, selectionMode: 'RANK' });
  });
  it('accepts only the three supported UUID parameters on a local booking URL', () => {
    expect(isBookingHandoffUrl('/dat-lich?' + params())).toBe(true);
    expect(isBookingHandoffUrl('/dat-lich?' + params({ doctorId }))).toBe(true);
    for (const url of ['https://evil.test/dat-lich?' + params(), '/dat-lich?' + params({ date: '2026-11-17' }),
      '/dat-lich?' + params({ doctorId: 'bad' }), '/dat-lich?' + params() + '&serviceId=' + serviceId]) expect(isBookingHandoffUrl(url)).toBe(false);
  });
});
