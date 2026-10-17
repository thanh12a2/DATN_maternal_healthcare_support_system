
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Queue Service — Service Specification

> **Status:** DESIGN — implementation-ready; business decisions are **Approved**, detailed contracts are **DESIGN**.  
> **Public contract:** ../api-specs/queue-service.yaml  
> **Internal contract:** ../grpc/queue/v1/queue_internal.proto  
> UTC storage; Asia/Ho_Chi_Minh business day; UUID IDs; own database only.

---

## 1. Tổng quan và boundary

Queue Service là source of truth cho QueueJourney, ticket/ordinal, priority, position và trạng thái chờ thực tế sau payment/approved-credit + Appointment check-in.

### Chịu trách nhiệm

- Create/get một QueueJourney idempotently sau admission check-in.
- Tạo StageTicket theo từng stage/phòng; cấp ordinal authoritative theo stage + business date.
- Chọn ticket ở server trong CallNext; manual override chỉ với permission + reason.
- WAITING/CALLED/IN_SERVICE/COMPLETED/SKIPPED/CANCELLED; call timeout 5 phút, tối đa 2 lần.
- Late >30 phút vẫn nhận nhưng demote; expose estimate không cam kết tuyệt đối.
- Routing nhiều stage; event queue call/state cho Notification/domain consumers.

### Không chịu trách nhiệm

- Appointment booking/code/queue estimate trước admission; Appointment không được tạo QueueTicket authoritative.
- Payment/credit (Billing), check-in/no-show state (Appointment), ReceptionCase (Reception), encounter/order (Medical), room catalog/staff HR, notification delivery.
- Không quyết định refund, clinical urgency diagnosis hoặc sửa DB service khác.

### References

appointmentId (Appointment), patientId (Patient), receptionCaseId (Reception), encounterId/orderId (Medical) là external IDs; không cross-DB FK. Queue giữ minimum display snapshot (masked patient label) khi cần bảng gọi.

---

## 2. Actors và authorization

| Actor/consumer | Permission | Resource rule |
|---|---|---|
| PATIENT | queue:read:own | patientId resolve từ JWT sub; không thấy danh tính người khác |
| RECEPTIONIST | queue:read, queue:route, queue:override | active staff; override/requeue/cancel cần reason |
| DOCTOR/CLINICAL_STAFF | queue:call, queue:serve, queue:read:stage | chỉ stage/room được phân công |
| ADMIN | queue:manage, queue:override | reason + audit; không mặc định sửa ticket terminal |
| Reception Service | CreateOrGetJourney | service JWT; admission case và check-in evidence |
| Medical Record Service | EnqueueStage/GetJourney | order/encounter context; không tự cấp ordinal |
| Notification/Audit/Reporting | event only | không callback/sửa queue |

Service verify JWT RS256 và service JWT audience. Kong không thay resource-level authorization. Client không được gửi priority/ordinal/position/callCount/server timestamps.

---

## 3. Domain và data model

### QueueJourney

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| appointmentId | UUID | UNIQUE, immutable |
| patientId/receptionCaseId/encounterId | UUID | external refs; encounterId unique khi present |
| businessDate | date | derived Asia/Ho_Chi_Minh at admission |
| arrivalAt/scheduledAt/checkedInAt | timestamptz | evidence snapshot |
| lateMinutes | int | max(0,floor(arrivalAt-scheduledAt)); >=0 |
| latenessClass | ON_TIME|LATE_DEMOTED | LATE_DEMOTED iff >30 |
| state | ACTIVE|COMPLETED|CANCELLED | derived/transitioned |
| version/createdAt/updatedAt | int/timestamptz | optimistic lock |

### QueueStage

id UUID, code UNIQUE uppercase 2..50, name 2..100, stageType CONSULTATION|LAB|IMAGING|PROCEDURE|REVIEW|OTHER, active, defaultCallTimeoutSeconds=300, displayMaskPolicy. Configuration is local routing topology, not medical catalog or room HR.

### StageTicket

| Field | Type | Constraint |
|---|---|---|
| id/journeyId/stageId | UUID | local refs |
| sourceOrderId | UUID/null | external Medical order; uniqueness when present |
| businessDate | date | journey date |
| ordinal | int | >0; UNIQUE(stageId,businessDate,ordinal) |
| ticketCode | string | generated; UNIQUE(stageId,businessDate,ticketCode) |
| state | enum | WAITING default |
| basePriority | ROUTINE|URGENT | URGENT chỉ qua authorized clinical command; ROUTINE không phải booking type NORMAL |
| lateDemotion | bool | from Journey; cannot be client-set |
| enqueueSequence | bigint | monotonic tie-breaker |
| callCount | int | 0..2 |
| calledAt/callExpiresAt/serviceStartedAt/completedAt | timestamptz/null | transition-managed |
| roomCode | string/null | max 50, routing/display only |
| version/createdAt/updatedAt | int/timestamptz | optimistic lock |

