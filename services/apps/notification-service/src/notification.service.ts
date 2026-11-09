import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory, RabbitMqConsumer, type DomainEventEnvelope } from '@platform';
import { createHash } from 'node:crypto';
import { AppPrismaService } from './database/prisma.service';
import { EmailDeliveryService } from './email/email-delivery.service';

const titles: Record<string, string> = {
  'appointment.booked.v1': 'Đặt lịch thành công',
  'appointment.cancelled.v1': 'Lịch hẹn đã hủy',
  'appointment.rescheduled.v1': 'Lịch hẹn đã thay đổi',
  'appointment.reassigned.v1': 'Bác sĩ khám đã thay đổi',
  'billing.invoice_issued.v1': 'Hóa đơn mới',
  'billing.payment_recorded.v1': 'Thanh toán đã được xác nhận',
  'billing.payment_rejected.v1': 'Thanh toán chưa được xác nhận',
  'queue.ticket_created.v1': 'Đã check-in và tạo lượt chờ',
  'queue.ticket_called.v1': 'Đã đến lượt của bạn',
  'queue.ticket_requeued.v1': 'Hàng đợi của bạn đã thay đổi',
  'queue.ticket_cancelled.v1': 'Lượt chờ đã được hủy',
  'consultation.assigned.v1': 'Bạn được phân công tư vấn',
};

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private rerun = false;
  constructor(private readonly db: AppPrismaService, private readonly mq: RabbitMqConsumer, private readonly cfg: ConfigService, private readonly grpc: GrpcClientFactory, @Optional() private readonly email?: EmailDeliveryService) {}
  async onModuleInit() {
    if (this.cfg.get('RABBITMQ_URL')) await this.mq.subscribe({ queue: 'maternal.notification.delivery.v1', routingKeys: [...Object.keys(titles), 'medical.encounter_finalized.v1'], requeueOnError: true, handler: e => this.consume(e) });
    this.timer = setInterval(() => void this.flush(), 10000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async consume(e: DomainEventEnvelope) {
    if (e?.eventType === 'medical.encounter_finalized.v1') { await this.email?.enqueueClinical(e); return; }
    const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e?.eventId ?? '');
    const hash = createHash('sha256').update(JSON.stringify(e)).digest('hex');
    const id = validId ? e.eventId : `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
    const eventType = String(e?.eventType ?? 'unknown').slice(0, 120);
    const supported = Boolean(validId && titles[eventType] && e.eventVersion === 1);
    if (supported && eventType === 'billing.payment_recorded.v1') await this.email?.enqueuePayment(e);
    const payload = supported ? e : { eventType, eventVersion: e?.eventVersion ?? null };
    await this.db.notificationPendingEvent.upsert({ where: { eventId: id }, create: { eventId: id, eventType, payload: payload as any, status: supported ? 'PENDING' : 'UNSUPPORTED', lastError: supported ? null : validId ? 'UNSUPPORTED_EVENT' : 'INVALID_EVENT_ID' }, update: {} });
    if (supported) void this.flush();
  }
  async flush() {
    if (this.running) { this.rerun = true; return; }
    this.running = true;
    try {
      const items = await this.db.notificationPendingEvent.findMany({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, orderBy: { receivedAt: 'asc' }, take: 25 });
      if (items.length === 25) this.rerun = true;
      for (const item of items) {
        try {
          const event = item.payload as unknown as DomainEventEnvelope<{ patientId?: string; doctorId?: string; previousDoctorId?: string; expiresAt?: string }>;
          const validUuid = (value?: string) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
          const isAppointment = item.eventType.startsWith('appointment.');
          const isConsultation = item.eventType.startsWith('consultation.');
          const isQueue = item.eventType.startsWith('queue.');
          if (!validUuid(event.aggregateId) || (!isConsultation && !validUuid(event.data?.patientId)) || (isConsultation && !validUuid(event.data?.doctorId))) {
            await this.db.notificationPendingEvent.updateMany({ where: { eventId: item.eventId, status: 'PENDING' }, data: { status: 'FAILED', lastError: 'INVALID_RECIPIENT_OR_RESOURCE' } });
            continue;
          }
          if (item.eventType === 'queue.ticket_called.v1' && (!event.data.expiresAt || !Number.isFinite(Date.parse(event.data.expiresAt)) || new Date(event.data.expiresAt).getTime() <= Date.now())) {
            await this.db.notificationPendingEvent.updateMany({ where: { eventId: item.eventId, status: 'PENDING' }, data: { status: 'SUPPRESSED', lastError: 'CALL_EXPIRED' } });
            continue;
          }
          const recipients: { accountId: string; title: string; body: string }[] = [];
          if (!isConsultation) {
            const client = this.grpc.client({ key: 'notification-patient', target: this.cfg.get<string>('PATIENT_GRPC_TARGET') ?? 'patient-service:6004', proto: 'patient/v1/patient_internal.proto', package: 'maternal.patient.v1', service: 'PatientInternalService' });
            const patient = await this.grpc.unary<any, any>(client, 'resolveNotificationAccount', { patientId: event.data.patientId }, this.grpc.metadata('patient-service', ['patient:notification-account:read']));
            if (patient.found && patient.accountId) recipients.push({ accountId: patient.accountId, title: titles[item.eventType], body: isQueue ? 'Vui lòng theo dõi thông tin hàng đợi tại phòng khám.' : isAppointment ? 'Vui lòng mở lịch hẹn để xem thông tin cập nhật.' : 'Vui lòng liên hệ quầy tiếp nhận để biết chi tiết hóa đơn.' });
          }
          if (isAppointment || isConsultation) {
            const ids = [...new Set([event.data?.doctorId, event.data?.previousDoctorId].filter(validUuid))] as string[];
            for (const doctorId of ids) {
              const client = this.grpc.client({ key: 'notification-doctor', target: this.cfg.get<string>('DOCTOR_GRPC_TARGET') ?? 'doctor-service:6005', proto: 'doctor/v1/doctor_internal.proto', package: 'maternal.doctor.v1', service: 'DoctorInternalService' });
              const doctor = await this.grpc.unary<any, any>(client, 'resolveNotificationAccount', { doctorId }, this.grpc.metadata('doctor-service', ['doctor:notification-account:read']));
              if (doctor.found && doctor.accountId) recipients.push({ accountId: doctor.accountId, title: isConsultation ? titles[item.eventType] : doctorId === event.data.previousDoctorId && doctorId !== event.data.doctorId ? 'Lịch khám không còn được phân công cho bạn' : 'Lịch khám được phân công đã cập nhật', body: isConsultation ? 'Mở mục tư vấn để xem cuộc hội thoại.' : 'Mở lịch khám để xem thông tin mới nhất.' });
            }
          }
          const templateCode = item.eventType.replace(/\./g, '_');
          await this.db.$transaction(async tx => {
            for (const recipient of recipients) await tx.notification.upsert({ where: { sourceEventId_recipientAccountId_templateCode: { sourceEventId: item.eventId, recipientAccountId: recipient.accountId, templateCode } }, create: { sourceEventId: item.eventId, eventType: item.eventType, recipientAccountId: recipient.accountId, templateCode, category: isAppointment ? 'BOOKING' : isQueue ? 'QUEUE' : isConsultation ? 'REASSIGNMENT' : 'PAYMENT', title: recipient.title, body: recipient.body, resourceType: isAppointment ? 'appointment' : isQueue ? 'queue' : isConsultation ? 'consultation' : 'invoice', resourceId: event.aggregateId, deliveries: { create: { channel: 'IN_APP', status: 'DELIVERED' } } }, update: {} });
            await tx.notificationPendingEvent.updateMany({ where: { eventId: item.eventId, status: 'PENDING' }, data: { status: recipients.length ? 'DELIVERED' : 'SUPPRESSED', lastError: recipients.length ? null : 'NO_LINKED_ACCOUNT' } });
          });
        } catch (error) {
          this.logger.warn(`Notification event ${item.eventId} failed: ${error instanceof Error ? error.name : 'unknown'}`);
          const attempts = item.attempts + 1;
          await this.db.notificationPendingEvent.updateMany({ where: { eventId: item.eventId, status: 'PENDING' }, data: { attempts, lastError: 'PROCESSING_FAILED', nextAttemptAt: new Date(Date.now() + Math.min(300000, 10000 * 2 ** Math.min(attempts, 5))) } });
        }
      }
    } catch (error) { this.logger.warn(`Notification worker unavailable: ${error instanceof Error ? error.name : 'unknown'}`); }
    finally { this.running = false; if (this.rerun) { this.rerun = false; void this.flush(); } }
  }
  async status(id?:string,eventId?:string){const n=await this.db.notification.findFirst({where:id?{id}:{sourceEventId:eventId},include:{deliveries:true}});return{deliveries:(n?.deliveries??[]).map(d=>this.view(n!,d))};}
  async list(recipient:string,page=1,size=20){const [items,total]=await Promise.all([this.db.deliveryAttempt.findMany({where:{notification:{recipientAccountId:recipient}},include:{notification:true},skip:(page-1)*size,take:size,orderBy:{attemptedAt:'desc'}}),this.db.deliveryAttempt.count({where:{notification:{recipientAccountId:recipient}}})]);return{deliveries:items.map(x=>this.view(x.notification,x)),page:{page,pageSize:size,totalItems:String(total),totalPages:Math.ceil(total/size)}};}
  private view(n:any,d:any){return{id:d.id,eventId:n.sourceEventId,recipientId:n.recipientAccountId,channel:'DELIVERY_CHANNEL_'+d.channel,status:'DELIVERY_STATUS_'+(d.status==='SENT'?'PROCESSING':d.status),templateCode:n.templateCode,providerMessageId:d.providerMessageId??'',failureCode:d.lastErrorCode??'',attemptCount:d.attempt,createdAt:this.time(n.createdAt),updatedAt:this.time(d.attemptedAt)};}
  private time(d:Date){return{seconds:Math.floor(d.getTime()/1000).toString(),nanos:0};}
}
