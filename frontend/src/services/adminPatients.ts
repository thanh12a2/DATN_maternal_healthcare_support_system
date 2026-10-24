import type { Requester } from './catalog';

export interface PatientEmergencyContact {
  id: string;
  fullName: string;
  relationship: string;
  phoneNumber: string;
  isPrimary: boolean;
  priority: number;
}

export interface PatientItem {
  id: string;
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
  phoneNumberMasked?: string;
  email?: string | null;
  status?: 'ACTIVE' | 'LOCKED' | 'DRAFT' | string;
  nationalId?: string | null;
  nationalIdMasked?: string | null;
  address?: string | null;
  authAccountId?: string | null;
  version: number;
  emergencyContacts?: PatientEmergencyContact[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PatientSearchResult {
  items: PatientItem[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchPatientsParams {
  query?: string;
  fullName?: string;
  phoneNumber?: string;
  nationalId?: string;
  page?: number;
  limit?: number;
}

export interface CreatePatientPayload {
  fullName: string;
  email?: string;
  dateOfBirth: string; // YYYY-MM-DD
  phoneNumber: string;
  nationalId?: string;
  address?: string;
  reason?: string;
}

export interface UpdatePatientPayload {
  fullName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  nationalId?: string;
  address?: string;
  version?: number;
  reason?: string;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function searchPatients(
  request: Requester,
  params: SearchPatientsParams = {},
): Promise<PatientSearchResult> {
  const body: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.query?.trim()) body.query = params.query.trim();
  if (params.fullName?.trim()) body.fullName = params.fullName.trim();
  if (params.phoneNumber?.trim()) body.phoneNumber = params.phoneNumber.trim();
  if (params.nationalId?.trim()) body.nationalId = params.nationalId.trim();

  const res = await request<{ data: PatientSearchResult } | PatientSearchResult>('/api/patients/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const data = 'data' in res ? res.data : res;
  return {
    items: data.items ?? [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    limit: data.limit ?? 10,
  };
}

export async function getPatient(
  request: Requester,
  patientId: string,
): Promise<PatientItem> {
  const res = await request<{ data: PatientItem } | PatientItem>(`/api/patients/${encodeURIComponent(patientId)}`);
  return 'data' in res ? res.data : res;
}

export async function createPatient(
  request: Requester,
  payload: CreatePatientPayload,
): Promise<PatientItem> {
  const res = await request<{ data: PatientItem } | PatientItem>('/api/patients', {
    method: 'POST',
    headers: {
      'idempotency-key': generateUuid(),
    },
    body: JSON.stringify({
      ...payload,
      reason: payload.reason || 'Admin tạo hồ sơ bệnh nhân',
    }),
  });
  return 'data' in res ? res.data : res;
}

export async function updatePatient(
  request: Requester,
  patientId: string,
  payload: UpdatePatientPayload,
): Promise<PatientItem> {
  const res = await request<{ data: PatientItem } | PatientItem>(`/api/patients/${encodeURIComponent(patientId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...payload,
      reason: payload.reason || 'Admin cập nhật hồ sơ bệnh nhân',
    }),
  });
  return 'data' in res ? res.data : res;
}

export async function deletePatient(
  request: Requester,
  patientId: string,
): Promise<void> {
  await request<void>(`/api/patients/${encodeURIComponent(patientId)}`, {
    method: 'DELETE',
  });
}

export interface CreateEmergencyContactPayload {
  fullName: string;
  relationship: string;
  phoneNumber: string;
  isPrimary?: boolean;
}

export interface UpdateEmergencyContactPayload {
  fullName?: string;
  relationship?: string;
  phoneNumber?: string;
  isPrimary?: boolean;
}

export async function createEmergencyContact(
  request: Requester,
  patientId: string,
  payload: CreateEmergencyContactPayload,
): Promise<PatientEmergencyContact> {
  const res = await request<{ data: PatientEmergencyContact } | PatientEmergencyContact>(
    `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return 'data' in res ? res.data : res;
}

export async function updateEmergencyContact(
  request: Requester,
  patientId: string,
  contactId: string,
  payload: UpdateEmergencyContactPayload,
): Promise<PatientEmergencyContact> {
  const res = await request<{ data: PatientEmergencyContact } | PatientEmergencyContact>(
    `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts/${encodeURIComponent(contactId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return 'data' in res ? res.data : res;
}

export async function deleteEmergencyContact(
  request: Requester,
  patientId: string,
  contactId: string,
): Promise<void> {
  await request<void>(
    `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts/${encodeURIComponent(contactId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function reorderEmergencyContacts(
  request: Requester,
  patientId: string,
  contactIds: string[],
): Promise<PatientEmergencyContact[]> {
  const res = await request<{ data: PatientEmergencyContact[] } | PatientEmergencyContact[]>(
    `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts/order`,
    {
      method: 'PUT',
      body: JSON.stringify({ contactIds }),
    },
  );
  return 'data' in res ? res.data : res;
}
