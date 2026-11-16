# Bước 3: retrieval danh mục đúng dữ liệu hệ thống

Triển khai local ngày 16/11/2026. Mã tìm kiếm nằm trong `D:/rag-phu-san-chatbot/src/catalog_schema.py`, `src/catalog_search.py`; `web_app.py` điều hướng sau Safety Gate. DATN chỉ bổ sung DTO và thẻ danh mục trên widget bệnh nhân. Không sửa schema, migration, seed, AppointmentStatus, BookingChannel hay luồng đặt lịch.

## Luồng chat

1. Server xác thực và đọc phiên như bước 1; Safety Gate bước 2 chạy trước mọi tìm kiếm.
2. Nhu cầu tìm khoa/dịch vụ đi vào tìm kiếm danh mục. Câu hỏi kiến thức thai kỳ tiếp tục RAG y khoa cũ có guard đầu ra.
3. Tìm kiếm chọn ứng viên bằng từ khóa có trọng số trên dữ liệu API; đối chiếu API hiện hành trước khi trả tên/ID.
4. Có kết quả: hiển thị tên thật, khoa thật, nguồn danh mục và liên kết trang chi tiết hiện có. Thiếu kết quả: hỏi rõ/hướng dẫn liên hệ tiếp đón. API lỗi: trả chưa xác minh được, không dùng thẻ cũ.
5. Lưu metadata danh mục cùng tin nhắn để tải lại trang vẫn hiển thị nguồn. Gửi lại cùng requestId ở nhánh danh mục phải đối chiếu dữ liệu mới, thay cặp tin nhắn cũ, giữ ID và turnCount; không nhân đôi lượt.

Đây là retrieval từ danh mục và phản hồi theo mẫu, chưa phải graph nhiều bước hay model tự gọi công cụ. Không tạo bác sĩ, giá, slot hoặc giữ chỗ; `actions=[]` và tool policy vẫn chặn công cụ đặt lịch.

## Ánh xạ schema đã kiểm chứng

- Nguồn dịch vụ: `services/prisma/catalog/schema.prisma`, bảng `medical_services` trong catalog DB. API dùng camelCase: `specialtyId` tương ứng `specialty_id`, `bookingEnabled` tương ứng `booking_enabled`, `durationMinutes` tương ứng `duration_minutes`, `doctorRankSelectionPolicy` tương ứng `doctor_rank_selection_policy`, `updatedAt` tương ứng `updated_at`.
- Giữ nguyên `id` UUID, `code`, `slug`, `name`, `summary`, `description`, `kind`, `status`, `version` và các thuộc tính trên. Boolean phải là boolean thật. `durationMinutes` nullable, không tự điền thời lượng; `specialtyId` nullable trong DB nhưng ứng viên dịch vụ thiếu liên kết khoa sẽ bị loại.
- `doctorRankSelectionPolicy` giữ đúng enum `NOT_REQUIRED`, `BASIC_INCLUDED`, `RANK_UPGRADE_ALLOWED`; không đổi thành chế độ booking do Agent tự suy diễn.
- Nguồn khoa: `services/prisma/doctor/schema.prisma`, bảng `specialties` trong doctor DB. Có `id/code/slug/name/description/overview/status/updatedAt`; **không có cột version**, không thêm version giả vào Specialty. `slug` DB nullable; API có thể sinh slug khi thiếu.
- Quan hệ khoa–dịch vụ là UUID liên DB qua `MedicalService.specialtyId`, không phải Prisma FK nội bộ catalog. Chỉ ghép bằng ID với danh sách khoa ACTIVE từ doctor-service. Bỏ qua `specialty` tổng hợp/cache/fallback trong API catalog.
- Tags là quan hệ `MedicalServiceTag -> CatalogTag`. Public API trả tags đã làm phẳng và không trả tag.updatedAt; không tạo timestamp giả. `categories:[]` là trường presenter cũ, không phải quan hệ DB dùng để điều hướng.
- JSON dịch vụ giữ snake_case thật: `schema_version`, `suitable_for`, `notice.type`, `package.needs_confirmation`. JSON `Specialty.overview` dùng camelCase: `scopeOfCare`, `diagnostics`, `treatments`.

## API và điều kiện hợp lệ

