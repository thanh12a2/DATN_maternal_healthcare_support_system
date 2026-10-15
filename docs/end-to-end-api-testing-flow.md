# Hướng dẫn Kiểm thử API End-to-End Toàn Hệ Thống

> **Môi trường thử nghiệm:**
> - Gateway (Kong): `http://localhost:8080`
> - Direct Service Ports:
>   - `auth-service`: `http://localhost:5003`
>   - `patient-service`: `http://localhost:5004`
>   - `doctor-service`: `http://localhost:5005`
>   - `receptionist-service`: `http://localhost:5006`
>   - `service-catalog-service`: `http://localhost:5007`
>   - `appointment-service`: `http://localhost:5008`
>   - `billing-service`: `http://localhost:5009`
>   - `medical-record-service`: `http://localhost:8080/api/medical-records`
>   - `queue-service`: `http://localhost:8080/api/queue`
>   - `consultation-service`: `http://localhost:8080/api/consultations`

---

## 1. Bảng Biến Môi Trường (Data Pipeline)

Để đảm bảo **không bao giờ bị thiếu dữ liệu**, các API được kết nối tuần tự theo chuỗi biến sau:

| Tên biến | Được sinh ra từ bước | Dùng làm đầu vào cho bước |
|---|---|---|
| `{{ADMIN_TOKEN}}` | Bước 1 (Login Admin) | Cài đặt danh mục, giá, bác sĩ, lịch làm việc |
| `{{PATIENT_TOKEN}}` | Bước 1 (Login Patient) | Cập nhật hồ sơ thai phụ, tìm slot, đặt hẹn, chat tư vấn |
| `{{DOCTOR_TOKEN}}` | Bước 1 (Login Doctor) | Khám lâm sàng, chỉ định CLS, duyệt kết quả, trả lời chat |
| `{{RECEPTIONIST_TOKEN}}`| Bước 1 (Login Receptionist) | Mở ca tiếp đón, xác minh CCCD, admit |
| `{{serviceId}}` | Bước 2 (Tạo dịch vụ khám) | Cài giá, tìm bookable-slots, đặt lịch hẹn |
| `{{doctorId}}` | Bước 3 (Lấy/Tạo bác sĩ) | Cài lịch làm việc, gán khám, chỉ định bác sĩ |
| `{{patientId}}` | Bước 4 (Hồ sơ thai phụ) | Tiếp đón, khám bệnh, kê đơn, mở ca tư vấn |
| `{{slotHoldId}}` | Bước 6 (Giữ chỗ 5 phút) | Tạo lịch hẹn (`POST /appointments`) |
| `{{appointmentId}}` | Bước 7 (Đặt lịch thành công)| Tiếp đón (`POST /reception/cases`), tìm hóa đơn |
| `{{caseId}}` | Bước 8 (Mở ca tiếp đón) | Xác minh CCCD, kích hoạt Admission Saga |
| `{{baseInvoiceId}}` | Bước 10 & 11 (Sinh từ Saga) | Thu tiền ban đầu (`POST /invoices/{id}/payments`) |
| `{{encounterId}}` | Bước 13 (Sinh từ Admit lần 2) | Bắt đầu khám, sinh hiệu, bệnh án, chỉ định CLS |
| `{{ticketId}}` | Bước 13 (Sinh từ Admit lần 2) | Gọi số, bắt đầu khám phòng, hoàn tất khám |
| `{{orderId}}` | Bước 20 (Chỉ định Siêu âm) | Thực hiện siêu âm, nhập kết quả, duyệt kết quả |
| `{{supplementaryInvoiceId}}`| Bước 22 & 29 (Sinh sau CLS) | Thu tiền dịch vụ cận lâm sàng phát sinh |
| `{{consultationId}}` | Bước 30 (Tạo ca tư vấn) | Gửi và nhận tin nhắn tư vấn sau khám |

---

## 2. Bảng Tra Cứu Nhanh Tất Cả Các Bước & API

