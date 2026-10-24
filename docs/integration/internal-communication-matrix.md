# Ma trận giao tiếp nội bộ

> **Status:** APPROVED ở mức ownership/transport; RPC của bốn owner nền khớp proto trong docs/grpc. RPC của 11 service mới là DESIGN contract name cho đến khi owner proto/spec tương ứng được duyệt.  
> Quy ước: synchronous = gRPC trực tiếp; asynchronous = RabbitMQ domain event. Không internal REST, không qua Kong, không cross-DB query.

## 1. Owner RPC nền

| Caller | Owner | RPC | Mục đích / dữ liệu tối thiểu | Failure policy |
|---|---|---|---|---|
| Receptionist, Doctor, Patient profile service | Auth | AuthInternalService.GetAccountAuthorization | Xác nhận account status/role khi create/activate business profile | Required; deadline, không fallback DB |
| Batch admin/read model | Auth | AuthInternalService.BatchGetAccountAuthorization | Resolve coarse auth metadata theo batch bounded | Required cho operation yêu cầu freshness |
| Appointment | Patient | PatientInternalService.GetPatientEligibility | patient active/profileComplete/version | Fail booking an toàn |
| Receptionist | Patient | PatientInternalService.SearchPatients | Tìm theo phone/last4/appointment code với PII masked | Fail admission lookup; không cache raw PII tùy tiện |
| Receptionist, Medical Record | Patient | PatientInternalService.GetPatientIdentity | Đối chiếu/minimum demographic theo purpose | Required; owner mask theo caller |
| Appointment, Medical Record | Doctor | DoctorInternalService.GetDoctorEligibility | status, specialty, consultationRank, versions | Required khi doctor cụ thể/assignment |
| Appointment | Doctor | DoctorInternalService.ListEligibleDoctors | Candidate theo specialty/rank/time | Required cho rank-based assignment |
| Appointment | Doctor | DoctorInternalService.GetDoctorAvailability | Working intervals; không gồm booking occupancy | Required để tính slot |
| Appointment | Catalog | CatalogInternalService.ResolveBookingOffering | service + base/rank surcharge + total snapshot | Required trước hold/booking |
| Medical Record, Billing, Reporting adapters | Catalog | CatalogInternalService.BatchResolveServices | Tên/code/version tối thiểu | Có thể cache projection nếu use case cho phép stale |

## 2. Booking và thay đổi doctor

| Caller | Owner | RPC/event | Mode | Kết quả/ghi chú |
|---|---|---|---|---|
| Public client qua Kong | Appointment | REST booking/hold API | Sync edge | Không phải internal call |
| Appointment | Patient/Doctor/Catalog | Các RPC mục 1 | Sync gRPC | Resolve eligibility, candidate/availability, pricing trước local commit |
| Appointment | Queue | QueueInternalService.EstimateWait | Optional sync gRPC | Chỉ trả estimate có calculatedAt/range; không tạo ticket/số thứ tự |
| Appointment | Appointment | SlotHold command | Local | TTL 5 phút; owner booking occupancy |
| Appointment | RabbitMQ | appointment.booked.v1 | Async event | Notification, Reporting, Audit consume |
| Doctor | RabbitMQ | doctor.availability_changed.v1, doctor.status_changed.v1 | Async event | Appointment rà soát future bookings; không gọi ngược trong doctor transaction |
| Appointment | RabbitMQ | appointment.reassignment_required.v1 | Async event | Notification nhắc confirmation; Audit/Reporting consume |
| Receptionist/Admin qua Kong | Appointment | CancelAppointment, RescheduleAppointment, ConfirmReassignment | Public REST → owner | Caller actor có permission; reason/audit bắt buộc |
| Appointment | RabbitMQ | appointment.cancelled.v1, appointment.rescheduled.v1, appointment.reassigned.v1 | Async event | Consumers cập nhật projection/reminder; không tự sửa owner state |

## 3. Admission canonical

| Step | Caller | Owner | RPC (DESIGN nếu chưa có owner proto) | Idempotency / failure |
|---:|---|---|---|---|
| 1 | Receptionist | Appointment | AppointmentInternalService.ValidateForAdmission | Read; trả appointment/patient/service/pricing/check-in eligibility, không tạo ticket |
| 2 | Receptionist | Patient | PatientInternalService.GetPatientIdentity | purpose=ADMISSION_IDENTITY_VERIFICATION; receptionist ghi assertion local |
| 3 | Receptionist | Receptionist | OpenReceptionCase | Local transaction, unique appointment active case |
| 4 | Receptionist | Billing | BillingInternalService.CreateOrGetBaseInvoice | Write idempotent theo case/appointment |
| 5 | Receptionist | Billing | BillingInternalService.GetAdmissionPaymentCondition | Chỉ CLEAR nếu paid đủ hoặc approved credit |
| 6 | Receptionist | Medical Record | MedicalRecordInternalService.OpenOrGetEncounter | Tạo/lấy Encounter DRAFT, idempotent theo appointment |
| 7 | Receptionist | Appointment | AppointmentInternalService.CheckInAppointment | Write idempotent; đánh dấu late nếu >30 phút |
| 8 | Receptionist | Queue | QueueInternalService.CreateOrGetJourney | Chỉ sau clearance + check-in; tạo QueueTicket stage đầu authoritative |
| 9 | Receptionist | Receptionist | CompleteReceptionCase | Local checkpoint/refs; không sở hữu downstream state |

