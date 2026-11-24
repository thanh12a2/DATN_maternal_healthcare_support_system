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
  employeeCode?: string;
  profile?: {
    fullName?: string;
    loginEmail?: string;
    department?: string;
    workPhone?: string;
    avatarUrl?: string | null;
  };
}

export interface ManagerAppointment {
  id: string;
  appointmentCode?: string;
  startAt?: string;
  endAt?: string;
  status?: string;
  serviceName?: string;
  assignedDoctorId?: string | null;
  serviceId?: string;
  patientId?: string;
  selectionMode?: 'DOCTOR' | 'RANK';
  version?: number;
}

export interface ManagedDoctorSchedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  status?: string;
  version: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  roomId?: string | null;
  roomCode?: string | null;
}

export interface ClinicRoom {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

function items<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const value = raw as { items?: unknown; data?: unknown };
  if (Array.isArray(value?.items)) return value.items as T[];
  if (Array.isArray(value?.data)) return value.data as T[];
  if (value?.data && typeof value.data === 'object' && Array.isArray((value.data as { items?: unknown }).items))
    return (value.data as { items: T[] }).items;
  return [];
}

function data<T>(raw: unknown): T {
  return raw && typeof raw === 'object' && 'data' in raw ? (raw as { data: T }).data : raw as T;
}

function key() {
  return `clinic-manager-${Date.now()}-${crypto.randomUUID()}`;
}

export async function listManagedStaff(
  request: Requester,
): Promise<ManagedStaff[]> {
  return items<ManagedStaff>(await request<unknown>('/auth/staff'));
}

export function createManagedStaff(
  request: Requester,
  body: { email: string; password: string; role: ManagedStaffRole },
) {
  return request<unknown>('/auth/staff', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function setManagedStaffStatus(
  request: Requester,
  accountId: string,
  status: ManagedStaffStatus,
) {
  return request<unknown>(
    `/auth/staff/${encodeURIComponent(accountId)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
}

export async function listManagedReceptionists(
  request: Requester,
): Promise<ReceptionistSummary[]> {
  return items<ReceptionistSummary>(
    await request<unknown>('/api/receptionists?limit=50'),
  );
}

export async function listManagerAppointments(
  request: Requester,
): Promise<ManagerAppointment[]> {
  return items<ManagerAppointment>(
    await request<unknown>('/api/appointment/appointments?limit=50'),
  );
}

export async function listManagedDoctorSchedules(
  request: Requester,
  doctorId: string,
): Promise<ManagedDoctorSchedule[]> {
  return items<ManagedDoctorSchedule>(
    await request<unknown>(
      `/api/doctors/${encodeURIComponent(doctorId)}/schedules?limit=50`,
    ),
  );
}

export async function listClinicRooms(request: Requester) {
  return items<ClinicRoom>(await request<unknown>('/api/doctors/rooms?limit=100'));
}

export async function createClinicRoom(request: Requester, body: { code: string; name: string }) {
  return data<ClinicRoom>(await request('/api/doctors/rooms', {
    method: 'POST', headers: { 'idempotency-key': key() }, body: JSON.stringify(body),
  }));
}

export async function updateClinicRoom(request: Requester, roomId: string, body: { name?: string; status?: 'ACTIVE' | 'INACTIVE' }) {
  return data<ClinicRoom>(await request(`/api/doctors/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }));
}

export interface ScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string;
  roomId?: string;
}

export async function createManagedDoctorSchedule(request: Requester, doctorId: string, body: ScheduleInput) {
  return data<ManagedDoctorSchedule>(await request(`/api/doctors/${encodeURIComponent(doctorId)}/schedules`, {
    method: 'POST', headers: { 'idempotency-key': key() }, body: JSON.stringify(body),
  }));
}

export async function updateManagedDoctorSchedule(request: Requester, doctorId: string, schedule: ManagedDoctorSchedule, body: Partial<Omit<ScheduleInput, 'dayOfWeek'>>) {
  return data<ManagedDoctorSchedule>(await request(`/api/doctors/${encodeURIComponent(doctorId)}/schedules/${schedule.id}`, {
    method: 'PATCH', headers: { 'if-match': String(schedule.version) }, body: JSON.stringify(body),
  }));
}

