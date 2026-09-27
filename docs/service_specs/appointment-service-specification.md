# Appointment Service — Service Specification

> **Trạng thái:** `APPROVED_CODING_BASELINE`  
> **Phiên bản:** `1.1.0` — 2026-09-27  
> **Mục tiêu:** đủ rõ để AI coding agent triển khai hoàn chỉnh Appointment Service, database, REST, internal gRPC, event/outbox và Docker integration mà không tự đoán boundary hoặc business rule.  
> **Không thuộc tài liệu:** source code, code skeleton, unit-test code và concurrency-test code.

## 0. Nguồn và quyết định ưu tiên

Tài liệu được tổng hợp từ:

- `docs/system_design.md`;
- `docs/service-specification-template.md`;
- đặc tả Auth, Patient, Doctor, Service Catalog và Receptionist trong `docs/service_specs/`;
- `docs/receptionist-service-grpc-design.md`;
- tài liệu use case và quy hoạch hệ thống trong `docs/`.

Khi tài liệu cũ mâu thuẫn, ưu tiên theo thứ tự: `system_design.md` → đặc tả này → service specs hiện hành → use case/quy hoạch cũ.

Các quyết định đã chốt cho MVP:

1. Appointment sở hữu appointment lifecycle, booking occupancy, slot hold, bookable slot và check-in state.
2. Doctor chỉ sở hữu working availability; Doctor không biết slot đã được Appointment giữ/đặt.
3. Catalog sở hữu service definition, booking flag, duration, base price và rank surcharge.
4. Patient sở hữu hồ sơ và booking eligibility.
5. Receptionist là orchestrator của Admission; Appointment không điều phối Billing, Medical Record hoặc Queue.
6. Billing sở hữu invoice/payment/refund; Queue chỉ tạo ticket sau Admission; Medical Record sở hữu encounter/clinical data.
7. Mỗi appointment MVP bắt buộc có `medicalServiceId`, một `doctorId` cụ thể và service kind `CONSULTATION`.
8. Hệ thống hỗ trợ ba nguồn tạo lịch: bệnh nhân tự đặt, lễ tân đặt hộ và walk-in do lễ tân tiếp nhận; cả ba dùng chung hold/occupancy/lifecycle.
9. Không có `AppointmentType` trong MVP. Cách chọn bác sĩ dùng `DoctorSelectionMode`; nguồn tạo lịch dùng `AppointmentSource`.
10. `patientId` luôn bắt buộc; `patientAuthAccountId` có thể null đối với hồ sơ tạo tại quầy chưa liên kết Auth account và được gắn sau bằng event authoritative từ Patient.
11. Admin không gọi Appointment để đặt lịch thường ngày. Nghiệp vụ nhân viên thao tác thay bệnh nhân đi qua Receptionist Service để giữ authorization/audit nhất quán.
12. Không shared database, không foreign key xuyên service, không distributed transaction.
13. Public API dùng REST qua Kong; nội bộ dùng unary gRPC `v1`; domain event dùng RabbitMQ + transactional outbox.

Với service `CONSULTATION` có `bookingEnabled=true`, `durationMinutes` từ Catalog là booking duration authoritative. Quyết định này thay thế wording cũ coi duration chỉ là tham khảo; Catalog contract phải được cập nhật tương ứng trước khi chạy end-to-end.

---

## 1. Tổng quan và boundary

| Thuộc tính | Giá trị |
|---|---|
| Service | Appointment Service |
| Bounded context | Appointment Scheduling & Booking Occupancy |
| Source path | `services/apps/appointment-service/` |
| Prisma | `services/prisma/appointment/schema.prisma` và migrations riêng |
| Public OpenAPI | `docs/api-specs/appointment-service.yaml` |
| Public route | `/api/appointments` |
| Local HTTP | `5007` |
| Internal gRPC | `6007` |
| Dev PostgreSQL host port | `5437` |
| Timezone/currency | `Asia/Bangkok`, `VND` |

### 1.1 Chịu trách nhiệm

- Tính slot thực sự có thể đặt từ Doctor availability trừ local `HELD`/`BOOKED` reservation.
- Tạo, expire, release và consume slot hold.
- Chống doctor và patient bị đặt lịch chồng giờ dưới concurrent request.
- Tạo, xem, reschedule, cancel appointment cho cả self-service và command hợp lệ từ Receptionist Service.
- Ghi nhận nguồn tạo lịch `PATIENT_SELF`, `RECEPTION_ON_BEHALF` hoặc `WALK_IN` và actor thực hiện.
- Lưu immutable revision và snapshot doctor/service/pricing ở từng lần đặt hoặc đổi lịch.
- Cung cấp billing context từ pricing snapshot cho Billing Service nhưng không sở hữu trạng thái tài chính.
- Kiểm tra Admission eligibility và thực hiện authoritative check-in.
- Nhận completion/no-show command từ đúng owner service.
- Reconcile appointment tương lai khi Doctor thay đổi.
- Phát event qua outbox; tạo reminder event 24 giờ và 2 giờ trước lịch.

### 1.2 Không chịu trách nhiệm

- Account, password, role, user token — Auth Service.
- Patient profile/identity — Patient Service.
- Doctor profile, rank, specialty, schedule/availability — Doctor Service.
- Catalog master data và bảng giá — Service Catalog.
- Reception Case, identity verification, Admission Saga — Receptionist Service.
- Invoice/payment/refund — Billing Service.
- Queue ticket/priority/position — Queue Service.
- Encounter, diagnosis, prescription, result — Medical Record Service.
- Gửi SMS/email/push trực tiếp — Notification capability.
- Facility/room/equipment/group capacity/recurring appointment trong MVP.

### 1.3 Data ownership

Appointment Database chỉ sở hữu:

- `Appointment`, `AppointmentRevision`, `AppointmentCurrentRevision`;
- `SlotReservation`, `AppointmentStatusHistory`;
- historical doctor/service/pricing snapshot;
- idempotency, audit, outbox, inbox/dedupe và reminder records.

`patientId`, `doctorId`, `medicalServiceId`, price IDs, Reception/Medical references là external references, không có cross-service FK.

---

## 2. Actors, authentication và authorization

| Actor/caller | Capability | Rule |
|---|---|---|
| `PATIENT` | Search, hold, confirm, own list/detail, reschedule, cancel | JWT role `PATIENT`; không nhận arbitrary patient owner từ body/query |
| Receptionist Service | Search slot/lịch, đặt hộ/walk-in, get/eligibility, đổi/hủy hộ, check-in/no-show | Service JWT + scope; gửi staff context để audit; Appointment vẫn tự validate nghiệp vụ |
| Billing Service | Đọc billing context của appointment/revision | Service JWT + read-only scope; không được đổi appointment state |
| Medical Record Service | Get/complete | Service JWT; completion reference bắt buộc |
| System worker | Expiry, reminder, outbox, reconciliation | Workload identity nội bộ; không tự mark no-show |

Quy tắc identity:

- User JWT `sub` là Auth account ID, không phải `patientId`.
- Self-service: Appointment gọi Patient để resolve `JWT.sub → patientId` và eligibility; không nhận `patientId` từ public request.
- Staff flow: Receptionist gửi `patientId`; Appointment gọi Patient bằng chính `patientId` để kiểm tra eligibility, không tin dữ liệu hồ sơ do Reception tự khai báo.
- Hold lưu `patientId`, `patientVersionSnapshot`, nguồn booking và actor context. `patientAuthAccountId` lấy từ Patient nếu đã liên kết, không lấy từ Reception request.
- Khi confirm, Appointment lưu riêng `patientId` và nullable `patientAuthAccountId`.
- Own read/mutation authorize bằng `patientAuthAccountId = verified JWT.sub`; appointment chưa link account không thể được public JWT nhận sở hữu chỉ bằng phone/email/national ID.
- Event `patient.account_linked` authoritative được phép chuyển `patientAuthAccountId` từ null sang đúng account ID cho các appointment cùng `patientId`; không overwrite giá trị khác, trường hợp conflict phải alert/manual review.
- Appointment của account khác trả `404 APPOINTMENT_NOT_FOUND` để tránh enumeration.
- Kong không thay thế authorization trong service.

