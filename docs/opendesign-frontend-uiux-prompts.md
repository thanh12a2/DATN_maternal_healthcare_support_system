# Prompt OpenDesign — Thiết kế UI/UX Frontend An Tâm Medical

> Mục đích: Đây là prompt để gửi cho OpenDesign tạo thiết kế UI/UX trước khi coding. Đây không phải prompt triển khai React hoặc prompt tích hợp API.
>
> Cách dùng tiết kiệm quota: Chạy lần lượt từng batch. Mỗi batch chỉ có một cụm giao diện nhỏ, từ 2 đến 4 màn hình. Sau mỗi batch, duyệt và giữ nguyên design tokens, app shell, component patterns cho batch tiếp theo.

---

## 1. Product truth — bắt buộc phải bám sát

### Sản phẩm

**An Tâm Medical** là hệ thống vận hành phòng khám tư nhân, một cơ sở, tập trung khám dịch vụ và hỗ trợ hành trình chăm sóc thai sản. Đây không phải app wellness, e-commerce, mạng xã hội hay hospital information system quá nặng tính kỹ thuật.

Các portal dự kiến:

- **Patient Portal:** bệnh nhân xem hồ sơ hành chính, đặt lịch, xem lịch hẹn, thông tin hàng đợi, hóa đơn, thông báo và tư vấn bất đồng bộ.
- **Reception Workspace:** lễ tân xác nhận danh tính, điều phối tiếp nhận, thanh toán và check-in.
- **Doctor Workspace:** bác sĩ xem lịch/ca khám, thực hiện clinical encounter, kết quả, chẩn đoán, đơn thuốc và kế hoạch điều trị theo quyền.
- **Admin/Operations:** vận hành bác sĩ, danh mục dịch vụ và báo cáo.

### Sự thật nghiệp vụ phải phản ánh trong UX

1. Bệnh nhân đăng ký/đăng nhập, rồi hoàn thiện **hồ sơ hành chính**. Clinical/pregnancy data không nằm trong profile hành chính.
2. Khi đặt lịch, bệnh nhân chọn dịch vụ, chuyên khoa và có thể chọn bác sĩ cụ thể hoặc chọn theo hạng bác sĩ nếu hệ thống hỗ trợ; sau đó chọn slot.
3. Slot hold chỉ tồn tại **5 phút**. UX phải thể hiện countdown rõ ràng và xử lý hết hạn lịch sự.
4. Sau booking, bệnh nhân thấy dịch vụ, bác sĩ hoặc rank, thời gian, pricing snapshot, hướng dẫn đến khám và queue estimate. Queue estimate chỉ là dự kiến, không phải số thứ tự authoritative.
5. Bệnh nhân **không tự hủy hoặc tự đổi lịch**. UI patient chỉ đưa hướng dẫn liên hệ phòng khám khi cần thay đổi lịch. Hủy/đổi lịch là thao tác Receptionist/Admin, cần reason/audit.
6. Check-in diễn ra ở quầy lễ tân. Chỉ sau admission/check-in hợp lệ và payment/approved credit, hệ thống mới tạo journey/ticket hàng đợi.
7. Patient queue view hiển thị ticket code, khu vực/chặng, số người phía trước và ETA hiện tại khi có dữ liệu. Không thiết kế nút gọi lượt tiếp theo, start hoặc complete cho patient.
8. Thanh toán ban đầu chỉ có **cash** hoặc **manual bank transfer**. Không thiết kế payment gateway, thẻ tín dụng, ví điện tử, split payment hay refund flow.
9. Encounter lâm sàng theo state machine: DRAFT → IN_PROGRESS → AWAITING_RESULTS → READY_FOR_REVIEW → FINALIZED. Sau FINALIZED, chỉnh sửa là amendment append-only, không phải edit trực tiếp.
10. Prescription: DRAFT → ISSUED → CANCELLED. Treatment plan: DRAFT → ACTIVE → COMPLETED hoặc CANCELLED.
11. Notification là in-app, push/email; preview không nên lộ chi tiết PHI.
12. Consultation là nhắn tin bất đồng bộ Patient–Doctor; không thiết kế AI diagnosis, video call, kê đơn hoặc lời khuyên y khoa tự động từ chat.
13. Không thêm đa cơ sở, BHYT, refund, mixed payment, pharmacy/medicine selling, AI triage hay ambulance/emergency flows.

