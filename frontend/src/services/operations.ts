import type { Requester } from './catalog';

export interface ReceptionCase { id?: string; patientId?: string; status?: string; [key: string]: unknown; }
export interface Report { [key: string]: unknown; }
export interface Consultation {
  id?: string;
  status?: string;
  subject?: string;
  patientId?: string;
  assignedDoctorId?: string | null;
  lastMessageAt?: string | null;
  updatedAt?: string | null;
  unreadCount?: number;
  [key: string]: unknown;
}
export interface ConsultationMessage {
  id?: string;
  threadId?: string;
  sequenceNo?: number;
  senderAccountId?: string;
  senderType?: string;
  body?: string;
  sentAt?: string | null;
  [key: string]: unknown;
}
const list = <T,>(raw: unknown): T[] => Array.isArray(raw) ? raw as T[] : Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: T[] }).items : Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: T[] }).data : [];
const post = <T>(request: Requester, path: string, body?: unknown) => request<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export function getMyReceptionist(request: Requester) { return request<unknown>('/api/receptionists/me'); }
export function updateMyReceptionist(request: Requester, body: unknown) { return request<unknown>('/api/receptionists/me', { method: 'PATCH', body: JSON.stringify(body) }); }
const unwrapData = <T,>(value: T | { data: T }): T => value && typeof value === 'object' && 'data' in value ? (value as { data: T }).data : value as T;
export async function openReceptionCase(request: Requester, body: unknown) { return unwrapData(await post<ReceptionCase | { data: ReceptionCase }>(request, '/api/reception/cases', body)); }
export async function getReceptionCase(request: Requester, id: string) { return unwrapData(await request<ReceptionCase | { data: ReceptionCase }>(`/api/reception/cases/${encodeURIComponent(id)}`)); }
export async function verifyReceptionIdentity(request: Requester, id: string, body: unknown) { return unwrapData(await post<ReceptionCase | { data: ReceptionCase }>(request, `/api/reception/cases/${encodeURIComponent(id)}/identity-verifications`, body)); }
export async function admitReceptionCase(request: Requester, id: string) { return unwrapData(await post<ReceptionCase | { data: ReceptionCase }>(request, `/api/reception/cases/${encodeURIComponent(id)}/admit`)); }
export interface ReceptionPatient { id: string; fullName?: string; phoneNumber?: string; nationalIdMasked?: string | null; [key: string]: unknown; }
export async function searchReceptionPatients(request: Requester, body: { fullName?: string; phoneNumber?: string; nationalId?: string }) { const raw = await request<unknown>('/api/patients/search', { method: 'POST', body: JSON.stringify({ ...body, limit: 20, page: 1 }) }); const value = raw as { data?: { items?: ReceptionPatient[] }; items?: ReceptionPatient[] }; return value.data?.items ?? value.items ?? []; }
export interface ReceptionAppointment { id?: string; appointmentCode?: string; patientId?: string; startAt?: string; endAt?: string; status?: string; pricing?: { serviceName?: string }; [key: string]: unknown; }
export async function listReceptionAppointments(request: Requester, patientId?: string, filters: { from?: string; to?: string; status?: string } = {}): Promise<ReceptionAppointment[]> { const query = new URLSearchParams({ limit: '50' }); if (patientId) query.set('patientId', patientId); if (filters.from) query.set('from', filters.from); if (filters.to) query.set('to', filters.to); if (filters.status) query.set('status', filters.status); const raw = await request<unknown>('/api/appointment/appointments?' + query); const value = raw as { items?: ReceptionAppointment[]; data?: ReceptionAppointment[] }; return Array.isArray(value.items) ? value.items : Array.isArray(value.data) ? value.data : []; }
export async function getReceptionPatient(request: Requester, patientId: string): Promise<ReceptionPatient | null> { const raw = await request<unknown>('/api/patients/' + encodeURIComponent(patientId)); const value = raw as { data?: ReceptionPatient }; return value.data ?? raw as ReceptionPatient; }
export const receptionistSelectionKey = 'an-tam-receptionist-selection';
export function saveReceptionSelection(value: { patientId: string; appointmentId: string }) { window.sessionStorage.setItem(receptionistSelectionKey, JSON.stringify(value)); }
export function readReceptionSelection(): { patientId: string; appointmentId: string } | null { try { const raw = window.sessionStorage.getItem(receptionistSelectionKey); return raw ? JSON.parse(raw) as { patientId: string; appointmentId: string } : null; } catch { return null; } }

export function getReportOverview(request: Requester, query = '') { return request<Report>(`/api/reports/overview${query ? `?${query}` : ''}`); }
export function getAppointmentReport(request: Requester, query = '') { return request<Report>(`/api/reports/appointments${query ? `?${query}` : ''}`); }
export function getRevenueReport(request: Requester, query = '') { return request<Report>(`/api/reports/revenue${query ? `?${query}` : ''}`); }