Staff context gồm `performedByAccountId`, `receptionistProfileId`, `receptionCaseId` khi đã có case và `reason`; đây là dữ liệu audit. Quyền thực thi đến từ service JWT/scope của Receptionist Service, không đến từ các ID trong payload.

Internal service token profile:

- RS256; header có `kid`; claims bắt buộc `iss`, `sub`, `aud`, `scope`, `iat`, `exp`, `jti`.
- `iss/sub` là caller service, `aud` là target service; TTL tối đa 300 giây, skew 30 giây.
- Mỗi service có key pair riêng; không dùng shared admin secret hoặc header service-name không ký.

Scope allowlist bắt buộc:

| Caller service | Scopes được cấp |
|---|---|
| `reception-service` | `appointment:availability:read`, `appointment:booking:write`, `appointment:search`, `appointment:read`, `appointment:admission:read`, `appointment:check-in`, `appointment:no-show`; tùy phân quyền vận hành mới cấp `appointment:cutoff-override` |
| `billing-service` | `appointment:billing-context:read` |
| `medical-record-service` | `appointment:read`, `appointment:complete` |

Appointment gRPC chỉ listen internal network, không route qua Kong. Caller identity và scope phải đồng thời đúng allowlist; có scope hợp lệ nhưng `sub` không đúng service vẫn bị từ chối.

---

## 3. Domain và database

### 3.1 Enums

