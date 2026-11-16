# Các bước triển khai và kiểm chứng Agent đặt khám

Phạm vi: Agent hỏi đáp, hỗ trợ chọn dịch vụ/bác sĩ, tra lịch và chuyển sang trang `/dat-lich` hiện có. Không đổi AppointmentStatus, BookingChannel, cách hold/booking, quyền hủy/đổi hay thêm bước chờ duyệt. Trạng thái và bằng chứng thực hiện được ghi riêng tại từng bước.

Tài liệu kiến trúc: [ai-booking-agent-plan.md](./ai-booking-agent-plan.md).

## Cách dùng checklist

Làm lần lượt 0–8. Hoàn thành một bước phải có đầu ra và bằng chứng đạt các ca tương ứng, không chỉ code chạy được. Các phần đọc API có thể kiểm bằng Postman CLI hoặc HTTP client; hội thoại nhiều lượt bằng API có phiên và sau đó bằng giao diện. Chỉ thử ghi lịch với tài khoản/dữ liệu demo. Kiểm tra quyền bằng ít nhất hai bệnh nhân A/B và một tài khoản lễ tân.

Lưu kết quả thực tế cho mỗi ca: input, actor, conversationId, response, ID nguồn, trạng thái dữ liệu trước/sau, PASS/FAIL và lỗi còn tồn tại. Không lưu token hay PHI vào bằng chứng chia sẻ. Với model không tất định, chạy lại bộ hội thoại cố định ba lần, kiểm tra invariant thay vì so khớp nguyên văn câu trả lời.

## Bước 0 — Chốt baseline hiện tại

Mục đích: có mốc so sánh để biết Agent có làm sai luồng đặt lịch không.

Việc làm:
- Xác minh dữ liệu đang chạy: khoa/dịch vụ active, dịch vụ bookingEnabled, liên kết bác sĩ–khoa, giá hợp lệ, lịch làm việc và slot thật.
- Chọn fixture demo: một dịch vụ có slot, một trường hợp không có slot, một bác sĩ cụ thể, một lựa chọn bệnh viện tự sắp xếp.
- Ghi lại request/response và trạng thái của luồng đặt hiện tại; ghi riêng lỗi có sẵn.

Test:
- BL01: đặt thủ công theo DOCTOR và RANK bằng bệnh nhân có hồ sơ đủ; phải có phiếu hẹn, channel ONLINE, status BOOKED.
- BL02: hồ sơ chưa đủ/không đăng nhập không được tạo lịch trái policy.
- BL03: chọn giờ chưa tạo server hold; bấm xác nhận mới gọi hold rồi appointment.
- BL04: thử hold hết hạn và slot bị chiếm; backend trả lỗi, không tạo lịch thành công giả.

Đạt khi: có bằng chứng baseline cho hai chế độ và lỗi; biết fixture nào dùng được. Nếu không có slot do seed/lịch hiện hành không hợp lệ, sửa hoặc bổ sung fixture demo đúng chỗ trước, không để Agent bịa slot.

## Bước 1 — Chuẩn hóa API chat và phiên hội thoại

Trạng thái 14/11/2026: đã triển khai và kiểm thử local. Xem [contract và cách chạy](./ai-chat-step1-contract.md), [bằng chứng nghiệm thu](../testing/agent-step1-2026-11-14/README.md). Bước 2–7 được cập nhật riêng ở dưới; bước 8 chưa triển khai.

Mục đích: hội thoại hiểu các lượt liên tiếp, output đủ cho UI và không trộn dữ liệu người dùng.

Việc làm:
- Bổ sung conversationId, chủ sở hữu, messages và state; dữ liệu cá nhân cần danh tính xác thực từ server.
- Thống nhất response có answer, citations, insufficientEvidence, state và actions (tên cụ thể chốt trong contract).
- Map refused/contexts của RAG đúng ra API; lưu metadata nguồn xuyên suốt, không tạo nguồn giả. Giữ chat cũ tương thích trong giai đoạn chuyển đổi nếu frontend còn dùng.
- Định nghĩa xóa phiên/reset và chính sách phiên khi đăng nhập/đăng xuất.

