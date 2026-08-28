# Patient Service — Service Specification

> **Status:** Draft — chờ review và approve trước khi implement.
> **Scope:** Thiết kế Patient Service cho quy trình khám thai. Không implement source code trong tài liệu này.
> **Nguồn đối chiếu:** source/config hiện tại → tests → tài liệu trong `docs/`.

---

## 1. Tổng quan và Boundary

| Thuộc tính | Giá trị |
|---|---|
| **Tên service** | Patient Service |
| **Mục đích** | Quản lý hồ sơ hành chính và thông tin định danh của thai phụ. Cung cấp nguồn dữ liệu Patient chuẩn cho đặt lịch và tiếp nhận tại quầy. |
| **Bounded context** | Patient Profile — thông tin ổn định về người được chăm sóc, không phải tài khoản đăng nhập và không phải hồ sơ y tế theo từng lần khám. |
| **Actors/Consumers** | PATIENT, RECEPTIONIST, Appointment Service, Check-in/Reception Service; DOCTOR/NURSE chỉ khi có use case và authorization được chốt. |
| **Source path dự kiến** | `services/apps/patient-service/` |
| **Internal port đề xuất** | `5004` — cần approve trước implementation |
| **Tech stack** | NestJS 11, TypeScript, PostgreSQL 16, Prisma 6; reuse stack backend hiện tại, không thêm Redis/message broker. |

### Chịu trách nhiệm

- Tạo một Patient Profile cho thai phụ có Auth account hoặc thai phụ được tạo tại quầy.
- Quản lý thông tin hành chính và định danh: họ tên, ngày sinh, giới tính, số điện thoại liên hệ, địa chỉ, mã định danh nếu được cung cấp.
- Quản lý Emergency Contact ở mức đơn giản.
- Xác định hồ sơ đã đủ thông tin để đặt lịch hay chưa.
- Cho phép PATIENT đọc/cập nhật hồ sơ của chính mình.
- Cho phép RECEPTIONIST tra cứu Patient phục vụ xác nhận định danh và check-in.
- Audit các thao tác tạo, đọc và thay đổi thông tin nhạy cảm.

### Không chịu trách nhiệm

- Account, email đăng nhập, password, role, access token, refresh token hoặc session — thuộc Auth Service.
- Appointment, check-in state, QueueTicket, Invoice hoặc Notification.
- Tuần thai hiện tại, tiền sử bệnh/sản khoa, vital signs, xét nghiệm, siêu âm, chẩn đoán, đơn thuốc hoặc phác đồ điều trị — thuộc Pregnancy/Medical Record domain.
- Xác nhận “Doctor được phân công cho Patient” — quan hệ này phải đến từ Appointment/Medical Record Service.
- Quản lý nhân sự bệnh viện.
- Merge hồ sơ Patient trùng trong phase đầu; duplicate phải được phát hiện và đưa vào quy trình xử lý thủ công sau.

### Data ownership

Patient Service là source of truth cho:

- `Patient`
- `EmergencyContact`

Patient Service chỉ tham chiếu:

| Dữ liệu | Owner service | Cách tham chiếu |
|---|---|---|
| `authAccountId` | Auth Service | UUID, nullable, unique khi có giá trị |
| `createdByAccountId` | Auth Service | UUID từ JWT `sub` hoặc internal identity |
| `updatedByAccountId` | Auth Service | UUID từ JWT `sub` hoặc internal identity |

> Không tạo database foreign key xuyên service và không query trực tiếp Auth Database.

### Quan hệ với Auth Service

Source Auth Service hiện tại xác nhận:

- Auth account ID nằm ở JWT claim `sub` và response field `user.userId`.
- Public registration luôn tạo role `PATIENT`.
- `POST /auth/register` chỉ tạo account; không tạo Patient Profile và không phát event.

Thiết kế phase đầu, đơn giản nhất:

1. Client gọi `POST /auth/register`.
2. Client login để nhận access token.
3. Client gọi `PUT /patients/me` để tạo hoặc hoàn thiện Patient Profile một cách idempotent.
4. `authAccountId = JWT.sub`.

Không để Auth Service synchronously gọi Patient Service và không dùng distributed transaction.

---

## 2. Actors và Authorization

| Actor/Consumer | Hành động | Permission logic | Resource-level rule |
|---|---|---|---|
| `PATIENT` | Tạo/lấy/cập nhật profile của mình; quản lý emergency contacts | JWT role `PATIENT` | `patient.authAccountId == JWT.sub` |
| `RECEPTIONIST` | Tạo Patient tại quầy; tra cứu/detail/update phục vụ check-in | JWT role `RECEPTIONIST` | Phase đầu là institution-wide trusted role; bắt buộc audit, rate limit và data minimization vì JWT chưa có facility scope |
| `Appointment Service` | Kiểm tra Patient tồn tại và profile có đủ điều kiện đặt lịch | Internal service auth — chưa có implementation hiện tại | Chỉ nhận dữ liệu tối thiểu: `patientId`, `profileStatus` |
| `Check-in Service` | Lấy dữ liệu định danh tối thiểu để lễ tân đối chiếu | Internal service auth — chưa có implementation hiện tại | Không được cập nhật Patient trực tiếp nếu không qua endpoint có audit |
| `DOCTOR/NURSE` | Không có API Patient riêng trong phase đầu | N/A | Dữ liệu cần thiết lấy qua Medical Record/encounter flow sau này |
| `ADMIN` | Không mặc định được đọc toàn bộ PII | N/A trong phase đầu | Admin role không tự động vượt qua resource-level authorization |

Quy tắc gateway/service:

- Kong verify access JWT trước khi forward protected route.
- Patient Service cũng verify Bearer JWT defense-in-depth bằng public key cấu hình/mount sẵn: `alg=RS256`, `kid`, signature, `iss`, `aud`, `exp`, `sub`, và role allowlist. JWKS refresh/key rotation để phase hardening sau.
- Patient Service kiểm tra ownership/resource-level rule và không gọi `/auth/me` mỗi request.
- Không tin `X-User-Id`, `X-Role` hoặc header tương tự do client tự gửi.
- Không expose Patient Service public; client chỉ đi qua Kong.
- Auth source hiện phát singular `role`, trong khi DB cho phép nhiều roles nhưng lựa chọn role chưa deterministic. Chỉ PATIENT self-service được coi là executable contract; RECEPTIONIST endpoints bị block implementation cho đến khi Auth enforce một active role/account hoặc phát deterministic `roles[]`.

---

## 3. Domain và Data Model

### Entity: `Patient`