| Enum | Giá trị |
|---|---|
| `AppointmentSource` | `PATIENT_SELF`, `RECEPTION_ON_BEHALF`, `WALK_IN` |
| `DoctorSelectionMode` | `SYSTEM_ASSIGNED`, `PATIENT_SELECTED` |
| `DoctorConsultationRank` | `BASIC`, `SPECIALIST_I`, `SPECIALIST_II`, `MASTER`, `ASSOC_PROFESSOR`, `PROFESSOR`, `EXPERT` |
| `AppointmentStatus` | `BOOKED`, `RESCHEDULE_REQUIRED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `SlotReservationStatus` | `HELD`, `BOOKED`, `FULFILLED`, `RELEASED`, `EXPIRED` |
| `AppointmentRevisionReason` | `INITIAL_BOOKING`, `PATIENT_RESCHEDULE`, `RECEPTION_RESCHEDULE`, `DOCTOR_UNAVAILABLE_REMEDIATION` |
| `CancellationReasonCode` | `PATIENT_REQUEST`, `RECEPTION_REQUEST`, `DOCTOR_UNAVAILABLE`, `OTHER` |
| `ActorType` | `ACCOUNT`, `SERVICE`, `SYSTEM` |
| `OutboxStatus` | `PENDING`, `PROCESSING`, `PUBLISHED`, `FAILED` |
| `ReminderStatus` | `PENDING`, `DISPATCHED`, `CANCELLED` |

### 3.2 Entity `Appointment`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID | PK, immutable |
| `confirmationCode` | varchar(14) | UNIQUE; `APT-` + 10 Crockford Base32 chars từ CSPRNG |
| `patientId` | UUID | External Patient ID, immutable |
| `patientAuthAccountId` | UUID nullable | Technical owner reference; chỉ null → UUID qua Patient resolution/link event, không đổi sang account khác |
| `source` | `AppointmentSource` | Immutable; nguồn booking ban đầu |
| `externalBookingReferenceId` | UUID nullable | Stable Reception booking/walk-in operation reference; external, không FK; bắt buộc cho non-self source |
| `medicalServiceId` | UUID | External Catalog ID, immutable; đổi service = cancel + book mới |
| `status` | enum | Default `BOOKED`; theo state machine |
| `checkedInAt` | timestamptz nullable | Set một lần khi check-in |
| `checkInReceptionCaseId` | UUID nullable | External Reception case used for successful check-in; không FK |
| `checkInAdmissionAttemptId` | UUID nullable | UNIQUE khi khác null; stable Admission attempt reference |
| `completedAt` | timestamptz nullable | Chỉ `COMPLETED` |
| `completionReferenceId` | UUID nullable | UNIQUE khi khác null; external Medical Record ID |
| `cancelledAt` | timestamptz nullable | Chỉ `CANCELLED` |
| `cancellationReasonCode` | enum nullable | Bắt buộc khi cancel |
| `cancellationNote` | varchar(500) nullable | Internal; `OTHER` bắt buộc note |
| `noShowAt` | timestamptz nullable | Chỉ `NO_SHOW` |
| `version` | integer | Default 1, optimistic lock |
| actor/timestamps | fields | created/updated actor type/id, caller service, optional receptionist profile, `createdAt`, `updatedAt` |

DB CHECK phải buộc timestamp/reference khớp status: `CHECKED_IN` cần `checkedInAt`, Reception case và Admission attempt; `COMPLETED` giữ các check-in field và cần completion time/reference; `CANCELLED` cần cancellation time/reason; `NO_SHOW` cần `noShowAt`; các field terminal phải null ở status không tương ứng.

### 3.3 Entity `AppointmentRevision`

Revision immutable; reschedule luôn insert revision mới.

| Nhóm | Fields bắt buộc |
|---|---|
| Identity | `id`, `appointmentId`, `revisionNumber`, `slotReservationId` |
| Schedule | `doctorId`, `startAt`, `endAt`, `businessTimezone`, `selectionMode` |
| Doctor snapshot | display name, professional title nullable, actual rank, doctor version |
| Service snapshot | service code/name/kind, specialty ID, service version, duration minutes |
| Pricing snapshot | rank policy, charged rank, base price ID/amount, surcharge price ID nullable/amount, total, currency |
| Audit | revision reason, created actor type/id, `createdAt` |

Constraints:

- UNIQUE `(appointmentId, revisionNumber)` và UNIQUE `slotReservationId`.
- `startAt < endAt`; duration `5..480`; service kind `CONSULTATION`; currency `VND`.
- `estimatedTotal = baseAmount + rankSurchargeAmount`; money dùng `bigint`, không float.

### 3.4 Entity `AppointmentCurrentRevision`

| Field | Rule |
|---|---|
| `appointmentId` | PK, FK local → Appointment |
| `revisionId` | UNIQUE; composite FK `(appointmentId, revisionId)` → Revision |
| `updatedAt` | DB timestamp |

Bảng pointer mutable này tránh circular FK và giữ Revision immutable.

### 3.5 Entity `SlotReservation`

| Nhóm | Fields |
|---|---|
| Identity/owner | `id`, `patientId`, nullable `patientAuthAccountId`, `patientVersionSnapshot`, `source`, created actor/service/staff context |
| Purpose | `medicalServiceId`, `selectionMode`, nullable `rescheduleAppointmentId`, nullable `appointmentId` |
| Doctor/service/price | Cùng snapshot fields cần để tạo Revision |
| Time/state | `startAt`, `endAt`, `status`, `expiresAt`, nullable `consumedAt`, nullable `releasedAt`, `version` |
| Timestamps | `createdAt`, `updatedAt` |

State constraints:

- `HELD`: chưa có `appointmentId/consumedAt/releasedAt`.
- `BOOKED`: có `appointmentId/consumedAt`, chưa có `releasedAt`.
- `FULFILLED`: đã từng `BOOKED`, reservation hoàn tất.
- `RELEASED`: có `releasedAt`; có thể là hold chưa consume hoặc booking lịch sử.
- `EXPIRED`: chưa consume, có `releasedAt`, `expiresAt <= transactionNow`.
- Một appointment có nhiều reservation lịch sử qua reschedule; `appointmentId` không unique.

### 3.6 Technical records

| Record | Mục đích/constraint chính |
|---|---|
| `AppointmentStatusHistory` | Append-only transition history |
| `AppointmentIdempotencyRecord` | UNIQUE `(callerType, callerId, operation, idempotencyKey)`; request hash + saved response; retention 24 giờ |
| `AppointmentAuditLog` | Append-only; actor, resource, changed fields, reason, request/correlation ID |
| `AppointmentOutboxEvent` | Event/payload/status/attempt/nextAttempt/lease; publish atomic với domain write |
| `AppointmentProcessedEvent` | UNIQUE `eventId`; inbound dedupe; retention 90 ngày |
| `AppointmentReminderDispatch` | UNIQUE `(revisionId, offsetMinutes)`; due/status; reminder 1440/120 phút |

### 3.7 Database constraints và indexes bắt buộc

- PostgreSQL `btree_gist` và partial exclusion constraint trên `(doctorId, tstzrange(startAt,endAt,'[)'))` khi status `HELD/BOOKED`.
- Exclusion constraint tương tự theo `patientId` để cấm một patient giữ/đặt hai lịch chồng giờ.
- Partial unique `rescheduleAppointmentId` khi reservation còn `HELD`: tối đa một active reschedule hold/appointment.
- Partial UNIQUE `(source, externalBookingReferenceId)` khi reference khác null; retry cùng business reference phải resolve về cùng logical appointment, không tạo lịch thứ hai.
- `patientAuthAccountId` không có unique constraint vì một account/patient có nhiều appointment; update từ link event chỉ được null → expected account.
- CHECK: `PATIENT_SELF` bắt buộc có `patientAuthAccountId` và không có external booking reference; hai source từ Reception bắt buộc có `externalBookingReferenceId`.
- Index: appointment owner/status; patient/status; doctor/time; reservation status/expiry; outbox status/next attempt; reminder status/due.
- Local FK cho Appointment–Revision–CurrentPointer–Reservation–History; `ON DELETE RESTRICT`; MVP không hard-delete domain history.
- Constraint DB là correctness boundary; application pre-check không thay thế được constraint.

---

## 4. State machine và business logic

### 4.1 Appointment lifecycle

| From | Action | To | Caller/điều kiện |
|---|---|---|---|
| — | Confirm hold | `BOOKED` | Patient hoặc Reception; đúng owner/source của active hold |
| `BOOKED` | Reschedule | `BOOKED` | Patient trước cutoff; Reception theo staff policy |
| `BOOKED` | Doctor unavailable | `RESCHEDULE_REQUIRED` | Reconciliation |
| `RESCHEDULE_REQUIRED` | Reschedule | `BOOKED` | Patient hoặc Reception; miễn cutoff |
| `BOOKED` | Check-in | `CHECKED_IN` | Reception; trong window |
| `BOOKED` | Cancel | `CANCELLED` | Patient trước cutoff; Reception theo staff policy |
| `RESCHEDULE_REQUIRED` | Cancel | `CANCELLED` | Patient hoặc Reception; miễn cutoff |
| `BOOKED` | No-show | `NO_SHOW` | Reception; sau check-in close |
| `CHECKED_IN` | Complete | `COMPLETED` | Medical Record Service |

`COMPLETED`, `CANCELLED`, `NO_SHOW` là terminal. Không cancel/undo sau `CHECKED_IN` trong MVP.

### 4.2 Reservation lifecycle

| From | Action | To |
|---|---|---|
| — | Create hold | `HELD` |
| `HELD` | Confirm | `BOOKED` |
| `HELD` | Release | `RELEASED` |
| `HELD` | TTL reached | `EXPIRED` |
| `BOOKED` | Complete | `FULFILLED` |
| `BOOKED` | Cancel/reschedule/no-show/doctor unavailable | `RELEASED` |

### 4.3 Availability algorithm

1. Resolve Catalog service: active, booking enabled, kind `CONSULTATION`, có specialty, duration và active base price.
2. Resolve Doctor candidates theo specialty/rank policy.
3. Lấy effective working intervals từ Doctor; `bookingOccupancyApplied` phải là false.
4. Duration Catalog phải chia hết Doctor `slotDurationMinutes`; sinh interval half-open `[startAt,endAt)`.
5. Loại candidate ngoài source-specific lead time/horizon hoặc overlap local `HELD` chưa hết hạn/`BOOKED`.
6. Resolve pricing quote và trả result advisory; search không tạo hold.

Selection:

- `PATIENT_SELECTED`: request hold bắt buộc `doctorId`; quote theo actual rank.
- `SYSTEM_ASSIGNED`: request cấm `doctorId/rank`; server chọn concrete doctor theo rank order ở mục 3.1 rồi `doctorId ASC`.
- System-assigned luôn `chargedRank=BASIC`, surcharge 0, kể cả khi hệ thống phải phân doctor rank cao hơn.
- Mỗi system-assigned start time chỉ trả một concrete doctor.

Pricing:

- `BASIC_INCLUDED`: patient-selected chỉ chọn doctor `BASIC`.
- `RANK_UPGRADE_ALLOWED`: rank `BASIC` surcharge 0; rank cao hơn cần active surcharge đúng rank.
- Policy `NOT_REQUIRED` không bookable trong Appointment MVP.
- Hold khóa quote đến expiry; confirm copy snapshot, không resolve giá lại.
- Reschedule tạo hold/quote mới; revision cũ không đổi.
- Estimated price không phải invoice/payment truth.

### 4.4 Time policy

| Policy | MVP |
|---|---:|
| Hold TTL | 5 phút |
| Availability range/request | Tối đa 31 ngày |
| Booking horizon | 90 ngày |
| Minimum lead — self/reception đặt hộ | 120 phút |
| Minimum lead — walk-in | 0 phút; chỉ cùng business date và `startAt >= transactionNow` |
| Cancel/reschedule cutoff | 120 phút trước start |
| Check-in open | 120 phút trước start |
| Late threshold | 30 phút sau start |
| Check-in close | 30 phút sau scheduled end |
| Max active holds/patient | 3 |

`transactionNow` lấy từ DB. Timestamp API là ISO-8601 UTC; không nhận local datetime thiếu offset.

### 4.5 Reschedule rules

- Tạo reschedule hold trước, với cùng patient và `medicalServiceId`.
- Khi appointment còn `BOOKED`, hold mới không được overlap current interval; đổi doctor cùng giờ phải cancel + book mới trong MVP.
- Khi `RESCHEDULE_REQUIRED`, reservation cũ đã release nên có thể chọn lại cùng giờ với doctor khác.
- Transaction reschedule lock appointment + old/new reservation, verify `expectedVersion`, release old, consume new, insert revision, đổi current pointer và ghi outbox/audit.
- Version conflict hoặc hold hết hạn không làm thay đổi slot cũ/new hold.
- Cancel/check-in/no-show phải release active reschedule hold để không giữ chỗ mồ côi.

### 4.6 Booking channel và staff policy

Ba nguồn tạo lịch dùng cùng `SlotReservation`, exclusion constraint và state machine; không tạo bảng/lifecycle riêng cho walk-in:

| Source | Khởi tạo bởi | Patient account | Quy tắc |
|---|---|---|---|
| `PATIENT_SELF` | Public REST | Bắt buộc đã link | Owner lấy từ JWT; tuân lead time/cutoff |
| `RECEPTION_ON_BEHALF` | Reception gRPC | Có thể đã hoặc chưa link | Dành cho lễ tân đặt lịch thay bệnh nhân đã xác định |
| `WALK_IN` | Reception gRPC | Có thể null | Dành cho bệnh nhân đến trực tiếp; vẫn phải có `patientId`, doctor, service và hold |

- Walk-in không có nghĩa là bỏ qua Patient eligibility, Doctor availability, Catalog pricing, occupancy hoặc payment/admission policy.
- Walk-in chỉ chọn slot còn trống trong ngày, có `startAt >= transactionNow`; không backdate appointment và không chen vào slot đang bị giữ/đặt.
- Reception phải tạo/tìm hồ sơ Patient trước, sau đó mới gọi Appointment bằng `patientId`; Appointment không tạo Patient profile.
- Staff reschedule/cancel cần `performedByAccountId`, `receptionistProfileId`, reason code/note, stable `commandId` và `expectedVersion`.
- Mặc định staff cũng tuân cutoff. Chỉ request có `overrideCutoff=true` **và** service token có scope `appointment:cutoff-override` mới được bỏ qua cutoff; bắt buộc reason note. Override không được bỏ qua state machine, patient/doctor conflict, service eligibility hoặc DB constraint.
- Reception chịu trách nhiệm xác thực lễ tân đang `ACTIVE` và có quyền vận hành trước khi gọi; Appointment kiểm tra service identity/scope và ghi actor context, không query Reception DB.
- Không cho đổi `patientId`, `medicalServiceId` hoặc `source` khi reschedule. Muốn đổi patient/service phải cancel rồi tạo appointment mới.
- Không có public/Admin endpoint đặt lịch trực tiếp; nếu sau này Admin hỗ trợ vận hành tại quầy thì vẫn đi qua Reception workflow và staff audit contract.

### 4.7 Phối hợp payment và Admission

Appointment chỉ cung cấp booking/pricing context; luồng tài chính và tiếp nhận diễn ra như sau:

1. Appointment tạo `BOOKED` và phát `appointment.booked`; booking không đồng nghĩa đã thanh toán.
2. Thanh toán online: sau booking, Patient client gọi public Billing checkout qua Kong bằng `appointmentId`; Billing gọi `GetAppointmentBillingContext`. Thanh toán tại quầy: Reception gọi Billing `CreateOrGetInvoice` bằng `appointmentId + revisionId`. Cả hai cách đều tạo invoice/payment trong Billing, không trong Appointment.
3. Billing sở hữu invoice/payment/refund và trả payment decision authoritative cho Reception.
4. Reception chỉ tiếp tục Admission sau khi đối chiếu Patient và Billing policy đạt yêu cầu; sau đó mở Medical Record, gọi `CheckInAppointment`, rồi tạo Queue ticket.
5. Appointment tự kiểm tra lifecycle, patient, version, time window và Doctor eligibility; không gọi Billing và không tự kết luận đã thanh toán. `receptionCaseId`/`admissionAttemptId` chỉ được lưu làm external audit reference.
6. Reschedule/cancel/no-show phát event gắn appointment/revision/version. Billing reconcile invoice/adjustment/refund theo policy của Billing; Appointment không rollback hoặc sửa financial state.

Vì vậy lỗi Billing không làm mất booking đã commit, nhưng có thể làm Admission dừng ở `AWAITING_PAYMENT`/retry trong Reception Saga. Queue luôn được tạo sau check-in thành công, không phải khi vừa booking.

MVP chốt **không tự hủy appointment chỉ vì chưa thanh toán**. Appointment vẫn `BOOKED`; đến Admission, Reception bắt buộc hỏi Billing và chặn tiếp tục nếu payment policy chưa đạt. Nếu sau này có payment deadline/auto-cancel, đó là policy mới cần ADR và command contract riêng, không được suy ra từ timeout hoặc event delivery.

---

## 5. Public REST contract

### 5.1 Quy ước

- Public business endpoints trong mục này chỉ dành cho `PATIENT_SELF`. Receptionist không dùng JWT bệnh nhân và không gọi các endpoint này thay bệnh nhân; staff flow dùng gRPC mục 6.
- Kong route `/api/appointments`, `strip_path=true`, upstream `http://appointment-service:5007/appointments`.
- Nest local controller prefix `/appointments`.
- JSON camelCase; UUID string; tiền là integer minor unit + currency.
- Mọi POST cần `Idempotency-Key` UUID v4; mutation trên appointment cần `expectedVersion`.
- Mutation đã commit lưu response để retry cùng key không tạo duplicate. Failure trước commit không giữ key.
- Error envelope: `{ error: { code, message, details, requestId } }`.

