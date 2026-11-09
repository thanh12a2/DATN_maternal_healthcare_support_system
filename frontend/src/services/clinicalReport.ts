import type { Requester } from './catalog';

export interface MedicalReportPayload {
  appointmentCode: string;
  encounterId: string;
  patientId: string;
  roomCode?: string;
  roomName?: string;
  examinationDate: string;
  examinationTime?: string;

  // Patient Demographics
  patientName: string;
  patientDob?: string;
  patientAge?: number | string;
  patientGender?: string;
  patientPhone?: string;
  patientNationalId?: string;
  patientAddress?: string;
  emergencyContact?: string;
  pregnancyWeek?: string;

  // Vitals
  vitals?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    weight?: string;
    height?: string;
    bmi?: string;
  };

  // Clinical Diagnosis
  chiefComplaint?: string;
  clinicalExamination?: string;
  primaryDiagnosis: string;
  doctorNotes?: string;

  // Paraclinical orders
  clinicalOrders?: Array<{
    name: string;
    category?: string;
    result?: string;
    status?: string;
  }>;

  // Prescriptions
  prescriptions?: Array<{
    name: string;
    strength?: string;
    quantity: number | string;
    unit?: string;
    dosage?: string;
    frequency?: string;
    instruction?: string;
  }>;

  // Care Advice & Treatment Plan
  careAdvice?: Array<{
    category?: string;
    title: string;
    description: string;
  }>;

  // Follow-up
  followUpDate?: string;
  followUpRelative?: string;

  // Doctor
  doctorName: string;
  finalizedAt?: string;
}

export interface GeneratedReportResult {
  documentId: string;
  version: number;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  viewUrl: string;
  downloadUrl: string;
  generatedAt: string;
}

export async function generateEncounterReport(
  request: Requester,
  payload: MedicalReportPayload
): Promise<GeneratedReportResult> {
  const res = await request<GeneratedReportResult | { data: GeneratedReportResult }>(
    '/api/documents/encounter-reports',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return (res as any)?.data || res;
}

export async function getEncounterReport(
  request: Requester,
  encounterId: string
): Promise<GeneratedReportResult | null> {
  try {
    const res = await request<{ success: boolean; data: GeneratedReportResult }>(
      `/api/documents/encounter-reports/${encodeURIComponent(encounterId)}`
    );
    if (!res || !res.data) return null;
    return res.data;
  } catch (err) {
    return null;
  }
}

