import type { Requester } from './catalog';

export interface ReceptionCase { id?: string; patientId?: string; status?: string; [key: string]: unknown; }
export interface Report { [key: string]: unknown; }
export interface Consultation { id?: string; status?: string; subject?: string; [key: string]: unknown; }
const list = <T,>(raw: unknown): T[] => Array.isArray(raw) ? raw as T[] : Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: T[] }).items : Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: T[] }).data : [];
const post = <T>(request: Requester, path: string, body?: unknown) => request<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export function getMyReceptionist(request: Requester) { return request<unknown>('/api/receptionists/me'); }
export function updateMyReceptionist(request: Requester, body: unknown) { return request<unknown>('/api/receptionists/me', { method: 'PATCH', body: JSON.stringify(body) }); }
export function openReceptionCase(request: Requester, body: unknown) { return post<ReceptionCase>(request, '/api/reception/cases', body); }
export function getReceptionCase(request: Requester, id: string) { return request<ReceptionCase>(`/api/reception/cases/${encodeURIComponent(id)}`); }
export function verifyReceptionIdentity(request: Requester, id: string, body: unknown) { return post<ReceptionCase>(request, `/api/reception/cases/${encodeURIComponent(id)}/identity-verifications`, body); }
export function admitReceptionCase(request: Requester, id: string) { return post<ReceptionCase>(request, `/api/reception/cases/${encodeURIComponent(id)}/admit`); }

export function getReportOverview(request: Requester, query = '') { return request<Report>(`/api/reports/overview${query ? `?${query}` : ''}`); }
export function getAppointmentReport(request: Requester, query = '') { return request<Report>(`/api/reports/appointments${query ? `?${query}` : ''}`); }
export function getRevenueReport(request: Requester, query = '') { return request<Report>(`/api/reports/revenue${query ? `?${query}` : ''}`); }

export async function listConsultations(request: Requester, query = '') { return list<Consultation>(await request<unknown>(`/api/consultations${query ? `?${query}` : ''}`)); }
export function getConsultation(request: Requester, id: string) { return request<Consultation>(`/api/consultations/${encodeURIComponent(id)}`); }
export function sendConsultationMessage(request: Requester, id: string, body: unknown) { return post<Consultation>(request, `/api/consultations/${encodeURIComponent(id)}/messages`, body); }
