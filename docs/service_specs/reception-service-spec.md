# Receptionist Service Specification

> **Service:** `receptionist-service`  
> **Port:** `5005`  
> **Public gateway path:** `/api/receptionists`  
> **Status:** Receptionist profile operations implemented; Admission orchestration blocked by downstream contracts  
> **Scope decision:** Chỉ quản lý hồ sơ nghiệp vụ cơ bản của lễ tân. Không quản lý ca làm.

---

## 1. Mục tiêu và boundary

Receptionist Service có hai trách nhiệm kiến trúc:

1. Quản lý hồ sơ nghiệp vụ tối thiểu của lễ tân để xác định ai được thực hiện tiếp nhận.
2. Trong phase tương lai, làm process manager/Saga orchestrator cho quy trình bệnh nhân đến quầy, đối chiếu hồ sơ, thanh toán và vào khám.

### Chịu trách nhiệm hiện tại

- Ánh xạ một Auth account role `RECEPTIONIST` với một hồ sơ Receptionist nội bộ.
- Quản lý `employeeCode`, thông tin hồ sơ cơ bản và trạng thái nghiệp vụ.
- Cho Receptionist xem hồ sơ và chỉ tự sửa `avatarUrl`.
- Cho Admin tìm kiếm, cập nhật và deactivate hồ sơ.
- Verify JWT RS256 của Auth Service tại chỗ.
- Optimistic concurrency, idempotency cho business POST và audit thay đổi.

### Không chịu trách nhiệm

- Tài khoản, mật khẩu, refresh token hoặc role — Auth Service sở hữu.
- Ca làm, lịch trực, chấm công, nghỉ phép hoặc availability.
- Phân công cơ sở/quầy; `department` chỉ là thông tin mô tả trên hồ sơ.
- Lương, hợp đồng, tuyển dụng, kỷ luật và dữ liệu HR khác.
- Hồ sơ bệnh nhân — Patient Service sở hữu.
- Lịch hẹn/check-in — Appointment Service sở hữu.
- Hóa đơn/thanh toán/refund — Billing Service sở hữu.
- Hồ sơ khám — Medical Record Service sở hữu.
- Số thứ tự/độ ưu tiên — Queue Service sở hữu.

Receptionist Service không query database của service khác và không thực hiện distributed transaction.

---

## 2. Kiến trúc và giao tiếp

Luồng public:

```text
Frontend → Kong → Receptionist Service
```

Khi Admission được mở, Receptionist Service gọi downstream trực tiếp bằng synchronous REST trên Docker network:

```text
Receptionist Service
├── Auth Service (chỉ create/activate staff)
├── Patient Service
├── Appointment Service
├── Billing Service
├── Medical Record Service
└── Queue Service
```

Business service không gọi vòng qua Kong. Mỗi internal client phải có timeout, request/correlation ID, service authentication đã được approve và idempotency contract cho write.

### Xác thực request hiện tại

Auth Service phát JWT với các claim:

```json
{
  "iss": "maternal-healthcare-auth",
  "aud": "maternal-healthcare-api",
  "sub": "account-uuid",
  "jti": "token-uuid",
  "role": "RECEPTIONIST"
}
```

Receptionist Service verify:

- Chữ ký `RS256` bằng `AUTH_JWT_PUBLIC_KEY`.
- `iss`, `aud`, `kid`, expiration, `sub`, `jti` và role.
- Authorization theo `ADMIN` hoặc `RECEPTIONIST` trên từng endpoint.
- Own access bằng `Receptionist.accountId == JWT.sub`; không tin receptionist ID do client tự khai.

JWT được verify tại service ngay cả khi request đi qua Kong.

---

## 3. Domain và database

Receptionist Service sở hữu PostgreSQL riêng qua `RECEPTIONIST_DATABASE_URL`.

### Enum

```text
ReceptionistStatus = DRAFT | ACTIVE | INACTIVE
```

State machine:

```text
DRAFT ─────→ ACTIVE
  │             │
  └────────────→INACTIVE
                │
                └────→ ACTIVE
```

- Create mặc định `DRAFT`.
- Activate yêu cầu Auth account tồn tại, `ACTIVE` và có role `RECEPTIONIST`.
- Deactivate giữ nguyên lịch sử/audit.
- `ACTIVE` là điều kiện local để thực hiện Admission trong phase tương lai.

