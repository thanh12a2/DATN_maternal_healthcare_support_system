# Appointment Service — Service Specification

> **Status:** DESIGN — implementation-ready, chưa có source/config trong repository tại ngày 2026-10-03.  
> **Approved decisions:** một phòng khám/một cơ sở, chỉ dịch vụ (không BHYT); channel là `ONLINE | RECEPTION | WALK_IN`; SlotHold 5 phút; patient không tự cancel/reschedule; RabbitMQ + transactional outbox; synchronous internal calls dùng gRPC.  
> Contract chuẩn: [OpenAPI](../api-specs/appointment-service.yaml) · [gRPC](../grpc/appointment/v1/appointment_internal.proto).

## 1. Tổng quan và boundary

| Thuộc tính | Giá trị |
|---|---|
| Service | Appointment Service |
| Mục đích | Sở hữu lịch hẹn, occupancy, hold và bookable slot; chọn bác sĩ cụ thể hoặc phân bác sĩ theo consultation rank; giữ snapshot giá/lịch sử; check-in authoritative và nhận clinical completion. |
| Bounded context | Appointment Scheduling & Booking Occupancy |
| Actors/consumers | PATIENT, RECEPTIONIST, ADMIN; Reception, Medical Record, Queue, Notification, Reporting |
| Source/port/stack | `services/apps/appointment-service/` / TBD — DESIGN, chưa tồn tại; dùng stack chuẩn khi implementation được khởi tạo |
| Time/money | Lưu UTC; business timezone `Asia/Ho_Chi_Minh`; tiền là integer minor VND (1 minor = 1 VND) |

### Chịu trách nhiệm
- Sinh bookable slots từ Doctor effective working availability **trừ** appointment occupancy và active hold.
- Atomic SlotHold TTL đúng 5 phút; booking consume hold trong cùng local transaction.
- Appointment lifecycle, appointment code, channel, lựa chọn doctor/rank, assignment/reassignment và check-in.
- Pricing snapshot bất biến theo lần booking/reschedule: service/base price + rank surcharge; không tự định nghĩa giá.
- Cung cấp admission validation, queue estimate reference (không tạo ticket), và nhận clinical completion.

### Không chịu trách nhiệm
- Doctor profile/rank/working availability (Doctor); catalog/base price/surcharge (Catalog); patient profile (Patient).
- Invoice/payment/approved credit và void invoice chưa trả (Billing); ReceptionCase/identity verification (Reception); Encounter (Medical Record); QueueTicket/số thứ tự (Queue). Refund không thuộc scope hệ thống.
- Không tạo QueueTicket khi booking; không có `NORMAL/SERVICE`; không BHYT; không patient self-cancel/reschedule.

### Data ownership
Source of truth: `Appointment`, `SlotHold`, `AppointmentAssignmentHistory`, local idempotency/outbox/audit evidence.

| External ref/snapshot | Owner | Cách dùng |
|---|---|---|
| patientId | Patient | UUID, validate eligibility qua gRPC |
| doctorId, consultationRank, availabilityVersion | Doctor | UUID/code/version; rank snapshot không đổi owner |
| serviceId, price IDs, names, amount | Catalog | UUID + booking snapshot |
| encounterId | Medical Record | External ref sau mở encounter |
| receptionCaseId | Reception | External ref khi admission |
| invoiceId/payment condition | Billing | External ref/status tối thiểu |
| queue estimate/ticket | Queue | estimate khi booking; ticket chỉ sau admission |

Không cross-DB FK/query, không distributed transaction.

## 2. Actors và authorization

| Actor | Capability | Permission | Resource rule |
|---|---|---|---|
| PATIENT | Search slots; create hold/booking; xem lịch mình | `appointment:book:own`, `appointment:read:own` | JWT subject phải map patientId; server bỏ/reject actorId client gửi |
| RECEPTIONIST | Book tại quầy/walk-in; search; cancel/reschedule/check-in/reassign | `appointment:manage`, `appointment:checkin`, `appointment:reassign` | reason bắt buộc với cancel/reschedule/manual reassignment |
| ADMIN | Như Receptionist, xử lý exception | `appointment:admin` | reason + audit; không sửa snapshot trực tiếp |
| Reception Service | search slot, book hộ patient, validate/get/check-in | service JWT scopes `appointment:booking:read`, `appointment:booking:write`, `appointment:admission:read`, `appointment:checkin` | Không giả JWT Patient; idempotency bắt buộc cho command |
| Medical Record | mark clinical completion | service JWT scope `appointment.internal.clinical` | encounter phải thuộc appointment và caller assignment hợp lệ |
| Queue/Notification/Reporting | read event/projection | service JWT hoặc RabbitMQ ACL | Không có quyền mutate appointment |

