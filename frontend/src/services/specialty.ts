import { apiRequest } from './api';

export interface SpecialtyOverviewData {
  intro?: string;
  scopeOfCare?: string[];
  standardTitle?: string;
  standardDesc?: string;
  diagnosticTitle?: string;
  diagnostics?: string[];
  treatmentTitle?: string;
  treatments?: string[];
  patientNotes?: string;
}

export interface SpecialtyItem {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  overview?: SpecialtyOverviewData | null;
  status?: string;
}

let cachedSpecialties: SpecialtyItem[] | null = null;
let pendingPromise: Promise<SpecialtyItem[]> | null = null;

export async function fetchSpecialties(): Promise<SpecialtyItem[]> {
  if (cachedSpecialties && cachedSpecialties.length > 0) {
    return cachedSpecialties;
  }
  if (pendingPromise) {
    return pendingPromise;
  }

  pendingPromise = (async () => {
    // 1. Primary endpoint: GET /api/doctors/specialties (Doctor database)
    try {
      const res = await apiRequest<{ data?: SpecialtyItem[] } | SpecialtyItem[]>('/api/doctors/specialties');
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list) && list.length > 0) {
        cachedSpecialties = list.filter((item) => Boolean(item && item.slug && item.name));
        return cachedSpecialties;
      }
    } catch {
      // Fallback
    }

    // 2. Secondary fallback
    try {
      const res = await apiRequest<{ data?: SpecialtyItem[] } | SpecialtyItem[]>('/specialties');
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list) && list.length > 0) {
        cachedSpecialties = list.filter((item) => Boolean(item && item.slug && item.name));
        return cachedSpecialties;
      }
    } catch {
      // Return empty
    }

    return [];
  })().finally(() => {
    pendingPromise = null;
  });

  return pendingPromise;
}
