# Quy ước gRPC nội bộ

> **Status:** APPROVED cho transport/security; DESIGN cho các giá trị timeout cụ thể.  
> Áp dụng cho mọi synchronous service-to-service call. Public client không gọi gRPC này và gRPC không đi qua Kong.

## 1. Boundary và versioning

- Proto dùng proto3, package maternal.<domain>.v1; file owner nằm tại docs/grpc/<domain>/v1/.
- Owner định nghĩa service/method/request/response của mình. Message là contract view tối thiểu, không phải shared DB entity.
- Chỉ shared primitives nằm trong maternal.common.v1: RequestContext, Money, PageRequest, PageInfo và enum hạ tầng thật sự chung nếu phát sinh.
- Business enum nằm trong owner package; không đặt AppointmentStatus, PaymentMethod, role hay rank vào common.proto.
- Field number đã phát hành không reuse. Field xóa phải reserved trong lần sửa sau. Thêm field theo hướng backward-compatible; breaking change tạo v2.
- Không dựa vào unknown field để thực thi authorization hoặc invariant.

## 2. Authentication và authorization

Mỗi call mang service JWT trong gRPC metadata:

| Metadata | Required | Quy tắc |
|---|---:|---|
| authorization | Yes | Bearer <service-jwt> |
| x-request-id | Yes | UUID; tạo mới tại entry point nếu thiếu |
| x-correlation-id | Yes | Giữ xuyên workflow/event |
| traceparent | Recommended | W3C Trace Context |

Service JWT:

- ký RS256 bằng private key của workload identity; receiver verify bằng public key/JWKS đã cấu hình;
- claims tối thiểu: iss, sub (caller service), aud (owner service), iat, exp, jti;
- TTL ngắn; allowlist issuer/audience/algorithm; reject alg none và token user dùng sai audience;
- không chứa Patient PII/PHI, payload nghiệp vụ, password hoặc secret;
- key rotation theo kid, có overlap hợp lý; clock skew bounded;
- transport production dùng TLS/mTLS theo hạ tầng được duyệt. Service JWT vẫn bắt buộc nếu mTLS được bật.

Owner authorize theo caller service + RPC + resource/purpose. RequestContext.actor_account_id/actor_role chỉ truyền actor gốc để audit/delegated authorization; không thay thế service authentication và không được tin nếu caller không được phép delegate.

## 3. RequestContext và correlation

- Mọi request business dùng maternal.common.v1.RequestContext.
- request_id định danh một attempt; correlation_id giữ nguyên toàn use case; causation_id trỏ request/event làm nguyên nhân.
- Write RPC bắt buộc idempotency_key ổn định qua retry. Read RPC để rỗng.
- Metadata và body context phải khớp request/correlation ID; mismatch trả INVALID_ARGUMENT và audit security signal.
- Không đặt raw Authorization, national ID, diagnosis hoặc payment detail vào context/log tag.

## 4. Deadline, retry và cancellation

- Caller bắt buộc đặt deadline; server reject call không deadline cho write quan trọng nếu framework cho phép.
- **DESIGN default:** read 800 ms, simple write 1.5 s, orchestrated step 3 s; từng spec được phép siết chặt nhưng không được vô hạn.
- Chỉ retry UNAVAILABLE và DEADLINE_EXCEEDED khi operation read-only hoặc write idempotent. Không retry lỗi validation/auth/business conflict.
- **DESIGN default:** tối đa 2 retry, exponential backoff + jitter, tổng thời gian không vượt deadline/workflow budget.
- Server theo dõi cancellation và dừng công việc chưa commit. Deadline sau commit là outcome ambiguous; caller lookup/retry cùng idempotency key, không tạo key mới.

## 5. Idempotency và concurrency

Write RPC lưu hoặc enforce unique theo scope (caller service, operation, idempotency_key):

- cùng key + cùng canonical request hash: trả cùng outcome/resource;
- cùng key + payload khác: ALREADY_EXISTS với ErrorInfo reason IDEMPOTENCY_KEY_REUSED;
- concurrent duplicate: chỉ một mutation/event;
- retention phải dài hơn retry/reconciliation window và được ghi trong owner spec.

Optimistic version/business unique constraint vẫn cần nếu invariant không được bảo vệ chỉ bằng idempotency.

## 6. Status và error detail

Dùng canonical gRPC status:

| Status | Ý nghĩa |
|---|---|
| INVALID_ARGUMENT | Field/context không hợp lệ |
| UNAUTHENTICATED | Thiếu/sai service JWT |
| PERMISSION_DENIED | Caller/actor không có quyền |
| NOT_FOUND | Resource không tồn tại hoặc conceal theo policy |
| ALREADY_EXISTS | Duplicate/idempotency key conflict |
| FAILED_PRECONDITION | State/business prerequisite chưa đạt |
| ABORTED | Optimistic lock/race; caller có thể reread |
| RESOURCE_EXHAUSTED | Rate/capacity limit |
| DEADLINE_EXCEEDED | Không hoàn tất trong deadline |
| UNAVAILABLE | Dependency/service tạm unavailable |
| INTERNAL | Lỗi ngoài dự kiến; không lộ stack/SQL |

Error detail nên dùng google.rpc.ErrorInfo/BadRequest/RetryInfo khi toolchain đã hỗ trợ. reason là stable UPPER_SNAKE_CASE; metadata không chứa PII/PHI. Không trả raw downstream error.

## 7. Pagination, time và money

- Cursor opaque qua PageRequest.page_token/PageInfo.next_page_token; page_size default/maximum do owner spec quy định.
- Timestamp là google.protobuf.Timestamp UTC; business date được diễn giải theo Asia/Ho_Chi_Minh và phải ghi rõ boundary inclusive/exclusive.
- Money là int64 amount_minor + ISO currency code. MVP owner reject currency khác VND; không dùng float/double.

## 8. Observability và audit

Log có request_id, correlation_id, caller service, RPC, status, duration và retry count; không log token hoặc full message có PII/PHI. Metrics tối thiểu: request count, latency, status, deadline exceeded, auth failure, idempotent replay. Sensitive read/write và manual override phát audit event theo catalog.

## 9. Health và reflection

- gRPC Health Checking Protocol cho liveness/readiness; liveness không gọi dependency.
- Reflection chỉ bật trong môi trường nội bộ được kiểm soát, tắt ở production trừ khi có approval.
- Readiness có thể phản ánh dependency bắt buộc nhưng phải tránh cascading restart.

## 10. Contract testing checklist

- protoc/buf lint và breaking check với version đã phát hành.
- Positive/negative service JWT: issuer, audience, exp, kid, alg.
- Deadline/cancellation; retry chỉ đúng status.
- Idempotent replay, key reuse payload khác, concurrent duplicates và lost response after commit.
- Authorization theo caller/resource/purpose; minimum necessary response.
- Unknown fields và mixed-version clients không phá contract.
