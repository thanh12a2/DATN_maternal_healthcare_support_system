# Tích hợp Agent theo luồng đặt lịch hiện có

Cập nhật 14/11/2026 theo yêu cầu giữ nguyên cách đặt và trạng thái lịch. Tài liệu này thay thế phương án BookingRequest/chờ lễ tân duyệt trước đó. Chưa sửa code ứng dụng. Kết luận dựa trên source, Prisma và seed, chưa kiểm đếm hoặc xác minh độ đầy đủ của database đang chạy.

## 1. Luồng hiện tại theo source

`frontend/src/modules/patient/pages/PatientBookingPage.tsx` có ba bước nghiệp vụ:

1. Chọn chuyên khoa/dịch vụ. Trang đã đọc query `serviceId`, `specialtyId`, `doctorId` để điền trước lựa chọn.
2. Chọn bác sĩ hoặc bệnh viện tự sắp xếp, chọn ngày và giờ từ API bookable-slots.
3. Đăng nhập/hoàn thiện hồ sơ, kiểm tra thông tin và bấm xác nhận. Handler gọi createSlotHold rồi createAppointment liên tiếp; thành công hiển thị phiếu hẹn.

Chi tiết quan trọng: handleSelectSlot chỉ đặt selectedSlot và đếm ngược 300 giây ở frontend, chưa tạo SlotHold trên server. Hold thật chỉ tạo trong handleConfirmBooking. Không coi countdown giao diện là bằng chứng giờ đã được giữ. Không thay đổi cơ chế này trong phạm vi tích hợp Agent.

API public hiện có qua gateway:
- GET /api/appointment/bookable-slots
- POST /api/appointment/slot-holds
- POST /api/appointment/appointments với holdId, channel ONLINE

Backend listBookableSlots lấy catalog và khả dụng bác sĩ, loại lịch chiếm chỗ và hold còn hạn. Với DOCTOR dùng bác sĩ cụ thể. Với RANK code hiện chọn BASIC; không tự nâng ngạch. createHold chọn ứng viên phù hợp, ưu tiên bác sĩ đã có appointment COMPLETED với bệnh nhân và cân bằng tải ngày; đây là cơ chế đã có, Agent không viết lại. Lịch sử dùng cho điểm continuity hiện không giới hạn theo PregnancyEpisode trong truy vấn đã khảo sát.

createAppointment kiểm tra chủ sở hữu hold, hạn, hồ sơ đủ điều kiện, dịch vụ/chuyên khoa và bác sĩ; consume hold và tạo appointment trong transaction Serializable, lưu snapshot giá, idempotency, audit/outbox. Appointment mặc định BOOKED và phát realtime. Đặt lịch không đồng nghĩa đã thanh toán hay đã check-in.

Các trạng thái giữ nguyên: BOOKED, REASSIGNMENT_REQUIRED, CHECKED_IN, IN_CLINICAL_CARE, COMPLETED, CANCELLED, NO_SHOW. Tuyến khám chính là BOOKED → CHECKED_IN → IN_CLINICAL_CARE → COMPLETED; có các nhánh đổi phân công, hủy, vắng mặt theo nghiệp vụ hiện tại. Reception xử lý tiếp nhận với điều kiện thanh toán; hủy/đổi lịch được backend giới hạn staff. Agent không cấp quyền tự hủy/đổi cho bệnh nhân.

## 2. Phương án tích hợp

Agent là lớp hội thoại phía trước luồng đặt lịch. Python graph/tools tiếp tục đặt trong D:\rag-phu-san-chatbot; backend NestJS đồ án cung cấp dữ liệu và giữ toàn bộ quyết định nghiệp vụ. Không thêm BookingRequest, không thêm trạng thái PENDING, không thêm channel AI.

MVP khuyến nghị: Agent tìm hiểu nhu cầu, gợi ý khoa/dịch vụ, đọc bác sĩ/giá/lịch, sau đó trả nút mở trang hiện tại:

/dat-lich?specialtyId=<id>&serviceId=<id>&doctorId=<id tùy chọn>