Test:
- S01: hai lượt có cùng conversationId phải đọc đúng lịch sử; phiên mới không kế thừa lựa chọn cũ.
- S02: bệnh nhân B dùng ID phiên A phải bị từ chối; ID phiên đoán được không cấp quyền.
- S03: câu ngoài corpus phải phản ánh thiếu bằng chứng, không trả cờ thành công cố định.
- S04: citation trả về truy nguyên được tài liệu/section/chunk; không có nguồn thì không bịa nguồn.

Đạt khi: contract nhất quán, tách phiên/ownership đúng. Chưa cần LLM tự gọi tool hoặc memory bệnh án.

## Bước 2 — Safety gate và giới hạn quyền

Trạng thái 14/11/2026: đã triển khai bản mô phỏng và kiểm thử kỹ thuật local. Xem [contract Safety Gate](./ai-safety-step2-contract.md), [bằng chứng kiểm thử](../testing/agent-step2-2026-11-14/README.md). Bộ rule chưa được chuyên gia y tế phê duyệt lâm sàng.

Rà soát 16/11/2026: đã sửa lỗi phạm vi câu “nếu/không”, tách khóa để cấp cứu không chờ model và thêm nút dừng chờ trên widget. Rule hiện là `maternal-safety-1.0.1`; kết quả 128 test Python, 17 test frontend và 32 kiểm tra Playwright đều qua. [Bằng chứng mới](../testing/agent-step2-2026-11-16/README.md). Đây vẫn là nghiệm thu kỹ thuật cho đồ án mô phỏng, không phải phê duyệt lâm sàng.

Mục đích: chặn nhánh hành động không phù hợp trước khi nối các khả năng Agent.

Việc làm:
- Bộ rule mô phỏng có version và fixture được duyệt; chạy trước retrieval/LLM ở mọi lượt.
- Quy định câu trả lời tham khảo, không chẩn đoán/kê đơn; fallback sang người thật khi thiếu căn cứ.
- Tool allowlist ở server; MVP chỉ đọc dữ liệu, không cho model gọi createAppointment/cancel/reschedule.

Test:
- SF01: fixture khớp cấp cứu theo rule phải có cảnh báo và không gọi tool tra/đặt lịch thường.
- SF02: đang chọn lịch rồi gửi fixture cấp cứu cũng phải ngắt nhánh thường.
- SF03: fixture phủ định, giả định, triệu chứng cũ và lỗi chính tả có expected outcome được xác định trước; nếu thiếu ngữ cảnh thì hỏi lại/chuyển người thật theo rule.
- SF04: yêu cầu chẩn đoán/kê thuốc không nhận kết luận bệnh hay đơn thuốc.
- SF05: prompt yêu cầu bỏ qua quyền/xem hồ sơ người khác không thay đổi quyền server.

Đạt khi: toàn bộ invariant của bộ fixture safety đã duyệt đều qua; lưu ca thất bại và sửa trước khi nối hành động. Qua fixture không có nghĩa bảo đảm phát hiện mọi cấp cứu thực tế.

## Bước 3 — Tận dụng catalog hiện có cho retrieval

Trạng thái 16/11/2026: đã triển khai retrieval danh mục với kiểm tra API live và thẻ nguồn trên web. Python 180/180, chatbot/router 19/19, Playwright 17/17 PASS; TypeScript/build PASS. Full frontend còn 5 test trang hồ sơ lỗi, ghi riêng trong [báo cáo](../testing/agent-step3-2026-11-16/README.md). Xem [contract và ánh xạ DB](./ai-catalog-step3-contract.md). Công cụ bác sĩ/giá/slot được bổ sung riêng tại bước 4 bên dưới.

Mục đích: Agent gợi ý khoa/dịch vụ có thật và giải thích được nguồn.

