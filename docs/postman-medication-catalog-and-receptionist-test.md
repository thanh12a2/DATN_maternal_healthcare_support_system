# Test Medication Catalog và Receptionist Service bằng Postman

> Mục tiêu: kiểm thử phần **quản lý danh mục thuốc** của `prescription-service` và các API đang được expose của `receptionist-service`.
>
> Dùng URL service trực tiếp trước để tách lỗi Gateway/Kong khỏi lỗi nghiệp vụ:
>
> - Auth: `http://localhost:5003`
> - Medication Catalog: `http://localhost:5014`
> - Receptionist: `http://localhost:5006`
>
> Sau khi pass toàn bộ direct URL mới đổi sang Kong (`http://localhost:8080/api/...`) nếu cần test Gateway.

---

## 1. Phạm vi và lưu ý quan trọng

### Medication Catalog đã có

- `GET /medications`, `GET /medications/:id`
- `POST /medications`, `PATCH /medications/:id`
- `POST /medications/:id/deactivate`, `POST /medications/:id/activate`

### Receptionist đã có

- Hồ sơ lễ tân: đọc danh sách, đọc hồ sơ mình, Admin sửa hồ sơ, lễ tân tự đổi avatar, Admin ngưng hoạt động hồ sơ.
- Điều phối tiếp nhận: tìm lịch hẹn, tìm slot, đặt lịch hộ, mở ca tiếp nhận, đối chiếu danh tính, lập hóa đơn, ghi nhận thanh toán và admit bệnh nhân.

`POST /receptionists` và `POST /receptionists/:id/activate` **chưa được expose** vì còn phụ thuộc internal contract của Auth. Do đó không được dùng API để tạo lại/kích hoạt hồ sơ đã bị deactivate.

> Không chạy `deactivate` trên tài khoản demo duy nhất. Chỉ dùng request đó cho một hồ sơ test có thể bỏ đi. API này thay đổi dữ liệu và hiện không có API khôi phục.

> Các API điều phối gọi Patient, Appointment, Billing, Medical Record và Queue qua gRPC. Không có mock data. Phần E2E chỉ chạy khi các service downstream và gRPC của chúng đều sẵn sàng.

---

## 2. Chuẩn bị hệ thống

1. Mở PowerShell tại thư mục gốc dự án.

2. Kiểm tra file Compose hợp lệ trước:

```powershell
docker compose config --quiet
```

Nếu lệnh báo conflict/merge marker trong `docker-compose.yml`, cần giải quyết conflict trước khi chạy stack. Không tiếp tục test khi Compose chưa parse được.

3. Nếu chưa khởi tạo môi trường, chạy stack và dữ liệu demo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Mode Docker -SeedDemo
```

4. Kiểm tra service tối thiểu:

```powershell
Invoke-WebRequest http://localhost:5006/health
Invoke-WebRequest http://localhost:5014/health
```

Receptionist có `GET /health`. Nếu Prescription không expose health trong image hiện tại, kiểm tra container/log thay vì coi đó là lỗi API Medication:

```powershell
docker compose ps
docker compose logs --tail=100 prescription-service receptionist-service
```

5. Dữ liệu demo Auth mặc định (nếu chưa đổi `DEMO_SEED_PASSWORD`):

| Vai trò | Email | Password |
|---|---|---|
| Admin | `demo.admin@antam.local` | `Demo@123456` |
| Receptionist | `demo.receptionist@antam.local` | `Demo@123456` |

---

## 3. Tạo Postman Environment

Trong Postman: **Environments → Create environment** → đặt tên `Maternal Local`.

Điền các biến sau ở cột **Current value**. Token và ID để trống, chúng sẽ được script của request ghi lại.

| Biến | Giá trị cần thêm | Dùng cho |
|---|---|---|
| `authBaseUrl` | `http://localhost:5003` | Đăng nhập |
| `medicationBaseUrl` | `http://localhost:5014` | Medication Catalog |
| `receptionBaseUrl` | `http://localhost:5006` | Receptionist Service |
| `adminEmail` | `demo.admin@antam.local` | Đăng nhập Admin |
| `receptionistEmail` | `demo.receptionist@antam.local` | Đăng nhập lễ tân |
| `demoPassword` | `Demo@123456` | Đăng nhập, thay nếu đã cấu hình khác |
| `adminToken` | để trống | Access token Admin |
| `receptionistToken` | để trống | Access token lễ tân |
| `medicationId` | để trống | ID thuốc vừa tạo |
| `medicationVersion` | để trống | Optimistic locking thuốc |
| `receptionistId` | để trống | ID hồ sơ lễ tân |
| `receptionistVersion` | để trống | Optimistic locking hồ sơ |
| `appointmentId` | để trống | Ca tiếp nhận E2E |
| `patientId` | để trống | Ca tiếp nhận E2E |
| `caseId` | để trống | Ca tiếp nhận E2E |
| `paymentAmountMinor` | để trống | Số tiền thanh toán, lấy từ invoice |

