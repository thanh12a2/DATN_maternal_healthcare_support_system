# Chạy lần đầu

> **Nguồn lệnh duy nhất:** xem [`README.md`](../README.md). Không copy các command setup từ tài liệu cũ trong file này.

README mô tả đầy đủ:

- prerequisites;
- tạo `.env`, keys và secrets;
- chạy Docker hoặc Local;
- load environment khi chạy app local;
- health check, seed, build/test và dừng hệ thống.

## Lưu ý an toàn

- Không commit `.env` hoặc `scripts/keys/*.pem`.
- Không dùng `docker compose down -v` nếu chưa chấp nhận xóa dữ liệu local.
- Nếu `.env` có kích thước bất thường hoặc chứa ký tự rác, chạy lại `setup.ps1 -Mode PrepareOnly`; script sẽ backup file hỏng và tạo lại từ `.env.example`.

Các phần troubleshooting/architecture chi tiết nằm trong `docs/` và không thay thế command canonical trong README.
