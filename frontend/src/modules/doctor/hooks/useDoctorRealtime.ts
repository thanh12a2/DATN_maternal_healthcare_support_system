import { useEffect, useRef, useState } from 'react';
import { notification } from 'antd';
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
  selectedDateStr,
  patientMap = {},
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
  const dateStrRef = useRef(selectedDateStr);
  const patientMapRef = useRef(patientMap);
  const onCheckedInRef = useRef(onPatientCheckedIn);
  const onUpdateRef = useRef(onAppointmentUpdate);
  const onRefetchRef = useRef(onRefetch);

  doctorIdRef.current = doctorId;
  roomCodeRef.current = roomCode;
  dateStrRef.current = selectedDateStr;
  patientMapRef.current = patientMap;
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
          // Bệnh nhân vừa check-in tại quầy tiếp đón
          const pInfo = patientMapRef.current[event.patientId] || {
            name: 'Bệnh nhân',
            phone: '',
          };
          const patientName = pInfo.name || 'Bệnh nhân';
          const roomDisplay = event.roomCode || myRoomCode || '';

          // 1. Kích hoạt cập nhật bảng hàng đợi tức thì
          onCheckedInRef.current?.(event);

          // 2. Hiển thị thông báo góc trên bên phải
          notification.info({
            message: '🔔 Bệnh nhân mới vào hàng đợi',
            description: `Bệnh nhân ${patientName} (Mã hẹn: ${event.appointmentCode || '...'}) vừa check-in sẵn sàng vào khám${roomDisplay ? ` tại phòng ${roomDisplay}` : ''}.`,
            placement: 'topRight',
            duration: 5,
          });
        } else if (event.eventType === 'appointment.cancelled') {
          onUpdateRef.current?.(event);
          const pInfo = patientMapRef.current[event.patientId] || {
            name: 'Bệnh nhân',
            phone: '',
          };
          notification.warning({
            message: '⚠️ Lịch hẹn đã hủy',
            description: `Lịch hẹn của bệnh nhân ${pInfo.name || 'bệnh nhân'} (Mã: ${event.appointmentCode || ''}) đã bị hủy.`,
            placement: 'topRight',
            duration: 4.5,
          });
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
