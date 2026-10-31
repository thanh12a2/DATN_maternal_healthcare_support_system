# Luồng nghiệp vụ end-to-end — Phòng khám tư nhân

> **Status:** APPROVED baseline theo quyết định khách hàng ngày 2026-10-03.  
> **Nguồn:** lựa chọn cuối của Nam trong `ba-service-decisions-voting.xlsx` và các clarification sau workshop.  
> Chi tiết implementation nằm trong `service_specs/`, `api-specs/`, `grpc/` và `integration/`.

## 1. Bối cảnh đã chốt

- Một phòng khám tư nhân, một cơ sở, chỉ khám dịch vụ, không BHYT.
- Patient có thể chọn bác sĩ cụ thể hoặc chọn consultation rank để hệ thống phân bác sĩ.
- Doctor sở hữu rank; Catalog sở hữu base price và surcharge theo rank.
- Public client dùng REST qua Kong; synchronous internal call dùng gRPC; async event dùng RabbitMQ.
- Mỗi service có database riêng; không query/FK xuyên service, không distributed transaction.

## 2. Người bệnh biết gì?

### Sau booking

Người bệnh nhận mã lịch hẹn, dịch vụ, bác sĩ/rank, thời gian, pricing snapshot, hướng dẫn đến khám và queue estimate có `calculatedAt`/range. Estimate không phải số thứ tự authoritative.

### Sau Admission/check-in

Queue Service mới tạo `QueueJourney` và `StageTicket` authoritative. Người bệnh nhận ticket code, phòng/stage, số người phía trước và ETA hiện tại.

## 3. Luồng chính

### 3.1 Tài khoản và hồ sơ hành chính

1. Patient đăng ký/login qua Authentication Service.
2. Patient hoàn thiện Patient Profile.
3. Patient Service chỉ sở hữu dữ liệu hành chính; pregnancy/clinical data thuộc Medical Record.

### 3.2 Chọn dịch vụ, bác sĩ/rank và slot

1. Client đọc Catalog và Doctor public APIs.
2. Appointment gọi Patient gRPC kiểm tra eligibility.
3. Appointment gọi Doctor gRPC lấy candidate/working availability.
4. Appointment gọi Catalog gRPC resolve base price + rank surcharge.
5. Appointment tính bookable slot bằng Doctor availability trừ occupancy và active SlotHold.
6. SlotHold giữ đúng một slot/doctor trong 5 phút; booking consume hold atomically.

### 3.3 Booking

1. Appointment tạo booking channel `ONLINE | RECEPTION | WALK_IN`.
2. Lưu service/doctor/rank/pricing snapshot.
3. Không tạo QueueTicket tại booking.
4. Phát `appointment.booked.v1`; Notification gửi xác nhận và reminder trước 24 giờ/1 giờ.
5. Patient không tự cancel/reschedule; Receptionist/Admin thao tác với reason và audit.

### 3.4 Doctor unavailable

- Chọn doctor cụ thể: chuyển `REASSIGNMENT_REQUIRED` và cần confirmation workflow.
- Chọn rank: có thể auto-assign doctor khác cùng exact rank nếu availability/occupancy hợp lệ.
- Trước payment có thể lập quote mới; sau payment không refund, giá giảm vẫn giữ số tiền đã thu.

### 3.5 Admission tại quầy

Canonical Reception Saga:

1. Validate Appointment.
2. Verify Patient identity.
3. Open ReceptionCase.
4. Billing CreateOrGet base Invoice.
5. Verify `PAID` hoặc `APPROVED_CREDIT`.
6. Medical Record OpenOrGet ClinicalEncounter DRAFT.
7. Appointment check-in.
8. Queue CreateOrGet authoritative journey + initial stage ticket.
9. Complete ReceptionCase.

Mỗi gRPC command dùng stable idempotency key. Timeout sau write không chứng minh rollback; retry cùng key hoặc lookup outcome. Không sửa database owner khác để compensation.

### 3.6 Payment ban đầu

- Chỉ `CASH` hoặc `MANUAL_BANK_TRANSFER`.
- Đúng một Payment/Invoice; không partial, mixed hoặc payment gateway.
- Có approved credit; nếu chưa PAID/APPROVED_CREDIT thì Admission ở PAYMENT_PENDING và chưa tạo QueueTicket.
- Không refund dưới mọi hình thức; payment đã ghi nhận là immutable.