Việc làm:
- Đọc Specialty description/overview và MedicalService summary/description/content/tags hiện có.
- Tạo index phục vụ tìm kiếm có ID, loại nguồn, version và thời điểm đồng bộ; không tạo database danh mục thứ hai làm nguồn quyết định.
- Lọc ứng viên theo trạng thái/bookingEnabled/quan hệ; API live là kiểm tra cuối trước hiển thị hành động.
- Tạo bộ câu hỏi cố định có expected candidates từ danh mục demo; cách gọi đời thường chỉ bổ sung khi đo thấy thiếu.

Test:
- C01: hỏi tên dịch vụ cụ thể phải trả đúng ID và nguồn.
- C02: hỏi mô tả nhu cầu phải trả ứng viên nằm trong expected candidates hoặc hỏi làm rõ; không ép luôn chọn một khoa.
- C03: yêu cầu khoa không tồn tại phải báo ngoài phạm vi/handoff.
- C04: đổi một dịch vụ sang inactive ở dữ liệu test; dù index cũ còn chứa, API live phải ngăn đề xuất đặt dịch vụ đó.
- C05: không dùng câu trả lời trong nội dung seed như bằng chứng y khoa bên ngoài chưa được kiểm chứng.

Đạt khi: 100% ID được hiển thị có thật và hợp lệ theo fixture; ghi riêng tỷ lệ chọn đúng ứng viên, thiếu và sai. Chốt ngưỡng chất lượng với bộ câu hỏi trước khi điều chỉnh prompt, không dùng chính bộ nghiệm thu để chỉnh mã liên tục.

## Bước 4 — Nối tool đọc API thật

Trạng thái 16/11/2026: đã triển khai 4 adapter đọc có Safety Gate/ownership, GET estimate dùng chung resolver giá backend và panel tra cứu trong thẻ dịch vụ. Python 211/211, frontend phạm vi chatbot/router/panel 21/21, Playwright 21/21 PASS; TypeScript và build PASS. Appointment/hold không tăng. [Contract](./ai-booking-reads-step4-contract.md), [bằng chứng và cách thử trên web](../testing/agent-step4-2026-11-16/README.md). Chưa cho LLM điều phối nhiều lượt, chưa ghi lịch; phần đó thuộc các bước tiếp theo.

Mục đích: model dùng dữ liệu hiện hành cho bác sĩ, giá và giờ trống.

Việc làm:
- Adapter đọc catalog, bác sĩ, bookable-slots; thêm get-my-appointments theo danh tính server khi cần.
- Kiểm tra schema input/output, timeout và lỗi phụ thuộc. Không cho model tự truyền patientId bất kỳ.
- Chế độ tự sắp xếp chuyển đúng RANK/BASIC của backend; không chọn thay thuật toán phân bác sĩ hiện có.

Test:
- T01: dùng cùng tham số gọi API trực tiếp và tool, so sánh ID, ngày/giờ và giá. Khi so slot phải xét cùng thời điểm hoặc trạng thái fixture không thay đổi.
- T02: bác sĩ không thuộc khoa/dịch vụ không được hiển thị như lựa chọn hợp lệ.
- T03: không có slot trả danh sách rỗng và hướng chọn ngày khác; không tạo giờ giả.
- T04: API down/timeout trả lỗi thân thiện/handoff, không dùng trí nhớ model để khẳng định lịch còn trống.
- T05: get-my-appointments chỉ đọc lịch của người đang đăng nhập; bệnh nhân không tự hủy/đổi qua Agent.

Đạt khi: dữ liệu phản ánh API, lỗi có nhánh xử lý; số appointment/hold không tăng chỉ do tra cứu.

## Bước 5 — Graph điều phối hội thoại

Trạng thái 16/11/2026: đã triển khai state machine `booking-graph-1.0.0`, context server có mã hóa, sử dụng adapter bước 4, kết quả ngay trong chat. Python 244/244, frontend phạm vi chatbot/router/panel/result 24/24, Playwright 31/31 (luồng chính 28 + dừng chờ 3) PASS; TypeScript/build PASS. Không tăng appointment/hold. [Contract](./ai-conversation-step5-contract.md), [bằng chứng và cách thử](../testing/agent-step5-2026-11-16/README.md). Chưa dùng LangGraph/LLM để tự chọn tool; chưa có bàn giao deep link hoặc ghi lịch.

