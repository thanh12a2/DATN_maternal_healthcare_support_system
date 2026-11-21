# Bước 4 — Công cụ đọc bác sĩ, giá và giờ trống

Triển khai 16/11/2026. Adapter trong `D:/rag-phu-san-chatbot/src/booking_reads.py`; endpoint trong `web_app.py`; UI `BookingReadPanel.tsx` gắn vào thẻ dịch vụ của chatbot. Không thay DB/schema/seed/AppointmentStatus/BookingChannel hoặc thuật toán phân bác sĩ.

## API công cụ

`POST /api/assistant/conversations/{conversationId}/tools` yêu cầu JWT PATIENT và ownership như messages. Đây là POST để gửi tham số công cụ có cấu trúc; tất cả lời gọi tới nghiệp vụ bên dưới đều là GET, không ghi appointment/hold.

Body chỉ nhận:

- `list_doctors`: `name`, `serviceId` UUID.
- `get_service_estimate` hoặc `query_bookable_slots`: `name`, `serviceId`, `date` đúng YYYY-MM-DD, `selectionMode` DOCTOR/RANK; DOCTOR bắt buộc `requestedDoctorId` UUID; RANK cấm truyền bác sĩ.
- `get_my_appointments`: chỉ `name`. Không chấp nhận patientId, URL, token, role hoặc filter tùy ý.

Ngày dùng múi giờ UTC+7 của hệ thống, từ hôm nay tới 90 ngày tới, mỗi truy vấn giới hạn một ngày. Chưa parse “sáng mai”/đổi lựa chọn nhiều lượt; đó là phần graph ở bước 5. Các công cụ hiện được gọi qua thao tác rõ ràng trên UI, chưa để LLM tự gọi tùy ý.

UI: bệnh nhân hỏi tên/mã dịch vụ → thẻ danh mục → **Tra bác sĩ và lịch** → chọn ngày, bác sĩ cụ thể hoặc bệnh viện sắp xếp → **Tra lịch và giá tham khảo**. Kết quả tra cứu tạm thời không được lưu vào hội thoại như cam kết lịch còn trống; tải lại cần tra lại. Tool lịch của tôi chưa có nút riêng trong widget, đã có endpoint và kiểm tra quyền cho bước điều phối sau.

## Dữ liệu thật và API nguồn

1. `GET /api/catalog/services/{UUID}` + danh sách khoa ACTIVE của doctor-service: kiểm tra lại dịch vụ ACTIVE, bookingEnabled, specialtyId và notice như bước 3.
2. `GET /api/doctors?specialtyId={UUID}&limit=100`: đọc `id`, `status`, `consultationRank`, `profile.fullName`, `specialties[].id`. Chấp nhận chuyên khoa chính/phụ; tự đối chiếu UUID khoa thêm lần nữa. Không dùng phòng mặc định của profile thay phòng thực tế của slot. Endpoint hiện không áp dụng cursor nên nếu trang đủ 100 hoặc có nextCursor, adapter từ chối danh sách thiếu.
3. `GET /api/catalog/services/{UUID}/estimate`: endpoint public GET mới, gọi trực tiếp **CatalogService.resolveEligibility** hiện có; UUID/query được Nest validation. Dùng chung logic nghiệp vụ với offering của booking, không sao chép công thức giá sang Agent, không dùng internal secret.
4. `GET /api/appointment/bookable-slots`: truyền serviceId, selectionMode, from/to có timezone, limit=100. DOCTOR truyền requestedDoctorId. RANK truyền requestedRankCode=BASIC và để backend hiện hành chọn bác sĩ; không chấm điểm hoặc phân lại trong Agent.
5. `GET /api/appointment/appointments?limit=20`: chuyển access token đã xác thực của chính request, backend tự resolve patientId. Chỉ trả projection ID, mã, dịch vụ, bác sĩ, thời gian, status, selectionMode và nextPageToken. Đây là trang đầu tối đa 20 lịch, không tuyên bố đã đọc toàn bộ. Không trả patientId, lý do khám hay nhân khẩu học.

Giá giữ nguyên cấu trúc snapshot từ resolver: `service`, `basePrice.id/amountMinor/currency/version`, `doctorRankSurcharge.rankCode/priceId/amountMinor/currency/version` hoặc null, `estimatedTotal.amountMinor/currency`. `amountMinor` của VND được hiển thị đúng số đồng như hệ thống hiện có; không chia 100. Giá tính tại đầu ngày yêu cầu, chỉ là dự kiến, chưa khóa giá giao dịch.

Resolver hiện hành kiểm tra giá ACTIVE, effectiveFrom <= at, effectiveTo null hoặc > at, currency; phụ phí theo policy NOT_REQUIRED/BASIC_INCLUDED/RANK_UPGRADE_ALLOWED. Agent không lấy phần tử đầu của prices hoặc hard-code phụ phí. Giá mới cũng không tạo hàng/phiên bản DB.

Slot giữ đúng `serviceId`, `selectionMode`, `doctorId`, `doctorName`, `rankCode`, `roomId/roomCode/roomName`, `startAt/endAt`, `availableCapacity`, `isAvailable`. Đây là DTO availability, không phải Appointment mới. Chỉ hiển thị isAvailable=true, capacity>0 và giờ tương lai. Kiểm tra khớp service/mode, bác sĩ thuộc khoa, rank khớp và khoảng thời gian nằm trong ngày hỏi. Kết quả có checkedAt/readOnly; danh sách rỗng được báo hết giờ phù hợp, không tự sinh slot thay thế.

## Quyền, lỗi và ưu tiên Safety Gate

Allowlist bật đúng bốn công cụ trên; search_catalog vẫn dùng nhánh retrieval bước 3 riêng. Không có createAppointment, hold, cancel hoặc reschedule trong endpoint. Tool arguments không thể tự cấp quyền bằng safety do client gửi.

Safety được tính từ state server trước truy vấn và kiểm tra lại sau truy vấn. Cấp cứu xuất hiện trong lúc tool chậm sẽ không phải đợi; kết quả đọc cũ bị loại. Xóa phiên trong lúc đọc -> 404, không phục hồi phiên đã xóa. UI hủy request và xóa kết quả cũ khi nhận cảnh báo. Owner khác -> 404; role khác PATIENT -> 403; trạng thái an toàn chặn -> 409; tham số sai -> 422; nguồn lỗi/schema không hợp lệ -> 503. Không biến lỗi thành danh sách rỗng hoặc dùng cache để khẳng định còn chỗ.

Chỉ URL nguồn cố định từ cấu hình server, GET với timeout, cấm redirect; access token không gửi sang public catalog/doctor, không lưu vào SQLite/log/index. Kết quả lịch cá nhân không gửi qua medical LLM. API response dùng Cache-Control:no-store như bước 1.

## Kiểm thử

Xem [bằng chứng nghiệm thu](../testing/agent-step4-2026-11-16/README.md). Giữ luồng đặt lịch thủ công `/dat-lich` và thời điểm xác nhận/hold hiện hành. Đọc slot không bảo đảm còn chỗ ở thời điểm người bệnh xác nhận sau này; backend booking vẫn là nơi quyết định cuối.
