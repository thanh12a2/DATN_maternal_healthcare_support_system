
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Medical Record Service — Service Specification

> **Status:** DESIGN — implementation-ready; các quyết định nghiệp vụ trong đề bài là **Approved**. Contract/schema/API dưới đây là **DESIGN** cho đến khi implementation và contract test được merge.  
> **Public contract:** ../api-specs/medical-record-service.yaml  
> **Internal contract:** ../grpc/medical_record/v1/medical_record_internal.proto  
> **Time:** lưu UTC; business timezone Asia/Ho_Chi_Minh. **ID:** UUID. Không dùng cross-database FK/query.

---

## 1. Tổng quan và boundary

Medical Record Service là source of truth cho diễn tiến lâm sàng của một lần khám, PregnancyEpisode và orchestration các hoạt động lâm sàng nhiều phòng.

### Chịu trách nhiệm

- Đúng một ClinicalEncounter chính cho mỗi Appointment; lifecycle DRAFT → IN_PROGRESS → AWAITING_RESULTS → READY_FOR_REVIEW → FINALIZED.
- EncounterAssignment và resource-level authorization dựa trên phân công.
- Structured vital signs, clinical notes, diagnosis/assessment và obstetric observations.
- PregnancyEpisode và liên kết Encounter vào thai kỳ.
- ClinicalServiceOrder và trạng thái thực hiện/kết quả giữa các phòng; phát tín hiệu PERFORMED cho Billing.
- Finalization, amendment append-only sau finalize và clinical-completion event cho Appointment.
- Giữ reference tới object của Document Service, Prescription Service và Treatment Plan Service.

### Không chịu trách nhiệm

- Patient demographics (Patient), doctor profile/rank/availability (Doctor), Appointment/check-in (Appointment), tiền/invoice (Billing), queue ticket (Queue).
- Binary object/version/malware scan (Document); prescription lifecycle/dispensing/sale (Prescription); treatment-plan lifecycle (Treatment Plan).
- Pharmacy/inventory, thuốc tính tiền, bảo hiểm, chat tư vấn, queue position hoặc notification delivery.
- Không hoàn tất Appointment trực tiếp; Appointment xử lý event clinical completion.

### Data ownership và external references

| Reference | Owner | Cách dùng |
|---|---|---|
| patientId | Patient Service | ID; resolve tối thiểu khi cần |
| appointmentId | Appointment Service | Unique business key; validate admission bằng gRPC DESIGN |
| doctorId | Doctor Service | ID + display/specialty snapshot tại assignment |
| documentId/documentVersionId | Document Service | Immutable scanned object reference; không lưu URL binary |
| prescriptionId | Prescription Service | ID/status projection tối thiểu qua event/contract |
| treatmentPlanId | Treatment Plan Service | ID/status projection tối thiểu |
| invoiceId/payment | Billing Service | Không lưu, chỉ correlation trong event nếu bắt buộc |

Mỗi service có database riêng; không distributed transaction.

---

## 2. Actors và authorization

| Actor/consumer | Quyền | Resource-level rule |
|---|---|---|
| PATIENT | medical:read:own | patientId được resolve từ JWT sub; chỉ dữ liệu FINALIZED và amendment đã công bố; không xem internal note |
| DOCTOR | medical:read:assigned, medical:write:assigned, medical:finalize:assigned | EncounterAssignment đang hiệu lực; PRIMARY mới finalize trừ permission override |
| CLINICAL_STAFF | medical:result:write:assigned-stage | Được phân công order/phòng; chỉ update order/result được giao |
| ADMIN | medical:assignment:manage, medical:amend:override | Mọi override cần reason; không mặc định đọc PHI nếu thiếu medical:read:any |
| Reception Service | OpenOrGetEncounter | service JWT; admission case hợp lệ; minimum fields |
| Queue/Prescription/Treatment/Document | Context/link contract | service JWT, audience đúng, allowlist method |
| Appointment/Billing/Notification/Audit | Event consumer | Không có quyền query DB hoặc sửa clinical state |