### 5.2 Endpoint summary

| Method | Path | Request chính | Kết quả |
|---|---|---|---|
| GET | `/health` | — | Liveness |
| GET | `/ready` | — | DB/schema/config readiness |
| GET | `/api/appointments/availability` | medicalServiceId, from/to, selectionMode, optional doctor/rank, cursor/limit | Concrete slot + quote |
| POST | `/api/appointments/slot-holds` | medicalServiceId, startAt, selectionMode, conditional doctorId/rescheduleAppointmentId | `HELD`, concrete doctor, quote, expiry |
| POST | `/api/appointments/slot-holds/{id}/release` | `{}` | Current reservation state |
| POST | `/api/appointments` | `holdId` | `BOOKED` appointment |
| GET | `/api/appointments/me` | status/from/to/cursor/limit | Own appointments |
| GET | `/api/appointments/{id}` | — | Own current projection |
| POST | `/api/appointments/{id}/reschedule` | `newHoldId`, `expectedVersion` | New current revision |
| POST | `/api/appointments/{id}/cancel` | `expectedVersion`, reasonCode, optional note | `CANCELLED` |

Availability validation:

- `from < to`, range ≤ 31 ngày, không vượt horizon; limit default 20/max 100.
- `SYSTEM_ASSIGNED` reject doctor/rank query.
- `PATIENT_SELECTED` cho phép filter doctor hoặc rank; doctor/rank không được mâu thuẫn.
- Kết quả chỉ advisory; client phải tạo hold.

Create hold flow:

1. Resolve Patient eligibility từ JWT account.
2. Resolve Catalog baseline.
3. Resolve/list Doctor và exact interval eligibility.
4. Resolve final Catalog quote cùng service version.
5. Trong transaction: advisory lock theo patient, expire relevant stale hold, enforce max hold/one reschedule hold, insert reservation.
6. Doctor conflict → `SLOT_NO_LONGER_AVAILABLE`; patient overlap → `PATIENT_TIME_CONFLICT`.

Confirm flow:

- Hold phải có source `PATIENT_SELF`, created actor account = `JWT.sub`, status `HELD`, chưa hết hạn, không phải reschedule hold.
- Cùng transaction tạo Appointment, Revision 1, current pointer, status history, reminder rows, audit/outbox/idempotency; reservation chuyển `BOOKED`.
- Không tạo invoice, payment, Reception Case, Medical Record hoặc Queue ticket.

Public response chỉ dùng current snapshot. MVP không expose full revision history hoặc internal audit/note.

### 5.3 Error catalog

