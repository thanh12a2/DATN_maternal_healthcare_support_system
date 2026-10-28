import { Injectable, OnModuleDestroy } from '@nestjs/common';

export interface QueueRealtimeEvent {
  eventType: string;
  data: {
    journeyId: string;
    ticketId?: string;
    state?: string;
    version?: string;
  };
}

type Subscriber = (event: QueueRealtimeEvent) => void;

@Injectable()
export class QueueRealtimeService implements OnModuleDestroy {
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  subscribe(patientId: string, subscriber: Subscriber): () => void {
    const subscribers = this.subscribers.get(patientId) ?? new Set<Subscriber>();
    subscribers.add(subscriber);
    this.subscribers.set(patientId, subscribers);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) this.subscribers.delete(patientId);
    };
  }

  publish(patientId: string, event: QueueRealtimeEvent): void {
    for (const subscriber of this.subscribers.get(patientId) ?? []) {
      try {
        subscriber(event);
      } catch {
        // Một subscriber lỗi không được làm gián đoạn các kết nối khác.
      }
    }
  }

  onModuleDestroy(): void {
    this.subscribers.clear();
  }
}
