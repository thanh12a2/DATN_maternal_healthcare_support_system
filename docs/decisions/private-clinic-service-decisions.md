# Quyết định chính thức cho mô hình phòng khám tư nhân

> **Status:** APPROVED baseline  
> **Decision date:** 2026-10-03  
> **Nguồn:** docs/ba-service-decisions-voting.xlsx, lựa chọn của Nam và các clarification đã được phê duyệt sau workbook.  
> **Quy tắc ưu tiên:** clarification trong tài liệu này thay thế option cũ trong workbook khi có xung đột. Cột biểu quyết và Quyết định cuối trong workbook hiện chưa được điền; vì vậy workbook chỉ cung cấp ID/option để trace, còn tài liệu này là source of truth đã duyệt cho implementation.

## 1. Cách đọc trạng thái

- **APPROVED:** quyết định nghiệp vụ/kiến trúc chính thức, implementation không được tự thay đổi.
- **DESIGN:** chi tiết kỹ thuật đề xuất để các spec thống nhất; phải được review trước khi coi là contract production.
- Mọi thay đổi APPROVED phải cập nhật decision log, spec bị ảnh hưởng, OpenAPI/proto và event catalog trước khi implement.

## 2. Bối cảnh và invariant đã duyệt

| ID | Status | Quyết định |
|---|---|---|
| PC-001 | APPROVED | Một phòng khám tư nhân, một cơ sở, chỉ khám dịch vụ; không có BHYT. |
| PC-002 | APPROVED | Không tồn tại phân loại giá/lịch hẹn NORMAL và SERVICE. Booking channel chỉ là ONLINE, RECEPTION hoặc WALK_IN. |
| PC-003 | APPROVED | Public API là REST qua Kong. Mọi synchronous internal call là gRPC trực tiếp, không đi qua Kong. |
| PC-004 | APPROVED | Domain event dùng RabbitMQ, transactional outbox, at-least-once delivery và idempotent consumer. |
| PC-005 | APPROVED | Mỗi service có database riêng; không cross-database query/FK, không distributed transaction. ID ngoài boundary là external reference. |
| PC-006 | APPROVED | Timestamp lưu/truyền UTC; business timezone Asia/Ho_Chi_Minh; tiền là integer minor unit VND. |
| PC-007 | APPROVED | Chỉ trao đổi minimum necessary data; service JWT RS256, deadline, idempotency key và correlation ID bắt buộc theo convention. |

## 3. Traceability workbook và clarification

### 3.1 Scope và Appointment

| Workbook ID | Priority | Status | Quyết định chính thức | Mapping/ghi chú |
|---|---:|---|---|---|
| S01 | P0 | APPROVED | Viết full implementation-ready spec cho 11 service: Appointment, Billing, Medical Record, Queue, Notification, Document, Prescription, Treatment Plan, Audit Log, Reporting, Consultation. | Clarification mở rộng Option B; không chỉ roadmap. |
| A01 | P0 | APPROVED | Chỉ một mô hình appointment khám dịch vụ. Channel là ONLINE, RECEPTION, WALK_IN và không quyết định giá. | Supersede Option A và loại NORMAL/SERVICE. |
| A02 | P0 | APPROVED | Booking có thời điểm bắt đầu/kết thúc cụ thể; không có luồng khám thường chỉ chọn ngày/ca. | Điều chỉnh theo mô hình service-only. |
| A03 | P0 | APPROVED | Patient được chọn doctor cụ thể hoặc chọn consultation rank để hệ thống phân doctor phù hợp. | Clarification tương đương hỗ trợ cả hai. |
| A04 | P0 | APPROVED | Booking trả appointment code, dịch vụ, doctor/rank, thời gian, pricing snapshot và queue estimate. Không tạo QueueTicket/số thứ tự authoritative khi booking. | Theo Option A. |
| A05 | P1 | APPROVED | SlotHold TTL đúng 5 phút, tự hết hạn, chống race; retry không kéo dài hold vô hạn. | Theo Option A. |
| A06 | P1 | APPROVED | Patient không tự cancel/reschedule. Chỉ Receptionist/Admin có quyền, bắt buộc reason và audit; reschedule bảo toàn liên kết lịch sử. | Theo clarification, supersede workbook Option A. |
| A07 | P0 | APPROVED | Doctor nghỉ/deactivate: booking chọn doctor chuyển workflow cần confirmation/reassignment; booking chọn rank có thể tự phân doctor rank tương đương theo rule. | Không dùng NORMAL/SERVICE; giảm giá sau thanh toán không hoàn tiền. |
| A08 | P0 | APPROVED | Trễ hơn 30 phút vẫn tiếp nhận nhưng Queue demote. Chưa check-in sau ngưỡng grace thì Appointment có thể NO_SHOW theo job/rule owner. | Early check-in threshold là DESIGN/config, không tự coi là quyết định nếu chưa duyệt. |

