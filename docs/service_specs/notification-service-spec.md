
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |
| Update-2026-11-09 | 2026-11-09 | Cập nhật hiện trạng thông báo, công việc lễ tân, claim và SSE theo code. | Phân biệt chức năng đã code, kiểm thử và phần còn thiếu; không thay đổi quy định nghiệp vụ. |
| Update-2026-11-09-inbox-sse | 2026-11-09 | Bổ sung SSE cho inbox Patient/Doctor. | Thêm migration Notification, tín hiệu theo tài khoản và bỏ polling frontend của chuông cá nhân. |
| Request-2026-11-09-clinical-email | 2026-11-09 | Email lịch sau thanh toán, email đơn thuốc/điều trị và email file xét nghiệm sau hoàn tất khám. | Đã bổ sung code và kiểm thử đơn vị; cần áp dụng migration, cấu hình SMTP và kiểm thử tích hợp trước khi vận hành. |

---
# Notification Service — Service Specification

> **Đối chiếu code ngày 08/11/2026:** Phần 13 ghi nhận hiện trạng, giới hạn và các quyết định còn mở. Các phần 1–12 là đặc tả thiết kế trước đó, không khẳng định mọi chức năng đã được triển khai. Người dùng hiện muốn xem xét thêm email/SMS; điều này chưa thay đổi phạm vi được duyệt hoặc tự động bổ sung provider.

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

---

## 13. Đối chiếu triển khai và các vấn đề cần xử lý — 08/11/2026

> **Cập nhật 09/11/2026:** Phần này phản ánh code đang có trong workspace. SSE là kênh đồng bộ trạng thái công việc, không phải lịch sử sự kiện cho từng lễ tân hay Web Push khi đóng trang. Các phần 1–12 là thiết kế, không phải cam kết mọi tính năng đã được triển khai.

### 13.1. Phạm vi và cách đọc

- **Đã có trong code** nghĩa là có implementation; không đồng nghĩa đã chạy thành công trên môi trường Docker hiện tại hoặc đã kiểm thử end-to-end mọi trường hợp.
- **Thiết kế/đề xuất** và **quyết định còn mở** là công việc tương lai, không phải chức năng đang hoạt động. Phần này cập nhật hiểu biết về code mà không tự thay đổi quy định phòng khám.
- Luồng inbox bệnh nhân/bác sĩ và chuông công việc chung của lễ tân là hai cơ chế khác nhau. Việc ghi case, xác minh thanh toán hay gọi hàng đợi thuộc service nghiệp vụ tương ứng, không chuyển ownership sang Notification Service.

### 13.2. Thông báo trên website: hiện trạng

- Notification Service nhận các event đang được khai báo từ RabbitMQ, lưu pending event, xử lý định kỳ, phân giải tài khoản nhận qua Patient/Doctor Service, tạo notification và delivery `IN_APP`. Code có cơ chế chống tạo trùng theo event, tài khoản nhận và template, cùng retry xử lý pending event. Cần tiếp tục kiểm thử thực tế khi broker và các service phụ thuộc gián đoạn.
- Chuông Patient/Doctor dùng `GET /api/notifications/in-app/stream` với JWT; backend lấy account từ token và chỉ gửi tín hiệu cho các phiên của account đó. Thông báo mới và thay đổi trạng thái đọc ghi tín hiệu vào outbox trong cùng transaction; relay chuyển qua RabbitMQ tới các instance. SSE chỉ báo thay đổi, nội dung và quyền đọc vẫn do API inbox hiện có kiểm tra.
- Frontend không còn polling chuông cá nhân 15 giây; tải lại inbox khi có SSE, khi kết nối/kết nối lại và khi quay về tab. Sau khi RabbitMQ kết nối lại, Notification Service yêu cầu các phiên đang mở đồng bộ lại. Không phát lại các thay đổi đã xuất hiện rồi biến mất trong lúc mất kết nối và không hỗ trợ Web Push khi đóng trang.
- Kết nối cá nhân được đóng khi access token hết hạn để lần kết nối tiếp theo được xác thực lại. Khi tài khoản frontend thay đổi, chuông đóng kết nối cũ và xóa trạng thái hiển thị của tài khoản trước.
- Relay sự kiện Appointment, Billing, Queue và Consultation được điều chỉnh kiểm tra outbox khoảng 1 giây/lần. Notification Service thử xử lý pending ngay khi nhận event; chu kỳ 10 giây trong backend vẫn là cơ chế thử lại, không phải polling của frontend. Thời gian thực tế còn tùy tải và các service phụ thuộc.
- **Patient:** event lịch đã đặt, hủy, đổi giờ hoặc đổi bác sĩ; hóa đơn được tạo, thanh toán xác nhận hoặc từ chối; lượt chờ được tạo, gọi, đưa lại hàng đợi hoặc hủy. Event gọi lượt quá hạn trước lúc xử lý được bỏ qua theo điều kiện trong code.
- **Doctor:** thay đổi lịch được phân công và được phân công tư vấn; việc phân giải người nhận phụ thuộc dữ liệu và event thực tế.
- Danh sách event trong code là phạm vi consumer hỗ trợ, không chứng minh mọi event đã được phát và nhận thành công trong mọi luồng. Cần kiểm thử từ thao tác gốc tới inbox và phân quyền từng người nhận.
- Có worker SMTP cho ba email được mô tả ở mục dưới; các nhóm email khác, SMS và push chưa được triển khai. SMTP `AUTH_SMTP_*` phục vụ Auth, còn Notification dùng cấu hình SMTP riêng.
- Chưa có scheduler hoàn chỉnh cho nhắc lịch, nhắc thuốc hoặc điều trị theo giờ. Không coi thông báo đã đọc là bằng chứng bệnh nhân uống thuốc hay thực hiện điều trị.

