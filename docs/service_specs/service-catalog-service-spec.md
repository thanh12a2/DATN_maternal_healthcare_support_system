# Service Catalog Service — Specification

> Trạng thái: Draft cô đọng cho MVP 1 cơ sở phòng khám.  
> Cập nhật: 2026-09-22.  
> Phạm vi: Catalog cho **luồng A — đặt lịch theo dịch vụ khám**.

---

## 1. Mục tiêu

Service Catalog Service quản lý danh mục dịch vụ y tế của phòng khám và giá niêm yết của từng dịch vụ.

Trong MVP chỉ có **1 cơ sở**, nên Catalog **không quản lý**:

- Facility
- Department
- Room
- ServiceOffering theo cơ sở

Catalog tập trung vào:

- Dịch vụ khám/dịch vụ y tế (`MedicalService`).
- Category/tag để tìm kiếm.
- Giá gốc của dịch vụ (`BasePrice`).
- Chính sách chọn rank bác sĩ cho dịch vụ khám.
- Phụ phí nâng rank bác sĩ trong luồng đặt theo dịch vụ.
- Snapshot dữ liệu giá cho Appointment/Billing.

---

## 2. Luồng A — đặt lịch theo dịch vụ khám

Luồng A dùng khi bệnh nhân bắt đầu bằng việc chọn một dịch vụ.

Flow:

```text
Chọn dịch vụ khám
→ xem giá gốc của dịch vụ
→ nếu dịch vụ cho phép, chọn rank/bác sĩ cao hơn
→ chọn ngày giờ khám
→ hệ thống tính tạm tính
→ tạo appointment và lưu snapshot giá
```

Quy tắc giá:

```text
estimatedTotal = serviceBasePrice + doctorRankSurcharge
```

Trong đó:

- `serviceBasePrice`: giá gốc của dịch vụ, đã bao gồm bác sĩ rank cơ bản nếu dịch vụ cần bác sĩ.
- `doctorRankSurcharge`: phụ phí khi khách chọn rank bác sĩ cao hơn.
- Rank cơ bản luôn có surcharge bằng `0` để tránh double charge.

Ví dụ:

| Thành phần | Giá |
|---|---:|
| Khám thai cơ bản | 300.000 VND |
| Nâng lên bác sĩ CKII | +300.000 VND |
| Tạm tính | 600.000 VND |

---

## 3. Boundary

### Catalog chịu trách nhiệm

- CRUD/lifecycle dịch vụ.
- Category và tag cho discovery.
- Base price của dịch vụ.
- Chính sách dịch vụ có cần/chọn rank bác sĩ hay không.
- Bảng phụ phí nâng rank bác sĩ cho luồng dịch vụ.
- Public search/detail catalog.
- Internal resolve/eligibility để Appointment lấy snapshot.

### Catalog không chịu trách nhiệm

- Tài khoản, role, JWT.
- Hồ sơ bác sĩ, lịch làm việc, slot khả dụng.
- Phân loại/rank thực tế của từng bác sĩ.
- Appointment lifecycle.
- Check-in, hàng chờ.
- Medical record, chẩn đoán, chỉ định.
- Invoice/final payment.
- Facility/Department/Room trong MVP.

### Ownership liên quan

| Dữ liệu | Owner |
|---|---|
| `specialtyId` | Doctor Service |
| `doctorId`, doctor profile, doctor schedule | Doctor Service |
| `doctorRank` của từng bác sĩ | Doctor Service, đề xuất bổ sung |
| Giá dịch vụ | Service Catalog |
| Phụ phí nâng rank trong luồng dịch vụ | Service Catalog MVP |
| Appointment snapshot | Appointment Service |
| Final invoice/payment | Billing Service khi có |

Catalog không query database service khác.

---

## 4. Domain model

### 4.1 Enums