### Mức độ chắc chắn của scope

Các nghiệp vụ trên là approved product/design direction. Một số backend service/API trong repository vẫn có thể chưa sẵn sàng. Vì vậy thiết kế hãy có availability/unavailable state lịch sự khi cần, nhưng không bịa thêm workflow hay business rule ngoài brief.

---

## 2. Visual system — phải align frontend đang có

### Brand personality

- An tâm, rõ ràng, có năng lực chuyên môn, ấm áp vừa đủ.
- Modern Vietnamese private clinic; không giống ứng dụng ngân hàng lạnh lẽo, sàn thương mại điện tử hoặc dashboard enterprise dày đặc.
- Nhấn mạnh sự minh bạch, cảm giác được hướng dẫn từng bước, giảm lo lắng cho bệnh nhân.
- Dành cho chăm sóc thai sản nhưng không dùng stereotype màu hồng, icon em bé quá mức hoặc minh họa sến.

### Design tokens phải bảo toàn

| Token | Giá trị | Dùng cho |
|---|---:|---|
| Background | #F6FAFD | nền app chính |
| Surface | #FFFFFF | card, form, panel |
| Main text | #183153 | text/heading |
| Muted text | #6F7F8F | mô tả, metadata |
| Border | #DFEAF3 | đường viền phân tách |
| Primary blue | #1677FF | CTA chính, focus, progress |
| Deep navy | #0B4F9C | brand, navigation, emphasis |
| Soft blue | #EAF4FF | active nav, subtle surface |
| Success green | #20B486 | trạng thái hoàn tất |
| Soft green | #E9F8F2 | success background |
| Danger red | #EF5350 | cảnh báo/lỗi |
| Soft red | #FFF0F0 | error background |
| Font | Be Vietnam Pro | toàn bộ UI |

### Ngôn ngữ hình ảnh đang có

- Nền rất sáng, card trắng, border xanh xám mảnh, shadow xanh navy rất mềm.
- Card có góc bo hào phóng, khoảng 16–30px; auth card có một góc bất đối xứng tinh tế.
- CTA chính màu blue, radius 12–16px, chữ đậm; không dùng gradient CTA quá lòe loẹt.
- Navigation panel trắng bán trong suốt, backdrop blur nhẹ, bo tròn lớn.
- Hình học y tế trừu tượng: vòng tròn, ring, capsule, medical cross, dot grid, pastel xanh/xanh lá/đỏ ở mức nhẹ.
- Có mascot trợ lý ảo dạng floating action ở Patient Portal; giữ mascot thân thiện, không để che CTA/dữ liệu quan trọng.
- Icon line SVG, stroke mảnh, nhất quán; không dùng emoji làm icon UI chính.
- Motion nếu có phải nhẹ; luôn có reduced-motion alternative.

### Typography và spacing

- Dùng **Be Vietnam Pro**.
- Heading ngắn, rõ; không dùng marketing copy dài.
- Label/metadata dùng uppercase nhỏ, letter-spacing nhẹ, navy/muted.
- Desktop content thoáng; mobile ưu tiên một cột, touch target tối thiểu 44px.
- Form tập trung vào scanability: section number, title, help text, field label, inline validation.

### Không làm

- Không dark mode trong scope này.
- Không glassmorphism quá đà làm giảm độ đọc dữ liệu y tế.
- Không charts trang trí không có ý nghĩa.
- Không quá nhiều badge/chip màu sắc cùng lúc.
- Không thêm logo mới thay thế dấu cộng hình học hiện hữu.
- Không dùng stock photo bác sĩ/bệnh nhân.

---

## 3. Quy tắc đầu ra từ OpenDesign

Mỗi batch phải trả về:

1. Desktop và mobile cho toàn bộ screen của batch.
2. Component states: loading, empty, error, disabled/submitting, success, unavailable khi phù hợp.
3. Quy ước trạng thái gồm status badges, colors, action hierarchy có thể tái sử dụng ở batch sau.
4. Annotation ngắn về responsive behavior, focus/keyboard và các hành động cần confirm.
5. UI copy bằng tiếng Việt tự nhiên, ngắn gọn.
6. Không tạo code, API schema, database schema hay business flow mới.
7. Không đổi visual tokens/app shell đã chốt khi sang batch sau, trừ khi có lý do rõ ràng.

