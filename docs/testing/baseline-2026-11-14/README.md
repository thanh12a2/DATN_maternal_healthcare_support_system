# Kết quả kiểm chứng baseline đặt khám — 14/11/2026

## Kết luận

Đã kiểm thử thật bằng Playwright/Chrome headless trên Docker localhost ở ba vai trò. Luồng booking, thu tiền mặt mô phỏng, check-in, bắt đầu khám, lưu dữ liệu, hoàn tất, xem kết quả, đổi lịch và hủy chạy được. Chưa đủ điều kiện coi baseline an toàn/hoàn chỉnh vì có lỗi đọc bệnh án chéo bệnh nhân và dữ liệu hành chính giả trên màn hình bác sĩ.

Ledger cuối có 40 kiểm tra riêng biệt: 36 PASS, 3 FAIL (F01, F02, F03) và 1 REVIEW về policy check-in trước ngày hẹn (F04). Đây là tập kiểm tra baseline đã thực hiện, không phải tỷ lệ bao phủ toàn bộ ứng dụng. Các phát hiện F05–F07 là quan sát UI/contract/dữ liệu ngoài phép đếm assertions này.

Chưa thay đổi code nghiệp vụ hoặc lifecycle. Chỉ bổ sung driver, kịch bản test và bằng chứng. Không reseed, không xóa database. Dữ liệu ghi trong ca khám được đánh dấu là kiểm thử mô phỏng; thu tiền là thao tác ghi nhận CASH trong localhost, không có giao dịch tiền thật.

## Môi trường và dữ liệu

- Web http://localhost:3000, gateway http://localhost:8080; source HEAD `e732b93` cùng các thay đổi frontend chưa commit của workspace. Xem `git-head.txt`, `docker-status.txt`.
- Dùng seed hiện hành: patient.thanhhang@gmail.com; patient.ngocmai@gmail.com; reception.hoangyen@antam.local; dr.lethuha@antam.local. Dùng thêm dr.hoangminhtuan@antam.local cho test quyền bác sĩ không được phân công.
- Database kiểm đếm: 5 chuyên khoa, 20 dịch vụ/20 bản ghi có content, 12 bác sĩ, 72 lịch làm việc ACTIVE, 4 lễ tân, 14 bệnh nhân. `pregnancy_episodes` hiện có 0 bản ghi.
- Trước test appointment/hold đều 0. Sau test có 2 appointment: 1 COMPLETED và 1 CANCELLED; 1 hóa đơn thật trong billing PAID 550.000 VND; 1 encounter FINALIZED; các hold cạnh tranh đã được release, hold booking/đổi lịch đã consume.
- `patient-service` bị Docker đánh dấu unhealthy: wget localhost:5004/ready connection refused, nhưng 127.0.0.1:5004/ready trả OK và API hồ sơ hoạt động. Chưa sửa cấu hình.

## Hai ca xuyên suốt đã chạy

### Ca A — Bệnh viện tự sắp xếp

- Bệnh nhân chọn Khám thai định kỳ chuẩn y khoa, RANK/BASIC, 08:00 ngày 16/11.
- API tạo hold rồi appointment, ONLINE/BOOKED, 300.000 VND, phân BS. Hoàng Minh Tuấn, P.202.
- Mã `APTMWFTGJ2SAD764C`, ID `f3d3e8db-b571-4207-8a2d-1ee9ce500ab6`.
- Lễ tân đổi sang 10:00 cùng ngày, rescheduleCount=1, vẫn BOOKED, version=2. Response hiện chuyển selectionMode sang DOCTOR do luồng đổi bác sĩ/giờ hiện có; requestedRankCode vẫn BASIC. Ghi nhận đây là hành vi hiện hành.
- Lễ tân hủy qua nút xác nhận; trạng thái CANCELLED, version=3. Bệnh nhân thấy trong tab Đã hủy.

### Ca B — Bác sĩ theo yêu cầu

- Chọn BS. Lê Thu Hà, 09:00 ngày 16/11, P.201; tổng 550.000 VND = giá dịch vụ 300.000 + phụ phí HEAD_DOCTOR 250.000.
- Mã `APTMWFTH9XT234394`, ID `35295482-d57b-4e48-8c04-4b19faa71f0b`.
- Lễ tân tìm theo ngày/phòng và mã lịch, ghi nhận đến; thu tiền mặt mô phỏng và check-in.
- Backend: invoice PAID, paid=550000, balance=0; appointment CHECKED_IN, encounter DRAFT, STT 201-01.
- Bác sĩ mở lịch ngày 16/11, bấm Bắt đầu khám: appointment IN_CLINICAL_CARE, encounter IN_PROGRESS.
- Nhập số liệu mô phỏng 120/80, 75 bpm, 36.8°C, 58.5kg, 160cm; lý do khám và nội dung kết luận ghi rõ KIỂM THỬ. Đã lưu đúng và giữ nguyên khi reload.
- Bấm hoàn tất, xác nhận Popconfirm: finalize HTTP 201; appointment COMPLETED/version=4, encounter FINALIZED. Inputs bị khóa sau reload.
- Bệnh nhân mở Lịch sử khám → Xem kết quả: đọc được sinh hiệu và nội dung đã lưu. Hệ thống tạo document/PDF; endpoint content trả 200. Chưa kiểm tra trực quan nội dung PDF/in giấy.
- Vì ngày test là 14/11 còn bệnh nhân chỉ được đặt từ ngày mai, toàn bộ tiếp nhận/khám đã được UI/backend cho thực hiện trước ngày hẹn 2 ngày. Đây là một phát hiện cần chốt policy, không phải đã test hành vi vào đúng ngày 16/11.