Nếu timeout sau write, Receptionist retry cùng idempotency key hoặc GetOperation/GetByBusinessKey. Không compensation bằng sửa DB owner. Invoice unpaid chuyển PAYMENT_PENDING; approved credit là quyết định Billing, không phải flag Receptionist tự đặt.

## 4. Clinical journey và billing bổ sung

| Caller/Producer | Owner/Consumer | RPC/event | Mode | Quy tắc |
|---|---|---|---|---|
| Queue | Medical Record | queue.ticket_called.v1 | Event | Chỉ tín hiệu vận hành; không tự đổi Encounter nếu owner chưa quy định |
| Medical Record | Document | DocumentInternalService.CreateDocumentUpload / LinkDocument | gRPC | Object private; scan status phải sạch trước clinical release |
| Medical Record | Queue | QueueInternalService.EnqueueStage | gRPC | ServiceOrder cần phòng tiếp theo; ticket theo stage |
| Medical Record | Prescription | PrescriptionInternalService.CreateDraftPrescription | gRPC | Assignment context; không charge thuốc |
| Medical Record | Treatment Plan | TreatmentPlanInternalService.CreateDraftPlan | gRPC | Link encounter/pregnancy episode bằng external refs |
| Medical Record | RabbitMQ | medical.service_order_performed.v1 | Event | Billing chỉ charge supplementary line khi PERFORMED |
| Billing | Catalog | CatalogInternalService.ResolveBookingOffering hoặc approved supplementary pricing RPC | gRPC | Không lấy giá bằng cross-DB; source/snapshot phải ghi rõ |
| Medical Record | RabbitMQ | medical.encounter_finalized.v1 | Event | Appointment complete theo clinical completion; Billing assessment async |
| Appointment | RabbitMQ | appointment.completed.v1 | Event | Không chờ nợ bổ sung |
| Billing | RabbitMQ | billing.outstanding_changed.v1 | Event | Notification/Reporting; không khóa Appointment/record |
| Medical Record | RabbitMQ | medical.result_released.v1 | Event | Notification không chứa result detail |

## 5. Queue operations

| Caller | Owner | RPC/API/event | Mode | Authorization/rule |
|---|---|---|---|---|
| Receptionist | Queue | CreateOrGetJourney | gRPC | Chỉ sau admission prerequisites |
| Nurse/authorized staff qua Kong | Queue | REST CallNext | Sync edge | Server chọn ticket |
| Authorized supervisor qua Kong | Queue | REST ManualCall/Requeue | Sync edge | Permission riêng + reason + audit |
| Queue scheduler | Queue | MarkSkipped | Local | 5 phút/lần, tối đa 2 lần gọi rồi SKIPPED |
| Queue | RabbitMQ | queue.ticket_created.v1, queue.ticket_called.v1, queue.ticket_skipped.v1 | Async | Notification/Reporting/Audit consume |

## 6. Document, Prescription, Treatment Plan, Consultation

| Caller | Owner | RPC/event | Mode | Boundary |
|---|---|---|---|---|
| Clinical services | Document | CreateDocumentUpload, LinkDocument, GetDocumentAccess | gRPC | Metadata only; binary qua private object store URL có TTL |
| Document scanner | RabbitMQ | document.scan_completed.v1 / scan_failed.v1 | Event | Document cập nhật scan state idempotently |
| Assigned Doctor | Prescription | Public REST issue/cancel | Edge | DRAFT→ISSUED→CANCELLED; no pharmacy/sale |
| Prescription | RabbitMQ | prescription.issued.v1, prescription.cancelled.v1 | Event | Medical/Notification/Reporting consume minimum data |
| Assigned Doctor | Treatment Plan | Public REST activate/complete/cancel | Edge | DRAFT→ACTIVE→COMPLETED/CANCELLED |
| Treatment Plan | RabbitMQ | treatment_plan.changed.v1 | Event | Reporting/Notification as approved |
| Patient/assigned Doctor | Consultation | Public REST send/read thread | Edge | Async messaging; no prescribing from chat |
| Consultation | Medical Record | MedicalRecordInternalService.ValidateEncounterAccess | gRPC | Kiểm tra assignment/relationship, không đọc DB clinical |
| Consultation | RabbitMQ | consultation.message_sent.v1 | Event | Notification; payload không chứa message body/PHI |

## 7. Cross-cutting consumers

| Producer | Consumer | Event/RPC | Mục đích |
|---|---|---|---|
| Mọi domain owner | Audit Log | *.v1 audit-relevant events | Async append-only centralized audit; không thay local atomic enforcement |
| Mọi domain owner | Reporting | approved domain events | Xây read model eventual; CSV export, không authoritative |
| Appointment/Queue/Billing/Medical/Consultation | Notification | event catalog | Delivery in-app/push mock/email |
| Reporting | Owners | Không gọi cho report thường | Report dùng read model; chỉ reconciliation được phê duyệt mới RPC bounded |
| Notification/Audit/Reporting | Owner | Không command ngược | Consumer failure không rollback producer transaction |

## 8. Quy tắc review

1. Mỗi arrow mới phải chỉ rõ owner, RPC/event, minimum fields, deadline/retry và failure semantics.
2. Không thêm synchronous dependency chỉ để hiển thị/report/notification.
3. Event không thay command cần kết quả tức thời; gRPC không thay domain event phục vụ fan-out/eventual projection.
4. RPC DESIGN phải được owner đưa vào proto/spec trước implementation; tên trong matrix không chứng minh code/dependency đã tồn tại.
