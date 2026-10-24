import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../app/AuthSessionProvider';
import { navigate } from '../app/navigation';
import { PatientSidebar } from '../components/navigation/PatientSidebar';
import { LoadingPlaceholder } from '../components/ui/LoadingPlaceholder';
import { getAppointment, listAppointments, type Appointment } from '../services/appointment';
import '../styles/patient-appointments.css';

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có dữ liệu';
}

function formatTime(value?: string) {
  return value
    ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '—';
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    BOOKED: 'Đã đặt lịch',
    CHECKED_IN: 'Đã check-in',
    IN_CLINICAL_CARE: 'Đang khám',
    COMPLETED: 'Hoàn tất',
    CANCELLED: 'Đã hủy',
    NO_SHOW: 'Vắng mặt',
  };
  return labels[status ?? ''] ?? status ?? 'Đang cập nhật';
}

function formatMoney(amount?: number, currency = 'VND') {
  if (amount === undefined) return 'Chưa có dữ liệu';
  return `${amount.toLocaleString('vi-VN')} ${currency}`;
}

function appointmentKey(appointment: Appointment) {
  return appointment.id ?? appointment.appointmentCode ?? '';
}

export function AppointmentDetailPage({ appointmentId }: { appointmentId: string }) {
  const auth = useAuthSession();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getAppointment(auth.request, appointmentId)
      .then((value) => {
        if (!live) return;
        setAppointment(value);
        setState('ready');
      })
      .catch((reason) => {
        if (!live) return;
        setError(reason instanceof Error ? reason.message : 'Không thể tải chi tiết lịch hẹn.');
        setState('error');
      });
    return () => { live = false; };
  }, [auth.request, appointmentId]);

  return (
    <div className="patient-home-shell patient-desktop-portal">
      <PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} />
      <main className="patient-main-view">
        <section className="appointments-page appointment-detail-shell">
          <button className="appointment-back-link" type="button" onClick={() => navigate('/lich-hen')}>← Quay lại lịch hẹn</button>
          <LoadingPlaceholder visible={state === 'loading'} label="Đang tải chi tiết lịch hẹn" />
          {state === 'error' && <p className="appointments-feedback is-error" role="alert">{error}</p>}
          {state === 'ready' && appointment && (
            <article className="appointment-detail-page">
              <header className="appointment-detail-head">
                <span>Chi tiết lịch hẹn</span>
                <h1>{appointment.pricing?.serviceName ?? 'Lịch khám'}</h1>
                <p>{appointment.appointmentCode ?? appointment.id}</p>
              </header>
              <div className="appointment-detail-body">
                <span className="appointment-detail-status">{statusLabel(appointment.status)}</span>
                <dl className="appointment-detail-list">
                  <div><dt>Ngày và giờ</dt><dd>{formatDateTime(appointment.startAt)}</dd></div>
                  <div><dt>Kết thúc</dt><dd>{formatDateTime(appointment.endAt)}</dd></div>
                  <div><dt>Bác sĩ</dt><dd>{appointment.assignedDoctorId ? 'Bác sĩ phụ trách' : 'Đang phân công'}</dd></div>
                  <div><dt>Hạng tư vấn</dt><dd>{appointment.assignedRankCode ?? 'Đang cập nhật'}</dd></div>
                  <div><dt>Chi phí dự kiến</dt><dd>{formatMoney(appointment.pricing?.estimatedTotalMinor, appointment.pricing?.currency)}</dd></div>
                </dl>
                <p className="appointment-detail-note">Vui lòng check-in tại quầy lễ tân khi đến phòng khám.</p>
              </div>
            </article>
          )}
        </section>
      </main>
    </div>
  );
}

