
## Version / Change Log

| Version | Date | Change | Impact |
|---|---|---|---|
| Draft-2026-10-17-changelog | 2026-10-17 | Bổ sung version và change log chuẩn hóa theo format của Doctor Service Specification. Không thay đổi business contract trong tài liệu. | Chỉ thay đổi metadata/documentation; dùng section này để theo dõi các lần cập nhật tiếp theo. |

---
# Document Service — Service Specification

> Status: DESIGN — implementation-ready; approved boundary, chưa implemented.
> Public contract: ../api-specs/document-service.yaml
> Internal contract: ../grpc/document/v1/document_internal.proto

## 1. Tổng quan và boundary

Document Service là source of truth cho vòng đời binary object, metadata, version, checksum, malware-scan status và quyền truy cập attachment. Service không sở hữu ý nghĩa lâm sàng của tài liệu.

### Chịu trách nhiệm

- Khởi tạo upload session và xác nhận upload hoàn tất.
- Lưu metadata object riêng tư, checksum SHA-256, MIME type, kích thước và storage key.
- Quản lý liên kết tài liệu tới resource ngoài bằng ownerType, ownerId và purpose.
- Quản lý version bất biến; thay file tạo version mới.
- Malware scan state và chặn download khi chưa CLEAN.
- Phát hành download URL ngắn hạn sau authorization.

### Không chịu trách nhiệm

- Clinical interpretation, diagnosis hoặc medical-record state.
- OCR, ký số, chỉnh sửa binary, public URL vĩnh viễn.
- Patient/Doctor/Encounter ownership; chỉ xác minh qua gRPC owner khi cần.

## 2. Actors và authorization

| Actor/caller | Hành động | Rule |
|---|---|---|
| PATIENT | Xem/download tài liệu đã RELEASED của mình | Patient ownership + release policy |
| DOCTOR/NURSE | Upload/read attachment của encounter được phân công | Encounter assignment + scope |
| Medical Record Service | Link/list document theo Encounter | Service JWT scope document:clinical |
| Prescription/Treatment Plan | Link document theo resource của mình | Service JWT + owner match |
| ADMIN | Không mặc định đọc nội dung | Chỉ metadata vận hành; break-glass ngoài MVP |

## 3. Domain model

### Document

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| ownerType | enum | CLINICAL_ENCOUNTER, PRESCRIPTION, TREATMENT_PLAN, CONSULTATION |
| ownerId | UUID | external reference |
| patientId | UUID | external Patient reference |
| purpose | string | 1–80, allowlist |
| status | enum | PENDING_UPLOAD, UPLOADED, SCANNING, CLEAN, REJECTED, ARCHIVED |
| currentVersion | int | >= 1 |
| visibility | enum | CLINICAL_TEAM, PATIENT_RELEASED |
| createdByAccountId | UUID | immutable |
| createdAt/updatedAt | timestamptz | UTC |

### DocumentVersion

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| documentId | UUID | local FK |
| version | int | unique per document |
| storageKey | string | unique, private bucket/path |
| fileName | string | sanitized display name |
| mediaType | string | allowlist |
| sizeBytes | bigint | 1..configured maximum |
| sha256 | string | 64 lowercase hex |
| scanStatus | enum | PENDING, CLEAN, INFECTED, FAILED |
| uploadedAt/scannedAt | timestamptz | UTC |

### UploadSession

- id, documentId, version, expiresAt, status, idempotencyKey, expectedMediaType, maxBytes.
- Unique actorId + operation + idempotencyKey.

## 4. State machine

PENDING_UPLOAD → UPLOADED → SCANNING → CLEAN.
SCANNING → REJECTED khi INFECTED hoặc policy reject.
CLEAN → ARCHIVED bằng command có reason; không hard-delete.
Upload session: OPEN → COMPLETED hoặc EXPIRED/CANCELLED.

## 5. Public REST API

Base path: /api/documents; JWT qua Kong và service authorization.

