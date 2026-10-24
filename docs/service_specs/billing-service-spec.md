
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Billing Service — Service Specification

> **Status:** DESIGN — implementation-ready, chưa có source/config trong repository tại ngày 2026-10-03.  
> **Approved decisions:** không BHYT; **không refund dưới mọi hình thức**; đúng một Payment/Invoice; không partial/mixed/gateway; payment `CASH | MANUAL_BANK_TRANSFER`; base charge trước queue hoặc approved credit; supplementary chỉ dịch vụ PERFORMED; thuốc không charge; nợ bổ sung không khóa clinical completion.  
> Contract chuẩn: [OpenAPI](../api-specs/billing-service.yaml) · [gRPC](../grpc/billing/v1/billing_internal.proto).

## 1. Tổng quan và boundary
| Thuộc tính | Giá trị |
|---|---|
| Service | Billing Service |
| Mục đích | Sở hữu nghĩa vụ tài chính thực tế: base/supplementary invoice, charge lines, một payment hoặc approved credit và trạng thái balance. |
| Bounded context | Private-pay Billing & Payment Recording |
| Actors | RECEPTIONIST, ADMIN; Reception, Appointment, Medical Record, Reporting, Notification |
| Source/port/stack | `services/apps/billing-service/` / TBD — DESIGN, chưa tồn tại |
| Time/money | UTC; Asia/Ho_Chi_Minh cho business date; integer minor VND |

### Ownership
- `Invoice`, `InvoiceLine`, `Payment`, `CreditApproval`, financial audit/outbox/idempotency.
- Base invoice idempotently từ Appointment pricing snapshot; supplementary invoice từ performed clinical services.
- Authoritative answer `PAID | APPROVED_CREDIT | NOT_SATISFIED` cho admission.

### Không sở hữu
Catalog/pricing config; Appointment/Encounter/Order/Performed truth; cashier identity; QueueTicket; pharmacy/inventory/drug sale. Không refund/chargeback/payment gateway/partial/mixed/BHYT. Không cross-DB FK/query hay distributed transaction.

| External data | Owner | Storage |
|---|---|---|
| appointmentId + pricing snapshot | Appointment | external ref + immutable source snapshot |
| patientId | Patient/Appointment context | UUID only |
| service/price IDs | Catalog | refs/snapshot, không edit price |
| encounterId, performedServiceId/orderId | Medical Record | refs; dedupe performed charge |
| receptionCaseId | Reception | correlation only |
| actor account | Auth | JWT/service claims only |

## 2. Actors/authorization
| Actor | Action | Permission/rule |
|---|---|---|
| PATIENT | Xem invoice của mình (nếu UI expose) | `billing:read:own`; không record/approve payment |
| RECEPTIONIST | create/get base invoice, record cash/manual transfer, xem balance | `billing:collect`; assigned active shift/policy; không approve own credit |
| ADMIN | correction metadata trước payment; approve credit; cancel unpaid invoice with reason | `billing:manage`, `billing:credit:approve` |
| Reception Service | create/get invoice, query admission condition | service scopes `billing.internal.invoice`, `billing.internal.admission` |
| Medical Record | append supplementary performed charge/finalize supplementary invoice | `billing.internal.supplementary`; only performed service evidence |
| Appointment | get financial status | `billing.internal.read` |
| Reporting/Notification | events/projection | RabbitMQ ACL, read-only |

Separation of duties: requester không approve credit của cùng invoice; approver cần ADMIN permission; mọi money action audit. Public qua Kong RS256; internal service JWT RS256/audience/scope/deadline.

## 3. Domain/data model
### Enums
- `InvoiceType = BASE | SUPPLEMENTARY`.
- `InvoiceStatus = OPEN | PAYMENT_PENDING_VERIFICATION | PAID | CREDIT_APPROVED | OUTSTANDING | CANCELLED`.
- `PaymentMethod = CASH | MANUAL_BANK_TRANSFER`; `PaymentStatus = RECORDED | VERIFIED | REJECTED`.
- `CreditStatus = APPROVED | REVOKED` (revoke chỉ trước admission/use and invoice unpaid).
- `LineSource = APPOINTMENT_SNAPSHOT | PERFORMED_SERVICE`.

