import dayjs from 'dayjs';

export function extractList<T = Record<string, unknown>>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const value = raw as { items?: unknown; data?: unknown } | null;
  if (Array.isArray(value?.items)) return value.items as T[];
  if (Array.isArray(value?.data)) return value.data as T[];
  if (value?.data && typeof value.data === 'object') return extractList<T>(value.data);
  return [];
}

export function formatDateTime(value: unknown): string {
  if (!value || (typeof value !== 'string' && typeof value !== 'number')) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : String(value);
}

export function formatDate(value: unknown): string {
  if (!value || (typeof value !== 'string' && typeof value !== 'number')) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : String(value);
}

export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const clean = String(phone).trim();
  if (clean.startsWith('+84')) {
    return '0' + clean.slice(3);
  }
  if (clean.startsWith('84') && clean.length > 9) {
    return '0' + clean.slice(2);
  }
  return clean;
}

/** Các API trả tiền theo đơn vị nhỏ nhất (minor). VND không có phần thập phân. */
export function formatMoneyMinor(value: unknown, currency = 'VND'): string {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export type TagColor = 'success' | 'processing' | 'warning' | 'error' | 'default';

const STATUS_COLORS: Array<[RegExp, TagColor]> = [
  [/\b(DRAFT)\b/i, 'default'],
  [/\b(INACTIVE|LOCKED|PENDING|WAITING|HELD|SCHEDULED|REQUESTED|UNPAID)\b/i, 'warning'],
  [/\b(PENDING_VERIFICATION|IN_PROGRESS|STARTED|CALLED|SERVING|PARTIAL|BOOKED)\b/i, 'processing'],
  [/\b(ACTIVE|COMPLETED|PAID|ISSUED|CONFIRMED|VERIFIED|FINALIZED|DONE|READY|OPEN|AVAILABLE|CHECKED_IN)\b/i, 'success'],
  [/\b(CANCEL|CANCELLED|CANCELED|REJECT|REJECTED|FAIL|FAILED|EXPIRED|NO_SHOW|VOID|CLOSED|DISABLED)\b/i, 'error'],
];

export function statusColor(status: unknown): TagColor {
  const value = String(status ?? '');
  return STATUS_COLORS.find(([pattern]) => pattern.test(value))?.[1] ?? 'default';
}

const REPORT_LABELS: Record<string, string> = {
  totalAppointments: 'Tổng lịch hẹn',
  completedAppointments: 'Lịch hẹn hoàn thành',
  cancelledAppointments: 'Lịch hẹn đã hủy',
  totalRevenue: 'Tổng doanh thu',
  totalCollectedAmount: 'Tổng đã thu',
  totalPatients: 'Tổng bệnh nhân',
  totalInvoices: 'Tổng hóa đơn',
  paidInvoices: 'Hóa đơn đã thanh toán',
  date: 'Ngày', total: 'Tổng', cancelled: 'Đã hủy', completed: 'Hoàn thành', collected: 'Đã thu', transactions: 'Giao dịch', refunded: 'Đã hoàn', pending: 'Chờ xử lý',
};

/** Chuyển key camelCase thành nhãn dễ đọc (ưu tiên nhãn tiếng Việt đã biết). */
export function humanizeKey(key: string): string {
  if (REPORT_LABELS[key]) return REPORT_LABELS[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