---

# 4. Prompt theo batch

## Batch 00 — Design foundation và app shells

**Mục tiêu:** Chạy batch này trước. Đây là batch tạo quy chuẩn để tất cả batch sau đồng bộ. Không thiết kế quá nhiều page chi tiết.

### Prompt để gửi OpenDesign

Thiết kế UI/UX foundation cho web app An Tâm Medical, một private clinic maternal healthcare system tại Việt Nam. Đây là thiết kế desktop-first nhưng bắt buộc có mobile responsive.

Brand và tokens bắt buộc:

- Font: Be Vietnam Pro.
- Background #F6FAFD; surface #FFFFFF; main text #183153; muted #6F7F8F; border #DFEAF3.
- Primary #1677FF; deep navy #0B4F9C; soft blue #EAF4FF.
- Success #20B486/#E9F8F2; danger #EF5350/#FFF0F0.
- Phong cách: private clinic hiện đại, an tâm, sáng, rõ ràng; card trắng bo tròn lớn, navy shadow mềm, border mảnh, icon line SVG, hình học y tế trừu tượng pastel. Không pink stereotype, không dark mode, không stock photos, không generic enterprise dashboard.

Hãy thiết kế 4 artboard nền tảng:

1. Patient Portal app shell desktop: sidebar trái trắng bo 30px, topbar, account chip, vùng content, vị trí floating virtual-assistant mascot.
2. Patient Portal app shell mobile: hamburger, drawer/sidebar, scrim, topbar tối giản, floating assistant không che CTA.
3. Staff Workspace shell desktop dùng cho Reception/Doctor/Admin: sidebar rõ nhóm navigation, topbar có search/notification/account; dày dữ liệu hơn patient nhưng vẫn thoáng.
4. Component reference board: heading hierarchy, page intro, breadcrumbs/back link, primary/secondary/ghost/destructive buttons, input/select/date-time field, segmented control, status badges, info/success/warning/error alerts, card, table/list row, empty state, loading skeleton, confirmation modal, toast.

Yêu cầu:

- Đặt token/color/type/spacing annotations ngắn trên component board.
- Show focus-visible và disabled state quan trọng.
- Staff shell và Patient shell cùng một brand system nhưng patient ấm và hướng dẫn nhiều hơn; staff tập trung hiệu quả thao tác.
- Không thêm màn hình nghiệp vụ cụ thể, không viết code.

---

## Batch 01 — Patient onboarding, hồ sơ và dashboard

**Phụ thuộc:** Batch 00. Có thể chạy độc lập nếu gửi kèm phần Visual system ở trên.

### Prompt để gửi OpenDesign

Tiếp tục dùng design system An Tâm Medical: Be Vietnam Pro, nền #F6FAFD, card trắng bo lớn, navy/blue/green tokens, Patient Portal sidebar trái và topbar như foundation đã chốt. Thiết kế UI/UX, không tạo code.

Thiết kế 4 màn hình Patient Portal sau ở desktop + mobile:

1. **Tổng quan — hồ sơ chưa hoàn tất:** Welcome bằng tên hoặc email fallback; hero card hướng dẫn Hoàn thiện hồ sơ bệnh nhân; checklist gồm thông tin định danh, địa chỉ/liên hệ khẩn cấp, thông tin sức khỏe cơ bản đang phát triển; CTA chính Hoàn thiện hồ sơ. Không bịa dữ liệu cuộc hẹn/queue/billing; có thể dùng quick-action card trạng thái Sắp ra mắt kín đáo.
2. **Hoàn thiện hồ sơ:** Header, back link, progress card sticky ở desktop. Các section đánh số: thông tin cá nhân, thông tin liên hệ/địa chỉ, thông tin định danh theo mức dữ liệu cần thiết. Không đưa clinical record hay pregnancy data vào đây. Có inline validation, helper, save/submitting/success/error.
3. **Liên hệ khẩn cấp** trong cùng trang profile: Empty state và danh sách contacts. Contact card có tên, quan hệ, số điện thoại, nhãn Liên hệ chính, action chỉnh sửa. Form add/edit inline hoặc modal accessible. Thiết kế primary contact rõ ràng, không quá nhiều màu.
4. **Tổng quan — hồ sơ đã hoàn tất:** Hero card success, profile summary ngắn, CTA Xem và cập nhật hồ sơ. Khu vực chuẩn bị cho Lịch hẹn / Hàng đợi / Thông báo nhưng thể hiện unavailable hoặc empty tinh tế nếu chưa có dữ liệu.

