# OpenDesign Prompt — Role-aware Sidebar cho 5 Actor

## Mục tiêu

Mở rộng frontend hiện tại để hỗ trợ 5 actor theo role-based navigation: PATIENT, DOCTOR, RECEPTIONIST, NURSE và ADMIN.

**Không thiết kế lại toàn bộ sản phẩm.** Không tạo giao diện mới độc lập. Chỉ bổ sung những navigation item, nhóm menu, route guard và trạng thái cần thiết nhất vào thiết kế đang có.

## Prompt gửi OpenDesign

Hãy mở rộng frontend hiện tại thành giao diện hỗ trợ nhiều role dựa trên backend contracts đang có, nhưng không thiết kế lại toàn bộ sản phẩm.

### Bối cảnh bắt buộc

Auth Service hiện có đúng 5 role cố định: PATIENT, DOCTOR, RECEPTIONIST, NURSE và ADMIN. Role được lấy từ authenticated user/JWT qua user.role. Không được tạo role mới.

Frontend hiện tại mới hỗ trợ hoàn chỉnh Patient Portal. Hãy giữ nguyên Patient Portal và mở rộng sidebar theo role.

## 1. Giữ nguyên thiết kế hiện tại

Giữ nguyên visual language của Patient Portal:

- Sidebar cố định bên trái.
- Card bo góc lớn.
- Nền xanh/xám rất nhạt.
- Card nền trắng.
- Accent màu xanh dương.
- Typography, font và design tokens hiện tại.
- Icon SVG đơn giản.
- Active menu có nền xanh nhạt.
- Sidebar collapsed và mobile drawer.
- Topbar, content spacing, border, shadow và radius hiện tại.

Giữ nguyên logo An Tâm Medical, hamburger, collapse/expand, active route, logout và responsive behavior. Chỉ thay đổi nội dung menu theo role. Không redesign sidebar thành visual style hoàn toàn khác.

## 2. Role-aware navigation

Dùng một sidebar component dùng chung, nhưng nội dung menu thay đổi theo role. Không hiển thị toàn bộ menu của tất cả role cùng lúc. Mỗi user chỉ nhìn thấy menu phù hợp với role và permission hiện tại.

Role badge hiển thị ngắn gọn: Bệnh nhân, Bác sĩ, Lễ tân, Điều dưỡng hoặc Quản trị viên.

Nếu user có nhiều role, ưu tiên role backend trả trong session/JWT. Không tự suy diễn role khác ở frontend.

## 3. Navigation cho PATIENT

Giữ nguyên Patient Portal hiện tại. Menu chính:

- Tổng quan
- Hồ sơ của tôi
- Đặt lịch khám
- Lịch hẹn của tôi
- Hàng đợi khám
- Thông báo
- Hóa đơn
- Cài đặt tài khoản

Giữ nguyên route hiện tại: /tong-quan, /ho-so, /dat-lich, /lich-hen, /hang-doi và /thong-bao-hoa-don. Không xóa hoặc thay thế Patient Portal.

## 4. Navigation cho DOCTOR

Nhóm Tổng quan: Tổng quan; Lịch khám của tôi; Bệnh nhân được phân công.

Nhóm Khám và hồ sơ: Hồ sơ khám; Ghi chú lâm sàng; Chẩn đoán; Y lệnh/dịch vụ cận lâm sàng; Thai kỳ; Kế hoạch điều trị.

Nhóm Lịch làm việc: Lịch làm việc; Ngoại lệ lịch/Nghỉ.

Nhóm Tư vấn: Tư vấn trực tuyến; Escalation cần xử lý.

Nhóm Tài khoản: Hồ sơ bác sĩ; Thông báo; Cài đặt tài khoản.

Nếu backend/UI chưa có implementation, dùng placeholder, loading/empty state hoặc “Tính năng đang được triển khai”. Không dùng mock data gây hiểu nhầm là API thật.

