import { useEffect, useState } from 'react';
import { AppLink } from '../../../app/navigation';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { ChatbotLauncher } from '../components/chatbot/ChatbotLauncher';
import { fetchSpecialties, type SpecialtyItem } from '../../../services/specialty';
import { apiRequest } from '../../../services/api';

interface PatientSpecialtyDetailPageProps {
  slug: string;
}

type TabType = 'overview' | 'services' | 'doctors';

interface DoctorProfileData {
  doctorId?: string;
  fullName?: string;
  professionalTitle?: string;
  biography?: string;
  practiceStartYear?: number;
  languages?: string[];
  photoUrl?: string;
}

interface DoctorData {
  id: string;
  status: string;
  consultationRank: string;
  roomId?: string;
  roomCode?: string;
  roomName?: string;
  room?: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
  profile?: DoctorProfileData;
  specialties?: Array<{
    id: string;
    code: string;
    name: string;
    isPrimary?: boolean;
  }>;
}

interface ServicePriceData {
  amountMinor: number;
  currency: string;
}

interface ServiceData {
  id: string;
  code: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  kind?: string;
  specialtyId?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  bookingEnabled?: boolean;
  prices?: ServicePriceData[];
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }} aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }} aria-hidden="true">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function GraduationCapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden="true">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function HospitalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden="true">
      <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M9 10h6M12 7v6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DoctorAvatarFallback() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48 }} aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function getDoctorExperienceText(startYear?: number) {
  if (!startYear || typeof startYear !== 'number') return null;
  const currentYear = new Date().getFullYear();
  const years = currentYear - startYear;
  if (years <= 0) return 'Dưới 1 năm kinh nghiệm';
  return `Hơn ${years} năm kinh nghiệm (từ ${startYear})`;
}

function getDoctorRankLabel(rank?: string) {
  switch (rank) {
    case 'EXPERT':
      return 'Cố vấn Chuyên gia Cao cấp';
    case 'HEAD_DOCTOR':
      return 'Bác sĩ Trưởng khoa';
    case 'PROFESSOR':
      return 'Giáo sư Bác sĩ';
    case 'ASSOC_PROFESSOR':
      return 'Phó Giáo sư Bác sĩ';
    case 'SPECIALIST_II':
      return 'Bác sĩ Chuyên khoa II';
    case 'SPECIALIST_I':
      return 'Bác sĩ Chuyên khoa I';
    case 'MASTER':
      return 'Thạc sĩ Bác sĩ';
    case 'BASIC':
      return 'Bác sĩ Chuyên khoa';
    default:
      return null;
  }
}

function getDoctorLanguagesLabel(languages?: string[]) {
  if (!languages || languages.length === 0) return 'Tiếng Việt';
  const map: Record<string, string> = {
    vi: 'Tiếng Việt',
    en: 'Tiếng Anh',
    fr: 'Tiếng Pháp',
    zh: 'Tiếng Trung',
  };
  return languages.map((l) => map[l.toLowerCase()] || l).join(', ');
}