Trang hiện tại đã hỗ trợ ba query này; không thêm tham số ngày/slot rồi kỳ vọng trang tự đọc khi chưa có code hỗ trợ. Khi mở trang phải kiểm tra lại ID đang active, quan hệ khoa–dịch vụ–bác sĩ và khả dụng hiện thời. Người dùng tiếp tục chọn giờ/xác nhận như cũ. Giờ Agent vừa tra chỉ mang tính tại thời điểm tra, chưa được giữ chỗ.

Bản nâng cao có thể hiển thị form chọn giờ và xác nhận ngay trong chat, nhưng phải dùng lại các API/validation hiện tại. Chỉ sau action xác nhận rõ ràng của bệnh nhân mới gọi hold → create appointment; channel vẫn ONLINE, status vẫn BOOKED. Dùng ID giao dịch/idempotency ổn định khi retry; không coi câu trả lời do LLM tự suy ra là xác nhận. Đây là mở rộng giao diện, không đổi lifecycle backend.

Yêu cầu cũ “lễ tân duyệt trước khi chốt mọi lịch” không được đáp ứng bởi luồng hiện có. Theo chỉ đạo mới giữ nguyên cách đặt, không đưa bước duyệt này vào phương án; lễ tân tiếp tục vai trò hiện tại. Không mô tả tiếp nhận sau booking như phê duyệt trước booking.

## 3. Dữ liệu hiện có và phần Agent cần

Không cần seed lại catalog, bác sĩ, giá, phòng, lịch, hồ sơ hay tạo booking database mô phỏng. Source/schema/seed đã có:
- Specialty: code, name, description, overview; seed có scopeOfCare, diagnostics, patientNotes.
- MedicalService: summary, description, content JSON, specialtyId, bookingEnabled, status, duration, price, tags. Seed có nội dung hướng dẫn và chuẩn bị.
- Doctor: chuyên khoa, ngạch, hồ sơ, trạng thái, lịch làm việc, ngoại lệ khả dụng, phòng.
- Appointment/SlotHold: lịch sử, occupancy, giá snapshot, phiên bản, hold và audit.
- Patient/Medical record: hồ sơ hành chính, thai kỳ, LMP/EDD, mức nguy cơ, sinh hiệu, encounter và ghi chú; truy cập theo quyền.
- Corpus RAG sức khỏe đang có trong repository Python.

Nội dung giới thiệu/seed không mặc nhiên là quy tắc điều hướng đã được kiểm chứng lâm sàng. Cần kiểm tra mức phủ và nguồn trước khi dùng. Phần bổ sung chủ yếu là lớp phục vụ Agent:
1. Index đọc từ description/overview/content/tag hiện có, kèm ID, nguồn, version và thời điểm đồng bộ. Không lưu bác sĩ/slot khả dụng chỉ trong vector DB.
2. Phiên hội thoại và trạng thái có cấu trúc: conversationId, chủ sở hữu, messages, intent, dữ kiện đã hỏi, lựa chọn, bước đang chờ. Lưu riêng phía Agent; không thêm vào enum Appointment.
3. Quy tắc an toàn có version, nguồn, người duyệt và test. Chưa thấy bộ rule engine red-flag hoặc cơ sở tương tác thuốc chuyên dụng trong các file đã tìm; không suy ra đã đủ chỉ từ mô tả dịch vụ.
4. Metadata trích dẫn từ pipeline đến API/frontend. API RAG hiện trả nguồn rỗng và cờ insufficient_evidence cố định cần được chuyển đúng từ kết quả retrieval.
5. Mapping từ cách gọi dân gian/nhu cầu sang khoa/dịch vụ chỉ bổ sung nếu đánh giá cho thấy nội dung hiện có thiếu. Ưu tiên tài liệu/index bổ trợ gắn ID, chưa cần sửa schema catalog.

Dữ liệu hội thoại không tự ghi thành bệnh sử chính thức. clinicalNotes ở trang booking hiện chỉ thấy state và input, không nằm trong payload createAppointment; muốn chuyển tóm tắt hội thoại cho nhân viên cần contract riêng được xác định, không hứa dữ liệu này đã được lưu.

## 4. Hội thoại khi thêm Agent

