import { useEffect, useRef, useState } from 'react';
import {
  getStoredAccessToken,
  subscribeToRealtimeStream,
  type ConnectionStatus,
  type RealtimeAppointmentEvent,
} from '../../../services/realtimeStream';

export interface UseDoctorRealtimeProps {
  doctorId?: string;
  roomCode?: string;
  selectedDateStr: string;
  patientMap?: Record<string, { name: string; phone: string }>;
  onPatientCheckedIn?: (event: RealtimeAppointmentEvent) => void;
  onAppointmentUpdate?: (event: RealtimeAppointmentEvent) => void;
  onRefetch?: () => void;
  enabled?: boolean;
  streamFn?: (path: string, signal?: AbortSignal) => Promise<Response>;
}

export function useDoctorRealtime({
  doctorId,
  roomCode,
  onPatientCheckedIn,
  onAppointmentUpdate,
  onRefetch,
  enabled = true,
  streamFn,
}: UseDoctorRealtimeProps) {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('DISCONNECTED');

  const doctorIdRef = useRef(doctorId);
  const roomCodeRef = useRef(roomCode);
  const onCheckedInRef = useRef(onPatientCheckedIn);
  const onUpdateRef = useRef(onAppointmentUpdate);
  const onRefetchRef = useRef(onRefetch);

  doctorIdRef.current = doctorId;
  roomCodeRef.current = roomCode;
  onCheckedInRef.current = onPatientCheckedIn;
  onUpdateRef.current = onAppointmentUpdate;
  onRefetchRef.current = onRefetch;

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
        const myDoctorId = doctorIdRef.current;
        const myRoomCode = roomCodeRef.current;

        // Xác định lịch hẹn có thuộc về bác sĩ hoặc phòng trực này không
        const isDoctorMatch =
          !event.assignedDoctorId ||
          !myDoctorId ||
          event.assignedDoctorId === myDoctorId;
        const isRoomMatch =
          !event.roomCode || !myRoomCode || event.roomCode === myRoomCode;
        const isRelevant = isDoctorMatch || isRoomMatch;

        if (!isRelevant) {
          return;
        }

        if (event.eventType === 'appointment.checked_in') {
          // Check-in precedes ticket creation; it is not yet a queue notification.
          onCheckedInRef.current?.(event);
        } else if (event.eventType === 'appointment.cancelled') {
          onUpdateRef.current?.(event);
        } else {
          // Các trạng thái khác (clinical_started, completed, rescheduled)
          onUpdateRef.current?.(event);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, streamFn]);

  return {
    connectionStatus,
    isLive: connectionStatus === 'CONNECTED',
  };
}