### Invoice
| Field | Type | Req | Constraint |
|---|---|---:|---|
| id, patientId, appointmentId | UUID | Y | PK/external refs |
| encounterId | UUID? | C | Bắt buộc cho SUPPLEMENTARY |
| invoiceNumber | varchar(24) | Y | unique, opaque/non-PII |
| type | enum | Y | BASE/SUPPLEMENTARY |
| status | enum | Y | OPEN default |
| currency | char(3) | Y | VND |
| subtotalMinor,totalMinor,paidMinor,balanceMinor | bigint | Y | >=0; total=sum lines; paid 0 hoặc total; balance=total-paid |
| sourceVersion | bigint | Y | Appointment snapshot/clinical aggregate version |
| dueAt | timestamptz? | N | supplementary/credit tracking |
| creditApprovalId, paymentId | UUID? | N | exclusive terminal satisfaction mechanism |
| version | bigint | Y | optimistic concurrency |
| createdAt, updatedAt, paidAt | timestamptz | conditional | UTC |

### InvoiceLine
`id,invoiceId,lineNo,source,sourceReferenceId,serviceId,descriptionSnapshot(max200),quantity(default1, >0),unitAmountMinor(>=0),lineAmountMinor=quantity*unit,priceReferenceId?,performedAt?,createdAt`. MVP base has 2 lines maximum: BASE_SERVICE và optional RANK_SURCHARGE (có thể amount 0). Supplementary line requires unique performedServiceId; medicine/drug source forbidden.

### Payment
`id,invoiceId,method,status,amountMinor,currency,manualTransferReference?,receivedAt,recordedBy,verifiedBy?,verifiedAt?,rejectionReason?,idempotencyKey,createdAt`.
- CASH created directly VERIFIED; MANUAL_BANK_TRANSFER starts RECORDED/PAYMENT_PENDING_VERIFICATION, ADMIN/authorized cashier verifies -> VERIFIED/PAID or REJECTED -> invoice OPEN/OUTSTANDING.
- Exactly one Payment row per Invoice **ever**, kể cả REJECTED; nếu rejected thì không tạo payment thứ hai trong MVP—ADMIN phải xử lý ngoài hệ thống/mark invoice outstanding. This makes one-payment invariant unambiguous.

### CreditApproval
`id,invoiceId,status,reasonCode,reasonText(max500),approvedBy,approvedAt,expiresAt?,revokedBy?,revokedAt?,version`. Không phải Payment, không set paidMinor; invoice CREDIT_APPROVED và admission condition APPROVED_CREDIT.

### Constraints/indexes
| Table | Type | Rule |
|---|---|---|
| invoice | UNIQUE | appointmentId,type (mỗi appointment tối đa một BASE và một SUPPLEMENTARY) |
| invoice | UNIQUE | invoiceNumber |
| payment | UNIQUE | invoiceId; idempotencyKey scope |
| credit_approval | UNIQUE | invoiceId |
| invoice_line | UNIQUE | invoiceId,lineNo; source+sourceReferenceId cho performed line |
| invoice | CHECK | total=sum maintained transactionally; paidMinor IN (0,total); balance=total-paid; currency=VND |
| invoice | CHECK | PAID iff verified payment and balance=0; CREDIT_APPROVED iff active credit and no payment |
| invoice_line | CHECK | amount >=0; quantity>0; supplementary source=PERFORMED_SERVICE |
| indexes | INDEX | patientId,createdAt; appointmentId; status,dueAt; encounterId; outbox unpublished |

No hard delete/financial overwrite. Corrections before payment use cancel unpaid invoice + controlled recreation only where unique lifecycle permits; after PAID amounts/lines immutable. Giá giảm sau thanh toán không tạo adjustment/refund và tiền đã thu giữ nguyên.