| Field | Type | Required | Default | Constraint | Mô tả |
|---|---|---:|---|---|---|
| `id` | UUID | Yes | Generated | PK | Patient ID dùng bởi các business services |
| `authAccountId` | UUID | No | `null` | Unique khi có giá trị | Liên kết Auth account; null với hồ sơ tạo tại quầy chưa có app |
| `fullName` | string | Yes | — | Trimmed, 2–150 ký tự | Họ tên thai phụ |
| `dateOfBirth` | date | Yes | — | Không lớn hơn ngày hiện tại | Ngày sinh, không chứa time/timezone |
| `phoneNumber` | string | Yes | — | E.164 hoặc format VN được chuẩn hóa; index | Số điện thoại liên hệ, không dùng làm khóa đăng nhập tại service này |
| `nationalId` | string (logical field) | No | `null` | 9–12 chữ số; unique khi có giá trị | API nhận/trả masked; DB lưu ciphertext + HMAC lookup index, không lưu plaintext |
| `address` | string | No | `null` | Tối đa 500 ký tự | Địa chỉ liên hệ |
| `version` | integer | Yes | `1` | Tăng khi update | Optimistic concurrency control |
| `createdByAccountId` | UUID | Yes | — | External Auth ID | Account tạo profile |
| `updatedByAccountId` | UUID | Yes | — | External Auth ID | Account cập nhật gần nhất |
| `createdAt` | timestamptz | Yes | DB now | Immutable | Thời điểm tạo |
| `updatedAt` | timestamptz | Yes | DB now | Auto update | Thời điểm cập nhật |

### Entity: `EmergencyContact`

| Field | Type | Required | Default | Constraint | Mô tả |
|---|---|---:|---|---|---|
| `id` | UUID | Yes | Generated | PK | Contact ID |
| `patientId` | UUID | Yes | — | FK local → Patient, cascade delete theo retention policy | Patient owner |
| `fullName` | string | Yes | — | Trimmed, 2–150 ký tự | Họ tên người liên hệ |
| `relationship` | string | Yes | — | Trimmed, 1–50 ký tự | Quan hệ với thai phụ |
| `phoneNumber` | string | Yes | — | Chuẩn hóa như Patient phone | Số liên hệ |
| `isPrimary` | boolean | Yes | `false` | Tối đa một primary contact/Patient | Liên hệ chính |
| `createdAt` | timestamptz | Yes | DB now | Immutable | Thời điểm tạo |
| `updatedAt` | timestamptz | Yes | DB now | Auto update | Thời điểm cập nhật |

### Internal persistence records

Patient Service còn sở hữu hai bảng kỹ thuật, không expose như domain resource:

| Record | Fields chính | Mục đích |
|---|---|---|
| `PatientAuditLog` | `id`, `eventType`, `actorId`, `actorRole`, `patientId`, `changedFields`, `requestId`, `createdAt` | Audit staff/internal reads và PII mutations; không lưu raw PII |
| `IdempotencyRecord` | `id`, `actorId`, `operation`, `idempotencyKey`, `requestHash`, `patientId`, `status`, `expiresAt`, `createdAt` | Đảm bảo `POST /patients` retry an toàn giữa nhiều instances |

`IdempotencyRecord` unique theo `(actorId, operation, idempotencyKey)`. Record và Patient phải được ghi trong cùng local transaction. Cùng key/cùng normalized request hash trả Patient đã tạo; cùng key/hash khác trả `409 IDEMPOTENCY_KEY_REUSED`.

### Relationships, constraints và indexes

| Entity/Table | Loại | Fields | Mục đích/quy tắc |
|---|---|---|---|
| Patient → EmergencyContact | 1—N | `patientId` | Một Patient có tối đa 3 emergency contacts trong phase đầu |
| `patients` | UNIQUE partial | `authAccountId` khi not null | Một Auth account liên kết tối đa một Patient |
| `patients` | UNIQUE partial | `nationalIdLookupHash` khi not null | HMAC của national ID normalized; equality/uniqueness không cần plaintext |
| `patients` | INDEX | `phoneNumber` | Tra cứu tại quầy |
| `patients` | INDEX | normalized `fullName` | Hỗ trợ search theo tên; không dùng exact name làm identity |
| Patient domain validation | Application rule | `dateOfBirth <= business date` | Dùng timezone `Asia/Ho_Chi_Minh`; không dùng time-dependent DB CHECK |
| `emergency_contacts` | UNIQUE partial | `patientId` với `isPrimary=true` | Tối đa một primary contact |

Ghi chú database:

- Prisma schema hiện tại dùng `AUTH_DATABASE_URL` và chỉ mô hình Auth. Patient Service phải có Prisma schema, generated client và migration history riêng dùng `PATIENT_DATABASE_URL`.
- Không thêm Patient models vào Auth Prisma schema/client. Cấu trúc file cụ thể có thể theo `services/prisma/patient/`, nhưng ownership và generated client riêng là bắt buộc.
- Phone lưu giá trị normalized để search.
- National ID normalized được mã hóa authenticated-encryption để hiển thị khi được phép; equality/search/unique dùng `HMAC-SHA256(normalizedNationalId, patient-specific lookup pepper)`. Không dùng plain hash vì không gian CCCD/CMND có thể bị brute-force.
- Encryption key và HMAC pepper không commit vào repository; rotation/key ownership phải được chốt trong implementation design.

### Profile completeness và lifecycle

Phase đầu chỉ tạo Patient khi có đủ `fullName`, `dateOfBirth`, `phoneNumber` hợp lệ. Vì vậy:

- Chưa có Patient record nghĩa là onboarding Patient Profile chưa hoàn tất.
- Patient đã tồn tại được coi là `COMPLETE` cho mục đích đặt lịch.
- `profileStatus` trong eligibility response là giá trị derived, không lưu trong Patient table.
- Không cần state machine cho Patient trong phase đầu.
- Không hard-delete hoặc deactivate Patient qua public API. Administrative lifecycle chỉ bổ sung khi có requirement rõ.

---

## 4. API Contract

- **OpenAPI dự kiến:** `docs/api-specs/patient-service.yaml` — tạo trong implementation/contract phase sau khi spec được approve.
- **Public gateway base path:** `/api/patients`
- **Service-local path:** `/patients`
- **Authentication:** Kong và Patient Service đều verify access JWT RS256; issuer `maternal-healthcare-auth`, audience `maternal-healthcare-api`. Kong JWT verification chưa được config hiện tại nên protected Patient routes chưa production-ready.

### Endpoint summary

| ID | Method | Path | Mục đích | Permission |
|---|---|---|---|---|
| API-001 | GET | `/health` | Liveness health check | Public/internal |
| API-002 | PUT | `/patients/me` | Idempotently tạo hoặc cập nhật profile của PATIENT hiện tại | `PATIENT`, own account |
| API-003 | GET | `/patients/me` | Lấy profile của PATIENT hiện tại | `PATIENT`, own account |
| API-004 | GET | `/patients/{patientId}` | Lấy Patient theo ID | `RECEPTIONIST` — BLOCKED theo Auth role contract |
| API-005 | PATCH | `/patients/{patientId}` | Cập nhật Patient tại quầy | `RECEPTIONIST` — BLOCKED, audited |
| API-006 | POST | `/patients/search` | Tìm Patient phục vụ check-in; dùng body để tránh PII trong URL | `RECEPTIONIST` — BLOCKED |
| API-007 | POST | `/patients` | Tạo Patient tại quầy chưa có Auth account | `RECEPTIONIST` — BLOCKED |
| API-008 | GET | `/internal/patients/{patientId}/eligibility` | Kiểm tra tồn tại và profile complete | FUTURE/BLOCKED theo service-auth |
| API-009 | POST | `/patients/{patientId}/emergency-contacts` | Thêm emergency contact | Own PATIENT hoặc RECEPTIONIST |
| API-010 | PATCH | `/patients/{patientId}/emergency-contacts/{contactId}` | Cập nhật emergency contact | Own PATIENT hoặc RECEPTIONIST |
| API-011 | DELETE | `/patients/{patientId}/emergency-contacts/{contactId}` | Xóa emergency contact | Own PATIENT hoặc RECEPTIONIST |

