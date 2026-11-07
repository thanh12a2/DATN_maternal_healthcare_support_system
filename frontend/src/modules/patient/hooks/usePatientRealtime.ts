import { useEffect, useRef, useState } from 'react';
import {
  getStoredAccessToken,
  subscribeToRealtimeStream,
  type ConnectionStatus,
  type RealtimeAppointmentEvent,
} from '../../../services/realtimeStream';

export interface UsePatientRealtimeProps {
  onAppointmentEvent?: (event: RealtimeAppointmentEvent) => void;
  onRefetch?: () => void;
  enabled?: boolean;
  streamFn?: (path: string, signal?: AbortSignal) => Promise<Response>;
}

export function usePatientRealtime({
  onAppointmentEvent,
  onRefetch,
  enabled = true,
  streamFn,
}: UsePatientRealtimeProps) {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('DISCONNECTED');
  const onEventRef = useRef(onAppointmentEvent);
  const onRefetchRef = useRef(onRefetch);

  onEventRef.current = onAppointmentEvent;
  onRefetchRef.current = onRefetch;

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribeToRealtimeStream({
      url: '/api/appointment/me/stream',
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
        onEventRef.current?.(event);
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
