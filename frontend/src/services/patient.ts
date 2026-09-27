import { apiRequest } from './api';

export interface EmergencyContact {
  id: string;
  fullName: string;
  relationship: string;
  phoneNumber: string;
  isPrimary: boolean;
  priority: number;
}

export interface PatientProfile {
  id: string;
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
  nationalIdMasked: string | null;
  address: string | null;
  profileStatus: 'COMPLETE';
  version: number;
  emergencyContacts: EmergencyContact[];
}

interface DataEnvelope<T> { data: T; }

export interface SavePatientProfileInput {
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
  nationalId?: string | null;
  address?: string | null;
  version?: number;
}

export interface SaveContactInput {
  fullName: string;
  relationship: string;
  phoneNumber: string;
  isPrimary?: boolean;
}

export async function getMyPatient(accessToken: string): Promise<PatientProfile> {
  return (await apiRequest<DataEnvelope<PatientProfile>>('/api/patients/me', {}, accessToken)).data;
}

export async function saveMyPatient(input: SavePatientProfileInput, accessToken: string): Promise<PatientProfile> {
  return (await apiRequest<DataEnvelope<PatientProfile>>('/api/patients/me', {
    method: 'PUT', body: JSON.stringify(input),
  }, accessToken)).data;
}

export async function createEmergencyContact(patientId: string, input: SaveContactInput, accessToken: string): Promise<EmergencyContact> {
  return (await apiRequest<DataEnvelope<EmergencyContact>>(`/api/patients/${patientId}/emergency-contacts`, {
    method: 'POST', body: JSON.stringify(input),
  }, accessToken)).data;
}

export async function updateEmergencyContact(patientId: string, contactId: string, input: SaveContactInput, accessToken: string): Promise<EmergencyContact> {
  return (await apiRequest<DataEnvelope<EmergencyContact>>(`/api/patients/${patientId}/emergency-contacts/${contactId}`, {
    method: 'PATCH', body: JSON.stringify(input),
  }, accessToken)).data;
}