### Entity `Receptionist`

| Field | Type | Constraint |
|---|---|---|
| `id` | UUID | PK, immutable |
| `accountId` | UUID | Unique, immutable, external Auth reference |
| `employeeCode` | string | Unique, uppercase, 2–30 ký tự |
| `status` | enum | Default `DRAFT` |
| `version` | integer | `>=1`, optimistic lock |
| `createdByAccountId` | UUID | Admin actor |
| `updatedByAccountId` | UUID | Actor cập nhật gần nhất |
| `createdAt` | timestamptz | DB timestamp |
| `updatedAt` | timestamptz | Auto update |

### Entity `ReceptionistProfile`

| Field | Type | Constraint |
|---|---|---|
| `receptionistId` | UUID | PK/FK local, quan hệ 1–1 |
| `fullName` | string | Trim/collapse space, 2–150 ký tự |
| `loginEmail` | string/null | Lowercase, email hợp lệ, unique; bản sao tham chiếu từ Auth |
| `workPhone` | string/null | Normalize E.164/VN, tối đa 20 ký tự |
| `address` | string/null | Trim/collapse space, tối đa 500 ký tự |
| `department` | string/null | Thông tin mô tả, tối đa 100 ký tự |
| `gender` | enum/null | `FEMALE`, `MALE`, `OTHER` |
| `avatarUrl` | string/null | URL HTTP(S), tối đa 2048 ký tự |
| `createdAt` | timestamptz | DB timestamp |
| `updatedAt` | timestamptz | Auto update |

`loginEmail` phục vụ hiển thị/tìm kiếm và phải đồng bộ từ Auth Service; Auth vẫn là source of truth cho đăng nhập. Receptionist Service không lưu password hoặc token.

### Technical records

`ReceptionIdempotencyRecord`:

- Unique `(actorId, operation, idempotencyKey)`.
- Lưu request hash, resource ID, response status và expiration.
- Cùng key/cùng normalized payload trả lại kết quả cũ.
- Cùng key/payload khác trả `409 IDEMPOTENCY_KEY_REUSED`.

`ReceptionAuditLog`:

- Append-only.
- Lưu event type, actor ID, aggregate references, changed-field names, reason code, request ID và timestamp.
- Không lưu raw changed-values của email, workPhone, address, token, password hoặc PII không cần thiết.

### Admission persistence reserved for future

Schema dành trước các bảng:

- `ReceptionCase`
- `IdentityVerification`
- `Admission`
- `AdmissionStatusHistory`

Các bảng này không có HTTP route production cho đến khi downstream release gate được mở. Việc tồn tại schema không có nghĩa Admission đã được triển khai.

---

## 4. API hiện tại

### Quy ước

- Service-local paths: `/health`, `/receptionists`.
- Timestamp: ISO-8601 UTC.
- Mutable update bắt buộc `version`.
- Business POST bắt buộc `Idempotency-Key` UUID.
- ValidationPipe: whitelist, reject field ngoài DTO, transform query.

Success envelope, trừ `/health`:

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