export function PatientAppointmentsPage() {
  const auth = useAuthSession();
  const [items, setItems] = useState<Appointment[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    listAppointments(auth.request)
      .then((result) => {
        if (!live) return;
        setItems(result.items ?? []);
        setState('ready');
      })
      .catch((reason) => {
        if (!live) return;
        setError(reason instanceof Error ? reason.message : 'Không thể tải lịch hẹn.');
        setState('error');
      });
    return () => { live = false; };
  }, [auth.request]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => {
      const left = a.startAt ? Date.parse(a.startAt) : Number.POSITIVE_INFINITY;
      const right = b.startAt ? Date.parse(b.startAt) : Number.POSITIVE_INFINITY;
      return left - right || appointmentKey(a).localeCompare(appointmentKey(b));
    }),
    [items],
  );

  const nearestKey = useMemo(() => {
    const now = Date.now();
    return sortedItems.find((item) => item.startAt && Date.parse(item.startAt) >= now)?.id;
  }, [sortedItems]);

  const referenceDate = sortedItems.find((item) => item.id === nearestKey)?.startAt ?? sortedItems[0]?.startAt;
  const periodLabel = referenceDate
    ? new Date(referenceDate).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="patient-home-shell patient-desktop-portal">
      <PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} />
      <main className="patient-main-view">
        <section className="appointments-page">
          <header className="appointments-page-header">
            <div>
              <span className="appointments-eyebrow">Lịch hẹn</span>
              <h1>Lịch hẹn của bạn</h1>
              <p>Thông tin các buổi khám đã được xác nhận và mã lịch tương ứng.</p>
            </div>
            <div className="appointments-page-meta">
              <strong>{String(sortedItems.length).padStart(2, '0')} lịch hẹn</strong>
              {periodLabel && <span>{periodLabel}</span>}
            </div>
          </header>

          <LoadingPlaceholder visible={state === 'loading'} label="Đang tải lịch hẹn" />
          {state === 'error' && <p className="appointments-feedback is-error" role="alert">{error}</p>}
          {state === 'ready' && !sortedItems.length && <div className="appointments-empty">Bạn chưa có lịch hẹn nào.</div>}
          {state === 'ready' && sortedItems.length > 0 && (
            <section className="appointment-sheet">
              <div className="appointment-sheet-head" aria-hidden="true">
                <span>Ngày khám</span><span>Thông tin buổi khám</span><span>Thao tác</span>
              </div>
              <div className="appointment-list">
                {sortedItems.map((appointment) => {
                  const start = appointment.startAt ? new Date(appointment.startAt) : null;
                  const isNearest = appointment.id === nearestKey;
                  return (
                    <article className={`appointment-item ${isNearest ? 'is-nearest' : ''}`} key={appointmentKey(appointment)}>
                      <time className="appointment-date" dateTime={appointment.startAt}>
                        <span>{start ? `Tháng ${start.getMonth() + 1}` : 'Ngày khám'}</span>
                        <strong>{start?.getDate() ?? '—'}</strong>
                        <small>{start?.toLocaleDateString('vi-VN', { weekday: 'long' }) ?? ''}</small>
                      </time>
                      <div className="appointment-content">
                        <div className="appointment-topline">
                          <span className="appointment-status">{statusLabel(appointment.status)}</span>
                          {isNearest && <span className="appointment-nearest-badge">Gần nhất</span>}
                          <span className="appointment-code">{appointment.appointmentCode ?? appointment.id}</span>
                        </div>
                        <h3>{appointment.pricing?.serviceName ?? 'Lịch khám'}</h3>
                        <div className="appointment-meta">
                          <span>{formatTime(appointment.startAt)} — {formatTime(appointment.endAt)}</span>
                          <span>{start?.toLocaleDateString('vi-VN') ?? 'Chưa có ngày'}</span>
                        </div>
                        <p>Dịch vụ: {appointment.serviceId ?? 'Chưa có dữ liệu'}</p>
                      </div>
                      <button
                        className="appointment-detail-link"
                        type="button"
                        disabled={!appointment.id}
                        onClick={() => appointment.id && navigate(`/lich-hen/${encodeURIComponent(appointment.id)}`)}
                      >
                        Xem chi tiết <span aria-hidden="true">→</span>
                      </button>
                    </article>
                  );
                })}
              </div>
              <footer className="appointment-note">
                <strong>Thay đổi lịch hẹn</strong>
                Patient không tự hủy hoặc đổi lịch trong portal. Vui lòng liên hệ phòng khám nếu cần hỗ trợ.
                <span> Lịch sắp tới gần nhất đã được đánh dấu.</span>
              </footer>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