### State machines
**Invoice:**
- `OPEN -> PAYMENT_PENDING_VERIFICATION` record manual transfer.
- `OPEN -> PAID` record CASH exact amount.
- `PAYMENT_PENDING_VERIFICATION -> PAID` verify transfer.
- `PAYMENT_PENDING_VERIFICATION -> OUTSTANDING` reject transfer.
- `OPEN -> CREDIT_APPROVED` approve credit.
- `CREDIT_APPROVED -> OPEN` revoke only before admission consumed/clinical started and policy allows.
- `OPEN -> OUTSTANDING` supplementary finalized without payment/credit.
- `OPEN -> CANCELLED` ADMIN only, reason, no payment/credit and not used for admission.
Terminal financial facts: PAID, CANCELLED; OUTSTANDING accepts no second payment in MVP if a rejected Payment exists. No transition to REFUNDED (enum/API không tồn tại).

**Payment:** CASH `—> VERIFIED`; transfer `—> RECORDED -> VERIFIED | REJECTED`. VERIFIED/REJECTED terminal.

Invalid transition -> 409, no write/success event.

## 4. Invoice workflows
### Base
Reception calls CreateOrGetBaseInvoice after appointment validation. Billing gets Appointment snapshot through inbound request plus optionally verifies by Appointment gRPC. Local transaction creates invoice + lines + outbox. Total equals booking snapshot, never live Catalog price. Before Queue, Reception requires admission condition PAID or APPROVED_CREDIT.

### Supplementary
Medical Record sends each service when status becomes PERFORMED, including performedServiceId, service/description/amount snapshot and performedAt. Billing dedupes. ORDERED/CANCELLED/medicine rejected. Invoice may be created lazily. Clinical finalize closes calculation to OUTSTANDING unless paid/credit; debt does not block Encounter/Appointment completion. Late arriving valid performed event with higher aggregateVersion may append while OPEN/OUTSTANDING; if already PAID this is a reconciliation exception (do not mutate paid invoice; alert/manual policy out-of-scope).

## 5. REST contract
Base `/api/v1`; detail in OpenAPI.

| ID | Method/path | Actor | Idempotency |
|---|---|---|---|
| BILL-001 | GET `/invoices/{id}` | owner/staff | read |
| BILL-002 | GET `/invoices` | owner/staff filters | cursor |
| BILL-003 | POST `/invoices/{id}/payments` | Receptionist/Admin | required |
| BILL-004 | POST `/payments/{id}/verify` | authorized staff/Admin | required |
| BILL-005 | POST `/payments/{id}/reject` | authorized staff/Admin | required + reason |
| BILL-006 | POST `/invoices/{id}/credit-approvals` | ADMIN | required; SoD |
| BILL-007 | POST `/invoices/{id}/credit-approvals/{creditId}/revoke` | ADMIN | required + reason |
| BILL-008 | POST `/invoices/{id}/cancel` | ADMIN | required + reason; unpaid only |

Payment request amount must equal invoice total/balance exactly; no client currency override, no payment method outside enum. Manual transfer reference 3–100 chars and unique-normalized when present. There is deliberately no refund endpoint.

Errors: `400 VALIDATION_FAILED`, `401`, `403`, `404 INVOICE_NOT_FOUND`, `409 PAYMENT_ALREADY_EXISTS|IDEMPOTENCY_KEY_REUSED|INVALID_STATE_TRANSITION|VERSION_CONFLICT|PERFORMED_SERVICE_ALREADY_CHARGED`, `422 AMOUNT_MUST_EQUAL_TOTAL|PAYMENT_METHOD_NOT_SUPPORTED|CREDIT_NOT_ALLOWED|SERVICE_NOT_PERFORMED|MEDICINE_NOT_BILLABLE|ADMISSION_CONDITION_NOT_MET`, `503 DEPENDENCY_UNAVAILABLE`.

