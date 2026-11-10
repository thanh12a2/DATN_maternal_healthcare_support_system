# Backend contract cho Flutter `maternal_health_care`

Đối chiếu controller, DTO, service, presenter, Prisma và Kong ngày **07/11/2026**. Đây là contract theo implementation trong repo. Ví dụ dùng dữ liệu giả; ID phải lấy từ response thật. Repo này không chứa source của app Flutter được mô tả.

## 1. Kết luận cho frontend agent

App có thể nối đăng nhập thật, đọc/tạo/cập nhật hồ sơ, đọc danh sách/chi tiết lịch khám và đọc hành trình hàng đợi của chính bệnh nhân. **Chưa thể nối toàn bộ màn hình hiện tại bằng token `PATIENT`: hóa đơn bị giới hạn cho nhân viên; hủy/đổi lịch cũng chỉ dành cho nhân viên; thông báo chưa có REST inbox.** Những giới hạn này chưa được thay đổi trong lần chuẩn bị này.

| Chức năng | Method + path qua gateway | Quyền / khả năng hiện tại |
|---|---|---|
| Health | `GET /health` | Public; health của Auth, không đại diện mọi dependency |
| Login | `POST /auth/login` | Public; email + password thật |
| Tài khoản hiện tại | `GET /auth/me` | Bearer token |
| Refresh | `POST /auth/refresh` | Refresh token trong JSON |
| Logout | `POST /auth/logout` | Refresh token trong JSON; 204 không body |
| Đăng ký | `POST /auth/register` | Public; tạo tài khoản PATIENT, chưa tạo hồ sơ và chưa trả token |
| Quên mật khẩu | `POST /auth/forgot-password` | Public; cần SMTP và reset URL hoạt động |
| Đặt lại mật khẩu | `POST /auth/reset-password` | Public; token từ email |
| Đổi mật khẩu | `POST /auth/change-password` | Bearer token |
| Đọc hồ sơ của tôi | `GET /api/patients/me` | PATIENT; `{data: ...}` |
| Tạo/cập nhật hồ sơ của tôi | `PUT /api/patients/me` | PATIENT; PUT đầy đủ trường bắt buộc; dùng `version` khi sửa |
| Danh sách lịch khám | `GET /api/appointment/appointments` | PATIENT tự lọc theo tài khoản trong JWT |
| Chi tiết lịch khám | `GET /api/appointment/appointments/{id}` | PATIENT chỉ xem lịch thuộc mình |
| Hủy lịch | `POST /api/appointment/appointments/{id}/cancel` | Chỉ RECEPTIONIST, CLINIC_MANAGER, ADMIN; PATIENT nhận 403 |
| Đổi lịch | `POST /api/appointment/appointments/{id}/reschedule` | Chỉ RECEPTIONIST, CLINIC_MANAGER, ADMIN; PATIENT nhận 403 |
| Slot có thể đặt | `GET /api/appointment/bookable-slots` | Có JWT; dùng khi chọn lịch mới |
| Giữ slot | `POST /api/appointment/slot-holds` | PATIENT giữ cho chính mình; cần Idempotency-Key |
| Nhả slot | `DELETE /api/appointment/slot-holds/{holdId}` | Kiểm tra chủ sở hữu; hiện trả 200 không body |
| Tạo lịch từ hold | `POST /api/appointment/appointments` | PATIENT; `channel=ONLINE`; cần Idempotency-Key |
| Hàng đợi của tôi | `GET /api/queue/me/journeys/active` | Resolve patient theo JWT; 404 khi chưa có hành trình ACTIVE |
| Thay đổi hàng đợi | `GET /api/queue/me/events` | SSE có JWT; tùy chọn sau bản đầu |
| Danh sách hóa đơn | `GET /api/billing/invoices` | Chỉ RECEPTIONIST, ADMIN; PATIENT nhận 403 |
| Chi tiết hóa đơn | `GET /api/billing/invoices/{id}` | Chỉ RECEPTIONIST, ADMIN; PATIENT nhận 403 nếu hóa đơn tồn tại |
| Thông báo | **Chưa có REST route cho app** | Notification chỉ health HTTP và truy vấn gRPC nội bộ |

Path có cả `/api/appointment/appointments` là chủ ý: Kong bỏ `/api/appointment` trước khi chuyển tới controller `/appointments`. Không thêm `/api` trước `/auth`, không tự đổi thành `/api/appointments`.

Không dùng `GET/PATCH /api/patients/{patientId}` để đọc/sửa hồ sơ của tôi: đây là luồng nhân viên tiếp nhận. Không mang tài khoản hoặc token nhân viên vào app bệnh nhân để vượt giới hạn quyền.

## 2. Base URL, Docker và môi trường

| Môi trường app | Base URL mặc định |
|---|---|
| Công cụ trên máy chạy Docker | `http://localhost:8080` |
| Android Emulator chuẩn Android Studio | `http://10.0.2.2:8080` |
| Điện thoại thật cùng LAN | `http://<IPv4-LAN-của-máy-chạy-Docker>:8080` |
| Production | `https://api.example.com` (ví dụ; cần domain/TLS triển khai thực tế) |

Base URL **không chứa `/api`** vì Auth và các domain có prefix khác nhau. `localhost` trên Android là thiết bị/emulator, không phải máy chạy Docker. Ví dụ máy có IPv4 `192.168.1.20`, điện thoại gọi `http://192.168.1.20:8080/health`. Dùng IPv4 card Wi-Fi/Ethernet đang kết nối, không dùng IP nội bộ container. Firewall của host cần cho phép TCP port gateway từ LAN.

