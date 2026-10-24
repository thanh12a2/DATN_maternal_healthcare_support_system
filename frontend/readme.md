# Frontend

React/Vite frontend cho cổng bệnh nhân An Tâm Medical.

## Tech Stack

| Component | Choice |
|---|---|
| Framework | React |
| Language | TypeScript |
| Build tool | Vite |
| Styling | CSS modules/global CSS theo design tokens trong handoff |
| Testing | Vitest + React Testing Library |
| API | Fetch qua Kong API Gateway |

## Auth UI hiện tại

Trang hiện implement giao diện đăng nhập/đăng ký theo handoff:

- Login/Register trong cùng authentication shell.
- Nền hình học động, tự giảm animation với `prefers-reduced-motion`.
- Show/hide password.
- Validation từng field với success/error states.
- Semantic label, keyboard navigation và focus-visible states.
- Login gọi `POST /auth/login` qua Gateway với `email` và `password`.
- Register gọi `POST /auth/register` qua Gateway với `email` và `password`.
- Public register không cho chọn role; backend luôn gán `PATIENT`.

## Environment Variables

Tạo từ root `.env.example`:

```env
FRONTEND_PORT=3000
VITE_API_BASE_URL=http://localhost:8080
```

Frontend chạy trong browser nên `VITE_API_BASE_URL` nên là URL browser truy cập được, thường là Kong:

```text
http://localhost:8080
```

## Chạy local

```powershell
cd D:\DATN_maternal_healthcare_support_system\frontend
npm.cmd install
npm.cmd run dev
```

Mở:

```text
http://localhost:3000
```

## Chạy bằng Docker Compose

Từ project root:

```powershell
cd D:\DATN_maternal_healthcare_support_system
docker compose up frontend --build
```

Frontend chạy tại:

```text
http://localhost:3000
```

## Test/build

```powershell
cd D:\DATN_maternal_healthcare_support_system\frontend
npm.cmd run test
npm.cmd run build
```

## Admin Portal (Ant Design)

Role `ADMIN` được chuyển vào `/workspace/admin/<section>` và render `src/admin/AdminWorkspacePage.tsx` (lazy-load, dùng lại sidebar/topbar hiện có). Ant Design chỉ được bọc trong `AdminThemeProvider`, không ảnh hưởng portal bệnh nhân.

| Section | Nguồn dữ liệu (qua Kong) |
|---|---|
| `overview` | `/api/reports/overview` + số lượng doctors/services/appointments |
| `reports` | `/api/reports/appointments`, `/api/reports/revenue` (`fromDate`, `toDate`) |
| `appointments`, `billing`, `doctors`, `services`, `queue` | `/api/appointment/appointments`, `/api/billing/invoices`, `/api/doctors`, `/api/catalog/services`, `/api/queue/stages` |
| `encounters`, `prescriptions`, `treatment-plans`, `consultations` | `/api/medical-records/encounters`, `/api/prescriptions`, `/api/treatment-plans`, `/api/consultations` |
| `patients` | `POST /api/patients/search` (backend không có GET list) |
| `users`, `audit-log` | **Chưa có HTTP API ở backend** nên hiển thị trạng thái "Backend chưa hỗ trợ" |

Thêm một mục dữ liệu mới: khai báo trong `src/admin/resources.tsx` (endpoint + cột), rồi thêm mục vào `workspaceNav.ADMIN` trong `PatientSidebar.tsx`.

## Project Structure

```text
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/auth/
│   ├── schemas/auth.ts
│   ├── services/auth.ts
│   ├── styles/auth.css
│   └── test/setup.ts
└── Dockerfile
```

## Lưu ý backend hiện tại

Backend Auth Service hiện yêu cầu public register body gồm:

```json
{
  "email": "patient@example.com",
  "password": "Password123!"
}
```

Backend luôn gán role `PATIENT` cho public registration. Các role khác như `ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST` chỉ nên được cấp bởi account `ADMIN` thông qua admin-only endpoint ở phase sau.

Các thông tin hồ sơ bệnh nhân như họ tên/ngày sinh/điện thoại/giới tính chưa được thu ở form này vì chúng thuộc Patient/Profile Service, không thuộc public Auth register contract hiện tại.
