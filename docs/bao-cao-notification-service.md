# Báo cáo rà soát Notification Service

**Ngày rà soát:** 01/11/2026  
**Phạm vi:** source code, database schema, tài liệu hợp đồng, các service phát sự kiện và giao diện trong workspace hiện tại.  
**Phương pháp:** đọc code và tài liệu; kiểm tra trạng thái container và số lượng bản ghi bằng truy vấn chỉ đọc. Chưa thực hiện kiểm thử gửi thông báo đầu cuối, chưa sửa dữ liệu hay triển khai thay đổi.

**Phạm vi triển khai hiện tại theo yêu cầu:** chỉ thông báo hiển thị trong website (`IN_APP`). App bệnh nhân, push, email và SMS không thuộc phạm vi hiện tại; các nhắc đến chúng ở phần hiện trạng chỉ nhằm phản ánh code hoặc tài liệu đang có.

## 1. Kết luận

Notification Service hiện có database, consumer RabbitMQ cơ bản và API gRPC nội bộ để tra cứu delivery. **Chưa có luồng hoàn chỉnh từ sự kiện nghiệp vụ đến inbox trên giao diện.** Có những điểm cản trở luồng event, chưa có REST inbox, chưa có worker gửi email/push và giao diện chưa nối với Notification Service.

Tài liệu service được đánh dấu **DESIGN**: những gì được mô tả trong đó không đồng nghĩa đã được triển khai. Trước khi mở rộng cho tất cả vai trò, nên hoàn thiện và kiểm thử một luồng mẫu: **đặt lịch thành công → bệnh nhân thấy thông báo trên website**.

### Quy ước trong báo cáo

- **Đã có:** thấy implementation trong source. Không mặc định đã hoạt động đầu cuối.
- **Một phần:** có model, code nền hoặc giao diện nhưng thiếu các bước để dùng thực tế.
- **Chưa thấy:** không tìm thấy implementation trong phạm vi source đã rà soát; không kết luận về các hệ thống hoặc cấu hình bên ngoài workspace.
- **Đề xuất:** hành vi cần thảo luận và triển khai, không phải chức năng hiện hữu.

## 2. Tài liệu và code đã rà soát

- [Đặc tả Notification Service](service_specs/notification-service-spec.md) — trạng thái DESIGN, mô hình event-first và yêu cầu nghiệp vụ.
- [OpenAPI Notification Service](api-specs/notification-service.yaml) — hợp đồng REST được mô tả, cần đối chiếu lại với đặc tả service.
- [Danh mục RabbitMQ event](integration/rabbitmq-event-catalog.md) — danh sách sự kiện dự kiến giữa các service.
- [gRPC contract Notification](grpc/notification/v1/notification_internal.proto) và [proto runtime](../services/proto/notification/v1/notification_internal.proto).
- [Notification service](../services/apps/notification-service/src/notification.service.ts), [controller](../services/apps/notification-service/src/notification.controller.ts), [module](../services/apps/notification-service/src/notification-service.module.ts) và [schema](../services/prisma/notification/schema.prisma).
- [RabbitMQ consumer](../services/libs/platform/src/rabbitmq/rabbitmq.consumer.ts), [publisher](../services/libs/platform/src/rabbitmq/rabbitmq.publisher.ts) và [OutboxRelay](../services/libs/platform/src/outbox/outbox-relay.ts).
- [Appointment service](../services/apps/appointment-service/src/appointments/appointment.service.ts), [Billing service](../services/apps/billing-service/src/billing/billing.service.ts), [Queue service](../services/apps/queue-service/src/queue/queue.service.ts) và [Consultation service](../services/apps/consultation-service/src/consultation.service.ts).
- [Cấu hình Kong](api-specs/kong.yml), [Docker Compose](../docker-compose.yml), [Doctor header](../frontend/src/modules/doctor/components/DoctorWorkspaceFrame.tsx), [Patient home](../frontend/src/modules/patient/pages/PatientHomePage.tsx) và [Patient notifications](../frontend/src/modules/patient/pages/PatientNotificationsBillingPage.tsx).

## 3. Hiện trạng đã xác minh

### 3.1. Database

| Thành phần | Hiện trạng trong schema | Nhận xét |
|---|---|---|
| `notifications` | Có event nguồn, account nhận, category, title, body, resource, `readAt`, thời gian tạo | Có dữ liệu nền cho inbox, nhưng chưa có REST inbox hoặc thao tác đọc trong controller. |
| `delivery_attempts` | Có channel, status, số lần thử, provider ID, mã lỗi, thời gian | Code hiện dùng bản ghi này để biểu diễn các channel ban đầu; chưa thấy worker thực hiện gửi và retry. |
| `notification_consumed_events` | Có `eventId` làm khóa chính | Có nền tảng dedupe event; cách dùng hiện tại chưa đáp ứng một event được xử lý cho nhiều người nhận. |
| Category | BOOKING, REMINDER, REASSIGNMENT, QUEUE, PAYMENT, RESULT | Đây là các giá trị trong schema; không đồng nghĩa đã có đầy đủ luồng cho từng loại. |
| Channel | IN_APP, PUSH, EMAIL | Chưa thấy adapter gửi email/push thực tế trong Notification Service. |

Tại lần kiểm tra máy cục bộ: `notification-database` và RabbitMQ đang chạy; **không có container `notification-service` trong danh sách Compose**. Database có 6 dòng notification, 0 delivery attempt và 0 consumed event. Đây là ảnh chụp tại thời điểm kiểm tra, có thể thay đổi sau khi người dùng chạy service hoặc seed.

[Script seed](../services/seed_system_data.js) chèn trực tiếp một số notification mẫu; sự hiện diện của các dòng đó **không chứng minh** luồng producer → RabbitMQ → consumer → UI đã hoạt động. Một số nội dung seed có chi tiết y tế; cần rà lại nếu dùng để trình diễn cơ chế gửi ra ngoài.

### 3.2. API và controller