Mục đích: Agent biết đang ở đâu và chọn đúng RAG/tool/bước hỏi tiếp theo.

Việc làm:
- Graph: safety → intent → hỏi rõ hoặc RAG hoặc catalog → lựa chọn dịch vụ → bác sĩ/chế độ → thời gian → tra lịch → handoff.
- Lưu lựa chọn có cấu trúc, hỗ trợ sửa ý và vô hiệu hóa lựa chọn phụ thuộc khi người dùng đổi dịch vụ.
- Tách chat state khỏi AppointmentStatus. Không dùng OOD gate tài liệu để từ chối câu hành chính như “sáng mai”.

Test:
- G01: hỏi kiến thức chỉ gọi RAG, không tự khởi động booking.
- G02: “muốn đặt khám” → chọn dịch vụ → “bệnh viện sắp xếp” → “sáng mai”: phải giữ đúng ngữ cảnh và gọi đúng tool.
- G03: đổi khoa/dịch vụ giữa chừng phải bỏ bác sĩ/slot cũ không còn hợp lệ.
- G04: “tìm giờ khác” không làm mất toàn bộ nhu cầu đã xác định.
- G05: thiếu dữ kiện/ngoài phạm vi phải hỏi lại hoặc handoff; giới hạn vòng lặp/tool call.

Đạt khi: bộ hội thoại cố định chạy đúng nhánh, tool arguments đúng, không có ghi appointment/hold. Không yêu cầu câu trả lời giống từng chữ.

## Bước 6 — Giao diện và chuyển sang trang đặt lịch

Trạng thái 16/11/2026: đã có nút tiếp tục, endpoint handoff kiểm tra state/ownership/live catalog, prefill được xác minh tại trang đích và xử lý chọn lại giờ khi conflict. Python 254/254, frontend phạm vi liên quan 31/31, kiểm tra trình duyệt 39 đạt sau kiểm lại cleanup HTTP 200 (giữ nguyên bằng chứng lỗi kỳ vọng 204 ban đầu). Đã tạo thật 3 lịch demo ONLINE/BOOKED bằng RANK, DOCTOR và thủ công sau conflict. [Contract](./ai-booking-handoff-step6-contract.md), [báo cáo và dữ liệu tạo thêm](../testing/agent-step6-2026-11-16/README.md). Không đổi schema/status/channel hoặc thời điểm tạo hold của luồng hiện hành.

Mục đích: bệnh nhân dùng được Agent mà booking tiếp tục như hiện tại.

Việc làm:
- Chat render nguồn, card dịch vụ/bác sĩ/lịch, cảnh báo và nút “Tiếp tục đặt khám”.
- Nút mở `/dat-lich?specialtyId=...&serviceId=...&doctorId=...`; doctorId chỉ có khi chọn bác sĩ cụ thể.
- Chỉ dùng các query trang hiện tại đã đọc; không khẳng định đã điền ngày/giờ hoặc giữ chỗ nếu chưa hỗ trợ.
- Kiểm tra lại dữ liệu live ở trang đích; hết slot thì yêu cầu chọn lại.

Test:
- U01: click từ card mở đúng dịch vụ/khoa/bác sĩ; không có doctorId thì dùng chế độ tự sắp xếp hiện có.
- U02: chat chỉ tra lịch/mở trang không tạo hold/appointment.
- U03: chọn giờ và xác nhận trên trang vẫn gọi hold → appointment; kết quả ONLINE/BOOKED và phiếu hẹn như baseline.
- U04: slot vừa bị chiếm phải báo chọn lại; Agent không hiển thị “đặt thành công” trước kết quả API.
- U05: luồng đặt thủ công không qua chat vẫn chạy đúng như bước 0.

Đạt khi: hoàn thành được từ chat đến phiếu hẹn và không thay đổi lifecycle/quyền nghiệp vụ. Lưu Network trace hoặc video demo có dữ liệu đã che.

## Bước 7 — Cá nhân hóa tối thiểu