export function PatientSpecialtyDetailPage({ slug }: PatientSpecialtyDetailPageProps) {
  const [specialty, setSpecialty] = useState<SpecialtyItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorData | null>(null);

  // 1. Fetch thông tin chuyên khoa từ API chính xác
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchSpecialties()
      .then((items) => {
        if (!active) return;
        const match = items.find(
          (item) => item.slug === slug || item.code?.toLowerCase() === slug.toLowerCase()
        );
        if (match) {
          setSpecialty(match);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  // 2. Tải danh sách Bác sĩ và Dịch vụ liên kết theo specialtyId
  useEffect(() => {
    if (!specialty?.id) return;
    let active = true;

    // Fetch doctors
    setDoctorsLoading(true);
    apiRequest<{ data: DoctorData[] }>(`/api/doctors?specialtyId=${encodeURIComponent(specialty.id)}`)
      .then((res) => {
        if (!active) return;
        setDoctors(res.data || []);
        setDoctorsLoading(false);
      })
      .catch(() => {
        if (active) setDoctorsLoading(false);
      });

    // Fetch catalog services
    setServicesLoading(true);
    apiRequest<{ data: ServiceData[] }>(`/api/catalog/services?specialtyId=${encodeURIComponent(specialty.id)}`)
      .then((res) => {
        if (!active) return;
        // Filter exactly matching this specialty
        const list = res.data || [];
        const filtered = list.filter((s) => s.specialtyId === specialty.id);
        setServices(filtered.length > 0 ? filtered : list);
        setServicesLoading(false);
      })
      .catch(() => {
        if (active) setServicesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [specialty?.id]);

  const rawName = specialty?.name || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const displayName = rawName.startsWith('Chuyên khoa') ? rawName : rawName;
  const overview = specialty?.overview;

  const formatPrice = (amountMinor?: number) => {
    if (!amountMinor) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN').format(amountMinor) + ' ₫';
  };

  return (
    <div className="portal-page-wrapper">
      {/* 1. Header Vinmec Style đồng bộ với trang chủ */}
      <PublicPortalHeader />

      {/* 2. Nội dung chính: Độ rộng căn chuẩn theo navbar (portal-container 1340px) */}
      <main className="portal-specialty-detail-main">
        <div className="portal-container">
          {/* Breadcrumb: [Trang chủ] / {displayName} */}
          <nav aria-label="Breadcrumb" className="portal-specialty-breadcrumb">
            <AppLink href="/" className="portal-specialty-breadcrumb-link">
              Trang chủ
            </AppLink>
            <span className="portal-specialty-breadcrumb-separator">/</span>
            <span className="portal-specialty-breadcrumb-current">
              {displayName}
            </span>
          </nav>

          {/* Tiêu đề Chuyên khoa (chỉ hiển thị tên chuyên khoa) */}
          <h1 className="portal-specialty-header-title">
            {displayName}
          </h1>

          {/* Thanh chuyển 3 Tab: [Tổng quan] [Dịch vụ] [Danh sách bác sĩ] */}
          <div className="portal-specialty-tabs-bar" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              className={`portal-specialty-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Tổng quan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'services'}
              className={`portal-specialty-tab-btn ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              Dịch vụ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'doctors'}
              className={`portal-specialty-tab-btn ${activeTab === 'doctors' ? 'active' : ''}`}
              onClick={() => setActiveTab('doctors')}
            >
              Danh sách bác sĩ
            </button>
          </div>

          {/* NỘI DUNG TAB 1: TỔNG QUAN CHUYÊN KHOA (Toàn bộ dữ liệu thật từ DB, không mockdata, không ảnh) */}
          {activeTab === 'overview' && (
            <div className="portal-overview-wrap" role="tabpanel">
              {/* Khối 1: Giới thiệu tổng quan */}
              <div className="portal-overview-card">
                <p className="portal-overview-intro">
                  {overview?.intro || specialty?.description || 'Thông tin chuyên khoa đang được cập nhật.'}
                </p>
              </div>

              {/* Khối 2: Phạm vi điều trị & Các diện bệnh tiếp nhận (Scope of Care) */}
              {overview?.scopeOfCare && overview.scopeOfCare.length > 0 && (
                <div className="portal-scope-card">
                  <div className="portal-section-header-compact">
                    <CheckCircleIcon />
                    <h3 className="portal-section-title-compact">Phạm vi tiếp nhận & Các diện bệnh thăm khám</h3>
                  </div>
                  <div className="portal-scope-tags-grid">
                    {overview.scopeOfCare.map((item, idx) => (
                      <div key={idx} className="portal-scope-tag-item">
                        <span className="portal-scope-bullet"></span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Khối 3: Tiêu chuẩn chuyên môn & Quy trình y khoa quốc tế */}
              {overview?.standardTitle && (
                <div className="portal-standard-card">
                  <div className="portal-section-header-compact">
                    <ShieldCheckIcon />
                    <h3 className="portal-section-title-compact">{overview.standardTitle}</h3>
                  </div>
                  <p className="portal-standard-desc-text">
                    {overview.standardDesc}
                  </p>
                </div>
              )}

              {/* Khối 4: Ma trận Chẩn đoán & Điều trị 2 cột cân đối */}
              <div className="portal-overview-two-col">
                {/* Cột trái: Kỹ thuật Chẩn đoán & Thăm dò */}
                <div className="portal-overview-col-card portal-diag-col">
                  <div className="portal-col-header">
                    <StethoscopeIcon />
                    <h3 className="portal-overview-col-title">
                      {overview?.diagnosticTitle || 'Chẩn đoán & Thăm dò Kỹ thuật cao'}
                    </h3>
                  </div>
                  <ul className="portal-overview-list">
                    {(overview?.diagnostics || []).map((item, idx) => (
                      <li key={idx} className="portal-overview-list-item">
                        <span className="portal-scope-bullet"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cột phải: Phương pháp Điều trị & Can thiệp */}
                <div className="portal-overview-col-card portal-treat-col">
                  <div className="portal-col-header">
                    <ActivityIcon />
                    <h3 className="portal-overview-col-title">
                      {overview?.treatmentTitle || 'Phương pháp Điều trị & Can thiệp'}
                    </h3>
                  </div>
                  <ul className="portal-overview-list">
                    {(overview?.treatments || []).map((item, idx) => (
                      <li key={idx} className="portal-overview-list-item">
                        <span className="portal-scope-bullet"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Khối 5: Hướng dẫn dành cho người bệnh trước khi đến khám */}
              {overview?.patientNotes && (
                <div className="portal-patient-notes-card">
                  <div className="portal-notes-icon">
                    <InfoIcon />
                  </div>
                  <div className="portal-notes-content">
                    <h4 className="portal-notes-title">Lưu ý dành cho người bệnh trước khi đến khám</h4>
                    <p className="portal-notes-text">{overview.patientNotes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NỘI DUNG TAB 2: DỊCH VỤ (Hiển thị như mẫu Vinmec kèm ảnh, description, giá & đặt lịch) */}
          {activeTab === 'services' && (
            <div className="portal-services-tab-wrap" role="tabpanel">
              {servicesLoading ? (
                <div className="portal-empty-card">Đang tải danh mục dịch vụ từ hệ thống...</div>
              ) : services.length === 0 ? (
                <div className="portal-empty-card">
                  Chưa có dịch vụ nào được cấu hình cho chuyên khoa này. Vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.
                </div>
              ) : (
                <div className="portal-services-showcase-list">
                  {services.map((svc, idx) => {
                    const priceItem = svc.prices?.[0];
                    const isReverse = idx % 2 === 1;
                    const thumbUrl =
                      svc.thumbnailUrl ||
                      'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=85';

                    return (
                      <div
                        key={svc.id}
                        className={`portal-service-showcase-row ${isReverse ? 'reverse' : ''}`}
                      >
                        {/* Cột Nội dung chi tiết */}
                        <div className="portal-service-showcase-content">
                          <div className="portal-service-tag">
                            Chuyên khoa {displayName}
                          </div>
                          <h3 className="portal-service-showcase-title">
                            <AppLink href={`/dich-vu/${svc.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                              {svc.name}
                            </AppLink>
                          </h3>
                          <p className="portal-service-showcase-desc">
                            {svc.description || svc.summary}
                          </p>

                          <div className="portal-service-showcase-footer">
                            <div className="portal-service-price-block">
                              <span className="portal-service-price-label">Giá niêm yết</span>
                              <span className="portal-service-price-val">
                                {formatPrice(priceItem?.amountMinor)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <AppLink
                                href={`/dich-vu/${svc.slug}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '8px 16px',
                                  borderRadius: '8px',
                                  border: '1.5px solid #0f4c81',
                                  color: '#0f4c81',
                                  fontSize: '13.5px',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                  background: '#ffffff',
                                  transition: 'all 0.2s',
                                }}
                              >
                                Xem chi tiết
                              </AppLink>
                              <AppLink
                                href={`/dat-lich?serviceId=${encodeURIComponent(svc.id)}`}
                                className="portal-service-book-btn"
                              >
                                <CalendarIcon />
                                <span>Đặt lịch</span>
                              </AppLink>
                            </div>
                          </div>
                        </div>

                        {/* Cột Hình ảnh */}
                        <div className="portal-service-showcase-media">
                          <img
                            src={thumbUrl}
                            alt={svc.name}
                            className="portal-service-showcase-img"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* NỘI DUNG TAB 3: DANH SÁCH BÁC SĨ (Grid 2 cột chuẩn thiết kế) */}
          {activeTab === 'doctors' && (
            <div className="portal-doctors-tab-wrap" role="tabpanel">
              {doctorsLoading ? (
                <div className="portal-doc-loading-card">
                  <div className="portal-doc-loading-spinner" />
                  <p>Đang tải danh sách bác sĩ chuyên khoa từ hệ thống...</p>
                </div>
              ) : doctors.length === 0 ? (
                <div className="portal-empty-card">
                  <InfoIcon />
                  <p style={{ margin: '8px 0', fontWeight: 600, color: '#1e293b' }}>
                    Hiện chưa có bác sĩ trực thuộc chuyên khoa này trong hệ thống.
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                    Vui lòng liên hệ hotline tổng đài <strong>1900 6868</strong> để được hỗ trợ điều phối lịch hẹn.
                  </p>
                </div>
              ) : (
                <div className="portal-doctors-two-col-grid">
                  {doctors.map((doc) => {
                    const profile = doc.profile;
                    const docName = profile?.fullName || 'Bác sĩ chuyên khoa';
                    const docTitle = profile?.professionalTitle || 'Bác sĩ Sản Phụ khoa';
                    const docPhoto = profile?.photoUrl;
                    const docExp = getDoctorExperienceText(profile?.practiceStartYear);
                    const rankLabel = getDoctorRankLabel(doc.consultationRank);
                    const docRoom = doc.roomName
                      ? `${doc.roomName}${doc.roomCode ? ` (${doc.roomCode})` : ''}`
                      : doc.roomCode || 'Phòng khám chuyên khoa';

                    return (
                      <div key={doc.id} className="portal-doc-card">
                        {/* Thân card: Ảnh đại diện + Thông tin chuyên môn */}
                        <div className="portal-doc-card-body">
                          {/* Cột trái: Ảnh chân dung */}
                          <div className="portal-doc-avatar-box">
                            <div
                              className="portal-doc-avatar-wrap"
                              onClick={() => setSelectedDoctor(doc)}
                              title="Bấm để xem hồ sơ bác sĩ"
                            >
                              {docPhoto ? (
                                <img
                                  src={docPhoto}
                                  alt={docName}
                                  className="portal-doc-photo"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="portal-doc-photo-fallback">
                                  <DoctorAvatarFallback />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Cột phải: Thông tin bác sĩ phong phú từ DB */}
                          <div className="portal-doc-meta-box">
                            {/* Tên bác sĩ */}
                            <h3
                              className="portal-doc-name"
                              onClick={() => setSelectedDoctor(doc)}
                              title="Bấm để xem hồ sơ bác sĩ"
                            >
                              {docName}
                            </h3>

                            {/* Danh sách chuyên khoa phụ trách (chuyên khoa lên TRƯỚC học vấn) */}
                            {doc.specialties && doc.specialties.length > 0 && (
                              <div className="portal-doc-specs-tags">
                                {[...doc.specialties]
                                  .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                                  .map((s) => {
                                    const isPrimary = Boolean(s.isPrimary) || doc.specialties?.length === 1;
                                    return (
                                      <span
                                        key={s.id}
                                        className={`portal-doc-spec-chip ${isPrimary ? 'primary' : ''}`}
                                      >
                                        {s.name}
                                      </span>
                                    );
                                  })}
                              </div>
                            )}

                            {/* Học hàm / chức danh (bên dưới chuyên khoa) */}
                            <div className="portal-doc-title">
                              <GraduationCapIcon />
                              <span>{docTitle}</span>
                            </div>

                            {/* Các thông tin chi tiết */}
                            <div className="portal-doc-info-list">
                              {docExp && (
                                <div className="portal-doc-info-row">
                                  <ClockIcon />
                                  <span>{docExp}</span>
                                </div>
                              )}

                              <div className="portal-doc-info-row">
                                <HospitalIcon />
                                <span>Bệnh viện Phụ sản Tâm An</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Chân card: 2 nút hành động Xem hồ sơ và Đặt lịch khám */}
                        <div className="portal-doc-card-footer">
                          <button
                            type="button"
                            className="portal-doc-outline-btn"
                            onClick={() => setSelectedDoctor(doc)}
                          >
                            <EyeIcon />
                            <span>Xem hồ sơ</span>
                          </button>
                          <AppLink
                            href={`/dat-lich?doctorId=${encodeURIComponent(doc.id)}&specialtyId=${encodeURIComponent(specialty?.id || '')}`}
                            className="portal-doc-primary-btn"
                          >
                            <CalendarIcon />
                            <span>Đặt lịch khám</span>
                          </AppLink>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 2. Modal Chi tiết Bác sĩ (Lấy 100% dữ liệu từ DB) */}
      {selectedDoctor && (
        <div
          className="portal-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedDoctor(null)}
        >
          <div
            className="portal-doc-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="portal-doc-modal-header">
              <div className="portal-doc-modal-badge">
                <StethoscopeIcon />
                <span>Hồ sơ Bác sĩ Chuyên khoa • Bệnh viện Phụ sản Tâm An</span>
              </div>
              <button
                type="button"
                className="portal-doc-modal-close"
                onClick={() => setSelectedDoctor(null)}
                aria-label="Đóng"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Modal Body */}
            <div className="portal-doc-modal-body">
              {/* Profile Top */}
              <div className="portal-doc-modal-top">
                <div className="portal-doc-modal-avatar-wrap">
                  {selectedDoctor.profile?.photoUrl ? (
                    <img
                      src={selectedDoctor.profile.photoUrl}
                      alt={selectedDoctor.profile.fullName || 'Bác sĩ'}
                      className="portal-doc-modal-avatar"
                    />
                  ) : (
                    <div className="portal-doc-modal-avatar-fallback">
                      <DoctorAvatarFallback />
                    </div>
                  )}
                </div>
                <div className="portal-doc-modal-top-info">
                  <h2 className="portal-doc-modal-name">
                    {selectedDoctor.profile?.fullName || 'Bác sĩ chuyên khoa'}
                  </h2>

                  {/* Danh sách thẻ chuyên khoa (chuyên khoa lên TRƯỚC học vấn) */}
                  {selectedDoctor.specialties && selectedDoctor.specialties.length > 0 && (
                    <div className="portal-doc-specs-tags" style={{ margin: '4px 0 6px 0' }}>
                      {[...selectedDoctor.specialties]
                        .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                        .map((s) => {
                          const isPrimary = Boolean(s.isPrimary) || selectedDoctor.specialties?.length === 1;
                          return (
                            <span
                              key={s.id}
                              className={`portal-doc-spec-chip ${isPrimary ? 'primary' : ''}`}
                            >
                              {s.name}
                            </span>
                          );
                        })}
                    </div>
                  )}

                  <div className="portal-doc-modal-title">
                    <GraduationCapIcon />
                    <span>{selectedDoctor.profile?.professionalTitle || 'Bác sĩ Sản Phụ khoa'}</span>
                  </div>
                  <div className="portal-doc-modal-badges">
                    <span className="portal-hospital-tag">
                      <HospitalIcon />
                      <span>Bệnh viện Phụ sản Tâm An</span>
                    </span>
                    <span className="portal-status-online-tag">
                      <span className="portal-doc-pulse-dot" />
                      <span>Sẵn sàng tiếp nhận khám</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Specs Grid */}
              <div className="portal-doc-modal-grid">
                {selectedDoctor.profile?.practiceStartYear && (
                  <div className="portal-doc-metric-item">
                    <div className="portal-metric-icon">
                      <ClockIcon />
                    </div>
                    <div className="portal-metric-text">
                      <span className="portal-metric-label">Kinh nghiệm lâm sàng</span>
                      <span className="portal-metric-val">
                        {getDoctorExperienceText(selectedDoctor.profile.practiceStartYear)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="portal-doc-metric-item">
                  <div className="portal-metric-icon">
                    <StethoscopeIcon />
                  </div>
                  <div className="portal-metric-text">
                    <span className="portal-metric-label">Chuyên khoa đảm nhiệm</span>
                    <span className="portal-metric-val">
                      {selectedDoctor.specialties && selectedDoctor.specialties.length > 0
                        ? [...selectedDoctor.specialties]
                            .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                            .map((s) =>
                              s.isPrimary && (selectedDoctor.specialties?.length || 0) > 1
                                ? `${s.name} (Chính)`
                                : s.name
                            )
                            .join(', ')
                        : displayName}
                    </span>
                  </div>
                </div>

                <div className="portal-doc-metric-item">
                  <div className="portal-metric-icon">
                    <GlobeIcon />
                  </div>
                  <div className="portal-metric-text">
                    <span className="portal-metric-label">Ngôn ngữ tư vấn</span>
                    <span className="portal-metric-val">
                      {getDoctorLanguagesLabel(selectedDoctor.profile?.languages)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tiểu sử & Quá trình công tác */}
              {selectedDoctor.profile?.biography && (
                <div className="portal-doc-modal-bio">
                  <h4 className="portal-doc-bio-heading">Quá trình đào tạo & Thế mạnh chuyên môn</h4>
                  <p className="portal-doc-bio-text">{selectedDoctor.profile.biography}</p>
                </div>
              )}

              {/* Cam kết tiêu chuẩn y tế */}
              <div className="portal-doc-modal-commitment">
                <ShieldCheckIcon />
                <span>
                  Bệnh viện Phụ sản Tâm An cam kết tuân thủ quy trình khám chữa bệnh quốc tế, phác đồ điều trị cá thể hóa và bảo mật toàn diện thông tin bệnh án người bệnh.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="portal-doc-modal-footer">
              <button
                type="button"
                className="portal-doc-modal-cancel-btn"
                onClick={() => setSelectedDoctor(null)}
              >
                Đóng
              </button>
              <AppLink
                href={`/dat-lich?doctorId=${encodeURIComponent(selectedDoctor.id)}&specialtyId=${encodeURIComponent(specialty?.id || '')}`}
                className="portal-doc-modal-book-btn"
              >
                <CalendarIcon />
                <span>Đặt lịch khám với bác sĩ</span>
              </AppLink>
            </div>
          </div>
        </div>
      )}

      {/* 3. Floating Mascot Chatbot Launcher */}
      <ChatbotLauncher />

      {/* 4. Footer Vinmec Style đồng bộ với trang chủ */}
      <PublicPortalFooter />
    </div>
  );
}
