import { Children, cloneElement, isValidElement, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactElement, ReactNode } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate, usePathname } from '../../../app/navigation';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { PatientSidebar } from '../../../shared/components/navigation/PatientSidebar';
import { ApiError } from '../../../services/api';
import {
  activateDoctor,
  deactivateDoctor,
  getDoctor,
  listDoctors,
  listSpecialties,
  type DoctorItem,
  type SpecialtyItem,
} from '../../../services/adminDoctors';
import {
  activateService,
  deactivateService,
  listAdminServices,
  createService,
  updateService,
  scheduleBasePrice,
  type MedicalServiceItem,
} from '../../../services/adminCatalog';
import {
  listClinicRooms,
  updateManagedReceptionist,
  deactivateManagedReceptionist,
  managerAppointmentAction,
  listManagerBookableSlots,
  rescheduleManagerAppointment,
  type ManagerBookableSlot,
  listManagerInvoices,
  getManagerInvoice,
  recordManagerPayment,
  decideManagerTransfer,
  type ManagerInvoice,
  listManagerEncounters,
  getManagerEncounter,
  searchManagerPatients,
  getManagerPatient,
  updateManagerPatient,
  createManagerPatient,
  type ManagerPatient,
  type ClinicRoom,
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
import { DoctorScheduling } from './DoctorScheduling';
import { DoctorLeaveApprovals } from './DoctorLeaveApprovals';
import { DoctorProfileManager } from './DoctorProfileManager';
import { CatalogMetadataManager } from './CatalogMetadataManager';
import { CreateAppointmentPanel } from './CreateAppointmentPanel';
import type { Requester } from '../../../services/catalog';
import { getOverviewPdf } from '../../../services/operations';
import { downloadCsv } from '../../../services/reporting';
import {
  getAppointmentReport,
  getReportOverview,
  getRevenueReport,
} from '../../../services/operations';
import '../../../styles/clinic-manager.css';

type LoadState = 'loading' | 'ready' | 'error';
const titles: Record<string, [string, string]> = {
  overview: [
    'Tổng quan vận hành',
    'Theo dõi các chỉ số và việc cần xử lý tại phòng khám.',
  ],
  staff: [
    'Nhân sự vận hành',
    'Tạo và quản lý trạng thái tài khoản bác sĩ, điều dưỡng và lễ tân.',
  ],
  doctors: [
    'Bác sĩ & lịch làm việc',
    'Theo dõi hồ sơ, trạng thái và mức độ sẵn sàng của đội ngũ bác sĩ.',
  ],
  receptionists: [
    'Lễ tân',
    'Theo dõi hồ sơ lễ tân phục vụ cho hoạt động tiếp nhận.',
  ],
  services: [
    'Dịch vụ & giá',
    'Quản lý trạng thái cung cấp dịch vụ và khả năng đặt lịch.',
  ],
  appointments: [
    'Điều phối lịch hẹn',
    'Theo dõi các lịch hẹn cần điều phối; không thao tác thay bệnh án.',
  ],
  reports: [
    'Báo cáo vận hành',
    'Theo dõi lịch hẹn và doanh thu trong khoảng thời gian gần đây.',
  ],
  billing: ['Hóa đơn', 'Theo dõi các hóa đơn và trạng thái thanh toán.'],
  encounters: ['Hồ sơ khám', 'Tra cứu hồ sơ khám theo quyền chỉ đọc.'],
  patients: ['Bệnh nhân', 'Tra cứu và cập nhật thông tin hành chính bệnh nhân.'],
};

function errorText(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 403)
    return 'Tài khoản không có quyền thực hiện thao tác này.';
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu.';
}
function status(value?: string) {
  const labels: Record<string, string> = {
    CHECKED_IN: 'Đã tiếp nhận', IN_CLINICAL_CARE: 'Đang khám',
    NO_SHOW: 'Vắng mặt', RESCHEDULED: 'Đã đổi lịch',
    ACTIVE: 'Đang hoạt động', DISABLED: 'Tạm ngưng', INACTIVE: 'Tạm ngưng',
    DRAFT: 'Bản nháp', BOOKED: 'Đã đặt', REASSIGNMENT_REQUIRED: 'Cần điều phối',
    CANCELLED: 'Đã hủy', COMPLETED: 'Hoàn thành', PAID: 'Đã thanh toán',
    PENDING: 'Đang chờ', PARTIAL: 'Thanh toán một phần', ISSUED: 'Đã phát hành',
    RECORDED: 'Đã ghi nhận', CONFIRMED: 'Đã xác nhận', FAILED: 'Thất bại',
    IN_PROGRESS: 'Đang thực hiện', OPEN: 'Đang mở', CLOSED: 'Đã đóng',
  };
  return labels[value ?? ''] ?? value ?? 'Chờ cập nhật';
}
function roleLabel(value?: string) {
  return ({ DOCTOR: 'Bác sĩ', NURSE: 'Điều dưỡng', RECEPTIONIST: 'Lễ tân' } as Record<string, string>)[value ?? ''] ?? value ?? 'Chưa rõ';
}
function serviceKindLabel(value?: string) {
  return ({ CONSULTATION: 'Khám tư vấn', DIAGNOSTIC: 'Chẩn đoán', PROCEDURE: 'Thủ thuật', PACKAGE: 'Gói dịch vụ', VACCINATION: 'Tiêm chủng', OTHER: 'Khác' } as Record<string, string>)[value ?? ''] ?? value ?? 'Khác';
}
function rankLabel(value?: string) {
  return ({ BASIC: 'Bác sĩ', MASTER: 'Thạc sĩ', SPECIALIST_I: 'Chuyên khoa I', SPECIALIST_II: 'Chuyên khoa II', EXPERT: 'Chuyên gia', ASSOC_PROFESSOR: 'Phó giáo sư', PROFESSOR: 'Giáo sư' } as Record<string, string>)[value ?? ''] ?? value ?? 'Bác sĩ';
}
function date(value?: string) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—';
}
function unwrapNumber(source: unknown, keys: string[]) {
  if (!source || typeof source !== 'object') return 0;
  const object = source as Record<string, unknown>;
  for (const key of keys) {
    const value = object[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && Number.isFinite(Number(value)))
      return Number(value);
  }
  return 0;
}

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
  const [reportOverview, setReportOverview] = useState<Record<string, unknown>>(
    {},
  );
  const [appointmentReport, setAppointmentReport] = useState<
    Record<string, unknown>
  >({});
  const [revenueReport, setRevenueReport] = useState<Record<string, unknown>>(
    {},
  );
  const [message, setMessage] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorItem | null>(null);
  const [selectedSchedules, setSelectedSchedules] = useState<
    ManagedDoctorSchedule[]
  >([]);
  const [rooms, setRooms] = useState<ClinicRoom[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);
  const [invoices, setInvoices] = useState<ManagerInvoice[]>([]);
  const [encounters, setEncounters] = useState<Record<string, unknown>[]>([]);
  const [reportFrom, setReportFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async (silent = false) => {
    if (!silent) setState('loading');
    setError('');
    try {
      if (section === 'overview') {
        const [report, people, doctorRows, receptionistRows, appointmentRows] =
          await Promise.all([
            getReportOverview(auth.request),
            listManagedStaff(auth.request),
            listDoctors(auth.request, { limit: 100 }),
            listManagedReceptionists(auth.request),
            listManagerAppointments(auth.request),
          ]);
        setReportOverview((report ?? {}) as Record<string, unknown>);
        setStaff(people);
        setDoctors(doctorRows.data);
        setReceptionists(receptionistRows);
        setAppointments(appointmentRows);
      } else if (section === 'staff')
        setStaff(await listManagedStaff(auth.request));
      else if (section === 'doctors') {
        const [doctorRows, roomRows, people, specialtyRows, catalogRows] = await Promise.all([listDoctors(auth.request, { limit: 100 }), listClinicRooms(auth.request), listManagedStaff(auth.request), listSpecialties(auth.request), listAdminServices(auth.request, { limit: 100 })]);
        setDoctors(doctorRows.data);
        setRooms(roomRows);
        setStaff(people);
        setSpecialties(specialtyRows);
        setServices(catalogRows.items);
      }
      else if (section === 'receptionists')
        setReceptionists(await listManagedReceptionists(auth.request));
      else if (section === 'services')
        setServices(
          (await listAdminServices(auth.request, { limit: 100 })).items,
        );
      else if (section === 'appointments') {
        const [appointmentRows, doctorRows, catalogRows] = await Promise.all([listManagerAppointments(auth.request), listDoctors(auth.request, { limit: 100 }), listAdminServices(auth.request, { limit: 100 })]);
        setAppointments(appointmentRows);
        setDoctors(doctorRows.data);
        setServices(catalogRows.items);
      }
      else if (section === 'reports') {
        const query = new URLSearchParams({ fromDate: reportFrom, toDate: reportTo }).toString();
        const [overview, appointmentData, revenueData] = await Promise.all([
          getReportOverview(auth.request, query),
          getAppointmentReport(auth.request, query),
          getRevenueReport(auth.request, query),
        ]);
        setReportOverview((overview ?? {}) as Record<string, unknown>);
        setAppointmentReport(
          (appointmentData ?? {}) as Record<string, unknown>,
        );
        setRevenueReport((revenueData ?? {}) as Record<string, unknown>);
      }
      else if (section === 'billing') setInvoices(await listManagerInvoices(auth.request));
      else if (section === 'encounters') setEncounters(await listManagerEncounters(auth.request));
      setState('ready');
    } catch (reason) {
      setError(errorText(reason));
      setState('error');
    }
  };
  useEffect(() => {
    void load();
  }, [section, auth.request]);

  const counts = useMemo(
    () => ({
      activeDoctors: doctors.filter((item) => item.status === 'ACTIVE').length,
      inactiveReceptionists: receptionists.filter(
        (item) => item.status !== 'ACTIVE',
      ).length,
      pendingAppointments: appointments.filter((item) =>
        ['REASSIGNMENT_REQUIRED', 'BOOKED'].includes(String(item.status)),
      ).length,
    }),
    [doctors, receptionists, appointments],
  );

  async function logout() {
    await auth.signOut();
    navigate('/dang-nhap', { replace: true });
  }
  async function chooseDoctor(id: string) {
    try {
      const [doctor, schedules] = await Promise.all([
        getDoctor(auth.request, id),
        listManagedDoctorSchedules(auth.request, id),
      ]);
      setSelectedDoctor(doctor);
      setSelectedSchedules(schedules);
    } catch (reason) {
      setMessage(errorText(reason));
    }
  }
  useEffect(() => {
    if (section === 'doctors' && state === 'ready' && doctors.length && !selectedDoctor)
      void chooseDoctor((doctors.find(item => item.status === 'ACTIVE') ?? doctors[0]).id);
  }, [section, state, doctors, selectedDoctor]);
  async function refreshDoctor() {
    await load(true);
    if (selectedDoctor) await chooseDoctor(selectedDoctor.id);
  }
  async function changeDoctorStatus(active: boolean) {
    if (!selectedDoctor) return;
    try {
      const next = active
        ? await activateDoctor(
            auth.request,
            selectedDoctor.id,
            selectedDoctor.version,
          )
        : await deactivateDoctor(
            auth.request,
            selectedDoctor.id,
            selectedDoctor.version,
            'Điều phối vận hành phòng khám',
          );
      setSelectedDoctor(next);
      await load(true);
      setMessage('Đã cập nhật trạng thái bác sĩ.');
    } catch (reason) {
      setMessage(errorText(reason));
    }
  }
  async function changeServiceStatus(item: MedicalServiceItem) {
    try {
      item.status === 'ACTIVE'
        ? await deactivateService(auth.request, item.id)
        : await activateService(auth.request, item.id);
      await load(true);
    } catch (reason) {
      setMessage(errorText(reason));
    }
  }

  const [title, description] = titles[section] ?? titles.overview;
  return (
    <div className="patient-home-shell patient-desktop-portal clinic-manager-shell">
      <PatientSidebar onLogout={() => void logout()} />
      <main className="patient-main-view" id="main-content">
        <header className="clinic-topbar">
          <div>
            <span>Điều hành phòng khám / {title}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="clinic-topbar-actions">
            {section !== 'patients' && <button type="button" className="clinic-refresh" onClick={() => void load(true)} aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu"><RefreshCw size={16} /> <span>Làm mới</span></button>}
            <div className="clinic-account">
              <b>{(auth.user?.email ?? 'CM').slice(0, 2).toUpperCase()}</b>
              <span>{auth.user?.email}<small>Quản lý phòng khám</small></span>
            </div>
          </div>
        </header>
        <section className="clinic-content">
          {message && (
            <div className="clinic-feedback" role="status">
              <span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Đóng thông báo">Đóng</button>
            </div>
          )}
          {state === 'loading' && (
            <div className="clinic-loading">
              <i />
              <i />
              <i />
            </div>
          )}
          {state === 'error' && (
            <section className="clinic-error" role="alert">
              <strong>Không thể tải dữ liệu</strong>
              <p>{error}</p>
              <button onClick={() => void load()}>Thử lại</button>
            </section>
          )}
          {state === 'ready' &&
            (section === 'overview' ? (
              <Overview
                report={reportOverview}
                staff={staff.length}
                doctors={counts.activeDoctors}
                receptionists={counts.inactiveReceptionists}
                appointments={counts.pendingAppointments}
              />
            ) : null)}
          {state === 'ready' && section === 'staff' && (
            <StaffPanel items={staff} request={auth.request} onDone={() => load(true)} />
          )}
          {state === 'ready' && section === 'doctors' && (
            <div className="clinic-doctor-workspace"><DoctorLeaveApprovals request={auth.request} onChanged={refreshDoctor} /><DoctorsPanel
              items={doctors}
              selected={selectedDoctor}
              schedules={selectedSchedules}
              rooms={rooms}
              staff={staff}
              specialties={specialties}
              services={services}
              request={auth.request}
              onRefresh={refreshDoctor}
              onSelect={chooseDoctor}
              onClear={() => setSelectedDoctor(null)}
              onStatus={changeDoctorStatus}
    /></div>
          )}
          {state === 'ready' && section === 'receptionists' && (
            <ReceptionistsPanel items={receptionists} request={auth.request} onDone={() => load(true)} />
          )}
          {state === 'ready' && section === 'services' && (
            <ServicesPanel items={services} onChange={changeServiceStatus} request={auth.request} onDone={() => load(true)} />
          )}
          {state === 'ready' && section === 'appointments' && (
            <AppointmentsPanel items={appointments} doctors={doctors} services={services} request={auth.request} onDone={() => load(true)} />
          )}
          {state === 'ready' && section === 'reports' && (
            <ReportsPanel
              overview={reportOverview}
              appointments={appointmentReport}
              revenue={revenueReport}
              from={reportFrom} to={reportTo} onFrom={setReportFrom} onTo={setReportTo}
              request={auth.request} onReload={() => load(true)}
            />
          )}
          {state === 'ready' && section === 'billing' && <BillingPanel items={invoices} request={auth.request} onDone={() => load(true)} />}
          {state === 'ready' && section === 'patients' && <PatientsPanel request={auth.request} />}
          {state === 'ready' && section === 'encounters' && <EncountersPanel items={encounters} request={auth.request} />}
        </section>
      </main>
    </div>
  );
}

function Overview({
  report,
  staff,
  doctors,
  receptionists,
  appointments,
}: {
  report: Record<string, unknown>;
  staff: number;
  doctors: number;
  receptionists: number;
  appointments: number;
}) {
  const revenue = unwrapNumber(report, [
    'totalCollectedAmount',
    'revenue',
    'totalRevenue',
  ]);
  return (
    <>
      <section className="clinic-kpis">
        <Kpi label="Bác sĩ hoạt động" value={doctors} note="Xem đội ngũ & ca làm" href="doctors" />
        <Kpi
          label="Tài khoản vận hành"
          value={staff}
          note="Quản lý nhân sự"
          href="staff"
        />
        <Kpi
          label="Lễ tân cần rà soát"
          value={receptionists}
          note="Hồ sơ tạm ngưng"
          href="receptionists"
        />
        <Kpi
          label="Lịch cần theo dõi"
          value={appointments}
          note="Mở lịch hẹn"
          href="appointments"
        />
      </section>
      <section className="clinic-overview-grid">
        <article className="clinic-card clinic-revenue-card">
          <div><span className="clinic-kicker">Doanh thu đã thu</span>
            <h2>{revenue.toLocaleString('vi-VN')} <small>đ</small></h2>
            <p>Theo kỳ báo cáo mặc định của hệ thống.</p></div>
          <button type="button" className="clinic-text-action" onClick={() => navigate('/workspace/clinic_manager/reports')}>Xem báo cáo <ArrowRight size={16} /></button>
        </article>
        <article className="clinic-card clinic-priority-card">
          <div className="clinic-card-head"><div><span className="clinic-kicker">Lối tắt</span><h2>Việc cần xử lý</h2></div></div>
          <div className="clinic-priority-list">
            <button type="button" onClick={() => navigate('/workspace/clinic_manager/doctors')}><span>Ca làm & yêu cầu nghỉ<small>Duyệt nghỉ ca, kiểm tra giờ bệnh nhân có thể đặt</small></span><ArrowRight size={17} /></button>
            <button type="button" onClick={() => navigate('/workspace/clinic_manager/appointments')}><span>Điều phối lịch hẹn<small>{appointments} lịch đã đặt hoặc cần theo dõi</small></span><ArrowRight size={17} /></button>
            <button type="button" onClick={() => navigate('/workspace/clinic_manager/services')}><span>Dịch vụ & giá<small>Kiểm tra dịch vụ trước khi mở đặt lịch</small></span><ArrowRight size={17} /></button>
          </div>
        </article>
      </section>
    </>
  );
}
function Kpi({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: number;
  note: string;
  href?: string;
}) {
  const content = <><span>{label}</span><strong>{value.toLocaleString('vi-VN')}</strong><small>{note} {href && <ArrowRight size={14} aria-hidden="true" />}</small></>;
  return href
    ? <button type="button" className="clinic-kpi" onClick={() => navigate(`/workspace/clinic_manager/${href}`)}>{content}</button>
    : <article className="clinic-kpi">{content}</article>;
}

function StaffPanel({
  items,
  request,
  onDone,
}: {
  items: ManagedStaff[];
  request: any;
  onDone: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'DOCTOR' | 'NURSE' | 'RECEPTIONIST'>(
    'RECEPTIONIST',
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await createManagedStaff(request, { email, password, role });
      setEmail('');
      setPassword('');
      setNotice('Đã tạo tài khoản nhân sự.');
      await onDone();
    } catch (reason) {
      setNotice(errorText(reason));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(item: ManagedStaff) {
    setBusy(true);
    setNotice('');
    try {
      await setManagedStaffStatus(
        request,
        item.userId,
        item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      );
      await onDone();
      setNotice(item.status === 'ACTIVE' ? 'Đã tạm ngưng tài khoản.' : 'Đã kích hoạt tài khoản.');
    } catch (reason) {
      setNotice(errorText(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="clinic-split">
      <article className="clinic-card">
        <span className="clinic-kicker">Tạo nhân sự</span>
        <h2>Tài khoản vận hành mới</h2>
        <form className="clinic-form" onSubmit={submit}>
          <label>Email đăng nhập<input
            value={email}
            type="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten@benhvien.vn"
            required
          /></label>
          <label>Mật khẩu ban đầu<input
            value={password}
            type="password"
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu tối thiểu 8 ký tự"
            required
          /></label>
          <label>Vai trò<select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="RECEPTIONIST">Lễ tân</option>
            <option value="NURSE">Điều dưỡng</option>
            <option value="DOCTOR">Bác sĩ</option>
          </select></label>
          <button disabled={busy}>
            {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </form>
        {notice && <p className="clinic-note">{notice}</p>}
        <p className="clinic-muted">
          Quản lý phòng khám không thể tạo Admin hoặc Clinic Manager.
        </p>
      </article>
      <ListCard
        title="Tài khoản vận hành"
        columns={['Email', 'Vai trò', 'Trạng thái', '']}
        searchItems={items.map(item => `${item.email} ${roleLabel(item.role)} ${status(item.status)}`)}
        rows={items.map((item) => (
          <tr key={item.userId}>
            <td>{item.email}</td>
            <td>{roleLabel(item.role)}</td>
            <td>
              <Status value={item.status} />
            </td>
            <td>
              <button type="button" className="clinic-link" disabled={busy} onClick={() => void toggle(item)}>
                {item.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}
              </button>
            </td>
          </tr>
        ))}
      />
    </div>
  );
}

function DoctorsPanel({
  items,
  selected,
  schedules,
  rooms,
  staff,
  specialties,
  services,
  request,
  onRefresh,
  onSelect,
  onClear,
  onStatus,
}: {
  items: DoctorItem[];
  selected: DoctorItem | null;
  schedules: ManagedDoctorSchedule[];
  rooms: ClinicRoom[];
  staff: ManagedStaff[];
  specialties: SpecialtyItem[];
  services: MedicalServiceItem[];
  request: Requester;
  onRefresh: () => Promise<void>;
  onSelect: (id: string) => void;
  onClear: () => void;
  onStatus: (active: boolean) => void;
}) {
  const [view, setView] = useState<'schedule' | 'profile'>('schedule');
  return (
    <div className="clinic-split">
      <ListCard
        title="Đội ngũ bác sĩ"
        columns={['Bác sĩ', 'Chuyên khoa', 'Trạng thái', '']}
        searchItems={items.map(item => `${item.profile?.fullName ?? ''} ${item.specialties?.map(x => x.name).join(' ') ?? ''} ${status(item.status)}`)}
        searchPlaceholder="Tìm tên, chuyên khoa, trạng thái..."
        headerAction={<button type="button" className="clinic-small-action" onClick={() => { onClear(); setView('profile'); }}>+ Thêm bác sĩ</button>}
        rows={items.map((item) => (
          <tr key={item.id} className={selected?.id === item.id ? 'is-selected' : ''}>
            <td>
              <strong>{item.profile?.fullName || 'Chưa có tên'}</strong>
              <small>{rankLabel(item.consultationRank)}</small>
            </td>
            <td>
              {item.specialties?.map((x) => x.name).join(', ') || 'Chưa gán'}
            </td>
            <td>
              <Status value={item.status} />
            </td>
            <td>
              <button type="button" className="clinic-link" onClick={() => { setView('schedule'); onSelect(item.id); }}>
                Xem ca làm
              </button>
            </td>
          </tr>
        ))}
      />
      <aside className="clinic-card clinic-detail">
        <span className="clinic-kicker">Điều phối bác sĩ</span>
        {selected ? (
          <>
            <h2>{selected.profile?.fullName}</h2>
            <Status value={selected.status} />
            <p>
              {selected.specialties?.map((x) => x.name).join(', ') ||
                'Chưa gán chuyên khoa'}{' '}
              · phiên bản {selected.version}
            </p>
            <div className="clinic-actions">
              <button
                onClick={() => onStatus(true)}
                disabled={selected.status === 'ACTIVE'}
              >
                Kích hoạt
              </button>
              <button
                className="is-danger"
                onClick={() => onStatus(false)}
                disabled={selected.status !== 'ACTIVE'}
              >
                Tạm ngưng
              </button>
            </div>
            <div className="clinic-detail-tabs" role="tablist" aria-label="Thông tin bác sĩ">
              <button type="button" role="tab" aria-selected={view === 'schedule'} onClick={() => setView('schedule')}>Ca làm & giờ đặt</button>
              <button type="button" role="tab" aria-selected={view === 'profile'} onClick={() => setView('profile')}>Hồ sơ & chuyên khoa</button>
            </div>
            {view === 'schedule' ? <DoctorScheduling key={selected.id} request={request} doctorId={selected.id} schedules={schedules} rooms={rooms} overrides={selected.availabilities ?? []} services={services} refresh={onRefresh} /> :
              <DoctorProfileManager request={request} selected={selected} doctors={items} staff={staff} specialties={specialties} refresh={onRefresh} />}
          </>
        ) : (
          <DoctorProfileManager request={request} selected={null} doctors={items} staff={staff} specialties={specialties} refresh={onRefresh} />
        )}
      </aside>
    </div>
  );
}
function ReceptionistsPanel({ items, request, onDone }: { items: ReceptionistSummary[]; request: Requester; onDone: () => Promise<void> }) {
  const [selected, setSelected] = useState<ReceptionistSummary | null>(null);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [workPhone, setWorkPhone] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  function choose(item: ReceptionistSummary) {
    setSelected(item);
    setFullName(item.profile?.fullName ?? '');
    setDepartment(item.profile?.department ?? '');
    setWorkPhone(item.profile?.workPhone ?? '');
    setReason('');
  }
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setNotice('');
    try { await action(); await onDone(); setSelected(null); setNotice('Đã cập nhật hồ sơ lễ tân.'); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  return (
    <div className="clinic-split"><ListCard
      title="Hồ sơ lễ tân"
      columns={['Họ tên', 'Email', 'Bộ phận', 'Trạng thái', '']}
      searchItems={items.map(item => `${item.profile?.fullName ?? ''} ${item.profile?.loginEmail ?? ''} ${item.profile?.department ?? ''} ${status(item.status)}`)}
      rows={items.map((item) => (
        <tr key={item.id} className={selected?.id === item.id ? 'is-selected' : ''}>
          <td>{item.profile?.fullName || 'Chưa cập nhật'}</td>
          <td>{item.profile?.loginEmail || '—'}</td>
          <td>{item.profile?.department || 'Tiếp nhận'}</td>
          <td>
            <Status value={item.status} />
          </td>
          <td><button className="clinic-link" onClick={() => choose(item)}>Sửa</button></td>
        </tr>
      ))}
    />
    <aside className="clinic-card clinic-detail"><h2>{selected ? `Sửa ${selected.profile?.fullName ?? 'lễ tân'}` : 'Hồ sơ lễ tân'}</h2>
      {selected ? <form className="clinic-form" onSubmit={e => { e.preventDefault(); void perform(() => updateManagedReceptionist(request, selected, { fullName, department, workPhone, reason })); }}>
        <label>Họ tên<input required value={fullName} onChange={e => setFullName(e.target.value)} /></label>
        <label>Bộ phận<input value={department} onChange={e => setDepartment(e.target.value)} /></label>
        <label>Điện thoại công việc<input value={workPhone} onChange={e => setWorkPhone(e.target.value)} /></label>
        <label>Lý do thay đổi<input required minLength={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button disabled={busy}>Lưu hồ sơ</button>
        {selected.status === 'ACTIVE' && <button type="button" className="is-danger" disabled={busy || reason.trim().length < 3} onClick={() => void perform(() => deactivateManagedReceptionist(request, selected, reason.trim()))}>Ngừng hồ sơ</button>}
      </form> : <Empty text="Chọn một lễ tân để cập nhật hồ sơ." />}
      {notice && <p className="clinic-note" role="status">{notice}</p>}
    </aside></div>
  );
}
function ServicesPanel({
  items,
  onChange,
  request,
  onDone,
}: {
  items: MedicalServiceItem[];
  onChange: (item: MedicalServiceItem) => void;
  request: Requester;
  onDone: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<MedicalServiceItem | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [kind, setKind] = useState<MedicalServiceItem['kind']>('CONSULTATION');
  const [duration, setDuration] = useState(30);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [price, setPrice] = useState('');
  const [priceFrom, setPriceFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  function choose(item: MedicalServiceItem | null) {
    setSelected(item); setCode(item?.code ?? ''); setName(item?.name ?? '');
    setSummary(item?.summary ?? ''); setKind(item?.kind ?? 'CONSULTATION');
    setDuration(item?.durationMinutes ?? 30); setBookingEnabled(item?.bookingEnabled ?? true);
    setPrice('');
  }
  async function run(action: () => Promise<unknown>, text: string) {
    setBusy(true); setNotice('');
    try { await action(); await onDone(); setNotice(text); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  return (
    <><div className="clinic-split"><ListCard
      title="Dịch vụ & khả năng đặt lịch"
      columns={['Dịch vụ', 'Loại', 'Đặt lịch', 'Trạng thái', '']}
      searchItems={items.map(item => `${item.name} ${item.code} ${serviceKindLabel(item.kind)} ${status(item.status)}`)}
      rows={items.map((item) => (
        <tr key={item.id} className={selected?.id === item.id ? 'is-selected' : ''}>
          <td>
            <strong>{item.name}</strong>
            <small>
              {item.durationMinutes
                ? `${item.durationMinutes} phút`
                : 'Chưa có thời lượng'}
            </small>
          </td>
          <td>{serviceKindLabel(item.kind)}</td>
          <td>{item.bookingEnabled ? 'Có' : 'Không'}</td>
          <td>
            <Status value={item.status} />
          </td>
          <td>
            <button className="clinic-link" onClick={() => void onChange(item)}>
              {item.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}
            </button>
            <button className="clinic-link" onClick={() => choose(item)}>Sửa / giá</button>
          </td>
        </tr>
      ))}
    /><aside className="clinic-card clinic-detail">
      <div className="clinic-card-head"><h2>{selected ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</h2><button type="button" className="clinic-link" onClick={() => choose(null)}>Tạo mới</button></div>
      <form className="clinic-form" onSubmit={e => { e.preventDefault(); void run(async () => { if (selected) await updateService(request, selected.id, { code, name, summary, kind, durationMinutes: duration, bookingEnabled }); else await createService(request, { code, name, summary, kind, durationMinutes: duration, bookingEnabled }); }, selected ? 'Đã sửa dịch vụ.' : 'Đã tạo dịch vụ.'); }}>
        <label>Mã dịch vụ<input required minLength={2} value={code} onChange={e => setCode(e.target.value)} /></label>
        <label>Tên dịch vụ<input required minLength={2} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Mô tả ngắn<input value={summary} onChange={e => setSummary(e.target.value)} /></label>
        <div className="clinic-form-pair"><label>Loại<select value={kind} onChange={e => setKind(e.target.value as typeof kind)}>{['CONSULTATION','DIAGNOSTIC','PROCEDURE','PACKAGE','VACCINATION','OTHER'].map(v => <option key={v} value={v}>{v}</option>)}</select></label><label>Thời lượng (phút)<input type="number" min={5} max={600} value={duration} onChange={e => setDuration(Number(e.target.value))} /></label></div>
        <label className="clinic-check"><input type="checkbox" checked={bookingEnabled} onChange={e => setBookingEnabled(e.target.checked)} /> Cho phép đặt lịch</label>
        <button disabled={busy}>{selected ? 'Lưu dịch vụ' : 'Tạo dịch vụ'}</button>
      </form>
      {selected && <form className="clinic-form clinic-compact-form" onSubmit={e => { e.preventDefault(); void run(() => scheduleBasePrice(request, selected.id, { amountMinor: Math.round(Number(price)), currency: 'VND', effectiveFrom: new Date(`${priceFrom}T00:00:00+07:00`).toISOString() }), 'Đã lưu giá dịch vụ.'); }}>
        <strong>Giá cơ bản</strong>
        <small>Giá hiện tại: {selected.prices?.filter(p => p.status === 'ACTIVE').map(p => Number(p.amountMinor).toLocaleString('vi-VN') + ' VND').join(', ') || 'Chưa có'}</small>
        <label>Giá mới (VND)<input type="number" min={0} required value={price} onChange={e => setPrice(e.target.value)} /></label>
        <label>Hiệu lực từ<input type="date" required value={priceFrom} onChange={e => setPriceFrom(e.target.value)} /></label>
        <button disabled={busy}>Lên lịch giá</button>
      </form>}
      {notice && <p className="clinic-note" role="status">{notice}</p>}
    </aside></div><details className="clinic-disclosure"><summary>Danh mục nâng cao: nhóm dịch vụ, thẻ và phụ thu <ArrowRight size={16} /></summary><CatalogMetadataManager request={request} /></details></>
  );
}
function AppointmentsPanel({ items, doctors, services, request, onDone }: { items: ManagerAppointment[]; doctors: DoctorItem[]; services: MedicalServiceItem[]; request: Requester; onDone: () => Promise<void> }) {
  const [filter, setFilter] = useState<'attention' | 'all'>('attention');
  const [selected, setSelected] = useState<ManagerAppointment | null>(null);
  const [reason, setReason] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [evidence, setEvidence] = useState('');
  const [newDate, setNewDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<ManagerBookableSlot[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function action(kind: 'cancel' | 'reassignment-required' | 'reassign') {
    if (!selected || reason.trim().length < 3) { setNotice('Nhập lý do ít nhất 3 ký tự.'); return; }
    if (kind === 'reassign' && (!doctorId || !evidence.trim())) { setNotice('Chọn bác sĩ và nhập bằng chứng xác nhận.'); return; }
    setBusy(true); setNotice('');
    try {
      await managerAppointmentAction(request, selected, kind, reason.trim(), kind === 'reassign' ? { doctorId, confirmationEvidence: evidence.trim() } : undefined);
      await onDone(); setSelected(null); setNotice('Đã cập nhật lịch hẹn.');
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  async function findSlots() {
    if (!selected?.serviceId || !doctorId) { setNotice('Chọn bác sĩ và lịch hẹn có dịch vụ.'); return; }
    setBusy(true); setNotice('');
    try { setSlots(await listManagerBookableSlots(request, selected.serviceId, doctorId, newDate)); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  async function reschedule(slot: ManagerBookableSlot) {
    if (!selected || reason.trim().length < 3) { setNotice('Nhập lý do đổi lịch ít nhất 3 ký tự.'); return; }
    setBusy(true); setNotice('');
    try { await rescheduleManagerAppointment(request, selected, slot, reason.trim()); await onDone(); setSelected(null); setSlots([]); setNotice('Đã đổi lịch hẹn.'); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  const actionable = selected && ['BOOKED', 'REASSIGNMENT_REQUIRED'].includes(selected.status ?? '');
  const attentionItems = items.filter(item => ['BOOKED', 'REASSIGNMENT_REQUIRED'].includes(item.status ?? ''));
  const visibleItems = filter === 'attention' ? attentionItems : items;
  return (
    <><details className="clinic-disclosure clinic-create-disclosure"><summary>+ Đặt lịch cho bệnh nhân <span>Mở biểu mẫu đặt lịch theo giờ bác sĩ có thể khám</span><ArrowRight size={16} /></summary><CreateAppointmentPanel request={request} doctors={doctors} services={services} refresh={onDone} /></details><div className="clinic-split">
      <ListCard
        title="Lịch hẹn"
        columns={['Mã lịch hẹn', 'Thời gian', 'Trạng thái', 'Bác sĩ', '']}
        searchItems={visibleItems.map(item => `${item.appointmentCode ?? item.id} ${date(item.startAt)} ${status(item.status)} ${doctors.find(d => d.id === item.assignedDoctorId)?.profile?.fullName ?? ''}`)}
        headerAction={<div className="clinic-filter-toggle" role="group" aria-label="Lọc lịch hẹn"><button type="button" aria-pressed={filter === 'attention'} onClick={() => setFilter('attention')}>Cần xử lý ({attentionItems.length})</button><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tất cả</button></div>}
        rows={visibleItems.map((item) => (
          <tr key={item.id} className={selected?.id === item.id ? 'is-selected' : ''}>
            <td>{item.appointmentCode || item.id.slice(0, 8).toUpperCase()}</td>
            <td>{date(item.startAt)}</td>
            <td>
              <Status value={item.status} />
            </td>
            <td>{item.assignedDoctorId ? doctors.find(d => d.id === item.assignedDoctorId)?.profile?.fullName ?? 'Đã phân công' : 'Chưa phân công'}</td>
            <td><button className="clinic-link" onClick={() => { setSelected(item); setReason(''); setDoctorId(item.assignedDoctorId ?? ''); setSlots([]); }}>{['BOOKED', 'REASSIGNMENT_REQUIRED'].includes(item.status ?? '') ? 'Điều phối' : 'Xem'}</button></td>
          </tr>
        ))}
      />
      <aside className="clinic-card clinic-detail"><h2>Điều phối lịch hẹn</h2>
        {selected ? <div className="clinic-form">
          <p>{selected.appointmentCode ?? selected.id} · <Status value={selected.status} /> · phiên bản {selected.version}</p>
          {!actionable && <p className="clinic-muted">Lịch hẹn này đã chuyển sang giai đoạn không thể điều phối hoặc hủy.</p>}
          {actionable && <>
          <label>Lý do<input required minLength={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
          <label>Bác sĩ mới<select value={doctorId} onChange={e => setDoctorId(e.target.value)}><option value="">Chọn bác sĩ</option>{doctors.filter(d => d.status === 'ACTIVE').map(d => <option key={d.id} value={d.id}>{d.profile?.fullName}</option>)}</select></label>
          <label>Bằng chứng xác nhận<input value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Ví dụ: bệnh nhân xác nhận qua điện thoại" /></label>
          <div className="clinic-actions"><button disabled={busy} onClick={() => void action('reassign')}>Phân lại bác sĩ</button>{selected.status === 'BOOKED' && <button disabled={busy} onClick={() => void action('reassignment-required')}>Đánh dấu cần điều phối</button>}<button className="is-danger" disabled={busy} onClick={() => { if (window.confirm('Hủy lịch hẹn này?')) void action('cancel'); }}>Hủy lịch</button></div>
          <div className="clinic-form clinic-compact-form"><strong>Đổi ngày/giờ hẹn</strong><label>Ngày mới<input type="date" min={new Date().toISOString().slice(0, 10)} value={newDate} onChange={e => { setNewDate(e.target.value); setSlots([]); }} /></label><button disabled={busy || !selected.serviceId || !doctorId} onClick={() => void findSlots()}>Tìm giờ trống</button>{slots.length ? <div className="clinic-slot-grid">{slots.slice(0, 40).map(slot => <button key={`${slot.doctorId}-${slot.startAt}`} disabled={busy} onClick={() => void reschedule(slot)}>{date(slot.startAt)} · {slot.roomCode ?? 'Phòng sẽ xác định'}</button>)}</div> : <small>Chọn bác sĩ và ngày để tìm giờ trống.</small>}</div>
          </>}
        </div> : <Empty text="Chọn lịch hẹn để điều phối." />}
        {notice && <p className="clinic-note" role="status">{notice}</p>}
      </aside>
    </div></>
  );
}
function EncountersPanel({ items, request }: { items: Record<string, unknown>[]; request: Requester }) {
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState('');
  async function choose(id: string) {
    setNotice('');
    try { setSelected(await getManagerEncounter(request, id)); }
    catch (error) { setNotice(errorText(error)); }
  }
  return <div className="clinic-split"><ListCard title="Hồ sơ khám (chỉ đọc)" columns={['Mã hồ sơ', 'Bệnh nhân', 'Trạng thái', 'Ngày tạo', '']} searchItems={items.map(item => `${item.id ?? ''} ${item.patientId ?? ''} ${status(String(item.status ?? ''))} ${date(String(item.createdAt ?? ''))}`)} rows={items.map((item, i) => <tr key={String(item.id ?? i)} className={selected?.id === item.id ? 'is-selected' : ''}><td>{String(item.id ?? '—').slice(0, 12)}</td><td>{String(item.patientId ?? '—').slice(0, 12)}</td><td><Status value={String(item.status ?? '')} /></td><td>{date(String(item.createdAt ?? ''))}</td><td><button className="clinic-link" onClick={() => void choose(String(item.id))}>Xem</button></td></tr>)} />
    <aside className="clinic-card clinic-detail"><h2>Chi tiết hồ sơ khám</h2>{selected ? <dl className="clinic-readonly-details"><dt>Mã hồ sơ</dt><dd>{String(selected.id ?? '—')}</dd><dt>Bệnh nhân</dt><dd>{String(selected.patientId ?? '—')}</dd><dt>Bác sĩ</dt><dd>{String(selected.doctorId ?? '—')}</dd><dt>Trạng thái</dt><dd>{String(selected.status ?? '—')}</dd><dt>Ngày tạo</dt><dd>{date(String(selected.createdAt ?? ''))}</dd></dl> : <Empty text="Chọn hồ sơ để xem thông tin. Clinic Manager không có quyền ghi bệnh án." />}{notice && <p className="clinic-note" role="status">{notice}</p>}</aside>
  </div>;
}

function BillingPanel({ items, request, onDone }: { items: ManagerInvoice[]; request: Requester; onDone: () => Promise<void> }) {
  const [filter, setFilter] = useState<'unpaid' | 'all'>('unpaid');
  const [selected, setSelected] = useState<ManagerInvoice | null>(null);
  const [method, setMethod] = useState<'CASH' | 'MANUAL_BANK_TRANSFER'>('CASH');
  const [reference, setReference] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function choose(id: string) {
    setBusy(true); setNotice('');
    try { setSelected(await getManagerInvoice(request, id)); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  async function perform(action: () => Promise<unknown>) {
    setBusy(true); setNotice('');
    try { await action(); await onDone(); if (selected) setSelected(await getManagerInvoice(request, selected.id)); setNotice('Đã cập nhật thanh toán.'); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  const unpaidItems = items.filter(item => Number(item.balanceMinor ?? 0) > 0);
  const visibleItems = filter === 'unpaid' ? unpaidItems : items;
  return <div className="clinic-split"><ListCard title="Hóa đơn" columns={['Mã hóa đơn', 'Bệnh nhân', 'Trạng thái', 'Tổng tiền', '']} searchItems={visibleItems.map(item => `${item.invoiceNumber ?? item.id} ${item.patientId ?? ''} ${status(item.status)} ${item.totalMinor ?? ''}`)} headerAction={<div className="clinic-filter-toggle" role="group" aria-label="Lọc hóa đơn"><button type="button" aria-pressed={filter === 'unpaid'} onClick={() => setFilter('unpaid')}>Chưa thu ({unpaidItems.length})</button><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tất cả</button></div>} rows={visibleItems.map(item => <tr key={item.id} className={selected?.id === item.id ? 'is-selected' : ''}><td>{item.invoiceNumber ?? item.id.slice(0, 8)}</td><td>{item.patientId?.slice(0, 8) ?? '—'}</td><td><Status value={item.status} /></td><td>{Number(item.totalMinor ?? 0).toLocaleString('vi-VN')} {item.currency ?? 'VND'}</td><td><button className="clinic-link" onClick={() => void choose(item.id)}>Chi tiết</button></td></tr>)} />
    <aside className="clinic-card clinic-detail"><h2>Thanh toán hóa đơn</h2>{selected ? <div className="clinic-form"><p>{selected.invoiceNumber} · <Status value={selected.status} /></p><p>Còn phải thu: <strong>{Number(selected.balanceMinor ?? 0).toLocaleString('vi-VN')} {selected.currency ?? 'VND'}</strong></p>
      {Number(selected.balanceMinor ?? 0) > 0 && !selected.payment && <><label>Phương thức<select value={method} onChange={e => setMethod(e.target.value as typeof method)}><option value="CASH">Tiền mặt</option><option value="MANUAL_BANK_TRANSFER">Chuyển khoản thủ công</option></select></label>{method === 'MANUAL_BANK_TRANSFER' && <label>Mã tham chiếu<input required minLength={3} value={reference} onChange={e => setReference(e.target.value)} /></label>}<button disabled={busy || (method === 'MANUAL_BANK_TRANSFER' && reference.trim().length < 3)} onClick={() => { if (window.confirm('Ghi nhận thanh toán cho hóa đơn này?')) void perform(() => recordManagerPayment(request, selected, method, reference.trim())); }}>Ghi nhận thanh toán</button></>}
      {selected.payment?.method === 'MANUAL_BANK_TRANSFER' && selected.payment.status === 'RECORDED' && <><button disabled={busy} onClick={() => { if (window.confirm('Xác minh giao dịch chuyển khoản này?')) void perform(() => decideManagerTransfer(request, selected, true)); }}>Xác minh chuyển khoản</button><label>Lý do từ chối<input value={rejectReason} onChange={e => setRejectReason(e.target.value)} /></label><button className="is-danger" disabled={busy || rejectReason.trim().length < 3} onClick={() => void perform(() => decideManagerTransfer(request, selected, false, rejectReason.trim()))}>Từ chối chuyển khoản</button></>}
    </div> : <Empty text="Chọn hóa đơn để xem và xử lý thanh toán." />}{notice && <p className="clinic-note" role="status">{notice}</p>}</aside>
  </div>;
}

function PatientsPanel({ request }: { request: Requester }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ManagerPatient[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<ManagerPatient | null>(null);
  const [creating, setCreating] = useState(false);
  const [dateOfBirth, setBirth] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function search() {
    if (query.trim().length < 2) { setNotice('Nhập ít nhất 2 ký tự tên bệnh nhân.'); return; }
    setBusy(true); setNotice('');
    try { setRows(await searchManagerPatients(request, query.trim())); setSearched(true); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  async function choose(id: string) {
    setBusy(true); setNotice('');
    try {
      const patient = await getManagerPatient(request, id);
      setCreating(false);
      setSelected(patient); setFullName(patient.fullName); setPhoneNumber(patient.phoneNumber ?? '');
      setAddress(patient.address ?? ''); setReason('');
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected && !creating) return;
    setBusy(true); setNotice('');
    try {
      const patient = selected
        ? await updateManagerPatient(request, selected, { fullName, phoneNumber, address, reason })
        : await createManagerPatient(request, { fullName, phoneNumber, dateOfBirth, address, reason });
      setSelected(patient); setCreating(false);
      if (query.trim().length >= 2) setRows(await searchManagerPatients(request, query.trim()));
      setNotice(selected ? 'Đã cập nhật thông tin bệnh nhân.' : 'Đã tạo bệnh nhân.');
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="clinic-split"><article className="clinic-card"><div className="clinic-card-head"><h2>Tra cứu bệnh nhân</h2><button className="clinic-link" onClick={() => { setSelected(null); setCreating(true); setFullName(''); setPhoneNumber(''); setAddress(''); setBirth(''); setReason(''); }}>Thêm bệnh nhân</button></div><form className="clinic-form" onSubmit={e => { e.preventDefault(); void search(); }}><label>Tên bệnh nhân<input value={query} minLength={2} required onChange={e => { setQuery(e.target.value); setSearched(false); }} placeholder="Nhập ít nhất 2 ký tự" /></label><button disabled={busy}>{busy ? 'Đang tìm…' : 'Tìm kiếm'}</button></form>
    <div className="clinic-patient-results">{rows.map(p => <button type="button" key={p.id} className="clinic-patient-result" aria-pressed={selected?.id === p.id} onClick={() => void choose(p.id)}><strong>{p.fullName}</strong><small>{p.phoneNumber ?? '—'}</small></button>)}{searched && !rows.length && <p className="clinic-muted">Không tìm thấy bệnh nhân. Thử tên khác hoặc thêm hồ sơ mới.</p>}</div>
    {notice && <p className="clinic-note" role="status">{notice}</p>}</article>
    <aside className="clinic-card clinic-detail"><h2>{selected ? 'Thông tin hành chính' : creating ? 'Thêm bệnh nhân' : 'Chọn bệnh nhân'}</h2>{(selected || creating) && <form className="clinic-form" onSubmit={e => void save(e)}><label>Họ tên<input required minLength={2} value={fullName} onChange={e => setFullName(e.target.value)} /></label>{creating && <label>Ngày sinh<input type="date" required value={dateOfBirth} onChange={e => setBirth(e.target.value)} /></label>}<label>Số điện thoại<input required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} /></label><label>Địa chỉ<input value={address} onChange={e => setAddress(e.target.value)} /></label><label>Lý do {creating ? 'tạo hồ sơ' : 'cập nhật'}<input required value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={busy}>{creating ? 'Tạo bệnh nhân' : 'Lưu thông tin'}</button></form>}</aside>
  </div>;
}

function ReportsPanel({
  overview,
  appointments,
  revenue,
  from, to, onFrom, onTo, request, onReload,
}: {
  overview: Record<string, unknown>;
  appointments: Record<string, unknown>;
  revenue: Record<string, unknown>;
  from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void;
  request: Requester; onReload: () => Promise<void>;
}) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const appointmentRows = Array.isArray(appointments.rows) ? appointments.rows : (appointments.data && typeof appointments.data === 'object' && Array.isArray((appointments.data as Record<string, unknown>).rows) ? (appointments.data as { rows: Record<string, unknown>[] }).rows : []);
  const revenueRows = Array.isArray(revenue.rows) ? revenue.rows : (revenue.data && typeof revenue.data === 'object' && Array.isArray((revenue.data as Record<string, unknown>).rows) ? (revenue.data as { rows: Record<string, unknown>[] }).rows : []);
  const query = new URLSearchParams({ fromDate: from, toDate: to }).toString();
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  async function previewPdf() {
    setBusy(true); setNotice('');
    try {
      const file = await getOverviewPdf(request, query);
      if (!(file instanceof Blob) || !file.type.includes('pdf')) throw new Error('Dịch vụ không trả về PDF hợp lệ.');
      setPdfUrl(URL.createObjectURL(file));
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  async function csv(kind: 'appointments' | 'revenue') {
    setBusy(true); setNotice('');
    try {
      const content = await downloadCsv(request, kind, query);
      const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `bao-cao-${kind}-${from}-${to}.csv`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  return (
    <>
      <article className="clinic-card clinic-report-toolbar"><h2>Kỳ báo cáo</h2><div className="clinic-actions"><label>Từ ngày <input type="date" value={from} max={to} onChange={e => onFrom(e.target.value)} /></label><label>Đến ngày <input type="date" value={to} min={from} onChange={e => onTo(e.target.value)} /></label><button onClick={() => void onReload()}>Áp dụng</button><button disabled={busy} onClick={() => void previewPdf()}>{busy ? 'Đang tải…' : 'Xem trước PDF'}</button></div><div className="clinic-actions"><button disabled={busy} onClick={() => void csv('appointments')}>Xuất CSV lịch hẹn</button><button disabled={busy} onClick={() => void csv('revenue')}>Xuất CSV doanh thu</button></div>{notice && <p className="clinic-note" role="status">{notice}</p>}</article>
      <section className="clinic-kpis">
        <Kpi
          label="Doanh thu đã thu"
          value={unwrapNumber(overview, ['totalCollectedAmount'])}
          note="Đơn vị VND"
        />
        <Kpi
          label="Lịch hẹn"
          value={unwrapNumber(overview, ['totalAppointments'])}
          note="Tổng trong kỳ"
        />
        <Kpi
          label="Đã hoàn thành"
          value={unwrapNumber(overview, ['completedAppointments'])}
          note="Lịch hẹn"
        />
        <Kpi
          label="Đã hủy"
          value={unwrapNumber(overview, ['cancelledAppointments'])}
          note="Lịch hẹn"
        />
      </section>
      <section className="clinic-split clinic-report-charts"><ReportBarChart title="Lịch hẹn phát sinh" unit="lịch" rows={appointmentRows.map(row => ({ label: String(row.date ?? row.day ?? ''), value: unwrapNumber(row, ['totalAppointments', 'total']) }))} /><ReportBarChart title="Doanh thu đã thu" unit="VND" rows={revenueRows.map(row => ({ label: String(row.date ?? row.day ?? ''), value: unwrapNumber(row, ['totalCollectedAmount', 'collectedAmount', 'collected']) }))} /></section>
      <details className="clinic-disclosure clinic-report-details"><summary>Xem bảng số liệu theo ngày <ArrowRight size={16} /></summary><section className="clinic-split"><ListCard title="Lịch hẹn theo ngày" columns={['Ngày', 'Đặt', 'Hoàn thành', 'Hủy']} rows={appointmentRows.map((row, i) => <tr key={i}><td>{String(row.date ?? row.day ?? '—')}</td><td>{String(row.totalAppointments ?? row.total ?? 0)}</td><td>{String(row.completedAppointments ?? row.completed ?? 0)}</td><td>{String(row.cancelledAppointments ?? row.cancelled ?? 0)}</td></tr>)} /><ListCard title="Doanh thu theo ngày" columns={['Ngày', 'Đã thu (VND)']} rows={revenueRows.map((row, i) => <tr key={i}><td>{String(row.date ?? row.day ?? '—')}</td><td>{Number(row.totalCollectedAmount ?? row.collectedAmount ?? row.collected ?? 0).toLocaleString('vi-VN')}</td></tr>)} /></section></details>
      {pdfUrl && <div className="clinic-pdf-backdrop" role="dialog" aria-modal="true" aria-label="Xem trước báo cáo PDF"><div className="clinic-pdf-modal"><div className="clinic-card-head"><h2>Xem trước báo cáo {from} – {to}</h2><div className="clinic-actions"><a className="clinic-download" href={pdfUrl} download={`bao-cao-van-hanh-${from}-${to}.pdf`}>Tải PDF</a><button onClick={() => setPdfUrl('')}>Đóng</button></div></div><iframe title="Báo cáo PDF" src={pdfUrl} /></div></div>}
    </>
  );
}
function ReportBarChart({ title, unit, rows }: { title: string; unit: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map(row => Number.isFinite(row.value) ? row.value : 0));
  const width = Math.max(420, rows.length * 42 + 90);
  const bottom = 170;
  const chartWidth = width - 85;
  return <article className="clinic-card clinic-report-chart"><h2>{title}</h2><small>{unit} · Theo ngày ghi nhận</small>{rows.length ? <div className="clinic-chart-scroll"><svg viewBox={`0 0 ${width} 225`} style={{ minWidth: width }} role="img" aria-label={`${title} theo ngày, có trục giá trị`}>
    {[0, 0.5, 1].map(f => { const y = bottom - f * 125; return <g key={f}><line x1="66" x2={width - 12} y1={y} y2={y} stroke="#d8e6f4" strokeDasharray={f ? '4 4' : undefined} /><text x="58" y={y + 4} textAnchor="end" fill="#60748c" fontSize="10">{Math.round(max * f).toLocaleString('vi-VN')}</text></g>; })}
    {rows.map((row, index) => { const x = 70 + index * chartWidth / rows.length; const barWidth = Math.max(10, Math.min(28, chartWidth / rows.length - 8)); const height = Math.max(0, row.value / max * 125); const day = /^\d{4}-\d{2}-\d{2}$/.test(row.label) ? `${row.label.slice(8, 10)}/${row.label.slice(5, 7)}` : row.label; return <g key={`${row.label}-${index}`}><rect x={x} y={bottom - height} width={barWidth} height={height} rx="3" fill="#0f68aa"><title>{row.label}: {row.value.toLocaleString('vi-VN')} {unit}</title></rect><text x={x + barWidth / 2} y={bottom + 18} textAnchor="middle" fill="#60748c" fontSize="9">{day}</text></g>; })}
  </svg></div> : <p className="clinic-empty">Chưa có dữ liệu trong kỳ.</p>}</article>;
}
function ListCard({
  title,
  columns,
  rows,
  searchItems,
  searchPlaceholder,
  headerAction,
}: {
  title: string;
  columns: string[];
  rows: ReactNode[];
  searchItems?: string[];
  searchPlaceholder?: string;
  headerAction?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
  const visibleRows = normalizedQuery && searchItems
    ? rows.filter((_, index) => searchItems[index]?.toLocaleLowerCase('vi-VN').includes(normalizedQuery))
    : rows;
  const labeledRows = visibleRows.map((row) => {
    if (!isValidElement(row)) return row;
    const tableRow = row as ReactElement<{ children?: ReactNode }>;
    return cloneElement(tableRow, {}, Children.map(tableRow.props.children, (cell, index) => {
      if (!isValidElement(cell)) return cell;
      return cloneElement(cell as ReactElement<{ 'data-label'?: string }>, {
        'data-label': columns[index] ?? '',
      });
    }));
  });
  return (
    <article className="clinic-card clinic-list">
      <div className="clinic-card-head">
        <div className="clinic-list-heading"><h2>{title}</h2><span className="clinic-count">{visibleRows.length}{query ? ` / ${rows.length}` : ''}</span></div>
        {headerAction}
      </div>
      {searchItems && <label className="clinic-list-search"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder ?? `Tìm trong ${title.toLocaleLowerCase('vi-VN')}`} aria-label={`Tìm trong ${title}`} /></label>}
      <div className="clinic-table-wrap">
        <table aria-label={title}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? (
              labeledRows
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <Empty text={query ? 'Không tìm thấy kết quả. Thử từ khóa khác.' : 'Chưa có dữ liệu phù hợp.'} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
function Status({ value }: { value?: string }) {
  return (
    <span className={'clinic-status is-' + String(value ?? '').toLowerCase()}>
      {status(value)}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="clinic-empty">{text}</p>;
}