### 13.3. Công việc chung của lễ tân: hiện trạng

- Chuông hiển thị công việc chung, không tạo bản sao inbox riêng cho từng lễ tân. Khi có tín hiệu SSE, giao diện tải lại nhóm liên quan; khi kết nối hoặc kết nối lại, giao diện tải lại các nhóm. Khi quay lại tab, giao diện tải lại trạng thái. Không còn polling định kỳ 15 giây; nếu SSE hoặc RabbitMQ gián đoạn, dữ liệu có thể không tự cập nhật cho đến khi kết nối phục hồi, chuyển lại tab hoặc người dùng làm mới.
- Trên trang đang tải, frontend so sánh việc chưa nhận để phát hiệu ứng, kể cả khi một việc mới thay thế việc cũ và tổng số không đổi. Không bảo đảm phát hiệu ứng cho mọi thay đổi, ví dụ việc xuất hiện rồi biến mất trong lúc mất kết nối; khi đóng trang chưa có Web Push.
- **Tiếp nhận:** ghi nhận bệnh nhân có lịch đã đến tạo case chờ; đăng ký vãng lai hiện tạo appointment `WALK_IN` rồi yêu cầu tạo case chờ. Danh sách có trạng thái chờ xác minh, tiếp nhận, thanh toán hoặc thử lại khi dữ liệu tương ứng được ghi nhận. Người dùng có thể nhận, gia hạn, trả việc và mở case.
- Receptionist Service trả mã case ổn định `caseCode` trong danh sách, khi mở và khi xem case; mã được tính từ ID hiện có, không phải cột mới hay mã tra cứu độc lập. Chuông hiển thị mã do backend trả về.
- **Thanh toán:** chuyển khoản thủ công đang chờ xác minh có hàng đợi claim riêng; người giữ việc có thể xác nhận/từ chối theo điều kiện invoice và payment. Ghi nhận chuyển khoản không tự trở thành thanh toán tiền mặt.
- **Tiền mặt:** lễ tân ghi nhận thu tiền tại quầy; giao dịch không nằm trong hàng đợi chuyển khoản chờ xác minh. API xác nhận/từ chối chuyển khoản thủ công cũ đã được sửa để yêu cầu claim còn hạn; client cũ gọi thẳng mà chưa nhận việc có thể nhận `409 CLAIM_REQUIRED`.
- **Lịch cần phân công lại:** nhân viên đánh dấu lịch và lý do; người nhận có thể xử lý theo API lịch hiện có. Không tự phát hiện bác sĩ nghỉ/ngừng hoạt động.
- **Hàng đợi quá hạn:** ticket đã gọi và quá `callExpiresAt` có thể được nhận hỗ trợ. Đánh dấu đã hỗ trợ không tự đổi trạng thái khám, gọi lại hay đánh dấu vắng mặt.
- Claim thông thường có thời hạn 5 phút. Backend dùng cập nhật có điều kiện để cạnh tranh nhận việc; việc xác minh/admit case, quyết định giao dịch chuyển khoản, thao tác đối với lịch đang chờ phân công lại và đánh dấu hỗ trợ có kiểm tra điều kiện/quyền tương ứng. Không suy diễn rằng claim của case đã khóa mọi hành động khác tại mọi service.
- Không có quản lý ca lễ tân: công việc còn hợp lệ tồn tại ngoài giờ. Chưa có quy tắc đóng việc theo 07:00–17:00, chuyển ca hoặc tự thông báo thời điểm sẽ xử lý.

