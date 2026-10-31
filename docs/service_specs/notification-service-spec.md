
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Notification Service — Service Specification

> **Status:** DESIGN — implementation-ready; business decisions are **Approved**, detailed contracts are **DESIGN**.  
> **Public contract:** ../api-specs/notification-service.yaml  
> **Internal contract:** ../grpc/notification/v1/notification_internal.proto  
> Delivery-only, RabbitMQ-first; no synchronous callback to domain owner.

---

## 1. Tổng quan và boundary

Notification Service chuyển domain events thành thông báo IN_APP, PUSH và EMAIL; quản lý trạng thái delivery/read và endpoint kỹ thuật. Domain owner vẫn sở hữu sự thật nghiệp vụ.

### Chịu trách nhiệm

- Consume versioned RabbitMQ events, chọn approved template/channel, render nội dung tối thiểu và deliver at-least-once.
- In-app inbox/unread, mark read; register/revoke push device endpoints.
- Email adapter và push adapter (mock được phép trong MVP), retry/backoff/DLQ, provider response classification.
- Dedupe theo event/recipient/template/channel; delivery/audit telemetry.

### Không chịu trách nhiệm

- Không tạo booking/reminder/payment/result/queue truth; không polling DB domain; không synchronous callback xác nhận tới producer.
- Không SMS provider; không user preference trong MVP; không marketing/broadcast/admin free-text send.
- Không chứa diagnosis, result detail, pregnancy detail, payment instrument hoặc clinical note.
- Không quyết định lịch reminder: Appointment phát appointment.reminder_due ở mốc 24h và 1h.

### Data ownership

Own: NotificationMessage (delivery projection), DeliveryAttempt, InAppNotification, PushEndpoint, TemplateDefinition versioned technical content, inbox/dedupe/outbox. External: recipient account/patient/doctor IDs và domainResourceId chỉ reference. Email address nếu event contract cung cấp phải mã hóa và xóa theo retention; không trở thành profile owner.

---

## 2. Actors và authorization

| Actor/consumer | Permission | Rule |
|---|---|---|
| authenticated user | notification:read:own, notification:manage:own | accountId = JWT sub; chỉ inbox/device của mình |
| ADMIN/Support | notification:ops:read | metadata/attempt, không body PHI; không gửi tùy ý |
| Domain services | RabbitMQ publish | producer allowlist/event schema; không gọi Send gRPC |
| UI aggregator | GetInAppSummary gRPC | service JWT; accountId authorized forwarding context |
| Audit/Reporting | event/metrics | minimum fields |

JWT RS256 verify local. Device ownership từ JWT sub, không tin accountId body. Internal gRPC chỉ query in-app summary; không có callback hay SendNotification RPC.

---

## 3. Domain và data model

### NotificationMessage

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| sourceEventId | UUID | required |
| sourceEventType/sourceEventVersion | string/int | producer allowlist |
| recipientAccountId | UUID | required |
| domainResourceType/domainResourceId | string/UUID | reference, optional |
| templateKey/templateVersion | string/int | immutable render version |
| locale | vi-VN | MVP fixed fallback |
| category | BOOKING|REMINDER|REASSIGNMENT|QUEUE|PAYMENT|RESULT | enum |
| createdAt/expiresAt | timestamptz | expiration per category |

UNIQUE(sourceEventId,recipientAccountId,templateKey) prevents duplicate message.

### Delivery

Delivery: id,messageId,channel IN_APP|PUSH|EMAIL,status PENDING|SENDING|DELIVERED|FAILED_RETRYABLE|FAILED_PERMANENT|SUPPRESSED, destinationRef/encryptedDestination nullable, providerMessageId nullable, attemptCount,nextAttemptAt,deliveredAt,lastErrorCode,version. UNIQUE(messageId,channel,destinationKeyHash).

DeliveryAttempt: append-only id,deliveryId,attemptNo,startedAt,finishedAt,outcome,providerCode,latencyMs; không lưu raw provider body/token/email.

InAppNotification: id,messageId UNIQUE,accountId,title,body,deepLink allowlisted,readAt nullable,createdAt,expiresAt. Nội dung generic, ví dụ “Kết quả của bạn đã sẵn sàng”; không tên xét nghiệm/kết quả.

