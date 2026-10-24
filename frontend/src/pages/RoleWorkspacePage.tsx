import { useEffect, useMemo, useState } from 'react';
import { PatientSidebar, type Role } from '../components/navigation/PatientSidebar';
import { useAuthSession } from '../app/AuthSessionProvider';
import { navigate, usePathname } from '../app/navigation';
import { ApiError } from '../services/api';
import { listDoctors } from '../services/doctor';
import { listEncounters, listPrescriptions, listTreatmentPlans } from '../services/clinical';
import { getReportOverview, getMyReceptionist, listConsultations } from '../services/operations';
import { ReceptionistAdmissionWorkspace } from '../components/receptionist/ReceptionistAdmissionWorkspace';
import { ReceptionistQueueWorkspace } from '../components/receptionist/ReceptionistQueueWorkspace';
import { ReceptionistBillingWorkspace } from '../components/receptionist/ReceptionistBillingWorkspace';
import { ReceptionistWorkspaceFrame } from '../components/receptionist/ReceptionistWorkspaceFrame';
import { ReceptionistAppointmentsWorkspace } from '../components/receptionist/ReceptionistAppointmentsWorkspace';
import { DoctorWorkspaceFrame } from '../components/doctor/DoctorWorkspaceFrame';
import { DoctorWorkspace } from '../components/doctor/DoctorWorkspace';
import '../styles/patient-home.css';
import '../styles/patient-portal.css';
import '../styles/receptionist-content.css';
import '../styles/receptionist-fixes.css';
import '../styles/doctor-content.css';

type WorkspaceState = 'loading' | 'ready' | 'error' | 'unavailable';
type Summary = { label: string; value: string; detail: string };

const roleNames: Record<Exclude<Role, 'PATIENT'>, string> = {
  DOCTOR: 'Bác sĩ',
  RECEPTIONIST: 'Lễ tân',
  NURSE: 'Điều dưỡng',
  ADMIN: 'Quản trị viên',
};

const sectionNames: Record<string, string> = {
  overview: 'Tổng quan', appointments: 'Lịch khám', patients: 'Bệnh nhân', encounters: 'Hồ sơ khám', schedule: 'Lịch làm việc', consultations: 'Tư vấn', profile: 'Hồ sơ cá nhân',
  reception: 'Tiếp nhận', 'check-in': 'Check-in', queue: 'Hàng đợi', billing: 'Hóa đơn', today: 'Bệnh nhân hôm nay', vitals: 'Sinh hiệu', notes: 'Ghi chú điều dưỡng',
  users: 'Người dùng', doctors: 'Bác sĩ', services: 'Dịch vụ & giá', 'audit-log': 'Audit log', reports: 'Báo cáo',
};

function ReceptionistOverview({ summaries, state, error }: { summaries: Summary[]; state: WorkspaceState; error: string }) {
  if (state === 'loading') return <div className="receptionist-loading-lines"><i /><i /><i /></div>;
  if (state === 'error') return <section className="receptionist-empty" role="alert"><strong>Không thể tải tổng quan</strong><p>{error}</p></section>;
  if (!summaries.length) return <section className="receptionist-empty"><strong>Chưa có dữ liệu vận hành</strong><p>Hãy bắt đầu từ Tiếp nhận để tìm bệnh nhân và lịch hẹn.</p></section>;
  return <><section className="receptionist-overview-grid">{summaries.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><p>{item.detail}</p></article>)}</section><section className="receptionist-next-actions"><span className="receptionist-kicker">Việc cần làm</span><h2>Bắt đầu tiếp nhận bệnh nhân</h2><p>Tìm bệnh nhân theo họ tên, số điện thoại hoặc CCCD; sau đó chọn lịch hẹn để mở case.</p><div><button type="button" onClick={() => navigate('/workspace/receptionist/patients')}>Tra cứu bệnh nhân</button><button type="button" onClick={() => navigate('/workspace/receptionist/reception')}>Mở tiếp nhận</button></div></section></>;
}

function apiMessage(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 403) return 'Tài khoản không có quyền xem dữ liệu này.';
  if (error instanceof ApiError && error.statusCode === 404) return 'API chưa có dữ liệu cho khu vực này.';
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu workspace.';
}

