import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate, usePathname } from '../../../app/navigation';
import { PatientSidebar } from '../../../shared/components/navigation/PatientSidebar';
import { ApiError } from '../../../services/api';
import { activateDoctor, deactivateDoctor, getDoctor, listDoctors, type DoctorItem } from '../../../services/adminDoctors';
import { activateService, deactivateService, listAdminServices, type MedicalServiceItem } from '../../../services/adminCatalog';
import {
  createManagedStaff,
  listManagedDoctorSchedules,
  listManagedReceptionists,
  listManagedStaff,
  listManagerAppointments,
  setManagedStaffStatus,
  type ManagedStaff,
  type ManagerAppointment,
  type ManagedDoctorSchedule,
  type ReceptionistSummary,
} from '../../../services/clinicManager';
import { getAppointmentReport, getReportOverview, getRevenueReport } from '../../../services/operations';
import '../../../styles/clinic-manager.css';

type LoadState = 'loading' | 'ready' | 'error';
const titles: Record<string, [string, string]> = {
  overview: ['Tổng quan vận hành', 'Theo dõi các chỉ số và việc cần xử lý tại phòng khám.'],
  staff: ['Nhân sự vận hành', 'Tạo và quản lý trạng thái tài khoản bác sĩ, điều dưỡng và lễ tân.'],
  doctors: ['Bác sĩ & lịch làm việc', 'Theo dõi hồ sơ, trạng thái và mức độ sẵn sàng của đội ngũ bác sĩ.'],
  receptionists: ['Lễ tân', 'Theo dõi hồ sơ lễ tân phục vụ cho hoạt động tiếp nhận.'],
  services: ['Dịch vụ & giá', 'Quản lý trạng thái cung cấp dịch vụ và khả năng đặt lịch.'],
  appointments: ['Điều phối lịch hẹn', 'Theo dõi các lịch hẹn cần điều phối; không thao tác thay bệnh án.'],
  reports: ['Báo cáo vận hành', 'Theo dõi lịch hẹn và doanh thu trong khoảng thời gian gần đây.'],
};

function errorText(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 403) return 'Tài khoản không có quyền thực hiện thao tác này.';
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu.';
}
function status(value?: string) { return value === 'ACTIVE' ? 'Đang hoạt động' : value === 'DISABLED' || value === 'INACTIVE' ? 'Tạm ngưng' : value === 'DRAFT' ? 'Bản nháp' : value ?? 'Chờ cập nhật'; }
function date(value?: string) { return value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'; }
function unwrapNumber(source: unknown, keys: string[]) { if (!source || typeof source !== 'object') return 0; const object = source as Record<string, unknown>; for (const key of keys) { const value = object[key]; if (typeof value === 'number') return value; if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value); } return 0; }

