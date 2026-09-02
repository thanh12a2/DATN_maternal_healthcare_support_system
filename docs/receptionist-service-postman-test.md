# Hướng dẫn test Receptionist Service bằng Postman

> **Service trực tiếp:** `http://localhost:5006`  
> **Auth Service:** `http://localhost:5003`  
> **Gateway:** `http://localhost:8080`  
> **Phạm vi hiện tại:** hồ sơ nghiệp vụ cơ bản của lễ tân; không có API ca làm hoặc Admission.

---

## 1. Những API có thể test

| Method | Path | Quyền | Trạng thái |
|---|---|---|---|
| `GET` | `/health` | Public | Có thể test ngay |
| `GET` | `/receptionists` | `ADMIN` | Implemented |
| `GET` | `/receptionists/me` | `RECEPTIONIST` | Implemented |
| `GET` | `/receptionists/{id}` | Own hoặc `ADMIN` | Implemented |
| `PATCH` | `/receptionists/me` | `RECEPTIONIST` | Implemented |
| `PATCH` | `/receptionists/{id}` | `ADMIN` | Implemented |
| `POST` | `/receptionists/{id}/deactivate` | `ADMIN` | Implemented |
| `POST` | `/receptionists` | `ADMIN` | Chưa expose — blocked bởi Auth contract |
| `POST` | `/receptionists/{id}/activate` | `ADMIN` | Chưa expose — blocked bởi Auth contract |
| Bất kỳ | `/reception/*` | — | Chưa expose — blocked bởi downstream contracts |

Do API create/activate chưa được mở, hướng dẫn này dùng fixture trong database local để test. Không sử dụng cách sửa database trực tiếp trong production.

---

## 2. Chuẩn bị JWT key

Từ thư mục gốc của project:

```powershell
node generate-auth-keys.cjs
```

Nếu PowerShell không nhận `node`:

```powershell
& "C:\nvm4w\nodejs\node.exe" generate-auth-keys.cjs
```

Sau khi chạy sẽ có:

```text
auth-private.pem
auth-public.pem
```

Chuyển key sang dạng escaped newline:

```powershell
$privateKey = (Get-Content .\auth-private.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$publicKey = (Get-Content .\auth-public.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")

$privateKey
$publicKey
```

Nếu chưa có `.env`, tạo từ file mẫu:

```powershell
Copy-Item .env.example .env
```

Điền kết quả vào `.env`:

```env
AUTH_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
AUTH_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
AUTH_REFRESH_TOKEN_PEPPER=local-dev-change-me-long-random-value-123456
```

Không commit `.env`, private key hoặc token lên Git.

---

## 3. Khởi động database và chạy migration

Từ thư mục gốc:

```powershell
docker compose up -d auth-database receptionist-database
```

Chạy migration và seed role:

```powershell
Set-Location services

$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"
$env:RECEPTIONIST_DATABASE_URL="postgresql://receptionist:receptionistpass@localhost:5436/receptionist?schema=public"

npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run prisma:migrate:receptionist:deploy

Set-Location ..
```

Khởi động hai service:

```powershell
docker compose up -d --build auth-service receptionist-service
```

Kiểm tra:

```powershell
docker compose ps
docker compose logs --tail 100 auth-service receptionist-service
```

---

## 4. Tạo Postman Environment

Trong Postman, chọn **Environments → Create environment** và đặt tên `Maternal Local`.

| Variable | Initial value |
|---|---|
| `authBaseUrl` | `http://localhost:5003` |
| `receptionBaseUrl` | `http://localhost:5006` |
| `gatewayBaseUrl` | `http://localhost:8080` |
| `adminToken` | để trống |
| `receptionistToken` | để trống |
| `adminAccountId` | để trống |
| `receptionistAccountId` | để trống |
| `receptionistId` | để trống |
| `version` | `1` |
| `deactivateVersion` | để trống |
| `deactivateKey` | để trống |

Save và chọn environment `Maternal Local` trước khi gửi request.

---

## 5. Test health

### Request

