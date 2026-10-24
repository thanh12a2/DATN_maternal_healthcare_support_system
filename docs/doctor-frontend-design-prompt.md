# Prompt thiết kế Frontend Doctor

Thiết kế lại toàn bộ frontend role **DOCTOR**. Bám sát design system hiện có: sidebar giữ nguyên, layout content nổi bên phải sidebar, header có tên trang + thông báo + user chip, font Be Vietnam Pro, palette xanh nhạt/xanh đậm, hover xanh nhạt; không dùng màu hồng. Không tạo API/mock/backend mới.

## Trang cần có

- **Tổng quan:** KPI lịch khám hôm nay, patient đang chờ, encounter cần hoàn tất, tư vấn chưa đọc; timeline ca làm việc và shortcut đến lịch khám/encounter.
- **Lịch khám:** filter ngày, trạng thái, patient; danh sách appointment dạng row có giờ, patient, dịch vụ, trạng thái, phòng; chọn appointment mở detail panel và CTA mở encounter khi backend cho phép.
- **Bệnh nhân phân công:** tìm theo tên/mã patient; card/row có thông tin tối thiểu, lịch hẹn gần nhất, trạng thái encounter; không hiển thị thông tin ngoài quyền truy cập.
- **Hồ sơ khám / Encounter:** danh sách encounter được phân công; detail theo tab gồm thông tin visit, vital signs, chẩn đoán, ghi chú, đơn thuốc, treatment plan; action lưu/xác nhận chỉ khi API/state cho phép.
- **Lịch làm việc:** lịch ngày/tuần, ca khám và availability; hiển thị slot bận/rảnh theo dữ liệu backend, không tạo lịch giả.
- **Tư vấn:** danh sách cuộc hội thoại được phân công, unread badge, khung chat async, composer gửi tin; empty state khi chưa có cuộc hội thoại.
- **Hồ sơ cá nhân:** thông tin bác sĩ, chức danh, chuyên khoa, hạng tư vấn, trạng thái hoạt động; form cập nhật đúng field API cho phép.

## UX bắt buộc

- Mỗi trang có loading skeleton/fade, empty state hướng dẫn bước tiếp theo và error state có retry.
- Reuse component filter/search/list/detail giữa Lịch khám, Bệnh nhân và Encounter.
- Không bắt Doctor nhập UUID thủ công; dùng nhãn nghiệp vụ như tên patient, mã lịch hẹn, mã encounter.
- Disabled state phải nêu rõ lý do: chưa được phân công, appointment chưa check-in, encounter sai state hoặc thiếu permission.
- Không hiển thị action thuộc Receptionist/Admin như admit, thu tiền, credit approval hoặc queue override.