export function ClinicManagerWorkspace() {
  const auth = useAuthSession();
  const pathname = usePathname();
  const section = pathname.split('/').filter(Boolean).at(-1) || 'overview';
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [receptionists, setReceptionists] = useState<ReceptionistSummary[]>([]);
  const [services, setServices] = useState<MedicalServiceItem[]>([]);
  const [appointments, setAppointments] = useState<ManagerAppointment[]>([]);
  const [reportOverview, setReportOverview] = useState<Record<string, unknown>>({});
  const [appointmentReport, setAppointmentReport] = useState<Record<string, unknown>>({});
  const [revenueReport, setRevenueReport] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorItem | null>(null);
  const [selectedSchedules, setSelectedSchedules] = useState<ManagedDoctorSchedule[]>([]);

  const load = async () => {
    setState('loading'); setError(''); setMessage('');
    try {
      if (section === 'overview') {
        const [report, people, doctorRows, receptionistRows, appointmentRows] = await Promise.all([
          getReportOverview(auth.request), listManagedStaff(auth.request), listDoctors(auth.request, { limit: 100 }), listManagedReceptionists(auth.request), listManagerAppointments(auth.request),
        ]);
        setReportOverview((report ?? {}) as Record<string, unknown>); setStaff(people); setDoctors(doctorRows.data); setReceptionists(receptionistRows); setAppointments(appointmentRows);
      } else if (section === 'staff') setStaff(await listManagedStaff(auth.request));
      else if (section === 'doctors') setDoctors((await listDoctors(auth.request, { limit: 100 })).data);
      else if (section === 'receptionists') setReceptionists(await listManagedReceptionists(auth.request));
      else if (section === 'services') setServices((await listAdminServices(auth.request, { limit: 100 })).items);
      else if (section === 'appointments') setAppointments(await listManagerAppointments(auth.request));
      else if (section === 'reports') {
        const [overview, appointmentData, revenueData] = await Promise.all([getReportOverview(auth.request), getAppointmentReport(auth.request), getRevenueReport(auth.request)]);
        setReportOverview((overview ?? {}) as Record<string, unknown>); setAppointmentReport((appointmentData ?? {}) as Record<string, unknown>); setRevenueReport((revenueData ?? {}) as Record<string, unknown>);
      }
      setState('ready');
    } catch (reason) { setError(errorText(reason)); setState('error'); }
  };
  useEffect(() => { void load(); }, [section, auth.request]);

  const counts = useMemo(() => ({
    activeDoctors: doctors.filter((item) => item.status === 'ACTIVE').length,
    inactiveReceptionists: receptionists.filter((item) => item.status !== 'ACTIVE').length,
    pendingAppointments: appointments.filter((item) => ['REASSIGNMENT_REQUIRED', 'BOOKED'].includes(String(item.status))).length,
  }), [doctors, receptionists, appointments]);

  async function logout() { await auth.signOut(); navigate('/dang-nhap', { replace: true }); }
  async function chooseDoctor(id: string) { try { const [doctor, schedules] = await Promise.all([getDoctor(auth.request, id), listManagedDoctorSchedules(auth.request, id)]); setSelectedDoctor(doctor); setSelectedSchedules(schedules); } catch (reason) { setMessage(errorText(reason)); } }
  async function changeDoctorStatus(active: boolean) {
    if (!selectedDoctor) return;
    try {
      const next = active ? await activateDoctor(auth.request, selectedDoctor.id, selectedDoctor.version) : await deactivateDoctor(auth.request, selectedDoctor.id, selectedDoctor.version, 'Điều phối vận hành phòng khám');
      setSelectedDoctor(next); setMessage('Đã cập nhật trạng thái bác sĩ.'); await load();
    } catch (reason) { setMessage(errorText(reason)); }
  }
  async function changeServiceStatus(item: MedicalServiceItem) {
    try { item.status === 'ACTIVE' ? await deactivateService(auth.request, item.id) : await activateService(auth.request, item.id); await load(); }
    catch (reason) { setMessage(errorText(reason)); }
  }

  const [title, description] = titles[section] ?? titles.overview;
  return <div className="patient-home-shell patient-desktop-portal clinic-manager-shell">
    <PatientSidebar onLogout={() => void logout()} />
    <main className="patient-main-view" id="main-content">
      <header className="clinic-topbar"><div><span>Clinic manager workspace</span><h1>{title}</h1><p>{description}</p></div><div className="clinic-account"><b>{(auth.user?.email ?? 'CM').slice(0, 2).toUpperCase()}</b><span>{auth.user?.email}<small>Quản lý phòng khám</small></span></div></header>
      <section className="clinic-content">
        {message && <div className="clinic-feedback" role="status">{message}</div>}
        {state === 'loading' && <div className="clinic-loading"><i /><i /><i /></div>}
        {state === 'error' && <section className="clinic-error" role="alert"><strong>Không thể tải dữ liệu</strong><p>{error}</p><button onClick={() => void load()}>Thử lại</button></section>}
        {state === 'ready' && (section === 'overview' ? <Overview report={reportOverview} staff={staff.length} doctors={counts.activeDoctors} receptionists={counts.inactiveReceptionists} appointments={counts.pendingAppointments} /> : null)}
        {state === 'ready' && section === 'staff' && <StaffPanel items={staff} request={auth.request} onDone={load} />}
        {state === 'ready' && section === 'doctors' && <DoctorsPanel items={doctors} selected={selectedDoctor} schedules={selectedSchedules} onSelect={chooseDoctor} onStatus={changeDoctorStatus} />}
        {state === 'ready' && section === 'receptionists' && <ReceptionistsPanel items={receptionists} />}
        {state === 'ready' && section === 'services' && <ServicesPanel items={services} onChange={changeServiceStatus} />}
        {state === 'ready' && section === 'appointments' && <AppointmentsPanel items={appointments} />}
        {state === 'ready' && section === 'reports' && <ReportsPanel overview={reportOverview} appointments={appointmentReport} revenue={revenueReport} />}
      </section>
    </main>
  </div>;
}

