# Bước 7 — Cá nhân hóa đặt khám tối thiểu

Triển khai 16/11/2026, version `patient-memory-1.0.0`. Mã mới ở repo RAG: `src/personalization.py`, `src/model_privacy.py`; tích hợp `web_app.py`, `src/booking_graph.py`, `src/conversations.py`. Web có nút **Sở thích đặt khám** và thẻ nguồn thông tin cá nhân hóa.

## Phạm vi và cách dùng

- “Ghi nhớ tôi thích khám buổi sáng và để bệnh viện sắp xếp”: chủ động lưu buổi/cách chọn bác sĩ cho tài khoản hiện tại.
- Tạo hội thoại mới rồi “Đặt khám PRENATAL_ROUTINE”: dùng RANK đã lưu và hỏi ngày, bớt một câu hỏi chọn mode. “Ngày mai” dùng buổi đã lưu; “Chiều mai” ưu tiên buổi vừa nói, không âm thầm sửa sở thích lâu dài.
- “Đổi sở thích sang chiều” sửa sở thích lưu; “Đổi sở thích sang bệnh viện sắp xếp” chỉ sửa mode, chữ “sang” không được hiểu là buổi sáng.
- Sở thích DOCTOR chỉ giúp hỏi ngay tên bác sĩ từ danh sách hiện hành; không nhớ hoặc tự chọn doctorId thay bệnh nhân.
- “Hồ sơ của tôi”, “Tôi muốn khám lại như lần trước”: đọc tóm tắt tối thiểu và đề xuất dịch vụ từ lần khám đã hoàn thành. Chưa chọn tự động.
- “Dùng dịch vụ lần trước”: yêu cầu rõ ràng để chọn lại serviceId đã revalidate, sau đó vẫn hỏi bác sĩ/mode hoặc dùng RANK đã lưu, và hỏi ngày/giờ. Không lấy ngày/bác sĩ cũ làm lựa chọn mặc định.
- “Quên sở thích của tôi” hoặc nút **Xóa sở thích đã lưu** xóa preference; reset hội thoại và preference là hai thao tác riêng.

Chỉ lưu hai trường scheduling có enum: `preferredSelectionMode=RANK|DOCTOR`, `preferredPeriod=any|morning|afternoon|evening`. Không lưu nguyên câu người dùng vào preference, không lưu tên/CCCD/SĐT, thuốc, dị ứng, bệnh sử hoặc tuần thai. Câu yêu cầu lưu dữ kiện lâm sàng được chuyển hướng tới nhân viên y tế, không biến thành hồ sơ chính thức. Các cách nói phủ định/mơ hồ cần nói rõ trước khi lưu.

Đây là cá nhân hóa hành chính dựa trên dữ liệu và mẫu ngôn ngữ có giới hạn, chưa phải memory toàn bộ bệnh án hoặc tư vấn theo tuổi thai. Patient DB không có cột tuần thai/bệnh sử; PregnancyEpisode nằm ở medical-record DB riêng và không được tự suy ra hoặc tích hợp trong bước này.

## Hai nguồn chính thức mới — đều chỉ đọc

`GET /api/patients/me/assistant-context`:

- PATIENT only; `where.authAccountId=auth.userId` từ JWT, không nhận patientId từ client.
- SQL select đúng `Patient.version`, `Patient.updatedAt` (cột updated_at).
- Response `data:{profileStatus,version,updatedAt}`. profileStatus COMPLETE/MISSING là projection suy ra từ sự tồn tại của hồ sơ theo presenter hiện có, **không phải cột Patient mới** hoặc chứng nhận đủ điều kiện lâm sàng/đặt lịch.
- Không select/decrypt nationalIdCiphertext, không lấy fullName/dateOfBirth/phoneNumber/address/emergencyContacts.

`GET /api/appointment/me/assistant-context`:

- PATIENT only; dùng resolvePatientId từ danh tính JWT/gateway nghiệp vụ đang có.
- `Appointment.status=COMPLETED`, `endAt<=now`, orderBy `endAt desc,id desc`, lấy đúng một bản ghi.
- Chỉ select `id,serviceId,assignedDoctorId,endAt,status`; response `data:{lastCompleted:object|null}`.
- Không lấy patientId trong response, lý do khám, clinical notes, pricing, demographics hoặc bệnh án. Lịch BOOKED/CANCELLED/NO_SHOW không được coi là lần đã khám.

RAG đọc profile projection trước; MISSING thì không đọc lịch sử. COMPLETE mới gọi projection appointment. ServiceId lịch sử được đối chiếu lại qua adapter catalog ACTIVE/bookingEnabled/specialty/notice ở bước 4. Nếu nguồn lỗi hoặc service không còn hợp lệ, không dùng bản cũ để khẳng định và không tự thay bằng một dịch vụ khác.