Bắt buộc thể hiện loading skeleton, API error + retry, empty state, saved success feedback, mobile one-column. Bảo toàn cảm giác hướng dẫn, an tâm và không dày đặc.

---

## Batch 02 — Patient đặt lịch khám (booking wizard)

**Phụ thuộc:** Batch 00; tốt nhất sau Batch 01.

### Prompt để gửi OpenDesign

Thiết kế UI/UX cho booking wizard của Patient Portal An Tâm Medical, đồng bộ hoàn toàn với design system đã chốt: Be Vietnam Pro; #F6FAFD nền, navy #183153/#0B4F9C, primary #1677FF, success #20B486; card trắng bo tròn lớn, icon line, sidebar patient và topbar giữ nguyên. Không tạo code.

Business truth không được vi phạm:

- Bệnh nhân đặt lịch bằng cách chọn dịch vụ/chuyên khoa, bác sĩ cụ thể hoặc consultation rank nếu hệ thống cho phép, rồi chọn slot.
- Slot hold chỉ tồn tại 5 phút. Booking phải minh bạch về thời gian giữ chỗ.
- Patient không có quyền tự cancel/reschedule sau booking.
- Không thiết kế payment gateway, refund, insurance, multi-facility.

Thiết kế tối đa 4 màn hình desktop + mobile:

1. **Bước 1 — Chọn nhu cầu khám:** Danh mục dịch vụ/chuyên khoa, search/filter tối giản. Service cards nêu tên, mô tả ngắn, thời lượng/giá chỉ khi có; không dùng dữ liệu giả quá cụ thể. Có loading, no results và unavailable.
2. **Bước 2 — Chọn bác sĩ hoặc hạng tư vấn:** Segmented choice Chọn bác sĩ / Để hệ thống phân công theo hạng. Doctor card gồm avatar minh họa tối giản, tên, chuyên khoa, hạng, availability rất ngắn. Không dùng stock photo; dùng initial/avatar gradient brand.
3. **Bước 3 — Chọn ngày giờ:** Date selector dễ dùng; list/grid slots; legend available/selected/unavailable. Khi chọn slot, summary panel hiển thị dịch vụ + bác sĩ/hạng + thời điểm + giá nếu có. Sau hold, show countdown rõ Giữ chỗ trong 04:59, warning trước khi hết hạn, state hold expired với CTA chọn slot khác.
4. **Bước 4 — Xác nhận và thành công:** Review booking, pricing snapshot nếu có, hướng dẫn đến khám. Success state có mã lịch hẹn, thời gian, dịch vụ, bác sĩ/hạng, CTA Xem lịch hẹn. Thêm note: nếu cần thay đổi lịch, liên hệ phòng khám; không có nút hủy/đổi lịch cho patient.

Dùng stepper/progress header rõ ràng. Mobile: sticky bottom CTA, summary accordion; không để countdown hay CTA bị che. Cung cấp disabled, submitting, slot conflict, hold expired, network error.

---

## Batch 03 — Patient lịch hẹn, hàng đợi, thông báo và hóa đơn

**Phụ thuộc:** Batch 00; sau Batch 02 là lý tưởng.

### Prompt để gửi OpenDesign

Thiết kế 4 màn hình Patient Portal An Tâm Medical, đồng bộ visual system: Be Vietnam Pro, sáng, private clinic hiện đại, nền #F6FAFD, surface trắng, blue/navy primary, green success, red chỉ cho error, bo góc lớn, icon line. Không viết code.

Business rules:

- Sau booking, patient xem dịch vụ, bác sĩ/rank, thời gian, pricing snapshot, hướng dẫn đến khám, queue estimate có nhãn Dự kiến.
- Patient không tự cancel/reschedule; nếu cần đổi lịch, UI hướng dẫn liên hệ phòng khám.
- Queue ticket authoritative chỉ xuất hiện sau check-in/admission hợp lệ. Queue estimate trước check-in không phải ticket.
- Initial payment chỉ là cash/manual bank transfer; không có payment gateway/refund/mixed payment.
- Notification preview không lộ PHI chi tiết.

