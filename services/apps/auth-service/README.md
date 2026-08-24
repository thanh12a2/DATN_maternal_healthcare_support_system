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

Bước foundation hiện tại mới chuẩn bị nền tảng bảo mật cho các phase auth tiếp theo, chưa implement register/login/JWT/refresh token/database.

### Dependencies đã thêm

- `@nestjs/config`: chuẩn bị quản lý cấu hình qua environment variables cho JWT, database, token TTL, key/secret ở các phase sau.
- `class-validator`: validate DTO input như email, password length và role.
- `class-transformer`: hỗ trợ NestJS `ValidationPipe` transform request payload vào DTO class.
- `argon2`: hash password bằng Argon2id theo target architecture.

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
  - `role`: một trong `PATIENT`, `RECEPTIONIST`, `DOCTOR`, `NURSE`, `ADMIN`.
- `LoginDto`
  - `email`: email hợp lệ.
  - `password`: string, tối thiểu 8 ký tự.

Auth Service bootstrap đã bật global `ValidationPipe` với:

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `transform: true`

## Lợi ích kiến trúc

Kiến trúc này được dùng rất phổ biến vì vừa giảm độ trễ, vừa tránh việc Authentication Service trở thành nút thắt hiệu năng cho toàn bộ hệ thống. Đồng thời, việc tách riêng xác thực tập trung giúp hệ thống dễ mở rộng, dễ vận hành và dễ bảo trì hơn.
