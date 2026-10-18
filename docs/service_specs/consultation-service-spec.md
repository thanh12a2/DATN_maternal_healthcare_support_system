
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Consultation Service — Service Specification

> **Implementation status:** DESIGN — chưa có source/database/runtime trong repository tại thời điểm 2026-10-03.  
> **Decision status:** Approved: patient–doctor asynchronous messaging, assignment/escalation; không AI/chatbot, video call, emergency service, và không tạo diagnosis/prescription/treatment plan trực tiếp từ chat.

---

## 1. Tổng quan và boundary

Consultation Service sở hữu thread trao đổi không đồng bộ, message bất biến, doctor assignment và escalation vận hành. Đây là communication context, không phải Medical Record.

### Chịu trách nhiệm

- Patient mở thread; staff assign/reassign doctor; participant gửi/đọc message theo resource-level authorization.
- Message ordering/dedup/read receipt; thread close; escalation acknowledge/resolve.
- Phát event metadata tối thiểu cho Notification/Audit, không phát body.
- Cảnh báo rõ async/not emergency và hướng dẫn kênh khẩn cấp đã được cơ sở công bố.

### Không chịu trách nhiệm

- Không chatbot/AI/automated medical advice, video/voice call, appointment booking, queue, payment.
- Không tạo hoặc finalize diagnosis, ClinicalEncounter, ServiceOrder, Result, Prescription hay TreatmentPlan từ message.
- Không biến message thành clinical record tự động; chuyển nội dung sang Medical Record là workflow riêng ngoài MVP và cần clinician action/contract được approve.
- Không sở hữu Patient/Doctor profile, doctor schedule/rank, Notification delivery hoặc Document object.
- Attachments, message edit/delete, reactions, typing/presence và group chat ngoài MVP.

### Data ownership/reference

Sở hữu ConsultationThread, DoctorAssignment, ConsultationMessage, MessageReadCursor, Escalation, idempotency/outbox. patientId thuộc Patient; doctorId thuộc Doctor; appointmentId thuộc Appointment nếu cung cấp; chỉ external UUID, không cross-DB FK/query.

| Thuộc tính | Giá trị |
|---|---|
| Actors | PATIENT, DOCTOR, RECEPTIONIST/ADMIN coordinator với permission; internal services. |
| Source path/port | DESIGN: chưa tồn tại/chưa cấp. |
| Public base | /api/consultations qua Kong. |
| Internal | gRPC direct, service JWT RS256, deadline/idempotency/correlation. |

## 2. Actors và authorization

| Actor | Hành động | Permission | Resource rule |
|---|---|---|---|
| PATIENT | Create/list/read/send/close own thread, raise escalation | consultation:*:own | JWT account phải map tới patientId qua trusted context/contract; chỉ thread.patientId. |
| DOCTOR | List/read/send/close assigned thread, raise escalation | consultation:*:assigned | Chỉ assignment ACTIVE tại thời điểm access. |
| RECEPTIONIST | List metadata, assign/reassign, acknowledge/resolve operational escalation | consultation:coordinate | Không đọc body mặc định; reason bắt buộc cho override. |
| ADMIN | Coordinate; exceptional body access | consultation:coordinate; consultation:read:any | read:any cần reason và audit; không bỏ qua policy. |
| Internal service | Access summary/check participation/assignment command | service JWT scope | Minimum necessary; no message body in summary. |

PatientId/doctorId là business IDs, không mặc định bằng JWT.sub. Mapping identity phải từ verified claims do platform approve hoặc internal owner contract; không tin client gửi owner ID. Khi chưa có mapping contract, endpoint phụ thuộc phải BLOCKED thay vì đoán.

## 3. Domain và data model

### Enum/state

- ThreadStatus: PENDING_ASSIGNMENT, ACTIVE, CLOSED.
- AssignmentStatus: ACTIVE, ENDED.
- AssignmentSource: PATIENT_SELECTED, STAFF_ASSIGNED, REASSIGNED.
- MessageSenderType: PATIENT, DOCTOR, SYSTEM.
- EscalationStatus: OPEN, ACKNOWLEDGED, RESOLVED, CANCELLED.
- EscalationReason: NO_RESPONSE, REQUEST_REASSIGNMENT, SAFETY_CONCERN, TECHNICAL, OTHER.

### ConsultationThread