CallAttempt: id, ticketId, attemptNumber 1..2 UNIQUE/ticket, calledAt, expiresAt=calledAt+300s, outcome ANSWERED|ABSENT_TIMEOUT|CANCELLED, callerAccountId, roomCode.

PriorityOverride: id,ticketId,action CALL_OUT_OF_ORDER|REQUEUE|URGENT|CANCEL, actorId, reason 10..500, old/new rank metadata, createdAt; append-only.

Technical: DailySequence(stageId,businessDate,nextOrdinal) UNIQUE and row-locked; IdempotencyRecord; OutboxEvent; ConsumedEvent.

Indexes: Ticket(stageId,state,basePriority,lateDemotion,enqueueSequence), Ticket(journeyId,createdAt), Ticket(callExpiresAt) WHERE state=CALLED, Journey(patientId,createdAt DESC), Journey(state,updatedAt). Local FK only.

### Selection order

CallNext lựa chọn trong một DB transaction/row lock:

1. state WAITING và stage active;
2. basePriority URGENT trước ROUTINE;
3. trong cùng priority, lateDemotion=false trước true;
4. enqueueSequence tăng dần;
5. id tăng dần để deterministic.

Position/estimate là computed snapshot, không lưu như invariant. Estimate = số ticket đủ điều kiện phía trước × moving average service duration; nullable nếu thiếu sample, không phải SLA.

### State machines

~~~text
WAITING --CallNext/override--> CALLED
CALLED --start service before expiry--> IN_SERVICE
CALLED --timeout attempt 1--> WAITING (demote behind current same class)
CALLED --timeout attempt 2--> SKIPPED
IN_SERVICE --complete--> COMPLETED
WAITING|CALLED --authorized cancel--> CANCELLED
SKIPPED --authorized requeue+reason--> WAITING (new enqueueSequence, callCount retained unless admin reset explicitly forbidden in MVP)
~~~

Journey COMPLETED khi mọi ticket terminal và không còn stage pending; thêm stage mới khi completed sẽ reactivate trong transaction. Invalid transition 409/no event.

---

## 4. Contracts

### REST qua Kong

Base path /api/queue.

| ID | Method/path | Mục đích |
|---|---|---|
| QUE-001/002 | GET /health,/ready | probes |
| QUE-003 | GET /me/journeys/active | patient own active journey |
| QUE-004 | GET /journeys/{id} | own/authorized staff view |
| QUE-005 | GET /stages | active stages |
| QUE-006 | GET /stages/{id}/tickets | staff stage board, cursor pagination |
| QUE-007 | POST /stages/{id}/call-next | server selection hoặc overrideTicketId+reason |
| QUE-008 | POST /tickets/{id}/start | acknowledge उपस्थित/start service |
| QUE-009 | POST /tickets/{id}/complete | complete stage |
| QUE-010 | POST /tickets/{id}/requeue | SKIPPED → WAITING, reason |
| QUE-011 | POST /tickets/{id}/cancel | authorized cancellation, reason |

Mọi command yêu cầu Idempotency-Key UUID và expectedVersion khi target đã có. CallNext không nhận priority sort/order từ client; overrideTicketId đòi queue:override và reason. API không public-create ticket.

### gRPC nội bộ

| Method | Caller | Quy tắc |
|---|---|---|
| CreateOrGetJourney | Reception | chỉ sau check-in; unique appointment; tạo initial stage ticket atomically |
| EnqueueStage | Medical/Reception orchestrator | unique sourceOrderId hoặc idempotency key; stageCode active |
| GetJourney | Reception/Medical | minimum summary |
| CancelWaitingTickets | Appointment/Reception authorized process | reason; không hủy IN_SERVICE/COMPLETED |

Direct gRPC, service JWT RS256, deadline DESIGN 2s read/3s write, correlation metadata. Stable idempotency key và query/get outcome sau timeout; không REST nội bộ/Kong, không DB fallback.

---

## 5. Business rules