Tất cả request có body JSON dùng header:

```http
Content-Type: application/json
```

Request có xác thực dùng tab **Authorization → Bearer Token** và token tương ứng. Có thể thêm `X-Request-Id: {{$guid}}` để dễ tìm log, nhưng header này là tùy chọn.

---

## 4. Lấy token Admin và Receptionist

### 4.1. Đăng nhập Admin

```http
POST {{authBaseUrl}}/auth/login
Content-Type: application/json
```

```json
{
  "email": "{{adminEmail}}",
  "password": "{{demoPassword}}"
}
```

Trong tab **Tests**, thêm:

```javascript
const body = pm.response.json();
pm.test("Admin login trả 200", () => pm.response.to.have.status(200));
pm.test("Đúng role ADMIN", () => pm.expect(body.user.role).to.eql("ADMIN"));
pm.environment.set("adminToken", body.accessToken);
```

### 4.2. Đăng nhập Receptionist

```http
POST {{authBaseUrl}}/auth/login
Content-Type: application/json
```

```json
{
  "email": "{{receptionistEmail}}",
  "password": "{{demoPassword}}"
}
```

Tab **Tests**:

```javascript
const body = pm.response.json();
pm.test("Receptionist login trả 200", () => pm.response.to.have.status(200));
pm.test("Đúng role RECEPTIONIST", () => pm.expect(body.user.role).to.eql("RECEPTIONIST"));
pm.environment.set("receptionistToken", body.accessToken);
```

---

## 5. Phần A — Test Medication Catalog

Tất cả request phần này dùng `Authorization: Bearer {{adminToken}}`. Admin có toàn quyền với thuốc, gồm xem thuốc inactive và activate/deactivate.

### Bước A1 — Xem danh sách thuốc

```http
GET {{medicationBaseUrl}}/medications?page=1&limit=20
Authorization: Bearer {{adminToken}}
```

Có thể lọc bằng các query sau:

- `q`: mã thuốc/tên/hoạt chất, ví dụ `q=paracetamol`.
- `pregnancyCategory`: `CATEGORY_A`, `CATEGORY_B`, `CATEGORY_C`, `CATEGORY_D`, hoặc `CATEGORY_X`.
- `isActive`: `true` hoặc `false`.
- `page`: từ `1`; `limit`: từ `1` đến `100`.

Expected: `200`, dữ liệu nằm trong `data.items`.

### Bước A2 — Tạo thuốc test

Tạo request:

```http
POST {{medicationBaseUrl}}/medications
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "code": "PM-PARA-500-001",
  "name": "Paracetamol 500 mg - Postman",
  "activeIngredient": "Paracetamol",
  "strength": "500 mg",
  "dosageForm": "TABLET",
  "route": "ORAL",
  "defaultDose": "1 viên",
  "defaultFrequency": "Khi cần, tối đa 3 lần/ngày",
  "defaultInstruction": "Uống sau ăn khi đau hoặc sốt",
  "pregnancyCategory": "CATEGORY_B",
  "pregnancyWarning": "Chỉ dùng theo chỉ định của bác sĩ trong thai kỳ"
}
```

Các trường phải thêm:

| Trường | Bắt buộc | Quy tắc |
|---|---:|---|
| `code` | Có | Mã duy nhất, không sửa được sau khi tạo. Nếu đã tồn tại, đổi thành mã khác như `PM-PARA-500-002`. |
| `name` | Có | Tên hiển thị của thuốc. |
| `activeIngredient` | Có | Hoạt chất chính. |
| `strength` | Có | Hàm lượng, ví dụ `500 mg`. |
| `dosageForm` | Có | Dạng bào chế tự do trong implementation hiện tại, ví dụ `TABLET`, `CAPSULE`, `SYRUP`. |
| `route` | Có | Đường dùng tự do, ví dụ `ORAL`, `TOPICAL`, `INJECTION`. |
| `pregnancyCategory` | Có | Một trong năm enum ở bước A1. |
| `defaultDose` | Không | Liều mặc định; có thể bỏ qua. |
| `defaultFrequency` | Không | Tần suất mặc định; có thể bỏ qua. |
| `defaultInstruction` | Không | Hướng dẫn mặc định; có thể bỏ qua. |
| `pregnancyWarning` | Không | Cảnh báo thai kỳ; có thể bỏ qua. |

Tab **Tests** để lưu ID và version:

```javascript
const body = pm.response.json();
pm.test("Tạo thuốc thành công", () => pm.response.to.have.status(201));
pm.environment.set("medicationId", body.data.id);
pm.environment.set("medicationVersion", body.data.version);
```

> `version` là số phiên bản chống ghi đè dữ liệu cũ. Sau mỗi PATCH/activate/deactivate thành công, phải lưu lại version mới trước request ghi tiếp theo.

### Bước A3 — Đọc chi tiết thuốc

```http
GET {{medicationBaseUrl}}/medications/{{medicationId}}
Authorization: Bearer {{adminToken}}
```

Expected: `200`, kiểm tra `data.code`, `data.isActive` và `data.version`.

### Bước A4 — Cập nhật thuốc

```http
PATCH {{medicationBaseUrl}}/medications/{{medicationId}}
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "defaultInstruction": "Uống sau ăn; dùng theo chỉ định bác sĩ",
  "pregnancyWarning": "Không tự ý tăng liều trong thai kỳ",
  "version": {{medicationVersion}}
}
```

`version` là bắt buộc; chỉ gửi những trường muốn đổi. Không gửi `code` vì mã thuốc bất biến.

Tab **Tests**:

```javascript
const body = pm.response.json();
pm.test("Cập nhật thuốc thành công", () => pm.response.to.have.status(200));
pm.environment.set("medicationVersion", body.data.version);
```

### Bước A5 — Deactivate rồi activate lại thuốc test

Deactivate:

```http
POST {{medicationBaseUrl}}/medications/{{medicationId}}/deactivate
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "version": {{medicationVersion}}
}
```

Lưu `body.data.version` lại `medicationVersion`, sau đó activate bằng cùng cấu trúc body:

```http
POST {{medicationBaseUrl}}/medications/{{medicationId}}/activate
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "version": {{medicationVersion}}
}
```

Expected: `200`; `data.isActive` lần lượt là `false`, rồi `true`.

---

## 6. Chuẩn bị hồ sơ Receptionist để test

`SeedDemo` tạo tài khoản Auth có role `RECEPTIONIST`, nhưng hiện **không tạo record trong Receptionist database**. Nếu gọi `GET /receptionists/me` mà nhận `RECEPTIONIST_PROFILE_NOT_FOUND`, thêm fixture một lần dưới đây.

Mở PostgreSQL của Receptionist:

```powershell
docker compose exec receptionist-database psql -U receptionist -d receptionist
```

Thêm record nghiệp vụ. Các UUID này là account demo cố định từ `seed-demo.ts`:

- Account lễ tân: `00000000-0000-4000-8000-000000000003`
- Account Admin: `00000000-0000-4000-8000-000000000004`

