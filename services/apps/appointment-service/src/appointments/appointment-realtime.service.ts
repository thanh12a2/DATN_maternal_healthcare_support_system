import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface AppointmentRealtimeEvent {
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
  appointmentDate?: string; // YYYY-MM-DD (Asia/Ho_Chi_Minh) cho bộ lọc ngày của Lễ tân
  assignedDoctorId?: string;
  serviceId?: string;
  serviceName?: string;
  roomCode?: string;
  roomName?: string;
  ticketCode?: string;
  paymentStatus?: 'PAID' | 'UNPAID' | 'PARTIAL';
  updatedAt: string;
}

export type AppointmentSubscriber = (event: AppointmentRealtimeEvent) => void;

@Injectable()
export class AppointmentRealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(AppointmentRealtimeService.name);
  private readonly deskSubscribers = new Set<AppointmentSubscriber>();
  private readonly patientSubscribers = new Map<
    string,
    Set<AppointmentSubscriber>
  >();

  subscribeDesk(subscriber: AppointmentSubscriber): () => void {
    this.deskSubscribers.add(subscriber);
    return () => {
      this.deskSubscribers.delete(subscriber);
    };
  }

  subscribePatient(
    patientId: string,
    subscriber: AppointmentSubscriber,
  ): () => void {
    const list =
      this.patientSubscribers.get(patientId) ??
      new Set<AppointmentSubscriber>();
    list.add(subscriber);
    this.patientSubscribers.set(patientId, list);
    return () => {
      list.delete(subscriber);
      if (list.size === 0) {
        this.patientSubscribers.delete(patientId);
      }
    };
  }

  publish(event: AppointmentRealtimeEvent): void {
    // 1. Gửi cho tất cả subscriber của Bàn Lễ tân
    for (const sub of this.deskSubscribers) {
      try {
        sub(event);
      } catch (err) {
        this.logger.warn('Desk subscriber notification failed', err);
      }
    }

    // 2. Gửi cho Bệnh nhân tương ứng
    if (event.patientId) {
      const pSubs = this.patientSubscribers.get(event.patientId);
      if (pSubs) {
        for (const sub of pSubs) {
          try {
            sub(event);
          } catch (err) {
            this.logger.warn('Patient subscriber notification failed', err);
          }
        }
      }
    }
  }

  onModuleDestroy(): void {
    this.deskSubscribers.clear();
    this.patientSubscribers.clear();
  }
}