| API trong code hiện tại | Trạng thái | Giới hạn |
|---|---|---|
| HTTP `GET /health` | Đã có | Chỉ là health cơ bản; chưa thấy `/ready` trong controller. |
| gRPC `GetDeliveryStatus` | Đã có, guard service JWT và scope `notification:read` | Trả metadata delivery; không phải inbox public. |
| gRPC `ListRecipientDeliveries` | Đã có, guard service JWT và scope `notification:read` | Lấy các dòng delivery theo recipient. Các bộ lọc channel/status có trong proto nhưng method hiện chưa áp dụng chúng. |
| REST inbox, unread, read, read-all | Chưa thấy implementation | OpenAPI/spec có mô tả nhưng controller hiện không có các route này. |
| REST đăng ký/hủy thiết bị push | Chưa thấy implementation | Chưa có model PushEndpoint; chức năng này không thuộc phạm vi website hiện tại. |

Method gRPC `list` hiện trả các dòng **delivery**, không trả inbox item đầy đủ gồm title/body/readAt; một notification có thể có nhiều dòng channel. Không nên dùng trực tiếp kết quả này như danh sách thông báo của frontend.

### 3.3. Consumer hiện có

Khi có `RABBITMQ_URL`, service đăng ký queue `maternal.notification.delivery.v1` và các binding:

```text
appointment.*
billing.*
medical.result_released.v1
queue.ticket_called.v1
```

Consumer đọc `recipientAccountId` hoặc `patientAccountId` trong `event.data`. Nếu tìm thấy, nó tạo notification và các dòng channel trong transaction, sau đó ghi event đã consume. Nội dung hiện tại là text chung; `IN_APP` được ghi `DELIVERED`, còn `PUSH` và `EMAIL` được tạo theo giá trị mặc định `PENDING`.

**Giới hạn quan trọng:** `IN_APP = DELIVERED` ở đây chỉ phản ánh việc tạo bản ghi; chưa chứng minh người dùng có inbox hoặc đã nhìn thấy thông báo. Hai dòng `PUSH`/`EMAIL` đang chờ không đồng nghĩa đã có worker gửi.

### 3.4. Giao diện

- **Doctor:** header có nút chuông, nhưng nút chưa có xử lý mở inbox hay lấy unread từ Notification Service. Consultation có dữ liệu/trạng thái chưa đọc riêng của Consultation, không phải inbox Notification.
- **Patient:** trang **Thông báo & Hóa đơn** hiện là nội dung chờ; phần “Không có thông báo mới” trên trang tổng quan là nội dung cố định.
- **Receptionist, Clinic Manager, Admin:** chưa thấy inbox Notification Service dùng chung trong các giao diện đã rà soát. Các toast/modal thành công hoặc thất bại là phản hồi thao tác tức thời, không phải thông báo được lưu. Dù source có khai báo route `NURSE`, vai trò này không thuộc phạm vi đề xuất theo yêu cầu hiện tại.
- **Queue:** service có cơ chế realtime/SSE riêng cho thay đổi hàng đợi. Không nên mặc định đồng nhất cơ chế này với Notification Service; cần kiểm tra từng consumer frontend khi tích hợp.

## 4. Các vấn đề cần xử lý

### P0 — Ngăn luồng event hoạt động đúng

1. **Binding RabbitMQ không khớp event có version.** Exchange dùng loại `topic`; `*` khớp đúng một thành phần phân tách bởi dấu chấm. Do đó `appointment.*` không khớp `appointment.booked.v1`, và `billing.*` không khớp `billing.payment_recorded.v1`. Cần thống nhất dùng binding chính xác hoặc pattern phù hợp với event được duyệt.
2. **Thiếu account người nhận.** Payload outbox Appointment đã kiểm tra chứa `patientId`, không chứa `recipientAccountId`/`patientAccountId`; payload Billing được kiểm tra chứa ID hóa đơn/lịch và trạng thái. Consumer hiện bỏ qua message thiếu account và handler trả thành công, nên message được ACK mà không tạo notification. Cần xác định người nhận một cách tin cậy; không dùng `patientId` hoặc `doctorId` thay thế `accountId` theo giả định.
3. **Chưa thấy worker nối outbox của producer với RabbitMQ.** Có class OutboxRelay dùng routing key là `eventType` và có các bảng/điểm ghi outbox, nhưng chưa tìm thấy service worker khởi tạo/chạy relay trong các producer đã rà soát. Cần xác minh, triển khai và kiểm thử theo từng producer; ghi outbox chưa tương đương phát event.
4. **Không có inbox public và route gateway.** Chưa thể kết nối frontend an toàn chỉ bằng hai gRPC nội bộ hiện tại. Cần API lấy inbox/unread/đánh dấu đọc theo JWT và cấu hình route Kong sau khi thống nhất contract.

### P1 — Độ tin cậy và quyền

5. **Mã template không đúng:** `eventType.replace(/./g, '_')` thay mọi ký tự thành dấu gạch dưới. Cần sửa và có test cho từng event/template.
6. **Dedupe một event cho nhiều người:** consumer kiểm tra `eventId` toàn cục trước khi tạo notification. Cần thiết kế lại cách xử lý nếu cùng sự kiện cần gửi cho bệnh nhân, bác sĩ hoặc nhiều nhân viên. Định nghĩa khóa dedupe theo event, recipient, template và channel phải nhất quán với cách fan-out.
7. **Lỗi consumer:** code hiện `nack(..., false, false)` khi handler lỗi và không khai báo DLX cho queue trong code. Nếu broker không có policy DLX riêng, message có thể bị loại bỏ. Chưa thấy retry/backoff/DLQ hoàn chỉnh theo spec.
8. **Chưa có kiểm tra nội dung event/template theo allowlist:** cần kiểm tra loại/version, trường bắt buộc, recipient, resource và nội dung an toàn trước khi ghi. Message không hợp lệ phải có cách theo dõi và xử lý rõ ràng.
9. **Quyền inbox:** REST cần lấy account từ JWT, không tin recipient ID do client cung cấp; chỉ chủ sở hữu được xem/đánh dấu đọc. Các gRPC nội bộ cần giới hạn scope và ngữ cảnh truy cập theo contract.
10. **Các kênh ngoài website:** chưa thấy worker email/push hoặc quản lý endpoint trong Notification Service. Vì yêu cầu hiện tại chỉ là website, không cần triển khai các kênh này; không báo chúng đã gửi chỉ vì có bản ghi chờ.

### P2 — Chất lượng trải nghiệm

