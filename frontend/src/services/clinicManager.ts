import type { Requester } from './catalog';

export type ManagedStaffRole = 'DOCTOR' | 'NURSE' | 'RECEPTIONIST';
export type ManagedStaffStatus = 'ACTIVE' | 'DISABLED';

export interface ManagedStaff {
  userId: string;
  email: string;
  role: ManagedStaffRole | 'CLINIC_MANAGER';
  status: ManagedStaffStatus;
  createdAt?: string;
}

export interface ReceptionistSummary {
  id: string;
  status?: string;
  version?: number;
  profile?: { fullName?: string; loginEmail?: string; department?: string; avatarUrl?: string | null };
}

export interface ManagerAppointment {
  id: string;
  appointmentCode?: string;
  startAt?: string;
  endAt?: string;
  status?: string;
  serviceName?: string;
  assignedDoctorId?: string | null;
  version?: number;
}

export interface ManagedDoctorSchedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  status?: string;
}

function items<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const value = raw as { items?: unknown; data?: unknown };
  if (Array.isArray(value?.items)) return value.items as T[];
  if (Array.isArray(value?.data)) return value.data as T[];
  return [];
}

export async function listManagedStaff(request: Requester): Promise<ManagedStaff[]> {
  return items<ManagedStaff>(await request<unknown>('/auth/staff'));
}

export function createManagedStaff(request: Requester, body: { email: string; password: string; role: ManagedStaffRole }) {
  return request<unknown>('/auth/staff', { method: 'POST', body: JSON.stringify(body) });
}

export function setManagedStaffStatus(request: Requester, accountId: string, status: ManagedStaffStatus) {
  return request<unknown>(`/auth/staff/${encodeURIComponent(accountId)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function listManagedReceptionists(request: Requester): Promise<ReceptionistSummary[]> {
  return items<ReceptionistSummary>(await request<unknown>('/api/receptionists?limit=50'));
}

export async function listManagerAppointments(request: Requester): Promise<ManagerAppointment[]> {
  return items<ManagerAppointment>(await request<unknown>('/api/appointment/appointments?limit=50'));
}

export async function listManagedDoctorSchedules(request: Requester, doctorId: string): Promise<ManagedDoctorSchedule[]> {
  return items<ManagedDoctorSchedule>(await request<unknown>(`/api/doctors/${encodeURIComponent(doctorId)}/schedules?limit=50`));
}