| Bước | Hành động | API (Method & Path) | Service sở hữu | Role thực hiện |
|---|---|---|---|---|
| **Bước 1** | Đăng nhập hệ thống | `POST /auth/login` | **Auth Service** | Tất cả |
| **Bước 2.1** | Tạo dịch vụ khám thai | `POST /admin/services` | **Service Catalog Service** | `ADMIN` |
| **Bước 2.2** | Cài đặt giá cơ sở (Base price) | `POST /admin/services/:id/prices` | **Service Catalog Service** | `ADMIN` |
| **Bước 2.3** | Cài phụ thu theo hạng bác sĩ | `POST /admin/doctor-rank-surcharges` | **Service Catalog Service** | `ADMIN` |
| **Bước 2.4** | Kích hoạt dịch vụ | `POST /admin/services/:id/activate` | **Service Catalog Service** | `ADMIN` |
| **Bước 3.1** | Tra cứu danh sách bác sĩ | `GET /doctors` | **Doctor Service** | `PATIENT` / `ADMIN` |
| **Bước 3.2** | Tạo ca làm việc hàng tuần cho bác sĩ | `POST /doctors/:id/schedules` | **Doctor Service** | `ADMIN` |
| **Bước 4** | Cập nhật hồ sơ hành chính thai phụ | `PUT /patients/me` | **Patient Service** | `PATIENT` |
| **Bước 5** | Tra cứu các khung giờ trống | `GET /bookable-slots` | **Appointment Service** | `PATIENT` |
| **Bước 6** | Giữ chỗ tạm thời 5 phút | `POST /slot-holds` | **Appointment Service** | `PATIENT` |
| **Bước 7** | Xác nhận đặt lịch khám | `POST /appointments` | **Appointment Service** | `PATIENT` |
| **Bước 8** | Mở ca tiếp đón tại quầy | `POST /reception/cases` | **Receptionist Service** | `RECEPTIONIST` |
| **Bước 9** | Xác minh CCCD của thai phụ | `POST /reception/cases/:id/identity-verifications` | **Receptionist Service** | `RECEPTIONIST` |
| **Bước 10** | Tiếp đón lần 1 (Xuất hóa đơn cơ sở) | `POST /reception/cases/:id/admit` | **Receptionist Service** | `RECEPTIONIST` |
| **Bước 11** | Tra cứu hóa đơn cơ sở vừa xuất | `GET /invoices` | **Billing Service** | `RECEPTIONIST` |
| **Bước 12** | Thu tiền viện phí cơ sở ban đầu | `POST /invoices/:id/payments` | **Billing Service** | `RECEPTIONIST` |
| **Bước 13** | Tiếp đón lần 2 (Check-in, Mở bệnh án, Cấp vé)| `POST /reception/cases/:id/admit` | **Receptionist Service** | `RECEPTIONIST` |
| **Bước 14** | Bác sĩ gọi số thứ tự tiếp theo vào phòng | `POST /stages/:stageCode/call-next` | **Queue Service** | `DOCTOR` |
| **Bước 15** | Bắt đầu vào phòng khám | `POST /tickets/:id/start` | **Queue Service** | `DOCTOR` |
| **Bước 16** | Bác sĩ bắt đầu phiên khám lâm sàng | `POST /encounters/:id/start` | **Medical Record Service** | `DOCTOR` |
| **Bước 17** | Nhập chỉ số sinh hiệu (Huyết áp, tim, cân) | `POST /encounters/:id/vital-signs` | **Medical Record Service** | `DOCTOR` |
| **Bước 18** | Ghi nhận diễn biến & bệnh sử | `POST /encounters/:id/notes` | **Medical Record Service** | `DOCTOR` |
| **Bước 19** | Ghi nhận chẩn đoán ICD | `POST /encounters/:id/diagnoses` | **Medical Record Service** | `DOCTOR` |
| **Bước 20** | Chỉ định cận lâm sàng (Siêu âm 2D) | `POST /encounters/:id/orders` | **Medical Record Service** | `DOCTOR` |
| **Bước 21** | Phòng CLS bắt đầu làm dịch vụ | `POST /orders/:id/start` | **Medical Record Service** | Kỹ thuật viên |
| **Bước 22** | Xác nhận đã hoàn tất siêu âm | `POST /orders/:id/performed` | **Medical Record Service** | Kỹ thuật viên |
| **Bước 23** | Nhập kết quả siêu âm có cấu trúc | `POST /orders/:id/results` | **Medical Record Service** | `DOCTOR` |
| **Bước 24** | Ký duyệt kết quả cận lâm sàng | `POST /orders/:id/verify` | **Medical Record Service** | `DOCTOR` |
| **Bước 25** | Chuyển bệnh án sang sẵn sàng tổng kết | `POST /encounters/:id/ready-for-review` | **Medical Record Service** | `DOCTOR` |
| **Bước 26** | Kê đơn thuốc thai kỳ | gRPC: `CreateDraftPrescription` & `IssuePrescription` | **Prescription Service** | `DOCTOR` |
| **Bước 27** | Khóa và hoàn tất bệnh án | `POST /encounters/:id/finalize` | **Medical Record Service** | `DOCTOR` |
| **Bước 28** | Hoàn tất vé trong hàng đợi | `POST /tickets/:id/complete` | **Queue Service** | `DOCTOR` |
| **Bước 29.1**| Lấy hóa đơn bổ sung cho siêu âm | `GET /invoices?type=SUPPLEMENTARY` | **Billing Service** | `RECEPTIONIST` |
| **Bước 29.2**| Thanh toán hóa đơn siêu âm bổ sung | `POST /invoices/:id/payments` | **Billing Service** | `RECEPTIONIST` |
| **Bước 30** | Thai phụ mở ca tư vấn sau khám | `POST /consultations` | **Consultation Service** | `PATIENT` |
| **Bước 31** | Thai phụ gửi câu hỏi tư vấn | `POST /consultations/:id/messages` | **Consultation Service** | `PATIENT` |
| **Bước 32** | Bác sĩ phản hồi tư vấn | `POST /consultations/:id/messages` | **Consultation Service** | `DOCTOR` |
| **Bước 33** | Đóng phiên tư vấn | `POST /consultations/:id/close` | **Consultation Service** | `PATIENT` / `DOCTOR` |
| **Bước 34** | Báo cáo doanh thu & ca khám | gRPC: `GetAppointmentReport`, `GetRevenueReport` | **Reporting Service** | `ADMIN` |
| **Bước 35** | Nhật ký kiểm toán toàn hệ thống | gRPC: `ListAuditLogs` | **Audit Log Service** | `ADMIN` |