11. **Nội dung hiện tại quá chung và chưa có deep link nghiệp vụ.** Cần template được duyệt theo loại sự kiện, hiển thị thông tin tối thiểu và dẫn tới trang đúng; trang đích vẫn phải kiểm tra quyền.
12. **Chưa có kiểm thử thực chất cho notification:** test hiện tại chỉ là kiểm tra boundary rất cơ bản. Cần unit, integration và kiểm thử đầu cuối theo các tiêu chí ở mục 9.
13. **Trạng thái trống giả trên frontend:** dòng “Không có thông báo mới” không dựa trên dữ liệu backend. Cần phân biệt đang tải, chưa có, lỗi và chưa hỗ trợ.

## 5. Sự khác nhau giữa các tài liệu

| Chủ đề | Service spec | OpenAPI / code hiện tại | Việc cần chốt |
|---|---|---|---|
| Trạng thái | Service spec ghi DESIGN | Controller chưa triển khai REST inbox | Chọn contract chuẩn trước, sau đó triển khai và cập nhật tài liệu. |
| Inbox path | `/api/notifications/in-app` | OpenAPI mô tả server `/api/v1` và `/notifications` | Chọn một đường dẫn public thống nhất với Kong và frontend. |
| Đánh dấu đọc | Spec mô tả POST | OpenAPI mô tả PUT | Chọn method và quy tắc idempotency; cập nhật cả hai tài liệu. |
| Push device | Spec mô tả register/revoke | Chưa thấy trong OpenAPI đang rà soát và controller | Chốt phạm vi MVP và contract nếu cần push. |
| SMS | Spec nói không có SMS trong MVP | OpenAPI/proto có enum SMS; schema Notification không có SMS | Không suy luận đã hỗ trợ SMS; thống nhất lại contract. |
| Tên event kết quả | Spec có `medical.result_available` | Event catalog/consumer dùng `medical.result_released.v1` | Chọn tên, version và thời điểm phát khi được phép công bố. |

## 6. Đề xuất luồng thông báo

Các mục dưới đây là **đề xuất**, không khẳng định event hay UI đã được triển khai.

| Ưu tiên | Luồng và điều kiện | Service phát / sở hữu sự thật | Người nhận | Trang / vị trí hiển thị |
|---|---|---|---|---|
| P1 | Đặt lịch thành công | Appointment | Patient; Doctor được phân công nếu nghiệp vụ cần | Chuông/inbox Patient và Doctor; lịch hẹn Patient; lịch khám Doctor. |
| P1 | Đổi giờ, ngày, phòng, bác sĩ hoặc hủy lịch | Appointment | Patient và Doctor bị ảnh hưởng; Receptionist nếu cần xử lý | Inbox và trang lịch của từng vai trò; tiếp nhận/phân công của Receptionist. |
| P1 | Nhắc lịch 24 giờ / 1 giờ | Appointment hoặc scheduler được thống nhất | Patient | Inbox Patient trên website. Scheduler phải kiểm tra lịch còn hiệu lực trước khi phát. |
| P1 | Tạo số thứ tự, gọi đến lượt, đổi phòng, bỏ lượt | Queue | Patient; lễ tân xử lý khi cần | Trang hàng đợi Patient; bảng tiếp nhận/điều phối của Receptionist; chuông nếu đang ở trang khác. |
| P1 | Có tin nhắn tư vấn mới | Consultation | Doctor hoặc Patient ở phía nhận | Inbox/chuông, badge cuộc hội thoại, trang tư vấn. Không đưa nội dung chat vào event hay thông báo. |
| P1 | Tư vấn được phân công/chuyển bác sĩ | Consultation | Doctor mới; nhân viên điều phối nếu cần | Trang tư vấn Doctor và khu vực điều phối. |
| P2 | Hóa đơn cần thanh toán, thanh toán xác nhận/từ chối, khoản phát sinh | Billing | Patient; Receptionist khi cần tiếp tục xử lý | Thông báo & Hóa đơn Patient; bàn thanh toán/tiếp nhận Receptionist. |
| P2 | Kết quả được phép công bố | Medical Record hoặc service sở hữu kết quả sau khi chốt contract | Patient; Doctor nếu có yêu cầu xử lý | Inbox và hồ sơ sức khỏe Patient; hồ sơ khám Doctor khi phù hợp. Chỉ dùng nội dung chung. |
| P2 | Đơn thuốc được xác nhận hoặc hủy | Prescription | Patient | Inbox, đơn thuốc/hồ sơ sức khỏe Patient. Nội dung thông báo chỉ nêu có cập nhật, không hiển thị danh sách thuốc. |
| P2 | Kế hoạch điều trị kích hoạt hoặc thay đổi quan trọng | Treatment Plan | Patient | Inbox và trang kế hoạch điều trị Patient. Không gửi chi tiết nhạy cảm ra ngoài. |
| P3 | Lịch cần phân công lại do bác sĩ không khả dụng | Doctor/Appointment theo contract | Clinic Manager/Receptionist; Patient/Doctor khi thay đổi được xác nhận | Trang phân công/lịch của Manager và Receptionist; inbox các bên liên quan. |
| P3 | Xuất báo cáo hoàn tất hoặc thất bại | Reporting | Người yêu cầu | Trang báo cáo và inbox Admin/Manager; link tải phải có quyền và thời hạn. |
| P3 | Thay đổi bảo mật tài khoản | Auth nếu sản phẩm chốt yêu cầu | Chủ tài khoản | Trung tâm thông báo tài khoản trên website; không chứa mã xác minh hoặc link đặt lại mật khẩu. |

**Quy tắc chống làm phiền:** không tạo thông báo lưu trữ cho từng thay đổi vị trí hàng đợi hoặc mỗi trạng thái trung gian. Chỉ gửi sự kiện người dùng cần hành động hoặc cần biết; gom các cập nhật có thể lặp và đặt thời hạn cho thông báo có tính tức thời.

### 6.1. Phạm vi hiện tại: chỉ thông báo trên website

**Phần này là đề xuất, chưa phải chức năng đã có.** Giai đoạn hiện tại chỉ triển khai một kênh `IN_APP` để hiển thị trong website. Mục tiêu là chuông, số chưa đọc, danh sách thông báo, đánh dấu đã đọc và chuyển tới trang nghiệp vụ phù hợp.

