# Ghi chú migration internal HTTP sang gRPC

> Target đã APPROVED; source hiện tại chưa được thay đổi bởi task tài liệu này.

## Current compatibility đã xác nhận

- Auth source có HTTP account lookup bằng shared secret.
- Patient source/spec có internal eligibility HTTP và internal JWT guard.
- Doctor/Catalog từng mô tả HTTP `/internal/*`.
- Reception Admission chưa implemented.

## Target

- Public REST chỉ qua Kong; OpenAPI không chứa `/internal/*`.
- Internal synchronous call dùng proto trong `docs/grpc/` với RS256 service JWT, audience/scope/deadline/correlation/idempotency.
- Không dùng user JWT, unsigned service-name hoặc shared static secret làm target service identity.

## Migration gates

1. Implement gRPC server song song và contract tests.
2. Migrate caller theo dependency order, quan sát metrics và reconciliation.
3. Chặn HTTP compatibility route khỏi Kong/public network trong toàn bộ giai đoạn.
4. Chỉ xóa compatibility HTTP sau khi không còn caller và rollback window kết thúc.
5. Cập nhật source/config/tests; tài liệu target không chứng minh source đã migrate.
