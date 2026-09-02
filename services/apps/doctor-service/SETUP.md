# Doctor Service Setup Guide

## 1. Yêu cầu

- Node.js/npm
- Docker Desktop và Docker Compose
- Auth public key nếu gọi business API

## 2. Tạo env

Từ root:

```powershell
copy .env.example .env
```

Các biến Doctor mặc định:

```env
DOCTOR_SERVICE_PORT=5005
DOCTOR_SERVICE_INTERNAL_PORT=5005
DOCTOR_DB_NAME=doctor
DOCTOR_DB_USER=doctor
DOCTOR_DB_PASSWORD=doctorpass
DOCTOR_DB_PORT=5435
DOCTOR_DATABASE_URL=postgresql://doctor:doctorpass@localhost:5435/doctor?schema=public
DOCTOR_TIMEZONE=Asia/Bangkok
DOCTOR_MAX_AVAILABILITY_RANGE_DAYS=31
```

## 3. Chạy Doctor Database

```powershell
docker compose up -d doctor-database
docker compose ps doctor-database
```

Đợi trạng thái `healthy`.

## 4. Prisma generate/migrate/seed

```powershell
cd D:\DATN_maternal_healthcare_support_system\services
$env:DOCTOR_DATABASE_URL="postgresql://doctor:doctorpass@localhost:5435/doctor?schema=public"
$env:AUTH_ACCOUNT_LOOKUP_URL="http://localhost:5003/internal/accounts"
$env:INTERNAL_SERVICE_AUTH_SECRET="local-dev-internal-secret"
npm.cmd run prisma:generate:doctor
npm.cmd run prisma:migrate:doctor
npm.cmd run prisma:seed:doctor
```

Seed hiện không tạo specialty mặc định vì specification không chỉ định dữ liệu ban đầu.

Các bảng sau migration:

```text
doctors
doctor_profiles
specialties
doctor_specialties
doctor_schedules
doctor_availabilities
idempotency_records
audit_records
outbox_events
```

## 5. Kết nối pgAdmin/DBeaver

```text
Host:     localhost
Port:     5435
Database: doctor
Username: doctor
Password: doctorpass
```

Trong Docker network, app dùng:

```text
Host: doctor-database
Port: 5432
```

Không dùng `localhost` trong connection string của container.

## 6. Chạy service

Local:

```powershell
$env:PORT=5005
$env:DOCTOR_DATABASE_URL="postgresql://doctor:doctorpass@localhost:5435/doctor?schema=public"
cd D:\DATN_maternal_healthcare_support_system\services
npm.cmd run start:doctor
```

Docker:

```powershell
cd D:\DATN_maternal_healthcare_support_system
docker compose up doctor-service --build
```

## 7. Postman

Health không cần token:

```http
GET http://localhost:5005/health
GET http://localhost:8080/api/doctors/health
```

Business API direct service:

```http
POST http://localhost:5005/doctors
```

Qua Kong:

```http
POST http://localhost:8080/api/doctors/doctors
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer <Auth access token>
Idempotency-Key: <UUID>
```

Body mẫu theo specification:

```json
{
  "accountId": "9b48cdea-a468-4d83-9807-e0f96707eec8",
  "licenseNumber": "VN-OB-012345",
  "profile": {
    "fullName": "Nguyen Thi An",
    "professionalTitle": "BS.CKI",
    "biography": "Bac si chuyen khoa san.",
    "practiceStartYear": 2015,
    "languages": ["vi"],
    "photoUrl": "https://cdn.example.test/doctors/doctor-id.jpg"
  }
}
```

Response thành công dự kiến:

```json
{
  "data": {
    "id": "uuid",
    "accountId": "uuid",
    "licenseNumber": "VN-OB-012345",
    "status": "DRAFT",
    "version": 1
  }
}
```

Lưu ý: request create/activate gọi Auth Service qua `AUTH_ACCOUNT_LOOKUP_URL` và header `x-internal-service-secret`. Auth và Doctor phải dùng cùng `INTERNAL_SERVICE_AUTH_SECRET`; sau khi cập nhật code, cần restart cả hai process. Nếu lookup/secret không hoạt động, request sẽ trả `503 DEPENDENCY_UNAVAILABLE`.

## 8. Kiểm tra dữ liệu sau API

Trong pgAdmin/DBeaver chạy:

```sql
SELECT id, account_id, license_number, status, version FROM doctors;
SELECT * FROM doctor_profiles;
SELECT * FROM specialties;
SELECT * FROM audit_records ORDER BY created_at DESC;
SELECT id, event_type, status, attempts FROM outbox_events ORDER BY created_at DESC;
```

Không thấy bảng appointment/patient/medical-record trong Doctor Database là đúng boundary.

## 9. Kong route import

Kong import `docs/api-specs/kong.yml` khi database Kong bootstrap lần đầu. Nếu `kong-data` đã tồn tại, cần tạo route bằng Kong Admin API/Manager hoặc reset local volume theo hướng dẫn Gateway. Không reset volume có dữ liệu quan trọng.