### 3.2 Billing và Admission

| Workbook ID | Priority | Status | Quyết định chính thức | Mapping/ghi chú |
|---|---:|---|---|---|
| B01 | P0 | APPROVED | Phí cơ bản phải được trả đủ trước khi tạo QueueTicket, hoặc có approved credit authoritative từ Billing. | Theo Option A. |
| B02 | P0 | APPROVED | Khoản thu trước queue là phí khám cơ bản 100%, không phải tiền đặt cọc/tạm ứng chung. | Theo Option A. |
| B03 | P1 | APPROVED | Payment method chỉ CASH hoặc MANUAL_BANK_TRANSFER. Không payment gateway, BHYT, mixed payment trong MVP. | Clarification chọn Option B và thu hẹp scope. |
| B04 | P0 | APPROVED | Invoice bổ sung chỉ charge dịch vụ đã PERFORMED. Prescription/thuốc không tạo charge vì không có pharmacy/inventory/sale. | Theo Option A. |
| B05 | P0 | APPROVED | Đúng một Payment cho một Invoice; không partial, multiple hay mixed payment. | Theo Option B. |
| B06 | P0 | APPROVED | Trước thanh toán có thể lập pricing snapshot/quote mới cần xác nhận. Sau thanh toán, nếu giá giảm vẫn giữ số tiền đã thu; không refund. Nếu phát sinh tăng, Billing quản lý nghĩa vụ bổ sung theo spec. | Clarification supersede adjustment/refund của Option A. |
| B07 | P1 | APPROVED | Không hoàn tiền dưới mọi hình thức. Không có REFUND flow. Invoice chưa thanh toán có thể void theo rule; payment đã ghi nhận là immutable financial history. | Theo Option B, áp dụng tuyệt đối. |
| X01 | P0 | APPROVED | Admission canonical: validate appointment → verify identity → open ReceptionCase → create/get invoice → payment hoặc approved credit → open Encounter DRAFT → check-in Appointment → create QueueTicket → complete. | Thứ tự bắt buộc; QueueTicket chỉ sau payment/credit và check-in. |
| X02 | P0 | APPROVED | Clinical completion quyết định Appointment COMPLETED. Nợ bổ sung ở Billing không khóa clinical record hay Appointment completion. | Theo Option A. |

### 3.3 Medical và clinical subdomains

| Workbook ID | Priority | Status | Quyết định chính thức | Mapping/ghi chú |
|---|---:|---|---|---|
| M01 | P0 | APPROVED | Mỗi Appointment có đúng một ClinicalEncounter chính; clinical subresources tham chiếu encounter. | Theo Option A. |
| M02 | P0 | APPROVED | Có PregnancyEpisode; một patient có nhiều episode lịch sử và tối đa một active episode. | Theo Option A. |
| M03 | P0 | APPROVED | Structured clinical data là authoritative; scan/tài liệu là bổ sung và do Document Service quản lý. | Theo Option A. |
| M04 | P0 | APPROVED | Authorization dựa trên assignment và minimum necessary: Nurse nhập vital, Technician nhập result, assigned Doctor chẩn đoán/review/finalize; Reception không sửa clinical data; Patient chỉ xem phần released. | Theo Option A. |
| M05 | P0 | APPROVED | Encounter: DRAFT → IN_PROGRESS → AWAITING_RESULTS → READY_FOR_REVIEW → FINALIZED. Sau FINALIZED chỉ sửa bằng amendment append-only. | Theo Option A. |
| M06 | P0 | APPROVED | Một encounter chính có service orders/results qua nhiều phòng; QueueJourney có ticket cho từng stage/phòng. | Theo Option A, không tạo encounter riêng mỗi phòng. |
| M07 | P1 | APPROVED | Document, Prescription và Treatment Plan là ba bounded context/service riêng trong bộ 11 specs. | Theo clarification, tương ứng workbook Option B. |

### 3.4 Queue