Kong xác thực JWT RS256 ở public edge; service vẫn enforce permission/ownership. gRPC dùng service JWT RS256, audience, scope, deadline và correlation metadata.

## 3. Domain/data model

### Enums
- `BookingChannel = ONLINE | RECEPTION | WALK_IN` (nguồn booking, không phải loại giá).
- `SelectionMode = DOCTOR | RANK`.
- `AppointmentStatus = BOOKED | REASSIGNMENT_REQUIRED | CHECKED_IN | IN_CLINICAL_CARE | COMPLETED | CANCELLED | NO_SHOW`.
- `HoldStatus = ACTIVE | CONSUMED | EXPIRED | RELEASED`.
- `AssignmentReason = INITIAL | RANK_ALLOCATION | DOCTOR_UNAVAILABLE | STAFF_OVERRIDE`.

### Appointment
| Field | Type | Req | Constraint/mô tả |
|---|---|---:|---|
| id | UUID | Y | PK |
| appointmentCode | varchar(20) | Y | Unique, uppercase, opaque; không encode PII |
| patientId, serviceId | UUID | Y | External refs |
| channel | enum | Y | Approved enum |
| selectionMode | enum | Y | DOCTOR hoặc RANK |
| requestedDoctorId | UUID? | C | Bắt buộc iff DOCTOR; giữ yêu cầu lịch sử |
| requestedRankCode | varchar(50)? | C | Bắt buộc iff RANK |
| assignedDoctorId | UUID | Y | Doctor thực tế giữ occupancy; khi rank booking được phân atomic lúc booking |
| assignedRankCode | varchar(50) | Y | Rank Doctor tại lần assignment |
| specialtyId | UUID | Y | Snapshot/ref dùng eligibility |
| startAt, endAt | timestamptz | Y | UTC, `startAt < endAt`, half-open `[start,end)` |
| status | enum | Y | default BOOKED |
| serviceNameSnapshot | varchar(200) | Y | Catalog result |
| serviceVersion, availabilityVersion | bigint | Y | >=1 |
| basePriceId | UUID | Y | Catalog price ref |
| baseAmountMinor | bigint | Y | >=0 |
| rankSurchargePriceId | UUID? | C | null chỉ khi Catalog không có riêng; surcharge vẫn 0 |
| rankSurchargeAmountMinor | bigint | Y | >=0 |
| estimatedTotalMinor | bigint | Y | base + surcharge |
| currency | char(3) | Y | VND |
| queueEstimateMinutes | int? | N | Snapshot estimate, >=0; không authoritative ticket |
| receptionCaseId, encounterId | UUID? | N | External refs |
| checkedInAt, clinicalStartedAt, completedAt | timestamptz? | N | Theo state |
| cancellationReason | varchar(500)? | C | bắt buộc khi CANCELLED |
| rescheduleCount | int | Y | default 0, >=0 |
| version | bigint | Y | optimistic concurrency |
| createdByType/id, createdAt, updatedAt | fields | Y | UTC/audit |

### SlotHold
| Field | Type | Req | Constraint/mô tả |
|---|---|---:|---|
| id | UUID | Y | PK, token public dùng UUID opaque |
| patientId, serviceId, doctorId | UUID | Y | Hold luôn resolve một doctor cụ thể |
| rankCode | varchar(50) | Y | Doctor rank snapshot |
| startAt, endAt | timestamptz | Y | Half-open interval |
| status | enum | Y | ACTIVE mặc định |
| expiresAt | timestamptz | Y | `createdAt + 300 seconds`; active iff `now < expiresAt` |
| requestHash, idempotencyKey | varchar | Y | Retry/payload conflict |
| consumedByAppointmentId | UUID? | C | Chỉ CONSUMED |
| createdAt, updatedAt | timestamptz | Y | UTC |