JWT RS256 được verify tại service: issuer/audience/kid/exp/sub/jti/role/permissions. Kong chỉ là edge; service vẫn enforce ownership/assignment. Assignment kết thúc không cho đọc encounter mới, nhưng quyền điều trị đang diễn ra có thể được giữ đến endedAt theo policy được audit.

---

## 3. Domain và data model

### ClinicalEncounter

| Field | Type | Required | Constraint/mô tả |
|---|---|---:|---|
| id | UUID | Yes | PK |
| appointmentId | UUID | Yes | UNIQUE; external Appointment ref |
| patientId | UUID | Yes | immutable external ref |
| pregnancyEpisodeId | UUID/null | No | local FK; nếu có phải cùng patientId |
| primaryDoctorId | UUID | Yes | external ref; phải có active PRIMARY assignment |
| state | enum | Yes | DRAFT mặc định |
| chiefComplaint | string/null | No | max 2000; PHI |
| clinicalSummary | string/null | No | max 10000; PHI |
| startedAt/reviewReadyAt/finalizedAt | timestamptz/null | No | set theo transition; UTC |
| version | int | Yes | >=1 optimistic lock |
| createdAt/updatedAt | timestamptz | Yes | DB managed |

### EncounterAssignment

id, encounterId (local FK), doctorId, role PRIMARY|CONTRIBUTOR|REVIEWER, scope ALL|ORDER_RESULT|REVIEW, assignedAt, endedAt nullable, assignedByAccountId, reason, doctorDisplaySnapshot, specialtySnapshot. Chỉ một PRIMARY active: partial UNIQUE encounterId WHERE role=PRIMARY AND endedAt IS NULL.

### PregnancyEpisode

| Field | Type | Constraint |
|---|---|---|
| id/patientId | UUID | PK / external ref |
| status | ACTIVE|CLOSED | một ACTIVE mỗi patient |
| estimatedDueDate | date/null | clinical date trong Asia/Ho_Chi_Minh |
| gravida/para | int/null | 0..30 |
| lastMenstrualPeriod | date/null | không ở tương lai business-date |
| riskLevel | LOW|MODERATE|HIGH|UNKNOWN | UNKNOWN mặc định |
| startedAt/closedAt | timestamptz | closedAt chỉ khi CLOSED |
| version | int | optimistic lock |

### Structured records

- VitalSign: id, encounterId, type BLOOD_PRESSURE|PULSE|TEMPERATURE|WEIGHT|HEIGHT|SPO2, valueNumeric/valueText, unit, measuredAt, recorderId, version. BP dùng systolic/diastolic integer; các type khác không được set hai field BP.
- ClinicalNote: id, encounterId, noteType SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN|INTERNAL, content max 10000, authorId, createdAt; update trước finalize tạo revision, không overwrite lịch sử.
- Diagnosis: id, encounterId, codeSystem, code, display, diagnosisType PRIMARY|SECONDARY|RULE_OUT, clinicalStatus, recordedBy, recordedAt.
- ObstetricObservation: id, encounterId, pregnancyEpisodeId, kind, value, unit, observedAt; schema allowlist theo kind.

### ClinicalServiceOrder

| Field | Type | Constraint |
|---|---|---|
| id/encounterId | UUID | PK/local FK |
| catalogServiceId | UUID | external Catalog ref/snapshot only |
| stageCode | string | 1..50, Queue routing code |
| orderedByDoctorId | UUID | phải assigned lúc order |
| status | ORDERED|IN_PROGRESS|PERFORMED|RESULT_AVAILABLE|VERIFIED|CANCELLED | state machine |
| performedAt/resultAvailableAt/verifiedAt | timestamptz/null | transition-managed |
| documentId/documentVersionId | UUID/null | kết quả file từ Document; chỉ link khi scan CLEAN |
| structuredResult | JSON/null | schema/version allowlist; max 64 KiB |
| billableSnapshot | bool | true cho dịch vụ supplementary; thuốc luôn false |
| version/createdAt/updatedAt | int/timestamptz | optimistic lock |

