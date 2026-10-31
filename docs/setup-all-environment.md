# Setup toàn bộ môi trường

> **Nguồn lệnh duy nhất:** xem [`README.md`](../README.md). File này không duy trì command setup/run riêng để tránh lệch giữa tài liệu và implementation.

README là tài liệu canonical cho:

- setup bằng `scripts/setup.ps1`;
- tạo và sửa `.env`;
- chạy Docker hoặc Local;
- chạy service local sau khi database sẵn sàng;
- health check, seed, build/test và dừng stack.

## Phạm vi kiến trúc

Mỗi service sở hữu database/bounded context riêng. Không truy cập database nội bộ của service khác. Frontend đi qua Kong Gateway; service-to-service communication dùng các contract gRPC/event hiện có.

## Troubleshooting

Khi gặp lỗi, ưu tiên kiểm tra theo thứ tự:

```powershell
docker compose config --quiet
docker compose ps -a
docker compose logs --no-color --tail 100 <service>
```

Không reset volume ngay khi migration lỗi. Chỉ dùng `docker compose down -v` khi chủ động xóa dữ liệu local.
