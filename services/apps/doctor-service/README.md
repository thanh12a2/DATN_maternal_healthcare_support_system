# Doctor Service

Doctor Service quản lý Doctor Directory & Working Availability theo `docs/doctor-service-specification.md`.

## Scope

Service sở hữu `Doctor`, `DoctorProfile`, `Specialty`, `DoctorSpecialty`, `DoctorSchedule` và `DoctorAvailability`, cùng local audit/outbox records. Service không sở hữu hoặc truy cập database của Appointment, Patient hay Medical Record.

## API

- Direct local base URL: `http://localhost:5005`
- Kong public base URL: `http://localhost:8080/api/doctors`
- OpenAPI: `docs/api-specs/doctor-service.yaml`
- Health: `GET /health`

Business routes yêu cầu Bearer JWT. Role/ownership được kiểm tra trong service; `/internal/*` không có route public trong Kong config.

## Run nhanh

Từ project root:

```powershell
docker compose up -d doctor-database
cd services
$env:DOCTOR_DATABASE_URL="postgresql://doctor:doctorpass@localhost:5435/doctor?schema=public"
npm.cmd run prisma:generate:doctor
npm.cmd run prisma:migrate:doctor
npm.cmd run prisma:seed:doctor
npm.cmd run start:doctor
```

Health:

```text
GET http://localhost:5005/health
```

Response khi process và DB ready:

```json
{ "status": "ok" }
```

## Auth/internal dependency

API tạo hoặc activate doctor xác minh account ACTIVE có role DOCTOR bằng internal endpoint của Auth Service:

```text
GET http://auth-service:5003/internal/accounts/{accountId}
```

Doctor Service gọi endpoint này với header:

```text
x-internal-service-secret: <INTERNAL_SERVICE_AUTH_SECRET>
```

Hai service phải dùng cùng giá trị `INTERNAL_SERVICE_AUTH_SECRET`. Nếu endpoint/secret chưa cấu hình hoặc Auth Service chưa restart sau khi cập nhật code, thao tác cần lookup trả `503 DEPENDENCY_UNAVAILABLE`. Doctor Service không truy cập trực tiếp Auth Database.

## Configuration

| Variable | Default/local example |
|---|---|
| `PORT` | `5005` |
| `DOCTOR_DATABASE_URL` | `postgresql://doctor:doctorpass@doctor-database:5432/doctor?schema=public` trong Docker |
| `DOCTOR_TIMEZONE` | `Asia/Bangkok` |
| `DOCTOR_MAX_AVAILABILITY_RANGE_DAYS` | `31` |
| `AUTH_JWT_PUBLIC_KEY` | Public RS256 key từ Auth |
| `AUTH_JWT_ISSUER` | `maternal-healthcare-auth` |
| `AUTH_JWT_AUDIENCE` | `maternal-healthcare-api` |
| `AUTH_ACCOUNT_LOOKUP_URL` | Chưa bật nếu contract Auth chưa chốt |

## Reliability notes

Các write quan trọng tạo local audit/outbox record trong cùng transaction. Outbox lưu `PENDING`; repository hiện chưa bật broker/dispatcher, đúng decision gate trong specification. Không tự động hủy hoặc sửa appointment.