Mỗi lượt: nhận tin → kiểm tra safety → xác định intent theo cả phiên → chọn RAG hoặc tool nghiệp vụ → kiểm tra output/ID → trả lời và action phù hợp.

Hỏi kiến thức: truy xuất corpus hiện có, trả lời kèm nguồn; thiếu bằng chứng thì nói rõ. Không tự kéo người dùng vào đặt lịch.

Nhờ định hướng: hỏi thêm dữ kiện cần thiết, gợi ý chuyên khoa tồn tại và giải thích dựa trên nguồn. Không chẩn đoán hay chọn xét nghiệm/thủ thuật thay bác sĩ. Nếu chưa đủ dữ kiện hoặc ngoài phạm vi thì chuyển điều phối.

Nhờ đặt lịch: thu thập dịch vụ, chọn bác sĩ hay bệnh viện sắp xếp, thời gian mong muốn; gọi API lịch; trả lựa chọn có thật và nút mở /dat-lich đã điền sẵn khoa/dịch vụ/bác sĩ. Trang đặt lịch vẫn chịu trách nhiệm xác nhận, hold và booking.

Xem lịch của tôi: chỉ cho tài khoản đã xác thực, đọc API theo danh tính server. Xin hủy/đổi lịch: hướng dẫn đúng luồng lễ tân hiện có, không gọi tool vượt quyền.

Safety: đánh giá mỗi lượt, trước retrieval và cả khi đang bàn lịch. Tình huống khớp rule cấp cứu dừng nhánh đặt lịch thường và hiển thị cảnh báo theo yêu cầu đề tài. Bộ rule cần duyệt chuyên môn, không tuyên bố bao phủ mọi cấp cứu. Mọi câu trả lời hiển thị khuyến cáo tham khảo; không chẩn đoán/kê đơn.

Frontend hiện lưu messages nhưng mỗi request chỉ gửi message; model không có memory nhiều lượt từ cơ chế này. Cần conversationId + lịch sử phía server, kiểm tra quyền sở hữu phiên. Tách intent hành chính khỏi OOD gate của corpus y khoa: “đặt sáng mai” không bị từ chối chỉ vì không tìm thấy trong tài liệu sức khỏe.

## 5. Các thay đổi cần thực hiện

- RAG repo: agent router, graph, state/checkpoint, adapter read-only catalog/doctor/slots/profile/appointments; sửa citations và refusal contract.
- Đồ án: endpoint/facade có xác thực cho chức năng cá nhân, tool API theo quyền, chat response chứa citations/cards/actions, nút liên kết /dat-lich.
- Giữ source of truth ở API; kiểm tra lại ID live trước render/handoff. Không cho LLM tự chọn patientId hoặc truy cập database trực tiếp.
- Không gửi CCCD/địa chỉ/điện thoại hoặc toàn bộ bệnh án vào model khi không cần. Kiểm tra quyền đọc hồ sơ lâm sàng riêng; tài khoản bệnh nhân đăng nhập không mặc nhiên được dùng mọi API staff.
- Log đã che dữ liệu nhạy cảm, retention cho chat/checkpoint, timeout/fallback, handoff và bộ kiểm thử hội thoại.

## 6. Thứ tự thực hiện và nghiệm thu

1. Chuẩn hóa index catalog có nguồn và contract citations của RAG.
2. Thêm phiên nhiều lượt, intent routing và safety gate.
3. Nối tool đọc dữ liệu thật, trả nút handoff sang trang đặt lịch đang có.
4. Thêm đọc lịch cá nhân/memory theo quyền; chỉ làm booking ngay trong chat nếu cần ở giai đoạn sau.

Nghiệm thu: không đổi enum/API semantics đặt lịch; luồng thủ công vẫn hoạt động; tên/ID/giá/giờ được grounded; chat hiểu lựa chọn qua nhiều lượt; không bịa lịch khi API lỗi; không tự tạo appointment khi chỉ hỏi; không vượt quyền xem/hủy/đổi; nguồn RAG hiển thị; ngăn nhánh đặt lịch thường trong ca safety fixture; giờ đã đầy được backend báo lại đúng.