Màn hình:

1. **Lịch hẹn của tôi + detail:** Upcoming/past tabs hoặc list groups. Appointment card với status, ngày giờ, dịch vụ, bác sĩ/hạng, hướng dẫn ngắn. Detail có pricing snapshot, hướng dẫn đến khám, queue estimate với nhãn Dự kiến tại thời điểm…, support CTA Liên hệ phòng khám để thay đổi lịch. Có empty/loading/error.
2. **Hàng đợi khám:** Active journey rõ ràng, bình tĩnh: ticket code, chặng/khu vực, số người phía trước, ETA, last updated. Timeline journey; tách Bạn đã check-in và Đang chờ được gọi. Có refresh, không có staff controls. Có empty state khi chưa check-in/chưa có ticket.
3. **Thông báo:** Bell badge và full notification center. Read/unread list, ngày nhóm, mark all read. Preview an toàn, không diagnosis/clinical details. Có empty/error/loading.
4. **Hóa đơn và thanh toán:** Invoice list; status chờ thanh toán/đã thanh toán/approved credit. Invoice detail có itemized charges, total, phương thức cash/manual bank transfer và hướng dẫn khi có. Không có credit card checkout, QR payment giả, refund button hoặc staff verify/reject control.

Mobile ưu tiên card/list dễ quét; desktop có detail side panel hợp lý. Đưa ra shared status badge system dùng lại cho các screen.

---

## Batch 04 — Patient tư vấn bất đồng bộ và document/results viewer

**Phụ thuộc:** Batch 00. Chỉ là UI design, không ngụ ý backend sẵn sàng.

### Prompt để gửi OpenDesign

Thiết kế UI/UX cho hai feature Patient Portal của An Tâm Medical: consultation messaging và document/results viewing. Giữ nguyên design system: Be Vietnam Pro, light clinical blue/navy, card trắng bo lớn, icon line, không stock images, không viết code.

Business boundaries:

- Consultation là Patient–Doctor messaging bất đồng bộ.
- Không AI assistant chẩn đoán, không video/voice call, không kê đơn trực tiếp trong chat, không emergency triage.
- Document là private; patient chỉ thấy tài liệu được phép truy cập và chỉ download khi trạng thái an toàn.
- Không lộ clinical PHI ở notification previews.

Thiết kế tối đa 4 artboard desktop + mobile:

1. Consultation inbox: thread list, unread indicator, trạng thái hỗ trợ, empty/unavailable/error.
2. Conversation thread: patient/doctor message bubbles rõ, timestamp, read marker nếu có, composer send/disabled/sending/error retry. Có safety note tinh tế: nội dung không thay thế tư vấn khẩn cấp.
3. Tài liệu và kết quả: document list grouped by visit/date, loại tài liệu, ngày cập nhật, trạng thái available/processing/unavailable; search/filter tối giản.
4. Document detail/preview: metadata, version, download CTA chỉ khi safe; unavailable/error khi file chưa sẵn sàng.

Không dùng chat UI avatar stock. Không thiết kế clinical interpretation, AI summaries hay buttons action bệnh lý. Component states phải rõ và accessible.

---

## Batch 05 — Reception Workspace: tiếp nhận, thanh toán, check-in

**Phụ thuộc:** Batch 00. Đây là workspace staff, không dùng patient shell.

### Prompt để gửi OpenDesign

Thiết kế UI/UX cho Reception Workspace của An Tâm Medical. Dùng Staff Workspace shell cùng brand system: Be Vietnam Pro, nền sáng #F6FAFD, navy/blue primary, green success, card trắng, border mảnh, sidebar trái, topbar có search/notification/account. Giao diện cần hiệu quả thao tác hơn Patient Portal, nhưng không biến thành dashboard dày đặc. Không viết code.

Canonical reception flow bắt buộc:

1. Validate appointment.
2. Verify patient identity.
3. Open ReceptionCase.
4. Create/get base invoice.
5. Verify PAID hoặc APPROVED_CREDIT.
6. Open/get clinical encounter draft.
7. Check-in appointment.
8. Create/get queue journey + initial stage ticket.
9. Complete ReceptionCase.