function Overview({ report, staff, doctors, receptionists, appointments }: { report: Record<string, unknown>; staff: number; doctors: number; receptionists: number; appointments: number }) {
  const revenue = unwrapNumber(report, ['totalCollectedAmount', 'revenue', 'totalRevenue']);
  return <><section className="clinic-kpis"><Kpi label="Bác sĩ hoạt động" value={doctors} note="Sẵn sàng phục vụ" /><Kpi label="Tài khoản vận hành" value={staff} note="Doctor · Nurse · Receptionist" /><Kpi label="Lễ tân cần rà soát" value={receptionists} note="Đang tạm ngưng hoạt động" /><Kpi label="Lịch cần theo dõi" value={appointments} note="Booked hoặc cần điều phối" /></section><section className="clinic-overview-grid"><article className="clinic-card"><span className="clinic-kicker">KPI từ Reporting Service</span><h2>{revenue.toLocaleString('vi-VN')} VND</h2><p>Doanh thu đã thu trong kỳ báo cáo mặc định của hệ thống.</p></article><article className="clinic-card"><span className="clinic-kicker">Ưu tiên vận hành</span><ul><li>Rà soát bác sĩ inactive hoặc chưa sẵn sàng.</li><li>Đảm bảo dịch vụ active trước khi mở đặt lịch.</li><li>Kiểm tra lịch hẹn cần điều phối lại.</li></ul></article></section></>;
}
function Kpi({ label, value, note }: { label: string; value: number; note: string }) { return <article className="clinic-kpi"><span>{label}</span><strong>{String(value).padStart(2, '0')}</strong><small>{note}</small></article>; }

