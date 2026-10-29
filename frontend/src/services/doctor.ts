import type { Requester } from './catalog';
export interface Doctor { id?: string; doctorId?: string; fullName?: string; name?: string; displayName?: string; professionalTitle?: string; consultationRank?: string; profile?: { fullName?: string; professionalTitle?: string }; [key: string]: unknown; }
export interface Specialty { id?: string; code?: string; name?: string; [key: string]: unknown; }
function items<T>(raw: unknown): T[] { if (Array.isArray(raw)) return raw as T[]; const value = raw as {data?: unknown; items?: unknown}; if (Array.isArray(value?.data)) return value.data as T[]; if (Array.isArray(value?.items)) return value.items as T[]; return []; }
export interface ClinicRoom { id: string; code: string; name: string; status: string; }
export async function listDoctors(request: Requester): Promise<Doctor[]> { return items<Doctor>(await request('/api/doctors?limit=100')); }
export async function listClinicRooms(request: Requester): Promise<ClinicRoom[]> { return items<ClinicRoom>(await request('/api/doctors/rooms?limit=100')); }
export async function listSpecialties(request: Requester): Promise<Specialty[]> { return items<Specialty>(await request('/api/doctors/specialties')); }
export function getDoctor(request: Requester, id: string) { return request<Doctor>('/api/doctors/' + encodeURIComponent(id)); }
export function getDoctorAvailability(request: Requester, id: string, from: string, to: string) { const q = new URLSearchParams({ from, to }); return request<unknown>('/api/doctors/' + encodeURIComponent(id) + '/availability?' + q); }
export interface MyDoctor { id: string; status: string; consultationRank?: string; version: number; profile: { fullName?: string; professionalTitle?: string; biography?: string | null; languages?: string[]; photoUrl?: string | null }; specialties?: { name: string }[]; }
export async function getMyDoctor(request: Requester) { return (await request<{ data: MyDoctor }>('/api/doctors/me')).data; }
export async function updateMyDoctor(request: Requester, doctor: MyDoctor, body: { biography?: string; languages?: string[]; photoUrl?: string }) { return (await request<{ data: MyDoctor }>('/api/doctors/' + encodeURIComponent(doctor.id), { method: 'PATCH', headers: { 'If-Match': String(doctor.version) }, body: JSON.stringify(body) })).data; }
export interface DoctorInterval { startAt: string; endAt: string; roomName?: string | null; roomCode?: string | null; }
export async function listMyAvailability(request: Requester, id: string, from: string, to: string) { return (await request<{ data: { intervals: DoctorInterval[]; bookingOccupancyApplied: boolean } }>('/api/doctors/' + encodeURIComponent(id) + '/availability?' + new URLSearchParams({ from, to }))).data; }