### API-001 — `GET /health`

**Success — `200 OK`**

```json
{
  "status": "ok",
  "service": "patient-service"
}
```

Liveness không cần dependency call. Readiness/database check có thể bổ sung endpoint riêng khi infrastructure convention được chốt.

### API-002 — `PUT /patients/me`

- **Mục đích:** Tạo profile lần đầu hoặc cập nhật profile của Auth account hiện tại.
- **Caller/Authorization:** JWT role `PATIENT`; `authAccountId` luôn lấy từ verified `sub`, không nhận từ body.
- **Semantics:** Full upsert. Create bắt buộc `fullName`, `dateOfBirth`, `phoneNumber`; update phải gửi full representation và `version` hiện tại. Optional field bị omit được hiểu là `null`.
- **Idempotency:** Nếu request không có `version` nhưng profile đã tồn tại và normalized representation giống state hiện tại, trả no-op `200`: không tăng version/updatedAt và không ghi thêm `patient.updated`. Nếu payload khác, trả `409 VERSION_REQUIRED`.
- **Concurrency:** Update có version dùng conditional write. Concurrent create cùng `authAccountId` và cùng normalized payload trả cùng Patient; payload khác trả `409 CONCURRENT_CREATE_CONFLICT`.

**Request**

```json
{
  "fullName": "Nguyễn Thị A",
  "dateOfBirth": "1995-06-15",
  "phoneNumber": "+84901234567",
  "nationalId": "012345678901",
  "address": "Quận 1, TP. Hồ Chí Minh"
}
```

Request create omit `version`. Request update gửi cùng full representation và thêm `"version": 3`.

**Success — `200 OK` khi update/no-op, `201 Created` khi tạo**

```json
{
  "data": {
    "id": "uuid",
    "fullName": "Nguyễn Thị A",
    "dateOfBirth": "1995-06-15",
    "phoneNumber": "+84901234567",
    "nationalIdMasked": "********8901",
    "address": "Quận 1, TP. Hồ Chí Minh",
    "profileStatus": "COMPLETE",
    "version": 1,
    "emergencyContacts": []
  }
}
```

**Errors**

| HTTP | Code | Khi nào |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Field sai format/length/date |
| 401 | `UNAUTHENTICATED` | JWT thiếu/không hợp lệ |
| 403 | `FORBIDDEN` | Role không phải PATIENT |
| 409 | `PATIENT_IDENTITY_CONFLICT` | `nationalId` đã thuộc Patient khác |
| 409 | `VERSION_REQUIRED` | Profile đã tồn tại, payload thay đổi nhưng request không có version |
| 409 | `CONCURRENT_UPDATE` | Update gửi version cũ |
| 409 | `CONCURRENT_CREATE_CONFLICT` | Hai create cùng account nhưng normalized payload khác nhau |

**Writes và side effects**

- Create hoặc conditional update Patient trong một local transaction; không dùng read-then-write không có constraint.
- Validate đầy đủ ba field tối thiểu và encrypt/HMAC national ID trước commit.
- Ghi `patient.created` hoặc `patient.updated` trong cùng transaction; no-op retry không ghi change audit mới.
- Không gọi Auth Service và không phát event trong phase đầu.

### API-003 — `GET /patients/me`

- **Authorization:** JWT role `PATIENT`, resolve bằng `authAccountId = sub`.
- **Success:** `200` với full own profile và emergency contacts.
- **Not found:** `404 PATIENT_PROFILE_NOT_FOUND` nếu account chưa tạo profile.

### API-004 — `GET /patients/{patientId}`

- **Authorization:** RECEPTIONIST only trong phase đầu; PATIENT dùng `/patients/me`. Internal service dùng API-008 sau khi service-auth được approve.
- **Success `200`:** `{ id, fullName, dateOfBirth, phoneNumber, nationalIdMasked, address, version, emergencyContacts }` với `Cache-Control: no-store`.
- **Errors:** `400 INVALID_PATIENT_ID`, `401`, `403`, `404 PATIENT_NOT_FOUND`.
- Mỗi successful RECEPTIONIST read phải audit `patient.viewed` với purpose `CHECK_IN`.

### API-005 — `PATCH /patients/{patientId}`

- **Caller:** RECEPTIONIST.
- **Request:** ít nhất một mutable field trong `fullName`, `dateOfBirth`, `phoneNumber`, `nationalId`, `address`; luôn có `version` và `reason` 1–250 ký tự.
- `null` chỉ được dùng để clear optional `nationalId`/`address`; required fields không nhận null/omit-to-clear.
- **Server-managed fields bị reject:** `id`, `authAccountId`, audit/timestamps.
- **Success `200`:** Patient detail với `version` tăng 1; no-op normalized patch trả `200`, không tăng version/audit change.
- **Errors:** `400`, `401`, `403`, `404`, `409 PATIENT_IDENTITY_CONFLICT`, `409 CONCURRENT_UPDATE`.
- Mọi actual update ghi actor, changed field names và reason vào local audit cùng transaction.

### API-006 — `POST /patients/search`

- **Caller:** RECEPTIONIST only.
- **Request body:** `{ phoneNumber?, nationalId?, fullName?, page=1, limit=20 }`; phải có ít nhất một search field; `page >= 1`, `1 <= limit <= 50`.
- Dùng POST vì criteria chứa PII không nên nằm trong URL/query log; endpoint này chỉ đọc và không thay đổi dữ liệu.
- `phoneNumber` và `nationalId`: exact normalized match. `fullName`: case-insensitive partial match, minimum 2 ký tự.
- **Success `200`:** `{ data: { items: PatientSearchItem[], page, limit, total } }`; stable sort `updatedAt DESC, id ASC`.
- `PatientSearchItem`: `{ id, fullName, dateOfBirth, phoneNumberMasked, nationalIdMasked }`; không trả address, authAccountId hoặc audit metadata.
- **Errors:** `400 SEARCH_FILTER_REQUIRED`, `400 VALIDATION_FAILED`, `401`, `403`.
- Response có `Cache-Control: no-store`; không có list-all endpoint trong phase đầu.
- Successful search audit `searchType`, result count và actor; không audit raw criteria.

### API-007 — `POST /patients`