```sql
INSERT INTO receptionists (
  account_id,
  employee_code,
  status,
  created_by_account_id,
  updated_by_account_id
)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  'LT-DEMO-001',
  'ACTIVE',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000004'
);

INSERT INTO receptionist_profiles (
  receptionist_id,
  full_name,
  login_email,
  work_phone,
  address,
  department,
  gender,
  avatar_url
)
SELECT
  id,
  'Lễ tân Demo',
  'demo.receptionist@antam.local',
  '+84901234567',
  '12 Nguyễn Huệ, Quận 1, TP.HCM',
  'Khoa Phụ sản',
  'FEMALE',
  NULL
FROM receptionists
WHERE account_id = '00000000-0000-4000-8000-000000000003';
```

Các trường đã thêm có ý nghĩa:

| Bảng | Trường cần có | Ý nghĩa |
|---|---|---|
| `receptionists` | `account_id` | Bắt buộc; phải là UUID account Auth của người lễ tân. Đây là khóa mapping JWT → profile. |
| `receptionists` | `employee_code` | Bắt buộc, duy nhất; ví dụ `LT-DEMO-001`. |
| `receptionists` | `status` | Dùng `ACTIVE` để thực hiện được API tiếp nhận. `DRAFT`/`INACTIVE` không được orchestration. |
| `receptionists` | `created_by_account_id`, `updated_by_account_id` | Bắt buộc; dùng UUID Admin demo khi tạo fixture. |
| `receptionist_profiles` | `receptionist_id` | Bắt buộc; chính là `receptionists.id` vừa tạo. |
| `receptionist_profiles` | `full_name` | Bắt buộc. |
| `receptionist_profiles` | `login_email`, `work_phone`, `address`, `department`, `gender`, `avatar_url` | Không bắt buộc trong schema nhưng nên thêm để test đủ profile. `gender`: `FEMALE`, `MALE`, `OTHER` hoặc `NULL`. |

Kiểm tra và lấy ID:

```sql
SELECT r.id, r.account_id, r.employee_code, r.status, r.version,
       p.full_name, p.login_email, p.work_phone, p.address,
       p.department, p.gender, p.avatar_url
FROM receptionists r
JOIN receptionist_profiles p ON p.receptionist_id = r.id
WHERE r.account_id = '00000000-0000-4000-8000-000000000003';
```

Copy `r.id` vào `receptionistId` nếu muốn, rồi gõ `\q` để thoát. Không chạy lại hai lệnh INSERT nếu record đã tồn tại.

---

## 7. Phần B — Test Receptionist Profile API

### Bước B1 — Health check

```http
GET {{receptionBaseUrl}}/health
```

Expected: `200` với `status: "ok"`.

### Bước B2 — Admin xem danh sách lễ tân

```http
GET {{receptionBaseUrl}}/receptionists?status=ACTIVE&limit=20
Authorization: Bearer {{adminToken}}
```

Query có thể thêm:

- `status`: `DRAFT`, `ACTIVE`, `INACTIVE`.
- `q`: tối thiểu 2 ký tự, tìm theo mã nhân viên/tên/email.
- `cursor`: UUID trả về ở `data.nextCursor`.
- `limit`: 1–100, mặc định 20.

Expected: `200`; record fixture phải có trong `data.items`.

### Bước B3 — Lễ tân xem hồ sơ của mình và lưu ID/version

```http
GET {{receptionBaseUrl}}/receptionists/me
Authorization: Bearer {{receptionistToken}}
```

Tab **Tests**:

```javascript
const body = pm.response.json();
pm.test("Đọc hồ sơ bản thân thành công", () => pm.response.to.have.status(200));
pm.environment.set("receptionistId", body.data.id);
pm.environment.set("receptionistVersion", body.data.version);
```

### Bước B4 — Lễ tân tự đổi avatar

Đây là trường **duy nhất** lễ tân tự cập nhật được.

```http
PATCH {{receptionBaseUrl}}/receptionists/me
Authorization: Bearer {{receptionistToken}}
Content-Type: application/json
```

```json
{
  "avatarUrl": "https://example.com/avatars/receptionist-demo.png",
  "version": {{receptionistVersion}}
}
```

