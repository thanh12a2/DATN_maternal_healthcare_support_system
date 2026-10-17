# Maternal Healthcare Support System

Hệ thống hỗ trợ chăm sóc sức khỏe thai phụ theo kiến trúc microservice. Repository gồm frontend React/Vite, API Gateway Kong, các NestJS service, PostgreSQL database riêng theo bounded context, RabbitMQ và Prisma migrations.

> Hướng dẫn chạy lần đầu: [docs/first-run.md](docs/first-run.md)

## Kiến trúc

```text
Browser :3000
   |
Kong Gateway :8080
   |
Auth / Patient / Doctor / Reception / Catalog / Appointment / Billing
Medical Record / Queue / Consultation / Document / Prescription
Treatment Plan / Notification / Audit Log / Reporting
   |
PostgreSQL riêng cho từng bounded context + RabbitMQ
```

Mỗi service sở hữu database của mình. Service-to-service communication dùng gRPC và events theo contract hiện có; frontend chỉ đi qua Gateway, không truy cập database trực tiếp.

## Thành phần chính

| Thành phần | Port mặc định | Ghi chú |
|---|---:|---|
| Frontend | 3000 | React/Vite Patient Portal và role workspace |
| Kong proxy | 8080 | Entry point cho frontend/API |
| Kong Admin | 8001 | Chỉ bind local |
| Kong Manager | 8002 | Chỉ bind local |
| Auth | 5003 | Authentication, JWT, refresh session |
| Patient | 5004 | Hồ sơ bệnh nhân |
| Doctor | 5005 | Bác sĩ, specialty, schedule, availability |
| Receptionist | 5006 | Tiếp nhận/admission |
| Catalog | 5007 | Dịch vụ và pricing |
| Appointment | 5008 | Slot, hold, appointment |
| Billing | 5009 | Invoice/payment |
| Medical Record | 5011 | Encounter và dữ liệu lâm sàng |
| Queue | 5012 | Journey/ticket |
| Document | 5013 | Document metadata |
| Prescription | 5014 | Prescription |
| Treatment Plan | 5015 | Treatment plan |
| Notification | 5016 | Internal notification operations |
| Audit Log | 5017 | Audit events |
| Reporting | 5018 | Reports |
| Consultation | 5019 | Consultation |
| RabbitMQ Management | 15672 | Chỉ bind local |

## Yêu cầu

- Docker Desktop và Docker Compose v2.
- Node.js 22+ và npm nếu chạy test/build local.
- Git.

## Chạy nhanh

```powershell
# PowerShell
Copy-Item .env.example .env
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker
```

Hoặc thủ công:

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Không cần dùng `docker-compose.services.yml`; cấu hình đã được hợp nhất vào `docker-compose.yml`.

## Seed dữ liệu demo

Sau khi database và migrations đã sẵn sàng:

```powershell
cd services
npm.cmd run prisma:seed:demo
```

Tài khoản demo mặc định:

| Role | Email | Password |
|---|---|---|
| Patient | `demo.patient@antam.local` | `Demo@123456` |
| Doctor | `demo.doctor@antam.local` | `Demo@123456` |
| Receptionist | `demo.receptionist@antam.local` | `Demo@123456` |
| Admin | `demo.admin@antam.local` | `Demo@123456` |

Có thể đổi password bằng biến `DEMO_SEED_PASSWORD`. Seed dùng `upsert`, không reset hoặc xóa database.

## Commands thường dùng

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f gateway
docker compose down

cd frontend
npm.cmd run build
npm.cmd run test

cd ..\services
npm.cmd run build
npm.cmd test -- --runInBand
```

## Environment và secrets

- `.env.example` là template an toàn, được phép commit.
- `.env` là local-only và bị ignore.
- Private key `*.pem` bị ignore.
- Không commit password, JWT private key, pepper, SMTP credential hoặc database secret.
- Nếu secret đã từng commit, cần rotate secret; việc thêm `.gitignore` không xóa secret khỏi Git history.

Các script setup có thể tự sinh local key/pepper khi chạy lần đầu. Xem [docs/first-run.md](docs/first-run.md).

## Tài liệu

- [Hướng dẫn chạy lần đầu](docs/first-run.md)
- [Setup toàn bộ môi trường](docs/setup-all-environment.md)
- [API specifications và Kong config](docs/api-specs/)
- [Gateway notes](gateway/readme.md)
- [System design](docs/system_design.md)
- [Service contracts index](docs/service-contracts-index.md)

## Verification

```powershell
docker compose config --quiet
cd frontend; npm.cmd run build; npm.cmd run test
cd ..\services; npm.cmd run build; npm.cmd test -- --runInBand
```

## Git safety

Không commit/push tự động. Khi thay đổi history hoặc force push, cần thông báo cho toàn bộ thành viên trước.
