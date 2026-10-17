
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Reporting Service — Service Specification

> **Implementation status:** DESIGN — chưa có source/database/runtime trong repository tại thời điểm 2026-10-03.  
> **Decision status:** Approved: event-driven read models, CSV export, mỗi service DB riêng, không cross-DB query và không distributed transaction.

---

## 1. Tổng quan và boundary

Reporting Service xây projection tổng hợp từ domain event versioned và phục vụ dashboard/CSV. Dữ liệu là eventually consistent, không authoritative cho Appointment, Billing, Queue hay Medical Record.

### Chịu trách nhiệm

- Consumer idempotent, projection checkpoint/error, rebuild có kiểm soát.
- Read models theo business date Asia/Ho_Chi_Minh nhưng lưu timestamps UTC.
- Query report aggregate và quản lý CSV export asynchronous.
- Hiển thị freshness/asOf/watermark để người dùng không hiểu projection là realtime authoritative.

### Không chịu trách nhiệm

- Không query DB service khác, không join runtime xuyên DB, không sửa domain state.
- Không dùng report để authorize/check payment/check-in/clinical decision.
- Không data warehouse tự do, ad-hoc SQL, BI connector, PDF/XLSX hoặc scheduled email trong MVP.
- Không export clinical note, message body, diagnosis chi tiết, nationalId, phone/email hoặc PHI row-level.

### Ownership

Sở hữu ProjectionEventReceipt, ProjectionCheckpoint, các DailyMetric và ReportExport. External IDs/dimensions là reference/snapshot tối thiểu; producer vẫn là source of truth.

| Thuộc tính | Giá trị |
|---|---|
| Actors | ADMIN; internal service có scope rõ; worker/consumer. |
| Source path/port | DESIGN: chưa tồn tại/chưa cấp, không giả định. |
| Public path | /api/reports qua Kong. |
| Internal | gRPC direct với service JWT RS256, deadline/correlation. |

## 2. Actors và authorization

| Actor | Capability | Permission | Rule |
|---|---|---|---|
| ADMIN | Xem operational/financial/clinical aggregate | reports:read tương ứng scope | Field/dimension allowlist; không tự động có mọi sensitive scope. |
| ADMIN | Tạo/tải CSV | reports:export | Export gắn actor; download chỉ creator hoặc reports:export:any. |
| Reporting worker | Consume/project/rebuild | service identity | Rebuild cần operator approval và lock; không public. |
| Internal service | Summary hoặc export status | service JWT audience + scope | Minimum necessary contract. |
| PATIENT/DOCTOR/RECEPTIONIST | Không có report quản trị mặc định | N/A | 403; future role mapping cần approval. |

Mọi query/export được audit bất đồng bộ; không gọi Audit Service sync. Không tin filter scope do client để mở rộng quyền.

## 3. Report catalog và data model

### ReportType

- APPOINTMENT_DAILY: booked, cancelled, checkedIn, completed, noShow theo channel/service/rank snapshot.
- REVENUE_DAILY: invoice count, paid base/supplementary amounts, outstanding supplementary; integer minor VND; không refund metric vì policy không refund.
- QUEUE_DAILY: tickets, served, skipped, average/max wait seconds, late demotion count theo stage.
- CLINICAL_ACTIVITY_DAILY: encounter started/finalized, orders/results count; aggregate only, không clinical content.

Mỗi report có versioned dimension/measure allowlist. Unknown dimension/measure trả 400, không map thành dynamic SQL identifier.

### ProjectionEventReceipt

| Field | Type | Constraint |
|---|---|---|
| eventId | UUID | PK/UNIQUE, dedup toàn service. |
| eventType/eventVersion/producer | varchar/int/varchar | Supported schema only. |
| occurredAt/processedAt | timestamptz | UTC. |
| payloadHash | char(64) | Duplicate conflict detection. |
| aggregateId/aggregateVersion | UUID?/bigint? | Dùng chống stale nếu producer cung cấp. |

### ProjectionCheckpoint

| Field | Type | Constraint |
|---|---|---|
| consumerName/partitionKey | varchar/varchar | Composite PK. |
| lastOccurredAt/lastEventId | timestamptz/UUID | Watermark quan sát, không cam kết global order. |
| lastProcessedAt | timestamptz | Freshness. |
| status | RUNNING, PAUSED, REBUILDING, DEGRADED | Valid enum. |
| version | int | Optimistic lock. |

### DailyMetric

Physical tables tách theo report type hoặc typed schema; không dùng unbounded EAV.