---

## 3. Quy Trình Test Chi Tiết Từng Bước (Full Payloads & Headers)

---

### GIAI ĐOẠN 0: KHỞI TẠO TÀI KHOẢN & DỮ LIỆU CỐT LÕI (SETUP PREREQUISITES)

#### Bước 1: Đăng nhập các tài khoản để lấy Bearer Token — API: `POST /auth/login` (Service: Auth Service)
Tất cả các API nghiệp vụ đều yêu cầu Bearer JWT hợp lệ.

**1.1 Đăng nhập Bệnh nhân (Thai phụ):**
- **Service:** `auth-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/auth/login` (hoặc `http://localhost:5003/auth/login`)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "email": "patient@test.local",
  "password": "Password123!"
}
```
- **Response mẫu:** Lấy `accessToken` lưu vào biến `{{PATIENT_TOKEN}}`, `accountId` lưu vào `{{patientAccountId}}`.

**1.2 Đăng nhập Bác sĩ:**
- **Request Body:**
```json
{
  "email": "doctor@test.local",
  "password": "Password123!"
}
```
- **Response mẫu:** Lấy `accessToken` lưu vào biến `{{DOCTOR_TOKEN}}`.

**1.3 Đăng nhập Lễ tân:**
- **Request Body:**
```json
{
  "email": "receptionist@test.local",
  "password": "Password123!"
}
```
- **Response mẫu:** Lấy `accessToken` lưu vào biến `{{RECEPTIONIST_TOKEN}}`.

**1.4 Đăng nhập Quản trị viên (Admin):**
- **Request Body:**
```json
{
  "email": "admin@test.local",
  "password": "Password123!"
}
```
- **Response mẫu:** Lấy `accessToken` lưu vào biến `{{ADMIN_TOKEN}}`.

---

#### Bước 2: Thiết lập Dịch vụ khám thai & Bảng giá (Service: Service Catalog Service)
Để hệ thống tính được tiền và hiển thị dịch vụ trong catalog:

**2.1 Tạo dịch vụ "Khám thai định kỳ" — API: `POST /admin/services` (Service Catalog Service):**
- **Service:** `service-catalog-service`
- **Method:** `POST`
- **URL:** `http://localhost:5007/admin/services` (hoặc `http://localhost:8080/api/catalog/admin/services`)
- **Headers:** 
  - `Authorization: Bearer {{ADMIN_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "Khám thai định kỳ",
  "slug": "kham-thai-dinh-ky",
  "description": "Gói khám thai định kỳ tổng quát cho thai phụ",
  "departmentId": "4815a519-74d3-4632-a9b0-9c4456577881",
  "targetSpecialtyId": "79343da4-a158-4e14-82b8-001dffb03a5b",
  "isBookingEnabled": true,
  "slotDurationMinutes": 30
}
```
- **Response mẫu:** Nhận về `id` dịch vụ -> lưu vào `{{serviceId}}`.

**2.2 Thiết lập giá cơ sở (Base Price) 800.000 VNĐ — API: `POST /admin/services/:serviceId/prices` (Service Catalog Service):**
- **Service:** `service-catalog-service`
- **Method:** `POST`
- **URL:** `http://localhost:5007/admin/services/{{serviceId}}/prices`
- **Headers:** `Authorization: Bearer {{ADMIN_TOKEN}}`
- **Request Body:**
```json
{
  "amountMinor": 800000,
  "currency": "VND",
  "effectiveFrom": "2026-01-01T00:00:00.000Z"
}
```

**2.3 Thiết lập phụ thu theo hạng bác sĩ (Rank Surcharge) +300.000 VNĐ cho SPECIALIST_II — API: `POST /admin/doctor-rank-surcharges` (Service Catalog Service):**
- **Service:** `service-catalog-service`
- **Method:** `POST`
- **URL:** `http://localhost:5007/admin/doctor-rank-surcharges`
- **Headers:** `Authorization: Bearer {{ADMIN_TOKEN}}`
- **Request Body:**
```json
{
  "rankCode": "SPECIALIST_II",
  "surchargeMinor": 300000,
  "currency": "VND",
  "effectiveFrom": "2026-01-01T00:00:00.000Z"
}
```

