import type { Requester } from './catalog';
import { listClinicRooms, listDoctors, listSpecialties } from './doctor';
import {
  admitReceptionCase,
  listReceptionAppointments,
  listReceptionInvoices,
  listReceptionQueueStages,
  listReceptionStageTickets,
  openReceptionCase,
  recordReceptionCashPayment,
  searchReceptionPatients,
  verifyReceptionIdentity,
  getReceptionPatient,
  type ReceptionAppointment,
} from './operations';

export type AppointmentStatus = 'BOOKED' | 'CHECKED_IN' | 'IN_CLINICAL_CARE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'REASSIGNMENT_REQUIRED';
export type AppointmentSource = 'BOOKED' | 'WALK_IN';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface DeskRoom { code: string; name: string; doctorName: string }
export interface DeskPatient {
  id: string;
  version?: number;
  fullName: string;
  dateOfBirth?: string;
  phone?: string;
  nationalId?: string;
  nationalIdMasked?: string;
  address?: string;
  emergencyContacts: Array<{ id?: string; fullName: string; relationship?: string; phone?: string; isPrimary?: boolean }>;
  isFullProfile?: boolean;
}
export interface DeskInvoice {
  id: string;
  number: string;
  version: number;
  lines: Array<{ name: string; qty: number; unitPrice: number; amount: number }>;
  total: number;
  paid: number;
  balance: number;
  payments: Array<{ at?: string; method: string; amount: number }>;
}
export interface DeskAppointment {
  id: string;
  code: string;
  version: number;
  date: string;
  startAt: string;
  endAt: string;
  source: AppointmentSource;
  channel: string;
  patientId: string;
  serviceId?: string;
  service: string;
  doctorId?: string;
  doctorName: string;
  roomCode: string;
  roomName: string;
  specialty: string;
  status: AppointmentStatus;
  queueCode?: string;
  queueState?: string;
  checkedInAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  estimatedTotal: number;
  invoice?: DeskInvoice | null;
}
export interface DeskDoctorInfo {
  id: string;
  name: string;
  roomCode: string;
  roomName: string;
  specialtyName: string;
  shiftType: 'MORNING' | 'AFTERNOON' | 'EVENING';
  shiftLabel: string;
  startTime: string;
  endTime: string;
  slots: string[];
}

export type PatientMap = Record<string, DeskPatient>;
export interface DeskCatalog {
  rooms: DeskRoom[];
  doctors: DeskDoctorInfo[];
  services: Array<{ id: string; name: string }>;
  doctorById: Map<string, string>;
  specialtyById: Map<string, string>;
  doctorInfoById: Map<string, DeskDoctorInfo>;
}

export const KNOWN_DOCTOR_SHIFTS: Record<
  string,
  {
    shiftType: 'MORNING' | 'AFTERNOON' | 'EVENING';
    shiftLabel: string;
    startTime: string;
    endTime: string;
    roomCode: string;
    roomName: string;
    specialtyName: string;
  }
