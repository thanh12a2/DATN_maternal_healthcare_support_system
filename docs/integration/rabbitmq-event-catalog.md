# RabbitMQ Domain Event Catalog

> **Status:** APPROVED cho broker, envelope, delivery semantics và ownership; event rows là contract baseline v1. Producer spec vẫn phải định nghĩa payload schema/version cụ thể trước implementation.  
> Broker: RabbitMQ; delivery: at-least-once; publish: transactional outbox; consume: idempotent inbox/deduplication.

## 1. Topology

| Thành phần | Tên | Quy tắc |
|---|---|---|
| Topic exchange chính | maternal.domain.v1 | durable, type=topic, producer publish domain event đã commit |
| Retry exchange | maternal.retry.v1 | durable; dead-letter/TTL theo retry tier |
| Dead-letter exchange | maternal.dlx.v1 | durable, type=topic |
| Queue | maternal.<consumer>.<purpose>.v1 | durable, owner là consumer; một queue không dùng chung cho consumer có lifecycle khác |
| Routing key | <domain>.<aggregate>.<past_tense_event>.v1 | lowercase dot-separated; version ở cuối |
| DLQ routing | dlq.<original-routing-key> | Giữ original headers/envelope |

Không publish trực tiếp vào queue name. Notification/Audit/Reporting có queue riêng và binding riêng. Không dùng auto-delete/exclusive cho business queue.

## 2. Envelope chuẩn

~~~json
{
  "eventId": "uuid",
  "eventType": "appointment.booked.v1",
  "eventVersion": 1,
  "aggregateType": "appointment",
  "aggregateId": "uuid",
  "aggregateVersion": 3,
  "occurredAt": "2026-10-03T12:00:00Z",
  "producer": "appointment-service",
  "correlationId": "uuid",
  "causationId": "uuid",
  "actor": {
    "accountId": "uuid-or-null",
    "role": "PATIENT",
    "service": "appointment-service"
  },
  "data": {}
}
~~~

Bắt buộc:

- eventId UUID duy nhất và ổn định qua republish; eventType khớp routing key.
- occurredAt UTC; aggregateVersion tăng đơn điệu trong aggregate khi owner có version.
- data chỉ chứa minimum necessary identifiers/snapshot. Không token, password, national ID, diagnosis/result detail, message body, payment credential.
- Schema thay đổi compatible giữ v1/eventVersion tăng minor semantics nếu consumer chịu được; breaking payload/routing tạo v2 và chạy song song migration.
- Rabbit headers có content-type=application/json, message-id=eventId, correlation-id và schema/version; không dùng header làm source of truth nghiệp vụ.

## 3. Publish và consume

### Transactional outbox

Producer ghi domain mutation + outbox record trong cùng local DB transaction. Publisher claim record an toàn, publish persistent message, xác nhận publisher confirm rồi đánh dấu sent. Crash có thể publish lặp; không được mất event sau commit. Outbox retry bounded/backoff và alert khi backlog/SLA vượt ngưỡng.

### Idempotent consumer

Consumer transaction ghi inbox/dedup eventId cùng local side effect. Duplicate đã hoàn tất: ack, không lặp side effect. Nếu processing đang dở/crash, redelivery tiếp tục an toàn. Với event có aggregateVersion, consumer không ghi đè projection mới bằng event cũ; gap/out-of-order phải park/retry/reconcile theo consumer spec.

### Ack, retry và DLQ

- Ack chỉ sau local transaction thành công hoặc duplicate được xác nhận.
- Validation/schema/unknown required version: không retry vô hạn; dead-letter và alert.
- Transient DB/network: nack/retry qua retry exchange, không tight requeue loop.
- **DESIGN default:** 10 giây, 1 phút, 5 phút; tối đa 5 attempts tổng cộng rồi DLQ. Consumer spec có thể giảm, không được vô hạn.
- Poison message vào maternal.<consumer>.<purpose>.dlq.v1; replay là thao tác có quyền, có audit, giữ eventId gốc.
- Không log full sensitive payload. Metrics: outbox lag, publish failure, queue depth/age, retry count, DLQ count, consumer latency.

## 4. Catalog sự kiện

### Auth, Patient, Doctor, Catalog

