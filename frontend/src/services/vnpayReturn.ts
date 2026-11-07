import type { DeskAppointment, DeskPatient } from './receptionDesk';

export const PENDING_VNPAY_RETURN_KEY = 'billing.vnpay.pending-return';
export const COMPLETED_VNPAY_RETURN_KEY = 'billing.vnpay.completed-return';

export interface VnpayReturnContext {
  txnRef: string;
  returnPath: string;
  invoiceId: string;
  appointment: DeskAppointment;
  patient?: DeskPatient;
  page: {
    room: string;
    date: string;
    status?: string;
    source?: string;
    query: string;
  };
  responseCode?: string;
  completeCheckInAfterPayment?: boolean;
}

export function readVnpayContext(key: string): VnpayReturnContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as VnpayReturnContext;
    return value &&
      typeof value.txnRef === 'string' &&
      typeof value.returnPath === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

export function safeReceptionistReturnPath(value: string): string | null {
  if (
    !value.startsWith('/workspace/receptionist') ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return null;
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin
      ? parsed.pathname + parsed.search + parsed.hash
      : null;
  } catch {
    return null;
  }
}
