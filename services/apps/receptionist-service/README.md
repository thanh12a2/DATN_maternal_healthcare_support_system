# Receptionist Service

NestJS service for the basic operational receptionist profile described in
`docs/service_specs/reception-service-spec.md`. Shift scheduling, attendance,
leave, and availability management are outside this service's scope.

The profile stores full name, login-email snapshot, work phone, address,
department, gender, and avatar URL. A receptionist may update only their own
avatar; profile administration remains restricted to `ADMIN`.

## Implemented routes

- `GET /health`
- `GET /receptionists`
- `GET /receptionists/me`
- `GET /receptionists/:receptionistId`
- `PATCH /receptionists/me`
- `PATCH /receptionists/:receptionistId`
- `POST /receptionists/:receptionistId/deactivate`
- `POST /reception/appointments/search`
- `GET /reception/appointments/slots`
- `POST /reception/appointments` (đặt lịch hộ bệnh nhân; `channel=RECEPTION|WALK_IN`)
- `POST /reception/cases`
- `GET /reception/cases/:caseId`
- `POST /reception/cases/:caseId/identity-verifications`
- `GET /reception/cases/:caseId/invoice` (tạo/lấy base invoice qua Billing gRPC)
- `POST /reception/cases/:caseId/payments` (ghi nhận thanh toán qua Billing gRPC)
- `POST /reception/cases/:caseId/admit`

All protected routes verify the Auth Service RS256 access token locally. The
gateway paths are `/api/receptionists` for profile operations and
`/api/reception` for admission operations; the service listens on port `5006`.

## Deliberately not exposed

- `POST /receptionists` and `POST /receptionists/:id/activate` remain blocked
  until Auth Service provides a real internal active-account/role contract.
- Walk-in không có route riêng. Dùng `POST /reception/appointments` với
  `channel=WALK_IN`; Receptionist gọi Appointment Service qua internal gRPC.
- There are no mocks, hard-coded downstream results, or cross-service database
  queries.
- There are no shift, schedule, attendance, leave, or availability APIs.

## Database

The independent Prisma schema is `prisma/receptionist/schema.prisma` and uses
`RECEPTIONIST_DATABASE_URL`.

```sh
npm run prisma:generate:receptionist
npm run prisma:migrate:receptionist:dev
npx nest start receptionist-service --watch
```

Required runtime configuration: `RECEPTIONIST_DATABASE_URL`,
`AUTH_JWT_PUBLIC_KEY`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, and
`AUTH_JWT_KEY_ID`.

Postman walkthrough: `../../../docs/receptionist-service-postman-test.md`.