## 6. gRPC
### Inbound — `BillingInternalService`
- `CreateOrGetBaseInvoice`: Reception; appointment/pricing snapshot, same appointment returns same invoice; request mismatch -> conflict.
- `RecordAdmissionPayment`: Reception; chỉ nhận `CASH` hoặc `MANUAL_BANK_TRANSFER`, full amount và expected invoice version; idempotency bắt buộc.
- `GetInvoice`, `GetInvoiceByAppointment`: authorized internal reads.
- `GetAdmissionPaymentCondition`: Reception/Appointment; BASE only; returns PAID, APPROVED_CREDIT, NOT_SATISFIED.
- `AddPerformedServiceCharge`: Medical Record; exact performed evidence and snapshot; idempotent by performedServiceId.
- `FinalizeSupplementaryInvoice`: Medical Record; does not block clinical completion, returns balance.

Metadata/service auth/deadlines as Appointment: read ≤2s, write ≤3s, `x-idempotency-key` mandatory write; proto DTO không share DB entities.

### Outbound
| Dependency/method logical | Required | Failure |
|---|---:|---|
| Appointment `GetAppointment` | yes for verification/reconciliation | deadline 1s, bounded read retry; no create on mismatch/down |
| Medical Record `GetPerformedService` | optional defense/reconciliation when signed command has insufficient version | if required evidence absent -> reject; no blind charge |
| Audit Log event | async | outbox retry; core financial local audit remains |

Billing does **not** call Catalog for booking base amount and does not call Queue. Snapshot comes from Appointment; supplementary amount comes from approved clinical/service snapshot contract (price provenance required).

## 7. Business rules
| ID | Rule | Enforcement/error |
|---|---|---|
| BILL-BR-001 | Không BHYT; payer model private-pay only | Contract |
| BILL-BR-002 | Không refund/void paid amount/negative adjustment dưới mọi hình thức | API absent + DB checks |
| BILL-BR-003 | Tối đa đúng một Payment/Invoice ever | DB UNIQUE/PAYMENT_ALREADY_EXISTS |
| BILL-BR-004 | Không partial/mixed: amount == total and one method | App+DB/AMOUNT_MUST_EQUAL_TOTAL |
| BILL-BR-005 | Chỉ CASH hoặc MANUAL_BANK_TRANSFER; không gateway | Enum/PAYMENT_METHOD_NOT_SUPPORTED |
| BILL-BR-006 | CASH verified atomically; transfer cần explicit verify | State machine |
| BILL-BR-007 | Base invoice dùng immutable Appointment pricing snapshot | App/SNAPSHOT_MISMATCH |
| BILL-BR-008 | Base condition trước queue là PAID hoặc APPROVED_CREDIT | Domain |
| BILL-BR-009 | Credit chỉ ADMIN, reason, SoD; không đồng tồn tại Payment | Auth+DB/CREDIT_NOT_ALLOWED |
| BILL-BR-010 | Supplementary chỉ charge service PERFORMED, dedupe performedServiceId | App+DB/SERVICE_NOT_PERFORMED |
| BILL-BR-011 | Thuốc/medicine không charge | App/MEDICINE_NOT_BILLABLE |
| BILL-BR-012 | Supplementary outstanding không block clinical/Appointment completion | Contract |
| BILL-BR-013 | Giá giảm sau PAID giữ nguyên tiền và snapshot; không refund | Domain |
| BILL-BR-014 | paid invoice lines/amount/payment immutable | DB/app/INVALID_STATE_TRANSITION |
| BILL-BR-015 | Same idempotency key/hash -> same result; different hash -> 409 | DB/app |
| BILL-BR-016 | `total=sum(quantity*unit)`, integer VND, overflow-safe | DB/app |
| BILL-BR-017 | Invoice number opaque unique; no PII | generator+DB |
| BILL-BR-018 | Admission condition only BASE invoice | Domain |