ExternalClinicalLink: id, encounterId, resourceType DOCUMENT|PRESCRIPTION|TREATMENT_PLAN, resourceId, resourceVersionId nullable, statusSnapshot, linkedAt. UNIQUE(resourceType, resourceId); không cascade/xóa resource ngoài.

EncounterAmendment: id, encounterId, section, reason (10..500), patch (allowlisted structured JSON, max 64 KiB), authorDoctorId, approvedByDoctorId, createdAt. Append-only; không sửa bản FINALIZED.

### Technical tables, constraints và indexes

- IdempotencyRecord UNIQUE(actorOrServiceId, operation, idempotencyKey), requestHash, responseRef/status, expiresAt.
- OutboxEvent(eventId UNIQUE, type, version, aggregateId, payload, occurredAt, publishedAt).
- ConsumedEvent(eventId PK, type, consumedAt) cho external resource/status events.
- Index Encounter(patientId, createdAt DESC), Encounter(state, updatedAt), Assignment(doctorId, endedAt), Order(encounterId,status), Order(stageCode,status,createdAt), PregnancyEpisode(patientId,status), Amendment(encounterId,createdAt).
- CHECK timestamp ordering, nonblank reason/content, structured JSON size; local FK chỉ giữa bảng Medical.

### State machines

ClinicalEncounter:

~~~text
DRAFT --start--> IN_PROGRESS
IN_PROGRESS --has pending order--> AWAITING_RESULTS
AWAITING_RESULTS --all required results verified--> IN_PROGRESS
IN_PROGRESS --submit review--> READY_FOR_REVIEW
READY_FOR_REVIEW --return with reason--> IN_PROGRESS
READY_FOR_REVIEW --finalize--> FINALIZED
FINALIZED --amend--> FINALIZED (append-only amendment)
~~~

ClinicalServiceOrder:

~~~text
ORDERED -> IN_PROGRESS -> PERFORMED -> RESULT_AVAILABLE -> VERIFIED
ORDERED|IN_PROGRESS -> CANCELLED (reason; chưa PERFORMED)
PERFORMED -> VERIFIED được phép khi structured result hoàn tất không cần file
~~~

Invalid transition trả 409 INVALID_STATE_TRANSITION; không write/outbox success.

---

## 4. Contracts

### REST qua Kong

Base path /api/medical-records; service-local path bỏ prefix. OpenAPI là contract chi tiết.

| ID | Method/path | Mục đích | Quyền |
|---|---|---|---|
| MED-001/002 | GET /health, /ready | probe | public/internal |
| MED-003 | GET /encounters | danh sách own/assigned | read own/assigned |
| MED-004 | GET /encounters/{id} | aggregate view tối thiểu | resource rule |
| MED-005 | POST /encounters/{id}/start | bắt đầu khám | assigned |
| MED-006..009 | POST vital-signs/notes/diagnoses/orders | structured write | assigned/scope |
| MED-010..013 | POST order start/performed/result/verify | multi-room flow | assigned-stage |
| MED-014/015 | POST ready-for-review/finalize | clinical completion | primary doctor |
| MED-016 | POST /encounters/{id}/amendments | amendment | assigned doctor/override |
| MED-017..019 | POST/GET/PATCH pregnancy-episodes | thai kỳ | doctor assigned; patient read own |

Mọi business POST cần Idempotency-Key UUID. Mutable command có expectedVersion. Success envelope data/meta.requestId; lỗi error.code/message/requestId/details allowlisted. Unknown fields reject.

### gRPC trực tiếp, không qua Kong

