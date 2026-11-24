import { useEffect, useRef, useState } from 'react';
import { useAuthSession } from '../../../../app/AuthSessionProvider';
import { AppLink } from '../../../../app/navigation';
import { ApiError } from '../../../../services/api';
import { calculateGestationalWeek } from '../../utils/pregnancyHero';
import type { LandingDoctor } from './document';
interface Episode {
  status: string;
  estimatedDueDate?: string;
  lastMenstrualPeriod?: string;
}
interface Appointment {
  id: string;
  status: string;
  startAt?: string;
  assignedDoctorId?: string;
  serviceNameSnapshot?: string;
  roomName?: string;
  roomCode?: string;
  pricing?: { serviceName?: string };
}
const items = <T,>(v: any): T[] => {
  const result = Array.isArray(v) ? v : (v?.items ?? v?.data);
  return Array.isArray(result) ? result : [];
};

function PatientGreeting({ name }: { name: string }) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const Observer = el.ownerDocument.defaultView?.IntersectionObserver;
    if (!Observer) {
      setHasAnimated(true);
      return;
    }
    try {
      const observer = new Observer(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setHasAnimated(true);
            observer.disconnect();
          }
        },
        { threshold: 0.15 },
      );
      observer.observe(el);
      return () => observer.disconnect();
    } catch {
      setHasAnimated(true);
    }
  }, []);

  const greeting = `Xin chào, ${name}!`;
  const prefixLength = 'Xin chào, '.length;
  return (
    <h2
      ref={headingRef}
      className={`patient-greeting ${hasAnimated ? 'patient-greeting--play' : ''}`}
      aria-label={greeting}
    >
      <span
        className="patient-greeting__letters"
        aria-hidden="true"
        key={`${greeting}-${hasAnimated}`}
      >
        {Array.from(greeting).map((character, index) => {
          const isName =
            index >= prefixLength && index < prefixLength + name.length;
          return (
            <span
              key={`${character}-${index}`}
              className={`patient-greeting__letter${isName ? ' patient-greeting__letter--name' : ''}`}
              style={{
                animationDelay: hasAnimated ? `${index * 42}ms` : '0ms',
              }}
            >
              {character === ' ' ? '\u00a0' : character}
            </span>
          );
        })}
      </span>
    </h2>
  );
}

export function PatientSummary({ doctors }: { doctors: LandingDoctor[] }) {
  const auth = useAuthSession();
  const [version, retry] = useState(0);
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    name?: string;
    profile?: boolean;
    week?: number | null;
    appointment?: Appointment;
    pregnancyError?: boolean;
    appointmentError?: boolean;
  }>({ loading: true });
  useEffect(() => {
    if (auth.status !== 'authenticated' || auth.user?.role !== 'PATIENT')
      return;
    let active = true;
    setState({ loading: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const options = { signal: controller.signal };
    (async () => {
      let profile: { id: string; fullName: string } | null = null;
      try {
        profile = (
          await auth.request<{ data: { id: string; fullName: string } }>(
            '/api/patients/me',
            options,
          )
        ).data;
      } catch (e) {
        if (!(e instanceof ApiError && e.statusCode === 404)) throw e;
      }
      const [pregnancy, appointments] = await Promise.allSettled([
        profile
          ? auth.request(
              `/api/medical-records/pregnancy-episodes?patientId=${encodeURIComponent(profile.id)}`,
              options,
            )
          : Promise.resolve([]),
        auth.request('/api/appointment/appointments?limit=50', options),
      ]);
      const ep =
        pregnancy.status === 'fulfilled'
          ? items<Episode>(pregnancy.value).find((e) => e.status === 'ACTIVE')
          : undefined;
      const appointment =
        appointments.status === 'fulfilled'
          ? items<Appointment>(appointments.value)
              .filter(
                (a) =>
                  ['BOOKED', 'CHECKED_IN'].includes(a.status) &&
                  a.startAt &&
                  Date.parse(a.startAt) >= Date.now(),
              )
              .sort(
                (a, b) => Date.parse(a.startAt!) - Date.parse(b.startAt!),
              )[0]
          : undefined;
      if (active)
        setState({
          loading: false,
          name: profile?.fullName,
          profile: !!profile,
          week: ep ? calculateGestationalWeek(ep) : null,
          appointment,
          pregnancyError: pregnancy.status === 'rejected',
          appointmentError: appointments.status === 'rejected',
        });
    })()
      .catch(() => {
        if (active)
          setState({
            loading: false,
            error: 'Không tải được hồ sơ. Vui lòng thử lại.',
          });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [auth.status, auth.user?.userId, auth.request, version]);
  if (auth.status !== 'authenticated' || auth.user?.role !== 'PATIENT')
    return null;
  const doctor = doctors.find(
    (d) => d.id === state.appointment?.assignedDoctorId,
  );
  return (
    <section
      className="patient-summary"
      aria-label="Thông tin cá nhân của bệnh nhân"
    >
      <PatientGreeting name={state.name || auth.user.email.split('@')[0]} />
      {state.loading ? (
        <p role="status">Đang tải thông tin của bạn…</p>
      ) : state.error ? (
        <p role="alert">
          {state.error}{' '}
          <button onClick={() => retry((v) => v + 1)}>Thử lại</button>
        </p>
      ) : (
        <>
          {!state.pregnancyError && (
            <p>
              {state.week != null
                ? `Bạn đang ở tuần thai thứ ${state.week}.`
                : state.profile
                  ? 'Chưa có thông tin thai kỳ đang theo dõi.'
                  : 'Hoàn thiện hồ sơ để bắt đầu hành trình chăm sóc.'}
            </p>
          )}
          {state.pregnancyError || state.appointmentError ? (
            <p role="status">
              Một số thông tin thai kỳ hoặc lịch hẹn chưa tải được.{' '}
              <button onClick={() => retry((v) => v + 1)}>Thử lại</button>
            </p>
          ) : null}
          {state.appointment ? (
            <div>
              <strong>Lịch khám sắp tới</strong>
              <p>
                {state.appointment.pricing?.serviceName ||
                  state.appointment.serviceNameSnapshot}
              </p>
              <p>
                {new Date(state.appointment.startAt!).toLocaleString('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                })}{' '}
                ·{' '}
                {doctor?.profile?.fullName ||
                  doctor?.fullName ||
                  'Bác sĩ phụ trách'}
              </p>
              <p>{state.appointment.roomName || state.appointment.roomCode}</p>
              <AppLink
                href={'/lich-hen/' + encodeURIComponent(state.appointment.id)}
              >
                Xem phiếu khám
              </AppLink>
              {state.appointment.status === 'BOOKED' && (
                <AppLink href="/lich-hen">Đổi lịch</AppLink>
              )}
            </div>
          ) : (
            !state.appointmentError && <p>Bạn chưa có lịch hẹn sắp tới.</p>
          )}
        </>
      )}
      <div className="patient-summary-links">
        <AppLink href="/dat-lich">Đặt lịch khám</AppLink>
        <AppLink href="/lich-hen">Lịch hẹn của tôi</AppLink>
        <AppLink href="/ho-so/hoan-thien">Hồ sơ bệnh nhân</AppLink>
      </div>
    </section>
  );
}
