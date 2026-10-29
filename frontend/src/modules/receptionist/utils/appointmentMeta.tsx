import dayjs from 'dayjs';
import type { AppointmentSource, AppointmentStatus, DeskAppointment, PaymentStatus } from '../../../services/receptionDesk';

export const statusMeta: Record<AppointmentStatus, { label: string; color: string }> = {
  BOOKED: { label: 'Chờ tiếp nhận', color: 'gold' },
  CHECKED_IN: { label: 'Đã check-in / Chờ khám', color: 'blue' },
  IN_CLINICAL_CARE: { label: 'Đang khám', color: 'green' },
  COMPLETED: { label: 'Đã hoàn tất', color: 'cyan' },
  CANCELLED: { label: 'Đã hủy', color: 'red' },
  NO_SHOW: { label: 'Không đến', color: 'volcano' },
  REASSIGNMENT_REQUIRED: { label: 'Cần đổi bác sĩ', color: 'orange' },
};
export const sourceMeta: Record<AppointmentSource, { label: string; color: string }> = {
  BOOKED: { label: 'Đặt trước', color: 'geekblue' },
  WALK_IN: { label: 'Vãng lai', color: 'purple' },
};
export const payMeta: Record<PaymentStatus, { label: string; color: string }> = {
  UNPAID: { label: 'Chưa thanh toán', color: 'red' },
  PARTIAL: { label: 'Thanh toán một phần', color: 'orange' },
  PAID: { label: 'Đã thanh toán', color: 'green' },
};
export const channelText = (c: string) => ({ ONLINE: 'Online', RECEPTION: 'Quầy', COUNTER: 'Quầy', HOTLINE: 'Hotline' } as Record<string, string>)[c.toUpperCase()] ?? (c || '—');
export const money = (v: number) => v.toLocaleString('vi-VN') + ' ₫';
export const time = (iso?: string) => (iso ? dayjs(iso).format('HH:mm') : '—');
export const dateTime = (iso?: string) => (iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : '—');
export const age = (dob?: string) => (dob ? dayjs().diff(dayjs(dob), 'year') : undefined);
export const sortByStart = (list: DeskAppointment[], desc = false) =>
  [...list].sort((a, b) => (desc ? -1 : 1) * (dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf()));