Business constraints:

- Nếu chưa PAID/APPROVED_CREDIT: PAYMENT_PENDING và chưa tạo queue ticket.
- Thanh toán chỉ CASH hoặc MANUAL_BANK_TRANSFER; không payment gateway, refund, partial/mixed payment.
- Command lỗi/timeout cần UI idempotency-safe: không khuyến khích staff click lại mù quáng; show outcome/retry rõ.
- Override/cancel/reassign cần reason và audit indication khi applicable.

Thiết kế 4 screen desktop + mobile/tablet:

1. Reception dashboard: today overview, appointments cần check-in, payment pending, queue status; không chart trang trí.
2. Patient/appointment lookup: search state, appointment summary, identity verification checklist, administrative info đúng phạm vi.
3. Admission stepper/workbench: 9 checkpoint ở trên, status pending/processing/success/blocked/error; action hierarchy rõ; error có safe retry.
4. Payment/check-in result: invoice summary, cash/manual transfer, paid/pending/approved credit; admission success hiển thị ticket code, stage/khu vực, CTA in/hand-off nếu cần.

Thiết kế no appointment found, identity mismatch/escalate, payment pending, already checked-in/idempotent success, failure with safe retry, completed. Không đưa diagnosis/clinical note vào màn hình lễ tân.

---

## Batch 06 — Doctor Workspace: ca khám và clinical encounter

**Phụ thuộc:** Batch 00. Ưu tiên rõ ràng/an toàn dữ liệu hơn tính trang trí.

### Prompt để gửi OpenDesign

Thiết kế UI/UX cho Doctor Workspace của An Tâm Medical. Dùng staff shell đã chốt, Be Vietnam Pro, light blue/navy clinical visual system, spacious white cards, subtle geometry. Không viết code và không tự tạo clinical business rules.

Clinical boundaries:

- Doctor xem lịch/ca khám, thực hiện encounter, ghi note/diagnosis/orders theo quyền.
- Encounter states: DRAFT → IN_PROGRESS → AWAITING_RESULTS → READY_FOR_REVIEW → FINALIZED.
- Không edit trực tiếp sau FINALIZED; chỉ amendment append-only khi được cấp quyền.
- Required result chưa verified thì không thể finalize.
- Prescription: DRAFT → ISSUED → CANCELLED. Treatment plan: DRAFT → ACTIVE → COMPLETED/CANCELLED.
- Không thiết kế AI diagnosis, autonomous recommendation, pharmacy selling hoặc clinical auto-fill.

Thiết kế 4 artboard desktop + tablet/mobile adaptation:

1. Doctor dashboard/today schedule: upcoming patients, current queue context, alerts needing review; chỉ thông tin cần thiết, không chart vô nghĩa.
2. Encounter workspace — DRAFT/IN_PROGRESS: patient header, appointment context, left section navigation, central structured note/diagnosis/orders, right encounter status panel. Readable, low cognitive load, autosave/saving/error indicators.
3. Results and review — AWAITING_RESULTS/READY_FOR_REVIEW: ordered services/results list, required/verified state, document links, blocked-finalize explanation.
4. Final review modal/page: encounter summary, irreversible finalization warning, accessible confirm; FINALIZED read-only state và amendment timeline riêng.

Biểu đạt rõ permission/state-based action hierarchy: Start encounter, Save draft, Ready for review, Finalize. Action irreversible phải có confirmation. Không nhét toàn bộ clinical form vào một màn hình quá dày; dùng sections/tabs với persistent patient context.

---

## Batch 07 — Doctor: prescription, treatment plan và availability

**Phụ thuộc:** Batch 06 và Batch 00.

### Prompt để gửi OpenDesign

Tiếp tục Doctor Workspace An Tâm Medical với đúng visual system và staff shell đã chốt. Thiết kế UI/UX, không viết code.

Business truth:

- Prescription: DRAFT → ISSUED → CANCELLED. Issue/cancel là hành động nhạy cảm, phải confirm và phản ánh read-only state sau issue theo dữ liệu thực tế.
- Treatment plan: DRAFT → ACTIVE → COMPLETED hoặc CANCELLED. Không AI, không autobooking.
- Doctor có working schedule và availability overrides; override/cancel override phải hiển thị phạm vi và lý do khi applicable.
- Không thiết kế pharmacy/stock/medicine sales/insurance.