```text
CatalogStatus = DRAFT | ACTIVE | INACTIVE | ARCHIVED
MedicalServiceKind = CONSULTATION | DIAGNOSTIC | PROCEDURE | PACKAGE | VACCINATION | OTHER
TagGroup = AGE | GENDER | AUDIENCE | FEATURE | LABEL
PriceStatus = SCHEDULED | ACTIVE | EXPIRED | CANCELLED
DoctorRankSelectionPolicy = NOT_REQUIRED | BASIC_INCLUDED | RANK_UPGRADE_ALLOWED
```

Ý nghĩa `DoctorRankSelectionPolicy`:

| Policy | Ý nghĩa |
|---|---|
| `NOT_REQUIRED` | Dịch vụ không cần bác sĩ trong pricing/booking flow |
| `BASIC_INCLUDED` | Giá dịch vụ đã gồm bác sĩ rank cơ bản, không cho nâng rank |
| `RANK_UPGRADE_ALLOWED` | Giá dịch vụ đã gồm rank cơ bản, cho cộng phụ phí rank cao hơn |

---

### 4.2 MedicalService

| Field | Type | Ghi chú |
|---|---|---|
| `id` | UUID | PK |
| `code` | varchar(50) | unique, uppercase |
| `slug` | varchar(160) | unique public key |
| `name` | varchar(200) | tên hiển thị |
| `summary` | varchar(500) | mô tả ngắn |
| `description` | text | sanitized |
| `kind` | enum | loại dịch vụ |
| `specialtyId` | UUID nullable | reference Doctor Service |
| `thumbnailUrl` | string nullable | HTTPS/allowlist |
| `durationMinutes` | int nullable | tham khảo, không tạo slot |
| `bookingEnabled` | boolean | có cho đặt lịch không |
| `doctorRankSelectionPolicy` | enum | chính sách rank bác sĩ |
| `status` | enum | DRAFT/ACTIVE/INACTIVE/ARCHIVED |
| `version` | int | snapshot/concurrency |
| `publishedAt` | timestamptz nullable | lần đầu active |
| `createdAt/updatedAt` | timestamptz | audit |

Rule:

- Dịch vụ public phải `ACTIVE`.
- Dịch vụ active phải có đúng một primary category.
- Nếu `doctorRankSelectionPolicy = RANK_UPGRADE_ALLOWED`, rank cơ bản phải có surcharge `0`.
- `durationMinutes` chỉ là gợi ý, Appointment/Doctor vẫn kiểm tra slot và availability.

---

### 4.3 BasePrice

Giá gốc của dịch vụ.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | UUID | PK |
| `medicalServiceId` | UUID | FK local |
| `amountMinor` | bigint | tiền dạng integer, không dùng float |
| `currency` | char(3) | default `VND` |
| `effectiveFrom` | timestamptz | bắt đầu hiệu lực |
| `effectiveTo` | timestamptz nullable | end-exclusive |
| `status` | PriceStatus | SCHEDULED/ACTIVE/EXPIRED/CANCELLED |
| `version` | int | snapshot |
| `createdAt/updatedAt` | timestamptz | audit |

Rule:

- Không overlap active/scheduled interval cho cùng `medicalServiceId + currency`.
- `amountMinor` của dịch vụ khám đã bao gồm bác sĩ rank cơ bản nếu policy không phải `NOT_REQUIRED`.

---

### 4.4 DoctorRankSurcharge

Phụ phí nâng rank bác sĩ trong luồng A.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | UUID | PK |
| `rankCode` | varchar(50) | code rank từ Doctor Service contract |
| `amountMinor` | bigint | phụ phí; rank cơ bản = 0 |
| `currency` | char(3) | default `VND` |
| `effectiveFrom` | timestamptz | bắt đầu hiệu lực |
| `effectiveTo` | timestamptz nullable | end-exclusive |
| `status` | PriceStatus | SCHEDULED/ACTIVE/EXPIRED/CANCELLED |
| `version` | int | snapshot |
| `createdAt/updatedAt` | timestamptz | audit |

MVP dùng surcharge global theo rank. Chưa hỗ trợ surcharge khác nhau theo từng dịch vụ.

Rule:

- Không overlap active/scheduled interval cho cùng `rankCode + currency`.
- `BASIC` hoặc rank cơ bản tương đương phải có active surcharge `0`.
- Catalog chỉ lưu giá theo rank code, không sở hữu hồ sơ bác sĩ.

---

### 4.5 ServiceCategory / CatalogTag

`ServiceCategory` dùng để nhóm dịch vụ.

`CatalogTag` dùng để filter/discovery, ví dụ audience, age, gender, feature.

Tag không phải quyết định y khoa. Ví dụ `PREGNANT_WOMEN` chỉ phục vụ tìm kiếm, không xác nhận patient đang mang thai.

---

## 5. API đề xuất

### Public

| Method | Path | Mục đích |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness |
| GET | `/services` | Search/filter/sort dịch vụ active |
| GET | `/services/{idOrSlug}` | Detail dịch vụ active |
| GET | `/categories` | Category tree/list active |
| GET | `/filters` | Metadata tag/filter |

### Admin

| Method | Path | Mục đích |
|---|---|---|
| POST | `/admin/services` | Tạo draft service |
| PATCH | `/admin/services/{serviceId}` | Sửa service |
| POST | `/admin/services/{serviceId}/activate` | Publish service |
| POST | `/admin/services/{serviceId}/deactivate` | Ẩn service |
| POST/PATCH | `/admin/categories/...` | Quản trị category |
| POST/PATCH | `/admin/tags/...` | Quản trị tag |
| POST | `/admin/services/{serviceId}/prices` | Schedule base price |
| POST | `/admin/doctor-rank-surcharges` | Schedule phụ phí rank |
| POST | `/admin/prices/{priceId}/cancel` | Hủy price/surcharge |

### Internal

| Method | Path | Mục đích |
|---|---|---|
| GET | `/internal/services/{serviceId}/eligibility` | Appointment resolve service/base price/surcharge |
| POST | `/internal/services/resolve` | Batch resolve service snapshot |

---

## 6. Pricing response cho Appointment

Request eligibility có thể truyền rank mong muốn:

```text
GET /internal/services/{serviceId}/eligibility?doctorRankCode=SPECIALIST_II&at=...
```

Response đề xuất:

```json
{
  "data": {
    "service": {
      "id": "uuid",
      "code": "ANC_BASIC",
      "name": "Khám thai cơ bản",
      "kind": "CONSULTATION",
      "specialtyId": "uuid-or-null",
      "bookingEnabled": true,
      "durationMinutes": 30,
      "doctorRankSelectionPolicy": "RANK_UPGRADE_ALLOWED",
      "version": 3
    },
    "basePrice": {
      "id": "uuid",
      "amountMinor": 300000,
      "currency": "VND",
      "version": 1
    },
    "doctorRankSurcharge": {
      "rankCode": "SPECIALIST_II",
      "priceId": "uuid",
      "amountMinor": 300000,
      "currency": "VND",
      "version": 1
    },
    "estimatedTotal": {
      "amountMinor": 600000,
      "currency": "VND"
    }
  }
}
```

Validation:

- Nếu policy `NOT_REQUIRED` hoặc `BASIC_INCLUDED`, Catalog không cộng surcharge rank cao hơn.
- Nếu policy `RANK_UPGRADE_ALLOWED` nhưng thiếu active surcharge cho rank được chọn, trả lỗi.
- Nếu không truyền `doctorRankCode`, mặc định dùng rank cơ bản surcharge `0`.

---

## 7. Snapshot Appointment nên lưu

Appointment Service nên lưu snapshot tại thời điểm đặt lịch:

```text
appointmentType = SERVICE_APPOINTMENT
serviceId
serviceCode
serviceName
serviceVersion
basePriceId
baseAmountMinor
currency
doctorRankSelectionPolicy
selectedDoctorRankCode
rankSurchargePriceId
rankSurchargeAmountMinor
estimatedTotalAmountMinor
```

Nếu user chọn bác sĩ cụ thể trong luồng A, Appointment lưu thêm:

```text
selectedDoctorId
selectedDoctorName snapshot
selectedDoctorRankCode
```

Appointment vẫn phải kiểm tra Doctor availability/slot nếu có chọn bác sĩ hoặc rank yêu cầu phân công bác sĩ.

---

## 8. Business rules chính

| ID | Rule |
|---|---|
| BR-001 | Public API chỉ trả `ACTIVE` service/category/tag |
| BR-002 | Code/slug unique sau normalize |
| BR-003 | Active service phải có đúng một primary category |
| BR-004 | Base price không overlap theo service/currency |
| BR-005 | Doctor rank surcharge không overlap theo rank/currency |
| BR-006 | Rank cơ bản có surcharge `0` |
| BR-007 | Không dùng float để lưu tiền |
| BR-008 | Catalog không dùng `professionalTitle` để tính giá |
| BR-009 | Catalog không xác nhận doctor availability |
| BR-010 | Appointment/Billing phải lưu snapshot giá |

---

## 9. Những điểm cần Doctor Service cung cấp

Để luồng A hoạt động nếu cho chọn bác sĩ/rank, Doctor Service cần có contract rõ cho:

- rank chuẩn hóa của bác sĩ, ví dụ `consultationRank`;
- danh sách bác sĩ active theo specialty/rank;
- eligibility/availability theo doctor/date-time;
- public fields để hiển thị bác sĩ.

Hiện Doctor Service mới có `professionalTitle` dạng text, chưa đủ để tính phụ phí rank một cách ổn định.

### Yêu cầu cho coding agent khi chỉnh Doctor Service

Trước khi implement pricing theo rank ở Catalog/Appointment, agent phải cập nhật Doctor Service theo thứ tự:

1. Thêm `DoctorConsultationRank` hoặc bảng master rank theo quyết định được duyệt.
2. Thêm field chuẩn hóa `Doctor.consultationRank` với default rank cơ bản.
3. Không thêm bất kỳ field giá tiền nào vào Doctor Service.
4. Cập nhật DTO create/update doctor để ADMIN quản lý rank; doctor thường không tự sửa rank.
5. Cập nhật public/internal response để trả `consultationRank` khi cần cho chọn bác sĩ và snapshot.
6. Cập nhật query list doctor cho phép filter theo `specialtyId` và `consultationRank` nếu luồng đặt lịch cần.
7. Cập nhật internal eligibility để trả rank snapshot cùng `doctorId`, status và version.
8. Cập nhật Doctor OpenAPI, migration, seed/test tương ứng.
9. Không dùng `professionalTitle` để suy ra rank hoặc tính giá.

---

## 10. Open questions

1. Danh sách rank chính thức và rank cơ bản tên là gì: `BASIC`, `REGULAR` hay tên khác?
2. Luồng A cho chọn rank thôi hay bắt buộc chọn bác sĩ cụ thể?
3. Nếu chọn rank nhưng phòng khám phân công bác sĩ sau, Appointment kiểm tra slot theo rank như thế nào?
4. Nếu bác sĩ được đổi sang rank thấp/cao hơn sau khi đặt, xử lý chênh lệch giá ra sao?
5. Giá tạm tính thu lúc đặt lịch, lúc check-in, hay chỉ hiển thị để tham khảo?
6. DoctorRankSurcharge nằm lâu dài ở Catalog hay sau này chuyển sang Billing/Pricing Service?

---

## 11. Kết luận

Với luồng A, giá dịch vụ là giá gốc đã bao gồm bác sĩ rank cơ bản nếu dịch vụ cần bác sĩ. Khi khách chọn rank cao hơn, hệ thống cộng thêm phụ phí rank:

```text
estimatedTotal = serviceBasePrice + doctorRankSurcharge
```

Catalog sở hữu giá dịch vụ và phụ phí rank trong MVP. Doctor Service chỉ nên sở hữu thông tin bác sĩ và rank chuẩn hóa của từng bác sĩ, không sở hữu giá tiền.


