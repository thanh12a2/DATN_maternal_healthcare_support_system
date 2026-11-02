import { useState, useEffect, useMemo } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { AppointmentTicketModal } from '../../../shared/components/portal/AppointmentTicketModal';
import { AppLink } from '../../../app/navigation';
import {
  listAppointments,
  getAppointment,
  type Appointment,
} from '../../../services/appointment';
import { listDoctors, listSpecialties, type Doctor, type Specialty } from '../../../services/doctor';
import { getMyPatient, type PatientProfile } from '../../../services/patient';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  MapPin,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Copy,
  Check,
  Printer,
  ArrowRight,
  Search,
  Sparkles,
  PhoneCall,
  FileText,
  RefreshCw,
  X,
  ChevronLeft,
  Building2,
} from 'lucide-react';
import '../../../styles/patient-appointments.css';

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function formatDateDisplay(isoString?: string | null): string {
  if (!isoString) return '--/--/----';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--/--/----';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatWeekday(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getDay()] || '';
}

function formatDayNum(isoString?: string | null): string {
  if (!isoString) return '--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--';
  return String(d.getDate()).padStart(2, '0');
}

function formatMonthYear(isoString?: string | null): string {
  if (!isoString) return '--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--';
  return `Tháng ${d.getMonth() + 1}`;
}

function formatTimeRange(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return '--:--';
  const s = new Date(startIso);
  const startStr = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
  if (!endIso) return startStr;
  const e = new Date(endIso);
  const endStr = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
  return `${startStr} - ${endStr}`;
}

