# Auth Service Setup Guide

Tài liệu này hướng dẫn setup và test **Authentication Service** sau khi fork/clone repository về máy local.

Auth Service hiện tại đã implement:

- `GET /health`
- `GET /.well-known/jwks.json`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`
- Auth Database PostgreSQL riêng
- Prisma schema/migration/seed
- Password hashing bằng Argon2id
- Access JWT signing/verification bằng RS256
- Refresh token/session bằng opaque refresh token + HMAC hash trong DB

Chưa implement ở phase hiện tại:

- Kong JWT validation cho protected business routes
- Admin-only role assignment
- Password reset/change password
- Audit/throttling nâng cao

---

## 1. Yêu cầu môi trường

Cần có:

- Node.js + npm
- Docker Desktop
- Git
- PowerShell hoặc CMD trên Windows

Kiểm tra nhanh:

```powershell
node -v
npm -v
docker --version
docker compose version
```

Nếu PowerShell không nhận `node`, thử:

```powershell
& "C:\Program Files\nodejs\node.exe" -v
npm.cmd -v
```

---

## 2. Clone/fork repo

```powershell
git clone <your-fork-url>
cd D:\DATN_maternal_healthcare_support_system
```

Hoặc thay path theo nơi bạn clone repo.

---

## 3. Cài dependencies cho backend services

```powershell
cd D:\DATN_maternal_healthcare_support_system\services
npm.cmd install
```

---

## 4. Tạo file `.env` ở project root

Từ project root:

```powershell
cd D:\DATN_maternal_healthcare_support_system
copy .env.example .env
```

File cần có path:

```text
D:\DATN_maternal_healthcare_support_system\.env
```

Các giá trị local-dev quan trọng:

```env
AUTH_SERVICE_PORT=5003
AUTH_SERVICE_INTERNAL_PORT=5003

AUTH_DB_NAME=auth
AUTH_DB_USER=auth
AUTH_DB_PASSWORD=authpass
AUTH_DB_PORT=5433
AUTH_DATABASE_URL=postgresql://auth:authpass@localhost:5433/auth?schema=public

AUTH_JWT_ISSUER=maternal-healthcare-auth
AUTH_JWT_AUDIENCE=maternal-healthcare-api
AUTH_JWT_KEY_ID=local-dev-key
AUTH_ACCESS_TOKEN_TTL_SECONDS=900