Error envelope:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The receptionist record was updated by another request",
    "requestId": "uuid"
  }
}
```

### Endpoint summary

| ID | Method | Path | Permission | Trạng thái |
|---|---|---|---|---|
| API-001 | GET | `/health` | Public/internal | Implemented |
| API-002 | POST | `/receptionists` | `ADMIN` | `BLOCKED_BY_AUTH` |
| API-003 | GET | `/receptionists` | `ADMIN` | Implemented |
| API-004 | GET | `/receptionists/me` | `RECEPTIONIST`, own | Implemented |
| API-005 | GET | `/receptionists/{id}` | Own hoặc `ADMIN` | Implemented |
| API-006 | PATCH | `/receptionists/me` | `RECEPTIONIST`, own | Implemented |
| API-007 | PATCH | `/receptionists/{id}` | `ADMIN` | Implemented |
| API-008 | POST | `/receptionists/{id}/activate` | `ADMIN` | `BLOCKED_BY_AUTH` |
| API-009 | POST | `/receptionists/{id}/deactivate` | `ADMIN` | Implemented |


### API-001 — Health

```http
GET /health
```

```json
{ "status": "ok" }
```

Liveness không gọi dependency.

### API-002 — Create Receptionist — BLOCKED_BY_AUTH

Request dự kiến:

```json
{
  "accountId": "uuid",
  "employeeCode": "LT-001",
  "profile": {
    "fullName": "Nguyễn Thị Lan",
    "loginEmail": "lan.receptionist@example.com",
    "workPhone": "+84901234567",
    "address": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "department": "Khoa Phụ sản",
    "gender": "FEMALE"
  }
}
```

Route chưa được đăng ký vì Auth Service chưa có internal API/event projection xác nhận account tồn tại, active và có đúng role. Không được bỏ validation hoặc query Auth DB trực tiếp.

### API-003 — List Receptionists

```http
GET /receptionists?status=ACTIVE&q=LT-001&cursor=<uuid>&limit=20
```

- Chỉ `ADMIN`.
- `q` tìm `employeeCode`, `fullName` hoặc `loginEmail`.
- Cursor pagination ổn định, limit tối đa 100.
- Không trả token hoặc gọi Auth khi list; `loginEmail` là bản sao local trên profile.

### API-004 — Own profile

```http
GET /receptionists/me
```

- Chỉ `RECEPTIONIST`.
- Resolve bằng JWT `sub`.
- Không nhận receptionist ID từ client.
- Không có mapping trả `404 RECEPTIONIST_PROFILE_NOT_FOUND`.

### API-005 — Profile by ID

```http
GET /receptionists/{receptionistId}
```

- Admin xem mọi record.
- Receptionist chỉ xem record có `accountId == JWT.sub`.
- Không có public Patient view.

### API-006 — Update own profile

```http
PATCH /receptionists/me
```

```json
{
  "avatarUrl": "https://cdn.example.com/receptionists/avatar-01.jpg",
  "version": 1
}
```

- Own Receptionist chỉ sửa `avatarUrl`; `null` để xóa avatar.
- Reject `fullName`, `loginEmail`, `workPhone`, `address`, `department`, `gender`, `employeeCode`, `accountId`, `status` và server fields.
- No-op normalized update không tăng version/audit.

### API-007 — Admin update profile

```http
PATCH /receptionists/{receptionistId}
```

```json
{
  "employeeCode": "LT-002",
  "profile": {
    "fullName": "Nguyễn Thị Lan",
    "loginEmail": "lan.receptionist@example.com",
    "workPhone": "+84901234567",
    "address": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "department": "Khoa Phụ sản",
    "gender": "FEMALE"
  },
  "version": 1,
  "reason": "Cập nhật thông tin nghiệp vụ"
}
```

- Admin sửa `employeeCode`, `fullName`, `loginEmail`, `workPhone`, `address`, `department` và `gender`.
- `avatarUrl` chỉ được chủ hồ sơ cập nhật qua `/receptionists/me`.
- Không dùng endpoint này đổi status.
- Actual change tăng version và ghi audit changed-field names.

### API-008 — Activate — BLOCKED_BY_AUTH

```http
POST /receptionists/{receptionistId}/activate
```

```json
{ "version": 1 }
```

Route chưa được đăng ký. Khi mở, Auth phải xác nhận account active và có role `RECEPTIONIST`; profile phải đầy đủ.

### API-009 — Deactivate

```http
POST /receptionists/{receptionistId}/deactivate
Idempotency-Key: <uuid>
```

```json
{
  "version": 1,
  "reason": "Ngừng tham gia hoạt động tiếp nhận"
}
```

- `DRAFT/ACTIVE → INACTIVE`.
- Retry cùng key/payload trả cùng kết quả.
- Nếu đã `INACTIVE`, trả `200` và không ghi success audit lần hai.
- Không xóa lịch sử nghiệp vụ.

---

## 5. Business rules hồ sơ lễ tân

| ID | Rule | Error |
|---|---|---|
| BR-OP-001 | Một Auth account ánh xạ tối đa một Receptionist. | `RECEPTIONIST_ACCOUNT_EXISTS` |
| BR-OP-002 | `employeeCode` normalize uppercase và unique. | `EMPLOYEE_CODE_EXISTS` |
| BR-OP-003 | Chỉ account active role `RECEPTIONIST` mới được create/activate. | `ACCOUNT_NOT_RECEPTIONIST`, `ACCOUNT_NOT_ACTIVE` |
| BR-OP-004 | Receptionist chỉ đọc own profile và chỉ sửa own `avatarUrl`. | `FORBIDDEN`, `FIELD_NOT_ALLOWED` |
| BR-OP-005 | Chỉ Admin sửa employee code, full name, login email, phone, address, department, gender và trạng thái. | `FORBIDDEN` |
| BR-OP-006 | Mutable write dùng optimistic version. | `VERSION_CONFLICT` |
| BR-OP-007 | Actual change phải audit; no-op không tạo change audit. | Transaction rollback nếu audit fail |
| BR-OP-008 | Không hard-delete Receptionist trong MVP. | `INVALID_STATE_TRANSITION` |
| BR-OP-009 | Receptionist phải `ACTIVE` mới thực hiện Admission tương lai. | `RECEPTIONIST_INACTIVE` |
| BR-OP-010 | Không có facility/desk/shift/leave/attendance model; department chỉ là text mô tả. | Code review boundary |

---

## 6. Admission Orchestration — FUTURE/BLOCKED

### Release gate

API-101..107 chỉ là contract định hướng. Trong phase hiện tại:

- Không đăng ký route.
- Không tạo mock/fake/hard-coded downstream response.
- Không tự đoán path, DTO hoặc error code của downstream.
- Không query database downstream.
- Chỉ triển khai sau khi đọc source/test/OpenAPI thật và chốt service authentication.

### Endpoint định hướng

| ID | Method | Path | Dependency chính |
|---|---|---|---|
| API-101 | POST | `/reception/appointments/search` | Patient, Appointment |
| API-102 | POST | `/reception/cases` | Patient, Appointment |
| API-103 | GET | `/reception/cases/{caseId}` | Local Reception DB |
| API-104 | POST | `/reception/cases/{caseId}/identity-verifications` | Local assertion + Patient snapshot/reference |
| API-105 | POST | `/reception/cases/{caseId}/admit` | Appointment, Billing, Medical, Queue |
| API-106 | POST | `/reception/cases/{caseId}/cancel` | Appointment/Billing policy |
| API-107 | POST | `/reception/walk-ins` | Future Patient/Appointment walk-in contracts |

### Quy trình nghiệp vụ đã chốt

```text
Tra cứu lịch hẹn/bệnh nhân
→ Mở ReceptionCase
→ Lễ tân đối chiếu hồ sơ
→ Xác nhận chi phí và thanh toán
→ Mở hồ sơ khám
→ Check-in Appointment
→ Cấp số thứ tự
→ Cho bệnh nhân vào khám
```

Không được cho vào khám trước khi hoàn tất đối chiếu và đáp ứng chính sách thanh toán của Billing.

### Saga dự kiến cho API-105

```text
VALIDATE_APPOINTMENT
→ CREATE_INVOICE
→ VERIFY_PAYMENT
→ OPEN_MEDICAL_RECORD
→ CHECK_IN_APPOINTMENT
→ CREATE_QUEUE_TICKET
→ DONE
```

Nguyên tắc Saga:

- Lưu checkpoint local sau mỗi downstream success.
- Chỉ tăng `currentStep` sau khi lưu external ID cần thiết.
- Retry tiếp tục từ bước dở, không chạy lại bước đã hoàn tất một cách mù quáng.
- Downstream write dùng stable idempotency key.
- Invoice chưa paid chuyển `AWAITING_PAYMENT`, không tiếp tục.
- Timeout/5xx chuyển `FAILED_RETRYABLE` khi outcome rõ ràng có thể retry.
- Outcome mơ hồ hoặc vượt retry limit chuyển `MANUAL_REVIEW`.
- Không rollback tiền/hồ sơ bằng cách sửa database downstream.

### Downstream contract tối thiểu cần có

Patient Service:

- Tìm patient với response đã giảm PII.
- Đọc hồ sơ tối thiểu để đối chiếu.
- Quy tắc masking và authorization cho Receptionist.

Appointment Service:

- Tìm appointment tại quầy.
- Đọc status/version/scheduled time/type.
- Validate eligibility và check-in idempotently.
- Lookup outcome sau timeout.

Billing Service:

- Tạo/lấy invoice idempotently.
- Kiểm tra payment authoritative.
- Chính sách tiền mặt/công nợ/refund/void.

Medical Record Service:

- Mở/lấy hồ sơ khám idempotently.
- Xử lý record nếu các bước sau thất bại vĩnh viễn.

Queue Service:

- Tạo/lấy queue ticket idempotently.
- Sở hữu priority, demotion và quy tắc đến trễ.

Auth Service:

- Internal lookup account status/role cho API-002/008.
- Service authentication; không dùng unsigned identity header.

---

## 7. Security, audit và NFR

- Không log access/refresh token, password, raw Patient PII/PHI hoặc payment detail.
- Không trả stack trace, SQL error hoặc raw downstream response.
- `X-Request-Id` hợp lệ được giữ lại; nếu thiếu service tạo UUID mới.
- Audit và domain mutation nằm cùng local transaction.
- Email, workPhone và address không được ghi raw vào audit changed-values.
- Service stateless; nhiều instance dùng chung Reception DB.
- P95 profile/list local mục tiêu ban đầu dưới 300 ms ở tải dự kiến.
- Không hard-delete hồ sơ và audit trong MVP; retention cần stakeholder approve.

---

## 8. Configuration

| Variable | Required | Example |
|---|---:|---|
| `PORT` | No | `5005` |
| `RECEPTIONIST_DATABASE_URL` | Yes | `postgresql://...@receptionist-database:5432/receptionist` |
| `AUTH_JWT_PUBLIC_KEY` | Yes | Mounted PEM |
| `AUTH_JWT_ISSUER` | Yes | `maternal-healthcare-auth` |
| `AUTH_JWT_AUDIENCE` | Yes | `maternal-healthcare-api` |
| `AUTH_JWT_KEY_ID` | Yes | `local-dev-key` |
| `AUTH_SERVICE_BASE_URL` | Khi mở API-002/008 | `http://auth-service:5003` |
| `PATIENT_SERVICE_BASE_URL` | Khi mở Admission | Docker service URL |
| `APPOINTMENT_SERVICE_BASE_URL` | Khi mở Admission | Docker service URL |
| `BILLING_SERVICE_BASE_URL` | Khi mở Admission | Docker service URL |
| `MEDICAL_RECORD_SERVICE_BASE_URL` | Khi mở Admission | Docker service URL |
| `QUEUE_SERVICE_BASE_URL` | Khi mở Admission | Docker service URL |
| `RECEPTION_IDEMPOTENCY_TTL_HOURS` | No | `24` |