**2.4 Kích hoạt dịch vụ — API: `POST /admin/services/:serviceId/activate` (Service Catalog Service):**
- **Service:** `service-catalog-service`
- **Method:** `POST`
- **URL:** `http://localhost:5007/admin/services/{{serviceId}}/activate`
- **Headers:** `Authorization: Bearer {{ADMIN_TOKEN}}`

---

#### Bước 3: Thiết lập Bác sĩ & Ca làm việc tuần (Service: Doctor Service)
> **Lưu ý then chốt:** Nếu không có bước tạo lịch làm việc tuần này, API tìm ca trống (`bookable-slots`) sẽ luôn trả về danh sách rỗng `[]`!

**3.1 Lấy thông tin Bác sĩ — API: `GET /doctors` (Doctor Service):**
- **Service:** `doctor-service`
- **Method:** `GET`
- **URL:** `http://localhost:8080/api/doctors` (hoặc `http://localhost:5005/doctors`)
- **Headers:** `Authorization: Bearer {{PATIENT_TOKEN}}`
- **Response:** Chọn một bác sĩ (ví dụ Bác sĩ Nguyễn Thị An có hạng `SPECIALIST_II`) -> lưu `id` vào `{{doctorId}}`.

**3.2 Tạo ca làm việc hàng tuần cho Bác sĩ — API: `POST /doctors/:doctorId/schedules` (Doctor Service):**
- **Service:** `doctor-service`
- **Method:** `POST`
- **URL:** `http://localhost:5005/doctors/{{doctorId}}/schedules` (hoặc `http://localhost:8080/api/doctors/{{doctorId}}/schedules`)
- **Headers:** 
  - `Authorization: Bearer {{ADMIN_TOKEN}}`
  - `Idempotency-Key: sched-mon-001`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "dayOfWeek": 1,
  "startTime": "08:00",
  "endTime": "12:00",
  "slotDurationMinutes": 30,
  "effectiveFrom": "2026-01-01"
}
```
- **Response:** Trạng thái `ACTIVE`. Bác sĩ đã có các khung giờ làm việc: 08:00-08:30, 08:30-09:00, 09:00-09:30, v.v.

---

#### Bước 4: Hoàn thiện hồ sơ hành chính của Thai phụ — API: `PUT /patients/me` (Service: Patient Service)
Appointment Service sẽ gọi gRPC sang Patient Service để xác minh `eligible_for_booking`. Nếu hồ sơ thiếu thông tin hành chính, việc đặt lịch sẽ bị chặn.

- **Service:** `patient-service`
- **Method:** `PUT`
- **URL:** `http://localhost:8080/api/patients/me` (hoặc `http://localhost:5004/patients/me`)
- **Headers:** 
  - `Authorization: Bearer {{PATIENT_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "fullName": "Trần Thị Mai",
  "dateOfBirth": "1998-05-20",
  "gender": "FEMALE",
  "phoneNumber": "0912345678",
  "nationalId": "001198000123",
  "address": "123 Đường Nguyễn Huệ, Quận 1, TP.HCM"
}
```
- **Response mẫu:** Lưu `patientId` (hoặc `id`) vào biến `{{patientId}}`.

---

### GIAI ĐOẠN 1: TÌM CA TRỐNG, GIỮ CHỖ & ĐẶT LỊCH HẸN (BOOKING)

#### Bước 5: Tra cứu các khung giờ trống (Bookable Slots) — API: `GET /bookable-slots` (Service: Appointment Service)
- **Service:** `appointment-service`
- **Method:** `GET`
- **URL:** `http://localhost:8080/api/appointment/bookable-slots?serviceId={{serviceId}}&doctorId={{doctorId}}&fromDate=2026-11-09&toDate=2026-11-09` (hoặc `http://localhost:5008/bookable-slots?...`)
- **Headers:** `Authorization: Bearer {{PATIENT_TOKEN}}`
- **Response mẫu:**
```json
{
  "slots": [
    {
      "startAt": "2026-11-09T01:00:00.000Z",
      "endAt": "2026-11-09T01:30:00.000Z",
      "doctorId": "2c53a2f9-73e7-4bba-bcf2-ee3f8a32ef29",
      "serviceId": "f6cee8ed-8b12-4da5-9ea3-6a2da34f0c3f",
      "available": true
    }
  ]
}
```
*(Chọn 1 slot có `available: true` để lấy `startAt`, `endAt`)*

