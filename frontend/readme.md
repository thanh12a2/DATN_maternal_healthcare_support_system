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