| Field | Type | Constraint |
|---|---|---|
| businessDate | date | Asia/Ho_Chi_Minh date từ occurredAt. |
| dimensionKey | varchar(200) | Canonical typed dimensions, không PII. |
| dimensions | jsonb | Chỉ allowlisted keys/codes/display snapshot cần thiết. |
| measures | jsonb | Chỉ integer typed measures; tiền minor VND. |
| lastEventOccurredAt/updatedAt | timestamptz | Freshness. |
| version | int | >= 1. |

UNIQUE(reportType, businessDate, dimensionKey); INDEX(reportType, businessDate), GIN không mặc định—chỉ thêm khi query plan chứng minh cần.

### ReportExport

| Field | Type | Required | Constraint |
|---|---|---:|---|
| id | UUID | Yes | PK. |
| requestedByActorId | UUID | Yes | External account identity cho authorization/audit. |
| reportType | enum | Yes | Supported type. |
| filters/columns | jsonb | Yes | Validated allowlist, canonical hash. |
| status | enum | Yes | QUEUED initial. |
| idempotencyKey/requestHash | UUID/char(64) | Yes | UNIQUE(actor, key). |
| rowCount/fileSizeBytes | bigint | No | >= 0; set complete. |
| storageKey | varchar(300) | No | Opaque private key; không public URL. |
| errorCode | varchar(80) | No | Safe code, không stack trace. |
| createdAt/startedAt/completedAt/expiresAt | timestamptz | Yes/No | UTC. |

State machine: QUEUED → RUNNING → COMPLETED hoặc FAILED; COMPLETED → EXPIRED. Retry FAILED tạo job mới/key mới; same key+same body trả job cũ; same key+different body 409. Worker claim dùng row lock/lease để một job chỉ chạy một lần; orphan RUNNING được lease recovery idempotent.

Indexes: status+createdAt cho worker; requestedByActorId+createdAt DESC; expiresAt cho cleanup; unique requestedByActorId+idempotencyKey.

## 4. REST và gRPC contracts

- OpenAPI: docs/api-specs/reporting-service.yaml
- Proto: docs/grpc/reporting/v1/reporting_internal.proto

| ID | Method/path | Mục đích | Quyền |
|---|---|---|---|
| RPT-API-001 | GET /health | Liveness | Public/internal |
| RPT-API-002 | GET /ready | DB/consumer/worker readiness | Ops |
| RPT-API-003 | GET /catalog | Report/dimension/measure catalog | reports:read |
| RPT-API-004 | GET /{reportType} | Query aggregate | reports:read scoped |
| RPT-API-005 | POST /exports | Queue CSV | reports:export + Idempotency-Key |
| RPT-API-006 | GET /exports/{exportId} | Status | owner/any permission |
| RPT-API-007 | GET /exports/{exportId}/download | Stream CSV | owner/any; COMPLETED unexpired |

Query: fromDate/toDate inclusive business dates, tối đa 366 ngày; groupBy allowlist; filters typed; limit dimensions 1..1000, cursor opaque. Response có reportType, timezone, fromDate, toDate, asOf, projectionStatus, lagSeconds, data. Financial amounts là integer int64/minor VND và JSON REST biểu diễn integer an toàn trong range; không float.

CSV UTF-8 có BOM configurable, RFC 4180 quoting, header cố định theo requested columns, CRLF, formula-injection neutralization cho cell bắt đầu = + - @, content-type text/csv, Content-Disposition attachment. Download được stream qua authenticated service; không trả public object URL.

Errors: 400 VALIDATION_FAILED/UNSUPPORTED_DIMENSION, 401, 403, 404 REPORT_EXPORT_NOT_FOUND, 409 IDEMPOTENCY_KEY_REUSED/INVALID_STATE, 410 EXPORT_EXPIRED, 413 EXPORT_TOO_LARGE, 429, 503 PROJECTION_UNAVAILABLE/STORAGE_UNAVAILABLE.

### gRPC

- GetReportSummary: bounded aggregate query cho internal consumer; không dùng làm authoritative domain check.
- RequestReportExport: idempotent enqueue, actor/service context rõ.
- GetReportExport: status/metadata, không trả file bytes.
- GetProjectionHealth: checkpoint/freshness.

Deadline đề xuất <= 3s query/status, <= 2s enqueue; service JWT aud reporting-service. INVALID_ARGUMENT, PERMISSION_DENIED, NOT_FOUND, ALREADY_EXISTS, FAILED_PRECONDITION, RESOURCE_EXHAUSTED, UNAVAILABLE.

## 5. Business rules