#### Bước 6: Giữ chỗ tạm thời trong 5 phút (Slot Hold) — API: `POST /slot-holds` (Service: Appointment Service)
- **Service:** `appointment-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/appointment/slot-holds` (hoặc `http://localhost:5008/slot-holds`)
- **Headers:** 
  - `Authorization: Bearer {{PATIENT_TOKEN}}`
  - `Idempotency-Key: hold-req-12345`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "serviceId": "{{serviceId}}",
  "doctorId": "{{doctorId}}",
  "startAt": "2026-11-09T01:00:00.000Z",
  "endAt": "2026-11-09T01:30:00.000Z"
}
```
- **Response mẫu:** Nhận về `holdId` (hoặc `id`) -> lưu vào `{{slotHoldId}}`.

#### Bước 7: Xác nhận đặt lịch khám — API: `POST /appointments` (Service: Appointment Service)
- **Service:** `appointment-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/appointment/appointments` (hoặc `http://localhost:5008/appointments`)
- **Headers:** 
  - `Authorization: Bearer {{PATIENT_TOKEN}}`
  - `Idempotency-Key: booking-req-12345`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "slotHoldId": "{{slotHoldId}}",
  "channel": "ONLINE",
  "note": "Khám thai định kỳ mốc 12 tuần"
}
```
- **Response mẫu:**
```json
{
  "id": "530dcd7d-af50-42b5-bc88-34d5b55e4dd2",
  "appointmentCode": "APTMV6HHPS6498F47",
  "patientId": "{{patientId}}",
  "serviceId": "{{serviceId}}",
  "status": "BOOKED",
  "pricing": {
    "serviceName": "Khám thai định kỳ",
    "baseAmountMinor": 800000,
    "rankSurchargeAmountMinor": 300000,
    "estimatedTotalMinor": 1100000
  }
}
```
- **Lưu ý:** Lưu `id` vào `{{appointmentId}}`. Trạng thái lịch hẹn lúc này là `BOOKED`.

---

### GIAI ĐOẠN 2: TIẾP ĐÓN TẠI QUẦY & ĐÓNG TIỀN BAN ĐẦU

#### Bước 8: Lễ tân mở ca tiếp đón khi thai phụ đến quầy — API: `POST /reception/cases` (Service: Receptionist Service)
- **Service:** `receptionist-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/reception/cases` (hoặc `http://localhost:5006/reception/cases`)
- **Headers:** 
  - `Authorization: Bearer {{RECEPTIONIST_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "appointmentId": "{{appointmentId}}",
  "patientId": "{{patientId}}"
}
```
- **Response mẫu:** Nhận về `id` của reception case -> lưu vào `{{caseId}}`. Trạng thái: `OPEN`.

#### Bước 9: Lễ tân xác minh CCCD / giấy tờ tùy thân — API: `POST /reception/cases/:id/identity-verifications` (Service: Receptionist Service)
- **Service:** `receptionist-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/reception/cases/{{caseId}}/identity-verifications` (hoặc `http://localhost:5006/reception/cases/{{caseId}}/identity-verifications`)
- **Headers:** 
  - `Authorization: Bearer {{RECEPTIONIST_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "method": "NATIONAL_ID_DOCUMENT",
  "result": "VERIFIED",
  "verifiedFields": ["FULL_NAME", "DATE_OF_BIRTH", "PHONE_NUMBER"],
  "note": "Đã đối chiếu căn cước công dân khớp 100%"
}
```
- **Response mẫu:** Trạng thái ca tiếp đón chuyển sang `IDENTITY_VERIFIED`.

#### Bước 10: Kích hoạt Admission Saga lần 1 (Xuất hóa đơn cơ sở) — API: `POST /reception/cases/:id/admit` (Service: Receptionist Service)
- **Service:** `receptionist-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/reception/cases/{{caseId}}/admit` (hoặc `http://localhost:5006/reception/cases/{{caseId}}/admit`)
- **Headers:** `Authorization: Bearer {{RECEPTIONIST_TOKEN}}`
- **Cơ chế:** Receptionist Service gọi gRPC sang Billing Service tạo hóa đơn cơ sở (`type: BASE, status: OPEN`). Do hóa đơn chưa được thanh toán, ca tiếp đón dừng lại ở bước chờ đóng tiền.
- **Response mẫu:** Ca tiếp đón có `status: AWAITING_PAYMENT`, `lastErrorCode: "PAYMENT_NOT_CLEARED"`.

#### Bước 11: Tra cứu hóa đơn cơ sở vừa xuất — API: `GET /invoices` (Service: Billing Service)
- **Service:** `billing-service`
- **Method:** `GET`
- **URL:** `http://localhost:8080/api/billing/invoices?appointmentId={{appointmentId}}&type=BASE&status=OPEN` (hoặc `http://localhost:5009/invoices?...`)
- **Headers:** `Authorization: Bearer {{RECEPTIONIST_TOKEN}}`
- **Response mẫu:**
```json
{
  "invoices": [
    {
      "id": "336278c1-1b28-4c9d-8fd4-f89fd38dc5dd",
      "invoiceNumber": "INVMV6IE6VUF56398",
      "type": "BASE",
      "status": "OPEN",
      "totalMinor": 1100000,
      "balanceMinor": 1100000
    }
  ]
}
```
- **Lưu ý:** Lưu `id` vào `{{baseInvoiceId}}`.