export function RoleWorkspacePage({ role }: { role: Exclude<Role, 'PATIENT'> }) {
  const auth = useAuthSession();
  const pathname = usePathname();
  const section = pathname.split('/').filter(Boolean).at(-1) || 'overview';
  const title = sectionNames[section] ?? 'Không gian làm việc';
  const [state, setState] = useState<WorkspaceState>('loading');
  const [error, setError] = useState('');
  const [summaries, setSummaries] = useState<Summary[]>([]);

  const workspaceDescription = useMemo(() => {
    if (role === 'DOCTOR') return 'Theo dõi lịch khám và dữ liệu lâm sàng được phân quyền.';
    if (role === 'RECEPTIONIST') return 'Quản lý tiếp nhận và hỗ trợ hành trình khám của người bệnh.';
    if (role === 'NURSE') return 'Theo dõi công việc điều dưỡng và encounter được phân công.';
    return 'Theo dõi vận hành bằng dữ liệu báo cáo được backend cấp quyền.';
  }, [role]);

  useEffect(() => {
    let active = true;
    setState('loading');
    setError('');
    setSummaries([]);
    const load = async () => {
      try {
        if (role === 'DOCTOR') {
          const [doctors, encounters, consultations] = await Promise.all([
            listDoctors(auth.request),
            listEncounters(auth.request),
            listConsultations(auth.request),
          ]);
          if (active) setSummaries([
            { label: 'Bác sĩ hoạt động', value: String(doctors.length), detail: 'Danh mục bác sĩ hiện có' },
            { label: 'Encounter', value: String(encounters.length), detail: 'Dữ liệu theo quyền truy cập' },
            { label: 'Tư vấn', value: String(consultations.length), detail: 'Cuộc hội thoại được phân công' },
          ]);
        } else if (role === 'NURSE') {
          const [encounters, prescriptions, plans] = await Promise.all([
            listEncounters(auth.request),
            listPrescriptions(auth.request),
            listTreatmentPlans(auth.request),
          ]);
          if (active) setSummaries([
            { label: 'Encounter được phân công', value: String(encounters.length), detail: 'Không tự suy diễn quyền clinical' },
            { label: 'Đơn thuốc liên quan', value: String(prescriptions.length), detail: 'Dữ liệu do backend trả về' },
            { label: 'Kế hoạch điều trị', value: String(plans.length), detail: 'Theo assignment/permission' },
          ]);
        } else if (role === 'RECEPTIONIST') {
          const profile = await getMyReceptionist(auth.request);
          if (active) setSummaries([
            { label: 'Hồ sơ tài khoản', value: profile ? 'Đã kết nối' : 'Trống', detail: 'Receptionist Service' },
            { label: 'Tiếp nhận', value: 'Sẵn sàng', detail: 'Mở case khi có appointment hợp lệ' },
            { label: 'Check-in', value: 'Theo quyền', detail: 'Business flow do backend quyết định' },
          ]);
        } else {
          const report = await getReportOverview(auth.request);
          const values = Object.entries(report ?? {}).filter(([, value]) => ['string', 'number'].includes(typeof value)).slice(0, 3);
          if (active) setSummaries(values.length ? values.map(([label, value]) => ({ label, value: String(value), detail: 'Reporting Service' })) : [{ label: 'Báo cáo vận hành', value: 'Đã kết nối', detail: 'Chưa có metric trong khoảng thời gian hiện tại' }]);
        }
        if (active) setState('ready');
      } catch (reason) {
        if (!active) return;
        if (reason instanceof ApiError && [404, 501].includes(reason.statusCode)) setState('unavailable');
        else { setError(apiMessage(reason)); setState('error'); }
      }
    };
    void load();
    return () => { active = false; };
  }, [auth.request, role, section]);

  if (role === 'DOCTOR') {
    return <div className="patient-home-shell patient-desktop-portal doctor-portal"><PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} /><main className="patient-main-view doctor-main"><DoctorWorkspaceFrame section={section}><DoctorWorkspace section={section} request={auth.request} email={auth.user?.email} /></DoctorWorkspaceFrame></main></div>;
  }

  if (role === 'RECEPTIONIST') {
    const receptionistContent = section === 'appointments' ? <ReceptionistAppointmentsWorkspace request={auth.request} /> : section === 'queue' ? <ReceptionistQueueWorkspace request={auth.request} /> : section === 'billing' ? <ReceptionistBillingWorkspace request={auth.request} /> : ['patients', 'reception', 'check-in'].includes(section) ? <ReceptionistAdmissionWorkspace section={section} request={auth.request} /> : <ReceptionistOverview summaries={summaries} state={state} error={error} />;
    return <div className="patient-home-shell patient-desktop-portal receptionist-portal"><PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} /><main className="patient-main-view receptionist-main"><ReceptionistWorkspaceFrame section={section}>{receptionistContent}</ReceptionistWorkspaceFrame></main></div>;
  }

  async function logout() { await auth.signOut(); navigate('/dang-nhap', { replace: true }); }
  return <div className="patient-home-shell patient-desktop-portal">
    <PatientSidebar onLogout={() => void logout()} />
    <main className="patient-main-view" id="main-content">
      <header className="patient-topbar"><div><span>{roleNames[role]} workspace</span><strong>{title}</strong></div><div className="patient-account-chip"><span>{auth.user?.email}</span></div></header>
      <section className="patient-home-section patient-dashboard-section">
        <div className="patient-page-heading"><span>Không gian {roleNames[role].toLowerCase()}</span><h1>{title}</h1><p>{workspaceDescription}</p></div>
        {state === 'loading' && <article className="portal-card" role="status"><h2>Đang tải dữ liệu</h2><p>Đang kiểm tra dữ liệu từ các service được cấp quyền…</p></article>}
        {state === 'error' && <article className="portal-card" role="alert"><h2>Không thể tải workspace</h2><p>{error}</p><button className="patient-primary-action" type="button" onClick={() => window.location.reload()}>Thử lại</button></article>}
        {state === 'unavailable' && <article className="portal-card portal-empty"><div><div className="portal-empty-icon" aria-hidden="true">!</div><h2>Tính năng chưa khả dụng</h2><p>Backend chưa expose dữ liệu cho khu vực này hoặc tài khoản chưa được provision.</p></div></article>}
        {state === 'ready' && <>
          <div className="patient-dashboard-grid" aria-label="Tóm tắt workspace">{summaries.map((item) => <article className="patient-dashboard-card" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><p>{item.detail}</p></article>)}</div>
          <article className="portal-card" style={{ marginTop: 20 }}><span className="portal-badge">Trạng thái hệ thống</span><h2 style={{ marginTop: 12 }}>{title} đã kết nối API</h2><p className="portal-note">Các thao tác thay đổi dữ liệu clinical, payment hoặc vận hành chỉ được thực hiện khi backend trả về permission và state hợp lệ.</p></article>
        </>}
      </section>
    </main>
  </div>;
}
