# BÁO CÁO TOÀN DIỆN: THUỘC TÍNH VÀ MỐI QUAN HỆ DỮ LIỆU
## Chuyên khoa · Dịch vụ · Nhóm dịch vụ · Thẻ tag · Bác sĩ · Hạng bác sĩ
*Hệ thống Hỗ trợ Chăm sóc Y tế Thai sản & Sản Phụ khoa (DATN Maternal Healthcare)*

---

## 1. TỔNG QUAN KIẾN TRÚC DỮ LIỆU
Trong kiến trúc Microservices phân tán của hệ thống, 6 khái niệm nghiệp vụ này được quản trị bởi **2 Service / Database độc lập**, giao tiếp thông qua **gRPC nội bộ**, **REST API Gateway (Kong)** và **Event-driven messaging**:
1. **Catalog Domain (`catalog-database` / `service-catalog-service`)**: Chịu trách nhiệm quản lý Dịch vụ y tế, Nhóm dịch vụ (Cây danh mục), Thẻ tag phân loại, Bảng giá cơ sở (Base Price) và Bảng phụ thu theo Hạng bác sĩ (Doctor Rank Surcharge).
2. **Doctor Domain (`doctor-database` / `doctor-service`)**: Chịu trách nhiệm quản lý Chuyên khoa (Specialty), Bác sĩ (Doctor & Profile), Phòng khám (Clinic Room), Lịch trực định kỳ (Doctor Schedule) và Lịch nghỉ/tăng ca (Doctor Availability).
3. **Appointment Domain (`appointment-database` / `appointment-service`)**: Nơi hội tụ toàn bộ các thực thể trên khi phát sinh hành động Đặt lịch khám, chốt snapshot giá cơ sở, phụ thu hạng bác sĩ và phòng khám.

---

## 2. CHI TIẾT THUỘC TÍNH CỦA TỪNG THỰC THỂ

### 2.1. Chuyên khoa (Specialty)
- **Vị trí lưu trữ**: Bảng `specialties` trong cơ sở dữ liệu `doctor-database`.
- **Mục đích nghiệp vụ**: Định danh các chuyên ngành y khoa chuyên sâu phục vụ phân bổ nhân lực bác sĩ và chỉ định loại hình khám bệnh.

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc (Constraints) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PK**, Default `gen_random_uuid()` | Định danh duy nhất của chuyên khoa |
| `code` | `VARCHAR(50)` | **Unique**, Not Null | Mã định danh chuyên khoa viết hoa (VD: `OBSTETRICS`, `GYNECOLOGY`) |
| `name` | `VARCHAR(120)` | **Unique**, Not Null | Tên hiển thị đầy đủ của chuyên khoa |
| `description` | `VARCHAR(1000)` | Nullable | Mô tả phạm vi khám chữa bệnh và năng lực lâm sàng |
| `status` | `ENUM` | Default `ACTIVE` (`ACTIVE`, `INACTIVE`) | Trạng thái hoạt động của chuyên khoa |
| `created_at` | `TIMESTAMPTZ(6)` | Default `now()` | Thời điểm tạo bản ghi |
| `updated_at` | `TIMESTAMPTZ(6)` | Auto update | Thời điểm cập nhật cuối cùng |

> [!NOTE]
> **5 Chuyên khoa thực tế đang vận hành trong hệ thống:**
> 1. `OBSTETRICS`: **Sản khoa** (Quản lý thai kỳ, chuyển dạ, sinh thường và sinh mổ).
> 2. `GYNECOLOGY`: **Phụ khoa** (Khám, điều trị bệnh phụ khoa, u xơ, u buồng trứng, tầm soát ung thư).
> 3. `PERINATOLOGY`: **Y học bào thai & Chẩn đoán trước sinh** (Siêu âm 4D/5D, NIPT, can thiệp thai kỳ nguy cơ cao).
> 4. `REPRODUCTIVE_ENDOCRINOLOGY`: **Hiếm muộn & Hỗ trợ sinh sản** (Vô sinh - hiếm muộn, IUI, IVF).
> 5. `MATERNAL_MEDICINE`: **Bệnh lý nội khoa thai kỳ** (Đái tháo đường thai kỳ, tiền sản giật, tim mạch thai kỳ).

---

