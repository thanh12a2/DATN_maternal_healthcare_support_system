import { useEffect, useRef, useState } from 'react';
import { notification } from 'antd';
import {
  getStoredAccessToken,
  subscribeToRealtimeStream,
  type ConnectionStatus,
  type RealtimeAppointmentEvent,
} from '../../../services/realtimeStream';

export interface UseReceptionRealtimeProps {
  selectedDateStr: string;
  onNewAppointment?: (event: RealtimeAppointmentEvent) => void;
  onAppointmentUpdate?: (event: RealtimeAppointmentEvent) => void;
  onRefetch?: () => void;
  enabled?: boolean;
  streamFn?: (path: string, signal?: AbortSignal) => Promise<Response>;
}

export function useReceptionRealtime({
  selectedDateStr,
  onNewAppointment,
  onAppointmentUpdate,
  onRefetch,
  enabled = true,
  streamFn,
}: UseReceptionRealtimeProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const onNewRef = useRef(onNewAppointment);
  const onUpdateRef = useRef(onAppointmentUpdate);
  const onRefetchRef = useRef(onRefetch);
  const dateStrRef = useRef(selectedDateStr);

  onNewRef.current = onNewAppointment;
  onUpdateRef.current = onAppointmentUpdate;
  onRefetchRef.current = onRefetch;
  dateStrRef.current = selectedDateStr;

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribeToRealtimeStream({
      url: '/api/appointment/desk/stream',
      getToken: getStoredAccessToken,
      streamFn,
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
      onReconnectSuccess: () => {
        // Refetch 1 lần khi kết nối lại thành công sau khi rớt mạng
        onRefetchRef.current?.();
      },
      onEvent: (event) => {
        const currentDate = dateStrRef.current;
        const eventDate =
          event.appointmentDate ||
          (event.startAt ? new Date(event.startAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');

        if (event.eventType === 'appointment.created') {
          const timeDisplay = event.startAt
            ? new Date(event.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            : '';

          // 1. Nếu lịch hẹn thuộc đúng ngày đang xem -> chèn vào bảng bàn tiếp đón
          if (eventDate === currentDate) {
            onNewRef.current?.(event);
            notification.info({
              message: '🔔 Lịch hẹn mới vừa đặt',
              description: `Mã: ${event.appointmentCode || 'Mới'} · ${event.serviceName || 'Dịch vụ'} (${timeDisplay})`,
              placement: 'topRight',
              duration: 4.5,
            });
          } else {
            // Khác ngày -> chỉ báo Toast thông báo, không chèn vào bảng hôm nay để tránh lẫn dữ liệu
            notification.info({
              message: '🔔 Có lịch hẹn mới đặt',
              description: `Ngày ${eventDate} · Mã: ${event.appointmentCode || 'Mới'} (${timeDisplay})`,
              placement: 'topRight',
              duration: 4,
            });
          }
        } else {
          // Các trạng thái cập nhật (checked_in, clinical_started, completed, cancelled, rescheduled)
          onUpdateRef.current?.(event);
        }
      },
    });

    // Lắng nghe khi tab active trở lại (visibilitychange & focus) -> Refetch 1 lần
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        onRefetchRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [enabled]);

  return {
    connectionStatus,
    isLive: connectionStatus === 'CONNECTED',
  };
}