```text
Service nghiệp vụ phát sự kiện
  → Notification service xác định account nhận
  → Lưu một mục thông báo vào inbox của account
  → Website gọi API để hiển thị inbox và số chưa đọc
```

App bệnh nhân, push, email, SMS, đăng ký thiết bị, provider và quản lý tùy chọn các kênh **không thuộc phạm vi triển khai hiện tại**. Có thể đánh giá lại về sau khi người dùng yêu cầu; không cần xây dựng hạ tầng cho chúng ở giai đoạn này. Hiện code vẫn khai báo và tạo bản ghi cho một số kênh khác: đây là **hiện trạng cần xử lý khi triển khai**, không phải yêu cầu bật các kênh đó.

### 6.2. Các khái niệm và delivery đề xuất

| Khái niệm | Đề xuất trong phạm vi website |
|---|---|
| Notification / inbox item | Một bản ghi thông báo cho mỗi account nhận; chứa nội dung tối thiểu, tài nguyên liên quan, thời gian tạo và `readAt`. |
| Delivery `IN_APP` | Ghi nhận kết quả đưa thông báo vào inbox của account trên hệ thống. Không cần tạo bản ghi riêng cho từng trình duyệt hoặc từng tab. |
| Delivery attempt | Nếu triển khai worker/retry, ghi nhận mỗi lần xử lý và lỗi an toàn để vận hành; không bắt buộc tạo hạ tầng provider bên ngoài. |
| Read state | `readAt = null` là chưa đọc; khác null là đã đọc. Khi cùng tài khoản đăng nhập ở trình duyệt khác, trạng thái dựa trên dữ liệu server. |

**Delivery state và read state khác nhau:** `DELIVERED` chỉ có nghĩa thông báo đã được ghi vào inbox, không có nghĩa người dùng đã mở hoặc đọc. Số chưa đọc được tính theo inbox item có `readAt = null`, không tính theo số delivery hay tab trình duyệt.

Không đưa nguyên văn OTP, mã xác minh, link đặt lại mật khẩu, nội dung tư vấn hoặc chi tiết y tế vào inbox; thông báo bảo mật nếu cần chỉ dùng nội dung chung.

### 6.3. Delivery state đề xuất cho website

Các trạng thái dưới đây là **đề xuất cần thống nhất**, không phải khẳng định schema hiện tại đã hỗ trợ đầy đủ:

| Trạng thái | Ý nghĩa trong luồng `IN_APP` | Xử lý |
|---|---|---|
| `PENDING` | Đã tiếp nhận công việc tạo thông báo, đang chờ xử lý. | Chờ worker xử lý nếu thiết kế dùng hàng đợi nội bộ. |
| `PROCESSING` | Worker đã nhận công việc và đang xử lý. | Cần cơ chế phục hồi nếu worker dừng giữa chừng; chỉ dùng khi thực sự có worker bất đồng bộ. |
| `DELIVERED` | Mục thông báo đã được ghi thành công vào inbox của đúng account. | Website có thể lấy qua API; trạng thái đọc được quản lý riêng bằng `readAt`. |
| `FAILED_RETRYABLE` | Xử lý thất bại tạm thời, ví dụ database gián đoạn. | Ghi lỗi an toàn và thử lại có giới hạn nếu thông báo còn hiệu lực. |
| `FAILED_PERMANENT` | Không thể xử lý theo chính sách, ví dụ payload không hợp lệ sau phân loại hoặc đã hết số lần thử. | Ngừng tự thử; ghi nhận để vận hành kiểm tra. |
| `SUPPRESSED` | Chủ động không tạo inbox theo chính sách nghiệp vụ được thống nhất. | Lưu lý do an toàn; không hiển thị như đã giao. |
| `EXPIRED` | Công việc chưa được đưa vào inbox và đã quá thời hạn hữu ích. | Không tạo thông báo muộn. Thời hạn hiển thị của mục đã có trong inbox cần được quản lý riêng nếu sản phẩm yêu cầu. |

Luồng khái quát khi có worker:

```text
PENDING → PROCESSING → DELIVERED
                     ├→ FAILED_RETRYABLE → PENDING / PROCESSING
                     └→ FAILED_PERMANENT
PENDING / FAILED_RETRYABLE → SUPPRESSED hoặc EXPIRED theo chính sách
```

Nếu consumer tạo notification và inbox trong cùng transaction thì có thể không cần `PENDING`/`PROCESSING` làm trạng thái delivery bền vững; cần chốt mô hình nhất quán thay vì thêm trạng thái không dùng. `SENT` và các trạng thái xác nhận từ provider không cần thiết cho phạm vi chỉ có inbox website.

### 6.4. Thông báo nên hiện trên website

| Luồng | Đề xuất hiển thị |
|---|---|
| Đặt lịch thành công; đổi/hủy lịch, bác sĩ hoặc phòng | Inbox và trang lịch liên quan của Patient/Doctor. |
| Nhắc lịch 24 giờ / 1 giờ | Inbox Patient, chỉ tạo nếu lịch vẫn còn hiệu lực và có scheduler phù hợp. |
| Đến lượt hoặc đổi phòng | Inbox Patient và trang hàng đợi; kiểm soát thời hạn để không hiện thông báo mới khi lượt đã qua. |
| Tin nhắn tư vấn mới | Inbox/chuông và badge hội thoại Patient/Doctor; không đưa nội dung tin nhắn vào thông báo. |
| Thanh toán xác nhận hoặc cần xử lý | Inbox Patient và trang hóa đơn; Receptionist xem công việc cần xử lý theo quyền. |
| Kết quả, đơn thuốc hoặc kế hoạch điều trị mới | Inbox Patient với nội dung chung; trang đích kiểm tra quyền trước khi hiển thị chi tiết. |

Website cần trạng thái đang tải, chưa có dữ liệu, lỗi và thử lại; không hiển thị “không có thông báo” cố định khi chưa lấy được dữ liệu.

Trong MVP, website có thể tải lại unread/inbox theo chu kỳ hợp lý khi tab đang hiển thị và khi người dùng mở chuông. Nếu cần cập nhật gần thời gian thực, đánh giá SSE sau; không nhầm polling/SSE trong trang web với web push qua trình duyệt.

#### Thông báo đơn thuốc và kế hoạch điều trị

