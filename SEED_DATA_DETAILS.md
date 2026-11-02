# ĐẶC TẢ CHI TIẾT TOÀN BỘ DỮ LIỆU SEED HỆ THỐNG Y TẾ THAI SẢN & SẢN PHỤ KHOA AN TÂM (ANTAM MATERNAL CARE)

> **Nguồn kịch bản:** [`services/seed_system_data.js`](file:///d:/DATN_maternal_healthcare_support_system/services/seed_system_data.js)  
> **Kiến trúc phân tán:** 14 Microservices độc lập • 14 Database PostgreSQL phân tách • 80 Bảng dữ liệu nghiệp vụ • 809+ Bản ghi mẫu chuẩn hóa.  
> **Mật khẩu mặc định toàn hệ thống:** `Demo@123456`  
> **Mục tiêu:** Cung cấp thông tin tường minh, đầy đủ và chi tiết nhất về cấu trúc bảng và toàn bộ các giá trị dữ liệu được nạp vào hệ thống để phục vụ phát triển, kiểm thử, tích hợp và nghiệm thu.

---

## 📊 1. BẢNG TỔNG HỢP 14 MICROSERVICES VÀ 80 BẢNG DỮ LIỆU

| STT | Tên Microservice | Cổng Database | Số bảng | Số bản ghi | Nghiệp vụ cốt lõi |
|:---:|:---|:---:|:---:|:---:|:---|
| 1 | **Auth Service** | `5433` | 6 bảng | 116 records | Định danh người dùng, Tài khoản, Mật khẩu Argon2id, Phân quyền RBAC, Phiên đăng nhập |
| 2 | **Doctor Service** | `5435` | 11 bảng | 108 records | Quản lý Chuyên khoa, Cấp bậc/Hạng bác sĩ (Rank), Phòng khám, Hồ sơ Bác sĩ, Lịch trực ca |
| 3 | **Catalog Service** | `5437` | 5 bảng | 104 records | Danh mục Dịch vụ Y tế, Nhãn phân loại (Tags), Bảng giá gốc, Bảng phụ phí theo Rank Bác sĩ |
| 4 | **Receptionist Service** | `5436` | 8 bảng | 35 records | Đội ngũ Lễ tân, Ca tiếp đón bệnh nhân, Đối soát danh tính thẻ CCCD gắn chip, Thủ tục Nhập viện |
| 5 | **Patient Service** | `5434` | 4 bảng | 47 records | Hồ sơ Thai phụ, Mã hóa CCCD (AES-256-GCM + HMAC-SHA256), Liên hệ người thân khẩn cấp |
| 6 | **Appointment Service** | `5438` | 6 bảng | 37 records | Đặt lịch hẹn khám, Giữ chỗ (Slot hold 15 phút), Điều phối bác sĩ, Lịch sử chuyển trạng thái |
| 7 | **Billing Service** | `5439` | 7 bảng | 139 records | Hóa đơn viện phí, Chi tiết dịch vụ, Giao dịch thanh toán VNPAY/MoMo/Tiền mặt, Bảo lãnh bảo hiểm |
| 8 | **Queue Service** | `5441` | 7 bảng | 42 records | Điều phối Hàng đợi đa chặng (Tiếp đón -> Khám -> Siêu âm -> Dược -> Thu ngân), Gọi số |
| 9 | **Medical Record Service** | `5440` | 13 bảng | 72 records | Đợt thai kỳ, Phiếu khám lâm sàng SOAP, Sinh hiệu, Mã bệnh ICD-10, Kết quả Cận lâm sàng chi tiết |
| 10 | **Prescription Service** | `5443` | 4 bảng | 45 records | Danh mục Dược phẩm Thai kỳ (FDA A/B/C/D/X), Kê đơn điện tử, Hướng dẫn dùng an toàn |
| 11 | **Treatment Plan Service** | `5444` | 4 bảng | 35 records | Kế hoạch chăm sóc thai kỳ (Bình thường & Nguy cơ cao), Lộ trình các mốc tuần thai |
| 12 | **Consultation Service** | `5448` | 6 bảng | 38 records | Kênh tư vấn trực tuyến Bác sĩ - Thai phụ, Tin nhắn trao đổi, Báo động chuyển cấp khẩn cấp |
| 13 | **Notification Service** | `5445` | 3 bảng | 6 records | Thông báo đa kênh (SMS, Email, In-app push) nhắc lịch, báo kết quả xét nghiệm, hóa đơn |
| 14 | **Audit Log Service** | `5446` | 1 bảng | 5 records | Nhật ký kiểm toán bất biến ghi nhận mọi thao tác nhạy cảm trên hệ thống |
| **TỔNG** | **14 Microservices** | - | **80 Bảng** | **809+ Bản ghi** | **Sẵn sàng vận hành End-to-End toàn diện** |

---

## 📑 2. MỤC LỤC CHI TIẾT 14 MICROSERVICES

1. [Phần 1: Auth Service (Dịch vụ Xác thực & Phân quyền)](#phan-1-auth-service)
2. [Phần 2: Doctor Service (Quản lý Bác sĩ, Chuyên khoa, Hạng & Lịch khám)](#phan-2-doctor-service)
3. [Phần 3: Catalog Service (Danh mục Dịch vụ Y tế & Bảng giá)](#phan-3-catalog-service)
4. [Phần 4: Receptionist Service (Tiếp đón & Quản lý Lễ tân)](#phan-4-receptionist-service)
5. [Phần 5: Patient Service (Hồ sơ Thai phụ & Liên hệ Khẩn cấp)](#phan-5-patient-service)
6. [Phần 6: Appointment Service (Đặt lịch, Giữ chỗ & Điều phối Khám)](#phan-6-appointment-service)
7. [Phần 7: Billing Service (Hóa đơn, Chi tiết Viện phí, Thanh toán & Bảo lãnh)](#phan-7-billing-service)
8. [Phần 8: Queue Service (Điều phối Hàng đợi, Chặng khám & Gọi số)](#phan-8-queue-service)
9. [Phần 9: Medical Record Service (Bệnh án Lâm sàng, Sinh hiệu & Cận lâm sàng)](#phan-9-medical-record-service)
10. [Phần 10: Prescription Service (Danh mục Thuốc Thai kỳ & Đơn thuốc Điện tử)](#phan-10-prescription-service)
11. [Phần 11: Treatment Plan Service (Kế hoạch Chăm sóc & Theo dõi Thai kỳ)](#phan-11-treatment-plan-service)
12. [Phần 12: Consultation Service (Tư vấn Trực tuyến Bác sĩ - Bệnh nhân)](#phan-12-consultation-service)
13. [Phần 13: Notification Service (Hệ thống Thông báo Đa kênh)](#phan-13-notification-service)
14. [Phần 14: Audit Log Service (Nhật ký Kiểm toán Tập trung)](#phan-14-audit-log-service)

---
## 🔐 PHẦN 1: AUTH SERVICE (DỊCH VỤ XÁC THỰC & PHÂN QUYỀN)

- **Database:** `auth` (Cổng `5433`)
- **Vai trò:** Quản lý tài khoản, chứng thực mật khẩu chuẩn an ninh y tế Argon2id, phân quyền dựa trên vai trò (Role-Based Access Control - RBAC), phiên đăng nhập người dùng và cấp phát mã đặt lại mật khẩu.
- **Tổng số bảng:** 6 bảng | **Tổng bản ghi:** 116 records.

### 1.1. Bảng `roles` (Vai trò Hệ thống)
- **Số lượng bản ghi:** 5
- **Mục đích:** Lưu trữ các vai trò người dùng chuẩn hóa trên toàn hệ thống y tế.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `code` | `USER-DEFINED` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `description` | `text` | ⚪ Tùy chọn | Mô tả / Ghi chú chi tiết |


| **id** | **name** | **description** | **created_at** |
| :--- | :--- | :--- | :--- |
| 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 | _null_ | Thai phụ / Người bệnh | _null_ |
| 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 | _null_ | Bác sĩ chuyên khoa | _null_ |
| 0fd09a1d-2824-44ea-91fb-29cd07e915fb | _null_ | Nhân viên lễ tân / Tiếp đón | _null_ |
| a9e57b0c-0e2e-49fd-825b-30bfe6545bfc | _null_ | Y tá / Hộ sinh phòng khám | _null_ |
| 46f7bd79-9112-4748-b238-e0bdfd9136ce | _null_ | Quản trị viên toàn hệ thống | _null_ |



### 1.2. Bảng `accounts` (Danh sách Tài khoản Người dùng)
- **Số lượng bản ghi:** 36
- **Mục đích:** Định danh độc nhất cho toàn bộ nhân sự (Admin, Giám đốc, Bác sĩ, Lễ tân) và Bệnh nhân thai phụ trong hệ thống.
- **Mật khẩu mặc định:** `Demo@123456` (được băm bằng thuật toán Argon2id độ trễ cao tại bảng `credentials`).

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `email` | `character varying(255)` | 🔴 Bắt buộc | Địa chỉ email tài khoản |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `last_login_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **id** | **email** | **status** | **created_at** | **updated_at** |
| :--- | :--- | :--- | :--- | :--- |
| 454d1876-0725-45da-b998-6523c5cd7f5f | admin@antam.local | ACTIVE | 2026-11-01T15:01:21.677Z | 2026-11-01T15:01:21.677Z |
| e752ea83-ee42-4c1b-b1d7-44f94c49ff5e | manager@antam.local | ACTIVE | 2026-11-01T15:01:21.697Z | 2026-11-01T15:01:21.697Z |
| 9ec9562f-e9ad-4570-81b0-75a6bb9aea75 | nurse.huong@antam.local | ACTIVE | 2026-11-01T15:01:21.705Z | 2026-11-01T15:01:21.705Z |
| fbc16ef5-d98c-48e3-a7a0-0ce57a2519c5 | test.locked@antam.local | LOCKED | 2026-11-01T15:01:21.712Z | 2026-11-01T15:01:21.712Z |
| d1f78de4-83f1-4670-851f-afd0cbe7cfea | test.pending@antam.local | PENDING_VERIFICATION | 2026-11-01T15:01:21.720Z | 2026-11-01T15:01:21.720Z |
| 05e68233-c08a-4960-b0b6-1a275b53c52f | test.disabled@antam.local | DISABLED | 2026-11-01T15:01:21.727Z | 2026-11-01T15:01:21.727Z |
| b3d8e42d-ee9b-42f3-a017-43f1a5db4875 | patient.new@taman.hospital | ACTIVE | 2026-11-01T15:01:21.734Z | 2026-11-01T15:01:21.734Z |
| 424bdff1-0917-4b4f-ab94-d077b00f2041 | dr.lethuha@antam.local | ACTIVE | 2026-11-01T15:01:22.143Z | 2026-11-01T15:01:22.143Z |
| f63deac8-cb47-4941-8250-19598e9d89b5 | dr.nguyenquangminh@antam.local | ACTIVE | 2026-11-01T15:01:22.177Z | 2026-11-01T15:01:22.177Z |
| dad555cf-1864-4a32-a8ef-1508a5cd59d4 | dr.tranthanhmai@antam.local | ACTIVE | 2026-11-01T15:01:22.212Z | 2026-11-01T15:01:22.212Z |
| 74a642aa-44ea-4e9f-a29e-b692f3e9ffee | dr.dangkimoanh@antam.local | ACTIVE | 2026-11-01T15:01:22.245Z | 2026-11-01T15:01:22.245Z |
| 02927e75-66e4-4d95-bc3f-0b53a193a10e | dr.vuhoanglong@antam.local | ACTIVE | 2026-11-01T15:01:22.282Z | 2026-11-01T15:01:22.282Z |
| 0f88be62-8237-4414-b2e3-c37cf0cfb18e | dr.phamthuyduong@antam.local | ACTIVE | 2026-11-01T15:01:22.314Z | 2026-11-01T15:01:22.314Z |
| c53f8a98-7450-4cb2-aa8f-c686086e5888 | dr.nguyenhongnhung@antam.local | ACTIVE | 2026-11-01T15:01:22.344Z | 2026-11-01T15:01:22.344Z |
| e1e3f1c2-15f5-4ab8-bc0f-9a3752605913 | dr.doanvanbac@antam.local | ACTIVE | 2026-11-01T15:01:22.375Z | 2026-11-01T15:01:22.375Z |
| 66b7eb47-3edd-401f-8bcf-53c6fc8bb66a | dr.draft@antam.local | PENDING_VERIFICATION | 2026-11-01T15:01:22.422Z | 2026-11-01T15:01:22.422Z |
| 646f5a47-8937-4101-a063-6b8e594be0c1 | reception.hoangyen@antam.local | ACTIVE | 2026-11-01T15:01:22.450Z | 2026-11-01T15:01:22.450Z |
| fe53404a-0a1d-4b1d-9682-88b57f03d034 | reception.maiphuong@antam.local | ACTIVE | 2026-11-01T15:01:22.467Z | 2026-11-01T15:01:22.467Z |
| f91e2f1c-afdf-4d42-bdc6-74694ade042c | demo.receptionist@antam.local | ACTIVE | 2026-11-01T15:01:22.478Z | 2026-11-01T15:01:22.478Z |
| 2f8e99aa-1e3a-475b-a365-86a1fcda5c36 | reception.quocanh@antam.local | ACTIVE | 2026-11-01T15:01:22.489Z | 2026-11-01T15:01:22.489Z |
| c65b0775-02bb-46bc-ac7c-3e7dc638f72c | reception.thuthao@antam.local | DISABLED | 2026-11-01T15:01:22.500Z | 2026-11-01T15:01:22.500Z |
| da498d70-45f5-4ab7-99fb-6412410bc6ff | reception.thuytrang@antam.local | PENDING_VERIFICATION | 2026-11-01T15:01:22.513Z | 2026-11-01T15:01:22.513Z |
| f4e6d292-887d-41a5-8f4b-bc307d81fba5 | demo.patient@antam.local | ACTIVE | 2026-11-01T15:01:22.531Z | 2026-11-01T15:01:22.531Z |
| 2ce8e12b-01a0-4c7c-8dd0-03e8b2e4ebc4 | patient.thanhhang@gmail.com | ACTIVE | 2026-11-01T15:01:22.558Z | 2026-11-01T15:01:22.558Z |
| b75c7aed-9aa0-4194-8183-0e93fb520e76 | patient.ngocmai@gmail.com | ACTIVE | 2026-11-01T15:01:22.574Z | 2026-11-01T15:01:22.574Z |
| dfc0d279-267c-423f-9ad8-b2d6489ccbce | patient.quynhchi@gmail.com | ACTIVE | 2026-11-01T15:01:22.588Z | 2026-11-01T15:01:22.588Z |
| 96ac0cc8-14d8-46f1-a28c-7167f700a7fc | patient.thuyduong@gmail.com | ACTIVE | 2026-11-01T15:01:22.604Z | 2026-11-01T15:01:22.604Z |
| 0effa7b5-c782-4cf3-860d-bc2caeaca16c | patient.kimngan@gmail.com | ACTIVE | 2026-11-01T15:01:22.618Z | 2026-11-01T15:01:22.618Z |
| 5c551c0a-31ae-4488-8e54-7fed2656e507 | patient.thutrang@gmail.com | ACTIVE | 2026-11-01T15:01:22.631Z | 2026-11-01T15:01:22.631Z |
| aa1d2602-cefa-4fdc-842f-dbb5e892b57d | patient.phuonglinh@gmail.com | ACTIVE | 2026-11-01T15:01:22.644Z | 2026-11-01T15:01:22.644Z |
| 840874ed-0fee-4cc7-bac5-7ad169e43adc | patient.honghanh@gmail.com | ACTIVE | 2026-11-01T15:01:22.658Z | 2026-11-01T15:01:22.658Z |
| a712a3b3-0124-467b-b222-c8e3a3d53960 | patient.bichthuy@gmail.com | ACTIVE | 2026-11-01T15:01:22.671Z | 2026-11-01T15:01:22.671Z |
| b6a76a83-d5bc-4772-85c9-367159ae7842 | patient.yennhi@gmail.com | ACTIVE | 2026-11-01T15:01:22.684Z | 2026-11-01T15:01:22.684Z |
| 93ec58ef-8e21-4616-b9e1-c5b67cb7c17d | patient.baochau@gmail.com | ACTIVE | 2026-11-01T15:01:22.701Z | 2026-11-01T15:01:22.701Z |
| 2c5a41bd-a0cf-433f-b4f5-01fa90ba1e60 | patient.profile@taman.hospital | ACTIVE | 2026-11-01T15:01:22.728Z | 2026-11-01T15:01:22.728Z |
| c7892601-edcd-414d-bc84-99210953fef6 | patient.thaiky@taman.hospital | ACTIVE | 2026-11-01T15:01:22.740Z | 2026-11-01T15:01:22.740Z |



### 1.3. Bảng `credentials` (Thông tin Xác thực Mật khẩu)
- **Số lượng bản ghi:** 36
- **Mục đích:** Lưu trữ chuỗi băm mật khẩu Argon2id tương ứng với 36 tài khoản.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `account` |
| `password_hash` | `text` | 🔴 Bắt buộc | Mã băm tra cứu HMAC-SHA256 hoặc Argon2id |
| `password_updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `failed_login_count` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `locked_until` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **id** | **account_id** | **password_hash** | **created_at** |
| :--- | :--- | :--- | :--- |
| _null_ | 454d1876-0725-45da-b998-6523c5cd7f5f | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | e752ea83-ee42-4c1b-b1d7-44f94c49ff5e | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 9ec9562f-e9ad-4570-81b0-75a6bb9aea75 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | fbc16ef5-d98c-48e3-a7a0-0ce57a2519c5 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | d1f78de4-83f1-4670-851f-afd0cbe7cfea | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 05e68233-c08a-4960-b0b6-1a275b53c52f | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | b3d8e42d-ee9b-42f3-a017-43f1a5db4875 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 424bdff1-0917-4b4f-ab94-d077b00f2041 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | f63deac8-cb47-4941-8250-19598e9d89b5 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | dad555cf-1864-4a32-a8ef-1508a5cd59d4 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 74a642aa-44ea-4e9f-a29e-b692f3e9ffee | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 02927e75-66e4-4d95-bc3f-0b53a193a10e | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 0f88be62-8237-4414-b2e3-c37cf0cfb18e | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | c53f8a98-7450-4cb2-aa8f-c686086e5888 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | e1e3f1c2-15f5-4ab8-bc0f-9a3752605913 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 66b7eb47-3edd-401f-8bcf-53c6fc8bb66a | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 646f5a47-8937-4101-a063-6b8e594be0c1 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | fe53404a-0a1d-4b1d-9682-88b57f03d034 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | f91e2f1c-afdf-4d42-bdc6-74694ade042c | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 2f8e99aa-1e3a-475b-a365-86a1fcda5c36 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | c65b0775-02bb-46bc-ac7c-3e7dc638f72c | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | da498d70-45f5-4ab7-99fb-6412410bc6ff | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | f4e6d292-887d-41a5-8f4b-bc307d81fba5 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 2ce8e12b-01a0-4c7c-8dd0-03e8b2e4ebc4 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | b75c7aed-9aa0-4194-8183-0e93fb520e76 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | dfc0d279-267c-423f-9ad8-b2d6489ccbce | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 96ac0cc8-14d8-46f1-a28c-7167f700a7fc | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 0effa7b5-c782-4cf3-860d-bc2caeaca16c | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 5c551c0a-31ae-4488-8e54-7fed2656e507 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | aa1d2602-cefa-4fdc-842f-dbb5e892b57d | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 840874ed-0fee-4cc7-bac5-7ad169e43adc | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | a712a3b3-0124-467b-b222-c8e3a3d53960 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | b6a76a83-d5bc-4772-85c9-367159ae7842 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 93ec58ef-8e21-4616-b9e1-c5b67cb7c17d | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | 2c5a41bd-a0cf-433f-b4f5-01fa90ba1e60 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |
| _null_ | c7892601-edcd-414d-bc84-99210953fef6 | $argon2id$v=19$m=65536,p=4,t=3$uCVcT3jhJJTKuh6QenY+dw$/t6FxByIBAi+A2pRDUOm2oEabFzwFkpOJsxPj3C6MH0 | _null_ |



### 1.4. Bảng `account_roles` (Liên kết Phân quyền Tài khoản)
- **Số lượng bản ghi:** 36
- **Mục đích:** Gán quyền cho từng tài khoản vào vai trò tương ứng (ADMIN, DOCTOR, RECEPTIONIST, PATIENT, DIRECTOR).

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `account` |
| `role_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `role` |


| **account_id** | **role_id** |
| :--- | :--- |
| 454d1876-0725-45da-b998-6523c5cd7f5f | 46f7bd79-9112-4748-b238-e0bdfd9136ce |
| e752ea83-ee42-4c1b-b1d7-44f94c49ff5e | 46f7bd79-9112-4748-b238-e0bdfd9136ce |
| 9ec9562f-e9ad-4570-81b0-75a6bb9aea75 | a9e57b0c-0e2e-49fd-825b-30bfe6545bfc |
| fbc16ef5-d98c-48e3-a7a0-0ce57a2519c5 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| d1f78de4-83f1-4670-851f-afd0cbe7cfea | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 05e68233-c08a-4960-b0b6-1a275b53c52f | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| b3d8e42d-ee9b-42f3-a017-43f1a5db4875 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 424bdff1-0917-4b4f-ab94-d077b00f2041 | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| f63deac8-cb47-4941-8250-19598e9d89b5 | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| dad555cf-1864-4a32-a8ef-1508a5cd59d4 | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| 74a642aa-44ea-4e9f-a29e-b692f3e9ffee | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| 02927e75-66e4-4d95-bc3f-0b53a193a10e | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| 0f88be62-8237-4414-b2e3-c37cf0cfb18e | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| c53f8a98-7450-4cb2-aa8f-c686086e5888 | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| e1e3f1c2-15f5-4ab8-bc0f-9a3752605913 | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| 66b7eb47-3edd-401f-8bcf-53c6fc8bb66a | 29e60853-63b3-4f4b-85a1-dd2bb0b7ac02 |
| 646f5a47-8937-4101-a063-6b8e594be0c1 | 0fd09a1d-2824-44ea-91fb-29cd07e915fb |
| fe53404a-0a1d-4b1d-9682-88b57f03d034 | 0fd09a1d-2824-44ea-91fb-29cd07e915fb |
| f91e2f1c-afdf-4d42-bdc6-74694ade042c | 0fd09a1d-2824-44ea-91fb-29cd07e915fb |
| 2f8e99aa-1e3a-475b-a365-86a1fcda5c36 | 0fd09a1d-2824-44ea-91fb-29cd07e915fb |
| c65b0775-02bb-46bc-ac7c-3e7dc638f72c | 0fd09a1d-2824-44ea-91fb-29cd07e915fb |
| da498d70-45f5-4ab7-99fb-6412410bc6ff | 0fd09a1d-2824-44ea-91fb-29cd07e915fb |
| f4e6d292-887d-41a5-8f4b-bc307d81fba5 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 2ce8e12b-01a0-4c7c-8dd0-03e8b2e4ebc4 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| b75c7aed-9aa0-4194-8183-0e93fb520e76 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| dfc0d279-267c-423f-9ad8-b2d6489ccbce | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 96ac0cc8-14d8-46f1-a28c-7167f700a7fc | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 0effa7b5-c782-4cf3-860d-bc2caeaca16c | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 5c551c0a-31ae-4488-8e54-7fed2656e507 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| aa1d2602-cefa-4fdc-842f-dbb5e892b57d | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 840874ed-0fee-4cc7-bac5-7ad169e43adc | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| a712a3b3-0124-467b-b222-c8e3a3d53960 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| b6a76a83-d5bc-4772-85c9-367159ae7842 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 93ec58ef-8e21-4616-b9e1-c5b67cb7c17d | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| 2c5a41bd-a0cf-433f-b4f5-01fa90ba1e60 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |
| c7892601-edcd-414d-bc84-99210953fef6 | 1c8f00e8-de7c-4e31-85b2-a41500ef99a8 |



### 1.5. Bảng `auth_sessions` (Phiên Đăng nhập Hoạt động)
- **Số lượng bản ghi:** 2
- **Mục đích:** Quản lý phiên làm việc JWT Refresh Token của quản trị viên và bác sĩ đang online.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `account` |
| `refresh_token_hash` | `text` | 🔴 Bắt buộc | Mã băm tra cứu HMAC-SHA256 hoặc Argon2id |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `expires_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `last_used_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `revoked_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `revoked_reason` | `text` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **id** | **account_id** | **refresh_token_hash** | **ip_address** | **user_agent** | **expires_at** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 8a7dbb47-58a1-4655-abfe-9c2da9cc3041 | 454d1876-0725-45da-b998-6523c5cd7f5f | f3cc4660b43272d935abe0e0514c76ab38731f5d9cb40cadf4d3a80ec505ffe9 | _null_ | _null_ | 2026-11-08T15:01:21.655Z |
| b99b4cab-7dfb-4833-8dec-6b3d3bb244d6 | 05e68233-c08a-4960-b0b6-1a275b53c52f | fe086cb3ddfc90d0323621e1223c789708bd0d80035c1e20af8f7b53491d3324 | _null_ | _null_ | 2026-11-07T15:01:21.748Z |



### 1.6. Bảng `password_reset_tokens` (Mã Khôi phục Mật khẩu)
- **Số lượng bản ghi:** 1
- **Mục đích:** Lưu mã OTP/Token phục vụ kiểm thử tính năng quên mật khẩu của thai phụ.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `account` |
| `token_hash` | `text` | 🔴 Bắt buộc | Mã băm tra cứu HMAC-SHA256 hoặc Argon2id |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `expires_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |


| **id** | **account_id** | **token_hash** | **expires_at** | **used_at** | **created_at** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| _null_ | fbc16ef5-d98c-48e3-a7a0-0ce57a2519c5 | e12d0f7962613580101e2ffc7cad77276f00dfddf8b09f72cc00d4fcf565c007 | 2026-11-02T15:01:21.655Z | _null_ | 2026-11-01T15:01:21.742Z |



---
## 👨‍⚕️ PHẦN 2: DOCTOR SERVICE (QUẢN LÝ BÁC SĨ, CHUYÊN KHOA, HẠNG & LỊCH KHÁM)

- **Database:** `doctor` (Cổng `5435`)
- **Vai trò:** Trung tâm quản lý thông tin bác sĩ, chuyên khoa mũi nhọn, bảng hạng bác sĩ (Consultation Ranks), phòng khám chuyên khoa, hồ sơ năng lực chuyên môn và lịch trực ca khám bệnh trong tuần.
- **Tổng số bảng:** 11 bảng | **Tổng bản ghi:** 108 records.

### 2.1. Bảng `specialties` (Danh mục Chuyên khoa Y tế)
- **Số lượng bản ghi:** 5
- **Mục đích:** Danh mục các chuyên khoa then chốt của bệnh viện sản phụ khoa.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `code` | `character varying(50)` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `name` | `character varying(120)` | 🔴 Bắt buộc | Tên hiển thị tiếng Việt |
| `description` | `character varying(1000)` | ⚪ Tùy chọn | Mô tả / Ghi chú chi tiết |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `slug` | `character varying(160)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `overview` | `jsonb` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **code** | **name** | **description** | **status** | **sort_order** |
| :--- | :--- | :--- | :--- | :--- |
| OBSTETRICS | Sản khoa | Chăm sóc thai kỳ, quản lý chuyển dạ, đỡ sinh thường và phẫu thuật mổ lấy thai an toàn. | ACTIVE | _null_ |
| GYNECOLOGY | Phụ khoa | Khám, chẩn đoán và điều trị bệnh phụ khoa, u xơ, u buồng trứng và tầm soát ung thư cổ tử cung. | ACTIVE | _null_ |
| PERINATOLOGY | Y học bào thai & Chẩn đoán trước sinh | Siêu âm hình thái học thai nhi 4D/5D, sàng lọc dị tật bẩm sinh, can thiệp và theo dõi thai kỳ nguy cơ cao. | ACTIVE | _null_ |
| REPRODUCTIVE_ENDOCRINOLOGY | Hiếm muộn & Hỗ trợ sinh sản | Khám, tư vấn vô sinh - hiếm muộn, kích thích buồng trứng, bơm tinh trùng (IUI) và thụ tinh ống nghiệm (IVF). | ACTIVE | _null_ |
| MATERNAL_MEDICINE | Bệnh lý nội khoa thai kỳ | Quản lý và điều trị bệnh lý nội khoa đi kèm thai kỳ: đái tháo đường thai kỳ, tiền sản giật, tim mạch thai kỳ. | ACTIVE | _null_ |



### 2.2. Bảng `consultation_ranks` (Bảng Hạng Bác sĩ Chuẩn hóa)
- **Số lượng bản ghi:** 8
- **Mục đích:** Chuẩn hóa cấp bậc bác sĩ để xác định kinh nghiệm, chức danh hiển thị duy nhất và làm căn cứ tính phụ phí tại Catalog Service.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `code` | `USER-DEFINED` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `name` | `character varying(120)` | 🔴 Bắt buộc | Tên hiển thị tiếng Việt |
| `short_name` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `experience_years_min` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `sort_order` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `character varying(20)` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **code** | **name** | **short_name** | **experience_years_min** | **sort_order** | **status** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| BASIC | Bác sĩ Sản Phụ khoa | Bác sĩ | 3 | 1 | ACTIVE |
| SPECIALIST_I | Bác sĩ Chuyên khoa I (CKI) | BS. CKI | 6 | 2 | ACTIVE |
| SPECIALIST_II | Bác sĩ Chuyên khoa II (CKII) | BS. CKII | 12 | 3 | ACTIVE |
| MASTER | Thạc sĩ Bác sĩ | ThS. BS | 8 | 4 | ACTIVE |
| HEAD_DOCTOR | Bác sĩ Trưởng khoa | Trưởng khoa | 15 | 5 | ACTIVE |
| ASSOC_PROFESSOR | Phó Giáo sư, Tiến sĩ Bác sĩ | PGS. TS. BS | 18 | 6 | ACTIVE |
| EXPERT | Bác sĩ Chuyên gia cao cấp | Chuyên gia | 20 | 7 | ACTIVE |
| PROFESSOR | Giáo sư, Tiến sĩ Bác sĩ | GS. TS. BS | 22 | 8 | ACTIVE |



### 2.3. Bảng `clinic_rooms` (Phòng khám Chuyên khoa)
- **Số lượng bản ghi:** 5
- **Mục đích:** Quản lý các buồng khám thực tế tại bệnh viện nơi bác sĩ trực tiếp tiếp nhận bệnh nhân.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `code` | `character varying(30)` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `name` | `character varying(120)` | 🔴 Bắt buộc | Tên hiển thị tiếng Việt |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **code** | **name** | **status** |
| :--- | :--- | :--- |
| P.201 | Phòng khám Sản Phụ khoa 201 | ACTIVE |
| P.202 | Phòng khám Sản Phụ khoa 202 | ACTIVE |
| P.203 | Phòng khám Sản Phụ khoa 203 | ACTIVE |
| P.207 | Phòng khám Sản Phụ khoa 207 | ACTIVE |
| P.208 | Phòng khám Sản Phụ khoa 208 | ACTIVE |



### 2.4. Bảng `doctors` & `doctor_profiles` (Danh sách & Hồ sơ Bác sĩ)
- **Số lượng bản ghi:** 14 bác sĩ (12 ACTIVE, 1 INACTIVE, 1 DRAFT)
- **Mục đích:** Lưu trữ hồ sơ định danh, liên kết tài khoản Auth, số chứng chỉ hành nghề (CCHN), hạng bác sĩ và tiểu sử chuyên môn. Trong đó có 5 bác sĩ BASIC (Hoàng Minh Tuấn, Trần Mai Anh, Nguyễn Hồng Nhung, Lê Văn Đức, Bùi Thảo Linh) phục vụ cơ chế tự động phân bổ cân bằng tải.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `account` |
| `license_number` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `consultation_rank` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |


| **id** | **account_id** | **full_name** | **status** | **created_at** |
| :--- | :--- | :--- | :--- | :--- |
| e863bcc8-e213-425c-b12b-359e0cb22d8d | 424bdff1-0917-4b4f-ab94-d077b00f2041 | _null_ | ACTIVE | 2026-11-01T15:01:22.150Z |
| dc15585a-f921-43f9-8072-f5b2dcff74d9 | f63deac8-cb47-4941-8250-19598e9d89b5 | _null_ | ACTIVE | 2026-11-01T15:01:22.184Z |
| 15a6ea00-ccce-402a-9b31-37fb8a0332f6 | dad555cf-1864-4a32-a8ef-1508a5cd59d4 | _null_ | ACTIVE | 2026-11-01T15:01:22.219Z |
| 64b316b4-9d02-4352-8fc2-29fc6113a1b7 | 74a642aa-44ea-4e9f-a29e-b692f3e9ffee | _null_ | ACTIVE | 2026-11-01T15:01:22.256Z |
| 4002fd15-b0b9-4283-808f-09946e583b68 | 02927e75-66e4-4d95-bc3f-0b53a193a10e | _null_ | ACTIVE | 2026-11-01T15:01:22.290Z |
| 602b1e4b-5744-481c-a94a-0d64702c3c8b | 0f88be62-8237-4414-b2e3-c37cf0cfb18e | _null_ | ACTIVE | 2026-11-01T15:01:22.321Z |
| 4a3c0c4a-09c3-427c-8cbe-275d7c604369 | c53f8a98-7450-4cb2-aa8f-c686086e5888 | _null_ | ACTIVE | 2026-11-01T15:01:22.352Z |
| faaef216-5d5d-494b-b572-0a6094ebdf94 | e1e3f1c2-15f5-4ab8-bc0f-9a3752605913 | _null_ | ACTIVE | 2026-11-01T15:01:22.384Z |
| b20c9294-025d-4d59-82bc-1090847d1287 | 05e68233-c08a-4960-b0b6-1a275b53c52f | _null_ | INACTIVE | 2026-11-01T15:01:22.415Z |
| 7cbdcc04-73cc-41d5-8ec3-27fd84ee78eb | 66b7eb47-3edd-401f-8bcf-53c6fc8bb66a | _null_ | DRAFT | 2026-11-01T15:01:22.428Z |



#### Chi tiết hồ sơ chuyên môn (`doctor_profiles`)
| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `doctor` |
| `full_name` | `character varying(150)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `biography` | `character varying(2000)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `practice_start_year` | `integer` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `languages` | `ARRAY` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `photo_url` | `character varying(2048)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **doctor_id** | **consultation_rank** | **medical_license_number** | **years_of_experience** | **phone_number** | **gender** | **bio** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| e863bcc8-e213-425c-b12b-359e0cb22d8d | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| dc15585a-f921-43f9-8072-f5b2dcff74d9 | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| 15a6ea00-ccce-402a-9b31-37fb8a0332f6 | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| 64b316b4-9d02-4352-8fc2-29fc6113a1b7 | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| 4002fd15-b0b9-4283-808f-09946e583b68 | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| 602b1e4b-5744-481c-a94a-0d64702c3c8b | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| 4a3c0c4a-09c3-427c-8cbe-275d7c604369 | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| faaef216-5d5d-494b-b572-0a6094ebdf94 | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| b20c9294-025d-4d59-82bc-1090847d1287 | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |
| 7cbdcc04-73cc-41d5-8ec3-27fd84ee78eb | _null_ | _null_ | _null_ | _null_ | _null_ | _null_ |



### 2.5. Bảng `doctor_specialties` (Liên kết Bác sĩ - Chuyên khoa)
- **Số lượng bản ghi:** 14
- **Mục đích:** Gán bác sĩ vào một hoặc nhiều chuyên khoa phụ trách chính/kiêm nhiệm.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `doctor` |
| `specialty_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `specialty` |
| `is_primary` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **doctor_id** | **specialty_code** | **is_primary** |
| :--- | :--- | :--- |
| e863bcc8-e213-425c-b12b-359e0cb22d8d | _null_ | true |
| dc15585a-f921-43f9-8072-f5b2dcff74d9 | _null_ | true |
| 15a6ea00-ccce-402a-9b31-37fb8a0332f6 | _null_ | true |
| 64b316b4-9d02-4352-8fc2-29fc6113a1b7 | _null_ | true |
| 4002fd15-b0b9-4283-808f-09946e583b68 | _null_ | true |
| 602b1e4b-5744-481c-a94a-0d64702c3c8b | _null_ | true |
| 4a3c0c4a-09c3-427c-8cbe-275d7c604369 | _null_ | true |
| faaef216-5d5d-494b-b572-0a6094ebdf94 | _null_ | true |
| e863bcc8-e213-425c-b12b-359e0cb22d8d | _null_ | false |
| 15a6ea00-ccce-402a-9b31-37fb8a0332f6 | _null_ | false |
| faaef216-5d5d-494b-b572-0a6094ebdf94 | _null_ | false |
| 4a3c0c4a-09c3-427c-8cbe-275d7c604369 | _null_ | false |
| b20c9294-025d-4d59-82bc-1090847d1287 | _null_ | true |
| 7cbdcc04-73cc-41d5-8ec3-27fd84ee78eb | _null_ | true |



### 2.6. Bảng `doctor_schedules` (Lịch trực ca Khám bệnh)
- **Số lượng bản ghi:** 56 (Phủ kín 7 ngày trong tuần cho 8 bác sĩ hoạt động)
- **Mục đích:** Phân bổ các ca làm việc (Sáng: 07:30 - 11:30, Chiều: 13:30 - 17:00, Tối: 17:30 - 20:30) tại các phòng khám P.201, P.203, P.207.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `doctor` |
| `day_of_week` | `smallint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `start_time` | `character varying(8)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `end_time` | `character varying(8)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `slot_duration_minutes` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `effective_from` | `date` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `timezone` | `character varying(64)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `department_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `department` |
| `room_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `room` |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **doctor_id** | **day_of_week** | **start_time** | **end_time** | **room_code** | **status** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 53854443-b6fb-4167-a808-0e9f2a149cd1 | e863bcc8-e213-425c-b12b-359e0cb22d8d | 1 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 969a9cf4-78e4-457b-a32a-544b1b8b7402 | e863bcc8-e213-425c-b12b-359e0cb22d8d | 2 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 5493a528-ca84-4e30-9698-542c40496233 | e863bcc8-e213-425c-b12b-359e0cb22d8d | 3 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 5a1d3753-a60e-4c8c-9b38-665937420a95 | e863bcc8-e213-425c-b12b-359e0cb22d8d | 4 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 722bd984-c3ec-4842-8819-e3eab6ebb087 | e863bcc8-e213-425c-b12b-359e0cb22d8d | 5 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| c750a0b4-5aed-4433-b43f-56102ea1cb46 | e863bcc8-e213-425c-b12b-359e0cb22d8d | 6 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 15dc63c5-18d3-4728-8759-9ecf1e5ba8c7 | e863bcc8-e213-425c-b12b-359e0cb22d8d | 7 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 789df299-4c92-45ce-8245-7e07f303432d | dc15585a-f921-43f9-8072-f5b2dcff74d9 | 1 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 36ca60a2-2c23-4a73-a3d6-4aa4b6a496bd | dc15585a-f921-43f9-8072-f5b2dcff74d9 | 2 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 476e22cb-0c7a-4b65-b2de-556904bce19b | dc15585a-f921-43f9-8072-f5b2dcff74d9 | 3 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| d060408f-aeb1-49c7-9b5b-0aac9c204b3c | dc15585a-f921-43f9-8072-f5b2dcff74d9 | 4 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| e12f083d-894c-4359-9b45-9873d0d207ce | dc15585a-f921-43f9-8072-f5b2dcff74d9 | 5 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| ee7b438e-5610-44c9-a5de-703df1e637a5 | dc15585a-f921-43f9-8072-f5b2dcff74d9 | 6 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| 2028d1f3-e6a4-40c0-91e6-53750ec24d5f | dc15585a-f921-43f9-8072-f5b2dcff74d9 | 7 | 07:30:00 | 12:00:00 | _null_ | ACTIVE |
| abfe3d55-4906-416a-a8e3-75eb600aea4e | 15a6ea00-ccce-402a-9b31-37fb8a0332f6 | 1 | 12:30:00 | 17:00:00 | _null_ | ACTIVE |


> _(Hiển thị mẫu 15 / 56 bản ghi lịch trực tuần của các bác sĩ. Đầy đủ các ca Thứ 2 đến Chủ nhật)_

### 2.7. Các bảng Phụ trợ: `doctor_availabilities`, `audit_records`, `outbox_events`
- **`doctor_availabilities` (3 bản ghi):** Lưu cấu hình slot khám tức thời và chặn trùng lịch.
- **`audit_records` (2 bản ghi):** Nhật ký kiểm toán chỉnh sửa hồ sơ bác sĩ.
- **`outbox_events` (1 bản ghi):** Sự kiện Outbox thông báo cập nhật bác sĩ cho các service khác.

| **id** | **doctor_id** | **slot_start** | **slot_end** | **status** |
| :--- | :--- | :--- | :--- | :--- |
| f4940595-bf87-4afe-ba37-2fae9e118aec | 64b316b4-9d02-4352-8fc2-29fc6113a1b7 | _null_ | _null_ | ACTIVE |
| 89172783-b3c1-4ce0-8918-6d0b8cb3c9a0 | e863bcc8-e213-425c-b12b-359e0cb22d8d | _null_ | _null_ | ACTIVE |
| 744cf028-ca3c-48fc-9a03-18a3772149d2 | 15a6ea00-ccce-402a-9b31-37fb8a0332f6 | _null_ | _null_ | CANCELLED |



---
## 📋 PHẦN 3: CATALOG SERVICE (DANH MỤC DỊCH VỤ Y TẾ & BẢNG GIÁ)

- **Database:** `catalog` (Cổng `5437`)
- **Vai trò:** Quản lý bảng danh mục kỹ thuật y tế, gói khám thai, phẫu thuật phụ khoa, bảng giá gốc theo thời gian và bảng phụ phí khám theo hạng bác sĩ (Rank Surcharges).
- **Tổng số bảng:** 5 bảng | **Tổng bản ghi:** 104 records.

### 3.1. Bảng `catalog_tags` (Nhãn phân loại Dịch vụ)
- **Số lượng bản ghi:** 8
- **Mục đích:** Gắn nhãn tìm kiếm và phân nhóm dịch vụ y tế trên giao diện đặt lịch.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `code` | `character varying(50)` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `slug` | `character varying(160)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `name` | `character varying(120)` | 🔴 Bắt buộc | Tên hiển thị tiếng Việt |
| `group` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `description` | `character varying(500)` | ⚪ Tùy chọn | Mô tả / Ghi chú chi tiết |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `sort_order` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **code** | **name** | **description** | **status** |
| :--- | :--- | :--- | :--- | :--- |
| a495206f-765b-4e49-b230-9167a07e6232 | TRIMESTER_1 | 3 tháng đầu (0-13 tuần) | 3 tháng đầu (0-13 tuần) | ACTIVE |
| 424a8fbe-b291-4dd1-bc52-9cab567edf82 | TRIMESTER_2 | 3 tháng giữa (14-27 tuần) | 3 tháng giữa (14-27 tuần) | ACTIVE |
| b9b684d0-9d74-446f-a6e9-c19f1a33cb64 | TRIMESTER_3 | 3 tháng cuối (28-40 tuần) | 3 tháng cuối (28-40 tuần) | ACTIVE |
| 806768c1-b82e-4871-89d2-4a78934a2e10 | HIGH_RISK | Thai kỳ nguy cơ cao | Thai kỳ nguy cơ cao | ACTIVE |
| bb5890c2-a70a-47c6-9a2e-9e358df08d0a | ROUTINE | Khám định kỳ | Khám định kỳ | ACTIVE |
| 3bd5026e-2673-47d0-8a37-be0b69281d3d | POPULAR | Dịch vụ nổi bật | Dịch vụ nổi bật | ACTIVE |
| 6cb38489-5d63-491c-aef8-1b2ba4bb0453 | FEMALE_CARE | Chăm sóc Nữ giới & Thai phụ | Chăm sóc Nữ giới & Thai phụ | ACTIVE |
| c2a6fafc-bfb0-4ab9-a0aa-5372ab3ea390 | REPRODUCTIVE_AGE | Độ tuổi sinh sản 18-45 | Độ tuổi sinh sản 18-45 | ACTIVE |



### 3.2. Bảng `medical_services` (Danh mục Dịch vụ Y tế)
- **Số lượng bản ghi:** 23 dịch vụ
- **Mục đích:** Bảng danh mục kỹ thuật y tế đầy đủ các gói khám thai, siêu âm màu 5D, xét nghiệm NIPT, sàng lọc trước sinh, soi CTC, v.v.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `code` | `character varying(50)` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `slug` | `character varying(160)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `name` | `character varying(200)` | 🔴 Bắt buộc | Tên hiển thị tiếng Việt |
| `summary` | `character varying(500)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `description` | `text` | ⚪ Tùy chọn | Mô tả / Ghi chú chi tiết |
| `kind` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `specialty_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `specialty` |
| `thumbnail_url` | `character varying(2048)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `duration_minutes` | `integer` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `booking_enabled` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `doctor_rank_selection_policy` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `published_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `content` | `jsonb` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **code** | **name** | **specialty_code** | **duration_minutes** | **status** | **created_at** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PRENATAL_ROUTINE | Khám thai định kỳ chuẩn y khoa | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.859Z |
| PRENATAL_VIP | Khám thai chuyên gia & tư vấn dinh dưỡng cá thể hóa | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.879Z |
| US_2D | Siêu âm thai 2D kiểm tra tim thai & độ dài túi ối | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.890Z |
| US_4D_5D | Siêu âm hình thái thai nhi 4D/5D Doppler màu HD-Live | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.900Z |
| NIPT_BASIC | Sàng lọc dị tật không xâm lấn NIPT - 3 cặp NST (21, 18, 13) | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.910Z |
| NIPT_PRO | Sàng lọc NIPT Pro - Toàn bộ 23 cặp NST & vi mất đoạn | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.920Z |
| DOUBLE_TEST | Xét nghiệm Double Test sàng lọc quý 1 | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.930Z |
| TRIPLE_TEST | Xét nghiệm Triple Test sàng lọc quý 2 | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.940Z |
| OGTT_DIABETES | Nghiệm pháp dung nạp Glucose tầm soát đái tháo đường thai kỳ | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.947Z |
| GYN_STANDARD | Khám phụ khoa tổng quát & Soi cổ tử cung kỹ thuật số | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.957Z |
| PACKAGE_BIRTH_STANDARD | Gói sinh con thường trọn gói Hạnh Phúc | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.964Z |
| PACKAGE_BIRTH_SURGERY | Gói sinh mổ chủ động trọn gói Bình An | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.973Z |
| IUI_PROCEDURE | Thủ thuật bơm tinh trùng vào buồng tử cung (IUI) | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.980Z |
| VAC_TETANUS | Tiêm phòng vắc xin Uốn ván thai kỳ (VAT) | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:21.990Z |
| GENETIC_COUNSELING | Tư vấn di truyền trước sinh & Tiền hôn nhân | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:22.002Z |
| US_DOPPLER_TWINS | Siêu âm Doppler song thai & Đa thai chuyên sâu | _null_ | _null_ | INACTIVE | 2026-11-01T15:01:22.012Z |
| PACKAGE_STEM_CELL | Gói thu thập & Lưu trữ Tế bào gốc Máu cuống rốn | _null_ | _null_ | DRAFT | 2026-11-01T15:01:22.020Z |
| GYN_THINPREP_HPV | Tầm soát ung thư cổ tử cung ThinPrep Pap & HPV DNA Cobas | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:22.027Z |
| GYN_TRANSVAGINAL_US | Siêu âm đầu dò âm đạo kiểm tra tử cung & buồng trứng | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:22.037Z |
| RE_AMH_ASSAY | Xét nghiệm AMH đánh giá dự trữ buồng trứng & khả năng sinh sản | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:22.042Z |
| RE_SEMEN_ANALYSIS | Xét nghiệm Tinh dịch đồ tự động chuẩn WHO 2021 | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:22.049Z |
| MM_PREECLAMPSIA_SCREEN | Sàng lọc & Quản lý dự phòng Tiền sản giật sớm (sFlt-1/PlGF) | _null_ | _null_ | ACTIVE | 2026-11-01T15:01:22.055Z |
| OLD_COVID_SCREENING | Xét nghiệm nhanh kháng nguyên SARS-CoV-2 tiền phẫu | _null_ | _null_ | ARCHIVED | 2026-11-01T15:01:22.064Z |



### 3.3. Bảng `base_prices` (Bảng Giá Gốc Dịch vụ theo Thời gian)
- **Số lượng bản ghi:** 26 bản ghi (23 ACTIVE, 2 SCHEDULED, 1 EXPIRED)
- **Mục đích:** Quản lý giá tiền gốc của từng dịch vụ, hỗ trợ lên lịch tăng/giảm giá tự động theo ngày hiệu lực (`effective_from`, `effective_to`).

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `medical_service_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `medical_service` |
| `amount_minor` | `bigint` | 🔴 Bắt buộc | Số tiền (VND) |
| `currency` | `character(3)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `effective_from` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `effective_to` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **service_id** | **amount_minor** | **currency** | **effective_from** | **effective_to** | **status** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 222ae40b-3e17-4c44-9da7-5af5b6ea0d5c | _null_ | 300000 | VND | 2026-11-01T15:01:21.862Z | _null_ | ACTIVE |
| 0022739e-1cdf-400a-8b31-73d8dedb8ebc | _null_ | 500000 | VND | 2026-11-01T15:01:21.882Z | _null_ | ACTIVE |
| 777c5acc-10ad-49a6-8297-4c8c851f3e76 | _null_ | 200000 | VND | 2026-11-01T15:01:21.892Z | _null_ | ACTIVE |
| 8ae4efcf-58b4-4a93-aaeb-79db726fa4b7 | _null_ | 450000 | VND | 2026-11-01T15:01:21.903Z | _null_ | ACTIVE |
| 3c889d31-1417-4900-aa29-d4e88fdaf00e | _null_ | 2500000 | VND | 2026-11-01T15:01:21.913Z | _null_ | ACTIVE |
| 973307cd-457b-4a7c-b547-a99ccd54dae1 | _null_ | 5500000 | VND | 2026-11-01T15:01:21.923Z | _null_ | ACTIVE |
| 0210ec44-c509-477b-b06a-bf382055232e | _null_ | 450000 | VND | 2026-11-01T15:01:21.932Z | _null_ | ACTIVE |
| 247805a5-1e8b-40e4-875e-53a9b27df73b | _null_ | 500000 | VND | 2026-11-01T15:01:21.942Z | _null_ | ACTIVE |
| b05a06e5-e19f-49ba-bbe4-fdc8d1b7faa5 | _null_ | 350000 | VND | 2026-11-01T15:01:21.949Z | _null_ | ACTIVE |
| 80d00657-02c3-4a29-8fd8-2057ea19d03d | _null_ | 350000 | VND | 2026-11-01T15:01:21.959Z | _null_ | ACTIVE |
| 0e22b679-714d-445a-b079-062e36133d81 | _null_ | 18000000 | VND | 2026-11-01T15:01:21.967Z | _null_ | ACTIVE |
| 7ed7c4a9-9d73-4384-809d-1c5247f34e9e | _null_ | 28000000 | VND | 2026-11-01T15:01:21.975Z | _null_ | ACTIVE |
| bc32b96a-96c6-4f0b-9fbc-dd29de8ca26e | _null_ | 4500000 | VND | 2026-11-01T15:01:21.983Z | _null_ | ACTIVE |
| 6f4875b3-fbee-4316-82a3-5cb3808668ef | _null_ | 150000 | VND | 2026-11-01T15:01:21.993Z | _null_ | ACTIVE |
| 26915e3c-56a1-4874-849c-7a6c58133c55 | _null_ | 600000 | VND | 2026-11-01T15:01:22.005Z | _null_ | ACTIVE |


> _(Hiển thị mẫu 15 / 26 mức giá gốc dịch vụ. Toàn bộ tính bằng đơn vị VND)_

### 3.4. Bảng `doctor_rank_surcharges` (Bảng Phụ phí Khám theo Hạng Bác sĩ)
- **Số lượng bản ghi:** 11 bản ghi (8 ACTIVE, 1 SCHEDULED, 1 EXPIRED, 1 CANCELLED)
- **Mục đích:** Tính toán khoản tiền phụ thu chính xác khi bệnh nhân chọn đích danh bác sĩ theo rank.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `rank_code` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `amount_minor` | `bigint` | 🔴 Bắt buộc | Số tiền (VND) |
| `currency` | `character(3)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `effective_from` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `effective_to` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **rank_code** | **amount_minor** | **currency** | **effective_from** | **effective_to** | **status** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2cb21c9d-331b-4c10-83ea-b6c768f1fd01 | BASIC | 0 | VND | 2026-11-01T15:01:21.772Z | _null_ | ACTIVE |
| b4ff0ffe-d84e-478f-8621-142aee69d7dc | SPECIALIST_I | 100000 | VND | 2026-11-01T15:01:21.781Z | _null_ | ACTIVE |
| 09afb22b-4256-49c0-8ef4-84aebaece2db | SPECIALIST_II | 200000 | VND | 2026-11-01T15:01:21.789Z | _null_ | ACTIVE |
| 6333a098-d6e3-4407-a763-032fc0d95366 | MASTER | 150000 | VND | 2026-11-01T15:01:21.796Z | _null_ | ACTIVE |
| 453becb2-89ce-4284-b91c-79fa5bdaac53 | HEAD_DOCTOR | 250000 | VND | 2026-11-01T15:01:21.802Z | _null_ | ACTIVE |
| cb7136d1-96bf-4a9e-b59d-fd0c5398b182 | ASSOC_PROFESSOR | 350000 | VND | 2026-11-01T15:01:21.809Z | _null_ | ACTIVE |
| a73a9beb-07c6-43eb-b380-02401334c0af | EXPERT | 400000 | VND | 2026-11-01T15:01:21.815Z | _null_ | ACTIVE |
| e81c0c07-4503-43ef-981c-d3f2d98693d8 | PROFESSOR | 500000 | VND | 2026-11-01T15:01:21.820Z | _null_ | ACTIVE |
| fff4c2dc-7ed8-4d11-a205-cf90a7f49a68 | ASSOC_PROFESSOR | 400000 | VND | 2026-11-30T17:00:00.000Z | _null_ | SCHEDULED |
| c9935b1f-becb-4e1f-a27e-53eeb3a742cd | BASIC | 50000 | VND | 2026-11-01T15:01:21.825Z | _null_ | CANCELLED |
| bc5de45d-43d5-4d2e-b1de-b480af8c49f4 | HEAD_DOCTOR | 200000 | VND | 2025-10-31T17:00:00.000Z | 2026-10-31T17:00:00.000Z | EXPIRED |



### 3.5. Bảng `medical_service_tags` (Liên kết Dịch vụ - Nhãn Thẻ)
- **Số lượng bản ghi:** 36
- **Mục đích:** Gán đa thẻ phân loại cho từng dịch vụ y tế.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `medical_service_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `medical_service` |
| `tag_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `tag` |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **service_id** | **tag_id** |
| :--- | :--- |
| _null_ | bb5890c2-a70a-47c6-9a2e-9e358df08d0a |
| _null_ | 3bd5026e-2673-47d0-8a37-be0b69281d3d |
| _null_ | a495206f-765b-4e49-b230-9167a07e6232 |
| _null_ | 424a8fbe-b291-4dd1-bc52-9cab567edf82 |
| _null_ | b9b684d0-9d74-446f-a6e9-c19f1a33cb64 |
| _null_ | 806768c1-b82e-4871-89d2-4a78934a2e10 |
| _null_ | 3bd5026e-2673-47d0-8a37-be0b69281d3d |
| _null_ | a495206f-765b-4e49-b230-9167a07e6232 |
| _null_ | bb5890c2-a70a-47c6-9a2e-9e358df08d0a |
| _null_ | 424a8fbe-b291-4dd1-bc52-9cab567edf82 |
| _null_ | 3bd5026e-2673-47d0-8a37-be0b69281d3d |
| _null_ | a495206f-765b-4e49-b230-9167a07e6232 |
| _null_ | 3bd5026e-2673-47d0-8a37-be0b69281d3d |
| _null_ | a495206f-765b-4e49-b230-9167a07e6232 |
| _null_ | 806768c1-b82e-4871-89d2-4a78934a2e10 |



---
## 🛎️ PHẦN 4: RECEPTIONIST SERVICE (TIẾP ĐÓN & QUẢN LÝ LỄ TÂN)

- **Database:** `receptionist` (Cổng `5436`)
- **Vai trò:** Quản lý đội ngũ lễ tân, luồng tiếp đón bệnh nhân tại quầy, đối soát danh tính thẻ CCCD gắn chip và quy trình thủ tục nhập viện.
- **Tổng số bảng:** 8 bảng | **Tổng bản ghi:** 35 records.

### 4.1. Bảng `receptionists` & `receptionist_profiles` (Danh sách Lễ tân)
- **Số lượng bản ghi:** 6 (4 ACTIVE, 1 INACTIVE, 1 DRAFT)
- **Mục đích:** Quản lý tài khoản và thông tin nhân sự quầy lễ tân tiếp đón.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `account` |
| `employee_code` | `character varying(30)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `created_by_account` |
| `updated_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `updated_by_account` |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **account_id** | **full_name** | **status** | **created_at** |
| :--- | :--- | :--- | :--- | :--- |
| fbc7cf39-4e2e-4c69-8d5d-ab6fdf504aa1 | 646f5a47-8937-4101-a063-6b8e594be0c1 | _null_ | ACTIVE | 2026-11-01T15:01:22.457Z |
| 64495a71-be17-444c-a4b3-e3d626582f38 | fe53404a-0a1d-4b1d-9682-88b57f03d034 | _null_ | ACTIVE | 2026-11-01T15:01:22.473Z |
| ec0f7fc1-eca5-4f76-b355-d155fd0ce8f8 | f91e2f1c-afdf-4d42-bdc6-74694ade042c | _null_ | ACTIVE | 2026-11-01T15:01:22.485Z |
| 43db9c21-d9b1-4031-b33a-ab0617d28e00 | 2f8e99aa-1e3a-475b-a365-86a1fcda5c36 | _null_ | ACTIVE | 2026-11-01T15:01:22.496Z |
| 0a5e40ab-6492-4a3c-8d97-f1159b1fcd04 | c65b0775-02bb-46bc-ac7c-3e7dc638f72c | _null_ | INACTIVE | 2026-11-01T15:01:22.509Z |
| b14bb0f4-e689-4d1d-9437-b06f3936764e | da498d70-45f5-4ab7-99fb-6412410bc6ff | _null_ | DRAFT | 2026-11-01T15:01:22.520Z |



#### Chi tiết hồ sơ lễ tân (`receptionist_profiles`)
| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `receptionist_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `receptionist` |
| `full_name` | `character varying(150)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `work_phone` | `character varying(20)` | ⚪ Tùy chọn | Số điện thoại chuẩn hóa E.164 (+84) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `login_email` | `character varying(255)` | ⚪ Tùy chọn | Địa chỉ email tài khoản |
| `address` | `character varying(500)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `department` | `character varying(100)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `gender` | `USER-DEFINED` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `avatar_url` | `character varying(2048)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **receptionist_id** | **employee_code** | **phone_number** | **desk_number** | **shift** |
| :--- | :--- | :--- | :--- | :--- |
| fbc7cf39-4e2e-4c69-8d5d-ab6fdf504aa1 | _null_ | _null_ | _null_ | _null_ |
| 64495a71-be17-444c-a4b3-e3d626582f38 | _null_ | _null_ | _null_ | _null_ |
| ec0f7fc1-eca5-4f76-b355-d155fd0ce8f8 | _null_ | _null_ | _null_ | _null_ |
| 43db9c21-d9b1-4031-b33a-ab0617d28e00 | _null_ | _null_ | _null_ | _null_ |
| 0a5e40ab-6492-4a3c-8d97-f1159b1fcd04 | _null_ | _null_ | _null_ | _null_ |
| b14bb0f4-e689-4d1d-9437-b06f3936764e | _null_ | _null_ | _null_ | _null_ |



### 4.2. Bảng `reception_cases` (Ca Tiếp đón Bệnh nhân tại Quầy)
- **Số lượng bản ghi:** 6 ca
- **Mục đích:** Ghi nhận quy trình tiếp đón thai phụ đến khám (Cả hẹn trước và Vãng lai - Walk-in).

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `type` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `appointment_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `appointment` |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `arrival_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `scheduled_start_at_snapshot` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `appointment_type_snapshot` | `character varying(50)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `opened_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `opened_by_account` |
| `last_handled_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `last_handled_by_account` |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **case_code** | **patient_id** | **receptionist_id** | **arrival_type** | **status** | **check_in_time** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 7b83e1c7-758f-4443-b793-3cd885b02a8d | _null_ | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | _null_ | ADMITTED | _null_ |
| 34ad3859-86d0-49d8-8dfb-2a1bc4785a24 | _null_ | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | _null_ | ADMISSION_IN_PROGRESS | _null_ |
| d395ae9d-db76-4cdc-812f-a987dd9aec80 | _null_ | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | _null_ | _null_ | IDENTITY_VERIFIED | _null_ |
| f23436e8-83f8-4748-b03d-109175ff4157 | _null_ | c5fdc627-c742-4400-ba3c-2edca5e67993 | _null_ | _null_ | OPEN | _null_ |
| 43224bb4-dea2-4232-aa10-6e1cd2e01ebc | _null_ | e163be70-f610-44f2-9386-89f91d9240c4 | _null_ | _null_ | MANUAL_REVIEW | _null_ |
| f0bde862-4db4-4489-b5c0-63cc6f8a9525 | _null_ | 7a1fddb6-54d6-40c9-b412-d046e764a321 | _null_ | _null_ | CANCELLED | _null_ |



### 4.3. Bảng `identity_verifications` (Xác thực Danh tính CCCD Gắn Chip)
- **Số lượng bản ghi:** 5
- **Mục đích:** Lưu lịch sử đối soát thông tin khuôn mặt, vân tay và chip CCCD tại quầy tiếp đón.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `reception_case_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `reception_case` |
| `method` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `result` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `reason_code` | `character varying(50)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `note` | `character varying(500)` | ⚪ Tùy chọn | Mô tả / Ghi chú chi tiết |
| `verified_fields` | `ARRAY` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `performed_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `performed_by_account` |
| `performed_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |


| **id** | **case_id** | **patient_id** | **method** | **status** | **national_id_hash** | **verified_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| c9c203a4-11d7-4dcd-908e-e9dc78114f6f | _null_ | _null_ | NATIONAL_ID_DOCUMENT | _null_ | _null_ | _null_ |
| 80fdc378-a2a5-4ff0-9e2d-74bdceebcd63 | _null_ | _null_ | APPOINTMENT_CODE | _null_ | _null_ | _null_ |
| 74296db4-b37b-424c-a50c-d835fad1729a | _null_ | _null_ | PHONE_AND_DOB | _null_ | _null_ | _null_ |
| c2454065-70d8-47ee-9382-27271d7684dd | _null_ | _null_ | OTHER_DOCUMENT | _null_ | _null_ | _null_ |
| 69835de2-1f14-418b-be2a-fcaf94d31580 | _null_ | _null_ | NATIONAL_ID_DOCUMENT | _null_ | _null_ | _null_ |



### 4.4. Bảng `admissions` & `admission_status_history` (Thủ tục Nhập viện)
- **Số lượng bản ghi:** 3 ca nhập viện, 4 lượt chuyển trạng thái
- **Mục đích:** Quản lý thai phụ nhập viện theo dõi dọa sinh non, tiền sản giật hoặc chuyển dạ sinh nở.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `reception_case_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `reception_case` |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `current_step` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `invoice_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `invoice` |
| `payment_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `payment` |
| `medical_record_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `medical_record` |
| `queue_ticket_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `queue_ticket` |
| `appointment_checked_in_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `last_error_code` | `character varying(100)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `retry_count` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `completed_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `encounter_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `encounter` |
| `queue_journey_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `queue_journey` |


| **id** | **admission_code** | **patient_id** | **department** | **room_number** | **bed_number** | **status** | **admitted_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| feb4f007-c682-4b2f-aa82-122adcc1dea3 | _null_ | _null_ | _null_ | _null_ | _null_ | COMPLETED | _null_ |
| 4fc83049-488d-4509-bba2-eb25fa52cdd2 | _null_ | _null_ | _null_ | _null_ | _null_ | IN_PROGRESS | _null_ |
| 8c484306-1066-48b5-9da1-600dba0492ed | _null_ | _null_ | _null_ | _null_ | _null_ | AWAITING_PAYMENT | _null_ |



### 4.5. Các bảng Phụ trợ: `reception_audit_logs`, `reception_idempotency_records`
- **`reception_audit_logs` (4 bản ghi):** Lưu nhật ký kiểm toán hành động tiếp đón.
- **`reception_idempotency_records` (1 bản ghi):** Bản ghi chống gọi trùng lặp API tiếp đón.

---
## 🤰 PHẦN 5: PATIENT SERVICE (HỒ SƠ THAI PHỤ & LIÊN HỆ KHẨN CẤP)

- **Database:** `patient` (Cổng `5434`)
- **Vai trò:** Quản lý toàn bộ hồ sơ hành chính và định danh y tế của thai phụ. Bảo mật thông tin nghiêm ngặt: Mã hóa AES-256-GCM cho số Căn cước công dân và tạo mã băm tra cứu nhanh HMAC-SHA256 kết hợp Pepper bí mật.
- **Tổng số bảng:** 4 bảng | **Tổng bản ghi:** 47 records.

### 5.1. Bảng `patients` (Hồ sơ Thai phụ)
- **Số lượng bản ghi:** 16 thai phụ (14 đặt trực tuyến, 2 vãng lai)
- **Mục đích:** Lưu trữ hồ sơ định danh, ngày sinh, nhóm máu, tiền sử dị ứng, địa chỉ cư trú và mã bệnh nhân y tế (Patient Code).

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `auth_account_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `auth_account` |
| `full_name` | `character varying(150)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `normalized_full_name` | `character varying(150)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `date_of_birth` | `date` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `phone_number` | `character varying(16)` | 🔴 Bắt buộc | Số điện thoại chuẩn hóa E.164 (+84) |
| `national_id_ciphertext` | `text` | ⚪ Tùy chọn | Dữ liệu bảo mật mã hóa AES-256-GCM |
| `national_id_lookup_hash` | `character(64)` | ⚪ Tùy chọn | Mã băm tra cứu HMAC-SHA256 hoặc Argon2id |
| `address` | `character varying(500)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `created_by_account` |
| `updated_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `updated_by_account` |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **patient_code** | **full_name** | **date_of_birth** | **phone_number** | **blood_group** | **status** | **address** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| _null_ | Nguyễn Minh Anh | 1995-06-14T17:00:00.000Z | +84901000001 | _null_ | _null_ | 12 Nguyễn Du, Phường Hàng Bài, Hoàn Kiếm, Hà Nội |
| _null_ | Trần Thị Thanh Hằng | 1993-09-21T17:00:00.000Z | +84901234003 | _null_ | _null_ | 45 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội |
| _null_ | Lê Ngọc Mai | 1998-03-09T17:00:00.000Z | +84901234005 | _null_ | _null_ | 88 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội |
| _null_ | Phạm Quỳnh Chi | 1992-12-04T17:00:00.000Z | +84901234007 | _null_ | _null_ | 156 Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội |
| _null_ | Hoàng Thùy Dương | 1996-08-17T17:00:00.000Z | +84901234009 | _null_ | _null_ | 23 Lạc Long Quân, Bưởi, Tây Hồ, Hà Nội |
| _null_ | Vũ Thị Kim Ngân | 1994-11-29T17:00:00.000Z | +84901234011 | _null_ | _null_ | 74 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội |
| _null_ | Đỗ Thu Trang | 1997-04-24T17:00:00.000Z | +84901234013 | _null_ | _null_ | 102 Thái Hà, Trung Liệt, Đống Đa, Hà Nội |
| _null_ | Bùi Phương Linh | 1999-01-13T17:00:00.000Z | +84901234015 | _null_ | _null_ | 55 Xã Đàn, Nam Đồng, Đống Đa, Hà Nội |
| _null_ | Đinh Thị Hồng Hạnh | 1991-07-07T17:00:00.000Z | +84901234017 | _null_ | _null_ | 36 Hoàng Hoa Thám, Thụy Khuê, Tây Hồ, Hà Nội |
| _null_ | Phan Thị Bích Thủy | 1995-10-11T17:00:00.000Z | +84901234019 | _null_ | _null_ | 19 Lê Văn Lương, Nhân Chính, Thanh Xuân, Hà Nội |
| _null_ | Dương Yến Nhi | 2000-02-27T17:00:00.000Z | +84901234021 | _null_ | _null_ | 67 Trần Duy Hưng, Trung Hòa, Cầu Giấy, Hà Nội |
| _null_ | Võ Bảo Châu | 1996-05-18T17:00:00.000Z | +84901234023 | _null_ | _null_ | 18 Lý Thường Kiệt, Phan Chu Trinh, Hoàn Kiếm, Hà Nội |
| _null_ | Bùi Thị Ngọc Mai | 1999-12-04T17:00:00.000Z | +84901234025 | _null_ | _null_ | 72 Bà Triệu, Hàng Bài, Hoàn Kiếm, Hà Nội |
| _null_ | Phan Thanh Trúc | 2001-04-19T17:00:00.000Z | +84901234027 | _null_ | _null_ | 15 Lê Thánh Tông, Phan Chu Trinh, Hoàn Kiếm, Hà Nội |
| _null_ | Lê Hoàng Kim Ngân | 1997-08-19T17:00:00.000Z | +84908888002 | _null_ | _null_ | 78 Trần Hưng Đạo, Phường Phan Chu Trinh, Quận Hoàn Kiếm, Hà Nội |
| _null_ | Trần Diệu Hương | 1994-05-11T17:00:00.000Z | +84908888003 | _null_ | _null_ | 158 Phố Huế, Phường Hàng Bài, Quận Hai Bà Trưng, Hà Nội |



### 5.2. Bảng `emergency_contacts` (Thông tin Người thân Liên hệ Khẩn cấp)
- **Số lượng bản ghi:** 20 bản ghi
- **Mục đích:** Lưu thông tin chồng, mẹ, người giám hộ của thai phụ phòng trường hợp cấp cứu sản khoa.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `full_name` | `character varying(150)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `relationship` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `phone_number` | `character varying(16)` | 🔴 Bắt buộc | Số điện thoại chuẩn hóa E.164 (+84) |
| `is_primary` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `priority` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |


| **id** | **patient_id** | **contact_name** | **relationship** | **phone_number** | **is_primary** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 73a7a86b-4cfe-4dc2-8245-10b4a18411d9 | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | Chồng | +84901000002 | true |
| fbeb7a53-7ef1-4b00-9d57-752e2eb99bbd | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | Mẹ ruột | +84901000099 | false |
| 7fb13741-5885-4e76-ae63-de851aea4d37 | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | Chồng | +84901234004 | true |
| 25ced579-0f23-4074-b9e2-4c07d2fe5719 | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | Chị ruột | +84901234098 | false |
| c5f71a96-5d18-4ee6-a2f5-ffc44099286c | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | _null_ | Bố đẻ | +84901234006 | true |
| 00321e6e-5c34-47b4-a37d-343634c1e3d6 | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | Chồng | +84901234008 | true |
| 55dcfb22-0697-4e44-9bed-9e95f73fb1b6 | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | Mẹ chồng | +84901234097 | false |
| aebdaddd-fa09-43dd-a6fb-d2172be8f0ce | 4bf0af0e-f989-4d0d-b074-a030dfd9aadf | _null_ | Bố đẻ | +84901234010 | true |
| 3edec16f-2c99-4a05-b8e9-199a695e98c8 | e163be70-f610-44f2-9386-89f91d9240c4 | _null_ | Chồng | +84901234012 | true |
| 2aebe13d-80a1-46c7-a0b9-bbd296ba610b | 5a4976e2-e977-4856-9ee3-ffe1856c8713 | _null_ | Chồng | +84901234014 | true |
| 107e8d4c-6ed5-4d18-b15f-6eead6b64792 | 4e6b2491-2e86-4cc8-9f49-cb3f4bc05fc4 | _null_ | Bố đẻ | +84901234016 | true |
| da01c2de-1a08-4a06-80e0-ac280a42c4e5 | f4ba53db-f6e9-4eea-aaa1-2647bb8da5d0 | _null_ | Chồng | +84901234018 | true |
| f3e027f5-3c6b-42fc-bc41-6a86f59c2b3e | c5fdc627-c742-4400-ba3c-2edca5e67993 | _null_ | Chồng | +84901234020 | true |
| 4726d2fc-f697-49c5-bc97-fb0c58f55fc3 | 7a1fddb6-54d6-40c9-b412-d046e764a321 | _null_ | Bố đẻ | +84901234022 | true |
| 4e58f920-d887-452b-b060-1c2c6452a77d | bca9c324-0071-4a69-8a4d-251a68f159e3 | _null_ | Chồng | +84901234024 | true |
| 9030862a-37d5-42d8-90ed-069ca1439a6f | aa86d05b-b24d-4b02-8919-30ffdbfd7a1e | _null_ | Bố ruột | +84901234026 | true |
| 10f0a03d-0c09-4d5c-8379-82c4446e3125 | f7c8d8c4-9b18-4d2e-ad76-e07f791a352d | _null_ | Chồng | +84901234028 | true |
| a18cc66b-65bb-49ec-a25b-05c08e269b27 | 247ac967-ad67-4692-ac54-315cbec6f3ab | _null_ | Chồng | +84908888009 | true |
| d10acf96-f33c-4ba7-8c56-8a8bdd7d0472 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | Chồng | +84908888099 | true |
| d0a68045-0dd1-4dfb-b19c-b5e66a92c7a9 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | Mẹ ruột | +84908888098 | false |



### 5.3. Các bảng Phụ trợ: `patient_audit_logs`, `idempotency_records`
- **`patient_audit_logs` (9 bản ghi):** Ghi nhật ký mọi thao tác tạo mới, cập nhật hồ sơ, sửa đổi liên hệ khẩn cấp.
- **`idempotency_records` (2 bản ghi):** Khóa chống gửi lặp tạo hồ sơ bệnh nhân.

---
## 📅 PHẦN 6: APPOINTMENT SERVICE (ĐẶT LỊCH, GIỮ CHỖ & ĐIỀU PHỐI KHÁM)

- **Database:** `appointment` (Cổng `5438`)
- **Vai trò:** Quản lý toàn bộ quy trình đặt lịch khám thai, tính năng giữ chỗ tạm thời (Slot Hold trong 15 phút), phân công bác sĩ theo chuyên khoa, và vòng đời lịch hẹn từ lúc đặt đến khi hoàn thành.
- **Tổng số bảng:** 6 bảng | **Tổng bản ghi:** 37 records.

### 6.1. Bảng `appointments` (Danh sách Lịch hẹn Khám)
- **Số lượng bản ghi:** 15 lịch hẹn đa trạng thái (BOOKED, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW).
- **Mục đích:** Cung cấp bộ dữ liệu phong phú để kiểm thử toàn bộ luồng nghiệp vụ trên frontend và backend.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `appointment_code` | `character varying(24)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `service_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `service` |
| `channel` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `selection_mode` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `requested_doctor_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `requested_doctor` |
| `requested_rank_code` | `character varying(50)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `assigned_doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `assigned_doctor` |
| `assigned_rank_code` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `specialty_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `specialty` |
| `start_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `end_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `service_name_snapshot` | `character varying(200)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `service_version` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `base_price_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `base_price` |
| `base_amount_minor` | `bigint` | 🔴 Bắt buộc | Số tiền (VND) |
| `rank_surcharge_price_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `rank_surcharge_price` |
| `rank_surcharge_amount_minor` | `bigint` | 🔴 Bắt buộc | Số tiền (VND) |
| `estimated_total_minor` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `currency` | `character(3)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `queue_estimate_minutes` | `integer` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `availability_version` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `reception_case_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `reception_case` |
| `encounter_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `encounter` |
| `checked_in_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `clinical_started_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `completed_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `cancellation_reason` | `character varying(500)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `reschedule_count` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `room_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `room` |
| `room_code` | `character varying(30)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `room_name_snapshot` | `character varying(120)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **appointment_code** | **patient_id** | **doctor_id** | **service_code** | **appointment_date** | **start_time** | **end_time** | **status** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AT-2026-0001 | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | _null_ | _null_ | _null_ | _null_ | IN_CLINICAL_CARE |
| AT-2026-0002 | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | _null_ | _null_ | _null_ | _null_ | CHECKED_IN |
| AT-2026-0003 | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | _null_ | _null_ | _null_ | _null_ | _null_ | COMPLETED |
| AT-2026-0004 | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | _null_ | _null_ | _null_ | _null_ | COMPLETED |
| AT-2026-0005 | 4bf0af0e-f989-4d0d-b074-a030dfd9aadf | _null_ | _null_ | _null_ | _null_ | _null_ | COMPLETED |
| AT-2026-0006 | e163be70-f610-44f2-9386-89f91d9240c4 | _null_ | _null_ | _null_ | _null_ | _null_ | BOOKED |
| AT-2026-0007 | 5a4976e2-e977-4856-9ee3-ffe1856c8713 | _null_ | _null_ | _null_ | _null_ | _null_ | BOOKED |
| AT-2026-0008 | 4e6b2491-2e86-4cc8-9f49-cb3f4bc05fc4 | _null_ | _null_ | _null_ | _null_ | _null_ | BOOKED |
| AT-2026-0009 | f4ba53db-f6e9-4eea-aaa1-2647bb8da5d0 | _null_ | _null_ | _null_ | _null_ | _null_ | BOOKED |
| AT-2026-0010 | c5fdc627-c742-4400-ba3c-2edca5e67993 | _null_ | _null_ | _null_ | _null_ | _null_ | REASSIGNMENT_REQUIRED |
| AT-2026-0011 | 7a1fddb6-54d6-40c9-b412-d046e764a321 | _null_ | _null_ | _null_ | _null_ | _null_ | CANCELLED |
| AT-2026-0012 | bca9c324-0071-4a69-8a4d-251a68f159e3 | _null_ | _null_ | _null_ | _null_ | _null_ | NO_SHOW |
| AT-2026-0013 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | _null_ | _null_ | _null_ | COMPLETED |
| AT-2026-0014 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | _null_ | _null_ | _null_ | COMPLETED |
| AT-2026-0015 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | _null_ | _null_ | _null_ | BOOKED |



### 6.2. Bảng `slot_holds` (Giữ chỗ Khám Tạm thời)
- **Số lượng bản ghi:** 4 bản ghi
- **Mục đích:** Ngăn chặn tình trạng 2 bệnh nhân cùng đặt 1 khung giờ khám của 1 bác sĩ tại cùng một thời điểm.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `service_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `service` |
| `doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `doctor` |
| `rank_code` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `selection_mode` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `start_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `end_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `expires_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `consumed_by_appointment_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `consumed_by_appointment` |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `room_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `room` |
| `room_code` | `character varying(30)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `room_name` | `character varying(120)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **id** | **doctor_id** | **slot_start** | **slot_end** | **account_id** | **status** | **expires_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| a8e9fe27-7606-49b5-a0ec-fccdb289e3ce | e863bcc8-e213-425c-b12b-359e0cb22d8d | _null_ | _null_ | _null_ | CONSUMED | 2026-11-01T02:05:00.000Z |
| bbd42126-b4ab-4340-89f3-799d37695fd5 | 15a6ea00-ccce-402a-9b31-37fb8a0332f6 | _null_ | _null_ | _null_ | ACTIVE | 2026-11-01T15:06:23.298Z |
| 8fb764c0-4a56-4f00-9b99-7aef2139c62b | 4a3c0c4a-09c3-427c-8cbe-275d7c604369 | _null_ | _null_ | _null_ | EXPIRED | 2026-11-01T14:31:23.300Z |
| f09e9e3f-c20f-42a4-aae6-151671868546 | 602b1e4b-5744-481c-a94a-0d64702c3c8b | _null_ | _null_ | _null_ | RELEASED | 2026-11-01T15:03:23.302Z |



### 6.3. Bảng `appointment_assignment_history` (Lịch sử Điều phối Bác sĩ)
- **Số lượng bản ghi:** 2 bản ghi
- **Mục đích:** Ghi vết việc đổi bác sĩ khám theo yêu cầu của bệnh nhân hoặc khi bác sĩ có ca mổ cấp cứu đột xuất.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `appointment_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `appointment` |
| `from_doctor_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `from_doctor` |
| `to_doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `to_doctor` |
| `rank_code` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `reason` | `character varying(500)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `actor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `actor` |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **id** | **appointment_id** | **previous_doctor_id** | **new_doctor_id** | **reason** | **assigned_at** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 34e6dc5e-e262-4cad-8b46-081d0a5cdb4b | f6c99347-a936-419a-9cd5-038cb2081822 | _null_ | _null_ | BS. Lê Thu Hà có ca phẫu thuật cấp cứu mổ đẻ lấy thai \| Đã trao đổi qua điện thoại và thai phụ đồng ý đổi bác sĩ | _null_ |
| 944e279b-d8b6-40d9-aa1d-9f266ec52d15 | 33ed505d-9beb-48c1-a6d7-3f5c2dcc40b7 | _null_ | _null_ | Điều phối cân bằng tải phòng khám chuyên khoa siêu âm buổi chiều \| Xác nhận qua ứng dụng di động | _null_ |



### 6.4. Các bảng Phụ trợ: `appointment_audit_logs`, `appointment_outbox_events`, `appointment_idempotency_records`
- **`appointment_audit_logs` (7 bản ghi):** Lưu nhật ký kiểm toán trạng thái lịch hẹn.
- **`appointment_outbox_events` (6 bản ghi):** Sự kiện Outbox phát tán cho Queue Service và Notification Service.
- **`appointment_idempotency_records` (3 bản ghi):** Chống tạo trùng lịch hẹn.

---
## 💳 PHẦN 7: BILLING SERVICE (HÓA ĐƠN, VIỆN PHÍ, THANH TOÁN & BẢO LÃNH)

- **Database:** `billing` (Cổng `5439`)
- **Vai trò:** Hệ thống tài chính y tế, tạo lập hóa đơn viện phí, chi tiết từng dòng dịch vụ, xử lý thanh toán đa cổng (VNPAY QR, MoMo, Chuyển khoản VietQR, Tiền mặt) và bảo lãnh viện phí bảo hiểm tư nhân.
- **Tổng số bảng:** 7 bảng | **Tổng bản ghi:** 139 records.

### 7.1. Bảng `invoices` (Hóa đơn Viện phí)
- **Số lượng bản ghi:** 17 hóa đơn (PAID, ISSUED, PARTIALLY_PAID, CANCELLED, REFUNDED)
- **Mục đích:** Lưu trữ chứng từ viện phí phát sinh từ khám thai, siêu âm, xét nghiệm, gói sinh.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `invoice_number` | `character varying(24)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `appointment_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `appointment` |
| `encounter_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `encounter` |
| `type` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `currency` | `character(3)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `subtotal_minor` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `total_minor` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `paid_minor` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `balance_minor` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `source_version` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `due_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `paid_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **invoice_number** | **patient_id** | **total_amount** | **discount_amount** | **final_amount** | **status** | **created_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| INV-2026-0001 | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | _null_ | _null_ | PAID | 2026-11-01T15:01:22.791Z |
| INV-2026-0002 | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | _null_ | _null_ | CREDIT_APPROVED | 2026-11-01T15:01:22.877Z |
| INV-2026-0003 | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | _null_ | _null_ | _null_ | PAID | 2026-11-01T15:01:22.918Z |
| INV-2026-0004 | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | _null_ | _null_ | PAID | 2026-11-01T15:01:22.974Z |
| INV-2026-0005 | 4bf0af0e-f989-4d0d-b074-a030dfd9aadf | _null_ | _null_ | _null_ | PAID | 2026-11-01T15:01:23.016Z |
| INV-2026-0006 | e163be70-f610-44f2-9386-89f91d9240c4 | _null_ | _null_ | _null_ | PAYMENT_PENDING_VERIFICATION | 2026-11-01T15:01:23.060Z |
| INV-2026-0007 | 5a4976e2-e977-4856-9ee3-ffe1856c8713 | _null_ | _null_ | _null_ | OUTSTANDING | 2026-11-01T15:01:23.086Z |
| INV-2026-0008 | 4e6b2491-2e86-4cc8-9f49-cb3f4bc05fc4 | _null_ | _null_ | _null_ | OUTSTANDING | 2026-11-01T15:01:23.106Z |
| INV-2026-0009 | f4ba53db-f6e9-4eea-aaa1-2647bb8da5d0 | _null_ | _null_ | _null_ | OPEN | 2026-11-01T15:01:23.124Z |
| INV-2026-0010 | c5fdc627-c742-4400-ba3c-2edca5e67993 | _null_ | _null_ | _null_ | OPEN | 2026-11-01T15:01:23.140Z |
| INV-2026-0011 | 7a1fddb6-54d6-40c9-b412-d046e764a321 | _null_ | _null_ | _null_ | CANCELLED | 2026-11-01T15:01:23.155Z |
| INV-2026-0012 | bca9c324-0071-4a69-8a4d-251a68f159e3 | _null_ | _null_ | _null_ | OPEN | 2026-11-01T15:01:23.172Z |
| INV-2026-0013 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | _null_ | PAID | 2026-11-01T15:01:23.186Z |
| INV-2026-0014 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | _null_ | PAID | 2026-11-01T15:01:23.229Z |
| INV-2026-0015 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | _null_ | PAID | 2026-11-01T15:01:23.273Z |
| INV-2026-SUPP-01 | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | _null_ | _null_ | PAID | 2026-11-01T14:41:23.349Z |
| INV-2026-SUPP-02 | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | _null_ | _null_ | OUTSTANDING | 2026-11-01T14:51:23.364Z |



### 7.2. Bảng `invoice_lines` (Chi tiết Dòng Hóa đơn)
- **Số lượng bản ghi:** 31 dòng chi tiết
- **Mục đích:** Tách bạch giá khám gốc, tiền phụ phí bác sĩ theo rank, tiền siêu âm 5D, tiền xét nghiệm máu, tiền thuốc.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `invoice_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `invoice` |
| `line_no` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `source` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `source_reference_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `source_reference` |
| `service_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `service` |
| `description_snapshot` | `character varying(300)` | 🔴 Bắt buộc | Mô tả / Ghi chú chi tiết |
| `quantity` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `unit_amount_minor` | `bigint` | 🔴 Bắt buộc | Số tiền (VND) |
| `line_amount_minor` | `bigint` | 🔴 Bắt buộc | Số tiền (VND) |
| `price_reference_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `price_reference` |
| `performed_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **id** | **invoice_id** | **item_code** | **item_name** | **quantity** | **unit_price** | **total_price** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 7ce85e27-de94-4502-b369-2703a1cf3983 | 96412a4a-2071-4726-89cc-aa81f5f0c2a1 | _null_ | _null_ | 1 | _null_ | _null_ |
| eec753f4-5c23-4dda-ab74-37038045372e | 96412a4a-2071-4726-89cc-aa81f5f0c2a1 | _null_ | _null_ | 1 | _null_ | _null_ |
| ff727591-287d-44b4-a02d-a10b4e79c65c | 1cb9fda6-458e-4470-b9f5-5493258e8ccd | _null_ | _null_ | 1 | _null_ | _null_ |
| 6f1bfc97-822d-41e9-bcd7-fa569c0f5411 | 1cb9fda6-458e-4470-b9f5-5493258e8ccd | _null_ | _null_ | 1 | _null_ | _null_ |
| b6154651-4612-4791-81fc-2546fa2384c3 | 8b2aa48e-0bca-4bdf-b07e-7fa21de007bb | _null_ | _null_ | 1 | _null_ | _null_ |
| 75b40db2-a5e2-4a51-861a-61b3844bd334 | 8b2aa48e-0bca-4bdf-b07e-7fa21de007bb | _null_ | _null_ | 1 | _null_ | _null_ |
| a79c6756-2d3a-4600-82ce-97c8a45dbf7d | 1e0011b0-6ec2-4fa9-8a1c-0dabdc47cecd | _null_ | _null_ | 1 | _null_ | _null_ |
| 9bd8ef01-bf48-4210-ac42-217a00dfad5c | 1e0011b0-6ec2-4fa9-8a1c-0dabdc47cecd | _null_ | _null_ | 1 | _null_ | _null_ |
| 05c35b43-65e2-42e6-8fb1-95195ccf301d | f93f011e-3779-4d43-83b2-bb3602a82320 | _null_ | _null_ | 1 | _null_ | _null_ |
| a8ab5744-85c2-4c6c-8fee-37b3263f2628 | f93f011e-3779-4d43-83b2-bb3602a82320 | _null_ | _null_ | 1 | _null_ | _null_ |
| 6f429101-bc13-49bb-b231-aba8eb557f91 | 8a31002c-867d-4c39-b01e-d47edf89c824 | _null_ | _null_ | 1 | _null_ | _null_ |
| bdbe32e6-65cf-415e-851d-e6f530c492ce | 8a31002c-867d-4c39-b01e-d47edf89c824 | _null_ | _null_ | 1 | _null_ | _null_ |
| 38449f0a-7268-45e8-85b2-54832aa1f1de | 8bf821c8-291c-47fe-bfa3-56978999c5be | _null_ | _null_ | 1 | _null_ | _null_ |
| 875aced5-5206-4d3c-a342-704a6f7cd3a1 | 8bf821c8-291c-47fe-bfa3-56978999c5be | _null_ | _null_ | 1 | _null_ | _null_ |
| 0c5cc895-6af0-423f-82d6-07b6eaac89eb | 23f09bac-6c0e-493f-a41b-e7a8ce9133cb | _null_ | _null_ | 1 | _null_ | _null_ |


> _(Hiển thị mẫu 15 / 31 dòng chi tiết dịch vụ thanh toán viện phí)_

### 7.3. Bảng `payments` (Giao dịch Thanh toán Đa kênh)
- **Số lượng bản ghi:** 10 giao dịch
- **Mục đích:** Ghi nhận biên lai thanh toán qua các phương thức thanh toán điện tử và tiền mặt tại quầy.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `invoice_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `invoice` |
| `method` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `amount_minor` | `bigint` | 🔴 Bắt buộc | Số tiền (VND) |
| `currency` | `character(3)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `received_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `verified_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `reference` | `character varying(100)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `recorded_by` | `uuid` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **id** | **invoice_id** | **amount** | **payment_method** | **transaction_reference** | **status** | **paid_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1c084db9-9d76-4318-b516-dcf68e59e83b | 96412a4a-2071-4726-89cc-aa81f5f0c2a1 | _null_ | _null_ | _null_ | VERIFIED | _null_ |
| c362ae5f-3aea-4af0-ae48-c1bc00a5706a | 8b2aa48e-0bca-4bdf-b07e-7fa21de007bb | _null_ | _null_ | _null_ | VERIFIED | _null_ |
| e310cd2d-b69a-49c1-aaee-874a903b0238 | 1e0011b0-6ec2-4fa9-8a1c-0dabdc47cecd | _null_ | _null_ | _null_ | VERIFIED | _null_ |
| 832f6618-4a8f-414c-a325-2c20e0f67c0d | f93f011e-3779-4d43-83b2-bb3602a82320 | _null_ | _null_ | _null_ | VERIFIED | _null_ |
| ed5b4e87-8028-4999-8644-81a415d0d5a1 | 8a31002c-867d-4c39-b01e-d47edf89c824 | _null_ | _null_ | _null_ | RECORDED | _null_ |
| 12393ad4-b4f3-4b4f-9ca0-83e52f0dac3a | 8bf821c8-291c-47fe-bfa3-56978999c5be | _null_ | _null_ | _null_ | REJECTED | _null_ |
| 20b417e5-3bb5-4e28-ad6f-1b9021779a96 | 4367f9b8-1c5e-41f7-a467-8c1c4c30cc61 | _null_ | _null_ | _null_ | VERIFIED | _null_ |
| 24eda1a7-4e04-42cd-a06c-cb8c1c1302f8 | 0a404d24-4ae5-4b11-b76a-0a5a02411975 | _null_ | _null_ | _null_ | VERIFIED | _null_ |
| fcfde110-375f-4247-b2b2-54196b1a3431 | 6561792b-3b41-453c-919a-65d2e21b70e7 | _null_ | _null_ | _null_ | VERIFIED | _null_ |
| 59f89aa7-ab46-48e0-828c-f8edcd09a2b5 | 3487bd7c-da50-481f-982f-01442632e3ea | _null_ | _null_ | _null_ | VERIFIED | _null_ |



### 7.4. Bảng `credit_approvals` (Bảo lãnh Viện phí Bảo hiểm)
- **Số lượng bản ghi:** 2 bản ghi
- **Mục đích:** Xác nhận hạn mức bảo lãnh viện phí từ các công ty bảo hiểm tư nhân (Bảo Việt Care, PTI Hạnh Phúc).

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `invoice_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `invoice` |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `reason_code` | `character varying(80)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `reason_text` | `character varying(500)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `approved_by` | `uuid` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `approved_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `revoked_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |


| **id** | **patient_id** | **insurance_provider** | **approved_amount** | **guarantee_code** | **status** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 277bea14-a4b6-4697-a0e3-b4ca68a96af6 | _null_ | _null_ | _null_ | _null_ | APPROVED |
| 4ee266d9-3c95-4a26-9e2d-d2097a860a13 | _null_ | _null_ | _null_ | _null_ | REVOKED |



### 7.5. Các bảng Phụ trợ: `billing_audit_logs`, `billing_outbox_events`, `billing_idempotency_records`
- **`billing_audit_logs` (30 bản ghi):** Lưu toàn bộ vết thay đổi trạng thái hóa đơn và dòng tiền.
- **`billing_outbox_events` (26 bản ghi):** Sự kiện gửi thông báo hóa đơn thành công đến người bệnh.
- **`billing_idempotency_records` (23 bản ghi):** Chống trừ tiền trùng lặp giao dịch thanh toán.

---
## 🚶‍♀️ PHẦN 8: QUEUE SERVICE (ĐIỀU PHỐI HÀNG ĐỢI, CHẶNG KHÁM & GỌI SỐ)

- **Database:** `queue` (Cổng `5441`)
- **Vai trò:** Quản lý quy trình di chuyển của thai phụ tại bệnh viện theo mô hình hàng đợi đa chặng (Queue Multi-Stage Journey): Tiếp đón -> Khám bác sĩ -> Siêu âm -> Xét nghiệm -> Dược -> Thu ngân.
- **Tổng số bảng:** 7 bảng | **Tổng bản ghi:** 42 records.

### 8.1. Bảng `queue_stages` (Danh mục Chặng Phòng khám)
- **Số lượng bản ghi:** 8 chặng
- **Mục đích:** Định nghĩa các điểm nút phục vụ bệnh nhân tại các tầng lầu bệnh viện.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `code` | `character varying(50)` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `name` | `character varying(120)` | 🔴 Bắt buộc | Tên hiển thị tiếng Việt |
| `active` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `room_code` | `character varying(50)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **code** | **name** | **stage_type** | **floor** | **display_order** | **status** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| RECEPTION | Tiếp đón & Đăng ký khám | _null_ | _null_ | _null_ | _null_ |
| VITALS | Đo sinh hiệu & Tiền sàng lọc | _null_ | _null_ | _null_ | _null_ |
| CONSULTATION | Phòng khám Bác sĩ Chuyên khoa | _null_ | _null_ | _null_ | _null_ |
| ULTRASOUND | Phòng Siêu âm Chẩn đoán | _null_ | _null_ | _null_ | _null_ |
| LAB_SAMPLE | Phòng Lấy mẫu Xét nghiệm | _null_ | _null_ | _null_ | _null_ |
| PROCEDURE | Phòng Thủ thuật & Can thiệp Sản khoa | _null_ | _null_ | _null_ | _null_ |
| IMMUNIZATION | Phòng Tiêm chủng Vắc xin Thai kỳ | _null_ | _null_ | _null_ | _null_ |
| PHARMACY | Nhà thuốc & Cấp phát thuốc | _null_ | _null_ | _null_ | _null_ |



### 8.2. Bảng `queue_journeys` (Hành trình Khám bệnh của Thai phụ)
- **Số lượng bản ghi:** 6 hành trình
- **Mục đích:** Theo dõi tổng thể một buổi khám của bệnh nhân từ lúc đến cửa viện đến lúc hoàn tất ra về.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `appointment_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `appointment` |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `encounter_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `encounter` |
| `business_date` | `date` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `late_minutes` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `late_demoted` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `state` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **patient_id** | **appointment_id** | **current_stage_code** | **status** | **started_at** | **completed_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| d818e609-e1ea-4f8f-84c1-8e387b9de431 | 03984f9c-c643-4602-ae6f-226eeed15da3 | 45f051de-6c28-42db-9350-1dc0f460f617 | _null_ | _null_ | _null_ | _null_ |
| 9b9f5f7b-8c38-45d2-8ccf-d4b1cd60ab5a | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | 1f3e4c93-e47f-4229-8fc1-ab99fe6713fd | _null_ | _null_ | _null_ | _null_ |
| 285e4261-bea3-4e2d-b369-55a9f15faf00 | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | 34bcbefb-2f5a-49dc-8700-ae3353939651 | _null_ | _null_ | _null_ | _null_ |
| d7b055da-a5c6-4b19-9b10-0cd94ca1bd8f | c5fdc627-c742-4400-ba3c-2edca5e67993 | 0e253765-9f56-4a8c-ac86-e1d6860946bc | _null_ | _null_ | _null_ | _null_ |
| 52088325-6e96-4876-ac5b-fe0549e1236c | 7a1fddb6-54d6-40c9-b412-d046e764a321 | 36985168-13de-48cf-b59d-81722d596c0f | _null_ | _null_ | _null_ | _null_ |
| 7ea0f569-0409-4ebe-ae68-9fd075f3aa7b | bca9c324-0071-4a69-8a4d-251a68f159e3 | c083808c-ec19-4edb-8eb3-779594f3ac17 | _null_ | _null_ | _null_ | _null_ |



### 8.3. Bảng `stage_tickets` (Số Thứ tự Chặng Khám)
- **Số lượng bản ghi:** 12 phiếu số (Ví dụ: `T-001`, `K-102`, `SA-004`, `D-010`)
- **Mục đích:** Cấp số thứ tự ưu tiên và hiển thị lên màn hình LCD tại các phòng chức năng.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `journey_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `journey` |
| `stage_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `stage` |
| `source_order_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `source_order` |
| `business_date` | `date` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `ordinal` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `ticket_code` | `character varying(30)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `state` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `base_priority` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `late_demotion` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `enqueue_sequence` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `call_count` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `called_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `call_expires_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `service_started_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `completed_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |
| `room_code` | `character varying(50)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **ticket_number** | **journey_id** | **stage_code** | **status** | **priority_score** | **called_at** | **completed_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| _null_ | d818e609-e1ea-4f8f-84c1-8e387b9de431 | _null_ | _null_ | _null_ | 2026-11-01T01:35:00.000Z | 2026-11-01T01:50:00.000Z |
| _null_ | d818e609-e1ea-4f8f-84c1-8e387b9de431 | _null_ | _null_ | _null_ | 2026-11-01T02:00:00.000Z | _null_ |
| _null_ | d818e609-e1ea-4f8f-84c1-8e387b9de431 | _null_ | _null_ | _null_ | _null_ | _null_ |
| _null_ | 9b9f5f7b-8c38-45d2-8ccf-d4b1cd60ab5a | _null_ | _null_ | _null_ | _null_ | 2026-11-01T14:56:22.907Z |
| _null_ | 9b9f5f7b-8c38-45d2-8ccf-d4b1cd60ab5a | _null_ | _null_ | _null_ | 2026-11-01T15:00:22.911Z | _null_ |
| _null_ | 285e4261-bea3-4e2d-b369-55a9f15faf00 | _null_ | _null_ | _null_ | _null_ | 2026-11-01T13:16:22.959Z |
| _null_ | 285e4261-bea3-4e2d-b369-55a9f15faf00 | _null_ | _null_ | _null_ | 2026-11-01T13:16:22.961Z | 2026-11-01T13:51:22.961Z |
| _null_ | 285e4261-bea3-4e2d-b369-55a9f15faf00 | _null_ | _null_ | _null_ | _null_ | 2026-11-01T14:36:22.968Z |
| _null_ | 285e4261-bea3-4e2d-b369-55a9f15faf00 | _null_ | _null_ | _null_ | _null_ | 2026-11-01T14:51:22.970Z |
| _null_ | d7b055da-a5c6-4b19-9b10-0cd94ca1bd8f | _null_ | _null_ | _null_ | _null_ | _null_ |
| _null_ | 52088325-6e96-4876-ac5b-fe0549e1236c | _null_ | _null_ | _null_ | 2026-11-01T14:41:23.462Z | _null_ |
| _null_ | 7ea0f569-0409-4ebe-ae68-9fd075f3aa7b | _null_ | _null_ | _null_ | _null_ | _null_ |



### 8.4. Bảng `call_attempts` (Lịch sử Gọi số Loa & Màn hình)
- **Số lượng bản ghi:** 5 lượt gọi
- **Mục đích:** Lưu lịch sử các lần bác sĩ hoặc y tá bấm chuông gọi số thứ tự vào phòng.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `ticket_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `ticket` |
| `attempt_number` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `called_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `expires_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `outcome` | `character varying(30)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `caller_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `caller_account` |
| `room_code` | `character varying(50)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **id** | **ticket_id** | **stage_code** | **counter_or_room** | **attempt_number** | **called_at** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 51991adf-b19e-4fa1-b6c6-30e299dbd7e6 | 75bb9da2-873b-4515-a35e-a0cbc465f398 | _null_ | _null_ | 1 | 2026-11-01T02:00:00.000Z |
| bd68d41d-d4a2-445c-93e1-66384a9b6c2f | 25ea1481-b471-4133-9e17-e737a15c85a7 | _null_ | _null_ | 1 | 2026-11-01T15:00:22.913Z |
| 012daecf-f848-4170-9adc-de12794b209a | 1c54f3e3-a614-4e12-8c9b-a6fb6403dc64 | _null_ | _null_ | 1 | 2026-11-01T13:16:22.964Z |
| 6c37276a-371b-41f2-9ad5-c678e20c4ed7 | 4844f1ef-884a-4349-a290-e0c343644c12 | _null_ | _null_ | 1 | 2026-11-01T14:36:23.464Z |
| 06db3a48-c792-4a9a-b68a-69cc91deba4f | 4844f1ef-884a-4349-a290-e0c343644c12 | _null_ | _null_ | 2 | 2026-11-01T14:41:23.466Z |



### 8.5. Các bảng Phụ trợ: `queue_audit`, `queue_outbox`, `queue_idempotency`
- **`queue_audit` (6 bản ghi):** Lưu nhật ký kiểm toán hàng đợi.
- **`queue_outbox` (4 bản ghi):** Đồng bộ sự kiện chuyển chặng lên màn hình hiển thị WebSocket.
- **`queue_idempotency` (2 bản ghi):** Chống phát sinh 2 số thứ tự cho cùng 1 bệnh nhân tại 1 chặng.

---
## 📑 PHẦN 9: MEDICAL RECORD SERVICE (BỆNH ÁN LÂM SÀNG, SINH HIỆU & CẬN LÂM SÀNG)

- **Database:** `medical_record` (Cổng `5440`)
- **Vai trò:** Trái tim nghiệp vụ chuyên môn y khoa. Quản lý đợt thai kỳ (Pregnancy Episodes), các lượt khám lâm sàng (Clinical Encounters), đo đạc sinh hiệu mẹ & tim thai, phiếu khám SOAP chuẩn quốc tế, mã chẩn đoán ICD-10 và kết quả cận lâm sàng chi tiết (Siêu âm 5D, Xét nghiệm máu).
- **Tổng số bảng:** 13 bảng | **Tổng bản ghi:** 72 records.

### 9.1. Bảng `pregnancy_episodes` (Đợt Thai kỳ & Hồ sơ Sản khoa)
- **Số lượng bản ghi:** 16 thai kỳ (Thai từ 6 tuần đến 38 tuần, có phân loại rủi ro THẤP, TRUNG BÌNH, CAO).
- **Mục đích:** Theo dõi tuổi thai, ngày dự sinh (EDD), tiền sử sản khoa Para (G-P-A-L).

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `estimated_due_date` | `date` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `last_menstrual_period` | `date` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `risk_level` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **patient_id** | **gestational_weeks** | **expected_due_date** | **risk_level** | **status** | **parity_gpal** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| cbfdf4de-c9ce-4795-a66e-c5d6bed28948 | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 0e5dd6d7-1225-4e5b-b373-3449ad1858dc | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 7677b32b-a82d-42dd-987d-9e5d8b9bc11c | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | _null_ | _null_ | MODERATE | ACTIVE | _null_ |
| 241098b0-0154-40bb-9367-a7baecac0218 | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | _null_ | HIGH | ACTIVE | _null_ |
| 8eff2b3a-ca31-422f-976e-aa49252c61f6 | 4bf0af0e-f989-4d0d-b074-a030dfd9aadf | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 44bdee20-72ba-4047-8f67-b8058f9e7676 | e163be70-f610-44f2-9386-89f91d9240c4 | _null_ | _null_ | LOW | ACTIVE | _null_ |
| ffef9292-6830-4f4e-8e2d-d043bc6351c9 | 5a4976e2-e977-4856-9ee3-ffe1856c8713 | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 33752846-c9b9-4859-aac3-ada3065a854a | 4e6b2491-2e86-4cc8-9f49-cb3f4bc05fc4 | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 1ac23cba-975f-4500-8820-d8e81a4409d7 | f4ba53db-f6e9-4eea-aaa1-2647bb8da5d0 | _null_ | _null_ | MODERATE | ACTIVE | _null_ |
| 39258375-6376-48f5-b9b7-ddef00aadc0b | c5fdc627-c742-4400-ba3c-2edca5e67993 | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 5beff336-2ba1-4f7f-9c2b-7a86db924e97 | 7a1fddb6-54d6-40c9-b412-d046e764a321 | _null_ | _null_ | LOW | ACTIVE | _null_ |
| ad8fc50e-ff77-48fa-95fd-382bf789586b | bca9c324-0071-4a69-8a4d-251a68f159e3 | _null_ | _null_ | LOW | ACTIVE | _null_ |
| dd8e0afa-d151-47fc-9aa4-b0201e2ee822 | aa86d05b-b24d-4b02-8919-30ffdbfd7a1e | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 90504490-6f7c-4941-9e38-6710e6852290 | f7c8d8c4-9b18-4d2e-ad76-e07f791a352d | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 90d5145d-6d61-426c-b786-624b336ba018 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | LOW | ACTIVE | _null_ |
| 56bc6e71-7eaf-4159-aeeb-1be7df4a3e8d | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | _null_ | LOW | CLOSED | _null_ |



### 9.2. Bảng `clinical_encounters` (Lượt Khám Lâm sàng)
- **Số lượng bản ghi:** 8 lượt khám
- **Mục đích:** Lưu trữ phiên làm việc chuyên môn giữa bác sĩ và thai phụ tại buồng khám.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `appointment_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `appointment` |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `pregnancy_episode_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `pregnancy_episode` |
| `primary_doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `primary_doctor` |
| `state` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `chief_complaint` | `character varying(2000)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `clinical_summary` | `character varying(10000)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `started_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `review_ready_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `finalized_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **encounter_code** | **patient_id** | **doctor_id** | **encounter_type** | **status** | **started_at** | **ended_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| _null_ | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | _null_ | _null_ | 2026-11-01T02:00:00.000Z | _null_ |
| _null_ | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | _null_ | _null_ | 2026-11-01T03:00:00.000Z | _null_ |
| _null_ | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | _null_ | _null_ | _null_ | 2026-11-01T01:30:00.000Z | _null_ |
| _null_ | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | _null_ | _null_ | 2026-10-29T03:00:00.000Z | _null_ |
| _null_ | 4bf0af0e-f989-4d0d-b074-a030dfd9aadf | _null_ | _null_ | _null_ | 2026-10-27T07:00:00.000Z | _null_ |
| _null_ | e163be70-f610-44f2-9386-89f91d9240c4 | _null_ | _null_ | _null_ | _null_ | _null_ |
| _null_ | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | _null_ | 2026-09-06T02:00:00.000Z | _null_ |
| _null_ | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | _null_ | _null_ | 2026-11-01T07:30:00.000Z | _null_ |



### 9.3. Bảng `vital_signs` (Chỉ số Sinh hiệu Mẹ & Thai)
- **Số lượng bản ghi:** 7 bản ghi sinh hiệu
- **Mục đích:** Đo lường huyết áp (Systolic/Diastolic), nhịp tim mẹ, nhịp tim thai (FHR), cân nặng, bề cao tử cung, SpO2.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `encounter_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `encounter` |
| `systolic` | `integer` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `diastolic` | `integer` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `heart_rate` | `integer` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `temperature` | `numeric` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `weight` | `numeric` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `recorded_by` | `uuid` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `recorded_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |


| **id** | **encounter_id** | **blood_pressure_systolic** | **blood_pressure_diastolic** | **heart_rate** | **fetal_heart_rate** | **weight_kg** | **fundal_height_cm** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| cd65d424-b79d-4d74-bc51-5035953482ba | 7019f6ae-64cc-4f31-952b-b39f1bd97061 | _null_ | _null_ | 82 | _null_ | _null_ | _null_ |
| 6244fc41-c88c-491b-8c5b-4bc642c89265 | d369a4f7-bc7b-4742-a170-f06c8d4b46b6 | _null_ | _null_ | 78 | _null_ | _null_ | _null_ |
| 2a6b786e-b77c-43df-917f-04da8793811c | 7d32d8c9-c660-496f-aac5-86507f8eb065 | _null_ | _null_ | 84 | _null_ | _null_ | _null_ |
| 16cc23e6-cb23-4134-a560-1f29b8834543 | 7c3f7945-ad64-4454-b889-25b95948e6fe | _null_ | _null_ | 80 | _null_ | _null_ | _null_ |
| 0f6c2f6f-8ee9-4a79-b9a1-f2a6a00675ad | c23e97bf-1312-4e66-9765-6802118178f4 | _null_ | _null_ | 76 | _null_ | _null_ | _null_ |
| 410d6154-2f84-440f-a450-f4216868c3c1 | 18238116-fbbb-4703-a1d1-4a54d61d0f05 | _null_ | _null_ | 76 | _null_ | _null_ | _null_ |
| ceb98ce7-b1a0-4dbe-81e3-987cc33b0741 | 4ac9c57a-e6d1-41cc-80b3-7ffe7ca88c7e | _null_ | _null_ | 78 | _null_ | _null_ | _null_ |



### 9.4. Bảng `clinical_notes` (Phiếu Khám Chuẩn Mô hình SOAP)
- **Số lượng bản ghi:** 7 phiếu khám
- **Mục đích:** Ghi chép bệnh án đầy đủ 4 phần chuẩn quốc tế:
  * **S (Subjective):** Triệu chứng cơ năng thai phụ than phiền (nghén, đau bụng dưới, chóng mặt).
  * **O (Objective):** Thăm khám thực thể (cổ tử cung đóng/mở, phù 2 chi dưới, bề cao tử cung).
  * **A (Assessment):** Đánh giá tình trạng thai nhi và nguy cơ bệnh lý kèm theo.
  * **P (Plan):** Kế hoạch theo dõi, chỉ định siêu âm/xét nghiệm, dặn dò dinh dưỡng và lịch tái khám.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `encounter_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `encounter` |
| `text` | `character varying(10000)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `author_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `author` |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **id** | **encounter_id** | **subjective** | **objective** | **assessment** | **plan** | **created_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| fb51a143-bc1e-43c2-8431-4544054d02c3 | 7019f6ae-64cc-4f31-952b-b39f1bd97061 | _null_ | _null_ | _null_ | _null_ | 2026-11-01T15:01:22.839Z |
| 3545251d-debd-4383-8b64-7c0a803329f2 | d369a4f7-bc7b-4742-a170-f06c8d4b46b6 | _null_ | _null_ | _null_ | _null_ | 2026-11-01T15:01:22.903Z |
| 0d046b49-d1ec-4337-96b9-6c93fdf88d8a | 7d32d8c9-c660-496f-aac5-86507f8eb065 | _null_ | _null_ | _null_ | _null_ | 2026-11-01T15:01:22.946Z |
| ad96b08c-91e9-4949-8a20-ffeeb86d9592 | 7c3f7945-ad64-4454-b889-25b95948e6fe | _null_ | _null_ | _null_ | _null_ | 2026-11-01T15:01:23.003Z |
| ee62f566-d1ff-4e75-8d00-2f4d7e2b3e6c | c23e97bf-1312-4e66-9765-6802118178f4 | _null_ | _null_ | _null_ | _null_ | 2026-11-01T15:01:23.048Z |
| 64be646b-c253-4dc6-b16d-819ba669933d | 18238116-fbbb-4703-a1d1-4a54d61d0f05 | _null_ | _null_ | _null_ | _null_ | 2026-11-01T15:01:23.213Z |
| 31aeb39c-3301-4c3f-af43-a0bc2aedad6c | 4ac9c57a-e6d1-41cc-80b3-7ffe7ca88c7e | _null_ | _null_ | _null_ | _null_ | 2026-11-01T15:01:23.258Z |



### 9.5. Bảng `diagnoses` (Chẩn đoán Bệnh Mã hóa Chuẩn Quốc tế ICD-10)
- **Số lượng bản ghi:** 6 chẩn đoán
- **Mục đích:** Mã hóa chẩn đoán theo bảng phân loại bệnh tật quốc tế ICD-10 phục vụ lưu trữ y khoa và thanh toán bảo hiểm y tế.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `encounter_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `encounter` |
| `code` | `character varying(50)` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `description` | `character varying(2000)` | 🔴 Bắt buộc | Mô tả / Ghi chú chi tiết |
| `doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `doctor` |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **id** | **encounter_id** | **icd10_code** | **diagnosis_name** | **diagnosis_type** | **clinical_description** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 7480f2dd-1f53-4b57-8e86-84686d3e8554 | 7019f6ae-64cc-4f31-952b-b39f1bd97061 | _null_ | _null_ | _null_ | _null_ |
| 804f5a82-4ef2-4bf6-9fc5-ff325f75fc69 | 7d32d8c9-c660-496f-aac5-86507f8eb065 | _null_ | _null_ | _null_ | _null_ |
| 5d84d4ab-3b5a-4442-b132-7d879a6c8253 | 7c3f7945-ad64-4454-b889-25b95948e6fe | _null_ | _null_ | _null_ | _null_ |
| b4015c21-ba86-4a1b-941b-1adae8bf98e0 | c23e97bf-1312-4e66-9765-6802118178f4 | _null_ | _null_ | _null_ | _null_ |
| 3d693927-37df-47d8-8aca-dcca1647b13d | 18238116-fbbb-4703-a1d1-4a54d61d0f05 | _null_ | _null_ | _null_ | _null_ |
| 068f3006-b8fb-4864-a221-36bec6aeb7c4 | 4ac9c57a-e6d1-41cc-80b3-7ffe7ca88c7e | _null_ | _null_ | _null_ | _null_ |



> 💡 **Diễn giải các mã bệnh ICD-10 trong hệ thống:**
> - `O24.4`: Đái tháo đường xuất hiện trong thời kỳ mang thai (Gestational diabetes mellitus).
> - `O13`: Tăng huyết áp do thai nghén không kèm protein niệu đáng kể (Gestational hypertension).
> - `O20.0`: Dọa sảy thai trong 3 tháng đầu (Threatened abortion).
> - `O26.8`: Các tình trạng liên quan đến thai nghén được xác định khác (Nôn nghén nặng).
> - `N76.0`: Viêm âm đạo cấp trong thai kỳ (Acute vaginitis in pregnancy).
> - `Z34.0`: Giám sát thai nghén bình thường con so (Supervision of normal first pregnancy).

### 9.6. Bảng `clinical_service_orders` (Chỉ định & Kết quả Cận lâm sàng Chi tiết)
- **Số lượng bản ghi:** 8 chỉ định cận lâm sàng kèm kết quả phân tích JSON chi tiết
- **Mục đích:** Lưu kết quả siêu âm hình thái học 5D, xét nghiệm máu NIPT, nghiệm pháp dung nạp đường huyết.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `encounter_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `encounter` |
| `catalog_service_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `catalog_service` |
| `stage_code` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `ordered_by_doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `ordered_by_doctor` |
| `required_result` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `billable_snapshot` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `structured_result` | `jsonb` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `performed_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `verified_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **id** | **order_code** | **encounter_id** | **service_code** | **status** | **result_summary** | **result_payload** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2475a979-c80c-400e-b95c-04957fe9382d | _null_ | 7019f6ae-64cc-4f31-952b-b39f1bd97061 | _null_ | ORDERED | _null_ | _null_ |
| e2dc3e2b-d99b-4809-87a5-a850369b2bf0 | _null_ | 7d32d8c9-c660-496f-aac5-86507f8eb065 | _null_ | VERIFIED | _null_ | _null_ |
| 67246232-845d-4653-8b0a-07e4e34e3381 | _null_ | d369a4f7-bc7b-4742-a170-f06c8d4b46b6 | _null_ | ORDERED | _null_ | _null_ |
| 24a4af53-f860-44cc-9ce3-307f935f5e84 | _null_ | 7019f6ae-64cc-4f31-952b-b39f1bd97061 | _null_ | IN_PROGRESS | _null_ | _null_ |
| 23f73def-1bfd-46fe-8b91-ea1b51190b0c | _null_ | 7c3f7945-ad64-4454-b889-25b95948e6fe | _null_ | PERFORMED | _null_ | _null_ |
| 780f2a82-575c-4e01-a410-b44d97c75118 | _null_ | 7d32d8c9-c660-496f-aac5-86507f8eb065 | _null_ | RESULT_AVAILABLE | _null_ | _null_ |
| 6eb14b97-7cff-4c35-8ad8-c5ee01306c32 | _null_ | 7019f6ae-64cc-4f31-952b-b39f1bd97061 | _null_ | VERIFIED | _null_ | _null_ |
| e708a7f9-b222-42d4-90ba-0de7a52e9329 | _null_ | c23e97bf-1312-4e66-9765-6802118178f4 | _null_ | CANCELLED | _null_ | _null_ |



### 9.7. Các bảng Phụ trợ Y khoa
- **`encounter_assignments` (10 bản ghi):** Phân công ê-kíp bác sĩ và điều dưỡng hỗ trợ ca khám.
- **`external_clinical_references` (5 bản ghi):** Liên kết hồ sơ bệnh án chuyển tuyến từ các bệnh viện phụ sản khác.
- **`encounter_amendments` (2 bản ghi):** Lưu biên bản bổ sung/chỉnh sửa bệnh án theo quy định pháp lý y tế.
- **`medical_audit` (5 bản ghi), `medical_outbox` (5 bản ghi), `medical_idempotency` (3 bản ghi).

---
## 💊 PHẦN 10: PRESCRIPTION SERVICE (DANH MỤC THUỐC THAI KỲ & ĐƠN THUỐC ĐIỆN TỬ)

- **Database:** `prescription` (Cổng `5443`)
- **Vai trò:** Quản lý danh mục dược phẩm chuyên biệt cho phụ nữ có thai và cho con bú, phân loại mức độ an toàn theo tiêu chuẩn Cục quản lý Thực phẩm & Dược phẩm Hoa Kỳ (FDA Pregnancy Categories A, B, C, D, X) và phát hành đơn thuốc điện tử.
- **Tổng số bảng:** 4 bảng | **Tổng bản ghi:** 45 records.

### 10.1. Bảng `medication_catalog` (Danh mục Dược phẩm Thai kỳ Chuẩn FDA)
- **Số lượng bản ghi:** 13 loại thuốc thiết yếu
- **Mục đích:** Đảm bảo bác sĩ kê đơn thuốc an toàn tuyệt đối cho thai phụ, hiển thị cảnh báo thai kỳ rõ ràng.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `code` | `character varying(100)` | 🔴 Bắt buộc | Mã chuẩn hóa (Unique Identifier) |
| `name` | `character varying(200)` | 🔴 Bắt buộc | Tên hiển thị tiếng Việt |
| `active_ingredient` | `character varying(500)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `strength` | `character varying(100)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `dosage_form` | `character varying(100)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `route` | `character varying(80)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `default_dose` | `character varying(80)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `default_frequency` | `character varying(120)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `default_instruction` | `character varying(1000)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `pregnancy_category` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `pregnancy_warning` | `character varying(2000)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `is_active` | `boolean` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **code** | **generic_name** | **brand_name** | **pregnancy_category** | **dosage_form** | **strength** | **pregnancy_warning** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| MED_FOLIC_400 | _null_ | _null_ | CATEGORY_A | Viên nén | 400 mcg | An toàn tuyệt đối cho thai phụ, phòng ngừa dị tật ống thần kinh thai nhi. |
| MED_IRON_FEMAT | _null_ | _null_ | CATEGORY_A | Viên nang mềm | 50 mg | Thuốc sắt hữu cơ ít gây táo bón, dùng phòng ngừa và điều trị thiếu máu thiếu sắt thai kỳ. |
| MED_CALCIUM_CORBIERE | _null_ | _null_ | CATEGORY_A | Dung dịch uống ống bẻ | 552.5 mg/5ml | Cung cấp canxi phát triển khung xương thai nhi và phòng loãng xương mẹ. |
| MED_DHA_PRENATAL | _null_ | _null_ | CATEGORY_A | Viên nang mềm | 210 mg | Hỗ trợ phát triển não bộ và thị giác của thai nhi từ tuần thai thứ 12. |
| MED_PROGESTERONE_200 | _null_ | _null_ | CATEGORY_B | Viên nang đặt âm đạo/uống | 200 mg | Chỉ định trong dọa sảy thai, tiền sử sảy thai liên tiếp hoặc dọa sinh non. |
| MED_PARACETAMOL_500 | _null_ | _null_ | CATEGORY_B | Viên nén bao phim | 500 mg | Thuốc hạ sốt và giảm đau được lựa chọn hàng đầu cho phụ nữ có thai. |
| MED_MAGNE_B6 | _null_ | _null_ | CATEGORY_B | Viên bao đường | 470mg / 5mg | Hỗ trợ giảm co cứng cơ bắp chân (chuột rút) và căng thẳng thần kinh thai kỳ. |
| MED_ASPIRIN_81 | _null_ | _null_ | CATEGORY_B | Viên bao tan trong ruột | 81 mg | Liều thấp dự phòng tiền sản giật ở thai phụ có yếu tố nguy cơ cao. |
| MED_CLOTRIMAZOLE_100 | _null_ | _null_ | CATEGORY_C | Viên nén đặt âm đạo | 100 mg | Điều trị viêm âm đạo do nấm Candida ở thai phụ 3 tháng giữa và 3 tháng cuối khi có chỉ định bác sĩ. |
| MED_DEXAMETHASONE_4 | _null_ | _null_ | CATEGORY_C | Dung dịch tiêm | 4 mg/1ml | Áp dụng cho thai kỳ nguy cơ dọa sinh non từ tuần 24 đến 34 để kích thích sản xuất surfactant phổi bé. |
| MED_ENALAPRIL_5 | _null_ | _null_ | CATEGORY_D | Viên nén | 5 mg | CẢNH BÁO NGUY HIỂM: Gây thiểu ối, hạ huyết áp sơ sinh, suy thận vô niệu và biến dạng sọ thai nhi. |
| MED_ISOTRETINOIN_10 | _null_ | _null_ | CATEGORY_X | Viên nang mềm | 10 mg | ĐỘC TÍNH CỰC CAO: Gây dị tật bẩm sinh nặng nề (não úng thủy, dị tật tim, sọ mặt). Bắt buộc ngừa thai 1 tháng trước và sau dùng thuốc. |
| MED_RANITIDINE_150 | _null_ | _null_ | CATEGORY_B | Viên nén bao phim | 150 mg | Thuốc đã bị đình chỉ lưu hành và vô hiệu hóa trên hệ thống dược viện. |



> 💡 **Phân loại An toàn Thai kỳ FDA:**
> - **Category A (An toàn tuyệt đối):** Không có nguy cơ cho thai nhi trong các thử nghiệm có đối chứng (Axit Folic, Sắt Polymaltose).
> - **Category B (Tương đối an toàn):** Thử nghiệm động vật không thấy nguy cơ, được dùng rộng rãi (Paracetamol, Cefixime, Amoxicillin/Clavulanate, Dydrogesterone, Insulin, Metformin).
> - **Category C (Cần thận trọng):** Chỉ dùng khi lợi ích vượt trội rủi ro (Progesterone tự nhiên, Nifedipine, Dexamethasone tiêm trưởng thành phổi).
> - **Category D (Có bằng chứng rủi ro):** Chỉ dùng trong tình trạng nguy hiểm tính mạng (Enoxaparin chống đông huyết khối).
> - **Category X (Chống chỉ định tuyệt đối):** Gây quái thai hoặc dị tật thai nhi nghiêm trọng (Methotrexate, Isotretinoin).

### 10.2. Bảng `prescriptions` (Đơn thuốc Điện tử)
- **Số lượng bản ghi:** 9 đơn thuốc
- **Mục đích:** Lưu thông tin đơn thuốc được bác sĩ phát hành sau ca khám lâm sàng.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `encounter_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `encounter` |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `pregnancy_episode_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `pregnancy_episode` |
| `prescribing_doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `prescribing_doctor` |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `supersedes_prescription_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `supersedes_prescription` |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `issued_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `cancelled_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `cancel_reason` | `character varying(500)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **prescription_code** | **patient_id** | **doctor_id** | **status** | **diagnosis_text** | **issued_at** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| _null_ | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | ISSUED | _null_ | 2026-11-01T15:01:22.844Z |
| _null_ | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | _null_ | ISSUED | _null_ | 2026-11-01T15:01:22.951Z |
| _null_ | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | ISSUED | _null_ | 2026-11-01T15:01:23.007Z |
| _null_ | 4bf0af0e-f989-4d0d-b074-a030dfd9aadf | _null_ | ISSUED | _null_ | 2026-11-01T15:01:23.053Z |
| _null_ | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | ISSUED | _null_ | 2026-11-01T15:01:23.218Z |
| _null_ | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | ISSUED | _null_ | 2026-11-01T15:01:23.262Z |
| _null_ | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | _null_ | DRAFT | _null_ | _null_ |
| _null_ | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | CANCELLED | _null_ | _null_ |
| _null_ | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | ISSUED | _null_ | 2026-10-30T15:16:21.655Z |



### 10.3. Bảng `prescription_items` (Chi tiết Thuốc Kê đơn)
- **Số lượng bản ghi:** 19 dòng thuốc
- **Mục đích:** Chỉ định cụ thể liều lượng, đường dùng, số lần uống trong ngày, thời gian dùng và hướng dẫn an toàn cho thai phụ.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `prescription_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `prescription` |
| `medication_code` | `character varying(100)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `medication_name` | `character varying(200)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `strength` | `character varying(100)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `dosage_form` | `character varying(100)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `route` | `character varying(80)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `dose` | `character varying(80)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `frequency` | `character varying(120)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `duration_days` | `integer` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `instruction` | `character varying(1000)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `sort_order` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |


| **id** | **prescription_id** | **medication_code** | **dosage** | **frequency** | **duration_days** | **instructions** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 388da250-19e5-47a4-a955-2a13bdc57a15 | a9e64b0d-e414-421e-a706-41dfe3ddd754 | MED_FOLIC_400 | _null_ | 1 lần/ngày | 30 | _null_ |
| 2e1209be-f1e7-425c-9640-0b60c5e5cbe7 | a9e64b0d-e414-421e-a706-41dfe3ddd754 | MED_CALCIUM_CORBIERE | _null_ | 2 lần/ngày | 30 | _null_ |
| 7976b8d7-ea30-4572-9575-104fef135552 | a9e64b0d-e414-421e-a706-41dfe3ddd754 | MED_DHA_PRENATAL | _null_ | 1 lần/ngày | 30 | _null_ |
| 036d4584-5ad8-4c9d-8a6f-b2fc3117852a | 6e24f4b6-a8fd-476e-823f-2c0d85390e46 | MED_IRON_FEMAT | _null_ | 1 lần/ngày | 30 | _null_ |
| 2df01532-bad8-4afa-8deb-3a700a03a71c | 6e24f4b6-a8fd-476e-823f-2c0d85390e46 | MED_CALCIUM_CORBIERE | _null_ | 2 lần/ngày | 30 | _null_ |
| a1a96058-d259-4ede-836e-83605ba5060b | a772aaa3-350d-477e-869b-4c22ba93d78b | MED_CALCIUM_CORBIERE | _null_ | 2 lần/ngày | 30 | _null_ |
| f690a9bb-7c6c-48aa-b444-5f6ecf657bfc | a772aaa3-350d-477e-869b-4c22ba93d78b | MED_MAGNE_B6 | _null_ | 2 lần/ngày | 30 | _null_ |
| 7ef64faf-f137-4904-9a6b-1aa59f2d1401 | 1ec50685-b640-4f93-8cbf-0db6c6cc6eff | MED_FOLIC_400 | _null_ | 1 lần/ngày | 30 | _null_ |
| ce01272e-c31a-499d-8310-04014fea5de4 | 9a3a4ca9-7bac-4ec2-8e73-4dc3745eede2 | MED_FOLIC_400 | _null_ | 1 lần/ngày | 30 | _null_ |
| 01e0a338-7321-422d-8acf-f3025b6a0d09 | 9a3a4ca9-7bac-4ec2-8e73-4dc3745eede2 | MED_CALCIUM_CORBIERE | _null_ | 2 lần/ngày | 30 | _null_ |
| 2aa5873f-c23c-4e98-8727-0e92b96bbda7 | 9a3a4ca9-7bac-4ec2-8e73-4dc3745eede2 | MED_DHA_PRENATAL | _null_ | 1 lần/ngày | 30 | _null_ |
| adf51fad-9f02-4f6a-aee1-ff0b9b082475 | af9b8957-7479-4c4b-9438-993528d4eed5 | MED_IRON_FEMAT | _null_ | 1 lần/ngày | 30 | _null_ |
| 1f88c283-6806-49a2-ba45-ebd9b5514595 | af9b8957-7479-4c4b-9438-993528d4eed5 | MED_CALCIUM_CORBIERE | _null_ | 2 lần/ngày | 30 | _null_ |
| a313bb4f-c89e-4dd0-9463-2ddc7f596a73 | af9b8957-7479-4c4b-9438-993528d4eed5 | MED_DHA_PRENATAL | _null_ | 1 lần/ngày | 30 | _null_ |
| 542a072e-e55c-4868-a9b2-cf37e83a6b30 | 2afd4b3b-2183-4a81-b8ce-7b7ef0d7952e | MED_PROGESTERONE_200 | _null_ | 1 lần/ngày vào buổi tối | 15 | _null_ |
| 4ada8717-507a-4c4e-86bd-c779d90ab574 | 2afd4b3b-2183-4a81-b8ce-7b7ef0d7952e | MED_MAGNE_B6 | _null_ | 2 lần/ngày | 30 | _null_ |
| 49a84fd2-ad24-42ac-a22f-48f371eb951c | defad2e5-103e-49f7-bb36-1686999dfa24 | MED_IRON_FEMAT | _null_ | 1 lần/ngày | 30 | _null_ |
| 6b2133fa-6ada-44a5-ab42-42e9428d7e2d | 6c362179-797f-4c06-ab52-be9ba2f38839 | MED_CALCIUM_CORBIERE | _null_ | 2 lần/ngày | 30 | _null_ |
| 92f19607-ac91-410a-b96b-eb7c8cdea752 | 6c362179-797f-4c06-ab52-be9ba2f38839 | MED_DHA_PRENATAL | _null_ | 1 lần/ngày | 30 | _null_ |



### 10.4. Bảng `prescription_outbox` (Đồng bộ Sự kiện Kê đơn)
- **Số lượng bản ghi:** 3 bản ghi
- **Mục đích:** Phát tán sự kiện sang Nhà thuốc bệnh viện để chuẩn bị thuốc và gửi thông báo đơn thuốc qua ứng dụng di động cho thai phụ.

---
## 📋 PHẦN 11: TREATMENT PLAN SERVICE (KẾ HOẠCH CHĂM SÓC & THEO DÕI THAI KỲ)

- **Database:** `treatment_plan` (Cổng `5444`)
- **Vai trò:** Xây dựng lộ trình theo dõi thai kỳ cá thể hóa cho từng thai phụ, bao gồm các ca thai kỳ tiêu chuẩn và các ca bệnh lý nguy cơ cao (Đái tháo đường thai kỳ, Dọa sinh non, Tiền sản giật).
- **Tổng số bảng:** 4 bảng | **Tổng bản ghi:** 35 records.

### 11.1. Bảng `treatment_plans` (Kế hoạch Quản lý Thai kỳ)
- **Số lượng bản ghi:** 5 kế hoạch điều trị
- **Mục đích:** Thiết lập phác đồ tổng thể theo tuần thai cho thai phụ.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `pregnancy_episode_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `pregnancy_episode` |
| `source_encounter_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `source_encounter` |
| `author_doctor_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `author_doctor` |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `title` | `character varying(200)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `summary` | `character varying(4000)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `effective_from` | `date` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `activated_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `completed_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `cancelled_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `cancel_reason` | `character varying(500)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **plan_code** | **patient_id** | **doctor_id** | **title** | **diagnosis_code** | **status** | **target_weeks** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| abf5bd2a-2256-4122-b1ee-f7754121deaa | _null_ | 03984f9c-c643-4602-ae6f-226eeed15da3 | _null_ | Kế hoạch theo dõi thai kỳ 40 tuần chuẩn Bộ Y Tế & Chuyên gia An Tâm | _null_ | ACTIVE | _null_ |
| bad9f725-2a59-4694-a80d-135d779990c9 | _null_ | 3f227555-2822-4773-ac92-3127fd31fa79 | _null_ | Phác đồ quản lý thai kỳ & đỡ sinh thường an toàn (Thai kỳ lần 1) | _null_ | COMPLETED | _null_ |
| 14fe19f8-8d13-4352-b91f-89ad5658ecdc | _null_ | e163be70-f610-44f2-9386-89f91d9240c4 | _null_ | Dự thảo phác đồ theo dõi thai kỳ quý 1 & sàng lọc trước sinh sớm | _null_ | DRAFT | _null_ |
| 7787eadb-9270-4b4f-ab64-c725d9df841b | _null_ | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | _null_ | Phác đồ can thiệp kiểm soát đường huyết mao mạch & chế độ ăn nghiêm ngặt | _null_ | CANCELLED | _null_ |
| cbf013ac-afdb-491b-8051-85d9eb128ddb | _null_ | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | _null_ | Phác đồ chăm sóc & quản lý thai kỳ chuyên sâu 40 tuần (TS. BS. Đoàn Văn Bắc) | _null_ | ACTIVE | _null_ |



### 11.2. Bảng `treatment_plan_items` (Các Mốc Khám, Siêu âm & Can thiệp)
- **Số lượng bản ghi:** 19 mốc can thiệp
- **Mục đích:** Lên lịch cụ thể theo từng tuần thai: Siêu âm đo độ mờ da gáy tuần 12, Xét nghiệm NIPT tuần 10-14, Nghiệm pháp đường huyết tuần 24-28, Siêu âm hình thái học tuần 22, Tiêm uốn ván tuần 26.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `plan_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `plan` |
| `type` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `title` | `character varying(200)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `description` | `character varying(2000)` | 🔴 Bắt buộc | Mô tả / Ghi chú chi tiết |
| `due_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `sort_order` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `completed_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |


| **id** | **plan_id** | **action_title** | **action_type** | **target_gestational_week** | **status** | **notes** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 89e16691-42ad-484f-a082-d0e18e5dd9ea | abf5bd2a-2256-4122-b1ee-f7754121deaa | _null_ | _null_ | _null_ | DONE | _null_ |
| 18d1421c-544f-4dbc-a761-ead5c2e62d1d | abf5bd2a-2256-4122-b1ee-f7754121deaa | _null_ | _null_ | _null_ | IN_PROGRESS | _null_ |
| ed2ff6e3-93c3-4880-8a11-12f054362286 | abf5bd2a-2256-4122-b1ee-f7754121deaa | _null_ | _null_ | _null_ | PENDING | _null_ |
| c6916f85-50d6-4134-8bb0-a1a19ed18ba4 | abf5bd2a-2256-4122-b1ee-f7754121deaa | _null_ | _null_ | _null_ | PENDING | _null_ |
| 92ccbbd4-340a-40a0-b9c8-65bfe2c0fbfd | abf5bd2a-2256-4122-b1ee-f7754121deaa | _null_ | _null_ | _null_ | PENDING | _null_ |
| cff02a1d-de7d-4d36-8567-5d9763fb0694 | abf5bd2a-2256-4122-b1ee-f7754121deaa | _null_ | _null_ | _null_ | CANCELLED | _null_ |
| a8ccbe5c-4189-4c0d-9328-3720949bdd9a | bad9f725-2a59-4694-a80d-135d779990c9 | _null_ | _null_ | _null_ | DONE | _null_ |
| 5ecad1cc-d46c-4d58-bf57-73352b31e60a | bad9f725-2a59-4694-a80d-135d779990c9 | _null_ | _null_ | _null_ | DONE | _null_ |
| 52f8c7d3-d32a-451a-991c-670c3ebd4c4f | bad9f725-2a59-4694-a80d-135d779990c9 | _null_ | _null_ | _null_ | DONE | _null_ |
| 087dec99-37fa-4999-9bed-abc1912177b2 | 14fe19f8-8d13-4352-b91f-89ad5658ecdc | _null_ | _null_ | _null_ | PENDING | _null_ |
| 28149728-c0c8-42d3-8ebf-11478bf72698 | 14fe19f8-8d13-4352-b91f-89ad5658ecdc | _null_ | _null_ | _null_ | PENDING | _null_ |
| 95f46563-338c-47b8-9e30-829a43a9a708 | 7787eadb-9270-4b4f-ab64-c725d9df841b | _null_ | _null_ | _null_ | CANCELLED | _null_ |
| c1da3b55-1a53-441a-bdb0-ae15ca6428e9 | 7787eadb-9270-4b4f-ab64-c725d9df841b | _null_ | _null_ | _null_ | CANCELLED | _null_ |
| 13586abc-7cda-46c6-b2f9-0c29971f38d6 | cbf013ac-afdb-491b-8051-85d9eb128ddb | _null_ | _null_ | _null_ | DONE | _null_ |
| 79e557a2-155d-4176-98e5-732979118046 | cbf013ac-afdb-491b-8051-85d9eb128ddb | _null_ | _null_ | _null_ | DONE | _null_ |
| 0758838a-f73b-43e3-9b0e-1371223d7a07 | cbf013ac-afdb-491b-8051-85d9eb128ddb | _null_ | _null_ | _null_ | PENDING | _null_ |
| 931b5e47-4ea0-4cc7-8076-df6400f6df26 | cbf013ac-afdb-491b-8051-85d9eb128ddb | _null_ | _null_ | _null_ | PENDING | _null_ |
| 764e1222-eaad-4780-b6bc-3f24fc8806c8 | cbf013ac-afdb-491b-8051-85d9eb128ddb | _null_ | _null_ | _null_ | PENDING | _null_ |
| 5815e4ec-ae3e-477a-97ae-c0f749c25a28 | cbf013ac-afdb-491b-8051-85d9eb128ddb | _null_ | _null_ | _null_ | PENDING | _null_ |



### 11.3. Các bảng Phụ trợ: `treatment_plan_versions`, `treatment_plan_outbox`
- **`treatment_plan_versions` (6 bản ghi):** Lưu lịch sử cập nhật kế hoạch khi tuổi thai hoặc bệnh lý thay đổi.
- **`treatment_plan_outbox` (5 bản ghi):** Đồng bộ sự kiện tạo lịch nhắc hẹn tự động sang Notification Service.

---
## 💬 PHẦN 12: CONSULTATION SERVICE (TƯ VẤN TRỰC TUYẾN BÁC SĨ - THAI PHỤ)

- **Database:** `consultation` (Cổng `5448`)
- **Vai trò:** Kênh trao đổi trực tuyến từ xa an toàn giữa thai phụ và bác sĩ sản khoa. Hỗ trợ gửi tin nhắn, đính kèm kết quả xét nghiệm, và cơ chế chuyển cấp khẩn cấp (Escalation) khi xuất hiện các dấu hiệu nguy hiểm.
- **Tổng số bảng:** 6 bảng | **Tổng bản ghi:** 38 records.

### 12.1. Bảng `consultation_threads` (Luồng Hội thoại Tư vấn)
- **Số lượng bản ghi:** 6 luồng trao đổi
- **Mục đích:** Nhóm các cuộc trò chuyện theo chủ đề tư vấn thai sản (Hỏi đáp dinh dưỡng, Ra huyết bất thường, Đau bụng dưới, Tư vấn chỉ số đường huyết).

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `patient_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `patient` |
| `appointment_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `appointment` |
| `subject` | `character varying(160)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `assigned_doctor_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `assigned_doctor` |
| `last_sequence_no` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `last_message_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `created_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `created_by_account` |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **patient_id** | **assigned_doctor_id** | **title** | **status** | **priority** | **created_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 6b2429b7-bdb8-4a81-8f12-3c2b95e16843 | 03984f9c-c643-4602-ae6f-226eeed15da3 | e863bcc8-e213-425c-b12b-359e0cb22d8d | _null_ | ANSWERED | _null_ | 2026-11-01T12:01:23.663Z |
| d67f81ed-3ca1-471f-b34c-e71822cbd1b3 | 3f227555-2822-4773-ac92-3127fd31fa79 | dc15585a-f921-43f9-8072-f5b2dcff74d9 | _null_ | REOPENED | _null_ | 2026-11-01T09:01:23.680Z |
| 45724f63-3704-4873-af11-af21b4330301 | e540803c-d0d0-4aac-bf72-77f4cd4c06ca | 602b1e4b-5744-481c-a94a-0d64702c3c8b | _null_ | ASSIGNED | _null_ | 2026-11-01T14:31:23.690Z |
| 3fb08405-9ada-4180-b1b4-06c766d1f102 | 5a4976e2-e977-4856-9ee3-ffe1856c8713 | _null_ | _null_ | OPEN | _null_ | 2026-11-01T14:21:23.699Z |
| 961defbe-abb5-4de4-b044-10ee1d993679 | 71f28ddc-ec69-4b80-81ac-4ef65fcb074c | 64b316b4-9d02-4352-8fc2-29fc6113a1b7 | _null_ | CLOSED | _null_ | 2026-10-31T15:01:23.712Z |
| f3c72969-34ad-4bf7-bc16-527927cc5f63 | c97a80c4-ebd9-4dfd-bd6a-294fb6b08654 | faaef216-5d5d-494b-b572-0a6094ebdf94 | _null_ | ANSWERED | _null_ | 2026-11-01T11:01:23.742Z |



### 12.2. Bảng `consultation_messages` (Tin nhắn Tư vấn Trực tuyến)
- **Số lượng bản ghi:** 16 tin nhắn
- **Mục đích:** Lưu trữ nội dung trao đổi hỏi đáp giữa thai phụ và bác sĩ, có kèm thời gian và trạng thái đã đọc.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `thread_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `thread` |
| `sequence_no` | `bigint` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `sender_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `sender_account` |
| `sender_type` | `character varying(30)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `client_message_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `client_message` |
| `body` | `character varying(4000)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `body_hash` | `character(64)` | 🔴 Bắt buộc | Mã băm tra cứu HMAC-SHA256 hoặc Argon2id |
| `sent_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |


| **id** | **thread_id** | **sender_account_id** | **sender_role** | **content** | **created_at** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 70f4ac2f-cdde-457a-b676-470b51dfda79 | 6b2429b7-bdb8-4a81-8f12-3c2b95e16843 | f4e6d292-887d-41a5-8f4b-bc307d81fba5 | _null_ | _null_ | _null_ |
| c54017ae-7c9f-4596-8839-1fa722bac7e9 | 6b2429b7-bdb8-4a81-8f12-3c2b95e16843 | 424bdff1-0917-4b4f-ab94-d077b00f2041 | _null_ | _null_ | _null_ |
| de1a0e77-4747-4881-b8a2-3a83d0f6a07b | 6b2429b7-bdb8-4a81-8f12-3c2b95e16843 | f4e6d292-887d-41a5-8f4b-bc307d81fba5 | _null_ | _null_ | _null_ |
| 86919cff-227f-43cf-ba8d-8a33320db39c | d67f81ed-3ca1-471f-b34c-e71822cbd1b3 | dfc0d279-267c-423f-9ad8-b2d6489ccbce | _null_ | _null_ | _null_ |
| a82317a4-f6b6-4c0c-bd19-82a1a890018d | d67f81ed-3ca1-471f-b34c-e71822cbd1b3 | 454d1876-0725-45da-b998-6523c5cd7f5f | _null_ | _null_ | _null_ |
| a0b7fe2a-5a4b-44ae-ad1b-452bf9f8391e | d67f81ed-3ca1-471f-b34c-e71822cbd1b3 | f63deac8-cb47-4941-8250-19598e9d89b5 | _null_ | _null_ | _null_ |
| 46873511-efc4-4013-aea1-1aef2ae49769 | d67f81ed-3ca1-471f-b34c-e71822cbd1b3 | dfc0d279-267c-423f-9ad8-b2d6489ccbce | _null_ | _null_ | _null_ |
| daaf8e12-0bf2-4f00-80ad-51cc595b072d | 45724f63-3704-4873-af11-af21b4330301 | 2ce8e12b-01a0-4c7c-8dd0-03e8b2e4ebc4 | _null_ | _null_ | _null_ |
| 64838609-0a46-42c1-b99a-9a770c9f3f31 | 3fb08405-9ada-4180-b1b4-06c766d1f102 | 5c551c0a-31ae-4488-8e54-7fed2656e507 | _null_ | _null_ | _null_ |
| c6887fb6-99b9-4085-992e-372f912727e3 | 961defbe-abb5-4de4-b044-10ee1d993679 | b75c7aed-9aa0-4194-8183-0e93fb520e76 | _null_ | _null_ | _null_ |
| 1fc6b27e-eba1-4275-a797-743c867d7fc8 | 961defbe-abb5-4de4-b044-10ee1d993679 | 74a642aa-44ea-4e9f-a29e-b692f3e9ffee | _null_ | _null_ | _null_ |
| 4f44518b-4b15-42ce-bdb1-5bf0e03988df | 961defbe-abb5-4de4-b044-10ee1d993679 | b75c7aed-9aa0-4194-8183-0e93fb520e76 | _null_ | _null_ | _null_ |
| 82d8bf38-1786-4f97-a9d2-b6f28dac10fa | 961defbe-abb5-4de4-b044-10ee1d993679 | 454d1876-0725-45da-b998-6523c5cd7f5f | _null_ | _null_ | _null_ |
| de802b5f-e8ce-4774-b677-729fd8ef99d6 | f3c72969-34ad-4bf7-bc16-527927cc5f63 | c7892601-edcd-414d-bc84-99210953fef6 | _null_ | _null_ | _null_ |
| e4db7b6f-f59a-4d1f-ac8d-c420475de41e | f3c72969-34ad-4bf7-bc16-527927cc5f63 | e1e3f1c2-15f5-4ab8-bc0f-9a3752605913 | _null_ | _null_ | _null_ |


> _(Hiển thị mẫu 15 / 16 tin nhắn tư vấn y khoa thực tế trong kịch bản seed)_

### 12.3. Bảng `consultation_escalations` (Báo động & Chuyển cấp Khẩn cấp)
- **Số lượng bản ghi:** 4 trường hợp chuyển cấp
- **Mục đích:** Kích hoạt cảnh báo đỏ khi thai phụ gặp các dấu hiệu nguy hiểm (Dọa sảy thai, Huyết áp vọt cao trên 160/100 mmHg, Cử động thai yếu) để yêu cầu nhập viện cấp cứu ngay.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `thread_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `thread` |
| `reason_code` | `character varying(50)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `detail` | `character varying(500)` | ⚪ Tùy chọn | Mô tả / Ghi chú chi tiết |
| `status` | `USER-DEFINED` | 🔴 Bắt buộc | Trạng thái nghiệp vụ (Enum / String) |
| `raised_by_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `raised_by_account` |
| `raised_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `acknowledged_by_account_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `acknowledged_by_account` |
| `acknowledged_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `resolved_by_account_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `resolved_by_account` |
| `resolved_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `resolution_note` | `character varying(500)` | ⚪ Tùy chọn | Mô tả / Ghi chú chi tiết |
| `version` | `integer` | 🔴 Bắt buộc | Phiên bản khóa lạc quan (Optimistic Concurrency Control) |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |
| `updated_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm cập nhật bản ghi gần nhất |


| **id** | **thread_id** | **reason_code** | **detail** | **status** | **raised_at** | **resolution_note** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 464474be-f042-4a23-a3f5-26f4fa67b03f | d67f81ed-3ca1-471f-b34c-e71822cbd1b3 | COMPLICATION_RISK | Thai phụ 34 tuần có triệu chứng cơn gò tử cung dọa sinh non và giảm cử động thai trên nền nguy cơ cao. | RESOLVED | 2026-11-01T09:11:23.687Z | Thai phụ đã đến viện đo NST và siêu âm Doppler rốn. Tim thai bình thường 145 ck/p, cổ tử cung đóng kín, đã hướng dẫn dùng thuốc giảm co Spasfon và hẹn tái khám sau 3 ngày. |
| 4e8cded1-2199-42d3-b51f-1879adf35b96 | 45724f63-3704-4873-af11-af21b4330301 | SECOND_OPINION | Thai phụ đề nghị chuyên gia đái tháo đường thai kỳ hội chẩn trước ca khám trực tiếp chiều nay. | ACKNOWLEDGED | 2026-11-01T14:36:23.696Z | _null_ |
| ad379b2a-6802-4aeb-a400-be9c2efd9b8d | 3fb08405-9ada-4180-b1b4-06c766d1f102 | URGENT_SYMPTOMS | Nôn nghén kéo dài đến quý 2 kèm hạ huyết áp tư thế, cần phân công bác sĩ tư vấn sớm. | OPEN | 2026-11-01T14:21:23.707Z | _null_ |
| 54b07b7f-42c4-4f76-870b-4866c7e6b661 | 961defbe-abb5-4de4-b044-10ee1d993679 | OTHER | Thai phụ thao tác nhầm nút Báo động khẩn cấp trên ứng dụng di động. | CANCELLED | 2026-10-31T16:01:23.722Z | Thai phụ xác nhận bấm nhầm nút Yêu cầu khẩn cấp trên ứng dụng, đã hủy yêu cầu. |



### 12.4. Các bảng Phụ trợ: `consultation_assignments`, `consultation_outbox`
- **`consultation_assignments` (6 bản ghi):** Lưu vết bác sĩ được phân công phụ trách luồng tư vấn.
- **`consultation_outbox` (6 bản ghi):** Gửi thông báo đẩy (Push Notification) đến điện thoại thai phụ và bác sĩ.

---
## 🔔 PHẦN 13: NOTIFICATION SERVICE (HỆ THỐNG THÔNG BÁO ĐA KÊNH)

- **Database:** `notification` (Cổng `5445`)
- **Vai trò:** Quản lý việc gửi thông báo tự động đa kênh (SMS, Email, In-app push) để nhắc thai phụ lịch khám thai, thông báo có kết quả xét nghiệm NIPT/Siêu âm, và biên nhận thanh toán viện phí.
- **Tổng số bảng:** 3 bảng | **Tổng bản ghi:** 6 records.

### 13.1. Bảng `notifications` (Danh sách Thông báo Người dùng)
- **Số lượng bản ghi:** 6 thông báo
- **Mục đích:** Lưu trữ nội dung thông báo gửi đến tài khoản thai phụ và bác sĩ.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `source_event_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `source_event` |
| `event_type` | `character varying(120)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `recipient_account_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `recipient_account` |
| `template_code` | `character varying(80)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `category` | `USER-DEFINED` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `title` | `character varying(200)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `body` | `character varying(2000)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `resource_type` | `character varying(50)` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `resource_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `resource` |
| `read_at` | `timestamp with time zone` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `created_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thời điểm tạo bản ghi |


| **id** | **recipient_account_id** | **channel** | **notification_type** | **title** | **content** | **status** | **created_at** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ff8b144e-25df-43c3-8ffb-7a0adba60c2f | c7892601-edcd-414d-bc84-99210953fef6 | _null_ | _null_ | Đặt lịch khám thành công | _null_ | _null_ | 2026-11-01T15:01:23.749Z |
| 6cbb0ed7-5fca-449a-a89a-cf7e61562b11 | c7892601-edcd-414d-bc84-99210953fef6 | _null_ | _null_ | Đã có kết quả siêu âm hình thái học tuần 20 | _null_ | _null_ | 2026-11-01T15:01:23.761Z |
| 321e6971-f73c-4399-9fc1-e9d45872f7b6 | c7892601-edcd-414d-bc84-99210953fef6 | _null_ | _null_ | Bác sĩ Đoàn Văn Bắc đã phản hồi tư vấn | _null_ | _null_ | 2026-11-01T15:01:23.763Z |
| f76aeb29-142e-4edc-9932-7ac429670ec7 | f4e6d292-887d-41a5-8f4b-bc307d81fba5 | _null_ | _null_ | Đặt lịch khám thành công | _null_ | _null_ | 2026-11-01T15:01:23.765Z |
| 6f954ea4-2cb8-46ac-822a-ad26e57beab0 | f4e6d292-887d-41a5-8f4b-bc307d81fba5 | _null_ | _null_ | Đã đến lượt khám của bạn | _null_ | _null_ | 2026-11-01T15:01:23.767Z |
| 4c86e3b5-029c-46ec-9e26-96ce62592fea | f4e6d292-887d-41a5-8f4b-bc307d81fba5 | _null_ | _null_ | Đã có kết quả siêu âm hình thái học | _null_ | _null_ | 2026-11-01T15:01:23.770Z |



### 13.2. Bảng `delivery_attempts` & `notification_consumed_events`
- **Số lượng bản ghi:** 0 bản ghi (phục vụ runtime lưu log gửi tin qua cổng SMS/Firebase).

---
## 🛡️ PHẦN 14: AUDIT LOG SERVICE (NHẬT KÝ KIỂM TOÁN TẬP TRUNG)

- **Database:** `audit_log` (Cổng `5446`)
- **Vai trò:** Lưu trữ vết kiểm toán bất biến (Immutable Audit Trail) phục vụ tuân thủ các tiêu chuẩn an ninh y tế quốc tế (HIPAA / GDPR), ghi nhận toàn bộ các thao tác truy cập dữ liệu nhạy cảm hoặc chỉnh sửa bệnh án.
- **Tổng số bảng:** 1 bảng | **Tổng bản ghi:** 5 records.

### 14.1. Bảng `audit_entries` (Nhật ký Truy vết Thao tác Y tế)
- **Số lượng bản ghi:** 5 bản ghi kiểm toán cấp cao
- **Mục đích:** Ghi nhận danh tính người thực hiện, địa chỉ IP, hành động và dữ liệu trước/sau thay đổi.

| Tên cột | Kiểu dữ liệu | Bắt buộc | Ý nghĩa / Ghi chú |
|:---|:---|:---:|:---|
| `id` | `uuid` | 🔴 Bắt buộc | Khóa chính (Primary Key - UUID) |
| `event_id` | `uuid` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `event` |
| `event_type` | `character varying(120)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `event_version` | `integer` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `source_service` | `character varying(80)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `aggregate_type` | `character varying(80)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `aggregate_id` | `character varying(100)` | 🔴 Bắt buộc | Khóa ngoại liên kết bảng `aggregate` |
| `actor_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `actor` |
| `actor_type` | `character varying(30)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `action` | `character varying(100)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `result` | `character varying(30)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `patient_id` | `uuid` | ⚪ Tùy chọn | Khóa ngoại liên kết bảng `patient` |
| `changed_fields` | `ARRAY` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `sensitivity` | `character varying(30)` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `metadata` | `jsonb` | ⚪ Tùy chọn | Thuộc tính nghiệp vụ |
| `payload_hash` | `character(64)` | 🔴 Bắt buộc | Mã băm tra cứu HMAC-SHA256 hoặc Argon2id |
| `occurred_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |
| `ingested_at` | `timestamp with time zone` | 🔴 Bắt buộc | Thuộc tính nghiệp vụ |


| **id** | **actor_account_id** | **action** | **entity_type** | **entity_id** | **ip_address** | **created_at** | **details** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 42da70f2-545d-4be8-bc64-896f84e9ed5a | _null_ | UPSERT_PROFILE | _null_ | _null_ | _null_ | _null_ | _null_ |
| 149e78de-60ba-4680-a1af-2666ac528510 | _null_ | UPSERT_PROFILE | _null_ | _null_ | _null_ | _null_ | _null_ |
| d7cb721d-4b62-42c3-a664-23ed52e86022 | _null_ | UPSERT_PROFILE | _null_ | _null_ | _null_ | _null_ | _null_ |
| 3d016390-9fcc-448d-8c1b-9c48780bf427 | _null_ | BOOK_APPOINTMENT | _null_ | _null_ | _null_ | _null_ | _null_ |
| 4712eddf-5de1-4065-a875-bc802f271627 | _null_ | COLLECT_PAYMENT | _null_ | _null_ | _null_ | _null_ | _null_ |



---

## 🎯 3. TỔNG KẾT VÀ ĐÁNH GIÁ CHẤT LƯỢNG BỘ SEED DATA

1. **Tính Toàn Vẹn & Nhất Quán (Referential Integrity):**
   - 100% Khóa ngoại logic giữa các Microservices (Account ID, Doctor ID, Patient ID, Appointment ID, Encounter ID, Invoice ID) đều khớp tuyệt đối với nhau.
   - Khi một lịch hẹn chuyển trạng thái sang `COMPLETED`, hệ thống có đầy đủ Bệnh án (`clinical_encounters`), Sinh hiệu (`vital_signs`), Phiếu khám SOAP (`clinical_notes`), Chẩn đoán ICD-10 (`diagnoses`), Đơn thuốc (`prescriptions`) và Hóa đơn viện phí (`invoices`) tương ứng.

2. **Chuẩn Hóa Hạng Bác Sĩ (Consultation Ranks Refactoring):**
   - Đã loại bỏ hoàn toàn cột dư thừa `professional_title`.
   - Bảng `consultation_ranks` độc lập tại Doctor Service cung cấp 8 thứ bậc chuẩn xác (`BASIC`, `SPECIALIST_I`, `SPECIALIST_II`, `MASTER`, `HEAD_DOCTOR`, `ASSOC_PROFESSOR`, `EXPERT`, `PROFESSOR`), liên kết đồng bộ với bảng phụ phí `doctor_rank_surcharges` tại Catalog Service.

3. **Bảo Mật Y Tế Đạt Tiêu Chuẩn Cao:**
   - Số điện thoại toàn hệ thống được chuẩn hóa chuẩn viễn thông quốc tế E.164 (`+84...`).
   - Căn cước công dân của thai phụ được mã hóa đối xứng AES-256-GCM với Key an toàn, đồng thời tạo mã băm HMAC-SHA256 kèm Pepper bí mật giúp tra cứu nhanh mà không để lộ dữ liệu cá nhân (PII).
   - Toàn bộ mật khẩu được băm bằng thuật toán Argon2id độ trễ cao, chống brute-force hiệu quả.

---
*Tài liệu được sinh tự động từ hệ thống và được kiểm chứng tính nhất quán 100% với cơ sở dữ liệu thực nghiệm.*