Quy tắc: `avatarUrl` là URL `http/https`, tối đa 2048 ký tự; gửi `null` nếu muốn xóa avatar. `version` bắt buộc.

Tab **Tests**:

```javascript
const body = pm.response.json();
pm.test("Đổi avatar thành công", () => pm.response.to.have.status(200));
pm.environment.set("receptionistVersion", body.data.version);
```

Gửi `fullName`, `email`, `department` hoặc bất kỳ field nào khác vào API `/me` sẽ bị `400` vì global validation có `forbidNonWhitelisted`.

### Bước B5 — Admin xem một hồ sơ

```http
GET {{receptionBaseUrl}}/receptionists/{{receptionistId}}
Authorization: Bearer {{adminToken}}
```

Expected: `200`; Admin thấy profile đầy đủ. Lễ tân cũng gọi được URL này nhưng chỉ với đúng `receptionistId` của mình.

### Bước B6 — Admin cập nhật thông tin nghiệp vụ

```http
PATCH {{receptionBaseUrl}}/receptionists/{{receptionistId}}
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "profile": {
    "fullName": "Lễ tân Demo Postman",
    "loginEmail": "demo.receptionist@antam.local",
    "workPhone": "0901234567",
    "address": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "department": "Khoa Phụ sản",
    "gender": "FEMALE"
  },
  "version": {{receptionistVersion}},
  "reason": "Cập nhật hồ sơ trong kiểm thử Postman"
}
```

Các trường của API Admin:

| Trường | Bắt buộc | Quy tắc |
|---|---:|---|
| `version` | Có | Version hiện tại của hồ sơ. |
| `reason` | Có | 3–250 ký tự; lưu audit log. |
| `employeeCode` | Không | 2–30 ký tự chữ/số/dấu `-`, duy nhất; hệ thống chuẩn hóa thành in hoa. |
| `profile.fullName` | Không | 2–150 ký tự, không được `null`. |
| `profile.loginEmail` | Không | Email hợp lệ hoặc `null`; duy nhất nếu có giá trị. |
| `profile.workPhone` | Không | Số Việt Nam/E.164; `0901234567` được chuẩn hóa thành `+84901234567`; hoặc `null`. |
| `profile.address` | Không | Tối đa 500 ký tự hoặc `null`. |
| `profile.department` | Không | Tối đa 100 ký tự hoặc `null`. |
| `profile.gender` | Không | `FEMALE`, `MALE`, `OTHER` hoặc `null`. |

Admin không sửa avatar qua API này; avatar thuộc quyền tự cập nhật của lễ tân.

Sau `200`, cập nhật biến:

```javascript
const body = pm.response.json();
pm.environment.set("receptionistVersion", body.data.version);
```

### Bước B7 — Test optimistic locking (không làm hỏng dữ liệu)

Gửi lại PATCH B4 hoặc B6 nhưng cố tình dùng version cũ, ví dụ `1`. Expected: `409` với code `VERSION_CONFLICT`. Sau đó đọc lại `GET /receptionists/me` hoặc `GET /receptionists/{{receptionistId}}` để lấy version mới.

### Bước B8 — Deactivate (tùy chọn, chỉ dùng hồ sơ test riêng)

```http
POST {{receptionBaseUrl}}/receptionists/{{receptionistId}}/deactivate
Authorization: Bearer {{adminToken}}
Idempotency-Key: {{$guid}}
Content-Type: application/json
```

```json
{
  "version": {{receptionistVersion}},
  "reason": "Ngưng hồ sơ test sau khi kiểm thử"
}
```

`Idempotency-Key` phải là UUID. Nếu retry cùng request, giữ **cùng key và cùng body**. Key cũ với body khác sẽ trả `409 IDEMPOTENCY_KEY_REUSED`.

Không thực hiện bước này với profile demo đã dùng để test luồng tiếp nhận, vì profile sẽ thành `INACTIVE` và API admission sẽ trả `403 RECEPTIONIST_INACTIVE`.

---

## 8. Phần C — Test API điều phối tiếp nhận (E2E có điều kiện)