## Phát hiện cần xử lý

### F01 — Nghiêm trọng: PATIENT đọc được bệnh án bệnh nhân khác

Tái hiện: đăng nhập Ngọc Mai, GET `/api/medical-records/encounters/19f9fc03-186e-43e0-9a36-11742d33c527` là encounter của Thanh Hằng.

Thực tế: HTTP 200, returnedPatientId = `7916a729-2282-4604-b45d-02c3983eed71`, trả FINALIZED và các trường chiefComplaint/vitalSigns/notes/diagnoses/orders. Trong khi GET appointment của Thanh Hằng bằng token Ngọc Mai trả 404 đúng.

Nguồn: `services/apps/medical-record-service/src/medical/medical.controller.ts`: getEncounter chỉ assert assignment khi role DOCTOR; PATIENT không được kiểm tra ownership trước khi gọi getEncounter. listEncounters cũng chỉ tạo scope doctor; cần audit rộng hơn, chưa tuyên bố đã kiểm tra hết endpoint.

Bằng chứng tối thiểu đã lược bỏ nội dung: [record-access-proof.json](./record-access-proof.json). Test A06 trong [patient-api-safeguards.json](./patient-api-safeguards.json). Đây là dữ liệu localhost được seed; không khai thác dữ liệu bên ngoài.

### F02 — Cao: màn hình bác sĩ trộn dữ liệu hành chính fallback

Tên bệnh nhân Thanh Hằng đúng, nhưng màn hình bác sĩ hiển thị tuổi 28, CCCD `001196000112`, phone `0901000001`, địa chỉ 18 Lý Thường Kiệt, người thân Lê Quang Huy. Hồ sơ thật của fixture là ngày sinh 22/09/1993, phone 0901234003, CCCD 001193000102, địa chỉ 45 Tràng Thi, người thân Nguyễn Hoàng Long.

Đã tái hiện cả trước và sau hoàn tất. `DoctorWorkspacePage.tsx` có PATIENT_FALLBACK_MAP theo UUID và fallback phone; `DoctorConsultationDetail.tsx` có giá trị hành chính hardcode khi patientInfo thiếu. UUID đổi sau reseed làm kiểu mapping này không đáng tin. Không dùng fallback của người khác để trình bày như dữ liệu thật; cần lấy hồ sơ theo patientId qua quyền phù hợp.

Bằng chứng: BUG01 trong [doctor-verify.json](./doctor-verify.json), [ảnh bác sĩ](./doctor-verify.png). Trang kết quả bệnh nhân lại lấy đúng hồ sơ, nên hai màn hình mâu thuẫn.

### F03 — Cao: encounter đã kết thúc nhưng hàng đợi chưa kết thúc

Sau ca B: appointment COMPLETED, encounter FINALIZED, nhưng queue_journeys ACTIVE và stage_tickets 201-01 WAITING. API `/api/queue/me/journeys/active` vẫn trả ca đó sau hoàn tất.

Ca được mở trực tiếp từ dòng lịch và bấm Bắt đầu khám, không bấm Gọi số tiếp theo. Đây là đường UI đang cho phép; cần đồng bộ trạng thái vé theo start/finalize hoặc buộc đi qua quy trình gọi/nhận phục vụ phù hợp.

Bằng chứng: [final-api-state.json](./final-api-state.json); trạng thái DB được ghi trong `database-verification.txt`. Chưa kiểm thử riêng toàn bộ đường Gọi số tiếp theo → phục vụ → hoàn tất.

### F04 — Cần chốt policy: cho check-in và hoàn tất trước ngày hẹn

Ngày hẹn 16/11 nhưng checkedInAt 14/11, và có thể hoàn tất ngay. Journey businessDate là 14/11, trong khi lịch hẹn ở 16/11, khiến lọc ngày giữa bàn khám/hàng đợi không thống nhất.

Nếu đây là ngoại lệ được phép, cần biểu diễn rõ; nếu chỉ khám đúng ngày thì cần guard ở backend. Không tự đổi quy tắc này trong đợt test.

### F05 — Trung bình: countdown “đã giữ chỗ” chỉ ở frontend

Chọn giờ hiện thông báo “đã được giữ chỗ trong 05:00” nhưng trước xác nhận chưa có POST slot-holds. API giữ chỗ thật chỉ chạy khi xác nhận, rồi booking ngay. Chống xung đột server đã hoạt động, nhưng thông báo làm người dùng tưởng đã có reservation.