| Workbook ID | Priority | Status | Quyết định chính thức | Mapping/ghi chú |
|---|---:|---|---|---|
| Q01 | P0 | APPROVED | QueueJourney theo Appointment; QueueTicket theo từng stage/phòng. Phase đầu có thể một stage nhưng model không giới hạn một ticket toàn hành trình. | Theo Option A. |
| Q02 | P0 | APPROVED | Queue partition theo business date/session/stage hoặc room; doctor là assignment, không mặc định là queue key. | Theo Option A, một cơ sở. |
| Q03 | P0 | APPROVED | Không ưu tiên theo NORMAL/SERVICE vì các loại này không tồn tại. Clinical override có quyền+reason; late bị demote; còn lại server áp dụng policy công bằng và chống starvation. | Clarification supersede Option A cũ. Trọng số chi tiết là DESIGN/config. |
| Q04 | P0 | APPROVED | Late > 30 phút vẫn được admission; ticket bị demote, không tự cancel appointment. | Theo Option A, bỏ cụm lớp khám thường. |
| Q05 | P0 | APPROVED | Sau khi gọi mà vắng: chờ 5 phút, gọi tối đa 2 lần rồi SKIPPED; requeue phải có quyền và reason. | Theo Option A. |
| Q06 | P1 | APPROVED | CallNext do server quyết định. Manual override cần permission riêng, reason và audit. | Theo Option A. |

### 3.5 Notification và architecture

| Workbook ID | Priority | Status | Quyết định chính thức | Mapping/ghi chú |
|---|---:|---|---|---|
| N01 | P0 | APPROVED | Kênh MVP: in-app, push adapter/mock và email. Không tích hợp SMS provider. | Theo Option A nhưng SMS hoàn toàn out of scope MVP. |
| N02 | P0 | APPROVED | Thông báo tối thiểu: booking, reminder, reschedule/cancel bởi staff, reassignment, queue called, payment/credit/outstanding, result available. | Theo Option A và clarification. |
| N03 | P1 | APPROVED | Reminder trước 24 giờ và 1 giờ; thay đổi lịch hủy lịch nhắc cũ và schedule lại. | Theo Option A. |
| N04 | P0 | APPROVED | Notification không chứa diagnosis/result/pregnancy detail hay PHI chi tiết; chỉ cung cấp thông tin tối thiểu và yêu cầu đăng nhập. | Theo Option A, áp dụng cả push/email/in-app preview. |
| N05 | P1 | APPROVED | Chưa có notification preference trong MVP. Transactional notifications theo policy hệ thống. | Theo Option C. |
| T01 | P1 | APPROVED | RabbitMQ là broker domain event của MVP. | Theo Option A. |

## 4. Các bounded context được duyệt thêm

| Service | Status | Ownership và state chính | Out of scope bắt buộc |
|---|---|---|---|
| Document | APPROVED | Private immutable/versioned object metadata, access grant, malware scan status. | Public bucket, sửa blob tại chỗ. |
| Prescription | APPROVED | DRAFT → ISSUED → CANCELLED; medication instructions lâm sàng. | Pharmacy, inventory, dispense, sale và charge thuốc. |
| Treatment Plan | APPROVED | DRAFT → ACTIVE → COMPLETED hoặc CANCELLED. | Billing ownership và tự kê đơn. |
| Audit Log | APPROVED | Async append-only audit records; query theo quyền. | Thay thế local transactional outbox/audit cần rollback cùng command. |
| Reporting | APPROVED | Event-driven read models và CSV export. | Cross-DB query, authoritative business state. |
| Consultation | APPROVED | Async patient-doctor messaging, assignment/relationship-based access. | AI, video call, emergency triage và clinical prescribing từ chat. |

## 5. Chi tiết còn ở trạng thái DESIGN

- Danh mục consultation rank/code cụ thể và thứ tự tương đương; Doctor là owner, Catalog map surcharge bằng code.
- Early check-in threshold và no-show grace duration; phải cấu hình và được Appointment spec duyệt.
- Queue session definition, room/stage registry và weighted fairness parameters; Queue là owner.
- Retention cụ thể cho audit, message, document và reporting export.
- SLO/timeout cụ thể theo môi trường; mọi RPC vẫn phải có deadline ngay từ đầu.

Không được dùng các mục DESIGN để khôi phục NORMAL/SERVICE, BHYT, refund, patient self-cancel hoặc bất kỳ quyết định đã bị supersede nào.