| Field | Type | Required | Constraint |
|---|---|---:|---|
| id | UUID | Yes | PK. |
| patientId | UUID | Yes | External ref; immutable. |
| appointmentId | UUID | No | External ref; context only, no FK. |
| subject | varchar(160) | Yes | Trimmed, no diagnosis field. |
| status | enum | Yes | Initial based on assignment. |
| assignedDoctorId | UUID | No | Denormalized current external ref; null iff pending/closed may retain last assignment by policy below. |
| lastSequenceNo | bigint | Yes | Initial 0; monotonic under row lock. |
| lastMessageAt | timestamptz | No | UTC. |
| createdByAccountId | UUID | Yes | Verified actor identity. |
| version | int | Yes | Optimistic concurrency. |
| createdAt/updatedAt/closedAt | timestamptz | Yes/Yes/No | UTC. |
| closeReasonCode/closeReasonText | varchar/varchar(250) | No | Required on staff override. |

On CLOSED, assignedDoctorId retains last doctor as historical reference; no active assignment exists.

### DoctorAssignment

| Field | Type | Constraint |
|---|---|---|
| id/threadId/doctorId | UUID | PK/local FK/external ref. |
| status/source | enum/enum | One ACTIVE per thread. |
| assignedByAccountId/reason | UUID/varchar(250) | reason required for staff/reassign. |
| assignedAt/endedAt | timestamptz | endedAt iff ENDED. |
| version | int | Optimistic concurrency. |

Partial UNIQUE(threadId) WHERE status=ACTIVE; INDEX doctorId,status,assignedAt DESC.

### ConsultationMessage (immutable)

| Field | Type | Constraint |
|---|---|---|
| id/threadId | UUID | PK/local FK. |
| sequenceNo | bigint | UNIQUE(threadId, sequenceNo), starts 1. |
| senderType/senderAccountId | enum/UUID | Verified actor; SYSTEM only trusted internal command. |
| senderPatientId/senderDoctorId | UUID? | Exactly field matching senderType; external ref. |
| clientMessageId | UUID | UNIQUE(threadId, senderAccountId, clientMessageId). |
| body | text | Trimmed 1..4000 Unicode chars; encrypted at rest; no HTML execution. |
| bodyHash | char(64) | Idempotency conflict check. |
| sentAt | timestamptz | Server UTC; immutable. |

No update/delete API. Render as plain text; output encoding mandatory.

### MessageReadCursor

UNIQUE(threadId, readerAccountId); lastReadSequenceNo >= 0 and <= thread.lastSequenceNo; updatedAt. Upsert monotonic: max(current, requested), retry safe. Read receipts không được dùng để suy ra clinical acknowledgement.

### Escalation

| Field | Type | Constraint |
|---|---|---|
| id/threadId | UUID | PK/local FK. |
| reasonCode/details | enum/varchar(500)? | details minimum necessary, không diagnosis field. |
| status | enum | OPEN initial. |
| raisedByAccountId/raisedAt | UUID/timestamptz | Immutable. |
| acknowledgedBy/At | UUID?/timestamptz? | Both or neither. |
| resolvedBy/At/resolutionNote | UUID?/timestamptz?/varchar(500)? | Required on resolved. |
| version | int | Optimistic lock. |

At most one OPEN/ACKNOWLEDGED escalation per thread via partial unique. Index status,raisedAt and threadId,raisedAt DESC.

### State machines

Thread: create without doctor → PENDING_ASSIGNMENT; create with eligible selected doctor → ACTIVE; PENDING_ASSIGNMENT → ACTIVE on assign; ACTIVE → ACTIVE on atomic reassign; PENDING_ASSIGNMENT/ACTIVE → CLOSED. CLOSED terminal MVP.

Escalation: OPEN → ACKNOWLEDGED → RESOLVED; OPEN → RESOLVED allowed coordinator with resolution; OPEN → CANCELLED only creator before acknowledgement; terminal RESOLVED/CANCELLED.

Invalid transition: 409 INVALID_STATE_TRANSITION, no write/outbox.

## 4. REST và gRPC contracts

- OpenAPI: docs/api-specs/consultation-service.yaml
- Proto: docs/grpc/consultation/v1/consultation_internal.proto

| ID | Method/path | Mục đích | Permission |
|---|---|---|---|
| CON-API-001/002 | GET /health, /ready | Health/readiness | Public/ops |
| CON-API-003 | POST / | Patient tạo thread | consultation:create:own |
| CON-API-004 | GET / | List actor-scoped threads | own/assigned/coordinate metadata |
| CON-API-005 | GET /{threadId} | Detail + summary | participant; override rule |
| CON-API-006 | GET /{threadId}/messages | Cursor messages | participant/read:any+reason |
| CON-API-007 | POST /{threadId}/messages | Append async message | participant + Idempotency-Key |
| CON-API-008 | PUT /{threadId}/read-cursor | Mark read monotonic | participant |
| CON-API-009 | POST /{threadId}/assignments | Assign/reassign | consultation:coordinate |
| CON-API-010 | POST /{threadId}/escalations | Raise | participant |
| CON-API-011 | POST /{threadId}/escalations/{id}/acknowledge | Ack | coordinate |
| CON-API-012 | POST /{threadId}/escalations/{id}/resolve | Resolve | coordinate |
| CON-API-013 | POST /{threadId}/close | Close | participant/coordinate |