| ID | Quy tắc | Error |
|---|---|---|
| Q-BR-001 | Không Journey/ticket trước Billing paid/approved-credit và Appointment checked-in evidence | ADMISSION_NOT_READY |
| Q-BR-002 | Một Journey/appointment; retry trả cùng aggregate | idempotent/DB unique |
| Q-BR-003 | Ordinal/ticketCode chỉ Queue cấp per stage/businessDate | SERVER_MANAGED_FIELD |
| Q-BR-004 | lateMinutes >30 (strict) demote; đúng 30 không demote; vẫn tiếp nhận | — |
| Q-BR-005 | Appointment no-show do Appointment xác định theo grace; no-show không được create journey | APPOINTMENT_NO_SHOW |
| Q-BR-006 | CallNext chọn server-side theo selection order, concurrency-safe | NO_WAITING_TICKET/409 race retry |
| Q-BR-007 | Manual out-of-order cần queue:override + reason; luôn audit | OVERRIDE_REASON_REQUIRED |
| Q-BR-008 | Mỗi call giữ 5 phút; timeout lần 1 requeue, lần 2 SKIPPED | — |
| Q-BR-009 | start chỉ khi CALLED và now <= callExpiresAt; boundary inclusive | CALL_EXPIRED |
| Q-BR-010 | Một sourceOrderId chỉ sinh một stage ticket | DUPLICATE_STAGE_TICKET |
| Q-BR-011 | Patient không thấy PII/position chi tiết của ticket khác | FORBIDDEN |
| Q-BR-012 | Duplicate command/event no-op; same key/different payload conflict | IDEMPOTENCY_KEY_REUSED |
| Q-BR-013 | Queue call event generic, không PHI; Notification chỉ delivery | event allowlist |
| Q-BR-014 | Terminal ticket không sửa; requeue là transition explicit từ SKIPPED | INVALID_STATE_TRANSITION |

---

## 6. Given–When–Then scenarios

**Q-SCN-001 — Admission:** Given invoice paid hoặc approved credit, Appointment A checked-in, initial stage S; When Reception gọi CreateOrGetJourney hai lần cùng key; Then một Journey và một StageTicket authoritative được tạo, cùng ID trả về, ordinal chỉ tăng một lần, event emitted once.

**Q-SCN-002 — Block premature:** Given booking confirmed nhưng chưa check-in hoặc payment chưa đạt; When create journey; Then FAILED_PRECONDITION/422 ADMISSION_NOT_READY; không sequence/ticket/event.

**Q-SCN-003 — Late boundary:** Given scheduled 08:00; When arrival 08:30 exactly Then ON_TIME/non-demoted; When arrival 08:30:01 Then lateMinutes calculation may be 30 but elapsed >30m flag is LATE_DEMOTED; patient vẫn có ticket và được xếp sau non-late same priority.

**Q-SCN-004 — Call race:** Given một WAITING ticket; When hai staff đồng thời CallNext; Then row locking cho tối đa một caller nhận ticket đó; caller kia nhận ticket khác hoặc 204 NO_WAITING; chỉ một CallAttempt #1/event.

**Q-SCN-005 — Absent:** Given CALLED attempt 1 hết đúng 300 giây không start; When timeout worker runs Then ticket WAITING với enqueueSequence mới. Given attempt 2 hết hạn Then SKIPPED; không call lần 3 tự động.

**Q-SCN-006 — Override:** Given T2 đứng sau T1; When staff không có queue:override gửi overrideTicketId T2 Then 403/no changes. When authorized actor gửi reason hợp lệ Then T2 CALLED, PriorityOverride/audit/outbox committed atomically.

**Q-SCN-007 — Stage routing:** Given Medical order O PERFORMED/needs stage S; When EnqueueStage retried/out-of-order duplicate; Then unique sourceOrderId trả ticket cũ; complete ticket không bị reset.

**Q-SCN-008 — Invalid/ownership/dependency:** invalid body →400; wrong patient owner→404/403 no leak; stale expectedVersion→409; Appointment validation timeout during create→UNAVAILABLE, no local commit; response lost after commit→retry returns same journey.

---

## 7. Edge cases

- Midnight: businessDate fixed lúc journey tạo theo Asia/Ho_Chi_Minh; stage sau midnight vẫn dùng journey date để tránh đổi mã giữa hành trình.
- Sequence gaps do rollback được phép; ordinal unique chứ không đảm bảo gapless.
- Clock skew: server/DB clock authoritative; client timestamps ignored.
- Appointment no-show event tới sau race với check-in: owner version mới nhất quyết định; nếu đã valid checked-in thì không tự hủy Journey chỉ từ stale event, đưa reconciliation/manual review.
- Stage inactive giữa hành trình: không enqueue mới; ticket đã chờ được route/cancel có reason.
- Call expires đồng thời start: conditional update state=CALLED AND expiresAt>=DB now; chỉ một outcome.
- Queue board không trả phone/name đầy đủ; maskedLabel optional.
- Payload/cursor invalid →400; page max 100; reason whitespace/too long reject.
- Broker down sau commit: outbox pending, API vẫn success; call board state authoritative local.