PushEndpoint: id,accountId,platform ANDROID|IOS|WEB,tokenCiphertext,tokenHash UNIQUE,provider MOCK|FCM_ADAPTER|APNS_ADAPTER,active,lastSeenAt,revokedAt,createdAt. Token không trả lại client.

TemplateDefinition: key,version,channel,category,locale,subject/title/body/deepLinkPattern,active,variableAllowlist,contentHash; UNIQUE(key,version,channel). Template deploy-controlled/reviewed, không endpoint sửa trong MVP.

ConsumedEvent(eventId PK,eventType,producer,consumedAt,payloadHash), OutboxEvent cho notification.delivery_* telemetry/audit, IdempotencyRecord cho device/read-all command.

Indexes: InApp(accountId,readAt,createdAt DESC), Delivery(status,nextAttemptAt), Delivery(messageId), PushEndpoint(accountId,active), Message(domainResourceId), Attempt(deliveryId,attemptNo).

### Delivery state

~~~text
PENDING -> SENDING -> DELIVERED
SENDING -> FAILED_RETRYABLE -> SENDING (bounded retry)
SENDING -> FAILED_PERMANENT
PENDING -> SUPPRESSED (expired/no destination/channel unavailable)
~~~

IN_APP được ghi DELIVERED trong cùng local transaction tạo inbox. PUSH/EMAIL worker claim SKIP LOCKED. Retry DESIGN: 1m,5m,30m,2h, tối đa 5 attempts; 429/timeout/5xx retryable, invalid token/address/4xx permanent. Push invalid token revoke endpoint. Adapter mock không được báo production-delivered trừ profile ENV=development/test.

---

## 4. Event-first và API contracts

### RabbitMQ inbound là command source duy nhất cho delivery

| Event v1 | Producer owner | Category/channels mặc định |
|---|---|---|
| appointment.booked | Appointment | IN_APP,PUSH,EMAIL |
| appointment.reminder_due | Appointment | IN_APP,PUSH; reminderKind HOURS_24|HOUR_1 |
| appointment.doctor_reassigned | Appointment | IN_APP,PUSH,EMAIL |
| queue.ticket_called | Queue | IN_APP,PUSH |
| billing.payment_recorded | Billing | IN_APP,EMAIL |
| medical.result_available | Medical Record | IN_APP,PUSH,EMAIL |

Event envelope bắt buộc eventId,eventType,eventVersion,occurredAt,correlationId,producer,data. data chỉ có recipientAccountId, domain resource IDs, safe template variables và destination email nếu contract đã approve. Thiếu recipient hoặc schema sai → reject/DLQ schema; không gọi ngược producer.

### REST qua Kong

Base path /api/notifications.

| ID | Method/path | Mục đích |
|---|---|---|
| NOT-001/002 | GET /health,/ready | probes |
| NOT-003 | GET /in-app | own inbox cursor pagination |
| NOT-004 | GET /in-app/unread-count | own summary |
| NOT-005 | POST /in-app/{id}/read | mark own read idempotent |
| NOT-006 | POST /in-app/read-all | mark all before server cutoff |
| NOT-007 | POST /devices | register/update own device by tokenHash |
| NOT-008 | DELETE /devices/{id} | revoke own endpoint idempotently |

Không có POST /send. Business POST cần Idempotency-Key; unknown/server fields rejected.

### gRPC nội bộ tối thiểu

GetInAppSummary(accountId, optional since) dành cho BFF/UI aggregator, trả unreadCount/latestUnreadAt. Không body, không delivery command, không preference RPC trong MVP. Service JWT, 1s deadline, không retry bắt buộc; public client dùng REST.

---

## 5. Business rules