Create/send/assign/escalate/actions yêu cầu Idempotency-Key UUID. Same actor+operation+key/body trả original 200; khác body 409 IDEMPOTENCY_KEY_REUSED. List dùng cursor opaque/limit 1..100. Message list dùng afterSequenceNo >= 0, limit <=100, ascending để đồng bộ ổn định. Message POST success 201, retry 200.

Body access của ADMIN override yêu cầu X-Access-Reason 1..250; receptionist không có read-body permission. Coordinate list chỉ trả subject có thể nhạy cảm? Mặc định subject được coi sensitive và coordinator list trả subject null trừ permission read:any.

Errors: 400 VALIDATION_FAILED, 401, 403, 404 CONSULTATION_NOT_FOUND (anti-enumeration), 409 INVALID_STATE_TRANSITION/IDEMPOTENCY_KEY_REUSED/VERSION_CONFLICT/ACTIVE_ESCALATION_EXISTS, 422 DOCTOR_NOT_ELIGIBLE/ASYNC_NOT_EMERGENCY, 413 PAYLOAD_TOO_LARGE, 429, 503 DEPENDENCY_UNAVAILABLE.

### gRPC

- GetConsultationSummary: metadata tối thiểu, không body.
- CheckConsultationAccess: check participant/action cho trusted internal use; không thay thế caller auth.
- AssignDoctor: idempotent coordinator command, expectedVersion/reason.
- AppendSystemMessage: allowlisted system template code + safe variables, không cho arbitrary clinical text; dùng cho migration/ops approved only.

Service JWT aud consultation-service; deadline <=2s read/check, <=3s command. Write có idempotencyKey/correlationId. Status mapping chuẩn; proto message riêng, không share entity.

## 5. Business rules

| Rule ID | Quy tắc | Error |
|---|---|---|
| CON-BR-001 | Thread thuộc đúng một patient; patient chỉ own thread. | FORBIDDEN/404 |
| CON-BR-002 | Doctor chỉ đọc/gửi khi có ACTIVE assignment; quyền bị thu hồi ngay khi reassign/close. | FORBIDDEN/404 |
| CON-BR-003 | Chỉ một ACTIVE assignment; assign/reassign atomic, version checked. | VERSION_CONFLICT |
| CON-BR-004 | Doctor selected phải active/eligible theo Doctor owner contract; dependency fail thì không tạo assigned thread. | DOCTOR_NOT_ELIGIBLE/503 |
| CON-BR-005 | Message immutable, server sequence monotonic; duplicate clientMessageId/body idempotent. | IDEMPOTENCY conflict |
| CON-BR-006 | CLOSED không nhận message/assignment/escalation mới/read remains allowed to authorized historical participant per policy. | INVALID_STATE_TRANSITION |
| CON-BR-007 | Chat không tạo diagnosis/prescription/order/treatment/medical record. | Capability absent |
| CON-BR-008 | Event/notification không chứa body, subject hoặc clinical detail; chỉ IDs/type/timestamp. | Schema reject |
| CON-BR-009 | Escalation không phải emergency triage; SAFETY_CONCERN trả disclaimer và notify coordinator priority nhưng không chẩn đoán. | ASYNC_NOT_EMERGENCY guidance |
| CON-BR-010 | Staff assign/reassign/close/override-read bắt buộc reason và audit. | VALIDATION_FAILED |
| CON-BR-011 | Một escalation active/thread; terminal retry cùng key idempotent. | ACTIVE_ESCALATION_EXISTS |
| CON-BR-012 | Read cursor chỉ tăng, không vượt lastSequenceNo. | VALIDATION_FAILED |
| CON-BR-013 | Patient-selected doctor không đồng nghĩa clinical assignment trong Medical Record. | Boundary invariant |
| CON-BR-014 | Message transaction và outbox events commit cùng local DB transaction. | Atomic local |

## 6. Given–When–Then scenarios

### CON-SCN-001 — Patient tạo và nhắn doctor selected

~~~gherkin
Given patient P được xác thực và doctor D được Doctor Service xác nhận active/eligible
When P tạo thread với D bằng idempotency key K
Then trả 201 thread ACTIVE và assignment PATIENT_SELECTED
And local outbox có thread_created và assigned không chứa subject/body
And không tạo Encounter, diagnosis hay prescription
~~~

