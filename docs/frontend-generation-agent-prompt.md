# Prompt giao cho Agent: Hoàn thiện Frontend An Tâm Medical

> Sao chép toàn bộ nội dung bên dưới, bắt đầu từ phần **Vai trò**, để giao cho coding agent.

---

## Vai trò

Bạn là **Senior Frontend Engineer** phụ trách hoàn thiện frontend cho hệ thống microservice **An Tâm Medical – Maternal Healthcare Support System**.

## Mục tiêu

Hoàn thiện **toàn bộ frontend còn thiếu** trong thư mục `frontend/`, bắt đầu từ source code hiện tại, để tạo các portal nghiệp vụ có UX hoàn chỉnh, responsive, accessible và tích hợp an toàn với backend qua Kong API Gateway.

Không tạo demo tách rời. Hãy mở rộng nhất quán codebase hiện hữu, tái sử dụng pattern/component/style đang có và chỉ tích hợp các backend contract đã được xác minh.

---

# 1. Bối cảnh repository và source of truth

Repository là microservice monorepo. Frontend hiện tại:

- Vị trí: `frontend/`.
- Stack: React + TypeScript + Vite.
- Test: Vitest + React Testing Library.
- Styling: CSS thuần/global CSS, design tokens.
- Không có React Router, Redux, React Query, component library hay icon library.
- Không tự thêm dependency nếu chưa thật sự cần thiết.
- API giao tiếp qua Kong API Gateway với:
  `VITE_API_BASE_URL ?? 'http://localhost:8080'`.
- API client hiện có: `frontend/src/services/api.ts`.
- Authentication/session hiện có: `frontend/src/app/AuthSessionProvider.tsx`.
- Navigation client-side hiện có: `frontend/src/app/navigation.tsx`.

## Quy tắc source of truth bắt buộc

Trước khi code:

1. Đọc source frontend hiện có trong `frontend/src/`.
2. Đọc implementation backend tương ứng trong `services/apps/`.
3. Kiểm tra gateway route/config trong `gateway/`, Docker Compose và configuration thực tế.
4. Kiểm tra OpenAPI trong `docs/api-specs/*.yaml`.
5. Kiểm tra tài liệu nghiệp vụ liên quan trong `docs/`.

Ưu tiên xác thực theo thứ tự:

1. Source code backend hiện tại.
2. Gateway/config/infrastructure hiện tại.
3. Tests.
4. OpenAPI specs.
5. Documentation.

> **Lưu ý:** Một phần tài liệu và OpenAPI có thể mô tả *target design* nhưng backend chưa implement. Không được coi mọi API trong docs là có thật. Nếu không xác minh được backend/gateway route hoạt động, không được tự bịa request/response contract.

---

# 2. Những gì frontend đã có — không được phá vỡ

## Authentication

Các route hiện hữu:

- `/dang-nhap`
- `/dang-ky`

Các API auth hiện hữu:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Đặc điểm:

- Public register chỉ gồm `email`, `password`.
- Backend gán role `PATIENT` cho đăng ký public.
- Session được lưu trong `sessionStorage` hoặc `localStorage` theo lựa chọn “remember”.
- Token refresh tự động khi request trả về `401`.
- `AuthSessionProvider` đã cung cấp: `status`, `user`, `signIn`, `signUp`, `signOut`, `request<T>(path, init)`.

Không thay đổi JWT payload, auth contract, token persistence hoặc logic refresh nếu không có bằng chứng cần thiết từ backend.

## Patient Portal đã có

Các màn hình hiện hữu:

- `/tong-quan`: `PatientHomePage`
- `/ho-so/hoan-thien`: `PatientProfilePage`

Các API Patient đang dùng:

- `GET /api/patients/me`
- `PUT /api/patients/me`
- `POST /api/patients/{patientId}/emergency-contacts`
- `PATCH /api/patients/{patientId}/emergency-contacts/{contactId}`

Đã có:

- `PatientSidebar` responsive.
- Patient profile và emergency contacts.
- Dashboard trạng thái hoàn thiện profile.
- Basic error/loading/empty states.
- Mascot assets tại `frontend/public/mascots/`.

Không được xóa, rewrite toàn bộ, hoặc làm regress các luồng này.

---