- **Caller:** RECEPTIONIST.
- **Header:** `Idempotency-Key` là UUID, bắt buộc.
- **Request:** `fullName`, `dateOfBirth`, `phoneNumber` bắt buộc; `nationalId`, `address` optional; `reason` 1–250 ký tự bắt buộc. `authAccountId` không được nhận từ body.
- **Success `201`:** Patient detail; retry cùng actor/key/normalized payload trả `200` với cùng Patient.
- **Idempotency:** persistent `IdempotencyRecord`; cùng key/payload khác trả `409 IDEMPOTENCY_KEY_REUSED`; concurrent cùng key chỉ có một execution.
- **Errors:** `400`, `401`, `403`, `409 PATIENT_IDENTITY_CONFLICT`, `409 IDEMPOTENCY_KEY_REUSED`.
- DB unique `nationalIdLookupHash` là source of truth; phone trùng không block create và không tự merge. Lễ tân nên search trước nếu nghi ngờ trùng.

### API-008 — `GET /internal/patients/{patientId}/eligibility` — FUTURE/BLOCKED

Không implement endpoint này cho đến khi service-to-service authentication được approve. Auth Service hiện chỉ phát user token với một `role`, chưa có service identity/scope.

Contract dự kiến sau khi có service auth:

- Caller có service identity `appointment-service` hoặc `check-in-service` và scope `patient:eligibility:read`.
- Patient tồn tại: `200 { data: { patientId, exists: true, profileStatus: "COMPLETE", eligibleForBooking: true, missingFields: [] } }`.
- Patient không tồn tại: `200 { data: { patientId, exists: false, profileStatus: null, eligibleForBooking: false, missingFields: [] } }`.
- Không trả phone, national ID, address hoặc emergency contacts.

### API-009 — `POST /patients/{patientId}/emergency-contacts`

- **Request:** `{ fullName, relationship, phoneNumber, isPrimary? }`.
- **Success:** `201` với contact mới. **Errors:** `400`, `401`, `403`, `404 PATIENT_NOT_FOUND`, `422 EMERGENCY_CONTACT_LIMIT_REACHED`.
- Lock parent Patient row trong transaction trước khi count/insert; khi `isPrimary=true`, bỏ primary cũ và insert/set primary atomically.

### API-010 — `PATCH /patients/{patientId}/emergency-contacts/{contactId}`

- **Request:** ít nhất một mutable field; contact phải thuộc đúng Patient trong path.
- **Success:** `200`. **Errors:** `400`, `401`, `403`, `404 CONTACT_NOT_FOUND`.
- Chuyển primary phải lock parent Patient row; concurrent primary switch chỉ để lại một primary.

### API-011 — `DELETE /patients/{patientId}/emergency-contacts/{contactId}`

- Contact phải thuộc đúng Patient. Successful delete hoặc retry sau delete trả `204` nếu caller đã được authorize cho Patient.
- Không được xóa contact có cùng ID nhưng thuộc Patient khác; trả `404 CONTACT_NOT_FOUND` để tránh leak.

Quy tắc chung:

- Tối đa 3 contacts/Patient và tối đa một primary.
- PATIENT chỉ thao tác Patient của mình; RECEPTIONIST operations phải audit.
- Third-party PII được bảo vệ và không log raw.

### Error envelope

```json
{
  "error": {
    "code": "PATIENT_PROFILE_NOT_FOUND",
    "message": "Patient profile was not found",
    "requestId": "uuid"
  }
}
```

---

## 5. Business Rules

| Rule ID | Quy tắc | Enforced by | Error code |
|---|---|---|---|
| BR-001 | Mỗi `authAccountId` liên kết tối đa một Patient. | DB unique + application | `PATIENT_ACCOUNT_CONFLICT` |
| BR-002 | `authAccountId` của `/patients/me` luôn lấy từ verified JWT `sub`; client không được gán/sửa. | Controller/service DTO allowlist | `FORBIDDEN_FIELD` |
| BR-003 | `nationalId` sau normalize phải unique khi có giá trị. | DB unique + application | `PATIENT_IDENTITY_CONFLICT` |
| BR-004 | Patient chỉ được tạo khi có `fullName`, `dateOfBirth`, `phoneNumber` hợp lệ; Patient tồn tại được coi là đủ điều kiện profile cho đặt lịch. | Application | `VALIDATION_FAILED` |
| BR-005 | PATIENT chỉ đọc/sửa profile có `authAccountId == JWT.sub`. | Application authorization | `FORBIDDEN` hoặc `/me` 404 |
| BR-006 | Phone number không unique tuyệt đối vì có thể dùng chung trong gia đình; phone trùng không block create và không được dùng để tự merge. | Application | N/A |
| BR-007 | RECEPTIONIST search phải có filter và chỉ nhận kết quả tối thiểu/PII masked. | Application | `SEARCH_FILTER_REQUIRED` |
| BR-008 | Mọi actual update qua API-002/API-005 phải conditional theo expected `version`; stale version không ghi đè dữ liệu mới hơn. | Application + conditional DB update | `CONCURRENT_UPDATE` |
| BR-009 | Patient có tối đa 3 emergency contacts và tối đa một primary contact; operation thay đổi contacts phải lock parent Patient. | Transaction + DB unique safety net | `EMERGENCY_CONTACT_LIMIT_REACHED` |
| BR-010 | Không hard-delete Patient trong phase đầu. | API surface | N/A |
| BR-011 | Patient Service không lưu clinical pregnancy/medical data. | Boundary/code review | N/A |
| BR-012 | Mọi read/search/update bởi RECEPTIONIST và mọi thay đổi `nationalId`, `fullName`, `dateOfBirth` phải audit. | Application/local audit | `INTERNAL_ERROR` nếu audit bắt buộc thất bại |
| BR-013 | API search không cho list toàn bộ Patient và giới hạn tối đa 50 kết quả/request. | Application | `SEARCH_FILTER_REQUIRED` / `VALIDATION_FAILED` |
| BR-014 | Date of birth là date theo timezone `Asia/Ho_Chi_Minh`; lớn hơn business date hiện tại bị reject, bằng ngày hiện tại được chấp nhận. | DTO/domain validation | `INVALID_DATE_OF_BIRTH` |
| BR-015 | Receptionist create lưu idempotency key/request hash/result trong Patient DB; record retention mặc định 24 giờ. | Local transaction + unique constraint | `IDEMPOTENCY_KEY_REUSED` |
| BR-016 | National ID không lưu plaintext: ciphertext để authorized display, HMAC lookup hash để equality/unique. | Application crypto + DB unique | `PATIENT_IDENTITY_CONFLICT` |

### Normalization

- `fullName`: trim, collapse multiple spaces; giữ Unicode/diacritics để hiển thị; tạo normalized search form riêng nếu cần.
- `phoneNumber`: normalize về E.164 khi đủ thông tin; implementation phải có test cho số Việt Nam.
- `nationalId`: bỏ khoảng trắng/ký tự phân cách, chỉ giữ 9 hoặc 12 chữ số.
- Không normalize bằng cách làm mất dữ liệu gốc cần hiển thị nếu chưa có policy rõ.