| Routing key / eventType | Owner | Trigger | Payload data tối thiểu | Consumers dự kiến |
|---|---|---|---|---|
| auth.account_status_changed.v1 | Auth | account status/roles thay đổi | accountId, status, roleCodes, authorizationVersion | Profile owners, Audit |
| patient.profile_changed.v1 | Patient | administrative profile/version đổi | patientId, profileVersion, active, profileComplete | Reporting, Audit; consumer khác chỉ khi cần projection |
| doctor.status_changed.v1 | Doctor | doctor active/inactive | doctorId, status, consultationRankCode, version | Appointment, Reporting, Audit |
| doctor.availability_changed.v1 | Doctor | schedule/override commit | doctorId, affectedFrom, affectedTo, availabilityVersion | Appointment, Reporting |
| doctor.consultation_rank_changed.v1 | Doctor | Admin đổi rank | doctorId, oldRankCode, newRankCode, effectiveAt, version | Appointment review, Audit |
| catalog.service_changed.v1 | Catalog | service/bookability/version đổi | serviceId, serviceCode, active, bookable, version | Appointment projection, Reporting |
| catalog.price_changed.v1 | Catalog | base/surcharge effective version đổi | serviceId hoặc rankCode, effectiveAt, priceVersion | Appointment cache invalidation, Reporting |

### Appointment và Reception

| Routing key / eventType | Owner | Trigger | Payload data tối thiểu | Consumers dự kiến |
|---|---|---|---|---|
| appointment.booked.v1 | Appointment | booking commit | appointmentId, appointmentCode, patientId, serviceId, doctorId nullable, selectedRankCode, startAt, channel | Notification, Reporting, Audit |
| appointment.reassignment_required.v1 | Appointment | selected doctor unavailable | appointmentId, patientId, previousDoctorId, requiredRankCode, respondBy | Notification, Reception projection, Audit |
| appointment.reassigned.v1 | Appointment | reassignment confirmed/auto rank rule | appointmentId, oldDoctorId, newDoctorId, rankCode, effectivePriceDisposition | Notification, Reporting, Audit |
| appointment.rescheduled.v1 | Appointment | staff reschedule commit | appointmentId, previousStartAt, newStartAt, actorAccountId, reasonCode | Notification, Reporting, Audit |
| appointment.cancelled.v1 | Appointment | Receptionist/Admin cancel | appointmentId, patientId, actorAccountId, reasonCode | Notification, Reporting, Audit |
| appointment.checked_in.v1 | Appointment | admission check-in | appointmentId, patientId, checkedInAt, late | Queue projection only if approved, Reporting, Audit |
| appointment.no_show.v1 | Appointment | grace elapsed without check-in | appointmentId, patientId, markedAt | Notification if policy, Reporting, Audit |
| appointment.completed.v1 | Appointment | clinical completion applied | appointmentId, patientId, completedAt | Billing/Reporting/Notification per policy |
| reception.case_opened.v1 | Receptionist | ReceptionCase opened | receptionCaseId, appointmentId, patientId | Audit, Reporting |
| reception.admission_completed.v1 | Receptionist | all canonical steps checkpointed | receptionCaseId, appointmentId, encounterId, queueJourneyId | Reporting, Audit |
| reception.admission_manual_review_required.v1 | Receptionist | ambiguous/permanent step failure | receptionCaseId, failedStep, errorReason | Ops/Audit; không chứa raw error/PII |

### Billing

| Routing key / eventType | Owner | Trigger | Payload data tối thiểu | Consumers dự kiến |
|---|---|---|---|---|
| billing.invoice_issued.v1 | Billing | base/supplementary invoice issued | invoiceId, appointmentId, patientId, invoiceKind, amountMinor, currency | Notification, Reporting, Audit |
| billing.payment_recorded.v1 | Billing | đúng một payment commit | paymentId, invoiceId, appointmentId, method, amountMinor, paidAt | Reception clearance projection, Notification, Reporting, Audit |
| billing.credit_approved.v1 | Billing | authorized credit approval | invoiceId, appointmentId, approvalId, approvedAt | Reception, Notification, Reporting, Audit |
| billing.invoice_voided.v1 | Billing | unpaid invoice voided | invoiceId, appointmentId, reasonCode | Reporting, Audit |
| billing.outstanding_changed.v1 | Billing | supplementary amount due đổi | invoiceId, appointmentId, amountDueMinor, dueStatus | Notification, Reporting |

Không có event refund vì refund ngoài scope và bị cấm. Payment event không chứa bank account detail hay credential.

### Medical, Document, Prescription, Treatment Plan

