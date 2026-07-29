# Hướng dẫn setup 1 microservice mới trong monorepo NestJS

Tài liệu này hướng dẫn cách thêm một microservice mới vào thư mục services theo cấu trúc monorepo NestJS hiện có trong dự án.

## 1. Cài đặt NestJS CLI

Nếu chưa cài đặt, chạy lệnh sau ở terminal:

```bash
npm install -g @nestjs/cli
```

Kiểm tra xem đã cài thành công chưa:

```bash
nest --version
```

## 2. Vào thư mục monorepo services

```bash
cd services
```

Nếu chưa cài dependency cho project:

```bash
npm install
```

## 3. Tạo microservice mới bằng Nest CLI

Giả sử bạn muốn tạo một service tên là appointment-service:

```bash
nest generate app appointment-service
```

Lệnh này sẽ tạo thư mục mới trong cấu trúc:

```text
services/apps/appointment-service/
```

Và các file chuẩn của một Nest application như:

- apps/appointment-service/src/main.ts
- apps/appointment-service/src/app.module.ts
- apps/appointment-service/src/app.controller.ts
- apps/appointment-service/src/app.service.ts

## 4. Chạy microservice mới

Để chạy service vừa tạo:

```bash
npm run start -- appointment-service
```

Hoặc dùng Nest CLI trực tiếp:

```bash
nest start appointment-service
```

Nếu muốn chạy ở chế độ watch:

```bash
npm run start:dev -- appointment-service
```

## 5. Cấu trúc thư mục sau khi tạo

Sau khi tạo, project sẽ có dạng như sau:

```text
services/
  apps/
    auth-service/
    services/
    appointment-service/
```

Trong đó:
- auth-service: service hiện có
- services: service gốc mặc định
- appointment-service: service mới bạn vừa thêm

## 6. Thêm file test cho service mới

Nếu muốn tạo test cho service mới:

```bash
nest generate test appointment-service
```

## 7. Mẹo khi đặt tên service

Nên dùng tên ngắn, rõ nghĩa và thống nhất theo chuẩn:

```text
user-service
appointment-service
payment-service
notification-service
```

## 8. Ví dụ thực tế

Ví dụ tạo service cho bệnh nhân:

```bash
cd services
nest generate app patient-service
npm run start -- patient-service
```

## 9. Lưu ý quan trọng

- Mỗi microservice nên có tên riêng và độc lập.
- Nếu service mới cần giao tiếp với service khác, hãy dùng tên service trong Docker Compose DNS hoặc cấu hình mạng nội bộ.
- Nếu có thay đổi API, nên cập nhật OpenAPI spec trong thư mục docs/api-specs.
- Nếu chạy trong Docker, nên thêm service mới vào file docker-compose.yml.

## 10. Gợi ý workflow chuẩn

```bash
cd services
npm install
npm install -g @nestjs/cli
nest generate app <ten-service>
npm run start -- <ten-service>
```


