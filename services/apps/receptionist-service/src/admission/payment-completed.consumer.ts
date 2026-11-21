import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqConsumer, type DomainEventEnvelope } from '@platform';
import { ReceptionCaseStatus } from '../../../../generated/receptionist-client';
import { PrismaService } from '../database/prisma.service';
import { AdmissionService } from './admission.service';

@Injectable()
export class PaymentCompletedConsumer implements OnModuleInit {
  constructor(private readonly db: PrismaService, private readonly mq: RabbitMqConsumer, private readonly config: ConfigService, private readonly admission: AdmissionService) {}

  async onModuleInit() {
    if (!this.config.get('RABBITMQ_URL')) return;
    await this.mq.subscribe({ queue: 'maternal.reception.payment.v1', routingKeys: ['billing.payment_recorded.v1'], requeueOnError: true, handler: event => this.consume(event) });
  }

  async consume(event: DomainEventEnvelope) {
    if (event.eventType !== 'billing.payment_recorded.v1' || event.eventVersion !== 1) return;
    const data = event.data as { appointmentId?: string; patientId?: string; invoiceId?: string; status?: string };
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (data.status !== 'PAID' || !uuid.test(data.appointmentId ?? '') || !uuid.test(data.patientId ?? '') || !uuid.test(data.invoiceId ?? '')) return;
    const item = await this.db.receptionCase.findFirst({ where: { appointmentId: data.appointmentId, patientId: data.patientId, status: { in: [ReceptionCaseStatus.IDENTITY_VERIFIED, ReceptionCaseStatus.ADMISSION_IN_PROGRESS] } }, include: { admission: true } });
    if (!item) return;
    if (item.workRunningToken) throw new Error('CASE_OPERATION_IN_PROGRESS');
    if (!item.admission || item.admission.invoiceId !== data.invoiceId || item.admission.status === 'COMPLETED') return;
    if (!item.workClaimedBy) throw new Error('CASE_UNASSIGNED');
    await this.admission.admit(item.id, { userId: item.workClaimedBy, role: 'RECEPTIONIST', tokenId: event.eventId });
  }
}
