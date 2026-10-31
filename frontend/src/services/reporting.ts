import type { Requester } from './catalog';

export interface ReportPayload { [key: string]: unknown; }
export function getOverview(request: Requester, query = '') { return request<ReportPayload>(`/api/reports/overview${query ? `?${query}` : ''}`); }
export function getAppointments(request: Requester, query = '') { return request<ReportPayload>(`/api/reports/appointments${query ? `?${query}` : ''}`); }
export function getRevenue(request: Requester, query = '') { return request<ReportPayload>(`/api/reports/revenue${query ? `?${query}` : ''}`); }
export async function downloadCsv(request: Requester, kind: 'appointments' | 'revenue', query = '') {
  return request<Blob>(`/api/reports/${kind}.csv${query ? `?${query}` : ''}`, { headers: { Accept: 'text/csv' } });
}