# 3. Kiến trúc frontend cần xây dựng

## 3.1. Phân tách theo role/portal

Hệ thống có các role nghiệp vụ ít nhất:

- `PATIENT`
- `DOCTOR`
- `RECEPTIONIST`
- `ADMIN`
- Có thể có `NURSE` tùy source backend thực tế.

Thiết kế frontend theo portal/role rõ ràng:

- Patient Portal: `PATIENT`.
- Doctor Workspace: `DOCTOR`.
- Reception Workspace: `RECEPTIONIST`.
- Admin/Operations Portal: `ADMIN`.
- Nurse workspace: chỉ implement nếu role/backend flow được xác nhận.

Không được cho phép user đi vào portal không đúng role chỉ bằng URL.

Tạo route guard tái sử dụng được, nhưng không over-engineer. Guard cần:

- Hiển thị loading khi restore session.
- Redirect anonymous user về `/dang-nhap`.
- Chặn role sai quyền bằng trang “Không có quyền truy cập”.
- Có logout rõ ràng.
- Không hard-code role ngoài các role được xác nhận từ backend.

## 3.2. Routing

Tiếp tục dùng custom routing hiện có nếu không cần dependency mới.

Mở rộng `AppRouter.tsx`, `navigation.tsx` và route guards theo pattern hiện tại. Không thêm `react-router-dom` nếu custom router đáp ứng được yêu cầu.

Mỗi route cần có:

- Loading state.
- Empty state.
- Error state có retry nếu phù hợp.
- Accessible heading.
- Redirect/unauthorized behavior đúng role.

## 3.3. Cấu trúc mã nguồn

Tổ chức theo feature/portal, nhất quán với codebase. Ví dụ:

~~~text
frontend/src/
  app/
  components/
    common/
    navigation/
    patient/
    doctor/
    receptionist/
    admin/
  pages/
    patient/
    doctor/
    receptionist/
    admin/
  services/
    api.ts
    auth.ts
    patient.ts
    appointment.ts
    doctor.ts
    catalog.ts
    queue.ts
    billing.ts
    notification.ts
    consultation.ts
  schemas/
  styles/
~~~

Không cần ép cấu trúc này nếu codebase đang dùng flat pages; mục tiêu là rõ ràng, nhất quán, không refactor không liên quan.

---

# 4. Phạm vi chức năng frontend

Triển khai theo phase để tránh bịa backend. Bắt đầu từ các luồng có backend/API thực tế, sau đó mở rộng các màn hình có contract đã xác minh.

## Phase A — Hoàn thiện Patient Portal

Mục tiêu: bệnh nhân có thể quản lý hành trình khám cơ bản sau khi đăng nhập.

### A1. Dashboard bệnh nhân

Nâng cấp `/tong-quan` thành dashboard thực sự, nhưng chỉ hiển thị dữ liệu được backend hỗ trợ.

Các khối mong muốn:

- Hồ sơ cá nhân và mức độ hoàn thiện.
- Cuộc hẹn sắp tới.
- Trạng thái hàng đợi/chặng khám đang active.
- Thông báo chưa đọc.
- Hóa đơn/chờ thanh toán.
- Quick actions: đặt lịch, xem lịch hẹn, xem hàng đợi, cập nhật hồ sơ, xem thông báo.

Nếu endpoint chưa có thật, card phải thể hiện “Chưa khả dụng” hoặc không render tính năng đó. Không gửi request đến endpoint đoán mò.

### A2. Hồ sơ bệnh nhân

Hoàn thiện route/profile hiện có:

- Xem và cập nhật thông tin cá nhân.
- Quản lý emergency contacts.
- Validation nhất quán với `schemas/`.
- Hiển thị lỗi API theo `ApiError`.
- Xử lý optimistic concurrency/version nếu backend thực tế hỗ trợ.
- Xử lý 404 “chưa có hồ sơ” rõ ràng.
- Hỗ trợ mobile tốt.
- Không đưa dữ liệu y khoa không thuộc Patient Service vào profile hành chính.

### A3. Danh mục dịch vụ và đặt lịch

Chỉ implement khi API thực tế khả dụng/xác minh được.

OpenAPI hướng tới các endpoint:

- Service Catalog: `/services`, `/services/{idOrSlug}`, `/categories`, `/filters`.
- Doctor: `/doctors`, `/doctors/{doctorId}`, `/specialties`, `/doctors/{doctorId}/availability`.
- Appointment: `/bookable-slots`, `/slot-holds`, `/slot-holds/{holdId}`, `/appointments`, `/appointments/{id}`, `/appointments/{id}/cancel`, `/appointments/{id}/reschedule`.

Nếu backend/gateway xác nhận hoạt động, xây dựng flow:

1. Chọn chuyên khoa/dịch vụ.
2. Chọn bác sĩ hoặc “bất kỳ bác sĩ phù hợp” nếu API hỗ trợ.
3. Chọn ngày/khung giờ.
4. Hiển thị giá/ghi chú nếu catalog trả về.
5. Tạo slot hold nếu contract yêu cầu.
6. Xác nhận đặt lịch.
7. Hiển thị thành công, mã lịch hẹn, trạng thái và CTA kế tiếp.
8. Hiển thị danh sách và chi tiết lịch hẹn.
9. Hủy hoặc đổi lịch theo đúng trạng thái backend cho phép.

Yêu cầu UX:

- Hiển thị countdown và xử lý hold expiry, không để hết hạn âm thầm.
- Disable thao tác trùng request.
- Confirm dialog trước cancellation.
- Không tự quyết định rule cancellation/reschedule ở frontend.
- Hiển thị server validation/business error rõ ràng.

### A4. Hàng đợi khám

OpenAPI hướng tới:

- `GET /me/journeys/active`
- `GET /journeys/{journeyId}`

Nếu backend xác nhận hoạt động, xây dựng patient queue view:

- Chặng khám active.
- Số thứ tự hiện tại.
- Vị trí/thời gian chờ nếu backend trả về.
- Trạng thái ticket/journey.
- Auto-refresh có kiểm soát hoặc manual refresh.
- Cleanup timer/effect khi unmount.

Không cho Patient gọi endpoint điều hành như `call-next`, `start`, `complete`, `requeue`, `cancel` trừ khi backend explicit cho phép.

### A5. Thông báo

OpenAPI hướng tới:

- `GET /notifications`
- `GET /notifications/unread-count`
- `GET /notifications/{notificationId}`
- `/notifications/{notificationId}/read`
- `/notifications/read-all`

Sau khi xác minh method/contract thực tế:

- Notification bell/badge.
- Danh sách notification.
- Unread/read states.
- Mark single/all as read.
- Empty/error/loading states.
- Không render PHI chi tiết trong toast/badge/list preview.

### A6. Hóa đơn và thanh toán

OpenAPI hướng tới:

- `/invoices`
- `/invoices/{id}`
- `/invoices/{id}/payments`

Chỉ làm Patient invoice/payment screen nếu authorization và API thực tế xác nhận Patient được phép dùng.

Tối thiểu:

- Danh sách hóa đơn.
- Chi tiết khoản phí.
- Payment status.
- CTA thanh toán chỉ khi backend/payment flow có thật.
- Không fake payment provider, không tự đánh dấu đã thanh toán.
- Không expose verify/reject payment hay credit approval cho Patient.

### A7. Tư vấn/chat

OpenAPI hướng tới:

- `/consultations`
- `/consultations/{consultationId}`
- `/consultations/{consultationId}/messages`
- `/consultations/{consultationId}/read`

Chỉ implement nếu backend authorization và contract đã xác minh.

Nếu có:

- Danh sách cuộc hội thoại.
- Thread messages.
- Gửi message.
- Read state.
- Loading/send error/retry state.
- Không triển khai AI diagnosis, video call, prescription hoặc medical advice từ chat.

## Phase B — Reception Workspace

Chỉ triển khai sau khi xác minh role `RECEPTIONIST`, gateway route và backend contract thực sự tồn tại.

Mục tiêu screens:

- Dashboard tiếp nhận.
- Tìm kiếm bệnh nhân.
- Xem thông tin hành chính bệnh nhân.
- Lịch hẹn trong ngày.
- Check-in theo contract.
- Theo dõi queue/reception case.

Không được:

- Truy cập database trực tiếp.
- Reimplement business rules Appointment/Queue/Billing ở frontend.
- Dùng patient API nội bộ trái quyền.
- Cho receptionist sửa medical record/diagnosis/prescription nếu backend/domain không cho phép.