| HTTP | Code | Ý nghĩa |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | DTO/time/enum invalid |
| 401/403 | `AUTHENTICATION_REQUIRED`, `FORBIDDEN` | Token/role/scope invalid |
| 404 | `APPOINTMENT_NOT_FOUND`, `HOLD_NOT_FOUND` | Missing hoặc không thuộc owner |
| 409 | `SLOT_NO_LONGER_AVAILABLE`, `PATIENT_TIME_CONFLICT` | Exclusion conflict |
| 409 | `HOLD_EXPIRED`, `HOLD_ALREADY_CONSUMED` | Hold state invalid |
| 409 | `HOLD_CALLER_MISMATCH`, `BOOKING_REFERENCE_CONFLICT` | Sai booking channel/owner hoặc business reference đã dùng với payload khác |
| 409 | `VERSION_CONFLICT`, `IDEMPOTENCY_KEY_REUSED` | Concurrency/idempotency conflict |
| 409 | `DEPENDENCY_STATE_CHANGED` | Catalog service version đổi liên tục trong resolution; retry request |
| 409 | `INVALID_STATE_TRANSITION` | State không cho phép action |
| 409 | `CANCELLATION_CUTOFF_PASSED`, `RESCHEDULE_CUTOFF_PASSED` | Quá cutoff |
| 409 | `CHECK_IN_WINDOW_NOT_OPEN`, `CHECK_IN_WINDOW_CLOSED` | Ngoài check-in window |
| 409 | `ACTIVE_RESCHEDULE_HOLD_EXISTS` | Đã có reschedule hold còn hiệu lực |
| 409 | `REVISION_NOT_CURRENT` | Billing/command đang dùng revision cũ |
| 422 | `PATIENT_NOT_ELIGIBLE`, `SERVICE_NOT_BOOKABLE`, `DOCTOR_NOT_ELIGIBLE` | Downstream business validation fail |
| 422 | `DOCTOR_RANK_NOT_ALLOWED` | Rank trái Catalog policy |
| 429 | `ACTIVE_HOLD_LIMIT_REACHED`, `RATE_LIMIT_EXCEEDED` | Abuse/rate protection |
| 503 | `DEPENDENCY_UNAVAILABLE`, `DEPENDENCY_CONTRACT_MISMATCH` | Required downstream unavailable/invalid |

---

## 6. Internal gRPC contracts

Canonical proto nằm dưới `services/contracts/proto/maternal/.../v1`; generated TypeScript nằm ở `services/libs/contracts/src/generated/` và không sửa tay.

### 6.1 Appointment server

Package `maternal.appointment.v1`, service `AppointmentInternalService`, port `6007`:

| RPC | Caller/scope | Input chính | Output/hành vi |
|---|---|---|---|
| `SearchBookableSlotsForPatient` | Reception / `appointment:availability:read` | patientId, source, service, range, selection mode/filter | Concrete slots + quote; advisory, không giữ chỗ |
| `CreateSlotHoldOnBehalf` | Reception / `appointment:booking:write` | new booking: patient/source/service; reschedule: appointmentId; cùng start/selection/optional doctor, staff + command context | Validate Patient/Doctor/Catalog; tạo `HELD` |
| `ReleaseSlotHoldOnBehalf` | Reception / `appointment:booking:write` | holdId, expected patient, staff + command context | Release đúng Reception-created hold; idempotent |
| `ConfirmAppointmentOnBehalf` | Reception / `appointment:booking:write` | holdId, externalBookingReferenceId, staff + command context | Consume đúng initial Reception hold; trả `BOOKED` |
| `StaffRescheduleAppointment` | Reception / `appointment:booking:write` | appointmentId, newHoldId, expectedVersion, staff reason, override flag, command context | New revision; override cần scope riêng |
| `StaffCancelAppointment` | Reception / `appointment:booking:write` | appointmentId, expectedPatientId/version, reason, override flag, command context | `BOOKED/RESCHEDULE_REQUIRED → CANCELLED` |
| `SearchAppointments` | Reception / `appointment:search` | exact confirmation code hoặc patientId + range ≤31 ngày | Minimum internal projection; không list-all |
| `GetAppointment` | Reception/Medical / `appointment:read` | appointmentId | Current internal projection |
| `GetAdmissionEligibility` | Reception / `appointment:admission:read` | appointmentId, expectedPatientId, receptionCaseId | eligible/reasons, schedule, doctor/service, estimated price |
| `CheckInAppointment` | Reception / `appointment:check-in` | expected patient/version, command ID, receptionCaseId, admissionAttemptId | `BOOKED → CHECKED_IN`; lưu external audit refs |
| `MarkAppointmentNoShow` | Reception / `appointment:no-show` | expected patient/version, staff + command context | `BOOKED → NO_SHOW` sau close |
| `GetAppointmentBillingContext` | Billing / `appointment:billing-context:read` | appointmentId, optional expectedRevisionId | Status/version, source, patient, current revision và immutable pricing snapshot |
| `CompleteAppointment` | Medical / `appointment:complete` | expected patient/version, command context, completionReferenceId | `CHECKED_IN → COMPLETED` |

Eligibility reason enum: `STATUS_NOT_BOOKED`, `PATIENT_MISMATCH`, `TOO_EARLY`, `CHECK_IN_WINDOW_CLOSED`, `DOCTOR_NOT_ELIGIBLE`.

Check-in không tin caller đã gọi eligibility: Appointment tự revalidate patient context, window và exact Doctor eligibility. Doctor timeout trả `UNAVAILABLE`; Doctor chắc chắn không eligible chuyển appointment sang `RESCHEDULE_REQUIRED` và không check-in.

Quy tắc cho Reception booking RPC:

- Với initial booking, `source` chỉ nhận `RECEPTION_ON_BEHALF` hoặc `WALK_IN`; reject `PATIENT_SELF` để Reception không giả user flow. Với reschedule, caller không truyền source/patient/service; server derive từ appointment và giữ source ban đầu.
- Search/hold luôn gọi Patient eligibility theo `patientId`; hold/confirm giữ nguyên source và staff context.
- Initial hold do account tạo không được confirm bởi Reception và initial hold do Reception tạo không được confirm qua public REST. Reschedule hold phải được consume bởi đúng actor channel đã tạo nó.
- `externalBookingReferenceId` phải ổn định theo Reception case/walk-in operation. Cùng reference và cùng request hash trả resource cũ; cùng reference nhưng payload khác trả conflict.
- Walk-in vẫn tạo appointment `BOOKED`; quy trình thanh toán, mở medical record, check-in và queue tiếp tục do Reception Saga điều phối.
- Staff change không được sửa appointment đã `CHECKED_IN` hoặc terminal. `overrideCutoff` chỉ xử lý cutoff, không phải quyền overbook hay sửa lịch sử.

Billing context là read model từ appointment hiện tại, không phải invoice. Output tối thiểu gồm `appointmentId`, `appointmentVersion`, `revisionId`, `revisionNumber`, `patientId`, `source`, `status`, `medicalServiceId`, doctor/rank snapshot, service snapshot, `baseAmount`, `rankSurchargeAmount`, `estimatedTotal`, `currency`, schedule và `snapshotCreatedAt`. Billing phải bind invoice với `appointmentId + revisionId`; nếu `expectedRevisionId` không còn current thì trả `FAILED_PRECONDITION/REVISION_NOT_CURRENT` kèm current revision ID.

### 6.2 Canonical message và validation