---

## 6. Given–When–Then Scenarios

### Scenario index

| ID | Loại | Mô tả | Rule/API |
|---|---|---|---|
| SCN-001 | Happy path | PATIENT tạo profile lần đầu | BR-001/002/004, API-002 |
| SCN-002 | Idempotency | PATIENT gửi lại PUT `/patients/me` | BR-001, API-002 |
| SCN-003 | Validation | Ngày sinh trong tương lai | BR-014, API-002 |
| SCN-004 | Authorization | PATIENT cố dùng endpoint theo ID | BR-005, API-004 |
| SCN-005 | Conflict | Mã định danh đã thuộc Patient khác | BR-003, API-002/007 |
| SCN-006 | Race | Hai request đồng thời tạo profile cùng account | BR-001, API-002 |
| SCN-007 | Concurrency | RECEPTIONIST update với version cũ | BR-008, API-005 |
| SCN-008 | Search | RECEPTIONIST search theo phone | BR-007/013, API-006 |
| SCN-009 | Privacy | Search không trả nationalId/address đầy đủ | BR-007/012, API-006 |
| SCN-010 | Internal | Appointment kiểm tra profile eligibility | BR-004, API-008 |
| SCN-011 | Limit | Thêm emergency contact thứ tư | BR-009, API-009 |
| SCN-012 | Partial failure | Audit write thất bại trong sensitive update | BR-012, API-005 |
| SCN-013 | Idempotency | Receptionist create retry/reused key | API-007 |
| SCN-014 | Race | Concurrent emergency contact limit | BR-009, API-009 |
| SCN-015 | Identity lifecycle | Hồ sơ tại quầy không tự link account | BR-001/003, API-002/007 |

### SCN-001 — PATIENT tạo profile lần đầu

```gherkin
Given access JWT hợp lệ có sub = A1 và role = PATIENT
And chưa có Patient nào liên kết authAccountId = A1
When client gửi PUT /patients/me với fullName, dateOfBirth và phoneNumber hợp lệ
Then service trả 201 Created
And tạo đúng một Patient có authAccountId = A1
And eligibility derived của Patient là COMPLETE
And response mask nationalId nếu field này được gửi
And audit patient.created được lưu
And không gọi Auth Service
```

### SCN-002 — PUT `/patients/me` được retry

```gherkin
Given Patient P1 đã liên kết authAccountId = A1
And client đã gửi PUT /patients/me thành công
When client gửi lại cùng payload với JWT sub = A1
Then service trả 200 OK với Patient P1
And không tạo Patient thứ hai
And dữ liệu giữ nguyên ngoài updatedAt nếu implementation không no-op update
```

### SCN-003 — Ngày sinh trong tương lai

```gherkin
Given JWT PATIENT hợp lệ
When client gửi PUT /patients/me với dateOfBirth sau business date hiện tại
Then service trả 400 INVALID_DATE_OF_BIRTH
And không write Patient
And không ghi success audit
```

### SCN-004 — PATIENT không đọc profile theo ID tùy ý

```gherkin
Given Patient A có JWT PATIENT hợp lệ
And Patient B tồn tại với patientId = P2
When A gọi GET /patients/P2
Then service trả 403 FORBIDDEN
And không trả bất kỳ dữ liệu nào của P2
And A vẫn chỉ có thể dùng GET /patients/me
```

### SCN-005 — National ID conflict

```gherkin
Given Patient P1 đã có normalized nationalId = N1
When PATIENT khác hoặc RECEPTIONIST tạo Patient với nationalId = N1
Then chỉ một Patient giữ nationalId = N1
And request sau trả 409 PATIENT_IDENTITY_CONFLICT
And không tự merge hai hồ sơ
```

### SCN-006 — Hai request đồng thời tạo profile cùng account

```gherkin
Given chưa có Patient cho authAccountId = A1
When hai PUT /patients/me với JWT sub = A1 chạy đồng thời
Then database chỉ có một Patient liên kết A1
And request thắng tạo Patient và trả 201
And request thua với cùng normalized payload trả 200 cùng Patient
And request thua với payload khác trả 409 CONCURRENT_CREATE_CONFLICT
And chỉ có một patient.created audit record
```

### SCN-007 — Lost update được ngăn chặn

```gherkin
Given Patient P1 đang có version = 3
And RECEPTIONIST A và B cùng đọc version 3
When A cập nhật thành công làm version thành 4
And B gửi PATCH với version = 3
Then B nhận 409 CONCURRENT_UPDATE
And dữ liệu do A ghi không bị ghi đè
And không ghi audit update thành công cho request B
```

### SCN-008 — RECEPTIONIST search theo phone

```gherkin
Given RECEPTIONIST có JWT hợp lệ
And Patient P1 có normalized phoneNumber = +84901234567
When RECEPTIONIST gọi POST /patients/search với phoneNumber = 0901234567 trong request body
Then service normalize input và trả P1 trong danh sách phân trang
And chỉ trả Patient summary cần cho check-in
And ghi audit patient.searched với actorId và search type, không ghi raw nationalId
```

### SCN-009 — Search response không leak PII

```gherkin
Given RECEPTIONIST search trả Patient P1
When service tạo search response
Then nationalId chỉ hiển thị dạng masked
And address đầy đủ không được trả trong list result
And response không chứa authAccountId hoặc audit metadata
```

### SCN-010 — Appointment kiểm tra eligibility

```gherkin
Given Patient P1 tồn tại với đủ fullName, dateOfBirth và phoneNumber hợp lệ
And Appointment Service được internal-authenticated
When gọi GET /internal/patients/P1/eligibility
Then service trả eligibleForBooking = true và missingFields rỗng
And không trả phoneNumber, nationalId, address hoặc emergency contacts
```

### SCN-011 — Emergency contact limit

```gherkin
Given Patient P1 đã có ba emergency contacts
When authorized caller thêm contact thứ tư
Then service trả 422 EMERGENCY_CONTACT_LIMIT_REACHED
And không tạo contact mới
And ba contacts hiện có không thay đổi
```

### SCN-012 — Audit write thất bại

```gherkin
Given RECEPTIONIST cập nhật nationalId của Patient P1
And local audit write thất bại trước transaction commit
When service xử lý PATCH
Then toàn bộ transaction rollback
And Patient P1 không bị cập nhật một cách không audit
And service trả 500 INTERNAL_ERROR
And log không chứa nationalId raw
```

### SCN-013 — Receptionist create được retry bằng idempotency key

```gherkin
Given RECEPTIONIST gửi POST /patients với Idempotency-Key K và normalized payload H
And request đầu đã tạo Patient P1
When cùng actor gửi lại K với payload H
Then service trả 200 với P1
And không tạo Patient/audit lần hai
When cùng actor gửi K với payload khác H
Then service trả 409 IDEMPOTENCY_KEY_REUSED
```

