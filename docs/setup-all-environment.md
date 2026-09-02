# Setup toàn bộ môi trường và services

Tài liệu này hướng dẫn chạy Auth, Doctor, Patient, Sample, Kong và Frontend bằng Docker hoặc chạy app local với PostgreSQL trong Docker.

## 1. Yêu cầu

- Docker Desktop và Docker Compose v2.
- Node.js 22 khuyến nghị.
- npm và PowerShell.
- pgAdmin4/Postman tùy nhu cầu.

Kiểm tra:

~~~powershell
docker version
docker compose version
node --version
npm --version
~~~

## 2. Port local

| Thành phần | Port |
|---|---:|
| Frontend | 3000 |
| Kong proxy | 8080 |
| Kong Admin/Manager | 8001 / 8002 |
| Auth API | 5003 |
| Doctor API | 5005 |
| Patient API | 5004 |
| Sample API | 5001 |
| Auth PostgreSQL | 5433 |
| Doctor PostgreSQL | 5435 |
| Patient PostgreSQL | 5434 |

Trong Docker network, app dùng hostname như auth-database, doctor-database, patient-database và port PostgreSQL 5432. Từ Windows/pgAdmin dùng localhost và port ở bảng trên.

## 3. Các script setup

- scripts/setup-local.ps1: tạo env/key, migrate database và chạy setup Docker/local.
- scripts/load-env.ps1: nạp root .env vào PowerShell hiện tại.
- scripts/generate-internal-keys.cjs: tạo key pair cho internal service JWT.

Script setup không chạy docker compose down -v, không xóa volume và không reset database.

## 4. Chuẩn bị environment và keys

Từ project root:

~~~powershell
cd D:\DATN_maternal_healthcare_support_system
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode PrepareOnly
~~~

Script tạo hoặc bổ sung:

- .env.
- auth-private.pem và auth-public.pem.
- patient-internal-private.pem và patient-internal-public.pem.
- Password database khi .env mới hoặc còn placeholder.
- Auth refresh-token pepper.
- Patient AES-256 national ID key.
- Patient national ID lookup pepper.

Không commit .env hoặc *.pem.

## 5. Chạy toàn bộ bằng Docker

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker
~~~

Không build lại image:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker -NoBuild
~~~

Flow Docker:

1. Validate Docker và Compose.
2. Build image nếu không có NoBuild.
3. Start PostgreSQL.
4. Chờ Auth, Doctor và Patient database healthy.
5. Chạy auth-migrate.
6. Chạy doctor-migrate.
7. Chạy patient-migrate.
8. Start Auth, Doctor, Patient, Sample, Gateway và Frontend.

Kiểm tra:

~~~powershell
docker compose ps -a
~~~

Kỳ vọng:

- auth-migrate, doctor-migrate, patient-migrate: Exited (0).
- auth-database, doctor-database, patient-database: Up (healthy).
- auth-service, doctor-service, patient-service, sample-service, gateway, frontend: Up.

## 6. Chạy app local, database bằng Docker

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Local
~~~

Lệnh này start ba database, generate Prisma clients, migrate Auth/Doctor/Patient và chạy seed.

Trong mỗi terminal app phải load environment trước:

~~~powershell
cd D:\DATN_maternal_healthcare_support_system
. .\scripts\load-env.ps1
cd services
~~~

Auth:

~~~powershell
npm run start:dev -- auth-service
~~~

Doctor:

~~~powershell
npm run start:doctor:dev
~~~

Patient:

~~~powershell
npx nest start patient-service --watch
~~~

Sample:

~~~powershell
npm run start:dev -- sample-service
~~~

Do not use npm run start:prod for Patient/Doctor because the current generic script points to Auth. Use the explicit commands above.

## 7. Prisma commands thủ công

Từ services, sau khi load env:

~~~powershell
npm ci
npm run prisma:generate
npm run prisma:generate:doctor
npm run prisma:generate:patient
npm run prisma:migrate:deploy
npm run prisma:migrate:doctor
npm run prisma:migrate:patient
npm run prisma:seed
npm run prisma:seed:doctor
~~~

Doctor migration tạo các bảng doctors, doctor_profiles, specialties, doctor_specialties, doctor_schedules, doctor_availabilities, idempotency_records, audit_records và outbox_events.

## 8. Health check

~~~powershell
curl.exe -i http://localhost:5003/health
curl.exe -i http://localhost:5004/health
curl.exe -i http://localhost:5004/ready
curl.exe -i http://localhost:5005/health
curl.exe -i http://localhost:8080/health
~~~

Auth health qua Kong là /health, không phải /auth/health.

## 9. pgAdmin4

Auth:

~~~text
Host: localhost
Port: 5433
Database: auth
Username: auth
Password: AUTH_DB_PASSWORD trong .env
~~~

Doctor:

~~~text
Host: localhost
Port: 5435
Database: doctor
Username: doctor
Password: DOCTOR_DB_PASSWORD trong .env
~~~

Patient:

~~~text
Host: localhost
Port: 5434
Database: patient
Username: patient
Password: PATIENT_DB_PASSWORD trong .env
~~~

## 10. Troubleshooting Doctor

Nếu gặp relation public.specialties does not exist:

~~~powershell
docker compose ps -a doctor-migrate doctor-service
docker compose logs --no-color doctor-migrate
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker -NoBuild
~~~

Không cần xóa volume; doctor-migrate sẽ apply migration còn thiếu.

Nếu password database bị lỗi sau khi đổi .env, nhớ rằng PostgreSQL volume giữ password lúc init lần đầu. Không chạy down -v nếu cần giữ dữ liệu. Với local disposable mới, có thể chủ động chạy:

~~~powershell
docker compose down -v
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker
~~~

## 11. Security

- Không commit .env, private key hoặc token.
- Không dùng local secrets cho production.
- Không log JWT/password/national ID/raw PII.
- Không dùng User JWT thay internal service JWT.
- Mỗi service chỉ truy cập database của bounded context của mình.
- Compose đang publish database ports cho local debugging; production nên bỏ publish ports.

## 12. Verification checklist

~~~powershell
docker compose config --quiet
docker compose ps -a
docker compose logs --no-color --tail 100 doctor-migrate
curl.exe -i http://localhost:5004/ready
curl.exe -i http://localhost:5005/health
~~~
