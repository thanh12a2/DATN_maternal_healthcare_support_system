# Auth Service Setup Guide

Tài liệu này hướng dẫn setup Authentication Service sau khi fork/clone repository về máy local.

Scope hiện tại của Auth Service:

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- Auth Database PostgreSQL riêng
- Prisma schema/migration/seed
- Password hashing bằng Argon2id
- Access JWT signing bằng RS256

Chưa implement ở phase hiện tại:

- Refresh token/session
- Logout
- JWKS endpoint
- Kong JWT validation plugin

---

## 1. Yêu cầu môi trường

Cần có:

- Node.js, npm
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

Nếu PowerShell không nhận `node`/`npm`, thử dùng đường dẫn Node mặc định:

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

## 3. Cài dependencies cho NestJS services

```powershell
cd D:\DATN_maternal_healthcare_support_system\services
npm.cmd install
```

Nếu dùng CMD:

```cmd
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

Các config default local-dev quan trọng:

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
AUTH_REFRESH_TOKEN_PEPPER=replace-with-local-dev-refresh-token-pepper
AUTH_REFRESH_TOKEN_TTL_DAYS=30
```

Thông thường có thể giữ nguyên các giá trị trên nếu máy không bị trùng port.

Bắt buộc cần thay 2 field JWT key:

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
```

Nếu `node` đã có trong PATH:

```powershell
node generate-auth-keys.cjs
```

Nếu PowerShell không nhận `node`, dùng đường dẫn Node mặc định trên Windows:

```powershell
& "C:\Program Files\nodejs\node.exe" generate-auth-keys.cjs
```

Sau khi chạy thành công, project root sẽ có:

```text
auth-private.pem
auth-public.pem
```

Lưu ý: không xóa `generate-auth-keys.cjs` vì đây là script setup đã có sẵn trong repo.

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

Lưu ý:

- Không commit `.env`
- Không commit `auth-private.pem`
- Không commit private key dưới bất kỳ hình thức nào

---

## 7. Chạy Auth Database bằng Docker Compose

Từ project root:

```powershell
cd D:\DATN_maternal_healthcare_support_system
docker compose up -d auth-database
```

Kiểm tra container:

```powershell
docker compose ps auth-database
```

Đợi status `healthy`.

Auth Database mapping mặc định:

```text
localhost:5433 -> auth-database:5432
```

---

## 8. Generate Prisma Client, migrate và seed

Chạy từ thư mục `services`.

PowerShell:

```powershell
cd D:\DATN_maternal_healthcare_support_system\services
$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"

npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
```

Nếu đây là lần đầu setup local và muốn dùng `migrate dev`:

```powershell
npm.cmd run prisma:migrate:dev
```

Nếu Prisma hỏi:

```text
? Enter a name for the new migration:
```

mà migration `20260824142300_auth_foundation` đã apply rồi, hãy nhấn `Ctrl + C` để tránh tạo migration không cần thiết, sau đó dùng:

```powershell
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
```

Kiểm tra trạng thái migration:

```powershell
npx.cmd prisma migrate status
```

---

## 9. Chạy Auth Service local bằng npm

Vẫn trong thư mục `services`.

PowerShell:

```powershell
cd D:\DATN_maternal_healthcare_support_system\services

$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"
$env:PORT=5003