| ID | Quy tắc | Error/behavior |
|---|---|---|
| N-BR-001 | Notification không tạo/chỉnh domain state; chỉ event owner kích hoạt | no send API |
| N-BR-002 | Dedupe cùng sourceEvent/recipient/template; duplicate ack, không redeliver | unique/inbox |
| N-BR-003 | Chỉ template/variables allowlist; không PHI chi tiết | EVENT_SCHEMA_REJECTED |
| N-BR-004 | Không preference MVP; áp dụng channel matrix mặc định, thiếu endpoint thì SUPPRESSED channel đó | — |
| N-BR-005 | Không SMS; event yêu cầu SMS bị reject/ignore với metric | UNSUPPORTED_CHANNEL |
| N-BR-006 | Queue call hết hạn không retry delivery sau expiresAt | SUPPRESSED_EXPIRED |
| N-BR-007 | In-app read chỉ owner; mark read lặp trả same state | FORBIDDEN/idempotent |
| N-BR-008 | Device token encrypted, unique hash; chuyển ownership cần proof/current auth, không silently reassign | DEVICE_TOKEN_CONFLICT |
| N-BR-009 | Provider failure không rollback domain event/message/in-app | retry/DLQ |
| N-BR-010 | Reminder 24h/1h do Appointment phát; Notification không tính schedule | — |
| N-BR-011 | Result message chỉ “đã sẵn sàng” + deep link authenticated | PHI policy |
| N-BR-012 | Cùng Idempotency-Key/payload khác →409 | IDEMPOTENCY_KEY_REUSED |
| N-BR-013 | Out-of-order event không hủy inbox cũ; template rendering dùng source event version mapping | version routing |

---

## 6. Given–When–Then scenarios

**N-SCN-001 — Booking:** Given valid appointment.booked v1 for account A; When consumer handles event; Then one Message, one in-app item and pending push/email deliveries per available endpoints are committed; duplicate event is ack/no-op; no callback to Appointment.

**N-SCN-002 — No PHI:** Given medical.result_available includes only IDs; When rendered; Then title/body generic and deep link authenticated. Given variable/result detail ngoài allowlist; Then event quarantined/DLQ, security metric/audit emitted, no notification content persisted.

**N-SCN-003 — Retry:** Given email provider timeout; When worker attempts; Then FAILED_RETRYABLE + nextAttemptAt, domain owner unaffected. On fifth retryable failure Then delivery DLQ/FAILED_PERMANENT policy, in-app remains available.

**N-SCN-004 — Queue expiry:** Given queue.ticket_called expires at T; When push retry worker claims at or after T; Then SUPPRESSED_EXPIRED, no stale “đến phòng” push/email.

**N-SCN-005 — Own inbox:** Given notification belongs A; When B GET/read ID; Then 404/403 without content leak. When A marks read twice with same/different key; Then same readAt retained and no duplicate audit success.

**N-SCN-006 — Device:** Given token hash already active for A; When A registers retry Then return same endpoint/update lastSeen. When B registers same token Then 409, no ownership transfer/token leak. Delete twice returns 204.

**N-SCN-007 — Broker/dependency:** Given RabbitMQ redelivery after DB commit before ack; Then inbox not duplicated. Given provider down; Then event consumer still ack after durable local commit; delivery retried asynchronously.

Validation/JWT: unknown field/malformed cursor→400 no write; missing/invalid JWT→401; same key different payload→409.

---

## 7. Edge cases

- Event unknown version/type: route to unsupported-event DLQ; do not guess fields/template.
- Recipient absent/deactivated: SUPPRESSED_NO_RECIPIENT after approved local resolution contract; no producer callback.
- Email case/plus handling: destination key hash over normalized exact approved address; Notification không thay đổi profile.
- Push provider returns invalid token: atomically permanent-fail delivery and revoke endpoint.
- Device token rotation: create/upsert by tokenHash, old token explicitly revoked or expires by policy.
- Read-all uses server cutoff timestamp captured once, affects unread createdAt<=cutoff; concurrent newer item remains unread.
- Cursor stable by createdAt,id; expired items hidden and later purged; legal/audit metadata retained separately.
- Template missing: TEMPLATE_NOT_FOUND DLQ; no free-text fallback leaking raw event.
- Locale unsupported: vi-VN template fallback only if event mapping approves; otherwise DLQ.
- Large/unsafe deep link: reject; only relative allowlisted routes, no javascript/external URL.

---

## 8. Integrations, topology và consistency

RabbitMQ DESIGN topology: durable topic exchange maternal.domain.v1; durable queue notification.delivery.v1; routing keys exact allowlist; retry queues with TTL/dead-letter; notification.delivery.dlq.v1 and notification.schema.dlq.v1. Names are DESIGN, not claim of existing infra.