## 5. Navigation cho RECEPTIONIST

Nhóm Tổng quan: Dashboard; Công việc hôm nay.

Nhóm Tiếp nhận: Tiếp nhận bệnh nhân; Tra cứu bệnh nhân; Tra cứu lịch hẹn; Xác minh thông tin; Hồ sơ tiếp nhận.

Nhóm Lịch hẹn: Danh sách lịch hẹn; Đặt lịch tại quầy; Walk-in; Check-in; Hủy/đổi lịch theo quyền.

Nhóm Hàng đợi: Hàng đợi hiện tại; Cấp số; Theo dõi trạng thái queue.

Nhóm Thanh toán: Điều kiện thanh toán; Hóa đơn; Xác nhận thanh toán thủ công.

Nhóm Tài khoản: Hồ sơ cá nhân; Thông báo; Cài đặt tài khoản.

Các chức năng chưa có backend implementation phải được đánh dấu “Đang được triển khai”. Không thiết kế flow giả nếu API chưa tồn tại.

## 6. Navigation cho NURSE

NURSE là role chính thức trong Auth Service. Repository có bằng chứng Medical Record Service cho phép NURSE thực hiện một số thao tác clinical/support: ghi nhận sinh hiệu, thêm ghi chú, cập nhật kết quả hoặc order được phân công và theo dõi encounter được phân công.

Permission matrix riêng cho NURSE chưa đầy đủ. Vì vậy NURSE phải được hiểu là clinical/support workflow theo assignment và permission.

Menu NURSE: Dashboard; Công việc hôm nay; Bệnh nhân hôm nay; Hàng đợi hiện tại; Bệnh nhân đang chờ; Gọi bệnh nhân tiếp theo; Cập nhật trạng thái phục vụ; Encounter được phân công; Hồ sơ khám; Ghi nhận sinh hiệu; Ghi chú điều dưỡng; Kết quả/order được phân công; Bệnh nhân đang khám; Chờ bác sĩ; Chờ kết quả; Đã hoàn tất; Hồ sơ cá nhân; Thông báo; Cài đặt tài khoản.

Không hiển thị mặc định cho NURSE: quản lý bác sĩ, quản lý bảng giá, quản lý tài khoản, chẩn đoán độc lập, kê đơn, finalize bệnh án, sửa clinical data ngoài assignment, hủy/reschedule appointment hoặc quản trị hệ thống.

Nếu permission chưa được backend xác nhận, ẩn item hoặc hiển thị “Chưa được cấp quyền”. Không mở quyền cho NURSE chỉ vì menu được thiết kế.

## 7. Navigation cho ADMIN

Nhóm Tổng quan: Dashboard; Báo cáo vận hành; Công việc cần xử lý.

Nhóm Người dùng và phân quyền: Tài khoản; Phân quyền; Bác sĩ; Lễ tân; Điều dưỡng; Bệnh nhân.

Nhóm Chuyên môn: Chuyên khoa; Rank bác sĩ; Phân công bác sĩ; Hồ sơ bác sĩ.

Nhóm Lịch làm việc: Lịch bác sĩ; Availability; Ngoại lệ lịch; Lịch bổ sung.

Nhóm Dịch vụ và giá: Dịch vụ khám; Danh mục dịch vụ; Bảng giá; Phụ phí theo rank.

Nhóm Lịch hẹn và vận hành: Tất cả lịch hẹn; Reassignment; Tiếp nhận; Check-in; Hàng đợi.

Nhóm Hồ sơ y khoa: Encounter; Assignment; Clinical review; Amendment; Quyền truy cập hồ sơ.

Nhóm Hệ thống: Audit log; Báo cáo; Notification configuration; Cấu hình hệ thống.

Admin không mặc định được đọc toàn bộ dữ liệu y tế nhạy cảm. Admin vẫn phải tuân thủ permission và audit.

## 8. Role-aware routing