$env:AUTH_JWT_PRIVATE_KEY=(Get-Content ..\auth-private.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$env:AUTH_JWT_ISSUER="maternal-healthcare-auth"
$env:AUTH_JWT_AUDIENCE="maternal-healthcare-api"
$env:AUTH_JWT_KEY_ID="local-dev-key"
$env:AUTH_ACCESS_TOKEN_TTL_SECONDS="900"
$env:AUTH_REFRESH_TOKEN_PEPPER="replace-with-local-dev-refresh-token-pepper"
$env:AUTH_REFRESH_TOKEN_TTL_DAYS="30"

npm.cmd run start
```

Auth Service chạy tại:

```text
http://localhost:5003
```

Health check:

```text
GET http://localhost:5003/health
```

Expected:

```json
{
  "status": "ok"
}
```

---

## 10. Test bằng Postman

### 10.1 JWKS public key

Request:

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

JWKS không được chứa private key hoặc các field private JWK như `d`, `p`, `q`, `dp`, `dq`, `qi`.

### 10.2 Register

Request:

```http
POST http://localhost:5003/auth/register
Content-Type: application/json
```

Body:

```json
{
  "email": "patient@example.com",
  "password": "Password123!",
  "role": "PATIENT"
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

### 10.3 Login

Request:

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

### 10.4 Get current user

Copy `accessToken` từ response login.

Request:

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

Không có token, token sai, token hết hạn, hoặc account không active sẽ trả:

```http
401 Unauthorized
```

### 10.5 Refresh token

Copy `refreshToken` từ response login.

Request:

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

Sau refresh thành công, refresh token cũ đã bị rotate. Nếu gọi lại bằng token cũ, expected:

```http
401 Unauthorized
```

### 10.6 Logout

Dùng refresh token mới nhất từ login/refresh.

Request:

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

Sau logout, gọi `/auth/refresh` bằng refresh token đó sẽ trả:

```http
401 Unauthorized
```

Sai password hoặc account không tồn tại:

```http
401 Unauthorized
```

```json
{
  "message": "Invalid credentials"
}
```

---

## 11. Chạy bằng Docker Compose

Sau khi đã tạo `.env` ở project root và thay JWT keys:

```powershell
cd D:\DATN_maternal_healthcare_support_system
docker compose up auth-service --build
```

Auth Service Docker chạy tại:

```text
http://localhost:5003
```

Lưu ý:

- Docker Compose dùng root `.env` tự động.
- `AUTH_DATABASE_URL` trong container trỏ tới `auth-database:5432`, không phải `localhost:5433`.
- Nếu đổi `AUTH_DB_USER`, `AUTH_DB_PASSWORD`, `AUTH_DB_NAME`, cần đảm bảo database/volume tương ứng được tạo lại hoặc migrate đúng.

---

## 12. Test qua Kong Gateway

Kong route hiện tại trong:

```text
docs/api-specs/kong.yml
```

Routes liên quan Auth:

```text
/health -> auth-service:5003/health
/auth/* -> auth-service:5003/auth/*
```

Chạy gateway:

```powershell
docker compose up gateway --build
```

Test:

```text
GET http://localhost:8080/health
POST http://localhost:8080/auth/register
POST http://localhost:8080/auth/login
```

Lưu ý quan trọng:

`gateway/init-kong.sh` chỉ import `docs/api-specs/kong.yml` khi Kong database bootstrap lần đầu. Nếu `kong-data` đã tồn tại từ config cũ, route mới có thể chưa được import.

Local reset Kong config:

```powershell
docker compose down --volumes
docker compose up gateway --build
```

Cẩn thận: `down --volumes` sẽ xóa local volumes, bao gồm cả database volumes nếu đang dùng. Không dùng với dữ liệu quan trọng.

---

## 13. Chạy test/build

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

## 14. Các lỗi thường gặp

### Lỗi: `Environment variable not found: AUTH_DATABASE_URL`

Set env trong terminal hiện tại:

```powershell
$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"
```

Sau đó chạy lại Prisma command.

---

### Lỗi: `Can't reach database server at localhost:5433`

Kiểm tra DB container:

```powershell
docker compose ps auth-database
```

Nếu chưa chạy:

```powershell
docker compose up -d auth-database
```

---

### Lỗi Prisma `EPERM rename query_engine-windows.dll.node`

Thường do Node/Nest/Prisma Studio đang giữ file Prisma engine trên Windows.

Cách xử lý:

1. Dừng `npm.cmd run start`
2. Dừng Prisma Studio nếu đang mở
3. Đóng terminal Node đang chạy
4. Chạy lại:

```powershell
npm.cmd run prisma:generate
```

---

### Lỗi login: `Missing required configuration: AUTH_JWT_PRIVATE_KEY`

Bạn chưa set private key.

Nếu chạy local bằng npm, set env:

```powershell
$env:AUTH_JWT_PRIVATE_KEY=(Get-Content ..\auth-private.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
```

Nếu chạy Docker Compose, kiểm tra root `.env` có:

```env
AUTH_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 15. Security notes

Không commit các file này:

```text
.env
auth-private.pem
auth-public.pem
```

Private key chỉ dùng local-dev. Production/staging phải dùng secret manager hoặc mechanism bảo mật tương đương.

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

---

## 16. Checklist setup nhanh

```powershell
cd D:\DATN_maternal_healthcare_support_system
copy .env.example .env

# Generate keys bằng script có sẵn ở project root, rồi paste key vào .env hoặc set env trực tiếp.
node generate-auth-keys.cjs

docker compose up -d auth-database

cd D:\DATN_maternal_healthcare_support_system\services
npm.cmd install
$env:AUTH_DATABASE_URL="postgresql://auth:authpass@localhost:5433/auth?schema=public"
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed

$env:PORT=5003
$env:AUTH_JWT_PRIVATE_KEY=(Get-Content ..\auth-private.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$env:AUTH_JWT_ISSUER="maternal-healthcare-auth"
$env:AUTH_JWT_AUDIENCE="maternal-healthcare-api"
$env:AUTH_JWT_KEY_ID="local-dev-key"
$env:AUTH_ACCESS_TOKEN_TTL_SECONDS="900"
$env:AUTH_REFRESH_TOKEN_PEPPER="replace-with-local-dev-refresh-token-pepper"
$env:AUTH_REFRESH_TOKEN_TTL_DAYS="30"
npm.cmd run start
```

Sau đó test:

```text
GET  http://localhost:5003/health
POST http://localhost:5003/auth/register
POST http://localhost:5003/auth/login
```