```http
GET {{receptionBaseUrl}}/health
```

### Expected

```http
200 OK
```

```json
{
  "status": "ok"
}
```

Post-response script tùy chọn:

```javascript
pm.test("Receptionist Service healthy", function () {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json()).to.eql({ status: "ok" });
});
```

---

## 6. Đăng ký hai tài khoản test

Public register không nhận `role`; mọi account mới đều là `PATIENT`. Ta sẽ đổi role trong database local ở bước tiếp theo.

### 6.1. Đăng ký Admin candidate

```http
POST {{authBaseUrl}}/auth/register
Content-Type: application/json
```

Body → raw → JSON:

```json
{
  "email": "admin@test.local",
  "password": "Admin123!"
}
```

Không thêm `role` và không đặt dấu phẩy sau thuộc tính cuối.

Post-response script:

```javascript
const body = pm.response.json();
pm.environment.set("adminAccountId", body.user.userId);
```

### 6.2. Đăng ký Receptionist candidate

```http
POST {{authBaseUrl}}/auth/register
Content-Type: application/json
```

```json
{
  "email": "receptionist@test.local",
  "password": "Reception123!"
}
```

Post-response script:

```javascript
const body = pm.response.json();
pm.environment.set("receptionistAccountId", body.user.userId);
```

Nếu account đã tồn tại, Auth trả `409 Conflict`. Khi đó bỏ qua register và dùng account hiện có.

---

## 7. Đổi role trong Auth Database local

Mở `psql`:

```powershell
docker compose exec auth-database psql -U auth -d auth
```

Xóa role cũ và gán đúng một role cho mỗi account:

```sql
BEGIN;

DELETE FROM account_roles
WHERE account_id IN (
  SELECT id
  FROM accounts
  WHERE email IN ('admin@test.local', 'receptionist@test.local')
);

INSERT INTO account_roles (account_id, role_id)
SELECT a.id, r.id
FROM accounts a
JOIN roles r ON
  (a.email = 'admin@test.local' AND r.code = 'ADMIN')
  OR
  (a.email = 'receptionist@test.local' AND r.code = 'RECEPTIONIST');

COMMIT;
```

Kiểm tra:

```sql
SELECT a.id, a.email, a.status, r.code AS role
FROM accounts a
JOIN account_roles ar ON ar.account_id = a.id
JOIN roles r ON r.id = ar.role_id
WHERE a.email IN ('admin@test.local', 'receptionist@test.local')
ORDER BY a.email;
```

Kết quả cần có:

```text
admin@test.local         | ACTIVE | ADMIN
receptionist@test.local  | ACTIVE | RECEPTIONIST
```

Copy hai `id` vào Postman environment tương ứng rồi thoát:

```sql
\q
```

Không chỉ thêm role mới mà giữ role cũ. Auth repository hiện chỉ lấy một role, nên account nhiều role có thể cho kết quả không xác định.

---

## 8. Đăng nhập và lưu token

Phải đăng nhập sau khi đổi role để JWT mới chứa role mới.

### 8.1. Login Admin

```http
POST {{authBaseUrl}}/auth/login
Content-Type: application/json
```

```json
{
  "email": "admin@test.local",
  "password": "Admin123!"
}
```

Post-response script:

```javascript
const body = pm.response.json();

pm.test("Admin login thành công", function () {
  pm.response.to.have.status(200);
  pm.expect(body.user.role).to.eql("ADMIN");
});

pm.environment.set("adminToken", body.accessToken);
pm.environment.set("adminAccountId", body.user.userId);
```

### 8.2. Login Receptionist

```http
POST {{authBaseUrl}}/auth/login
Content-Type: application/json
```

```json
{
  "email": "receptionist@test.local",
  "password": "Reception123!"
}
```

Post-response script:

```javascript
const body = pm.response.json();

pm.test("Receptionist login thành công", function () {
  pm.response.to.have.status(200);
  pm.expect(body.user.role).to.eql("RECEPTIONIST");
});

pm.environment.set("receptionistToken", body.accessToken);
pm.environment.set("receptionistAccountId", body.user.userId);
```