### AssignmentHistory / Operational tables
`AppointmentAssignmentHistory(id, appointmentId, fromDoctorId?, toDoctorId, rankCode, reason, actorType, actorId, reasonText?, createdAt)`; `IdempotencyRecord(scope,key,requestHash,responseStatus,responseBody,resourceId,expiresAt)`; `OutboxEvent(id,aggregateId,aggregateVersion,eventType,eventVersion,payload,occurredAt,publishedAt,attempts)`; `ConsumedEvent(eventId,consumer,processedAt)`.

### Constraints/indexes
| Table | Type | Fields/rule |
|---|---|---|
| appointment | UNIQUE | appointmentCode |
| appointment | exclusion/serialized overlap | assignedDoctorId + tstzrange(startAt,endAt,'[)') khi state chiếm chỗ: BOOKED, REASSIGNMENT_REQUIRED, CHECKED_IN, IN_CLINICAL_CARE |
| slot_hold | exclusion/serialized overlap | doctorId + interval cho ACTIVE chưa hết hạn; implementation phải expire stale rows trước/within lock |
| appointment + hold | transaction/advisory key | `doctorId:startAt:endAt`; lock cùng canonical key để chống race giữa hai table |
| appointment | INDEX | patientId,startAt DESC; assignedDoctorId,startAt; status,startAt; requestedDoctorId,status |
| slot_hold | INDEX | status,expiresAt; patientId,createdAt DESC |
| idempotency | UNIQUE | scope,idempotencyKey; cùng key khác hash -> conflict |
| outbox | INDEX | publishedAt,occurredAt |
| all | CHECK | amounts >=0; currency=VND; start<end; conditional fields/state timestamps |

### Slot algorithm và assignment
1. Validate range tối đa `BOOKABLE_RANGE_DAYS`; normalize UTC nhưng derive business date bằng Asia/Ho_Chi_Minh.
2. gRPC Doctor lấy effective intervals/candidate doctors; interval là working availability, chưa trừ booking.
3. Với DOCTOR: doctor phải active, specialty/rank hợp lệ. Với RANK: lấy candidates active có đúng requested rank (không tự nâng/hạ), deterministic order theo ít occupancy cùng ngày, rồi earliest doctorId làm tie-break.
4. Slice interval theo Doctor `slotDurationMinutes`; chỉ slot nằm trọn interval.
5. Loại slot overlap occupancy và ACTIVE hold với `now < expiresAt`; `end == next.start` không overlap.
6. Với RANK search, cùng thời điểm chỉ trả capacity/candidate token tối thiểu; create hold chọn và khóa một doctor. Không hứa doctor cho đến hold response.
7. Create hold lock canonical slot, re-check Doctor eligibility + local occupancy, insert ACTIVE với DB clock `expiresAt=transaction_timestamp()+5m`.
8. Booking consume đúng active hold và tạo Appointment atomically. Resolve Catalog tại booking; không dùng giá chỉ từ search cache.

### State machines

| Current | Command/event | Next | Guard |
|---|---|---|---|
| — | book | BOOKED | Active hold consumed; dependencies valid; snapshot complete |
| BOOKED | doctor unavailable (DOCTOR) | REASSIGNMENT_REQUIRED | Không tự đổi; cần staff/patient confirmation workflow |
| BOOKED | doctor unavailable (RANK) | BOOKED | Auto-reassign doctor cùng exact rank, available, không conflict; event reassigned |
| REASSIGNMENT_REQUIRED | confirm reassignment | BOOKED | Staff permission + reason; selected replacement available; confirmation evidence |
| BOOKED/REASSIGNMENT_REQUIRED | staff cancel | CANCELLED | reason; trước check-in |
| BOOKED/REASSIGNMENT_REQUIRED | staff reschedule | BOOKED | reason + new active hold; atomic release old/occupy new; new pricing snapshot |
| BOOKED | check-in | CHECKED_IN | Admission validated; Billing says PAID hoặc APPROVED_CREDIT; idempotent |
| CHECKED_IN | clinical started | IN_CLINICAL_CARE | Encounter linked |
| CHECKED_IN/IN_CLINICAL_CARE | clinical completed | COMPLETED | Medical Record authoritative completion; supplementary debt does not block |
| BOOKED | grace elapsed/reception marks | NO_SHOW | Not checked in; reason/system evidence |