Hai nhóm này đều nằm trong đề xuất cho Patient trên website, nhưng cần phân biệt **thông báo có cập nhật** và **nhắc thực hiện theo thời gian**:

| Trường hợp đề xuất | Nguồn sự kiện / dữ liệu | Nội dung thông báo gợi ý | Điều kiện và trang đích |
|---|---|---|---|
| Bác sĩ xác nhận đơn thuốc | Prescription service, khi đơn chuyển sang `ISSUED` | “Bạn có đơn thuốc mới. Vui lòng xem hướng dẫn trong hồ sơ.” | Chỉ thông báo sau khi xác nhận, không thông báo bản nháp. Mở trang đơn thuốc của lượt khám có kiểm tra quyền. |
| Đơn thuốc đã phát hành bị hủy | Prescription service, khi đơn đã phát hành chuyển sang `CANCELLED` | “Đơn thuốc của bạn có thay đổi. Vui lòng xem thông tin cập nhật.” | Không mặc định thông báo khi hủy bản nháp chưa phát hành; trang đích kiểm tra trạng thái và quyền hiện tại. |
| Kế hoạch điều trị được kích hoạt | Treatment Plan service, khi kế hoạch chuyển sang `ACTIVE` | “Bạn có kế hoạch điều trị mới. Vui lòng xem chi tiết trong hồ sơ.” | Không thông báo bản nháp. Mở kế hoạch tương ứng sau khi kiểm tra quyền. |
| Kế hoạch đang hoạt động được điều chỉnh hoặc hủy | Treatment Plan service, khi thay đổi được lưu/áp dụng theo trạng thái hợp lệ | “Kế hoạch điều trị của bạn đã được cập nhật.” | Chỉ tạo khi có thay đổi có ý nghĩa; tránh lặp khi retry. Người dùng xem hướng dẫn mới trong trang đích. |
| Sắp đến thời hạn một nội dung điều trị | Treatment Plan service và bộ lập lịch được thiết kế bổ sung | “Bạn có nội dung trong kế hoạch điều trị sắp đến hạn.” | Chỉ xét kế hoạch còn `ACTIVE` và nội dung chưa hoàn thành/hủy; thời điểm nhắc trước hạn cần được thống nhất. |
| Nhắc dùng thuốc theo giờ | Cần dữ liệu lịch dùng thuốc có cấu trúc và bộ lập lịch bổ sung | “Đến thời gian thực hiện hướng dẫn trong đơn thuốc.” | **Chưa đủ dữ liệu để triển khai chính xác**; không suy đoán giờ hoặc liều từ văn bản tự do. |

**Giới hạn dữ liệu hiện tại:** `PrescriptionItem` có liều `dose` và tần suất `frequency` dạng chuỗi, số ngày `durationDays`, nhưng không có lịch giờ dùng thuốc có cấu trúc hoặc ngày bắt đầu cho từng thuốc. Không nên tự chuyển các chuỗi như “2 lần/ngày” thành giờ uống cụ thể. Nếu sau này cần nhắc thuốc, phải thống nhất nguồn lịch, ngày bắt đầu/kết thúc, múi giờ và quyền tạo/chỉnh sửa; hướng dẫn và liều vẫn phải do người có thẩm quyền xác nhận.

`TreatmentPlanItem` có `dueAt` và trạng thái, nên có thể làm cơ sở **thiết kế** lời nhắc trước hạn, nhưng chưa thấy scheduler nhắc hạn được triển khai. Việc xác nhận, thay đổi hoặc hủy đơn/kế hoạch cũng cần có producer event và kết nối Notification thực tế; bảng trên không khẳng định các thông báo đã hoạt động.

Vì hiện chỉ có website, thông báo được lưu trong inbox và hiển thị khi người dùng mở website hoặc khi trang đang hoạt động và cập nhật dữ liệu. **Không cam kết báo đúng giờ khi người dùng đóng website**, vì phạm vi này chưa có push, email hay SMS. Đánh dấu thông báo đã đọc cũng không có nghĩa bệnh nhân đã uống thuốc hoặc hoàn thành điều trị.

### 6.5. Quy tắc dữ liệu và độ tin cậy

- Notification lưu tối thiểu `sourceEventId`, `recipientAccountId`, loại/template, nội dung an toàn, tài nguyên liên quan, `createdAt` và `readAt`. Các bảng delivery/attempt chỉ bổ sung theo mô hình được chốt.
- Khóa chống trùng phải cho phép một sự kiện thông báo cho nhiều account hợp lệ nhưng không tạo trùng cùng event, account và template. Không coi `eventId` toàn cục là đủ để fan-out nhiều người nhận.
- Việc ghi inbox và ghi nhận event đã xử lý cần nhất quán; event được phát lại sau lỗi không được tạo thêm inbox item trùng.
- Retry và DLQ nếu có phải giới hạn, theo dõi được và dừng khi công việc hết hiệu lực. Lịch retry cụ thể cần được chốt theo điều kiện vận hành thực tế.
- JWT xác định account đăng nhập; frontend không tự chọn account nhận. Nội dung và trang đích cần kiểm tra quyền, không gửi chi tiết y tế vào event/log.
- Lỗi thông báo không được rollback lịch khám, thanh toán hay dữ liệu nghiệp vụ nguồn.

## 7. Các service và trang cần tham gia