function StaffPanel({ items, request, onDone }: { items: ManagedStaff[]; request: any; onDone: () => Promise<void> }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState<'DOCTOR' | 'NURSE' | 'RECEPTIONIST'>('RECEPTIONIST'); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setNotice(''); try { await createManagedStaff(request, { email, password, role }); setEmail(''); setPassword(''); setNotice('Đã tạo tài khoản nhân sự.'); await onDone(); } catch (reason) { setNotice(errorText(reason)); } finally { setBusy(false); } }
  async function toggle(item: ManagedStaff) { try { await setManagedStaffStatus(request, item.userId, item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'); await onDone(); } catch (reason) { setNotice(errorText(reason)); } }
  return <div className="clinic-split"><article className="clinic-card"><span className="clinic-kicker">Tạo nhân sự</span><h2>Tài khoản vận hành mới</h2><form className="clinic-form" onSubmit={submit}><input value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="Email đăng nhập" required /><input value={password} type="password" minLength={8} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu tối thiểu 8 ký tự" required /><select value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="RECEPTIONIST">Lễ tân</option><option value="NURSE">Điều dưỡng</option><option value="DOCTOR">Bác sĩ</option></select><button disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</button></form>{notice && <p className="clinic-note">{notice}</p>}<p className="clinic-muted">Quản lý phòng khám không thể tạo Admin hoặc Clinic Manager.</p></article><ListCard title="Tài khoản vận hành" columns={['Email', 'Vai trò', 'Trạng thái', '']} rows={items.map((item) => <tr key={item.userId}><td>{item.email}</td><td>{item.role}</td><td><Status value={item.status} /></td><td><button className="clinic-link" onClick={() => void toggle(item)}>{item.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</button></td></tr>)} /></div>;
}

function DoctorsPanel({ items, selected, schedules, onSelect, onStatus }: { items: DoctorItem[]; selected: DoctorItem | null; schedules: ManagedDoctorSchedule[]; onSelect: (id: string) => void; onStatus: (active: boolean) => void }) { const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']; return <div className="clinic-split"><ListCard title="Đội ngũ bác sĩ" columns={['Bác sĩ', 'Chuyên khoa', 'Trạng thái', '']} rows={items.map((item) => <tr key={item.id}><td><strong>{item.profile?.fullName || 'Chưa có tên'}</strong><small>{item.consultationRank}</small></td><td>{item.specialties?.map((x) => x.name).join(', ') || 'Chưa gán'}</td><td><Status value={item.status} /></td><td><button className="clinic-link" onClick={() => onSelect(item.id)}>Chi tiết</button></td></tr>)} /><aside className="clinic-card clinic-detail"><span className="clinic-kicker">Điều phối bác sĩ</span>{selected ? <><h2>{selected.profile?.fullName}</h2><p>{selected.specialties?.map((x) => x.name).join(', ') || 'Chưa gán chuyên khoa'} · phiên bản {selected.version}</p><div className="clinic-actions"><button onClick={() => onStatus(true)} disabled={selected.status === 'ACTIVE'}>Kích hoạt</button><button className="is-danger" onClick={() => onStatus(false)} disabled={selected.status !== 'ACTIVE'}>Tạm ngưng</button></div><div className="clinic-schedule-list"><strong>Lịch làm việc hiện có</strong>{schedules.length ? schedules.map((item) => <span key={item.id}>{weekdays[Math.max(0, item.dayOfWeek - 1)] ?? 'Chưa xác định'} · {item.startTime}–{item.endTime}</span>) : <small>Chưa có lịch làm việc được cấu hình.</small>}</div><p className="clinic-muted">Kích hoạt chỉ thành công khi hồ sơ bác sĩ thỏa các điều kiện nghiệp vụ của Doctor Service.</p></> : <Empty text="Chọn một bác sĩ để xem trạng thái và thực hiện điều phối." />}</aside></div>; }
function ReceptionistsPanel({ items }: { items: ReceptionistSummary[] }) { return <ListCard title="Hồ sơ lễ tân" columns={['Họ tên', 'Email', 'Bộ phận', 'Trạng thái']} rows={items.map((item) => <tr key={item.id}><td>{item.profile?.fullName || 'Chưa cập nhật'}</td><td>{item.profile?.loginEmail || '—'}</td><td>{item.profile?.department || 'Tiếp nhận'}</td><td><Status value={item.status} /></td></tr>)} />; }
function ServicesPanel({ items, onChange }: { items: MedicalServiceItem[]; onChange: (item: MedicalServiceItem) => void }) { return <ListCard title="Dịch vụ & khả năng đặt lịch" columns={['Dịch vụ', 'Loại', 'Đặt lịch', 'Trạng thái', '']} rows={items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.durationMinutes ? `${item.durationMinutes} phút` : 'Chưa có thời lượng'}</small></td><td>{item.kind}</td><td>{item.bookingEnabled ? 'Có' : 'Không'}</td><td><Status value={item.status} /></td><td><button className="clinic-link" onClick={() => void onChange(item)}>{item.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</button></td></tr>)} />; }
function AppointmentsPanel({ items }: { items: ManagerAppointment[] }) { return <><ListCard title="Lịch hẹn gần nhất" columns={['Mã lịch hẹn', 'Thời gian', 'Trạng thái', 'Bác sĩ']} rows={items.map((item) => <tr key={item.id}><td>{item.appointmentCode || item.id.slice(0, 8).toUpperCase()}</td><td>{date(item.startAt)}</td><td><Status value={item.status} /></td><td>{item.assignedDoctorId ? 'Đã phân công' : 'Chưa phân công'}</td></tr>)} /><p className="clinic-muted clinic-inline-note">Đổi lịch hoặc đổi bác sĩ cần xác nhận nghiệp vụ riêng; màn hình này không tự thay đổi appointment.</p></>; }
function ReportsPanel({ overview, appointments, revenue }: { overview: Record<string, unknown>; appointments: Record<string, unknown>; revenue: Record<string, unknown> }) { const appointmentRows = Array.isArray(appointments.rows) ? appointments.rows.length : 0; const revenueRows = Array.isArray(revenue.rows) ? revenue.rows.length : 0; return <><section className="clinic-kpis"><Kpi label="Doanh thu đã thu" value={unwrapNumber(revenue, ['totalCollectedAmount'])} note="Đơn vị VND" /><Kpi label="Dòng báo cáo lịch hẹn" value={appointmentRows} note="Theo ngày" /><Kpi label="Dòng báo cáo doanh thu" value={revenueRows} note="Theo ngày" /><Kpi label="Kỳ báo cáo" value={Array.isArray(overview.rows) ? overview.rows.length : 0} note="Dữ liệu tổng quan" /></section><article className="clinic-card"><span className="clinic-kicker">Nguồn dữ liệu</span><h2>Reporting Service</h2><p>API hiện hỗ trợ báo cáo tổng quan, lịch hẹn, doanh thu và xuất CSV. UI không tự tính lại dữ liệu tài chính.</p></article></>; }
function ListCard({ title, columns, rows }: { title: string; columns: string[]; rows: ReactNode[] }) { return <article className="clinic-card clinic-list"><div className="clinic-card-head"><h2>{title}</h2><span>{rows.length}</span></div><div className="clinic-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.length ? rows : <tr><td colSpan={columns.length}><Empty text="Chưa có dữ liệu phù hợp." /></td></tr>}</tbody></table></div></article>; }
function Status({ value }: { value?: string }) { return <span className={'clinic-status is-' + String(value ?? '').toLowerCase()}>{status(value)}</span>; }
function Empty({ text }: { text: string }) { return <p className="clinic-empty">{text}</p>; }
