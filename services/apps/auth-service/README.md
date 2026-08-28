# Auth Service

Authentication Service là dịch vụ xác thực tập trung của hệ thống, chịu trách nhiệm đăng nhập, phát hành token và làm mới token. Các microservice khác không gọi trực tiếp Authentication Service cho mỗi request; thay vào đó, API Gateway sẽ xác thực JWT cục bộ bằng public key để giảm độ trễ và tránh tạo điểm nghẽn hiệu năng.

## Kiến trúc

```text
		   Client
			 │
			 ▼
		 API Gateway
			 │
	  Verify JWT bằng public key
			 │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
Appointment     Medical      Notification
Service         Service      Service

		▲
		│
     Authentication Service
     (Login / Refresh / Logout)
```

## Vai trò của Authentication Service

- Chỉ xử lý đăng nhập, phát hành token và làm mới token.
- Không tham gia xác thực từng request nghiệp vụ của hệ thống.
- Có thể được triển khai nhiều instance phía sau load balancer để loại bỏ điểm lỗi đơn.

## Cách giao tiếp giữa các dịch vụ

- API Gateway xác thực JWT offline bằng public key, không gọi Authentication Service cho mọi request.
- Các microservice nhận thông tin người dùng như `userId`, `role`, `permissions` từ JWT hoặc từ header do Gateway chuyển tiếp.
- Khi cần giao tiếp nội bộ nhanh và ổn định, ưu tiên gRPC cho inter-service communication.

## Security foundation hiện tại

Bước foundation hiện tại mới chuẩn bị nền tảng bảo mật cho các phase auth tiếp theo, chưa implement register/login/JWT/refresh token.

### Dependencies đã thêm

- `@nestjs/config`: chuẩn bị quản lý cấu hình qua environment variables cho JWT, database, token TTL, key/secret ở các phase sau.
- `class-validator`: validate DTO input như email và password length.
- `class-transformer`: hỗ trợ NestJS `ValidationPipe` transform request payload vào DTO class.
- `argon2`: hash password bằng Argon2id theo target architecture.
- `@prisma/client`: Prisma runtime client để Auth Service truy cập Auth Database.
- `prisma`: Prisma CLI dùng cho generate client, migration và seed.

### Password hashing

- Password tuyệt đối không lưu plaintext.
- `PasswordHasherService` dùng `argon2` với `argon2id` để hash password.
- Mỗi lần hash dùng salt riêng do thư viện sinh ra.
- Unit tests xác nhận:
  - hash không bằng password gốc,
  - hash chứa metadata `$argon2id$`,
  - cùng một password tạo ra hash khác nhau do salt,
  - verify đúng password thành công,
  - verify sai password thất bại.

### DTO validation

Các DTO nền tảng đã được tạo:

- `RegisterDto`
  - `email`: email hợp lệ.
  - `password`: string, tối thiểu 8 ký tự.
  - Public register không nhận `role`; backend luôn gán `PATIENT`.
- `LoginDto`
  - `email`: email hợp lệ.
  - `password`: string, tối thiểu 8 ký tự.

Auth Service bootstrap đã bật global `ValidationPipe` với:

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `transform: true`

## Auth endpoints hiện tại

### `POST /auth/register`

Endpoint đăng ký account foundation đã được implement để ghi dữ liệu vào Auth Database.

Request body:

```json
{
  "email": "patient@example.com",
  "password": "Password123!"
}
```

Response hiện tại:

```json
{
  "user": {
    "userId": "uuid",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Lưu ý phase hiện tại **chưa phát hành `accessToken` hoặc `refreshToken`**. JWT signing và refresh session sẽ được implement ở phase sau.

Security behavior hiện tại:

- Email được normalize bằng `trim().toLowerCase()` trước khi lưu.
- Password được hash bằng Argon2id trước khi lưu vào bảng `credentials`.
- Response không trả password hash.
- Duplicate email trả `409 Conflict`.
- Public register luôn tạo role `PATIENT`.
- Các role khác chỉ được cấp qua admin-only flow ở phase sau.
- Nếu role `PATIENT` chưa seed trong DB thì được coi là lỗi cấu hình server.

### `POST /auth/login`

Endpoint đăng nhập foundation đã được implement để xác thực credential bằng Auth Database.

Request body:

```json
{
  "email": "patient@example.com",
  "password": "Password123!"
}
```

Response hiện tại:

```json
{
  "user": {
    "userId": "uuid",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Login thành công hiện phát hành short-lived JWT access token RS256 và opaque refresh token.

Security behavior hiện tại:

- Email được normalize bằng `trim().toLowerCase()` trước khi lookup.
- Chỉ account `ACTIVE` được login.
- Password được verify bằng Argon2id thông qua `PasswordHasherService`.
- Login sai account/password/status đều trả lỗi chung `401 Invalid credentials`.
- Không tiết lộ account tồn tại hay không.
- Login thành công cập nhật `last_login_at`.
- Response không trả password hash.
- Access token không chứa password, refresh token, medical data hoặc unnecessary PII.
- Refresh token là opaque random token, không phải JWT.
- Auth Database chỉ lưu HMAC-SHA256 hash của refresh token, không lưu plaintext refresh token.
- Refresh endpoint đã implement refresh token rotation.
- Logout endpoint đã implement revoke refresh session.

## JWKS endpoint

Auth Service expose public key theo JWKS format:

```http
GET /.well-known/jwks.json
```

Response dạng:

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

Endpoint này chỉ expose public key material, không expose private key.

Biến env dùng bởi JWKS:

```env
AUTH_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"
AUTH_JWT_KEY_ID=local-dev-key
```

JWKS endpoint là foundation cho phase Kong JWT validation sau này.

## JWT access token foundation

Login thành công trả response dạng:

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-refresh-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "userId": "uuid",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Access token được ký bằng RS256. Private key phải đến từ environment variable, không commit vào repository.

### JWT environment variables

```env
AUTH_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
AUTH_JWT_ISSUER=maternal-healthcare-auth
AUTH_JWT_AUDIENCE=maternal-healthcare-api
AUTH_JWT_KEY_ID=local-dev-key
AUTH_ACCESS_TOKEN_TTL_SECONDS=900
AUTH_REFRESH_TOKEN_PEPPER=replace-with-local-dev-refresh-token-pepper
AUTH_REFRESH_TOKEN_TTL_DAYS=30
```

Default nếu không set:

- `AUTH_JWT_ISSUER`: `maternal-healthcare-auth`
- `AUTH_JWT_AUDIENCE`: `maternal-healthcare-api`
- `AUTH_JWT_KEY_ID`: `local-dev-key`
- `AUTH_ACCESS_TOKEN_TTL_SECONDS`: `900`

Bắt buộc phải set:

- `AUTH_JWT_PRIVATE_KEY`
- `AUTH_REFRESH_TOKEN_PEPPER`

### JWT claims tối thiểu

Access token hiện chứa:

| Claim | Ý nghĩa |
|---|---|
| `iss` | Issuer |
| `aud` | Audience |
| `sub` | Account/user id |
| `jti` | Token id |
| `iat` | Issued at |
| `exp` | Expiration |
| `role` | Role coarse-grained |

Không đưa vào JWT:

- Password/credential metadata.
- Refresh token.
- Medical record.
- Diagnosis.
- Prescription.
- Treatment plan.
- Địa chỉ, CCCD, số điện thoại, ngày sinh nếu không cần thiết.

### Generate RSA key pair local-dev

PowerShell:

```powershell
openssl genrsa -out auth-private.pem 2048
openssl rsa -in auth-private.pem -pubout -out auth-public.pem
```

Đưa private key vào env dạng escaped newline:

```powershell
$privateKey = (Get-Content .\auth-private.pem -Raw).Replace("`r`n", "\n").Replace("`n", "\n")
$env:AUTH_JWT_PRIVATE_KEY=$privateKey
```

Public key sẽ dùng ở phase Kong JWT validation sau. Không commit private key vào repository.

## Refresh token/session foundation

Login hiện tạo một record trong bảng `auth_sessions` và trả refresh token plaintext cho client một lần.

Database chỉ lưu:

```text
refresh_token_hash
```

Hash được tạo bằng:

```text
HMAC-SHA256(refreshToken, AUTH_REFRESH_TOKEN_PEPPER)
```

Environment variables:

```env
AUTH_REFRESH_TOKEN_PEPPER=replace-with-local-dev-refresh-token-pepper
AUTH_REFRESH_TOKEN_TTL_DAYS=30
```

Refresh token hiện tại được issue khi login và rotate khi gọi refresh.

### `POST /auth/refresh`

Request body:

```json
{
  "refreshToken": "opaque-refresh-token-from-login"
}
```

Response:

```json
{
  "accessToken": "new-jwt",
  "refreshToken": "new-opaque-refresh-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "userId": "uuid",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Refresh flow:

- Hash refresh token bằng `AUTH_REFRESH_TOKEN_PEPPER`.
- Tìm session theo `refresh_token_hash`.
- Reject nếu session không tồn tại, hết hạn hoặc đã revoke.
- Load account/role và chỉ cho account `ACTIVE` refresh.
- Rotate refresh token bằng cách update `refresh_token_hash`, `expires_at`, `last_used_at`.
- Issue access token mới.

Sau refresh thành công, refresh token cũ không còn dùng được.

### `GET /auth/me`

Request:

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "user": {
    "userId": "uuid",
    "email": "patient@example.com",
    "role": "PATIENT"
  }
}
```

Behavior:

- Extract Bearer token từ `Authorization` header.
- Verify access token bằng `AUTH_JWT_PUBLIC_KEY` với RS256.
- Verify `iss` và `aud`.
- Load account profile từ Auth DB bằng `sub` trong token.
- Chỉ account `ACTIVE` được trả profile.
- Invalid/missing/expired token trả `401 Unauthorized`.

Lưu ý: `/auth/me` là Auth Service endpoint. Business APIs sau này vẫn không được gọi Auth Service đồng bộ để validate access token; validation cho business routes sẽ thuộc Kong/JWT offline validation phase.

### `POST /auth/logout`

Request body:

```json
{
  "refreshToken": "opaque-refresh-token"
}
```

Response:

```http
204 No Content
```

Logout flow:

- Hash refresh token bằng `AUTH_REFRESH_TOKEN_PEPPER`.
- Tìm session theo `refresh_token_hash`.
- Reject nếu session không tồn tại, hết hạn hoặc đã revoke.
- Set `revoked_at` và `revoked_reason = 'logout'`.
- Sau logout, refresh token đó không còn dùng được để refresh.

## Auth Database foundation

Auth Service sở hữu database riêng cho identity/security data. Không dùng Kong database và không truy cập database của service khác.

Prisma schema nằm tại:

```text
services/prisma/schema.prisma
```

Datasource dùng biến môi trường:

```env
AUTH_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

Các model foundation hiện có:

- `Account` -> bảng `accounts`
  - email normalized/unique,
  - status,
  - timestamps,
  - last login timestamp.
- `Credential` -> bảng `credentials`
  - `password_hash`,
  - `password_updated_at`,
  - `failed_login_count`,
  - `locked_until`.
- `Role` -> bảng `roles`
  - role code: `PATIENT`, `RECEPTIONIST`, `DOCTOR`, `NURSE`, `ADMIN`.
- `AccountRole` -> bảng `account_roles`
  - mapping many-to-many giữa account và role.

Migration đầu tiên nằm tại:

```text
services/prisma/migrations/20260824142300_auth_foundation/migration.sql
```

Migration này tạo schema foundation và seed roles cơ bản idempotent bằng `ON CONFLICT DO NOTHING`.

Seed script bổ sung nằm tại:

```text
services/prisma/seed.ts
```

Script này upsert các role cơ bản và có thể chạy lại an toàn.

### Docker Compose Auth Database

`docker-compose.yml` hiện có PostgreSQL riêng cho Auth Service:

```text
auth-database
```

Default host port:

```text
localhost:5433 -> auth-database:5432
```

Default credentials local-dev:

```env
AUTH_DB_NAME=auth
AUTH_DB_USER=auth
AUTH_DB_PASSWORD=authpass
AUTH_DB_PORT=5433
```

Khi Auth Service chạy trong Docker network, app dùng connection string container nội bộ:

```env
AUTH_DATABASE_URL=postgresql://auth:authpass@auth-database:5432/auth?schema=public
```

Khi chạy Prisma migration từ máy host, dùng host port `5433`:

```cmd
set AUTH_DATABASE_URL=postgresql://auth:authpass@localhost:5433/auth?schema=public
npm.cmd run prisma:migrate:dev
npm.cmd run prisma:seed
```

### Prisma commands

Chạy trong thư mục `services`:

```cmd
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:dev
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
```

Lưu ý: các lệnh migrate/seed cần `AUTH_DATABASE_URL` trỏ tới PostgreSQL Auth Database đang chạy.

## Lợi ích kiến trúc

Kiến trúc này được dùng rất phổ biến vì vừa giảm độ trễ, vừa tránh việc Authentication Service trở thành nút thắt hiệu năng cho toàn bộ hệ thống. Đồng thời, việc tách riêng xác thực tập trung giúp hệ thống dễ mở rộng, dễ vận hành và dễ bảo trì hơn.