### 2.2. Dịch vụ y tế (Medical Service)
- **Vị trí lưu trữ**: Bảng `medical_services` trong cơ sở dữ liệu `catalog-database`.
- **Mục đích nghiệp vụ**: Thực thể trung tâm lưu trữ thông tin sản phẩm y tế (khám, siêu âm, xét nghiệm, gói sinh, thủ thuật).

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc (Constraints) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PK**, Default `gen_random_uuid()` | Khóa chính của dịch vụ |
| `code` | `VARCHAR(50)` | **Unique**, Not Null | Mã dịch vụ y tế chuẩn (VD: `PRENATAL_ROUTINE`, `US_4D_5D`, `NIPT_PRO`) |
| `slug` | `VARCHAR(160)` | **Unique**, Not Null | Đường dẫn URL thân thiện SEO (VD: `kham-thai-dinh-ky-chuan-y-khoa`) |
| `name` | `VARCHAR(200)` | Not Null | Tên hiển thị của dịch vụ |
| `summary` | `VARCHAR(500)` | Nullable | Tóm tắt ngắn gọn hiển thị trên thẻ card / kết quả tìm kiếm |
| `description` | `TEXT` | Nullable | Mô tả chi tiết quy trình, chuẩn bị trước khám, đối tượng chỉ định |
| `kind` | `ENUM` | Not Null | Phân loại bản chất kỹ thuật y khoa: <br>• `CONSULTATION` (Khám lâm sàng)<br>• `DIAGNOSTIC` (Chẩn đoán hình ảnh / Xét nghiệm)<br>• `PROCEDURE` (Thủ thuật)<br>• `PACKAGE` (Gói thai sản / sinh nở)<br>• `VACCINATION` (Tiêm chủng)<br>• `OTHER` (Khác) |
| `specialty_id` | `UUID` | Nullable, Indexed | Khóa ngoại logic liên kết sang `specialties.id` ở Doctor Service |
| `thumbnail_url` | `VARCHAR(2048)`| Nullable | Ảnh đại diện dịch vụ |
| `duration_minutes` | `INTEGER` | Nullable, Min: 5, Max: 600 | Thời lượng thực hiện tiêu chuẩn (phút) phục vụ tính toán lịch hẹn |
| `booking_enabled` | `BOOLEAN` | Default `true` | Cho phép bệnh nhân đặt lịch hẹn trực tuyến hay không |
| `doctor_rank_selection_policy` | `ENUM` | Default `NOT_REQUIRED` | Chính sách chọn hạng bác sĩ (xem mục 2.6) |
| `status` | `ENUM` | Default `DRAFT` | Vòng đời: `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `version` | `INTEGER` | Default `1` | Optimistic locking quản lý cập nhật đồng thời |
| `published_at` | `TIMESTAMPTZ(6)` | Nullable | Ngày phát hành công khai dịch vụ |
| `created_at` | `TIMESTAMPTZ(6)` | Default `now()` | Ngày tạo |
| `updated_at` | `TIMESTAMPTZ(6)` | Auto update | Ngày cập nhật |

---

### 2.3. Nhóm dịch vụ / Danh mục (Service Category)
- **Vị trí lưu trữ**: Bảng `service_categories` trong cơ sở dữ liệu `catalog-database`.
- **Mục đích nghiệp vụ**: Tổ chức các dịch vụ theo cây thư mục phân cấp đa tầng (Adjacency List Tree Pattern).

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc (Constraints) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PK**, Default `gen_random_uuid()` | Khóa chính danh mục |
| `code` | `VARCHAR(50)` | **Unique**, Not Null | Mã nhóm (VD: `PRENATAL`, `ULTRASOUND`, `TESTING`, `PACKAGES`) |
| `slug` | `VARCHAR(160)` | **Unique**, Not Null | URL slug của nhóm danh mục |
| `name` | `VARCHAR(160)` | Not Null | Tên hiển thị nhóm (VD: `Khám & Theo dõi Thai kỳ`) |
| `description` | `VARCHAR(1000)` | Nullable | Mô tả chi tiết nhóm dịch vụ |
| `parent_id` | `UUID` | **FK** -> `service_categories.id` | Trỏ đến danh mục cha để tạo cây đa tầng (Self-relation) |
| `status` | `ENUM` | Default `DRAFT` | `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `sort_order` | `INTEGER` | Default `0` | Thứ tự ưu tiên hiển thị trên giao diện |
| `created_at` | `TIMESTAMPTZ(6)` | Default `now()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ(6)` | Auto update | Thời điểm cập nhật |