| Message | Fields/constraint bắt buộc |
|---|---|
| `CommandContext` | `commandId`, `requestId`, `correlationId`; UUID hợp lệ, retry giữ nguyên `commandId` |
| `StaffContext` | `performedByAccountId`, `receptionistProfileId`, optional `receptionCaseId`, reason code/note; reason note 1..500 khi override/`OTHER` |
| `SlotSearchCriteria` | patient, service, UTC from/to ≤31 ngày, selection mode, optional doctor/rank, page size ≤100 |
| `SlotOffer` | doctor snapshot, service/version, `[startAt,endAt)`, selection mode, pricing quote, currency; chỉ advisory |
| `HoldProjection` | hold ID/version/status/source/patient, concrete doctor/service/pricing snapshot, expiresAt |
| `AppointmentProjection` | appointment ID/code/version/source/status/patient, current revision/schedule/doctor/service/pricing snapshot |

- UUID dùng canonical lowercase khi persist/compare; server không dựa vào client casing.
- `expectedPatientId` bắt buộc trên staff mutation/check-in/no-show để ngăn thao tác nhầm case.
- Request mutation không nhận price, doctor rank/name hoặc service duration từ caller; các snapshot này phải do Appointment resolve từ owner services.
- Staff search response không trả `patientAuthAccountId`, Patient PII, internal audit hoặc cancellation note. Billing projection không trả staff context.
- Pagination order ổn định: `(startAt ASC, appointmentId ASC)` hoặc `(startAt ASC, doctorId ASC)` cho slot; cursor chứa sort tuple đã ký/opaque.

### 6.3 Required downstream contracts

#### Patient — `maternal.patient.v1.PatientInternalService`

Hai RPC bắt buộc:

| RPC | Dùng cho | Input | Output tối thiểu |
|---|---|---|---|
| `ResolvePatientForBookingByAccount` | Public self-service | authAccountId | patientId, linked authAccountId, profile status, eligibility, missing fields, version |
| `GetPatientBookingEligibility` | Reception/walk-in | patientId | exists, nullable linked authAccountId, profile status, eligibility, missing fields, version |

Không trả PII không cần thiết. Appointment chỉ nhận `linked_auth_account_id` từ Patient; Reception không được tự gán ownership account.

#### Doctor — `maternal.doctor.v1.DoctorInternalService`

| RPC | Input | Output tối thiểu |
|---|---|---|
| `ListBookingCandidates` | specialtyId, optional rank, cursor/pageSize | doctor ID, display/title, rank, version |
| `GetEffectiveAvailability` | doctorIds ≤50, from/to ≤31 ngày | intervals + slotDuration + timezone + `bookingOccupancyApplied=false` |
| `CheckBookingEligibility` | doctorId, specialtyId, start/end | eligible/reasons, status/specialty/availability, slotDuration, display/rank/version, occupancy false |

#### Catalog — `maternal.catalog.v1.CatalogInternalService`

`ResolveBookableConsultation` nhận service ID, optional doctor rank, optional expected service version, time; trả:

- service ID/code/name/kind/status/booking flag;
- specialty ID, duration, rank-selection policy, service version;
- base price ID/amount, optional surcharge price ID/amount, currency.

Final quote phải cùng service version/duration/specialty/policy với baseline dùng tính interval. Version đổi giữa hai lần resolve thì Appointment restart resolution một lần; tiếp tục đổi thì trả transient conflict, không trộn snapshot.

Appointment gọi downstream bằng service JWT riêng, không forward user token:

| Target | Audience | Scope tối thiểu |
|---|---|---|
| Patient | `patient-service` | `patient:eligibility:read` |
| Doctor | `doctor-service` | `doctor:internal:read` |
| Catalog | `catalog-service` | `catalog:booking:resolve` |

Patient/Doctor giữ scope đã có trong đặc tả hiện hành; Catalog phải bổ sung scope canonical ở trên. Nếu provider hiện còn REST, adapter tạm thời không được đặt trong Appointment core và không được coi là contract production cuối cùng.

### 6.4 Proto và command conventions

- Proto dùng package/version độc lập theo bounded context; không import entity/database model.
- Tất cả command có `command_id` UUID, `request_id`, `correlation_id`; command retry giữ nguyên `command_id`.
- Timestamp dùng protobuf `Timestamp`; money dùng `int64` minor unit + ISO currency; pagination dùng opaque cursor.
- Optional scalar phải dùng presence-aware field/`optional`; không dùng empty string/zero để thay null.
- Mọi response mutation trả resource ID, state/version hiện tại và `replayed` để caller phân biệt idempotent replay khi cần log.
- Breaking change tạo package `v2`; chỉ thêm field backward-compatible trong `v1`.

### 6.5 Failure policy

- Unary gRPC deadline 1 giây/call; total public dependency budget 3 giây.
- Retry read/idempotent call tối đa một lần với jitter khi lỗi transient; không retry validation error.
- Không REST fallback, không query DB service khác, không fake/mocked success trong production.
- Provider chưa triển khai contract → Appointment vẫn expose API nhưng capability liên quan trả `503`.
- `int64` money generate thành string ở TypeScript boundary, parse bằng `bigint` để tránh mất chính xác.

Canonical mapping: validation → `INVALID_ARGUMENT`; auth → `UNAUTHENTICATED/PERMISSION_DENIED`; missing → `NOT_FOUND`; version/slot/idempotency conflict → `ABORTED` hoặc `ALREADY_EXISTS` theo error detail; invalid lifecycle/cutoff/revision → `FAILED_PRECONDITION`; dependency timeout/unavailable → `UNAVAILABLE`; unexpected error → `INTERNAL`. Mọi non-success trả typed error detail chứa stable domain code và request ID; caller không parse message text.

---

## 7. Consistency, events và recovery

### 7.1 Transaction boundaries

| Operation | Phải cùng local DB transaction |
|---|---|
| Create hold | idempotency + stale expiry + reservation insert |
| Confirm | appointment + revision + pointer + reservation + reminders + history + audit + outbox |
| Reschedule | old/new reservation + revision + pointer + version + reminders + history/audit/outbox |
| Cancel/no-show | appointment + reservation/reschedule-hold release + reminders + history/audit/outbox |
| Check-in | appointment/version + reschedule-hold release + reminders + history/audit/outbox |
| Complete | appointment + reservation fulfilled + history/audit/outbox |
| Doctor reconciliation | appointment `RESCHEDULE_REQUIRED` + release + reminders + history/audit/outbox |
| Patient account linked | null ownership update + audit + processed-event dedupe/conflict record |

External RPC luôn chạy trước transaction; transaction recheck local state/version. Không giữ DB lock trong lúc gọi mạng.

### 7.2 Events

RabbitMQ baseline:

- exchange `maternal.domain.events.v1`, DLX `maternal.domain.events.dlx.v1`;
- persistent message, publisher confirm, consumer manual ACK, at-least-once;
- inbound queues `appointment-service.doctor-events.v1` và `appointment-service.patient-events.v1`;
- retry tối đa 10 lần rồi DLQ; consumer dedupe bằng `eventId`.

Outbound event tối thiểu:

- `appointment.booked`, `appointment.rescheduled`, `appointment.reschedule_required`;
- `appointment.cancelled`, `appointment.checked_in`, `appointment.completed`, `appointment.no_show`;
- `appointment.reminder_due` ở 24 giờ và 2 giờ trước current start.

Mọi lifecycle event chứa tối thiểu `eventId`, `eventType`, `occurredAt`, `aggregateId=appointmentId`, `aggregateVersion`, `correlationId`, `source`, `patientId`, current `revisionId`, status và schedule. Event cần cho Billing có thêm pricing totals/currency nhưng không chứa phone, email, national ID, address, note tự do hoặc clinical data.

Consumer expectation:

| Consumer | Events | Mục đích; không chuyển ownership |
|---|---|---|
| Billing | booked, rescheduled, reschedule_required, cancelled, checked_in, completed, no_show | Reconcile/void/refund/adjust financial state theo Billing policy; khi cần gọi `GetAppointmentBillingContext`. Event không tự chứng minh đã thanh toán |
| Notification | booked, rescheduled, reschedule_required, cancelled, reminder_due | Gửi thông báo; Appointment không theo dõi delivery state |
| Reception/operations | reschedule_required, cancelled | Cập nhật case đang xử lý/manual workflow nếu có |

Inbound Doctor events:

- `doctor.status_changed`, `doctor.specialties_changed`, `doctor.schedule_changed`, `doctor.availability_changed`.
- Event chỉ là trigger. Appointment gọi current Doctor eligibility trước khi transition; không áp dụng old event payload trực tiếp.
- Duplicate `eventId` no-op. Event version cũ nhưng ID mới vẫn có thể trigger revalidation range để không bỏ sót thay đổi.
- Safety reconciliation scan mỗi 15 phút cho appointment tương lai trong horizon 90 ngày.

Inbound Patient event:

- `patient.account_linked` gồm `patientId`, `authAccountId`, `patientVersion`, `eventId`.
- Consumer chỉ gắn ownership cho Appointment và active SlotReservation có cùng `patientId` và `patientAuthAccountId IS NULL`, ghi audit; không đổi source/revision/pricing.
- Nếu appointment đã trỏ account khác, không overwrite; ACK sau khi lưu conflict record/alert để manual review, tránh poison-message loop.
- Event duplicate no-op qua `AppointmentProcessedEvent`. Safety reconciliation có thể gọi Patient khi người dùng không thấy lịch đã link, nhưng không match bằng PII.

### 7.3 Recovery

- Outbox publish fail không rollback booking; worker retry và alert backlog.
- Crash sau commit/trước response: caller retry cùng idempotency key hoặc read resource.
- Hold expiry worker chạy mỗi 30 giây; access path cũng expire stale hold trước insert/confirm.
- Reminder chỉ dispatch nếu revision còn current và appointment `BOOKED`; reschedule/cancel/check-in/no-show/reschedule-required cancel reminder pending.
- Doctor unavailable: `BOOKED → RESCHEDULE_REQUIRED`, release reservation, không tự đổi bác sĩ.
- Không có automatic no-show worker; chỉ Reception được mark no-show.
- Billing event delivery thất bại không rollback booking/cancel/reschedule; outbox retry. Reception phải đọc payment authoritative từ Billing trước Admission, không suy ra payment từ trạng thái event.
- Race payment với reschedule/cancel được giải bằng appointment/revision/version trong event và Billing context. Appointment không gọi refund/void; Billing tự áp dụng policy hoặc đưa manual review.

---

## 8. Business rules và acceptance scenarios

### 8.1 Rules bắt buộc

| ID | Rule |
|---|---|
| `APT-BR-001` | Appointment là owner duy nhất của lifecycle, occupancy, hold, bookable slot và check-in state. |
| `APT-BR-002` | Public client không truyền patient owner; account ID và patient ID luôn tách biệt; staff flow nhận patientId nhưng phải resolve lại qua Patient. |
| `APT-BR-003` | Mọi booking có active CONSULTATION service và concrete doctor. |
| `APT-BR-004` | Doctor availability không bao gồm Appointment occupancy. |
| `APT-BR-005` | Hai DB exclusion constraints là bắt buộc; pre-check không đủ chống race. |
| `APT-BR-006` | Search advisory; chỉ hold mới giữ chỗ. |
| `APT-BR-007` | Hold hết hạn không confirm; max 3 active hold/patient. |
| `APT-BR-008` | Confirm/reschedule/cancel/check-in/complete phải atomic và idempotent. |
| `APT-BR-009` | Revision/snapshot immutable; current pointer là phần mutable. |
| `APT-BR-010` | Estimated price không phải payment truth. |
| `APT-BR-011` | Reschedule giữ appointment ID/patient/service, tạo revision và reservation mới. |
| `APT-BR-012` | Patient self-change tuân cutoff; `RESCHEDULE_REQUIRED` miễn cutoff. |
| `APT-BR-013` | Check-in chỉ từ Reception; complete chỉ từ Medical Record; no-show chỉ từ Reception. |
| `APT-BR-014` | Booking không tạo invoice, medical record hoặc queue ticket. |
| `APT-BR-015` | Cross-service reference không có FK và không query shared DB. |
| `APT-BR-016` | Domain event/audit/outbox ghi cùng transaction; consumer phải dedupe. |
| `APT-BR-017` | Doctor change không sửa revision cũ; affected future booking phải reconcile. |
| `APT-BR-018` | Không lưu Patient PII/clinical/payment/queue state trong Appointment DB. |
| `APT-BR-019` | `PATIENT_SELF`, `RECEPTION_ON_BEHALF`, `WALK_IN` dùng chung occupancy/lifecycle; source immutable. |
| `APT-BR-020` | Appointment chưa link account chỉ được staff thao tác; ownership public chỉ được gắn từ Patient contract/event authoritative. |
| `APT-BR-021` | Reception command phải có service scope, staff audit context, expected version khi mutation resource và stable `commandId`; payload staff không tự tạo quyền. |
| `APT-BR-022` | Staff cutoff override cần scope riêng và reason; không override state, eligibility, conflict hoặc DB constraint. |
| `APT-BR-023` | Billing chỉ đọc immutable pricing context/consume event; Appointment không sở hữu invoice, payment, refund hoặc ra lệnh Billing. |

### 8.2 Acceptance scenarios cần được implementation đáp ứng

| Scenario | Expected result |
|---|---|
| Hai request giữ cùng doctor/time | Đúng một hold commit; request kia `SLOT_NO_LONGER_AVAILABLE` |
| Patient giữ hai lịch overlap | Request sau `PATIENT_TIME_CONFLICT` |
| Confirm hold hết hạn | Không tạo appointment; `HOLD_EXPIRED` |
| Response confirm mất sau commit | Retry cùng key trả đúng appointment cũ |
| Patient đọc appointment người khác | `APPOINTMENT_NOT_FOUND` |
| Reschedule success | Old reservation released, new booked, revision/version tăng atomic |
| Reschedule version conflict | Không đổi old/new reservation |
| Cancel trước/sau cutoff | Trước: cancel/release; sau: cutoff error |
| Check-in đúng/ngoài window | Đúng: checked-in một lần; ngoài: explicit window error |
| Doctor bị deactivate/đổi lịch | Future appointment → `RESCHEDULE_REQUIRED`, không silent reassignment |
| Catalog đổi giá sau booking | Revision cũ giữ giá cũ; hold/revision mới dùng giá mới |
| Reception retry check-in/no-show | Một transition logical, không duplicate event |
| Medical retry completion | Một completion; unique completion reference |
| Downstream timeout khi tạo hold | `DEPENDENCY_UNAVAILABLE`, không partial hold/fake data |
| Reception đặt hộ patient đã link | Appointment source `RECEPTION_ON_BEHALF`, owner account lấy từ Patient, staff actor được audit |
| Reception đặt hộ patient chưa link | Booking thành công với nullable account owner; public user chưa thể đọc/mutate |
| Walk-in | Có Patient trước, tạo hold + appointment source `WALK_IN`; vẫn không bỏ qua payment/admission |
| Patient account được link sau | Event gắn null owner đúng patient; event lặp no-op; account conflict không overwrite |
| Reception confirm nhầm self hold | Reject `FAILED_PRECONDITION`; hold không đổi |
| Staff đổi/hủy trước cutoff | Thành công khi scope, version, patient và reason hợp lệ |
| Staff override cutoff thiếu scope/reason | `PERMISSION_DENIED` hoặc `FAILED_PRECONDITION`; appointment không đổi |
| Billing đọc context đúng revision | Nhận immutable pricing snapshot; không nhận payment state |
| Billing đọc expected revision cũ | `REVISION_NOT_CURRENT` kèm current revision ID; không trộn giá hai revision |
| Payment vừa xác nhận nhưng appointment bị hủy | Appointment emit versioned event; Billing reconcile/refund theo policy, không sửa DB Appointment |