### SCN-014 — Concurrent emergency contact limit

```gherkin
Given Patient P1 đang có hai emergency contacts
When hai request thêm contact chạy đồng thời
Then transaction lock Patient P1
And chỉ một request tạo contact thứ ba và trả 201
And request còn lại trả 422 EMERGENCY_CONTACT_LIMIT_REACHED
And tổng số contact không vượt quá ba
```

### SCN-015 — Hồ sơ tại quầy chưa được tự động link account

```gherkin
Given Patient P1 được tạo tại quầy với authAccountId = null
And người đó sau này đăng ký Auth account A1
When A1 gọi PUT /patients/me
Then service không tự link P1 bằng phone hoặc email
And nếu nationalId trùng P1 thì trả 409 PATIENT_IDENTITY_CONFLICT
And yêu cầu manual verified linking flow chưa thuộc phase này
```

---

## 7. Edge Cases

| ID | Case | Expected behavior | Result |
|---|---|---|---|
| EDGE-001 | Missing/null required field | Reject, không write | 400 |
| EDGE-002 | `fullName` chỉ có whitespace hoặc quá 150 ký tự | Reject sau normalize | 400 |
| EDGE-003 | `dateOfBirth` tương lai hoặc invalid calendar date | Reject | 400 `INVALID_DATE_OF_BIRTH` |
| EDGE-004 | `nationalId` không phải 9/12 chữ số | Reject | 400 |
| EDGE-005 | National ID duplicate | Không tạo/ghi đè/merge | 409 |
| EDGE-006 | Phone duplicate | Không block create và không tự merge; receptionist nên search trước | 201/200 |
| EDGE-007 | PATIENT chưa có profile gọi `/patients/me` | Không tạo ngầm ở GET | 404 |
| EDGE-008 | Client gửi `authAccountId` hoặc timestamps | Reject vì server-managed | 400 |
| EDGE-009 | Hai create cùng `authAccountId` | Cùng payload: 201 + 200 cùng Patient; khác payload: loser conflict | 201/200 hoặc 409 |
| EDGE-010 | Hai update cùng version | Chỉ một update thắng | 200 + 409 |
| EDGE-011 | Cùng Idempotency-Key, payload khác ở receptionist create | Reject, không đổi dữ liệu | 409 |
| EDGE-012 | DB commit thành công nhưng response bị mất | Retry PUT `/me` hoặc POST với idempotency key không duplicate | Same result |
| EDGE-013 | Search không có filter | Không list toàn bộ Patient | 400 |
| EDGE-014 | Search `fullName` dưới 2 ký tự | Reject để giảm broad enumeration | 400 |
| EDGE-015 | Search limit > 50 | Reject hoặc clamp theo OpenAPI; chọn reject | 400 |
| EDGE-016 | Unauthorized role search Patient | Reject trước query | 403 |
| EDGE-017 | National ID trong log/error/metric label | Không ghi raw value | No leak |
| EDGE-018 | Emergency contact mới set primary | Lock Patient; bỏ primary cũ và set mới trong một transaction | 200/201 |
| EDGE-018A | Hai request đồng thời thêm contact khi đã có 2 | Lock Patient; chỉ một request tạo contact thứ 3 | 201 + 422 |
| EDGE-018B | Hai request đồng thời đổi primary | Serialize bằng Patient lock; cuối cùng đúng một primary | 200 |
| EDGE-019 | Xóa contact đã bị xóa và caller có ownership | Idempotent | 204 |
| EDGE-020 | Auth account bị disable sau khi JWT đã phát | Token có thể còn hiệu lực tới expiry; Patient Service không gọi Auth mỗi request | Behavior theo access-token architecture |
| EDGE-021 | Patient tạo tại quầy sau đó muốn liên kết account | Chưa implement; không tự suy đoán bằng phone/email | Out of scope/open decision |
| EDGE-022 | Nhiều thai kỳ hoặc thay đổi tuần thai | Không lưu trong Patient Service | Medical Record/Pregnancy domain |
| EDGE-023 | Payload quá lớn | Reject tại Kong/app limit | 413 |
| EDGE-024 | Unicode tiếng Việt trong tên | Preserve display value; normalized search không làm hỏng dấu | 200 |

---

## 8. Integrations và Failure Behavior

### Dependencies

Patient Service phase đầu không có outbound synchronous dependency trong request path.

| Dependency | Operation | Required? | Timeout/Retry | Khi lỗi |
|---|---|---:|---|---|
| Auth Service | Không có outbound call trong phase đầu | No | N/A | JWT verify locally bằng configured public key; không gọi `/auth/me` |
| Audit Service | Không dùng trong phase đầu | No | N/A | Dùng local audit table trong Patient DB |

Inbound consumers dự kiến:

| Consumer | Operation | Mục đích | Data trả về |
|---|---|---|---|
| Appointment Service | Eligibility endpoint | Check Patient đủ điều kiện đặt lịch | ID, status, eligibility, missing fields |
| Check-in Service | `GET /patients/{id}` hoặc search | Đối chiếu định danh tại quầy | Minimum necessary masked profile |

### Events

Phase đầu:

```text
N/A — repository chưa có message broker và Patient foundation không cần event để hoạt động.
```

Future events chỉ thêm khi có consumer rõ ràng:

- `patient.created`
- `patient.profile_completed`
- `patient.updated`
- `patient.account_linked`

Nếu được thêm sau, event phải có `eventId`, `eventVersion`, `correlationId`, không chứa raw PII/PHI và consumer xử lý duplicate an toàn.

### Consistency và recovery

- Trong Patient Service: local PostgreSQL transaction.
- Cross-service: synchronous read cho eligibility/check-in ở phase đầu.
- Concurrency: unique constraints + optimistic `version` update.
- Patient Service không dùng distributed transaction với Auth.
- Nếu Patient DB down: create/read/update/search trả `503`; không false success.
- Auth Service down nhưng access JWT còn hợp lệ: Kong và Patient Service verify bằng configured public key, nên protected Patient API vẫn hoạt động.
- Nếu public key config thiếu/invalid, Patient Service fail-fast hoặc readiness fail; không accept token chưa verify.
- Nếu Kong chưa có JWT verification: Patient route chưa được coi là production-ready và không expose trực tiếp.

---

## 9. Security, Audit và NFR

### Security và sensitive data

| Dữ liệu | Classification | Log policy | Response policy |
|---|---|---|---|
| `fullName` | PII | Không dùng làm metric label; chỉ log khi đã mask nếu thật sự cần | Own Patient/full authorized view |
| `dateOfBirth` | PII | Không log raw | Chỉ actor có quyền |
| `phoneNumber` | PII | Mask; search audit chỉ ghi search type/hash nếu cần | Mask trong list, full trong own/detail authorized view |
| `nationalId` | High-risk PII | Không log raw, không đưa event | Chỉ trả masked trong phase đầu; không có API trả raw value |
| `address` | PII | Không log raw | Không trả trong search list |
| Emergency contact | PII của người thứ ba | Không log raw | Chỉ own Patient/authorized receptionist |
| Pregnancy/medical data | PHI | Không được lưu ở service này | N/A |

