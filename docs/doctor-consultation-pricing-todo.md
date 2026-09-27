# TODO — Luồng B: Khám theo chuyên khoa và bác sĩ

> Trạng thái: ghi chú thiết kế, chưa implement.
> Quyết định hiện tại: Luồng B dùng **Cách 1** — giá khám được tính trực tiếp theo rank/phân loại bác sĩ.

---

## 1. Mục tiêu luồng B

Luồng B phục vụ trường hợp bệnh nhân muốn khám theo chuyên khoa/bác sĩ, không bắt đầu từ một dịch vụ khám cụ thể.

Flow nghiệp vụ:

```text
Chọn chuyên khoa
→ chọn bác sĩ
→ chọn ngày/giờ hoặc ca khám
→ tính phí khám theo rank bác sĩ
→ tạo appointment
→ sau khi bác sĩ khám, nếu chỉ định thêm dịch vụ thì cộng tiền dịch vụ phát sinh
```

---

## 2. Quyết định pricing

Luồng B dùng **full consultation fee theo rank bác sĩ**.

Công thức:

```text
estimatedInitialPrice = doctorConsultationPriceByRank
```

Không dùng:

```text
base consultation price + surcharge
```

Ví dụ:

| Doctor rank | Giá khám |
|---|---:|
| BASIC | 150.000 VND |
| SPECIALIST_I | 300.000 VND |
| SPECIALIST_II | 500.000 VND |
| EXPERT | 700.000 VND |

Nếu bệnh nhân chọn bác sĩ rank `SPECIALIST_II`, phí khám ban đầu là `500.000 VND`.

---

## 3. Boundary đề xuất

### Doctor Service

Doctor Service nên lưu **rank/phân loại bác sĩ**, không lưu giá tiền.

Dữ liệu cần có:

```text
Doctor.consultationRank
```

Ví dụ rank:

```text
BASIC
SPECIALIST_I
SPECIALIST_II
MASTER
ASSOC_PROFESSOR
PROFESSOR
EXPERT
```

`professionalTitle` vẫn chỉ dùng để hiển thị, ví dụ `BS.CKI`, `Thạc sĩ`, `Bác sĩ CKII`, không dùng để tính tiền.

### Service Catalog hoặc Billing

Giá khám theo rank nên thuộc pricing/catalog/billing domain, không thuộc Doctor Service.

MVP có thể lưu ở Service Catalog:

```text
DoctorConsultationPrice
- id
- rankCode
- amountMinor
- currency
- effectiveFrom
- effectiveTo
- status
- version
```

Khi Billing Service hoàn thiện, có thể chuyển ownership pricing cuối cùng sang Billing nếu kiến trúc yêu cầu.

### Appointment Service

Appointment lưu snapshot tại thời điểm đặt lịch:

```text
appointmentType = SPECIALTY_CONSULTATION
specialtyId
specialtyName snapshot nếu có
doctorId
doctorName snapshot
doctorRankCode
consultationPriceId
consultationAmountMinor
currency
estimatedInitialPrice
```

---

## 4. Dịch vụ phát sinh sau khám

Sau khi bác sĩ khám, bác sĩ có thể chỉ định thêm dịch vụ:

```text
Siêu âm
Xét nghiệm
Tiêm
Thủ thuật
Gói dịch vụ khác
```

Các dịch vụ này lấy từ `MedicalService` của Service Catalog và được tính thêm vào hóa đơn.

Đề xuất lifecycle tối thiểu cho order phát sinh:

```text
ORDERED → COMPLETED → BILLED
ORDERED → CANCELLED
```

Billing final:

```text
phí khám bác sĩ ban đầu
+ dịch vụ phát sinh đã hoàn tất
- giảm giá/bảo hiểm nếu có
= tổng tiền cuối cùng
```

---

## 5. Open questions cần chốt

1. Danh sách rank chính thức gồm những code nào?
2. Rank là enum cố định hay bảng master có thể quản trị?
3. Giá khám theo rank lưu ở Catalog MVP hay đợi Billing Service?
4. Patient có bắt buộc chọn bác sĩ cụ thể hay có thể chỉ chọn rank/chuyên khoa để phòng khám phân công?
5. Nếu bác sĩ nghỉ và đổi sang rank khác thì xử lý chênh lệch giá thế nào?
6. Appointment thu tiền ngay khi đặt lịch hay chỉ lưu estimated price, Reception/Billing thu lúc check-in?

---

## 6. Không implement trong TODO này

- Không sửa Doctor Service source code.
- Không sửa Prisma schema/migration.
- Không sửa Appointment/Billing.
- Không định nghĩa OpenAPI cuối cùng.

Tài liệu này chỉ ghi lại quyết định nghiệp vụ cho luồng B để dùng khi thiết kế Appointment, Doctor, Catalog/Billing sau này.