Không yêu cầu viết unit-test code hoặc concurrency-test code trong scope hiện tại; bảng trên là acceptance contract để review thủ công/QA sau này. Không được bỏ database constraint chỉ vì hoãn test automation.

---

## 9. Security, audit và NFR

### 9.1 Security/data minimization

- Verify public JWT local bằng JWKS; validate algorithm, signature, issuer, audience, expiry và role.
- Verify service JWT theo audience/scope/caller allowlist.
- Reception booking/change phải audit cả caller service và human staff context; không ghi reason note vào log thường.
- Billing context response chỉ chứa định danh/domain snapshot cần lập hóa đơn, không trả Patient PII.
- DTO allowlist, reject unknown property; không mass assignment.
- Log redact token, PII, request body nhạy cảm và downstream response.
- Confirmation code random; Reception exact search phải rate-limit.
- Audit bắt buộc cho hold lifecycle, booking changes, internal search/read, eligibility/check-in, completion/no-show và authorization denied.

### 9.2 Performance/resilience baseline

| Capability | p95 target |
|---|---:|
| Local own list/detail | ≤ 300 ms |
| Local command sau khi có hold | ≤ 500 ms |
| Availability/create hold | ≤ 1,000 ms |
| Internal local read/command | ≤ 500 ms |
| Internal availability/eligibility có downstream | ≤ 1,000 ms |

- Stateless ngoài PostgreSQL/RabbitMQ; scale horizontal.
- `/health` chỉ phản ánh process; `/ready` yêu cầu config + DB + schema đúng.
- Downstream/broker degradation xuất hiện trong component status nhưng không làm readiness fail nếu local core còn hoạt động.
- Graceful shutdown: stop traffic/worker claim, drain HTTP/gRPC, đóng DB/broker.
- Published outbox retention 30 ngày; processed-event retention 90 ngày; domain/history/audit không auto-delete trong MVP.

### 9.3 Configuration tối thiểu

| Nhóm | Variables |
|---|---|
| Runtime | `NODE_ENV`, `PORT=5007`, `GRPC_PORT=6007`, `BUSINESS_TIMEZONE=Asia/Bangkok` |
| DB | `APPOINTMENT_DATABASE_URL` |
| User auth | `AUTH_JWKS_URL`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE` |
| Service auth | private-key path, key ID, trusted JWKS path, TTL |
| gRPC | `PATIENT_GRPC_URL`, `DOCTOR_GRPC_URL`, `CATALOG_GRPC_URL`, dependency timeout |
| Booking | hold TTL, horizon, lead, cutoff, check-in window, max active holds |
| Broker/workers | `RABBITMQ_URL`, exchange/DLX, Doctor/Patient inbound queue names, outbox/expiry/reminder/reconciliation intervals |
| Rate limits | availability 60/min, hold 10/min, command 30/min/account; internal search 120/min/service instance |

Secrets không commit vào repository hoặc `.env.example`.

---

## 10. Deployment và integration readiness

Docker Compose baseline:

- `appointment-db`: PostgreSQL 16, database/user/volume/healthcheck riêng.
- `appointment-migrate`: one-shot migration sau DB healthy.
- `appointment-service`: Nest hybrid HTTP `5007` + gRPC `6007`, start sau migration success.
- RabbitMQ durable volume/healthcheck; broker down không ngăn local domain commit vì có outbox.
- Kong chỉ route HTTP; không expose gRPC port.
- `docker compose up --build` trên máy mới phải generate Prisma/proto, chạy migration rồi start service.

Required repository integration:

- đăng ký project trong `services/nest-cli.json`;
- scripts `start:appointment`, `start:appointment:dev`, `prisma:generate:appointment`, `prisma:migrate:appointment`, `proto:generate`;
- root Prisma generation phải bao gồm Appointment client;
- production Docker build copy proto trước compile và start đúng compiled entrypoint.

Provider work để chạy end-to-end:

| Owner | Contract cần có |
|---|---|
| Auth | RS256 access token + JWKS, stable issuer/audience/kid |
| Patient | gRPC `6004`, resolve theo account + eligibility theo patient ID; phát `patient.account_linked` |
| Doctor | gRPC `6005`, candidate/availability/eligibility RPC + change events |
| Catalog | gRPC `6008`, `ResolveBookableConsultation` với duration/pricing/rank policy |
| Receptionist | Generate Appointment client; booking-on-behalf/walk-in/staff-change + Admission Saga; service JWT; stable command/business reference; staff context |
| Billing | Generate Appointment read client; public checkout + Reception create/get invoice; bind invoice theo appointment/revision; consume versioned lifecycle events và tự xử lý financial policy |
| Medical Record | Generate Appointment client; complete bằng stable reference/key |
| Platform | Internal DNS, keys/JWKS mount, Rabbit exchange/DLX, DB migration role |

Downstream chưa code không phải lý do bỏ client/route khỏi Appointment. Appointment implement đúng contract và trả `503` cho đến khi provider sẵn sàng.

---

## 11. Out of scope và Definition of Done

### 11.1 Out of scope

- Multi-facility/room/equipment/group capacity.
- Waitlist, recurring appointment, telemedicine, manual overbooking.
- Appointment không có Medical Service hoặc diagnostic/procedure không cần concrete doctor.
- Admin đặt lịch trực tiếp, Doctor self-calendar; mọi staff operation đi qua Receptionist Service.
- Undo check-in/Admission compensation.
- Invoice/payment/refund, Queue state, clinical record, notification delivery.

### 11.2 Definition of Done cho coding agent

- Boundary/data ownership đúng `system_design.md`; không shared DB/cross-service FK.
- Prisma schema/migration có local FK, CHECK, index, two exclusion constraints và partial unique reschedule hold.
- Toàn bộ REST endpoint và gRPC RPC mục 5–6 được expose với auth/ownership/error mapping.
- Patient/Doctor/Catalog typed gRPC clients tồn tại; Appointment server client được Reception/Billing/Medical generate từ cùng canonical proto; không mock/fallback success production.
- Self, booking-on-behalf và walk-in đều dùng chung hold/occupancy; nullable account ownership và `patient.account_linked` consumer hoạt động đúng invariant.
- Staff reschedule/cancel, cutoff override, caller/scope allowlist, staff audit và cross-channel hold protection được enforce.
- Billing context trả đúng immutable current revision; lifecycle event đủ version/source/pricing context để Billing reconcile mà Appointment không giữ payment state.
- Confirm/reschedule/cancel/check-in/no-show/complete atomic, versioned và idempotent.
- Historical revision/snapshot không bị update ngược.
- Outbox, consumer dedupe, reminder và Doctor reconciliation hoạt động restart-safe.
- Health/readiness/graceful shutdown và Docker Compose chạy được trên máy mới.
- OpenAPI/proto/config/docs khớp implementation.
- Không cần unit-test code hoặc concurrency-test code trong scope này; implementation vẫn phải giữ toàn bộ invariant/constraint đã mô tả.

Không còn open design question trong phạm vi MVP. Thay đổi boundary, state machine, schema hoặc public/internal contract phải cập nhật tài liệu/ADR trước khi đổi code.
