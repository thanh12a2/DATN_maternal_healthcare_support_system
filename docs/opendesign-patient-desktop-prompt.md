# Prompt OpenDesign — An Tâm Medical Patient Portal (Desktop)

> Dùng nguyên prompt bên dưới cho OpenDesign. Chỉ thiết kế giao diện desktop; không làm mobile, không code, không tạo thêm portal staff.

---

Thiết kế **desktop web UI** cho **An Tâm Medical – Patient Portal**, một cổng thông tin cho bệnh nhân tại phòng khám tư nhân hỗ trợ chăm sóc thai sản.

## Style bắt buộc

Giữ đúng visual language frontend hiện có:

- Font: **Be Vietnam Pro**.
- Nền: `#F6FAFD`; card: trắng `#FFFFFF`.
- Text chính: `#183153`; muted: `#6F7F8F`; border: `#DFEAF3`.
- Primary blue: `#1677FF`; deep navy: `#0B4F9C`; soft blue: `#EAF4FF`.
- Success: `#20B486`; error: `#EF5350`.
- Private clinic hiện đại, an tâm, sáng, rõ ràng; không phải generic admin dashboard.
- Sidebar trái trắng bo góc lớn, topbar tối giản, card trắng bo 20–30px, border mảnh, navy shadow mềm.
- Dùng icon line SVG; không emoji, không stock photo, không dark mode, không palette hồng stereotype.
- Có floating virtual-assistant mascot ở góc phải dưới, nhưng không che CTA.

## App shell

Thiết kế một desktop shell nhất quán:

- Sidebar: logo **An Tâm Medical**, menu Tổng quan, Hồ sơ, Đặt lịch, Lịch hẹn, Hàng đợi khám, Thông báo, Hóa đơn, Tư vấn; nút Đăng xuất cuối sidebar.
- Topbar: page eyebrow/title, notification bell, avatar + tên bệnh nhân.
- Content desktop rộng, thoáng, tập trung vào một nhiệm vụ chính mỗi trang.

## Thiết kế 6 màn hình chính

1. **Tổng quan**
   - Lời chào và card trạng thái hồ sơ.
   - Lịch hẹn sắp tới, hàng đợi hiện tại, thông báo chưa đọc, hóa đơn cần chú ý dưới dạng card gọn.
   - Nếu chưa có dữ liệu, dùng empty state thân thiện, không tạo dữ liệu giả quá chi tiết.

2. **Hồ sơ bệnh nhân**
   - Header, progress hoàn thiện hồ sơ.
   - Form hành chính: thông tin cá nhân, liên hệ/địa chỉ, giấy tờ định danh.
   - Khối liên hệ khẩn cấp: list card, thêm/chỉnh sửa, nhãn Liên hệ chính.
   - Không hiển thị bệnh án, chẩn đoán hoặc thông tin lâm sàng tại đây.

3. **Đặt lịch khám**
   - Flow đơn giản trong một trang hoặc stepper: chọn dịch vụ → chọn bác sĩ hoặc hạng tư vấn → chọn ngày giờ → xác nhận.
   - Khi giữ slot, thể hiện countdown 5 phút rõ ràng.
   - Summary panel ở bên phải: dịch vụ, bác sĩ/hạng, giờ khám và giá nếu có.
   - Trạng thái slot hết chỗ/hết hạn cần rõ ràng.

4. **Lịch hẹn của tôi**
   - Danh sách lịch sắp tới và lịch đã qua.
   - Appointment detail hiển thị dịch vụ, bác sĩ/hạng, thời gian, hướng dẫn đến khám và queue estimate với nhãn **Dự kiến**.
   - Patient **không có nút hủy hoặc đổi lịch**; thay bằng CTA “Liên hệ phòng khám để thay đổi lịch”.

5. **Hàng đợi khám**
   - Khi đã check-in: ticket code, khu vực/chặng khám, số người phía trước, ETA và thời điểm cập nhật.
   - Timeline trạng thái: Đã check-in → Đang chờ được gọi → Đang khám.
   - Empty state khi chưa check-in: giải thích bệnh nhân sẽ nhận số thứ tự tại quầy lễ tân.
   - Không có staff controls như gọi lượt, start, complete.

6. **Thông báo và hóa đơn**
   - Thiết kế dạng tab trong một trang: Thông báo | Hóa đơn.
   - Notification list có read/unread, ngày nhận, preview an toàn không lộ chi tiết y tế.
   - Invoice list/detail hiển thị trạng thái, các khoản phí, tổng tiền và phương thức thanh toán là Cash hoặc Chuyển khoản thủ công.
   - Không có payment gateway, QR payment giả, refund hoặc credit-card checkout.

## Business constraints

- Bệnh nhân hoàn thiện hồ sơ hành chính trước; dữ liệu khám/chẩn đoán không nằm trong profile.
- Queue ticket chỉ có sau khi bệnh nhân check-in tại quầy lễ tân và hoàn tất điều kiện tiếp nhận.
- Patient không tự cancel/reschedule.
- Không thiết kế BHYT, đa cơ sở, refund, mixed payment, pharmacy, video call hay AI diagnosis.

## States cần thể hiện

Cho ít nhất các màn hình quan trọng, hãy minh họa ngắn gọn: loading, empty, error, disabled/submitting, success và unavailable state.

## Kết quả mong muốn

Tạo một thiết kế desktop đồng nhất gồm 6 màn hình trên, dùng chung sidebar/topbar/design tokens/component styles. Ưu tiên tính rõ ràng, tin cậy và dễ sử dụng cho bệnh nhân hơn là nhiều hiệu ứng hoặc nhiều dữ liệu.