| Method | Path | Mục đích |
|---|---|---|
| POST | /documents/uploads | Tạo upload session |
| POST | /documents/uploads/{sessionId}/complete | Xác nhận object và checksum |
| GET | /documents/{documentId} | Metadata được phép xem |
| GET | /documents/{documentId}/download | URL tải ngắn hạn |
| POST | /documents/{documentId}/versions | Tạo upload cho version mới |
| POST | /documents/{documentId}/archive | Archive có reason |

Mọi command nhận Idempotency-Key; mutable command nhận version/If-Match.

## 6. Internal gRPC

DocumentInternalService:

- CreateDocumentUpload: owner service tạo upload context.
- LinkDocument: xác nhận ownerType/ownerId và liên kết version CLEAN.
- ListDocumentsByOwner: trả metadata tối thiểu.
- GetDocumentAccess: trả metadata/access decision; không trả permanent URL.
- ArchiveDocumentsByOwner: archive bounded và idempotent.

Metadata bắt buộc gồm RequestContext, service JWT, deadline và idempotency key cho command.

## 7. Business rules

| ID | Rule |
|---|---|
| DOC-BR-001 | Binary luôn private; không expose storage key/public URL. |
| DOC-BR-002 | Chỉ version CLEAN mới được download/link clinical. |
| DOC-BR-003 | Version bất biến; replacement tạo version tăng tuần tự. |
| DOC-BR-004 | Complete upload phải khớp size, media type và checksum. |
| DOC-BR-005 | Owner link là external reference, không cross-DB FK. |
| DOC-BR-006 | Patient chỉ thấy visibility PATIENT_RELEASED. |
| DOC-BR-007 | INFECTED bị quarantine và không retry cùng object. |
| DOC-BR-008 | Archive không xóa audit/version lịch sử. |

## 8. Scenarios và edge cases

- Upload hợp lệ: session OPEN, object đúng checksum, chuyển SCANNING; scan CLEAN cho phép link.
- Retry complete cùng key/payload trả cùng kết quả; key khác payload trả conflict.
- Object quá lớn, MIME không allowlist, checksum sai: reject và không tạo CLEAN version.
- Malware scan timeout: giữ SCANNING/FAILED, không false success, retry bounded.
- Actor đúng role nhưng không thuộc Encounter: trả 403/404 và không lộ metadata.
- Concurrent new-version: optimistic version chỉ một request thắng.
- Download URL hết hạn không được tái sử dụng.

## 9. Events và consistency

Outbound RabbitMQ: document.uploaded.v1, document.scan_completed.v1, document.rejected.v1, document.archived.v1. Event không chứa binary, PHI nội dung hay storage credential. Publish qua transactional outbox; consumer idempotent theo eventId.

Local PostgreSQL transaction quản lý metadata/outbox. Object storage và malware scanner là side effect; reconciliation kiểm tra orphan object, pending scan và outbox.

## 10. Security, audit và NFR

- Encryption in transit; storage encryption theo provider.
- Audit create upload, complete, link, download, release, archive và deny.
- Log documentId/requestId, không log URL ký, storage key hay nội dung.
- Default max size và URL TTL là configuration.
- P95 metadata local < 300 ms; binary transfer qua storage adapter.

## 11. Testing và acceptance

- Unit: state, checksum, version, access policy.
- Integration: DB/outbox/idempotency/object adapter.
- Contract: OpenAPI + proto compatibility.
- Security: unauthorized owner, expired URL, malware, filename/path traversal.
- Acceptance: không tài liệu nào được tải trước CLEAN; retry không duplicate; patient không thấy tài liệu chưa release.

## 12. Implementation plan

1. Module/config/health, PostgreSQL schema, storage adapter.
2. Upload/version/scan lifecycle và local audit/outbox.
3. Public REST, internal gRPC, service JWT scopes.
4. RabbitMQ publisher, scanner integration, reconciliation.
5. Contract/integration/security/E2E tests.

Out of scope: OCR, e-signature, legal retention duration, public CDN, multi-facility.