## Phase C — Doctor Workspace

Chỉ triển khai khi role/API thực tế xác nhận.

Màn hình dự kiến theo contract thực:

- Doctor dashboard.
- Lịch làm việc/availability.
- Danh sách lịch hẹn hoặc bệnh nhân chờ khám.
- Chi tiết bệnh nhân trong phạm vi API trả về.
- Encounter workflow: start, vital signs, notes, diagnoses, orders, results/review/finalize theo state machine backend.
- Pregnancy episode, prescription, treatment plan nếu backend permission/API xác nhận.
- Consultation inbox.

OpenAPI hướng tới Medical Record:

- `/encounters`
- `/encounters/{encounterId}/start`
- `/encounters/{encounterId}/vital-signs`
- `/encounters/{encounterId}/notes`
- `/encounters/{encounterId}/diagnoses`
- `/encounters/{encounterId}/orders`
- `/orders/{orderId}/start`
- `/orders/{orderId}/performed`
- `/orders/{orderId}/results`
- `/orders/{orderId}/verify`
- `/encounters/{encounterId}/ready-for-review`
- `/encounters/{encounterId}/finalize`
- `/pregnancy-episodes`

OpenAPI hướng tới Prescription/Treatment Plan:

- Prescription: `/`, `/{prescriptionId}`, `/{prescriptionId}/issue`, `/{prescriptionId}/cancel`.
- Treatment Plan: `/`, `/{planId}`, `/{planId}/activate`, `/{planId}/complete`, `/{planId}/cancel`, `/{planId}/items/{itemId}/complete`.

Cực kỳ quan trọng:

- Medical record không được sửa arbitrary state trên client.
- Chỉ hiển thị/cho phép action theo state và permission backend trả về.
- Không thêm clinical rules, diagnosis logic hoặc prescription logic ở frontend.
- Action irreversible như finalize, issue, cancel cần confirm dialog, lý do nếu API yêu cầu, và hiển thị lỗi server cụ thể.

## Phase D — Admin/Operations Portal

Chỉ triển khai các màn hình có role/API thật.

Khả năng theo OpenAPI/docs:

- Quản lý bác sĩ: `/doctors`, `/doctors/{doctorId}`, activate/deactivate, specialties, schedules, availability overrides.
- Danh mục dịch vụ: `/services`, `/categories`, `/filters`.
- Reporting: `/reports/overview`, `/reports/appointments`, `/reports/revenue`, CSV exports.
- Audit log: `/audit-logs`, `/audit-logs/{auditLogId}`.

Yêu cầu:

- Dashboard báo cáo chỉ dùng API Reporting, không tổng hợp/cross-query frontend.
- CSV export dùng server-provided endpoint khi thực sự tồn tại.
- Không expose raw audit data cho role không được cấp quyền.
- Không thêm chức năng tạo user/assign role nếu auth backend không xác nhận admin endpoint tương ứng.

---

# 5. Quy tắc API integration

## 5.1. Bắt buộc dùng API client hiện hữu

- Tái sử dụng `apiRequest<T>()`.
- Với authenticated request, ưu tiên `auth.request<T>()` từ `useAuthSession()` để kế thừa refresh/retry behavior.
- Không gọi `fetch` trực tiếp trong component trừ khi có lý do chính đáng theo pattern hiện hữu.
- Mỗi domain tạo service typed riêng trong `src/services/`.
- Không copy-paste request logic vào page/component.

## 5.2. Typed contracts

- Định nghĩa TypeScript types theo response thực tế backend.
- Chỉ unwrap `{ data: ... }` nếu contract thật dùng envelope đó.
- Không suy đoán field names, enum, pagination format, date format, role hay state machine.
- Nếu OpenAPI khác source backend/gateway:
  1. Ghi rõ khác biệt.
  2. Ưu tiên source/config hoạt động.
  3. Không tự sửa backend.
  4. Không tự “chuẩn hóa” API contract.

## 5.3. Error handling

Xử lý đúng:

- `400/422`: validation/business error.
- `401`: refresh/retry qua `AuthSessionProvider`; nếu vẫn fail thì về anonymous state.
- `403`: notice/màn hình không có quyền.
- `404`: empty/not found tùy ngữ cảnh.
- `409`: conflict, version conflict, slot unavailable hoặc state conflict; yêu cầu user refresh/chọn lại.
- `429`: retry guidance nếu backend trả về.
- `5xx`/network error: error state + retry.

Không expose raw stack trace hoặc token/PHI vào UI/console.

---

# 6. UX/UI requirements

## Design direction

Duy trì và mở rộng phong cách hiện có:

- Thân thiện, y tế, chuyên nghiệp, dễ hiểu.
- Ngôn ngữ UI chính: tiếng Việt.
- “An Tâm Medical” nhất quán ở branding.
- Không biến giao diện thành dashboard generic quá dày đặc.
- Không dùng emoji làm icon chính.
- Ưu tiên SVG inline/component icon nhỏ theo pattern hiện hữu.
- Responsive desktop/tablet/mobile.
- Sidebar desktop collapse; mobile drawer/scrim; Escape để đóng; focus behavior hợp lý.

## Accessibility bắt buộc

- Semantic HTML.
- Một `<h1>` rõ ràng cho mỗi page.
- Label đầy đủ cho input.
- Keyboard navigable.
- Focus-visible state.
- Button/icon-only button có `aria-label`.
- `aria-live` cho loading/error/success quan trọng.
- Không chỉ dùng màu để biểu đạt trạng thái.
- Contrast tốt.
- Tôn trọng `prefers-reduced-motion`.
- Modal/dialog phải có focus management phù hợp.

## States bắt buộc cho mỗi feature

Mỗi page/list/action cần cân nhắc:

- Initial loading.
- Skeleton hoặc loading UI phù hợp.
- Empty state có CTA.
- Error state.
- Retry state.
- Submitting/disabled state.
- Success feedback.
- Pagination/filter/search state nếu API hỗ trợ.
- Unsaved changes warning nếu có form nhiều bước hoặc dữ liệu dễ mất.

## Date/time/currency

- Không tự đoán timezone format.
- Tôn trọng dữ liệu backend trả về.
- Dùng `Intl.DateTimeFormat('vi-VN', ...)` và `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })` nếu phù hợp.
- Không parse ngày theo cách dễ lệch timezone.
- Không hard-code tiền tệ/đơn vị khi API trả đơn vị khác.

---

# 7. Security và privacy

Đây là hệ thống y tế, nên bắt buộc:

- Không log access token, refresh token, password, patient record, diagnosis, prescription hoặc PHI ra console.
- Không đưa token vào URL/query string.
- Không lưu dữ liệu nhạy cảm dư thừa trong localStorage.
- Không render raw HTML từ server.
- Không dùng `dangerouslySetInnerHTML` trừ khi sanitize và có lý do rõ ràng.
- Frontend guard chỉ là UX; backend vẫn là authorization authority.
- Không expose admin/staff navigation cho role không được phép.
- Không show PHI trong notification preview nếu không thật sự cần.

---

# 8. Test requirements

Dùng Vitest + React Testing Library đã có trong project.

Bổ sung test theo feature, tối thiểu gồm:

## Existing behavior regression

- Auth route redirect.
- Anonymous user bị redirect khi vào protected route.
- `PATIENT` không vào được staff portal.
- Staff role không vào Patient Portal nếu policy hiện tại vẫn chỉ dành cho `PATIENT`.
- Token/session restore behavior không bị regress.
- Logout redirect và clear session.

## Patient features

- Dashboard loading/profile absent/profile available/API error.
- Profile form validation.
- Save profile success/failure.
- Emergency contact create/update.
- Appointment: selection, hold expiry/conflict, booking success/failure, cancel confirmation.
- Notification unread/read behavior.
- Queue active/empty/error state.

## Shared UI

- Sidebar mobile open/close/Escape.
- Navigation active route.
- Accessible labels cho controls quan trọng.
- Error retry action.

Mock API ở test theo pattern hiện có. Không cần E2E giả nếu project chưa setup E2E framework.

---

# 9. Verification bắt buộc

Sau từng phase hoặc trước khi kết thúc:

~~~powershell
cd frontend
npm.cmd run test
npm.cmd run build
~~~

Ngoài ra:

