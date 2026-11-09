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

    return () => {
      unsubscribe();
    };
  }, [enabled]);

  return {
    connectionStatus,
    isLive: connectionStatus === 'CONNECTED',
  };
}