Chạy phần này sau B1–B6 và chỉ khi Patient, Appointment, Billing, Medical Record, Queue cùng các gRPC target của Receptionist đều healthy. Lễ tân phải có profile `ACTIVE`.

### C1 — Tìm lịch hẹn của bệnh nhân

Ít nhất phải có `patientId` hoặc `phoneNumber`.

```http
POST {{receptionBaseUrl}}/reception/appointments/search
Authorization: Bearer {{receptionistToken}}
Content-Type: application/json
```

```json
{
  "patientId": "10000000-0000-4000-8000-000000000001",
  "appointmentCode": "AT-DEMO-0001",
  "limit": 20
}
```

Các field tùy chọn: `appointmentCode` (3–40 ký tự), `phoneNumber` (7–20), `from`, `to` (ISO date), `limit` (1–50). Lưu `patientId` và `appointmentId` từ response vào environment; không tự đoán ID nếu đang test dữ liệu khác.

### C2 — Tìm slot để đặt lịch hộ

```http
GET {{receptionBaseUrl}}/reception/appointments/slots?serviceId=30000000-0000-4000-8000-000000000001&selectionMode=DOCTOR&requestedDoctorId=20000000-0000-4000-8000-000000000001&from=2026-10-19T00:00:00.000Z&to=2026-10-26T23:59:59.999Z&limit=20
Authorization: Bearer {{receptionistToken}}
```

Các field bắt buộc: `serviceId`, `selectionMode` (`DOCTOR` hoặc `RANK`), `from`, `to`. Nếu chọn `DOCTOR`, thêm `requestedDoctorId`; nếu chọn `RANK`, thêm `requestedRankCode`. Dùng `startAt`/`endAt` đúng từ slot trả về cho C3.

### C3 — Đặt lịch hộ hoặc tạo lịch walk-in

```http
POST {{receptionBaseUrl}}/reception/appointments
Authorization: Bearer {{receptionistToken}}
Idempotency-Key: {{$guid}}
Content-Type: application/json
```

```json
{
  "patientId": "{{patientId}}",
  "serviceId": "30000000-0000-4000-8000-000000000001",
  "selectionMode": "DOCTOR",
  "requestedDoctorId": "20000000-0000-4000-8000-000000000001",
  "startAt": "2026-10-20T02:00:00.000Z",
  "endAt": "2026-10-20T02:30:00.000Z",
  "channel": "RECEPTION"
}
```

`channel` là `RECEPTION` khi lễ tân đặt lịch hẹn tại quầy, hoặc `WALK_IN` khi tiếp nhận khám vãng lai. Không có endpoint walk-in riêng; đây là cách đúng để tạo walk-in. Cần `Idempotency-Key` và retry phải giữ key/body.

### C4 — Mở ca tiếp nhận

```http
POST {{receptionBaseUrl}}/reception/cases
Authorization: Bearer {{receptionistToken}}
Content-Type: application/json
```

```json
{
  "appointmentId": "{{appointmentId}}",
  "patientId": "{{patientId}}",
  "arrivalAt": "2026-10-20T01:55:00.000Z"
}
```

`appointmentId` và `patientId` là bắt buộc ở logic service; `arrivalAt` tùy chọn, bỏ qua thì dùng thời điểm server. Lưu `data.id` vào `caseId`:

```javascript
const body = pm.response.json();
pm.environment.set("caseId", body.data.id);
```

### C5 — Đối chiếu danh tính

```http
POST {{receptionBaseUrl}}/reception/cases/{{caseId}}/identity-verifications
Authorization: Bearer {{receptionistToken}}
Content-Type: application/json
```

```json
{
  "method": "NATIONAL_ID_DOCUMENT",
  "result": "VERIFIED",
  "verifiedFields": ["FULL_NAME", "DATE_OF_BIRTH", "PHONE_NUMBER"],
  "note": "Đối chiếu giấy tờ hợp lệ"
}
```

Các enum cần dùng:

- `method`: `APPOINTMENT_CODE`, `PHONE_AND_DOB`, `NATIONAL_ID_DOCUMENT`, `OTHER_DOCUMENT`.
- `result`: `VERIFIED`, `MISMATCH`, `INCONCLUSIVE`.

