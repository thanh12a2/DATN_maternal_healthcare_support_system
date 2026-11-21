import type { Requester } from './catalog';
export type SelectionMode = 'DOCTOR' | 'RANK';
export type AppointmentStatus = 'BOOKED' | 'REASSIGNMENT_REQUIRED' | 'CHECKED_IN' | 'IN_CLINICAL_CARE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export interface BookableSlot { serviceId?: string; selectionMode?: SelectionMode; doctorId?: string | null; rankCode?: string; startAt: string; endAt: string; availableCapacity?: number; [key: string]: unknown; }
export interface SlotHold { id: string; expiresAt: string; status?: string; [key: string]: unknown; }
export interface Appointment {
  id?: string;
  appointmentCode?: string;
  patientId?: string;
  patientName?: string;
  patientDemographics?: { name: string; phone: string; dob?: string; nationalId?: string; address?: string; emergencyContact?: string };
  serviceId?: string;
  specialtyId?: string;
  assignedDoctorId?: string;
  assignedRankCode?: string;
  roomCode?: string;
  roomName?: string;
  selectionMode?: SelectionMode;
  startAt?: string;
  endAt?: string;
  status?: AppointmentStatus;
  pricing?: {
    serviceName?: string;
    estimatedTotalMinor?: number;
    currency?: string;
    basePriceMinor?: number;
    rankSurchargeMinor?: number;
    totalMinor?: number;
  };
  doctorNotes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  checkInAt?: string;
  checkedInAt?: string;
  clinicalStartedAt?: string;
  completedAt?: string;
  queueCode?: string;
  queueState?: string;
  invoice?: any;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
export interface AppointmentPage { items?: Appointment[]; nextPageToken?: string | null; }
const list = <T,>(raw: unknown): T[] => Array.isArray(raw) ? raw as T[] : Array.isArray((raw as {items?: unknown})?.items) ? (raw as {items: T[]}).items : Array.isArray((raw as {data?: unknown})?.data) ? (raw as {data: T[]}).data : [];
export function idempotencyKey(): string { try { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch { /* fallback */ } return 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2); }
export async function listBookableSlots(request: Requester, params: {serviceId: string; selectionMode: SelectionMode; from: string; to: string; requestedDoctorId?: string; requestedRankCode?: string}): Promise<BookableSlot[]> { const query = new URLSearchParams({serviceId: params.serviceId, selectionMode: params.selectionMode, from: params.from, to: params.to, limit: '50'}); if (params.requestedDoctorId) query.set('requestedDoctorId', params.requestedDoctorId); if (params.requestedRankCode) query.set('requestedRankCode', params.requestedRankCode); return list<BookableSlot>(await request('/api/appointment/bookable-slots?' + query)); }
export function createSlotHold(request: Requester, body: {serviceId: string; selectionMode: SelectionMode; requestedDoctorId?: string; requestedRankCode?: string; startAt: string; endAt: string}) { return request<SlotHold>('/api/appointment/slot-holds', {method:'POST', headers:{'Idempotency-Key': idempotencyKey()}, body:JSON.stringify(body)}); }
export function releaseSlotHold(request: Requester, id: string) { return request<void>('/api/appointment/slot-holds/' + encodeURIComponent(id), {method:'DELETE'}); }
export function createAppointment(request: Requester, holdId: string, reasonForVisit?: string) { return request<Appointment>('/api/appointment/appointments', {method:'POST', headers:{'Idempotency-Key': idempotencyKey()}, body:JSON.stringify({holdId, channel:'ONLINE', ...(reasonForVisit?.trim() ? {reasonForVisit: reasonForVisit.trim()} : {})})}); }
export interface AppointmentListFilters {
  status?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

export async function listAppointments(request: Requester, filters: AppointmentListFilters = {}): Promise<AppointmentPage> {
  const query = new URLSearchParams({ limit: '100' });
  if (filters.status) query.set('status', filters.status);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.cursor) query.set('cursor', filters.cursor);
  const raw = await request<unknown>('/api/appointment/appointments?' + query.toString());
  return {items:list<Appointment>(raw), nextPageToken:(raw as AppointmentPage)?.nextPageToken};
}
export async function listAllDoctorAppointments(request: Requester, filters: AppointmentListFilters = {}): Promise<Appointment[]> {
  const rows: Appointment[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await listAppointments(request, { ...filters, cursor });
    rows.push(...(page.items ?? []));
    cursor = page.nextPageToken || undefined;
    if (cursor && seen.has(cursor)) throw new Error('Không thể tải đầy đủ danh sách lịch khám.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return rows;
}
export async function getDoctorOccupancy(request: Requester, from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return (await request<{ data: { startAt: string; endAt: string }[] }>('/api/appointment/doctor-occupancy?' + query)).data;
}
export function getAppointment(request: Requester, id: string) { return request<Appointment>('/api/appointment/appointments/' + encodeURIComponent(id)); }
export function cancelAppointment(request: Requester, id: string, reason: string, version?: number) { return request<void>('/api/appointment/appointments/' + encodeURIComponent(id) + '/cancel', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify({ reason, ...(version === undefined ? {} : { version }) }) }); }
export function rescheduleAppointment(request: Requester, id: string, body: { holdId: string; reason?: string; version?: number }) { return request<Appointment>('/api/appointment/appointments/' + encodeURIComponent(id) + '/reschedule', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify(body) }); }

export interface QueueTicketInfo {
  ticketCode?: string;
  stageCode?: string;
  roomCode?: string;
  state?: string;
}

export async function fetchAppointmentsQueueMap(request: Requester): Promise<Map<string, QueueTicketInfo>> {
  const map = new Map<string, QueueTicketInfo>();
  try {
    // 1. Kiểm tra nhanh active journey của bệnh nhân đang đăng nhập
    try {
      const activeRes = await request<any>('/api/queue/me/journeys/active');
      const activeJourney = activeRes?.data || activeRes;
      const apptId = activeJourney?.appointmentId;
      const tickets = activeJourney?.tickets || [];
      const primaryTicket = tickets[0];
      if (apptId && primaryTicket?.ticketCode) {
        map.set(apptId, {
          ticketCode: primaryTicket.ticketCode,
          stageCode: primaryTicket.stageCode,
          roomCode: primaryTicket.roomCode,
          state: primaryTicket.state,
        });
      }
    } catch {
      // Bỏ qua nếu không phải tài khoản bệnh nhân hoặc chưa có active journey
    }

    // 2. Tải danh sách stages và bóc tách đúng mảng data tickets
    const stagesRaw = await request<any>('/api/queue/stages').catch(() => []);
    const stages = Array.isArray(stagesRaw) ? stagesRaw : stagesRaw?.data || [];
    if (Array.isArray(stages) && stages.length > 0) {
      const lists = await Promise.all(
        stages.map(async (s: any) => {
          if (!s?.id) return [];
          const res = await request<any>(`/api/queue/stages/${encodeURIComponent(s.id)}/tickets?limit=100`).catch(() => []);
          const items = Array.isArray(res) ? res : res?.data || res?.items || [];
          return Array.isArray(items) ? items : [];
        })
      );
      for (const item of lists.flat()) {
        const apptId = (item as any)?.appointmentId || (item as any)?.journey?.appointmentId;
        const code = (item as any)?.ticketCode;
        if (apptId && code) {
          map.set(apptId, {
            ticketCode: code,
            stageCode: (item as any)?.stageCode,
            roomCode: (item as any)?.roomCode,
            state: (item as any)?.state,
          });
        }
      }
    }
  } catch {
    // Graceful fallback
  }
  return map;
}

export async function fetchAppointmentInvoicesMap(request: Requester, appointmentIds: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (!appointmentIds || appointmentIds.length === 0) return map;
  try {
    const list = await Promise.all(
      appointmentIds.map(async (id) => {
        try {
          const res = await request<any>(`/api/billing/invoices?appointmentId=${encodeURIComponent(id)}&limit=10`);
          const items = Array.isArray(res) ? res : res?.items || res?.data || [];
          if (!items || items.length === 0) return { id, invoice: null };

          if (items.length === 1) {
            const single = items[0];
            const t = Number(single.totalMinor ?? single.total ?? 0);
            const isBase = single.type === 'BASE';
            return {
              id,
              invoice: {
                ...single,
                invoices: items,
                totalMinor: t,
                total: t,
                initialFeeMinor: isBase ? t : 0,
                extraFeeMinor: isBase ? 0 : t,
                hasAdditionalOrders: !isBase,
              },
            };
          }

          // Phân loại và tổng hợp viện phí khi có nhiều hóa đơn (Khám ban đầu + Chỉ định phát sinh)
          let totalMinor = 0;
          let paidMinor = 0;
          let balanceMinor = 0;
          let allPaid = true;
          let initialFeeMinor = 0;
          let extraFeeMinor = 0;

          const baseInvoice = items.find((inv: any) => inv.type === 'BASE') || items[items.length - 1] || items[0];
          initialFeeMinor = Number(baseInvoice?.totalMinor ?? baseInvoice?.total ?? 0);

          for (const inv of items) {
            const t = Number(inv.totalMinor ?? inv.total ?? 0);
            const p = Number(inv.paidMinor ?? inv.paid ?? 0);
            const b = Number(inv.balanceMinor ?? inv.balance ?? 0);
            totalMinor += t;
            paidMinor += p;
            balanceMinor += b;
            if (inv.status !== 'PAID') {
              allPaid = false;
            }
            if (inv.id !== baseInvoice?.id || inv.type !== 'BASE') {
              extraFeeMinor += t;
            }
          }

          if (extraFeeMinor === 0 && totalMinor > initialFeeMinor) {
            extraFeeMinor = totalMinor - initialFeeMinor;
          }

          const aggregated = {
            ...baseInvoice,
            invoices: items,
            totalMinor,
            total: totalMinor,
            paidMinor,
            paid: paidMinor,
            balanceMinor,
            balance: balanceMinor,
            status: allPaid ? 'PAID' : (paidMinor > 0 ? 'PARTIAL' : 'UNPAID'),
            initialFeeMinor,
            extraFeeMinor,
            hasAdditionalOrders: extraFeeMinor > 0,
          };
          return { id, invoice: aggregated };
        } catch {
          return { id, invoice: null };
        }
      })
    );
    for (const item of list) {
      if (item.invoice) {
        map.set(item.id, item.invoice);
      }
    }
  } catch {
    // Graceful fallback
  }
  return map;
}