Adapter kiểm tra schema chính xác; profile có field ngoài projection hoặc lastCompleted không đúng status/ngày/UUID thì fail closed. Các URL cố định phía server, access token hiện tại truyền tạm thời cho API self-context, không truyền token vào model hoặc lưu vào memory. Response Cache-Control:no-store.

## Phân biệt dữ kiện và phần tổng hợp

Message metadata `personalization` gồm:

- `official.source=system_record`, checkedAt, profileStatus/profileVersion/profileUpdatedAt, lastCompleted, sourcePaths và suggestedService khi xác minh được. Các trường profileVersion/profileUpdatedAt là tên projection, không phải cột DB mới.
- `userDeclared.source=user_declared`, values/revision/updatedAt/expiresAt: sở thích người bệnh chủ động lưu, có thể sai hoặc thay đổi.
- `aiSummary`: câu tổng hợp hành chính theo mẫu, không đưa thêm dữ kiện y khoa hoặc kết luận bệnh; không dùng LLM để tự suy ra thông tin hồ sơ.

UI tách rõ hai loại nguồn; snapshot message mô tả tại lượt đó, không phải hồ sơ hiện tại bất biến. Draft có `memoryApplied`/preferenceSources để biết mode/buổi nào do preference điền, khác lựa chọn vừa nói. Giá và giờ vẫn từ API bước 4, booking/handoff vẫn theo bước 5–6.

## Lưu trữ, TTL và xóa

Preference nằm trong bảng `assistant_preferences` của SQLite private RAG hiện có; **không thêm schema/migration/seed cho Postgres nghiệp vụ**. Payload chỉ gồm hai enum, mã hóa Fernet bằng khóa private hiện có; owner lấy từ JWT, không nhận qua body/query. Không vector hóa hoặc ghi vào Qdrant.

TTL 30 ngày kể từ lần lưu/sửa chủ động, đọc không gia hạn. Hết TTL payload trở thành rỗng; sửa/xóa tăng revision. Tombstone revision không còn dữ liệu preference được giữ tối đa 30 ngày để chống replay/CAS cũ rồi dọn. Runtime vẫn yêu cầu một worker như conversation SQLite các bước trước.

`GET /api/assistant/memory`: lấy preference của chính PATIENT, không tự đọc hồ sơ. `DELETE /api/assistant/memory`: xóa preference, vẫn được dùng để bảo vệ riêng tư khi chat đang có cảnh báo. Staff không truy cập hai endpoint này.

Reset chat xóa phiên/draft đang mở theo bước 1, không xóa preference đã lưu riêng. Xóa preference không xóa appointment/hồ sơ y tế hay các tin nhắn lịch sử; muốn xóa nội dung phiên hiện tại dùng reset. Chat history vẫn mã hóa và retention 30 ngày như trước.

## Ưu tiên, concurrency và cache

1. Safety Gate luôn chạy trước cá nhân hóa, có kiểm tra lại trước từng đọc và trước persist.
2. Lựa chọn hiện tại nói rõ thắng preference; không tự sửa record official hoặc saved preference trừ khi có lệnh lưu/sửa.
3. Xóa/sửa preference làm vô hiệu hóa các default phụ thuộc ở lượt sau; không xóa các lựa chọn thực sự được người dùng nói rõ. Handoff từ draft dùng revision cũ trả 409.
4. Compare-and-swap và owner lock chống ghi đè đồng thời. Kết quả graph chậm dựa trên preference đã bị xóa/sửa bị loại (409), không tiếp tục handoff bằng dữ liệu cũ.
5. Retry cùng requestId của lệnh lưu sau khi đã có revision mới bị từ chối, không khôi phục sở thích vừa xóa. Lệnh đã thành công cùng revision không ghi trùng hoặc gia hạn TTL do retry.
6. Retry lượt official mới nhất đọc lại nguồn và thay cặp message cũ, giữ ID/turnCount. Không cache hồ sơ cũ để khẳng định trạng thái hiện hành.

## Giới hạn dữ liệu tới medical LLM

Các lượt cá nhân hóa chạy bằng read-only adapter/template, không gọi model. Khi trở lại nhánh kiến thức, cặp tin nhắn mang metadata personalization được loại khỏi history đưa model; số định danh/SĐT phổ biến 9–12 chữ số và email trong input/history được che. Đây là lớp lọc heuristic bổ sung, không tuyên bố nhận diện mọi kiểu PII viết biến thể.

Nguồn profile được thu nhỏ ngay ở DB select, nên Agent không phải lấy toàn bộ hồ sơ rồi mới cắt cho model. Không log body lỗi nguồn/claims/token/câu người bệnh; chỉ log tên lớp lỗi. Luồng clinical/appointment hiện tại không bị sửa bởi preference.

[Bằng chứng M01–M04 và hướng dẫn kiểm thử](../testing/agent-step7-2026-11-16/README.md).
