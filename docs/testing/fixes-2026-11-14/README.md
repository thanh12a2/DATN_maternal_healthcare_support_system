# Sửa lỗi baseline và kết quả test lại — 14/11/2026

## Kết quả

Đã build lại các service bị ảnh hưởng, áp dụng migration qua Compose và chạy lại trên Docker localhost. Các kiểm tra cuối: 35 assertions Playwright/API PASS; 33 backend unit tests PASS (1 isolated integration test không bật); 16 frontend tests PASS. Các app backend bị sửa và frontend qua typecheck/build riêng. Đây là phạm vi sửa baseline, không phải chứng nhận kiểm thử mọi chức năng của hệ thống.

Không thêm trạng thái lịch hoặc hàng đợi duyệt, không đổi cách bệnh nhân xác nhận rồi tạo BOOKED. Các thay đổi frontend đã có trước phiên này được giữ lại. Không reset database hoặc chạy lại foundational seed.

## Đã sửa gì và kiểm chứng thế nào

### F01 — Phân quyền bệnh án

- Resolve patientId từ account xác thực qua Patient Service; không tin patientId do client truyền.
- GET encounter kiểm tra owner với PATIENT và assignment với DOCTOR. Danh sách encounter/pregnancy của PATIENT được scope theo owner; filter giả bị từ chối.
- Chặn PATIENT tạo/cập nhật hồ sơ lâm sàng trực tiếp qua các REST route đã sửa.
- Test: owner đọc được 200, Ngọc Mai đọc encounter Thanh Hằng bị 403; list và filter không đi vòng; chủ hồ sơ vẫn mở được trang kết quả. Xem [access-regression.json](./access-regression.json).

### F02 — Dữ liệu hành chính ở bác sĩ

- Xóa PATIENT_FALLBACK_MAP dựa trên UUID seed và thông tin giả ở màn hình khám/bàn khám.
- Appointment Service chỉ bổ sung demographics cho lịch đã scope theo bác sĩ; Patient Service cung cấp thông tin thật qua internal RPC với purpose CLINICAL. Không mở quyền đọc mọi bệnh nhân cho doctor trên public Patient API.
- Tuổi tính từ ngày sinh; dữ liệu thiếu hiển thị chưa cập nhật, không dùng CCCD/địa chỉ/người thân của người khác.
- Test: Thanh Hằng hiển thị đúng DOB 22/09/1993, tuổi 33, CCCD kết thúc 0102, điện thoại, địa chỉ Tràng Thi và người liên hệ Nguyễn Hoàng Long. [Ảnh sau sửa](./demographics-regression.png), [5 assertions](./demographics-regression.json).

### F03 — Đồng bộ hàng đợi

- Thêm RPC nội bộ SyncClinicalJourney, chỉ nhận từ medical-record-service với scope riêng.
- Job đồng bộ bền vững chỉ DONE khi appointment và queue cùng xác nhận. Nếu queue lỗi sau khi appointment cập nhật, retry không ghi lại lifecycle appointment nhưng tiếp tục sync queue.
- START đưa vé khám từ WAITING/CALLED sang IN_SERVICE, kể cả mở trực tiếp từ dòng lịch. COMPLETE kết thúc vé khám; journey chỉ kết thúc nếu không còn stage khác chờ/phục vụ.
- Redelivery/START đến muộn không mở lại vé đã kết thúc; giao dịch Serializable và kiểm tra encounterId tránh sửa nhầm ca.
- Test mới đúng ngày: vé 201-02 đi WAITING → IN_SERVICE → COMPLETED, journey COMPLETED và appointment COMPLETED. [clinical-final-state.json](./clinical-final-state.json).
- Repair fixture cũ: đưa lại job COMPLETE của encounter baseline vào PENDING để worker đồng bộ lại; không sửa trực tiếp trạng thái bệnh án/lịch đã hoàn tất. Vé 201-01 và journey cũ hiện COMPLETED. [Đối chiếu DB](./database-verification.txt).

### F04 — Tiếp nhận trước ngày hẹn

- Chặn lịch có ngày hẹn trong tương lai theo Asia/Ho_Chi_Minh ở validate admission và check-in backend. Reception kiểm tra trước khi lập hóa đơn/thu tiền.
- Bệnh nhân vẫn đặt trước như cũ. Nếu cần khám sớm hơn ngày đã hẹn, lễ tân cần dời lịch trước khi tiếp nhận. Tiếp nhận cùng ngày và quy tắc trễ giờ hiện có vẫn được giữ.
- Test: lịch ngày 17/11 được tạo BOOKED bình thường; mở reception case ngày 14/11 trả 409/APPOINTMENT_NOT_DUE và không phát sinh hóa đơn. Ca cùng ngày 14/11 tiếp nhận được. Có unit test biên 23:59/00:01 múi giờ bệnh viện.
- Đây là guard nghiệp vụ được bổ sung để sửa hành vi tiếp nhận trước ngày hẹn đã nêu; không thêm trạng thái lịch.