- Kiểm tra TypeScript compile không lỗi.
- Không để dead imports.
- Không bỏ qua lỗi bằng `any`, `@ts-ignore`, disable lint/test.
- Không sửa unrelated backend code để frontend build.
- Không sửa docs trừ khi task yêu cầu rõ hoặc behavior/API thay đổi thật sự.

Nếu test/build fail do lỗi tồn tại ngoài scope:

1. Xác nhận lỗi không do thay đổi mới.
2. Không sửa lan man.
3. Báo cáo rõ file/lỗi/nguyên nhân.

---

# 10. Cách làm việc bắt buộc

## Trước khi implement

1. Đọc source code liên quan.
2. Lập inventory:
   - Existing routes.
   - Existing components.
   - Existing services.
   - Roles thực tế.
   - API routes thực tế qua Kong.
   - Backend endpoints đã implement.
   - Gaps giữa source và docs/OpenAPI.
3. Đề xuất plan theo phase, affected files và risk.
4. Không bắt đầu bằng rewrite toàn bộ frontend.

## Khi phát hiện backend chưa sẵn sàng

Không tự bịa API hay fake production behavior.

Thay vào đó:

- Tạo UI shell/component tái sử dụng được nếu hợp lý.
- Dùng feature availability state rõ ràng, ví dụ “Tính năng đang được kết nối với hệ thống”.
- Chỉ tạo mock data trong test hoặc development-only fixture cô lập rõ ràng.
- Không để mock data xuất hiện như dữ liệu thật ở production.
- Báo cáo endpoint/backend dependency bị thiếu.

## Scope control

Không:

- Cài package mới nếu không thật sự cần.
- Chuyển toàn bộ CSS sang Tailwind/SCSS/CSS Modules.
- Thay custom router bằng router library chỉ vì preference.
- Introduce Redux/Zustand/React Query nếu không chứng minh được cần thiết.
- Refactor toàn bộ `AuthSessionProvider`.
- Thay đổi backend architecture hoặc microservice boundary.
- Truy cập trực tiếp database/service nội bộ từ frontend.
- Bịa API gateway routes.
- Implement payment provider giả như production-ready.
- Implement medical/clinical business logic ở frontend.

---

# 11. Deliverables

Thực hiện theo các phase thực tế có thể triển khai được. Sau mỗi phase hoặc khi kết thúc, báo cáo bằng tiếng Việt:

## Đã triển khai

- Tính năng/UI/route nào đã hoàn thành.
- Role nào được hỗ trợ.
- API contract nào đã tích hợp thật.

## Files

- File đã tạo.
- File đã sửa.
- File đã xóa, nếu có.

## API/backend dependency

- Endpoint đã xác minh và sử dụng.
- Endpoint/documentation chưa khớp source.
- API/role/backend dependency còn thiếu.
- Tính năng unavailable vì backend chưa sẵn sàng.

## Verification

- Test đã chạy.
- Kết quả `npm.cmd run test`.
- Kết quả `npm.cmd run build`.

## Issues / follow-up

- Lỗi ngoài scope.
- Gaps backend cần team khác xử lý.
- Documentation có dấu hiệu outdated.

---

# 12. Tiêu chí hoàn thành

Frontend chỉ được coi là hoàn thành ở mức hiện có thể hoàn thành khi:

- Các portal/route đã implement đúng role và không phá auth hiện tại.
- Patient Portal hoàn chỉnh cho mọi API thực sự khả dụng.
- Staff portal chỉ tồn tại khi backend/role/API được xác minh.
- Tất cả màn hình có loading, empty, error, success và responsive behavior phù hợp.
- Không có API contract đoán mò.
- Không có token/PHI bị log hoặc lộ qua UI.
- Test liên quan pass.
- `npm.cmd run build` pass.
- Báo cáo rõ tính năng chưa thể hoàn thiện do backend chưa có.

---

## Bắt đầu ngay theo thứ tự này

1. Inventory chính xác frontend hiện có và endpoint backend/gateway hiện hữu.
2. Tạo bảng đối chiếu: **Frontend cần có / Backend đã xác minh / Có thể implement ngay / Bị block**.
3. Đề xuất plan implementation nhỏ theo phase, affected files và risk.
4. Sau đó mới sửa code.
