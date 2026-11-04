/**
 * Trình đọc luồng SSE (Server-Sent Events) siêu nhẹ bằng fetch thuần.
 * Hỗ trợ:
 * - Gửi Header Authorization: Bearer <token> (EventSource chuẩn không hỗ trợ)
 * - Tự động Reconnect khi mất mạng hoặc token hết hạn (401)
 * - Nhận diện thông điệp event/data và bỏ qua heartbeat comment (: ping)
 */

import { getSessionStorageKey } from '../app/AuthSessionProvider';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export function resolveStreamUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  const candidateKeys = [getSessionStorageKey(), 'an-tam-auth-session', 'an-tam-admin-session'];
  for (const key of candidateKeys) {
    for (const storage of [window.sessionStorage, window.localStorage]) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.accessToken) return parsed.accessToken;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export interface RealtimeAppointmentEvent {
  eventType:
    | 'appointment.created'
    | 'appointment.checked_in'
    | 'appointment.clinical_started'
    | 'appointment.completed'
    | 'appointment.cancelled'
    | 'appointment.rescheduled';
  appointmentId: string;
  patientId: string;
  status: string;
  appointmentCode?: string;
  startAt?: string;
  endAt?: string;
  appointmentDate?: string; // YYYY-MM-DD
  assignedDoctorId?: string;
  serviceId?: string;
  serviceName?: string;
  roomCode?: string;
  roomName?: string;
  ticketCode?: string;
  paymentStatus?: 'PAID' | 'UNPAID' | 'PARTIAL';
  updatedAt: string;
}

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export interface SseSubscriptionOptions {
  url: string;
  getToken?: () => string | null | Promise<string | null>;
  streamFn?: (path: string, signal?: AbortSignal) => Promise<Response>;
  onEvent: (event: RealtimeAppointmentEvent) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onReconnectSuccess?: () => void;
}

export function subscribeToRealtimeStream(options: SseSubscriptionOptions): () => void {
  const { url, getToken, streamFn, onEvent, onStatusChange, onReconnectSuccess } = options;
  let isCancelled = false;
  let activeAbortController: AbortController | null = null;
  let hasConnectedBefore = false;
  let retryTimeoutId: any = null;

  async function connect() {
    if (isCancelled) return;

    try {
      onStatusChange?.('CONNECTING');
      activeAbortController = new AbortController();

      let response: Response;

      if (streamFn) {
        response = await streamFn(url, activeAbortController.signal);
      } else {
        const token = await (getToken ? getToken() : getStoredAccessToken());
        if (!token) {
          // Chưa có token đăng nhập, đợi 3s rồi kiểm tra lại
          retryTimeoutId = setTimeout(connect, 3000);
          return;
        }

        const fullUrl = resolveStreamUrl(url);
        response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: activeAbortController.signal,
        });
      }

      if (response.status === 401) {
        // Token hết hạn, chờ kết nối lại sau 2s
        onStatusChange?.('DISCONNECTED');
        retryTimeoutId = setTimeout(connect, 2000);
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !response.body || !contentType.includes('text/event-stream')) {
        throw new Error(
          `SSE stream failed with status ${response.status}, contentType: ${contentType}`
        );
      }

      onStatusChange?.('CONNECTED');
      if (hasConnectedBefore) {
        onReconnectSuccess?.();
      }
      hasConnectedBefore = true;

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      let currentEvent = 'message';
      let currentData = '';

      while (!isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Giữ lại phần chưa kết thúc dòng ở cuối buffer
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith(':')) {
            // Dòng trống hoặc heartbeat ping (: ping / : connected), bỏ qua
            continue;
          }

          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim();
            try {
              const parsed = JSON.parse(currentData);
              if (parsed && typeof parsed === 'object') {
                if (!parsed.eventType && currentEvent) {
                  parsed.eventType = currentEvent;
                }
                onEvent(parsed as RealtimeAppointmentEvent);
              }
            } catch {
              // Bỏ qua gói tin json lỗi
            }
            currentData = '';
            currentEvent = 'message';
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || isCancelled) return;
    } finally {
      if (!isCancelled) {
        onStatusChange?.('DISCONNECTED');
        retryTimeoutId = setTimeout(connect, 3000);
      }
    }
  }

  // Khởi động kết nối
  connect();

  // Trả về hàm hủy đăng ký (unsubscribe)
  return () => {
    isCancelled = true;
    if (retryTimeoutId) clearTimeout(retryTimeoutId);
    if (activeAbortController) activeAbortController.abort();
    onStatusChange?.('DISCONNECTED');
  };
}