Terminal: COMPLETED, CANCELLED, NO_SHOW. Invalid transition -> `409 INVALID_STATE_TRANSITION`; no write/success event. Late >30 phút vẫn có thể check-in; Appointment returns `late=true`; Queue owns demotion. No-show grace is config and evaluated only before check-in.

## 4. REST contract
Base `/api/v1`, public qua Kong. Chi tiết schema/error ở OpenAPI.

| ID | Method/path | Actor | Idempotency |
|---|---|---|---|
| APP-001 | GET `/bookable-slots` | authenticated Patient/staff | read |
| APP-002 | POST `/slot-holds` | Patient/staff | required `Idempotency-Key` |
| APP-003 | DELETE `/slot-holds/{holdId}` | hold owner/staff | desired-state idempotent |
| APP-004 | POST `/appointments` | Patient/staff | required; consumes hold |
| APP-005 | GET `/appointments/{id}` | owner/staff | read |
| APP-006 | GET `/appointments` | owner or staff filters | cursor pagination |
| APP-007 | POST `/{id}/cancel` | RECEPTIONIST/ADMIN only | required + reason |
| APP-008 | POST `/{id}/reschedule` | RECEPTIONIST/ADMIN only | required + reason/new hold |
| APP-009 | POST `/{id}/reassign` | RECEPTIONIST/ADMIN | required + reason/confirmation |

Booking response: code, service snapshot, requested doctor/rank, assigned doctor/rank, interval, pricing snapshot, queue estimate. Tuyệt đối không trả/tạo authoritative queue number/ticket.

Common errors: `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 APPOINTMENT_NOT_FOUND` (patient wrong-owner dùng 404), `409 SLOT_NOT_AVAILABLE|HOLD_EXPIRED|IDEMPOTENCY_KEY_REUSED|INVALID_STATE_TRANSITION|VERSION_CONFLICT`, `422 DOCTOR_NOT_ELIGIBLE|SERVICE_NOT_BOOKABLE|RANK_NOT_AVAILABLE|PAYMENT_CONDITION_NOT_MET`, `503 DEPENDENCY_UNAVAILABLE`. Error envelope: `{code,message,requestId,details?}`, không stack trace.

Write transaction luôn gồm aggregate + local audit evidence + outbox. Notification/event publish sau commit; publish lỗi không rollback core.

## 5. gRPC

### Inbound (service JWT only)
Contract `AppointmentInternalService`:
- `SearchBookableSlotsForReception`: Reception proxy đọc slot; không ghi dữ liệu.
- `BookForReception`: Reception đặt lịch hộ patient với `channel=RECEPTION` hoặc `WALK_IN`; Appointment tự kiểm tra patient/doctor/catalog, tạo-consume hold và ghi outbox atomically.
- `GetAppointment`, `ValidateForAdmission`: Reception/Billing/Medical/Queue lấy minimum necessary.
- `CheckInAppointment`: Reception command; yêu cầu receptionCaseId, invoiceId, paymentCondition, idempotency key.
- `MarkClinicalStarted`, `MarkClinicalCompleted`: Medical Record; completion không phụ thuộc supplementary balance.
- `MarkNoShow`: Reception/system worker có scope.

Metadata bắt buộc: `authorization: Bearer <service-jwt>`, `x-correlation-id`, `x-request-id`; write thêm `x-idempotency-key`. Deadline caller ≤2s read, ≤3s write. Map gRPC: INVALID_ARGUMENT, UNAUTHENTICATED, PERMISSION_DENIED, NOT_FOUND, ALREADY_EXISTS/ABORTED, FAILED_PRECONDITION, UNAVAILABLE.

### Outbound
| Service/method logical contract | Dùng khi | Failure |
|---|---|---|
| Patient `CheckBookingEligibility(patientId)` | hold/booking | required; deadline 1s, 1 retry read-only; fail 503 |
| Doctor `ListEffectiveAvailability/ListEligibleDoctors/CheckDoctorEligibility` | search/hold/book/reconcile | required; bounded retry read; không write nếu unavailable |
| Catalog `ResolveBookingPrice(serviceId,rankCode,at)` | booking/reschedule | required; snapshot exact; fail 503 |
| Queue `EstimateWait(serviceId,doctorId,at)` | booking response | optional; timeout -> estimate null, core vẫn success |
| Billing `GetAdmissionPaymentCondition(invoiceId,appointmentId)` | check-in defense-in-depth | required; PAID/APPROVED_CREDIT only |