| Rule ID | Quy tắc | Enforced by |
|---|---|---|
| RPT-BR-001 | Projection chỉ từ versioned event; tuyệt đối không cross-DB query. | Architecture/tests |
| RPT-BR-002 | eventId xử lý đúng một lần về effect dù delivery at-least-once. | Receipt unique + transaction |
| RPT-BR-003 | Receipt/checkpoint/metric delta commit cùng local transaction; chỉ ack sau commit. | Consumer |
| RPT-BR-004 | Event sai thứ tự không ghi đè aggregate-version mới; additive fact dùng eventId dedup. | Projector |
| RPT-BR-005 | Business date = occurredAt chuyển Asia/Ho_Chi_Minh; API date range inclusive. | Projector/API |
| RPT-BR-006 | Report luôn trả asOf/freshness; DEGRADED không được trình bày như realtime. | API |
| RPT-BR-007 | CSV chỉ aggregate allowlisted, không row-level PII/PHI. | Export policy |
| RPT-BR-008 | Export snapshot dùng watermark captured khi RUNNING; file và metadata cùng watermark. | Worker |
| RPT-BR-009 | Same idempotency key/body trả cùng job; khác body 409. | DB/app |
| RPT-BR-010 | Download chỉ owner hoặc reports:export:any; mỗi download audited async. | Authz |
| RPT-BR-011 | Giá trị tiền là integer minor VND; không float/rounding trong projection. | Schema |
| RPT-BR-012 | Rebuild shadow projection rồi atomic local swap/version; không xóa live trước khi rebuild hoàn tất. | Operator tooling |

## 6. Given–When–Then scenarios

### RPT-SCN-001 — Project event

~~~gherkin
Given event billing.payment_recorded.v1 E hợp lệ chưa có receipt
When consumer xử lý E
Then receipt E và revenue metric delta được commit cùng local transaction
And message chỉ ack sau commit
And report response sau đó có asOf mới
~~~

### RPT-SCN-002 — Duplicate/redelivery

~~~gherkin
Given receipt E đã tồn tại
When E được redeliver 20 lần
Then consumer ack từng delivery
And metric không tăng thêm
~~~

### RPT-SCN-003 — Export idempotent

~~~gherkin
Given ADMIN A đã POST export với key K và body B tạo job J
When A gửi lại K và B
Then trả 200 với J
And không queue job/file thứ hai
When A gửi K với body khác
Then trả 409 IDEMPOTENCY_KEY_REUSED
~~~

### RPT-SCN-004 — Export và event đến trong lúc chạy

~~~gherkin
Given worker bắt đầu job J tại watermark W
When domain event mới đến sau W
Then CSV J chỉ phản ánh projection đến W
And metadata/asOf của J bằng W
And event mới xuất hiện ở query/export kế tiếp
~~~

### RPT-SCN-005 — Storage lỗi

~~~gherkin
Given job RUNNING và CSV tạm đã sinh nhưng private storage unavailable
When retry bounded hết
Then job thành FAILED với STORAGE_UNAVAILABLE an toàn
And không công bố storageKey/download
And có thể tạo job mới; domain projection không đổi
~~~

### RPT-SCN-006 — Sai quyền tải

~~~gherkin
Given export J thuộc ADMIN A
And ADMIN B không có reports:export:any
When B download J
Then trả 404 theo anti-enumeration policy
And không stream byte nào
And access denial được audit bất đồng bộ
~~~

### RPT-SCN-007 — Projection lag

~~~gherkin
Given consumer lag vượt threshold nhưng DB query được
When ADMIN query report
Then response có projectionStatus DEGRADED và lagSeconds
And dữ liệu không được gắn nhãn realtime
~~~

### RPT-SCN-008 — Rebuild thất bại

~~~gherkin
Given live projection V1 đang phục vụ
When shadow rebuild V2 lỗi giữa chừng
Then V1 vẫn phục vụ nguyên vẹn
And V2 không được swap
And checkpoint ghi DEGRADED/alert
~~~

## 7. Edge cases

- Unknown event/version: DLQ/quarantine và alert, không ack-loop vô hạn.
- Same eventId khác hash: quarantine conflict; không sửa receipt/metric.
- Event cũ hợp lệ: áp delta vào đúng businessDate; asOf/late-event metric cập nhật.
- Range qua UTC day boundary: group theo Asia/Ho_Chi_Minh, không theo DB session timezone.
- fromDate > toDate, >366 ngày, filter/groupBy lạ, cursor malformed: 400.
- Zero-row export: COMPLETED với CSV chỉ header, rowCount 0.
- Row/file vượt limit: FAILED EXPORT_TOO_LARGE; xóa temp artifact.
- CSV values chứa comma, quote, newline, formula prefix: quote/escape/neutralize.
- Response lost sau POST: retry key trả cùng J.
- Worker crash: lease hết hạn, worker khác resume/restart idempotently; một published final object key.
- Export expired: 410; cleanup object retry async; metadata giữ theo retention policy.

## 8. Integrations và events