**Tín hiệu cập nhật:** Receptionist, Billing, Appointment và Queue ghi tín hiệu nhóm công việc vào outbox trong cùng giao dịch với dữ liệu liên quan. Relay kiểm tra outbox khoảng 1 giây/lần và gửi qua RabbitMQ; Notification Service chuyển tín hiệu SSE tới các phiên lễ tân. Hạn claim và hạn gọi queue có tín hiệu được đặt lịch. Nếu giao dịch nghiệp vụ rollback, tín hiệu trong giao dịch đó cũng rollback. Khi trigger/outbox lỗi, thao tác ghi tương ứng có thể lỗi theo.

**API mới qua gateway:**

- Tiếp nhận: `GET /api/reception/work`, `POST /api/reception/work/{id}/claim` và `/release`.
- Thanh toán: `GET /api/billing/payment-reviews`, `POST /api/billing/payment-reviews/{id}/claim` và `/release`.
- Lịch: `POST /api/appointment/appointments/{id}/reassignment-required`; `GET /api/appointment/reception/reassignments` và `POST .../{id}/claim`, `.../{id}/release`.
- Hàng đợi: `GET /api/queue/reception/overdue` và `POST .../{id}/claim`, `.../{id}/release`, `.../{id}/complete`.
- SSE: `GET /api/notifications/reception/work-stream`, chỉ cho `RECEPTIONIST` và `ADMIN` sau xác thực. ID trong API do frontend lấy từ backend; lễ tân không cần nhập UUID.

**Áp dụng thay đổi:** có 8 migration mới trong bốn service: mỗi service có một migration cho claim và một migration cho outbox/trigger SSE. Cần build image migration và service tương ứng, áp dụng migration thành công rồi khởi động lại frontend, Notification, Receptionist, Billing, Appointment và Queue; RabbitMQ phải sẵn sàng. Migration đã được thử trên database tạm, chưa được tự áp dụng vào database đang dùng. Không cần xóa volume để áp dụng.

SSE inbox cá nhân bổ sung thêm migration `20261109140000_personal_inbox_signals` của Notification Service. Để áp dụng phần này cần build frontend, notification-service, notification-migrate và các service có relay được điều chỉnh; chạy notification-migrate trước khi khởi động image mới. Cần kiểm tra log và trạng thái database thực tế trước khi kết luận đã áp dụng.

### 13.4. Giới hạn và tồn đọng cần xử lý

**Cập nhật luồng tiếp nhận:** Chuông lễ tân hiển thị danh sách case duy nhất. Người ghi nhận đến giữ case vô thời hạn; chủ case hoặc Admin có thể trả lại khi không có thao tác đang chạy. Appointment và Billing đặt khóa thao tác qua gRPC Receptionist trước khi thay đổi lịch hoặc xử lý thanh toán. Khi Billing phát sự kiện thanh toán thành công, Receptionist tiếp tục admit; sau khi tạo lượt chờ, case hiển thị thông báo cho chủ case với mã số/phòng nếu có. Xác minh hoặc từ chối chuyển khoản thực hiện trong case.

Thay đổi này cần migration `20261109150000_admission_completion_notice` và image tương ứng. Khóa thao tác được giữ an toàn khi service không liên lạc được; nếu tiến trình bị dừng đột ngột hoặc phản hồi gRPC bị mất, khóa có thể cần được xử lý vận hành sau khi xác minh thao tác downstream đã kết thúc. Chưa xem đây là bảo đảm tự phục hồi sau mọi sự cố phân tán; cần kiểm thử E2E với RabbitMQ và các service đã cập nhật.

