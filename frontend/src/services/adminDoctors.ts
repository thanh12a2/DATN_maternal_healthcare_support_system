import type { Requester } from './catalog';

export type DoctorStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export type DoctorConsultationRank =
  | 'BASIC'
  | 'SPECIALIST_I'
  | 'SPECIALIST_II'
  | 'MASTER'
  | 'ASSOC_PROFESSOR'
  | 'PROFESSOR'
  | 'EXPERT'
  | 'HEAD_DOCTOR'
  | (string & {});

export interface DoctorSpecialtyInfo {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
}

export interface DoctorProfile {
  fullName: string;
  professionalTitle?: string | null;
  biography?: string | null;
  practiceStartYear?: number | null;
  photoUrl?: string | null;
}

export interface DoctorScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  status: string;
  roomId?: string | null;
}

export interface DoctorItem {
  id: string;
  accountId: string;
  email?: string | null;
  phoneNumber?: string | null;
  licenseNumber: string;
  consultationRank: DoctorConsultationRank;
  status: DoctorStatus;
  version: number;
  profile: DoctorProfile;
  specialties: DoctorSpecialtyInfo[];
  schedules?: DoctorScheduleItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SpecialtyItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
}

export interface QueryDoctorsParams {
  limit?: number;
  cursor?: string;
  status?: string;
  specialtyId?: string;
  q?: string;
  accountId?: string;
}

export interface CreateDoctorPayload {
  accountId?: string;
  email: string;
  phoneNumber: string;
  licenseNumber: string;
  consultationRank?: DoctorConsultationRank;
  profile: {
    fullName: string;
    professionalTitle?: string;
    biography?: string;
    practiceStartYear?: number;
    photoUrl?: string;
  };
}

export interface UpdateDoctorPayload {
  email?: string;
  phoneNumber?: string;
  licenseNumber?: string;
  consultationRank?: DoctorConsultationRank;
  profile?: {
    fullName?: string;
    professionalTitle?: string;
    biography?: string;
    practiceStartYear?: number;
    photoUrl?: string;
  };
}

export async function listDoctors(
  request: Requester,
  params: QueryDoctorsParams = {},
): Promise<{ data: DoctorItem[]; nextCursor?: string }> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.status) query.set('status', params.status);
  if (params.specialtyId) query.set('specialtyId', params.specialtyId);
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.accountId) query.set('accountId', params.accountId);

  const path = `/api/doctors${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await request<{ data: DoctorItem[]; nextCursor?: string } | DoctorItem[]>(path);
  if (Array.isArray(res)) {
    return { data: res };
  }
  return {
    data: res.data ?? [],
    nextCursor: res.nextCursor,
  };
}

export async function getDoctor(
  request: Requester,
  doctorId: string,
): Promise<DoctorItem> {
  const res = await request<{ data: DoctorItem } | DoctorItem>(`/api/doctors/${encodeURIComponent(doctorId)}`);
  return 'data' in res ? res.data : res;
}

export async function createDoctor(
  request: Requester,
  payload: CreateDoctorPayload,
): Promise<DoctorItem> {
  const res = await request<{ data: DoctorItem } | DoctorItem>('/api/doctors', {
    method: 'POST',
    headers: {
      'idempotency-key': `doctor-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    body: JSON.stringify(payload),
  });
  return 'data' in res ? res.data : res;
}

export async function updateDoctor(
  request: Requester,
  doctorId: string,
  version: number,
  payload: UpdateDoctorPayload,
): Promise<DoctorItem> {
  const res = await request<{ data: DoctorItem } | DoctorItem>(`/api/doctors/${encodeURIComponent(doctorId)}`, {
    method: 'PATCH',
    headers: {
      'if-match': String(version),
    },
    body: JSON.stringify(payload),
  });
  return 'data' in res ? res.data : res;
}

export async function activateDoctor(
  request: Requester,
  doctorId: string,
  version: number,
): Promise<DoctorItem> {
  const res = await request<{ data: DoctorItem } | DoctorItem>(`/api/doctors/${encodeURIComponent(doctorId)}/activate`, {
    method: 'POST',
    headers: {
      'if-match': String(version),
    },
    body: '{}',
  });
  return 'data' in res ? res.data : res;
}