| Method | Caller | Semantics/idempotency |
|---|---|---|
| OpenOrGetEncounter | Reception | unique appointmentId + idempotencyKey; validate admission snapshot; trả existing nếu retry |
| GetEncounterSummary | Reception/Queue/clinical service | minimum state/IDs, không full notes |
| ValidateEncounterAccess | Document/Prescription/Treatment Plan | xác minh patient/doctor assignment và state |
| LinkExternalClinicalResource | Document/Prescription/Treatment Plan | upsert unique resourceType/resourceId; không copy entity |
| GetPregnancyEpisodeContext | authorized clinical service | minimum pregnancy context |

Service JWT RS256 có iss/aud/sub(service), jti, exp; deadline mặc định DESIGN 2s read/3s write, tối đa một retry cho idempotent call. Correlation ID và idempotency key truyền metadata. Dependency contract chưa hiện hữu trong repo phải coi là release gate, không fallback DB/REST.

---

## 5. Business rules

| ID | Quy tắc | Enforce/error |
|---|---|---|
| MR-BR-001 | Đúng một encounter/appointment; open retry trả cùng encounter | DB/app ENCOUNTER_EXISTS/idem |
| MR-BR-002 | Open chỉ khi Appointment admission-eligible, payment/approved-credit đã được Reception điều phối; Medical không tự xác nhận tiền | app ADMISSION_NOT_ELIGIBLE |
| MR-BR-003 | Mọi clinical read/write của người dùng enforce patient ownership hoặc assignment active | app FORBIDDEN |
| MR-BR-004 | Chỉ PRIMARY active finalize; override có permission và reason | app FINALIZE_FORBIDDEN |
| MR-BR-005 | Không finalize khi required order chưa VERIFIED/CANCELLED hoặc thiếu summary/primary diagnosis | app ENCOUNTER_NOT_FINALIZABLE |
| MR-BR-006 | FINALIZED immutable; sửa chỉ bằng amendment append-only | app/db ENCOUNTER_FINALIZED |
| MR-BR-007 | Một PregnancyEpisode ACTIVE/patient; Encounter link phải cùng patient | DB/app ACTIVE_EPISODE_EXISTS |
| MR-BR-008 | Order PERFORMED phát medical.service_order_performed đúng một lần; Billing chỉ charge supplementary PERFORMED | outbox |
| MR-BR-009 | Thuốc không billable và Medical không phát charge event cho prescription/medication | app |
| MR-BR-010 | File result chỉ link Document version immutable có malware status CLEAN | app DOCUMENT_NOT_CLEAN |
| MR-BR-011 | Finalize phát medical.encounter_finalized; Appointment tự hoàn tất theo clinical completion, nợ bổ sung không block | outbox |
| MR-BR-012 | Result available notification chỉ chứa IDs/generic text, không PHI chi tiết | event allowlist |
| MR-BR-013 | Cùng idempotency key khác normalized payload → 409 IDEMPOTENCY_KEY_REUSED | app/db |
| MR-BR-014 | expectedVersion lệch → 409 VERSION_CONFLICT | app/db |
| MR-BR-015 | Event duplicate ack/no-op; event cũ không ghi đè projection mới hơn | inbox/version |

---

## 6. Given–When–Then scenarios

| ID | Loại | Rule/API |
|---|---|---|
| MR-SCN-001 | open happy/idempotent | BR-001/002, gRPC |
| MR-SCN-002 | wrong assignment | BR-003, MED-004 |
| MR-SCN-003 | lifecycle/results | BR-005/008 |
| MR-SCN-004 | finalize/amend | BR-006/011 |
| MR-SCN-005 | race/version | BR-014 |
| MR-SCN-006 | dependency failure | BR-002/010 |

**MR-SCN-001:** Given Appointment A admission-eligible, patient P, doctor D và payment checkpoint đã đạt; When Reception gọi OpenOrGetEncounter hai lần cùng idempotency key; Then lần đầu tạo một DRAFT encounter + PRIMARY assignment, lần sau trả cùng ID, chỉ một outbox event, không duplicate.

