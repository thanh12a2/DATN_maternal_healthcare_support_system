# Service Specifications & Contracts Index

> Target architecture: private clinic, one facility, service-only, no BHYT. Public REST qua Kong; internal synchronous gRPC; RabbitMQ domain events.

## Approved decisions và luồng

- [Decision log](decisions/private-clinic-service-decisions.md)
- [End-to-end business flow](private-clinic-end-to-end-flow.md)
- [System design](system_design.md)
- [Internal communication matrix](integration/internal-communication-matrix.md)
- [gRPC conventions](integration/grpc-conventions.md)
- [RabbitMQ event catalog](integration/rabbitmq-event-catalog.md)
- [gRPC migration notes](integration/grpc-migration-notes.md)

## 11 implementation-ready services

| Service | Specification | Public OpenAPI | Internal gRPC |
|---|---|---|---|
| Appointment | [Spec](service_specs/appointment-service-spec.md) | [OpenAPI](api-specs/appointment-service.yaml) | [Proto](grpc/appointment/v1/appointment_internal.proto) |
| Billing | [Spec](service_specs/billing-service-spec.md) | [OpenAPI](api-specs/billing-service.yaml) | [Proto](grpc/billing/v1/billing_internal.proto) |
| Medical Record | [Spec](service_specs/medical-record-service-spec.md) | [OpenAPI](api-specs/medical-record-service.yaml) | [Proto](grpc/medical_record/v1/medical_record_internal.proto) |
| Queue | [Spec](service_specs/queue-service-spec.md) | [OpenAPI](api-specs/queue-service.yaml) | [Proto](grpc/queue/v1/queue_internal.proto) |
| Notification | [Spec](service_specs/notification-service-spec.md) | [OpenAPI](api-specs/notification-service.yaml) | [Proto](grpc/notification/v1/notification_internal.proto) |
| Document | [Spec](service_specs/document-service-spec.md) | [OpenAPI](api-specs/document-service.yaml) | [Proto](grpc/document/v1/document_internal.proto) |
| Prescription | [Spec](service_specs/prescription-service-spec.md) | [OpenAPI](api-specs/prescription-service.yaml) | [Proto](grpc/prescription/v1/prescription_internal.proto) |
| Treatment Plan | [Spec](service_specs/treatment-plan-service-spec.md) | [OpenAPI](api-specs/treatment-plan-service.yaml) | [Proto](grpc/treatment_plan/v1/treatment_plan_internal.proto) |
| Audit Log | [Spec](service_specs/audit-log-service-spec.md) | [OpenAPI](api-specs/audit-log-service.yaml) | [Proto](grpc/audit_log/v1/audit_log_internal.proto) |
| Reporting | [Spec](service_specs/reporting-service-spec.md) | [OpenAPI](api-specs/reporting-service.yaml) | [Proto](grpc/reporting/v1/reporting_internal.proto) |
| Consultation | [Spec](service_specs/consultation-service-spec.md) | [OpenAPI](api-specs/consultation-service.yaml) | [Proto](grpc/consultation/v1/consultation_internal.proto) |

## Owner gRPC contracts for existing services

- [Auth](grpc/auth/v1/auth_internal.proto)
- [Patient](grpc/patient/v1/patient_internal.proto)
- [Doctor](grpc/doctor/v1/doctor_internal.proto)
- [Service Catalog](grpc/catalog/v1/catalog_internal.proto)
- [Common messages](grpc/common/v1/common.proto)

## Status caveat

Các file trên là target DESIGN/approved decisions. Chúng không chứng minh source, Docker Compose, Kong, RabbitMQ hoặc database migration tương ứng đã được implement. Khi triển khai phải đối chiếu source/config hiện tại và thực hiện migration theo dependency order.
