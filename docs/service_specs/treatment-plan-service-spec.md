
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Treatment Plan Service — Service Specification

> Status: DESIGN — implementation-ready; approved boundary, chưa implemented.
> Public contract: ../api-specs/treatment-plan-service.yaml
> Internal contract: ../grpc/treatment_plan/v1/treatment_plan_internal.proto

## 1. Tổng quan và boundary

Treatment Plan Service là source of truth cho kế hoạch chăm sóc dài hạn, phiên bản, plan item, follow-up instruction và lifecycle. Plan liên kết Patient, PregnancyEpisode, Encounter và author Doctor bằng external IDs.

### Chịu trách nhiệm

- Draft/version/publish kế hoạch chăm sóc.
- Goal/task/instruction/follow-up item có due date và status.
- Patient xem plan ACTIVE của mình.
- Hoàn tất hoặc cancel plan có reason/audit.

### Không chịu trách nhiệm

- Tự đặt Appointment, AI recommendation, diagnosis, prescription, Notification delivery.
- Patient/Doctor/PregnancyEpisode source of truth.

## 2. Actors và authorization

| Actor/caller | Hành động | Rule |
|---|---|---|
| Assigned DOCTOR | Create/edit/activate/complete/cancel | Encounter assignment + patient relation |
| PATIENT | Read own ACTIVE/COMPLETED plan | patientId ownership |
| Medical Record Service | Link/list plan references | service scope treatment-plan:clinical |
| NURSE | Read active plan khi thuộc care team | Không publish/cancel |
| ADMIN | Không mặc định xem PHI | No role-only bypass |

## 3. Domain model

### TreatmentPlan

id, patientId, pregnancyEpisodeId nullable, sourceEncounterId, authorDoctorId, status, title, summary, version, effectiveFrom, effectiveTo nullable, activatedAt, completedAt, cancelledAt, cancelReason, createdAt, updatedAt.

### TreatmentPlanItem

id, planId, type GOAL|CARE_INSTRUCTION|FOLLOW_UP|MONITORING, title, description, dueAt nullable, status PENDING|IN_PROGRESS|DONE|CANCELLED, sortOrder, completedAt nullable.

### TreatmentPlanVersion

planId, version, snapshotJson sanitized, changedBy, changeReason, createdAt. Unique planId + version.

## 4. State machine

DRAFT → ACTIVE → COMPLETED.
DRAFT/ACTIVE → CANCELLED.
ACTIVE plan content không update đè: change tạo version mới trong cùng aggregate và audit. COMPLETED/CANCELLED terminal; follow-up mới tạo plan mới.

## 5. Public REST API

Base path: /api/treatment-plans.

| Method | Path | Mục đích |
|---|---|---|
| POST | /treatment-plans | Tạo draft |
| GET | /treatment-plans/{id} | Xem plan authorized |
| GET | /treatment-plans?patientId=... | Own patient/care-team filtered list |
| PATCH | /treatment-plans/{id} | Edit draft hoặc tạo active version |
| POST | /treatment-plans/{id}/activate | Publish cho patient |
| POST | /treatment-plans/{id}/complete | Hoàn tất |
| POST | /treatment-plans/{id}/cancel | Cancel có reason |
| POST | /treatment-plans/{id}/items/{itemId}/complete | Hoàn tất item |

Write có Idempotency-Key và version.

## 6. Internal gRPC

TreatmentPlanInternalService:

- CreateDraftPlan.
- GetTreatmentPlan.
- ListPlansByPatient hoặc PregnancyEpisode.
- ActivatePlan.
- CompletePlan.
- CancelPlan.
- ValidateTreatmentPlanReference.

RequestContext + service JWT + deadline; command idempotent. Response minimum necessary.

## 7. Business rules

| ID | Rule |
|---|---|
| TP-BR-001 | Author phải là assigned doctor của source encounter. |
| TP-BR-002 | Activate cần title, summary và ít nhất một active item. |
| TP-BR-003 | Patient chỉ thấy ACTIVE/COMPLETED plan của mình. |
| TP-BR-004 | Active modification tạo version và reason; không overwrite history. |
| TP-BR-005 | effectiveTo không trước effectiveFrom; timestamps UTC. |
| TP-BR-006 | Follow-up item không tự tạo Appointment; chỉ phát signal/event. |
| TP-BR-007 | Cancel/complete terminal và idempotent theo key. |
| TP-BR-008 | Không AI-generated clinical recommendation trong MVP. |

## 8. Scenarios và edge cases

- Assigned doctor tạo draft, activate; patient thấy plan.
- Draft thiếu item bị 422, không publish event.
- Doctor không assigned bị reject không leak patient data.
- Concurrent patch same version: một success, một VERSION_CONFLICT.
- Retry activate/complete cùng key không duplicate event.
- PregnancyEpisode closed không chặn historical read; create mới theo Medical rule.
- Follow-up due event lỗi: core state giữ nguyên, outbox retry.

## 9. Events và consistency

Outbound: treatment_plan.created.v1, treatment_plan.activated.v1, treatment_plan.updated.v1, treatment_plan.follow_up_due.v1, treatment_plan.completed.v1, treatment_plan.cancelled.v1. Notification/Appointment chỉ consumer; không được tự đổi plan. Transactional outbox, at-least-once, consumer dedupe.

Medical Record gRPC validate encounter/assignment; Patient/Doctor current display resolve khi thật sự cần. Không distributed transaction.

## 10. Security, audit và NFR

- PHI; field minimization và purpose-based audit.
- Không log summary/instruction raw.
- Audit create, view staff, version, activate, item complete, complete/cancel, deny.
- PostgreSQL riêng; service stateless; no public DB port production.
- P95 local reads < 300 ms; writes < 500 ms excluding bounded gRPC.

## 11. Testing và acceptance

Unit state/version/date rules; integration optimistic lock/outbox/idempotency; REST/gRPC authorization; event duplicate; PHI logging; failure Medical dependency. Acceptance: patient không thấy DRAFT; active updates preserve version; follow-up không tự book appointment.

## 12. Implementation plan

1. Foundation/schema/health/audit/outbox.
2. Plan/item/version/state application layer.
3. REST + Medical gRPC + service JWT.
4. RabbitMQ follow-up/notification signals.
5. Contract/integration/security/E2E tests.

Out of scope: AI/CDSS, automatic booking, multi-facility care pathway, remote monitoring device integration.