Security controls bắt buộc:

- Global validation pipe: `whitelist`, `forbidNonWhitelisted`, `transform`, consistent với Auth Service.
- DTO allowlist; client không sửa server-managed fields.
- Parameterized query/Prisma.
- Exact ownership check cho PATIENT.
- Search rate limit tại Kong và application guard nếu cần; không list toàn bộ Patient.
- Response DTO riêng cho own/detail/search/internal eligibility để tránh over-sharing.
- Patient Service và database không expose public host port trong production-like Compose.
- Không ghi secret, JWT, Authorization header hoặc raw PII vào logs.

### Audit

Dùng `patient_audit_logs` trong Patient DB phase đầu để tránh thêm Audit Service/message broker.

| Event | Khi nào | Metadata tối thiểu |
|---|---|---|
| `patient.created` | Tạo qua `/me` hoặc tại quầy | actorId, actorRole, patientId, requestId, timestamp |
| `patient.viewed` | RECEPTIONIST xem detail | actorId, patientId, purpose=`CHECK_IN`, requestId |
| `patient.searched` | RECEPTIONIST search | actorId, searchType, resultCount, requestId; không raw criteria |
| `patient.updated` | Actual profile change | actorId, patientId, changed field names, reason, requestId |
| `emergency_contact.changed` | Add/update/delete contact | actorId, patientId, contactId, action |
| `patient.access_denied` | Staff/internal access bị từ chối | actorId/serviceId, requested patientId, route, requestId |

Own PATIENT `GET /me`, no-op update và future eligibility call dùng access/request log, không tạo business change audit. Mọi staff/internal full-PII read phải audit. Không lưu full before/after raw PII trong generic JSON audit. Audit retention và quyền đọc audit records phải được approve trước production.

### Non-functional requirements

| Concern | Requirement |
|---|---|
| Performance | `GET /patients/me` và eligibility P95 < 300 ms; receptionist exact search P95 < 500 ms ở quy mô ban đầu |
| Availability | App stateless; nhiều instance có thể dùng chung Patient DB; một instance chết không mất state |
| Failure | Patient DB down → API phụ thuộc DB trả 503; `/health` liveness vẫn phản ánh process, readiness nên fail |
| Scalability | PostgreSQL indexes cho account ID, phone, national ID, normalized name; chưa cần Redis |
| Pagination | Search max 50 kết quả/request; default 20 |
| Observability | Structured log có requestId/correlationId; metrics request/error/latency không chứa Patient ID hoặc PII label |
| Data retention | Không hard-delete trong phase đầu; retention/legal deletion cần stakeholder chốt |

### Configuration

| Variable | Required | Example | Secret? | Mô tả |
|---|---:|---|---:|---|
| `PORT` | No | `5004` | No | Internal app port |
| `PATIENT_DATABASE_URL` | Yes | `postgresql://<user>:<password>@patient-database:5432/patient` | Yes | Patient DB connection |
| `JWT_ISSUER` | Yes | `maternal-healthcare-auth` | No | Phải khớp Auth issuer |
| `JWT_AUDIENCE` | Yes | `maternal-healthcare-api` | No | Phải khớp Auth audience |
| `AUTH_JWT_PUBLIC_KEY` | Yes | `<mounted/escaped public PEM>` | No | Patient Service verify JWT locally; phải khớp active Auth signing key |
| `AUTH_JWT_KEY_ID` | Yes | `local-dev-key` | No | Reject token có `kid` không khớp trong phase một-key |
| `PATIENT_NATIONAL_ID_ENCRYPTION_KEY` | Yes nếu dùng national ID | `<secret>` | Yes | Authenticated-encryption key |
| `PATIENT_NATIONAL_ID_LOOKUP_PEPPER` | Yes nếu dùng national ID | `<secret>` | Yes | HMAC lookup/unique index |

Infrastructure target sau approve:

- Docker service: `patient-service`.
- Database owner: `patient-database`, PostgreSQL 16 hoặc logical DB riêng với credential riêng.
- Kong target chốt: service URL `http://patient-service:5004/patients`, route path `/api/patients`, `strip_path: true`. Vì vậy `/api/patients/me` phải được test là forward thành `/patients/me`.
- Patient `/health` dùng Docker internal healthcheck; không tạo public `/health` route xung đột Auth. Nếu cần expose qua gateway, dùng `/api/patients/health` với route riêng.
- CORS allowlist cho Patient route phải thêm `Idempotency-Key`; không dùng `If-Match` vì optimistic version nằm trong body.
- Không publish Patient Service/DB host ports trong production-like config; dev override có thể expose khi cần.
- Vì Kong database-backed config chỉ import declarative file khi DB trống, implementation phải có bước apply/verify route trên Kong DB hiện có mà không mặc định xóa volume.
- Không thêm Redis, RabbitMQ, Kafka, Kubernetes hoặc service mesh.

---

## 10. Testing và Acceptance

### Traceability

| Rule | Scenario | API | Test level |
|---|---|---|---|
| BR-001/002/004 | SCN-001/002/006 | API-002 | Unit + integration + E2E |
| BR-003 | SCN-005 | API-002/007 | Integration |
| BR-005 | SCN-004 | API-003/004 | E2E security |
| BR-007/013 | SCN-008/009 | API-006 | Integration + E2E |
| BR-008 | SCN-007 | API-005 | Integration concurrency |
| BR-009 | SCN-011 | API-009..011 | Unit + integration |
| BR-012 | SCN-012 | API-005/006 | Integration |
| BR-014 | SCN-003 | API-002/005/007 | Unit + E2E |

### Minimum tests

- [ ] Health endpoint.
- [ ] HTTP global validation: unknown fields bị reject.
- [ ] `/patients/me` create, read, update và retry.
- [ ] JWT missing/invalid role và ownership/IDOR.
- [ ] Required-field, phone, national ID, date validation.
- [ ] Unique `authAccountId` và `nationalId` với PostgreSQL thật.
- [ ] Concurrent create cùng account.
- [ ] Optimistic concurrent update.
- [ ] Receptionist search filter, pagination, masking và no-list-all.
- [ ] Internal eligibility chỉ trả minimal data.
- [ ] Emergency contact limit, primary switch và idempotent delete.
- [ ] Audit atomicity với sensitive update.
- [ ] Logs/errors không chứa raw national ID, token hoặc PHI.
- [ ] OpenAPI contract và Kong route sau khi implementation nằm trong scope.

### Acceptance criteria

#### AC-001 — Thai phụ hoàn thiện Patient Profile

```gherkin
Given PATIENT đã đăng ký Auth account và login thành công
And chưa có Patient Profile liên kết JWT sub
When PATIENT gửi PUT /patients/me với dữ liệu hợp lệ
Then một Patient Profile duy nhất được tạo
And eligibility derived của Patient là COMPLETE
And PATIENT có thể lấy profile qua GET /patients/me
And không cần Auth Service trong normal Patient request path
```

