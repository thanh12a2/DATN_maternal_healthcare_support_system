
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Prescription Service — Service Specification

> Status: DESIGN — implementation-ready; approved boundary, chưa implemented.
> Public contract: ../api-specs/prescription-service.yaml
> Internal contract: ../grpc/prescription/v1/prescription_internal.proto

## 1. Tổng quan và boundary

Prescription Service là source of truth cho đơn thuốc lâm sàng, danh mục thuốc lâm sàng, item, dosage instruction, version và issue/cancel lifecycle. Service không phải Pharmacy và không tạo charge.

### Chịu trách nhiệm

- Draft prescription trong một ClinicalEncounter.
- Quản lý Medication Catalog dùng chung: mã thuốc, hoạt chất, hàm lượng, dạng bào chế, đường dùng, hướng dẫn mặc định và cảnh báo an toàn thai kỳ.
- Quản lý item, hoạt chất/tên thuốc, dạng dùng, liều, tần suất, đường dùng, thời gian và hướng dẫn.
- Assigned Doctor issue/cancel; lưu snapshot doctor/patient cần cho lịch sử.
- Patient đọc prescription đã ISSUED.

### Không chịu trách nhiệm

- Kho, cấp/bán thuốc, payment, drug interaction engine, e-prescription quốc gia.
- Chẩn đoán và Encounter state; Medical Record sở hữu.

## 2. Actors và authorization

| Actor/caller | Hành động | Rule |
|---|---|---|
| Assigned DOCTOR | Create/edit draft, issue, cancel | Active encounter assignment |
| PATIENT | Read own ISSUED/CANCELLED prescription | patientId ownership |
| Medical Record Service | Create/get context, list by encounter | service scope prescription:clinical |
| NURSE | Read issued when assigned | Không create/issue/cancel |
| ADMIN | Không mặc định đọc nội dung | No role-only bypass |

## 3. Domain model

### Prescription

id, encounterId, patientId, pregnancyEpisodeId nullable, prescribingDoctorId, status, version, issuedAt, cancelledAt, cancelReason, createdAt, updatedAt.

### PrescriptionItem

id, prescriptionId, medicationCode nullable, medicationName, strength, dosageForm, route, dose, frequency, durationDays nullable, quantityText nullable, instruction, sortOrder.

Constraints:

- Unique encounterId + prescription sequence/version.
- Ít nhất một item hợp lệ khi issue.
- Không cross-DB FK cho encounter/patient/doctor/documentId.
- Text length/allowlist; không dùng float cho dose có đơn vị, lưu decimal string + unit.

### MedicationCatalog

id, code (unique, immutable), name, activeIngredient, strength, dosageForm, route, defaultDose/Frequency/Instruction nullable, pregnancyCategory (A/B/C/D/X), pregnancyWarning nullable, isActive, version, timestamps.

Catalog entry là dữ liệu hỗ trợ kê đơn, không phải tồn kho. Khi `medicationCode` được gửi vào draft/update, service xác thực thuốc đang active và lưu snapshot chuẩn vào PrescriptionItem; đơn đã lưu không thay đổi khi danh mục bị sửa hoặc vô hiệu hóa.

## 4. State machine

DRAFT → ISSUED → CANCELLED.
DRAFT có thể CANCELLED để bỏ bản nháp.
ISSUED là immutable; thay đổi điều trị tạo prescription mới liên kết supersedesPrescriptionId.
CANCELLED là terminal.

## 5. Public REST API

Base path: /api/prescriptions.

| Method | Path | Permission |
|---|---|---|
| POST | /prescriptions | Assigned DOCTOR |
| GET | /prescriptions/{id} | Own patient/assigned clinical staff |
| PATCH | /prescriptions/{id} | Assigned DOCTOR, DRAFT |
| POST | /prescriptions/{id}/issue | Assigned DOCTOR |
| POST | /prescriptions/{id}/cancel | Prescribing/assigned doctor + reason |
| GET | /prescriptions?encounterId=... | Clinical caller/own patient filtered |
| GET | /medications | `DOCTOR`, `RECEPTIONIST`, `ADMIN`; staff ngoài ADMIN chỉ thấy active |
| GET | /medications/{id} | `DOCTOR`, `PATIENT`, `ADMIN`; inactive chỉ ADMIN |
| POST | /medications | `ADMIN`, `DOCTOR` |
| PATCH | /medications/{id} | `ADMIN`, `DOCTOR`, optimistic version |
| POST | /medications/{id}/activate, /deactivate | `ADMIN`, optimistic version |