Không gọi REST nội bộ và không share DB entity.

## 6. Business rules
| ID | Rule | Enforcement/error |
|---|---|---|
| APP-BR-001 | Bookable = Doctor effective availability − occupying appointments − active holds | Domain + DB / SLOT_NOT_AVAILABLE |
| APP-BR-002 | Interval half-open; exact boundary không overlap | Domain/contract |
| APP-BR-003 | Hold TTL 300s bằng DB clock; `now == expiresAt` là expired | DB/domain / HOLD_EXPIRED |
| APP-BR-004 | Mỗi hold resolve đúng một doctor; consume tối đa một lần | DB unique/INVALID_HOLD_STATE |
| APP-BR-005 | SelectionMode có đúng một requestedDoctorId/requestedRankCode | DB+app/VALIDATION_FAILED |
| APP-BR-006 | Rank assignment chỉ exact rank, deterministic và re-check atomic | Domain/RANK_NOT_AVAILABLE |
| APP-BR-007 | Doctor/rank/specialty phải eligible toàn interval | gRPC + domain/DOCTOR_NOT_ELIGIBLE |
| APP-BR-008 | `estimatedTotalMinor=baseAmountMinor+rankSurchargeAmountMinor`, không làm tròn | App+CHECK/PRICING_INVALID |
| APP-BR-009 | Snapshot giá/version bất biến sau booking; reschedule ghi snapshot revision mới | App/audit |
| APP-BR-010 | Chỉ Receptionist/Admin cancel/reschedule; reason trim 3–500 | Auth/app/FORBIDDEN |
| APP-BR-011 | Patient không self cancel/reschedule kể cả owner | Auth/FORBIDDEN |
| APP-BR-012 | Doctor nghỉ + selected doctor -> REASSIGNMENT_REQUIRED; không silent replace | Consumer/domain |
| APP-BR-013 | Rank booking có thể auto-reassign exact rank nếu available; nếu không -> REASSIGNMENT_REQUIRED | Consumer/domain |
| APP-BR-014 | Check-in chỉ khi Billing condition PAID hoặc APPROVED_CREDIT | Domain/PAYMENT_CONDITION_NOT_MET |
| APP-BR-015 | Appointment completion theo Medical clinical completion; nợ supplementary không block | Domain |
| APP-BR-016 | Booking không tạo queue ticket/number | Contract test |
| APP-BR-017 | Late >30m vẫn admit; expose lateMinutes; Queue quyết định demotion | Domain |
| APP-BR-018 | Idempotency same key+same hash returns stored result; different hash 409 | App+DB |
| APP-BR-019 | Appointment code unique, random/opaque | DB |
| APP-BR-020 | No-show chỉ khi grace elapsed và chưa check-in | Domain/INVALID_STATE_TRANSITION |

