import { Suspense } from 'react';
import { Result, Skeleton } from 'antd';
import { PatientSidebar } from '../../shared/components/navigation/PatientSidebar';
import { UserChip } from '../../shared/components/navigation/UserChip';
import { useAuthSession } from '../../app/AuthSessionProvider';
import { navigate, usePathname } from '../../app/navigation';
import { AdminThemeProvider } from './AdminThemeProvider';
import { AdminAuditProvider } from './AdminAuditContext';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPatientsPage } from './pages/AdminPatientsPage';
import { AdminDoctorsPage } from './pages/AdminDoctorsPage';
import { AdminSpecialtiesPage } from './pages/AdminSpecialtiesPage';
import { ResourcePage } from './pages/ResourcePage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminServicesPage } from './pages/AdminServicesPage';
import { AdminAuditLogsPage } from './pages/AdminAuditLogsPage';
import { AdminSystemHealthPage } from './pages/AdminSystemHealthPage';
import { RESOURCES, SECTION_TITLES, UNSUPPORTED } from './resources';
import './admin.css';

const DESCRIPTIONS: Record<string, string> = {
  overview: 'Tổng quan vận hành và các chỉ số hoạt động chính của hệ thống.',
  reports: 'Theo dõi lịch hẹn, số lượt khám và doanh thu theo khoảng thời gian.',
  doctors: 'Danh mục bác sĩ, thông tin chuyên khoa và trạng thái hoạt động.',
  specialties: 'Quản lý danh mục chuyên khoa khám chữa bệnh và đội ngũ bác sĩ phụ trách.',
  patients: 'Tra cứu hồ sơ bệnh nhân, thông tin liên hệ và danh bạ khẩn cấp.',
  users: 'Quản lý tài khoản, vai trò và trạng thái người dùng trong hệ thống.',
  services: 'Quản lý danh mục dịch vụ y tế, bảng giá viện phí, nhóm dịch vụ và thẻ tag.',
  'audit-log': 'Truy vết minh bạch y tế: sửa giá, đổi hạng bác sĩ, kích hoạt/khóa tài khoản, thời gian và địa chỉ IP.',
  'system-health': 'Giám sát trực tiếp trạng thái hoạt động (uptime/downtime) của 17 cụm microservices & Quản lý sao lưu dữ liệu.',
};

function Section({ section }: { section: string }) {
  if (section === 'overview') return <DashboardPage />;
  if (section === 'reports') return <ReportsPage />;
  if (section === 'doctors') return <AdminDoctorsPage />;
  if (section === 'specialties') return <AdminSpecialtiesPage />;
  if (section === 'patients') return <AdminPatientsPage />;
  if (section === 'users') return <AdminUsersPage />;
  if (section === 'services') return <AdminServicesPage />;
  if (section === 'audit-log') return <AdminAuditLogsPage />;
  if (section === 'system-health') return <AdminSystemHealthPage />;
  if (RESOURCES[section]) return <ResourcePage key={section} config={RESOURCES[section]} />;
  if (UNSUPPORTED[section]) return <Result status="info" title="Backend chưa hỗ trợ" subTitle={UNSUPPORTED[section].reason} />;
  return <Result status="404" title="Không tìm thấy mục quản trị" subTitle="Mục bạn chọn không tồn tại." />;
}

export default function AdminWorkspacePage() {
  const auth = useAuthSession();
  const pathname = usePathname();
  const section = pathname.split('/').filter(Boolean).at(-1) || 'overview';
  const title = SECTION_TITLES[section] ?? 'Quản trị hệ thống';
  const description = DESCRIPTIONS[section] ?? RESOURCES[section]?.description ?? UNSUPPORTED[section]?.description ?? '';

  async function logout() { await auth.signOut(); navigate('/admin/login', { replace: true }); }

  return (
    <AdminThemeProvider>
      <AdminAuditProvider>
        <div className="patient-home-shell patient-desktop-portal admin-shell">
          <PatientSidebar onLogout={() => void logout()} />
          <main className="patient-main-view" id="main-content">
            <header className="admin-topbar">
              <div className="admin-topbar-heading">
                <h1 className="admin-topbar-title">{title}</h1>
                <p className="admin-topbar-subtitle">{description}</p>
              </div>
              <div className="admin-topbar-actions">
                <UserChip onLogout={() => void logout()} showWorkspaceLink={false} />






              </div>
            </header>
            <section className="admin-content">
              <Suspense fallback={<Skeleton active />}><Section section={section} /></Suspense>
            </section>
          </main>
        </div>
      </AdminAuditProvider>
    </AdminThemeProvider>
  );
}