Consumer transaction: validate envelope/schema → dedupe inbox → render immutable template → create Message/Delivery/InApp → commit → ACK. Crash before commit causes redelivery; after commit before ACK dedupes. Provider calls occur outside consumer transaction. Outbox publishes notification.delivery_succeeded, notification.delivery_failed_permanent, notification.security_event for Audit/Reporting only; producers must not synchronously wait.

Dependencies: RabbitMQ required for intake (readiness degraded if unavailable); PostgreSQL required; email/push optional to core intake and fail asynchronously. Auth/JWK is local verification/config, no per-request Auth call. No domain service synchronous dependency.

---

## 9. Security, audit, NFR và config

Classification: accountId/domain IDs sensitive; email and device token PII/secret-like; notification body may reveal visit context. Encrypt destinations/tokens, hash lookup keys with keyed hash, TLS, key rotation. Never log payload body, token, email, Authorization or provider response body. Responses never expose destination/token. Rate limit device churn/read commands; CSRF posture per bearer client; DTO allowlist.

Audit Service async append-only: device register/revoke, read-all, support access, template deployment, DLQ replay and permanent delivery failure. Metadata only: actor/service, IDs, action/result, reason, request/correlation/time. Inbox read may be batched to avoid excessive audit but security/support reads always audited.

NFR DESIGN: event-to-durable-message P95 ≤2s under normal load; in-app read P95 ≤250ms; 99.9% API target; at-least-once intake with effectively-once message creation; horizontal stateless consumers/workers. Metrics lag, render rejection, delivery latency/success by channel, retries, DLQ, unread counts (aggregate), outbox lag. Liveness dependency-free; readiness DB + broker intake, provider outage reports degraded metric not unready.

Config: PORT,DATABASE_URL(secret),RABBITMQ_URL(secret),JWT_PUBLIC_KEY/JWT_ISSUER/JWT_AUDIENCE,PUSH_PROVIDER=MOCK|adapter, PUSH_CREDENTIALS(secret),EMAIL_PROVIDER/EMAIL_CREDENTIALS(secret),DESTINATION_ENCRYPTION_KEY(secret),TOKEN_HASH_KEY(secret),DELIVERY_MAX_ATTEMPTS=5, retry delays, retention days, BUSINESS_TIMEZONE. MOCK forbidden when ENV=production.

---

## 10. Testing và acceptance

- Unit event schema/template allowlist, dedupe key, state/error classification, expiry, read ownership.
- DB integration uniqueness, concurrent consumers, read-all cutoff, endpoint conflict, worker claim/outbox.
- Rabbit redelivery/out-of-order/unknown version/retry/DLQ/replay tests.
- Provider adapter contract with timeout/429/4xx/5xx/invalid token; production mock guard.
- REST OpenAPI/gRPC proto/JWT tests; security scans assert no PHI/PII logs or responses.
- E2E six required event families and 24h/1h reminder kinds; verify no synchronous producer callback.

Acceptance: domain event commit survives provider outage; duplicate event yields one inbox item/channel delivery; no SMS/send API/preferences; result notification has no result detail; own inbox isolation and endpoint secrecy hold.

---

## 11. Implementation phases

1. DB/auth/probes/inbox/outbox/idempotency; template registry.
2. Rabbit consumer validation/dedupe/render and in-app REST.
3. push endpoint + mock adapter, email adapter, workers/retry/DLQ.
4. minimal gRPC summary, audit/reporting events, purge/replay tooling with authorization.
5. contract/security/load/chaos/E2E and dashboards.

Release gate: producer event schemas, recipient identity contract, approved safe templates, broker topology/secrets and non-mock provider for production.

---

## 12. Assumptions, out of scope và approval

- **Approved:** delivery-only; in-app + push adapter/mock + email; no SMS; six event families; no preferences MVP; RabbitMQ/outbox/at-least-once; no PHI detail.
- **DESIGN:** vi-VN default templates, bounded retry values/topology/retention configurable. Email destination must be supplied by an approved minimum-data event or future identity projection; implementation must not invent cross-DB lookup.
- Out of scope: marketing, arbitrary admin send, two-way messaging, SMS, AI, domain scheduling, user preference UI, provider procurement.
- Open production questions: exact email/push provider and retention duration; these do not permit use of mock in production.
- **Approval:** Approved decisions / 2026-10-03; detailed DESIGN pending architecture/security/operations review.