export async function listConsultations(request: Requester, query = '') { return list<Consultation>(await request<unknown>(`/api/consultations${query ? `?${query}` : ''}`)); }
export async function listAllDoctorConsultations(request: Requester): Promise<Consultation[]> {
  const rows: Consultation[] = []; const seen = new Set<string>(); let cursor = '';
  for (;;) {
    const query = new URLSearchParams({ limit: '100' }); if (cursor) query.set('cursor', cursor);
    const page = await request<{ data: Consultation[]; meta?: { nextCursor?: string | null } }>(`/api/consultations?${query}`);
    if (!Array.isArray(page.data)) throw new Error('Không thể tải đầy đủ tư vấn.');
    rows.push(...page.data); const next = page.meta?.nextCursor;
    if (!next) return rows;
    if (seen.has(next)) throw new Error('Không thể tải đầy đủ tư vấn.');
    seen.add(next); cursor = next;
  }
}
export function getConsultation(request: Requester, id: string) { return request<Consultation>(`/api/consultations/${encodeURIComponent(id)}`); }
export async function listConsultationMessages(request: Requester, id: string): Promise<ConsultationMessage[]> {
  const messages: ConsultationMessage[] = [];
  let after = 0;
  for (;;) {
    const page = list<ConsultationMessage>(await request<unknown>(`/api/consultations/${encodeURIComponent(id)}/messages?limit=100&afterSequence=${after}`));
    messages.push(...page);
    if (page.length < 100) return messages;
    const next = page[page.length - 1]?.sequenceNo;
    if (!next || next <= after) throw new Error('Không thể tải đầy đủ tin nhắn.');
    after = next;
  }
}
export function sendConsultationMessage(request: Requester, id: string, body: unknown) { return post<Consultation>(request, `/api/consultations/${encodeURIComponent(id)}/messages`, body); }
export function markConsultationRead(request: Requester, id: string, sequenceNo: number) { return post(request, `/api/consultations/${encodeURIComponent(id)}/read`, { sequenceNo }); }

export interface ReceptionQueueStage { id?: string; code?: string; name?: string; roomCode?: string | null; [key: string]: unknown; }
export interface ReceptionQueueTicket { id?: string; ticketCode?: string; stageId?: string; stageName?: string; roomCode?: string | null; state?: string; version?: number | string; [key: string]: unknown; }
export interface ReceptionInvoice { id?: string; invoiceNumber?: string; patientId?: string; appointmentId?: string; status?: string; totalMinor?: number; balanceMinor?: number; currency?: string; version?: number | string; [key: string]: unknown; }
const key = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const withKey = <T>(request: Requester, path: string, body?: unknown) => request<T>(path, { method: 'POST', headers: { 'Idempotency-Key': key() }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export async function listReceptionQueueStages(request: Requester): Promise<ReceptionQueueStage[]> { const raw = await request<unknown>('/api/queue/stages'); const value = raw as { data?: ReceptionQueueStage[] }; return value.data ?? (Array.isArray(raw) ? raw as ReceptionQueueStage[] : []); }
export async function listReceptionStageTickets(request: Requester, stageId: string): Promise<ReceptionQueueTicket[]> { const raw = await request<unknown>(`/api/queue/stages/${encodeURIComponent(stageId)}/tickets?limit=50`); const value = raw as { data?: ReceptionQueueTicket[] }; return value.data ?? []; }
export function callReceptionNext(request: Requester, stageId: string) { return withKey<ReceptionQueueTicket | null>(request, `/api/queue/stages/${encodeURIComponent(stageId)}/call-next`); }
export function updateReceptionTicket(request: Requester, ticketId: string, action: 'start' | 'complete' | 'requeue' | 'cancel', expectedVersion: number, reason?: string) { return withKey<ReceptionQueueTicket>(request, `/api/queue/tickets/${encodeURIComponent(ticketId)}/${action}`, { expectedVersion, ...(reason ? { reason } : {}) }); }
export async function listReceptionInvoices(request: Requester, query: { patientId?: string; appointmentId?: string }): Promise<ReceptionInvoice[]> { const params = new URLSearchParams({ limit: '50' }); if (query.patientId) params.set('patientId', query.patientId); if (query.appointmentId) params.set('appointmentId', query.appointmentId); const raw = await request<unknown>(`/api/billing/invoices?${params}`); const value = raw as { items?: ReceptionInvoice[]; data?: ReceptionInvoice[] }; return value.items ?? value.data ?? []; }
export function recordReceptionCashPayment(request: Requester, invoice: ReceptionInvoice) { return withKey<unknown>(request, `/api/billing/invoices/${encodeURIComponent(invoice.id ?? '')}/payments`, { method: 'CASH', amountMinor: invoice.balanceMinor ?? invoice.totalMinor ?? 0, receivedAt: new Date().toISOString(), expectedInvoiceVersion: Number(invoice.version ?? 1) }); }