- `GET /api/catalog/services?page=1&limit=100`: `{data:[],meta:{page,limit,total}}`; phân trang theo total, kiểm tra trùng ID và schema.
- `GET /api/catalog/services/{UUID}`: đọc lại từng ứng viên, bắt buộc ID trả về trùng ID yêu cầu. Không nhận URL nguồn từ người dùng/model.
- `GET /api/doctors/specialties?limit=100`: `{data:[],meta:{nextCursor,limit,...}}`. Endpoint hiện chưa hỗ trợ phân trang thật; nếu đạt 100 bản ghi hoặc có nextCursor thì từ chối snapshot thiếu, cần nâng API khi mở rộng.
- Dịch vụ chỉ hiển thị nếu ACTIVE, bookingEnabled=true, specialtyId trỏ đúng khoa ACTIVE; loại notice `COMING_SOON`, `TEMP_SUSPENDED`, `DISCONTINUED`. Trạng thái được kiểm tra lại dù index còn bản cũ.
- Giá, bác sĩ và lịch trống chưa thuộc bước này. Trang chi tiết dùng `/dich-vu/{slug}` hoặc `/chuyen-khoa/{slug}`.

## Index, nguồn và chất lượng dữ liệu

Danh mục hiện có 20 dịch vụ/5 khoa. Index lexical có trọng số được chọn cho phạm vi nhỏ này; chưa dùng embedding/vector DB cho danh mục. Corpus y khoa và Qdrant hiện có được giữ riêng. Không thêm danh mục trùng trong DB nghiệp vụ.

Cache dẫn xuất `data/private/catalog_index.json` có indexVersion=`hospital-catalog-1.0.0`, SHA256 contentHash và indexedAt; refresh tối đa mỗi 5 phút hoặc khởi động lại. Không đọc lại cache đĩa khi khởi động để phục vụ như nguồn dự phòng. Khoa và ứng viên dịch vụ đều được kiểm tra live trước trả kết quả. Dịch vụ mới có thể cần tới chu kỳ refresh để xuất hiện.

DTO nguồn có `sourceType=hospital_catalog`, `sourcePath`, `sourceId`, `updatedAt`, `indexedAt`, `verifiedAt`, `indexVersion`, `contentHash`, `fieldsUsed`. Đây là metadata của retrieval, không phải cột DB mới. `clinicalEvidence=false`; `citations` y khoa được giữ riêng. `contentHash` mô tả snapshot index, còn verifiedAt mô tả lần kiểm tra live, không phải bằng chứng snapshot và DB luôn đồng nhất tại mọi thời điểm.

SQL read-only xác nhận **20/20 content.review đang DRAFT và needs_medical_review=true**. Public presenter không trả review. Agent chỉ dùng trường mô tả/intro/suitable_for để xếp hạng tìm kiếm, không trích FAQ trả lời, chống chỉ định hay cảnh báo seed thành kết luận y khoa. Các thẻ chỉ hiển thị danh tính nguồn và định hướng tham khảo.

Hai gói sinh hiện có `content.package.needs_confirmation=true`; DTO `requiresStaffConfirmation` là cờ suy ra để hiển thị lời nhắc, không phải cột DB mới, trạng thái lịch mới hay bước duyệt mới trong booking.

Tìm kiếm hiện bảo thủ: câu không khớp có thể yêu cầu nói rõ tên/mục đích, không bảo đảm hiểu mọi cách nói triệu chứng. Bộ test chỉ chứng minh các fixture kỹ thuật đã chạy; chưa thay thế đánh giá lâm sàng hoặc benchmark độc lập rộng hơn.

## Cấu hình và kiểm thử

RAG cần biến môi trường `CATALOG_API_BASE_URL=http://127.0.0.1:8080` (mặc định); `.env.chat.example` là mẫu, không tự nạp. Có thể đổi `CATALOG_INDEX_PATH`; chỉ cấu hình phía server. Hiện chạy một process như yêu cầu lưu hội thoại SQLite của bước 1.

Xem [báo cáo và cách kiểm thử](../testing/agent-step3-2026-11-16/README.md). Dữ liệu hiện có đủ để triển khai bước 3; chưa cần thêm cột hoặc seed. Nội dung y khoa cần được chuyên môn duyệt trước khi dùng để tư vấn sâu.