**Email mới theo yêu cầu — tình trạng code:**

- Khi thanh toán hoàn tất, gửi email xác nhận thông tin lịch khám theo bố cục phiếu mẫu: thông tin người bệnh cần thiết, mã lịch, dịch vụ, bác sĩ/phòng và giờ theo dữ liệu thực, thông tin thanh toán. Chỉ hiển thị số thứ tự nếu thực sự đã được cấp; không tự tạo số giả.
- Khi bác sĩ hoàn tất lượt khám, gửi một email có nội dung đơn thuốc và kế hoạch điều trị ngay trong thư. Phải xác định các bản đã phát hành/có hiệu lực thuộc đúng lượt khám và người bệnh; không mặc định lấy bản nháp hoặc bản đã hủy.
- Gửi một email riêng với lời giới thiệu và các file kết quả xét nghiệm đính kèm. Theo lựa chọn của người dùng, chỉ lấy file có sẵn tại thời điểm hoàn tất khám, không tự gửi thêm file xuất hiện sau đó. Cần xác định và kiểm thử hành vi khi không có file hoặc file chưa sẵn sàng.
- Không thực hiện nhắc uống thuốc theo giờ. Yêu cầu gửi nội dung đơn thuốc/điều trị và file xét nghiệm trực tiếp qua email thay đổi đề xuất trước đó về chỉ gửi liên kết đăng nhập; nội dung là dữ liệu y tế và email sau khi gửi không thể thu hồi. Cần kiểm tra chính xác địa chỉ nhận và quyền truy cập dữ liệu trước khi triển khai.
- Hiện `medical.encounter_finalized.v1` đã được ghi vào Medical Record outbox kèm `patientId` và `encounterId`; còn phải nối publish/consume và lấy thông tin từ các service có quyền. Prescription có `ISSUED`; Treatment Plan có `DRAFT`, `ACTIVE`, `COMPLETED`, `CANCELLED`. File xét nghiệm hiện thuộc luồng bác sĩ, lưu `UPLOADED` và scan `PENDING`; không tự coi đã công bố hoặc đã quét sạch.
- Đã bổ sung xác minh địa chỉ email bệnh nhân bằng liên kết một lần. Cả ba email hiện chỉ được gửi tới địa chỉ đã xác minh của tài khoản bệnh nhân đang hoạt động; tài khoản seed không tự được coi là đã xác minh. Link yêu cầu đăng nhập đúng tài khoản, hết hạn sau 30 phút.
- Notification ghi job theo event và loại thư, lấy thông tin tối thiểu qua gRPC nội bộ và gửi SMTP bất đồng bộ. Job chưa xác minh chờ kiểm tra lại sau một giờ; lỗi tạm thời được thử lại sau một phút. `SENT` nghĩa là SMTP đã chấp nhận thư, không chứng minh người bệnh đã nhận hoặc đọc; có thể gửi trùng nếu SMTP chấp nhận nhưng việc ghi trạng thái bị lỗi.
- Email kết quả không được gửi nếu chưa có file tại thời điểm hoàn tất. File được giới hạn tổng 10 MiB, kiểm tra kích thước và SHA-256; trạng thái quét mã độc hiện vẫn là `PENDING`, hệ thống chưa có máy quét. Nếu file vượt giới hạn hoặc dịch vụ phụ thuộc lỗi, job chờ thử lại.
- Upload file và chuyển trạng thái hoàn tất có khóa phối hợp để tránh gửi file tải lên sau thời điểm hoàn tất. Cần phương án vận hành phục hồi khóa khi document-service dừng đột ngột hoặc mất phản hồi trong lúc upload; không tự xóa khóa khi chưa xác định upload đã dừng.
- Cấu hình SMTP thông báo dùng `NOTIFICATION_SMTP_*` và `NOTIFICATION_EMAIL_FROM`; email xác minh dùng `AUTH_SMTP_*`, `AUTH_EMAIL_FROM` và `AUTH_EMAIL_VERIFICATION_URL`. Chưa có SMS. Không gửi thư thử tới tài khoản seed thật khi chạy kiểm thử tự động.