**MR-SCN-002:** Given Doctor X không có assignment trên encounter E; When X GET E hoặc POST note; Then 403 (hoặc 404 theo anti-enumeration policy), không lộ PHI, không write/audit nội dung.

**MR-SCN-003:** Given E IN_PROGRESS và order O required; When O bắt đầu rồi PERFORMED; Then E chuyển AWAITING_RESULTS, outbox medical.service_order_performed đúng một lần; When result được link/verify; Then E có thể quay IN_PROGRESS, duplicate event/call không charge lần hai.

**MR-SCN-004:** Given READY_FOR_REVIEW, mọi required order verified và PRIMARY D; When D finalize; Then E FINALIZED, finalizedAt set, event finalized/result_available được outbox; When D sửa nội dung trực tiếp Then 409; When tạo amendment có reason Then bản gốc giữ nguyên và amendment append-only.

**MR-SCN-005:** Given version 7; When hai command cùng expectedVersion 7 chạy đồng thời; Then một success version 8, một 409 VERSION_CONFLICT, không mất update.

**MR-SCN-006:** Given Appointment validation timeout khi open; When retry bounded hết; Then gRPC UNAVAILABLE/REST 503, không tạo encounter. Given Document scan PENDING/INFECTED; When link result; Then 422 DOCUMENT_NOT_CLEAN, order không RESULT_AVAILABLE.

Validation/unauthenticated: body sai hoặc field ngoài schema → 400/no write; JWT thiếu/sai → 401. Lost response retry cùng key trả persisted result.

---

## 7. Edge cases

- Appointment/patient/doctor mismatch: 422 REFERENCE_MISMATCH; không tự sửa reference.
- Reassignment khi encounter active: kết thúc PRIMARY cũ, tạo assignment mới trong một local transaction; không xóa lịch sử; audit reason bắt buộc.
- Hai finalize đồng thời: optimistic lock, một event duy nhất.
- Pregnancy dates so sánh theo Asia/Ho_Chi_Minh; timestamp lưu UTC; leap-day hợp lệ.
- Structured result >64 KiB hoặc note >10,000: 413/400; binary phải qua Document.
- Order cancelled sau PERFORMED bị từ chối; corrective note/amendment thay vì rollback.
- Giá thay đổi/financial debt không thay clinical state. Result tới sau finalize chỉ bằng amendment/linked addendum có audit.
- External resource deleted/cancelled: giữ ID/history; update status projection bằng versioned event, không cascade.
- Event out-of-order: so ownerVersion/occurredAt; stale ignored và metric tăng.

---

## 8. Dependencies, events và failure

| Dependency | Operation | Required | Timeout/failure |
|---|---|---:|---|
| Appointment | admission snapshot khi open | Yes | deadline 2s, retry 1 idempotent; fail closed |
| Doctor | validate/display snapshot khi assignment | Yes | fail closed; không cache quyền vô hạn |
| Patient | existence/minimum identity nếu cần | Yes khi open | fail closed |
| Document | validate immutable version + CLEAN | Yes khi link file | 503/no state advance |
| Queue | enqueue stage | Async owner event hoặc gRPC from orchestrator | không rollback clinical order; outbox retry |
| Prescription/Treatment Plan | link/status contracts | Eventual + access gRPC | stale projection không sửa owner |
| RabbitMQ | publish outbox | Optional với local commit | commit thành công, worker retry/backoff/DLQ |

Outbound version 1: medical.encounter_opened, medical.encounter_state_changed, medical.service_order_created, medical.service_order_performed, medical.result_available, medical.encounter_finalized, medical.encounter_amended. Envelope gồm eventId,eventType,eventVersion,occurredAt,correlationId,aggregateId,data tối thiểu. Inbound: document.scan_completed, prescription.issued/cancelled, treatment_plan.activated/completed/cancelled, appointment.doctor_reassigned. Consumer at-least-once idempotent.

Local transaction gồm aggregate mutation + audit intent + outbox. Publisher confirm; exponential backoff có jitter, DLQ và replay có kiểm soát. Không 2PC; reconciliation tìm outbox quá hạn và external links stale.