#### Bước 12: Thu tiền viện phí cơ sở ban đầu (Thu ngân) — API: `POST /invoices/:id/payments` (Service: Billing Service)
- **Service:** `billing-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/billing/invoices/{{baseInvoiceId}}/payments` (hoặc `http://localhost:5009/invoices/{{baseInvoiceId}}/payments`)
- **Headers:** 
  - `Authorization: Bearer {{RECEPTIONIST_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "amountMinor": 1100000,
  "method": "CASH",
  "referenceNote": "Thu tiền mặt tại quầy lễ tân"
}
```
- **Response mẫu:** Hóa đơn chuyển trạng thái sang `status: "PAID"`, `balanceMinor: 0`.

---

### GIAI ĐOẠN 3: HOÀN TẤT CHECK-IN & CẤP SỐ THỨ TỰ XẾP HÀNG

#### Bước 13: Tiếp đón hoàn tất lần 2 (Admit Complete) — API: `POST /reception/cases/:id/admit` (Service: Receptionist Service)
- **Service:** `receptionist-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/reception/cases/{{caseId}}/admit` (hoặc `http://localhost:5006/reception/cases/{{caseId}}/admit`)
- **Headers:** `Authorization: Bearer {{RECEPTIONIST_TOKEN}}`
- **Cơ chế:** Do hóa đơn đã `PAID`, Admission Saga thực hiện nốt 3 tác vụ tự động:
  1. Gọi Medical Record Service mở bệnh án lâm sàng DRAFT -> tạo `encounterId`.
  2. Gọi Appointment Service check-in lịch hẹn -> đổi lịch sang `CHECKED_IN`.
  3. Gọi Queue Service cấp số thứ tự vào phòng khám -> sinh vé `ticketCode` (vd: `KB-001`) và `ticketId`.
  4. Ca tiếp đón hoàn tất -> `status: "ADMITTED"`.
- **Response mẫu:**
```json
{
  "id": "{{caseId}}",
  "status": "ADMITTED",
  "admission": {
    "status": "COMPLETED",
    "encounterId": "e931b234-5678-4abc-9999-encounterid01",
    "queueTicketId": "tkt12345-6789-4abc-8888-ticketid0001"
  }
}
```
- **Lưu ý:** Lưu `encounterId` vào `{{encounterId}}`, lưu `queueTicketId` vào `{{ticketId}}`.

#### Bước 14: Bác sĩ / Y tá gọi số thứ tự tiếp theo vào phòng khám — API: `POST /stages/:stageCode/call-next` (Service: Queue Service)
- **Service:** `queue-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/queue/stages/KB/call-next`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "overrideTicketId": "{{ticketId}}",
  "reason": "Mời bệnh nhân vào phòng khám số 1"
}
```
- **Response mẫu:** Vé chuyển sang `status: "CALLED"` (giữ lượt 5 phút).

#### Bước 15: Bắt đầu khám tại phòng (Khách vào phòng) — API: `POST /tickets/:id/start` (Service: Queue Service)
- **Service:** `queue-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/queue/tickets/{{ticketId}}/start`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "expectedVersion": 1
}
```
- **Response mẫu:** Vé chuyển sang `status: "IN_SERVICE"`.

---

### GIAI ĐOẠN 4: KHÁM LÂM SÀNG & CHỈ ĐỊNH CẬN LÂM SÀNG (MEDICAL RECORD)

#### Bước 16: Bác sĩ bắt đầu ca khám lâm sàng (Start Encounter) — API: `POST /encounters/:id/start` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/encounters/{{encounterId}}/start`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "expectedVersion": 1
}
```
- **Response mẫu:** Bệnh án chuyển sang `state: "IN_PROGRESS"`.

#### Bước 17: Điều dưỡng / Bác sĩ đo và nhập chỉ số sinh tồn (Vital Signs) — API: `POST /encounters/:id/vital-signs` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/encounters/{{encounterId}}/vital-signs`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "systolicBloodPressure": 118,
  "diastolicBloodPressure": 76,
  "heartRate": 80,
  "temperatureCelsius": 36.8,
  "weightKg": 56.5
}
```
- **Response mẫu:** Ghi nhận thành công các chỉ số sinh hiệu.

#### Bước 18: Bác sĩ ghi nhận diễn biến & triệu chứng lâm sàng (Notes) — API: `POST /encounters/:id/notes` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/encounters/{{encounterId}}/notes`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "text": "Thai phụ 28 tuổi, mang thai lần đầu, tuổi thai 12 tuần. Toàn trạng tỉnh táo, không nôn nghén nhiều, tim thai nghe rõ."
}
```

#### Bước 19: Bác sĩ ghi nhận mã chẩn đoán (Diagnosis) — API: `POST /encounters/:id/diagnoses` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/encounters/{{encounterId}}/diagnoses`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "code": "O26.9",
  "description": "Theo dõi thai kỳ phát triển bình thường mốc 12 tuần"
}
```

#### Bước 20: Bác sĩ chỉ định làm thêm cận lâm sàng (Siêu âm 2D) — API: `POST /encounters/:id/orders` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/encounters/{{encounterId}}/orders`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "catalogServiceId": "f6cee8ed-8b12-4da5-9ea3-6a2da34f0c3f",
  "stageCode": "SA_2D",
  "requiredResult": true,
  "billableSnapshot": {
    "serviceName": "Siêu âm thai 2D khảo sát hình thái",
    "amountMinor": 250000
  }
}
```
- **Response mẫu:** Nhận về `id` của clinical order -> lưu vào `{{orderId}}`. Trạng thái: `ORDERED`.

---

### GIAI ĐOẠN 5: THỰC HIỆN CẬN LÂM SÀNG & DUYỆT TRẢ KẾT QUẢ

#### Bước 21: Phòng cận lâm sàng tiếp nhận & bắt đầu làm dịch vụ — API: `POST /orders/:id/start` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/orders/{{orderId}}/start`
- **Headers:** `Authorization: Bearer {{DOCTOR_TOKEN}}`
- **Response mẫu:** Order chuyển sang `status: "IN_PROGRESS"`.