`verifiedFields`, `reasonCode`, `note` là tùy chọn. Chỉ `result=VERIFIED` mới đưa case sang `IDENTITY_VERIFIED` để thanh toán/admit.

### C6 — Lập/xem hóa đơn, ghi nhận thanh toán, admit

1. Lập hoặc lấy invoice:

```http
GET {{receptionBaseUrl}}/reception/cases/{{caseId}}/invoice
Authorization: Bearer {{receptionistToken}}
```

Copy `data.invoice.balanceMinor` vào `paymentAmountMinor` (ví dụ `350000`). Giá trị này phải là số nguyên, không thêm dấu phẩy hay ký hiệu `VND`.

2. Ghi nhận thanh toán:

```http
POST {{receptionBaseUrl}}/reception/cases/{{caseId}}/payments
Authorization: Bearer {{receptionistToken}}
Idempotency-Key: {{$guid}}
Content-Type: application/json
```

```json
{
  "method": "CASH",
  "amountMinor": {{paymentAmountMinor}},
  "receivedAt": "2026-10-20T02:05:00.000Z",
  "reference": "PM-CASH-001"
}
```

`method` chỉ là `CASH` hoặc `MANUAL_BANK_TRANSFER`. `amountMinor` và `receivedAt` bắt buộc. Với chuyển khoản thủ công, thêm `manualTransferReference` (3–100 ký tự).

3. Hoàn tất tiếp nhận:

```http
POST {{receptionBaseUrl}}/reception/cases/{{caseId}}/admit
Authorization: Bearer {{receptionistToken}}
```

Nếu thanh toán đã được Billing xác nhận, orchestrator tiếp tục mở encounter, check-in lịch hẹn và tạo queue ticket. Kiểm tra lại case:

```http
GET {{receptionBaseUrl}}/reception/cases/{{caseId}}
Authorization: Bearer {{receptionistToken}}
```

Expected cuối cùng: case `ADMITTED`, admission `COMPLETED`, có `encounterId`, `queueJourneyId`, `queueTicketId`. Nếu dừng ở `AWAITING_PAYMENT`, kiểm tra invoice/payment thay vì gửi `admit` lặp vô hạn.

---

## 9. Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `401 Unauthorized` | Token thiếu, hết hạn, hoặc sai issuer/audience/key giữa Auth và service. Login lại để lấy token mới. |
| `403 Forbidden` | Sai role; Medication write cần Admin/Doctor, profile list/update cần Admin, `/me` cần Receptionist. |
| `404 RECEPTIONIST_PROFILE_NOT_FOUND` | Auth account chưa có record mapping trong `receptionists`; làm bước 6. |
| `403 RECEPTIONIST_INACTIVE` | `status` của hồ sơ không phải `ACTIVE`; không deactivate profile đang test admission. |
| `400 property ... should not exist` | Body gửi field không được DTO nhận; đặc biệt `/receptionists/me` chỉ nhận `avatarUrl`, `version`. |
| `409 VERSION_CONFLICT` | Đọc lại resource để lấy version mới rồi gửi PATCH/activate/deactivate lại. |
| `409 IDEMPOTENCY_KEY_REUSED` | Reuse cùng idempotency key nhưng body khác; request mới phải dùng UUID mới. |
| Lỗi gRPC/`5xx` ở `/reception/...` | Kiểm tra target gRPC và trạng thái các service downstream; không thay bằng dữ liệu mock trong Receptionist. |
| `docker compose` không chạy | Chạy `docker compose config --quiet`; giải quyết conflict của Compose trước. |

---

## 10. Thứ tự chạy khuyến nghị

1. Setup stack và login Admin/Receptionist.
2. A1 → A5 để kiểm tra Medication Catalog độc lập.
3. Tạo fixture Receptionist một lần nếu cần.
4. B1 → B7 để kiểm tra profile; bỏ B8 nếu chỉ có account demo.
5. Chỉ khi downstream sẵn sàng: C1 → C6 để kiểm tra luồng tiếp nhận hoàn chỉnh.