### CON-SCN-002 — Chưa có doctor

~~~gherkin
Given patient P tạo thread không chọn doctor
When request hợp lệ
Then thread PENDING_ASSIGNMENT được tạo
And P chưa thể nhận reply doctor
And coordinator có thể assign sau đó với reason
~~~

### CON-SCN-003 — Concurrent messages

~~~gherkin
Given thread ACTIVE có lastSequenceNo 10 và hai participant hợp lệ gửi đồng thời
When cả hai transaction append
Then tạo đúng sequence 11 và 12 không trùng
And mỗi message có đúng một outbox event
~~~

### CON-SCN-004 — Retry response lost

~~~gherkin
Given message M với clientMessageId C đã commit nhưng response bị mất
When caller retry cùng idempotency key/clientMessageId và body
Then trả 200 message M cùng sequence
And không thêm message/event thứ hai
When body khác
Then trả 409 IDEMPOTENCY_KEY_REUSED
~~~

### CON-SCN-005 — Reassign thu hồi quyền

~~~gherkin
Given D1 đang ACTIVE và đã đọc thread
When coordinator reassign D2 với expectedVersion và reason
Then assignment D1 ENDED, D2 ACTIVE trong một transaction
And D1 không thể đọc/send request tiếp theo
And event reassigned không chứa message body
~~~

### CON-SCN-006 — Unauthorized doctor

~~~gherkin
Given doctor D không được assign thread T
When D GET messages của T
Then trả 404 theo anti-enumeration
And không trả subject, participant hay message
And denial được audit async
~~~

### CON-SCN-007 — Escalation lifecycle

~~~gherkin
Given thread ACTIVE chưa có escalation active
When patient raise SAFETY_CONCERN
Then escalation OPEN, response có async-not-emergency guidance
When coordinator acknowledge rồi resolve với note
Then state lần lượt ACKNOWLEDGED, RESOLVED và events đúng một lần
~~~

### CON-SCN-008 — Closed thread

~~~gherkin
Given thread CLOSED
When participant gửi message mới
Then trả 409 INVALID_STATE_TRANSITION
And không insert message/outbox success
~~~

### CON-SCN-009 — Doctor dependency timeout

~~~gherkin
Given patient chọn doctor D và Doctor gRPC timeout sau bounded retry an toàn
When create thread
Then trả 503 và không tạo thread/assignment
And idempotency record cho phép retry xác định cùng outcome theo contract
~~~

### CON-SCN-010 — Notification down

~~~gherkin
Given message và outbox đã local commit
When Notification consumer/service down
Then message API vẫn success
And RabbitMQ redelivery xử lý sau
And không gọi Notification synchronously
~~~

## 7. Edge cases

- Empty/whitespace/body >4000, invalid Unicode control, server-managed sender/sequence: 400; no write.
- HTML/script stored as text and output encoded; URLs không tự thực thi.
- Same Idempotency-Key payload khác hoặc same clientMessageId body khác: 409.
- Patient sends while coordinator closes/reassigns: row/version lock quyết định; loser re-evaluate auth/state và fail, không ghost message.
- Doctor deactivated sau assignment: consume doctor status event để flag/reassignment workflow; cho đến policy event xử lý, mỗi sensitive write có thể validate current eligibility theo approved contract. Exact cache TTL is DESIGN open decision.
- Out-of-order doctor status events use aggregateVersion; stale ignored.
- Event publish fail after commit: outbox relay retries; API remains success.
- DB commit/response lost: retry stable key returns same resource.
- afterSequenceNo beyond last: empty list; negative/non-integer 400.
- Exact timestamp expiry boundaries use UTC; no message TTL/auto-delete MVP.
- Subject/body never logged or emitted; traceback/SQL hidden.

## 8. Integrations, RabbitMQ và failure

| Dependency | Operation | Required | Timeout/failure |
|---|---|---:|---|
| Patient identity mapping/eligibility owner contract | Resolve patientId for create | Yes | gRPC deadline <=2s; 503/no write. Contract/provider must be approved. |
| Doctor Service | Validate doctor active/eligible; status events | Yes when assigning | gRPC deadline <=2s, bounded retry reads; 422 or 503. |
| RabbitMQ | Outbox events/status consumer | Async | Mutation success after local outbox; relay retries. |
| Notification | Consumes events | Optional async | Never blocks message. |
| Audit Log | Consumes audit facts | Optional async | Never called sync. |