---

## 8. Dependencies, events và recovery

| Dependency | Operation | Required | Failure |
|---|---|---:|---|
| Appointment | verify checked-in/scheduled/no-show owner state | Yes create | fail closed, 503/gRPC UNAVAILABLE |
| Billing | evidence paid/approved-credit via Reception admission snapshot/contract | Yes create | fail closed; Queue không infer tiền |
| Medical | encounter/order references and stage routing | Yes per request | reject mismatch; no DB query |
| RabbitMQ | events | No for local commit | outbox retry/backoff/DLQ |

Outbound v1: queue.journey_created, queue.stage_ticket_created, queue.ticket_called, queue.ticket_call_timed_out, queue.ticket_service_started, queue.ticket_completed, queue.ticket_skipped, queue.journey_completed. queue.ticket_called data: ticketId/journeyId/accountId recipient ref/stageCode/roomCode/callExpiresAt; không diagnosis/test/result.

Inbound reconciliation: appointment.no_show/cancelled và medical.order_cancelled (versioned). Domain commands requiring immediate admission remain gRPC. Consumer at-least-once via inbox. Local aggregate + sequence + attempt/override + outbox commit in one transaction. Timeout scheduler claims rows with SKIP LOCKED; retry idempotently.

---

## 9. Security, audit, NFR và config

PII minimum: patientId, masked display label; ticket/stage are sensitive operational data. Không log JWT, full patient identity, request body hoặc location history. Rate limit patient reads and staff commands; DTO allowlist; stage assignment check.

Async Audit Service receives append-only events. Audit create, call/start/complete, every override/requeue/cancel, priority/urgent change and denied override; actor/service, IDs, action, reason, old/new state, request/correlation, time; no unnecessary PHI.

NFR DESIGN: CallNext P95 ≤250ms at 100 waiting tickets/stage; reads ≤300ms; 99.9% target; stateless API + DB scheduler leader/locking; at most one active call per ticket. Metrics queue length/wait estimate/call timeout/skipped/override/outbox lag/deadlock retry. Readiness DB; liveness dependency-free.

Config: PORT, DATABASE_URL(secret), JWT public key/issuer/audience, service JWT key(secret), RABBITMQ_URL(secret), BUSINESS_TIMEZONE, CALL_TIMEOUT_SECONDS=300 (Approved), MAX_CALL_ATTEMPTS=2 (Approved), LATE_DEMOTION_SECONDS=1800 with strict greater-than, IDEMPOTENCY_TTL_HOURS, GRPC_DEADLINE_MS, APPOINTMENT_GRPC_TARGET. No hard-coded port/credential.

---

## 10. Testing và acceptance

- Unit selection comparator, strict 30m, timeout boundary, estimates, all transitions.
- DB races: sequence, CallNext, timeout-vs-start, unique journey/order, optimistic version/outbox.
- REST/OpenAPI/gRPC contract and JWT/assignment tests.
- Rabbit duplicate/stale/DLQ, broker outage, dependency timeout, response loss.
- E2E Reception admission → Journey → multi-stage → complete; verify no pre-check-in ticket and no PII leak.

Acceptance: Queue is sole ticket authority; CallNext cannot be client-ranked; absence gives exactly two 5-minute attempts; late patient accepted/demoted; override always permission+reason+audit; retry never duplicates ordinal/ticket.

---

## 11. Implementation phases

1. Foundation/database/auth/idempotency/outbox/inbox/probes.
2. Journey, stage, ticket, sequence and deterministic CallNext.
3. timeout scheduler, override, routing and journey completion.
4. gRPC/events/audit/reconciliation; REST boards/patient view.
5. race/security/load/contract/E2E and dashboard.

Release gate: approved Appointment/Billing admission evidence contracts, Auth permission mapping, Rabbit topology. Không workaround bằng DB access.

---

## 12. Assumptions, out of scope và approval

- **Approved:** authoritative only post-payment/credit + check-in; stage tickets; late strict >30m demotion; 5m/2 calls; server CallNext; manual override permission+reason.
- **DESIGN:** stage master/room mapping seeded per single clinic; urgent priority may only enter through explicitly authorized clinical workflow. Exact appointment no-show grace belongs Appointment, not duplicated here.
- Out of scope: pre-booking virtual ticket, kiosk hardware, SMS, multi-site transfer, bed management, emergency triage algorithm, guaranteed wait SLA.
- Open production question: final stage/room master data and role mapping.
- **Approval:** Approved decisions / 2026-10-03; detailed DESIGN pending architecture/operations review.