Commands có Idempotency-Key; updates dùng version.

## 6. Internal gRPC

PrescriptionInternalService:

- CreateDraftPrescription.
- GetPrescription.
- ListPrescriptionsByEncounter.
- IssuePrescription.
- CancelPrescription.
- ValidatePrescriptionReference cho Medical Record/Document.

Mỗi RPC dùng RequestContext, service JWT scope, deadline; command idempotent.

## 7. Business rules

| ID | Rule |
|---|---|
| RX-BR-001 | Chỉ assigned doctor của active encounter được draft/issue. |
| RX-BR-002 | Issue cần ít nhất một item và encounter chưa CANCELLED. |
| RX-BR-003 | ISSUED immutable; correction tạo bản mới. |
| RX-BR-004 | Cancel cần reason; không xóa lịch sử. |
| RX-BR-005 | Patient chỉ xem prescription của mình sau issue. |
| RX-BR-006 | Prescription không tạo invoice line hoặc tồn kho. |
| RX-BR-007 | Medication code optional; medication name và dosage bắt buộc. |
| RX-BR-008 | Mọi read/write PHI phải audit theo purpose. |
| RX-BR-009 | Medication code là định danh bất biến và unique; không xóa cứng danh mục. |
| RX-BR-010 | Thuốc inactive không xuất hiện trong autocomplete và không được dùng trong draft mới; snapshot trong đơn lịch sử vẫn hợp lệ. |
| RX-BR-011 | Danh mục thuốc là bounded context của Prescription Service; không gọi Service Catalog hay Pharmacy để lookup. |

## 8. Scenarios và edge cases

- Doctor assigned tạo draft, thêm item, issue thành công và phát event đúng một lần.
- Doctor khác cùng role bị reject.
- Issue draft rỗng/invalid dosage bị 422, không event.
- Concurrent issue: optimistic lock chỉ một request thắng.
- Retry issue cùng key trả cùng result; key reuse payload khác conflict.
- Cancel issued lặp cùng key idempotent; patient vẫn thấy trạng thái CANCELLED và reason an toàn.
- Encounter gRPC timeout trước create: 503, không false write.

## 9. Events và consistency

Outbound: prescription.draft_created.v1, prescription.issued.v1, prescription.cancelled.v1. Notification có thể thông báo issued nhưng không nhận item/PHI chi tiết. Transactional outbox, at-least-once, idempotent consumer.

Synchronous gRPC tới Medical Record để validate encounter/assignment khi command cần current relationship. Không distributed transaction.

## 10. Security, audit và NFR

- PHI; response DTO theo actor, no broad list.
- Audit view, draft change, issue, cancel, deny.
- Không log medication instruction/raw note.
- Service stateless, PostgreSQL riêng; UTC và Asia/Ho_Chi_Minh business date.
- P95 local read/write < 400 ms, dependency deadline bounded.

## 11. Testing và acceptance

Unit state/rules; integration DB/idempotency/outbox; gRPC authorization/dependency failure; REST ownership; duplicate/out-of-order event; PHI log tests. Acceptance: không ai ngoài assigned care team và patient owner đọc được; issued không update đè; không phát sinh billing/inventory side effect.

## 12. Implementation plan

1. Foundation/schema/health/audit/outbox.
2. Draft/item/version/state APIs.
3. Medical Record gRPC + service JWT.
4. RabbitMQ/Notification event integration.
5. Contract, integration, security và E2E tests.

Out of scope: pharmacy, inventory, dispensing, medication payment, interaction/CDSS, external e-prescription.