1. **Lịch online mới:** giao diện bàn lễ tân đã có toast qua luồng SSE lịch hẹn hiện có khi nhận được sự kiện đặt lịch. Việc này chưa tự tạo case tiếp nhận hay một công việc cần claim. Lịch mới không đồng nghĩa bệnh nhân đã đến; cần kiểm thử toast trên môi trường thực tế và phân biệt nó với hàng đợi tiếp nhận.
2. **Bác sĩ nghỉ/không hoạt động:** chưa tự xác định các appointment bị ảnh hưởng hoặc tạo việc phân công lại cho lễ tân. Doctor ghi `doctor.availability_changed`/`doctor.status_changed` vào outbox, nhưng chưa xác nhận đường publish-consume/reconciliation hoàn chỉnh sang Appointment và công việc lễ tân.
3. **Quyền xuyên service:** claim của ReceptionCase chưa được Billing kiểm tra cho mọi đường thu tiền; chưa khẳng định mọi thay đổi appointment, hóa đơn, queue hoặc mọi thao tác cũ đều bị ràng buộc bởi cùng một chủ case. Thiết kế authorization và idempotency từng service trước khi coi đây là khóa toàn quy trình.
4. **Thông tin trên case:** tên bệnh nhân và mã lịch được frontend lấy từ service khác; khi dependency lỗi có thể chỉ hiện tên mặc định hoặc thiếu mã lịch. Xem xét giới hạn số request, trạng thái lỗi/retry và không tiết lộ dữ liệu vượt quyền.
5. **Đã có lịch nhưng case tạo lỗi:** frontend vãng lai cảnh báo trường hợp appointment đã tạo nhưng case chưa tạo. Cần cơ chế tìm lại và tiếp tục an toàn, không tự đặt thêm lịch hoặc mặc định đã check-in.
6. **Hết hạn claim và lỗi phân tán:** cần kiểm chứng đầy đủ yêu cầu chạy quá thời hạn, client/service chết, phản hồi gRPC đến muộn và các bước đã commit; downstream phải bảo đảm idempotency/fencing thích hợp. Một lease đơn thuần không chứng minh mọi side effect chỉ xảy ra một lần.
7. **Quan sát và trạng thái:** xác minh thực tế pagination khi dữ liệu thay đổi, kết nối lỗi/hết phiên, reload, nhiều tab và nhận việc khi trang đang ẩn. Cần làm rõ màn hình lỗi, cách thử lại, audit và vận hành khi công việc kẹt.
8. **Email/SMS:** ba email mới đã có SMTP worker theo phạm vi ở trên; cần kiểm thử tích hợp, hoàn thiện vận hành và quản lý vòng đời delivery. SMS và các email khác chưa triển khai.
9. **Kiểm thử thực tế:** cần áp dụng các migration/image tương ứng và chạy E2E với hai tài khoản lễ tân, database và service thật; không khẳng định hoạt động ổn định chỉ từ unit/integration test.
10. **Giới hạn SSE:** tín hiệu đến các instance đang kết nối và frontend đồng bộ lại trạng thái hiện tại sau khi kết nối lại. Chưa có lịch sử để phát lại mọi thay đổi đã xuất hiện rồi biến mất khi mất kết nối; cần thiết kế thêm nếu nghiệp vụ yêu cầu không bỏ sót từng sự kiện.

### 13.5. Doctor nghỉ và trạng thái: code hiện tại và quyết định nghiệp vụ