Đã đặt `app.listen(PORT, '0.0.0.0')` tường minh tại Auth, Patient, Appointment, Billing, Queue, Notification. Trước đó các service không truyền hostname; thay đổi này làm rõ IPv4 bind, không khẳng định bản cũ chỉ bind localhost.

Cấu hình hiện có đã đủ công bố HTTP:

- `gateway/Dockerfile`: `KONG_PROXY_LISTEN=0.0.0.0:8000`, `EXPOSE 8000`.
- `docker-compose.yml`: `${GATEWAY_PORT:-8080}:8000`, mặc định publish trên mọi interface. Kong Admin/Manager 8001/8002 chỉ publish `127.0.0.1`; không phải API base của mobile.
- Các service HTTP đã có port mapping; `services/Dockerfile` đã `EXPOSE` các port liên quan. `EXPOSE` chỉ mô tả port, Compose `ports` mới công bố ra host. App nên đi qua gateway 8080.
- Port host trực tiếp để debug: Auth 5003, Patient 5004, Appointment 5008, Billing 5009, Queue 5012, Notification 5016. Khi gọi trực tiếp phải dùng path controller, không dùng prefix Kong; ví dụ `http://localhost:5008/appointments`.

Lệnh setup, chạy, kiểm tra và rebuild nằm trong [README, mục 11](../../README.md#11-kết-nối-app-flutter). Không cần đổi Dockerfile hay Compose để publish thêm API mobile.

Các biến cần có trên **server**, theo `.env.example` và script setup:

| Nhóm | Biến / ý nghĩa |
|---|---|
| Cổng | `GATEWAY_PORT=8080`; giữ port Auth nội bộ 5003 vì Kong upstream đang dùng 5003 |
| JWT người dùng | `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY`, `AUTH_JWT_ISSUER=maternal-healthcare-auth`, `AUTH_JWT_AUDIENCE=maternal-healthcare-api`, `AUTH_JWT_KEY_ID` |
| Session | `AUTH_ACCESS_TOKEN_TTL_SECONDS=900`, `AUTH_REFRESH_TOKEN_TTL_DAYS=30`, `AUTH_REFRESH_TOKEN_PEPPER` |
| Nội bộ | `INTERNAL_SERVICE_JWT_PRIVATE_KEY/PUBLIC_KEY`, issuer/key ID; các target `*_GRPC_TARGET` theo Compose |
| Hồ sơ | `PATIENT_NATIONAL_ID_ENCRYPTION_KEY`, `PATIENT_NATIONAL_ID_LOOKUP_PEPPER`; cấu hình trust/JWKS Patient theo template |
| Database/event | PostgreSQL từng service; các `*_DATABASE_URL`; `RABBITMQ_URL` và exchange. Compose tự đặt hostname Docker cho dependency |
| Password reset, tùy chọn | `AUTH_SMTP_HOST/PORT/SECURE/USER/PASSWORD`, `AUTH_EMAIL_FROM`, `AUTH_PASSWORD_RESET_URL`, `AUTH_PASSWORD_RESET_PEPPER` |

Không copy `.env` server sang Flutter. App chỉ cần cấu hình riêng như `API_BASE_URL`; đây là tên đề xuất cho app, backend không đọc biến này. `VITE_API_BASE_URL` dành cho frontend web sẵn có, không tự cấu hình Flutter. Giữ JWT private key, pepper, database credential và VNPay secret ở server.

Flutter native thường không cần CORS. Android cần quyền `android.permission.INTERNET`; khi phát triển qua HTTP cần cấu hình cleartext cho build development phù hợp; production dùng HTTPS.

Nếu chạy Flutter Web, CORS hiện được xử lý ở plugin Kong trong `docs/api-specs/kong.yml`: chỉ chấp nhận origin `http://localhost:3000`, `http://localhost:3001`, `http://127.0.0.1:3000`, `http://127.0.0.1:3001`; có Authorization/Content-Type/Idempotency-Key và OPTIONS. Chạy web bằng origin đã cho phép hoặc thêm **đúng scheme + host + port** của web vào `plugins → cors → config → origins`. Rebuild/reimport gateway và kong-init theo README; sửa YAML trên host chưa tự cập nhật DB Kong. Không cần mở CORS `*` cho native. Nếu web gọi thẳng port service, CORS Kong không có hiệu lực.

## 3. Quy ước JSON và kiểu dữ liệu

- Request/response JSON dùng `Content-Type: application/json`, trừ SSE và response không body.
- ID là string UUID; `user.userId` là Auth account ID, **khác** `patient.id`. Không gán hai ID này cho nhau.
- Ngày sinh và `businessDate`: string `YYYY-MM-DD`, không phải timestamp. Ngày sinh không được ở tương lai.
- Auth/Patient/Appointment/Billing: datetime thông thường là ISO 8601 có múi giờ, ví dụ `2026-11-08T01:00:00.000Z` = 08:00 Việt Nam. Request dùng `Z` hoặc offset `+07:00`, tránh string thiếu timezone. Khi dùng `+07:00` trong query phải URL-encode dấu `+`.
- **Ngoại lệ Queue journey:** `enqueuedAt`, `calledAt`, `callExpiresAt` là object protobuf Timestamp `{ "seconds": "1794099600", "nanos": 0 }`; `seconds` là string. Flutter chuyển bằng milliseconds = `int.parse(seconds) * 1000 + nanos ~/ 1000000`, UTC rồi hiển thị local. Không gọi `DateTime.parse` trực tiếp trên object này.
- Tiền: các trường `*Minor` là JSON integer, không phải string và không phải decimal. `currency="VND"`, `250000` nghĩa là 250.000 đồng; không chia 100. Việc nhân 100 trong giao thức VNPay do backend thực hiện riêng. Presenter đang chuyển BigInt sang JS number; không dùng giá trị vượt `Number.MAX_SAFE_INTEGER`.
- `version` của Patient/Appointment/Billing là integer. Journey/ticket trong endpoint Queue `/me/journeys/active` có `version` **string**, ví dụ `"1"`.
- Chưa có response envelope chung: Auth trả token/user ở top level; Patient `{data}`; Appointment/Billing list `{items,nextPageToken}` và detail là object trực tiếp; Queue active `{data,id}`. Không unwrap mọi API bằng cùng một `.data`.
- Trường nullable có thể là `null`; một số timestamp Queue chưa có thì bị bỏ khỏi JSON. Parser cần xử lý trường optional và enum mới.

## 4. Đăng nhập, refresh và logout

`POST /auth/login` → **200**:

```json
{
  "email": "patient@example.com",
  "password": "ExamplePassword123!"
}
```

```json
{
  "accessToken": "<RS256-JWT>",
  "refreshToken": "<opaque-refresh-token>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "userId": "11111111-1111-4111-8111-111111111111",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Login dùng **email**, chưa hỗ trợ số điện thoại/OTP/social login. Password tối thiểu 8 ký tự. App bệnh nhân cần kiểm tra `user.role == "PATIENT"` trước khi mở luồng hồ sơ.

Gửi header cho các request xác thực:

```http
Authorization: Bearer <accessToken>
Accept: application/json
```

`GET /auth/me` → **200**, body chỉ chứa `{ "user": { "userId": "...", "email": "...", "role": "PATIENT" } }`; không phải hồ sơ y tế.

`POST /auth/refresh` → **200**, không cần access token:

```json
{ "refreshToken": "<refresh-token-hiện-tại>" }
```

Response cùng cấu trúc login, chứa **accessToken và refreshToken mới**. Refresh xoay token, phải lưu cặp mới; token refresh cũ không dùng lại được. TTL mặc định access 900 giây, refresh 30 ngày theo config. App nên lưu token bằng cơ chế secure storage của nền tảng, gộp các request refresh đồng thời thành một lần. Khi API trả 401 do hết access token, refresh rồi retry tối đa một lần; refresh 401 thì xóa session và về login. Không refresh khi nhận 403.

`POST /auth/logout` → **204, không có JSON**:

```json
{ "refreshToken": "<refresh-token-mới-nhất>" }
```

Logout revoke refresh session tương ứng; không lập tức vô hiệu hóa JWT access đã phát hành tại mọi service. App xóa token local; access token cũ có thể còn hợp lệ đến `exp`. Không cố parse body rỗng của logout thành JSON.

Form demo đăng ký/quên mật khẩu có API thật để nối sau:

| API | Request | Response thành công |
|---|---|---|
| `POST /auth/register` | `{"email":"patient@example.com","password":"ExamplePassword123!"}` | 201 `{"user":{"userId":"...","email":"patient@example.com","role":"PATIENT"}}`; sau đó login riêng và tạo hồ sơ |
| `POST /auth/forgot-password` | `{"email":"patient@example.com"}` | 202 `{"message":"If an eligible account exists, password reset instructions will be sent."}`; không tiết lộ tài khoản có tồn tại |
| `POST /auth/reset-password` | `{"token":"<token-từ-email>","newPassword":"AnotherPassword123!"}` | 204 không body |
| `POST /auth/change-password` | `{"currentPassword":"ExamplePassword123!","newPassword":"AnotherPassword123!"}` + Bearer | 204 không body |

`AUTH_PASSWORD_RESET_URL` mặc định trỏ web localhost:3000. Native cần luồng mở link/reset token phù hợp; chưa có contract deep link mobile. HTTP 202 không chứng minh email đã được gửi đến hộp thư.

## 5. Hồ sơ bệnh nhân

`GET /api/patients/me` → **200**:

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "fullName": "Nguyễn Thị An",
    "dateOfBirth": "1997-06-15",
    "phoneNumber": "+84901234567",
    "nationalIdMasked": null,
    "nationalId": null,
    "address": "TP. Hồ Chí Minh",
    "profileStatus": "COMPLETE",
    "version": 1,
    "emergencyContacts": []
  }
}
```

Nếu tài khoản mới chưa có hồ sơ: **404 `PATIENT_PROFILE_NOT_FOUND`**, không phải session hết hạn. Chuyển sang form hoàn thiện hồ sơ.

`PUT /api/patients/me` tạo hồ sơ → **201**, cập nhật → **200**; response cùng `{data: Patient}` như GET. Request tạo:

```json
{
  "fullName": "Nguyễn Thị An",
  "dateOfBirth": "1997-06-15",
  "phoneNumber": "+84901234567",
  "nationalId": null,
  "address": "TP. Hồ Chí Minh"
}
```

Request cập nhật phải gửi đủ `fullName`, `dateOfBirth`, `phoneNumber` và `version` mới nhất:

```json
{
  "fullName": "Nguyễn Thị An",
  "dateOfBirth": "1997-06-15",
  "phoneNumber": "+84901234567",
  "nationalId": null,
  "address": "Địa chỉ mới tại TP. Hồ Chí Minh",
  "version": 1
}
```

Không gửi lại nguyên response: `id`, `profileStatus`, `nationalIdMasked`, `emergencyContacts` không thuộc DTO PUT và bị reject. Thiếu `address`/`nationalId` được chuẩn hóa về null, nên giữ giá trị hiện tại nếu không muốn xóa. `nationalId` nhận 9 hoặc 12 chữ số nếu có. Số điện thoại được chuẩn hóa, ví dụ `0901234567` → `+84901234567`. Khi sửa thực sự, response version tăng; 409 `CONCURRENT_UPDATE` thì tải lại và cho người dùng xử lý; 409 `VERSION_REQUIRED` khi sửa mà thiếu version.

Model hiện chưa có các trường theo dõi thai kỳ như tuần thai/ngày dự sinh/nhóm máu trong self-profile DTO. Không gửi các trường hard-code của Flutter chưa được DTO hỗ trợ. Emergency contacts dùng endpoint riêng; không cập nhật qua PUT me.

## 6. Lịch khám

`GET /api/appointment/appointments?limit=20&status=BOOKED&from=2026-11-01T00%3A00%3A00Z&to=2026-12-01T00%3A00%3A00Z` → **200**. Tất cả filter đều optional; `limit` 1–100, mặc định 20; sort `startAt ASC, id ASC`. Server xác định patient từ JWT, app không cần gửi `patientId`.

```json
{
  "items": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "appointmentCode": "APTM-EXAMPLE",
      "patientId": "22222222-2222-4222-8222-222222222222",
      "serviceId": "44444444-4444-4444-8444-444444444444",
      "channel": "ONLINE",
      "selectionMode": "DOCTOR",
      "requestedDoctorId": "55555555-5555-4555-8555-555555555555",
      "requestedRankCode": null,
      "assignedDoctorId": "55555555-5555-4555-8555-555555555555",
      "assignedRankCode": "BASIC",
      "specialtyId": "66666666-6666-4666-8666-666666666666",
      "roomId": null,
      "roomCode": "P.101",
      "roomName": "Phòng khám sản",
      "room": { "id": null, "code": "P.101", "name": "Phòng khám sản" },
      "availabilityVersion": 1,
      "startAt": "2026-11-08T01:00:00.000Z",
      "endAt": "2026-11-08T01:30:00.000Z",
      "status": "BOOKED",
      "pricing": {
        "serviceName": "Khám thai",
        "serviceVersion": 1,
        "basePriceId": "77777777-7777-4777-8777-777777777777",
        "baseAmountMinor": 250000,
        "rankSurchargePriceId": null,
        "rankSurchargeAmountMinor": 0,
        "estimatedTotalMinor": 250000,
        "currency": "VND"
      },
      "queueEstimateMinutes": 15,
      "receptionCaseId": null,
      "encounterId": null,
      "checkedInAt": null,
      "clinicalStartedAt": null,
      "completedAt": null,
      "cancellationReason": null,
      "rescheduleCount": 0,
      "version": 1,
      "createdAt": "2026-11-07T03:00:00.000Z",
      "updatedAt": "2026-11-07T03:00:00.000Z"
    }
  ],
  "nextPageToken": null
}
```

Trang tiếp theo: gửi `cursor=<nextPageToken>`, giữ filter cũ; dừng khi token null. Không gửi `pageSize`, `page` hoặc `nextPageToken` làm tên query. `GET /api/appointment/appointments/{id}` trả **200 object appointment trực tiếp**, không có `{data}`. Detail cũng hỗ trợ appointmentCode; mutation nên luôn dùng UUID `id`. Detail không trả tên bác sĩ; nếu UI cần, tra API Doctor đã có `GET /api/doctors/{doctorId}` với Bearer token (trả hồ sơ công khai của bác sĩ ACTIVE; xem spec Doctor).

Enum `status`: `BOOKED`, `REASSIGNMENT_REQUIRED`, `CHECKED_IN`, `IN_CLINICAL_CARE`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. `channel`: `ONLINE`, `RECEPTION`, `WALK_IN`. `selectionMode`: `DOCTOR`, `RANK`. Dùng đúng giá trị enum, không gửi nhãn tiếng Việt làm filter.

### Hủy/đổi lịch hiện chỉ dành cho nhân viên

**App PATIENT chưa được gọi hai mutation này thành công.** Ẩn/vô hiệu hóa nút hoặc hiển thị hướng dẫn liên hệ phòng khám; không mô phỏng cập nhật thành công trên dữ liệu server. Contract nhân viên hiện có, để backend/frontend cùng biết phần đã tồn tại:

`POST /api/appointment/appointments/{id}/cancel`, Bearer nhân viên + `Idempotency-Key: <UUID-thao-tác>`, body:

```json
{ "reason": "Bệnh nhân đề nghị hủy lịch", "expectedVersion": 1 }
```

Chỉ hủy trạng thái `BOOKED` hoặc `REASSIGNMENT_REQUIRED`. Response hiện là **201** (Nest POST mặc định; controller chưa override), object appointment với `status="CANCELLED"`, cancellationReason và version mới. PATIENT nhận 403 trước nghiệp vụ hủy.

Đổi lịch dùng hold, không gửi thẳng `startAt` vào reschedule:

1. `GET /api/appointment/bookable-slots?serviceId=<UUID>&selectionMode=DOCTOR&doctorId=<UUID>&from=<ISO>&to=<ISO>` → 200 `{items:[{serviceId,selectionMode,doctorId,doctorName,rankCode,roomId,roomCode,roomName,room,startAt,endAt,availableCapacity,isAvailable}],nextPageToken:null}`. Đây là mô tả trường, không phải JSON mẫu để copy. Chọn item `isAvailable=true`.
2. `POST /api/appointment/slot-holds`, Idempotency-Key, body mẫu dưới; nhân viên thêm `patientId` của lịch cần đổi, PATIENT giữ cho chính mình.
3. Nhân viên gọi `POST /api/appointment/appointments/{id}/reschedule`, body mẫu dưới + Idempotency-Key riêng.

```json
{
  "serviceId": "44444444-4444-4444-8444-444444444444",
  "selectionMode": "DOCTOR",
  "requestedDoctorId": "55555555-5555-4555-8555-555555555555",
  "startAt": "2026-11-09T02:00:00.000Z",
  "endAt": "2026-11-09T02:30:00.000Z"
}
```

Hold trả **201 object trực tiếp** gồm `id,patientId,serviceId,doctorId,rankCode,selectionMode,roomId,roomCode,roomName,room,startAt,endAt,status,expiresAt,createdAt`. Dùng `id` làm `newHoldId`; kiểm tra `expiresAt` từ server.

```json
{
  "newHoldId": "88888888-8888-4888-8888-888888888888",
  "expectedVersion": 1,
  "reason": "Bệnh nhân đề nghị đổi ngày khám"
}
```

Reschedule thành công hiện trả **201 object appointment** với giờ mới, version và rescheduleCount tăng. Chỉ đổi lịch ở trạng thái `BOOKED` hoặc `REASSIGNMENT_REQUIRED`. `reason` 3–500 ký tự, `expectedVersion` integer >=1. Khi 409, tải lại lịch/slot; không retry mù với version cũ. Với API có hỗ trợ replay (như tạo hold/tạo lịch), Idempotency-Key cần giữ nguyên cho retry cùng thao tác/body, tạo key mới cho thao tác mới. Riêng reschedule hiện nhận header nhưng chưa lưu/replay idempotency; nếu mất response sau khi đổi thành công, refetch lịch để xác định kết quả trước khi thử lại.

Nếu sau này nối tạo lịch mới, đã có `POST /api/appointment/appointments` với `{"holdId":"<hold-id>","channel":"ONLINE"}` + Idempotency-Key, trả 201 appointment. Việc có API tạo lịch không có nghĩa PATIENT đã được quyền hủy/đổi lịch.

## 7. Hàng đợi chỉ để xem

`GET /api/queue/me/journeys/active` → **200**:

```json
{
  "data": {
    "id": "99999999-9999-4999-8999-999999999999",
    "journeyId": "99999999-9999-4999-8999-999999999999",
    "appointmentId": "33333333-3333-4333-8333-333333333333",
    "patientId": "22222222-2222-4222-8222-222222222222",
    "encounterId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "businessDate": "2026-11-08",
    "lateMinutes": 0,
    "lateDemoted": false,
    "state": "JOURNEY_STATE_ACTIVE",
    "version": "1",
    "tickets": [
      {
        "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "ticketId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "journeyId": "99999999-9999-4999-8999-999999999999",
        "stageId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "sourceOrderId": "",
        "stageCode": "CONSULTATION",
        "roomCode": "P.101",
        "ordinal": 3,
        "ticketCode": "101-03",
        "state": "TICKET_STATE_WAITING",
        "basePriority": "BASE_PRIORITY_ROUTINE",
        "lateDemotion": false,
        "callCount": 0,
        "version": "1",
        "enqueuedAt": { "seconds": "1794099600", "nanos": 0 }
      }
    ]
  },
  "id": "99999999-9999-4999-8999-999999999999"
}
```

Journey state có prefix `JOURNEY_STATE_` + `ACTIVE/COMPLETED/CANCELLED`. Ticket state có prefix `TICKET_STATE_` + `WAITING/CALLED/IN_SERVICE/COMPLETED/SKIPPED/CANCELLED`. Không áp parser enum trạng thái lịch khám vào Queue.

404 `ACTIVE_JOURNEY_NOT_FOUND`: hiển thị chưa có lượt khám đang hoạt động. Chỉ có lịch đặt chưa đảm bảo có journey; journey thường được tạo trong luồng tiếp nhận của phòng khám. Có thể polling khi màn hình đang mở, ví dụ 15–30 giây; đây là gợi ý client, không phải SLA. `ordinal`/`ticketCode` là số thứ tự phát hành, không phải số người đang chờ phía trước.

SSE tùy chọn: `GET /api/queue/me/events` + Authorization + `Accept: text/event-stream`. Ví dụ event:

```text
event: queue.ticket_called.v1
data: {"journeyId":"99999999-9999-4999-8999-999999999999","ticketId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","state":"CALLED","version":"2"}
```

**SSE state không có prefix**; nhận event rồi refetch active journey. Heartbeat 25 giây; không có persisted replay/Last-Event-ID contract. SSE không thay thế push notification khi app bị đóng/background.

Các route đã tồn tại nhưng **chưa nên dùng trong app bệnh nhân**: `GET /api/queue/stages`, `GET /api/queue/stages/{stageId}/tickets`, `GET /api/queue/journeys/{id}`, `POST /api/queue/journeys`. Controller hiện chỉ kiểm JWT ở các route này, chưa kiểm ownership/role đầy đủ; list tickets có patientId/encounterId của người khác, create journey có thể nhận patientId tùy ý. Cần siết quyền trước production. Không dùng danh sách toàn phòng làm cách tính vị trí chờ trong mobile; nên bổ sung endpoint riêng chỉ trả ticket của mình và số người phía trước đã ẩn danh. App không gọi call-next/start/complete/requeue/cancel hay tự tạo journey.

## 8. Hóa đơn và tình trạng thanh toán

**Bản backend hiện tại chưa hỗ trợ PATIENT đọc hóa đơn của mình.** `BillingDomainService.list/get` chỉ cho `RECEPTIONIST`, `ADMIN`; truyền `patientId` bằng query không mở quyền. Contract dưới đây mô tả route hiện hữu dành cho nhân viên, chưa phải tính năng có thể bật trong Flutter.

`GET /api/billing/invoices?patientId=<UUID>&limit=20&status=OPEN` → 200 `{ "items": [invoice], "nextPageToken": null }`. Filter optional: `patientId,appointmentId,encounterId,type,status,limit,cursor`. Dùng `cursor=nextPageToken` cho trang kế tiếp; mặc định limit 20, DTO hiện chỉ ràng buộc minimum 1, chưa có maximum. Sort `createdAt DESC,id ASC`.

`GET /api/billing/invoices/{id}` → 200 object trực tiếp, ví dụ hóa đơn chưa thanh toán:

```json
{
  "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "invoiceId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "invoiceNumber": "INV-EXAMPLE",
  "patientId": "22222222-2222-4222-8222-222222222222",
  "appointmentId": "33333333-3333-4333-8333-333333333333",
  "encounterId": null,
  "type": "BASE",
  "status": "OPEN",
  "currency": "VND",
  "subtotalMinor": 250000,
  "totalMinor": 250000,
  "paidMinor": 0,
  "balanceMinor": 250000,
  "sourceVersion": 1,
  "dueAt": null,
  "paidAt": null,
  "version": 1,
  "lines": [
    {
      "id": "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "invoiceId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "lineNo": 1,
      "source": "APPOINTMENT_SNAPSHOT",
      "sourceReferenceId": "33333333-3333-4333-8333-333333333333",
      "serviceId": "44444444-4444-4444-8444-444444444444",
      "descriptionSnapshot": "Khám thai",
      "quantity": 1,
      "unitAmountMinor": 250000,
      "lineAmountMinor": 250000,
      "priceReferenceId": "77777777-7777-4777-8777-777777777777",
      "performedAt": null,
      "createdAt": "2026-11-07T03:00:00.000Z"
    }
  ],
  "payment": null,
  "credits": [],
  "createdAt": "2026-11-07T03:00:00.000Z",
  "updatedAt": "2026-11-07T03:00:00.000Z"
}
```

Hóa đơn thực tế có `lines`; mỗi line gồm các trường Prisma như `id,invoiceId,lineNo,source,sourceReferenceId,serviceId,descriptionSnapshot,quantity,unitAmountMinor,lineAmountMinor,priceReferenceId,createdAt`. Hai amount được chuyển sang integer. `payment` nếu có chứa `id,invoiceId,method,status,amountMinor,receivedAt,verifiedAt,...`; `credits` là danh sách phê duyệt công nợ, không phải lịch sử giao dịch của người bệnh. Các trường bổ sung nullable/optional phải được parser chấp nhận.

`type`: `BASE`, `SUPPLEMENTARY`. `status`: `OPEN`, `PAYMENT_PENDING_VERIFICATION`, `PAID`, `CREDIT_APPROVED`, `OUTSTANDING`, `CANCELLED`. `payment.method`: `CASH`, `MANUAL_BANK_TRANSFER`, `VNPAY`; `payment.status`: `RECORDED`, `VERIFIED`, `REJECTED`. Không gán mọi trạng thái khác PAID thành thất bại.

Thanh toán trong repo **không chỉ là demo giao diện**:

- Có mã gateway VNPay: tạo URL có chữ ký, payment attempt và xử lý callback có chữ ký/IPN. `.env.example` mặc định dùng sandbox `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`; merchant code/hash secret để trống. Có implementation không chứng minh merchant sandbox hay production đã được kết nối và kiểm thử.
- `POST /api/billing/invoices/{id}/vnpay-attempts` hiện dành cho nhân viên, cần `expectedInvoiceVersion`, `returnPath` và Idempotency-Key. Thiếu cấu hình merchant sẽ nhận 503 `VNPAY_NOT_CONFIGURED` khi đến bước tạo URL. Chưa có contract checkout/deep link dành riêng cho native mobile.
- `GET /api/payment-callbacks/vnpay/ipn` là callback công khai qua Kong, xác minh chữ ký ở Billing. Mobile không gọi giả callback để đánh dấu đã trả tiền.
- `POST /api/billing/invoices/{id}/payments` ghi nhận tiền mặt/chuyển khoản thủ công cho nhân viên, **thay đổi sổ hóa đơn thật trong database**, không phải demo endpoint.
- Bản Flutter đầu giữ màn hình thanh toán demo tách khỏi hóa đơn server hoặc tạm tắt; không gọi endpoint ghi nhận payment từ nút demo và không hiển thị PAID cho hóa đơn thật sau thao tác giả lập. Lần chuẩn bị này không thêm giao dịch hoặc tích hợp payment provider mới.

## 9. Thông báo

Notification service đã có schema lưu Notification/DeliveryAttempt và consumer RabbitMQ; HTTP chỉ có `GET /health` trên port 5016. `GetDeliveryStatus`, `ListRecipientDeliveries` là gRPC nội bộ có service JWT, không phải REST cho app. Kong chưa có route notification.

Còn thiếu inbox REST cho chính tài khoản, xem chi tiết/đánh dấu đã đọc/unread count và đăng ký device token. Các delivery `PUSH`/`EMAIL` được tạo trong database chưa chứng minh đã gửi qua FCM/APNs/SMTP provider. Frontend chưa nối màn hình thông báo với server trong bản đầu.

## 10. Cấu trúc lỗi thực tế

Chưa có một schema lỗi chung cho mọi tầng; client cần normalize ở lớp API adapter.

Patient, Appointment, Billing thường trả:

```json
{
  "error": {
    "code": "CONCURRENT_UPDATE",
    "message": "Patient profile was updated by another request",
    "requestId": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
  }
}
```

Appointment/Billing có thể kèm `error.details`. Auth và Queue dùng Nest mặc định, ví dụ:

```json
{ "message": "Invalid credentials", "error": "Unauthorized", "statusCode": 401 }
```

Validation Auth có thể trả `message` dạng string array:

```json
{ "message": ["email must be an email"], "error": "Bad Request", "statusCode": 400 }
```

Kong từ chối trước khi vào service có thể chỉ trả `{"message":"Unauthorized"}` hoặc `{"message":"API rate limit exceeded"}`. Không giả định luôn có `error.code`/`requestId`, và không hiển thị raw body chưa kiểm tra cho người dùng.

| HTTP | Code/message theo khu vực | Cách xử lý ở Flutter |
|---|---|---|
| 400 | `VALIDATION_FAILED`, `INVALID_DATE_OF_BIRTH`, `IDEMPOTENCY_KEY_REQUIRED`; Auth message array | Kiểm tra trường/form; không refresh |
| 401 | Auth `Invalid credentials`; service `UNAUTHENTICATED`; Kong Unauthorized | Login sai: báo thông tin không đúng. API khác: refresh một lần nếu đang có session |
| 403 | `FORBIDDEN`, `Staff only` | Thiếu quyền; không refresh và không đổi sang token nhân viên |
| 404 | `PATIENT_PROFILE_NOT_FOUND`, `APPOINTMENT_NOT_FOUND`, `INVOICE_NOT_FOUND`; Queue message `ACTIVE_JOURNEY_NOT_FOUND` | Xử lý trạng thái chưa có dữ liệu/tải lại; riêng profile mở onboarding |
| 409 | Patient `VERSION_REQUIRED`, `CONCURRENT_UPDATE`; Appointment `VERSION_CONFLICT`, `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_KEY_REUSED`, `HOLD_EXPIRED`, `SLOT_NOT_AVAILABLE` | Tải lại bản mới, chọn lại slot nếu cần |
| 409 | Auth `Account already exists` | Báo email đã dùng |
| 422 | `PATIENT_NOT_ELIGIBLE`, `DOCTOR_NOT_ELIGIBLE` và các nghiệp vụ khác | Hiển thị điều kiện nghiệp vụ chưa đáp ứng |
| 429 | Kong rate limiting | Chờ/backoff; Patient và Appointment hiện 120 request/phút theo plugin |
| 500 | `INTERNAL_ERROR` hoặc Nest default | Báo lỗi hệ thống, giữ requestId nếu có |
| 502/503/504 | Gateway upstream/dependency, `DEPENDENCY_UNAVAILABLE`, Patient `SERVICE_UNAVAILABLE` | Báo tạm gián đoạn; retry có giới hạn đối với GET |

Không phân loại mọi lỗi 404 là danh sách rỗng: route sai cũng 404. Hãy xét path, status và code/message.

## 11. OpenAPI và cách kiểm tra

Repo có spec tĩnh trong [docs/api-specs](../api-specs), nhưng chưa có `@nestjs/swagger`, `SwaggerModule` hoặc Swagger UI được mount bởi Nest. **Không có URL `/docs` hoặc `/api-json` được cấu hình trong source.** Kong Manager ở 8002 không phải Swagger.

Mở các file `auth-service.yaml`, `patient-service.yaml`, `appointment-service.yaml`, `queue-service.yaml`, `billing-service.yaml` bằng OpenAPI preview của editor hoặc Swagger Editor → File → Import File. Khi dùng Try it out, sửa `servers[0].url` trong bản spec preview để đi qua gateway:

| Spec | Server URL khi thử qua Kong |
|---|---|
| Auth | `http://localhost:8080` |
| Patient (paths bắt đầu `/me`, `/{patientId}`) | `http://localhost:8080/api/patients` |
| Appointment | `http://localhost:8080/api/appointment` |
| Queue | `http://localhost:8080/api/queue` |
| Billing | `http://localhost:8080/api/billing` |

Swagger chạy trong browser vẫn chịu CORS: cần origin đã được Kong cho phép như mục 2. Authorize bằng access token nhận từ login; tùy UI, ô bearer chỉ nhập token, không nhập thêm chữ Bearer. Dùng PowerShell/curl theo README nếu browser preview bị chặn CORS.

**Spec tĩnh có chỗ lệch implementation:** Queue spec mô tả version integer/datetime ISO trong khi self journey thực tế trả string/protobuf Timestamp; Billing spec không thay thế được kiểm tra role trong service; HTTP status mutation theo controller có thể khác spec. Dùng tài liệu này và source làm mốc cho adapter; chưa generate toàn bộ Dart client từ YAML cũ mà không rà lại schema.

## 12. Phần còn thiếu trước khi bật mọi màn hình

1. **Đọc hóa đơn PATIENT:** thêm quyền đọc có ownership ở server, resolve patient từ JWT; list tự lọc và detail từ chối invoice của người khác. Chưa chỉ cần bỏ `Staff only`.
2. **Tự hủy/đổi lịch:** cần quyết định chính sách thời hạn, trạng thái, phí/hoàn tiền và quyền PATIENT; hiện service chặn bằng `staff()`. Chưa thay đổi quy tắc phòng khám.
3. **Queue:** siết các route dùng ID/list/create để ngăn PATIENT đọc hoặc tạo journey tùy ý; thêm thống kê hàng chờ đã ẩn danh nếu UI cần số người phía trước/thời gian chờ hiện tại. Self journey hiện dùng được cho màn hình xem vé của mình nhưng chưa đủ để tuyên bố toàn bộ Queue an toàn cho production.
4. **Thông báo:** REST inbox theo JWT, trạng thái đã đọc và mobile push/device token; delivery nội bộ chưa phải inbox API.
5. **Profile bổ sung:** map lại model AppStore; các trường thai kỳ chưa có trong self-profile hiện tại.
6. **Chuẩn hóa contract:** đồng bộ OpenAPI với presenter thực tế, thống nhất error envelope và kiểu timestamp khi có nhu cầu nâng version API.
7. **Thanh toán:** giữ demo Flutter riêng; chưa bật checkout native hay coi sandbox là production.

Trình tự nối app: thêm một HTTP client và cấu hình base URL → login/token storage/refresh → Auth me → Patient me/onboarding → lịch khám → Queue self. Hóa đơn, hủy/đổi lịch và thông báo chờ các hạng mục trên. Thay từng nhóm dữ liệu hard-code trong AppStore bằng repository/API adapter; xử lý loading, empty, error, expired session và parse riêng theo domain.

## 13. Bằng chứng rà soát

- Auth: `services/apps/auth-service/src/auth/{auth.controller.ts,auth.service.ts,dto/}` và `sessions/sessions.service.ts`.
- Patient: `services/apps/patient-service/src/patients/{patients.controller.ts,patients.service.ts,patient-presenter.ts,dto/upsert-my-patient.dto.ts}`.
- Appointment: `services/apps/appointment-service/src/appointments/{appointment.controller.ts,appointment.service.ts,dto.ts,presenter.ts}`.
- Queue: `services/apps/queue-service/src/queue/{queue.controller.ts,queue.service.ts,patient-dependency.gateway.ts}`.
- Billing: `services/apps/billing-service/src/billing/{billing.controller.ts,billing.service.ts,presenter.ts,vnpay-gateway.service.ts}`.
- Notification: `services/apps/notification-service/src/{notification.controller.ts,notification.service.ts}`.
- Gateway/deployment: `docs/api-specs/kong.yml`, `gateway/Dockerfile`, `gateway/init-kong.sh`, `docker-compose.yml`, `services/Dockerfile`, `.env.example`.

Runtime kiểm tra trên stack đang chạy ngày 07/11/2026 (qua gateway 8080):

| Kiểm tra | Kết quả |
|---|---|
| `GET /health` | 200 `{"status":"ok"}` |
| Login bằng `demo.patient@antam.local` trong README | 401; seed hiện tại dùng bộ tài khoản khác |
| Login bằng PATIENT trong `seed_system_data.js` | 200, role PATIENT, expiresIn 900 |
| `GET /auth/me` | 200, top-level `user` |
| `GET /api/patients/me` | 200, top-level `data` |
| `GET /api/appointment/appointments?limit=1` | 200, `items` + `nextPageToken`; danh sách tài khoản thử nghiệm rỗng |
| `GET /api/queue/me/journeys/active` | 404 với message `ACTIVE_JOURNEY_NOT_FOUND` |
| `GET /api/billing/invoices?limit=1` bằng PATIENT | 403 `FORBIDDEN`, message `Staff only` |
| `GET /api/notifications`, `GET /docs` | 404 từ Kong: chưa có route |
| Refresh | 200, refresh token thực sự thay đổi |
| Logout với refresh token mới | 204 |

Không tạo/sửa hồ sơ, lịch, payment, queue hay seed lại database trong smoke test. Phiên đăng nhập kiểm thử đã logout. Chưa runtime test detail lịch/hóa đơn có dữ liệu, cập nhật profile, SSE hoặc các mutation nhân viên. Các ví dụ và kết luận cho các nhánh này dựa trên source. Stack đang chạy là image đã tồn tại; chưa rebuild/redeploy container sau thay đổi bind.

Validation local: Docker Compose config hợp lệ; build Auth, Patient, Appointment, Billing, Queue, Notification thành công. Notification cần generate Prisma client từ `prisma/notification/schema.prisma` trước build local; Dockerfile đã generate client này trong builder stage. Không thay đổi schema hoặc migrate database.
