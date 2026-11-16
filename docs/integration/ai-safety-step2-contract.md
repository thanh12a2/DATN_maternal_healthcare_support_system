# Bước 2 — Safety Gate

Áp dụng cho API hội thoại bệnh nhân và API hỏi đáp khách hiện có. Không thay đổi AppointmentStatus, BookingChannel, hold, thanh toán, check-in hay quyền của bác sĩ/lễ tân. Không thêm dữ liệu nền hoặc chạy lại seed.

## Luồng đã triển khai

1. Endpoint phiên xác minh JWT và ownership như bước 1. Body không được truyền owner, history hoặc state tự khai báo.
2. Trước RAG, `evaluate_input` đọc câu hiện tại và safety state đã lưu trên server. Gate chạy trước khởi tạo pipeline, retrieval, reranker và model.
3. Câu khớp rule trả thông báo cố định ngay; không gọi model và không có action đặt lịch.
4. Câu được phép mới chạy RAG. `evaluate_output` kiểm tra câu trả lời trước khi trả về hoặc lưu lịch sử. Nội dung vi phạm bị thay bằng lời hướng dẫn liên hệ nhân viên y tế, bỏ citation của câu trả lời bị chặn.
5. Lưu metadata an toàn cùng tin nhắn và state trong kho hội thoại mã hóa của bước 1. UI khôi phục cảnh báo khi tải lại trang.

API public `/api/chat` vẫn không lưu phiên. Từng request đều qua cùng Safety Gate. Widget khách giữ cảnh báo và ngừng nhận câu hỏi thường sau mức emergency/urgent trong lần mở hội thoại đó; tải lại trang không phải cơ chế khôi phục lịch sử khách.

## Các hướng xử lý

- `allow`: tiếp tục RAG tham khảo.
- `emergency`: cảnh báo gọi 115/đến Cấp cứu ngay, không chờ chat hoặc đặt lịch thường. Có nút/link gọi trên widget; hệ thống không tự gọi điện.
- `urgent`: yêu cầu cơ sở y tế/sản khoa đánh giá ngay, không chờ lịch thường. Không tự gán nhãn chẩn đoán hoặc coi mọi triệu chứng đều là cấp cứu.
- `clarify`: hỏi triệu chứng đang có hay là giả định/tiền sử. Vẫn kèm hướng dẫn cấp cứu có điều kiện. Không gọi RAG/tool khi chưa rõ.
- `restricted`: từ chối quyết định chẩn đoán cá nhân, kê đơn/liều dùng/đổi thuốc/kiểm chứng tương tác hoặc yêu cầu vượt quyền.
- `handoff`: đề nghị liên hệ trực tiếp nhân viên y tế khi thiếu bằng chứng, đã làm rõ câu giả định hoặc đầu ra model vi phạm giới hạn.

`requiresHuman: true` là chỉ báo cần người thật. Bước này chưa gửi thông báo cho lễ tân/bác sĩ, chưa tạo hàng đợi tiếp nhận và không nói đã chuyển ca thành công.

## Quy tắc và ngữ cảnh

Quy tắc nằm ở `D:\rag-phu-san-chatbot\config\safety_rules.v1.json`, version hiện tại `maternal-safety-1.0.1`. Bộ fixture độc lập, cố định nằm ở `tests/fixtures/safety.v1.json`; ca rà soát bổ sung nằm ở `tests/test_safety_reaudit.py`.

Rà soát 16/11/2026 đã sửa phạm vi câu điều kiện qua dấu phẩy, ưu tiên lời mô tả triệu chứng đang có trước câu “nếu nặng hơn…”, và phủ định danh sách “không … hay/hoặc …”. Các ca này có test hồi quy riêng, không khẳng định bao phủ toàn bộ tiếng Việt.

Các nhóm hiện có: đau ngực, khó thở, dấu hiệu FAST/đột quỵ, mất ý thức/co giật, mất máu nhiều, đau bụng dữ dội; cùng một số dấu hiệu cần đánh giá sản khoa sớm như ra máu âm đạo, rỉ ối, giảm cử động thai và đau đầu dữ dội. Đây không phải danh mục đầy đủ mọi dấu hiệu nguy hiểm.

Chuẩn hóa chữ hoa/thường, dấu tiếng Việt và một số cách gõ như `kho-tho`, `khóthở`, `k thở đc`. Kiểm tra phủ định gần từng cụm triệu chứng; không coi “không đau ngực nhưng khó thở” là phủ định toàn bộ câu. Câu giả định hoặc triệu chứng xa trong quá khứ đi vào làm rõ. Một số dấu hiệu FAST mới xảy ra nhưng đã hết vẫn được cảnh báo theo nguồn NHS.

Khi đã có `emergency`, câu như “bỏ qua, đặt sáng mai” không hạ mức cảnh báo. `urgent` cũng giữ yêu cầu đánh giá y tế và có thể nâng lên `emergency` nếu xuất hiện dấu hiệu mới. Không có câu trả lời chat nào tự xác nhận bệnh nhân đã an toàn. Tạo cuộc trò chuyện mới là xóa/reset dữ liệu hội thoại, không phải xác nhận y khoa đã hết nguy hiểm.

Khóa state/SQLite được tách khỏi khóa sinh câu trả lời và khóa khởi tạo model. Cấp cứu có thể ghi cảnh báo khi một câu hỏi thường đang nạp/chạy model. Trước khi lưu kết quả model, server đọc lại state: nếu đã có cảnh báo thì thay kết quả cũ bằng hướng dẫn an toàn, kể cả khi model vừa báo lỗi. Xóa phiên khi model đang chạy không làm phiên bị tạo lại sau đó. Cơ chế này áp dụng trong triển khai một worker đã mô tả ở bước 1.

