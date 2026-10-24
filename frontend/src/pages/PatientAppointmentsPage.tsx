import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../app/AuthSessionProvider';
import { navigate } from '../app/navigation';
import { PatientSidebar } from '../components/navigation/PatientSidebar';
import { LoadingPlaceholder } from '../components/ui/LoadingPlaceholder';
import { getAppointment, listAppointments, type Appointment } from '../services/appointment';
import { listDoctors, type Doctor } from '../services/doctor';
import '../styles/patient-appointments.css';

function formatDateTime(value?: string) { return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có dữ liệu'; }
function formatTime(value?: string) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'; }
function statusLabel(status?: string) {
  const labels: Record<string, string> = { BOOKED: 'Đã đặt lịch', REASSIGNMENT_REQUIRED: 'Đang phân công lại', CHECKED_IN: 'Đã check-in', IN_CLINICAL_CARE: 'Đang khám', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng mặt' };
  return labels[status ?? ''] ?? status ?? 'Đang cập nhật';
}
function formatMoney(amount?: number, currency = 'VND') { return amount === undefined ? 'Chưa có dữ liệu' : `${amount.toLocaleString('vi-VN')} ${currency}`; }
function appointmentKey(appointment: Appointment) { return appointment.id ?? appointment.appointmentCode ?? ''; }
function doctorLabel(doctor: Doctor) {
  const profile = doctor.profile ?? {};
  const name = String(doctor.fullName ?? doctor.name ?? profile.fullName ?? doctor.displayName ?? '').replace(/^BS\.?\s*/i, '').trim();
  const title = String(doctor.professionalTitle ?? profile.professionalTitle ?? '').trim();
  return [title, name].filter(Boolean).join(' · ') || 'Bác sĩ phụ trách';
}
function doctorNameMap(doctors: Doctor[]) {
  return Object.fromEntries(doctors.map((doctor) => [String(doctor.id ?? doctor.doctorId ?? ''), doctorLabel(doctor)]).filter(([id]) => Boolean(id)));
}

export function AppointmentDetailPage({ appointmentId }: { appointmentId: string }) {
  const auth = useAuthSession();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([getAppointment(auth.request, appointmentId), listDoctors(auth.request).catch(() => [])])
      .then(([value, doctors]) => { if (live) { setAppointment(value); setDoctorNames(doctorNameMap(doctors)); setState('ready'); } })
      .catch((reason) => { if (live) { setError(reason instanceof Error ? reason.message : 'Không thể tải chi tiết lịch hẹn.'); setState('error'); } });
    return () => { live = false; };
  }, [auth.request, appointmentId]);
  const doctorName = appointment?.assignedDoctorId ? doctorNames[appointment.assignedDoctorId] ?? 'Bác sĩ phụ trách' : 'Đang phân công';
  return <div className="patient-home-shell patient-desktop-portal"><PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} /><main className="patient-main-view"><section className="appointments-page appointment-detail-shell"><button className="appointment-back-link" type="button" onClick={() => navigate('/lich-hen')}>← Quay lại lịch hẹn</button><LoadingPlaceholder visible={state === 'loading'} label="Đang tải chi tiết lịch hẹn" />{state === 'error' && <p className="appointments-feedback is-error" role="alert">{error}</p>}{state === 'ready' && appointment && <article className="appointment-detail-page"><header className="appointment-detail-head"><span>Chi tiết lịch hẹn</span><h1>{appointment.pricing?.serviceName ?? 'Lịch khám'}</h1><p>{doctorName}</p></header><div className="appointment-detail-body"><span className="appointment-detail-status">{statusLabel(appointment.status)}</span><dl className="appointment-detail-list"><div><dt>Ngày và giờ</dt><dd>{formatDateTime(appointment.startAt)}</dd></div><div><dt>Kết thúc</dt><dd>{formatDateTime(appointment.endAt)}</dd></div><div><dt>Bác sĩ</dt><dd>{doctorName}</dd></div><div><dt>Hạng tư vấn</dt><dd>{appointment.assignedRankCode ?? 'Đang cập nhật'}</dd></div><div><dt>Chi phí dự kiến</dt><dd>{formatMoney(appointment.pricing?.estimatedTotalMinor, appointment.pricing?.currency)}</dd></div></dl><p className="appointment-detail-note">Vui lòng check-in tại quầy lễ tân khi đến phòng khám.</p></div></article>}</section></main></div>;
}

type AppointmentView = 'upcoming' | 'history' | 'all';
const terminalStatuses = new Set(['COMPLETED', 'CANCELLED', 'NO_SHOW']);
function isUpcoming(item: Appointment, now: number) { if (terminalStatuses.has(item.status ?? '')) return false; return Boolean(item.startAt && Date.parse(item.startAt) >= now); }