> [!TIP]
> **Cấu trúc phân cấp thực tế:**
> - `PRENATAL` (Khám & Theo dõi Thai kỳ - Cấp cha)
>   - ↳ `PRENATAL_ROUTINE_CAT` (Khám thai định kỳ cơ bản - Cấp con)
>   - ↳ `PRENATAL_HIGH_RISK_CAT` (Quản lý thai kỳ nguy cơ cao - Cấp con)
> - `ULTRASOUND` (Siêu âm Sản Phụ khoa Chẩn đoán)
> - `TESTING` (Xét nghiệm Sàng lọc Trước sinh)
> - `PACKAGES` (Gói Chăm sóc Thai sản Trọn gói)

---

### 2.4. Thẻ Tag phân loại (Catalog Tag)
- **Vị trí lưu trữ**: Bảng `catalog_tags` trong cơ sở dữ liệu `catalog-database`.
- **Mục đích nghiệp vụ**: Phân loại đa chiều (faceted filtering) giúp mẹ bầu lọc dịch vụ theo tuần thai, độ tuổi, giới tính và độ ưu tiên.

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc (Constraints) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PK**, Default `gen_random_uuid()` | Khóa chính của tag |
| `code` | `VARCHAR(50)` | **Unique**, Not Null | Mã tag viết hoa (VD: `TRIMESTER_1`, `HIGH_RISK`, `POPULAR`) |
| `slug` | `VARCHAR(160)` | **Unique**, Not Null | URL slug lọc tag |
| `name` | `VARCHAR(120)` | Not Null | Tên nhãn hiển thị (VD: `3 tháng đầu (0-13 tuần)`) |
| `group` | `ENUM` | Not Null | Nhóm phân loại nghiệp vụ: <br>• `AUDIENCE`: Nhóm đối tượng (Tuần thai: Tam cá nguyệt 1, 2, 3)<br>• `FEATURE`: Đặc trưng lâm sàng (Thai kỳ nguy cơ cao)<br>• `LABEL`: Nhãn tiếp thị (Dịch vụ nổi bật, Khám định kỳ)<br>• `GENDER`: Giới tính (Chăm sóc Nữ giới & Thai phụ)<br>• `AGE`: Độ tuổi (Độ tuổi sinh sản 18-45) |
| `description` | `VARCHAR(500)` | Nullable | Mô tả tiêu chí của tag |
| `status` | `ENUM` | Default `DRAFT` | `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `sort_order` | `INTEGER` | Default `0` | Thứ tự sắp xếp bộ lọc |
| `created_at` | `TIMESTAMPTZ(6)` | Default `now()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ(6)` | Auto update | Thời điểm cập nhật |

---

### 2.5. Bác sĩ (Doctor & Doctor Profile)
- **Vị trí lưu trữ**: Phân chia thành 2 bảng trong cơ sở dữ liệu `doctor-database` để tách bạch chứng chỉ hành nghề và thông tin hiển thị:
  1. `doctors`: Bản ghi lõi quản lý trạng thái, tài khoản và hạng khám.
  2. `doctor_profiles`: Hồ sơ chi tiết (tiểu sử, học hàm học vị, ngôn ngữ, ảnh).

#### Bảng `doctors`
| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc (Constraints) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PK**, Default `gen_random_uuid()` | Mã định danh bác sĩ trong hệ thống |
| `account_id` | `UUID` | **Unique**, Not Null | Khóa ngoại liên kết sang bảng `accounts` ở Auth Service |
| `license_number` | `VARCHAR(50)` | **Unique**, Not Null | Số chứng chỉ hành nghề y tế (VD: `001234/BYT-CCHN`) |
| `consultation_rank` | `ENUM` | Default `BASIC` | Hạng bác sĩ khám (xem mục 2.6) |
| `status` | `ENUM` | Default `DRAFT` | Vòng đời: `DRAFT`, `ACTIVE`, `INACTIVE` |
| `version` | `INTEGER` | Default `1` | Optimistic locking |
| `created_at` | `TIMESTAMPTZ(6)` | Default `now()` | Thời điểm khởi tạo |
| `updated_at` | `TIMESTAMPTZ(6)` | Auto update | Thời điểm cập nhật |

#### Bảng `doctor_profiles`
| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc (Constraints) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `doctor_id` | `UUID` | **PK**, **FK** -> `doctors.id` | Khóa ngoại 1:1 sang bảng `doctors` (Cascade Delete) |
| `full_name` | `VARCHAR(150)` | Not Null | Họ và tên bác sĩ (VD: `BS. CKII. Lê Thu Hà`) |
| `professional_title` | `VARCHAR(100)` | Nullable | Chức danh chuyên môn (VD: `Bác sĩ CKII - Trưởng khoa Sản`) |
| `biography` | `VARCHAR(2000)`| Nullable | Tiểu sử, quá trình đào tạo và kinh nghiệm công tác |
| `practice_start_year` | `INTEGER` | Nullable, Range: 1950-Now | Năm bắt đầu hành nghề (dùng để tính số năm kinh nghiệm) |
| `languages` | `TEXT[]` | Default `[]` | Mảng các ngôn ngữ hỗ trợ (VD: `['vi', 'en']`) |
| `photo_url` | `VARCHAR(2048)`| Nullable | URL ảnh chân dung bác sĩ |
| `created_at` | `TIMESTAMPTZ(6)` | Default `now()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ(6)` | Auto update | Thời điểm cập nhật |

---

### 2.6. Hạng bác sĩ & Chính sách phụ thu (Doctor Rank & Surcharge)
Hệ thống thiết kế một mô hình tài chính phân tầng chuyên sâu kết hợp giữa **Danh xưng chuyên môn** và **Chính sách phụ thu viện phí**:

#### A. Enum `DoctorConsultationRank` (Hạng bác sĩ)
Định nghĩa 8 cấp bậc chuyên môn:
1. `BASIC`: Bác sĩ đa khoa / Bác sĩ nội trú thực hành cơ bản.
2. `SPECIALIST_I`: Bác sĩ Chuyên khoa I (CKI).
3. `MASTER`: Thạc sĩ Y học.
4. `SPECIALIST_II`: Bác sĩ Chuyên khoa II (CKII).
5. `HEAD_DOCTOR`: Trưởng khoa lâm sàng.
6. `ASSOC_PROFESSOR`: Phó Giáo sư (PGS. TS. BS).
7. `EXPERT`: Chuyên gia Cố vấn cấp cao.
8. `PROFESSOR`: Giáo sư (GS. TS. BS).

#### B. Enum `DoctorRankSelectionPolicy` (Chính sách áp dụng trên Dịch vụ)
Mỗi dịch vụ y tế quy định cách áp dụng phụ thu:
- `NOT_REQUIRED`: Dịch vụ kỹ thuật/xét nghiệm/chẩn đoán hình ảnh không phụ thuộc hạng bác sĩ khám (Phụ thu luôn bằng 0).
- `BASIC_INCLUDED`: Đã bao gồm bác sĩ hạng cơ bản trong giá gốc, không phát sinh phụ thu nếu khám với bác sĩ cơ bản.
- `RANK_UPGRADE_ALLOWED`: Dịch vụ khám lâm sàng cho phép người bệnh chủ động chọn bác sĩ theo hạng mong muốn. Khi chọn bác sĩ hạng cao hơn, hệ thống tự động cộng phụ thu từ bảng phụ thu.

#### C. Bảng `doctor_rank_surcharges` (Phụ thu theo hạng)
- **Vị trí lưu trữ**: Bảng `doctor_rank_surcharges` trong cơ sở dữ liệu `catalog-database`.

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc (Constraints) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PK**, Default `gen_random_uuid()` | Khóa chính bản ghi phụ thu |
| `rank_code` | `VARCHAR(50)` | Not Null, Indexed | Mã hạng bác sĩ tương ứng enum `DoctorConsultationRank` |
| `amount_minor` | `BIGINT` | Not Null, Min: 0 | Số tiền phụ thu tính theo đơn vị nhỏ nhất (VND) |
| `currency` | `CHAR(3)` | Default `'VND'` | Đơn vị tiền tệ |
| `effective_from` | `TIMESTAMPTZ(6)`| Not Null | Thời điểm bắt đầu có hiệu lực giá |
| `effective_to` | `TIMESTAMPTZ(6)`| Nullable | Thời điểm hết hạn giá (null = vô thời hạn) |
| `status` | `ENUM` | Default `SCHEDULED` | `SCHEDULED`, `ACTIVE`, `EXPIRED`, `CANCELLED` |
| `version` | `INTEGER` | Default `1` | Optimistic locking |

> [!IMPORTANT]
> **Biểu giá phụ thu đang có hiệu lực thực tế:**
> - `BASIC`: **0 VND** *(Ràng buộc hệ thống: Hạng cơ bản bắt buộc phụ thu = 0).*
> - `SPECIALIST_I` (Bác sĩ CKI): **+100.000 VND**
> - `MASTER` (Thạc sĩ Bác sĩ): **+150.000 VND**
> - `SPECIALIST_II` (Bác sĩ CKII): **+200.000 VND**
> - `HEAD_DOCTOR` (Trưởng khoa): **+250.000 VND**
> - `ASSOC_PROFESSOR` (Phó Giáo sư): **+350.000 VND**
> - `EXPERT` (Chuyên gia Cố vấn): **+400.000 VND**
> - `PROFESSOR` (Giáo sư): **+500.000 VND**

---

## 3. CÁC BẢNG TRUNG GIAN VÀ BẢNG PHỤ TRỢ

Ngoài các thực thể chính, hệ thống sở hữu các bảng liên kết Many-to-Many (N-N) và bảng quản lý giá:

1. **`doctor_specialties` (Bác sĩ - Chuyên khoa)**:
   - `doctor_id` (`UUID`, FK -> `doctors.id`)
   - `specialty_id` (`UUID`, FK -> `specialties.id`)
   - `is_primary` (`BOOLEAN`, Default `false`): Đánh dấu chuyên khoa chính của bác sĩ.
   - *Ràng buộc*: Composite PK `(doctor_id, specialty_id)`.

2. **`medical_service_categories` (Dịch vụ - Nhóm dịch vụ)**:
   - `medical_service_id` (`UUID`, FK -> `medical_services.id`)
   - `category_id` (`UUID`, FK -> `service_categories.id`)
   - `is_primary` (`BOOLEAN`, Default `false`): Dịch vụ có thể thuộc nhiều nhóm phụ nhưng **bắt buộc phải có đúng 1 nhóm chính (`isPrimary = true`)** mới được phép kích hoạt `ACTIVE`.
   - *Ràng buộc*: Composite PK `(medical_service_id, category_id)`.

3. **`medical_service_tags` (Dịch vụ - Thẻ tag)**:
   - `medical_service_id` (`UUID`, FK -> `medical_services.id`)
   - `tag_id` (`UUID`, FK -> `catalog_tags.id`)
   - *Ràng buộc*: Composite PK `(medical_service_id, tag_id)`.

4. **`base_prices` (Giá gốc dịch vụ)**:
   - `id` (`UUID`, PK)
   - `medical_service_id` (`UUID`, FK -> `medical_services.id`)
   - `amount_minor` (`BIGINT`): Giá gốc dịch vụ (chưa cộng phụ thu hạng bác sĩ).
   - `currency` (`CHAR(3)`): `VND`
   - `effective_from`, `effective_to`, `status`: Quản lý phiên bản giá theo thời gian.

---

## 4. SƠ ĐỒ MỐI QUAN HỆ TOÀN CẢNH (MERMAID ERD)

```mermaid
erDiagram
    %% DOCTOR DOMAIN
    Specialty ||--o{ DoctorSpecialty : "được phụ trách bởi"
    Doctor ||--o{ DoctorSpecialty : "thuộc về"
    Doctor ||--|| DoctorProfile : "sở hữu hồ sơ"
    Doctor ||--o{ DoctorSchedule : "có lịch trực"

    %% CATALOG DOMAIN
    ServiceCategory ||--o{ ServiceCategory : "danh mục cha - con"
    ServiceCategory ||--o{ MedicalServiceCategory : "chứa"
    MedicalService ||--o{ MedicalServiceCategory : "thuộc nhóm"
    CatalogTag ||--o{ MedicalServiceTag : "gắn vào"
    MedicalService ||--o{ MedicalServiceTag : "được gắn"
    MedicalService ||--o{ BasePrice : "có bảng giá gốc"
    
    %% CROSS-DOMAIN & APPOINTMENT INTEGRATION
    Specialty ||--o{ MedicalService : "chuyên khoa phụ trách (Logic FK)"
    MedicalService ||--o{ Appointment : "được đặt khám"
    Doctor ||--o{ Appointment : "bác sĩ thực hiện"
    DoctorRankSurcharge ||..o{ Appointment : "áp dụng phụ thu theo hạng"

    Specialty {
        uuid id PK
        varchar code UK
        varchar name UK
        varchar description
        enum status
    }

    Doctor {
        uuid id PK
        uuid account_id UK
        varchar license_number UK
        enum consultation_rank
        enum status
    }

    DoctorProfile {
        uuid doctor_id PK_FK
        varchar full_name
        varchar professional_title
        text biography
        int practice_start_year
        text_array languages
        varchar photo_url
    }

    DoctorSpecialty {
        uuid doctor_id PK_FK
        uuid specialty_id PK_FK
        boolean is_primary
    }

    DoctorSchedule {
        uuid id PK
        uuid doctor_id FK
        smallint day_of_week
        varchar start_time
        varchar end_time
        date effective_from
        uuid room_id
    }

    ServiceCategory {
        uuid id PK
        varchar code UK
        varchar slug UK
        varchar name
        uuid parent_id FK
        enum status
        int sort_order
    }

    MedicalService {
        uuid id PK
        varchar code UK
        varchar slug UK
        varchar name
        enum kind
        uuid specialty_id "Logic FK"
        int duration_minutes
        boolean booking_enabled
        enum doctor_rank_selection_policy
        enum status
    }

    CatalogTag {
        uuid id PK
        varchar code UK
        varchar slug UK
        varchar name
        enum group
        enum status
    }

    MedicalServiceCategory {
        uuid medical_service_id PK_FK
        uuid category_id PK_FK
        boolean is_primary
    }

    MedicalServiceTag {
        uuid medical_service_id PK_FK
        uuid tag_id PK_FK
    }

    BasePrice {
        uuid id PK
        uuid medical_service_id FK
        bigint amount_minor
        char currency
        timestamp effective_from
        timestamp effective_to
        enum status
    }

    DoctorRankSurcharge {
        uuid id PK
        varchar rank_code
        bigint amount_minor
        char currency
        timestamp effective_from
        enum status
    }

    Appointment {
        uuid id PK
        varchar appointment_code UK
        uuid patient_id
        uuid service_id
        uuid assigned_doctor_id
        varchar assigned_rank_code
        uuid specialty_id
        bigint base_amount_minor
        bigint rank_surcharge_amount_minor
        bigint estimated_total_minor
    }
```

---

## 5. MỐI QUAN HỆ VÀ CƠ CHẾ VẬN HÀNH NGHIỆP VỤ

### 5.1. Mối quan hệ giữa Bác sĩ - Chuyên khoa (`Doctor` $\leftrightarrow$ `Specialty`)
- Quan hệ **Nhiều - Nhiều (N:N)** thông qua bảng `doctor_specialties`.
- Một bác sĩ có thể làm việc ở nhiều chuyên khoa (ví dụ: Bác sĩ vừa thuộc khoa *Sản khoa* vừa hội chẩn tại khoa *Y học bào thai*), nhưng trường `is_primary = true` xác định chuyên khoa chính để xuất hiện mặc định trong danh bạ khoa.

### 5.2. Mối quan hệ giữa Dịch vụ - Chuyên khoa (`MedicalService` $\rightarrow$ `Specialty`)
- Dịch vụ y tế liên kết với Chuyên khoa thông qua trường `specialty_id`.
- Quan hệ **Nhiều - Một (N:1)**: Nhiều dịch vụ cùng trực thuộc 1 Chuyên khoa (ví dụ: Chuyên khoa Sản khoa phụ trách các dịch vụ `Khám thai định kỳ`, `Gói sinh con thường`, `Gói sinh mổ`).
- Khi bệnh nhân tìm kiếm dịch vụ, hệ thống lọc được ngay danh sách bác sĩ thuộc chuyên khoa tương ứng có lịch trực rảnh để phục vụ bệnh nhân.

### 5.3. Mối quan hệ giữa Dịch vụ - Nhóm dịch vụ (`MedicalService` $\leftrightarrow$ `ServiceCategory`)
- Quan hệ **Nhiều - Nhiều (N:N)** qua bảng `medical_service_categories`.
- Cho phép 1 dịch vụ xuất hiện ở nhiều nhóm (ví dụ: Dịch vụ `Khám thai VIP` vừa nằm trong nhóm `Khám thai định kỳ cơ bản` vừa nằm trong nhóm `Quản lý thai kỳ nguy cơ cao`).
- Ràng buộc toàn vẹn: Bắt buộc dịch vụ phải có đúng **1 nhóm chính (`is_primary = true`)** để dựng breadcrumb đường dẫn trên website.

### 5.4. Mối quan hệ giữa Dịch vụ - Thẻ tag (`MedicalService` $\leftrightarrow$ `CatalogTag`)
- Quan hệ **Nhiều - Nhiều (N:N)** qua bảng `medical_service_tags`.
- Dịch vụ được gắn nhiều tag thuộc các nhóm khác nhau:
  - Gắn tag tuần thai: `TRIMESTER_1` (3 tháng đầu).
  - Gắn tag tính chất: `HIGH_RISK` (Thai kỳ nguy cơ cao).
  - Gắn nhãn quảng bá: `POPULAR` (Nổi bật).
- Giúp tính năng tìm kiếm của bệnh nhân có thể lọc chéo nhiều điều kiện (Faceted Search) tức thời.

### 5.5. Cơ chế tính giá khi Đặt lịch hẹn (Hội tụ tại `Appointment`)
Khi bệnh nhân tiến hành đặt lịch khám trên Cổng thông tin:
$$\text{estimated\_total\_minor} = \text{base\_amount\_minor} + \text{rank\_surcharge\_amount\_minor}$$

1. **Bước 1**: Lấy giá gốc dịch vụ `base_amount_minor` từ bảng `base_prices` đang `ACTIVE` tại thời điểm khám.
2. **Bước 2**: Kiểm tra `doctor_rank_selection_policy` của dịch vụ:
   - Nếu là `NOT_REQUIRED` hoặc `BASIC_INCLUDED`: `rank_surcharge_amount_minor = 0`.
   - Nếu là `RANK_UPGRADE_ALLOWED`: Tra cứu `consultation_rank` của Bác sĩ được chọn (ví dụ: Bác sĩ Lê Thu Hà có hạng `HEAD_DOCTOR`), tìm bản ghi phụ thu đang `ACTIVE` trong bảng `doctor_rank_surcharges` với `rank_code = 'HEAD_DOCTOR'` $\rightarrow$ Phụ thu là `250.000 VND`.
3. **Bước 3**: Khởi tạo bản ghi `Appointment` snapshot toàn bộ thông số:
   - `service_id`: Dịch vụ khám
   - `specialty_id`: Chuyên khoa
   - `assigned_doctor_id`: Bác sĩ phụ trách
   - `assigned_rank_code`: Hạng bác sĩ tại thời điểm đặt
   - `base_amount_minor`: 300.000 VND
   - `rank_surcharge_amount_minor`: 250.000 VND
   - `estimated_total_minor`: 550.000 VND
   - `room_id`: Phòng khám được xếp theo lịch trực của bác sĩ.

---

## 6. KẾT LUẬN & ĐÁNH GIÁ CHUẨN MỰC
- **Chuẩn hóa dữ liệu y tế**: Thiết kế dữ liệu bám sát mô hình bệnh viện quốc tế và thông tư quản lý hành nghề của Bộ Y tế Việt Nam.
- **Tính mở rộng (Scalability)**: Tách rời Catalog và Doctor thành 2 microservices độc lập giúp hệ thống chịu tải cao, dễ dàng thay đổi biểu giá, biểu phí phụ thu theo thời gian mà không làm ảnh hưởng đến dữ liệu lịch sử của các cuộc hẹn trước đó.
- **Tính toàn vẹn (Data Integrity)**: Toàn bộ quá trình tính viện phí đều lưu snapshot tại thời điểm đặt lịch, bảo vệ tính trung thực tài chính của hồ sơ bệnh án điện tử.