> = {
  // P.201 - Phòng khám Sản Phụ khoa 201
  'BS. CKII. Lê Thu Hà': {
    shiftType: 'MORNING',
    shiftLabel: 'Ca Sáng (07:30 – 12:00)',
    startTime: '07:30',
    endTime: '12:00',
    roomCode: 'P.201',
    roomName: 'Phòng khám Sản Phụ khoa 201',
    specialtyName: 'Sản khoa',
  },
  'ThS. BS. Trần Thanh Mai': {
    shiftType: 'AFTERNOON',
    shiftLabel: 'Ca Chiều (12:30 – 17:00)',
    startTime: '12:30',
    endTime: '17:00',
    roomCode: 'P.201',
    roomName: 'Phòng khám Sản Phụ khoa 201',
    specialtyName: 'Sản khoa',
  },
  'BS. CKII. Vũ Hoàng Long': {
    shiftType: 'EVENING',
    shiftLabel: 'Ca Tối (17:30 – 20:30)',
    startTime: '17:30',
    endTime: '20:30',
    roomCode: 'P.201',
    roomName: 'Phòng khám Sản Phụ khoa 201',
    specialtyName: 'Hiếm muộn & Hỗ trợ sinh sản',
  },
  // P.203 - Phòng khám Sản Phụ khoa 203
  'PGS. TS. BS. Nguyễn Quang Minh': {
    shiftType: 'MORNING',
    shiftLabel: 'Ca Sáng (07:30 – 12:00)',
    startTime: '07:30',
    endTime: '12:00',
    roomCode: 'P.203',
    roomName: 'Phòng khám Sản Phụ khoa 203',
    specialtyName: 'Y học bào thai & CĐTS',
  },
  'BS. CKI. Đặng Kim Oanh': {
    shiftType: 'AFTERNOON',
    shiftLabel: 'Ca Chiều (12:30 – 17:00)',
    startTime: '12:30',
    endTime: '17:00',
    roomCode: 'P.203',
    roomName: 'Phòng khám Sản Phụ khoa 203',
    specialtyName: 'Y học bào thai & CĐTS',
  },
  // P.207 - Phòng khám Sản Phụ khoa 207
  'BS. CKI. Phạm Thùy Dương': {
    shiftType: 'MORNING',
    shiftLabel: 'Ca Sáng (07:30 – 12:00)',
    startTime: '07:30',
    endTime: '12:00',
    roomCode: 'P.207',
    roomName: 'Phòng khám Sản Phụ khoa 207',
    specialtyName: 'Bệnh lý nội khoa thai kỳ',
  },
  'BS. Nguyễn Hồng Nhung': {
    shiftType: 'AFTERNOON',
    shiftLabel: 'Ca Chiều (12:30 – 17:00)',
    startTime: '12:30',
    endTime: '17:00',
    roomCode: 'P.207',
    roomName: 'Phòng khám Sản Phụ khoa 207',
    specialtyName: 'Sản khoa',
  },
  'TS. BS. Đoàn Văn Bắc': {
    shiftType: 'EVENING',
    shiftLabel: 'Ca Tối (17:30 – 20:30)',
    startTime: '17:30',
    endTime: '20:30',
    roomCode: 'P.207',
    roomName: 'Phòng khám Sản Phụ khoa 207',
    specialtyName: 'Sản khoa',
  },
};