| Service / khu vực | Trách nhiệm đề xuất | Công việc cần xác minh hoặc bổ sung |
|---|---|---|
| Notification | Inbox, unread/read, xử lý event, template, delivery | REST own-account, route Kong, xác thực, dedupe, worker, quan sát lỗi. |
| Appointment | Sự thật lịch khám, event booking/đổi/hủy/phân công | Outbox publisher thực sự chạy; xác định account người nhận; scheduler nhắc lịch. |
| Queue | Sự thật số thứ tự/lượt gọi | Event có đúng recipient và thời hạn; phối hợp với realtime đã có. |
| Consultation | Sự thật hội thoại, phân công, tin nhắn | Phát event metadata an toàn; phân biệt người gửi và người nhận; tránh lặp khi retry. |
| Billing | Sự thật hóa đơn và thanh toán | Event sau commit; recipient account và nội dung an toàn; không gửi khi trạng thái chưa xác nhận. |
| Medical Record | Sự thật hồ sơ và thời điểm công bố kết quả | Chốt event thực tế và điều kiện công bố; không đưa kết quả/chi tiết y tế vào notification. |
| Prescription / Treatment Plan | Sự thật đơn thuốc/kế hoạch | Phát event phù hợp sau chuyển trạng thái; kiểm tra quyền truy cập trang đích. |
| Doctor / Patient | Liên kết ID hồ sơ nghiệp vụ và account | Cung cấp hoặc duy trì ánh xạ có kiểm soát; không coi các ID là cùng một loại. |
| Receptionist / Manager | Thao tác và xử lý nghiệp vụ theo phân quyền | Chỉ nhận sự kiện phù hợp công việc, không biến Notification thành nguồn dữ liệu nghiệp vụ. |
| Auth / gateway | Danh tính, JWT, định tuyến | JWT sub là account; route và guard theo contract; không cho frontend chọn recipient tùy ý. |
| Reporting / Audit | Theo dõi trạng thái vận hành | Metadata tối thiểu, không ghi nội dung nhạy cảm hoặc token. |

### Vị trí giao diện đề xuất

- **Patient:** chuông dùng chung sau đăng nhập; trang Thông báo; liên kết đến lịch hẹn, hàng đợi, hóa đơn, kết quả, đơn thuốc và điều trị khi các trang đó sẵn sàng.
- **Doctor:** kết nối chuông sẵn có; inbox và unread; liên kết về lịch khám, encounter và tư vấn. Badge hội thoại vẫn phải phản ánh trạng thái đọc của Consultation.
- **Receptionist:** thông báo cần xử lý tại bàn tiếp nhận/điều phối, ví dụ lịch cần phân công lại hoặc thanh toán cần xác minh.
- **Clinic Manager:** thay đổi khả dụng và phân công, báo cáo hoàn tất/thất bại.
- **Admin:** thông báo vận hành có chọn lọc và trạng thái tác vụ; không cần nhận chi tiết mọi hoạt động lâm sàng.

## 8. Thứ tự triển khai đề xuất

1. **Chốt contract:** danh sách event và phiên bản, người nhận, đường dẫn/method REST, cấu trúc inbox, quyền và nội dung tối thiểu. Cập nhật spec, OpenAPI, proto và catalog cho nhất quán.
2. **Làm một luồng dọc:** Appointment ghi outbox sau khi đặt lịch → worker phát event → Notification nhận và lưu cho đúng account → API trả inbox → Patient nhìn thấy. Sửa binding và fan-out/dedupe trong bước này.
3. **An toàn và phục hồi:** test retry, idempotency, message lỗi/DLQ, lỗi RabbitMQ, consumer restart và hai người dùng khác nhau. Không ACK mất event chỉ vì thiếu recipient mà không có cơ chế theo dõi.
4. **Hoàn thiện inbox chung:** phân trang, unread, read/read-all, trạng thái tải/rỗng/lỗi; deep link được duyệt và kiểm tra quyền tại trang đích.
5. **Mở rộng theo ưu tiên:** Doctor và tư vấn; Queue/Receptionist; Billing; sau đó đến kết quả, đơn thuốc, điều trị và quản trị khi producer contract đã sẵn sàng.
6. **Hoàn thiện vận hành website:** theo dõi event lỗi, trạng thái xử lý, retry có giới hạn và các trường hợp không thể tạo inbox. App, email, push và SMS không nằm trong giai đoạn hiện tại.

## 9. Tiêu chí nghiệm thu và kiểm thử

- Một thao tác nghiệp vụ thành công tạo đúng event/outbox và cuối cùng có một thông báo cho từng người nhận được duyệt.
- Cùng event được chuyển lại không tạo trùng cho cùng recipient/template; cùng event gửi tới hai recipient hợp lệ tạo thông báo riêng.
- Event thiếu recipient, sai type/version hoặc sai cấu trúc được ghi nhận và xử lý theo chính sách; không âm thầm mất.
- Khi RabbitMQ hoặc Notification service tạm ngừng, dữ liệu nghiệp vụ chính không bị rollback và event có thể được chuyển lại sau khi phục hồi.
- Account A không xem, đọc hoặc suy ra nội dung notification của account B; truy cập trang đích vẫn kiểm tra quyền.
- Unread count thay đổi đúng khi đọc một, đọc lại hoặc đọc tất cả; hỗ trợ phân trang, loading, empty, error và retry.
- Thông báo đến lượt hết hạn không được gửi lại khi đã quá thời điểm sử dụng.
- Đơn thuốc và kế hoạch nháp không tạo thông báo cho bệnh nhân; hủy hoặc điều chỉnh phải xét trạng thái đã phát hành/đang hoạt động và quyền xem.
- Nhắc nội dung điều trị chỉ tạo theo chính sách thời hạn đã thống nhất; khi nội dung hoàn thành/hủy hoặc kế hoạch không còn hiệu lực, công việc nhắc chưa xử lý phải được kiểm tra lại và không phát sai.
- Không suy ra giờ dùng thuốc từ `frequency` dạng văn bản; trạng thái “đã đọc thông báo” không tự cập nhật thành “đã uống thuốc” hoặc “đã hoàn thành điều trị”.
- Đọc thông báo trên một phiên website cập nhật unread theo account; phiên/trình duyệt khác của cùng account nhận trạng thái sau khi tải lại hoặc đồng bộ. Đếm unread theo inbox item, không theo số delivery.
- Với `IN_APP`, chỉ ghi nhận `DELIVERED` khi inbox của đúng account đã được lưu thành công; `DELIVERED` không đồng nghĩa đã đọc.
- Kiểm thử các trạng thái `FAILED_RETRYABLE`, `FAILED_PERMANENT`, `SUPPRESSED`, `EXPIRED`, worker ngắt giữa chừng và event gửi trùng; không tự thử lại quá thời hạn.
- Event, inbox website, log và nội dung seed không lộ chẩn đoán, kết quả, tin nhắn tư vấn hoặc dữ liệu y tế chi tiết ngoài chính sách được chốt.
- Test luồng trên dữ liệu và môi trường kiểm thử; không tạo, xác nhận hay hủy lịch khám/đơn thuốc thật chỉ để kiểm tra thông báo.

## 10. Giới hạn kết quả rà soát