export async function cancelManagedDoctorSchedule(request: Requester, doctorId: string, schedule: ManagedDoctorSchedule, reason: string) {
  return request(`/api/doctors/${encodeURIComponent(doctorId)}/schedules/${schedule.id}/cancel`, {
    method: 'POST', headers: { 'if-match': String(schedule.version) }, body: JSON.stringify({ reason }),
  });
}

export async function createDoctorAvailabilityOverride(request: Requester, doctorId: string, body: {
  type: 'UNAVAILABLE' | 'EXTRA_AVAILABLE'; startAt: string; endAt: string;
  reasonCode: 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'TRAINING' | 'EMERGENCY' | 'EXTRA_SHIFT' | 'OTHER';
  note?: string; roomId?: string;
}) {
  return request(`/api/doctors/${encodeURIComponent(doctorId)}/availability-overrides`, {
    method: 'POST', headers: { 'idempotency-key': key() }, body: JSON.stringify(body),
  });
}

export async function cancelDoctorAvailabilityOverride(request: Requester, doctorId: string, item: { id: string; version: number }, reason: string) {
  return request(`/api/doctors/${encodeURIComponent(doctorId)}/availability-overrides/${item.id}/cancel`, {
    method: 'POST', headers: { 'if-match': String(item.version) }, body: JSON.stringify({ reason }),
  });
}

export async function updateManagedReceptionist(request: Requester, item: ReceptionistSummary, body: { fullName: string; department?: string; workPhone?: string; reason: string }) {
  return request(`/api/receptionists/${item.id}`, {
    method: 'PATCH', body: JSON.stringify({ version: item.version, reason: body.reason,
      profile: { fullName: body.fullName, ...(body.department ? { department: body.department } : {}),
        ...(body.workPhone ? { workPhone: body.workPhone } : {}) } }),
  });
}

export async function deactivateManagedReceptionist(request: Requester, item: ReceptionistSummary, reason: string) {
  return request(`/api/receptionists/${item.id}/deactivate`, {
    method: 'POST', headers: { 'idempotency-key': key() }, body: JSON.stringify({ version: item.version, reason }),
  });
}

export async function managerAppointmentAction(request: Requester, item: ManagerAppointment,
  action: 'cancel' | 'reassignment-required' | 'reassign', reason: string,
  extra?: { doctorId: string; confirmationEvidence: string }) {
  return request(`/api/appointment/appointments/${item.id}/${action}`, {
    method: 'POST', headers: { 'idempotency-key': key() },
    body: JSON.stringify({ reason, expectedVersion: item.version, ...extra }),
  });
}

export interface ManagerBookableSlot {
  serviceId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  isAvailable?: boolean;
  roomCode?: string | null;
}

export async function listManagerBookableSlots(request: Requester, serviceId: string, doctorId: string, date: string) {
  const from = new Date(`${date}T00:00:00+07:00`).toISOString();
  const to = new Date(`${date}T23:59:59+07:00`).toISOString();
  const query = new URLSearchParams({ serviceId, selectionMode: 'DOCTOR', doctorId, from, to, limit: '100' });
  return items<ManagerBookableSlot>(await request(`/api/appointment/bookable-slots?${query}`)).filter(s => s.isAvailable !== false);
}

export async function rescheduleManagerAppointment(request: Requester, item: ManagerAppointment, slot: ManagerBookableSlot, reason: string) {
  const hold = data<{ id: string }>(await request('/api/appointment/slot-holds', {
    method: 'POST', headers: { 'idempotency-key': key() },
    body: JSON.stringify({ patientId: item.patientId, serviceId: item.serviceId, selectionMode: 'DOCTOR',
      requestedDoctorId: slot.doctorId, startAt: slot.startAt, endAt: slot.endAt }),
  }));
  try {
    return await request(`/api/appointment/appointments/${item.id}/reschedule`, {
      method: 'POST', headers: { 'idempotency-key': key() },
      body: JSON.stringify({ newHoldId: hold.id, reason, expectedVersion: item.version }),
    });
  } catch (error) {
    await request(`/api/appointment/slot-holds/${hold.id}`, { method: 'DELETE' }).catch(() => undefined);
    throw error;
  }
}

