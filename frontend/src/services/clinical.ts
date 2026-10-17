import type { Requester } from './catalog';

export interface Encounter { id?: string; patientId?: string; appointmentId?: string; status?: string; startedAt?: string; [key: string]: unknown; }
export interface PregnancyEpisode { id?: string; patientId?: string; status?: string; [key: string]: unknown; }
export interface Prescription { id?: string; patientId?: string; encounterId?: string; status?: string; [key: string]: unknown; }
export interface TreatmentPlan { id?: string; patientId?: string; status?: string; title?: string; [key: string]: unknown; }
const list = <T,>(raw: unknown): T[] => Array.isArray(raw) ? raw as T[] : Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: T[] }).items : Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: T[] }).data : [];
const post = <T>(request: Requester, path: string, body?: unknown) => request<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export async function listEncounters(request: Requester, query = '') { return list<Encounter>(await request<unknown>(`/api/medical-records/encounters${query ? `?${query}` : ''}`)); }
export function getEncounter(request: Requester, id: string) { return request<Encounter>(`/api/medical-records/encounters/${encodeURIComponent(id)}`); }
export function startEncounter(request: Requester, id: string) { return post<Encounter>(request, `/api/medical-records/encounters/${encodeURIComponent(id)}/start`); }
export function recordVitalSigns(request: Requester, id: string, body: unknown) { return post<Encounter>(request, `/api/medical-records/encounters/${encodeURIComponent(id)}/vital-signs`, body); }
export function addClinicalNote(request: Requester, id: string, body: unknown) { return post<Encounter>(request, `/api/medical-records/encounters/${encodeURIComponent(id)}/notes`, body); }
export function addDiagnosis(request: Requester, id: string, body: unknown) { return post<Encounter>(request, `/api/medical-records/encounters/${encodeURIComponent(id)}/diagnoses`, body); }
export function createServiceOrder(request: Requester, id: string, body: unknown) { return post<Encounter>(request, `/api/medical-records/encounters/${encodeURIComponent(id)}/orders`, body); }
export function finalizeEncounter(request: Requester, id: string, body?: unknown) { return post<Encounter>(request, `/api/medical-records/encounters/${encodeURIComponent(id)}/finalize`, body); }
export async function listPregnancyEpisodes(request: Requester) { return list<PregnancyEpisode>(await request<unknown>('/api/medical-records/pregnancy-episodes')); }

export async function listPrescriptions(request: Requester, query = '') { return list<Prescription>(await request<unknown>(`/api/prescriptions${query ? `?${query}` : ''}`)); }
export function getPrescription(request: Requester, id: string) { return request<Prescription>(`/api/prescriptions/${encodeURIComponent(id)}`); }
export function createPrescription(request: Requester, body: unknown) { return post<Prescription>(request, '/api/prescriptions', body); }
export function issuePrescription(request: Requester, id: string, body?: unknown) { return post<Prescription>(request, `/api/prescriptions/${encodeURIComponent(id)}/issue`, body); }
export function cancelPrescription(request: Requester, id: string, body?: unknown) { return post<Prescription>(request, `/api/prescriptions/${encodeURIComponent(id)}/cancel`, body); }

export async function listTreatmentPlans(request: Requester, query = '') { return list<TreatmentPlan>(await request<unknown>(`/api/treatment-plans${query ? `?${query}` : ''}`)); }
export function getTreatmentPlan(request: Requester, id: string) { return request<TreatmentPlan>(`/api/treatment-plans/${encodeURIComponent(id)}`); }
export function createTreatmentPlan(request: Requester, body: unknown) { return post<TreatmentPlan>(request, '/api/treatment-plans', body); }
export function activateTreatmentPlan(request: Requester, id: string, body?: unknown) { return post<TreatmentPlan>(request, `/api/treatment-plans/${encodeURIComponent(id)}/activate`, body); }
export function completeTreatmentPlan(request: Requester, id: string, body?: unknown) { return post<TreatmentPlan>(request, `/api/treatment-plans/${encodeURIComponent(id)}/complete`, body); }