---

## 9. Security, audit, NFR và config

PHI: notes, diagnosis, vital/result, pregnancy data. Không log body, query PHI, token, email/phone hoặc signed URL. Encryption in transit; database/backup encryption theo platform. DTO allowlist, size limits, parameterized query, anti-enumeration. Patient export/break-glass ngoài MVP.

Audit Service là append-only async owner; Medical giữ audit intent/outbox để bảo đảm phát. Audit các lần đọc PHI, assignment/reassignment, state transition, finalize, amendment, order/result link và override; metadata: actor/service, resource IDs, action, reason, changed field names, request/correlation ID, time; không raw PHI.

NFR DESIGN target: P95 read ≤300 ms, write local ≤500 ms (không tính dependency); 99.9% monthly target; stateless instances; pagination limit 100; readiness kiểm DB, liveness không gọi dependency. Metrics: state counts, finalize latency, pending orders, auth deny, outbox lag/fail, duplicate/stale event. Trace propagation W3C + correlation ID.

Config: PORT (optional, no fixed approved value), DATABASE_URL secret, AUTH_JWT_PUBLIC_KEY secret material, JWT_ISSUER/AUDIENCE, SERVICE_JWT_PRIVATE_KEY secret, RABBITMQ_URL secret, OUTBOX_POLL_MS, IDEMPOTENCY_TTL_HOURS, APPOINTMENT_GRPC_TARGET, DOCTOR_GRPC_TARGET, PATIENT_GRPC_TARGET, DOCUMENT_GRPC_TARGET, GRPC_DEADLINE_MS, BUSINESS_TIMEZONE=Asia/Ho_Chi_Minh. Không ghi credential thật.

---

## 10. Testing và acceptance

- Unit: all transitions/rules, schemas, authorization matrix, timezone and amendment immutability.
- DB integration: unique appointment, one active episode/PRIMARY, optimistic race, outbox atomicity.
- REST/OpenAPI and gRPC/proto contract tests; JWT/service audience negative tests.
- RabbitMQ duplicate/out-of-order/DLQ/replay; dependency timeout/lost response; PHI log scan.
- E2E admission open → clinical order → result → finalize; assert no direct Queue/Billing/Appointment DB access.

Acceptance: (1) retry Admission never creates two encounters; (2) unassigned doctor cannot access PHI; (3) only PERFORMED supplementary service emits billable signal; (4) finalized record is immutable and amendable append-only; (5) Appointment completion signal is eventual and supplementary debt never blocks clinical finalization.

---

## 11. Implementation phases

1. Foundation: service JWT/JWT, DB/migrations, health/readiness, idempotency/inbox/outbox.
2. Encounter, assignments, PregnancyEpisode, structured records and authorization.
3. Service orders/results, state machine, Document/external links.
4. REST/gRPC/events, retries/reconciliation/audit integration.
5. Contract/security/load/E2E tests and operational dashboards.

Release gate: Appointment/Patient/Doctor/Document internal contracts and RabbitMQ topology must be approved/available; otherwise no DB workaround.

---

## 12. Assumptions, out of scope và approval

- **Approved:** one private clinic/site; 1 main encounter/appointment; state sequence; assignment auth; separate Document/Prescription/Treatment Plan; no insurance/refund; medicine not charged; events/outbox/JWT rules.
- **DESIGN assumptions:** stageCode master and detailed structured clinical schemas are versioned configuration owned here/Catalog mapping; role-to-permission mapping supplied by Auth deployment.
- Out of scope: coding, migration of legacy data, e-signature/legal retention schedule, FHIR export, AI/CDSS, pharmacy, insurance, multi-facility.
- Open question before production, không block domain coding: statutory retention duration and break-glass workflow.
- **Approval:** Approved decisions / 2026-10-03; detailed DESIGN contracts require architecture/clinical/security review before implementation.