- Báo cáo phản ánh source code và trạng thái container/database được nhìn thấy tại thời điểm kiểm tra, không bảo đảm image đang chạy ở môi trường khác trùng source.
- Số liệu notification chỉ là số lượng; chưa đọc hoặc xuất dữ liệu cá nhân. Các dòng seed không chứng minh thông báo đã được gửi hoặc đã hiển thị.
- Chưa bật Notification service, chưa phát event thử, chưa kiểm tra provider, và chưa thực hiện kiểm thử end-to-end với người dùng thật.
- Không thay đổi code, API hay dữ liệu khi lập báo cáo này.

## 11. Hướng code đã chốt: đặt lịch → Patient thấy thông báo trên website

### 11.1. Phạm vi và kết quả cần đạt

**Phạm vi lượt đầu:** thông báo `IN_APP` trên website cho bệnh nhân khi đặt lịch thành công; có danh sách, số chưa đọc, đọc một và đọc tất cả. Bệnh nhân tự đặt hoặc lễ tân đặt hộ đều phải nhận đúng tài khoản bệnh nhân.

**Không triển khai trong lượt đầu:** app, email, SMS, web/mobile push, scheduler nhắc lịch, nhắc thuốc theo giờ hoặc các event nghiệp vụ khác. Doctor, Receptionist và các luồng khác sẽ nối sau khi nền tảng được chứng minh hoạt động.

**Đích đầu tiên:** Patient thấy “Đặt lịch thành công” trong inbox; chọn thông báo sẽ tới `/lich-hen`. Route chi tiết theo ID hiện có nhưng trang chi tiết đang là phần chờ, nên không khẳng định đã hỗ trợ mở trực tiếp từng lịch.

Những mục trong phần 11 là **kế hoạch cần code và kiểm thử**, không phải implementation đã hoàn thành.

### 11.2. Luồng kỹ thuật chốt

```text
Appointment: tạo lịch + ghi appointment.booked.v1 vào outbox
          ↓
Appointment outbox worker: publish RabbitMQ, có confirm và retry
          ↓
Notification consumer: kiểm tra event, ghi nhận công việc bền vững
          ↓
Notification worker: tra cứu account của patient qua internal gRPC
          ↓
Tạo inbox IN_APP cho đúng account, chống trùng
          ↓
REST Notification → website Patient lấy inbox/unread và đánh dấu đọc
```

- Booking và outbox được ghi trong cùng transaction của Appointment. Lỗi Notification hoặc RabbitMQ không rollback lịch đã đặt thành công.
- Khóa định tuyến của luồng mẫu là `appointment.booked.v1`; không dùng `appointment.*` cho event có ba phần. Các event khác chưa được xem là đã hỗ trợ.
- `eventId` là định danh ổn định của bản ghi outbox; publish lại sau sự cố phải giữ cùng `eventId`. Có `eventType`, version, thời gian, correlation ID, `appointmentId` và `patientId` tối thiểu; không đưa kết quả khám hoặc nội dung nhạy cảm vào event.
- Consumer chỉ ACK sau khi đã ghi bền vững công việc xử lý hoặc kết quả cần thiết. Nếu xử lý tạm lỗi, retry có giới hạn và có nơi theo dõi; event lỗi không được bị ACK rồi bỏ mất âm thầm.
- Việc tra cứu account được thực hiện **bất đồng bộ sau khi event đã được ghi nhận**, không chặn giao dịch đặt lịch. Notification không gọi ngược Appointment để xác nhận kết quả nghiệp vụ.
- Nếu Patient service tạm lỗi: giữ công việc và thử lại. Nếu bệnh nhân không có tài khoản liên kết: ghi trạng thái/lý do “không có account nhận” theo chính sách đã chốt; không gửi nhầm cho lễ tân và không tự đoán account. Quy tắc có thông báo bù khi bệnh nhân liên kết account về sau cần được chốt riêng.

### 11.3. Xác định đúng tài khoản nhận

Trong [patient_internal.proto](../services/proto/patient/v1/patient_internal.proto), response eligibility/identity hiện chưa trả account ID. Dữ liệu Patient có liên kết `authAccountId` nhưng Notification không được truy vấn trực tiếp database của Patient.

Hướng triển khai là bổ sung **internal gRPC tối thiểu** ở Patient service để tra `patientId → accountId` phục vụ notification; chỉ trả thông tin cần thiết và trạng thái có/không có account. Bảo vệ bằng service JWT, caller allowlist và scope riêng; chỉ service được phép mới gọi được. Cập nhật cả proto runtime, bản tài liệu và kiểm thử tương ứng.

Không lấy account của người đang thao tác làm người nhận mặc định: khi lễ tân đặt hộ, account của lễ tân và account của Patient là hai tài khoản khác nhau. Không ghi nhầm `patientId` hoặc `doctorId` vào trường `recipientAccountId`.

### 11.4. Thay đổi theo service / file

| Thành phần | Công việc code cụ thể | Ranh giới |
|---|---|---|
| Appointment | Rà soát điểm ghi `appointment.booked.v1`; nối worker/adapter outbox với RabbitMQ publisher, đánh dấu đã phát sau khi broker confirm; retry và dừng worker đúng cách. | Không thay đổi ý nghĩa API đặt lịch; không gọi Notification trong transaction booking. |
| Patient | Bổ sung internal RPC tra account theo patient ID nếu không có contract phù hợp; kiểm tra caller/scope và trường hợp patient chưa có account. | Không cung cấp số điện thoại, CCCD hoặc thông tin y tế cho Notification. |
| Notification | Tách phần nhận/kiểm tra event, công việc xác định recipient, tạo inbox và logic read; sửa binding, lỗi template và chống trùng. | Lượt đầu chỉ xử lý booking được duyệt và `IN_APP`; không tạo delivery email/push chờ giả. |
| Shared RabbitMQ/outbox | Tận dụng publisher/relay đã có khi phù hợp; bổ sung claim, retry, DLQ hoặc cơ chế lưu lỗi bền vững cần thiết. | Kiểm tra ảnh hưởng các consumer khác trước khi thay helper dùng chung; cấu hình queue/binding hiện hữu có thể cần cập nhật khi triển khai. |
| Gateway | Thêm route Notification với JWT tương ứng. | Không phơi gRPC nội bộ hoặc endpoint cho client gửi thông báo tùy ý. |
| Frontend Patient | Thêm client API Notification, chuông, badge và danh sách; nối trang thông báo hoặc khu vực phù hợp; bỏ trạng thái “không có thông báo” cố định. | Chỉ hiển thị thông báo của account đang đăng nhập; không tự tạo notification giả. |
| Tài liệu và proto | Đồng bộ service spec, OpenAPI, event catalog và proto runtime/tài liệu. | Không gọi API trong tài liệu là “đã có” cho đến khi code và test hoàn tất. |

