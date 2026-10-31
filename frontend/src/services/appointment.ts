import type { Requester } from './catalog';
export type SelectionMode = 'DOCTOR' | 'RANK';
export type AppointmentStatus = 'BOOKED' | 'REASSIGNMENT_REQUIRED' | 'CHECKED_IN' | 'IN_CLINICAL_CARE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export interface BookableSlot { serviceId?: string; selectionMode?: SelectionMode; doctorId?: string | null; rankCode?: string; startAt: string; endAt: string; availableCapacity?: number; [key: string]: unknown; }
export interface SlotHold { id: string; expiresAt: string; status?: string; [key: string]: unknown; }
export interface Appointment { id?: string; appointmentCode?: string; patientId?: string; patientName?: string; serviceId?: string; assignedDoctorId?: string; assignedRankCode?: string; startAt?: string; endAt?: string; status?: AppointmentStatus; pricing?: {serviceName?: string; estimatedTotalMinor?: number; currency?: string}; [key: string]: unknown; }
export interface AppointmentPage { items?: Appointment[]; nextPageToken?: string | null; }
const list = <T,>(raw: unknown): T[] => Array.isArray(raw) ? raw as T[] : Array.isArray((raw as {items?: unknown})?.items) ? (raw as {items: T[]}).items : Array.isArray((raw as {data?: unknown})?.data) ? (raw as {data: T[]}).data : [];
export function idempotencyKey(): string { try { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch { /* fallback */ } return 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2); }
export async function listBookableSlots(request: Requester, params: {serviceId: string; selectionMode: SelectionMode; from: string; to: string; requestedDoctorId?: string; requestedRankCode?: string}): Promise<BookableSlot[]> { const query = new URLSearchParams({serviceId: params.serviceId, selectionMode: params.selectionMode, from: params.from, to: params.to, limit: '50'}); if (params.requestedDoctorId) query.set('requestedDoctorId', params.requestedDoctorId); if (params.requestedRankCode) query.set('requestedRankCode', params.requestedRankCode); return list<BookableSlot>(await request('/api/appointment/bookable-slots?' + query)); }
export function createSlotHold(request: Requester, body: {serviceId: string; selectionMode: SelectionMode; requestedDoctorId?: string; requestedRankCode?: string; startAt: string; endAt: string}) { return request<SlotHold>('/api/appointment/slot-holds', {method:'POST', headers:{'Idempotency-Key': idempotencyKey()}, body:JSON.stringify(body)}); }
export function releaseSlotHold(request: Requester, id: string) { return request<void>('/api/appointment/slot-holds/' + encodeURIComponent(id), {method:'DELETE'}); }
export function createAppointment(request: Requester, holdId: string) { return request<Appointment>('/api/appointment/appointments', {method:'POST', headers:{'Idempotency-Key': idempotencyKey()}, body:JSON.stringify({holdId, channel:'ONLINE'})}); }
export interface AppointmentListFilters {
  status?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

export async function listAppointments(request: Requester, filters: AppointmentListFilters = {}): Promise<AppointmentPage> {
  const query = new URLSearchParams({ limit: '100' });
  if (filters.status) query.set('status', filters.status);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.cursor) query.set('cursor', filters.cursor);
  const raw = await request<unknown>('/api/appointment/appointments?' + query.toString());
  return {items:list<Appointment>(raw), nextPageToken:(raw as AppointmentPage)?.nextPageToken};
}
export async function listAllDoctorAppointments(request: Requester, filters: AppointmentListFilters = {}): Promise<Appointment[]> {
  const rows: Appointment[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await listAppointments(request, { ...filters, cursor });
    rows.push(...(page.items ?? []));
    cursor = page.nextPageToken || undefined;
    if (cursor && seen.has(cursor)) throw new Error('Không thể tải đầy đủ danh sách lịch khám.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return rows;
}
export async function getDoctorOccupancy(request: Requester, from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return (await request<{ data: { startAt: string; endAt: string }[] }>('/api/appointment/doctor-occupancy?' + query)).data;
}
export function getAppointment(request: Requester, id: string) { return request<Appointment>('/api/appointment/appointments/' + encodeURIComponent(id)); }
export function cancelAppointment(request: Requester, id: string, reason: string, version?: number) { return request<void>('/api/appointment/appointments/' + encodeURIComponent(id) + '/cancel', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify({ reason, ...(version === undefined ? {} : { version }) }) }); }
export function rescheduleAppointment(request: Requester, id: string, body: { holdId: string; reason?: string; version?: number }) { return request<Appointment>('/api/appointment/appointments/' + encodeURIComponent(id) + '/reschedule', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify(body) }); }
