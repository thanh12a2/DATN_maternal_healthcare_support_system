# Maternal Healthcare Support System

Hệ thống hỗ trợ chăm sóc sức khỏe thai phụ theo kiến trúc microservice: React/Vite, Kong API Gateway, NestJS services, PostgreSQL theo bounded context, RabbitMQ và Prisma.

> **Nguồn lệnh duy nhất:** mọi hướng dẫn config, chuẩn bị môi trường và chạy server nằm trong file này. Các tài liệu khác chỉ mô tả kiến trúc, contract hoặc troubleshooting.

## 1. Yêu cầu

- Docker Desktop và Docker Compose v2.
- Node.js 22+ và npm.
- PowerShell trên Windows.
- Git.

Kiểm tra:

```powershell
docker version
docker compose version
node --version
npm --version
git --version
```

## 2. Cấu hình và chạy lần đầu

Đứng tại thư mục gốc repository. Chỉ thực hiện phần này khi clone project lần đầu, khi chưa có `.env`, hoặc khi muốn tạo lại local configuration.

### 2.1. Cấu hình lần đầu và chạy toàn bộ bằng Docker

Lệnh khuyến nghị cho máy development mới:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Mode Docker -SeedDemo
```

Script sẽ:

1. Tạo `.env` từ `.env.example`.
2. Sinh RSA keys và local secrets trong `scripts/keys/`.
3. Validate Docker Compose.
4. Build image và khởi động toàn bộ stack.
5. Chạy các migration service.
6. Seed dữ liệu demo nếu có `-SeedDemo`.

Nếu muốn cấu hình nhưng chưa chạy Docker:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Mode PrepareOnly
```

