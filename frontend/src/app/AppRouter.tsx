import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../services/api';
import { AuthSessionProvider, useAuthSession } from './AuthSessionProvider';
import { navigate, usePathname } from './navigation';
import { AuthPage } from '../pages/AuthPage';
import { PatientHomePage } from '../pages/PatientHomePage';
import { PatientProfilePage } from '../pages/PatientProfilePage';
import { PatientBookingPage } from '../pages/PatientBookingPage';
import { AppointmentDetailPage, PatientAppointmentsPage } from '../pages/PatientAppointmentsPage';
import { PatientQueuePage } from '../pages/PatientQueuePage';
import { PatientNotificationsBillingPage } from '../pages/PatientNotificationsBillingPage';
import { RoleWorkspacePage } from '../pages/RoleWorkspacePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import type { Role } from '../components/navigation/PatientSidebar';

import AdminWorkspacePage from '../admin/AdminWorkspacePage';
import { AdminLoginPage } from '../admin/pages/AdminLoginPage';

function Redirect({ to }: { to: string }) { useEffect(() => navigate(to, { replace: true }), [to]); return null; }
function homeForRole(role?: Role) {
  if (role === 'PATIENT') return '/tong-quan';
  if (role === 'ADMIN') return '/workspace/admin/overview';
  if (role) return `/workspace/${role.toLowerCase()}/overview`;
  return '/dang-nhap';
}
function Protected({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  if (auth.status === 'loading') return <main className="app-loading" role="status">Đang khôi phục phiên đăng nhập…</main>;
  if (auth.status === 'anonymous') return <Redirect to="/dang-nhap" />;
  if (auth.user?.role !== 'PATIENT') return <Redirect to={homeForRole(auth.user?.role as Role)} />;
  return <>{children}</>;
}
function PatientProfileRequired({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  const [state, setState] = useState<'loading' | 'complete' | 'missing' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    auth.request<{ data?: unknown }>('/api/patients/me')
      .then(() => { if (active) setState('complete'); })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.statusCode === 404) setState('missing');
        else setState('error');
      });
    return () => { active = false; };
  }, [auth.request]);

  if (state === 'loading') return <main className="app-loading" role="status">Đang kiểm tra hồ sơ bệnh nhân…</main>;
  if (state === 'missing') return <Redirect to="/ho-so/hoan-thien" />;
  if (state === 'error') return <main className="app-loading" role="alert"><h1>Không thể kiểm tra hồ sơ</h1><p>Vui lòng thử lại sau.</p></main>;
  return <>{children}</>;
}
function WorkspaceProtected({ role, children }: { role: Exclude<Role, 'PATIENT'>; children: ReactNode }) {
  const auth = useAuthSession();
  if (auth.status === 'loading') return <main className="app-loading" role="status">Đang khôi phục phiên đăng nhập…</main>;
  if (auth.status === 'anonymous') return <Redirect to={role === 'ADMIN' ? '/admin/login' : '/dang-nhap'} />;
  if (auth.user?.role !== role) return <main className="app-loading"><h1>403 - Không có quyền truy cập</h1><p>Không thể truy cập workspace của vai trò này.</p><button onClick={() => navigate(homeForRole(auth.user?.role as Role), { replace: true })}>Quay lại workspace</button></main>;
  return <>{children}</>;
}
function Routes() {
  const rawPath = usePathname();
  const path = (rawPath.split('?')[0].replace(/\/+$/, '') || '/').toLowerCase();
  const auth = useAuthSession();
  const isAdminPort = typeof window !== 'undefined' && window.location.port === '3001';

  if (auth.status === 'loading') return <main className="app-loading" role="status">Đang khôi phục phiên đăng nhập…</main>;
  if (isAdminPort && path === '/') {
    if (auth.status === 'authenticated' && auth.user?.role === 'ADMIN') return <Redirect to="/workspace/admin/overview" />;
    return <AdminLoginPage />;
  }
  if (path === '/admin/login' || path === '/admin/dang-nhap') {
    if (auth.status === 'authenticated' && auth.user?.role === 'ADMIN') return <Redirect to="/workspace/admin/overview" />;
    return <AdminLoginPage />;
  }
  if (path === '/admin') {
    if (auth.status === 'authenticated' && auth.user?.role === 'ADMIN') return <Redirect to="/workspace/admin/overview" />;
    return <Redirect to="/admin/login" />;
  }
  if (path === '/dang-nhap' || path === '/dang-ky') {
    if (auth.status === 'authenticated') return <Redirect to={homeForRole(auth.user?.role as Role)} />;
    return <AuthPage mode={path === '/dang-ky' ? 'register' : 'login'} />;
  }
  if (path === '/') return <Redirect to={auth.status === 'authenticated' ? homeForRole(auth.user?.role as Role) : '/dang-nhap'} />;

  const workspaceMatch = path.match(/^\/workspace\/([^/]+)(?:\/.*)?$/);
  if (workspaceMatch) {
    const workspaceRole = workspaceMatch[1].toUpperCase();
    if (auth.status === 'anonymous') return <Redirect to={workspaceRole === 'ADMIN' ? '/admin/login' : '/dang-nhap'} />;
    if (!['DOCTOR', 'RECEPTIONIST', 'NURSE', 'ADMIN'].includes(workspaceRole)) return <main className="app-loading"><h1>403 - Không có quyền truy cập</h1><p>Workspace không hợp lệ.</p></main>;
    const role = workspaceRole as Exclude<Role, 'PATIENT'>;
    if (role === 'ADMIN') return <WorkspaceProtected role={role}><AdminWorkspacePage /></WorkspaceProtected>;
    return <WorkspaceProtected role={role}><RoleWorkspacePage role={role} /></WorkspaceProtected>;
  }

  if (path === '/tong-quan') return <Protected><PatientHomePage /></Protected>;
  if (path === '/ho-so/hoan-thien' || path === '/ho-so') return <Protected><PatientProfilePage /></Protected>;
  if (path === '/dat-lich') return <Protected><PatientProfileRequired><PatientBookingPage /></PatientProfileRequired></Protected>;
  const appointmentDetailMatch = rawPath.match(/^\/lich-hen\/([^/]+)$/i);
  if (appointmentDetailMatch) return <Protected><PatientProfileRequired><AppointmentDetailPage appointmentId={decodeURIComponent(appointmentDetailMatch[1])} /></PatientProfileRequired></Protected>;
  if (path === '/lich-hen') return <Protected><PatientProfileRequired><PatientAppointmentsPage /></PatientProfileRequired></Protected>;
  if (path === '/hang-doi') return <Protected><PatientProfileRequired><PatientQueuePage /></PatientProfileRequired></Protected>;
  if (path === '/thong-bao-hoa-don') return <Protected><PatientNotificationsBillingPage /></Protected>;
  return <NotFoundPage />;
}
export function AppRouter() { return <AuthSessionProvider><Routes /></AuthSessionProvider>; }
