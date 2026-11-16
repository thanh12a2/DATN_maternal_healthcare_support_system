# Bước 5 — Điều phối hội thoại đặt khám nhiều lượt

Triển khai local 16/11/2026. Mã tại `D:/rag-phu-san-chatbot/src/booking_graph.py`; `web_app.py` nối vào message API có JWT/ownership của bước 1. Frontend thêm `ChatBooking` và `BookingConversationResult.tsx`. Tool và data contract của [bước 4](./ai-booking-reads-step4-contract.md) được dùng lại.

## Kiến trúc và phạm vi

Đây là state machine Python xác định, version `booking-graph-1.0.0`, chưa dùng thư viện LangGraph hay LLM tự quyết định tool/ID. Không thêm dependency hoặc trộn catalog vào corpus y khoa. Cách này cho phép kiểm chứng từng chuyển trạng thái và giới hạn công cụ trước khi mở rộng khả năng hiểu ngôn ngữ.

Các node: safety → intent → catalog/selection → list_doctors → hỏi cách chọn/ngày hoặc availability → get_service_estimate → query_bookable_slots → trả kết quả/handoff. Câu hỏi kiến thức đi nhánh RAG hiện có; nhánh đặt khám chỉ gọi các API đọc đã kiểm soát. Mỗi turn kết thúc bằng phản hồi hoặc đi tới node kế, không có vòng retry tự động.

Chưa tạo hold/appointment, chưa thêm nút chuyển lựa chọn sang `/dat-lich`, chưa thay lifecycle hoặc quyền bệnh nhân/lễ tân/bác sĩ. Giao diện bàn giao sang booking hiện hành thuộc bước 6.

## Những câu có thể thử

Gửi từng lượt: “Tôi muốn đặt khám” → `PRENATAL_ROUTINE` → “Bệnh viện sắp xếp” → “Sáng mai”.

Sau đó có thể gửi:

- “Tìm giờ khác”: giữ dịch vụ/cách chọn/ngày/buổi, lấy trang giờ khác chưa hiển thị trong lần tra hiện tại.
- “Tra lại lịch”: đọc lại API với lựa chọn hiện tại, không dùng slot lưu trong history để trả như dữ liệu live.
- “Đổi sang chiều mai”: giữ dịch vụ/cách chọn, đổi bộ lọc ngày/buổi.
- “Đổi sang bác sĩ Lê Thu Hà”: chỉ chọn bác sĩ thuộc khoa của dịch vụ trong API live, giữ nhu cầu ngày/buổi đã khai.
- “Đổi sang NIPT” hoặc “Đổi sang Phụ khoa”: xóa dịch vụ đã chốt, doctor/mode/date/time/giờ đã hiển thị; hỏi lại mục trong danh mục mới. Khoa được mở ra các dịch vụ hiện hành đúng specialtyId khi được chọn.
- “Chọn 1”/“Chọn cái đầu tiên”: chọn từ danh sách khoa/dịch vụ vừa hiển thị; ordinal bác sĩ được đối chiếu ID từ danh sách trước với danh sách live, không gán theo thứ tự mới của API.
- “9h sáng mai”: lọc startAt đúng 09:00 UTC+7, không tự tạo giờ mới hoặc kéo dài slot. “3h chiều mai” được hiểu 15:00.
- “Lịch hẹn của tôi”: gọi get_my_appointments bằng token hiện tại, không gửi dữ liệu lịch cá nhân tới medical LLM; tối đa trang đầu 20 lịch và có nextPageToken.
- “Dừng tìm lịch”: bỏ draft chat, không hủy appointment. “Đặt luôn”, “giữ chỗ”, “hủy lịch” chỉ nhận hướng dẫn thao tác tại trang/quầy hiện có, không gọi công cụ ghi.

Nếu người dùng mới nói “sáng mai” mà chưa có dịch vụ, Agent hỏi dịch vụ thay vì gửi câu hành chính sang medical RAG. Nhu cầu nhiều ứng viên cần chọn rõ, không tự chọn dịch vụ đắt hơn. Câu chỉ hỏi danh mục như “Tôi muốn khám thai” vẫn tương thích nhánh bước 3; có thể chọn tiếp bằng số để bắt đầu graph.

## State và thuộc tính DB

State hội thoại thêm `phase=booking`, `booking`, `catalogChoices`, `lastRequestId` trong payload SQLite **đã mã hóa** của bước 1. Đây là chat state/metadata, không phải cột hoặc enum DB nghiệp vụ mới.

Draft `booking` gồm active, phase, service, selectionMode, doctor, date, period, time khi đã xác định; danh sách choices/doctorChoices và fingerprint giờ đã hiển thị được giới hạn. Các phase nội bộ: need_service, service_choice, need_selection, doctor_choice, need_time, ready, no_slots, appointments, handoff, idle. Không ánh xạ những giá trị này sang AppointmentStatus.

