// Common API types and interfaces
export interface DataEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type Role = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE' | 'CLINIC_MANAGER' | 'ADMIN';