Inbound: doctor.status_changed.v1 / doctor.assignment_eligibility_changed.v1 if owner exposes approved contracts. Consumer dedup and aggregateVersion guard. Outbound: consultation.thread_created.v1, assigned.v1, reassigned.v1, message_sent.v1, escalation_raised/acknowledged/resolved.v1, thread_closed.v1 plus audit.recorded.v1. Event data chỉ threadId, patientId/doctorId khi minimum necessary, messageId, sequenceNo, reasonCode, timestamps; không body/subject/resolution details.

Transactional outbox unique eventId, at-least-once, publisher confirm; downstream idempotent. No distributed transaction. Reconciliation tìm outbox stuck/assignment mismatch local, không query DB khác.

## 9. Security, audit, NFR và config

- Encrypt body at rest; TLS; DB key/credentials secret. Field-level encryption method/key provider chưa được repo xác nhận, là release gate.
- DTO allowlist; rate limit create/message/read; plain-text rendering/CSP at client; no token/header/body in logs.
- Audit create, assignment, reassign, close, escalation, override read và denied access; changed field names only.
- Target DESIGN: append P95 <=1s excluding required doctor resolve; list P95 <=1s; availability target cần approve; async delivery at-least-once.
- Metrics: active/pending threads, assignment age, message latency/count (no content), escalation age, auth denied, outbox lag, dependency errors.

| Variable | Required | Default/example |
|---|---:|---|
| PORT/DATABASE_URL/RABBITMQ_URL | Yes | deploy/secret |
| SERVICE_JWT_AUDIENCE/JWKS_URI | Yes | consultation-service/configured |
| MESSAGE_MAX_CHARS | No | 4000 |
| PAGE_MAX_SIZE | No | 100 |
| IDEMPOTENCY_TTL_HOURS | No | 24 minimum; records for resource create may persist longer |
| OUTBOX_RETRY_LIMIT | No | bounded then alert, không discard event |
| DOCTOR_GRPC_TARGET/PATIENT_GRPC_TARGET | Conditional | approved service discovery |
| BODY_ENCRYPTION_KEY_REF | Yes | secret reference |
| SAFETY_GUIDANCE_TEXT | Yes | clinic-approved non-PHI text |

## 10. Testing và acceptance

- Unit: state transitions, assignment authorization, message normalization/hash, cursor, escalation, event redaction.
- DB integration: one active assignment/escalation, sequence races, idempotency conflicts, message immutability, outbox atomicity.
- Contract: OpenAPI/proto/event fixtures, gRPC JWT/deadline.
- E2E: create/assign/message/read/reassign/escalate/close; Notification/Audit unavailable.
- Security: IDOR, coordinator metadata/body split, admin override reason, XSS output, logs/events no content.

| AC | Acceptance |
|---|---|
| CON-AC-001 | Unassigned doctor cannot infer thread existence or read/send. |
| CON-AC-002 | Concurrent messages have unique monotonic sequence and no duplicate event. |
| CON-AC-003 | Reassignment atomically revokes old doctor and enables new doctor. |
| CON-AC-004 | No REST/gRPC/event can create diagnosis/prescription/treatment plan. |
| CON-AC-005 | Notification/Audit outage never rolls back committed message. |
| CON-AC-006 | Event/log scan confirms no body/subject/clinical details. |

## 11. Implementation phases

1. Foundation: DB/JWT/business identity mapping gate/health/idempotency/outbox.
2. Thread + assignment + resource authorization; Doctor gRPC contract.
3. Immutable messages/read cursor/concurrency and public REST.
4. Escalation/close, events, Notification/Audit integrations.
5. gRPC, encryption, security/load/failure/E2E hardening.

Release gates: patient-account mapping, Doctor eligibility method, permission mapping, encryption key provider, broker topology/port và clinic-approved safety text. Không implement bằng cách tự đoán các contract này.

## 12. Assumptions, out of scope và approval

- Approved: async patient-doctor, assignment/escalation, no AI/video/direct clinical prescribing/diagnosis; DB riêng; gRPC sync/RabbitMQ async.
- Assumption DESIGN: PATIENT account có trusted mapping tới patientId; coordinator roles được Auth cấp explicit permission.
- Open: selected-doctor eligibility semantics, retention, staff SLA/escalation routing, body encryption implementation, whether closed historical doctor retains read access. Default trong spec: doctor chỉ có access khi ACTIVE; ADMIN override có reason.
- Out of scope: attachments, media, real-time WebSocket/presence, chatbot, telehealth, emergency response, clinical order/record creation, pharmacy.
- **Spec status:** DESIGN / Approved decisions captured; chưa implemented.
