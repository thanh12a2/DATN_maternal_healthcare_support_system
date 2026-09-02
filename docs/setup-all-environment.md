# Setup toàn bộ môi trường và services

Tài liệu này hướng dẫn setup và chạy Auth, Doctor, Receptionist, Patient, Sample, Kong và Frontend bằng Docker hoặc chạy các NestJS app local với PostgreSQL trong Docker.

## 1. Yêu cầu

- Docker Desktop và Docker Compose v2.
- Node.js 22 khuyến nghị.
- npm và PowerShell.
- pgAdmin4/Postman tùy nhu cầu.

Kiểm tra:

```powershell
docker version
docker compose version
node --version
npm --version
```

## 2. Port local

| Thành phần | URL/port |
|---|---|
| Frontend | http://localhost:3000 |
| Kong proxy | http://localhost:8080 |
| Kong Admin/Manager | http://localhost:8001 / 8002 |
| Auth API | http://localhost:5003 |
| Doctor API | http://localhost:5005 |
| Receptionist API | http://localhost:5006 |
| Patient API | http://localhost:5004 |
| Sample API | http://localhost:5001 |
| Auth PostgreSQL | localhost:5433 |
| Doctor PostgreSQL | localhost:5435 |
| Receptionist PostgreSQL | localhost:5436 |
| Patient PostgreSQL | localhost:5434 |

Trong Docker network dùng hostname service và port PostgreSQL 5432. Từ Windows/pgAdmin dùng localhost và host port ở bảng trên.

## 3. Script setup

### 3.1. Chỉ chuẩn bị .env và keys

```powershell
cd D:\DATN_maternal_healthcare_support_system
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode PrepareOnly
```

Script tạo hoặc bổ sung .env, Auth RSA key pair, Patient internal RSA key pair, database secrets, Auth refresh pepper, Patient AES key và Patient lookup pepper. Script không tạo account Receptionist, không xóa volume và không chạy `docker compose down -v`.

### 3.2. Chạy toàn bộ bằng Docker

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker
```

Không build lại image:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker -NoBuild
```

Flow:

1. Kiểm tra Docker và Compose.
2. Build image nếu không có `-NoBuild`.
3. Start Auth, Doctor, Receptionist và Patient PostgreSQL.
4. Chờ database healthy.
5. Chạy `auth-migrate`, `doctor-migrate`, `receptionist-migrate`, `patient-migrate`.
6. Chỉ start các app sau khi migration tương ứng exit code 0.
7. Start Auth, Doctor, Receptionist, Patient, Sample, Gateway và Frontend.

Kiểm tra:

```powershell
docker compose ps -a
```

Migration job hợp lệ có trạng thái `Exited (0)`. App/database chính phải `Up`, database phải `healthy` nếu có healthcheck.

### 3.3. Chạy app local, database bằng Docker

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Local
```

Lệnh này start bốn database, generate Prisma clients, migrate Auth/Doctor/Receptionist/Patient và seed Auth roles/Doctor seed.

Trong mỗi terminal chạy app, nạp env trước:

```powershell
cd D:\DATN_maternal_healthcare_support_system
. .\scripts\load-env.ps1
cd services
```

Auth:

```powershell
npm run start:dev -- auth-service
```

Doctor:

```powershell
npm run start:doctor:dev
```

Receptionist:

```powershell
npm run start:receptionist:dev
```

Patient:

```powershell
npx nest start patient-service --watch
```

Sample:

```powershell
npm run start:dev -- sample-service
```

## 4. Prisma commands thủ công

Từ thư mục `services`, sau khi load env:

```powershell
npm ci
npm run prisma:generate
npm run prisma:generate:doctor
npm run prisma:generate:receptionist
npm run prisma:generate:patient

npm run prisma:migrate:deploy
npm run prisma:migrate:doctor
npm run prisma:migrate:receptionist
npm run prisma:migrate:patient

npm run prisma:seed
npm run prisma:seed:doctor
```

Doctor và Receptionist đều sở hữu database/schema riêng. Không truy cập database của service khác.

## 5. Health checks

```powershell
curl.exe -i http://localhost:5003/health
curl.exe -i http://localhost:5004/health
curl.exe -i http://localhost:5004/ready
curl.exe -i http://localhost:5005/health
curl.exe -i http://localhost:5006/health
curl.exe -i http://localhost:8080/health
```

Auth health qua Kong là `/health`, không phải `/auth/health`.

## 6. pgAdmin4

Auth:

```text
Host: localhost
Port: 5433
Database: auth
Username: auth
Password: AUTH_DB_PASSWORD trong .env
```

Doctor:

```text
Host: localhost
Port: 5435
Database: doctor
Username: doctor
Password: DOCTOR_DB_PASSWORD trong .env
```

Receptionist:

```text
Host: localhost
Port: 5436
Database: receptionist
Username: receptionist
Password: RECEPTIONIST_DB_PASSWORD trong .env
```

Patient:

```text
Host: localhost
Port: 5434
Database: patient
Username: patient
Password: PATIENT_DB_PASSWORD trong .env
```

## 7. Troubleshooting

### `relation public.specialties does not exist`

Doctor migration chưa chạy hoặc database đang dùng volume cũ chưa có migration:

```powershell
docker compose ps -a doctor-migrate doctor-service
docker compose logs --no-color doctor-migrate
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker -NoBuild
```

### Receptionist service không start

Kiểm tra port và migration:

```powershell
docker compose ps -a receptionist-database receptionist-migrate receptionist-service
docker compose logs --no-color receptionist-migrate receptionist-service
```

Receptionist app dùng 5006, database host dùng 5436. Doctor vẫn dùng 5005/5435.

### Đổi database password

PostgreSQL volume giữ password lúc init lần đầu. Đổi password trong .env không tự đổi password role trong volume. Nếu cần giữ dữ liệu, phải đổi password role trong PostgreSQL; nếu là local disposable mới có thể chủ động dùng `docker compose down -v` rồi setup lại.

## 8. Reset local data

Chỉ chạy khi chấp nhận xóa dữ liệu local:

```powershell
docker compose down -v
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode Docker
```

Lệnh này xóa volume Kong, Auth, Doctor, Receptionist và Patient.

## 9. Security

- Không commit .env hoặc private key.
- Không dùng local secrets cho production.
- Không log password, JWT, national ID hoặc raw PII.
- Không dùng User JWT thay internal service JWT.
- Compose local publish database ports để debug; production nên bỏ publish ports.

## 10. Verification checklist

```powershell
docker compose config --quiet
docker compose ps -a
docker compose logs --no-color --tail 100 receptionist-migrate
curl.exe -i http://localhost:5006/health
curl.exe -i http://localhost:5005/health
curl.exe -i http://localhost:5004/ready
```
