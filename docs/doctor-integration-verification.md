# Kiểm tra tích hợp Doctor

## Định danh tư vấn

Contract `consultation-service-spec.md` quy định `doctorId` là business ID thuộc Doctor Service, khác JWT subject. Kiểm tra chỉ đọc trên hai database cục bộ ngày 2026-10-29: 4 hội thoại có phân công đều khớp doctor ID; 0 khớp riêng account ID; 0 không khớp. Đây là số lượng tổng hợp trong môi trường được kiểm tra, không đại diện cho database khác. Không có dữ liệu nào được chuyển đổi.

Consultation Service tra account sang doctor qua gRPC và kiểm tra assignment ACTIVE với hội thoại chưa đóng. Hội thoại đã đóng cho phép bác sĩ cuối cùng đọc lại; gửi tin cho hội thoại đã đóng bị từ chối. Các instance Doctor và Consultation phải cùng hỗ trợ proto `ResolveDoctorByAccount`.

## Encounter và tài nguyên lâm sàng

Doctor chỉ bắt đầu encounter khi Appointment Service xác nhận lịch đã check-in, có cùng encounter và bác sĩ được phân công. Ghi chú, chẩn đoán và dấu hiệu sinh tồn của Doctor kiểm tra assignment ACTIVE, trạng thái IN_PROGRESS và expectedVersion trong transaction. Chuyển duyệt và hoàn tất yêu cầu version. Kiểm tra check-in là một lời gọi giữa service, không phải transaction phân tán; cần kiểm thử cạnh tranh trạng thái với admission.

Prescription và Treatment Plan kiểm tra assignment qua Medical Record và Doctor Service khi Doctor đọc theo encounter. Việc tạo/sửa/phát hành/hủy từ Doctor hiện trả `CLINICAL_WRITE_NOT_AVAILABLE` vì các thao tác REST hiện có chưa bảo đảm atomic state/version và phân quyền xuyên service. Những client Doctor từng dựa vào hành vi cũ sẽ bị ảnh hưởng; client vai trò khác không thay đổi trong phần này.

## Cần triển khai và kiểm thử

- Áp dụng migration Consultation read receipts cho môi trường kiểm thử và triển khai đồng bộ các service/proto trước khi kiểm tra chat và unread.
- Kiểm tra dữ liệu phân công ở từng môi trường khác trước khi chuyển quy ước; không tự động đổi các ID không xác định.
- Chạy kiểm thử tích hợp với ít nhất hai tài khoản Doctor, hai encounter, lịch chưa/đã check-in, trạng thái cũ và dependency unavailable. Xác minh không đọc hoặc sửa chéo.
- Kiểm tra các luồng trạng thái encounter/appointment và queue khi bắt đầu/hoàn tất; chưa có bằng chứng E2E cho các side effect liên service.
- Kiểm thử chi tiết prescription và treatment plan, các lỗi mất kết nối và migration thực tế; phần ghi hai tài nguyên vẫn chưa được triển khai.