`service.id/code/name/specialtyId` lấy từ MedicalService public API; khoa ghép theo UUID với doctor-service. `doctor.id/name` là ID và profile.fullName từ danh sách bác sĩ ACTIVE đúng specialties[].id. `selectionMode` DOCTOR/RANK giữ đúng backend; RANK/BASIC không tự chọn lại bác sĩ. Giá và slots giữ cấu trúc resolver/bookable-slots ở bước 4. Không có trường chẩn đoán/thuốc hay memory bệnh án mới.

Adapter đọc của bước 4 bổ sung projection `service.id/code/name/specialtyId` từ lần đọc live. Graph cập nhật lại tên/code trong draft; nếu specialtyId của cùng serviceId đổi ở nguồn thì xóa doctor/mode/date/time phụ thuộc và yêu cầu chọn lại. Không thay đổi DB để kiểm thử ca này; unit test dùng nguồn giả lập đúng schema.

Assistant message có `booking` là projection cho UI gồm lựa chọn, trace tên node, toolCalls và snapshot availability nếu vừa đọc thành công. Snapshot có checkedAt, tối đa 6 giờ/lượt, estimate, moreAvailable, matchedCount. Không lưu access token vào state/message/index; không đưa token vào prompt hay log.

## Thời gian và làm rõ

Ngày được xử lý ở UTC+7 trong 90 ngày tới: ISO YYYY-MM-DD; DD/MM/YYYY hoặc DD/MM với năm hiện tại; hôm nay, mai, ngày kia; thứ 2–7/Chủ nhật và tuần sau khi đã có thứ cụ thể. “Tuần sau” đơn lẻ, ngày sai/quá khứ/ngoài khoảng, nhiều ngày hoặc nhiều buổi cùng lúc phải hỏi lại.

Buổi sáng lọc startAt trước 12:00, chiều từ 12:00 tới trước 17:00, tối từ 17:00; đây là bộ lọc trình bày, không thay ca khám hoặc slot trong DB. Tên bác sĩ chứa “Mai” không được suy ra là ngày mai. “Đổi sang” không được hiểu thành buổi sáng.

Tìm kiếm/thời gian hiện dựa trên mẫu ngôn ngữ có giới hạn. Không tuyên bố hiểu mọi cách nói hoặc mọi thứ tự thông tin; khi không đủ rõ, hỏi lại/handoff. Với câu hỏi triệu chứng/kiến thức, Safety Gate và RAG có guard hiện có tiếp tục chịu trách nhiệm theo phạm vi mô phỏng.

## An toàn, replay và lỗi

- Safety Gate chạy trước graph. Trước mỗi lần gọi tool/catalog, controller kiểm tra lại state dưới khóa ngắn; cấp cứu không đợi model/tool chậm. Sau khi graph xong, kiểm tra state lần cuối trước persist.
- Cấp cứu/urgent/clarify/restricted vô hiệu hóa draft và choices; lịch sử không phải bằng chứng được phép bỏ qua cảnh báo. Kết quả đọc đang chạy không được ghi đè cảnh báo mới.
- Tối đa 4 lời gọi cấp adapter/node một turn (bao gồm catalog); mỗi adapter có GET nội bộ và timeout như bước 3–4. Không có vòng lặp tool tùy ý. Sau 3 lần yêu cầu làm rõ liên tiếp mà chưa xác định được lựa chọn, yêu cầu hỗ trợ người thật. Giới hạn phiên 100 lượt vẫn áp dụng.
- API lỗi/thiếu dữ liệu/doctor ngừng hoạt động: không đưa slot cache ra như dữ liệu mới, không tự sinh bác sĩ/giờ/giá. Không có giờ phù hợp: trả danh sách rỗng và hướng đổi ngày/buổi/bác sĩ; không tự đổi dịch vụ/ngày thay người bệnh.
- requestId của lượt graph mới nhất có availability được đọc lại live khi retry, giữ ID message và turnCount; không nhân đôi lượt. Retry một lượt graph/danh mục cũ sau khi đã có lựa chọn mới trả 409 để không ghi đè draft hiện tại. Chọn lại chủ động cần requestId mới.
- Client chỉ gửi message/requestId; state/doctorId/patientId/role do client chèn vào message API bị từ chối. Ownership giữ nguyên: bệnh nhân khác 404, role không PATIENT 403.

## Hiển thị và khôi phục

UI hiển thị tóm tắt lựa chọn và kết quả giá/giờ ngay trong chat; không có nút tạo lịch ở kết quả này. Giá/slot chỉ hiện như kết quả vừa đọc cho phản hồi mới nhất. Khi reload, có câu hỏi mới hoặc cảnh báo an toàn, snapshot cũ không được hiển thị như kết quả mới; ghi “Dữ liệu lần tra trước” và yêu cầu gửi “tra lại lịch”.

Hỏi kiến thức giữa chừng tạm dừng graph, giữ service/mode/doctor/date/time để có thể quay lại; xóa fingerprint giờ cũ để lần tra tiếp theo đọc lại. Đổi khoa/dịch vụ vô hiệu hóa toàn bộ lựa chọn phụ thuộc. Không đổi chính sách reset/xóa phiên/retention của bước 1.

Xem [kết quả kiểm thử và cách chạy lại](../testing/agent-step5-2026-11-16/README.md).