---

## 9. Tạo Receptionist fixture trong database local

API create/activate chưa được expose, nên cần seed một profile để test.

Mở database:

```powershell
docker compose exec receptionist-database psql -U receptionist -d receptionist
```

Thay `RECEPTIONIST_ACCOUNT_ID` và `ADMIN_ACCOUNT_ID` bằng UUID trong Postman environment:

```sql
INSERT INTO receptionists (
  account_id,
  employee_code,
  status,
  version,
  created_by_account_id,
  updated_by_account_id
)
VALUES (
  'RECEPTIONIST_ACCOUNT_ID',
  'LT-001',
  'ACTIVE',
  1,
  'ADMIN_ACCOUNT_ID',
  'ADMIN_ACCOUNT_ID'
)
RETURNING id, account_id, employee_code, status, version;
```

Copy `id` vừa trả về. Thay `RECEPTIONIST_ID` trong lệnh sau:

```sql
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
VALUES (
  'RECEPTIONIST_ID',
  'Lễ tân kiểm thử',
  'receptionist@example.com',
  '+84901234567',
  '12 Nguyễn Huệ, Quận 1, TP.HCM',
  'Khoa Phụ sản',
  'FEMALE',
  NULL
);
```

Kiểm tra fixture:

```sql
SELECT
  r.id,
  r.account_id,
  r.employee_code,
  r.status,
  r.version,
  p.full_name,
  p.login_email,
  p.work_phone,
  p.address,
  p.department,
  p.gender,
  p.avatar_url
FROM receptionists r
JOIN receptionist_profiles p ON p.receptionist_id = r.id;
```

Copy `r.id` vào biến Postman `receptionistId`, sau đó:

```sql
\q
```

---

## 10. Admin lấy danh sách Receptionist

```http
GET {{receptionBaseUrl}}/receptionists
Authorization: Bearer {{adminToken}}
```

Trong Postman Authorization:

- Type: `Bearer Token`
- Token: `{{adminToken}}`

Expected `200`:

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "accountId": "uuid",
        "employeeCode": "LT-001",
        "status": "ACTIVE",
        "version": 1,
        "profile": {
          "fullName": "Lễ tân kiểm thử",
          "loginEmail": "receptionist@example.com",
          "workPhone": "+84901234567",
          "address": "12 Nguyễn Huệ, Quận 1, TP.HCM",
          "department": "Khoa Phụ sản",
          "gender": "FEMALE",
          "avatarUrl": null
        }
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Post-response script:

```javascript
const body = pm.response.json();
const receptionist = body.data.items[0];

pm.test("Có Receptionist fixture", function () {
  pm.response.to.have.status(200);
  pm.expect(receptionist).to.exist;
});

pm.environment.set("receptionistId", receptionist.id);
pm.environment.set("version", receptionist.version);
```

---

## 11. Admin xem chi tiết Receptionist

```http
GET {{receptionBaseUrl}}/receptionists/{{receptionistId}}
Authorization: Bearer {{adminToken}}
```

Post-response script:

```javascript
const body = pm.response.json();

pm.test("Đọc đúng Receptionist", function () {
  pm.response.to.have.status(200);
  pm.expect(body.data.id).to.eql(pm.environment.get("receptionistId"));
});

pm.environment.set("version", body.data.version);
```

---

## 12. Admin cập nhật hồ sơ

```http
PATCH {{receptionBaseUrl}}/receptionists/{{receptionistId}}
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "employeeCode": "LT-002",
  "profile": {
    "fullName": "Lễ tân Postman",
    "loginEmail": "receptionist@example.com",
    "workPhone": "+84987654321",
    "address": "25 Hai Bà Trưng, Quận 1, TP.HCM",
    "department": "Khoa Phụ sản",
    "gender": "FEMALE"
  },
  "version": {{version}},
  "reason": "Cập nhật hồ sơ bằng Postman"
}
```

Post-response script:

```javascript
const oldVersion = Number(pm.environment.get("version"));
const body = pm.response.json();

pm.test("Admin update thành công và version tăng", function () {
  pm.response.to.have.status(200);
  pm.expect(body.data.version).to.be.above(oldVersion);
});

pm.environment.set("version", body.data.version);
```

---

## 13. Receptionist xem own profile

```http
GET {{receptionBaseUrl}}/receptionists/me
Authorization: Bearer {{receptionistToken}}
```

Post-response script:

```javascript
const body = pm.response.json();

pm.test("Receptionist đọc own profile", function () {
  pm.response.to.have.status(200);
  pm.expect(body.data.id).to.eql(pm.environment.get("receptionistId"));
});

pm.environment.set("version", body.data.version);
```

---

## 14. Receptionist cập nhật avatar của mình

```http
PATCH {{receptionBaseUrl}}/receptionists/me
Authorization: Bearer {{receptionistToken}}
Content-Type: application/json
```

```json
{
  "avatarUrl": "https://cdn.example.com/receptionists/avatar-01.jpg",
  "version": {{version}}
}
```

Post-response script:

```javascript
const body = pm.response.json();

pm.test("Receptionist update own avatar", function () {
  pm.response.to.have.status(200);
  pm.expect(body.data.profile.avatarUrl).to.eql(
    "https://cdn.example.com/receptionists/avatar-01.jpg"
  );
});

pm.environment.set("version", body.data.version);
```

Endpoint này chỉ nhận `avatarUrl` và `version`. Gửi `avatarUrl: null` để xóa avatar. Mọi trường hồ sơ khác đều bị reject.

---

## 15. Test authentication và authorization

### 15.1. Không gửi JWT

```http
GET {{receptionBaseUrl}}/receptionists
```

Expected:

```http
401 Unauthorized
```

### 15.2. Receptionist gọi Admin list

```http
GET {{receptionBaseUrl}}/receptionists
Authorization: Bearer {{receptionistToken}}
```

Expected:

```http
403 Forbidden
```

### 15.3. Receptionist cố sửa field Admin

```http
PATCH {{receptionBaseUrl}}/receptionists/me
Authorization: Bearer {{receptionistToken}}
Content-Type: application/json
```

```json
{
  "fullName": "Tên không được phép",
  "avatarUrl": "https://cdn.example.com/receptionists/avatar-02.jpg",
  "version": {{version}}
}
```

Expected:

```http
400 Bad Request
```

---

## 16. Test optimistic version conflict

Gửi một version cũ, ví dụ `1`:

```http
PATCH {{receptionBaseUrl}}/receptionists/me
Authorization: Bearer {{receptionistToken}}
Content-Type: application/json
```

```json
{
  "avatarUrl": "https://cdn.example.com/receptionists/avatar-old-version.jpg",
  "version": 1
}
```

Expected:

```http
409 Conflict
```

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The receptionist record was updated by another request",
    "requestId": "uuid"
  }
}
```

---

## 17. Test deactivate và idempotency

### 17.1. Lấy version mới nhất

```http
GET {{receptionBaseUrl}}/receptionists/{{receptionistId}}
Authorization: Bearer {{adminToken}}
```

Post-response script:

```javascript
const body = pm.response.json();
pm.environment.set("deactivateVersion", body.data.version);
```

### 17.2. Chuẩn bị idempotency key cố định

Trong Pre-request Script của request deactivate:

```javascript
if (!pm.environment.get("deactivateKey")) {
  pm.environment.set(
    "deactivateKey",
    pm.variables.replaceIn("{{$guid}}")
  );
}
```

### 17.3. Deactivate

```http
POST {{receptionBaseUrl}}/receptionists/{{receptionistId}}/deactivate
Authorization: Bearer {{adminToken}}
Idempotency-Key: {{deactivateKey}}
Content-Type: application/json
```

```json
{
  "version": {{deactivateVersion}},
  "reason": "Kiểm thử deactivate bằng Postman"
}
```

Expected `200` và `status=INACTIVE`.

```javascript
const body = pm.response.json();