## 7. GWT scenarios
| ID | GWT acceptance |
|---|---|
| APP-SCN-001 | **Given** Doctor D available 08:00–09:00, no occupancy, rank R and Catalog price 300000+100000 **When** patient holds 08:00 and books with same key **Then** hold expires in 300s, appointment BOOKED for D, total 400000 VND, one outbox event; retry returns same appointment. |
| APP-SCN-002 | **Given** one free slot **When** two patients concurrently create holds **Then** exactly one 201, one 409 SLOT_NOT_AVAILABLE; no overlap. |
| APP-SCN-003 | **Given** hold expires at T **When** booking at DB time T **Then** 409 HOLD_EXPIRED, no appointment/event. |
| APP-SCN-004 | **Given** rank R has D1/D2 available, D1 lower daily occupancy **When** rank hold created **Then** D1 selected and locked; response includes assigned doctor/rank. |
| APP-SCN-005 | **Given** patient owns appointment **When** patient calls cancel/reschedule **Then** 403, unchanged, no event. |
| APP-SCN-006 | **Given** staff and active booking **When** reschedule with active new hold + reason **Then** old occupancy released/new consumed atomically, revision/audit/event once; Catalog snapshot refreshed. |
| APP-SCN-007 | **Given** selected-doctor booking and doctor.unavailable **When** consumer processes event **Then** REASSIGNMENT_REQUIRED; notify event; no silent reassignment. |
| APP-SCN-008 | **Given** rank booking and replacement exact rank free **When** doctor unavailable event handled **Then** deterministic reassignment, history + appointment.reassigned once; duplicate event no-op. |
| APP-SCN-009 | **Given** appointment BOOKED and Billing returns PAID **When** Reception checks in twice with key K **Then** first -> CHECKED_IN, retry same result/event once. |
| APP-SCN-010 | **Given** Billing UNPAID **When** check-in **Then** failed precondition/422, no check-in/event/ticket instruction. |
| APP-SCN-011 | **Given** appointment 35 minutes late but within admission operation **When** check-in with paid condition **Then** succeeds with late=true/35; Queue consumes check-in event and owns demotion. |
| APP-SCN-012 | **Given** Medical finalizes encounter and supplementary invoice remains unpaid **When** MarkClinicalCompleted **Then** COMPLETED and event emitted; debt unchanged in Billing. |
| APP-SCN-013 | **Given** Catalog/Doctor required call times out **When** hold/book attempted **Then** bounded retry then 503; no local write/outbox. |
| APP-SCN-014 | **Given** Queue estimate times out after booking core is ready **When** booking completes **Then** 201 with estimate null; outbox retained; no QueueTicket. |
| APP-SCN-015 | **Given** key K stored with payload A **When** payload B uses K **Then** 409 IDEMPOTENCY_KEY_REUSED; original unchanged. |
| APP-SCN-016 | **Given** BOOKED appointment past no-show grace and not checked in **When** authorized worker marks no-show **Then** NO_SHOW once; later check-in rejected 409. |

## 8. Edge/failure/event behavior
- Expired holds may remain rows but never count as active; sweeper changes EXPIRED idempotently and emits optional operational event.
- Price/doctor changes after booking do not mutate snapshot. Reschedule is a new pricing decision; paid financial consequence belongs Billing and no-refund rule applies there.
- Cancellation after check-in, terminal mutation, overlapping reschedule, doctor rank changed between search/hold: reject/re-resolve; never false success.
- Response lost after commit: idempotency record returns original. Outbox at-least-once; consumer dedupe by eventId and aggregateVersion.
- Doctor event out-of-order: ignore aggregateVersion ≤ last processed; reconciliation scans future nonterminal appointments.
- Payload max 64 KiB; reason plain text sanitized; no arbitrary filters/sort.

### RabbitMQ
Exchange `maternal.domain` topic, durable; routing keys below. Envelope: `eventId,eventType,eventVersion,aggregateType,aggregateId,aggregateVersion,occurredAt,correlationId,causationId,producer,data`. Persistent message; publisher confirms; DLQ per consumer; payload minimum necessary, no PHI/free-text reason.

| Event | Dir | Data tối thiểu / handling |
|---|---|---|
| appointment.booked.v1 | out | appointmentId, patientId, serviceId, doctorId, rankCode, startAt,endAt,channel,totalMinor,currency; Notification/Reporting |
| appointment.rescheduled.v1 | out | ids, old/new interval, doctorId, rankCode; consumers refresh |
| appointment.cancelled.v1 | out | appointmentId, patientId, reasonCode (không reason text) |
| appointment.reassignment_required.v1 | out | appointmentId, patientId, oldDoctorId, startAt |
| appointment.reassigned.v1 | out | appointmentId, old/newDoctorId, rankCode,startAt |
| appointment.checked_in.v1 | out | appointmentId, patientId, receptionCaseId, encounterId?, doctorId, checkedInAt, lateMinutes; Queue may create ticket only after admission orchestrator completes |
| appointment.clinical_started.v1 / appointment.completed.v1 | out | appointmentId, encounterId, timestamps |
| appointment.no_show.v1 | out | appointmentId, patientId, occurredAt |
| doctor.status_changed / schedule_changed / availability_changed | in | reconcile impacted future appointments; dedupe/version |
| medical.encounter_started / finalized | in fallback | gRPC command preferred; event reconciles missing transition |

