# Bước 6 — Từ Agent sang trang đặt khám hiện hành

Triển khai 16/11/2026. Không thêm trạng thái lịch, booking channel, bước chờ duyệt hoặc thay cơ chế giữ chỗ. Endpoint mới chỉ xác minh lựa chọn và tạo URL nội bộ; booking vẫn do bệnh nhân xác nhận tại trang `/dat-lich`.

## Luồng

1. Bệnh nhân hoàn tất tra cứu trong chat bước 5. Chỉ phản hồi mới nhất có phase ready, có giờ thực tế và Safety Gate allow mới hiển thị **Tiếp tục đặt khám**.
2. Bấm nút gọi endpoint handoff bằng conversationId và ID tin nhắn assistant. Không gửi serviceId/doctorId/patientId hoặc state do client tự chọn.
3. Server đọc draft của chủ phiên, kiểm tra đúng lượt mới nhất, revalidate dịch vụ/khoa/bác sĩ qua adapter đọc bước 4.
4. Server trả `/dat-lich?specialtyId={UUID}&serviceId={UUID}`. Chỉ thêm doctorId khi người bệnh chủ động chọn DOCTOR. RANK không truyền bác sĩ do thuật toán từng gợi ý.
5. Trình duyệt mở trang đích và tải lại catalog/doctor/specialty hiện hành. Người bệnh tự chọn lại ngày/giờ, xem hồ sơ, rồi xác nhận như trước.
6. Chỉ khi bấm **Xác Nhận Đặt Lịch Khám**, trang gọi `POST slot-holds` → `POST appointments`, ONLINE/BOOKED và hiển thị phiếu hẹn hiện có.

Trang hiện tại không hỗ trợ prefill ngày/giờ nên handoff không truyền date, startAt, endAt, slotId, holdId hoặc giá. UI nói rõ cần chọn lại ngày/giờ; không khẳng định ngày đã chọn trong chat được chuyển sang trang đích. Phạm vi chọn ngày 14 ngày tới của trang đặt khám được giữ nguyên, dù công cụ chat có thể tra 90 ngày.

## API mới

`POST /api/assistant/conversations/{conversationId}/handoff`

Body: `{ "messageId": "UUID assistant message" }`. Extra fields bị từ chối. JWT PATIENT và ownership như messages. Response: `{url,readOnly:true,checkedAt,notice}`. Không ghi state/draft, không gọi hold/createAppointment, không nhận URL từ LLM/client.

Điều kiện server: đúng lastRequestId/assistant message của phản hồi mới nhất, draft active, phase ready và availability.items không rỗng. Sau khi đọc nguồn, kiểm tra lại ownership/revision/safety. Người khác 404, role khác 403, body sai 422, lựa chọn cũ/cảnh báo/không có giờ 409, nguồn chưa xác minh được 503. API lỗi không trả URL fallback.

Dịch vụ được revalidate ACTIVE/bookingEnabled/specialtyId/notice như bước 4. Nếu specialtyId đã thay đổi thì yêu cầu chọn lại. DOCTOR phải còn trong danh sách bác sĩ ACTIVE đúng khoa của dịch vụ. URL chỉ có ba tham số đã được trang hỗ trợ và các UUID lấy từ server. Không chuyển bệnh sử, PHI hoặc giá trong URL.

## Frontend và trang đích

- `BookingConversationResult.tsx`: nút hiện ở snapshot mới nhất còn hợp lệ; đang xác minh thì khóa nút; cảnh báo/câu hỏi mới hủy request đang chờ và ẩn hành động cũ. Khôi phục history không hiện nút từ snapshot cũ.
- `chatbot.ts`: gọi handoff với messageId, không tự dựng URL bằng lựa chọn từ UI.
- `bookingHandoff.ts`: kiểm tra URL nội bộ và whitelist query; `resolveBookingPrefill` đối chiếu dữ liệu live. Điều hướng tải lại trang để params được áp dụng cả khi chat được mở ngay trên `/dat-lich`.
- `PatientBookingPage.tsx`: không dùng raw IDs để tra slot trước khi tải/kiểm tra nguồn. Detail của serviceId được đọc riêng để hỗ trợ cả dịch vụ ngoài trang đầu; detail lỗi/INACTIVE không dùng bản list thay thế. Specialty lấy từ service.specialtyId và danh sách khoa ACTIVE, không lấy synthetic specialty của catalog.
- Doctor sai khoa/ngừng hoạt động bị bỏ lựa chọn; giữ ý định DOCTOR để người bệnh tự chọn lại hoặc chuyển RANK, không tự đổi sang bệnh viện sắp xếp. Các link doctor-only/specialty-only hiện có từ trang danh mục vẫn được hỗ trợ. Khi đổi dịch vụ, slot API không được dùng bác sĩ của khoa cũ.
- Dịch vụ không hợp lệ không thể đi tiếp với phantom selectedServiceId. Lỗi slot API vẫn có nhánh thử lại hiện có.

Giá/doctor/room cuối của giao dịch vẫn do backend booking quyết định, không lấy snapshot Agent để tạo appointment. Không thay payload chuẩn của createSlotHold/createAppointment hoặc chính sách quyền các role.

## Xung đột khi xác nhận

Backend hiện hành trả SLOT_NOT_AVAILABLE hoặc HOLD_EXPIRED thì trang bỏ giờ cũ, tải lại availability và quay về bước chọn giờ với thông báo tiếng Việt. Người bệnh phải chọn lại và bấm xác nhận lại; không tự retry giữ/đặt, không tạo phiếu thành công trước khi API createAppointment thành công. Các lỗi khác giữ cách xử lý hiện có.

## Kiểm chứng

Xem [báo cáo test, dữ liệu demo đã tạo và bằng chứng](../testing/agent-step6-2026-11-16/README.md). Unit test có quyền/ownership, stale message, concurrent safety/đổi lựa chọn/xóa phiên, nguồn lỗi; Playwright thực sự đặt thành công từ cả RANK/DOCTOR, tạo conflict bằng hold của bệnh nhân khác và hoàn thành lại qua luồng thủ công. Database không reseed/migrate; chỉ bổ sung các giao dịch demo được ghi rõ trong báo cáo.