---

## 9. Testing và acceptance

### Receptionist Operations

- Health trả chính xác `{ "status": "ok" }`.
- JWT đúng issuer/audience/kid/signature được chấp nhận; JWT sai bị reject.
- Non-Admin không list/update/deactivate người khác.
- Receptionist không thể sửa field ngoài `avatarUrl` của own profile.
- Version stale trả `409 VERSION_CONFLICT`.
- Employee code trùng trả `409 EMPLOYEE_CODE_EXISTS`.
- Deactivate retry cùng idempotency key không ghi audit lần hai.
- API-002/008 không tồn tại trước Auth gate.
- Không tồn tại route ca làm, lịch, nghỉ hoặc availability.
- API-101..107 không tồn tại trước downstream gate.

### Implementation hiện tại

- Nest app và port `5005`: implemented.
- `/health`, global validation, request/error envelope: implemented.
- JWT RS256, roles và own authorization: implemented.
- Receptionist/Profile read/update/deactivate: implemented.
- Reception DB, Prisma schema/migration, audit/idempotency: implemented.
- Docker Compose và Kong route `/api/receptionists`: implemented.
- Create/activate Receptionist: blocked bởi Auth internal contract.
- Admission/Saga/internal HTTP clients: blocked bởi downstream contracts.

---

## 10. Quyết định cuối cùng

Receptionist Service chỉ quản lý hồ sơ nghiệp vụ cơ bản của lễ tân. Không quản lý ca làm, lịch trực, nghỉ phép, availability, chấm công hoặc HR. Quyền thực hiện Admission tương lai dựa trên JWT role `RECEPTIONIST`, mapping hồ sơ local và `Receptionist.status == ACTIVE`, không dựa trên lịch làm việc.