| Routing key / eventType | Owner | Trigger | Payload data tối thiểu | Consumers dự kiến |
|---|---|---|---|---|
| medical.encounter_opened.v1 | Medical Record | Encounter DRAFT được open/get lần đầu | encounterId, appointmentId, patientId, assignedDoctorId | Audit, Reporting |
| medical.service_order_created.v1 | Medical Record | doctor tạo order | serviceOrderId, encounterId, serviceId, targetStageCode | Queue/Document as needed, Reporting |
| medical.service_order_performed.v1 | Medical Record | service thực sự PERFORMED | serviceOrderId, encounterId, appointmentId, serviceId, performedAt | Billing, Reporting, Audit |
| medical.result_released.v1 | Medical Record | result được release cho patient | resultId, encounterId, patientId, releasedAt | Notification; không có result detail |
| medical.encounter_finalized.v1 | Medical Record | Encounter FINALIZED | encounterId, appointmentId, patientId, finalizedAt, version | Appointment, Billing assessment, Reporting, Audit |
| medical.encounter_amended.v1 | Medical Record | amendment append sau finalize | encounterId, amendmentId, amendedAt, actorAccountId | Reporting, Audit |
| document.upload_completed.v1 | Document | immutable object version stored | documentId, versionId, ownerContextType, ownerContextId, scanStatus | Scanner workflow, Audit |
| document.scan_completed.v1 | Document | scan clean | documentId, versionId, scanStatus=CLEAN | Linking owner, Audit |
| document.scan_failed.v1 | Document | infected/error | documentId, versionId, scanStatus, reasonCode | Linking owner, Ops, Audit |
| prescription.issued.v1 | Prescription | DRAFT→ISSUED | prescriptionId, encounterId, patientId, issuedAt | Medical projection, Notification, Reporting, Audit |
| prescription.cancelled.v1 | Prescription | ISSUED/DRAFT→CANCELLED theo spec | prescriptionId, encounterId, reasonCode, cancelledAt | Medical projection, Notification, Audit |
| treatment_plan.changed.v1 | Treatment Plan | state transition commit | treatmentPlanId, encounterId, patientId, oldStatus, newStatus, changedAt | Medical projection, Notification if applicable, Reporting, Audit |

### Queue, Consultation và cross-cutting

| Routing key / eventType | Owner | Trigger | Payload data tối thiểu | Consumers dự kiến |
|---|---|---|---|---|
| queue.ticket_created.v1 | Queue | stage ticket authoritative created | queueJourneyId, ticketId, appointmentId, stageCode, ticketNumber, late | Notification optional, Reporting, Audit |
| queue.ticket_called.v1 | Queue | call attempt | ticketId, appointmentId, stageCode, roomCode, callAttempt, calledAt | Notification, display adapter, Reporting |
| queue.ticket_skipped.v1 | Queue | 2 calls/timeout → SKIPPED | ticketId, appointmentId, skippedAt, callAttempts | Notification, Reporting, Audit |
| queue.ticket_requeued.v1 | Queue | authorized requeue | ticketId, reasonCode, actorAccountId, requeuedAt | Reporting, Audit |
| queue.journey_completed.v1 | Queue | all stages terminal/completed | queueJourneyId, appointmentId, completedAt | Reporting |
| consultation.message_sent.v1 | Consultation | message commit | threadId, messageId, senderType, recipientAccountId, sentAt | Notification, Audit metadata; không body |
| consultation.thread_closed.v1 | Consultation | close thread | threadId, patientId, doctorId, closedAt, reasonCode | Reporting, Audit |
| notification.delivery_status_changed.v1 | Notification | delivery attempt terminal/status change | notificationId, channel, status, templateCode, occurredAt | Reporting, Audit |
| reporting.export_completed.v1 | Reporting | CSV export ready/failed | exportId, requesterAccountId, status, expiresAt | Notification, Audit |

Audit Log chủ yếu là consumer. Nếu phát audit.ingested.v1 thì event đó chỉ phục vụ vận hành, không được tạo vòng lặp tự consume.

## 5. Ownership và privacy rules

- Chỉ aggregate owner phát fact về state của aggregate. Consumer không republish cùng eventType như thể là owner.
- Event là fact quá khứ, không phải command. Consumer không được suy diễn mutation owner nếu chưa có rule/command rõ.
- Notification template resolve contact qua projection/authorized lookup; event không mang email/phone/PHI nếu chỉ cần IDs.
- Reporting projection có classification/retention riêng; CSV private, TTL và audit download.
- Event rename/version/deprecation cần consumer inventory, dual-publish hoặc compatibility window và rollback plan.

## 6. Acceptance

- Broker down sau domain commit: API core có thể success, outbox pending và publish khi phục hồi.
- Duplicate delivery không tạo duplicate notification/payment/projection/audit effect.
- Out-of-order không hạ aggregateVersion projection.
- Poison event vào đúng DLQ sau bounded retries và phát alert.
- Replay giữ eventId/correlation, có authorization/reason/audit.
- Contract tests validate routing key, envelope, required fields và absence của secret/PHI chi tiết.
