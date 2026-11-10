# Đề xuất lịch làm việc và phân phòng cho điều dưỡng

Ngày: 2026-11-08 · Trạng thái: **Đề xuất để review, chưa triển khai**.

## 1. Bác sĩ đang được quản lý thế nào?

Lịch nằm trong **`doctor-service`**, cùng danh mục phòng `ClinicRoom`.

| Thành phần | Cách hoạt động hiện tại |
|---|---|
| `DoctorSchedule` | Lặp theo thứ trong tuần; giờ bắt đầu/kết thúc; ngày hiệu lực; phòng; thời lượng slot khám. |
| `DoctorAvailability` | Ngoại lệ theo thời gian cụ thể: nghỉ (`UNAVAILABLE`) hoặc làm thêm (`EXTRA_AVAILABLE`). |
| Lịch thực tế | Lịch tuần + làm thêm − khoảng nghỉ. Lịch hẹn đã đặt được xử lý riêng bởi Appointment. |
| Người quản lý | Admin/Clinic Manager tạo, sửa, hủy lịch. Bác sĩ được khai khoảng nghỉ của mình; không tự thêm ca. |
| Kiểm tra | Chặn lịch tuần trùng giờ của cùng bác sĩ và lịch hai bác sĩ cùng phòng. Sửa/hủy kiểm tra version; thay đổi được ghi audit. |
| Giao diện | Bác sĩ xem lịch làm việc và lịch hẹn. Trang quản lý hiện có danh sách lịch; backend đã có API tạo/sửa/hủy. |

Nguồn: [schema](../services/prisma/doctor/schema.prisma), [logic lịch và ngoại lệ](../services/apps/doctor-service/src/doctors/doctor.service.ts) (`createSchedule`, `assertNoScheduleOverlap`, `listAvailability`), [giao diện bác sĩ](../frontend/src/modules/doctor/components/DoctorProfileSchedule.tsx).

## 2. Áp dụng cho điều dưỡng được không?

**Có. Dùng lại cơ chế lịch tuần + ngoại lệ + phòng**, với các điều chỉnh:

| Nội dung | Áp dụng cho điều dưỡng |
|---|---|
| Người được xếp lịch | Dùng `nurseAccountId` từ Auth; xác minh tài khoản có role NURSE và còn hoạt động. |
| Phòng | `roomId` bắt buộc; dùng chung danh mục `ClinicRoom`. |
| Slot khám | Không cần `slotDurationMinutes`; điều dưỡng làm theo ca. |
| Trùng giờ | Một điều dưỡng không được có hai ca trùng nhau. Cho phép bác sĩ và nhiều điều dưỡng cùng phòng. |
| Nghỉ/làm thay | Dùng ngoại lệ có thời gian cụ thể; kiểm tra trùng trên lịch thực tế sau khi áp dụng ngoại lệ. |
| Đổi phòng giữa ca | Quản lý kết thúc phần phân công cũ và tạo phần mới; lưu lý do, không ghi đè lịch sử. |

Ví dụ: Hương làm P.201, thứ Hai–thứ Sáu, 07:30–11:30. Khi nghỉ sáng thứ Tư, quản lý thêm ngoại lệ nghỉ cho Hương và ca thay cho Lan tại P.201.

## 3. Đề xuất triển khai tối thiểu

**Thêm module lịch điều dưỡng trong `doctor-service`**, vì service này đang sở hữu phòng và logic lịch. Chưa tạo `nurse-service` hoặc `staffing-service`.

- Thêm hai bảng riêng: `NurseSchedule` và `NurseAvailability`, theo cấu trúc lịch bác sĩ nhưng bỏ slot khám, bắt buộc phòng.
- Tách hàm tính khoảng làm việc và kiểm tra thời gian để dùng chung; không đưa điều dưỡng vào bảng Doctor hoặc dùng `doctorId` thay cho định danh điều dưỡng.
- Admin/Clinic Manager quản lý lịch điều dưỡng; điều dưỡng xem lịch của mình.
- Thêm mục **“Lịch điều dưỡng”** trong trang quản lý và **“Ca/phòng hiện tại”** trong workspace điều dưỡng.

Đây là đề xuất mở rộng phạm vi `doctor-service` sang lịch nhân sự hỗ trợ tại phòng; không bổ sung quản lý lương, chấm công hay hồ sơ HR. Thay thế đề xuất tạo Staffing Service trước đó để tận dụng phần đã có.

## 4. Lịch phải quyết định quyền vào phòng

1. Backend tính ca hiện tại từ lịch tuần và ngoại lệ của điều dưỡng.
2. Workspace chỉ mở bàn làm việc của phòng được phân công; chưa có ca thì không cho thao tác tại phòng.
3. Queue/Medical/Document xác minh phân công qua API nội bộ gRPC trước thao tác; không tin phòng do frontend gửi lên.
4. Nhập sinh hiệu/ghi chú/upload còn phải đúng lượt khám đang được chăm sóc tại phòng. Lịch phòng không tự cấp quyền xem toàn bộ bệnh án.
5. Hết ca, nghỉ hoặc bị điều chuyển thì quyền thao tác theo phòng cũ hết hiệu lực. Không chọn phòng mặc định khi thiếu phân công.

**Điều kiện nghiệm thu:** ca đúng được vào phòng; sai phòng/ngoài ca bị từ chối; nghỉ và làm thay có hiệu lực; không xếp trùng giờ một điều dưỡng; nhiều điều dưỡng được cùng phòng; phân công phòng không cấp quyền chẩn đoán/kê đơn/finalize.
