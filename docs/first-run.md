# Hướng dẫn chạy lần đầu

Tài liệu này dành cho máy development mới trên Windows. Không reset Docker volume trong quy trình thông thường.

## 1. Cài prerequisites

Cài và kiểm tra:

```powershell
docker version
docker compose version
node --version
npm --version
git --version
```

Bật Docker Desktop và chờ Linux engine ở trạng thái Running.

## 2. Clone và tạo environment

```powershell
git clone <repository-url>
cd D:\DATN_maternal_healthcare_support_system
Copy-Item .env.example .env
```

Không copy `.env.bak`. Không commit `.env` hoặc file `*.pem`.

## 3. Chuẩn bị key và secret local

Chạy:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode PrepareOnly
```

Script sẽ giữ cấu hình đã có và có thể tạo local:

- Auth RSA key pair.
- Internal JWT key pair.
- Refresh/password-reset pepper.
- Patient encryption/lookup key.

SMTP không bắt buộc cho login cơ bản. Chỉ cấu hình `AUTH_SMTP_*` nếu cần test password reset.

## 4. Validate và start stack

```powershell
docker compose config --quiet
docker compose up -d --build
```

Migration containers là job one-shot và phải kết thúc với exit code `0`.

Kiểm tra:

```powershell
docker compose ps -a
docker compose logs --tail 100 gateway
```

Không dùng:

```powershell
docker compose down -v
```

trừ khi chấp nhận xóa toàn bộ dữ liệu local.

## 5. Kiểm tra health

```powershell
curl.exe -i http://localhost:8080/health
curl.exe -i http://localhost:3000
curl.exe -i http://localhost:5003/health
curl.exe -i http://localhost:5004/health
curl.exe -i http://localhost:5005/health
curl.exe -i http://localhost:5007/health
```

Kỳ vọng Gateway/service health trả HTTP `200`.

## 6. Seed dữ liệu demo

Sau khi stack/database đã healthy:

```powershell
cd services
npm.cmd run prisma:seed:demo
```

Nếu chạy seed từ host và database port local bị resolve lỗi, seed script đã dùng `127.0.0.1` mặc định. Có thể override từng `*_DATABASE_URL` nếu môi trường khác.

Seed không chạy migration và không xóa dữ liệu. Dữ liệu demo dùng UUID cố định và `upsert`.

## 7. Mở frontend

Mở:

```text
http://localhost:3000
```

Tài khoản demo:

```text
Patient:      demo.patient@antam.local / Demo@123456
Doctor:       demo.doctor@antam.local / Demo@123456
Receptionist: demo.receptionist@antam.local / Demo@123456
Admin:        demo.admin@antam.local / Demo@123456
```

Nếu trình duyệt giữ bundle cũ, dùng `Ctrl+F5`.

## 8. Chạy test/build local

```powershell
cd frontend
npm.cmd ci
npm.cmd run test
npm.cmd run build

cd ..\services
npm.cmd ci
npm.cmd run build
npm.cmd test -- --runInBand
```

## 9. Dừng hệ thống

```powershell
docker compose down
```

Lệnh này giữ volume. Không dùng `-v` nếu muốn bảo toàn database local.

## 10. Troubleshooting

### Docker daemon không kết nối

Bật Docker Desktop, chờ Linux engine ready rồi chạy:

```powershell
docker info
docker compose ps
```

### Migration failed

```powershell
docker compose ps -a
docker compose logs <migration-service>
```

Không reset volume ngay; xác định migration lỗi trước.

### Port đã được sử dụng

Kiểm tra port, sau đó đổi biến tương ứng trong `.env`, ví dụ `FRONTEND_PORT`, `GATEWAY_PORT`, hoặc `*_DB_PORT`.

### Frontend không gọi được API

Kiểm tra:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Sau khi đổi biến Vite, cần rebuild frontend:

```powershell
docker compose up -d --build frontend
```

### Seed không kết nối database

Đảm bảo database container healthy:

```powershell
docker compose ps
```

Từ host dùng các port publish trong `.env`; trong container dùng hostname service và port `5432`.
