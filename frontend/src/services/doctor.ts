import type { Requester } from './catalog';
export interface Doctor {
  id?: string;
  doctorId?: string;
  fullName?: string;
  name?: string;
  displayName?: string;
  professionalTitle?: string;
  consultationRank?: string;
  profile?: { fullName?: string; professionalTitle?: string };
  [key: string]: unknown;
}
export interface Specialty {
  id?: string;
  code?: string;
  name?: string;
  [key: string]: unknown;
}
function items<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const value = raw as { data?: unknown; items?: unknown };
  if (Array.isArray(value?.data)) return value.data as T[];
  if (Array.isArray(value?.items)) return value.items as T[];
  return [];
}
export interface ClinicRoom {
  id: string;
  code: string;
  name: string;
  status: string;
}
export async function listDoctors(request: Requester): Promise<Doctor[]> {
  return items<Doctor>(await request('/api/doctors?limit=100'));
}
export async function listClinicRooms(
  request: Requester,
): Promise<ClinicRoom[]> {
  return items<ClinicRoom>(await request('/api/doctors/rooms?limit=100'));
}
export async function listSpecialties(
  request: Requester,
): Promise<Specialty[]> {
  return items<Specialty>(await request('/api/doctors/specialties'));
}
export function getDoctor(request: Requester, id: string) {
  return request<Doctor>('/api/doctors/' + encodeURIComponent(id));
}
export function getDoctorAvailability(
  request: Requester,
  id: string,
  from: string,
  to: string,
) {
  const q = new URLSearchParams({ from, to });
  return request<unknown>(
    '/api/doctors/' + encodeURIComponent(id) + '/availability?' + q,
  );
}
export interface MyDoctor {
  id: string;
  status: string;
  consultationRank?: string;
  licenseNumber?: string;
  roomName?: string | null;
  roomCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  version: number;
  profile: {
    fullName?: string;
    professionalTitle?: string | null;
    biography?: string | null;
    practiceStartYear?: number | null;
    languages?: string[];
    photoUrl?: string | null;
  };
  specialties?: { name: string; isPrimary?: boolean }[];
}
export async function getMyDoctor(request: Requester) {
  return (await request<{ data: MyDoctor }>('/api/doctors/me')).data;
}
export async function updateMyDoctor(
  request: Requester,
  doctor: MyDoctor,
  body: { biography?: string; languages?: string[]; photoUrl?: string },
) {
  return (
    await request<{ data: MyDoctor }>(
      '/api/doctors/' + encodeURIComponent(doctor.id),
      {
        method: 'PATCH',
        headers: { 'If-Match': String(doctor.version) },
        body: JSON.stringify(body),
      },
    )
  ).data;
}
export interface DoctorInterval {
  startAt: string;
  endAt: string;
  roomName?: string | null;
  roomCode?: string | null;
}
export async function listMyAvailability(
  request: Requester,
  id: string,
  from: string,
  to: string,
) {
  return (
    await request<{
      data: { intervals: DoctorInterval[]; bookingOccupancyApplied: boolean };
    }>(
      '/api/doctors/' +
        encodeURIComponent(id) +
        '/availability?' +
        new URLSearchParams({ from, to }),
    )
  ).data;
}

export interface DoctorShift {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  roomCode?: string | null;
  status: string;
}

export interface DoctorLeaveRequest {
  id: string;
  doctorId: string;
  scheduleId: string;
  workDate: string;
  startAt: string;
  endAt: string;
  reasonCode: string;
  note?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  version: number;
  reviewReason?: string | null;
  doctor?: { profile?: { fullName?: string } };
  schedule?: DoctorShift;
}

export async function listMyDoctorShifts(request: Requester, doctorId: string) {
  const raw = await request<{ data: DoctorShift[] }>(`/api/doctors/${doctorId}/schedules?limit=100`);
  return raw.data ?? [];
}

export async function listDoctorLeaveRequests(request: Requester, own = false) {
  const raw = await request<{ data: DoctorLeaveRequest[] }>(own ? '/api/doctors/me/leave-requests' : '/api/doctors/leave-requests?limit=100');
  return raw.data ?? [];
}

export async function requestDoctorLeave(request: Requester, body: { scheduleId: string; workDate: string; reasonCode: string; note?: string }) {
  return request('/api/doctors/me/leave-requests', {
    method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(body),
  });
}

export async function reviewDoctorLeave(request: Requester, item: DoctorLeaveRequest, approve: boolean, reason?: string) {
  return request(`/api/doctors/leave-requests/${item.id}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST', body: JSON.stringify({ expectedVersion: item.version, ...(reason ? { reason } : {}) }),
  });
}

export async function cancelDoctorLeave(request: Requester, item: DoctorLeaveRequest, reason?: string) {
  return request(`/api/doctors/leave-requests/${item.id}/cancel`, {
    method: 'POST', body: JSON.stringify({ expectedVersion: item.version, ...(reason ? { reason } : {}) }),
  });
}