export function PatientAppointmentsPage() {
  const auth = useAuthSession();
  const [items, setItems] = useState<Appointment[]>([]);
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [view, setView] = useState<AppointmentView>('upcoming');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([listAppointments(auth.request), listDoctors(auth.request).catch(() => [])])
      .then(([result, doctors]) => { if (live) { setItems(result.items ?? []); setDoctorNames(doctorNameMap(doctors)); setState('ready'); } })
      .catch((reason) => { if (live) { setError(reason instanceof Error ? reason.message : 'Không thể tải lịch hẹn.'); setState('error'); } });
    return () => { live = false; };
  }, [auth.request]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => (a.startAt ? Date.parse(a.startAt) : Number.POSITIVE_INFINITY) - (b.startAt ? Date.parse(b.startAt) : Number.POSITIVE_INFINITY) || appointmentKey(a).localeCompare(appointmentKey(b))), [items]);
  const now = Date.now();
  const upcomingItems = useMemo(() => sortedItems.filter((item) => isUpcoming(item, now)), [sortedItems, now]);
  const historyItems = useMemo(() => sortedItems.filter((item) => !isUpcoming(item, now)), [sortedItems, now]);
  const visibleItems = view === 'upcoming' ? upcomingItems : view === 'history' ? historyItems : sortedItems;
  const nearestKey = upcomingItems[0]?.id;
  const referenceDate = visibleItems.find((item) => item.id === nearestKey)?.startAt ?? visibleItems[0]?.startAt;
  const periodLabel = referenceDate ? new Date(referenceDate).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }) : '';
  const tabs: Array<{ id: AppointmentView; label: string; count: number }> = [{ id: 'upcoming', label: 'Sắp tới', count: upcomingItems.length }, { id: 'history', label: 'Lịch sử', count: historyItems.length }, { id: 'all', label: 'Tất cả', count: sortedItems.length }];

  return <div className="patient-home-shell patient-desktop-portal"><PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} /><main className="patient-main-view"><section className="appointments-page"><header className="appointments-page-header"><div><span className="appointments-eyebrow">Lịch hẹn</span><h1>Lịch hẹn của bạn</h1><p>Theo dõi lịch khám sắp tới và xem lại các lịch hẹn đã diễn ra.</p></div><div className="appointments-page-meta"><strong>{String(visibleItems.length).padStart(2, '0')} lịch hẹn</strong>{periodLabel && <span>{periodLabel}</span>}</div></header>
    <div className="appointment-view-tabs" role="tablist" aria-label="Bộ lọc lịch hẹn">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} className={`appointment-view-tab ${view === tab.id ? 'is-active' : ''}`} onClick={() => setView(tab.id)}><span>{tab.label}</span><strong>{tab.count}</strong></button>)}</div>
    <LoadingPlaceholder visible={state === 'loading'} label="Đang tải lịch hẹn" />
    {state === 'error' && <p className="appointments-feedback is-error" role="alert">{error}</p>}
    {state === 'ready' && !visibleItems.length && <div className="appointments-empty">{view === 'upcoming' ? 'Bạn chưa có lịch hẹn sắp tới.' : view === 'history' ? 'Chưa có lịch sử lịch hẹn.' : 'Bạn chưa có lịch hẹn nào.'}</div>}
    {state === 'ready' && visibleItems.length > 0 && <section className="appointment-sheet"><div className="appointment-sheet-head" aria-hidden="true"><span>Ngày khám</span><span>Thông tin buổi khám</span><span>Thao tác</span></div><div className="appointment-list">{visibleItems.map((appointment) => { const start = appointment.startAt ? new Date(appointment.startAt) : null; const isNearest = appointment.id === nearestKey && view !== 'history'; const doctorName = appointment.assignedDoctorId ? doctorNames[appointment.assignedDoctorId] ?? 'Bác sĩ phụ trách' : 'Đang phân công'; return <article className={`appointment-item ${isNearest ? 'is-nearest' : ''}`} key={appointmentKey(appointment)}><time className="appointment-date" dateTime={appointment.startAt}><span>{start ? `Tháng ${start.getMonth() + 1}` : 'Ngày khám'}</span><strong>{start?.getDate() ?? '—'}</strong><small>{start?.toLocaleDateString('vi-VN', { weekday: 'long' }) ?? ''}</small></time><div className="appointment-content"><div className="appointment-topline"><span className="appointment-status">{statusLabel(appointment.status)}</span>{isNearest && <span className="appointment-nearest-badge">Gần nhất</span>}</div><h3>{appointment.pricing?.serviceName ?? 'Lịch khám'}</h3><div className="appointment-meta"><span>{formatTime(appointment.startAt)} — {formatTime(appointment.endAt)}</span><span>{start?.toLocaleDateString('vi-VN') ?? 'Chưa có ngày'}</span></div><p>Bác sĩ: {doctorName}</p></div><button className="appointment-detail-link" type="button" disabled={!appointment.id} onClick={() => appointment.id && navigate(`/lich-hen/${encodeURIComponent(appointment.id)}`)}>Xem chi tiết <span aria-hidden="true">→</span></button></article>; })}</div><footer className="appointment-note"><strong>{view === 'history' ? 'Lịch sử lịch hẹn' : 'Thay đổi lịch hẹn'}</strong>{view === 'history' ? 'Các lịch hẹn đã hoàn tất, hủy hoặc quá giờ được lưu tại đây.' : 'Patient không tự hủy hoặc đổi lịch trong portal. Vui lòng liên hệ phòng khám nếu cần hỗ trợ.'}<span>{view === 'upcoming' ? ' Lịch sắp tới gần nhất đã được đánh dấu.' : ''}</span></footer></section>}
  </section></main></div>;
}