### F05 — Countdown giữ chỗ

- Đổi câu chữ thành thời gian xác nhận lựa chọn, không còn hứa đã có reservation trên server.
- Test: trước nút xác nhận chưa POST hold; sau xác nhận vẫn hold → appointment ONLINE/BOOKED. [future-booking.json](./future-booking.json).

### F06 — Lý do khám

- Thêm field optional reasonForVisit (tối đa 2000 ký tự) vào appointment; migration `20261114040000_reason_for_visit` đã áp dụng.
- Frontend gửi clinicalNotes khi xác nhận. Internal appointment/medical-record contracts chuyển lý do này vào chiefComplaint khi reception mở encounter.
- Không coi lời người bệnh tự khai là chẩn đoán; không ghi đè encounter đã tồn tại khi retry open.
- Test qua UI bệnh nhân: note được lưu trong appointment. Ca đúng ngày: note đi qua reception vào encounter và hiển thị sẵn cho bác sĩ trước khi chỉnh sửa. [clinical-setup.json](./clinical-setup.json), [clinical-lifecycle.json](./clinical-lifecycle.json).

### F07 — Hồ sơ thai kỳ demo

- Thêm script riêng `services/scripts/seed-demo-pregnancies.cjs`, chỉ bổ sung fixture demo theo 11 tài khoản có tuần thai trong dữ liệu bạn cung cấp; không tự suy ra tuần thai của Minh Anh.
- Script tìm theo email/account hiện hành, không gắn UUID cố định; không ghi đè pregnancy đã có, không dọn dữ liệu vận hành. LMP/EDD là ngày mô phỏng tương đối phục vụ demo, không phải bệnh sử thật.
- Đã chạy: lần đầu thêm 11, lần hai thêm 0. Database hiện 11 episode; API patient chỉ trả episode của chính mình.
- Foundational seed gốc vẫn tách khỏi dữ liệu lâm sàng. Nếu reseed làm đổi patientId, cần chạy lại script demo riêng; không dùng script này trên dữ liệu bệnh nhân thật.

### Healthcheck Patient Service

- Đổi localhost thành 127.0.0.1 cho /ready trong container để tránh probe vào địa chỉ không lắng nghe.
- Sau recreate container: patient-service healthy. [docker-status.txt](./docker-status.txt).

## Phương pháp test và dữ liệu phát sinh

- Chromium headless bằng Playwright trên localhost, dùng seed của người dùng; không gửi thông tin ra dịch vụ ngoài.
- Giữ nguyên hai lịch baseline. Đợt regression tạo thêm: lịch Ngọc Mai ngày 17/11 (ONLINE/BOOKED, note thử nghiệm), lịch Thanh Hằng cùng ngày 14/11 tại quầy (RECEPTION, đã COMPLETED, note/chẩn đoán ghi rõ QA).
- Ca tại quầy được chuẩn bị bằng API xác thực RECEPTIONIST, sau đó thu tiền/check-in và khám/hoàn tất bằng UI. Patient booking tương lai được chạy hoàn toàn qua UI. Không gọi đây là patient UI đặt cùng ngày vì giao diện hiện chỉ cho đặt từ ngày mai.
- Các hold dùng test tranh chấp đã release; không xóa appointment để che kết quả kiểm thử.
- Backend suites: medical-record 17 pass/1 skipped; queue 7 pass; appointment 9 pass. Frontend: 4 file, 16 pass.
- 35 assertions browser/API gồm quyền, demographics, booking, tiếp nhận, note, queue lifecycle, concurrency và idempotency. Xem [results.json](./results.json).

Build đầu tiên bị Docker engine ngắt EOF; đã build tuần tự và khởi động lại thành công, volume/database được giữ. Một vài lần viết test cần sửa wait/fixture: phải chờ trang kết quả render; tra lịch cùng ngày dùng khoảng bắt đầu sau thời điểm giá seed có hiệu lực. Những lần thử đó không được tính thành assertions đạt trong ledger cuối.

## Bằng chứng tiêu biểu

- [Bác sĩ hiển thị đúng hồ sơ](./demographics-regression.png).
- [Lễ tân tiếp nhận đúng ngày và có biên lai](./clinical-setup.png).
- [Bác sĩ hoàn tất ca mới](./clinical-lifecycle.png).
- [Bệnh nhân đặt trực tuyến, vẫn BOOKED](./future-booking.png).
- [Chủ bệnh án vẫn xem kết quả](./access-regression.png).

Chưa chạy lại mọi chức năng VNPay/SMTP, kê đơn/chỉ định/file, toàn bộ no-show hoặc mọi endpoint phân quyền. PDF sinh trước sửa là artifact demo lịch sử, không tự ghi đè lại nội dung. Các báo cáo mới dùng demographics hiện hành. Đợt này chưa tích hợp Agent.
