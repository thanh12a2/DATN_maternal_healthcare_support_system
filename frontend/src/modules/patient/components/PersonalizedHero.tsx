import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink, navigate } from '../../../app/navigation';
import { ApiError } from '../../../services/api';
import type { Appointment } from '../../../services/appointment';
import type { Doctor } from '../../../services/doctor';
import type { PatientProfile } from '../../../services/patient';
import { PREGNANCY_MILESTONES, TIMELINE_POINTS } from '../config/pregnancyHeroConfig';
import { HeroMotherArt } from './HeroMotherArt';
import {
  calculateDaysLeft,
  calculateGestationalWeek,
  extractGreetingName,
  getStageTip,
  getTimelinePosition,
} from '../utils/pregnancyHero';
import '../../../styles/personalized-hero.css';

interface PregnancyEpisode {
  id: string;
  patientId: string;
  status: 'ACTIVE' | 'CLOSED';
  estimatedDueDate?: string | null;
  lastMenstrualPeriod?: string | null;
  riskLevel?: string;
}

interface Envelope<T> {
  data: T;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function formatWeekday(date: Date): string {
  const day = date.getDay();
  if (day === 0) return 'Chủ Nhật';
  return `Thứ ${day + 1}`;
}

function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours < 12 ? 'sáng' : 'chiều';
  const displayHours = hours <= 12 ? hours : hours - 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function PersonalizedHero() {
  const auth = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dữ liệu người dùng thật
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [pregnancy, setPregnancy] = useState<PregnancyEpisode | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctorMap, setDoctorMap] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Tải thông tin bệnh nhân
      let profile: PatientProfile | null = null;
      try {
        const res = await auth.request<Envelope<PatientProfile>>('/api/patients/me');
        profile = res.data;
        setPatient(profile);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 404) {
          profile = null;
          setPatient(null);
        } else {
          throw err;
        }
      }

      // 2. Chạy song song: Tải hồ sơ thai kỳ, lịch hẹn và danh mục bác sĩ
      const promises: [Promise<any>, Promise<any>, Promise<any>] = [
        profile?.id
          ? auth
              .request<Envelope<PregnancyEpisode[]>>(`/api/medical-records/pregnancy-episodes?patientId=${profile.id}`)
              .catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        auth
          .request<any>('/api/appointment/appointments?limit=50')
          .catch(() => ({ items: [] })),
        auth
          .request<Doctor[] | { data: Doctor[] }>('/api/doctors')
          .catch(() => []),
      ];

      const [pregnancyRes, appointmentRes, doctorRes] = await Promise.all(promises);

      // Xử lý hồ sơ thai kỳ ACTIVE
      const episodes: PregnancyEpisode[] = Array.isArray(pregnancyRes?.data) ? pregnancyRes.data : [];
      const activeEp = episodes.find((ep) => ep.status === 'ACTIVE') ?? null;
      setPregnancy(activeEp);

      // Xử lý danh bạ bác sĩ để map tên hiển thị
      const rawDoctors: Doctor[] = Array.isArray(doctorRes) ? doctorRes : Array.isArray(doctorRes?.data) ? doctorRes.data : [];
      const dMap: Record<string, string> = {};
      for (const d of rawDoctors) {
        const id = d.id ?? d.doctorId;
        if (id) {
          const profileData = d.profile ?? {};
          const title = (d.professionalTitle ?? profileData.professionalTitle ?? '').trim();
          const name = (d.fullName ?? profileData.fullName ?? d.name ?? '').trim();
          dMap[id] = [title, name].filter(Boolean).join(' ') || 'Bác sĩ phụ trách';
        }
      }
      setDoctorMap(dMap);

      // Xử lý lịch hẹn sắp tới gần nhất (hợp lệ: BOOKED hoặc CHECKED_IN, thời gian >= hiện tại)
      const rawItems: Appointment[] = Array.isArray(appointmentRes?.items)
        ? appointmentRes.items
        : Array.isArray(appointmentRes?.data)
        ? appointmentRes.data
        : Array.isArray(appointmentRes)
        ? appointmentRes
        : [];

      const nowMs = Date.now();
      const validUpcoming = rawItems
        .filter((apt) => {
          const status = String(apt.status ?? '').toUpperCase();
          const isValidStatus = status === 'BOOKED' || status === 'CHECKED_IN';
          if (!isValidStatus) return false;
          if (!apt.startAt) return false;
          return new Date(apt.startAt).getTime() >= nowMs;
        })
        .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());

      setAppointment(validUpcoming[0] ?? null);
      setLoading(false);
    } catch {
      setError('Không tải được thông tin, vui lòng thử lại.');
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [auth.user?.userId]);

  // Tính tuần thai dựa trên dữ liệu thật
  const gestationalWeek = useMemo(() => {
    if (!pregnancy || pregnancy.status !== 'ACTIVE') return null;
    return calculateGestationalWeek({
      estimatedDueDate: pregnancy.estimatedDueDate,
      lastMenstrualPeriod: pregnancy.lastMenstrualPeriod,
    });
  }, [pregnancy]);

  const timelineCurPos = useMemo(() => {
    if (gestationalWeek === null) return 0;
    return getTimelinePosition(gestationalWeek);
  }, [gestationalWeek]);

  const stageTip = useMemo(() => {
    if (gestationalWeek === null) return null;
    return getStageTip(gestationalWeek);
  }, [gestationalWeek]);

  const greetingName = useMemo(() => {
    return extractGreetingName(patient?.fullName, auth.user?.email);
  }, [patient?.fullName, auth.user?.email]);

  // Thông tin ngày và lịch hẹn
  const apptMeta = useMemo(() => {
    if (!appointment?.startAt) return null;
    const start = new Date(appointment.startAt);
    const dayNumber = start.getDate().toString().padStart(2, '0');
    const monthShort = `Th${start.getMonth() + 1}`;
    const weekday = formatWeekday(start);
    const timeFormatted = formatTime(start);

    const docId = appointment.assignedDoctorId ?? '';
    const doctorDisplay: string = docId && doctorMap[docId] ? doctorMap[docId] : 'Bác sĩ phụ trách';
    const roomDisplay: string = String(appointment.roomName || appointment.roomCode || 'Phòng khám Sản Phụ khoa');
    const serviceDisplay: string = String(appointment.pricing?.serviceName || appointment.serviceNameSnapshot || 'Khám thai định kỳ');
    const daysLeftChip: string = calculateDaysLeft(appointment.startAt);
    const canReschedule: boolean = String(appointment.status).toUpperCase() === 'BOOKED';

    return {
      dayNumber,
      monthShort,
      weekday,
      timeFormatted,
      doctorDisplay,
      roomDisplay,
      serviceDisplay,
      daysLeftChip,
      canReschedule,
    };
  }, [appointment, doctorMap]);

  return (
    <section className="personalized-hero-section" aria-label="Khối chào cá nhân hóa cho bệnh nhân">
      <div className="portal-container personalized-hero-inner">
        {/* CỘT TRÁI: Thông tin cá nhân hóa */}
        <div className="ph-content-col">
          {loading ? (
            <div className="ph-loading-skeleton-wrap">
              <div className="ph-hero-intro">
                <div className="ph-skeleton ph-skeleton-title" />
                <div className="ph-skeleton ph-skeleton-sub" />
              </div>
              <div className="ph-skeleton ph-skeleton-track" />
              <div className="ph-skeleton ph-skeleton-card" />
            </div>
          ) : error ? (
            <div className="ph-error-box" role="alert">
              <span>{error}</span>
              <button type="button" className="ph-retry-btn" onClick={() => void fetchData()}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {/* 1. Lời chào bệnh nhân */}
              <div className="ph-hero-intro">
                <h1 className="ph-hero-title">
                  Chào {greetingName},<br />
                  {gestationalWeek !== null ? 'hôm nay mẹ và bé thế nào?' : 'chào mừng bạn đến với Tâm An!'}
                </h1>
                <p className="ph-hero-sub">
                  {gestationalWeek !== null ? (
                    <span>
                      Bạn đang ở <b>tuần thai thứ {gestationalWeek}</b>.
                    </span>
                  ) : (
                    <span>Chào mừng mẹ đồng hành cùng Bệnh viện Phụ sản & Y học Bào thai Tâm An.</span>
                  )}
                </p>
              </div>

              {/* 2. Thanh hành trình thai kỳ (Chỉ hiện khi có tuần thai hợp lệ 0-42) */}
              {gestationalWeek !== null ? (
                <div className="ph-weeks-wrap" aria-label="Hành trình thai kỳ">
                  <div className="ph-track">
                    <div className="ph-track-fill" style={{ width: `${timelineCurPos}%` }} />
                    {PREGNANCY_MILESTONES.map((tick, i) => {
                      const leftPercent = ((i + 1) / (TIMELINE_POINTS.length - 1)) * 100;
                      const isDone = tick.w <= gestationalWeek;
                      return (
                        <div key={tick.w}>
                          <i
                            className={`ph-dot ${isDone ? 'done' : ''}`}
                            style={{ left: `${leftPercent}%` }}
                            aria-hidden="true"
                          />
                          <div className="ph-lbl" style={{ left: `${leftPercent}%` }}>
                            <b>{tick.w}</b>
                            <span>{tick.name}</span>
                          </div>
                        </div>
                      );
                    })}
                    <i className="ph-dot now" style={{ left: `${timelineCurPos}%` }} aria-hidden="true" />
                    <span className="ph-here-badge" style={{ left: `${timelineCurPos}%` }}>
                      Bạn ở đây
                    </span>
                  </div>
                </div>
              ) : (
                /* Trạng thái chưa có hồ sơ thai kỳ: Card gợi ý onboarding */
                <div className="ph-prompt-card">
                  <div className="ph-prompt-copy">
                    <strong>
                      {!patient
                        ? 'Chưa hoàn thiện hồ sơ bệnh nhân'
                        : 'Chưa kích hoạt hồ sơ thai kỳ'}
                    </strong>
                    <p>
                      {!patient
                        ? 'Hãy cập nhật thông tin cá nhân để hệ thống chăm sóc và theo dõi thai kỳ tốt nhất cho mẹ.'
                        : 'Mẹ hãy đặt lịch khám thai để bác sĩ thăm khám và kích hoạt biểu đồ tuần thai nhé.'}
                    </p>
                  </div>
                  <AppLink
                    href={!patient ? '/ho-so/hoan-thien' : '/dat-lich'}
                    className="ph-prompt-btn"
                  >
                    {!patient ? 'Hoàn thiện hồ sơ →' : 'Đặt lịch khám ngay →'}
                  </AppLink>
                </div>
              )}

              {/* 3. Khối dưới cùng: Thẻ lịch hẹn & Lối tắt */}
              <div className="ph-bottom-group">
                {appointment && apptMeta ? (
                  <article className="ph-appt-card" aria-label="Lịch hẹn sắp tới">
                    <div className="ph-appt-date">
                      <strong>{apptMeta.dayNumber}</strong>
                      <span>{apptMeta.monthShort}</span>
                    </div>
                    <div className="ph-appt-info">
                      <span className="ph-chip highlight">{apptMeta.daysLeftChip}</span>
                      <h2>{apptMeta.serviceDisplay}</h2>
                      <p>
                        {apptMeta.timeFormatted}, {apptMeta.weekday} · {apptMeta.doctorDisplay}
                      </p>
                      <p>{apptMeta.roomDisplay}</p>
                    </div>
                    <div className="ph-btns">
                      <AppLink className="ph-btn" href={`/lich-hen/${encodeURIComponent(appointment.id ?? '')}`}>
                        Xem phiếu khám
                      </AppLink>
                      {apptMeta.canReschedule && (
                        <button
                          type="button"
                          className="ph-btn ghost"
                          onClick={() => navigate('/lich-hen')}
                        >
                          Đổi lịch
                        </button>
                      )}
                    </div>
                  </article>
                ) : (
                  /* Thẻ mời đặt lịch khi chưa có lịch hẹn sắp tới */
                  <article className="ph-appt-card" aria-label="Mời đặt lịch khám">
                    <div className="ph-appt-empty-icon" aria-hidden="true">
                      <CalendarIcon />
                    </div>
                    <div className="ph-appt-info">
                      <span className="ph-chip">Lịch khám của bạn</span>
                      <h2>Bạn chưa có lịch hẹn sắp tới</h2>
                      <p>Chủ động chọn bác sĩ chuyên khoa và khung giờ phù hợp mà không cần xếp hàng.</p>
                    </div>
                    <div className="ph-btns">
                      <AppLink className="ph-btn" href="/dat-lich">
                        Đặt lịch ngay
                      </AppLink>
                    </div>
                  </article>
                )}

                <div className="ph-cta-row">
                  <AppLink href="/dat-lich" className="ph-cta">
                    Đặt lịch khám mới
                  </AppLink>
                  <nav className="ph-quick" aria-label="Lối tắt">
                    <AppLink href="/lich-hen">Lịch hẹn của tôi</AppLink>
                    <AppLink href="/ho-so/hoan-thien">Hồ sơ thai kỳ</AppLink>
                  </nav>
                </div>
              </div>
            </>
          )}
        </div>

        {/* CỘT PHẢI: Hình ảnh minh họa & Chứng nhận */}
        <HeroMotherArt quote={stageTip} />
      </div>
    </section>
  );
}
