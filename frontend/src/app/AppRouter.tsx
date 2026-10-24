import { useEffect, type ReactNode } from 'react';
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

function Redirect({ to }: { to: string }) { useEffect(() => navigate(to, { replace: true }), [to]); return null; }
function homeForRole(role?: Role) { return role === 'PATIENT' ? '/tong-quan' : role ? `/workspace/${role.toLowerCase()}/overview` : '/dang-nhap'; }
function Protected({ children }: { children: ReactNode }) { const auth = useAuthSession(); if (auth.status === 'loading') return <main className="app-loading" role="status">Đang khôi phục phiên đăng nhập…</main>; if (auth.status === 'anonymous') return <Redirect to="/dang-nhap" />; if (auth.user?.role !== 'PATIENT') return <main className="app-loading"><h1>Khu vực dành cho bệnh nhân</h1><p>Tài khoản hiện tại không có quyền truy cập Patient Portal.</p><button onClick={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))}>Đăng xuất</button></main>; return <>{children}</>; }
function WorkspaceProtected({ role, children }: { role: Exclude<Role, 'PATIENT'>; children: ReactNode }) { const auth = useAuthSession(); if (auth.status === 'loading') return <main className="app-loading" role="status">Đang khôi phục phiên đăng nhập…</main>; if (auth.status === 'anonymous') return <Redirect to="/dang-nhap" />; if (auth.user?.role !== role) return <main className="app-loading"><h1>403 - Không có quyền truy cập</h1><p>Không thể truy cập workspace của vai trò này.</p><button onClick={() => navigate(homeForRole(auth.user?.role as Role), { replace: true })}>Quay lại workspace</button></main>; return <>{children}</>; }
function Routes() { const path = usePathname(); const auth = useAuthSession(); if (auth.status === 'loading') return <main className="app-loading" role="status">Đang khôi phục phiên đăng nhập…</main>;
  if (path === '/dang-nhap' || path === '/dang-ky') { if (auth.status === 'authenticated') return <Redirect to={homeForRole(auth.user?.role as Role)} />; return <AuthPage mode={path === '/dang-ky' ? 'register' : 'login'} />; }
  if (path === '/' ) return <Redirect to={auth.status === 'authenticated' ? homeForRole(auth.user?.role as Role) : '/dang-nhap'} />;
  const workspaceMatch = path.match(/^\/workspace\/([^/]+)(?:\/.*)?$/);
  if (workspaceMatch) {
    const workspaceRole = workspaceMatch[1].toUpperCase();
    if (auth.status === 'anonymous') return <Redirect to="/dang-nhap" />;
    if (!['DOCTOR', 'RECEPTIONIST', 'NURSE', 'ADMIN'].includes(workspaceRole)) return <main className="app-loading"><h1>403 - Không có quyền truy cập</h1><p>Workspace không hợp lệ.</p></main>;
    const role = workspaceRole as Exclude<Role, 'PATIENT'>;
    return <WorkspaceProtected role={role}><RoleWorkspacePage role={role} /></WorkspaceProtected>;
  }
  if (path === '/tong-quan') return <Protected><PatientHomePage /></Protected>;
  if (path === '/ho-so/hoan-thien' || path === '/ho-so') return <Protected><PatientProfilePage /></Protected>;
  if (path === '/dat-lich') return <Protected><PatientBookingPage /></Protected>;
  const appointmentDetailMatch = path.match(/^\/lich-hen\/([^/]+)$/);
  if (appointmentDetailMatch) return <Protected><AppointmentDetailPage appointmentId={decodeURIComponent(appointmentDetailMatch[1])} /></Protected>;
  if (path === '/lich-hen') return <Protected><PatientAppointmentsPage /></Protected>;
  if (path === '/hang-doi') return <Protected><PatientQueuePage /></Protected>;
  if (path === '/thong-bao-hoa-don') return <Protected><PatientNotificationsBillingPage /></Protected>;
  return <NotFoundPage />;
}
export function AppRouter() { return <AuthSessionProvider><Routes /></AuthSessionProvider>; }