- `DoctorStatus` có `DRAFT`, `ACTIVE`, `INACTIVE`; bác sĩ `ACTIVE` có thể tạo khoảng nghỉ `UNAVAILABLE` của chính mình. Override có trạng thái `ACTIVE` hoặc `CANCELLED`, được áp dụng sau khi tạo; code hiện không có trạng thái chờ duyệt cho yêu cầu nghỉ.
- Khi tạo khoảng nghỉ, `startAt` phải sau thời điểm hiện tại và trước `endAt`; thời lượng tối đa 31 ngày. **Không có quy tắc bắt buộc báo trước 24 giờ** trong logic tạo hiện tại. Lý do bao gồm nghỉ ốm, cá nhân, đào tạo và khẩn cấp.
- `UNAVAILABLE` được trừ khỏi availability khi tính lịch mới; nó không tự hủy/đổi những lịch đã đặt. Trạng thái bác sĩ `INACTIVE` khác với một khoảng nghỉ có thời gian xác định.
- **Cần người sở hữu nghiệp vụ quyết định:** có cần quản lý duyệt trước khi nghỉ có hiệu lực; nghỉ thông thường có phải báo trước 24 giờ; ngoại lệ bệnh/khẩn cấp, người được phép phê duyệt và thời hạn xử lý. Không mặc định 24 giờ hoặc tự coi đã được duyệt.
- Khi bệnh nhân đồng ý đổi bác sĩ/giờ: kiểm tra lịch trống và phòng, cập nhật appointment, thông báo người liên quan; cần làm rõ phí/chênh lệch và cách ghi nhận đồng ý. Nếu case/hóa đơn đã mở, giữ lịch sử và kiểm tra lại điều kiện; không tự xóa/tạo lại hồ sơ. Sau admit/check-in, encounter và queue có thể đã tồn tại nên cần quy trình riêng.

### 13.6. Kịch bản ngoại lệ cần kiểm thử và chốt kết quả mong đợi

**Đã kiểm thử trên hạ tầng tạm:** hai tài khoản cùng nhận công việc, kiểm tra claim chuyển khoản, chặn admit đồng thời, thử lại sau lỗi tạo queue, migration bốn service, rollback tín hiệu cùng transaction, phát tín hiệu RabbitMQ tới hai instance và frontend tải lại sau kết nối SSE. Đã kiểm tra TypeScript; một test giao diện hết thời gian khi máy quá tải và chạy riêng đã qua. Đây chưa phải kiểm thử toàn bộ trình duyệt với dữ liệu triển khai thực tế.

**Inbox cá nhân:** PostgreSQL/RabbitMQ tạm đã được dùng để kiểm tra thông báo mới, thay đổi đã đọc, hai phiên cùng account, account khác không nhận tín hiệu, rollback và đồng bộ sau khi broker kết nối lại. Frontend được kiểm tra bỏ polling và tải lại khi nhận SSE/kết nối lại. Vẫn cần kiểm tra E2E trên môi trường chạy thực tế sau khi áp dụng migration và image mới.

- Hai lễ tân cùng nhận, gia hạn, trả hoặc thao tác case; claim hết hạn rồi người khác nhận; người giữ cũ gửi lại lệnh; cùng tài khoản mở hai tab.
- Thanh toán tiền mặt, chuyển khoản chờ/đã duyệt/từ chối và callback VNPay đến trễ hoặc lặp; version invoice đã đổi; chủ case và người xử lý thanh toán khác nhau.
- Appointment đã tạo nhưng tạo case thất bại; cùng lịch được ghi nhận đến hai lần; bệnh nhân có nhiều lịch hoặc vãng lai dùng hồ sơ đã có.
- Mất mạng sau khi backend commit nhưng frontend chưa nhận response; Reception/Billing/Appointment/Queue/Medical Record lỗi hoặc phục hồi tại từng bước; thử lại không tạo trùng invoice, encounter, check-in hay ticket.
- Đổi bác sĩ/giờ trước khi tiếp nhận, trong lúc chờ thanh toán và sau check-in; bác sĩ mới hết slot, phòng thay đổi, giá thay đổi hoặc bệnh nhân không đồng ý.
- Bác sĩ đăng ký/hủy nghỉ trùng lịch đã đặt; nghỉ sát giờ/khẩn cấp; nhiều khoảng nghỉ chồng nhau; bác sĩ ngừng hoạt động rồi hoạt động lại; event lặp, đến sai thứ tự hoặc bị bỏ lỡ.
- Ticket quá hạn nhưng đã bắt đầu khám, được gọi lại, hủy hoặc chuyển phòng trước khi lễ tân thao tác; không tự đánh dấu vắng mặt khi chưa có quy trình.
- Lịch hoặc công việc phát sinh ngoài giờ, hai lễ tân đăng xuất, dữ liệu vẫn còn tới hôm sau; xác định việc nào hết hạn nghiệp vụ và ai chịu trách nhiệm xử lý.
- Notification event lặp, sai schema, thiếu người nhận hoặc service phân giải danh tính lỗi; số việc không đổi nhưng có công việc mới thay thế; kiểm tra read/unread, badge và hoạt động khi tab bị ẩn.