function formatVnd(amount?: number | null): string {
  if (!amount && amount !== 0) return '0 ₫';
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

function isAppointmentUpcoming(apt: Appointment): boolean {
  const status = apt.status;
  if (status === 'CANCELLED' || status === 'NO_SHOW' || status === 'COMPLETED') return false;
  const start = new Date(apt.startAt || 0);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return start.getTime() >= todayMidnight.getTime();
}

function isAppointmentPast(apt: Appointment): boolean {
  if (apt.status === 'COMPLETED') return true;
  if (apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') return false;
  const start = new Date(apt.startAt || 0);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return start.getTime() < todayMidnight.getTime();
}

function isAppointmentCancelled(apt: Appointment): boolean {
  return apt.status === 'CANCELLED' || apt.status === 'NO_SHOW';
}

function getStatusBadge(status?: string | null) {
  switch (status) {
    case 'CHECKED_IN':
      return { label: 'Đã tiếp đón', className: 'checked_in', icon: <CheckCircle2 size={13} /> };
    case 'IN_CLINICAL_CARE':
      return { label: 'Đang trong ca khám', className: 'in_clinical_care', icon: <Sparkles size={13} /> };
    case 'COMPLETED':
      return { label: 'Đã hoàn thành', className: 'completed', icon: <CheckCircle2 size={13} /> };
    case 'CANCELLED':
      return { label: 'Đã hủy', className: 'cancelled', icon: <XCircle size={13} /> };
    case 'NO_SHOW':
      return { label: 'Vắng mặt', className: 'cancelled', icon: <AlertCircle size={13} /> };
    case 'REASSIGNMENT_REQUIRED':
      return { label: 'Đang điều phối lại', className: 'checked_in', icon: <RefreshCw size={13} /> };
    case 'BOOKED':
    default:
      return { label: 'Đã xác nhận', className: 'booked', icon: <CheckCircle2 size={13} /> };
  }
}

/**
 * TRANG DANH SÁCH LỊCH HẸN KHÁM CỦA TÔI
 * Khớp 100% kích thước Navbar (1340px)
 * Phân tách rõ ràng giữa Lịch hẹn sắp tới và Lịch sử khám đã qua
 */
export function PatientAppointmentsPage() {
  const auth = useAuthSession();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled' | 'all'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Appointment | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // 1. Tải danh sách lịch hẹn & dữ liệu bổ trợ từ DB
  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      listAppointments(auth.request, {}).then((page) => page.items || []).catch(() => []),
      listDoctors(auth.request).catch(() => []),
      listSpecialties(auth.request).catch(() => []),
      getMyPatient(auth.request).catch(() => null),
    ]).then(([appList, docList, specList, profile]) => {
      if (!active) return;
      setAppointments(appList);
      setDoctors(docList || []);
      setSpecialties(specList || []);
      setPatientProfile(profile);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [auth.request]);

  // Maps tra cứu
  const doctorMap = useMemo(() => {
    const map = new Map<string, any>();
    doctors.forEach((d) => map.set(d.doctorId || d.id, d));
    return map;
  }, [doctors]);

  const specialtyMap = useMemo(() => {
    const map = new Map<string, any>();
    specialties.forEach((s) => map.set(s.id, s));
    return map;
  }, [specialties]);

  // Phân loại Lịch hẹn
  const { upcomingList, pastList, cancelledList, totalCount } = useMemo(() => {
    const upcoming: Appointment[] = [];
    const past: Appointment[] = [];
    const cancelled: Appointment[] = [];

    appointments.forEach((apt) => {
      if (isAppointmentCancelled(apt)) {
        cancelled.push(apt);
      } else if (isAppointmentPast(apt)) {
        past.push(apt);
      } else {
        upcoming.push(apt);
      }
    });

    // Sắp xếp: Sắp tới -> Ngày gần nhất trước; Đã qua/Hủy -> Mới nhất trước
    upcoming.sort((a, b) => new Date(a.startAt || 0).getTime() - new Date(b.startAt || 0).getTime());
    past.sort((a, b) => new Date(b.startAt || 0).getTime() - new Date(a.startAt || 0).getTime());
    cancelled.sort((a, b) => new Date(b.startAt || 0).getTime() - new Date(a.startAt || 0).getTime());

    return {
      upcomingList: upcoming,
      pastList: past,
      cancelledList: cancelled,
      totalCount: appointments.length,
    };
  }, [appointments]);

  // Lịch hẹn sắp tới gần nhất (Featured Hero Card)
  const nextAppointment = useMemo(() => {
    return upcomingList.length > 0 ? upcomingList[0] : null;
  }, [upcomingList]);

  // Lọc theo Tab và Từ khóa tìm kiếm
  const displayedAppointments = useMemo(() => {
    let list: Appointment[] = [];
    if (activeTab === 'upcoming') {
      list = upcomingList;
    } else if (activeTab === 'past') {
      list = pastList;
    } else if (activeTab === 'cancelled') {
      list = cancelledList;
    } else {
      list = appointments;
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.trim().toLowerCase();
    return list.filter((apt) => {
      const code = (apt.appointmentCode || '').toLowerCase();
      const svcName = (apt.pricing?.serviceName || '').toLowerCase();
      const doc = apt.assignedDoctorId ? doctorMap.get(apt.assignedDoctorId) : null;
      const docName = (doc?.displayName || '').toLowerCase();
      return code.includes(query) || svcName.includes(query) || docName.includes(query);
    });
  }, [activeTab, upcomingList, pastList, cancelledList, appointments, searchQuery, doctorMap]);

  // Sao chép mã phiếu khám
  const handleCopyCode = (code?: string) => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Lấy tên bác sĩ hiển thị
  const getDoctorDisplay = (apt: Appointment) => {
    if (apt.selectionMode === 'RANK') {
      const doc = apt.assignedDoctorId ? doctorMap.get(apt.assignedDoctorId) : null;
      if (doc?.displayName) {
        return `BS. ${doc.displayName}`;
      }
      return 'Bệnh viện tự động sắp xếp';
    }
    const doc = apt.assignedDoctorId ? doctorMap.get(apt.assignedDoctorId) : null;
    return doc?.displayName ? `BS. ${doc.displayName}` : 'Bác sĩ chuyên khoa Tâm An';
  };

  const renderAppointmentCard = (apt: Appointment) => {
    const isUpcoming = isAppointmentUpcoming(apt);
    const isPast = isAppointmentPast(apt);
    const isCancelled = isAppointmentCancelled(apt);
    const badge = getStatusBadge(apt.status);
    const doctorName = getDoctorDisplay(apt);
    const specialtyName = apt.specialtyId ? specialtyMap.get(apt.specialtyId)?.name : 'Sản khoa';

    const cardVariant = isCancelled
      ? 'is-cancelled'
      : isPast
      ? 'is-past'
      : 'is-upcoming';

    return (
      <article key={apt.id || apt.appointmentCode} className={`pap-card ${cardVariant}`}>
        {/* Cột 1: Lịch tờ */}
        <div className="pap-card-calendar-col">
          <span className="pap-card-month">{formatMonthYear(apt.startAt)}</span>
          <strong className="pap-card-day-num">{formatDayNum(apt.startAt)}</strong>
          <span className="pap-card-weekday">{formatWeekday(apt.startAt)}</span>
          <span className="pap-card-time-badge">
            {formatTimeRange(apt.startAt, apt.endAt)}
          </span>
        </div>

        {/* Cột 2: Thông tin chi tiết */}
        <div className="pap-card-info-col">
          <h3 className="pap-card-service-title">
            {apt.pricing?.serviceName || 'Dịch vụ khám Sản Phụ khoa'}
          </h3>

          <div className="pap-card-details-row">
            <div className="pap-card-detail-item">
              <Stethoscope size={15} color="#0b4f9c" />
              <span>{doctorName}</span>
              {apt.selectionMode === 'RANK' && (
                <span className="pap-auto-tag">Tự động</span>
              )}
            </div>

            <div className="pap-card-detail-item">
              <Building2 size={15} color="#64748b" />
              <span>{specialtyName || 'Sản - Phụ khoa'}</span>
            </div>
          </div>

          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
            Mã phiếu hẹn: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{apt.appointmentCode}</strong>
          </div>
        </div>

        {/* Cột 3: Trạng thái & Hành động */}
        <div className="pap-card-actions-col">
          <span className={`pap-status-badge ${badge.className}`}>
            {badge.icon} {badge.label}
          </span>

          <div className="pap-card-price">
            {formatVnd(apt.pricing?.estimatedTotalMinor)}
          </div>

          <div className="pap-card-btns-wrap">
            <button
              type="button"
              className="pap-btn-view-ticket"
              onClick={() => setSelectedTicket(apt)}
            >
              <FileText size={15} />
              <span>Phiếu hẹn</span>
            </button>

            {isPast && (
              <AppLink
                href={`/dat-lich?serviceId=${encodeURIComponent(apt.serviceId || '')}`}
                className="pap-btn-rebook"
              >
                <ArrowRight size={14} />
                <span>Đặt lại</span>
              </AppLink>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderEmptyState = (title: string, desc: string, showBookBtn = true) => (
    <div className="pap-empty-state">
      <div className="pap-empty-icon">
        <Calendar size={32} />
      </div>
      <h3 className="pap-empty-title">{title}</h3>
      <p className="pap-empty-desc">{desc}</p>
      {showBookBtn && (
        <AppLink href="/dat-lich" className="pap-btn-book-new">
          <Calendar size={18} />
          <span>Đặt Lịch Khám Ngay</span>
        </AppLink>
      )}
    </div>
  );

  return (
    <div className="patient-modern-portal-shell">
      <PublicPortalHeader />

      <main className="patient-modern-portal-main pap-page">
        <div className="portal-container pap-container">
          {/* 1. Header & Quick Action */}
          <section className="pap-header-section">
            <div className="pap-header-left">
              <nav className="pap-breadcrumbs">
                <AppLink href="/" className="pap-breadcrumb-link">Trang chủ</AppLink>
                <span>/</span>
                <span>Lịch hẹn của tôi</span>
              </nav>
              <h1 className="pap-title">Lịch Hẹn Khám Của Tôi</h1>
              <p className="pap-subtitle">
                Tra cứu, theo dõi tiến trình và quản lý phiếu hẹn khám y tế trực tuyến tại Bệnh viện Phụ sản Tâm An.
              </p>
            </div>

            <div className="pap-header-actions">
              <AppLink href="/dat-lich" className="pap-btn-book-new">
                <Calendar size={18} />
                <span>+ Đặt Lịch Khám Mới</span>
              </AppLink>
            </div>
          </section>

          {/* 2. Thẻ thống kê tóm tắt */}
          <section className="pap-stats-grid">
            <div className="pap-stat-card">
              <div className="pap-stat-icon upcoming">
                <Calendar size={22} />
              </div>
              <div className="pap-stat-content">
                <div className="pap-stat-count">{upcomingList.length}</div>
                <div className="pap-stat-label">Lịch hẹn sắp tới</div>
              </div>
            </div>

            <div className="pap-stat-card">
              <div className="pap-stat-icon completed">
                <CheckCircle2 size={22} />
              </div>
              <div className="pap-stat-content">
                <div className="pap-stat-count">{pastList.length}</div>
                <div className="pap-stat-label">Lịch sử đã khám</div>
              </div>
            </div>

            <div className="pap-stat-card">
              <div className="pap-stat-icon cancelled">
                <XCircle size={22} />
              </div>
              <div className="pap-stat-content">
                <div className="pap-stat-count">{cancelledList.length}</div>
                <div className="pap-stat-label">Lịch đã hủy</div>
              </div>
            </div>

            <div className="pap-stat-card">
              <div className="pap-stat-icon total">
                <FileText size={22} />
              </div>
              <div className="pap-stat-content">
                <div className="pap-stat-count">{totalCount}</div>
                <div className="pap-stat-label">Tổng cộng các đợt khám</div>
              </div>
            </div>
          </section>

          {/* 3. Toolbar: Phân loại Tabs & Tìm kiếm */}
          <section className="pap-toolbar-card">
            <div className="pap-tabs-list">
              <button
                type="button"
                className={`pap-tab-btn ${activeTab === 'upcoming' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('upcoming')}
              >
                <Calendar size={15} />
                <span>Lịch hẹn sắp tới</span>
                <span className="pap-tab-badge">{upcomingList.length}</span>
              </button>

              <button
                type="button"
                className={`pap-tab-btn ${activeTab === 'past' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('past')}
              >
                <CheckCircle2 size={15} />
                <span>Lịch sử khám</span>
                <span className="pap-tab-badge">{pastList.length}</span>
              </button>

              <button
                type="button"
                className={`pap-tab-btn ${activeTab === 'cancelled' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('cancelled')}
              >
                <XCircle size={15} />
                <span>Đã hủy</span>
                <span className="pap-tab-badge">{cancelledList.length}</span>
              </button>

              <button
                type="button"
                className={`pap-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <span>Tất cả</span>
                <span className="pap-tab-badge">{totalCount}</span>
              </button>
            </div>

            <div className="pap-search-box">
              <Search size={16} className="pap-search-icon" />
              <input
                type="text"
                className="pap-search-input"
                placeholder="Tìm theo mã lịch hẹn, dịch vụ, bác sĩ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </section>

          {/* 4. Trạng thái Loading hoặc Danh sách hiển thị */}
          {loading ? (
            <div className="pap-empty-state">
              <div className="pap-empty-icon">
                <RefreshCw size={28} className="animate-spin" />
              </div>
              <h3 className="pap-empty-title">Đang đồng bộ dữ liệu lịch hẹn...</h3>
              <p className="pap-empty-desc">Vui lòng chờ trong giây lát.</p>
            </div>
          ) : searchQuery.trim() ? (
            /* Khi đang tìm kiếm theo từ khóa */
            displayedAppointments.length > 0 ? (
              <div className="pap-cards-list">
                {displayedAppointments.map(renderAppointmentCard)}
              </div>
            ) : (
              renderEmptyState(
                `Không tìm thấy lịch hẹn phù hợp với "${searchQuery}"`,
                'Vui lòng thử tìm kiếm bằng mã lịch hẹn, tên dịch vụ hoặc tên bác sĩ khác.',
                false
              )
            )
          ) : activeTab === 'upcoming' ? (
            /* TAB LỊCH HẸN SẮP TỚI */
            upcomingList.length === 0 ? (
              renderEmptyState(
                'Bạn hiện không có lịch hẹn khám nào sắp tới',
                'Quý khách có thể dễ dàng đặt lịch khám trực tuyến để được phân bổ bác sĩ và giờ khám ưu tiên.',
                true
              )
            ) : (
              <>
                {/* 5. HERO CARD: LỊCH HẸN GẦN NHẤT SẮP DIỄN RA */}
                {nextAppointment && (
                  <article className="pap-hero-next-card">
                    <div className="pap-hero-ribbon">
                      ⭐ Lịch Hẹn Gần Nhất Sắp Diễn Ra
                    </div>

                    <div className="pap-hero-body">
                      <div className="pap-hero-main-info">
                        <h2 className="pap-hero-service-title">
                          {nextAppointment.pricing?.serviceName || 'Dịch vụ khám y tế Tâm An'}
                        </h2>

                        <div className="pap-hero-datetime-box">
                          <span className="pap-hero-time-badge">
                            {formatTimeRange(nextAppointment.startAt, nextAppointment.endAt)}
                          </span>
                          <div className="pap-hero-date-text">
                            {formatWeekday(nextAppointment.startAt)}, {formatDateDisplay(nextAppointment.startAt)}
                          </div>
                        </div>

                        <div className="pap-hero-meta-row">
                          <div className="pap-hero-meta-item">
                            <Stethoscope size={16} color="#0b4f9c" />
                            <span>Bác sĩ phụ trách: <strong>{getDoctorDisplay(nextAppointment)}</strong></span>
                            {nextAppointment.selectionMode === 'RANK' && (
                              <span className="pap-auto-tag">Tự động sắp xếp</span>
                            )}
                          </div>

                          <div className="pap-hero-meta-item">
                            <Building2 size={16} color="#0b4f9c" />
                            <span>
                              Chuyên khoa: <strong>{nextAppointment.specialtyId ? specialtyMap.get(nextAppointment.specialtyId)?.name : 'Sản Phụ khoa'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pap-hero-actions-col">
                        <div className="pap-hero-code-box">
                          <span>Mã phiếu:</span>
                          <span className="pap-hero-code-val">{nextAppointment.appointmentCode}</span>
                          <button
                            type="button"
                            className="pap-btn-copy-code"
                            onClick={() => handleCopyCode(nextAppointment.appointmentCode)}
                            title="Sao chép mã"
                          >
                            {copiedCode ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                          </button>
                        </div>

                        <div className="pap-hero-price-tag">
                          Tạm tính: {formatVnd(nextAppointment.pricing?.estimatedTotalMinor)}
                        </div>

                        <button
                          type="button"
                          className="pap-btn-hero-view"
                          onClick={() => setSelectedTicket(nextAppointment)}
                        >
                          <FileText size={16} />
                          <span>Xem Chi Tiết Phiếu Hẹn</span>
                        </button>
                      </div>
                    </div>
                  </article>
                )}

                {/* Nếu chỉ có duy nhất 1 lịch hẹn: hiển thị thông báo đã xác nhận, TUYỆT ĐỐI KHÔNG HIỂN THỊ EMPTY STATE */}
                {upcomingList.length === 1 ? (
                  <div className="pap-single-appointment-note">
                    <div className="pap-single-note-left">
                      <CheckCircle2 size={18} color="#16a34a" />
                      <span>Lịch hẹn của bạn đã được xác nhận. Vui lòng có mặt trước 15 phút tại Quầy tiếp đón Tầng 1.</span>
                    </div>
                    <AppLink href="/dat-lich" className="pap-single-note-action">
                      + Đặt thêm lịch khám khác
                    </AppLink>
                  </div>
                ) : (
                  /* Nếu có từ 2 lịch hẹn trở lên: hiển thị danh sách các lịch hẹn tiếp theo */
                  <>
                    <div className="pap-sublist-header">
                      <h3 className="pap-sublist-title">
                        Các lịch hẹn sắp tới khác ({upcomingList.length - 1})
                      </h3>
                    </div>
                    <div className="pap-cards-list">
                      {upcomingList.slice(1).map(renderAppointmentCard)}
                    </div>
                  </>
                )}
              </>
            )
          ) : (
            /* CÁC TAB KHÁC (past, cancelled, all) */
            displayedAppointments.length > 0 ? (
              <div className="pap-cards-list">
                {displayedAppointments.map(renderAppointmentCard)}
              </div>
            ) : (
              renderEmptyState(
                activeTab === 'past'
                  ? 'Bạn chưa có lịch sử khám nào hoàn thành'
                  : activeTab === 'cancelled'
                  ? 'Không có lịch hẹn nào bị hủy'
                  : 'Bạn chưa có lịch hẹn khám nào trong hệ thống',
                activeTab === 'past'
                  ? 'Các lịch khám sau khi hoàn tất sẽ được lưu trữ và tổng hợp tại đây.'
                  : activeTab === 'cancelled'
                  ? 'Không có lịch hẹn nào bị hủy trong danh sách của bạn.'
                  : 'Hãy bắt đầu đặt lịch khám thai sản trực tuyến với dịch vụ y tế chuẩn quốc tế của Tâm An.',
                true
              )
            )
          )}
        </div>
      </main>

      <PublicPortalFooter />

      {/* 8. MODAL XEM CHI TIẾT PHIẾU KHÁM BỆNH (TICKET MODAL) - Mở rộng chiều ngang, không cuộn */}
      <AppointmentTicketModal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        appointment={selectedTicket}
        patientProfile={patientProfile}
        fallbackDoctorName={selectedTicket ? getDoctorDisplay(selectedTicket) : undefined}
        fallbackSpecialtyName={selectedTicket?.specialtyId ? specialtyMap.get(selectedTicket.specialtyId)?.name : 'Sản Phụ khoa'}
        fallbackServiceName={selectedTicket?.pricing?.serviceName || 'Dịch vụ khám Sản Phụ khoa'}
        fallbackRoomName={selectedTicket?.roomName || selectedTicket?.roomCode || 'Quầy tiếp đón Tầng 1'}
      />
    </div>
  );
}

/**
 * TRANG CHI TIẾT PHIẾU HẸN (Đường dẫn trực tiếp /lich-hen/:id)
 */
export function AppointmentDetailPage({ appointmentId }: { appointmentId: string }) {
  const auth = useAuthSession();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      getAppointment(auth.request, appointmentId),
      getMyPatient(auth.request).catch(() => null),
    ])
      .then(([apt, profile]) => {
        if (!active) return;
        setAppointment(apt);
        setPatientProfile(profile);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Không tìm thấy thông tin phiếu hẹn khám này.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [auth.request, appointmentId]);

  const handleCopyCode = () => {
    if (appointment?.appointmentCode) {
      navigator.clipboard.writeText(appointment.appointmentCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const badge = getStatusBadge(appointment?.status);

  return (
    <div className="patient-modern-portal-shell">
      <PublicPortalHeader />

      <main className="patient-modern-portal-main pap-page">
        <div className="portal-container pap-container">
          <nav className="pap-breadcrumbs">
            <AppLink href="/lich-hen" className="pap-breadcrumb-link">
              <ChevronLeft size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Lịch hẹn của tôi
            </AppLink>
            <span>/</span>
            <span>Chi tiết phiếu hẹn</span>
          </nav>

          {loading ? (
            <div className="pap-empty-state">
              <div className="pap-empty-icon">
                <RefreshCw size={28} className="animate-spin" />
              </div>
              <h3 className="pap-empty-title">Đang tải phiếu khám...</h3>
            </div>
          ) : error || !appointment ? (
            <div className="pap-empty-state">
              <div className="pap-empty-icon">
                <XCircle size={32} color="#ef4444" />
              </div>
              <h3 className="pap-empty-title">Không tìm thấy phiếu hẹn khám</h3>
              <p className="pap-empty-desc">{error || 'Phiếu hẹn có thể đã bị xóa hoặc không thuộc quyền truy cập.'}</p>
              <AppLink href="/lich-hen" className="pap-btn-book-new">
                Quay lại danh sách lịch hẹn
              </AppLink>
            </div>
          ) : (
            <div style={{ maxWidth: '820px', margin: '0 auto' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img src="/brand/logo-symbol-cropped.png" alt="Tâm An" style={{ height: '36px' }} />
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a' }}>PHIẾU HẸN KHÁM BỆNH ĐIỆN TỬ</h2>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Bệnh viện Phụ sản Tâm An · Hà Nội</p>
                    </div>
                  </div>
                  <span className={`pap-status-badge ${badge.className}`}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                <div className="pap-ticket-code-banner">
                  <div className="pap-ticket-code-label">MÃ PHIẾU TIẾP ĐÓN</div>
                  <div className="pap-ticket-code-num">{appointment.appointmentCode}</div>
                  <button
                    type="button"
                    className="pap-btn-copy-code"
                    style={{ margin: '8px auto 0', fontSize: '13px', display: 'inline-flex', gap: '4px' }}
                    onClick={handleCopyCode}
                  >
                    {copiedCode ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                  </button>
                </div>

                <div className="pap-ticket-section">
                  <h5 className="pap-ticket-sec-title">1. Thông tin người khám</h5>
                  <div className="pap-ticket-grid">
                    <div className="pap-ticket-field">
                      <span className="pap-ticket-field-label">Họ và tên:</span>
                      <strong className="pap-ticket-field-val">{patientProfile?.fullName || 'Bệnh nhân'}</strong>
                    </div>
                    <div className="pap-ticket-field">
                      <span className="pap-ticket-field-label">Ngày sinh:</span>
                      <span className="pap-ticket-field-val">{formatDateDisplay(patientProfile?.dateOfBirth)}</span>
                    </div>
                    <div className="pap-ticket-field">
                      <span className="pap-ticket-field-label">Số điện thoại:</span>
                      <span className="pap-ticket-field-val">{patientProfile?.phoneNumber || '--'}</span>
                    </div>
                    <div className="pap-ticket-field">
                      <span className="pap-ticket-field-label">CCCD:</span>
                      <span className="pap-ticket-field-val">{patientProfile?.nationalIdMasked || '--'}</span>
                    </div>
                  </div>
                </div>

                <div className="pap-ticket-section">
                  <h5 className="pap-ticket-sec-title">2. Thông tin lịch khám</h5>
                  <div className="pap-ticket-grid">
                    <div className="pap-ticket-field" style={{ gridColumn: '1 / -1' }}>
                      <span className="pap-ticket-field-label">Dịch vụ:</span>
                      <strong className="pap-ticket-field-val" style={{ color: '#0b4f9c', fontSize: '16px' }}>
                        {appointment.pricing?.serviceName}
                      </strong>
                    </div>
                    <div className="pap-ticket-field">
                      <span className="pap-ticket-field-label">Thời gian:</span>
                      <strong className="pap-ticket-field-val" style={{ color: '#0b4f9c' }}>
                        {formatTimeRange(appointment.startAt, appointment.endAt)}
                      </strong>
                    </div>
                    <div className="pap-ticket-field">
                      <span className="pap-ticket-field-label">Ngày khám:</span>
                      <strong className="pap-ticket-field-val">
                        {formatWeekday(appointment.startAt)}, {formatDateDisplay(appointment.startAt)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px 20px', borderRadius: '12px', marginTop: '20px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>Tổng chi phí tạm tính:</span>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: '#0b4f9c' }}>
                    {formatVnd(appointment.pricing?.estimatedTotalMinor)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '28px', justifyContent: 'flex-end' }}>
                  <button type="button" className="pap-btn-secondary" onClick={() => window.print()}>
                    <Printer size={15} style={{ display: 'inline', marginRight: '6px' }} /> In phiếu hẹn
                  </button>
                  <AppLink href="/lich-hen" className="pap-btn-primary">
                    Về danh sách lịch hẹn
                  </AppLink>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <PublicPortalFooter />
    </div>
  );
}