pm.test("Receptionist đã inactive", function () {
  pm.response.to.have.status(200);
  pm.expect(body.data.status).to.eql("INACTIVE");
});
```

### 17.4. Retry cùng request

Nhấn **Send** lần hai và giữ nguyên:

- `Idempotency-Key`.
- `deactivateVersion`.
- `reason`.

Expected vẫn `200` và trả lại cùng resource. Nếu giữ cùng key nhưng thay payload, expected:

```http
409 Conflict
```

```json
{
  "error": {
    "code": "IDEMPOTENCY_KEY_REUSED"
  }
}
```

Khi chạy lại toàn bộ kịch bản từ đầu, clear biến `deactivateKey` để tạo key mới.

---

## 18. Xác nhận các route blocked chưa được expose

Các request sau phải trả `404 Not Found`:

```http
POST {{receptionBaseUrl}}/receptionists
Authorization: Bearer {{adminToken}}
```

```http
POST {{receptionBaseUrl}}/receptionists/{{receptionistId}}/activate
Authorization: Bearer {{adminToken}}
```

```http
POST {{receptionBaseUrl}}/reception/cases
Authorization: Bearer {{receptionistToken}}
```

Đây là kết quả đúng ở phase hiện tại.

---

## 19. Test qua Kong Gateway

Chỉ test Gateway sau khi direct service `5006` hoạt động.

Khởi động Gateway:

```powershell
docker compose up -d --build gateway
```

Request:

```http
GET {{gatewayBaseUrl}}/api/receptionists
Authorization: Bearer {{adminToken}}
```

Expected giống `GET {{receptionBaseUrl}}/receptionists`.

Nếu direct service thành công nhưng Gateway lỗi:

```powershell
docker compose logs --tail 200 gateway kong-init
```

---

## 20. Lỗi thường gặp

### `property role should not exist`

Public register không nhận `role`. Body đúng:

```json
{
  "email": "admin@test.local",
  "password": "Admin123!"
}
```

### `Expected double-quoted property name in JSON`

JSON có dấu phẩy thừa, nháy đơn hoặc comment. Chọn **Body → raw → JSON** và dùng dấu nháy kép.

### `401 Unauthorized`

- Token trống hoặc hết hạn.
- Chưa đăng nhập lại sau khi đổi role.
- Public/private key không cùng một cặp.
- `issuer`, `audience` hoặc `kid` giữa Auth và Receptionist không khớp.

### `403 Forbidden`

JWT hợp lệ nhưng role không được phép. Kiểm tra `user.role` trong login response.

### `404 RECEPTIONIST_PROFILE_NOT_FOUND`

JWT Receptionist chưa có mapping `Receptionist.accountId`. Thực hiện bước tạo fixture trong Receptionist Database.

### `409 VERSION_CONFLICT`

Đọc lại resource để lấy version mới nhất rồi gửi PATCH mới.

### `409 IDEMPOTENCY_KEY_REUSED`

Cùng idempotency key đã được dùng với payload khác. Retry phải giữ nguyên key và body; thao tác mới phải dùng UUID mới.

### Database/table không tồn tại

Chạy lại Auth và Receptionist migration ở bước 3, sau đó restart service.

---

## 21. Checklist hoàn tất

- [ ] `GET /health` trả `200`.
- [ ] Admin login response có `role=ADMIN`.
- [ ] Receptionist login response có `role=RECEPTIONIST`.
- [ ] Receptionist fixture liên kết đúng `accountId`.
- [ ] Admin list/detail/update thành công.
- [ ] Receptionist đọc/sửa own profile thành công.
- [ ] Không JWT trả `401`.
- [ ] Sai role trả `403`.
- [ ] Version cũ trả `409 VERSION_CONFLICT`.
- [ ] Deactivate retry cùng key/payload trả `200`.
- [ ] Cùng key/payload khác trả `409 IDEMPOTENCY_KEY_REUSED`.
- [ ] API create/activate và Admission trả `404` đúng release gate.
- [ ] Gateway `/api/receptionists` hoạt động sau khi direct service đã pass.