export async function createManagerAppointment(request: Requester, patientId: string, slot: ManagerBookableSlot, reasonForVisit?: string) {
  const hold = data<{ id: string }>(await request('/api/appointment/slot-holds', {
    method: 'POST', headers: { 'idempotency-key': key() },
    body: JSON.stringify({ patientId, serviceId: slot.serviceId, selectionMode: 'DOCTOR', requestedDoctorId: slot.doctorId,
      startAt: slot.startAt, endAt: slot.endAt }),
  }));
  try {
    return await request('/api/appointment/appointments', {
      method: 'POST', headers: { 'idempotency-key': key() },
      body: JSON.stringify({ holdId: hold.id, channel: 'RECEPTION', reasonForVisit }),
    });
  } catch (error) {
    await request(`/api/appointment/slot-holds/${hold.id}`, { method: 'DELETE' }).catch(() => undefined);
    throw error;
  }
}

export interface ManagerInvoice {
  id: string;
  invoiceNumber?: string;
  patientId?: string;
  status?: string;
  totalMinor?: number;
  balanceMinor?: number;
  currency?: string;
  version?: number;
  payment?: { id: string; status?: string; method?: string } | null;
}

export async function listManagerInvoices(request: Requester) {
  return items<ManagerInvoice>(await request('/api/billing/invoices?limit=50'));
}

export async function getManagerInvoice(request: Requester, invoiceId: string) {
  return data<ManagerInvoice>(await request(`/api/billing/invoices/${encodeURIComponent(invoiceId)}`));
}

export async function recordManagerPayment(request: Requester, invoice: ManagerInvoice, method: 'CASH' | 'MANUAL_BANK_TRANSFER', reference?: string) {
  return request(`/api/billing/invoices/${invoice.id}/payments`, {
    method: 'POST', headers: { 'idempotency-key': key() },
    body: JSON.stringify({ method, amountMinor: invoice.balanceMinor, receivedAt: new Date().toISOString(),
      expectedInvoiceVersion: invoice.version, ...(reference ? { manualTransferReference: reference } : {}) }),
  });
}

export async function decideManagerTransfer(request: Requester, invoice: ManagerInvoice, approve: boolean, reason?: string) {
  if (!invoice.payment?.id) throw new Error('Hóa đơn không có giao dịch chờ xác minh.');
  return request(`/api/billing/payments/${invoice.payment.id}/${approve ? 'verify' : 'reject'}`, {
    method: 'POST', headers: { 'idempotency-key': key() }, body: JSON.stringify({ expectedInvoiceVersion: invoice.version, ...(approve ? {} : { reason }) }),
  });
}

export async function listManagerEncounters(request: Requester) {
  return items<Record<string, unknown>>(await request('/api/medical-records/encounters?limit=50'));
}

export async function getManagerEncounter(request: Requester, encounterId: string) {
  return data<Record<string, unknown>>(await request(`/api/medical-records/encounters/${encodeURIComponent(encounterId)}`));
}

export interface ManagerPatient {
  id: string;
  fullName: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string | null;
  version?: number;
}

export async function searchManagerPatients(request: Requester, fullName: string) {
  const raw = await request<unknown>('/api/patients/search', {
    method: 'POST', body: JSON.stringify({ fullName, limit: 20 }),
  });
  return items<ManagerPatient>(raw);
}

export async function getManagerPatient(request: Requester, patientId: string) {
  return data<ManagerPatient>(await request(`/api/patients/${encodeURIComponent(patientId)}`));
}

export async function updateManagerPatient(request: Requester, item: ManagerPatient, body: {
  fullName: string; phoneNumber: string; address: string; reason: string;
}) {
  return data<ManagerPatient>(await request(`/api/patients/${encodeURIComponent(item.id)}`, {
    method: 'PATCH', body: JSON.stringify({ ...body, version: item.version }),
  }));
}

export async function createManagerPatient(request: Requester, body: {
  fullName: string; dateOfBirth: string; phoneNumber: string; address?: string; reason: string;
}) {
  return data<ManagerPatient>(await request('/api/patients', {
    method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(body),
  }));
}