#### AC-002 — Lễ tân tìm Patient an toàn

```gherkin
Given RECEPTIONIST đã authenticated
And Patient tồn tại với phone hoặc nationalId đã normalize
When RECEPTIONIST search bằng ít nhất một filter hợp lệ
Then response được phân trang và chỉ chứa summary cần cho check-in
And high-risk PII được mask
And thao tác search được audit
```

#### AC-003 — Chống Patient trùng khi concurrent create

```gherkin
Given chưa có Patient cho authAccountId A1
When hai create request cùng A1 chạy đồng thời
Then chỉ có một Patient liên kết A1
And không có duplicate record hoặc duplicate success audit
```

#### AC-004 — Appointment chỉ nhận eligibility tối thiểu

```gherkin
Given Appointment Service được internal-authenticated
When kiểm tra Patient đủ điều kiện đặt lịch
Then Patient Service trả ID, profile status, eligibility và missing fields
And không trả nationalId, address, emergency contacts hoặc dữ liệu y tế
```

---

## 11. Implementation Plan và Checklist

| Phase | Mục tiêu | Files/Modules dự kiến | DB/Infrastructure | Verify |
|---|---|---|---|---|
| 1 | Foundation | Nest app, config validation, health, JWT verifier, Patient Prisma client riêng | Patient DB + migrations riêng | Build + health/JWT unit tests |
| 2 | PATIENT self-service | Patient repository/service, `/patients/me`, own emergency contacts, local audit | Patient/contact/audit constraints + encrypted national ID fields | Unit + PostgreSQL integration + E2E |
| 3 | Gateway integration | OpenAPI, Kong protected route, CORS, rate limit | Apply/verify Kong config trên DB hiện có; không xóa volume | Contract + route/JWT E2E |
| 4 | RECEPTIONIST flow — BLOCKED | Detail/search/create/update, idempotency, masking | Chỉ bắt đầu sau Auth role contract và staff permissions được approve | Security + concurrency E2E |
| 5 | Internal eligibility — FUTURE/BLOCKED | API-008 | Chỉ bắt đầu sau service identity/scope contract | Service-auth contract tests |
| 6 | Hardening | Key rotation/JWKS refresh, retention, observability | Readiness/backup policy | Failure/security tests |

Checklist trước khi tuyên bố implementation hoàn thành:

- [ ] Boundary không chứa credential, appointment, queue, billing hoặc clinical data.
- [ ] Patient DB, Prisma schema/client/migrations tách khỏi Auth/Kong.
- [ ] Entities, unique/check constraints, indexes, encryption/HMAC và optimistic version đúng spec.
- [ ] API request/response/error khớp OpenAPI.
- [ ] PATIENT dùng `/me`; không có IDOR qua arbitrary patient ID.
- [ ] RECEPTIONIST search/detail/update có data minimization và audit.
- [ ] Internal eligibility không trả PII dư thừa.
- [ ] Không gọi Auth Service để verify mỗi request.
- [ ] Không query database service khác.
- [ ] Idempotency/concurrency/failure behavior được test.
- [ ] Không log hoặc commit secret/PII/PHI.
- [ ] Build, lint, unit, integration, contract và E2E liên quan pass.

---

## 12. Assumptions, Open Questions và Approval

### Assumptions đã dùng trong draft

- Một Auth account `PATIENT` liên kết tối đa một Patient Profile.
- Hồ sơ được tạo tại quầy có thể tồn tại mà chưa có Auth account.
- Public Auth registration không cần tạo Patient synchronously.
- `fullName`, `dateOfBirth`, `phoneNumber` là bộ field tối thiểu để đặt lịch.
- `nationalId` optional nhưng unique khi có.
- Phone không unique tuyệt đối vì có thể dùng chung trong gia đình.
- Patient Service không lưu clinical pregnancy data.
- Phase đầu dùng REST và local PostgreSQL transaction, không dùng event broker.

### Open questions cần approve

1. `nationalId` có bắt buộc trước check-in hoặc đặt lịch không?
2. Exact permission của RECEPTIONIST: được sửa field nào và có cần reason bắt buộc cho identity fields không?
3. DOCTOR/NURSE có cần gọi Patient Service trực tiếp hay chỉ nhận demographic snapshot qua encounter/Medical Record?
4. Quy trình liên kết Patient tạo tại quầy với Auth account sau này là gì? Không được tự match bằng phone/email.
5. Có cần merge duplicate Patient không, và ai approve merge?
6. Retention, legal deletion, soft-delete và quyền chỉnh sửa lịch sử định danh là gì?
7. Có cần lưu encrypted history của giá trị PII trước/sau không?
8. Service-to-service authentication giữa Appointment/Check-in và Patient dùng cơ chế nào?
9. Port `5004`, gateway base path `/api/patients` và database deployment đã phù hợp chưa?
10. `PUT /patients/me` trả `201` cho create và `200` cho update có được frontend chấp nhận không?
11. Auth sẽ enforce một active role/account hay chuyển sang deterministic `roles[]` trước khi mở RECEPTIONIST endpoints?
12. National ID encryption key ownership/rotation và audit retention cụ thể là gì?

### Out of scope

- Source code, migration, OpenAPI, Kong config và Docker Compose implementation trong task thiết kế này.
- Pregnancy episode, tuổi thai, tiền sử bệnh/sản khoa và medical records.
- Patient merge, account linking, guardian/dependent account.
- Admin patient management UI.
- Event broker/outbox.
- Advanced search engine hoặc fuzzy matching.

### Các khác biệt hiện trạng cần lưu ý

- `docs/architecture.md` vẫn là template và chưa phản ánh architecture thực tế.
- Auth README/SETUP có đoạn ghi chưa implement JWT/refresh/JWKS, nhưng source hiện đã implement.
- Auth OpenAPI mô tả register trả `AuthResponse`, trong source register chỉ trả `{ user }`.
- Auth OpenAPI example role dùng lowercase `patient`, source dùng uppercase `PATIENT`.
- `.env.example` ghi public key chưa dùng, nhưng source dùng cho `/auth/me` và JWKS.
- Kong đã route Auth/JWKS nhưng chưa verify JWT, chưa rate-limit auth routes và chưa có Patient route.
- Docker Compose hiện expose Auth/Sample/DB host ports; gateway bypass protection target chưa được áp dụng đầy đủ.
- Tài liệu cũ đặt “tuần thai hiện tại, tiền sử bệnh” trong Patient; spec này chủ động không làm vậy để giữ Medical Record boundary. Đây là quyết định kiến trúc cần approve.

### Approval

- **Status:** Draft
- **Approved by / Date:** Chưa có
- **Notes:** Không implement Patient Service cho đến khi boundary và các open questions quan trọng được approve.

> Mọi thay đổi ảnh hưởng service boundary, public API, database schema, event contract hoặc security model phải cập nhật spec trước khi implement.