Transactional outbox same DB transaction. Publish failure retries exponential with jitter, max attempts config then alert/DLQ; replay safe.

## 9. Security, audit, NFR, config
- PII: patientId/internal refs confidential; appointment time/service may be PHI context. Không log response/body, token, free-text reason, service name linked patient. Encrypt in transit; DB/backups encrypted per platform.
- Audit append-only event to Audit Log asynchronously plus local immutable evidence for critical writes: actor/service identity, action, aggregate, before/after status, changed fields, reason code/text local only, request/correlation, timestamp, outcome. Audit outage không rollback; outbox retry.
- P95 slot query ≤500ms excluding dependencies for 31-day cap; P95 local reads ≤250ms; write ≤500ms excluding gRPC. Availability target 99.9% DESIGN; stateless replicas, DB shared state.
- Metrics: hold created/expired/consumed, slot conflict, booking by channel/mode, dependency latency/error, reassignment backlog, outbox age, idempotency conflict. Traces propagate correlation without PHI.

| Config | Default | Secret |
|---|---:|---:|
| PORT | TBD | No |
| DATABASE_URL | required | Yes |
| JWT_JWKS_URL / JWT_AUDIENCE | required | No |
| SLOT_HOLD_TTL_SECONDS | 300 (approved; startup reject khác) | No |
| BUSINESS_TIMEZONE | Asia/Ho_Chi_Minh | No |
| BOOKABLE_RANGE_DAYS | 31 | No |
| LATE_THRESHOLD_MINUTES | 30 | No |
| NO_SHOW_GRACE_MINUTES | DESIGN default 30, operationally configurable | No |
| GRPC_*_TARGET | required per dependency | No |
| RABBITMQ_URL | required | Yes |
| OUTBOX_* / IDEMPOTENCY_TTL_HOURS | bounded defaults 10 attempts / 24h | No |

Readiness requires DB; RabbitMQ/dependencies reported degraded, không liveness-fail. Migration single-owner. No public service port except Kong.

## 10. Testing, acceptance, phases
### Traceability/minimum suite
- APP-BR-001..007 -> SCN-001..004, concurrency + property tests interval/timezone/rank assignment.
- APP-BR-008..013 -> SCN-005..008, snapshot and event consumer tests.
- APP-BR-014..020 -> SCN-009..016, gRPC auth/idempotency/state tests.
- OpenAPI 3.0.3 lint; proto compile/breaking check; consumer contract tests; DB constraints; outbox duplicate/out-of-order; auth wrong-owner; log redaction; dependency timeout.

### Acceptance
1. Không thể overbook kể cả hold-vs-book race; TTL chính xác 5 phút theo DB clock.
2. Cả doctor selection và exact-rank assignment hoạt động deterministic, pricing snapshot đầy đủ.
3. Patient không thể cancel/reschedule; staff action có reason/audit.
4. Admission chỉ check-in sau PAID/APPROVED_CREDIT; booking chưa tạo QueueTicket.
5. Medical completion hoàn tất Appointment dù supplementary debt còn lại.

### Implementation phases
1. Schema/migrations, state machine, constraints, idempotency/audit/outbox.
2. gRPC clients Doctor/Patient/Catalog; slot calculator + atomic hold.
3. REST booking/read/staff mutations + OpenAPI contract tests.
4. Inbound gRPC admission/clinical + Billing/Queue estimate integration.
5. RabbitMQ dispatcher/consumers/reconciliation/observability; load/race/security acceptance.

## 11. Assumptions/out-of-scope/open gates
- **Approved:** single facility, VND, no BHYT, rank exact-match, 5-minute hold, no patient self-mutation, RabbitMQ/outbox.
- **DESIGN default:** no-show grace 30 phút và appointment-code format; có thể đổi config trước implementation nhưng không đổi semantics.
- Queue estimate contract là optional và có thể null; authoritative ticket chỉ Queue sau payment+check-in.
- Không recurring/group/home visit/telemedicine/waitlist/overbooking/refund. Không sửa Doctor/Catalog contracts trong task này; method outbound là required target contract cần owner các service phê duyệt nếu proto tương ứng chưa có.