## 8. GWT scenarios
| ID | GWT acceptance |
|---|---|
| BILL-SCN-001 | **Given** valid appointment snapshot total 400000 **When** Reception CreateOrGet twice same key **Then** one BASE invoice/two lines max/one event; same response. |
| BILL-SCN-002 | **Given** OPEN invoice 400000 **When** cashier records CASH 400000 **Then** Payment VERIFIED, Invoice PAID/balance0 atomically, event once. |
| BILL-SCN-003 | **Given** OPEN 400000 **When** request CASH 300000 or mixed method **Then** 422, no payment/state/event. |
| BILL-SCN-004 | **Given** transfer recorded **When** verify by authorized actor **Then** invoice PAID; retry same key no duplicate. |
| BILL-SCN-005 | **Given** transfer recorded **When** reject with reason **Then** Payment REJECTED, invoice OUTSTANDING; second Payment attempt ->409. |
| BILL-SCN-006 | **Given** no payment and requester R **When** same actor R tries approve credit **Then** 403/422 SoD, unchanged. |
| BILL-SCN-007 | **Given** ADMIN different actor approves credit **When** admission query **Then** APPROVED_CREDIT; paidMinor remains 0 and no Payment. |
| BILL-SCN-008 | **Given** service order ORDERED/CANCELLED **When** add charge **Then** 422 SERVICE_NOT_PERFORMED, no line/event. |
| BILL-SCN-009 | **Given** PERFORMED lab service **When** command/event duplicated **Then** exactly one supplementary line; duplicate returns same outcome. |
| BILL-SCN-010 | **Given** medicine marked performed/dispensed **When** charge requested **Then** 422 MEDICINE_NOT_BILLABLE. |
| BILL-SCN-011 | **Given** supplementary balance outstanding **When** encounter finalized **Then** invoice OUTSTANDING/event; clinical completion not rejected/rolled back. |
| BILL-SCN-012 | **Given** invoice PAID then Catalog price decreases **When** pricing event observed **Then** invoice/payment unchanged; no refund/adjustment. |
| BILL-SCN-013 | **Given** Payment exists **When** concurrent second payment requests **Then** at most one succeeds; loser 409; total paid never > total. |
| BILL-SCN-014 | **Given** commit succeeded/response lost **When** retry key K **Then** stored response, no second payment/event. |
| BILL-SCN-015 | **Given** Appointment verification timeout **When** base invoice create **Then** bounded retry then 503; no invoice. |
| BILL-SCN-016 | **Given** PAID invoice **When** any cancel/refund/line-change attempted **Then** 404 endpoint or 409; immutable audit evidence. |

## 9. Edge/failure/consistency
- Zero-price base invoice: create PAID without Payment only if total=0 (explicit system settlement); one-payment invariant remains zero rows. Admission returns PAID. This is DESIGN behavior; test explicitly.
- Transfer reference duplicate, amount overflow, quantity zero, VND mismatch, server-managed fields, stale If-Match, wrong owner: reject/no write.
- Event duplicate/out-of-order: consumed event + aggregateVersion; stale ignored/acked. A newer performed event can append once only while invoice mutable.
- DB commit/publish fail: outbox persists; response success if commit; publish retry. Required gRPC failure before transaction ->503. Notification/Reporting failure non-blocking.
- No distributed rollback: Reception saga/checkpoints retry create/get and condition query.

### RabbitMQ
Durable topic exchange `maternal.domain`, persistent + confirms, transactional outbox, at-least-once/DLQ. Standard envelope as Appointment; no bank reference, reason text, patient name or service PHI description in events.

| Event | Dir | Payload/handling |
|---|---|---|
| billing.invoice_created.v1 | out | invoiceId,type,appointmentId,patientId,totalMinor,currency,status |
| billing.payment_recorded.v1 | out | paymentId,invoiceId,method,status,amountMinor (no transfer ref) |
| billing.payment_confirmed.v1 | out | paymentId,invoiceId,appointmentId,paidAt,totalMinor |
| billing.payment_rejected.v1 | out | ids,status,reasonCode only |
| billing.credit_approved.v1 / credit_revoked.v1 | out | invoiceId,appointmentId,creditId,status,timestamp |
| billing.supplementary_charge_added.v1 | out | invoiceId,appointmentId,encounterId,performedServiceId,lineAmountMinor |
| billing.invoice_outstanding.v1 / invoice_cancelled.v1 | out | ids,balance/status/reasonCode |
| appointment.cancelled/rescheduled | in | không refund; flag reconciliation only; paid invoice unchanged |
| medical.service_performed.v1 | in | alternative async ingestion; validate version/dedupe; medicine ignored/rejected |
| medical.encounter_finalized.v1 | in | finalize supplementary asynchronously; never block clinical |