### 3.7 Queue

- QueueJourney theo Appointment/Encounter; mỗi phòng/stage có StageTicket.
- CallNext do server chọn; manual override cần permission + reason.
- Late trên 30 phút vẫn nhận nhưng bị demote.
- Mỗi call giữ 5 phút; timeout lần 1 requeue, lần 2 SKIPPED.

### 3.8 Clinical Encounter

1. Nurse nhập vital signs; Doctor nhập note/diagnosis/order; staff phòng dịch vụ nhập result theo assignment.
2. State: `DRAFT → IN_PROGRESS → AWAITING_RESULTS → READY_FOR_REVIEW → FINALIZED`.
3. Required result chưa verified thì không finalize.
4. Sau FINALIZED không update đè; sửa bằng append-only amendment.
5. PregnancyEpisode liên kết nhiều encounter trong cùng thai kỳ.

### 3.9 Nhiều phòng/dịch vụ

- Doctor tạo ClinicalServiceOrder với target stage.
- Queue tạo StageTicket mới bằng `sourceOrderId`.
- Chỉ dịch vụ đã `PERFORMED` mới phát billable event; ORDERED chưa được charge.
- Result có thể structured và link Document ID; binary thuộc Document Service.

### 3.10 Prescription, Treatment Plan, Document

- Prescription: `DRAFT → ISSUED → CANCELLED`; không kho/bán thuốc/charge thuốc.
- Treatment Plan: `DRAFT → ACTIVE → COMPLETED|CANCELLED`; không AI/autobooking.
- Document: object private, immutable version, checksum, malware status; chỉ CLEAN mới link/download.

### 3.11 Clinical completion và Billing bổ sung

1. Medical finalize Encounter, phát `medical.encounter_finalized.v1`.
2. Appointment COMPLETED theo clinical completion, không chờ supplementary debt.
3. Billing lập supplementary invoice từ service đã PERFORMED.
4. Outstanding debt ở Billing/Notification/Reporting; không khóa record hoặc Appointment.

### 3.12 Cross-cutting

- Notification: in-app + push adapter/mock + email; không SMS provider; không chứa PHI chi tiết.
- Audit Log: append-only event consumer; không là synchronous dependency.
- Reporting: event-driven read model + CSV; không cross-DB query, không authoritative.
- Consultation: async Patient–Doctor messaging; không AI/video/diagnosis/prescription từ chat.

## 4. Source of truth

| Concept | Owner |
|---|---|
| Account/token/role | Authentication |
| Patient administrative profile | Patient |
| Doctor profile/specialty/rank/working availability | Doctor |
| Service/base price/rank surcharge | Catalog |
| Appointment/occupancy/hold/check-in | Appointment |
| ReceptionCase/checkpoints | Receptionist |
| Invoice/payment/credit/outstanding | Billing |
| Encounter/PregnancyEpisode/order/result/diagnosis | Medical Record |
| QueueJourney/StageTicket/position | Queue |
| Binary/version/access | Document |
| Prescription | Prescription |
| Care plan | Treatment Plan |
| Delivery attempt | Notification |
| Audit projection | Audit Log |
| Analytical projection/export | Reporting |
| Consultation thread/message | Consultation |

## 5. Điều cần biết trước implementation

- Tài liệu mới là target DESIGN/approved decisions, không phải bằng chứng source đã implement.
- Auth/Patient/Doctor/Catalog có thể còn internal HTTP/shared-secret compatibility; target là gRPC và phải migration có contract test.
- RabbitMQ chưa có trong runtime hiện tại; cần broker/outbox relay/DLQ khi implement.
- Port gRPC, retention pháp lý, provider push/email, taxonomy rank cuối và SLO production vẫn cần config/design review nhưng không được đảo ngược business decisions.
- Không hard-code multi-facility, BHYT, refund hay multi-payment.

## 6. Thứ tự triển khai khuyến nghị

1. Common proto + service JWT trust + RabbitMQ/outbox conventions.
2. Owner gRPC cho Auth/Patient/Doctor/Catalog.
3. Appointment và Billing.
4. Medical Record, Document, Prescription, Treatment Plan.
5. Queue và Reception Admission Saga.
6. Notification, Audit, Reporting.
7. Consultation.
8. Contract/integration/E2E/failure/reconciliation tests xuyên service.