Sau đó có thể khởi động stack bằng lệnh ở [mục 3](#3-chạy-các-lần-sau).

### 2.2. Cấu hình lần đầu theo menu

Nếu muốn chọn Docker, Local hoặc chỉ chuẩn bị config:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

Các lựa chọn:

- `Docker`: build và chạy toàn bộ stack.
- `Local`: chạy PostgreSQL bằng Docker, app NestJS chạy bằng Node trên máy host.
- `PrepareOnly`: chỉ tạo/cập nhật `.env`, key và secret.

### 2.3. Cấu hình lần đầu với Local mode

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Mode Local
```

Lệnh này khởi động các database cần thiết, generate Prisma client, chạy migration và seed dữ liệu nền. Sau khi hoàn tất, chạy app local theo [mục 6](#6-chạy-app-local-sau-khi-chọn-local).

Không gọi `scripts/setup-local.ps1` trực tiếp trong workflow mới. File này là implementation nội bộ được `setup.ps1` gọi để tương thích.

## 3. Chạy các lần sau

### 3.1. Stack Docker đã được tạo trước đó

Nếu các container đã tồn tại và chỉ đang dừng, dùng:

```powershell
docker compose start
```

Nếu cần bảo đảm các service được tạo/khởi động nhưng **không build lại image**, dùng:

```powershell
docker compose up -d
```

Kiểm tra trạng thái:

```powershell
docker compose ps -a
```

Xem log gateway:

```powershell
docker compose logs -f gateway
```

### 3.2. Khi source code, Dockerfile hoặc dependency thay đổi

Build lại image rồi khởi động:

```powershell
docker compose up -d --build
```

Không cần chạy lại `setup.ps1` chỉ vì muốn start server lần nữa. Không chạy lại migration thủ công nếu Docker Compose đã quản lý migration service.

### 3.3. Dừng và chạy lại hệ thống

Dừng container nhưng giữ volume/database:

```powershell
docker compose down
```

Sau đó chạy lại:

```powershell
docker compose up -d
```

Không dùng `docker compose down -v` trừ khi chủ động xóa toàn bộ dữ liệu local.

## 4. Environment và secrets

- `.env.example` là template được commit.
- `.env` là local-only và bị ignore.
- Key được sinh trong `scripts/keys/` và bị ignore.
- Không commit password, JWT private key, pepper, SMTP credential hoặc database secret.
- Nếu `.env` bị hỏng hoặc lớn bất thường, setup script sẽ lưu bản cũ thành `.env.corrupt.<timestamp>` rồi tạo lại từ `.env.example`.
- Không sửa trực tiếp private key PEM thành nhiều dòng trong `.env`; script tự encode newline thành `\n`.

Sau `PrepareOnly`, có thể chỉnh SMTP trong `.env` nếu cần password reset:

```env
AUTH_SMTP_HOST=smtp.example.com
AUTH_SMTP_PORT=587
AUTH_SMTP_SECURE=false
AUTH_SMTP_USER=<smtp-user>
AUTH_SMTP_PASSWORD=<smtp-password>
AUTH_EMAIL_FROM=no-reply@example.com
```

Trong Docker, SMTP host phải truy cập được từ container; không dùng `localhost` cho SMTP chạy ngoài container.

## 5. Port mặc định

| Thành phần | Port |
|---|---:|
| Frontend | 3000 |
| Kong proxy | 8080 |
| Kong Admin / Manager | 8001 / 8002 |
| Auth | 5003 |
| Patient | 5004 |
| Doctor | 5005 |
| Receptionist | 5006 |
| Catalog | 5007 |
| Appointment | 5008 |
| Billing | 5009 |
| Medical Record | 5011 |
| Queue | 5012 |
| Document | 5013 |
| Prescription | 5014 |
| Treatment Plan | 5015 |
| Notification | 5016 |
| Audit Log | 5017 |
| Reporting | 5018 |
| Consultation | 5019 |
| RabbitMQ Management | 15672 |

## 6. Chạy app local sau khi chọn `Local`

### Lần đầu sau khi cấu hình Local

Lệnh `setup.ps1 -Mode Local` đã tạo database, generate Prisma client và chạy migration. Mở terminal mới tại thư mục gốc rồi load environment:

```powershell
. .\scripts\load-env.ps1
cd services
```

### Các lần sau

Nếu database container đang dừng, bật lại:

```powershell
docker compose start auth-database doctor-database receptionist-database patient-database
```

Nếu container chưa tồn tại, dùng:

```powershell
docker compose up -d auth-database doctor-database receptionist-database patient-database
```

Không cần chạy lại migration mỗi lần khởi động app. Chỉ chạy lại `setup.ps1 -Mode Local` khi thay đổi cấu hình database, migration hoặc muốn tái tạo local setup.

Trong **mỗi terminal chạy app**, load environment rồi chuyển vào `services`:

```powershell
. .\scripts\load-env.ps1
cd services
```

Các lệnh chạy service:

```powershell
npm.cmd run start:dev -- auth-service
npm.cmd run start:doctor:dev
npm.cmd run start:receptionist:dev
npx nest start patient-service --watch
npm.cmd run start:dev -- sample-service
```

Các service còn lại ưu tiên chạy bằng Docker Compose để bảo đảm đúng dependency, network và gRPC target.

## 7. Kiểm tra, seed và dừng

```powershell
# Validate compose
docker compose config --quiet

# Trạng thái và log
docker compose ps -a
docker compose logs -f gateway

# Health checks
curl.exe -i http://localhost:8080/health
curl.exe -i http://localhost:3000
curl.exe -i http://localhost:5003/health
curl.exe -i http://localhost:5004/health
curl.exe -i http://localhost:5005/health

# Seed demo (idempotent)
cd services
npm.cmd run prisma:seed:demo
cd ..

# Dừng, giữ nguyên volume
docker compose down
```

Không dùng `docker compose down -v` nếu chưa chấp nhận xóa toàn bộ dữ liệu local.

Tài khoản demo mặc định dùng password `Demo@123456`:

- Patient: `demo.patient@antam.local`
- Doctor: `demo.doctor@antam.local`
- Receptionist: `demo.receptionist@antam.local`
- Admin: `demo.admin@antam.local`

## 8. Build và test

```powershell
cd frontend
npm.cmd ci
npm.cmd run test
npm.cmd run build

cd ..\services
npm.cmd ci
npm.cmd run build
npm.cmd test -- --runInBand
cd ..
```

## 9. Makefile shortcuts

Các lệnh Makefile chỉ là shortcut cho flow trong README:

```powershell
make init
make validate
make up-d
make status
make logs
make down
make seed-demo
```

Trên Windows có thể chạy trực tiếp các lệnh PowerShell/Docker ở trên nếu không cài `make`.

## 10. Tài liệu tham khảo

- [Kiến trúc hệ thống](docs/system_design.md)
- [API specifications và Kong config](docs/api-specs/)
- [Service contracts index](docs/service-contracts-index.md)
- [Gateway notes](gateway/readme.md)
- [Tài liệu tích hợp](docs/integration/)

Các file `docs/first-run.md` và `docs/setup-all-environment.md` không còn chứa command setup riêng; hãy quay lại README này để tránh chạy theo hướng dẫn đã lỗi thời.