export async function deactivateDoctor(
  request: Requester,
  doctorId: string,
  version: number,
  reason: string,
): Promise<DoctorItem> {
  const res = await request<{ data: DoctorItem } | DoctorItem>(`/api/doctors/${encodeURIComponent(doctorId)}/deactivate`, {
    method: 'POST',
    headers: {
      'if-match': String(version),
    },
    body: JSON.stringify({ reason }),
  });
  return 'data' in res ? res.data : res;
}

export async function deleteDoctor(
  request: Requester,
  doctorId: string,
): Promise<void> {
  await request<void>(`/api/doctors/${encodeURIComponent(doctorId)}`, {
    method: 'DELETE',
  });
}

export async function listSpecialties(
  request: Requester,
  params?: { status?: string; limit?: number },
): Promise<SpecialtyItem[]> {
  try {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    q.set('limit', String(params?.limit ?? 100));
    const qs = q.toString();
    const url = `/api/doctors/specialties${qs ? `?${qs}` : ''}`;
    const res = await request<{ data: SpecialtyItem[] } | SpecialtyItem[]>(url);
    if (Array.isArray(res)) return res;
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function linkDoctorSpecialty(
  request: Requester,
  doctorId: string,
  specialtyId: string,
  isPrimary: boolean = true,
): Promise<void> {
  await request<unknown>(
    `/api/doctors/${encodeURIComponent(doctorId)}/specialties/${encodeURIComponent(specialtyId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ isPrimary }),
    },
  );
}

export async function unlinkDoctorSpecialty(
  request: Requester,
  doctorId: string,
  specialtyId: string,
): Promise<void> {
  await request<unknown>(
    `/api/doctors/${encodeURIComponent(doctorId)}/specialties/${encodeURIComponent(specialtyId)}`,
    {
      method: 'DELETE',
    },
  );
}

export interface CreateSpecialtyPayload {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateSpecialtyPayload {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export async function createSpecialty(
  request: Requester,
  payload: CreateSpecialtyPayload,
): Promise<SpecialtyItem> {
  const res = await request<{ data: SpecialtyItem } | SpecialtyItem>('/api/doctors/specialties', {
    method: 'POST',
    headers: {
      'idempotency-key': `specialty-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    body: JSON.stringify(payload),
  });
  return 'data' in res ? res.data : res;
}

export async function updateSpecialty(
  request: Requester,
  id: string,
  payload: UpdateSpecialtyPayload,
  options?: { suppressAudit?: boolean },
): Promise<SpecialtyItem> {
  const querySuffix = options?.suppressAudit ? '?suppressAudit=true' : '';
  const res = await request<{ data: SpecialtyItem } | SpecialtyItem>(
    `/api/doctors/specialties/${encodeURIComponent(id)}${querySuffix}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return 'data' in res ? res.data : res;
}

export async function deleteSpecialty(
  request: Requester,
  id: string,
): Promise<void> {
  await request<unknown>(`/api/doctors/specialties/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export interface ConsultationRankItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  experienceYearsMin: number;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateConsultationRankPayload {
  code: string;
  name: string;
  description?: string;
  surchargeMinor?: number;
  experienceYearsMin?: number;
  status?: string;
}

export interface UpdateConsultationRankPayload {
  name?: string;
  description?: string;
  surchargeMinor?: number;
  experienceYearsMin?: number;
  status?: string;
}

export async function listConsultationRanks(
  request: Requester,
): Promise<ConsultationRankItem[]> {
  try {
    const res = await request<{ data: ConsultationRankItem[] } | ConsultationRankItem[]>(
      '/api/doctors/consultation-ranks',
    );
    if (Array.isArray(res)) return res;
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function createConsultationRank(
  request: Requester,
  payload: CreateConsultationRankPayload,
): Promise<ConsultationRankItem> {
  const res = await request<{ data: ConsultationRankItem } | ConsultationRankItem>(
    '/api/doctors/consultation-ranks',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return 'data' in res ? res.data : res;
}

export async function updateConsultationRank(
  request: Requester,
  id: string,
  payload: UpdateConsultationRankPayload,
): Promise<ConsultationRankItem> {
  const res = await request<{ data: ConsultationRankItem } | ConsultationRankItem>(
    `/api/doctors/consultation-ranks/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return 'data' in res ? res.data : res;
}

export async function deleteConsultationRank(
  request: Requester,
  id: string,
): Promise<void> {
  await request<unknown>(
    `/api/doctors/consultation-ranks/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
}