AUTH_REFRESH_TOKEN_PEPPER=local-dev-change-me-long-random-value-123456
AUTH_REFRESH_TOKEN_TTL_DAYS=30
```

Nếu máy không bị trùng port, có thể giữ nguyên các giá trị trên.

Bắt buộc cần thay 2 field JWT key bằng key thật:

```env
AUTH_JWT_PRIVATE_KEY="..."
AUTH_JWT_PUBLIC_KEY="..."
```

---

## 5. Generate RSA key pair cho JWT local-dev

Repo đã có sẵn script generate key ở project root:

```text
generate-auth-keys.cjs
```

Script này dùng Node.js built-in `crypto`, nên không cần cài `openssl`.

Chạy từ project root:

```powershell
cd D:\DATN_maternal_healthcare_support_system
node generate-auth-keys.cjs
```

Nếu PowerShell không nhận `node`, dùng đường dẫn Node mặc định:

```powershell
& "C:\Program Files\nodejs\node.exe" generate-auth-keys.cjs
```

Sau khi chạy thành công, project root sẽ có:

```text
auth-private.pem
auth-public.pem
```

Không xóa `generate-auth-keys.cjs` vì đây là script setup có sẵn trong repo.

---

## 6. Copy JWT key vào `.env`

Convert private/public key sang dạng một dòng có escaped newline `\n`.

Từ project root:

```powershell
$privateKey = (Get-Content .\auth-private.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$publicKey = (Get-Content .\auth-public.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
```

In private key:

```powershell
$privateKey
```

Copy output và paste vào `.env`:

```env
AUTH_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

In public key:

```powershell
$publicKey
```

Copy output và paste vào `.env`:

```env
AUTH_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

Kiểm tra không còn placeholder:

```powershell
Select-String -Path .env -Pattern "REPLACE_WITH"
```

Expected: không in gì liên quan tới `AUTH_JWT_PRIVATE_KEY` hoặc `AUTH_JWT_PUBLIC_KEY`.

Lưu ý bảo mật:

- Không commit `.env`
- Không commit `auth-private.pem`
- Không commit private key dưới bất kỳ hình thức nào

---

## 7. Cách chạy Auth Service khuyến nghị bằng Docker Compose

Từ project root:

```powershell
cd D:\DATN_maternal_healthcare_support_system
docker compose up -d auth-service --build --force-recreate
```

Compose sẽ tự chạy các dependency cần thiết:

- `auth-database`
- `auth-migrate`
- `auth-service`

Trong đó:

- `auth-database` là PostgreSQL riêng của Auth Service.
- `auth-migrate` chạy Prisma migration/seed rồi exit.
- `auth-service` chỉ start sau khi migrate xong.

Kiểm tra container:

```powershell
docker compose ps
```

Bạn cần thấy Auth Service có port mapping:

```text
0.0.0.0:5003->5003/tcp
```

Nếu chỉ thấy:

```text
5003/tcp
```

mà không có `0.0.0.0:5003->5003`, nghĩa là port chưa được publish ra host hoặc container chưa recreate sau khi sửa compose.

Xem logs:

```powershell
docker compose logs -f auth-service
```

Expected log có:

```text
Nest application successfully started
```

Auth Service chạy tại:

```text
http://localhost:5003
```

---

## 8. Chạy migration/seed thủ công khi cần

Nếu muốn chạy thủ công từ host hoặc debug migration:

```powershell
cd D:\DATN_maternal_healthcare_support_system

docker compose up -d auth-database
```

Sau đó trong thư mục `services`:

```powershell
cd D:\DATN_maternal_healthcare_support_system\services
$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"

npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
```

Kiểm tra trạng thái migration:

```powershell
npx.cmd prisma migrate status
```

Lưu ý:

- Khi chạy Prisma từ host, dùng `localhost:5433`.
- Khi Auth Service chạy trong Docker, connection string dùng `auth-database:5432` do Docker Compose cấu hình.

---

## 9. Chạy Auth Service local bằng npm

Nếu không chạy bằng Docker, có thể chạy local như sau.

Terminal PowerShell:

```powershell
cd D:\DATN_maternal_healthcare_support_system\services

$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"
$env:PORT=5003

$env:AUTH_JWT_PRIVATE_KEY=(Get-Content ..\auth-private.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$env:AUTH_JWT_PUBLIC_KEY=(Get-Content ..\auth-public.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$env:AUTH_JWT_ISSUER="maternal-healthcare-auth"
$env:AUTH_JWT_AUDIENCE="maternal-healthcare-api"
$env:AUTH_JWT_KEY_ID="local-dev-key"
$env:AUTH_ACCESS_TOKEN_TTL_SECONDS="900"

$env:AUTH_REFRESH_TOKEN_PEPPER="local-dev-change-me-long-random-value-123456"
$env:AUTH_REFRESH_TOKEN_TTL_DAYS="30"

npx.cmd nest start auth-service
```

Auth Service local chạy tại:

```text
http://localhost:5003
```

---

## 10. Test bằng Postman — direct Auth Service

Base URL:

```text
http://localhost:5003
```

### 10.1 Health check

```http
GET http://localhost:5003/health
```

Expected:

```http
200 OK
```

```json
{
  "status": "ok"
}
```

---

### 10.2 JWKS public key

```http
GET http://localhost:5003/.well-known/jwks.json
```

Expected:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "n": "...",
      "e": "...",
      "kid": "local-dev-key",
      "alg": "RS256",
      "use": "sig"
    }
  ]
}
```

JWKS không được chứa private key hoặc private JWK fields:

```text
d
p
q
dp
dq
qi
```

---

### 10.3 Register

Public register **không nhận role**. Backend luôn gán role `PATIENT`.

```http
POST http://localhost:5003/auth/register
Content-Type: application/json
```

Body:

```json
{
  "email": "patient@example.com",
  "password": "Password123!"
}
```

Expected:

```http
201 Created
```

```json
{
  "user": {
    "userId": "...",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Nếu gọi lại cùng email:

```http
409 Conflict
```

Nếu cố gửi role:

```json
{
  "email": "hacker@example.com",
  "password": "Password123!",
  "role": "ADMIN"
}
```

Expected:

```http
400 Bad Request
```

Vì `role` không nằm trong `RegisterDto` và global `ValidationPipe` đang bật `forbidNonWhitelisted`.

---

### 10.4 Login

```http
POST http://localhost:5003/auth/login
Content-Type: application/json
```

Body:

```json
{
  "email": "patient@example.com",
  "password": "Password123!"
}
```

Expected:

```http
200 OK
```

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "userId": "...",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Sai password hoặc email không tồn tại:

```http
401 Unauthorized
```

```json
{
  "message": "Invalid credentials",
  "error": "Unauthorized",
  "statusCode": 401
}
```

---

### 10.5 Get current user

Copy `accessToken` từ response login.

```http
GET http://localhost:5003/auth/me
Authorization: Bearer PASTE_ACCESS_TOKEN_FROM_LOGIN
```

Expected:

```http
200 OK
```

```json
{
  "user": {
    "userId": "...",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Không có token, token sai, token hết hạn, hoặc account không active:

```http
401 Unauthorized
```

---

### 10.6 Refresh token

Copy `refreshToken` từ response login.

```http
POST http://localhost:5003/auth/refresh
Content-Type: application/json
```

Body:

```json
{
  "refreshToken": "PASTE_REFRESH_TOKEN_FROM_LOGIN"
}
```

Expected:

```http
200 OK
```

```json
{
  "accessToken": "...",
  "refreshToken": "new-refresh-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "userId": "...",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Sau refresh thành công, refresh token cũ đã bị rotate. Nếu gọi lại bằng token cũ:

```http
401 Unauthorized
```

---

### 10.7 Logout

Dùng refresh token mới nhất từ login/refresh.

```http
POST http://localhost:5003/auth/logout
Content-Type: application/json
```

Body:

```json
{
  "refreshToken": "PASTE_CURRENT_REFRESH_TOKEN"
}
```

Expected:

```http
204 No Content
```

Không có response body.

Sau logout, gọi `/auth/refresh` bằng refresh token đó sẽ trả:

```http
401 Unauthorized
```

---

## 11. Test qua Kong Gateway

Kong route hiện tại trong:

```text
docs/api-specs/kong.yml
```

Routes liên quan Auth:

```text
/health -> auth-service:5003/health
/auth/* -> auth-service:5003/auth/*
/.well-known/jwks.json -> auth-service:5003/.well-known/jwks.json
```

Chạy gateway:

```powershell
cd D:\DATN_maternal_healthcare_support_system
docker compose up -d gateway --build --force-recreate
```

Test:

```http
GET http://localhost:8080/health
GET http://localhost:8080/.well-known/jwks.json
POST http://localhost:8080/auth/register
POST http://localhost:8080/auth/login
POST http://localhost:8080/auth/refresh
POST http://localhost:8080/auth/logout
```

Lưu ý:

`gateway/init-kong.sh` chỉ import `docs/api-specs/kong.yml` khi Kong database bootstrap lần đầu. Nếu `kong-data` đã tồn tại từ config cũ, route mới có thể chưa được import.

Reset riêng Kong config local nếu cần:

```powershell
docker compose down
docker volume ls
```

Tìm volume:

```text
maternal-healthcare-support-system_kong-data
```

Xóa đúng volume Kong:

```powershell
docker volume rm maternal-healthcare-support-system_kong-data
```

Start lại:

```powershell
docker compose up -d gateway --build --force-recreate
```

Không dùng `docker compose down --volumes` nếu không muốn xóa cả Auth DB data.

---

## 12. Test với frontend

Frontend mặc định gọi API qua Kong:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Chạy toàn bộ các service cần cho Auth UI:

```powershell
cd D:\DATN_maternal_healthcare_support_system
docker compose up -d auth-service gateway frontend --build --force-recreate
```

Mở browser:

```text
http://localhost:3000
```

UI hiện tại:

- Login: `email`, `password`
- Register: `email`, `password`
- Public register luôn tạo role `PATIENT`
- Không có chọn role trên UI

---

## 13. Xem DB bằng DBeaver/PostgreSQL client

Auth DB local-dev:

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `auth` |
| Username | `auth` |
| Password | `authpass` |

Sau khi connect, xem schema:

```text
public
  tables
    accounts
    credentials
    roles
    account_roles
    auth_sessions
```

Kiểm tra:

- `roles` có `PATIENT`, `RECEPTIONIST`, `DOCTOR`, `NURSE`, `ADMIN`
- `credentials.password_hash` bắt đầu bằng `$argon2id$`
- `auth_sessions.refresh_token_hash` không phải plaintext refresh token
- Sau logout, session có `revoked_at` và `revoked_reason = logout`

---

## 14. Chạy test/build

Từ thư mục `services`:

```powershell
cd D:\DATN_maternal_healthcare_support_system\services
$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"

npm.cmd run test
npm.cmd run test:e2e
npm.cmd run build
```

Expected:

```text
TEST_EXIT_CODE:0
E2E_EXIT_CODE:0
BUILD_EXIT_CODE:0
```

---

## 15. Các lỗi thường gặp

### 15.1 `ECONNREFUSED 127.0.0.1:5003`

Auth Service chưa publish port ra host hoặc container chưa chạy.

Kiểm tra:

```powershell
docker compose ps auth-service
```

Expected phải có:

```text
0.0.0.0:5003->5003/tcp
```

Nếu không có, recreate:

```powershell
docker compose up -d auth-service --build --force-recreate
```

---

### 15.2 `Environment variable not found: AUTH_DATABASE_URL`

Khi chạy Prisma từ host, set env:

```powershell
$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"
```

---

### 15.3 `Can't reach database server at localhost:5433`

DB chưa chạy hoặc port không đúng.

```powershell
docker compose up -d auth-database
docker compose ps auth-database
Test-NetConnection localhost -Port 5433
```

Expected:

```text
TcpTestSucceeded : True
```

---

### 15.4 Prisma `EPERM rename query_engine-windows.dll.node`

Thường do Node/Nest/Prisma Studio đang giữ Prisma engine trên Windows.

Cách xử lý:

1. Dừng `npm.cmd run start`
2. Dừng Prisma Studio nếu đang mở
3. Đóng terminal Node đang chạy
4. Chạy lại:

```powershell
npm.cmd run prisma:generate
```

---

### 15.5 Login lỗi private key

Nếu gặp:

```text
secretOrPrivateKey must be an asymmetric key when using RS256
```

Kiểm tra `.env` còn placeholder không:

```powershell
Select-String -Path .env -Pattern "REPLACE_WITH"
```

Kiểm tra container nhận key thật, không in full private key:

```powershell
docker compose exec auth-service node -e "const k=process.env.AUTH_JWT_PRIVATE_KEY||''; console.log({length:k.length,prefix:k.slice(0,35),hasReplace:k.includes('REPLACE_WITH')})"
```

Expected:

```js
{
  length: 1700,
  prefix: '-----BEGIN PRIVATE KEY-----...',
  hasReplace: false
}
```

---

### 15.6 Login/refresh lỗi thiếu pepper

Nếu refresh token/session lỗi, kiểm tra:

```env
AUTH_REFRESH_TOKEN_PEPPER=local-dev-change-me-long-random-value-123456
AUTH_REFRESH_TOKEN_TTL_DAYS=30
```

Sau khi sửa `.env`, recreate container:

```powershell
docker compose up -d auth-service --build --force-recreate
```

---

## 16. Security notes

Không commit:

```text
.env
auth-private.pem
```

Private key chỉ dùng local-dev. Production/staging phải dùng secret manager hoặc cơ chế bảo mật tương đương.

Access token hiện không chứa medical data hoặc unnecessary PII. Token claims hiện tại gồm:

```text
iss
aud
sub
jti
iat
exp
role
```

Refresh token:

- là opaque token, không phải JWT,
- chỉ trả về client một lần,
- DB chỉ lưu HMAC-SHA256 hash,
- được rotate khi gọi `/auth/refresh`,
- bị revoke khi gọi `/auth/logout`.

---

## 17. Checklist setup nhanh

```powershell
cd D:\DATN_maternal_healthcare_support_system
copy .env.example .env

# Generate keys bằng script có sẵn ở project root
node generate-auth-keys.cjs

# Convert key, paste vào .env:
$privateKey = (Get-Content .\auth-private.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$publicKey = (Get-Content .\auth-public.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$privateKey
$publicKey

# Sau khi sửa .env xong:
docker compose up -d auth-service --build --force-recreate

docker compose ps auth-service
```

Test nhanh:

```text
GET  http://localhost:5003/health
GET  http://localhost:5003/.well-known/jwks.json
POST http://localhost:5003/auth/register
POST http://localhost:5003/auth/login
GET  http://localhost:5003/auth/me
POST http://localhost:5003/auth/refresh
POST http://localhost:5003/auth/logout
```