Inbound minimum events (contract phải được domain owner approve trước implementation): appointment.booked/cancelled/checked_in/completed/no_show; billing.invoice_created/payment_recorded/supplementary_outstanding_changed; queue.ticket_created/called/served/skipped/demoted; medical.encounter_started/finalized/order_created/result_available. Không đưa PII/PHI; payload có eventId/version/occurredAt/correlationId và dimensions/measures tối thiểu.

| Dependency | Required | Failure |
|---|---:|---|
| PostgreSQL riêng | Yes | Not-ready; không ack. |
| RabbitMQ | Yes | Reconnect/backoff; projection stale và công khai lag. |
| Private object storage adapter | CSV only | Job retry/FAILED; query report vẫn hoạt động. Provider chưa được repo xác nhận. |
| JWT trust | REST/gRPC | Fail closed, local RS256 verify. |

Outbound qua local outbox: reporting.export_completed.v1, reporting.export_failed.v1 (không URL public/PII); Notification có thể consume nếu được cấu hình. At-least-once, consumer downstream tự dedup.

## 9. Security, audit, NFR và config

- Private storage, encryption in transit/at rest, opaque keys, short download authorization; no cache-store cho sensitive response.
- Audit query/export/download/rebuild với actor, filter hash, reportType, rowCount; không audit CSV body.
- Target DESIGN: query P95 <= 2 s cho 31 ngày; export enqueue P95 <= 500 ms; 100k rows/file max mặc định; freshness target <= 5 phút khi broker healthy. Đây là target cần load test, không phải current capability.
- Metrics: consumer lag, event errors/DLQ, projection freshness, query latency, export queue age/duration/failure/bytes.

| Variable | Required | Default |
|---|---:|---|
| PORT/DATABASE_URL/RABBITMQ_URL | Yes | deploy/secret |
| SERVICE_JWT_AUDIENCE/JWKS_URI | Yes | reporting-service/configured |
| REPORT_TIMEZONE | Yes | Asia/Ho_Chi_Minh |
| QUERY_MAX_DAYS | No | 366 |
| EXPORT_MAX_ROWS | No | 100000 |
| EXPORT_TTL_HOURS | No | 24 |
| EXPORT_WORKER_CONCURRENCY | No | 2 |
| PROJECTION_LAG_DEGRADED_SECONDS | No | 300 |
| OBJECT_STORAGE_ENDPOINT/BUCKET | CSV | provider-configured |
| OBJECT_STORAGE_CREDENTIALS | CSV | secret |

Bucket/provider, port, retention và event schema registry là DESIGN dependencies cần approve; không đưa credential thật vào docs/config.

## 10. Testing và acceptance

- Unit: projector per event version, date/timezone, stale/duplicate, money integer, CSV escaping/formula defense.
- Integration: receipt+metric atomicity, worker lease/race, idempotency key, object failure/cleanup.
- Contract: OpenAPI/proto/event fixtures; unsupported versions.
- E2E: events → projection → query → CSV → authorized download.
- Security/load/rebuild recovery tests; assert zero cross-DB connection/config.

| AC | Acceptance |
|---|---|
| RPT-AC-001 | Duplicate event không double count bất kỳ measure nào. |
| RPT-AC-002 | Mọi response/export có asOf và timezone; lag được biểu diễn. |
| RPT-AC-003 | CSV không chứa field ngoài allowlist và chống spreadsheet formula injection. |
| RPT-AC-004 | Không source/config runtime nào kết nối DB service khác. |
| RPT-AC-005 | Rebuild fail không phá live projection. |
| RPT-AC-006 | Concurrent same-key export tạo đúng một job. |

## 11. Implementation phases

1. Foundation + typed schemas/checkpoints/receipt/JWT/health.
2. Event contracts và projectors từng report, duplicate/out-of-order/DLQ.
3. Query catalog/REST/gRPC với freshness và authz.
4. Export worker/private storage/download/outbox.
5. Rebuild tooling, reconciliation, load/security/E2E.

Release gate: owner của từng event phải approve payload/version; infra approve RabbitMQ topology và private storage; security approve report permission và export retention.

## 12. Assumptions, out of scope và approval

- Approved decisions được ghi ở đầu spec; timestamps UTC, business timezone Asia/Ho_Chi_Minh.
- Assumption DESIGN: source services sẽ có transactional outbox và event đủ aggregate dimensions nhưng không PHI.
- Open: exact source event contracts, storage provider, report retention, official SLO/volume và dimension catalog.
- Out of scope: authoritative realtime checks, arbitrary SQL, cross-DB ETL, patient-level clinical exports, scheduled delivery, PDF/XLSX.
- **Spec status:** DESIGN / Approved decisions captured; chưa implemented.
