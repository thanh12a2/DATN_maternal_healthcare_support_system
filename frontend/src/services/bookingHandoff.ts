import type { CatalogService } from './catalog';
import type { Doctor, Specialty } from './doctor';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validBookingId = (value: string | null | undefined): value is string => !!value && UUID.test(value);

export function isBookingHandoffUrl(value: string): boolean {
  if (!value.startsWith('/dat-lich?')) return false;
  const url = new URL(value, 'http://local.test');
  const keys = [...url.searchParams.keys()];
  return url.pathname === '/dat-lich' && !url.hash && keys.length >= 2 && keys.length <= 3
    && new Set(keys).size === keys.length && keys.every(k => ['specialtyId', 'serviceId', 'doctorId'].includes(k))
    && validBookingId(url.searchParams.get('serviceId')) && validBookingId(url.searchParams.get('specialtyId'))
    && (!url.searchParams.has('doctorId') || validBookingId(url.searchParams.get('doctorId')));
}

export function resolveBookingPrefill(params: URLSearchParams, services: CatalogService[], specialties: Specialty[], doctors: Doctor[]) {
  const serviceId = params.get('serviceId') || '';
  const specialtyId = params.get('specialtyId') || '';
  const doctorId = params.get('doctorId') || '';
  const specialty = specialties.find(s => s.id === specialtyId && s.status === 'ACTIVE');
  const result = { serviceId: '', specialtyId: specialty?.id || 'all', doctorId: '', selectionMode: 'RANK' as 'DOCTOR' | 'RANK', notice: '' };
  const doctor = doctors.find(d => d.id === doctorId && d.status === 'ACTIVE');
  if (serviceId) {
    const service = services.find(s => s.id === serviceId && s.status === 'ACTIVE' && s.bookingEnabled === true);
    const actualSpecialty = service && specialties.find(s => s.id === service.specialtyId && s.status === 'ACTIVE');
    const notice = (service?.content as { notice?: { type?: string } } | undefined)?.notice?.type;
    if (!validBookingId(serviceId) || !service || !actualSpecialty?.id
        || (notice && ['COMING_SOON', 'TEMP_SUSPENDED', 'DISCONTINUED'].includes(notice))) {
      result.notice = 'Dịch vụ từ liên kết chưa được xác minh hoặc không còn nhận đặt khám. Vui lòng chọn lại dịch vụ hiện hành.';
      return result;
    }
    result.serviceId = serviceId; result.specialtyId = actualSpecialty.id;
    if (specialtyId && specialtyId !== actualSpecialty.id) {
      result.notice = 'Chuyên khoa đã được cập nhật theo dịch vụ hiện hành. Vui lòng kiểm tra lại lựa chọn.';
    }
    if (doctorId) {
      result.selectionMode = 'DOCTOR';
      const belongs = (doctor?.specialties as { id: string }[] | undefined)?.some(s => s.id === actualSpecialty.id);
      if (validBookingId(doctorId) && belongs && (!specialtyId || specialtyId === actualSpecialty.id)) result.doctorId = doctorId;
      else result.notice = 'Bác sĩ từ liên kết không còn phù hợp. Vui lòng chọn lại bác sĩ hoặc tự chọn chế độ bệnh viện sắp xếp.';
    }
  } else if (doctorId) {
    // Keep existing doctor-only links from public doctor/specialty pages working.
    result.selectionMode = 'DOCTOR';
    if (validBookingId(doctorId) && doctor && (!specialtyId || (specialty && (doctor.specialties as { id: string }[])?.some(s => s.id === specialtyId)))) result.doctorId = doctorId;
    else result.notice = 'Chưa xác minh được bác sĩ từ liên kết. Vui lòng chọn lại bác sĩ.';
  } else if (specialtyId && !specialty) result.notice = 'Chuyên khoa từ liên kết không còn hoạt động. Vui lòng chọn lại.';
  return result;
}