#### Bước 22: Kỹ thuật viên xác nhận hoàn tất thực hiện (Performed) — API: `POST /orders/:id/performed` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/orders/{{orderId}}/performed`
- **Headers:** `Authorization: Bearer {{DOCTOR_TOKEN}}`
- **Cơ chế:** Đánh dấu dịch vụ đã làm (`status: "PERFORMED"`). Sự kiện này kích hoạt Billing Service tạo hóa đơn bổ sung (`type: SUPPLEMENTARY`) 250.000 VNĐ.

#### Bước 23: Cập nhật kết quả cận lâm sàng có cấu trúc — API: `POST /orders/:id/results` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/orders/{{orderId}}/results`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "structuredResult": {
    "fetalHeartRateBpm": 152,
    "crownRumpLengthMm": 54,
    "nuchalTranslucencyMm": 1.2,
    "gestationalAgeWeeks": 12,
    "conclusion": "Một thai sống trong buồng tử cung, phát triển bình thường tương đương 12 tuần. Độ mờ da gáy bình thường."
  }
}
```
- **Response mẫu:** Order chuyển sang `status: "RESULT_AVAILABLE"`.

#### Bước 24: Bác sĩ chuyên khoa duyệt kết quả cận lâm sàng — API: `POST /orders/:id/verify` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/orders/{{orderId}}/verify`
- **Headers:** `Authorization: Bearer {{DOCTOR_TOKEN}}`
- **Response mẫu:** Order chuyển sang `status: "VERIFIED"`.

---

### GIAI ĐOẠN 6: KÊ ĐƠN THUỐC, HOÀN TẤT KHÁM & THU PHÍ PHÁT SINH

#### Bước 25: Chuyển bệnh án sang sẵn sàng tổng kết (Ready for Review) — API: `POST /encounters/:id/ready-for-review` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/encounters/{{encounterId}}/ready-for-review`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "expectedVersion": 2
}
```
- **Response mẫu:** Bệnh án chuyển sang `state: "READY_FOR_REVIEW"`. *(Hệ thống chỉ cho phép khi tất cả các orders có `requiredResult: true` đều đã `VERIFIED`)*.

#### Bước 26: Kê đơn thuốc thai kỳ — gRPC: `CreateDraftPrescription` & `IssuePrescription` (Service: Prescription Service)
- **Service:** `prescription-service` (gRPC port 6014)
- **Thực hiện:** Kê đơn bổ sung Sắt & Axit Folic, Canxi cho thai phụ:
  1. `CreateDraftPrescription` với danh sách thuốc và liều dùng.
  2. `IssuePrescription` ký phát hành đơn thuốc (`status: "ISSUED"`).

#### Bước 27: Bác sĩ khóa và hoàn tất ca khám bệnh án (Finalize Encounter) — API: `POST /encounters/:id/finalize` (Service: Medical Record Service)
- **Service:** `medical-record-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/medical-records/encounters/{{encounterId}}/finalize`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "expectedVersion": 3
}
```
- **Response mẫu:** Bệnh án chuyển sang `state: "FINALIZED"`. Lịch hẹn trong Appointment Service tự động chuyển sang `status: "COMPLETED"`.

