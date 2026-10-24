# Prompt thiết kế Frontend Receptionist

Thiết kế lại toàn bộ frontend role **RECEPTIONIST**. Bám sát design system hiện có: sidebar giữ nguyên, layout content nổi bên phải sidebar, header có tên trang + thông báo + user chip, font Be Vietnam Pro, palette xanh nhạt/xanh đậm, hover xanh nhạt; không dùng màu hồng. Không tạo API/mock/backend mới.

## Trang cần có

- **Tổng quan:** KPI lịch hẹn hôm nay, chờ tiếp nhận, đã check-in, hóa đơn chờ xử lý; danh sách việc cần làm và shortcut thao tác.
- **Bệnh nhân:** tìm theo họ tên, SĐT, CCCD; kết quả card/row có tên, SĐT, CCCD masked, ngày sinh; chọn patient mở detail ngắn và CTA xem lịch hẹn/tiếp nhận.
- **Lịch khám:** filter ngày, trạng thái, tên/SĐT; row appointment có mã lịch, bệnh nhân, dịch vụ, giờ, trạng thái; detail panel và CTA mở tiếp nhận. Chỉ hiển thị appointmentCode, không hiển thị UUID.
- **Tiếp nhận:** stepper `Tìm patient → Chọn lịch hẹn → Mở case`; hiển thị trạng thái reception case.
- **Check-in:** stepper `Xác minh danh tính → Admit/Check-in → Queue ticket`; card patient/appointment và trạng thái payment/admission/ticket.
- **Hàng đợi:** chọn stage/phòng; ticket board có mã ticket, bệnh nhân, thời gian, trạng thái, phòng; actions gọi tiếp theo, bắt đầu, hoàn tất, gọi lại/hủy có confirmation.
- **Hóa đơn:** tìm theo patient/appointment; danh sách invoice gồm mã, patient, lịch hẹn, tổng/còn lại/trạng thái; detail drawer, thu tiền mặt/xác minh chuyển khoản khi backend cho phép. Không hiện action Admin-only như credit approval.

## UX bắt buộc

- Reuse component search patient giữa Bệnh nhân, Lịch khám, Tiếp nhận, Check-in.
- Không bắt Receptionist nhập UUID thủ công.
- Dùng skeleton/fade loading hiện có.
- Empty state phải hướng dẫn bước tiếp theo, không dùng placeholder “Tính năng chưa khả dụng”.
- Error state hiển thị lỗi API thân thiện và nút thử lại.
- Disabled state nêu rõ thiếu patient/appointment/case hoặc backend state chưa hợp lệ.