Thiết kế 4 artboard desktop + responsive:

1. Prescription editor/list trong encounter context: medicine/item table dễ đọc, draft state, validation/error area, status badge.
2. Prescription review/issue: final review layout, confirm modal, issued read-only, cancel action có reason/confirmation chỉ khi allowed.
3. Treatment plan detail: plan header/status, item timeline/checklist, progress, action activate/complete/cancel theo state.
4. Availability management: weekly schedule grid, list/calendar availability overrides, create override dialog, cancelled override state. Không calendar quá phức tạp.

Mỗi artboard cần loading, empty, validation, permission-denied và error/retry khi phù hợp. Hành động không thể đảo ngược phải visually distinct nhưng không alarming quá mức.

---

## Batch 08 — Admin/Operations: doctors, catalog, reporting và audit

**Phụ thuộc:** Batch 00. Đây là batch cuối vì dữ liệu mang tính vận hành.

### Prompt để gửi OpenDesign

Thiết kế UI/UX cho Admin/Operations Portal của An Tâm Medical, dùng Staff Workspace shell và shared components đã chốt. Duy trì visual style light/navigable/private-clinic; không dark mode, không generic BI dashboard, không code.

Scope nghiệp vụ:

- Manage doctor profile, specialty, status active/deactivated, schedule/availability.
- Manage service catalog/categories/filters theo quyền thực tế.
- Reporting overview, appointment, revenue và server-generated CSV export.
- Audit log read-only. Không expose raw audit data cho role không được cấp quyền.
- Không thiết kế user role assignment nếu chưa mô tả rõ; không dùng cross-service data mashup không có owner.

Thiết kế tối đa 4 artboard desktop + tablet responsive:

1. Operations overview: KPI cards có ý nghĩa, operational alerts, recent activity; không lạm dụng charts.
2. Doctor management: searchable/filterable table/list, doctor profile detail/edit, specialty/status, activate/deactivate confirmation.
3. Service catalog: category/service list, service detail/edit, empty/error/unsaved changes. Layout phù hợp form vận hành nhưng nhất quán brand.
4. Reporting + Audit: reports filter bar, simple understandable chart/table, CSV export action state; audit log table/detail drawer với actor/action/time/request/reference IDs, no PHI-heavy preview.

Cần component states cho loading, zero data, export generating/ready/error, deactivated status, version/conflict/message area. Data tables responsive: desktop table, mobile card/list alternative.

---

# 5. Checklist trước khi duyệt từng batch

- [ ] Dùng đúng token màu, font và corner/shadow language của frontend hiện có.
- [ ] Desktop và mobile đều được thiết kế.
- [ ] Có loading, empty, error và disabled/submitting state.
- [ ] Không phát minh feature/role/API/clinical rule.
- [ ] Patient không có cancel/reschedule, staff controls không lọt vào Patient Portal.
- [ ] Không có payment gateway, refund, BHYT, đa cơ sở, pharmacy selling hay AI diagnosis.
- [ ] Không lộ PHI không cần thiết qua notification hoặc dashboard preview.
- [ ] CTA hierarchy, status badge và navigation thống nhất với các batch trước.
- [ ] Handoff đủ rõ để frontend engineer implement bằng React + CSS thuần mà không phải đoán behavior.

---

# 6. Thứ tự chạy đề xuất — tối ưu quota

1. **Batch 00** — chỉ chạy một lần, chốt foundation.
2. **Batch 01** — Patient onboarding/profile/dashboard.
3. **Batch 02** — Patient booking wizard.
4. **Batch 03** — Patient appointments/queue/notifications/invoices.
5. **Batch 04** — Patient consultations/documents.
6. **Batch 05** — Reception workspace.
7. **Batch 06** — Doctor encounter workspace.
8. **Batch 07** — Doctor prescription/treatment plan/availability.
9. **Batch 08** — Admin operations.

> Nếu quota giới hạn, ưu tiên chạy **00 → 01 → 02 → 03 → 05 → 06**. Các batch 04, 07, 08 có thể chạy sau mà không phá vỡ design system.