## 10. Security/audit/NFR/config
- Financial data confidential; transfer reference sensitive. Never log token, patient identity, bank reference, reason text, invoice response body. Mask reference in authorized response (last 4 only); raw encrypted at rest if stored.
- DTO allowlist; integer bounds; SQL parameterization; rate-limit payment commands; service identity allowlist; no trust client headers.
- Local immutable financial audit in transaction + async Audit event: actor/service, action, invoice/payment IDs, before/after state, amount/method, reasonCode, request/correlation, timestamp/outcome. Không đưa raw reference/free text vào central event.
- P95 local read ≤250ms/write ≤500ms excluding dependency; 99.9% DESIGN; stateless replicas. Metrics payment totals/count (no labels patient), outstanding aging, credit approval, conflict, outbox lag, dependency latency.

| Config | Default | Secret |
|---|---:|---:|
| PORT | TBD | No |
| DATABASE_URL | required | Yes |
| JWT_JWKS_URL/JWT_AUDIENCE | required | No |
| BUSINESS_TIMEZONE | Asia/Ho_Chi_Minh | No |
| CURRENCY | VND (startup reject khác) | No |
| APPOINTMENT_GRPC_TARGET | required | No |
| RABBITMQ_URL | required | Yes |
| IDEMPOTENCY_TTL_HOURS | 24 | No |
| OUTBOX_MAX_ATTEMPTS | 10 | No |
| PAYMENT_MAX_AMOUNT_MINOR | DESIGN 1000000000 | No |

Readiness DB required; RabbitMQ degraded with alert/outbox retry. No public port except Kong. Backups/restores and retention follow platform/legal policy (chưa có approved duration; không tự đặt).

## 11. Testing/acceptance/phases
### Traceability
- BILL-BR-001..009 -> SCN-001..007, invoice/payment/credit unit+DB+auth tests.
- BILL-BR-010..014 -> SCN-008..012/016, clinical consumer and immutability tests.
- BILL-BR-015..018 -> SCN-013..015, concurrency/idempotency/gRPC tests.
- OpenAPI lint; proto compile/breaking; contract tests with Reception/Appointment/Medical; event duplicate/stale/DLQ; audit/log redaction; money overflow and DB constraint tests.

### Acceptance
1. Một invoice không thể có payment thứ hai hoặc partial/mixed; chỉ CASH/manual transfer.
2. Không có endpoint/state/event refund; paid data immutable và price decrease không đổi tiền.
3. Admission condition chính xác: PAID hoặc APPROVED_CREDIT cho BASE.
4. Supplementary chỉ từ PERFORMED, không thuốc, dedupe; outstanding không block completion.
5. Mọi write idempotent, audit + outbox atomic, events không lộ bank ref/PHI.

### Phases
1. Schema/state/constraints/idempotency/audit/outbox.
2. Base invoice + Appointment gRPC + internal admission query.
3. Payment/verification/credit REST + security/SoD.
4. Supplementary gRPC/event consumers + reconciliation.
5. RabbitMQ, Reporting/Notification events, load/race/failure/security acceptance.

## 12. Assumptions/out-of-scope/open gates
- **Approved:** no BHYT/refund/partial/mixed/gateway; one payment; two methods; credit; performed-only supplementary; no medicine charge.
- **DESIGN:** transfer rejection consumes the sole payment slot; zero-total auto-settlement; maximum amount. Business owner must approve before implementation if operational process differs, nhưng không được làm yếu one-payment/no-refund.
- Out-of-scope: receipts/tax e-invoice, cash drawer/reconciliation, accounting GL, discount/promotion, installment, refund/chargeback, pharmacy/inventory, multi-currency/facility.
- Outbound Appointment/Medical methods are required target contracts; owner services must approve corresponding proto if absent. Data retention/legal policy remains external gate.