Các file bắt đầu rà và sửa dự kiến: [appointment.service.ts](../services/apps/appointment-service/src/appointments/appointment.service.ts), [patient-grpc.controller.ts](../services/apps/patient-service/src/grpc/patient-grpc.controller.ts), [notification.service.ts](../services/apps/notification-service/src/notification.service.ts), [notification.controller.ts](../services/apps/notification-service/src/notification.controller.ts), [notification schema](../services/prisma/notification/schema.prisma), [Kong config](api-specs/kong.yml) và các trang Patient đã liệt kê ở mục 2. Tên file mới cụ thể được quyết định theo cấu trúc hiện có khi triển khai.

### 11.5. REST contract chốt cho website

| Method và đường dẫn qua gateway | Hành vi |
|---|---|
| `GET /api/notifications/in-app` | Lấy inbox của account từ JWT; phân trang và sắp xếp ổn định từ mới đến cũ. |
| `GET /api/notifications/in-app/unread-count` | Đếm inbox item chưa đọc của account hiện tại. |
| `POST /api/notifications/in-app/{id}/read` | Đánh dấu một thông báo thuộc account hiện tại đã đọc; gọi lặp giữ trạng thái đã đọc. |
| `POST /api/notifications/in-app/read-all` | Đánh dấu các thông báo thuộc account hiện tại đã đọc theo thời điểm chốt ở server. |

- Các route này **chưa có trong controller**. Thống nhất lại OpenAPI và service spec theo bảng trước khi code; cấu hình gateway phải được kiểm tra thực tế.
- Không nhận `recipientAccountId` từ client để quyết định quyền. Trả lỗi nhất quán khi chưa đăng nhập, notification không thuộc account hoặc input không hợp lệ; không lộ nội dung của người khác.
- Với lượt đầu, API trả dữ liệu tối thiểu: ID thông báo, loại, title/body an toàn, loại/ID tài nguyên được phép, `readAt` và `createdAt`. Chỉ điều hướng theo loại đã duyệt; không tin URL tùy ý từ event.
- Frontend chỉ chọn trang được phép; Patient mở lịch thông qua trang nghiệp vụ và service đích vẫn xác thực quyền.

### 11.6. Database và trạng thái

- Inbox đọc từ dữ liệu notification của account; không bắt buộc phải có delivery attempt thì mới thấy notification, vì dữ liệu seed hiện có notification nhưng không có delivery attempt.
- `readAt = null` là chưa đọc. Sau khi đọc, ghi thời điểm một lần; đọc lại không tạo thêm bản ghi. Read-all chỉ áp dụng trong phạm vi account và thời điểm cutoff của server.
- `IN_APP DELIVERED` chỉ ghi nhận sau khi inbox được lưu thành công, không đồng nghĩa người dùng đã đọc. Không triển khai `SENT`, device endpoint hay delivery provider trong phạm vi website.
- Chống trùng theo event, recipient và template; cần xử lý đúng khi cùng một event có nhiều recipient ở giai đoạn sau. Bảng `notification_consumed_events` hiện dedupe toàn cục theo event nên phải được rà soát trước khi mở rộng fan-out.
- Ưu tiên tận dụng dữ liệu, bảng và chỉ mục sẵn có; nếu thiếu ràng buộc hoặc trạng thái cần thiết, bổ sung migration tương thích và kiểm thử trên database đã có dữ liệu. **Không dùng `down -v`, truncate hoặc seed lại để triển khai.**

### 11.7. Độ tin cậy và kiểm thử bắt buộc

1. **Unit:** kiểm tra event type/version, routing key, template, recipient, chống trùng, read/read-all và trạng thái lỗi.
2. **Integration:** transaction booking/outbox; worker publish có confirm; consumer ghi bền vững trước ACK; retry khi broker, Patient service hoặc notification database tạm ngừng.
3. **Quyền:** Patient A không đọc hoặc đánh dấu thông báo của Patient B; internal RPC chỉ cho caller/scope được phép. Lễ tân đặt hộ phải gửi tới Patient, không gửi nhầm account lễ tân.
4. **Idempotency:** replay event hoặc worker chạy lại không tạo hai inbox item; sau lỗi giữa commit và ACK vẫn không trùng.
5. **Dữ liệu cũ:** các notification seed hiện có không bị xóa và API không yêu cầu bắt buộc có delivery attempt để hiển thị; nội dung seed nhạy cảm phải được rà soát trước khi công khai.
6. **Website:** badge, danh sách, phân trang, loading/empty/error/retry, đọc một/đọc tất cả và điều hướng `/lich-hen`. Polling chỉ hoạt động khi phù hợp với trạng thái tab; xử lý lỗi/backoff thay vì gọi liên tục.
7. **End-to-end:** đặt lịch thử bằng tài khoản test, xác nhận event → inbox → giao diện; kiểm tra lại khi từng dependency tạm ngừng. Không dùng dữ liệu bệnh nhân thật cho thao tác tạo/hủy thử.

Chỉ kết luận luồng đặt lịch hoàn thành sau khi kiểm thử đầu-cuối thành công; test mock hoặc dữ liệu seed đơn lẻ không đủ chứng minh luồng đang hoạt động.

### 11.8. Mở rộng sau luồng mẫu

Sau khi luồng mẫu ổn định, lần lượt nối đổi/hủy lịch và Doctor; Consultation; Queue/Receptionist; Billing; Medical Record; Prescription và Treatment Plan. Mỗi nhóm phải chốt event, người nhận, quyền, template và test riêng. Scheduler nhắc lịch/điều trị và lịch dùng thuốc có cấu trúc là các bước riêng; không mặc định có sau khi hoàn thành booking notification.