#### Bước 28: Hoàn tất lượt phục vụ trong hàng đợi (Complete Queue Ticket) — API: `POST /tickets/:id/complete` (Service: Queue Service)
- **Service:** `queue-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/queue/tickets/{{ticketId}}/complete`
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "expectedVersion": 2
}
```
- **Response mẫu:** Vé chuyển sang `status: "COMPLETED"`.

#### Bước 29: Thu tiền hóa đơn bổ sung cho Siêu âm phát sinh (Service: Billing Service)
**29.1 Lấy hóa đơn bổ sung — API: `GET /invoices` (Billing Service):**
- **Service:** `billing-service`
- **Method:** `GET`
- **URL:** `http://localhost:8080/api/billing/invoices?encounterId={{encounterId}}&type=SUPPLEMENTARY` (hoặc `http://localhost:5009/invoices?...`)
- **Headers:** `Authorization: Bearer {{RECEPTIONIST_TOKEN}}`
- **Response mẫu:** Nhận về hóa đơn siêu âm 250.000 VNĐ -> lưu `id` vào `{{supplementaryInvoiceId}}`.

**29.2 Thanh toán hóa đơn bổ sung — API: `POST /invoices/:id/payments` (Billing Service):**
- **Service:** `billing-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/billing/invoices/{{supplementaryInvoiceId}}/payments` (hoặc `http://localhost:5009/invoices/{{supplementaryInvoiceId}}/payments`)
- **Headers:** `Authorization: Bearer {{RECEPTIONIST_TOKEN}}`
- **Request Body:**
```json
{
  "amountMinor": 250000,
  "method": "CASH",
  "referenceNote": "Thanh toán viện phí siêu âm 2D phát sinh"
}
```
- **Response:** Hóa đơn bổ sung chuyển sang `status: "PAID"`.

---

### GIAI ĐOẠN 7: TƯ VẤN HẬU KHÁM & BÁO CÁO QUẢN TRỊ

#### Bước 30: Thai phụ mở ca tư vấn sau khám với Bác sĩ — API: `POST /consultations` (Service: Consultation Service)
- **Service:** `consultation-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/consultations` (hoặc `http://localhost:5019/consultations`)
- **Headers:** 
  - `Authorization: Bearer {{PATIENT_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "patientId": "{{patientId}}",
  "doctorId": "{{doctorId}}",
  "appointmentId": "{{appointmentId}}",
  "topic": "Hỏi về cách dùng thuốc sắt và canxi sau khám"
}
```
- **Response mẫu:** Nhận về `id` ca tư vấn -> lưu vào `{{consultationId}}`. Trạng thái: `OPEN`.

#### Bước 31: Thai phụ gửi tin nhắn hỏi Bác sĩ — API: `POST /consultations/:id/messages` (Service: Consultation Service)
- **Service:** `consultation-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/consultations/{{consultationId}}/messages` (hoặc `http://localhost:5019/consultations/{{consultationId}}/messages`)
- **Headers:** 
  - `Authorization: Bearer {{PATIENT_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "content": "Bác sĩ ơi, thuốc Canxi và Sắt em có uống cùng một lúc được không ạ?"
}
```

#### Bước 32: Bác sĩ trả lời tin nhắn tư vấn — API: `POST /consultations/:id/messages` (Service: Consultation Service)
- **Service:** `consultation-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/consultations/{{consultationId}}/messages` (hoặc `http://localhost:5019/consultations/{{consultationId}}/messages`)
- **Headers:** 
  - `Authorization: Bearer {{DOCTOR_TOKEN}}`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "content": "Chào em, Canxi và Sắt em uống cách nhau ít nhất 2 tiếng nhé. Sắt uống sau bữa sáng, Canxi uống sau bữa trưa cùng nhiều nước."
}
```

#### Bước 33: Đóng phiên tư vấn — API: `POST /consultations/:id/close` (Service: Consultation Service)
- **Service:** `consultation-service`
- **Method:** `POST`
- **URL:** `http://localhost:8080/api/consultations/{{consultationId}}/close` (hoặc `http://localhost:5019/consultations/{{consultationId}}/close`)
- **Headers:** `Authorization: Bearer {{PATIENT_TOKEN}}`
- **Response mẫu:** Phiên tư vấn chuyển sang `status: "CLOSED"`.

#### Bước 34: Kiểm tra Báo cáo Doanh thu & Lượt khám — gRPC: `GetAppointmentReport` & `GetRevenueReport` (Service: Reporting Service)
- **Service:** `reporting-service` (gRPC port 6018)
- **Thực hiện:** Gọi gRPC `ReportingInternalService: GetAppointmentReport` và `GetRevenueReport` để kiểm tra tổng kết:
  - Số ca khám hoàn thành: `+1`
  - Tổng doanh thu thu được: `1.100.000 VNĐ (cơ sở) + 250.000 VNĐ (siêu âm) = 1.350.000 VNĐ`.

#### Bước 35: Kiểm tra Nhật ký kiểm toán toàn hệ thống — gRPC: `ListAuditLogs` (Service: Audit Log Service)
- **Service:** `audit-log-service` (gRPC port 6017)
- **Thực hiện:** Gọi gRPC `AuditLogInternalService: ListAuditLogs` để kiểm tra toàn bộ vết lịch sử kiểm toán của ca khám.