### F06 — Trung bình: lý do khám nhập khi đặt lịch chưa được chuyển sang bệnh án

Đã nhập marker thử nghiệm ở ô lý do khám ca A. Payload booking chỉ có holdId/channel và schema appointment không lưu clinicalNotes. Không có contract chuyển nội dung từ bước đặt sang reception/encounter. Ca B chỉ có chiefComplaint khi bác sĩ nhập. Agent sau này không nên hứa đã chuyển mô tả triệu chứng nếu chưa có cơ chế lưu/chuyển rõ ràng.

### F07 — Dữ liệu: mô tả tuần thai trong danh sách seed chưa tạo hồ sơ thai kỳ

Database medical-record có 0 pregnancy episode; homepage bệnh nhân báo Chưa kích hoạt hồ sơ thai kỳ. Catalog đã đủ nội dung cho tìm kiếm/booking, nhưng memory thai kỳ/hồ sơ lâm sàng không thể giả định đầy đủ từ dòng mô tả tài khoản seed.

## Các kiểm tra bảo vệ đã đạt

- Không JWT đọc lịch → 401.
- PATIENT tự cancel/reschedule → 403; gọi nghiệp vụ reception → 403.
- Ngọc Mai đọc appointment Thanh Hằng → 404.
- Bác sĩ Hoàng Minh Tuấn không được phân công đọc encounter Lê Thu Hà → 403.
- Người khác release hold → 404.
- Hai request giữ cùng doctor/slot đồng thời → 201/409, chỉ một hold hợp lệ.
- Retry cùng idempotency key/payload → cùng hold ID; cùng key khác payload → 409 IDEMPOTENCY_KEY_REUSED.
- Release hold thành công; dùng hold đã release để booking → 409 HOLD_EXPIRED.
- Chủ nhật seed không có lịch → UI báo không có giờ phù hợp.

Xem ledger [results.json](./results.json). Ledger chọn kết quả xác minh cuối cùng cho mỗi ID; không cộng số lần retry thành nhiều test.

## Bằng chứng giao diện tiêu biểu

- [Bệnh nhân đặt tự sắp xếp](./patient_rank_booking_success.png).
- [Bệnh nhân đặt bác sĩ yêu cầu](./patient_doctor_booking_success.png).
- [Lễ tân đổi lịch](./reception-reschedule.png).
- [Bác sĩ lưu và hoàn tất hồ sơ](./doctor-complete.png).
- [Bệnh nhân xem kết quả](./patient-results.png).
- [Bệnh nhân thấy lịch đã hủy](./final-verification.png).

Ảnh/JSON chỉ chứa dữ liệu seed và dữ liệu kiểm thử; không chứa JWT/password. Profile trình duyệt nằm trong TEMP, không đưa vào repository.

## Cách chạy lại và giới hạn

Driver `scripts/qa-local-baseline.cjs` dùng Playwright đã cài riêng trong TEMP, không thêm dependency vào app. Cú pháp: `node scripts/qa-local-baseline.cjs <role> <scenario.cjs>`. Các scenario trong thư mục này gắn ID của lần seed/test hiện tại; không phải bộ test độc lập có thể chạy mọi thứ lặp lại trên dữ liệu đã finalize/cancel. Muốn chạy lại ca ghi phải chuẩn bị fixture mới và cập nhật ID.

Các bước booking P01–P05 được chạy trực tiếp bằng phiên Playwright đầu tiên và lưu ảnh, xác minh bằng API/DB/audit. Các bước tiếp theo có file scenario, request log và assertions. Một lần kiểm tra D04 ban đầu dựa vào “có POST mới” cho false failure khi điền lại giá trị không đổi; `doctor-verify.json` kiểm tra lưu bền sau reload là kết quả cuối đúng. Không sửa log thô để che lần thử đó. Các timeout do chọn sai locator trong quá trình viết test được sửa trước khi chốt kết quả; không quy thành bug sản phẩm.

Chưa kiểm tra: hold hết hạn bằng cách đợi đủ 5 phút thực, no-show scheduler, walk-in toàn trình, mọi thao tác đổi bác sĩ/ngạch, hai lễ tân claim đồng thời, refresh token hết hạn, SMTP/SMS, VNPay/giao dịch bên ngoài, toàn bộ kê đơn/chỉ định/file upload và mọi endpoint phân quyền. Không kết luận đã kiểm chứng toàn bộ ứng dụng hoặc chứng nhận an toàn y khoa.

## Hệ quả cho tích hợp Agent

Có thể tái sử dụng booking APIs và UI hiện tại. Không cần thay enum hay thêm chờ duyệt. Cần ưu tiên sửa F01/F02 trước khi cấp tool hồ sơ cá nhân cho Agent; xử lý F03/F04 để trạng thái/hàng đợi nhất quán. Agent bản đầu có thể đọc catalog và handoff vào `/dat-lich`; memory lâm sàng chỉ bật khi ownership và nguồn dữ liệu đã đúng. Không dùng nội dung fallback hoặc văn bản seed làm bệnh sử thật.