Route guard cần thể hiện rõ: chưa đăng nhập → /dang-nhap; PATIENT → Patient Portal; DOCTOR → Doctor Workspace; RECEPTIONIST → Reception Workspace; NURSE → Nurse Workspace; ADMIN → Admin Workspace.

User truy cập route không thuộc role phải thấy trạng thái 403 — Bạn không có quyền truy cập. Không redirect vòng lặp. Không hiển thị Patient Portal cho DOCTOR, RECEPTIONIST, NURSE hoặc ADMIN. Frontend guard chỉ là lớp UX; backend authorization vẫn là lớp bảo mật cuối cùng.

Role hợp lệ nhưng workspace chưa được provision phải hiển thị: Tài khoản đã đăng nhập nhưng workspace chưa được cấu hình. Vui lòng liên hệ quản trị viên.

## 9. Landing page sau đăng nhập

- PATIENT: Tổng quan chăm sóc cá nhân.
- DOCTOR: Tổng quan công việc lâm sàng.
- RECEPTIONIST: Tổng quan tiếp nhận và vận hành.
- NURSE: Tổng quan điều dưỡng và bệnh nhân hôm nay.
- ADMIN: Tổng quan quản trị hệ thống.

Mỗi dashboard chỉ cần card quan trọng nhất: việc cần xử lý, lịch hôm nay, bệnh nhân/lịch hẹn liên quan, cảnh báo và shortcut. Không cần tạo dashboard quá phức tạp.

## 10. Trạng thái bắt buộc

Mỗi role workspace cần có loading, empty, error, 403 Forbidden, 401 Session expired, 404 Not found, 503 Service unavailable, tính năng chưa được backend expose và tài khoản chưa được provision. Không hiển thị màn hình trống hoặc sidebar không có menu.

## 11. Không tự phát minh API

Chỉ thiết kế dựa trên API/backend capability đã tồn tại hoặc đã được xác nhận trong repository. Nếu chức năng chưa có API, dùng placeholder ngắn gọn, gắn nhãn “Đang được triển khai”, không tạo dữ liệu giả như dữ liệu thật, không tự đặt endpoint mới, không tự tạo permission mới và không tự mở quyền cho role.

## 12. Ràng buộc không được vi phạm

- Không redesign toàn bộ Patient Portal.
- Không đổi màu, font hoặc layout sidebar.
- Không đổi cơ chế collapse/mobile drawer.
- Không xóa tab Patient hiện tại.
- Không đổi role enum hoặc thêm role mới.
- Không cho NURSE quyền giống DOCTOR mặc định.
- Không cho ADMIN quyền đọc toàn bộ PHI mặc định.
- Không đưa business logic vào sidebar.
- Không gộp mọi role vào một menu khổng lồ.
- Không hiển thị tab không thuộc role hiện tại.
- Không dùng mock data để giả lập API đã có.

Chỉ được bổ sung role badge, role-aware navigation, nhóm menu cần thiết, route guard, dashboard placeholder tối thiểu và empty/loading/403 states.

## 13. Deliverables cần trả về

1. Role-aware sidebar design.
2. Navigation map cho cả 5 role.
3. Route map theo role.
4. Role/access matrix.
5. Menu dùng API đã có.
6. Menu chỉ là placeholder vì backend chưa expose.
7. Quyền của NURSE cần cấu hình thêm ở backend.
8. Phần được giữ nguyên từ Patient Portal.
9. Thay đổi tối thiểu cần thực hiện trong frontend.
10. Xác nhận không tạo redesign mới ngoài phạm vi.

Mục tiêu cuối cùng: một sidebar dùng chung cùng visual style hiện tại, nhưng hiển thị menu chính xác theo user.role. PATIENT thấy menu Patient; DOCTOR thấy menu Doctor; RECEPTIONIST thấy menu Receptionist; NURSE thấy menu Nurse; ADMIN thấy menu Admin.