export function generateSlotsForShift(startTime: string, endTime: string, stepMinutes = 30): string[] {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let cur = startH * 60 + startM;
  const end = endH * 60 + endM;
  const slots: string[] = [];

  while (cur + stepMinutes <= end) {
    const sH = String(Math.floor(cur / 60)).padStart(2, '0');
    const sM = String(cur % 60).padStart(2, '0');
    const next = cur + stepMinutes;
    const eH = String(Math.floor(next / 60)).padStart(2, '0');
    const eM = String(next % 60).padStart(2, '0');
    slots.push(`${sH}:${sM} - ${eH}:${eM}`);
    cur = next;
  }
  return slots;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const num = (v: unknown) => Number(v ?? 0) || 0;
const key = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const patientCache = new Map<string, DeskPatient>();

export async function fetchCatalog(request: Requester): Promise<DeskCatalog> {
  const [rooms, doctors, specialties, rawServices] = await Promise.all([
    listClinicRooms(request).catch(() => []),
    listDoctors(request).catch(() => []),
    listSpecialties(request).catch(() => []),
    request<any>('/api/catalog/services?limit=50').catch(() => ({ data: [] })),
  ]);
  const doctorById = new Map<string, string>();
  const doctorInfoById = new Map<string, DeskDoctorInfo>();
  const doctorsList: DeskDoctorInfo[] = [];

  for (const d of doctors) {
    const name = d.profile?.fullName || d.fullName || d.displayName || 'Bác sĩ';
    const id = String(d.id || d.doctorId || '');
    if (!id) continue;

    if (d.id) doctorById.set(String(d.id), name);
    if (d.doctorId) doctorById.set(String(d.doctorId), name);

    // Map known shifts or fallback
    const known = KNOWN_DOCTOR_SHIFTS[name] || {
      shiftType: 'MORNING' as const,
      shiftLabel: 'Ca Sáng (07:30 – 12:00)',
      startTime: '07:30',
      endTime: '12:00',
      roomCode: d.roomCode ? String(d.roomCode) : 'P.201',
      roomName: d.roomName ? String(d.roomName) : `Phòng khám ${d.roomCode || '201'}`,
      specialtyName: 'Sản Phụ khoa',
    };

    const slots = generateSlotsForShift(known.startTime, known.endTime, 30);
    const docInfo: DeskDoctorInfo = {
      id,
      name,
      roomCode: known.roomCode,
      roomName: known.roomName,
      specialtyName: known.specialtyName,
      shiftType: known.shiftType,
      shiftLabel: known.shiftLabel,
      startTime: known.startTime,
      endTime: known.endTime,
      slots,
    };

    doctorInfoById.set(id, docInfo);
    doctorsList.push(docInfo);
  }

  const specialtyById = new Map<string, string>();
  for (const s of specialties) if (s.id) specialtyById.set(String(s.id), String(s.name ?? ''));

  const list: DeskRoom[] = rooms
    .filter((r) => r.status === 'ACTIVE')
    .map((r) => {
      const docsInRoom = doctorsList.filter((d) => d.roomCode === r.code);
      const docName = docsInRoom.map((d) => d.name).join(' / ') || 'Phòng khám';
      return { code: r.code, name: r.name, doctorName: docName };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const svcData = Array.isArray(rawServices) ? rawServices : rawServices?.data || rawServices?.items || [];
  const servicesList: Array<{ id: string; name: string }> = svcData.map((s: any) => ({
    id: String(s.id),
    name: String(s.name),
  }));

  return { rooms: list, doctors: doctorsList, services: servicesList, doctorById, specialtyById, doctorInfoById };
}

export async function fetchPatientDetails(request: Requester, id: string, force = false): Promise<DeskPatient | null> {
  return fetchPatient(request, id, force);
}

async function fetchPatient(request: Requester, id: string, force = false): Promise<DeskPatient | null> {
  if (!force) {
    const hit = patientCache.get(id);
    if (hit && hit.isFullProfile) return hit;
  }
  const raw = await getReceptionPatient(request, id).catch(() => null) as Record<string, unknown> | null;
  if (!raw) return patientCache.get(id) ?? null;
  const p = cachePatient(raw);
  p.isFullProfile = true;
  return p;
}

function cachePatient(raw: Record<string, unknown>): DeskPatient {
  const contacts = Array.isArray(raw.emergencyContacts) ? raw.emergencyContacts as Array<Record<string, unknown>> : [];
  const rawPhone = str(raw.phoneNumber) ?? str(raw.phoneNumberMasked);
  const formattedPhone = rawPhone ? (rawPhone.startsWith('+84') ? '0' + rawPhone.slice(3) : rawPhone) : undefined;
  const p: DeskPatient = {
    id: String(raw.id),
    version: num(raw.version) || 1,
    fullName: str(raw.fullName) ?? 'Bệnh nhân',
    dateOfBirth: str(raw.dateOfBirth),
    phone: formattedPhone,
    nationalId: str(raw.nationalId),
    nationalIdMasked: str(raw.nationalIdMasked),
    address: str(raw.address),
    emergencyContacts: contacts.map((c) => {
      const cPhone = str(c.phoneNumber);
      return {
        id: str(c.id),
        fullName: str(c.fullName) ?? '',
        relationship: str(c.relationship),
        phone: cPhone ? (cPhone.startsWith('+84') ? '0' + cPhone.slice(3) : cPhone) : undefined,
        isPrimary: Boolean(c.isPrimary),
      };
    }),
    isFullProfile: Boolean(raw.address !== undefined || raw.emergencyContacts !== undefined),
  };
  patientCache.set(p.id, p);
  return p;
}

function toInvoice(raw: Record<string, unknown> | undefined): DeskInvoice | null {
  if (!raw) return null;
  const lines = Array.isArray(raw.lines) ? raw.lines as Array<Record<string, unknown>> : [];
  const payRaw = Array.isArray(raw.payments) ? raw.payments as Array<Record<string, unknown>> : raw.payment ? [raw.payment as Record<string, unknown>] : [];
  return {
    id: String(raw.id ?? raw.invoiceId),
    number: str(raw.invoiceNumber) ?? '',
    version: num(raw.version) || 1,
    lines: lines.map((l) => ({ name: str(l.descriptionSnapshot) ?? '', qty: num(l.quantity), unitPrice: num(l.unitAmountMinor), amount: num(l.lineAmountMinor) })),
    total: num(raw.totalMinor),
    paid: num(raw.paidMinor),
    balance: num(raw.balanceMinor),
    payments: payRaw.filter((p) => p.status !== 'REJECTED').map((p) => ({ at: str(p.receivedAt), method: String(p.method ?? ''), amount: num(p.amountMinor) })),
  };
}

export const paymentStatusOf = (a: DeskAppointment): PaymentStatus => {
  const inv = a.invoice;
  if (!inv || inv.paid <= 0) return 'UNPAID';
  return inv.balance > 0 ? 'PARTIAL' : 'PAID';
};
export const amountTotalOf = (a: DeskAppointment) => a.invoice?.total ?? a.estimatedTotal;

async function ticketMap(request: Requester): Promise<Map<string, { code: string; state: string }>> {
  const map = new Map<string, { code: string; state: string }>();
  const stages = await listReceptionQueueStages(request).catch(() => []);
  const lists = await Promise.all(stages.map((s) => (s.id ? listReceptionStageTickets(request, s.id).catch(() => []) : Promise.resolve([]))));
  for (const t of lists.flat()) {
    const apptId = str((t as Record<string, unknown>).appointmentId);
    if (apptId && t.ticketCode) map.set(apptId, { code: t.ticketCode, state: String(t.state ?? '') });
  }
  return map;
}

async function enrich(request: Requester, cat: DeskCatalog, raws: ReceptionAppointment[]): Promise<DeskAppointment[]> {
  const tickets = await ticketMap(request);
  return Promise.all(raws.map(async (r) => {
    const x = r as Record<string, unknown>;
    const id = String(r.id);
    const invoices = await listReceptionInvoices(request, { appointmentId: id }).catch(() => []);
    const pricing = (x.pricing ?? {}) as Record<string, unknown>;
    const channel = String(x.channel ?? '');
    const t = tickets.get(id);
    const doctorId = str(x.assignedDoctorId);
    const serviceId = str(r.serviceId) ?? str(x.serviceId);
    return {
      id,
      code: String(r.appointmentCode ?? ''),
      version: num(x.version) || 1,
      date: r.startAt ? new Date(r.startAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) : '',
      startAt: String(r.startAt ?? ''),
      endAt: String(r.endAt ?? ''),
      source: /RECEPTION|COUNTER|WALK/i.test(channel) ? 'WALK_IN' : 'BOOKED',
      channel,
      patientId: String(r.patientId ?? ''),
      serviceId,
      service: str(pricing.serviceName) ?? '—',
      doctorId,
      roomCode: str(x.roomCode) ?? '',
      roomName: str(x.roomName) ?? '',
      doctorName: (doctorId && cat.doctorById.get(doctorId)) || '—',
      specialty: cat.specialtyById.get(String(x.specialtyId ?? '')) ?? '—',
      status: String(r.status) as AppointmentStatus,
      queueCode: t?.code,
      queueState: t?.state,
      checkedInAt: str(x.checkedInAt),
      startedAt: str(x.clinicalStartedAt),
      completedAt: str(x.completedAt),
      createdAt: str(x.createdAt),
      updatedAt: str(x.updatedAt),
      estimatedTotal: num(pricing.estimatedTotalMinor),
      invoice: toInvoice(invoices[0] as Record<string, unknown> | undefined),
    };
  }));
}

export async function fetchDayAppointments(request: Requester, cat: DeskCatalog, date: string) {
  const raws = await listReceptionAppointments(request, undefined, { from: `${date}T00:00:00+07:00`, to: `${date}T23:59:59+07:00`, limit: 100 });
  const rows = await enrich(request, cat, raws);
  const patients: PatientMap = {};
  await Promise.all([...new Set(rows.map((r) => r.patientId))].map(async (id) => { const p = await fetchPatient(request, id); if (p) patients[id] = p; }));
  return { rows, patients };
}

export async function searchDesk(request: Requester, cat: DeskCatalog, query: string) {
  const q = query.trim();
  const compact = q.replace(/[\s.-]/g, '');
  const foundMap = new Map<string, DeskPatient>();

  // 1. Tìm theo Mã lịch hẹn (ví dụ: AT-2026-0014, 2026-0014, 0014, AT-...)
  try {
    const appRaws = await listReceptionAppointments(request, undefined, { limit: 100 });
    const matchedApps = appRaws.filter((a) => {
      const code = String(a.appointmentCode ?? '').toLowerCase();
      const codeDigits = code.replace(/\D/g, '');
      return (
        code.includes(q.toLowerCase()) ||
        (compact.length >= 2 && (code.includes(compact.toLowerCase()) || codeDigits.includes(compact)))
      );
    });
    for (const a of matchedApps) {
      if (a.patientId && !foundMap.has(a.patientId)) {
        const p = await fetchPatient(request, a.patientId);
        if (p) foundMap.set(p.id, p);
      }
    }
  } catch (err) {
    console.error('Lỗi tìm kiếm theo mã lịch:', err);
  }

  // 2. Tìm theo Số điện thoại hoặc CCCD nếu query có chữ số
  if (/^\+?\d{3,12}$/.test(compact)) {
    // Nếu có độ dài từ 8 đến 11 số -> tìm chính xác theo SĐT
    if (compact.length >= 8 && compact.length <= 11) {
      try {
        const phoneParam = compact.startsWith('0')
          ? '+84' + compact.slice(1)
          : (compact.startsWith('+') ? compact : '+84' + compact);
        const rows = await searchReceptionPatients(request, { phoneNumber: phoneParam });
        for (const r of rows) {
          if (r.id && !foundMap.has(r.id)) {
            const p = await fetchPatient(request, r.id);
            if (p) foundMap.set(p.id, p);
          }
        }
      } catch {}
    }

    // Nếu có 9 hoặc 12 số -> tìm theo CCCD/CMND
    if (compact.length === 9 || compact.length === 12) {
      try {
        const rows = await searchReceptionPatients(request, { nationalId: compact });
        for (const r of rows) {
          if (r.id && !foundMap.has(r.id)) {
            const p = await fetchPatient(request, r.id);
            if (p) foundMap.set(p.id, p);
          }
        }
      } catch {}
    }
  }

  // 3. Tìm theo Họ tên bệnh nhân (nếu không phải chỉ là số, hoặc chưa tìm thấy)
  if (!/^\d+$/.test(compact) || foundMap.size === 0) {
    try {
      const rows = await searchReceptionPatients(request, { fullName: q });
      for (const r of rows) {
        if (r.id && !foundMap.has(r.id)) {
          const p = await fetchPatient(request, r.id);
          if (p) foundMap.set(p.id, p);
        }
      }
    } catch {}
  }

  // 4. Tìm kiếm mở rộng (quét qua các bệnh nhân đã có lịch hoặc trong cache)
  // Hỗ trợ trường hợp gõ đuôi SĐT (ví dụ: '4011') hoặc đuôi CCCD (ví dụ: '0106')
  if (foundMap.size === 0 && compact.length >= 3) {
    try {
      const appRaws = await listReceptionAppointments(request, undefined, { limit: 100 });
      const patientIds = [...new Set(appRaws.map((a) => a.patientId).filter((id): id is string => Boolean(id)))];
      for (const pid of patientIds) {
        if (!foundMap.has(pid)) {
          const p = await fetchPatient(request, pid);
          if (p) {
            const pPhone = (p.phone || '').replace(/\D/g, '');
            const pCccd = (p.nationalIdMasked || '').replace(/\D/g, '');
            if (
              (pPhone && pPhone.includes(compact)) ||
              (pCccd && pCccd.includes(compact)) ||
              p.fullName.toLowerCase().includes(q.toLowerCase())
            ) {
              foundMap.set(p.id, p);
            }
          }
        }
      }
    } catch {}
  }

  const found = Array.from(foundMap.values());
  const patients: PatientMap = Object.fromEntries(found.map((p) => [p.id, p]));
  const lists = await Promise.all(
    found.map(async (p) =>
      enrich(request, cat, await listReceptionAppointments(request, p.id, { limit: 50 }).catch(() => []))
    )
  );
  return { found, patients, appointments: lists.flat() };
}

export async function loadPatientWorkspace(
  request: Requester,
  cat: DeskCatalog,
  patientId: string
): Promise<{ found: DeskPatient[]; patients: PatientMap; appointments: DeskAppointment[] }> {
  const patient = await fetchPatient(request, patientId, true);
  if (!patient) return { found: [], patients: {}, appointments: [] };
  const rawAppts = await listReceptionAppointments(request, patient.id, { limit: 50 }).catch(() => []);
  const appointments = await enrich(request, cat, rawAppts);
  return {
    found: [patient],
    patients: { [patient.id]: patient },
    appointments,
  };
}

export interface CheckInResult { awaitingPayment: boolean; ticketCode?: string }
export async function checkInAppointment(request: Requester, a: DeskAppointment): Promise<CheckInResult> {
  const c = await openReceptionCase(request, { appointmentId: a.id, patientId: a.patientId, arrivalAt: new Date().toISOString() }) as { id?: string; data?: { id?: string } };
  const caseId = c?.id ?? c?.data?.id;
  if (!caseId) throw new Error('Không thể mở hồ sơ tiếp nhận.');
  await verifyReceptionIdentity(request, caseId, { method: 'NATIONAL_ID_DOCUMENT', result: 'VERIFIED', verifiedFields: ['fullName', 'phoneNumber', 'nationalId'] });
  const res = await admitReceptionCase(request, caseId) as Record<string, any>;
  const adm = res?.admission ?? res?.data?.admission ?? res;
  return { awaitingPayment: adm?.status === 'AWAITING_PAYMENT', ticketCode: adm?.queueTicketId };
}

export function cancelAppointment(request: Requester, a: DeskAppointment, reason: string) {
  return request(`/api/appointment/appointments/${encodeURIComponent(a.id)}/cancel`, {
    method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify({ reason, expectedVersion: a.version }),
  });
}

export function collectCash(request: Requester, inv: DeskInvoice) {
  return recordReceptionCashPayment(request, { id: inv.id, balanceMinor: inv.balance, totalMinor: inv.total, version: inv.version });
}

export async function refreshAppointment(request: Requester, cat: DeskCatalog, a: DeskAppointment): Promise<DeskAppointment> {
  const raws = await listReceptionAppointments(request, a.patientId, { limit: 50 });
  const raw = raws.find((r) => r.id === a.id);
  return raw ? (await enrich(request, cat, [raw]))[0] : a;
}

export interface WalkInInput {
  patientId?: string;
  fullName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  serviceId: string;
  doctorId: string;
  roomCode?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export async function createWalkInAppointment(request: Requester, input: WalkInInput): Promise<any> {
  let patientId = input.patientId;
  if (!patientId) {
    let phone = (input.phoneNumber || '').trim();
    if (phone.startsWith('0')) phone = '+84' + phone.slice(1);
    const pRes = await request<any>('/api/patients', {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
      body: JSON.stringify({
        fullName: input.fullName?.trim() || 'Bệnh nhân vãng lai',
        phoneNumber: phone,
        dateOfBirth: input.dateOfBirth || '1995-01-01',
        address: input.address?.trim() || 'Hà Nội',
        reason: 'Tiếp nhận bệnh nhân vãng lai tại quầy',
      }),
    });
    patientId = pRes?.data?.id || pRes?.id;
    if (!patientId) throw new Error('Không thể khởi tạo hồ sơ bệnh nhân mới.');
  }

  let startAt: string;
  let endAt: string;

  if (input.date && input.startTime && input.endTime) {
    startAt = new Date(`${input.date}T${input.startTime}:00+07:00`).toISOString();
    endAt = new Date(`${input.date}T${input.endTime}:00+07:00`).toISOString();
  } else {
    const now = new Date();
    startAt = new Date(now.getTime() + 2 * 60000).toISOString();
    endAt = new Date(now.getTime() + 32 * 60000).toISOString();
  }

  const holdRes = await request<any>('/api/appointment/slot-holds', {
    method: 'POST',
    headers: { 'Idempotency-Key': key() },
    body: JSON.stringify({
      patientId,
      serviceId: input.serviceId,
      selectionMode: 'DOCTOR',
      requestedDoctorId: input.doctorId,
      startAt,
      endAt,
    }),
  });
  const holdId = holdRes?.data?.id || holdRes?.id || holdRes?.holdId;
  if (!holdId) throw new Error('Không thể giữ chỗ phòng khám.');

  const apptRes = await request<any>('/api/appointment/appointments', {
    method: 'POST',
    headers: { 'Idempotency-Key': key() },
    body: JSON.stringify({
      holdId,
      channel: 'RECEPTION',
    }),
  });

  const appt = apptRes?.data || apptRes;
  const apptId = appt?.id || appt?.appointmentId;

  // Tự động khởi tạo hồ sơ tiếp nhận để sinh hóa đơn Base Invoice ngay lập tức
  if (apptId && patientId) {
    try {
      const c = (await openReceptionCase(request, {
        appointmentId: apptId,
        patientId,
        arrivalAt: new Date().toISOString(),
      })) as { id?: string; data?: { id?: string } };
      const caseId = c?.id ?? c?.data?.id;
      if (caseId) {
        await verifyReceptionIdentity(request, caseId, {
          method: 'NATIONAL_ID_DOCUMENT',
          result: 'VERIFIED',
          verifiedFields: ['fullName', 'phoneNumber', 'nationalId'],
        });
        await admitReceptionCase(request, caseId);
      }
    } catch (err) {
      console.warn('Tự động khởi tạo hóa đơn tiếp nhận thất bại:', err);
    }
  }

  return appt;
}

export async function payAndCheckInAppointment(
  request: Requester,
  a: DeskAppointment,
  reference?: string
): Promise<{ success: boolean; ticketCode?: string }> {
  let invoice = a.invoice;

  // 1. Nếu chưa có invoice (lịch hẹn tạo trước đó), kích hoạt tạo Base Invoice
  if (!invoice) {
    await checkInAppointment(request, a).catch(() => {});
    const invs = await listReceptionInvoices(request, { appointmentId: a.id }).catch(() => []);
    invoice = toInvoice(invs[0] as Record<string, unknown> | undefined);
  }

  // 2. Ghi nhận thanh toán tiền mặt tại quầy để chuyển sang PAID
  if (invoice && invoice.balance > 0) {
    await recordReceptionCashPayment(request, {
      id: invoice.id,
      balanceMinor: invoice.balance,
      totalMinor: invoice.total,
      version: invoice.version,
    });
  }

  // 3. Tiến hành Check-in chính thức để cấp số thứ tự vào hàng đợi
  const res = await checkInAppointment(request, a);
  return {
    success: true,
    ticketCode: res.ticketCode,
  };
}

export interface UpdatePatientInput {
  patientId: string;
  version: number;
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
  nationalId?: string;
  address?: string;
  emergencyContact?: {
    id?: string;
    fullName: string;
    relationship?: string;
    phoneNumber?: string;
  };
}

export async function updatePatientProfile(
  request: Requester,
  input: UpdatePatientInput
): Promise<DeskPatient> {
  let phone = input.phoneNumber.trim();
  if (phone.startsWith('0')) {
    phone = '+84' + phone.slice(1);
  }

  // 1. Cập nhật thông tin hành chính bệnh nhân
  await request<any>(`/api/patients/${encodeURIComponent(input.patientId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fullName: input.fullName.trim(),
      dateOfBirth: input.dateOfBirth,
      phoneNumber: phone,
      nationalId: input.nationalId?.trim() || null,
      address: input.address?.trim() || null,
      version: input.version,
      reason: 'Cập nhật thông tin hành chính bệnh nhân tại quầy tiếp đón',
    }),
  });

  // 2. Cập nhật hoặc thêm mới người liên hệ khẩn cấp nếu có
  if (input.emergencyContact && input.emergencyContact.fullName.trim()) {
    let cPhone = (input.emergencyContact.phoneNumber || '').trim();
    if (cPhone.startsWith('0')) {
      cPhone = '+84' + cPhone.slice(1);
    }
    const cData = {
      fullName: input.emergencyContact.fullName.trim(),
      relationship: input.emergencyContact.relationship?.trim() || 'Người thân',
      phoneNumber: cPhone || phone,
    };

    if (input.emergencyContact.id) {
      await request<any>(
        `/api/patients/${encodeURIComponent(input.patientId)}/emergency-contacts/${encodeURIComponent(input.emergencyContact.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(cData),
        }
      ).catch((err) => console.warn('Lỗi cập nhật người liên hệ khẩn cấp:', err));
    } else {
      await request<any>(
        `/api/patients/${encodeURIComponent(input.patientId)}/emergency-contacts`,
        {
          method: 'POST',
          body: JSON.stringify({ ...cData, isPrimary: true }),
        }
      ).catch((err) => console.warn('Lỗi thêm người liên hệ khẩn cấp:', err));
    }
  }

  // 3. Xóa cache và tải lại dữ liệu mới nhất
  patientCache.delete(input.patientId);
  const updated = await fetchPatient(request, input.patientId, true);
  if (!updated) throw new Error('Không thể tải lại hồ sơ sau khi cập nhật.');
  return updated;
}

export interface BookableSlot {
  startAt: string;
  endAt: string;
  timeLabel: string;
  roomCode?: string;
}

export async function fetchDoctorBookableSlots(
  request: Requester,
  serviceId: string,
  doctorId: string,
  dateStr: string
): Promise<BookableSlot[]> {
  try {
    const from = `${dateStr}T00:00:00+07:00`;
    const to = `${dateStr}T23:59:59+07:00`;
    const res = await request<any>(
      `/api/appointment/bookable-slots?serviceId=${encodeURIComponent(serviceId)}&selectionMode=DOCTOR&doctorId=${encodeURIComponent(doctorId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=50`
    );
    const items = res?.items || res?.data?.items || [];
    return items.map((it: any) => {
      const s = new Date(it.startAt);
      const e = new Date(it.endAt);
      const sH = String(s.getHours()).padStart(2, '0');
      const sM = String(s.getMinutes()).padStart(2, '0');
      const eH = String(e.getHours()).padStart(2, '0');
      const eM = String(e.getMinutes()).padStart(2, '0');
      return {
        startAt: String(it.startAt),
        endAt: String(it.endAt),
        timeLabel: `${sH}:${sM} - ${eH}:${eM}`,
        roomCode: it.roomCode || it.room?.code,
      };
    });
  } catch (err) {
    console.warn('Lỗi tải bookable-slots, sử dụng slot mặc định:', err);
    return [];
  }
}

export async function fetchDoctorOccupiedSlots(
  request: Requester,
  doctorId: string,
  dateStr: string,
  excludeAppointmentId?: string
): Promise<Set<string>> {
  try {
    const from = `${dateStr}T00:00:00+07:00`;
    const to = `${dateStr}T23:59:59+07:00`;
    const raws = await listReceptionAppointments(request, undefined, { from, to, limit: 100 }).catch(() => []);
    const occupied = new Set<string>();

    for (const r of raws) {
      const a = r as Record<string, unknown>;
      const apptDoctorId = str(a.assignedDoctorId);
      const apptId = String(r.id);
      const status = String(r.status);

      if (
        apptDoctorId === doctorId &&
        apptId !== excludeAppointmentId &&
        ['BOOKED', 'CHECKED_IN', 'IN_CLINICAL_CARE'].includes(status)
      ) {
        if (r.startAt && r.endAt) {
          const s = new Date(r.startAt);
          const e = new Date(r.endAt);
          const sH = String(s.getHours()).padStart(2, '0');
          const sM = String(s.getMinutes()).padStart(2, '0');
          const eH = String(e.getHours()).padStart(2, '0');
          const eM = String(e.getMinutes()).padStart(2, '0');
          occupied.add(`${sH}:${sM} - ${eH}:${eM}`);
        }
      }
    }
    return occupied;
  } catch (err) {
    console.warn('Lỗi kiểm tra occupied slots:', err);
    return new Set<string>();
  }
}

export interface RescheduleAppointmentInput {
  appointment: DeskAppointment;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (e.g. 09:30)
  endTime: string; // HH:mm (e.g. 10:00)
  doctorId: string;
  reason?: string;
}

export async function rescheduleAppointment(
  request: Requester,
  cat: DeskCatalog,
  input: RescheduleAppointmentInput
): Promise<DeskAppointment> {
  const { appointment, date, startTime, endTime, doctorId } = input;
  const reason = input.reason?.trim() || 'Dời lịch khám theo yêu cầu của bệnh nhân tại quầy';

  const startAt = `${date}T${startTime}:00+07:00`;
  const endAt = `${date}T${endTime}:00+07:00`;

  const isSameTime =
    new Date(startAt).getTime() === new Date(appointment.startAt).getTime() &&
    new Date(endAt).getTime() === new Date(appointment.endAt).getTime();
  const isSameDoctor = doctorId === appointment.doctorId;

  if (isSameTime && isSameDoctor) {
    return appointment;
  }

  if (isSameTime && !isSameDoctor) {
    // Chỉ điều phối đổi bác sĩ cùng khung giờ
    await request<any>(`/api/appointment/appointments/${encodeURIComponent(appointment.id)}/reassign`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
      body: JSON.stringify({
        doctorId,
        expectedVersion: appointment.version,
        confirmationEvidence: 'Điều phối lại bác sĩ tiếp nhận tại quầy lễ tân',
        reason,
      }),
    });
  } else {
    // Đổi ngày/giờ khám (và có thể đổi bác sĩ): tạo Slot Hold mới trước rồi reschedule
    const serviceId = appointment.serviceId || cat.services[0]?.id;
    if (!serviceId) throw new Error('Không xác định được dịch vụ y tế của lịch hẹn.');

    const holdRes = await request<any>('/api/appointment/slot-holds', {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
      body: JSON.stringify({
        patientId: appointment.patientId,
        serviceId,
        selectionMode: 'DOCTOR',
        requestedDoctorId: doctorId,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
      }),
    });

    const holdId = holdRes?.data?.id || holdRes?.id || holdRes?.holdId;
    if (!holdId) throw new Error('Không thể giữ chỗ khung giờ khám mới.');

    await request<any>(`/api/appointment/appointments/${encodeURIComponent(appointment.id)}/reschedule`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
      body: JSON.stringify({
        newHoldId: holdId,
        expectedVersion: appointment.version,
        reason,
      }),
    });
  }

  return refreshAppointment(request, cat, appointment);
}