Trạng thái 16/11/2026: đã triển khai preference opt-in mã hóa/TTL 30 ngày, hai self-context projection tối thiểu, đề xuất lại dịch vụ từ COMPLETED và phân biệt official/user-declared/summary. Python 277/277, Nest 4/4, frontend phạm vi liên quan 33/33, Playwright 23/23 PASS; TypeScript/build PASS. Profile version và số appointment/hold không đổi. [Contract](./ai-personalization-step7-contract.md), [báo cáo và cách thử](../testing/agent-step7-2026-11-16/README.md). Chưa đọc toàn bệnh án hoặc tự cá nhân hóa y khoa theo tuổi thai.

Mục đích: giảm hỏi lại mà vẫn giữ hồ sơ chính thức ở service hiện tại.

Việc làm:
- Đọc tóm tắt được phép dùng từ hồ sơ/lịch sử qua API theo quyền; không vector hóa toàn bộ bệnh án.
- Phân biệt dữ kiện người dùng tự khai, lịch sử chính thức và tóm tắt AI; không tự ghi câu chat thành chẩn đoán/dị ứng.
- Ưu tiên thông tin vừa được người dùng xác nhận, cho reset phiên và áp dụng retention.

Test:
- M01: có dữ kiện hợp lệ thì không hỏi lại không cần thiết; thiếu thì hỏi, không đoán.
- M02: sửa thông tin trong chat cập nhật ngữ cảnh phiên, không tự sửa bệnh án.
- M03: đăng xuất/đổi tài khoản không thấy lịch sử hoặc card của người trước.
- M04: model/log không nhận CCCD hay toàn bộ hồ sơ khi tool chỉ cần tóm tắt tối thiểu.

Đạt khi: chứng minh được lợi ích cá nhân hóa và phân quyền. Có thể để sau MVP; không chặn việc bàn giao bước 6.

## Bước 8 — Hồi quy, đóng gói và nghiệm thu

Mục đích: chứng minh luồng đầy đủ hoạt động trong môi trường chạy thực tế.

Việc làm:
- Chạy lại các ca baseline, safety, quyền, grounding, hội thoại và handoff; gồm phiên song song.
- Cấu hình URL service/gateway theo môi trường, không phụ thuộc đường dẫn ổ D; giữ bí mật ở server.
- Đo thời gian phản hồi, số lượt hỏi, lỗi API và tỷ lệ hoàn thành; lưu model/prompt/index/rule version để tái hiện.

Test:
- E01: hỏi kiến thức → đổi sang đặt lịch → chọn dịch vụ → mở trang → xác nhận thành công.
- E02: hai bệnh nhân cùng chọn slot; khi xác nhận chỉ giao dịch hợp lệ thành công, người còn lại nhận conflict theo backend.
- E03: tải lại UI, mất kết nối hoặc gửi lại tin nhắn không tạo lịch vì chat MVP không có tool ghi.
- E04: restart Agent/LLM down không làm hỏng lịch đã tạo; trang đặt thủ công vẫn hoạt động.
- E05: chạy trên môi trường triển khai thật với hai tài khoản, kiểm tra source links, đăng nhập, route, CORS/TLS và không lộ secret.

Đạt khi: các invariant về quyền, không bịa dữ liệu, safety fixture và booking hồi quy đều PASS; công bố các giới hạn/ca lỗi còn lại. Không gọi phiên bản này là đã có staff approval trước BOOKED.

## Mốc bàn giao

- Sau bước 0: xác minh dữ liệu/booking thật.
- Sau bước 1–3: chat có phiên, safety và grounding danh mục.
- Sau bước 4–5: Agent hội thoại gọi được tool thật.
- Sau bước 6: MVP end-to-end dùng được mà giữ nguyên booking.
- Bước 7: cá nhân hóa tăng cường.
- Sau bước 8: bản đủ bằng chứng để demo/triển khai theo phạm vi đã chốt.

Đặt hoàn toàn trong chat, tương tác thuốc, FHIR và dashboard là các hạng mục riêng sau MVP. Nếu làm booking trong chat, cần bộ test mới cho xác nhận rõ ràng, retry/idempotency, hold expiry và chính xác một lịch; không suy ra đã đạt từ bộ test read-only ở trên.