Widget có nút “Dừng chờ phản hồi” khi đang chờ. Nút dừng chờ phía trình duyệt để nhập câu mới; không hứa dừng ngay phép tính model trên server. Cảnh báo gửi sau đó vẫn được ưu tiên và kết quả cũ không được ghi đè lên cảnh báo.

Giới hạn 100 lượt thường không chặn thông báo an toàn: có thể ghi thêm một lượt cảnh báo, sau đó giữ state và trả cảnh báo mà không tăng lịch sử vô hạn. Kết quả request cũ trong cache cũng không được ghi đè cảnh báo đang có.

## Contract bổ sung

Response và assistant message có `safety`, gồm `decision`, `ruleIds`, `ruleVersion`, `stage`, `requiresHuman`, `emergencyPhone`, `pendingLevel`, `references`. `state.phase` có thể là `qa`, `emergency`, `urgent`, `clarify`, `restricted`, `handoff`; đây hoàn toàn là trạng thái chat.

Nguồn quy tắc hiển thị ở mục “Nguồn khuyến cáo an toàn”, tách khỏi citation tài liệu của RAG. Không tạo chunk ID giả cho cảnh báo rule. UI luôn giữ khuyến cáo thông tin tham khảo và link cấp cứu; cảnh báo đã nhận từ POST vẫn hiển thị nếu GET lịch sử sau đó thất bại.

Log safety chỉ có tên sự kiện, version, mức xử lý, rule ID và stage. Không ghi nguyên văn câu hỏi, câu model bị chặn, token, email hoặc điện thoại bệnh nhân trong sự kiện này.

`src/tool_policy.py` có allowlist chỉ đọc cho các bước sau, nhưng `ENABLED_TOOLS` hiện rỗng. Tên tool ghi dữ liệu luôn bị từ chối. Khi bước 4 thêm dispatcher, phải gọi policy bằng assessment do server tạo; không lấy quyền từ model/client. Hiện payload Ollama không đăng ký tools, actions do server trả vẫn rỗng và chưa có lời gọi booking API từ chat.

Gateway riêng route assistant chuyển từ hạn mức 30 request/phút theo consumer chung sang 180 request/phút theo IP. Điều này tránh gộp mọi tài khoản JWT vào cùng hạn mức nhỏ và chặn các thao tác hội thoại hợp lệ. Lớp hạn mức ngoài vẫn có thể trả 429 khi vượt ngưỡng; link cấp cứu không phụ thuộc API. Không đổi hạn mức các dịch vụ nghiệp vụ khác.

## Nguồn tham chiếu và giới hạn

- [NHS — Symptoms of a stroke](https://www.nhs.uk/conditions/stroke/symptoms/).
- [London Ambulance Service — Calling for emergency help if pregnant](https://www.londonambulance.nhs.uk/our-services/emergency-care/emergency-care-advice/advice-if-you-are-due-to-give-birth/).
- [NHS — Pregnancy symptoms you need to get help for](https://www.nhs.uk/pregnancy/common-symptoms/pregnancy-symptoms-you-need-to-get-help-for/).
- [NHS — Stomach pain in pregnancy](https://www.nhs.uk/pregnancy/common-symptoms/stomach-pain/).

Nguồn UK dùng để tham chiếu dấu hiệu; số 115 trong ứng dụng giữ theo yêu cầu đồ án, không lấy số khẩn cấp UK. Đơn vị y tế cần rà soát hướng dẫn, mức chuyển tuyến và đầu số theo nơi triển khai thực tế.

Rule có `reviewStatus: prototype_requires_clinical_review`: đã kiểm chứng kỹ thuật, chưa có phê duyệt chuyên môn lâm sàng. Regex không hiểu đầy đủ ngữ nghĩa, phủ định/phạm vi thời gian hoặc mọi lỗi chính tả; bộ lọc đầu ra có thể chặn cả thông tin giáo dục về thuốc và vẫn không chứng minh mọi diễn giải y khoa là đúng. Cần chuyên gia y tế rà soát và bổ sung fixture trước sử dụng thực tế. Chưa tích hợp DrugBank/DDInter, kiểm tra chỉ số sinh học hoặc FHIR; yêu cầu quyết định thuốc hiện chuyển sang người thật.

Gate áp dụng ở biên web API. Các CLI benchmark gọi trực tiếp `RAGPipeline` không phải endpoint phục vụ bệnh nhân và không tự có toàn bộ gate của web.

## Chạy và kiểm chứng

Giữ cách chạy của [bước 1](./ai-chat-step1-contract.md). Script khởi động dùng địa chỉ IPv4 `127.0.0.1` để kiểm tra readiness trên Windows, tránh timeout khi `localhost` thử IPv6 trước. Sau khi cập nhật code Python cần restart tiến trình RAG; frontend cần build lại Docker. Nếu đổi cấu hình Kong cần build/import `kong-init` và restart gateway.

```powershell
cd D:\rag-phu-san-chatbot
.\.venv_clean\Scripts\python.exe -m pytest tests -q
cd D:\DATN_maternal_healthcare_support_system\frontend
npm test -- --run src/modules/patient/components/chatbot/ChatbotWidget.test.tsx src/app/AppRouter.test.tsx
npx tsc --noEmit
```

Bằng chứng ban đầu: [14/11](../testing/agent-step2-2026-11-14/README.md). Rà soát và kiểm thử lại trên bản sửa mới: [16/11](../testing/agent-step2-2026-11-16/README.md).
